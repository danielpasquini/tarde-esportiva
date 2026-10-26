"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Star, ChevronDown, Lock, Globe, User } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { TEAM_META, type TeamKey } from "@/lib/teams";
import { GloveBadge } from "@/components/ui";

export type MatchItem = {
  id: string;
  date: string | Date;
};

export type PlayerHistoryItem = {
  id: string;
  name: string;
  isGoalkeeper: boolean;
  baseRating: number;
  timesPlayed: number;
  hasPin?: boolean;
  isPublic?: boolean;
  attendanceMap: Record<string, { team: string | null; avg: number | null }>;
};

export function HistoryPlayersList({
  players,
  allMatches,
  isOrganizer,
}: {
  players: PlayerHistoryItem[];
  allMatches: MatchItem[];
  isOrganizer: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(20);

  const displayedPlayers = players.slice(0, visibleCount);
  const hasMore = visibleCount < players.length;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y-2 divide-moss/20 border-2 border-moss bg-paper">
        {displayedPlayers.map((p, index) => (
          <li key={p.id}>
            <details className="group">
              <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer bg-paper hover:bg-paper-dark transition-colors list-none select-none">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-mono text-xs text-moss-soft w-6 tabular-nums">
                    #{index + 1}
                  </span>
                  <span className="font-semibold text-sm truncate text-moss">{p.name}</span>
                  {p.isGoalkeeper && <GloveBadge />}
                  {p.hasPin && !p.isPublic && (
                    <span title="Perfil Privado com PIN">
                      <Lock className="size-3 text-moss-soft shrink-0" />
                    </span>
                  )}
                  {p.isPublic && (
                    <span title="Perfil Público">
                      <Globe className="size-3 text-moss shrink-0" />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/perfil/${p.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brick bg-paper hover:bg-paper-dark border border-moss/30 px-2 py-0.5 rounded shadow-xs"
                    title="Acessar Perfil Individual"
                  >
                    {p.hasPin && !p.isPublic && !isOrganizer ? (
                      <Lock className="size-2.5 text-brick" />
                    ) : (
                      <User className="size-2.5 text-brick" />
                    )}
                    Perfil
                  </Link>

                  <span className="text-[10px] uppercase font-bold text-moss-soft tracking-wider bg-moss/10 px-2 py-0.5 rounded">
                    {p.timesPlayed} {p.timesPlayed === 1 ? "partida" : "partidas"}
                  </span>

                  {/* Notas visíveis EXCLUSIVAMENTE para o organizador */}
                  {isOrganizer && (
                    <div className="flex items-center gap-1 border border-moss bg-paper-dark px-2 py-0.5 rounded shadow-xs">
                      <Star className="size-3 fill-brick text-brick" />
                      <span className="font-serif text-xs font-bold text-moss tabular-nums">
                        ★ {p.baseRating.toFixed(1).replace(".", ",")}
                      </span>
                    </div>
                  )}

                  <span className="text-[10px] font-bold uppercase text-moss-soft underline group-open:hidden">
                    Partidas ▾
                  </span>
                  <span className="text-[10px] font-bold uppercase text-moss-soft underline hidden group-open:inline">
                    Ocultar ▴
                  </span>
                </div>
              </summary>

              <div className="border-t border-moss/30 bg-paper-dark p-3">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-moss/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-moss-soft">
                    Histórico de Partidas (Destaque nas presentes)
                  </p>
                  <Link
                    href={`/perfil/${p.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brick bg-paper hover:bg-paper-dark border border-moss/30 px-2.5 py-1 rounded shadow-xs uppercase tracking-wider transition-colors"
                  >
                    {p.hasPin && !p.isPublic && !isOrganizer ? (
                      <>
                        <Lock className="size-3 text-brick" /> Ver Perfil
                      </>
                    ) : (
                      <>
                        <User className="size-3 text-brick" /> Ver Perfil
                      </>
                    )}
                  </Link>
                </div>

                {allMatches.length ? (
                  <div className="flex flex-col divide-y divide-moss/15 border border-moss/30 bg-paper max-h-96 overflow-y-auto">
                    {allMatches.map((m) => {
                      const att = p.attendanceMap[m.id];
                      const wasPresent = att != null;

                      return (
                        <div
                          key={m.id}
                          className={`flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                            wasPresent
                              ? "bg-moss/10 border-l-4 border-moss font-medium"
                              : "bg-paper opacity-65 hover:opacity-90"
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={wasPresent ? "font-bold text-moss" : "text-moss-soft"}>
                              {formatShortDate(typeof m.date === "string" ? new Date(m.date) : m.date)}
                            </span>

                            {wasPresent ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-moss bg-moss/20 px-1.5 py-0.5 rounded">
                                {att.team && (
                                  <span
                                    className={`size-2.5 rounded-xs border border-moss/40 ${
                                      TEAM_META[att.team as TeamKey]?.swatch ?? ""
                                    }`}
                                  />
                                )}
                                ✓ Presente
                                {att.team && ` (Time ${TEAM_META[att.team as TeamKey]?.label ?? att.team})`}
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-semibold text-moss-soft/80 bg-paper-dark px-1.5 py-0.5 rounded border border-moss/20">
                                Ausente
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Notas visíveis apenas para organizador em partidas que participou */}
                            {isOrganizer && wasPresent && att.avg != null && (
                              <span className="font-mono font-bold text-xs text-moss">
                                ★ {att.avg.toFixed(1).replace(".", ",")}
                              </span>
                            )}

                            <Link
                              href={`/partida/${m.id}`}
                              className="text-[10px] font-bold uppercase tracking-wider text-brick hover:underline flex items-center gap-0.5"
                            >
                              Ver Jogo <ArrowUpRight className="size-3 text-brick" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-moss-soft italic">Nenhuma partida registrada ainda.</p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((prev) => Math.min(prev + 20, players.length))}
          className="w-full border-2 border-moss bg-paper-dark hover:bg-paper text-moss font-serif text-sm font-bold py-2.5 shadow-hard flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 select-none"
        >
          <ChevronDown className="size-4" />
          Exibir mais jogadores ({players.length - visibleCount} restantes)
        </button>
      )}
    </div>
  );
}
