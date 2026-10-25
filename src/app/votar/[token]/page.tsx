import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { TEAM_META, isTeam, teamsFor } from "@/lib/teams";
import { VoteForm } from "@/components/vote-form";
import { Loading, TeamDot } from "@/components/ui";

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
    include: { attendances: { where: { team: { not: null } }, include: { player: true } } },
  });
  if (!match) notFound();

  const order = teamsFor(match.numTeams) as string[];
  const people = match.attendances
    .map((a) => ({ id: a.playerId, name: a.player.name, team: a.team, isGoalkeeper: a.asGoalkeeper }))
    .sort((a, b) => order.indexOf(a.team ?? "") - order.indexOf(b.team ?? "") || a.name.localeCompare(b.name));

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

  const voterId = typeof sp.jogador === "string" ? sp.jogador : undefined;
  const voter = people.find((p) => p.id === voterId);

  if (!voter) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-3xl leading-tight">Quem é você?</h2>
          <p className="mt-1 text-xs text-moss-soft">Selecione seu nome para abrir a cédula de votação.</p>
        </div>

        <ul className="border-[3px] border-moss bg-paper shadow-hard divide-y-2 divide-dashed divide-moss/30">
          {people.map((p) => {
            const meta = isTeam(p.team) ? TEAM_META[p.team] : null;
            return (
              <li key={p.id}>
                <Link
                  href={`/votar/${token}?jogador=${p.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper-dark"
                  id={`eu-sou-${p.id}`}
                >
                  <span className={`size-3 shrink-0 border-2 border-moss ${meta?.swatch ?? "bg-paper"}`} aria-hidden="true" />
                  <span className="flex-1 font-serif text-lg leading-tight">{p.name}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-moss-soft">
                    {meta?.label}
                  </span>
                  <ChevronRight className="size-4 text-moss-soft" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const existing = await db.vote.findMany({ where: { matchId: match.id, voterId: voter.id } });
  const initial = Object.fromEntries(existing.map((v) => [v.targetId, v.score]));
  const others = people.filter((p) => p.id !== voter.id);

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de identificação do votante */}
      <div className="flex items-center gap-3 border-[3px] border-moss bg-paper-dark px-3 py-2.5 shadow-hard-sm">
        <TeamDot team={voter.team ?? ""} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Votando como</p>
          <p className="truncate font-serif text-lg leading-tight">{voter.name}</p>
        </div>
        <Link
          href={`/votar/${token}`}
          className="border-2 border-moss px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-paper"
        >
          Trocar
        </Link>
      </div>

      <VoteForm
        token={token}
        voter={voter}
        teammates={others.filter((p) => p.team === voter.team)}
        others={others.filter((p) => p.team !== voter.team)}
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
