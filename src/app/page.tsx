import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Users } from "lucide-react";
import { db } from "@/lib/db";
import { formatMatchDate } from "@/lib/format";
import { GloveBadge, Loading, StatusStamp } from "@/components/ui";

async function ActiveMatchCard() {
  await connection();
  const match = await db.match.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { date: "asc" },
    include: {
      attendances: { include: { player: true }, orderBy: { player: { name: "asc" } } },
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

  const confirmedCount = match.attendances.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Atalhos para Presença e Votação */}
      <div className="flex flex-col gap-3">
        <Link
          href={`/partida/${match.id}`}
          className="flex items-center justify-between border-[3px] border-moss bg-paper-dark px-4 py-3 shadow-hard-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brick">
              Partida
            </span>
            <span className="block font-serif text-lg leading-tight">
              Ver Jogadores Confirmados ({confirmedCount})
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

      {/* Súmula da Partida */}
      <section aria-labelledby="resumo-title" className="border-[3px] border-moss bg-paper shadow-hard">
        <div className="flex items-center justify-between border-b-[3px] border-moss bg-paper-dark px-4 py-2.5">
          <div>
            <h2 id="resumo-title" className="font-serif text-xl">
              Súmula da Partida
            </h2>
            <p className="text-xs text-moss-soft first-letter:uppercase">{formatMatchDate(match.date)}</p>
            {(match.location || match.cost != null) && (
              <p className="text-[11px] text-moss font-semibold mt-0.5 flex items-center gap-2">
                {match.location && <span>📍 {match.location}</span>}
                {match.cost != null && <span>💰 R$ {match.cost.toFixed(2).replace(".", ",")}</span>}
              </p>
            )}
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>

        <div className="p-4 border-b-[3px] border-moss flex items-center justify-between bg-paper">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">Jogadores Confirmados</p>
            <p className="mt-1 font-serif text-4xl leading-none tabular-nums text-moss">
              {confirmedCount} {confirmedCount === 1 ? "jogador" : "jogadores"}
            </p>
          </div>
          <Users className="size-8 text-moss/30" />
        </div>

        {/* Lista de Confirmados */}
        <div className="p-4">
          <h3 className="font-serif text-base text-moss mb-2">Lista de Presença</h3>
          {confirmedCount === 0 ? (
            <p className="text-xs text-moss-soft">Nenhum jogador confirmado ainda.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {match.attendances.map((a, i) => (
                <li key={a.id} className="flex items-center gap-2 p-2 border border-moss/20 bg-paper-dark text-xs">
                  <span className="w-5 font-mono text-[10px] text-moss-soft">{i + 1}.</span>
                  <span className="flex-1 truncate font-semibold text-moss">{a.player.name}</span>
                  {a.player.isGoalkeeper && <GloveBadge />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
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
