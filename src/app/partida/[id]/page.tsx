import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { getMatch } from "@/lib/match";
import { formatMatchDate } from "@/lib/format";
import { confirmPresence, cancelPresence } from "@/app/actions";
import { PreDrawList, Scoreboard, TeamsBoard } from "@/components/lineup";
import { SubmitButton } from "@/components/client";
import { Loading, StatusStamp } from "@/components/ui";

async function MatchView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) notFound();

  const confirmedIds = new Set(match.attendances.map((a) => a.playerId));
  const roster = await db.player.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const available = roster.filter((p) => !confirmedIds.has(p.id));

  return (
    <div className="space-y-7">
      <header className="card card-pad rise">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker">Súmula da partida</p>
            <h1 className="display text-3xl mt-1 first-letter:uppercase">{formatMatchDate(match.date)}</h1>
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>
        <hr className="rule my-3" />
        <p className="mono text-sm">
          {match.numTeams} times × {match.lineSize} na linha · {match.attendances.length} confirmados
        </p>
      </header>

      {match.votingOpen && (
        <Link href={`/votar/${match.voteToken}`} className="btn btn-brick btn-block" id="ir-votacao">
          Votação aberta · avaliar companheiros →
        </Link>
      )}

      {match.status !== "FINISHED" && (
        <section className="card card-pad space-y-4">
          <h2 className="display text-xl">Vai jogar?</h2>
          {available.length ? (
            <form action={confirmPresence.bind(null, match.id)} className="flex gap-2">
              <label htmlFor="confirm-player" className="sr-only">
                Seu nome
              </label>
              <select id="confirm-player" name="playerId" className="field" required defaultValue="">
                <option value="" disabled>
                  Selecione seu nome
                </option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <SubmitButton className="btn btn-moss shrink-0" id="confirmar-presenca">
                Tô dentro
              </SubmitButton>
            </form>
          ) : (
            <p className="kicker">Todos os jogadores do grupo já confirmaram.</p>
          )}
          {match.status === "DRAWN" && (
            <p className="text-sm text-ink/70">Times já sorteados: novas confirmações entram no banco de reservas.</p>
          )}
          {match.status === "OPEN" && match.attendances.length > 0 && (
            <details>
              <summary className="kicker underline">Não vai mais? Desconfirmar</summary>
              <form action={cancelPresence.bind(null, match.id)} className="flex gap-2 mt-3">
                <label htmlFor="cancel-player" className="sr-only">
                  Seu nome
                </label>
                <select id="cancel-player" name="playerId" className="field" required defaultValue="">
                  <option value="" disabled>
                    Selecione seu nome
                  </option>
                  {match.attendances.map((a) => (
                    <option key={a.playerId} value={a.playerId}>
                      {a.player.name}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn btn-brick shrink-0" id="desconfirmar-presenca">
                  Sair
                </SubmitButton>
              </form>
            </details>
          )}
        </section>
      )}

      <section>
        <div className="section-head">
          <h2 className="display text-2xl">{match.status === "OPEN" ? "Lista de presença" : "Escalação por colete"}</h2>
        </div>
        {match.status === "OPEN" ? <PreDrawList match={match} /> : <TeamsBoard match={match} />}
      </section>

      {match.status !== "OPEN" && (
        <section>
          <div className="section-head">
            <h2 className="display text-2xl">Placares</h2>
          </div>
          <Scoreboard match={match} />
        </section>
      )}
    </div>
  );
}

export default function MatchPage({ params }: PageProps<"/partida/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <MatchView params={params} />
    </Suspense>
  );
}
