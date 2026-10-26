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
 *    - Se 2 goleiros: alocados aos dois primeiros times.
 *    - Se 1 goleiro: alocado fixo no time 1. Os outros times recebem jogador para assumir o gol.
 *    - Se 0 goleiros: revezamento entre jogadores.
 * 2. Jogadores: distribuídos em serpentina por nota (snake draft).
 * 3. Regra Estrita: É estritamente proibido que um time tenha 6 jogadores (contando o goleiro, fixo ou não) e outro tenha 7.
 *    O balanceamento se dará por empréstimo do time que não está jogando,
 *    ou por tirar um goleiro fixo (definido previamente via sorteio), e um jogador toma lugar de goleiro.
 */
export function snakeDraft(
  teams: string[],
  goalkeepers: Candidate[],
  line: Candidate[],
  lineSize: number = 5
): Assignment[] {
  const result: Assignment[] = [];
  let gks = shuffle(goalkeepers).sort((a, b) => b.rating - a.rating);
  let pool = shuffle(line).sort((a, b) => b.rating - a.rating);
  const numTeams = teams.length;

  // Se houver 2 times e a contagem total for ímpar (o que causaria número diferente em cada time, ex: 5 vs 6 ou 6 vs 7):
  // Regra Estrita: Não pode haver um número diferente em cada time!
  // O balanceamento se dará por tirar um goleiro fixo (definido previamente via sorteio), e um jogador toma lugar de goleiro.
  if (numTeams === 2 && (gks.length + pool.length) % 2 !== 0) {
    if (gks.length >= 2) {
      const [keptGk, removedGk] = shuffle(gks.slice(0, 2));
      gks = [keptGk, ...gks.slice(2)];
      // O goleiro retirado via sorteio sai da escalação ativa para garantir que ambos os times joguem com número idêntico
    } else if (pool.length > 0) {
      // Se não há 2 goleiros fixos, o excedente ímpar fica como suplente/espera para manter número rigorosamente igual
      pool.pop();
    }
  }

  // Alocação de goleiros fixos
  const teamGkAssigned: Record<string, boolean> = {};
  for (const t of teams) {
    teamGkAssigned[t] = false;
  }

  if (gks.length >= numTeams) {
    teams.forEach((team, idx) => {
      result.push({ playerId: gks[idx].playerId, team, asGoalkeeper: true });
      teamGkAssigned[team] = true;
    });
    for (let i = numTeams; i < gks.length; i++) {
      pool.push(gks[i]);
    }
  } else if (gks.length >= 2) {
    result.push({ playerId: gks[0].playerId, team: teams[0], asGoalkeeper: true });
    result.push({ playerId: gks[1].playerId, team: teams[1], asGoalkeeper: true });
    teamGkAssigned[teams[0]] = true;
    teamGkAssigned[teams[1]] = true;
    for (let i = 2; i < gks.length; i++) {
      pool.push(gks[i]);
    }
  } else if (gks.length === 1) {
    result.push({ playerId: gks[0].playerId, team: teams[0], asGoalkeeper: true });
    teamGkAssigned[teams[0]] = true;
  }

  // Se algum time ficou sem goleiro fixo e temos jogadores disponíveis:
  // "um jogador toma lugar de goleiro" para manter paridade absoluta
  const teamsWithoutGk = teams.filter((t) => !teamGkAssigned[t]);
  for (const t of teamsWithoutGk) {
    if (pool.length > 0) {
      const playerGk = pool.pop()!;
      result.push({
        playerId: playerGk.playerId,
        team: t,
        asGoalkeeper: true,
      });
      teamGkAssigned[t] = true;
    }
  }

  pool.sort((a, b) => b.rating - a.rating);

  // Distribuição dos demais jogadores por serpentina entre todos os times
  const pickOrder = shuffle(teams);
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

  // Empréstimo balanceado se algum time estiver desfalcado ou para garantir que
  // nenhum confronto tenha 6 contra 7:
  // "o balanceamento se dará por empréstimo do time que não está jogando"
  balanceWithBorrows(teams, result, pool, lineSize);

  return result;
}

/**
 * Completa times desfalcados e impede estritamente que um time tenha 6 jogadores e outro 7
 * (contando o goleiro, fixo ou não).
 * O balanceamento se dará por empréstimo do time que não está jogando.
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

  // Contagem total de cada equipe (contando goleiro, fixo ou não)
  const getTeamHeadcount = (team: string) => {
    const direct = assignments.filter(
      (a) => a.team === team && !unavailableIds.has(a.playerId)
    ).length;
    const borrowed = assignments.filter(
      (a) => a.borrowedToTeam === team && !unavailableIds.has(a.playerId)
    ).length;
    return direct + borrowed;
  };

  const getTeamStrength = (team: string) => {
    const direct = assignments
      .filter((a) => a.team === team && !unavailableIds.has(a.playerId) && !a.borrowedToTeam)
      .reduce((sum, a) => sum + (ratingMap.get(a.playerId) ?? 3), 0);
    const borrowed = assignments
      .filter((a) => a.borrowedToTeam === team && !unavailableIds.has(a.playerId))
      .reduce((sum, a) => sum + (ratingMap.get(a.playerId) ?? 3), 0);
    return direct + borrowed;
  };

  // Se houver pelo menos 3 times, podemos emprestar do time que não está jogando
  // Regra Estrita: É estritamente proibido que um time tenha 6 jogadores e outro 7.
  // Todos os times devem ter a mesma quantidade de jogadores (o máximo entre lineSize + 1 e maxHeadcount).
  const maxHeadcount = Math.max(...teams.map(getTeamHeadcount));
  const targetTotal = Math.max(lineSize + 1, maxHeadcount);

  for (const team of teams) {
    let currentTotal = getTeamHeadcount(team);

    while (currentTotal < targetTotal) {
      // Busca doador no time que não está jogando (outros times)
      const donorTeams = teams.filter((t) => t !== team);
      let bestCandidate: Assignment | null = null;
      let minDiff = Infinity;

      for (const donorTeam of donorTeams) {
        const donorAvailable = assignments.filter(
          (a) =>
            a.team === donorTeam &&
            !a.asGoalkeeper &&
            !a.borrowedToTeam &&
            !unavailableIds.has(a.playerId)
        );

        for (const candidate of donorAvailable) {
          const candRating = ratingMap.get(candidate.playerId) ?? 3;
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
        break;
      }
    }
  }
}
