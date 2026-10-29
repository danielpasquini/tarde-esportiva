"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Star, ChevronDown, Lock, Globe, User, Search, X, Award } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import type { MedalCounts } from "@/lib/rating";
import { GloveBadge, PlayerMedals, TeamColorBadge } from "@/components/ui";
import CountUp from "@/components/CountUp";
import Magnet from "@/components/Magnet";

export type MatchItem = {
  id: string;
  date: string | Date;
  status?: string;
  location?: string | null;
};

export type PlayerHistoryItem = {
  id: string;
  name: string;
  isGoalkeeper: boolean;
  baseRating: number | null;
  timesPlayed: number;
  hasPin?: boolean;
  isPublic?: boolean;
  medals?: MedalCounts;
  attendanceMap: Record<string, { team: string | null; avg: number | null }>;
};

type PositionFilter = "all" | "gk" | "line";
type SortMode = "matches" | "medals" | "name" | "rating";

export function HistoryPlayersList({
  players,
  allMatches,
  isOrganizer,
}: {
  players: PlayerHistoryItem[];
  allMatches: MatchItem[];
  isOrganizer: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState<PositionFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("matches");

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (posFilter === "gk" && !p.isGoalkeeper) return false;
        if (posFilter === "line" && p.isGoalkeeper) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortMode === "name") return a.name.localeCompare(b.name);
        if (sortMode === "rating" && isOrganizer) {
          return (b.baseRating ?? 0) - (a.baseRating ?? 0) || b.timesPlayed - a.timesPlayed || a.name.localeCompare(b.name);
        }
        if (sortMode === "medals") {
          const ma = a.medals ?? { gold: 0, silver: 0, bronze: 0 };
          const mb = b.medals ?? { gold: 0, silver: 0, bronze: 0 };
          return (
            mb.gold - ma.gold ||
            mb.silver - ma.silver ||
            mb.bronze - ma.bronze ||
            b.timesPlayed - a.timesPlayed ||
            a.name.localeCompare(b.name)
          );
        }
        return b.timesPlayed - a.timesPlayed || a.name.localeCompare(b.name);
      });
  }, [players, query, posFilter, sortMode, isOrganizer]);

  const displayedPlayers = filteredPlayers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPlayers.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de Busca e Filtros Compacta */}
      <div className="flex flex-col gap-2 bg-paper-dark/65 rounded-xl border border-moss/12 p-2.5">
        <div className="relative flex items-center">
          <Search className="size-3.5 text-moss-soft absolute left-3 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jogador pelo nome…"
            aria-label="Buscar jogador pelo nome"
            className="w-full rounded-lg border border-moss/15 focus:border-moss/50 bg-white/90 pl-8 pr-7 py-1.5 text-xs text-moss placeholder:text-moss-soft/65 outline-none transition-colors shadow-2xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 text-moss-soft hover:text-brick cursor-pointer"
              aria-label="Limpar busca"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex items-center gap-0.5 bg-white/70 p-0.5 rounded-lg border border-moss/12">
            {(
              [
                ["all", "Todos"],
                ["line", "Linha"],
                ["gk", "Goleiros"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPosFilter(key)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  posFilter === key
                    ? "bg-moss text-paper shadow-2xs"
                    : "text-moss-soft hover:text-moss"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-moss-soft">Ordenar:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Ordenar jogadores"
              className="rounded-lg border border-moss/15 bg-white/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-moss outline-none cursor-pointer shadow-2xs"
            >
              <option value="matches">Mais Partidas</option>
              <option value="medals">Medalhas</option>
              <option value="name">Nome (A–Z)</option>
              {isOrganizer && <option value="rating">Nota</option>}
            </select>
          </div>
        </div>
      </div>

      {displayedPlayers.length === 0 ? (
        <p className="text-xs text-moss-soft text-center py-4 italic">
          Nenhum jogador encontrado para este filtro.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-moss/10 border border-moss/15 rounded-xl bg-white/80 overflow-hidden shadow-hard-sm">
          {displayedPlayers.map((p, index) => {
            const isTop3 = index < 3;
            const totalMedals = (p.medals?.gold ?? 0) + (p.medals?.silver ?? 0) + (p.medals?.bronze ?? 0);
            const playedMatches = allMatches.filter((m) => p.attendanceMap[m.id] != null);

            return (
              <li key={p.id}>
                <details className="group">
                  {/* Linha Principal Enxuta: Rank + Nome | Jogos + Dropdown Trigger */}
                  <summary className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer hover:bg-paper-dark/45 transition-colors list-none select-none">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-sm font-mono text-[10px] font-extrabold tabular-nums shrink-0 ${
                          isTop3
                            ? "bg-moss text-paper"
                            : "bg-paper-dark text-moss-soft border border-moss/15"
                        }`}
                      >
                        #{index + 1}
                      </span>

                      <span className="font-bold text-sm truncate text-moss">{p.name}</span>

                      {totalMedals > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-amber-900 bg-amber-400/20 border border-amber-500/35 px-1.5 py-0.5 rounded-xs shrink-0 leading-none"
                          title={`${totalMedals} medalha(s)`}
                        >
                          🏅 {totalMedals}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[10px] font-bold text-moss-soft bg-paper-dark/75 border border-moss/12 rounded-sm px-2 py-0.5 tabular-nums">
                        {p.timesPlayed} {p.timesPlayed === 1 ? "jogo" : "jogos"}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-md border border-moss/15 bg-paper px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-moss group-open:bg-moss group-open:text-paper transition-colors">
                        <span>Detalhes</span>
                        <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                      </span>
                    </div>
                  </summary>

                  {/* Dropdown: Ficha de Badges, Nota & Histórico de Jogos */}
                  <div className="border-t border-moss/12 bg-paper-dark/55 p-3 fut-grid-bg flex flex-col gap-2.5">
                    {/* Faixa de Badges + Nota + Botão Perfil */}
                    <div className="flex items-center justify-between gap-2 flex-wrap bg-white/85 border border-moss/12 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.isGoalkeeper ? (
                          <GloveBadge />
                        ) : (
                          <span className="inline-flex items-center rounded-sm bg-moss/8 border border-moss/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-moss">
                            Linha
                          </span>
                        )}

                        {totalMedals > 0 ? (
                          <PlayerMedals medals={p.medals} />
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-paper-dark/80 border border-moss/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-moss-soft">
                            <Award className="size-2.5" /> 0 medalhas
                          </span>
                        )}

                        {isOrganizer && (
                          p.baseRating != null ? (
                            <span className="inline-flex items-center gap-1 rounded-sm border border-brick/30 bg-amber-500/10 px-2 py-0.5">
                              <Star className="size-3 fill-brick text-brick" />
                              <span className="font-mono text-[11px] font-extrabold text-moss tabular-nums">
                                Nota <CountUp to={p.baseRating} decimals={1} duration={0.8} />
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-paper-dark border border-moss/12 px-2 py-0.5 text-[9px] font-bold text-moss-soft">
                              Sem nota
                            </span>
                          )
                        )}

                        {p.hasPin && !p.isPublic && (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-paper-dark border border-moss/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-moss-soft">
                            <Lock className="size-2.5 text-brick" /> PIN
                          </span>
                        )}
                        {p.isPublic && (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-moss/10 border border-moss/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-moss">
                            <Globe className="size-2.5 text-moss" /> Público
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/perfil/${p.id}`}
                        className="inline-flex items-center gap-1 rounded-md text-[10px] font-extrabold text-paper bg-moss hover:bg-moss-soft px-2.5 py-1 uppercase tracking-wider transition-colors shrink-0"
                      >
                        <User className="size-3 text-team-amarelo" />
                        Perfil <ArrowUpRight className="size-3" />
                      </Link>
                    </div>

                    {/* Lista Compacta de Partidas Disputadas */}
                    {playedMatches.length > 0 ? (
                      <div className="flex flex-col divide-y divide-moss/10 border border-moss/12 rounded-lg bg-white/90 max-h-56 overflow-y-auto">
                        {playedMatches.map((m) => {
                          const att = p.attendanceMap[m.id];
                          const dateObj = typeof m.date === "string" ? new Date(m.date) : m.date;
                          const timeStr = dateObj.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "America/Sao_Paulo",
                          });

                          return (
                            <div
                              key={m.id}
                              className="flex items-center justify-between px-2.5 py-1.5 text-xs transition-colors gap-2 hover:bg-paper-dark/40"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <TeamColorBadge team={att?.team} />
                                <span className="font-bold text-moss text-[11px]">
                                  {formatShortDate(dateObj)}
                                </span>
                                <span className="font-mono text-[9px] text-moss-soft bg-paper-dark/80 px-1.5 py-0.5 rounded-xs border border-moss/10">
                                  {timeStr}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isOrganizer && att?.avg != null && (
                                  <span className="inline-flex items-center gap-0.5 rounded-xs border border-moss/20 bg-paper px-1.5 py-0.5 font-mono font-bold text-[10px] text-moss">
                                    ★ {att.avg.toFixed(1).replace(".", ",")}
                                  </span>
                                )}

                                <Link
                                  href={`/partida/${m.id}`}
                                  className="text-[10px] font-extrabold uppercase tracking-wider text-brick hover:underline flex items-center gap-0.5 whitespace-nowrap"
                                >
                                  Resumo <ArrowUpRight className="size-3 text-brick" />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-moss-soft italic px-1">
                        Nenhuma presença registrada nas partidas até o momento.
                      </p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <Magnet padding={18} magnetStrength={3} className="w-full">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => Math.min(prev + 12, filteredPlayers.length))}
            className="w-full rounded-xl border border-moss/20 bg-paper-dark hover:bg-white text-moss font-serif text-sm font-bold py-2.5 shadow-hard-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] select-none cursor-pointer"
          >
            <ChevronDown className="size-4" />
            Exibir mais jogadores ({filteredPlayers.length - visibleCount} restantes)
          </button>
        </Magnet>
      )}
    </div>
  );
}
