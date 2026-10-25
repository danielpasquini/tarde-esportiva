"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, signIn, signOut } from "@/lib/auth";
import { getMatch } from "@/lib/match";
import { splitRoster, snakeDraft } from "@/lib/draw";
import { isTeam, teamsFor } from "@/lib/teams";
import { nextBaseRating, normalizeScore } from "@/lib/rating";
import { parseLocalDateTime } from "@/lib/format";

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
  redirect(ok ? "/admin" : "/admin/entrar?erro=1");
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
  await db.match.delete({ where: { id: matchId } });
  revalidatePath("/admin");
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
