import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { VoteForm } from "@/components/vote-form";
import { VoterSelector } from "@/components/voter-selector";
import { Loading, TeamColorBadge } from "@/components/ui";
import SpotlightCard from "@/components/SpotlightCard";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";

async function VoteView({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const match = await db.match.findUnique({
    where: { voteToken: token },
    include: { attendances: { include: { player: true } } },
  });
  if (!match) notFound();

  const people = match.attendances
    .map((a) => ({
      id: a.playerId,
      name: a.player.name,
      team: a.team,
      isGoalkeeper: a.asGoalkeeper || a.player.isGoalkeeper,
      pin: a.player.pin,
      hasPin: Boolean(a.player.pin),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!match.votingOpen) {
    return (
      <SpotlightCard className="border border-moss/15 bg-paper p-6 rounded-2xl text-center shadow-hard fut-grid-bg">
        <h2 className="font-serif text-2xl">
          <SplitText text="Votação Fechada" tag="span" textAlign="center" />
        </h2>
        <p className="mt-2 text-xs text-moss-soft">Esta votação não está recebendo notas no momento.</p>
        <Link
          href={`/partida/${match.id}`}
          className="mt-4 inline-flex items-center rounded-lg border border-moss/20 bg-paper-dark px-4 py-2 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm"
        >
          Ver Resumo da Partida
        </Link>
      </SpotlightCard>
    );
  }

  const votesInMatch = await db.vote.findMany({
    where: { matchId: match.id },
    select: { voterId: true },
    distinct: ["voterId"],
  });
  const votedIds = new Set(votesInMatch.map((v) => v.voterId));

  const voterId = typeof sp.jogador === "string" ? sp.jogador : undefined;
  const voter = people.find((p) => p.id === voterId);

  // Verificar no servidor se o jogador tem PIN e se o cookie de PIN é válido
  let isVoterPinVerified = true;
  if (voter && voter.pin) {
    const cookieStore = await cookies();
    const cookiePin = cookieStore.get(`player_pin_${voter.id}`)?.value;
    const organizer = await isAdmin();
    isVoterPinVerified = organizer || (cookiePin != null && cookiePin === voter.pin);
  }

  if (!voter || !isVoterPinVerified) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <span className="hud-tag bg-moss text-paper border-transparent mb-1.5">
            <ShinyText text="PÓS-JOGO • AVALIAÇÃO" color="#f6f4ef" shineColor="#d9a520" speed={2.2} />
          </span>
          <h2 className="font-serif text-3xl leading-tight text-moss">
            <SplitText text="Quem é você?" tag="span" />
          </h2>
          <p className="mt-1 text-xs text-moss-soft">Selecione seu nome para abrir a cédula de votação.</p>
        </div>

        <VoterSelector
          token={token}
          people={people.map((p) => ({
            id: p.id,
            name: p.name,
            hasVoted: votedIds.has(p.id),
            hasPin: p.hasPin,
          }))}
        />
      </section>
    );
  }

  if (votedIds.has(voter.id)) {
    return (
      <SpotlightCard className="border border-moss/15 bg-paper p-6 rounded-2xl text-center shadow-hard flex flex-col items-center gap-3 fut-grid-bg">
        <span className="inline-flex items-center justify-center size-10 rounded-xl bg-moss text-paper text-xl shadow-hard-brick">
          ✓
        </span>
        <h2 className="font-serif text-2xl">
          <SplitText text="Voto Já Registrado" tag="span" textAlign="center" />
        </h2>
        <p className="text-xs text-moss-soft max-w-sm">
          <strong>{voter.name}</strong>, sua avaliação para esta partida já foi registrada e não é possível votar novamente.
        </p>
        <Link
          href={`/votar/${token}`}
          className="mt-2 inline-flex items-center rounded-lg border border-moss/20 bg-paper-dark px-4 py-2 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm"
        >
          Voltar à Lista de Jogadores
        </Link>
      </SpotlightCard>
    );
  }

  const existing = await db.vote.findMany({ where: { matchId: match.id, voterId: voter.id } });
  const initial = Object.fromEntries(existing.map((v) => [v.targetId, v.score]));
  const targets = people.filter((p) => p.id !== voter.id);

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de identificação do votante */}
      <div className="flex items-center justify-between border border-moss/15 rounded-xl bg-paper-dark/70 px-4 py-3 shadow-hard-sm">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brick">Votando como</p>
          <div className="flex items-center gap-2 mt-0.5">
            <TeamColorBadge team={voter.team} showLabel />
            <p className="truncate font-serif text-lg leading-tight text-moss">{voter.name}</p>
          </div>
        </div>
        <Link
          href={`/votar/${token}`}
          className="rounded-lg border border-moss/20 bg-white/85 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-moss hover:text-paper transition-colors"
        >
          Trocar
        </Link>
      </div>

      <VoteForm
        token={token}
        voter={voter}
        targets={targets}
        initial={initial}
      />
    </div>
  );
}

export default function VotePage({ params, searchParams }: PageProps<"/votar/[token]">) {
  return (
    <Suspense fallback={<Loading label="Carregando votação…" />}>
      <VoteView params={params} searchParams={searchParams} />
    </Suspense>
  );
}
