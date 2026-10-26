export const MAX_MATCH_ROSTER = 24;

export type Candidate = {
  playerId: string;
  rating: number;
  isGoalkeeper: boolean;
};

export type Assignment = {
  playerId: string;
  team: string;
  asGoalkeeper: boolean;
  borrowedToTeam?: string | null;
  borrowedAsGk?: boolean;
};

/**
 * A lista de confirmados para a partida aceita até 24 jogadores.
 * O que passar de 24 entra automaticamente na "Lista de Espera" (não reservas).
 */
export function splitRoster<T extends Candidate>(list: T[], numTeams: number, lineSize: number) {
  const activeCandidates = list.slice(0, MAX_MATCH_ROSTER);
  const waitlist = list.slice(MAX_MATCH_ROSTER);

  const goalkeepers: T[] = [];
  const line: T[] = [];

  for (const c of activeCandidates) {
    if (c.isGoalkeeper && goalkeepers.length < Math.max(numTeams, 2)) {
      goalkeepers.push(c);
    } else {
      line.push(c);
    }
  }

  return { goalkeepers, line, waitlist, capacity: MAX_MATCH_ROSTER };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sorteio inteligente e balanceado de times sem reservas ou banco:
 * 1. Goleiros fixos:
 *    - Se 2 goleiros: alocados aos dois primeiros times (em campo atuam fixos nas traves A e B para quem estiver daquele lado).
 *    - Se 1 goleiro: alocado fixo no time 1. Os outros times pegarão jogador emprestado do time em descanso como goleiro.
 *    - Se 0 goleiros: revezamento entre times.
 * 2. Jogadores de linha: distribuídos em serpentina por nota (snake draft).
 * 3. Empréstimo automático: se algum time tiver menos jogadores que lineSize,
 *    pega emprestado o jogador ideal de outra equipe para equilibrar as forças.
 */
export function snakeDraft(
  teams: string[],
  goalkeepers: Candidate[],
  line: Candidate[],
  lineSize: number = 5
): Assignment[] {
  const result: Assignment[] = [];
  const gks = shuffle(goalkeepers).sort((a, b) => b.rating - a.rating);

  // Alocação de goleiros fixos
  if (gks.length >= 2) {
    result.push({ playerId: gks[0].playerId, team: teams[0], asGoalkeeper: true });
    result.push({ playerId: gks[1].playerId, team: teams[1], asGoalkeeper: true });
    // Se houver mais de 2 goleiros cadastrados, os excedentes entram na linha
    for (let i = 2; i < gks.length; i++) {
      line.push(gks[i]);
    }
  } else if (gks.length === 1) {
    result.push({ playerId: gks[0].playerId, team: teams[0], asGoalkeeper: true });
  }

  // Distribuição dos jogadores de linha por serpentina
  const pickOrder = gks.length ? [...teams].reverse() : shuffle(teams);
  const pool = shuffle(line).sort((a, b) => b.rating - a.rating);
  const n = pickOrder.length;

  pool.forEach((p, i) => {
    const round = Math.floor(i / n);
    const pos = i % n;
    const idx = round % 2 === 0 ? pos : n - 1 - pos;
    result.push({
      playerId: p.playerId,
      team: pickOrder[idx],
      asGoalkeeper: false,
    });
  });

  // Empréstimo balanceado se algum time estiver com menos atletas que o formato exigido (lineSize)
  balanceWithBorrows(teams, result, pool, lineSize);

  return result;
}

/**
 * Completa times desfalcados pegando jogadores emprestados de outros times,
 * escolhendo o atleta que melhor equilibra a média de força dos times.
 */
export function balanceWithBorrows(
  teams: string[],
  assignments: Assignment[],
  allLineCandidates: Candidate[],
  lineSize: number,
  unavailableIds: Set<string> = new Set()
) {
  const ratingMap = new Map(allLineCandidates.map((c) => [c.playerId, c.rating]));

  // Limpa empréstimos prévios para recalcular
  for (const a of assignments) {
    a.borrowedToTeam = null;
    a.borrowedAsGk = false;
  }

  // Identifica quantos jogadores disponíveis cada time tem
  const getAvailableLine = (team: string) =>
    assignments.filter(
      (a) => a.team === team && !a.asGoalkeeper && !unavailableIds.has(a.playerId)
    );

  const getTeamStrength = (team: string) => {
    const direct = getAvailableLine(team).reduce(
      (sum, a) => sum + (ratingMap.get(a.playerId) ?? 3),
      0
    );
    const borrowed = assignments
      .filter((a) => a.borrowedToTeam === team && !unavailableIds.has(a.playerId))
      .reduce((sum, a) => sum + (ratingMap.get(a.playerId) ?? 3), 0);
    return direct + borrowed;
  };

  for (const team of teams) {
    const directLine = getAvailableLine(team);
    const borrowedLine = assignments.filter((a) => a.borrowedToTeam === team);
    let currentTotal = directLine.length + borrowedLine.length;

    while (currentTotal < lineSize) {
      // Precisa pegar emprestado! Achar o melhor doador entre os outros times
      const otherTeams = teams.filter((t) => t !== team);
      let bestCandidate: Assignment | null = null;
      let minDiff = Infinity;

      for (const donorTeam of otherTeams) {
        const donorAvailable = assignments.filter(
          (a) =>
            a.team === donorTeam &&
            !a.asGoalkeeper &&
            !a.borrowedToTeam &&
            !unavailableIds.has(a.playerId)
        );

        for (const candidate of donorAvailable) {
          const candRating = ratingMap.get(candidate.playerId) ?? 3;
          // Simula forças após o empréstimo
          const myNewStrength = getTeamStrength(team) + candRating;
          const otherStrengths = teams.map((t) =>
            t === team ? myNewStrength : getTeamStrength(t)
          );
          const diff = Math.max(...otherStrengths) - Math.min(...otherStrengths);

          if (diff < minDiff) {
            minDiff = diff;
            bestCandidate = candidate;
          }
        }
      }

      if (bestCandidate) {
        bestCandidate.borrowedToTeam = team;
        currentTotal++;
      } else {
        // Não há mais candidatos disponíveis para emprestar
        break;
      }
    }
  }
}
