"use client";

import { useState, useTransition } from "react";
import { submitVotes } from "@/app/actions";
import { StarRating } from "@/components/star-rating";
import { GloveBadge } from "@/components/ui";

export type Person = { id: string; name: string; isGoalkeeper?: boolean };

function VoteRow({ p, value, onChange }: { p: Person; value: number; onChange: (v: number) => void }) {
  return (
    <li className="p-3 border-b-2 border-moss/20 last:border-b-0 flex flex-col gap-2 bg-paper">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm truncate">{p.name}</span>
          {p.isGoalkeeper && <GloveBadge />}
        </div>
        <span className="font-serif text-lg font-bold text-moss tabular-nums">
          {value ? value.toFixed(1).replace(".", ",") : "–"}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-dashed border-moss/30 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-moss-soft">Nota</span>
        <StarRating value={value} onChange={onChange} label={p.name} />
      </div>
    </li>
  );
}

export function VoteForm({
  token,
  voter,
  targets,
  initial,
}: {
  token: string;
  voter: { id: string; name: string };
  targets: Person[];
  initial: Record<string, number>;
}) {
  const [scores, setScores] = useState<Record<string, number>>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (id: string) => (v: number) => setScores((s) => ({ ...s, [id]: v }));
  const rated = Object.values(scores).filter(Boolean).length;

  const send = () =>
    startTransition(async () => {
      const votes = Object.entries(scores)
        .filter(([, score]) => score > 0)
        .map(([targetId, score]) => ({ targetId, score }));
      const res = await submitVotes(token, voter.id, votes);
      setMessage(
        res.ok
          ? { ok: true, text: `Votação registrada com sucesso! ${res.saved} nota(s) enviada(s).` }
          : { ok: false, text: res.error ?? "Erro ao enviar notas." },
      );
    });

  return (
    <div className="flex flex-col gap-6">
      <section className="border-[3px] border-moss bg-paper shadow-hard">
        <div className="flex items-center justify-between border-b-[3px] border-moss px-4 py-3 bg-paper-dark">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Cédula de Votação</span>
            <h2 className="font-serif text-2xl leading-none">Avaliar Jogadores</h2>
          </div>
          <span className="border-2 border-moss bg-paper px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-moss">
            {voter.name}
          </span>
        </div>

        <p className="px-4 py-2 text-[11px] text-moss-soft bg-paper-dark/50 border-b border-moss/20">
          Dê uma nota de 1 a 5 estrelas para quem você quiser (não é obrigatório avaliar todos).
        </p>

        {targets.length ? (
          <ul>
            {targets.map((p) => (
              <VoteRow key={p.id} p={p} value={scores[p.id] ?? 0} onChange={set(p.id)} />
            ))}
          </ul>
        ) : (
          <p className="p-4 text-xs text-moss-soft">Nenhum jogador para avaliar.</p>
        )}
      </section>

      {message && (
        <div
          role="status"
          className={`border-2 p-3 text-xs font-semibold ${
            message.ok
              ? "border-moss bg-[#E3EADF] text-moss"
              : "border-brick bg-[#F9EED9] text-brick"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Barra de envio fixa inferior */}
      <div className="sticky bottom-4">
        <button
          id="enviar-votos"
          type="button"
          disabled={pending || rated === 0}
          onClick={send}
          className="w-full border-[3px] border-moss bg-moss text-paper py-3.5 px-4 text-xs font-bold uppercase tracking-widest shadow-hard-brick transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Enviando votos…" : `Confirmar e Enviar (${rated} notas)`}
        </button>
      </div>
    </div>
  );
}
