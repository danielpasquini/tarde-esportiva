"use client";

import { useState } from "react";
import { Globe, Lock, Check } from "lucide-react";
import { togglePlayerPublic } from "@/app/actions";

export function ProfilePublicToggle({
  playerId,
  initialIsPublic,
}: {
  playerId: string;
  initialIsPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const res = await togglePlayerPublic(playerId);
      if (res.ok && res.isPublic !== undefined) {
        setIsPublic(res.isPublic);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-paper-dark border border-moss/30 p-2.5 rounded">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isPublic ? (
            <Globe className="size-4 text-moss shrink-0" />
          ) : (
            <Lock className="size-4 text-brick shrink-0" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-moss">
            Visibilidade: {isPublic ? "Público" : "Privado (PIN)"}
          </span>
        </div>
        <p className="text-[11px] text-moss-soft mt-0.5">
          {isPublic
            ? "Qualquer pessoa no Histórico pode ver suas estatísticas."
            : "Apenas você com seu PIN (e o organizador) podem ver suas notas."}
        </p>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className="shrink-0 border-2 border-moss bg-paper hover:bg-paper-dark text-moss px-3 py-1.5 text-xs font-bold uppercase tracking-wider shadow-hard-sm cursor-pointer disabled:opacity-50 transition-colors"
      >
        {loading ? "Salvando…" : isPublic ? "Tornar Privado" : "Tornar Público"}
      </button>

      {saved && (
        <span className="text-xs font-bold text-moss flex items-center gap-1">
          <Check className="size-3.5" /> Salvo!
        </span>
      )}
    </div>
  );
}
