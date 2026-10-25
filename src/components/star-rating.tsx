"use client";

import { Star } from "lucide-react";


/**
 * Avaliação de 1 a 5 estrelas com passos de meia estrela (1.0, 1.5, 2.0, ... 5.0).
 */
export function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const set = (v: number) => {
    onChange(Math.max(1, Math.min(5, Math.round(v * 2) / 2)));
  };

  return (
    <div
      className="flex items-center gap-1 select-none"
      role="slider"
      tabIndex={0}
      aria-label={`Nota de ${label}`}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={value || undefined}
      aria-valuetext={value ? `${value} estrelas` : "sem nota"}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") set((value || 0.5) + 0.5);
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") set((value || 1) - 0.5);
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fillAmount = Math.min(1, Math.max(0, value - (i - 1)));
        return (
          <div key={i} className="relative size-8">
            {/* Base vazia */}
            <Star className="size-8 stroke-[2] text-moss/30" aria-hidden="true" />

            {/* Preenchimento (total ou 50%) */}
            {fillAmount > 0 && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillAmount * 100}%` }}
              >
                <Star className="size-8 stroke-[2] text-brick fill-brick" aria-hidden="true" />
              </div>
            )}

            {/* Clique na metade esquerda (meia estrela) */}
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-y-0 left-0 w-1/2 z-10 cursor-pointer"
              aria-label={`${i - 0.5} estrelas`}
              onClick={() => set(i - 0.5)}
            />

            {/* Clique na metade direita (estrela cheia) */}
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-y-0 right-0 w-1/2 z-10 cursor-pointer"
              aria-label={`${i} estrelas`}
              onClick={() => set(i)}
            />
          </div>
        );
      })}
    </div>
  );
}
