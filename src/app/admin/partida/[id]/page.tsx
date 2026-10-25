import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getMatch } from "@/lib/match";
import { formatMatchDate } from "@/lib/format";
import { teamsFor } from "@/lib/teams";
import {
  addAttendances,
  addGame,
  closeVoting,
  deleteMatch,
  drawTeams,
  openVoting,
  reopenList,
  updateMatchConfig,
} from "@/app/admin/actions";
import { PreDrawList, Scoreboard, TeamsBoard } from "@/components/lineup";
import { CopyLink, SubmitButton } from "@/components/client";
import { Loading, StatusStamp } from "@/components/ui";

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
    <div className="space-y-8">
      <header className="rise">
        <Link href="/admin" className="kicker underline">
          ← Painel do Organizador
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div>
            <p className="kicker">Controle da Partida</p>
            <h1 className="display text-3xl first-letter:uppercase">{formatMatchDate(match.date)}</h1>
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href={`/partida/${match.id}`} className="btn btn-sm" target="_blank">
            Ver página pública ↗
          </Link>
          {match.votingOpen && (
            <Link href={`/votar/${match.voteToken}`} className="btn btn-sm btn-gold" target="_blank">
              Abrir votação ↗
            </Link>
          )}
        </div>
      </header>

      {/* Compartilhar link da votação */}
      {match.votingOpen && (
        <section className="card card-pad bg-paper-2">
          <p className="kicker mb-2">Link direto para os jogadores votarem</p>
          <CopyLink url={`/votar/${match.voteToken}`} id="copiar-link-votacao" />
        </section>
      )}

      {/* Ações principais do status da partida */}
      <section className="card card-pad space-y-4">
        <h2 className="display text-xl">Comandos da Mesa</h2>
        <div className="flex flex-wrap gap-2">
          {match.status === "OPEN" && (
            <form action={drawTeams.bind(null, match.id)} className="w-full">
              <SubmitButton
                className="btn btn-moss btn-block"
                id="sortear-times"
                confirm="Sortear times agora? Os jogadores serão distribuídos pelo Snake Draft e goleiros alocados."
              >
                Sortear Times (Snake Draft) ⚽
              </SubmitButton>
            </form>
          )}

          {match.status === "DRAWN" && (
            <>
              <form action={drawTeams.bind(null, match.id)}>
                <SubmitButton
                  className="btn btn-sm"
                  confirm="Refazer sorteio? Os coletes atuais serão recalculados."
                >
                  Refazer Sorteio
                </SubmitButton>
              </form>

              <form action={reopenList.bind(null, match.id)}>
                <SubmitButton
                  className="btn btn-sm"
                  confirm="Reabrir lista? Os times serão desfeitos para adicionar novos nomes."
                >
                  Voltar para Lista Aberta
                </SubmitButton>
              </form>

              {!match.votingOpen && (
                <form action={openVoting.bind(null, match.id)}>
                  <SubmitButton className="btn btn-sm btn-gold" id="abrir-votacao">
                    Liberar Votação Pós-Jogo ⭐
                  </SubmitButton>
                </form>
              )}

              {match.votingOpen && (
                <form action={closeVoting.bind(null, match.id)}>
                  <SubmitButton
                    className="btn btn-sm btn-brick"
                    id="fechar-votacao"
                    confirm="Encerrar partida e computar votos? As notas base dos jogadores serão atualizadas na média histórica e a partida será finalizada."
                  >
                    Encerrar Partida e Computar Votos 🏁
                  </SubmitButton>
                </form>
              )}
            </>
          )}
        </div>
      </section>

      {/* Adicionar presenças manualmente (organizador adiciona presentes) */}
      {match.status !== "FINISHED" && unconfirmed.length > 0 && (
        <section className="card card-pad space-y-3">
          <details>
            <summary className="font-semibold cursor-pointer">
              + Adicionar jogadores confirmados manualmente ({unconfirmed.length} disponíveis)
            </summary>
            <form action={addAttendances.bind(null, match.id)} className="grid gap-3 mt-3 pt-3 border-t-2 border-ink">
              <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-paper border border-ink/30 rounded">
                {unconfirmed.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm p-1 hover:bg-paper-2 cursor-pointer">
                    <input type="checkbox" name="playerId" value={p.id} className="check" />
                    <span className="font-medium">{p.name}</span>
                    {p.isGoalkeeper && <span className="tag tag-gk">GK</span>}
                    <span className="mono text-xs text-ink/60">★ {p.baseRating.toFixed(1)}</span>
                  </label>
                ))}
              </div>
              <SubmitButton className="btn btn-moss btn-sm">Confirmar Selecionados</SubmitButton>
            </form>
          </details>
        </section>
      )}

      {/* Visualização de times ou lista antes do sorteio */}
      <section>
        <div className="section-head">
          <h2 className="display text-2xl">
            {match.status === "OPEN" ? "Lista de Presença & Fila" : "Escalação & Remanejamento ao Vivo"}
          </h2>
          <span className="kicker">
            {match.attendances.length} atletas ({match.numTeams} times × {match.lineSize} linha)
          </span>
        </div>
        {match.status === "OPEN" ? (
          <PreDrawList match={match} admin />
        ) : (
          <TeamsBoard match={match} admin />
        )}
      </section>

      {/* Placares dos jogos */}
      {match.status !== "OPEN" && (
        <section className="space-y-4">
          <div className="section-head">
            <h2 className="display text-2xl">Placares dos Jogos</h2>
          </div>
          <Scoreboard match={match} admin />

          {match.status !== "FINISHED" && (
            <form action={addGame.bind(null, match.id)} className="card card-pad space-y-3">
              <p className="kicker">Lançar Placar</p>
              <div className="grid grid-cols-5 items-center gap-2">
                <div className="col-span-2">
                  <select name="teamA" className="field text-sm" defaultValue={validTeams[0]}>
                    {validTeams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-center">
                  <input
                    name="scoreA"
                    type="number"
                    min="0"
                    max="99"
                    defaultValue="0"
                    className="field text-center font-bold"
                    required
                  />
                </div>
                <div className="text-center font-bold">×</div>
                <div className="text-center">
                  <input
                    name="scoreB"
                    type="number"
                    min="0"
                    max="99"
                    defaultValue="0"
                    className="field text-center font-bold"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <select name="teamB" className="field text-sm" defaultValue={validTeams[1] || validTeams[0]}>
                    {validTeams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <SubmitButton className="btn btn-sm btn-gold btn-block">Registrar Placar</SubmitButton>
            </form>
          )}
        </section>
      )}

      {/* Configurações da partida & exclusão */}
      <section className="card card-pad space-y-4">
        <details>
          <summary className="kicker cursor-pointer">⚙ Configurações e cancelamento da partida</summary>
          {match.status === "OPEN" && (
            <form action={updateMatchConfig.bind(null, match.id)} className="grid gap-3 mt-4 pt-3 border-t-2 border-ink">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Times</label>
                  <select name="numTeams" defaultValue={match.numTeams} className="field">
                    <option value="2">2 times</option>
                    <option value="3">3 times</option>
                    <option value="4">4 times</option>
                  </select>
                </div>
                <div>
                  <label className="label">Tamanho da Linha</label>
                  <select name="lineSize" defaultValue={match.lineSize} className="field">
                    {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} na linha
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <SubmitButton className="btn btn-sm">Atualizar Regras</SubmitButton>
            </form>
          )}

          <div className="mt-4 pt-3 border-t border-ink/20">
            <form action={deleteMatch.bind(null, match.id)}>
              <SubmitButton
                className="btn btn-brick btn-sm"
                confirm="Tem certeza que deseja apagar esta partida? Todos os dados e votos serão perdidos."
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
    <Suspense fallback={<Loading />}>
      <AdminMatchView params={params} />
    </Suspense>
  );
}
