"use client";

import { useTransition } from "react";
import { Check, Hand } from "lucide-react";
import { setAttendanceTeam, setAttendanceGoalkeeper } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const TEAMS = [
  {
    id: "azul",
    label: "Azul",
    colorClass: "bg-sky-500/80 border-sky-600/40",
  },
  {
    id: "vermelho",
    label: "Vermelho",
    colorClass: "bg-rose-500/80 border-rose-600/40",
  },
  {
    id: "preto",
    label: "Preto",
    colorClass: "bg-neutral-800/85 border-neutral-900/40",
  },
  {
    id: "amarelo",
    label: "Amarelo",
    colorClass: "bg-yellow-400 border-yellow-500/50",
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
      {/* Container segmentado de cores com espaçamento confortável contra missclick */}
      <div
        role="group"
        aria-label="Selecionar cor do time"
        className="inline-flex items-center gap-3 p-1.5 px-2.5 rounded-full bg-paper-dark/65 border border-moss/12 shadow-2xs select-none"
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
                "relative size-6 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer border select-none active:scale-90 focus:outline-none",
                t.colorClass,
                isSelected
                  ? "scale-115 opacity-100 shadow-xs"
                  : hasSelection
                  ? "opacity-25 hover:opacity-50 scale-95"
                  : "opacity-80 hover:opacity-100",
                pending && "opacity-40 cursor-wait",
              )}
            >
              {isSelected && (
                <span className="size-1.5 rounded-full bg-white/95 shadow-2xs pointer-events-none" />
              )}
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
            "h-6 px-2 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1 border cursor-pointer select-none active:scale-95 shadow-2xs",
            isGoalkeeper
              ? "bg-amber-400/20 text-amber-950 border-amber-600/40 font-black"
              : "bg-paper-dark/60 text-moss-soft border-moss/10 hover:text-moss hover:bg-paper-dark/80",
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
