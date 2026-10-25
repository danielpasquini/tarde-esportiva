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
import { Loading, StatusStamp, GloveBadge } from "@/components/ui";

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
                    confirm="Encerrar partida e computar votos? As notas base dos jogadores serão atualizadas na média histórica e a partida será finalizada."
                  >
                    Encerrar Partida e Computar Votos
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Adicionar presenças manualmente */}
      {match.status !== "FINISHED" && unconfirmed.length > 0 && (
        <section className="border-[3px] border-moss bg-paper p-4 shadow-hard">
          <details>
            <summary className="font-serif text-lg cursor-pointer">
              + Confirmar Jogadores Manualmente ({unconfirmed.length})
            </summary>
            <form action={addAttendances.bind(null, match.id)} className="flex flex-col gap-3 mt-3 pt-3 border-t-2 border-moss">
              <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-paper-dark border border-moss/30">
                {unconfirmed.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs p-1.5 hover:bg-paper cursor-pointer">
                    <input type="checkbox" name="playerId" value={p.id} className="size-4 accent-moss" />
                    <span className="font-semibold">{p.name}</span>
                    {p.isGoalkeeper && <GloveBadge className="size-3.5" />}
                    <span className="text-moss-soft">★ {p.baseRating.toFixed(1)}</span>
                  </label>
                ))}
              </div>
              <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-2 text-xs font-bold uppercase tracking-wider">
                Confirmar Selecionados
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

      {/* Placares dos jogos */}
      {match.status !== "OPEN" && (
        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl">Placares dos Jogos</h2>
          <Scoreboard match={match} admin />

          {match.status !== "FINISHED" && (
            <form action={addGame.bind(null, match.id)} className="border-[3px] border-moss bg-paper p-4 shadow-hard flex flex-col gap-3">
              <h3 className="font-serif text-lg border-b border-moss/20 pb-1">Registrar Placar</h3>
              <div className="grid grid-cols-5 items-center gap-2">
                <div className="col-span-2">
                  <select name="teamA" className="w-full border-2 border-moss bg-paper px-2 py-1.5 text-xs font-bold uppercase text-moss outline-none" defaultValue={validTeams[0]}>
                    {validTeams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    name="scoreA"
                    type="number"
                    min="0"
                    max="99"
                    defaultValue="0"
                    className="w-full border-2 border-moss bg-paper px-2 py-1.5 text-center font-bold text-sm"
                    required
                  />
                </div>
                <div className="text-center font-serif text-xl font-bold">×</div>
                <div>
                  <input
                    name="scoreB"
                    type="number"
                    min="0"
                    max="99"
                    defaultValue="0"
                    className="w-full border-2 border-moss bg-paper px-2 py-1.5 text-center font-bold text-sm"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <select name="teamB" className="w-full border-2 border-moss bg-paper px-2 py-1.5 text-xs font-bold uppercase text-moss outline-none" defaultValue={validTeams[1] || validTeams[0]}>
                    {validTeams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <SubmitButton className="w-full bg-paper text-moss hover:bg-paper-dark py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm">
                Salvar Placar
              </SubmitButton>
            </form>
          )}
        </section>
      )}

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
