import { db } from "@/lib/db";
import { splitRoster } from "@/lib/draw";
import { teamsFor, type TeamKey } from "@/lib/teams";

export async function getMatch(id: string) {
  return db.match.findUnique({
    where: { id },
    include: {
      attendances: { include: { player: true }, orderBy: { createdAt: "asc" } },
      games: { orderBy: { createdAt: "asc" } },
    },
  });
}

export type MatchFull = NonNullable<Awaited<ReturnType<typeof getMatch>>>;
export type AttendanceFull = MatchFull["attendances"][number];

/** Antes do sorteio: titulares e lista de espera pela ordem de confirmação. */
export function preDraw(match: MatchFull) {
  const list = match.attendances.map((a) => ({
    ...a,
    rating: a.player.baseRating,
    isGoalkeeper: a.player.isGoalkeeper,
  }));
  return splitRoster(list, match.numTeams, match.lineSize);
}

/** Depois do sorteio: elenco por colete + banco de reservas. */
export function byTeams(match: MatchFull) {
  const teams = teamsFor(match.numTeams).map((team: TeamKey) => {
    const players = match.attendances
      .filter((a) => a.team === team)
      .sort((a, b) => Number(b.asGoalkeeper) - Number(a.asGoalkeeper));
    const line = players.filter((p) => !p.asGoalkeeper);
    const strength = line.reduce((s, p) => s + (p.ratingAtDraw ?? p.player.baseRating), 0);
    return { team, players, strength, lineCount: line.length };
  });
  const bench = match.attendances.filter((a) => !a.team);
  return { teams, bench };
}

export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Lista aberta", cls: "stamp-open" },
  DRAWN: { label: "Times sorteados", cls: "stamp-drawn" },
  FINISHED: { label: "Encerrada", cls: "stamp-done" },
};
