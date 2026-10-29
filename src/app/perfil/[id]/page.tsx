import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, Award, Calendar, CheckCircle2, Lock, ShieldAlert, Star, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { resetPlayerPin } from "@/app/admin/actions";
import { formatShortDate } from "@/lib/format";
import { computeMedalsFromVotes } from "@/lib/rating";
import { GloveBadge, Loading, PlayerMedals } from "@/components/ui";
import { ProfilePinGate } from "@/components/profile-pin-gate";
import { ProfilePublicToggle } from "@/components/profile-public-toggle";
import { ProfileSetPin } from "@/components/profile-set-pin";
import { SubmitButton } from "@/components/client";
import SpotlightCard from "@/components/SpotlightCard";
import GlareHover from "@/components/GlareHover";
import CountUp from "@/components/CountUp";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";

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

  const cookieStore = await cookies();
  const cookiePin = cookieStore.get(`player_pin_${id}`)?.value;
  const hasValidPinCookie = cookiePin != null && cookiePin === player.pin;

  // Se o perfil tem PIN cadastrado e não é público, exige o PIN na porta de entrada
  const isPinLockedForVisitor = Boolean(player.pin) && !hasValidPinCookie && !isOrganizer && !player.isPublic;

  if (isPinLockedForVisitor) {
    return (
      <div className="flex flex-col gap-5">
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

  // Notas e classificação geral só aparecem para o dono autenticado por PIN, organizador ou se o perfil for público
  const hasOwnerAccess = isOrganizer || hasValidPinCookie;
  const canSeeSecretRatings = Boolean(player.pin) ? hasOwnerAccess || player.isPublic : isOrganizer;

  const [allActivePlayers, totalMatchesCount, matchVotes, finishedVotes] = await Promise.all([
    db.player.findMany({
      where: { active: true },
      orderBy: [{ baseRating: "desc" }, { name: "asc" }],
      select: { id: true, baseRating: true },
    }),
    db.match.count(),
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
    db.vote.findMany({
      where: { match: { status: "FINISHED" } },
      select: {
        matchId: true,
        targetId: true,
        score: true,
      },
    }),
  ]);

  const medalsByPlayer = computeMedalsFromVotes(finishedVotes);
  const playerMedals = medalsByPlayer[player.id] ?? { gold: 0, silver: 0, bronze: 0 };

  const playerRoundedRating = player.baseRating != null ? Math.round(player.baseRating * 10) : null;
  const isActiveInRanking = playerRoundedRating != null && allActivePlayers.some((p) => p.id === player.id);
  const overallRank = isActiveInRanking
    ? 1 + allActivePlayers.filter((p) => p.baseRating != null && Math.round(p.baseRating * 10) > (playerRoundedRating as number)).length
    : null;
  const totalActive = allActivePlayers.length;

  // Montar ranking partida por partida
  const matchTargetScores: Record<string, Record<string, number[]>> = {};
  for (const v of matchVotes) {
    if (!matchTargetScores[v.matchId]) matchTargetScores[v.matchId] = {};
    if (!matchTargetScores[v.matchId][v.targetId]) matchTargetScores[v.matchId][v.targetId] = [];
    matchTargetScores[v.matchId][v.targetId].push(v.score);
  }

  const matchHistory = player.attendances.map((att) => {
    const scoresMap = matchTargetScores[att.matchId] || {};
    const playerScores = scoresMap[player.id] || [];
    const playerAvg = playerScores.length
      ? Math.round((playerScores.reduce((a, b) => a + b, 0) / playerScores.length) * 10) / 10
      : null;

    const targetAverages: { targetId: string; avg: number }[] = [];
    for (const [targetId, scores] of Object.entries(scoresMap)) {
      if (scores.length > 0) {
        const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        targetAverages.push({ targetId, avg });
      }
    }

    const place =
      playerAvg != null
        ? 1 + targetAverages.filter((t) => t.avg > playerAvg).length
        : null;
    const totalInMatch = targetAverages.length;

    return {
      matchId: att.matchId,
      date: att.match.date,
      location: att.match.location,
      status: att.match.status,
      playerAvg,
      place,
      totalInMatch,
    };
  });

  const timesPlayed = player.attendances.length;
  const attendanceRate =
    totalMatchesCount > 0 && timesPlayed > 0
      ? Math.min(100, Math.round((timesPlayed / totalMatchesCount) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <Link
          href="/historico"
          className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-moss-soft hover:text-brick transition-colors w-fit"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao Histórico
        </Link>

        {/* FUT Collectible Player Header Card */}
        <GlareHover
          glareColor="#d9a520"
          glareOpacity={0.2}
          className="border border-moss/20 bg-paper rounded-2xl shadow-hard overflow-hidden"
        >
          <div className="bg-moss text-paper fut-header-stripes px-4 py-2.5 flex items-center justify-between border-b border-moss/15">
            <ShinyText
              text="PLAYER CARD"
              color="#d9a520"
              shineColor="#f6f4ef"
              speed={2.2}
              className="text-[10px] font-extrabold uppercase tracking-[0.16em]"
            />
            {canSeeSecretRatings && overallRank ? (
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest bg-brick text-paper px-2.5 py-0.5 rounded-md">
                RANK #{overallRank}
              </span>
            ) : (
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest bg-white/15 text-paper px-2.5 py-0.5 rounded-md">
                ELENCO OFICIAL
              </span>
            )}
          </div>

          <div className="p-4 sm:p-5 fut-grid-bg flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <PlayerMedals medals={playerMedals} className="text-xs" />
                {player.isGoalkeeper && <GloveBadge />}
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl text-moss leading-tight break-words">
                <SplitText text={player.name} tag="span" />
              </h1>
            </div>

            {/* Nota Badge (Retangular) */}
            <div className="shrink-0 rounded-xl border border-moss/20 bg-white/85 px-4 py-2.5 shadow-hard-sm text-center">
              <span className="block text-[9px] font-extrabold uppercase tracking-[0.16em] text-brick leading-none mb-1">
                NOTA GERAL
              </span>
              {canSeeSecretRatings ? (
                player.baseRating != null ? (
                  <span className="font-mono text-2xl font-extrabold text-moss tabular-nums leading-none">
                    ★ <CountUp to={player.baseRating} decimals={1} duration={1.3} />
                  </span>
                ) : (
                  <span className="font-mono text-sm font-extrabold text-moss-soft leading-none">
                    Sem nota
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-xs font-extrabold text-moss-soft leading-none py-1">
                  <Lock className="size-3.5 text-brick" /> PIN
                </span>
              )}
            </div>
          </div>
        </GlareHover>
      </div>

      {/* Banner Especial de Organizador */}
      {isOrganizer && (
        <section className="border border-brick/35 rounded-xl bg-amber-500/8 p-3.5 flex flex-col gap-1.5">
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
                  className="bg-brick text-paper hover:bg-brick/90 py-1 px-3 text-[11px] font-bold uppercase tracking-wider shadow-none cursor-pointer border-transparent"
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
        {hasOwnerAccess && Boolean(player.pin) && (
          <ProfilePublicToggle playerId={player.id} initialIsPublic={player.isPublic} />
        )}
        {!player.pin && <ProfileSetPin playerId={player.id} />}
      </section>

      {/* Quadro de Medalhas Acumuladas (3-Column Podium Grid) */}
      <SpotlightCard className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brick block">
              Conquistas em Partidas Encerradas
            </span>
            <h2 className="font-serif text-xl text-moss">Quadro de Medalhas</h2>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-amber-500/35 bg-amber-400/12 p-3 flex flex-col items-center justify-center text-center">
            <span className="text-xl leading-none mb-1">🥇</span>
            <span className="font-serif text-2xl font-bold text-amber-950 tabular-nums leading-none">
              <CountUp to={playerMedals.gold} duration={1} />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900/80 mt-1">
              Ouro
            </span>
          </div>
          <div className="rounded-xl border border-slate-400/40 bg-slate-200/55 p-3 flex flex-col items-center justify-center text-center">
            <span className="text-xl leading-none mb-1">🥈</span>
            <span className="font-serif text-2xl font-bold text-slate-800 tabular-nums leading-none">
              <CountUp to={playerMedals.silver} duration={1} />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mt-1">
              Prata
            </span>
          </div>
          <div className="rounded-xl border border-amber-700/30 bg-amber-700/10 p-3 flex flex-col items-center justify-center text-center">
            <span className="text-xl leading-none mb-1">🥉</span>
            <span className="font-serif text-2xl font-bold text-amber-950 tabular-nums leading-none">
              <CountUp to={playerMedals.bronze} duration={1} />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900/75 mt-1">
              Bronze
            </span>
          </div>
        </div>
      </SpotlightCard>

      {/* Cards de Resumo Geral e Estatísticas */}
      <section className="grid grid-cols-2 gap-3">
        <SpotlightCard className="border border-moss/15 bg-paper p-4 rounded-2xl shadow-hard flex flex-col justify-between fut-grid-bg">
          <div className="flex items-start justify-between text-moss-soft gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider leading-snug min-w-0 break-words">
              Classificação Geral
            </span>
            <span className="size-7 rounded-lg bg-amber-500/12 flex items-center justify-center shrink-0">
              <Trophy className="size-3.5 text-brick" />
            </span>
          </div>
          <div className="mt-2.5">
            {canSeeSecretRatings ? (
              <>
                <span className="font-serif text-3xl font-bold text-moss tabular-nums">
                  {overallRank ? <CountUp to={overallRank} suffix="º" duration={1.1} /> : "—"}
                </span>
                <span className="text-xs text-moss-soft block mt-0.5">de {totalActive} ativos</span>
              </>
            ) : (
              <>
                <span className="font-mono text-base font-extrabold text-moss-soft flex items-center gap-1.5">
                  <Lock className="size-3.5 text-brick" /> Oculto
                </span>
                <span className="text-[11px] text-moss-soft block mt-0.5">Cadastre o PIN</span>
              </>
            )}
          </div>
        </SpotlightCard>

        <SpotlightCard className="border border-moss/15 bg-paper p-4 rounded-2xl shadow-hard flex flex-col justify-between fut-grid-bg">
          <div className="flex items-start justify-between text-moss-soft gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider leading-snug min-w-0 break-words">
              Nota Geral
            </span>
            <span className="size-7 rounded-lg bg-amber-500/12 flex items-center justify-center shrink-0">
              <Star className="size-3.5 text-brick fill-brick" />
            </span>
          </div>
          <div className="mt-2.5">
            {canSeeSecretRatings ? (
              player.baseRating != null ? (
                <>
                  <span className="font-serif text-3xl font-bold text-moss tabular-nums">
                    ★ <CountUp to={player.baseRating} decimals={1} duration={1.2} />
                  </span>
                  <span className="text-xs text-moss-soft block mt-0.5">
                    {player.ratedMatches} {player.ratedMatches === 1 ? "avaliação" : "avaliações"}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-serif text-2xl font-bold text-moss-soft">
                    Sem nota
                  </span>
                  <span className="text-[11px] text-moss-soft block mt-0.5">
                    Calculada após 1º jogo
                  </span>
                </>
              )
            ) : (
              <>
                <span className="font-mono text-base font-extrabold text-moss-soft flex items-center gap-1.5">
                  <Lock className="size-3.5 text-brick" /> Oculta
                </span>
                <span className="text-[11px] text-moss-soft block mt-0.5">Restrito ao atleta</span>
              </>
            )}
          </div>
        </SpotlightCard>

        <SpotlightCard className="border border-moss/15 bg-paper p-4 rounded-2xl shadow-hard flex flex-col justify-between fut-grid-bg">
          <div className="flex items-start justify-between text-moss-soft gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider leading-snug min-w-0 break-words">
              Partidas
            </span>
            <span className="size-7 rounded-lg bg-moss/8 flex items-center justify-center shrink-0">
              <Calendar className="size-3.5 text-moss" />
            </span>
          </div>
          <div className="mt-2.5">
            <span className="font-serif text-3xl font-bold text-moss tabular-nums">
              <CountUp to={timesPlayed} duration={1.1} />
            </span>
            <span className="text-xs text-moss-soft block mt-0.5">
              {timesPlayed === 1 ? "presença" : "presenças"}
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="border border-moss/15 bg-paper p-4 rounded-2xl shadow-hard flex flex-col justify-between fut-grid-bg">
          <div className="flex items-start justify-between text-moss-soft gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider leading-snug min-w-0 break-words">
              Assiduidade
            </span>
            <span className="size-7 rounded-lg bg-moss/8 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-3.5 text-moss" />
            </span>
          </div>
          <div className="mt-2.5">
            <span className="font-serif text-3xl font-bold text-moss tabular-nums">
              <CountUp to={attendanceRate} suffix="%" duration={1.2} />
            </span>
            <span className="text-xs text-moss-soft block mt-0.5">das partidas</span>
          </div>
        </SpotlightCard>
      </section>

      {/* Histórico Partida por Partida com Classificação em Cada Dia */}
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between border-b border-moss/15 pb-2">
          <div>
            <span className="hud-tag bg-moss text-paper border-transparent mb-1">
              <ShinyText text="Histórico Detalhado" color="#f6f4ef" shineColor="#d9a520" speed={2.4} />
            </span>
            <h2 className="font-serif text-2xl text-moss leading-none">
              <SplitText text="Desempenho por Partida" tag="span" />
            </h2>
          </div>
          <span className="hud-tag bg-paper-dark text-moss font-mono">
            <span>
              <CountUp to={matchHistory.length} duration={1} /> {matchHistory.length === 1 ? "jogo" : "jogos"}
            </span>
          </span>
        </div>

        {matchHistory.length ? (
          <ul className="flex flex-col divide-y divide-moss/10 border border-moss/15 rounded-2xl bg-paper shadow-hard overflow-hidden">
            {matchHistory.map((m) => {
              const dateObj = typeof m.date === "string" ? new Date(m.date) : m.date;
              const timeStr = dateObj.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              });

              let rankBadge = null;
              if (m.place === 1) {
                rankBadge = (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-amber-400/20 text-amber-950 border border-amber-500/40 rounded-sm px-2 py-0.5">
                    🥇 1º lugar (Craque da Rodada)
                  </span>
                );
              } else if (m.place === 2) {
                rankBadge = (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-slate-200/80 text-slate-800 border border-slate-400/45 rounded-sm px-2 py-0.5">
                    🥈 2º lugar de {m.totalInMatch}
                  </span>
                );
              } else if (m.place === 3) {
                rankBadge = (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-amber-700/12 text-amber-900 border border-amber-700/30 rounded-sm px-2 py-0.5">
                    🥉 3º lugar de {m.totalInMatch}
                  </span>
                );
              } else if (m.place != null && canSeeSecretRatings) {
                rankBadge = (
                  <span className="text-[10px] font-bold uppercase text-moss-soft bg-paper-dark/80 border border-moss/15 rounded-sm px-2 py-0.5">
                    {m.place}º lugar de {m.totalInMatch}
                  </span>
                );
              }

              return (
                <li key={m.matchId} className="p-3.5 flex flex-col gap-2 hover:bg-paper-dark/45 transition-colors">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-moss">
                        {formatShortDate(dateObj)}
                      </span>
                      <span className="font-mono text-[10px] text-moss-soft bg-paper-dark/80 px-1.5 py-0.5 rounded-sm border border-moss/12">
                        {timeStr}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
                          m.status === "FINISHED"
                            ? "border-brick/35 text-brick bg-brick/10"
                            : "border-moss/25 text-moss bg-moss/8"
                        }`}
                      >
                        {m.status === "FINISHED" ? "Encerrada" : "Aberta"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {canSeeSecretRatings && m.playerAvg != null && (
                        <div className="inline-flex items-center gap-1 rounded-sm border border-moss/20 bg-white/80 px-2 py-0.5">
                          <Star className="size-3 fill-brick text-brick" />
                          <span className="font-mono text-xs font-extrabold text-moss tabular-nums">
                            {m.playerAvg.toFixed(1).replace(".", ",")}
                          </span>
                        </div>
                      )}

                      <Link
                        href={`/partida/${m.matchId}`}
                        className="text-[10px] font-extrabold uppercase tracking-wider text-brick hover:underline flex items-center gap-0.5"
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
          <div className="border border-moss/15 rounded-2xl bg-paper p-6 text-center text-xs text-moss-soft italic">
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
