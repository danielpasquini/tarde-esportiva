"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { verifyPlayerPin } from "@/app/actions";

export function ProfilePinGate({
  playerId,
  playerName,
}: {
  playerId: string;
  playerName: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setErrorMsg("O PIN deve conter exatamente 4 dígitos.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await verifyPlayerPin(playerId, pin);
      if (res.ok) {
        router.refresh();
      } else {
        setErrorMsg(res.error || "PIN incorreto.");
      }
    } catch {
      setErrorMsg("Erro ao validar PIN. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto border-[3px] border-moss bg-paper p-6 shadow-hard flex flex-col gap-4">
      <div className="flex items-center gap-3 border-b-2 border-moss/20 pb-3">
        <div className="size-10 rounded-full bg-moss/10 flex items-center justify-center shrink-0">
          <Lock className="size-5 text-moss" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">
            Perfil Privado
          </span>
          <h2 className="font-serif text-2xl leading-tight">{playerName}</h2>
        </div>
      </div>

      <p className="text-xs text-moss-soft">
        Este perfil está protegido. Digite seu <strong>PIN de 4 dígitos</strong> para acessar suas estatísticas individuais, notas e histórico de classificações.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-pin-input" className="text-xs font-bold uppercase tracking-wider text-moss">
            PIN de 4 Números
          </label>
          <input
            id="profile-pin-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            autoFocus
            className="border-2 border-moss bg-paper px-3 py-2.5 text-center font-mono text-3xl tracking-[0.4em] text-moss outline-none"
          />
          {errorMsg && (
            <p className="text-xs font-bold text-brick bg-brick/10 p-2 border border-brick/30 rounded">
              {errorMsg}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || pin.length !== 4}
          className="w-full bg-moss text-paper hover:bg-moss-soft py-3 text-xs font-bold uppercase tracking-wider shadow-hard-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-1"
        >
          <ShieldCheck className="size-4" />
          {loading ? "Validando…" : "Desbloquear Perfil"}
        </button>
      </form>

      <div className="border-t border-moss/20 pt-3 text-center">
        <p className="text-[11px] text-moss-soft">
          Esqueceu seu PIN ou cadastraram por engano?
        </p>
        <p className="text-[11px] font-semibold text-moss">
          Solicite ao <strong>organizador</strong> para resetar seu PIN.
        </p>
      </div>
    </div>
  );
}
