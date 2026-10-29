import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { computeMedalsFromVotes } from "@/lib/rating";
import { Empty, Loading, StatusStamp } from "@/components/ui";
import { HistoryPlayersList, type PlayerHistoryItem } from "@/components/history-players-list";
import SpotlightCard from "@/components/SpotlightCard";
import CountUp from "@/components/CountUp";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";

export const metadata = { title: "Histórico" };

async function History() {
  await connection();
  const isOrganizer = await isAdmin();

  const [finishedMatches, allMatchesFallback, allMatchesList, players, finishedVotes] = await Promise.all([
    db.match.findMany({
      where: { status: "FINISHED" },
      orderBy: { date: "desc" },
      take: 5,
      include: {
        _count: { select: { attendances: true } },
      },
    }),
    db.match.findMany({
      orderBy: { date: "desc" },
      take: 5,
      include: {
        _count: { select: { attendances: true } },
      },
    }),
    db.match.findMany({
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        status: true,
        location: true,
      },
    }),
    db.player.findMany({
      where: { active: true },
      include: {
        attendances: {
          include: { match: true },
          orderBy: { match: { date: "desc" } },
        },
        votesGot: {
          include: { match: true },
        },
      },
    }),
    db.vote.findMany({
      where: { match: { status: "FINISHED" } },
      select: { matchId: true, targetId: true, score: true },
    }),
  ]);

  const recentMatches = finishedMatches.length > 0 ? finishedMatches : allMatchesFallback;
  const medalsByPlayer = computeMedalsFromVotes(finishedVotes);

  const playersData: PlayerHistoryItem[] = players
    .map((p) => {
      const attendanceMap: Record<string, { team: string | null; avg: number | null }> = {};

      const scoreMap: Record<string, number[]> = {};
      for (const v of p.votesGot) {
        if (!scoreMap[v.matchId]) scoreMap[v.matchId] = [];
        scoreMap[v.matchId].push(v.score);
      }

      for (const att of p.attendances) {
        const scores = scoreMap[att.matchId] || [];
        const avg = scores.length
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null;
        attendanceMap[att.matchId] = { team: att.team, avg };
      }

      const timesPlayed = Object.keys(attendanceMap).length;

      return {
        id: p.id,
        name: p.name,
        isGoalkeeper: p.isGoalkeeper,
        baseRating: p.baseRating,
        timesPlayed,
        hasPin: !!p.pin,
        isPublic: p.isPublic,
        medals: medalsByPlayer[p.id] ?? { gold: 0, silver: 0, bronze: 0 },
        attendanceMap,
      };
    })
    .sort((a, b) => b.timesPlayed - a.timesPlayed || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      {/* 1) Card dos Últimos 5 Jogos Jogados */}
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between border-b border-moss/15 pb-2">
          <div>
            <span className="hud-tag bg-moss text-paper border-transparent mb-1">
              <ShinyText text="Histórico Recente" color="#f6f4ef" shineColor="#d9a520" speed={2.4} />
            </span>
            <h2 className="font-serif text-2xl text-moss leading-none">
              <SplitText text="Últimos 5 Jogos" tag="span" />
            </h2>
          </div>
          <span className="hud-tag bg-paper-dark text-moss font-mono">
            <span>
              <CountUp to={recentMatches.length} duration={1} />{" "}
              {recentMatches.length === 1 ? "partida" : "partidas"}
            </span>
          </span>
        </div>

        {recentMatches.length ? (
          <ul className="flex flex-col gap-2.5">
            {recentMatches.map((m, idx) => {
              const timeStr = m.date.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              });
              return (
                <li key={m.id}>
                  <SpotlightCard
                    spotlightColor="rgba(180, 122, 22, 0.14)"
                    className="border border-moss/15 hover:border-moss/35 bg-paper rounded-xl shadow-hard overflow-hidden transition-all active:scale-[0.99]"
                  >
                    <Link
                      href={`/partida/${m.id}`}
                      className="block group"
                      id={`historico-${m.id}`}
                    >
                      <div className="flex items-center justify-between border-b border-moss/10 bg-paper-dark/60 px-4 py-2.5 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-sm bg-moss text-paper font-mono text-[10px] font-bold shrink-0">
                            J{idx + 1}
                          </span>
                          <span className="font-serif text-lg font-bold text-moss group-hover:text-brick transition-colors">
                            {formatShortDate(m.date)}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-moss-soft bg-white/80 px-1.5 py-0.5 rounded-sm border border-moss/15">
                            {timeStr}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusStamp status={m.status} votingOpen={m.votingOpen} />
                        </div>
                      </div>
                      <div className="px-4 py-2.5 fut-grid-bg">
                        <div className="flex items-center justify-between text-xs text-moss-soft font-semibold gap-2 flex-wrap">
                          <span className="font-mono text-moss">
                            <strong>
                              <CountUp to={m._count.attendances} duration={1} />
                            </strong>{" "}
                            jogadores participaram
                            {m.location && <span className="text-moss-soft"> · 📍 {m.location}</span>}
                          </span>
                          <span className="text-brick font-extrabold uppercase tracking-wider text-[10px] inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            Resumo <ArrowUpRight className="size-3" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </SpotlightCard>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Nenhuma partida encerrada ainda.</Empty>
        )}
      </section>

      {/* 2) Card: Jogadores */}
      <SpotlightCard className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard flex flex-col gap-4">
        <div className="flex items-end justify-between border-b border-moss/15 pb-2.5">
          <div>
            <span className="hud-tag bg-brick text-paper border-transparent mb-1">
              <ShinyText
                text={isOrganizer ? "Elenco • Modo Organizador" : "Elenco da Tarde"}
                color="#f6f4ef"
                shineColor="#ffffff"
                speed={2.2}
              />
            </span>
            <h2 className="font-serif text-2xl text-moss leading-none">
              <SplitText text="Jogadores" tag="span" />
            </h2>
          </div>
          <span className="hud-tag bg-paper-dark text-moss font-mono">
            <span>
              <CountUp to={playersData.length} duration={1.2} /> jogadores
            </span>
          </span>
        </div>

        {isOrganizer && (
          <p className="text-xs text-moss-soft bg-paper-dark/65 p-3 rounded-lg border border-moss/15">
            🔒 <strong>Visão do Organizador:</strong> Você pode visualizar a média geral (estrelas) e as notas de cada partida (decimais). Para os demais usuários, as notas são ocultas.
          </p>
        )}

        {playersData.length ? (
          <HistoryPlayersList
            players={playersData}
            allMatches={allMatchesList.map((m) => ({
              id: m.id,
              date: m.date,
              status: m.status,
              location: m.location,
            }))}
            isOrganizer={isOrganizer}
          />
        ) : (
          <Empty>Nenhum jogador cadastrado.</Empty>
        )}
      </SpotlightCard>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<Loading label="Carregando histórico…" />}>
      <History />
    </Suspense>
  );
}
