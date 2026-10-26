"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Shield, ShieldCheck, Lock, X } from "lucide-react";
import { setPlayerPin, verifyPlayerPin } from "@/app/actions";

export type VoterPerson = {
  id: string;
  name: string;
  hasVoted: boolean;
  hasPin: boolean;
};

export function VoterSelector({
  token,
  people,
}: {
  token: string;
  people: VoterPerson[];
}) {
  const router = useRouter();
  const [selectedPerson, setSelectedPerson] = useState<VoterPerson | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSelect = (p: VoterPerson) => {
    if (p.hasVoted) return;
    setErrorMsg("");
    setPinInput("");
    setSelectedPerson(p);
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;
    if (pinInput.trim().length !== 4) {
      setErrorMsg("O PIN deve ter exatamente 4 dígitos.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await verifyPlayerPin(selectedPerson.id, pinInput.trim());
      if (res.ok) {
        router.push(`/votar/${token}?jogador=${selectedPerson.id}`);
      } else {
        setErrorMsg(res.error || "PIN incorreto.");
      }
    } catch {
      setErrorMsg("Erro ao validar PIN. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;
    if (pinInput.trim().length !== 4) {
      setErrorMsg("O PIN deve ter exatamente 4 dígitos.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await setPlayerPin(selectedPerson.id, pinInput.trim());
      if (res.ok) {
        router.push(`/votar/${token}?jogador=${selectedPerson.id}`);
      } else {
        setErrorMsg(res.error || "Erro ao salvar PIN.");
      }
    } catch {
      setErrorMsg("Erro ao salvar PIN. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPin = () => {
    if (!selectedPerson) return;
    router.push(`/votar/${token}?jogador=${selectedPerson.id}`);
  };

  return (
    <>
      <ul className="border-[3px] border-moss bg-paper shadow-hard divide-y-2 divide-dashed divide-moss/30">
        {people.map((p) => {
          if (p.hasVoted) {
            return (
              <li key={p.id} className="opacity-45 bg-paper-dark/60 cursor-not-allowed">
                <div className="flex w-full items-center gap-3 px-4 py-3.5 text-left select-none">
                  <span className="flex-1 font-serif text-lg leading-tight line-through text-moss-soft">
                    {p.name}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-moss-soft bg-paper px-2 py-0.5 border border-moss/20">
                    ✓ Já Votou
                  </span>
                </div>
              </li>
            );
          }

          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => handleSelect(p)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper-dark group cursor-pointer"
                id={`eu-sou-${p.id}`}
              >
                <span className="flex-1 font-serif text-lg leading-tight text-moss group-hover:text-brick transition-colors">
                  {p.name}
                </span>

                {p.hasPin && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-bold uppercase text-moss-soft bg-moss/10 px-1.5 py-0.5 rounded"
                    title="Protegido por PIN"
                  >
                    <Lock className="size-3 text-moss" />
                    PIN
                  </span>
                )}

                <ChevronRight className="size-4 text-moss-soft group-hover:translate-x-0.5 transition-transform" />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Modal de PIN */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setSelectedPerson(null)}
              className="absolute top-3 right-3 text-moss-soft hover:text-brick text-sm p-1"
              title="Fechar"
            >
              <X className="size-5" />
            </button>

            {selectedPerson.hasPin ? (
              /* Modal: Jogador já tem PIN -> Digitar PIN para liberar voto */
              <form onSubmit={handleVerifyPin} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b-2 border-moss/20 pb-2">
                  <ShieldCheck className="size-5 text-moss shrink-0" />
                  <div>
                    <h3 className="font-serif text-lg leading-tight">Digite seu PIN</h3>
                    <p className="text-xs text-moss-soft">
                      {selectedPerson.name} está protegido por PIN.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="verify-pin-input" className="text-xs font-bold uppercase tracking-wider text-moss">
                    PIN de 4 Números
                  </label>
                  <input
                    id="verify-pin-input"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoComplete="one-time-code"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    autoFocus
                    className="border-2 border-moss bg-paper px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] text-moss outline-none"
                  />
                  {errorMsg && (
                    <p className="text-xs font-bold text-brick bg-brick/10 p-2 border border-brick/30 rounded">
                      {errorMsg}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={loading || pinInput.length !== 4}
                    className="w-full bg-moss text-paper hover:bg-moss-soft py-2.5 text-xs font-bold uppercase tracking-wider shadow-hard-sm disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Validando…" : "Confirmar PIN e Votar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPerson(null)}
                    className="w-full bg-paper hover:bg-paper-dark text-moss-soft border border-moss/30 py-1.5 text-xs font-bold uppercase tracking-wider shadow-none cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>

                <p className="text-[11px] text-moss-soft text-center mt-1">
                  Esqueceu seu PIN? Peça para o <strong>organizador</strong> resetar para você.
                </p>
              </form>
            ) : (
              /* Modal: Jogador ainda NÃO tem PIN -> Opcional criar PIN ou continuar sem */
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b-2 border-moss/20 pb-2">
                  <Shield className="size-5 text-brick shrink-0" />
                  <div>
                    <h3 className="font-serif text-lg leading-tight">Proteger seu Voto com PIN?</h3>
                    <p className="text-xs text-moss-soft">Olá, {selectedPerson.name}!</p>
                  </div>
                </div>

                <p className="text-xs text-moss-soft">
                  Você pode cadastrar um <strong>PIN de 4 dígitos</strong> agora. Com ele, somente você poderá votar no seu nome e terá acesso exclusivo ao seu <strong>Perfil Privado</strong> com suas estatísticas e notas.
                </p>

                <form onSubmit={handleCreatePin} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="create-pin-input" className="text-xs font-bold uppercase tracking-wider text-moss">
                      Criar PIN (4 dígitos)
                    </label>
                    <input
                      id="create-pin-input"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      autoComplete="one-time-code"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••"
                      autoFocus
                      className="border-2 border-moss bg-paper px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] text-moss outline-none"
                    />
                    {errorMsg && (
                      <p className="text-xs font-bold text-brick bg-brick/10 p-2 border border-brick/30 rounded">
                        {errorMsg}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={loading || pinInput.length !== 4}
                      className="w-full bg-moss text-paper hover:bg-moss-soft py-2.5 text-xs font-bold uppercase tracking-wider shadow-hard-sm disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? "Cadastrando…" : "Cadastrar PIN e Abrir Cédula"}
                    </button>

                    <button
                      type="button"
                      onClick={handleSkipPin}
                      className="w-full bg-paper hover:bg-paper-dark text-moss border border-moss/40 py-2 text-xs font-bold uppercase tracking-wider shadow-none cursor-pointer"
                    >
                      Votar sem PIN por enquanto
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
