import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getMatch } from "@/lib/match";
import { formatMatchDate, formatDateTimeInput } from "@/lib/format";
import { teamsFor, teamLabel, TEAM_META, type TeamKey } from "@/lib/teams";
import {
  addAttendances,
  addAttendancesByText,
  closeVoting,
  deleteMatch,
  drawTeams,
  openVoting,
  reopenList,
  microReorganize,
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
    <div className="overflow-x-auto border-2 border-moss">
      <table className="w-full text-left text-xs bg-paper">
        <thead className="bg-paper-dark border-b-2 border-moss uppercase tracking-wider text-[10px] text-moss-soft">
          <tr>
            <th className="p-2.5">#</th>
            <th className="p-2.5">Atleta</th>
            <th className="p-2.5 text-center">Colete</th>
            <th className="p-2.5 text-center">Votos</th>
            <th className="p-2.5 text-right">Média Partida</th>
            <th className="p-2.5 text-right">Nota Base Geral</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-moss/20">
          {list.map((p, idx) => (
            <tr key={p.id} className={idx < 5 ? "bg-amber-500/5 font-semibold" : ""}>
              <td className="p-2.5 tabular-nums text-moss-soft">{idx + 1}º</td>
              <td className="p-2.5">
                <div className="flex items-center gap-1.5">
                  <span>{p.name}</span>
                  {p.isGoalkeeper && <GloveBadge />}
                  {idx === 0 && (
                    <span className="text-[9px] bg-amber-500 text-white font-bold px-1 rounded">
                      CRAQUE
                    </span>
                  )}
                </div>
              </td>
              <td className="p-2.5 text-center uppercase text-[10px]">{p.team ?? "–"}</td>
              <td className="p-2.5 text-center tabular-nums">{p.count}</td>
              <td className="p-2.5 text-right font-mono font-bold text-moss">
                {p.avg > 0 ? `★ ${p.avg.toFixed(1).replace(".", ",")}` : "–"}
              </td>
              <td className="p-2.5 text-right font-mono text-moss-soft">
                ★ {p.baseRating.toFixed(1).replace(".", ",")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
        reason = `Com ${lineAvailable} jogadores de linha confirmados para ${numTeams} times, o formato ideal (1 goleiro + 5 linha) acomoda todo o elenco de forma limpa, sem necessidade de empréstimos excessivos.`;
      } else {
        reason = `O formato ideal do grupo é 1 goleiro + 5 linha. Ele garante a dinâmica ideal de jogo para o número de atletas confirmados.`;
      }
    } else if (bestSize === 6 && lineAvailable > numTeams * 5) {
      reason = `Há muitos atletas disponíveis (${lineAvailable} de linha). Mudar para 1 goleiro + 6 linha permite que todos joguem com menos tempo de espera.`;
    } else if (bestSize < currentLineSize) {
      reason = `O formato atual (1+${currentLineSize}) exige muitos empréstimos devido ao número de atletas presentes (${lineAvailable} de linha). Mudar para 1+${bestSize} fecha as equipes de forma mais natural.`;
    } else {
      reason = `Com ${lineAvailable} jogadores de linha confirmados, o formato 1 goleiro + ${bestSize} linha otimiza a montagem dos times.`;
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
                {match.cost != null && <span>💰 R$ {match.cost.toFixed(2).replace(".", ",")} por atleta</span>}
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

      {/* Sugestão Inteligente de Formato (Goleiro + Linha) */}
      {formatSuggestion && match.status !== "FINISHED" && (
        <section className="border-[3px] border-moss bg-amber-500/15 p-4 shadow-hard flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <h3 className="font-serif text-base sm:text-lg font-bold text-moss">
                Sugestão de Formato: {formatSuggestion.isIdeal ? "1 Goleiro + 5 Linha (Ideal do Grupo)" : `1 Goleiro + ${formatSuggestion.suggestedLineSize} Linha`}
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
            <form action={drawTeams.bind(null, match.id)}>
              <SubmitButton
                className="w-full bg-moss text-paper hover:bg-moss-soft py-3 text-xs font-bold uppercase tracking-widest shadow-hard-brick"
                id="sortear-times"
                confirm="Sortear times agora? Os jogadores e goleiros serão distribuídos de forma equilibrada entre as equipes."
              >
                Sortear Times
              </SubmitButton>
            </form>
          )}

          {match.status === "DRAWN" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <form action={drawTeams.bind(null, match.id)}>
                  <SubmitButton
                    className="w-full bg-paper-dark text-moss hover:bg-paper py-2.5 text-xs font-bold uppercase tracking-wider"
                    confirm="Refazer sorteio? Os coletes atuais serão recalculados."
                  >
                    Refazer Sorteio
                  </SubmitButton>
                </form>

                <form action={reopenList.bind(null, match.id)}>
                  <SubmitButton
                    className="w-full bg-paper-dark text-moss hover:bg-paper py-2.5 text-xs font-bold uppercase tracking-wider"
                    confirm="Reabrir lista? Os times serão desfeitos para adicionar novos nomes."
                  >
                    Reabrir Lista
                  </SubmitButton>
                </form>
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
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Área Restrita do Admin</span>
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
              <h2 className="font-serif text-lg">Confirmar Atletas na Partida ({unconfirmed.length} disponíveis)</h2>
            </div>
          </div>
          <p className="text-xs text-moss-soft">
            Selecione abaixo os atletas presentes para registrar na partida:
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

      {/* Card: Jogadores Indisponíveis (Atraso / Lesão) e Microreorganização */}
      {match.status === "DRAWN" && (
        <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
          <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">
                Gestão de Desfalques & Imprevistos
              </span>
              <h2 className="font-serif text-xl">Jogadores Indisponíveis (Atraso / Lesão)</h2>
            </div>
            <span className="text-xs font-mono font-bold text-moss-soft">
              {match.attendances.filter((a) => a.isUnavailable).length} desfalque(s)
            </span>
          </div>

          <p className="text-xs text-moss-soft">
            Selecione atletas que tiveram imprevisto (atraso ou lesão). O sistema fará a <strong>microreorganização balanceada pegando atletas emprestados</strong> de outras equipes para completar o time sem criar bancos.
          </p>

          <div className="border-2 border-moss bg-paper divide-y divide-moss/20 max-h-72 overflow-y-auto">
            {match.attendances
              .filter((a) => a.team)
              .map((att) => (
                <div
                  key={att.id}
                  className={`flex items-center justify-between p-2.5 text-xs transition-colors ${
                    att.isUnavailable ? "bg-brick/10" : "hover:bg-paper-dark/30"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                        TEAM_META[att.team as TeamKey]?.swatch ?? ""
                      }`}
                    >
                      {TEAM_META[att.team as TeamKey]?.label ?? att.team}
                    </span>
                    <span className={`font-semibold ${att.isUnavailable ? "line-through text-brick" : ""}`}>
                      {att.player.name}
                    </span>
                    {(att.asGoalkeeper || att.player.isGoalkeeper) && <GloveBadge />}
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

                  <form action={togglePlayerUnavailable.bind(null, match.id, att.id, "Atraso/Lesão")}>
                    <SubmitButton
                      className={`h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider rounded border shadow-none ${
                        att.isUnavailable
                          ? "bg-paper text-moss border-moss hover:bg-paper-dark"
                          : "bg-brick/10 text-brick border-brick/40 hover:bg-brick hover:text-paper"
                      }`}
                    >
                      {att.isUnavailable ? "✓ Restaurar Atleta" : "⚠️ Marcar Indisponível"}
                    </SubmitButton>
                  </form>
                </div>
              ))}
          </div>

          <form action={microReorganize.bind(null, match.id)}>
            <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-3 text-xs font-bold uppercase tracking-wider shadow-hard-sm">
              ⚡ Executar Microreorganização Balanceada (com Jogador Emprestado)
            </SubmitButton>
          </form>
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
                  className="w-full max-w-full box-border min-w-0 border-2 border-moss bg-paper px-3 py-2 text-xs font-mono text-moss outline-none"
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
                  Valor por Atleta em R$ (Opcional)
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
                  Formato (Goleiro + Linha)
                </label>
                <select
                  id="edit-lineSize"
                  name="lineSize"
                  defaultValue={match.lineSize}
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs text-moss outline-none font-semibold"
                >
                  <option value="3">1 goleiro + 3 linha (4 por time)</option>
                  <option value="4">1 goleiro + 4 linha (5 por time)</option>
                  <option value="5">1 goleiro + 5 linha (6 por time - Ideal)</option>
                  <option value="6">1 goleiro + 6 linha (7 por time)</option>
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
