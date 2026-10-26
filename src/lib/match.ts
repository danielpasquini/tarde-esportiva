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

export type TeamRoster = {
  team: TeamKey;
  players: AttendanceFull[];
  keeper: AttendanceFull | null;
  activeLine: AttendanceFull[];
  unavailablePlayers: AttendanceFull[];
  borrowedIn: AttendanceFull[];
  borrowedOut: AttendanceFull[];
  strength: number;
  lineCount: number;
  restingTeamForGk?: string;
};

/**
 * Depois do sorteio: equipes formadas sem reservas/banco,
 * com suporte à lógica de goleiros fixos de campo (Lado A e Lado B),
 * jogadores indisponíveis (atraso/lesão) e jogadores emprestados (frisados).
 */
export function byTeams(match: MatchFull) {
  const validTeams = teamsFor(match.numTeams);
  const confirmedGoalkeepers = match.attendances.filter(
    (a) => a.team && a.asGoalkeeper
  );

  let fixedGkMode: "TWO_FIXED" | "ONE_FIXED" | "ALL_FIXED" | "NONE" = "NONE";
  let fieldGkA: AttendanceFull | null = null;
  let fieldGkB: AttendanceFull | null = null;
  let singleFixedGk: AttendanceFull | null = null;

  if (confirmedGoalkeepers.length >= match.numTeams) {
    fixedGkMode = "ALL_FIXED";
  } else if (confirmedGoalkeepers.length >= 2) {
    fixedGkMode = "TWO_FIXED";
    fieldGkA = confirmedGoalkeepers[0];
    fieldGkB = confirmedGoalkeepers[1];
  } else if (confirmedGoalkeepers.length === 1) {
    fixedGkMode = "ONE_FIXED";
    singleFixedGk = confirmedGoalkeepers[0];
  }

  const teams: TeamRoster[] = validTeams.map((team: TeamKey) => {
    const players = match.attendances.filter((a) => a.team === team);

    // Goleiro fixo do time (se houver)
    const keeper = players.find((p) => p.asGoalkeeper) ?? null;

    // Jogadores deste time
    const lineAll = players.filter((p) => !p.asGoalkeeper);
    const unavailablePlayers = lineAll.filter((p) => p.isUnavailable);
    // Ordenados por nota/estrelas decrescente
    const activeLine = lineAll
      .filter((p) => !p.isUnavailable)
      .sort(
        (a, b) =>
          (b.ratingAtDraw ?? b.player.baseRating) -
          (a.ratingAtDraw ?? a.player.baseRating)
      );

    // Jogadores emprestados DE OUTROS TIMES para jogar neste time (ordenados por nota)
    const borrowedIn = match.attendances
      .filter(
        (a) => a.team !== team && a.borrowedToTeam === team && !a.isUnavailable
      )
      .sort(
        (a, b) =>
          (b.ratingAtDraw ?? b.player.baseRating) -
          (a.ratingAtDraw ?? a.player.baseRating)
      );

    // Jogadores deste time que jogam emprestados para outro time
    const borrowedOut = players.filter(
      (a) => a.borrowedToTeam != null && a.borrowedToTeam !== team
    );

    // Força total (titulares ativos + jogadores emprestados)
    const strength = [...activeLine, ...borrowedIn].reduce(
      (sum, p) => sum + (p.ratingAtDraw ?? p.player.baseRating),
      0
    );

    let restingTeamForGk: string | undefined;
    if (fixedGkMode === "ONE_FIXED" && !keeper) {
      const otherTeamsWithoutGk = validTeams.filter(
        (t) => t !== team && t !== singleFixedGk?.team
      );
      if (otherTeamsWithoutGk.length > 0) {
        restingTeamForGk = otherTeamsWithoutGk[0];
      } else if (singleFixedGk?.team) {
        restingTeamForGk = singleFixedGk.team;
      }
    }

    return {
      team,
      players,
      keeper,
      activeLine,
      unavailablePlayers,
      borrowedIn,
      borrowedOut,
      strength,
      lineCount: activeLine.length + borrowedIn.length,
      restingTeamForGk,
    };
  });

  return {
    teams,
    fixedGkMode,
    fieldGkA,
    fieldGkB,
    singleFixedGk,
  };
}

export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Lista aberta", cls: "stamp-open" },
  DRAWN: { label: "Times sorteados", cls: "stamp-drawn" },
  FINISHED: { label: "Encerrada", cls: "stamp-done" },
};
