"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, signIn, signOut } from "@/lib/auth";
import { getMatch } from "@/lib/match";
import { splitRoster, snakeDraft } from "@/lib/draw";
import { isTeam, teamsFor } from "@/lib/teams";
import { nextBaseRating, revertBaseRating, normalizeScore } from "@/lib/rating";
import { parseLocalDateTime } from "@/lib/format";
import { parseNumberedRoster } from "@/lib/parse-roster";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const intIn = (value: string, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

function touch(matchId: string) {
  revalidatePath(`/admin/partida/${matchId}`);
  revalidatePath(`/partida/${matchId}`);
}

/* ---------- Sessão ---------- */

export async function login(formData: FormData) {
  const ok = await signIn(str(formData, "pin"));
  if (ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/entrar");
    redirect("/admin");
  } else {
    redirect("/admin/entrar?erro=1");
  }
}

export async function logout() {
  await signOut();
  redirect("/");
}

/* ---------- Jogadores ---------- */

export async function createPlayer(formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name").slice(0, 40);
  if (!name) return;
  const baseRating = normalizeScore(Number(str(formData, "baseRating"))) ?? 3;
  await db.player.upsert({
    where: { name },
    create: { name, baseRating, isGoalkeeper: formData.get("isGoalkeeper") === "on" },
    update: { active: true },
  });
  revalidatePath("/admin/jogadores");
}

export async function importPlayersBatch(formData: FormData) {
  await requireAdmin();
  const rawText = str(formData, "names");
  const names = parseNumberedRoster(rawText);
  if (names.length === 0) return;

  const baseRating = normalizeScore(Number(str(formData, "baseRating"))) ?? 3;

  for (const name of names) {
    await db.player.upsert({
      where: { name },
      create: { name, baseRating, isGoalkeeper: false },
      update: { active: true },
    });
  }

  revalidatePath("/admin/jogadores");
  revalidatePath("/admin");
}

export async function updatePlayer(playerId: string, formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name").slice(0, 40);
  const baseRating = normalizeScore(Number(str(formData, "baseRating")));
  const clash = name ? await db.player.findFirst({ where: { name, NOT: { id: playerId } } }) : null;
  await db.player.update({
    where: { id: playerId },
    data: {
      ...(name && !clash ? { name } : {}),
      ...(baseRating != null ? { baseRating } : {}),
      isGoalkeeper: formData.get("isGoalkeeper") === "on",
      active: formData.get("active") === "on",
    },
  });
  revalidatePath("/admin/jogadores");
}

export async function deletePlayer(playerId: string) {
  await requireAdmin();
  await db.player.delete({
    where: { id: playerId },
  });
  revalidatePath("/admin/jogadores");
  revalidatePath("/admin");
}

/* ---------- Partidas ---------- */

export async function createMatch(formData: FormData) {
  await requireAdmin();
  const date = parseLocalDateTime(str(formData, "date")) ?? new Date();
  const match = await db.match.create({
    data: {
      date,
      numTeams: intIn(str(formData, "numTeams"), 2, 4, 2),
      lineSize: intIn(str(formData, "lineSize"), 3, 11, 5),
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin/partida/${match.id}`);
}

export async function updateMatchConfig(matchId: string, formData: FormData) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "OPEN") return;
  const date = parseLocalDateTime(str(formData, "date"));
  await db.match.update({
    where: { id: matchId },
    data: {
      ...(date ? { date } : {}),
      numTeams: intIn(str(formData, "numTeams"), 2, 4, match.numTeams),
      lineSize: intIn(str(formData, "lineSize"), 3, 11, match.lineSize),
    },
  });
  touch(matchId);
}

export async function deleteMatch(matchId: string) {
  await requireAdmin();
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { votes: true },
  });

  if (match && match.status === "FINISHED") {
    // Calcular médias dos votos desta partida para reverter a pontuação dos atletas
    const averages = await db.vote.groupBy({
      by: ["targetId"],
      where: { matchId },
      _avg: { score: true },
    });

    const playerIds = averages.map((a) => a.targetId);
    const players = await db.player.findMany({ where: { id: { in: playerIds } } });
    const avgMap = new Map(averages.map((a) => [a.targetId, a._avg.score]));

    await db.$transaction([
      ...players.flatMap((p) => {
        const avg = avgMap.get(p.id);
        if (avg == null) return [];
        return [
          db.player.update({
            where: { id: p.id },
            data: {
              baseRating: revertBaseRating(p.baseRating, p.ratedMatches, avg),
              ratedMatches: Math.max(0, p.ratedMatches - 1),
            },
          }),
        ];
      }),
      db.match.delete({ where: { id: matchId } }),
    ]);
  } else {
    await db.match.delete({ where: { id: matchId } });
  }

  revalidatePath("/admin");
  revalidatePath("/historico");
  revalidatePath("/");
  redirect("/admin");
}

/* ---------- Presença ---------- */

export async function addAttendances(matchId: string, formData: FormData) {
  await requireAdmin();
  const ids = formData.getAll("playerId").map(String);
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status === "FINISHED" || ids.length === 0) return;
  const players = await db.player.findMany({ where: { id: { in: ids }, active: true } });
  // Sequencial para preservar a ordem de chegada (define titular x espera).
  for (const p of players) {
    await db.attendance.upsert({
      where: { matchId_playerId: { matchId, playerId: p.id } },
      create: { matchId, playerId: p.id },
      update: {},
    });
  }
  touch(matchId);
}

export async function addAttendancesByText(matchId: string, formData: FormData) {
  await requireAdmin();
  const rawText = str(formData, "names");
  const names = parseNumberedRoster(rawText);
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status === "FINISHED" || names.length === 0) return;

  // Para cada nome na lista numerada, encontra ou cria o jogador e adiciona a presença
  for (const name of names) {
    let player = await db.player.findUnique({ where: { name } });
    if (!player) {
      player = await db.player.create({
        data: { name, baseRating: 3.0, active: true },
      });
    } else if (!player.active) {
      player = await db.player.update({
        where: { id: player.id },
        data: { active: true },
      });
    }

    await db.attendance.upsert({
      where: { matchId_playerId: { matchId, playerId: player.id } },
      create: { matchId, playerId: player.id },
      update: {},
    });
  }

  touch(matchId);
  revalidatePath("/admin/jogadores");
}

export async function removeAttendance(matchId: string, attendanceId: string) {
  await requireAdmin();
  await db.attendance.deleteMany({ where: { id: attendanceId, matchId } });
  touch(matchId);
}

/* ---------- Sorteio e remanejamento ---------- */

export async function drawTeams(matchId: string) {
  await requireAdmin();
  const match = await getMatch(matchId);
  if (!match || match.status === "FINISHED") return;

  const candidates = match.attendances.map((a) => ({
    playerId: a.playerId,
    rating: a.player.baseRating,
    isGoalkeeper: a.player.isGoalkeeper,
  }));
  const ratingOf = new Map(candidates.map((c) => [c.playerId, c.rating]));
  const { goalkeepers, line } = splitRoster(candidates, match.numTeams, match.lineSize);
  const assignments = snakeDraft(teamsFor(match.numTeams), goalkeepers, line);

  await db.$transaction([
    db.attendance.updateMany({
      where: { matchId },
      data: { team: null, asGoalkeeper: false, ratingAtDraw: null },
    }),
    ...assignments.map((a) =>
      db.attendance.update({
        where: { matchId_playerId: { matchId, playerId: a.playerId } },
        data: { team: a.team, asGoalkeeper: a.asGoalkeeper, ratingAtDraw: ratingOf.get(a.playerId) },
      }),
    ),
    db.match.update({ where: { id: matchId }, data: { status: "DRAWN" } }),
  ]);
  touch(matchId);
}

export async function reopenList(matchId: string) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "DRAWN") return;
  await db.$transaction([
    db.attendance.updateMany({ where: { matchId }, data: { team: null, asGoalkeeper: false, ratingAtDraw: null } }),
    db.match.update({ where: { id: matchId }, data: { status: "OPEN", votingOpen: false } }),
  ]);
  touch(matchId);
}

/**
 * Reorganiza o equilíbrio entre times com o mínimo de trocas possíveis (empréstimo de jogador).
 * Encontra a menor troca que minimiza a diferença de forças entre os times.
 */
export async function reorganizeTeams(matchId: string) {
  await requireAdmin();
  const match = await getMatch(matchId);
  if (!match || match.status !== "DRAWN") return;

  const validTeams = teamsFor(match.numTeams) as string[];
  const linePlayers = match.attendances.filter((a) => a.team && !a.asGoalkeeper && validTeams.includes(a.team));

  if (linePlayers.length < 2) return;

  // Força atual de cada time
  const teamStrengths = new Map<string, number>();
  for (const t of validTeams) {
    const sum = linePlayers
      .filter((p) => p.team === t)
      .reduce((s, p) => s + (p.ratingAtDraw ?? p.player.baseRating), 0);
    teamStrengths.set(t, sum);
  }

  // Diferença atual máxima - mínima
  const strengths = Array.from(teamStrengths.values());
  const currentDiff = Math.max(...strengths) - Math.min(...strengths);

  // Cenário 1: Troca 1 por 1 entre dois times (swap)
  let bestSwap: { p1: typeof linePlayers[0]; p2: typeof linePlayers[0]; newDiff: number } | null = null;
  let minDiff = currentDiff;

  for (let i = 0; i < linePlayers.length; i++) {
    for (let j = i + 1; j < linePlayers.length; j++) {
      const p1 = linePlayers[i];
      const p2 = linePlayers[j];
      if (p1.team === p2.team) continue;

      const r1 = p1.ratingAtDraw ?? p1.player.baseRating;
      const r2 = p2.ratingAtDraw ?? p2.player.baseRating;

      const simStrengths = validTeams.map((t) => {
        let s = teamStrengths.get(t) ?? 0;
        if (t === p1.team) s = s - r1 + r2;
        if (t === p2.team) s = s - r2 + r1;
        return s;
      });

      const diff = Math.max(...simStrengths) - Math.min(...simStrengths);
      if (diff < minDiff) {
        minDiff = diff;
        bestSwap = { p1, p2, newDiff: diff };
      }
    }
  }

  // Cenário 2: Se os times tiverem número desigual de jogadores de linha, uma transferência direta
  const counts = validTeams.map((t) => linePlayers.filter((p) => p.team === t).length);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  let bestTransfer: { p: typeof linePlayers[0]; toTeam: string; newDiff: number } | null = null;
  if (maxCount - minCount > 0) {
    for (const p of linePlayers) {
      const fromTeam = p.team!;
      if (linePlayers.filter((x) => x.team === fromTeam).length <= minCount) continue;
      const r = p.ratingAtDraw ?? p.player.baseRating;

      for (const toTeam of validTeams) {
        if (toTeam === fromTeam) continue;
        if (linePlayers.filter((x) => x.team === toTeam).length >= maxCount) continue;

        const simStrengths = validTeams.map((t) => {
          let s = teamStrengths.get(t) ?? 0;
          if (t === fromTeam) s -= r;
          if (t === toTeam) s += r;
          return s;
        });

        const diff = Math.max(...simStrengths) - Math.min(...simStrengths);
        if (diff < minDiff) {
          minDiff = diff;
          bestTransfer = { p, toTeam, newDiff: diff };
        }
      }
    }
  }

  // Aplicar a melhor reorganização mínima encontrada
  if (bestTransfer) {
    await db.attendance.update({
      where: { id: bestTransfer.p.id },
      data: { team: bestTransfer.toTeam },
    });
  } else if (bestSwap) {
    await db.$transaction([
      db.attendance.update({
        where: { id: bestSwap.p1.id },
        data: { team: bestSwap.p2.team },
      }),
      db.attendance.update({
        where: { id: bestSwap.p2.id },
        data: { team: bestSwap.p1.team },
      }),
    ]);
  }

  touch(matchId);
}

/** Troca de colete, promoção de reserva ou envio para o banco. */
export async function setTeam(matchId: string, attendanceId: string, formData: FormData) {
  await requireAdmin();
  const raw = str(formData, "team");
  const att = await db.attendance.findFirst({
    where: { id: attendanceId, matchId },
    include: { player: true, match: true },
  });
  if (!att || att.match.status === "FINISHED") return;
  const team = isTeam(raw) && teamsFor(att.match.numTeams).includes(raw) ? raw : null;
  await db.attendance.update({
    where: { id: att.id },
    data: {
      team,
      asGoalkeeper: team ? att.asGoalkeeper : false,
      ratingAtDraw: team ? (att.ratingAtDraw ?? att.player.baseRating) : null,
    },
  });
  touch(matchId);
}

export async function toggleGoalkeeper(matchId: string, attendanceId: string) {
  await requireAdmin();
  const att = await db.attendance.findFirst({ where: { id: attendanceId, matchId } });
  if (!att || !att.team) return;
  await db.attendance.update({ where: { id: att.id }, data: { asGoalkeeper: !att.asGoalkeeper } });
  touch(matchId);
}

/* ---------- Placares ---------- */

export async function addGame(matchId: string, formData: FormData) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status === "OPEN") return;
  const valid = teamsFor(match.numTeams) as string[];
  const teamA = str(formData, "teamA");
  const teamB = str(formData, "teamB");
  if (!valid.includes(teamA) || !valid.includes(teamB) || teamA === teamB) return;
  await db.game.create({
    data: {
      matchId,
      teamA,
      teamB,
      scoreA: intIn(str(formData, "scoreA"), 0, 99, 0),
      scoreB: intIn(str(formData, "scoreB"), 0, 99, 0),
    },
  });
  touch(matchId);
}

export async function deleteGame(matchId: string, gameId: string) {
  await requireAdmin();
  await db.game.deleteMany({ where: { id: gameId, matchId } });
  touch(matchId);
}

/* ---------- Votação ---------- */

export async function openVoting(matchId: string) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "DRAWN") return;
  await db.match.update({ where: { id: matchId }, data: { votingOpen: true } });
  touch(matchId);
}

/** Fecha a votação, aplica as médias nas notas base e encerra a partida. */
export async function closeVoting(matchId: string) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "DRAWN") return;

  const averages = await db.vote.groupBy({
    by: ["targetId"],
    where: { matchId },
    _avg: { score: true },
  });
  const players = await db.player.findMany({ where: { id: { in: averages.map((a) => a.targetId) } } });
  const avgOf = new Map(averages.map((a) => [a.targetId, a._avg.score ?? null]));

  await db.$transaction([
    ...players.flatMap((p) => {
      const avg = avgOf.get(p.id);
      if (avg == null) return [];
      return [
        db.player.update({
          where: { id: p.id },
          data: {
            baseRating: nextBaseRating(p.baseRating, p.ratedMatches, avg),
            ratedMatches: { increment: 1 },
          },
        }),
      ];
    }),
    db.match.update({ where: { id: matchId }, data: { status: "FINISHED", votingOpen: false } }),
  ]);
  touch(matchId);
  revalidatePath("/historico");
}
