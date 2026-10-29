"use client";

import { useTransition } from "react";
import { Check, Hand } from "lucide-react";
import { setAttendanceTeam, setAttendanceGoalkeeper } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const TEAMS = [
  {
    id: "azul",
    label: "Azul",
    colorClass: "bg-blue-600 border-blue-700",
  },
  {
    id: "vermelho",
    label: "Vermelho",
    colorClass: "bg-red-600 border-red-700",
  },
  {
    id: "preto",
    label: "Preto",
    colorClass: "bg-neutral-900 border-neutral-950",
  },
  {
    id: "amarelo",
    label: "Amarelo",
    colorClass: "bg-amber-400 border-amber-500",
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
      <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-paper-dark/75 border border-moss/15 shadow-2xs">
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
                "size-7 rounded-full transition-all flex items-center justify-center cursor-pointer select-none active:scale-95 border",
                t.colorClass,
                isSelected
                  ? "ring-2 ring-moss ring-offset-2 ring-offset-paper opacity-100"
                  : "opacity-40 hover:opacity-85 border-transparent",
                pending && "opacity-50 cursor-wait",
              )}
            >
              {isSelected && (
                <span
                  className={cn(
                    "size-2 rounded-full",
                    t.id === "amarelo" ? "bg-amber-950" : "bg-white",
                  )}
                />
              )}
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
