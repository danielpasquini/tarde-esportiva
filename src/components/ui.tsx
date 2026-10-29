import { Hand, Radio } from "lucide-react";
import type { MedalCounts } from "@/lib/rating";
import { cn } from "@/lib/utils";
import ShinyText from "@/components/ShinyText";
import ScrollVelocity from "@/components/ScrollVelocity";

export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Aberta", cls: "stamp-open" },
  FINISHED: { label: "Encerrada", cls: "stamp-done" },
};

export const TEAM_COLORS: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string; glow: string }
> = {
  azul: {
    label: "Azul",
    bg: "bg-blue-600/12",
    text: "text-blue-900",
    border: "border-blue-600/35",
    dot: "bg-blue-600",
    glow: "shadow-[0_0_8px_rgba(37,99,235,0.4)]",
  },
  vermelho: {
    label: "Vermelho",
    bg: "bg-red-600/12",
    text: "text-red-900",
    border: "border-red-600/35",
    dot: "bg-red-600",
    glow: "shadow-[0_0_8px_rgba(220,38,38,0.4)]",
  },
  preto: {
    label: "Preto",
    bg: "bg-neutral-900/10",
    text: "text-neutral-950",
    border: "border-neutral-900/40",
    dot: "bg-neutral-900",
    glow: "shadow-[0_0_8px_rgba(23,23,23,0.35)]",
  },
  amarelo: {
    label: "Amarelo",
    bg: "bg-amber-300/25",
    text: "text-amber-950",
    border: "border-amber-400/60",
    dot: "bg-amber-400",
    glow: "shadow-[0_0_8px_rgba(251,191,36,0.55)]",
  },
};

export function TeamColorBadge({
  team,
  showLabel = false,
  className,
}: {
  team?: string | null;
  showLabel?: boolean;
  className?: string;
}) {
  if (!team) return null;
  const normalized = team.toLowerCase().trim();
  const config = TEAM_COLORS[normalized];
  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shrink-0 border select-none leading-none align-middle backdrop-blur-xs transition-all",
        config.bg,
        config.text,
        config.border,
        className,
      )}
      title={`Time ${config.label}`}
    >
      <span className={cn("size-2 rounded-full shrink-0", config.dot, config.glow)} />
      {showLabel ? (
        <span>{config.label}</span>
      ) : (
        <span className="font-mono text-[9px] opacity-75">{config.label.slice(0, 3)}</span>
      )}
    </span>
  );
}

export function GloveBadge({ className }: { className?: string; showLabel?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 bg-amber-500/15 text-amber-950 border border-amber-700/30 px-1.5 py-0.5 rounded-sm text-[10px] font-extrabold tracking-wider uppercase shrink-0 leading-none select-none align-middle",
        className,
      )}
      title="Goleiro"
    >
      <Hand className="size-3 text-amber-800 shrink-0 fill-amber-500/30" strokeWidth={2.2} aria-hidden="true" />
      <span className="translate-y-[0.5px]">GL</span>
    </span>
  );
}

export function PlayerMedals({
  medals,
  className,
}: {
  medals?: MedalCounts;
  className?: string;
}) {
  if (!medals || (medals.gold === 0 && medals.silver === 0 && medals.bronze === 0)) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-bold tabular-nums shrink-0 select-none leading-none",
        className,
      )}
      title={`Medalhas: ${medals.gold} ouro, ${medals.silver} prata, ${medals.bronze} bronze`}
    >
      {medals.gold > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-amber-400/20 text-amber-950 border border-amber-600/35 px-1.5 py-0.5 rounded-sm">
          <span>🥇</span>
          <span className="font-mono">{medals.gold}</span>
        </span>
      )}
      {medals.silver > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-slate-200/80 text-slate-800 border border-slate-400/45 px-1.5 py-0.5 rounded-sm">
          <span>🥈</span>
          <span className="font-mono">{medals.silver}</span>
        </span>
      )}
      {medals.bronze > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-amber-700/12 text-amber-900 border border-amber-700/30 px-1.5 py-0.5 rounded-sm">
          <span>🥉</span>
          <span className="font-mono">{medals.bronze}</span>
        </span>
      )}
    </span>
  );
}

export function StatusStamp({ status, votingOpen }: { status: string; votingOpen?: boolean }) {
  if (votingOpen) {
    return (
      <span className="stamp stamp-drawn inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0">
        <span className="size-1.5 rounded-full bg-team-azul animate-pulse" aria-hidden="true" />
        <ShinyText
          text="Votação aberta"
          color="#2c4a6e"
          shineColor="#d9a520"
          speed={2}
          className="font-extrabold"
        />
      </span>
    );
  }
  const s = STATUS_LABEL[status] ?? STATUS_LABEL.OPEN;
  if (status === "OPEN") {
    return (
      <span className={`stamp ${s.cls} inline-flex items-center gap-1.5 whitespace-nowrap shrink-0`}>
        <span className="size-1.5 rounded-full bg-moss animate-pulse" aria-hidden="true" />
        <ShinyText
          text={s.label}
          color="#16281e"
          shineColor="#b47a16"
          speed={2.4}
          className="font-extrabold"
        />
      </span>
    );
  }
  return (
    <span className={`stamp ${s.cls} whitespace-nowrap shrink-0`}>
      <span>{s.label}</span>
    </span>
  );
}

export function BroadcastTicker({
  items = ["TARDE ESPORTIVA", "MATCH DAY HUB", "SÚMULA OFICIAL", "NOTAS PÓS-JOGO", "CLASSIFICAÇÃO GERAL"],
  className,
}: {
  items?: string[];
  className?: string;
}) {
  const line = items.join("  •  ") + "  •  ";
  return (
    <div
      className={cn(
        "border-y border-moss/15 bg-moss text-paper py-1.5 overflow-hidden select-none",
        className,
      )}
      aria-hidden="true"
    >
      <ScrollVelocity
        texts={[line]}
        velocity={28}
        numCopies={4}
        fontSize="10px"
        fontWeight={800}
        scrollerClassName="uppercase tracking-[0.22em] text-paper/90 items-center"
      />
    </div>
  );
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="border border-moss/15 bg-paper p-6 rounded-xl text-center shadow-hard fut-grid-bg" role="status">
      <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-moss">
        <Radio className="size-3.5 text-brick animate-pulse" />
        <ShinyText text={label} color="#16281e" shineColor="#b47a16" speed={1.6} />
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-moss/20 bg-paper-dark/35 py-7 px-4 rounded-xl text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-moss-soft">{children}</p>
    </div>
  );
}
