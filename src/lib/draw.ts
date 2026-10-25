export type Candidate = { playerId: string; rating: number; isGoalkeeper: boolean };
export type Assignment = { playerId: string; team: string; asGoalkeeper: boolean };

/**
 * Separa confirmados (em ordem de confirmação) em goleiros titulares,
 * linha titular e lista de espera. Goleiros excedentes entram como linha.
 */
export function splitRoster<T extends Candidate>(list: T[], numTeams: number, lineSize: number) {
  const capacity = numTeams * lineSize;
  const goalkeepers: T[] = [];
  const line: T[] = [];
  const waitlist: T[] = [];
  for (const c of list) {
    if (c.isGoalkeeper && goalkeepers.length < numTeams) goalkeepers.push(c);
    else if (line.length < capacity) line.push(c);
    else waitlist.push(c);
  }
  return { goalkeepers, line, waitlist, capacity };
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
 * Goleiros: um por time (melhor goleiro no 1º time).
 * Linha: serpentina por nota, começando pelo time com o goleiro mais fraco (ou sem goleiro).
 */
export function snakeDraft(teams: string[], goalkeepers: Candidate[], line: Candidate[]): Assignment[] {
  const result: Assignment[] = [];
  const gks = shuffle(goalkeepers).sort((a, b) => b.rating - a.rating);
  gks.slice(0, teams.length).forEach((g, i) =>
    result.push({ playerId: g.playerId, team: teams[i], asGoalkeeper: true }),
  );

  const pickOrder = gks.length ? [...teams].reverse() : shuffle(teams);
  const pool = shuffle(line).sort((a, b) => b.rating - a.rating);
  const n = pickOrder.length;
  pool.forEach((p, i) => {
    const round = Math.floor(i / n);
    const pos = i % n;
    const idx = round % 2 === 0 ? pos : n - 1 - pos;
    result.push({ playerId: p.playerId, team: pickOrder[idx], asGoalkeeper: false });
  });
  return result;
}
