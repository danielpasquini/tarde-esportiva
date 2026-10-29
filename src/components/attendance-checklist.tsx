"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/client";
import { GloveBadge } from "@/components/ui";

export interface AttendancePlayer {
  id: string;
  name: string;
  isGoalkeeper: boolean;
  baseRating: number | null;
}

export function AttendanceChecklist({
  players,
  action,
}: {
  players: AttendancePlayer[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = players.length > 0 && selectedIds.size === players.length;

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(players.map((p) => p.id)));
    }
  };

  const selectAll = () => {
    setSelectedIds(new Set(players.map((p) => p.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <form action={action} className="flex flex-col gap-3">
      {/* Barra de controle: Selecionar tudo / Limpar tudo */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-paper-dark/80 border border-moss/15 rounded-xl p-2.5 text-xs shadow-2xs">
        <label className="flex items-center gap-2 cursor-pointer font-bold uppercase tracking-wider text-moss text-[11px] select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleAll}
            className="size-4 accent-moss rounded"
            aria-label="Selecionar ou desmarcar todos"
          />
          <span>{allSelected ? "Desmarcar Todos" : "Selecionar Tudo"}</span>
        </label>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-moss-soft font-mono font-semibold">
            {selectedIds.size}/{players.length} selecionados
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="border border-moss/20 bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-moss hover:bg-paper-dark rounded-md transition-colors active:scale-95 cursor-pointer shadow-2xs"
          >
            Selecionar Tudo
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={selectedIds.size === 0}
            className="border border-moss/15 bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-moss-soft hover:bg-paper-dark disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors active:scale-95 cursor-pointer shadow-2xs"
          >
            Limpar Tudo
          </button>
        </div>
      </div>

      {/* Lista com scroll */}
      <div className="max-h-56 overflow-y-auto space-y-1 p-2 bg-white/75 border border-moss/15 rounded-xl shadow-2xs divide-y divide-moss/5">
        {players.map((p) => {
          const isChecked = selectedIds.has(p.id);
          return (
            <label
              key={p.id}
              className={`flex items-center gap-2 text-xs p-2 rounded-lg cursor-pointer transition-colors select-none ${
                isChecked ? "bg-moss/8 font-semibold text-moss" : "hover:bg-paper-dark/40 text-moss"
              }`}
            >
              <input
                type="checkbox"
                name="playerId"
                value={p.id}
                checked={isChecked}
                onChange={() => toggle(p.id)}
                className="size-4 accent-moss rounded"
              />
              <span className="truncate">{p.name}</span>
              {p.isGoalkeeper && <GloveBadge />}
              <span className="text-moss-soft ml-auto font-mono text-[11px]">
                {p.baseRating != null ? `★ ${p.baseRating.toFixed(1).replace(".", ",")}` : "–"}
              </span>
            </label>
          );
        })}
      </div>

      <SubmitButton
        className="w-full bg-moss text-paper hover:bg-moss-soft py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl shadow-hard-sm border-transparent"
        disabled={selectedIds.size === 0}
      >
        Confirmar {selectedIds.size > 0 ? `(${selectedIds.size}) ` : ""}Jogadores Selecionados
      </SubmitButton>
    </form>
  );
}
