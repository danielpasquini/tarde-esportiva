"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Eye, User, ChevronRight } from "lucide-react";
import { TeamColorBadge, GloveBadge } from "@/components/ui";

type PlayerSummary = {
  id: string;
  name: string;
  team: string | null;
  isGoalkeeper: boolean;
};

type VoteDetail = {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
  targetTeam: string | null;
  targetIsGoalkeeper: boolean;
  score: number;
};

type OutlierVote = {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
  targetTeam: string | null;
  score: number;
};

interface VotingAuditorProps {
  outliers: OutlierVote[];
  voters: { id: string; name: string; voteCount: number }[];
  votesByVoter: Record<string, { targetId: string; targetName: string; targetTeam: string | null; targetIsGoalkeeper: boolean; score: number }[]>;
}

export function VotingAuditor({ outliers, voters, votesByVoter }: VotingAuditorProps) {
  const [selectedVoterId, setSelectedVoterId] = useState<string>(voters[0]?.id ?? "");

  const activeVotes = selectedVoterId ? (votesByVoter[selectedVoterId] ?? []) : [];
  const selectedVoter = voters.find((v) => v.id === selectedVoterId);

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

                <div className="shrink-0">
                  <span
                    className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-sm border ${
                      o.score >= 5
                        ? "bg-emerald-500/15 text-emerald-800 border-emerald-500/30"
                        : "bg-brick/15 text-brick border-brick/30"
                    }`}
                  >
                    ★ {o.score.toFixed(1).replace(".", ",")}
                  </span>
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

      {/* 2. Inspetor de Votos por Votante */}
      <div className="border border-moss/15 bg-white/75 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-moss/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Eye className="size-4.5 text-brick shrink-0" />
            <div>
              <h3 className="font-serif text-lg text-moss">Inspecionar Votos por Pessoa</h3>
              <p className="text-[11px] text-moss-soft">
                Escolha qualquer votante confirmado para auditar individualmente as notas concedidas.
              </p>
            </div>
          </div>

          {voters.length > 0 && (
            <div className="flex items-center gap-2">
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
                    <th className="py-2 px-2 w-24 text-right font-extrabold">Nota Dada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-moss/10">
                  {activeVotes.map((v, i) => (
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
                      <td className="py-1.5 px-2 text-right">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
