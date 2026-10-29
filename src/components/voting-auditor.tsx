"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Eye, Trash2, Edit3, Check, X } from "lucide-react";
import { TeamColorBadge, GloveBadge } from "@/components/ui";
import { adminUpdateVote, adminResetVoterVotes, adminDeleteSingleVote } from "@/app/admin/actions";

type OutlierVote = {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
  targetTeam: string | null;
  score: number;
};

interface VotingAuditorProps {
  matchId: string;
  outliers: OutlierVote[];
  voters: { id: string; name: string; voteCount: number }[];
  votesByVoter: Record<
    string,
    { targetId: string; targetName: string; targetTeam: string | null; targetIsGoalkeeper: boolean; score: number }[]
  >;
}

export function VotingAuditor({ matchId, outliers, voters, votesByVoter }: VotingAuditorProps) {
  const [selectedVoterId, setSelectedVoterId] = useState<string>(voters[0]?.id ?? "");
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(3.0);
  const [pending, startTransition] = useTransition();

  const activeVotes = selectedVoterId ? (votesByVoter[selectedVoterId] ?? []) : [];
  const selectedVoter = voters.find((v) => v.id === selectedVoterId);

  const handleResetAllVotes = () => {
    if (!selectedVoterId || pending) return;
    const ok = window.confirm(
      `Deseja realmente resetar e apagar todos os ${activeVotes.length} votos emitidos por ${selectedVoter?.name}?`
    );
    if (!ok) return;

    startTransition(async () => {
      await adminResetVoterVotes(matchId, selectedVoterId);
    });
  };

  const handleDeleteSingle = (targetId: string, targetName: string) => {
    if (!selectedVoterId || pending) return;
    const ok = window.confirm(`Deseja excluir o voto de ${selectedVoter?.name} para ${targetName}?`);
    if (!ok) return;

    startTransition(async () => {
      await adminDeleteSingleVote(matchId, selectedVoterId, targetId);
    });
  };

  const handleStartEdit = (targetId: string, currentScore: number) => {
    setEditingTargetId(targetId);
    setEditScore(currentScore);
  };

  const handleSaveEdit = (targetId: string) => {
    if (!selectedVoterId || pending) return;
    startTransition(async () => {
      await adminUpdateVote(matchId, selectedVoterId, targetId, editScore);
      setEditingTargetId(null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Alertas de Votos Outliers (1.0 ou 5.0) */}
      <div className="border border-amber-500/30 bg-amber-500/8 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4.5 text-amber-600 shrink-0" />
            <h3 className="font-serif text-lg text-moss flex items-center gap-2">
              Auditoria de Outliers Extremos
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 px-1.5 py-0.5 rounded-sm">
                Notas 1★ ou 5★ ({outliers.length})
              </span>
            </h3>
          </div>
          <span className="text-[11px] font-mono text-moss-soft">
            {outliers.length === 0 ? "Nenhum extremo registrado" : "Atenção do organizador"}
          </span>
        </div>

        {outliers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {outliers.map((o, idx) => (
              <div
                key={`${o.voterId}-${o.targetId}-${idx}`}
                className="flex items-center justify-between p-2 rounded-lg bg-white/70 border border-amber-500/20 text-xs shadow-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 text-moss">
                    <span className="font-extrabold text-[11px] truncate max-w-[110px]" title={o.voterName}>
                      {o.voterName}
                    </span>
                    <span className="text-[10px] text-moss-soft uppercase">votou em</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 min-w-0">
                    <TeamColorBadge team={o.targetTeam} />
                    <span className="font-semibold truncate max-w-[110px]" title={o.targetName}>
                      {o.targetName}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <span
                    className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-sm border ${
                      o.score >= 5
                        ? "bg-emerald-500/15 text-emerald-800 border-emerald-500/30"
                        : "bg-brick/15 text-brick border-brick/30"
                    }`}
                  >
                    ★ {o.score.toFixed(1).replace(".", ",")}
                  </span>
                  <button
                    type="button"
                    title="Inspecionar/Editar este votante"
                    onClick={() => setSelectedVoterId(o.voterId)}
                    className="p-1 text-moss-soft hover:text-brick rounded transition-colors cursor-pointer"
                  >
                    <Edit3 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-moss-soft">
            Nenhum votante atribuiu notas nos extremos 1.0 ou 5.0 nesta partida até o momento.
          </p>
        )}
      </div>

      {/* 2. Inspetor e Editor de Votos por Votante */}
      <div className="border border-moss/15 bg-white/75 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-moss/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Eye className="size-4.5 text-brick shrink-0" />
            <div>
              <h3 className="font-serif text-lg text-moss">Inspecionar & Editar Votos por Pessoa</h3>
              <p className="text-[11px] text-moss-soft">
                O organizador pode ajustar qualquer nota individual ou resetar a votação completa de um atleta.
              </p>
            </div>
          </div>

          {voters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="voterSelect" className="text-xs font-bold text-moss uppercase tracking-wider shrink-0">
                Votante:
              </label>
              <select
                id="voterSelect"
                value={selectedVoterId}
                onChange={(e) => setSelectedVoterId(e.target.value)}
                className="bg-paper border border-moss/20 rounded-lg px-2.5 py-1 text-xs font-bold text-moss focus:outline-none focus:ring-1 focus:ring-brick"
              >
                {voters.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.voteCount} votos dados)
                  </option>
                ))}
              </select>

              {activeVotes.length > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleResetAllVotes}
                  title={`Resetar e apagar todos os votos dados por ${selectedVoter?.name}`}
                  className="inline-flex items-center gap-1 bg-brick/10 hover:bg-brick hover:text-paper text-brick border border-brick/30 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg transition-colors cursor-pointer ml-auto disabled:opacity-50"
                >
                  <Trash2 className="size-3" />
                  Resetar Votos do Jogador
                </button>
              )}
            </div>
          )}
        </div>

        {voters.length === 0 ? (
          <p className="text-xs text-moss-soft py-2">Nenhum voto foi registrado ainda nesta partida.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-moss-soft font-medium">
              <span>
                Exibindo votos de: <strong className="text-moss font-bold">{selectedVoter?.name}</strong>
              </span>
              <span className="font-mono">{activeVotes.length} atletas avaliados</span>
            </div>

            <div className="border border-moss/10 rounded-xl overflow-hidden bg-paper/60">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-moss/10 text-moss uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2 px-2 font-extrabold">Atleta Avaliado</th>
                    <th className="py-2 px-2 w-36 text-center font-extrabold">Nota Dada</th>
                    <th className="py-2 px-2 w-20 text-right font-extrabold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-moss/10">
                  {activeVotes.map((v, i) => {
                    const isEditing = editingTargetId === v.targetId;
                    return (
                      <tr key={`${selectedVoterId}-${v.targetId}-${i}`} className="hover:bg-paper-dark/30">
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <TeamColorBadge team={v.targetTeam} />
                            <Link
                              href={`/perfil/${v.targetId}`}
                              className="font-bold text-moss hover:text-brick hover:underline truncate"
                            >
                              {v.targetName}
                            </Link>
                            {v.targetIsGoalkeeper && <GloveBadge />}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <select
                                value={editScore}
                                onChange={(e) => setEditScore(Number(e.target.value))}
                                className="bg-paper border border-moss/30 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-moss"
                              >
                                {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((s) => (
                                  <option key={s} value={s}>
                                    ★ {s.toFixed(1).replace(".", ",")}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => handleSaveEdit(v.targetId)}
                                className="p-1 rounded bg-moss text-paper hover:bg-moss-soft cursor-pointer"
                                title="Salvar alteração"
                              >
                                <Check className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTargetId(null)}
                                className="p-1 rounded bg-paper-dark text-moss hover:bg-paper cursor-pointer"
                                title="Cancelar"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-sm border inline-block ${
                                v.score >= 5
                                  ? "bg-emerald-500/15 text-emerald-800 border-emerald-500/30"
                                  : v.score <= 1.0
                                  ? "bg-brick/15 text-brick border-brick/30"
                                  : "bg-paper-dark/70 text-moss border-moss/20"
                              }`}
                            >
                              ★ {v.score.toFixed(1).replace(".", ",")}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isEditing && (
                              <>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => handleStartEdit(v.targetId, v.score)}
                                  className="p-1 text-moss-soft hover:text-moss rounded transition-colors cursor-pointer"
                                  title="Editar esta nota"
                                >
                                  <Edit3 className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => handleDeleteSingle(v.targetId, v.targetName)}
                                  className="p-1 text-moss-soft hover:text-brick rounded transition-colors cursor-pointer"
                                  title="Excluir este voto"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
