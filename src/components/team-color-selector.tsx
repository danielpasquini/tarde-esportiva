"use client";

import { useTransition } from "react";
import { setAttendanceTeam } from "@/app/admin/actions";
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
  currentTeam,
  disabled = false,
}: {
  matchId: string;
  attendanceId: string;
  currentTeam?: string | null;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const handleSelect = (teamId: string | null) => {
    if (disabled || pending) return;
    const next = currentTeam === teamId ? null : teamId;
    startTransition(async () => {
      await setAttendanceTeam(matchId, attendanceId, next);
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
            onClick={() => handleSelect(t.id)}
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
    </div>
  );
}
