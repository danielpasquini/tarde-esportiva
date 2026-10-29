import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Radio, User, Users } from "lucide-react";
import { db } from "@/lib/db";
import { formatMatchDate } from "@/lib/format";
import { GloveBadge, Loading, StatusStamp } from "@/components/ui";
import SpotlightCard from "@/components/SpotlightCard";
import GlareHover from "@/components/GlareHover";
import CountUp from "@/components/CountUp";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";
import Magnet from "@/components/Magnet";

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
      <SpotlightCard className="border border-moss/15 bg-paper p-6 rounded-2xl text-center shadow-hard fut-grid-bg">
        <span className="hud-tag bg-paper-dark text-moss mb-3">
          <span>STATUS DO CLUBE</span>
        </span>
        <h2 className="font-serif text-2xl text-moss">
          <SplitText text="Nenhuma Partida Aberta" tag="span" textAlign="center" />
        </h2>
        <p className="mt-2 text-sm text-moss-soft">Acesse o painel do organizador para marcar uma partida.</p>
        <div className="mt-5 flex justify-center">
          <Magnet padding={25} magnetStrength={4}>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-moss bg-moss text-paper hover:bg-moss-soft px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider shadow-hard-brick transition-all active:scale-[0.99]"
            >
              Ir para o Organizador →
            </Link>
          </Magnet>
        </div>
      </SpotlightCard>
    );
  }

  const confirmedCount = match.attendances.length;

  return (
    <div className="flex flex-col gap-5">
      {match.votingOpen && (
        <GlareHover
          glareColor="#d9a520"
          glareOpacity={0.22}
          className="border border-brick/35 bg-gradient-to-r from-amber-500/12 via-paper-dark to-paper rounded-2xl shadow-hard-brick transition-all active:scale-[0.99]"
        >
          <Link
            href={`/votar/${match.voteToken}`}
            className="flex items-center justify-between px-4 py-3.5 text-moss group"
          >
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-brick">
                <Radio className="size-3 animate-pulse text-brick" />
                <ShinyText text="Urna aberta • Pós-jogo" color="#b47a16" shineColor="#16281e" speed={1.8} />
              </span>
              <span className="block font-serif text-lg leading-tight mt-0.5 group-hover:text-brick transition-colors">
                Votar nos Destaques da Partida
              </span>
            </div>
            <span className="inline-flex items-center justify-center size-9 rounded-lg bg-moss text-paper group-hover:bg-brick transition-colors shrink-0 shadow-xs">
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        </GlareHover>
      )}

      {/* Súmula da Partida */}
      <SpotlightCard
        aria-labelledby="resumo-title"
        spotlightColor="rgba(180, 122, 22, 0.14)"
        className="border border-moss/15 bg-paper rounded-2xl shadow-hard overflow-hidden"
      >
        <div className="flex items-start justify-between border-b border-moss/10 bg-paper-dark/65 px-4 py-4 gap-3">
          <div>
            <span className="hud-tag bg-moss text-paper border-transparent mb-2">
              <ShinyText
                text="Próxima Partida"
                color="#f6f4ef"
                shineColor="#d9a520"
                speed={2.5}
              />
            </span>
            <h2 id="resumo-title" className="font-serif text-xl sm:text-2xl text-moss first-letter:uppercase leading-tight">
              <SplitText text={formatMatchDate(match.date)} tag="span" />
            </h2>
            {(match.location || match.cost != null) && (
              <div className="text-[11px] text-moss font-bold mt-2 flex flex-wrap items-center gap-1.5">
                {match.location && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-moss/15 bg-white/80 px-2.5 py-0.5">
                    📍 {match.location}
                  </span>
                )}
                {match.cost != null && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-brick/25 bg-brick/10 text-moss px-2.5 py-0.5 font-mono">
                    💰 R$ {match.cost.toFixed(2).replace(".", ",")}
                  </span>
                )}
              </div>
            )}
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>

        {/* Placar de Presença */}
        <div className="px-4 py-4 border-b border-moss/10 flex items-center justify-between bg-paper fut-grid-bg gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-moss-soft">
              Jogadores Confirmados
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-4xl leading-none tabular-nums text-moss">
                <CountUp to={confirmedCount} duration={1.1} />
              </span>
              <span className="font-serif text-lg text-moss-soft">
                {confirmedCount === 1 ? "jogador" : "jogadores"}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de Confirmados */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-moss/10">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brick inline-block" aria-hidden="true" />
              <h3 className="font-serif text-base text-moss">Lista de Presença</h3>
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-moss-soft bg-paper-dark/60 px-2 py-0.5 rounded-md">
              <Users className="size-3 text-moss/65" />
              <span>ELENCO ({confirmedCount})</span>
            </div>
          </div>
          {confirmedCount === 0 ? (
            <p className="text-xs text-moss-soft py-2">Nenhum jogador confirmado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {match.attendances.map((a, i) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-moss/12 hover:border-moss/30 bg-white/70 hover:bg-white text-xs shadow-2xs transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-md bg-moss/10 text-moss font-mono text-[10px] font-extrabold shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-bold text-sm text-moss group-hover:text-brick transition-colors truncate">
                      {a.player.name}
                    </span>
                    {a.player.isGoalkeeper && <GloveBadge className="ml-0.5" />}
                  </div>

                  <Link
                    href={`/perfil/${a.playerId}`}
                    className="inline-flex items-center gap-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-moss-soft hover:text-paper hover:bg-moss border border-moss/15 bg-paper/80 px-2.5 py-1 shrink-0 transition-colors"
                  >
                    <User className="size-3" /> Perfil
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SpotlightCard>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<Loading label="Carregando partida…" />}>
        <ActiveMatchCard />
      </Suspense>
    </div>
  );
}
