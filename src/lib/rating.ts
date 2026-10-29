export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

export type MedalCounts = {
  gold: number;
  silver: number;
  bronze: number;
};

/**
 * Calcula médias robustas para cada atleta em uma partida a partir dos votos brutos.
 *
 * Algoritmo Estatístico:
 * 1. Análise de Comportamento dos Votantes:
 *    - Calcula a média e desvio padrão das notas dadas por cada votante.
 *    - Se um votante avaliou múltiplos atletas (>= 3) e deu notas idênticas (variância zero),
 *      ou se suas notas são extremos arbitrários (outliers em relação ao grupo),
 *      o peso de influência desse votante é amortecido (Winsorização / Huber weight).
 * 2. Média Aparada / Ponderada por Atleta (Trimmed Robust Mean):
 *    - Quando um atleta tem 4 ou mais notas, as notas extremas (a mais alta e a mais baixa)
 *      recebem peso reduzido de 50%, impedindo que um único voto troll (ex: 1.0 ou 5.0)
 *      distorça a avaliação coletiva.
 *    - Em casos com poucas notas (1 a 3), calcula a média ponderada direta.
 */
export function computeMatchRobustAverages(
  votes: { voterId: string; targetId: string; score: number }[]
): Map<string, { avg: number; count: number }> {
  const result = new Map<string, { avg: number; count: number }>();
  if (!votes.length) return result;

  // 1. Agrupar votos por votante para calcular perfil de dispersão e calibrar votos individuais
  // - Votos muito conservadores (concentrados no meio, ex: desvio padrão muito baixo ao redor de 3.0):
  //   são esticados a partir do centro para recuperar a diferenciação dos atletas.
  // - Votos com amplitude excessiva ou sem critério: são moderados/amortecidos.
  const votesByVoter = new Map<string, { targetId: string; score: number }[]>();
  for (const v of votes) {
    const list = votesByVoter.get(v.voterId) ?? [];
    list.push({ targetId: v.targetId, score: v.score });
    votesByVoter.set(v.voterId, list);
  }

  // Mapa de notas ajustadas por votante
  const adjustedVotes: { voterId: string; targetId: string; score: number; weight: number }[] = [];

  for (const [voterId, userVotes] of votesByVoter.entries()) {
    const count = userVotes.length;
    if (count < 3) {
      // Poucos votos: mantém notas e peso padrão
      for (const uv of userVotes) {
        adjustedVotes.push({ voterId, targetId: uv.targetId, score: uv.score, weight: 1.0 });
      }
      continue;
    }

    const scores = userVotes.map((u) => u.score);
    const mean = scores.reduce((a, b) => a + b, 0) / count;
    const variance = scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    // Variância praticamente zero (deu a mesma nota para todos, ex: tudo 5 ou tudo 3)
    if (stdDev < 0.2) {
      for (const uv of userVotes) {
        adjustedVotes.push({ voterId, targetId: uv.targetId, score: uv.score, weight: 0.5 });
      }
      continue;
    }

    // Se as notas forem muito conservadoras (aglomeradas no meio perto de 3.0, com baixo desvio < 0.6)
    // Realiza um estiramento individual moderado a partir da média do votante
    let stretchFactor = 1.0;
    let voterWeight = 1.0;

    if (stdDev < 0.6) {
      // Votos conservadores no centro: estira as diferenças em relação à média
      stretchFactor = 1.35;
      voterWeight = 1.0;
    } else if (stdDev > 1.4) {
      // Votante com amplitude extrema / volátil: amortece o peso e comprime levemente em direção ao centro
      stretchFactor = 0.85;
      voterWeight = 0.8;
    }

    for (const uv of userVotes) {
      const stretched = mean + (uv.score - mean) * stretchFactor;
      const clamped = Math.max(MIN_SCORE, Math.min(MAX_SCORE, stretched));
      adjustedVotes.push({ voterId, targetId: uv.targetId, score: clamped, weight: voterWeight });
    }
  }

  // 2. Agrupar votos ajustados por atleta avaliado (targetId)
  const votesByTarget = new Map<string, { voterId: string; score: number; weight: number }[]>();
  for (const v of adjustedVotes) {
    const list = votesByTarget.get(v.targetId) ?? [];
    list.push({ voterId: v.voterId, score: v.score, weight: v.weight });
    votesByTarget.set(v.targetId, list);
  }

  // 3. Calcular média aparada/ponderada robusta preliminar para cada atleta
  const unscaledAverages: { targetId: string; avg: number; count: number }[] = [];

  for (const [targetId, targetVotes] of votesByTarget.entries()) {
    const count = targetVotes.length;
    if (count === 0) continue;

    // Ordenar por pontuação para identificação de extremos (outliers)
    const sorted = [...targetVotes].sort((a, b) => a.score - b.score);

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      let itemWeight = item.weight;

      // Se há 4 ou mais avaliações, atenua os extremos (mínimo e máximo)
      if (count >= 4 && (i === 0 || i === sorted.length - 1)) {
        itemWeight *= 0.5;
      }

      weightedSum += item.score * itemWeight;
      totalWeight += itemWeight;
    }

    const rawAvg = totalWeight > 0 ? weightedSum / totalWeight : 1.0;
    unscaledAverages.push({ targetId, avg: rawAvg, count });
  }

  if (unscaledAverages.length === 0) return result;

  // 4. Calibração e Expansão de Amplitude Condicional (Adaptive Min-Max Stretch)
  // Regras de amplitude condicional baseadas nas médias simples dos jogadores:
  // - Topo: se o jogador de maior média simples tiver média > 4.0, estica até [4.8, 4.9] (ex: 4.85).
  //         caso contrário (nenhum jogador superou 4.0), estica até [4.3, 4.4] (ex: 4.35).
  // - Base: se o jogador de menor média simples tiver média < 2.0, estica até [1.1, 1.2] (ex: 1.15).
  //         caso contrário (nenhum jogador ficou abaixo de 2.0), estica até [1.6, 1.7] (ex: 1.65).
  if (unscaledAverages.length === 1) {
    const only = unscaledAverages[0];
    const rounded = Math.round(Math.max(1.0, Math.min(5.0, only.avg)) * 10) / 10;
    result.set(only.targetId, { avg: rounded, count: only.count });
    return result;
  }

  // Calcular média simples de cada jogador avaliado a partir dos votos brutos para avaliar as condições
  const rawTargetScores = new Map<string, number[]>();
  for (const v of votes) {
    const list = rawTargetScores.get(v.targetId) ?? [];
    list.push(v.score);
    rawTargetScores.set(v.targetId, list);
  }

  let highestSimpleAvg = -Infinity;
  let lowestSimpleAvg = Infinity;
  for (const [, scores] of rawTargetScores.entries()) {
    if (!scores.length) continue;
    const simpleAvg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    if (simpleAvg > highestSimpleAvg) highestSimpleAvg = simpleAvg;
    if (simpleAvg < lowestSimpleAvg) lowestSimpleAvg = simpleAvg;
  }

  const TARGET_MAX = highestSimpleAvg > 4.0 ? 4.85 : 4.35;
  const TARGET_MIN = lowestSimpleAvg < 2.0 ? 1.15 : 1.65;

  let minAvg = Infinity;
  let maxAvg = -Infinity;
  for (const item of unscaledAverages) {
    if (item.avg < minAvg) minAvg = item.avg;
    if (item.avg > maxAvg) maxAvg = item.avg;
  }

  const currentSpan = maxAvg - minAvg;

  for (const item of unscaledAverages) {
    let finalAvg: number;
    if (currentSpan < 0.001) {
      // Se todos empataram com exatamente a mesma nota
      finalAvg = item.avg;
    } else {
      // Mapeamento linear para esticar a amplitude cobrindo entre [TARGET_MIN, TARGET_MAX]
      const normalized = (item.avg - minAvg) / currentSpan;
      finalAvg = TARGET_MIN + normalized * (TARGET_MAX - TARGET_MIN);
    }

    const clamped = Math.max(1.0, Math.min(5.0, finalAvg));
    const roundedAvg = Math.round(clamped * 10) / 10;
    result.set(item.targetId, { avg: roundedAvg, count: item.count });
  }

  return result;
}

/**
 * Normaliza para a escala 1–5 em passos de meia estrela.
 */
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
