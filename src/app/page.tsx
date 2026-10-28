import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, User, Users } from "lucide-react";
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
      {match.votingOpen && (
        <Link
          href={`/votar/${match.voteToken}`}
          className="flex items-center justify-between border-[3px] border-moss bg-paper-dark px-4 py-3.5 shadow-hard-brick text-moss transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Urna aberta • Pós-jogo</span>
            <span className="block font-serif text-lg leading-tight">Votar nos Destaques da Partida</span>
          </span>
          <ArrowRight className="size-5 text-brick" aria-hidden="true" />
        </Link>
      )}

      {/* Súmula da Partida */}
      <section aria-labelledby="resumo-title" className="border-[3px] border-moss bg-paper shadow-hard">
        <div className="flex items-center justify-between border-b-[3px] border-moss bg-paper-dark px-4 py-3 gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick block">
              Próxima Partida
            </span>
            <h2 id="resumo-title" className="font-serif text-xl first-letter:uppercase">
              {formatMatchDate(match.date)}
            </h2>
            {(match.location || match.cost != null) && (
              <p className="text-[11px] text-moss font-semibold mt-0.5 flex flex-wrap items-center gap-2">
                {match.location && <span>📍 {match.location}</span>}
                {match.cost != null && <span>💰 R$ {match.cost.toFixed(2).replace(".", ",")}</span>}
              </p>
            )}
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>

        <div className="p-4 border-b-[3px] border-moss flex items-center justify-between bg-paper gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">Jogadores Confirmados</p>
            <p className="mt-1 font-serif text-4xl leading-none tabular-nums text-moss">
              {confirmedCount} {confirmedCount === 1 ? "jogador" : "jogadores"}
            </p>
          </div>
          <Link
            href={`/partida/${match.id}`}
            className="inline-flex items-center gap-1.5 border-2 border-moss bg-paper-dark hover:bg-paper px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-moss shadow-hard-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shrink-0"
          >
            <span>Ver Súmula</span>
            <ArrowRight className="size-3.5 text-moss" aria-hidden="true" />
          </Link>
        </div>

        {/* Lista de Confirmados */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-serif text-base text-moss">Lista de Presença</h3>
            <Users className="size-4 text-moss/40" />
          </div>
          {confirmedCount === 0 ? (
            <p className="text-xs text-moss-soft">Nenhum jogador confirmado ainda.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {match.attendances.map((a, i) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 p-2.5 border border-moss/20 bg-paper-dark text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 font-mono text-[10px] text-moss-soft">{i + 1}.</span>
                    <span className="truncate font-semibold text-moss">{a.player.name}</span>
                    {a.player.isGoalkeeper && <GloveBadge />}
                  </div>

                  <Link
                    href={`/perfil/${a.playerId}`}
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brick hover:underline shrink-0"
                  >
                    <User className="size-3" /> Perfil
                  </Link>
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
