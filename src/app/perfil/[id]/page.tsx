import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, Award, Calendar, CheckCircle2, ShieldAlert, Star, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { resetPlayerPin } from "@/app/admin/actions";
import { formatShortDate } from "@/lib/format";
import { TEAM_META, type TeamKey } from "@/lib/teams";
import { GloveBadge, Loading } from "@/components/ui";
import { ProfilePinGate } from "@/components/profile-pin-gate";
import { ProfilePublicToggle } from "@/components/profile-public-toggle";
import { ProfileSetPin } from "@/components/profile-set-pin";
import { SubmitButton } from "@/components/client";

export const metadata = { title: "Perfil do Jogador" };

type Props = {
  params: Promise<{ id: string }>;
};

async function Profile({ params }: Props) {
  await connection();
  const { id } = await params;
  const isOrganizer = await isAdmin();

  const player = await db.player.findUnique({
    where: { id },
    include: {
      attendances: {
        where: { team: { not: null }, isUnavailable: false },
        include: {
          match: true,
        },
        orderBy: { match: { date: "desc" } },
      },
    },
  });

  if (!player) {
    notFound();
  }

  // Verificar autorização de visualização
  const cookieStore = await cookies();
  const cookiePin = cookieStore.get(`player_pin_${id}`)?.value;
  const isAuthorized =
    isOrganizer ||
    player.isPublic ||
    !player.pin ||
    (cookiePin != null && cookiePin === player.pin);

  if (!isAuthorized) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <Link
            href="/historico"
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-moss-soft"
          >
            <ArrowLeft className="size-3.5" /> Voltar ao Histórico
          </Link>
        </header>
        <ProfilePinGate playerId={player.id} playerName={player.name} />
      </div>
    );
  }

  // Buscar todos os jogadores ativos para calcular o Ranking Geral
  const [allActivePlayers, totalFinishedMatches, matchVotes] = await Promise.all([
    db.player.findMany({
      where: { active: true },
      orderBy: [{ baseRating: "desc" }, { name: "asc" }],
      select: { id: true, baseRating: true },
    }),
    db.match.count({
      where: { status: "FINISHED" },
    }),
    // Buscar votos de todas as partidas em que este jogador participou
    db.vote.findMany({
      where: {
        matchId: { in: player.attendances.map((a) => a.matchId) },
      },
      select: {
        matchId: true,
        targetId: true,
        score: true,
      },
    }),
  ]);

  // Ranking geral
  const playerRankIndex = allActivePlayers.findIndex((p) => p.id === player.id);
  const overallRank = playerRankIndex !== -1 ? playerRankIndex + 1 : null;
  const totalActive = allActivePlayers.length;

  // Montar ranking partida por partida
  // Agrupar votos por [matchId][targetId] => array de notas
  const matchTargetScores: Record<string, Record<string, number[]>> = {};
  for (const v of matchVotes) {
    if (!matchTargetScores[v.matchId]) matchTargetScores[v.matchId] = {};
    if (!matchTargetScores[v.matchId][v.targetId]) matchTargetScores[v.matchId][v.targetId] = [];
    matchTargetScores[v.matchId][v.targetId].push(v.score);
  }

  // Para cada partida do jogador, calcular a média dele e a colocação dele
  const matchHistory = player.attendances.map((att) => {
    const scoresMap = matchTargetScores[att.matchId] || {};
    const playerScores = scoresMap[player.id] || [];
    const playerAvg = playerScores.length
      ? Math.round((playerScores.reduce((a, b) => a + b, 0) / playerScores.length) * 10) / 10
      : null;

    // Calcular rankings de todos os jogadores avaliados nessa partida
    const targetAverages: { targetId: string; avg: number }[] = [];
    for (const [targetId, scores] of Object.entries(scoresMap)) {
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        targetAverages.push({ targetId, avg });
      }
    }
    targetAverages.sort((a, b) => b.avg - a.avg);

    const rankInMatch = targetAverages.findIndex((t) => t.targetId === player.id);
    const place = rankInMatch !== -1 ? rankInMatch + 1 : null;
    const totalInMatch = targetAverages.length;

    return {
      matchId: att.matchId,
      date: att.match.date,
      status: att.match.status,
      team: att.team,
      playerAvg,
      place,
      totalInMatch,
    };
  });

  const timesPlayed = player.attendances.length;
  const attendanceRate = totalFinishedMatches > 0
    ? Math.round((timesPlayed / totalFinishedMatches) * 100)
    : 100;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/historico"
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-moss-soft"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao Histórico
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl text-moss">{player.name}</h1>
            {player.isGoalkeeper && <GloveBadge />}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-moss/10 text-moss px-2 py-0.5 rounded">
            {player.isGoalkeeper ? "Goleiro Fixo" : "Jogador de Linha"}
          </span>
        </div>
      </header>

      {/* Banner Especial de Organizador */}
      {isOrganizer && (
        <section className="border-2 border-brick bg-brick/10 p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-brick" />
              <span className="text-xs font-bold uppercase tracking-wider text-brick">
                Acesso do Organizador
              </span>
            </div>
            {player.pin ? (
              <form action={resetPlayerPin.bind(null, player.id)}>
                <SubmitButton
                  className="bg-brick text-paper hover:bg-brick/90 py-1 px-3 text-[11px] font-bold uppercase tracking-wider shadow-none cursor-pointer"
                  confirm={`Tem certeza que deseja resetar o PIN de ${player.name}? Se alguém cadastrou por engano, ele poderá cadastrar um novo PIN na próxima votação ou no perfil.`}
                >
                  ⚡ Resetar PIN deste Jogador
                </SubmitButton>
              </form>
            ) : (
              <span className="text-xs text-moss-soft italic">
                Jogador sem PIN cadastrado.
              </span>
            )}
          </div>
          <p className="text-[11px] text-moss-soft">
            Como organizador, você tem acesso irrestrito às estatísticas e pode resetar o PIN caso alguém tenha cadastrado por engano.
          </p>
        </section>
      )}

      {/* Visibilidade do Perfil & Configuração de PIN */}
      <section className="flex flex-col gap-2">
        <ProfilePublicToggle playerId={player.id} initialIsPublic={player.isPublic} />
        {!player.pin && <ProfileSetPin playerId={player.id} />}
      </section>

      {/* Cards de Resumo Geral e Estatísticas */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border-[3px] border-moss bg-paper p-4 shadow-hard flex flex-col justify-between">
          <div className="flex items-center justify-between text-moss-soft">
            <span className="text-[10px] font-bold uppercase tracking-wider">Classificação Geral</span>
            <Trophy className="size-4 text-brick" />
          </div>
          <div className="mt-2">
            <span className="font-serif text-3xl font-bold text-moss">
              {overallRank ? `${overallRank}º` : "—"}
            </span>
            <span className="text-xs text-moss-soft block">de {totalActive} ativos</span>
          </div>
        </div>

        <div className="border-[3px] border-moss bg-paper p-4 shadow-hard flex flex-col justify-between">
          <div className="flex items-center justify-between text-moss-soft">
            <span className="text-[10px] font-bold uppercase tracking-wider">Nota Geral</span>
            <Star className="size-4 text-brick fill-brick" />
          </div>
          <div className="mt-2">
            <span className="font-serif text-3xl font-bold text-moss">
              ★ {player.baseRating.toFixed(1).replace(".", ",")}
            </span>
            <span className="text-xs text-moss-soft block">
              {player.ratedMatches} {player.ratedMatches === 1 ? "avaliação" : "avaliações"}
            </span>
          </div>
        </div>

        <div className="border-[3px] border-moss bg-paper p-4 shadow-hard flex flex-col justify-between">
          <div className="flex items-center justify-between text-moss-soft">
            <span className="text-[10px] font-bold uppercase tracking-wider">Partidas</span>
            <Calendar className="size-4 text-moss" />
          </div>
          <div className="mt-2">
            <span className="font-serif text-3xl font-bold text-moss">
              {timesPlayed}
            </span>
            <span className="text-xs text-moss-soft block">
              {timesPlayed === 1 ? "presença" : "presenças"}
            </span>
          </div>
        </div>

        <div className="border-[3px] border-moss bg-paper p-4 shadow-hard flex flex-col justify-between">
          <div className="flex items-center justify-between text-moss-soft">
            <span className="text-[10px] font-bold uppercase tracking-wider">Assiduidade</span>
            <CheckCircle2 className="size-4 text-moss" />
          </div>
          <div className="mt-2">
            <span className="font-serif text-3xl font-bold text-moss">
              {attendanceRate}%
            </span>
            <span className="text-xs text-moss-soft block">das partidas</span>
          </div>
        </div>
      </section>

      {/* Histórico Partida por Partida com Classificação em Cada Dia */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between border-b-2 border-moss pb-1">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">
              Histórico Detalhado
            </span>
            <h2 className="font-serif text-2xl">Desempenho por Partida</h2>
          </div>
          <span className="text-xs text-moss-soft">
            {matchHistory.length} {matchHistory.length === 1 ? "jogo" : "jogos"}
          </span>
        </div>

        {matchHistory.length ? (
          <ul className="flex flex-col divide-y-2 divide-moss/20 border-2 border-moss bg-paper">
            {matchHistory.map((m) => {
              const meta = m.team ? TEAM_META[m.team as TeamKey] : null;

              let rankBadge = null;
              if (m.place === 1) {
                rankBadge = (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-amber-400/20 text-amber-900 border border-amber-400 px-2 py-0.5 rounded">
                    🥇 1º lugar (Craque da Rodada)
                  </span>
                );
              } else if (m.place === 2) {
                rankBadge = (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-slate-200 text-slate-800 border border-slate-400 px-2 py-0.5 rounded">
                    🥈 2º lugar de {m.totalInMatch}
                  </span>
                );
              } else if (m.place === 3) {
                rankBadge = (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-amber-700/15 text-amber-900 border border-amber-700/40 px-2 py-0.5 rounded">
                    🥉 3º lugar de {m.totalInMatch}
                  </span>
                );
              } else if (m.place != null) {
                rankBadge = (
                  <span className="text-[11px] font-semibold text-moss-soft bg-paper-dark border border-moss/20 px-2 py-0.5 rounded">
                    {m.place}º lugar de {m.totalInMatch}
                  </span>
                );
              }

              return (
                <li key={m.matchId} className="p-3.5 flex flex-col gap-2 hover:bg-paper-dark transition-colors">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-moss">
                        {formatShortDate(typeof m.date === "string" ? new Date(m.date) : m.date)}
                      </span>
                      {meta && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-moss bg-moss/10 px-1.5 py-0.5 rounded">
                          <span className={`size-2.5 rounded-xs border border-moss/40 ${meta.swatch}`} />
                          Time {meta.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {m.playerAvg != null && (
                        <div className="flex items-center gap-1 border border-moss bg-paper px-2 py-0.5 rounded shadow-xs">
                          <Star className="size-3 fill-brick text-brick" />
                          <span className="font-serif text-sm font-bold text-moss tabular-nums">
                            ★ {m.playerAvg.toFixed(1).replace(".", ",")}
                          </span>
                        </div>
                      )}

                      <Link
                        href={`/partida/${m.matchId}`}
                        className="text-[10px] font-bold uppercase tracking-wider text-brick hover:underline flex items-center gap-0.5"
                      >
                        Ver Jogo <ArrowUpRight className="size-3 text-brick" />
                      </Link>
                    </div>
                  </div>

                  {rankBadge && (
                    <div className="flex items-center gap-2">
                      <Award className="size-3.5 text-moss-soft" />
                      {rankBadge}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-2 border-moss bg-paper p-6 text-center text-xs text-moss-soft italic">
            Nenhuma partida concluída registrada com a presença deste jogador.
          </div>
        )}
      </section>
    </div>
  );
}

export default function ProfilePage({ params }: Props) {
  return (
    <Suspense fallback={<Loading label="Carregando perfil…" />}>
      <Profile params={params} />
    </Suspense>
  );
}
