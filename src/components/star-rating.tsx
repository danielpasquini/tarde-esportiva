"use client";

import { useState } from "react";

const STAR_PATH =
  "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z";

function Star({ fill }: { fill: number }) {
  return (
    <span className="star">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d={STAR_PATH} fill="#F4F1EA" stroke="#1F1F1F" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span className="star-fill" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d={STAR_PATH} fill="#C5A880" stroke="#1F1F1F" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
}

/** Nota de 1 a 5 em meias estrelas. value = 0 significa "sem nota". */
export function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [bump, setBump] = useState(0);
  const set = (v: number) => {
    onChange(Math.max(1, v));
    setBump((b) => b + 1);
  };
  return (
    <div
      className="stars"
      role="slider"
      tabIndex={0}
      aria-label={`Nota de ${label}`}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={value || undefined}
      aria-valuetext={value ? `${value} estrelas` : "sem nota"}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") set(Math.min(5, (value || 0.5) + 0.5));
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(Math.max(1, value - 0.5));
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative">
          {bump && Math.ceil(value) === i ? (
            <span key={bump} className="pop inline-block">
              <Star fill={Math.min(1, Math.max(0, value - (i - 1)))} />
            </span>
          ) : (
            <Star fill={Math.min(1, Math.max(0, value - (i - 1)))} />
          )}
          <button type="button" tabIndex={-1} className="star-hit left-0" aria-label={`${i - 0.5} estrelas`} onClick={() => set(i - 0.5)} />
          <button type="button" tabIndex={-1} className="star-hit right-0" aria-label={`${i} estrelas`} onClick={() => set(i)} />
        </span>
      ))}
    </div>
  );
}
