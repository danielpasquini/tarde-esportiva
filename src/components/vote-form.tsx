"use client";

import { useState, useTransition } from "react";
import { submitVotes } from "@/app/actions";
import { StarRating } from "@/components/star-rating";
import { GloveBadge, TeamColorBadge } from "@/components/ui";
import SpotlightCard from "@/components/SpotlightCard";
import ShinyText from "@/components/ShinyText";
import { ChevronDown, Users } from "lucide-react";

export type Person = { id: string; name: string; team?: string | null; isGoalkeeper?: boolean };

function VoteRow({ p, value, onChange }: { p: Person; value: number; onChange: (v: number) => void }) {
  return (
    <li className="p-3.5 border-b border-moss/10 last:border-b-0 flex flex-col gap-2 bg-white/65 hover:bg-white transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <TeamColorBadge team={p.team} />
          <span className="font-bold text-sm truncate text-moss">{p.name}</span>
          {p.isGoalkeeper && <GloveBadge />}
        </div>
        <span
          className={`inline-flex items-center justify-center min-w-11 px-2.5 py-0.5 rounded-md font-mono text-sm font-extrabold tabular-nums border ${
            value > 0
              ? "bg-moss text-paper border-moss"
              : "bg-paper-dark/80 text-moss-soft border-moss/15"
          }`}
        >
          {value ? `★ ${value.toFixed(1).replace(".", ",")}` : "–"}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-dashed border-moss/15 pt-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-moss-soft">Nota</span>
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
  voter: { id: string; name: string; team?: string | null };
  targets: Person[];
  initial: Record<string, number>;
}) {
  const [scores, setScores] = useState<Record<string, number>>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (id: string) => (v: number) => setScores((s) => ({ ...s, [id]: v }));
  const rated = Object.values(scores).filter(Boolean).length;

  // Separar goleiros dos jogadores de linha
  const goalkeepers = targets.filter((p) => p.isGoalkeeper);
  const fieldPlayers = targets.filter((p) => !p.isGoalkeeper);

  // Se o votante tiver time definido, separar companheiros do mesmo time e os demais
  const hasVoterTeam = Boolean(voter.team);
  const teammates = hasVoterTeam
    ? fieldPlayers.filter((p) => p.team && p.team === voter.team)
    : fieldPlayers;
  const others = hasVoterTeam
    ? fieldPlayers.filter((p) => !p.team || p.team !== voter.team)
    : [];

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
    <div className="flex flex-col gap-5">
      <SpotlightCard className="border border-moss/15 bg-paper rounded-2xl shadow-hard overflow-hidden">
        <div className="flex items-center justify-between border-b border-moss/10 px-4 py-3.5 bg-paper-dark/65">
          <div>
            <span className="hud-tag bg-moss text-paper border-transparent mb-1">
              <ShinyText text="Cédula de Votação" color="#f6f4ef" shineColor="#d9a520" speed={2.2} />
            </span>
            <h2 className="font-serif text-2xl leading-none text-moss">Avaliar Jogadores</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <TeamColorBadge team={voter.team} showLabel />
            <span className="rounded-md border border-moss/20 bg-white/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-moss">
              {voter.name}
            </span>
          </div>
        </div>

        <p className="px-4 py-2 text-[11px] text-moss-soft bg-paper-dark/35 border-b border-moss/10">
          {hasVoterTeam
            ? "Avalie os companheiros do seu time. Se desejar, abra a seção abaixo para avaliar jogadores de outras equipes."
            : "Dê uma nota de 1 a 5 estrelas para quem você quiser (não é obrigatório avaliar todos)."}
        </p>

        {/* Companheiros do mesmo time (ou todos caso o votante não tenha time) */}
        {teammates.length ? (
          <div>
            {hasVoterTeam && (
              <div className="px-4 py-2 bg-moss/8 border-b border-moss/10 flex items-center gap-1.5 text-xs font-bold text-moss">
                <Users className="size-3.5 text-brick" />
                <span>Seus Companheiros de Equipe ({teammates.length})</span>
              </div>
            )}
            <ul>
              {teammates.map((p) => (
                <VoteRow key={p.id} p={p} value={scores[p.id] ?? 0} onChange={set(p.id)} />
              ))}
            </ul>
          </div>
        ) : (
          <p className="p-4 text-xs text-moss-soft">
            {hasVoterTeam ? "Nenhum companheiro encontrado para seu time." : "Nenhum jogador para avaliar."}
          </p>
        )}

        {/* Dropdown opcional para votar em todos os outros jogadores */}
        {hasVoterTeam && others.length > 0 && (
          <details className="group border-t border-moss/15 bg-paper-dark/40">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none text-xs font-extrabold uppercase tracking-wider text-moss hover:bg-paper-dark/70 transition-colors">
              <span className="flex items-center gap-2">
                <span>Votar nos outros jogadores ({others.length})</span>
                <span className="text-[10px] font-bold text-moss-soft lowercase">(opcional)</span>
              </span>
              <ChevronDown className="size-4 text-moss transition-transform group-open:rotate-180" />
            </summary>
            <ul className="border-t border-moss/10">
              {others.map((p) => (
                <VoteRow key={p.id} p={p} value={scores[p.id] ?? 0} onChange={set(p.id)} />
              ))}
            </ul>
          </details>
        )}
      </SpotlightCard>

      {/* Tabela de Goleiros abaixo separada do dropdown */}
      {goalkeepers.length > 0 && (
        <SpotlightCard className="border border-moss/15 bg-paper rounded-2xl shadow-hard overflow-hidden">
          <div className="px-4 py-3 bg-moss/8 border-b border-moss/10 flex items-center justify-between text-xs font-bold text-moss">
            <div className="flex items-center gap-2">
              <GloveBadge />
              <span className="font-serif text-lg leading-none tracking-wide text-moss">
                Goleiros ({goalkeepers.length})
              </span>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-moss-soft">
              (opcional)
            </span>
          </div>
          <ul>
            {goalkeepers.map((p) => (
              <VoteRow key={p.id} p={p} value={scores[p.id] ?? 0} onChange={set(p.id)} />
            ))}
          </ul>
        </SpotlightCard>
      )}

      {message && (
        <div
          role="status"
          className={`rounded-xl border p-3.5 text-xs font-semibold ${
            message.ok
              ? "border-moss/30 bg-[#E3EADF] text-moss"
              : "border-brick/40 bg-[#F9EED9] text-brick"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Barra de envio fixa inferior */}
      <div className="sticky bottom-4 z-10">
        <button
          id="enviar-votos"
          type="button"
          disabled={pending || rated === 0}
          onClick={send}
          className="w-full rounded-xl bg-moss hover:bg-moss-soft text-paper py-3.5 px-4 text-xs font-extrabold uppercase tracking-widest shadow-hard-brick transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {pending ? "Enviando votos…" : `Confirmar e Enviar (${rated} notas)`}
        </button>
      </div>
    </div>
  );
}
