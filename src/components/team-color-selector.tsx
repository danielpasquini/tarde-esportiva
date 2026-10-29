"use client";

import { useTransition } from "react";
import { Check, Hand } from "lucide-react";
import { motion } from "motion/react";
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

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Segmented Pill Container */}
      <div
        role="group"
        aria-label="Selecionar cor do time"
        className="relative inline-flex items-center gap-1 p-1 rounded-full bg-paper-dark/80 border border-moss/15 shadow-2xs backdrop-blur-xs select-none"
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
                "relative size-7 rounded-full transition-transform flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-moss",
                pending && "opacity-50 cursor-wait",
              )}
            >
              {/* Animated highlight sliding capsule */}
              {isSelected && (
                <motion.div
                  layoutId={`activeTeamColor-${attendanceId}`}
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  className="absolute inset-0 rounded-full border-2 border-moss bg-transparent pointer-events-none"
                />
              )}

              {/* Sleek solid color dot */}
              <span
                className={cn(
                  "size-4 rounded-full border transition-all duration-200",
                  t.colorClass,
                  isSelected
                    ? "scale-100 shadow-2xs"
                    : "opacity-45 hover:opacity-85 scale-90",
                )}
              />
            </button>
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
            "h-7 px-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer select-none hover:scale-105 active:scale-95 shadow-2xs",
            isGoalkeeper
              ? "bg-amber-400/25 text-amber-950 border-amber-600/50 font-black shadow-xs ring-2 ring-amber-500/40"
              : "bg-paper-dark/80 text-moss-soft border-moss/15 hover:text-moss hover:bg-paper-dark",
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
