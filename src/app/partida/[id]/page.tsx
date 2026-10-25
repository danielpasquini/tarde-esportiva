import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getMatch } from "@/lib/match";
import { formatMatchDate } from "@/lib/format";
import { confirmPresence, cancelPresence } from "@/app/actions";
import { PreDrawList, TeamsBoard } from "@/components/lineup";
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
    <div className="flex flex-col gap-6">
      <header className="border-[3px] border-moss bg-paper p-4 shadow-hard">
        <Link href="/" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-moss-soft mb-2">
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">Partida</span>
            <h1 className="font-serif text-3xl first-letter:uppercase leading-tight">{formatMatchDate(match.date)}</h1>
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>
        <div className="mt-3 pt-3 border-t-2 border-moss/20 flex items-center justify-between text-xs text-moss-soft font-semibold">
          <span>{match.numTeams} times × {match.lineSize} na linha</span>
          <span>{match.attendances.length} atletas confirmados</span>
        </div>
      </header>

      {match.votingOpen && (
        <Link
          href={`/votar/${match.voteToken}`}
          className="flex items-center justify-between border-[3px] border-moss bg-paper-dark px-4 py-3.5 shadow-hard-brick text-moss transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          id="ir-votacao"
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Urna aberta</span>
            <span className="block font-serif text-lg leading-tight">Votação Pós-Jogo</span>
          </div>
          <ArrowRight className="size-5 text-brick" />
        </Link>
      )}

      {/* Imagem e Destaques do Jogador do Dia (Quando votação encerrada) */}
      {match.status === "FINISHED" && (
        <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
          <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Pós-Jogo</span>
              <h2 className="font-serif text-2xl">Destaques da Rodada</h2>
            </div>
            <a
              href={`/api/partida/${match.id}/destaques`}
              target="_blank"
              download={`craque-da-rodada-${match.id}.png`}
              className="inline-flex items-center gap-1 border-2 border-moss bg-moss text-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-moss-soft"
            >
              Baixar Imagem ↗
            </a>
          </div>

          <div className="overflow-hidden border-2 border-moss shadow-hard-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/partida/${match.id}/destaques`}
              alt="Jogador do Dia e Top 5 da partida"
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          </div>

          <p className="text-[11px] text-moss-soft text-center italic">
            Apenas o Top 5 é revelado publicamente. O restante das avaliações é restrito ao organizador.
          </p>
        </section>
      )}

      {/* Confirmação de presença */}
      {match.status !== "FINISHED" && (
        <section className="border-[3px] border-moss bg-paper p-4 shadow-hard flex flex-col gap-3">
          <h2 className="font-serif text-xl">Confirmação de Presença</h2>
          {available.length ? (
            <form action={confirmPresence.bind(null, match.id)} className="flex gap-2">
              <label htmlFor="confirm-player" className="sr-only">
                Seu nome
              </label>
              <select
                id="confirm-player"
                name="playerId"
                className="flex-1 border-2 border-moss bg-paper px-3 py-2 text-sm text-moss outline-none"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione seu nome
                </option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isGoalkeeper ? "(Goleiro)" : ""}
                  </option>
                ))}
              </select>
              <SubmitButton className="bg-moss text-paper hover:bg-moss-soft" id="confirmar-presenca">
                Confirmar
              </SubmitButton>
            </form>
          ) : (
            <p className="text-xs text-moss-soft">Todos os jogadores ativos já confirmaram presença.</p>
          )}

          {match.status === "DRAWN" && (
            <p className="text-xs text-moss-soft">
              Times já sorteados: novas confirmações entram no banco de reservas.
            </p>
          )}

          {match.status === "OPEN" && match.attendances.length > 0 && (
            <details className="mt-1">
              <summary className="text-xs font-bold uppercase tracking-wider text-brick cursor-pointer underline">
                Desconfirmar Presença
              </summary>
              <form action={cancelPresence.bind(null, match.id)} className="flex gap-2 mt-2 pt-2 border-t border-moss/20">
                <label htmlFor="cancel-player" className="sr-only">
                  Seu nome
                </label>
                <select
                  id="cancel-player"
                  name="playerId"
                  className="flex-1 border-2 border-moss bg-paper px-3 py-2 text-sm text-moss outline-none"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione seu nome
                  </option>
                  {match.attendances.map((a) => (
                    <option key={a.playerId} value={a.playerId}>
                      {a.player.name}
                    </option>
                  ))}
                </select>
                <SubmitButton className="bg-brick text-paper" id="desconfirmar-presenca">
                  Remover
                </SubmitButton>
              </form>
            </details>
          )}
        </section>
      )}

      {/* Escalação ou lista prévia */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl">
          {match.status === "OPEN" ? "Lista de Presença" : "Escalação por Colete"}
        </h2>
        {match.status === "OPEN" ? <PreDrawList match={match} /> : <TeamsBoard match={match} />}
      </section>
    </div>
  );
}

export default function MatchPage({ params }: PageProps<"/partida/[id]">) {
  return (
    <Suspense fallback={<Loading label="Carregando partida…" />}>
      <MatchView params={params} />
    </Suspense>
  );
}
