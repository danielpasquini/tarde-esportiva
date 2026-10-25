export const TEAM_ORDER = ["AZUL", "VERMELHO", "PRETO", "AMARELO"] as const;
export type TeamKey = (typeof TEAM_ORDER)[number];

export const TEAM_META: Record<
  TeamKey,
  { label: string; swatch: string; text: string; hex: string; border: string; bgLight: string }
> = {
  AZUL: {
    label: "Azul",
    swatch: "bg-blue-600 text-white",
    text: "text-white",
    hex: "#2563eb",
    border: "border-blue-700",
    bgLight: "bg-blue-50 text-blue-950",
  },
  VERMELHO: {
    label: "Vermelho",
    swatch: "bg-red-600 text-white",
    text: "text-white",
    hex: "#dc2626",
    border: "border-red-700",
    bgLight: "bg-red-50 text-red-950",
  },
  PRETO: {
    label: "Preto",
    swatch: "bg-neutral-900 text-white",
    text: "text-white",
    hex: "#171717",
    border: "border-black",
    bgLight: "bg-neutral-100 text-neutral-950",
  },
  AMARELO: {
    label: "Amarelo",
    swatch: "bg-amber-400 text-neutral-950",
    text: "text-neutral-950",
    hex: "#facc15",
    border: "border-amber-500",
    bgLight: "bg-amber-50 text-amber-950",
  },
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
