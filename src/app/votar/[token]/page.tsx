import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { formatMatchDate } from "@/lib/format";
import { TEAM_META, isTeam, teamsFor } from "@/lib/teams";
import { VoteForm } from "@/components/vote-form";
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
    include: { attendances: { where: { team: { not: null } }, include: { player: true } } },
  });
  if (!match) notFound();

  const order = teamsFor(match.numTeams) as string[];
  const people = match.attendances
    .map((a) => ({ id: a.playerId, name: a.player.name, team: a.team, isGoalkeeper: a.asGoalkeeper }))
    .sort((a, b) => order.indexOf(a.team ?? "") - order.indexOf(b.team ?? "") || a.name.localeCompare(b.name));

  const header = (
    <header className="text-center rise">
      <p className="kicker">Votação pós-jogo</p>
      <h1 className="display text-3xl mt-1 first-letter:uppercase">{formatMatchDate(match.date)}</h1>
    </header>
  );

  if (!match.votingOpen) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card card-pad text-center">
          <p className="display text-xl">Votação fechada</p>
          <p className="kicker mt-2">Aguarde o organizador abrir ou confira o resultado na súmula</p>
          <Link href={`/partida/${match.id}`} className="btn mt-4">
            Ver súmula
          </Link>
        </div>
      </div>
    );
  }

  const voterId = typeof sp.jogador === "string" ? sp.jogador : undefined;
  const voter = people.find((p) => p.id === voterId);

  if (!voter) {
    return (
      <div className="space-y-6">
        {header}
        <section className="card rise">
          <div className="team-band">
            <span className="display text-lg">Quem é você?</span>
            <span className="mono text-xs">Toque no seu nome</span>
          </div>
          <ul className="grid grid-cols-2 gap-2 p-3">
            {people.map((p) => {
              const meta = isTeam(p.team) ? TEAM_META[p.team] : null;
              return (
                <li key={p.id}>
                  <Link
                    href={`/votar/${token}?jogador=${p.id}`}
                    className="btn btn-block justify-start! normal-case! tracking-normal! text-sm!"
                    id={`eu-sou-${p.id}`}
                  >
                    <span className="team-dot" style={{ background: meta?.color }} aria-hidden />
                    <span className="truncate">{p.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  }

  const existing = await db.vote.findMany({ where: { matchId: match.id, voterId: voter.id } });
  const initial = Object.fromEntries(existing.map((v) => [v.targetId, v.score]));
  const others = people.filter((p) => p.id !== voter.id);

  return (
    <div className="space-y-6">
      {header}
      <p className="text-center text-sm">
        Votando como <strong>{voter.name}</strong> ·{" "}
        <Link href={`/votar/${token}`} className="underline">
          não sou eu
        </Link>
      </p>
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
    <Suspense fallback={<Loading label="Abrindo a urna…" />}>
      <VoteView params={params} searchParams={searchParams} />
    </Suspense>
  );
}
