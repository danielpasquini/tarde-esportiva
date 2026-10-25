import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getMatch } from "@/lib/match";
import { formatMatchDate } from "@/lib/format";
import { teamsFor } from "@/lib/teams";
import {
  addAttendances,
  closeVoting,
  deleteMatch,
  drawTeams,
  openVoting,
  reopenList,
  updateMatchConfig,
} from "@/app/admin/actions";
import { PreDrawList, TeamsBoard } from "@/components/lineup";
import { CopyLink, SubmitButton } from "@/components/client";
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
  const validTeams = teamsFor(match.numTeams);

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

        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-moss/20">
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
                confirm="Sortear times agora? Os jogadores serão distribuídos pelo Snake Draft e goleiros alocados."
              >
                Sortear Times (Snake Draft)
              </SubmitButton>
            </form>
          )}

          {match.status === "DRAWN" && (
            <div className="flex flex-col gap-2">
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
          <form action={addAttendances.bind(null, match.id)} className="flex flex-col gap-3">
            <div className="max-h-52 overflow-y-auto space-y-1 p-2 bg-paper-dark border border-moss/30 rounded-xs">
              {unconfirmed.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs p-1.5 hover:bg-paper cursor-pointer transition-colors">
                  <input type="checkbox" name="playerId" value={p.id} className="size-4 accent-moss" />
                  <span className="font-semibold">{p.name}</span>
                  {p.isGoalkeeper && <GloveBadge className="size-3.5" />}
                  <span className="text-moss-soft ml-auto font-mono">★ {p.baseRating.toFixed(1)}</span>
                </label>
              ))}
            </div>
            <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-2.5 text-xs font-bold uppercase tracking-wider">
              Confirmar Atletas Selecionados
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

      {/* Configurações e cancelamento */}
      <section className="border-[3px] border-moss bg-paper p-4 shadow-hard">
        <details>
          <summary className="text-xs font-bold uppercase tracking-wider text-moss-soft cursor-pointer">
            Configurações da Partida
          </summary>
          {match.status === "OPEN" && (
            <form action={updateMatchConfig.bind(null, match.id)} className="grid gap-3 mt-3 pt-3 border-t-2 border-moss">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">Times</label>
                  <select name="numTeams" defaultValue={match.numTeams} className="w-full border-2 border-moss bg-paper px-2 py-1.5 text-xs text-moss outline-none">
                    <option value="2">2 times</option>
                    <option value="3">3 times</option>
                    <option value="4">4 times</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">Linha por Time</label>
                  <select name="lineSize" defaultValue={match.lineSize} className="w-full border-2 border-moss bg-paper px-2 py-1.5 text-xs text-moss outline-none">
                    {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} na linha
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <SubmitButton className="bg-paper text-moss hover:bg-paper-dark py-1.5 text-xs font-bold uppercase tracking-wider">
                Atualizar Regras
              </SubmitButton>
            </form>
          )}

          <div className="mt-3 pt-3 border-t border-moss/20">
            <form action={deleteMatch.bind(null, match.id)}>
              <SubmitButton
                className="bg-brick text-paper py-2 text-xs font-bold uppercase tracking-wider"
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
