export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

export type MedalCounts = {
  gold: number;
  silver: number;
  bronze: number;
};

/** Normaliza para a escala 1–5 em passos de meia estrela. */
export function normalizeScore(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 2) / 2;
  if (rounded < MIN_SCORE || rounded > MAX_SCORE) return null;
  return rounded;
}

/**
 * Média ponderada com o histórico: se o jogador não tinha nota inicial,
 * a primeira partida define 100% da sua nota base. Caso contrário, a nota atual
 * pesa (partidas avaliadas + 1), limitado a 10.
 */
export function nextBaseRating(
  base: number | null | undefined,
  ratedMatches: number,
  matchAverage: number
): number {
  if (base == null) {
    return Math.round(matchAverage * 100) / 100;
  }
  const weight = Math.min(ratedMatches + 1, 10);
  const value = (base * weight + matchAverage) / (weight + 1);
  return Math.round(value * 100) / 100;
}

/**
 * Reverte a aplicação de uma média de partida sobre a nota do jogador.
 * base = (prevBase * weight + matchAverage) / (weight + 1)
 * prevBase = (base * (weight + 1) - matchAverage) / weight
 *
 * Se o jogador possuía apenas 1 partida avaliada (ou nenhuma), reverter a partida
 * retorna null (sem nota acumulada).
 */
export function revertBaseRating(
  currentBase: number | null | undefined,
  currentRatedMatches: number,
  matchAverage: number
): number | null {
  if (currentRatedMatches <= 1 || currentBase == null) return null;
  const prevMatches = currentRatedMatches - 1;
  const weight = Math.min(prevMatches + 1, 10);
  const prevBase = (currentBase * (weight + 1) - matchAverage) / weight;
  const bounded = Math.max(MIN_SCORE, Math.min(MAX_SCORE, prevBase));
  return Math.round(bounded * 100) / 100;
}

export function formatRating(value: number | null | undefined) {
  return value == null ? "–" : value.toFixed(1).replace(".", ",");
}

/**
 * Calcula o quadro de medalhas (🥇 1º, 🥈 2º, 🥉 3º) acumulado por jogador
 * considerando todas as partidas encerradas (FINISHED) com votos registrados.
 */
export function computeMedalsFromVotes(
  votes: { matchId: string; targetId: string; score: number }[]
): Record<string, MedalCounts> {
  const byMatch: Record<string, Record<string, { sum: number; count: number }>> = {};

  for (const v of votes) {
    if (!byMatch[v.matchId]) byMatch[v.matchId] = {};
    if (!byMatch[v.matchId][v.targetId]) byMatch[v.matchId][v.targetId] = { sum: 0, count: 0 };
    byMatch[v.matchId][v.targetId].sum += v.score;
    byMatch[v.matchId][v.targetId].count += 1;
  }

  const medals: Record<string, MedalCounts> = {};
  const ensure = (playerId: string) => {
    if (!medals[playerId]) medals[playerId] = { gold: 0, silver: 0, bronze: 0 };
    return medals[playerId];
  };

  for (const targets of Object.values(byMatch)) {
    const entries = Object.entries(targets)
      .filter(([, s]) => s.count > 0)
      .map(([targetId, s]) => ({
        targetId,
        avg: Math.round((s.sum / s.count) * 10) / 10,
      }))
      .filter((e) => e.avg > 0);

    for (const entry of entries) {
      const rank = 1 + entries.filter((other) => other.avg > entry.avg).length;
      if (rank === 1) ensure(entry.targetId).gold += 1;
      else if (rank === 2) ensure(entry.targetId).silver += 1;
      else if (rank === 3) ensure(entry.targetId).bronze += 1;
    }
  }

  return medals;
}
