import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { computeMedalsFromVotes } from "@/lib/rating";
import { Empty, Loading } from "@/components/ui";
import { HistoryPlayersList, type PlayerHistoryItem } from "@/components/history-players-list";

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
        attendanceMap[att.matchId] = { team: null, avg };
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
    <div className="flex flex-col gap-8">
      {/* 1) Card dos Últimos 5 Jogos Jogados */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between border-b-2 border-moss pb-1">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Histórico Recente</span>
            <h2 className="font-serif text-2xl">Últimos 5 Jogos</h2>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-moss-soft">
            {recentMatches.length} {recentMatches.length === 1 ? "partida" : "partidas"}
          </span>
        </div>

        {recentMatches.length ? (
          <ul className="flex flex-col gap-3">
            {recentMatches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/partida/${m.id}`}
                  className="block border-[3px] border-moss bg-paper shadow-hard hover:bg-paper-dark/30 transition-all active:translate-x-0.5 active:translate-y-0.5 group"
                  id={`historico-${m.id}`}
                >
                  <div className="flex items-center justify-between border-b-2 border-moss bg-paper-dark px-4 py-2.5">
                    <span className="font-serif text-lg font-bold text-moss">{formatShortDate(m.date)}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-moss group-hover:underline">
                      Página Pública <ArrowUpRight className="size-3.5 text-moss" />
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between text-xs text-moss-soft py-1">
                      <span>{m._count.attendances} jogadores participaram</span>
                      <span className="text-brick font-bold uppercase text-[10px]">Ver detalhes →</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhuma partida encerrada ainda.</Empty>
        )}
      </section>

      {/* 2) Card: Jogadores */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <div className="flex items-center justify-between border-b-2 border-moss pb-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">
              {isOrganizer ? "Elenco • Modo Organizador" : "Elenco da Tarde"}
            </span>
            <h2 className="font-serif text-2xl">Jogadores</h2>
          </div>
          <span className="text-xs font-mono font-bold text-moss-soft">
            {playersData.length} jogadores
          </span>
        </div>

        {isOrganizer && (
          <p className="text-xs text-moss-soft bg-paper-dark p-2.5 border border-moss/20">
            🔒 <strong>Visão do Organizador:</strong> Você pode visualizar a média geral (estrelas) e as notas de cada partida (decimais). Para os demais usuários, as notas são ocultas.
          </p>
        )}

        {playersData.length ? (
          <HistoryPlayersList
            players={playersData}
            allMatches={allMatchesList.map((m) => ({ id: m.id, date: m.date }))}
            isOrganizer={isOrganizer}
          />
        ) : (
          <Empty>Nenhum jogador cadastrado.</Empty>
        )}
      </section>
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
