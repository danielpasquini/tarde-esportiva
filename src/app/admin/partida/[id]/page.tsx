import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, Trash2, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getMatch } from "@/lib/match";
import { formatMatchDate, formatDateTimeInput } from "@/lib/format";
import { teamsFor, teamLabel, TEAM_META, TEAM_ORDER, type TeamKey } from "@/lib/teams";
import {
  addAttendances,
  addAttendancesByText,
  closeVoting,
  deleteMatch,
  drawTeams,
  openVoting,
  reopenList,
  microReorganize,
  planBReorganize,
  toggleFixedGkMode,
  togglePlayerUnavailable,
  applySuggestedFormat,
  updateMatchConfig,
} from "@/app/admin/actions";
import { PreDrawList, TeamsBoard } from "@/components/lineup";
import { CopyLink, SubmitButton } from "@/components/client";
import { AttendanceChecklist } from "@/components/attendance-checklist";
import { Loading, StatusStamp, GloveBadge } from "@/components/ui";

async function AdminVotesTable({ matchId }: { matchId: string }) {
  const [averages, attendances] = await Promise.all([
    db.vote.groupBy({
      by: ["targetId"],
      where: { matchId },
      _avg: { score: true },
      _count: { score: true },
    }),
    db.attendance.findMany({
      where: { matchId, team: { not: null } },
      include: { player: true },
    }),
  ]);

  const avgMap = new Map(averages.map((a) => [a.targetId, a._avg.score ?? 0]));
  const countMap = new Map(averages.map((a) => [a.targetId, a._count.score ?? 0]));

  const list = attendances
    .map((att) => ({
      id: att.playerId,
      name: att.player.name,
      team: att.team,
      isGoalkeeper: att.asGoalkeeper || att.player.isGoalkeeper,
      avg: avgMap.get(att.playerId) ?? 0,
      count: countMap.get(att.playerId) ?? 0,
      baseRating: att.player.baseRating,
    }))
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));

  if (!list.length) {
    return <p className="text-xs text-moss-soft">Nenhum voto computado para esta partida.</p>;
  }

  return (
    <div className="border-2 border-moss overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs bg-paper">
          <thead className="bg-paper-dark border-b-2 border-moss uppercase tracking-wider text-[9px] sm:text-[10px] text-moss-soft">
            <tr>
              <th className="p-2 sm:p-2.5 w-8">#</th>
              <th className="p-2 sm:p-2.5">Jogador</th>
              <th className="p-2 sm:p-2.5 text-center">
                <span className="hidden sm:inline">Colete</span>
                <span className="sm:hidden">Time</span>
              </th>
              <th className="p-2 sm:p-2.5 text-center">
                <span className="hidden sm:inline">Votos</span>
                <span className="sm:hidden">Vts</span>
              </th>
              <th className="p-2 sm:p-2.5 text-right">
                <span className="hidden sm:inline">Média Partida</span>
                <span className="sm:hidden">Média</span>
              </th>
              <th className="p-2 sm:p-2.5 text-right">
                <span className="hidden sm:inline">Nota Base Geral</span>
                <span className="sm:hidden">Base</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-moss/20 text-[11px] sm:text-xs">
            {list.map((p, idx) => (
              <tr key={p.id} className={idx < 5 ? "bg-amber-500/5 font-semibold" : ""}>
                <td className="p-2 sm:p-2.5 tabular-nums text-moss-soft">{idx + 1}º</td>
                <td className="p-2 sm:p-2.5 min-w-0 max-w-[130px] sm:max-w-none">
                  <div className="flex items-center gap-1.5 truncate">
                    {p.team && (
                      <span
                        className={`size-2.5 rounded-xs border border-moss/40 shrink-0 ${
                          TEAM_META[p.team as TeamKey]?.swatch ?? ""
                        }`}
                        title={TEAM_META[p.team as TeamKey]?.label}
                      />
                    )}
                    <span className="truncate">{p.name}</span>
                    {p.isGoalkeeper && <GloveBadge />}
                    {idx === 0 && (
                      <span className="text-[8px] sm:text-[9px] bg-amber-500 text-white font-bold px-1 rounded shrink-0">
                        CRAQUE
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-2 sm:p-2.5 text-center uppercase text-[10px]">{p.team ?? "–"}</td>
                <td className="p-2 sm:p-2.5 text-center tabular-nums">{p.count}</td>
                <td className="p-2 sm:p-2.5 text-right font-mono font-bold text-moss whitespace-nowrap">
                  {p.avg > 0 ? `★ ${p.avg.toFixed(1).replace(".", ",")}` : "–"}
                </td>
                <td className="p-2 sm:p-2.5 text-right font-mono text-moss-soft whitespace-nowrap">
                  ★ {p.baseRating.toFixed(1).replace(".", ",")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getFormatSuggestion(match: {
  numTeams: number;
  lineSize: number;
  attendances: { isUnavailable?: boolean; asGoalkeeper?: boolean; player: { isGoalkeeper: boolean } }[];
}) {
  const numTeams = match.numTeams;
  const currentLineSize = match.lineSize;
  const totalConfirmed = match.attendances.length;
  const gks = match.attendances.filter((a) => a.player.isGoalkeeper || a.asGoalkeeper).length;
  const lineAvailable = Math.max(0, totalConfirmed - Math.min(gks, Math.max(numTeams, 2)));

  // Opções possíveis de formato
  const candidateSizes = [5, 4, 6, 3];
  let bestSize = currentLineSize;
  let bestScore = -Infinity;

  for (const size of candidateSizes) {
    const slotsNeeded = numTeams * size;
    const deficit = Math.max(0, slotsNeeded - lineAvailable);
    const surplus = Math.max(0, lineAvailable - slotsNeeded);

    let score = 0;
    // Peso do formato ideal: 1 goleiro + 5 linha
    if (size === 5) score += 60;
    else if (size === 4) score += 20;
    else if (size === 6) score += 10;
    else if (size === 3) score += 0;

    // Menos empréstimos necessários
    score -= deficit * 15;
    // Aproveitar jogadores disponíveis
    score -= surplus * 8;

    if (deficit === 0 && surplus <= 1) {
      score += 25;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSize = size;
    }
  }

  if (bestSize !== currentLineSize) {
    const slotsNeeded = numTeams * bestSize;
    let reason = "";
    if (bestSize === 5) {
      if (lineAvailable >= slotsNeeded) {
        reason = `Com ${lineAvailable} jogadores confirmados para ${numTeams} times, o formato ideal (1 goleiro + 5 jogadores) acomoda todo o elenco de forma limpa, sem necessidade de empréstimos excessivos.`;
      } else {
        reason = `O formato ideal do grupo é 1 goleiro + 5 jogadores. Ele garante a dinâmica ideal de jogo para o número de jogadores confirmados.`;
      }
    } else if (bestSize === 6 && lineAvailable > numTeams * 5) {
      reason = `Há muitos jogadores disponíveis (${lineAvailable} jogadores). Mudar para 1 goleiro + 6 jogadores permite que todos joguem com menos tempo de espera.`;
    } else if (bestSize < currentLineSize) {
      reason = `O formato atual (1+${currentLineSize}) exige muitos empréstimos devido ao número de jogadores presentes (${lineAvailable} jogadores). Mudar para 1+${bestSize} fecha as equipes de forma mais natural.`;
    } else {
      reason = `Com ${lineAvailable} jogadores confirmados, o formato 1 goleiro + ${bestSize} jogadores otimiza a montagem dos times.`;
    }

    return {
      suggestedLineSize: bestSize,
      isIdeal: bestSize === 5,
      reason,
    };
  }

  return null;
}

async function AdminMatchView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireAdmin();
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) notFound();

  const confirmedIds = new Set(match.attendances.map((a) => a.playerId));
  const allPlayers = await db.player.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const unconfirmed = allPlayers.filter((p) => !confirmedIds.has(p.id));
  const validTeams = teamsFor(match.numTeams) as string[];
  const formatSuggestion = getFormatSuggestion(match);

  return (
    <div className="flex flex-col gap-6">
      <header className="border-[3px] border-moss bg-paper p-4 shadow-hard">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-moss-soft mb-2">
          <ArrowLeft className="size-3.5" /> Painel do Organizador
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">Partida</span>
            <h1 className="font-serif text-3xl first-letter:uppercase leading-tight">{formatMatchDate(match.date)}</h1>
            {(match.location || match.cost != null) && (
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-moss font-semibold">
                {match.location && <span>📍 {match.location}</span>}
                {match.cost != null && <span>💰 R$ {match.cost.toFixed(2).replace(".", ",")} por jogador</span>}
              </div>
            )}
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-moss/20">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/partida/${match.id}`}
              className="inline-flex items-center gap-1 border-2 border-moss bg-paper-dark px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-moss hover:bg-paper"
              target="_blank"
            >
              Página Pública <ArrowUpRight className="size-3.5" />
            </Link>
            {match.votingOpen && (
              <Link
                href={`/votar/${match.voteToken}`}
                className="inline-flex items-center gap-1 border-2 border-moss bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brick hover:bg-paper-dark"
                target="_blank"
              >
                Cédula de Votação <ArrowUpRight className="size-3.5" />
              </Link>
            )}
          </div>
          <form action={deleteMatch.bind(null, match.id)}>
            <SubmitButton
              className="inline-flex items-center gap-1 border border-brick/40 bg-brick/10 hover:bg-brick hover:text-paper text-brick px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-colors shadow-none"
              confirm="Excluir esta partida? Os dados e votos relacionados serão apagados e recalculados."
              title="Excluir partida"
            >
              <Trash2 className="size-3.5" /> Excluir Partida
            </SubmitButton>
          </form>
        </div>
      </header>

      {/* Sugestão Inteligente de Formato (Goleiro + Jogadores) - Somente após o primeiro sorteio */}
      {formatSuggestion && match.status === "DRAWN" && (
        <section className="border-[3px] border-moss bg-amber-500/15 p-4 shadow-hard flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <h3 className="font-serif text-base sm:text-lg font-bold text-moss">
                Sugestão de Formato: {formatSuggestion.isIdeal ? "1 Goleiro + 5 Jogadores (Ideal do Grupo)" : `1 Goleiro + ${formatSuggestion.suggestedLineSize} Jogadores`}
              </h3>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-moss text-paper px-2 py-0.5 rounded">
              Otimização
            </span>
          </div>

          <p className="text-xs text-moss font-medium">
            {formatSuggestion.reason}
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-moss/20 flex-wrap gap-2">
            <span className="text-[11px] text-moss-soft">
              Formato Atual: <strong>1+{match.lineSize}</strong> → Sugerido: <strong>1+{formatSuggestion.suggestedLineSize}</strong>
            </span>
            <form action={applySuggestedFormat.bind(null, match.id)}>
              <input type="hidden" name="lineSize" value={formatSuggestion.suggestedLineSize} />
              <SubmitButton className="bg-moss text-paper hover:bg-moss-soft py-1.5 px-3.5 text-xs font-bold uppercase tracking-wider shadow-hard-sm">
                Aplicar Formato {formatSuggestion.suggestedLineSize === 5 ? "1+5 (Ideal)" : `1+${formatSuggestion.suggestedLineSize}`}
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

      {/* Compartilhar link de votação */}
      {match.votingOpen && (
        <section className="border-[3px] border-moss bg-paper p-4 shadow-hard">
          <p className="text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-2">Link direto para os jogadores votarem</p>
          <CopyLink url={`/votar/${match.voteToken}`} id="copiar-link-votacao" />
        </section>
      )}

      {/* Ações da Partida */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <h2 className="font-serif text-xl border-b-2 border-moss/20 pb-2">Ações da Partida</h2>
        <div className="flex flex-col gap-2">
          {match.status === "OPEN" && (
            <form action={drawTeams.bind(null, match.id)} className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-2 border-moss bg-paper-dark p-2.5">
                <span className="text-xs font-bold text-moss flex items-center gap-1.5">
                  <span>🧤</span> Goleiros:
                </span>
                <select
                  name="fixedGk"
                  defaultValue="true"
                  className="border border-moss bg-paper px-2 py-1 text-xs font-bold text-moss outline-none"
                >
                  <option value="true">Goleiros Fixos</option>
                  <option value="false">Goleiros Rotativos (Revezamento)</option>
                </select>
              </div>
              <SubmitButton
                className="w-full bg-moss text-paper hover:bg-moss-soft py-3 text-xs font-bold uppercase tracking-widest shadow-hard-brick"
                id="sortear-times"
                confirm="Sortear times agora? Os jogadores serão distribuídos de forma equilibrada entre as equipes."
              >
                Sortear Times
              </SubmitButton>
            </form>
          )}

          {match.status === "DRAWN" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <form action={drawTeams.bind(null, match.id)} className="flex flex-col gap-1.5 border border-moss/20 p-2 bg-paper-dark/30 rounded">
                  <div className="flex items-center justify-between text-xs font-bold text-moss">
                    <span>🧤 Goleiros:</span>
                    <select
                      name="fixedGk"
                      defaultValue={match.attendances.some((a) => a.asGoalkeeper) ? "true" : "false"}
                      className="border border-moss bg-paper px-2 py-0.5 text-[11px] font-bold text-moss outline-none"
                    >
                      <option value="true">Fixos</option>
                      <option value="false">Rotativos</option>
                    </select>
                  </div>
                  <SubmitButton
                    className="w-full bg-paper-dark text-moss hover:bg-paper py-2 text-xs font-bold uppercase tracking-wider"
                    confirm="Refazer sorteio? Os coletes atuais serão recalculados."
                  >
                    Refazer Sorteio
                  </SubmitButton>
                </form>

                <div className="flex flex-col gap-1.5 justify-between">
                  <form action={toggleFixedGkMode.bind(null, match.id)}>
                    <SubmitButton className="w-full bg-paper text-moss hover:bg-paper-dark py-2 text-[11px] font-bold uppercase tracking-wider border border-moss/30 shadow-none">
                      {match.attendances.some((a) => a.asGoalkeeper)
                        ? "🧤 Goleiros Fixos Ativos (Alternar para Rotativos)"
                        : "🔄 Goleiros Rotativos (Alternar para Fixos)"}
                    </SubmitButton>
                  </form>

                  <form action={reopenList.bind(null, match.id)}>
                    <SubmitButton
                      className="w-full bg-paper-dark text-moss hover:bg-paper py-2 text-xs font-bold uppercase tracking-wider"
                      confirm="Reabrir lista? Os times serão desfeitos para adicionar novos nomes."
                    >
                      Reabrir Lista
                    </SubmitButton>
                  </form>
                </div>
              </div>

              {!match.votingOpen && (
                <form action={openVoting.bind(null, match.id)}>
                  <SubmitButton
                    className="w-full bg-paper text-moss hover:bg-paper-dark py-3 text-xs font-bold uppercase tracking-widest shadow-hard-sm"
                    id="abrir-votacao"
                  >
                    Liberar Votação Pós-Jogo
                  </SubmitButton>
                </form>
              )}

              {match.votingOpen && (
                <form action={closeVoting.bind(null, match.id)}>
                  <SubmitButton
                    className="w-full bg-brick text-paper hover:bg-brick/90 py-3 text-xs font-bold uppercase tracking-widest shadow-hard-sm"
                    id="fechar-votacao"
                    confirm="Encerrar partida e computar votos? A votação será fechada, as notas serão consolidadas e a imagem do Jogador do Dia será disponibilizada."
                  >
                    Encerrar Partida e Gerar Imagem do Craque
                  </SubmitButton>
                </form>
              )}
            </div>
          )}

          {match.status === "FINISHED" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-moss/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-moss">Imagem Gerada da Rodada</span>
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
                  alt="Imagem do Jogador do Dia"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Relatório Completo de Votos (Visível Somente para o Organizador) */}
      {match.status === "FINISHED" && (
        <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-3">
          <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Área Restrita do Organizador</span>
              <h2 className="font-serif text-xl">Todas as Notas da Partida</h2>
            </div>
          </div>
          <p className="text-xs text-moss-soft">
            Somente você tem acesso a estas notas detalhadas. Para os jogadores, apenas o Top 5 foi revelado na imagem.
          </p>
          <AdminVotesTable matchId={match.id} />
        </section>
      )}

      {/* Adicionar presenças pelo Administrador */}
      {match.status !== "FINISHED" && unconfirmed.length > 0 && (
        <section className="border-[3px] border-moss bg-paper p-4 shadow-hard flex flex-col gap-3">
          <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">Controle de Lista</span>
              <h2 className="font-serif text-lg">Confirmar Jogadores na Partida ({unconfirmed.length} disponíveis)</h2>
            </div>
          </div>
          <p className="text-xs text-moss-soft">
            Selecione abaixo os jogadores presentes para registrar na partida:
          </p>
          <AttendanceChecklist players={unconfirmed} action={addAttendances.bind(null, match.id)} />

          {/* Adicionar presenças colando lista numerada */}
          <details className="pt-2 border-t border-moss/20">
            <summary className="text-xs font-bold uppercase tracking-wider text-brick cursor-pointer underline">
              + Colar Lista Numerada (Adicionar presenças via texto)
            </summary>
            <form action={addAttendancesByText.bind(null, match.id)} className="flex flex-col gap-3 mt-3">
              <div>
                <label htmlFor="batch-attendance-names" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Cole a lista da partida (ex: 1. Paulo Ricardo, 2. Tuguinho...)
                </label>
                <textarea
                  id="batch-attendance-names"
                  name="names"
                  rows={5}
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs font-mono text-moss outline-none"
                  placeholder={`1. Paulo Ricardo\n2. Tuguinho\n3. Ricardo...`}
                  required
                />
              </div>
              <SubmitButton className="w-full bg-paper-dark text-moss hover:bg-paper py-2 text-xs font-bold uppercase tracking-wider border-2 border-moss shadow-hard-sm">
                Processar e Incluir na Partida
              </SubmitButton>
            </form>
          </details>
        </section>
      )}

      {/* Card: Jogadores Indisponíveis e Reorganização */}
      {match.status === "DRAWN" && (
        <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
          <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">
                Gestão de Desfalques & Imprevistos
              </span>
              <h2 className="font-serif text-xl">Jogadores Indisponíveis</h2>
            </div>
            <span className="text-xs font-mono font-bold text-moss-soft">
              {match.attendances.filter((a) => a.isUnavailable).length} desfalque(s)
            </span>
          </div>

          <p className="text-xs text-moss-soft">
            Selecione jogadores que tiveram imprevisto. O balanceamento se dará por empréstimo do time que não está jogando para manter a paridade sem permitir 6 contra 7.
          </p>

          <div className="border-2 border-moss bg-paper divide-y divide-moss/20 max-h-72 overflow-y-auto">
            {[...match.attendances.filter((a) => a.team)]
              .sort((a, b) => {
                const teamIdxA = TEAM_ORDER.indexOf(a.team as TeamKey);
                const teamIdxB = TEAM_ORDER.indexOf(b.team as TeamKey);
                if (teamIdxA !== teamIdxB) return teamIdxA - teamIdxB;
                const rA = a.ratingAtDraw ?? a.player.baseRating;
                const rB = b.ratingAtDraw ?? b.player.baseRating;
                return rB - rA || a.player.name.localeCompare(b.player.name);
              })
              .map((att) => (
                <div
                  key={att.id}
                  className={`flex items-center justify-between p-2.5 text-xs transition-colors ${
                    att.isUnavailable ? "bg-brick/10" : "hover:bg-paper-dark/30"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold ${att.isUnavailable ? "line-through text-brick" : ""}`}>
                      {att.player.name}
                    </span>
                    <span
                      className={`size-3 rounded-xs border border-moss/40 shrink-0 ${
                        TEAM_META[att.team as TeamKey]?.swatch ?? ""
                      }`}
                      title={`Time ${TEAM_META[att.team as TeamKey]?.label ?? att.team}`}
                    />
                    {(att.asGoalkeeper || att.player.isGoalkeeper) && <GloveBadge />}
                    <span className="font-mono text-xs text-moss-soft">
                      ★ {(att.ratingAtDraw ?? att.player.baseRating).toFixed(1).replace(".", ",")}
                    </span>
                    {att.isUnavailable && (
                      <span className="text-[9px] font-bold text-brick bg-paper px-1.5 py-0.5 border border-brick uppercase">
                        {att.unavailableReason || "Indisponível"}
                      </span>
                    )}
                    {att.borrowedToTeam && (
                      <span className="text-[9px] font-bold text-amber-950 bg-amber-200 border border-amber-400 px-1.5 py-0.5 rounded uppercase">
                        🔄 Empresta para {TEAM_META[att.borrowedToTeam as TeamKey]?.label ?? att.borrowedToTeam}
                      </span>
                    )}
                  </div>

                  <form action={togglePlayerUnavailable.bind(null, match.id, att.id, "Indisponível")}>
                    <SubmitButton
                      className={`h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider rounded border shadow-none ${
                        att.isUnavailable
                          ? "bg-paper text-moss border-moss hover:bg-paper-dark"
                          : "bg-brick/10 text-brick border-brick/40 hover:bg-brick hover:text-paper"
                      }`}
                    >
                      {att.isUnavailable ? "✓ Restaurar Jogador" : "⚠️ Marcar Indisponível"}
                    </SubmitButton>
                  </form>
                </div>
              ))}
          </div>

          {/* Demonstração de Alterações e Empréstimos Ativos */}
          <div className="border-2 border-moss bg-paper-dark p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-moss/20 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-moss">
                Demonstração das Mudanças & Empréstimos
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-950">
                {match.attendances.filter((a) => a.borrowedToTeam != null).length} jogador(es) emprestado(s)
              </span>
            </div>

            {match.attendances.some((a) => a.borrowedToTeam != null) ? (
              <ul className="flex flex-col gap-1.5">
                {match.attendances
                  .filter((a) => a.borrowedToTeam != null)
                  .map((b) => (
                    <li key={`loan-${b.id}`} className="text-xs flex items-center justify-between bg-paper p-2 border border-moss/25 rounded">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-moss">{b.player.name}</span>
                        <span className={`inline-block size-2.5 rounded-xs ${TEAM_META[b.team as TeamKey]?.swatch}`} />
                        <span className="text-moss-soft text-[11px]">(Time {TEAM_META[b.team as TeamKey]?.label})</span>
                        <span className="text-brick font-bold">➔ Emprestado para</span>
                        <span className="font-bold text-moss">Time {TEAM_META[b.borrowedToTeam as TeamKey]?.label}</span>
                        <span className={`inline-block size-2.5 rounded-xs ${TEAM_META[b.borrowedToTeam as TeamKey]?.swatch}`} />
                      </div>
                      <span className="font-mono text-[11px] text-moss-soft">
                        ★ {(b.ratingAtDraw ?? b.player.baseRating).toFixed(1).replace(".", ",")}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-xs text-moss-soft italic">
                {match.attendances.some((a) => a.isUnavailable)
                  ? "Existem desfalques marcados. Clique no botão abaixo para calcular os empréstimos ideais."
                  : "Nenhum jogador emprestado no momento. As equipes estão completas."}
              </p>
            )}
          </div>

          <form action={microReorganize.bind(null, match.id)}>
            <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-3 text-xs font-bold uppercase tracking-wider shadow-hard-sm flex items-center justify-center gap-1.5">
              <Zap className="size-4" /> Emprestar Jogador/Reorganizar
            </SubmitButton>
          </form>

          {/* Plano B: Reorganização Definitiva */}
          <details className="border border-moss/30 bg-paper p-3 rounded group">
            <summary className="text-xs font-bold uppercase tracking-wider text-moss cursor-pointer flex items-center justify-between select-none">
              <span>📋 Plano B: Reorganização Pequena nos Times e Goleiros</span>
              <span className="text-[10px] text-moss-soft group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="pt-2.5 mt-2 border-t border-moss/20 flex flex-col gap-2 text-xs">
              <p className="text-moss-soft text-[11px]">
                Transfere jogadores e goleiros em definitivo para suprir os desfalques entre as equipes, sem necessidade de empréstimos jogo a jogo.
              </p>
              <form action={planBReorganize.bind(null, match.id)}>
                <SubmitButton
                  className="w-full bg-paper-dark hover:bg-paper text-moss border border-moss py-2 text-xs font-bold uppercase tracking-wider shadow-none"
                  confirm="Executar Plano B? Jogadores disponíveis serão transferidos de time permanentemente para cobrir os desfalques."
                >
                  Executar Plano B (Reorganização Direta)
                </SubmitButton>
              </form>
            </div>
          </details>
        </section>
      )}

      {/* Escalação e Remanejamento */}
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl">
          {match.status === "OPEN" ? "Lista de Presença e Fila" : "Escalação e Remanejamento"}
        </h2>
        {match.status === "OPEN" ? (
          <PreDrawList match={match} admin />
        ) : (
          <TeamsBoard match={match} admin />
        )}
      </section>

      {/* Configurações da Partida */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard">
        <details open className="group">
          <summary className="text-xs font-bold uppercase tracking-wider text-moss-soft cursor-pointer flex items-center justify-between select-none">
            <span className="flex items-center gap-2">
              <span className="font-serif text-lg text-moss">Configurações da Partida</span>
              <span className="text-[10px] font-normal uppercase tracking-wider text-moss-soft/80">(Editar tudo)</span>
            </span>
            <span className="text-xs text-moss group-open:rotate-180 transition-transform">▼</span>
          </summary>

          <form action={updateMatchConfig.bind(null, match.id)} className="grid gap-4 mt-4 pt-4 border-t-2 border-moss">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label htmlFor="edit-date" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Data e Horário
                </label>
                <input
                  id="edit-date"
                  name="date"
                  type="datetime-local"
                  defaultValue={formatDateTimeInput(match.date)}
                  className="block w-full min-w-0 h-10 border-2 border-moss bg-paper px-3 py-2 text-xs font-mono text-moss outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-status" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Status da Partida
                </label>
                <select
                  id="edit-status"
                  name="status"
                  defaultValue={match.status}
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs font-semibold text-moss outline-none"
                >
                  <option value="OPEN">📋 Lista Aberta (Pré-sorteio)</option>
                  <option value="DRAWN">⚽ Times Sorteados (Em Andamento)</option>
                  <option value="FINISHED">🏁 Finalizada/Encerrada</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-location" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Local do Jogo (Opcional)
                </label>
                <input
                  id="edit-location"
                  name="location"
                  type="text"
                  defaultValue={match.location ?? ""}
                  placeholder="Ex: Arena Futebol Clube, Campo 2"
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs text-moss outline-none"
                />
              </div>
              <div>
                <label htmlFor="edit-cost" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Valor por Jogador em R$ (Opcional)
                </label>
                <input
                  id="edit-cost"
                  name="cost"
                  type="number"
                  step="0.50"
                  defaultValue={match.cost != null ? match.cost.toFixed(2) : ""}
                  placeholder="Ex: 25,00"
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs font-mono text-moss outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="edit-numTeams" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Número de Times
                </label>
                <select
                  id="edit-numTeams"
                  name="numTeams"
                  defaultValue={match.numTeams}
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs text-moss outline-none font-semibold"
                >
                  <option value="2">🟦 🟥 2 Times (Azul/Vermelho)</option>
                  <option value="3">🟦 🟥 ⬛ 3 Times (Azul/Vermelho/Preto)</option>
                  <option value="4">🟦 🟥 ⬛ 🟨 4 Times (Azul/Vermelho/Preto/Amarelo)</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-lineSize" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Formato (Goleiro + Jogadores)
                </label>
                <select
                  id="edit-lineSize"
                  name="lineSize"
                  defaultValue={match.lineSize}
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs text-moss outline-none font-semibold"
                >
                  <option value="3">1 goleiro + 3 jogadores (4 por time)</option>
                  <option value="4">1 goleiro + 4 jogadores (5 por time)</option>
                  <option value="5">1 goleiro + 5 jogadores (6 por time - Ideal)</option>
                  <option value="6">1 goleiro + 6 jogadores (7 por time)</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-votingOpen" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Urna de Votação
                </label>
                <select
                  id="edit-votingOpen"
                  name="votingOpen"
                  defaultValue={match.votingOpen ? "true" : "false"}
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs text-moss outline-none font-semibold"
                >
                  <option value="false">🔒 Fechada/Bloqueada</option>
                  <option value="true">🗳️ Aberta para Votos</option>
                </select>
              </div>
            </div>

            <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-2.5 text-xs font-bold uppercase tracking-wider shadow-hard-sm">
              Salvar Alterações da Partida
            </SubmitButton>
          </form>

          <div className="mt-4 pt-3 border-t border-moss/20 flex items-center justify-between">
            <span className="text-[11px] text-moss-soft font-semibold">Excluir partida</span>
            <form action={deleteMatch.bind(null, match.id)}>
              <SubmitButton
                className="bg-paper text-brick hover:bg-brick hover:text-paper border border-brick/40 py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider shadow-none transition-colors"
                confirm="Tem certeza que deseja apagar esta partida? Todos os dados serão perdidos."
              >
                Apagar Partida
              </SubmitButton>
            </form>
          </div>
        </details>
      </section>
    </div>
  );
}

export default function AdminMatchPage({ params }: PageProps<"/admin/partida/[id]">) {
  return (
    <Suspense fallback={<Loading label="Carregando partida…" />}>
      <AdminMatchView params={params} />
    </Suspense>
  );
}
