export const TEAM_ORDER = ["AZUL", "VERMELHO", "PRETO", "AMARELO"] as const;
export type TeamKey = (typeof TEAM_ORDER)[number];

export const TEAM_META: Record<
  TeamKey,
  { label: string; swatch: string; text: string; hex: string }
> = {
  AZUL: { label: "Azul", swatch: "bg-[#2c4a6e]", text: "text-paper", hex: "#2c4a6e" },
  VERMELHO: { label: "Vermelho", swatch: "bg-[#9e2a2b]", text: "text-paper", hex: "#9e2a2b" },
  PRETO: { label: "Preto", swatch: "bg-[#1f1f1f]", text: "text-paper", hex: "#1f1f1f" },
  AMARELO: { label: "Amarelo", swatch: "bg-[#d9a520]", text: "text-moss", hex: "#d9a520" },
};

export function teamsFor(numTeams: number): TeamKey[] {
  return TEAM_ORDER.slice(0, Math.min(Math.max(numTeams, 2), 4));
}

export function isTeam(value: unknown): value is TeamKey {
  return typeof value === "string" && (TEAM_ORDER as readonly string[]).includes(value);
}

export function teamLabel(team: string | null | undefined) {
  return isTeam(team) ? TEAM_META[team].label : "Reserva";
}
