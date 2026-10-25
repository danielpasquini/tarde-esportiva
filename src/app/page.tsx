import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { formatMatchDate } from "@/lib/format";
import { preDraw } from "@/lib/match";
import { TEAM_META, teamsFor } from "@/lib/teams";
import { confirmPresence } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { Loading, StatusStamp } from "@/components/ui";

async function ActiveMatchCard() {
  await connection();
  const match = await db.match.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { date: "asc" },
    include: {
      attendances: { include: { player: true }, orderBy: { createdAt: "asc" } },
      games: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!match) {
    return (
      <div className="border-[3px] border-moss bg-paper p-6 text-center shadow-hard">
        <h2 className="font-serif text-2xl">Nenhuma Partida Aberta</h2>
        <p className="mt-2 text-sm text-moss-soft">Acesse o painel do organizador para marcar uma partida.</p>
        <Link
          href="/admin"
          className="mt-4 inline-flex items-center gap-2 border-2 border-moss bg-paper-dark px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm"
        >
          Ir para o Organizador →
        </Link>
      </div>
    );
  }

  const { goalkeepers, line, waitlist, capacity } = preDraw(match);
  const totalTitulares = goalkeepers.length + line.length;
  const teams = teamsFor(match.numTeams);

  const confirmedIds = new Set(match.attendances.map((a) => a.playerId));
  const roster = await db.player.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const available = roster.filter((p) => !confirmedIds.has(p.id));

  return (
    <div className="flex flex-col gap-6">
      {/* Atalhos para Escalação e Votação */}
      <div className="flex flex-col gap-3">
        <Link
          href={`/partida/${match.id}`}
          className="flex items-center justify-between border-[3px] border-moss bg-paper-dark px-4 py-3 shadow-hard-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brick">
              {match.status === "OPEN" ? "Lista de presença" : "Times gerados"}
            </span>
            <span className="block font-serif text-lg leading-tight">
              {match.status === "OPEN" ? "Ver Lista e Confirmados" : "Ver Escalação da Rodada"}
            </span>
          </span>
          <ArrowRight className="size-5 text-moss" aria-hidden="true" />
        </Link>

        {match.votingOpen && (
          <Link
            href={`/votar/${match.voteToken}`}
            className="flex items-center justify-between border-[3px] border-moss bg-paper px-4 py-3 shadow-hard-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Pós-jogo</span>
              <span className="block font-serif text-lg leading-tight">Abrir Votação da Partida</span>
            </span>
            <ArrowRight className="size-5 text-moss" aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* Súmula da Rodada (inspirada no SummaryCard) */}
      <section aria-labelledby="resumo-title" className="border-[3px] border-moss bg-paper shadow-hard">
        <div className="flex items-center justify-between border-b-[3px] border-moss bg-paper-dark px-4 py-2.5">
          <div>
            <h2 id="resumo-title" className="font-serif text-xl">
              Súmula da Partida
            </h2>
            <p className="text-xs text-moss-soft first-letter:uppercase">{formatMatchDate(match.date)}</p>
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>

        <div className="grid grid-cols-2 divide-x-[3px] divide-moss border-b-[3px] border-moss">
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">Confirmados</p>
            <p className="mt-1 font-serif text-5xl leading-none tabular-nums">
              {totalTitulares}
              <span className="text-2xl text-moss-soft">/{capacity}</span>
            </p>
            <div
              className="mt-3 grid grid-cols-5 gap-1"
              role="img"
              aria-label={`${totalTitulares} de ${capacity} titulares preenchidos`}
            >
              {Array.from({ length: capacity }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3 border border-moss ${i < totalTitulares ? "bg-moss" : "bg-paper"}`}
                />
              ))}
            </div>
          </div>

          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">Configuração</p>
            <p className="mt-1 font-serif text-5xl leading-none">{teams.length}</p>
            <p className="text-[10px] uppercase font-bold text-moss-soft tracking-wider mt-0.5">Times</p>
            <ul className="mt-2 flex flex-col gap-1 text-xs font-medium">
              {teams.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className={`size-3 border border-moss ${TEAM_META[t].swatch}`} />
                  <span>{TEAM_META[t].label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Lista de espera / Reservas */}
        <div className="p-4">
          <div className="border-2 border-dashed border-brick bg-brick/5 p-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-base text-brick">Lista de Espera</h3>
              <span className="text-xs font-semibold uppercase tracking-wider text-brick">
                {waitlist.length} {waitlist.length === 1 ? "reserva" : "reservas"}
              </span>
            </div>

            {waitlist.length === 0 ? (
              <p className="mt-1 text-xs text-moss-soft">Ninguém na espera.</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1 text-xs">
                {waitlist.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className="w-4 font-serif text-brick">{i + 1}.</span>
                    <span className="flex-1 truncate font-medium">{a.player.name}</span>
                    {a.player.isGoalkeeper && (
                      <span className="border border-moss px-1 text-[9px] font-bold uppercase bg-paper">
                        GK
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {/* Formulário de Confirmação Rápida */}
      {match.status !== "FINISHED" && available.length > 0 && (
        <section className="border-[3px] border-moss bg-paper p-4 shadow-hard">
          <h3 className="font-serif text-lg mb-2">Confirmar Presença</h3>
          <form action={confirmPresence.bind(null, match.id)} className="flex gap-2">
            <select
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
            <SubmitButton className="bg-moss text-paper hover:bg-moss-soft">
              Confirmar
            </SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Loading label="Carregando partida…" />}>
        <ActiveMatchCard />
      </Suspense>
    </div>
  );
}
