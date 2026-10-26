import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, Trash2, Users, Vote, CheckCircle2, XCircle } from "lucide-react";
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
  updateMatchConfig,
} from "@/app/admin/actions";
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
      where: { matchId },
      include: { player: true },
    }),
  ]);

  const avgMap = new Map(averages.map((a) => [a.targetId, a._avg.score ?? 0]));
  const countMap = new Map(averages.map((a) => [a.targetId, a._count.score ?? 0]));

  const list = attendances
    .map((att) => ({
      id: att.playerId,
      name: att.player.name,
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
              <th className="p-2 sm:p-2.5 text-center">Votos</th>
              <th className="p-2 sm:p-2.5 text-right">Média Partida</th>
              <th className="p-2 sm:p-2.5 text-right">Nota Base Geral</th>
              <th className="p-2 sm:p-2.5 text-center w-16">Perfil</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-moss/20 text-[11px] sm:text-xs">
            {list.map((p, idx) => (
              <tr key={p.id} className={idx < 5 && p.avg > 0 ? "bg-amber-500/5 font-semibold" : ""}>
                <td className="p-2 sm:p-2.5 tabular-nums text-moss-soft">{idx + 1}º</td>
                <td className="p-2 sm:p-2.5 min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{p.name}</span>
                    {p.isGoalkeeper && <GloveBadge />}
                    {idx === 0 && p.avg > 0 && (
                      <span className="text-[8px] sm:text-[9px] bg-amber-500 text-white font-bold px-1 rounded shrink-0">
                        CRAQUE
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-2 sm:p-2.5 text-center tabular-nums">{p.count}</td>
                <td className="p-2 sm:p-2.5 text-right font-mono font-bold text-moss whitespace-nowrap">
                  {p.avg > 0 ? `★ ${p.avg.toFixed(1).replace(".", ",")}` : "–"}
                </td>
                <td className="p-2 sm:p-2.5 text-right font-mono text-moss-soft whitespace-nowrap">
                  ★ {p.baseRating.toFixed(1).replace(".", ",")}
                </td>
                <td className="p-2 sm:p-2.5 text-center">
                  <Link
                    href={`/perfil/${p.id}`}
                    className="text-[10px] font-bold text-brick hover:underline uppercase"
                  >
                    Ver
                  </Link>
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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-moss-soft"
        >
          <ArrowLeft className="size-3.5" /> Painel do Organizador
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Gerenciar Partida</span>
            <h1 className="font-serif text-3xl leading-tight first-letter:uppercase">{formatMatchDate(match.date)}</h1>
            {(match.location || match.cost != null) && (
              <p className="text-xs text-moss font-semibold mt-0.5 flex items-center gap-3">
                {match.location && <span>📍 {match.location}</span>}
                {match.cost != null && <span>💰 R$ {match.cost.toFixed(2).replace(".", ",")} por jogador</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusStamp status={match.status} votingOpen={match.votingOpen} />
            <Link
              href={`/partida/${match.id}`}
              className="inline-flex items-center gap-1 border-2 border-moss bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wider hover:bg-paper-dark"
            >
              Página Pública <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Votação e Notas */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Vote className="size-5 text-moss" />
            <h2 className="font-serif text-2xl">Votação e Notas</h2>
          </div>
          {match.status !== "FINISHED" && (
            <div className="flex items-center gap-2">
              {!match.votingOpen ? (
                <form action={openVoting.bind(null, match.id)}>
                  <SubmitButton className="bg-moss text-paper hover:bg-moss-soft py-1.5 px-3 text-xs font-bold uppercase tracking-wider shadow-hard-sm">
                    Abrir Votação
                  </SubmitButton>
                </form>
              ) : (
                <form action={closeVoting.bind(null, match.id)}>
                  <SubmitButton
                    className="bg-brick text-paper hover:bg-brick/90 py-1.5 px-3 text-xs font-bold uppercase tracking-wider shadow-hard-sm"
                    confirm="Deseja encerrar a votação desta partida e atualizar a nota base dos jogadores?"
                  >
                    Encerrar Votação e Salvar Notas
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </div>

        {match.votingOpen && (
          <div className="p-3 bg-paper-dark border-2 border-moss flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brick block">Urna Aberta</span>
              <span className="text-xs text-moss font-mono truncate block">/votar/{match.voteToken}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CopyLink
                url={`/votar/${match.voteToken}`}
                id="copiar-link-voto"
                className="py-1.5 px-3 text-xs w-auto shadow-none"
              />
              <Link
                href={`/votar/${match.voteToken}`}
                className="border-2 border-moss bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-paper-dark"
              >
                Abrir Cédula ↗
              </Link>
            </div>
          </div>
        )}

        {match.status === "FINISHED" && (
          <div className="p-2.5 bg-moss/10 border border-moss/30 text-xs text-moss font-semibold flex items-center gap-2">
            <CheckCircle2 className="size-4 text-moss shrink-0" />
            Partida finalizada. As notas computadas abaixo já foram incorporadas à nota base dos jogadores.
          </div>
        )}

        <AdminVotesTable matchId={match.id} />
      </section>

      {/* Lista de Presença da Partida */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-moss" />
            <h2 className="font-serif text-2xl">Jogadores na Partida</h2>
          </div>
          <span className="font-mono text-xs font-bold text-moss">
            {match.attendances.length} confirmados
          </span>
        </div>

        {/* Lista atual */}
        {match.attendances.length ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {match.attendances.map((a, i) => (
              <li
                key={a.id}
                className="flex items-center justify-between p-2.5 border border-moss/20 bg-paper-dark text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 font-mono text-[10px] text-moss-soft">{i + 1}.</span>
                  <span className="truncate font-semibold text-moss">{a.player.name}</span>
                  {a.player.isGoalkeeper && <GloveBadge />}
                </div>

                {match.status !== "FINISHED" && (
                  <form action={removeAttendance.bind(null, match.id, a.id)}>
                    <SubmitButton
                      className="text-brick hover:bg-brick hover:text-paper px-2 py-0.5 text-[10px] font-bold uppercase rounded shadow-none"
                      confirm={`Remover ${a.player.name} desta partida?`}
                    >
                      Remover
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-moss-soft italic">Nenhum jogador adicionado a esta partida.</p>
        )}

        {/* Adicionar Jogadores à Partida */}
        {match.status !== "FINISHED" && (
          <div className="mt-4 pt-4 border-t-2 border-moss/20 flex flex-col gap-4">
            <h3 className="font-serif text-lg">Adicionar Jogadores</h3>

            {/* Checklist de jogadores cadastrados disponíveis */}
            {availablePlayers.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-moss-soft">
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
            <details className="border-t border-moss/20 pt-2">
              <summary className="text-xs font-bold uppercase tracking-wider text-brick cursor-pointer underline">
                + Adicionar por Lista de Nomes (Colar texto ou lista numerada)
              </summary>
              <form action={addAttendancesByText.bind(null, match.id)} className="flex flex-col gap-2 mt-3">
                <textarea
                  name="names"
                  rows={4}
                  className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs font-mono text-moss outline-none"
                  placeholder={`1. Paulo Ricardo\n2. Tuguinho\n3. Ricardo...`}
                  required
                />
                <SubmitButton className="bg-moss text-paper hover:bg-moss-soft py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm">
                  Importar e Adicionar à Partida
                </SubmitButton>
              </form>
            </details>
          </div>
        )}
      </section>

      {/* Editar Dados da Partida */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <h2 className="font-serif text-xl border-b-2 border-moss/20 pb-2">Editar Dados da Partida</h2>
        <form action={updateMatchConfig.bind(null, match.id)} className="flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
              Data e Horário
            </label>
            <input
              name="date"
              type="datetime-local"
              defaultValue={formatDateTimeInput(match.date)}
              className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs font-mono text-moss outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                Local
              </label>
              <input
                name="location"
                type="text"
                defaultValue={match.location ?? ""}
                placeholder="Ex: Arena Futebol Clube"
                className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs text-moss outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                Valor por Jogador (R$)
              </label>
              <input
                name="cost"
                type="number"
                step="0.50"
                defaultValue={match.cost ?? ""}
                placeholder="Ex: 25.00"
                className="w-full border-2 border-moss bg-paper px-3 py-2 text-xs font-mono text-moss outline-none"
              />
            </div>
          </div>

          <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-2.5 text-xs font-bold uppercase tracking-wider shadow-hard-sm mt-1">
            Salvar Alterações
          </SubmitButton>
        </form>
      </section>

      {/* Exclusão da Partida */}
      <section className="border-[3px] border-brick/40 bg-paper p-4 flex items-center justify-between gap-4">
        <div>
          <span className="font-serif text-base text-brick block">Excluir Partida</span>
          <span className="text-[11px] text-moss-soft">
            Apaga permanentemente a partida e seus votos. Se finalizada, reverte os pontos.
          </span>
        </div>
        <form action={deleteMatch.bind(null, match.id)}>
          <SubmitButton
            className="bg-brick text-paper hover:bg-brick/90 py-2 px-3 text-xs font-bold uppercase tracking-wider shadow-none shrink-0"
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
