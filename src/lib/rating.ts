export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

/** Normaliza para a escala 1–5 em passos de meia estrela. */
export function normalizeScore(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 2) / 2;
  if (rounded < MIN_SCORE || rounded > MAX_SCORE) return null;
  return rounded;
}

/**
 * Média ponderada com o histórico: a nota atual pesa (partidas avaliadas + 1),
 * limitado a 10, para que a evolução recente continue tendo efeito.
 */
export function nextBaseRating(base: number, ratedMatches: number, matchAverage: number): number {
  const weight = Math.min(ratedMatches + 1, 10);
  const value = (base * weight + matchAverage) / (weight + 1);
  return Math.round(value * 100) / 100;
}

export function formatRating(value: number | null | undefined) {
  return value == null ? "–" : value.toFixed(1).replace(".", ",");
}
