"use client";

import { useTransition } from "react";
import { Hand } from "lucide-react";
import { setAttendanceTeam, setAttendanceGoalkeeper } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const TEAMS = [
  { id: "azul", label: "Azul", color: "bg-blue-600", activeClass: "bg-blue-600 text-white ring-2 ring-blue-500" },
  { id: "vermelho", label: "Vermelho", color: "bg-red-600", activeClass: "bg-red-600 text-white ring-2 ring-red-500" },
  { id: "preto", label: "Preto", color: "bg-neutral-900", activeClass: "bg-neutral-900 text-white ring-2 ring-neutral-900" },
  { id: "amarelo", label: "Amarelo", color: "bg-amber-400", activeClass: "bg-amber-400 text-neutral-950 ring-2 ring-amber-500" },
] as const;

export function TeamColorSelector({
  matchId,
  attendanceId,
  playerId,
  currentTeam,
  isGoalkeeper = false,
  disabled = false,
}: {
  matchId: string;
  attendanceId: string;
  playerId?: string;
  currentTeam?: string | null;
  isGoalkeeper?: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const handleSelectTeam = (teamId: string | null) => {
    if (disabled || pending) return;
    const next = currentTeam === teamId ? null : teamId;
    startTransition(async () => {
      await setAttendanceTeam(matchId, attendanceId, next);
    });
  };

  const handleToggleGk = () => {
    if (disabled || pending || !playerId) return;
    startTransition(async () => {
      await setAttendanceGoalkeeper(matchId, attendanceId, playerId, !isGoalkeeper);
    });
  };

  return (
    <div className="inline-flex items-center gap-1 bg-paper-dark/65 p-1 rounded-lg border border-moss/15">
      {TEAMS.map((t) => {
        const isSelected = currentTeam === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled || pending}
            onClick={() => handleSelectTeam(t.id)}
            title={`Time ${t.label}${isSelected ? " (Selecionado - clique para remover)" : ""}`}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase transition-all cursor-pointer select-none",
              isSelected
                ? `${t.activeClass} shadow-xs font-black scale-105`
                : "text-moss-soft hover:text-moss hover:bg-white/70 opacity-70 hover:opacity-100",
              pending && "opacity-50 cursor-wait",
            )}
          >
            <span className={cn("size-2 rounded-full shrink-0 shadow-2xs", t.color)} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}

      {playerId && (
        <>
          <span className="w-px h-3.5 bg-moss/20 mx-0.5" aria-hidden="true" />
          <button
            type="button"
            disabled={disabled || pending}
            onClick={handleToggleGk}
            title={isGoalkeeper ? "Goleiro fixo (clique para remover)" : "Definir como Goleiro Fixo"}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer select-none",
              isGoalkeeper
                ? "bg-amber-500/25 text-amber-950 border border-amber-600/40 font-black shadow-xs ring-1 ring-amber-500/50"
                : "text-moss-soft hover:text-moss hover:bg-white/70 opacity-70 hover:opacity-100",
              pending && "opacity-50 cursor-wait",
            )}
          >
            <Hand className="size-3 text-amber-800 shrink-0 fill-amber-500/30" strokeWidth={2.2} />
            <span className="hidden sm:inline">Goleiro</span>
            <span className="sm:hidden">GL</span>
          </button>
        </>
      )}
    </div>
  );
}
