import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, RotateCcw, Trash2, Users, Vote, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatMatchDate, formatDateTimeInput } from "@/lib/format";
import {
  addAttendances,
  addAttendancesByText,
  closeVoting,
  deleteMatch,
  openVoting,
  removeAttendance,
  reopenVoting,
  updateMatchConfig,
} from "@/app/admin/actions";
import { CopyLink, ShareVotingLink, SubmitButton } from "@/components/client";
import { AttendanceChecklist } from "@/components/attendance-checklist";
import { TeamColorSelector } from "@/components/team-color-selector";
import { Loading, StatusStamp, GloveBadge, TeamColorBadge } from "@/components/ui";
import SpotlightCard from "@/components/SpotlightCard";
import CountUp from "@/components/CountUp";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";

async function AdminVotesTable({ matchId }: { matchId: string }) {
  const [averages, attendances] = await Promise.all([
    db.vote.groupBy({
      by: ["targetId"],
      where: { matchId },
      _avg: { score: true },
      _count: { score: true },
    }),
    db.attendance.findMany({
      where: { matchId },
      include: { player: true },
    }),
  ]);

  const avgMap = new Map(averages.map((a) => [a.targetId, a._avg.score ?? 0]));
  const countMap = new Map(averages.map((a) => [a.targetId, a._count.score ?? 0]));

  const sorted = attendances
    .map((att) => {
      const rawAvg = avgMap.get(att.playerId) ?? 0;
      const roundedAvg = Math.round(rawAvg * 10) / 10;
      return {
        id: att.playerId,
        name: att.player.name,
        team: att.team,
        isGoalkeeper: att.asGoalkeeper || att.player.isGoalkeeper,
        avg: roundedAvg,
        count: countMap.get(att.playerId) ?? 0,
        baseRating: att.player.baseRating,
      };
    })
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));

  const list = sorted.map((p, idx) => ({
    ...p,
    rank: p.avg > 0 ? 1 + sorted.filter((other) => other.avg > p.avg).length : idx + 1,
  }));

  if (!list.length) {
    return <p className="text-xs text-moss-soft">Nenhum voto computado para esta partida.</p>;
  }

  return (
    <div className="border border-moss/15 rounded-xl overflow-hidden bg-white/75">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-moss text-paper uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-2.5 px-2 w-8 text-center font-extrabold">#</th>
              <th className="py-2.5 px-2 font-extrabold">Jogador</th>
              <th className="py-2.5 px-2 text-center font-extrabold">Votos</th>
              <th className="py-2.5 px-2 text-right font-extrabold">Média</th>
              <th className="py-2.5 px-2 text-right font-extrabold">Base</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-moss/10 text-xs">
            {list.map((p) => (
              <tr key={p.id} className={p.rank <= 5 && p.avg > 0 ? "bg-amber-500/8 font-semibold" : "hover:bg-paper-dark/40"}>
                <td className="py-2.5 px-2 tabular-nums text-moss-soft text-center font-mono">
                  {p.avg > 0 ? `${p.rank}º` : "–"}
                </td>
                <td className="py-2.5 px-2 min-w-0 max-w-[160px]">
                  <div className="flex items-center gap-1 min-w-0">
                    {p.avg > 0 && p.rank === 1 && <span className="text-xs leading-none shrink-0">🥇</span>}
                    {p.avg > 0 && p.rank === 2 && <span className="text-xs leading-none shrink-0">🥈</span>}
                    {p.avg > 0 && p.rank === 3 && <span className="text-xs leading-none shrink-0">🥉</span>}
                    <TeamColorBadge team={p.team} />
                    <Link
                      href={`/perfil/${p.id}`}
                      className="truncate font-bold text-moss hover:text-brick hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.isGoalkeeper && <GloveBadge />}
                    {p.rank === 1 && p.avg > 0 && (
                      <span className="text-[9px] rounded-xs bg-moss text-paper font-extrabold px-1.5 py-0.5 shrink-0">
                        CRAQUE
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-2 text-center tabular-nums font-mono">{p.count}</td>
                <td className="py-2.5 px-2 text-right font-mono font-extrabold text-moss whitespace-nowrap">
                  {p.avg > 0 ? (
                    <span className="inline-flex items-center rounded-sm border border-moss/20 bg-paper-dark/75 px-1.5 py-0.5">
                      ★ {p.avg.toFixed(1).replace(".", ",")}
                    </span>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-moss-soft whitespace-nowrap">
                  {p.baseRating != null ? `★ ${p.baseRating.toFixed(1).replace(".", ",")}` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function MatchAdminView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  await requireAdmin();

  const [match, allPlayers] = await Promise.all([
    db.match.findUnique({
      where: { id },
      include: {
        attendances: {
          include: { player: true },
          orderBy: { player: { name: "asc" } },
        },
      },
    }),
    db.player.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!match) notFound();

  const attendingPlayerIds = new Set(match.attendances.map((a) => a.playerId));
  const availablePlayers = allPlayers.filter((p) => !attendingPlayerIds.has(p.id));

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <SpotlightCard className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard fut-grid-bg flex flex-col gap-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-moss-soft hover:text-brick transition-colors w-fit"
        >
          <ArrowLeft className="size-3.5" /> Painel do Organizador
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <span className="hud-tag bg-moss text-paper border-transparent mb-1.5">
              <ShinyText text="Gerenciar Partida" color="#f6f4ef" shineColor="#d9a520" speed={2.2} />
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-moss leading-tight first-letter:uppercase">
              <SplitText text={formatMatchDate(match.date)} tag="span" />
            </h1>
            {(match.location || match.cost != null) && (
              <p className="text-xs text-moss font-bold mt-1.5 flex items-center gap-1.5 flex-wrap">
                {match.location && (
                  <span className="rounded-md border border-moss/15 bg-white/80 px-2 py-0.5">📍 {match.location}</span>
                )}
                {match.cost != null && (
                  <span className="rounded-md border border-brick/25 bg-brick/10 px-2 py-0.5 font-mono">
                    💰 R$ {match.cost.toFixed(2).replace(".", ",")} por jogador
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusStamp status={match.status} votingOpen={match.votingOpen} />
            {match.status === "FINISHED" && (
              <Link
                href={`/partida/${match.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-moss/20 bg-white/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider hover:bg-moss hover:text-paper transition-colors"
              >
                Resumo <ArrowUpRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </SpotlightCard>

      {/* Votação e Notas */}
      <SpotlightCard className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard flex flex-col gap-4">
        <div
          className={`flex items-center justify-between flex-wrap gap-2 ${
            match.votingOpen || match.status === "FINISHED" ? "border-b border-moss/10 pb-2.5" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <Vote className="size-5 text-brick" />
            <h2 className="font-serif text-2xl text-moss">Votação e Notas</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {match.status !== "FINISHED" ? (
              !match.votingOpen ? (
                <form action={openVoting.bind(null, match.id)}>
                  <SubmitButton className="bg-moss text-paper hover:bg-moss-soft py-1.5 px-3.5 text-xs font-extrabold uppercase tracking-wider shadow-hard-brick border-transparent">
                    Abrir Votação
                  </SubmitButton>
                </form>
              ) : (
                <form action={closeVoting.bind(null, match.id)}>
                  <SubmitButton
                    className="bg-brick text-paper hover:bg-brick/90 py-1.5 px-3.5 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm border-transparent"
                    confirm="Deseja encerrar a votação desta partida e atualizar a nota base dos jogadores?"
                  >
                    Encerrar Votação e Salvar Notas
                  </SubmitButton>
                </form>
              )
            ) : (
              <form action={reopenVoting.bind(null, match.id)}>
                <SubmitButton
                  className="bg-paper-dark text-moss hover:bg-paper py-1.5 px-3.5 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm"
                  confirm="Deseja reabrir a votação desta partida? As notas aplicadas ao encerrar serão revertidas até o novo encerramento."
                >
                  <RotateCcw className="size-3.5" />
                  Reabrir Votação
                </SubmitButton>
              </form>
            )}

            <Link
              href={`/admin/partida/${match.id}/votacao`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-moss/20 bg-paper-dark hover:bg-white text-moss py-1.5 px-3.5 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm transition-colors"
            >
              Ver Votação
              <ArrowUpRight className="size-3.5 text-brick" />
            </Link>
          </div>
        </div>

        {match.votingOpen && (
          <ShareVotingLink
            url="/votar"
            matchDate={formatMatchDate(match.date)}
          />
        )}

        {match.status === "FINISHED" && (
          <>
            <div className="p-3 bg-moss/8 rounded-xl border border-moss/15 text-xs text-moss font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-moss shrink-0" />
              Partida finalizada. As notas computadas abaixo já foram incorporadas à nota base dos jogadores.
            </div>
            <AdminVotesTable matchId={match.id} />
          </>
        )}
      </SpotlightCard>

      {/* Lista de Presença da Partida */}
      <SpotlightCard className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-moss/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-moss" />
            <h2 className="font-serif text-2xl text-moss">Jogadores na Partida</h2>
          </div>
          <span className="hud-tag bg-paper-dark text-moss font-mono">
            <span>
              <CountUp to={match.attendances.length} duration={1} /> confirmados
            </span>
          </span>
        </div>

        {/* Lista atual (Full width rows so GloveBadge never covers the name) */}
        {match.attendances.length ? (
          <ul className="flex flex-col gap-2">
            {match.attendances.map((a, i) => (
              <li
                key={a.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-moss/12 bg-white/70 text-xs gap-3 flex-wrap sm:flex-nowrap"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-md bg-moss/10 text-moss font-mono text-[10px] font-extrabold shrink-0">
                    {i + 1}
                  </span>
                  <TeamColorBadge team={a.team} />
                  <span className="truncate font-bold text-sm text-moss">{a.player.name}</span>
                  {a.player.isGoalkeeper && <GloveBadge className="ml-0.5" />}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {match.status !== "FINISHED" && (
                    <TeamColorSelector
                      matchId={match.id}
                      attendanceId={a.id}
                      playerId={a.playerId}
                      currentTeam={a.team}
                      isGoalkeeper={a.asGoalkeeper || a.player.isGoalkeeper}
                    />
                  )}

                  {match.status !== "FINISHED" && (
                    <form action={removeAttendance.bind(null, match.id, a.id)}>
                      <SubmitButton
                        className="text-brick bg-paper/90 hover:bg-brick hover:text-paper border border-moss/15 px-2.5 py-1 text-[10px] font-extrabold uppercase shadow-none rounded-md"
                        confirm={`Remover ${a.player.name} desta partida?`}
                      >
                        Remover
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-moss-soft italic">Nenhum jogador adicionado a esta partida.</p>
        )}

        {/* Adicionar Jogadores à Partida */}
        {match.status !== "FINISHED" && (
          <div className="mt-2 pt-4 border-t border-moss/10 flex flex-col gap-4">
            <h3 className="font-serif text-lg text-moss">Adicionar Jogadores</h3>

            {availablePlayers.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-moss-soft">
                  Selecionar do Cadastro ({availablePlayers.length} disponíveis)
                </span>
                <AttendanceChecklist
                  players={availablePlayers.map((p) => ({
                    id: p.id,
                    name: p.name,
                    isGoalkeeper: p.isGoalkeeper,
                    baseRating: p.baseRating,
                  }))}
                  action={addAttendances.bind(null, match.id)}
                />
              </div>
            ) : (
              <p className="text-xs text-moss-soft italic">
                Todos os jogadores ativos já estão presentes nesta partida.
              </p>
            )}

            {/* Colar lista de nomes */}
            <details className="border-t border-moss/10 pt-2">
              <summary className="text-xs font-extrabold uppercase tracking-wider text-brick cursor-pointer underline">
                + Adicionar por Lista de Nomes (Colar texto ou lista numerada)
              </summary>
              <form action={addAttendancesByText.bind(null, match.id)} className="flex flex-col gap-2 mt-3">
                <textarea
                  name="names"
                  rows={4}
                  className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-xs font-mono text-moss outline-none"
                  placeholder={`1. Paulo Ricardo\n2. Tuguinho\n3. Ricardo...`}
                  required
                />
                <SubmitButton className="bg-moss text-paper hover:bg-moss-soft py-2 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm border-transparent">
                  Importar e Adicionar à Partida
                </SubmitButton>
              </form>
            </details>
          </div>
        )}
      </SpotlightCard>

      {/* Editar Dados da Partida */}
      <SpotlightCard className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard flex flex-col gap-4">
        <h2 className="font-serif text-xl border-b border-moss/10 pb-2">Editar Dados da Partida</h2>
        <form action={updateMatchConfig.bind(null, match.id)} className="flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
              Data e Horário
            </label>
            <input
              name="date"
              type="datetime-local"
              defaultValue={formatDateTimeInput(match.date)}
              className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-xs font-mono text-moss outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
                Local
              </label>
              <input
                name="location"
                type="text"
                defaultValue={match.location ?? ""}
                placeholder="Ex: Arena Futebol Clube"
                className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-xs text-moss outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
                Valor por Jogador (R$)
              </label>
              <input
                name="cost"
                type="number"
                step="0.50"
                defaultValue={match.cost ?? ""}
                placeholder="Ex: 25.00"
                className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-xs font-mono text-moss outline-none"
              />
            </div>
          </div>

          <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-2.5 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm mt-1 border-transparent">
            Salvar Alterações
          </SubmitButton>
        </form>
      </SpotlightCard>

      {/* Exclusão da Partida */}
      <section className="border border-brick/30 rounded-2xl bg-paper p-4 flex items-center justify-between gap-4">
        <div>
          <span className="font-serif text-base text-brick block">Excluir Partida</span>
          <span className="text-[11px] text-moss-soft">
            Apaga permanentemente a partida e seus votos. Se finalizada, reverte os pontos.
          </span>
        </div>
        <form action={deleteMatch.bind(null, match.id)}>
          <SubmitButton
            className="bg-brick text-paper hover:bg-brick/90 py-2 px-3 text-xs font-extrabold uppercase tracking-wider shadow-none shrink-0 border-transparent"
            confirm="Tem certeza que deseja apagar permanentemente esta partida?"
          >
            <Trash2 className="size-3.5 mr-1" />
            Excluir Partida
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}

export default function AdminMatchPage({ params }: PageProps<"/admin/partida/[id]">) {
  return (
    <Suspense fallback={<Loading label="Carregando partida…" />}>
      <MatchAdminView params={params} />
    </Suspense>
  );
}
