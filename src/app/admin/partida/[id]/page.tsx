import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getMatch } from "@/lib/match";
import { formatMatchDate, formatDateTimeInput } from "@/lib/format";
import { teamsFor, teamLabel } from "@/lib/teams";
import {
  addAttendances,
  addAttendancesByText,
  closeVoting,
  deleteMatch,
  drawTeams,
  openVoting,
  reopenList,
  reorganizeTeams,
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

  // Calcular sugestão de reorganização mínima para equilíbrio
  let reorganizeSuggestion: { text: string; currentDiff: number; newDiff: number } | null = null;
  if (match.status === "DRAWN") {
    const linePlayers = match.attendances.filter(
      (a) => a.team && !a.asGoalkeeper && validTeams.includes(a.team),
    );
    if (linePlayers.length >= 2) {
      const teamStrengths = new Map<string, number>();
      for (const t of validTeams) {
        const sum = linePlayers
          .filter((p) => p.team === t)
          .reduce((s, p) => s + (p.ratingAtDraw ?? p.player.baseRating), 0);
        teamStrengths.set(t, sum);
      }
      const strengths = Array.from(teamStrengths.values());
      const currentDiff = Math.max(...strengths) - Math.min(...strengths);
      let minDiff = currentDiff;

      // Swap entre 2 jogadores
      let bestSwap: { p1: typeof linePlayers[0]; p2: typeof linePlayers[0]; diff: number } | null = null;
      for (let i = 0; i < linePlayers.length; i++) {
        for (let j = i + 1; j < linePlayers.length; j++) {
          const p1 = linePlayers[i];
          const p2 = linePlayers[j];
          if (p1.team === p2.team) continue;
          const r1 = p1.ratingAtDraw ?? p1.player.baseRating;
          const r2 = p2.ratingAtDraw ?? p2.player.baseRating;
          const sim = validTeams.map((t) => {
            let s = teamStrengths.get(t) ?? 0;
            if (t === p1.team) s = s - r1 + r2;
            if (t === p2.team) s = s - r2 + r1;
            return s;
          });
          const diff = Math.max(...sim) - Math.min(...sim);
          if (diff < minDiff) {
            minDiff = diff;
            bestSwap = { p1, p2, diff };
          }
        }
      }

      // Empréstimo direto se desbalanceado em quantidade
      const counts = validTeams.map((t) => linePlayers.filter((p) => p.team === t).length);
      const minCount = Math.min(...counts);
      const maxCount = Math.max(...counts);
      let bestTransfer: { p: typeof linePlayers[0]; toTeam: string; diff: number } | null = null;
      if (maxCount - minCount > 0) {
        for (const p of linePlayers) {
          const fromTeam = p.team!;
          if (linePlayers.filter((x) => x.team === fromTeam).length <= minCount) continue;
          const r = p.ratingAtDraw ?? p.player.baseRating;
          for (const toTeam of validTeams) {
            if (toTeam === fromTeam) continue;
            if (linePlayers.filter((x) => x.team === toTeam).length >= maxCount) continue;
            const sim = validTeams.map((t) => {
              let s = teamStrengths.get(t) ?? 0;
              if (t === fromTeam) s -= r;
              if (t === toTeam) s += r;
              return s;
            });
            const diff = Math.max(...sim) - Math.min(...sim);
            if (diff < minDiff) {
              minDiff = diff;
              bestTransfer = { p, toTeam, diff };
            }
          }
        }
      }

      if (bestTransfer) {
        reorganizeSuggestion = {
          text: `${bestTransfer.p.player.name} muda do ${teamLabel(bestTransfer.p.team)} para o ${teamLabel(bestTransfer.toTeam)} (equilibra número e força)`,
          currentDiff,
          newDiff: bestTransfer.diff,
        };
      } else if (bestSwap) {
        reorganizeSuggestion = {
          text: `${bestSwap.p1.player.name} vai para o ${teamLabel(bestSwap.p2.team)} e ${bestSwap.p2.player.name} vai para o ${teamLabel(bestSwap.p1.team)}`,
          currentDiff,
          newDiff: bestSwap.diff,
        };
      }
    }
  }

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
              {/* Sugestão de Reorganização Inteligente */}
              {reorganizeSuggestion && (
                <div className="border-2 border-moss bg-paper-dark p-3 text-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-brick">
                      Equilíbrio Mínimo Sugerido
                    </span>
                    <span className="text-[10px] text-moss-soft font-mono">
                      Dif. forças: {reorganizeSuggestion.currentDiff.toFixed(1)} → {reorganizeSuggestion.newDiff.toFixed(1)}
                    </span>
                  </div>
                  <p className="font-semibold text-moss">
                    💡 {reorganizeSuggestion.text}
                  </p>
                  <form action={reorganizeTeams.bind(null, match.id)}>
                    <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm">
                      Reorganizar
                    </SubmitButton>
                  </form>
                </div>
              )}

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
              <div>
                <label htmlFor="edit-date" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Data e Horário
                </label>
                <input
                  id="edit-date"
                  name="date"
                  type="datetime-local"
                  defaultValue={formatDateTimeInput(match.date)}
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs font-mono text-moss outline-none"
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
                  <option value="OPEN">Lista Aberta (Pré-sorteio)</option>
                  <option value="DRAWN">Times Sorteados (Em Andamento)</option>
                  <option value="FINISHED">Finalizada / Encerrada</option>
                </select>
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
                  <option value="2">2 Times (Azul / Vermelho)</option>
                  <option value="3">3 Times (+ Preto)</option>
                  <option value="4">4 Times (+ Amarelo)</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-lineSize" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                  Linha por Time
                </label>
                <select
                  id="edit-lineSize"
                  name="lineSize"
                  defaultValue={match.lineSize}
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs text-moss outline-none font-semibold"
                >
                  {[3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n} na linha
                    </option>
                  ))}
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
                  <option value="false">Fechada / Bloqueada</option>
                  <option value="true">Aberta para Votos</option>
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
