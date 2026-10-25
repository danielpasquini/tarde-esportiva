export const TEAM_ORDER = ["AZUL", "VERMELHO", "PRETO", "AMARELO"] as const;
export type TeamKey = (typeof TEAM_ORDER)[number];

export const TEAM_META: Record<TeamKey, { label: string; color: string; ink: string }> = {
  AZUL: { label: "Azul", color: "#2B4C7E", ink: "#F4F1EA" },
  VERMELHO: { label: "Vermelho", color: "#9E2A2B", ink: "#F4F1EA" },
  PRETO: { label: "Preto", color: "#1F1F1F", ink: "#F4F1EA" },
  AMARELO: { label: "Amarelo", color: "#D9A520", ink: "#1F1F1F" },
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
