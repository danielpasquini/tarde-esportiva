"use client";

import { useTransition } from "react";
import { Check, Hand } from "lucide-react";
import { setAttendanceTeam, setAttendanceGoalkeeper } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const TEAMS = [
  {
    id: "azul",
    label: "Azul",
    swatch: "bg-blue-600",
    activeClass: "bg-blue-600 text-white ring-2 ring-blue-500 ring-offset-1 border-blue-700 shadow-md",
    inactiveClass: "bg-blue-50/80 text-blue-900 border-blue-200 hover:bg-blue-100/80",
    dotClass: "bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.6)]",
  },
  {
    id: "vermelho",
    label: "Vermelho",
    swatch: "bg-red-600",
    activeClass: "bg-red-600 text-white ring-2 ring-red-500 ring-offset-1 border-red-700 shadow-md",
    inactiveClass: "bg-red-50/80 text-red-900 border-red-200 hover:bg-red-100/80",
    dotClass: "bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.6)]",
  },
  {
    id: "preto",
    label: "Preto",
    swatch: "bg-neutral-900",
    activeClass: "bg-neutral-900 text-white ring-2 ring-neutral-800 ring-offset-1 border-black shadow-md",
    inactiveClass: "bg-neutral-100 text-neutral-900 border-neutral-300 hover:bg-neutral-200",
    dotClass: "bg-neutral-900 shadow-[0_0_6px_rgba(23,23,23,0.5)]",
  },
  {
    id: "amarelo",
    label: "Amarelo",
    swatch: "bg-amber-400",
    activeClass: "bg-amber-300 text-amber-950 ring-2 ring-amber-400 ring-offset-1 border-amber-400 font-black shadow-md",
    inactiveClass: "bg-amber-50/90 text-amber-950 border-amber-300/80 hover:bg-amber-100",
    dotClass: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
  },
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
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-paper-dark/75 border border-moss/15 shadow-2xs">
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
                "size-7 rounded-lg transition-all flex items-center justify-center border cursor-pointer select-none active:scale-90",
                isSelected
                  ? `${t.activeClass} scale-105`
                  : "bg-white/80 border-moss/15 hover:bg-white hover:scale-105 opacity-80 hover:opacity-100",
                pending && "opacity-50 cursor-wait",
              )}
            >
              <span className={cn("size-3 rounded-full shrink-0 border border-white/40", t.dotClass)} />
            </button>
          );
        })}
      </div>

      {playerId && (
        <button
          type="button"
          disabled={disabled || pending}
          onClick={handleToggleGk}
          title={isGoalkeeper ? "Goleiro fixo (clique para remover)" : "Definir como Goleiro Fixo"}
          className={cn(
            "h-7 px-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer select-none active:scale-95 shadow-2xs",
            isGoalkeeper
              ? "bg-amber-400/25 text-amber-950 border-amber-600/50 font-black shadow-xs ring-2 ring-amber-500/50"
              : "bg-paper-dark/75 text-moss-soft border-moss/15 hover:text-moss hover:bg-paper-dark",
            pending && "opacity-50 cursor-wait",
          )}
        >
          <Hand className="size-3.5 text-amber-800 shrink-0 fill-amber-500/40" strokeWidth={2.4} />
          <span className="text-[10px]">GL</span>
          {isGoalkeeper && <Check className="size-3 shrink-0 text-amber-900 stroke-[3]" />}
        </button>
      )}
    </div>
  );
}
