"use client";

import { useState, useTransition } from "react";
import { submitVotes } from "@/app/actions";
import { StarRating } from "@/components/star-rating";
import { TEAM_META, isTeam } from "@/lib/teams";

type Person = { id: string; name: string; team: string | null; isGoalkeeper: boolean };

function Row({ p, value, onChange }: { p: Person; value: number; onChange: (v: number) => void }) {
  const meta = isTeam(p.team) ? TEAM_META[p.team] : null;
  return (
    <li className="roster-row flex-wrap justify-between">
      <span className="flex items-center gap-2 min-w-0">
        <span className="team-dot" style={{ background: meta?.color }} aria-hidden />
        <span className="font-semibold truncate">{p.name}</span>
        {p.isGoalkeeper && <span className="tag tag-gk">GK</span>}
      </span>
      <span className="flex items-center gap-2">
        <StarRating value={value} onChange={onChange} label={p.name} />
        <span className="mono text-sm w-7 text-right">{value ? value.toString().replace(".", ",") : "–"}</span>
      </span>
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
          ? { ok: true, text: `Súmula entregue! ${res.saved} nota(s) registrada(s). Pode alterar até a votação fechar.` }
          : { ok: false, text: res.error ?? "Não foi possível enviar." },
      );
    });

  return (
    <div className="space-y-5">
      <section className="team-card rise">
        <div className="team-band" style={{ background: meta?.color, color: meta?.ink }}>
          <span className="display text-lg">Seu time · {meta?.label}</span>
          <span className="mono text-xs">Etapa 1</span>
        </div>
        {teammates.length ? (
          <ul>
            {teammates.map((p) => (
              <Row key={p.id} p={p} value={scores[p.id] ?? 0} onChange={set(p.id)} />
            ))}
          </ul>
        ) : (
          <p className="kicker p-4">Nenhum companheiro escalado.</p>
        )}
      </section>

      {others.length > 0 && (
        <details className="card rise">
          <summary className="card-pad flex items-center justify-between gap-2" id="toggle-outras-equipes">
            <span className="font-semibold">+ Avaliar jogadores de outras equipes</span>
            <span className="kicker">Opcional</span>
          </summary>
          <ul className="border-t-2 border-ink">
            {others.map((p) => (
              <Row key={p.id} p={p} value={scores[p.id] ?? 0} onChange={set(p.id)} />
            ))}
          </ul>
        </details>
      )}

      {message && (
        <p
          role="status"
          className="card card-pad text-sm"
          style={{ background: message.ok ? "#E3EADF" : "#F3DEDA", color: message.ok ? "#1A2E22" : "#9E2A2B" }}
        >
          {message.text}
        </p>
      )}

      <div className="sticky bottom-3">
        <button id="enviar-votos" type="button" className="btn btn-moss btn-block" disabled={pending || rated === 0} onClick={send}>
          {pending ? "Entregando súmula…" : `Enviar ${rated} nota${rated === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
