"use client";

import { useState, useTransition } from "react";
import { submitVotes } from "@/app/actions";
import { StarRating } from "@/components/star-rating";
import { TEAM_META, isTeam } from "@/lib/teams";
import { GloveBadge, TeamDot } from "@/components/ui";

type Person = { id: string; name: string; team: string | null; isGoalkeeper: boolean };

function VoteRow({ p, value, onChange }: { p: Person; value: number; onChange: (v: number) => void }) {
  return (
    <li className="p-3 border-b-2 border-moss/20 last:border-b-0 flex flex-col gap-2 bg-paper">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <TeamDot team={p.team ?? ""} />
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
  teammates,
  others,
  initial,
}: {
  token: string;
  voter: Person;
  teammates: Person[];
  others: Person[];
  initial: Record<string, number>;
}) {
  const [scores, setScores] = useState<Record<string, number>>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (id: string) => (v: number) => setScores((s) => ({ ...s, [id]: v }));
  const rated = Object.values(scores).filter(Boolean).length;
  const meta = isTeam(voter.team) ? TEAM_META[voter.team] : null;

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
      {/* Time do jogador (Etapa 1) */}
      <section className="border-[3px] border-moss bg-paper shadow-hard">
        <div className={`flex items-center justify-between border-b-[3px] border-moss px-4 py-3 ${meta?.swatch} ${meta?.text}`}>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Seu Time</span>
            <h2 className="font-serif text-2xl leading-none">Companheiros de Equipe</h2>
          </div>
          <span className="border-2 border-moss bg-paper px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-moss">
            {meta?.label}
          </span>
        </div>

        <p className="px-4 py-2 text-[11px] text-moss-soft bg-paper-dark border-b border-moss/20">
          Dê notas para quem você quiser (não é obrigatório avaliar todos).
        </p>

        {teammates.length ? (
          <ul>
            {teammates.map((p) => (
              <VoteRow key={p.id} p={p} value={scores[p.id] ?? 0} onChange={set(p.id)} />
            ))}
          </ul>
        ) : (
          <p className="p-4 text-xs text-moss-soft">Nenhum companheiro de time escalado.</p>
        )}
      </section>

      {/* Outras equipes (Etapa 2 - Opcional) */}
      {others.length > 0 && (
        <details className="border-[3px] border-moss bg-paper shadow-hard">
          <summary className="p-4 flex items-center justify-between cursor-pointer bg-paper-dark">
            <div>
              <span className="font-serif text-lg block">Avaliar Jogadores de Outras Equipes</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-moss-soft">
                Opcional ({others.length} jogadores)
              </span>
            </div>
            <span className="font-serif text-xl">+</span>
          </summary>
          <ul className="border-t-[3px] border-moss">
            {others.map((p) => (
              <VoteRow key={p.id} p={p} value={scores[p.id] ?? 0} onChange={set(p.id)} />
            ))}
          </ul>
        </details>
      )}

      {message && (
        <div
          role="status"
          className={`border-2 p-3 text-xs font-semibold ${
            message.ok
              ? "border-moss bg-[#E3EADF] text-moss"
              : "border-brick bg-[#F3DEDA] text-brick"
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
