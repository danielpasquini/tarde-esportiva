"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { setPlayerPin } from "@/app/actions";

export function ProfileSetPin({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setErrorMsg("O PIN deve ter exatamente 4 dígitos numéricos.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await setPlayerPin(playerId, pin);
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      } else {
        setErrorMsg(res.error || "Erro ao salvar PIN.");
      }
    } catch {
      setErrorMsg("Erro de comunicação ao salvar PIN.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="bg-paper-dark border-2 border-moss/40 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-brick shrink-0" />
          <span className="text-xs text-moss">
            Este perfil ainda não tem PIN cadastrado.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="bg-moss text-paper hover:bg-moss-soft px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-hard-sm cursor-pointer shrink-0"
        >
          Proteger com PIN
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-dark border-2 border-moss p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-moss flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-moss" /> Cadastrar PIN de 4 dígitos
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs text-moss-soft hover:text-brick uppercase font-bold"
        >
          Cancelar
        </button>
      </div>
      <p className="text-[11px] text-moss-soft">
        Cadastrando um PIN, somente você poderá votar em seu nome e ver suas notas neste perfil.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="••••"
          autoFocus
          className="w-28 border-2 border-moss bg-paper px-2 py-1 text-center font-mono text-xl tracking-[0.3em] text-moss outline-none"
        />
        <button
          type="submit"
          disabled={loading || pin.length !== 4}
          className="bg-moss text-paper hover:bg-moss-soft px-3 py-1.5 text-xs font-bold uppercase tracking-wider shadow-hard-sm disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Salvando…" : "Salvar PIN"}
        </button>
      </div>
      {errorMsg && <p className="text-xs text-brick font-bold">{errorMsg}</p>}
    </form>
  );
}
