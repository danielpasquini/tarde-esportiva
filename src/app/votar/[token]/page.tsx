import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { VoteForm } from "@/components/vote-form";
import { VoterSelector } from "@/components/voter-selector";
import { Loading } from "@/components/ui";

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
      isGoalkeeper: a.asGoalkeeper || a.player.isGoalkeeper,
      pin: a.player.pin,
      hasPin: Boolean(a.player.pin),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!match.votingOpen) {
    return (
      <div className="border-[3px] border-moss bg-paper p-6 text-center shadow-hard">
        <h2 className="font-serif text-2xl">Votação Fechada</h2>
        <p className="mt-2 text-xs text-moss-soft">Esta votação não está recebendo notas no momento.</p>
        <Link
          href={`/partida/${match.id}`}
          className="mt-4 inline-flex items-center border-2 border-moss bg-paper-dark px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm"
        >
          Ver Súmula da Partida
        </Link>
      </div>
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
          <h2 className="font-serif text-3xl leading-tight">Quem é você?</h2>
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
      <div className="border-[3px] border-moss bg-paper p-6 text-center shadow-hard flex flex-col items-center gap-3">
        <span className="text-3xl">✓</span>
        <h2 className="font-serif text-2xl">Voto Já Registrado</h2>
        <p className="text-xs text-moss-soft max-w-sm">
          <strong>{voter.name}</strong>, sua avaliação para esta partida já foi registrada e não é possível votar novamente.
        </p>
        <Link
          href={`/votar/${token}`}
          className="mt-2 inline-flex items-center border-2 border-moss bg-paper-dark px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm"
        >
          Voltar à Lista de Jogadores
        </Link>
      </div>
    );
  }

  const existing = await db.vote.findMany({ where: { matchId: match.id, voterId: voter.id } });
  const initial = Object.fromEntries(existing.map((v) => [v.targetId, v.score]));
  const targets = people.filter((p) => p.id !== voter.id);

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de identificação do votante */}
      <div className="flex items-center justify-between border-[3px] border-moss bg-paper-dark px-4 py-2.5 shadow-hard-sm">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Votando como</p>
          <p className="truncate font-serif text-lg leading-tight text-moss">{voter.name}</p>
        </div>
        <Link
          href={`/votar/${token}`}
          className="border-2 border-moss bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-paper-dark"
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
