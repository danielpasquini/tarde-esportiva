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
    colorClass: "bg-yellow-400 border-yellow-500",
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

  const hasSelection = Boolean(currentTeam);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Container segmentado de cores */}
      <div
        role="group"
        aria-label="Selecionar cor do time"
        className="inline-flex items-center gap-1.5 p-1 rounded-full bg-paper-dark/70 border border-moss/15 shadow-2xs select-none"
      >
        {TEAMS.map((t) => {
          const isSelected = currentTeam === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled || pending}
              onClick={() => handleSelectTeam(t.id)}
              aria-pressed={isSelected}
              title={`Time ${t.label}${isSelected ? " (Selecionado - clique para remover)" : ""}`}
              className={cn(
                "relative size-6 rounded-full transition-all duration-150 flex items-center justify-center cursor-pointer border select-none active:scale-95 focus:outline-none",
                t.colorClass,
                isSelected
                  ? "ring-1.5 ring-black ring-offset-2 ring-offset-paper opacity-100 scale-105"
                  : hasSelection
                  ? "opacity-25 hover:opacity-50"
                  : "opacity-85 hover:opacity-100",
                pending && "opacity-40 cursor-wait",
              )}
            />
          );
        })}
      </div>

      {/* Botão de Goleiro Fixo [GL] */}
      {playerId && (
        <button
          type="button"
          disabled={disabled || pending}
          onClick={handleToggleGk}
          title={isGoalkeeper ? "Goleiro fixo (clique para remover)" : "Definir como Goleiro Fixo"}
          className={cn(
            "h-6 px-2 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1 border cursor-pointer select-none active:scale-95 shadow-2xs",
            isGoalkeeper
              ? "bg-amber-400/25 text-amber-950 border-black font-black ring-1.5 ring-black ring-offset-1 ring-offset-paper"
              : "bg-paper-dark/70 text-moss-soft border-moss/15 hover:text-moss hover:bg-paper-dark",
            pending && "opacity-40 cursor-wait",
          )}
        >
          <Hand className="size-3 text-amber-800 shrink-0 fill-amber-500/40" strokeWidth={2.4} />
          <span>GL</span>
          {isGoalkeeper && <Check className="size-2.5 shrink-0 text-amber-900 stroke-[3]" />}
        </button>
      )}
    </div>
  );
}
