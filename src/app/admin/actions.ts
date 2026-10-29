"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, signIn, signOut } from "@/lib/auth";
import { nextBaseRating, revertBaseRating, normalizeScore } from "@/lib/rating";
import { parseLocalDateTime } from "@/lib/format";
import { parseNumberedRoster } from "@/lib/parse-roster";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function touch(matchId: string) {
  revalidatePath(`/admin/partida/${matchId}`);
  revalidatePath(`/partida/${matchId}`);
  revalidatePath("/");
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
  const rawRating = str(formData, "baseRating");
  const baseRating = rawRating ? normalizeScore(Number(rawRating)) : null;
  await db.player.upsert({
    where: { name },
    create: { name, baseRating, isGoalkeeper: formData.get("isGoalkeeper") === "on" },
    update: { active: true },
  });
  revalidatePath("/admin/jogadores");
  revalidatePath("/historico");
}

export async function importPlayersBatch(formData: FormData) {
  await requireAdmin();
  const rawText = str(formData, "names");
  const names = parseNumberedRoster(rawText);
  if (names.length === 0) return;

  const rawRating = str(formData, "baseRating");
  const baseRating = rawRating ? normalizeScore(Number(rawRating)) : null;

  for (const name of names) {
    await db.player.upsert({
      where: { name },
      create: { name, baseRating, isGoalkeeper: false },
      update: { active: true },
    });
  }

  revalidatePath("/admin/jogadores");
  revalidatePath("/admin");
  revalidatePath("/historico");
}

export async function updatePlayer(playerId: string, formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name").slice(0, 40);
  const rawRating = str(formData, "baseRating");
  const baseRating = rawRating ? normalizeScore(Number(rawRating)) : null;
  const clash = name ? await db.player.findFirst({ where: { name, NOT: { id: playerId } } }) : null;
  await db.player.update({
    where: { id: playerId },
    data: {
      ...(name && !clash ? { name } : {}),
      baseRating: rawRating ? baseRating : null,
      isGoalkeeper: formData.get("isGoalkeeper") === "on",
      active: formData.get("active") === "on",
    },
  });
  revalidatePath("/admin/jogadores");
  revalidatePath("/historico");
  revalidatePath(`/perfil/${playerId}`);
}

export async function deletePlayer(playerId: string) {
  await requireAdmin();
  await db.player.delete({
    where: { id: playerId },
  });
  revalidatePath("/admin/jogadores");
  revalidatePath("/admin");
  revalidatePath("/historico");
}

/* ---------- Partidas ---------- */

export async function createMatch(formData: FormData) {
  await requireAdmin();
  const date = parseLocalDateTime(str(formData, "date")) ?? new Date();
  const location = str(formData, "location") || null;
  const rawCost = str(formData, "cost").replace(",", ".");
  const cost = rawCost && !Number.isNaN(Number(rawCost)) ? Math.max(0, Number(rawCost)) : null;

  const match = await db.match.create({
    data: {
      date,
      location,
      cost,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  redirect(`/admin/partida/${match.id}`);
}

export async function updateMatchConfig(matchId: string, formData: FormData) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) return;

  const date = parseLocalDateTime(str(formData, "date"));
  const location = str(formData, "location") || null;
  const rawCost = str(formData, "cost").replace(",", ".");
  const cost = rawCost && !Number.isNaN(Number(rawCost)) ? Math.max(0, Number(rawCost)) : null;

  await db.match.update({
    where: { id: matchId },
    data: {
      ...(date ? { date } : {}),
      location,
      cost,
    },
  });

  touch(matchId);
  revalidatePath("/admin");
  revalidatePath("/historico");
}

export async function deleteMatch(matchId: string) {
  await requireAdmin();
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { votes: true },
  });

  if (match && match.status === "FINISHED") {
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
  if (!match || ids.length === 0) return;
  const players = await db.player.findMany({ where: { id: { in: ids }, active: true } });
  for (const p of players) {
    await db.attendance.upsert({
      where: { matchId_playerId: { matchId, playerId: p.id } },
      create: { matchId, playerId: p.id },
      update: {},
    });
  }
  touch(matchId);
  revalidatePath("/historico");
}

export async function addAttendancesByText(matchId: string, formData: FormData) {
  await requireAdmin();
  const rawText = str(formData, "names");
  const names = parseNumberedRoster(rawText);
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || names.length === 0) return;

  for (const name of names) {
    let player = await db.player.findUnique({ where: { name } });
    if (!player) {
      player = await db.player.create({
        data: { name, baseRating: null, active: true },
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
  revalidatePath("/historico");
}

export async function removeAttendance(matchId: string, attendanceId: string) {
  await requireAdmin();
  await db.attendance.deleteMany({ where: { id: attendanceId, matchId } });
  touch(matchId);
  revalidatePath("/historico");
}

export async function setAttendanceTeam(matchId: string, attendanceId: string, team: string | null) {
  await requireAdmin();
  const validTeam = team && ["azul", "vermelho", "preto", "amarelo"].includes(team) ? team : null;
  await db.attendance.updateMany({
    where: { id: attendanceId, matchId },
    data: { team: validTeam },
  });
  touch(matchId);
}

export async function setAttendanceGoalkeeper(
  matchId: string,
  attendanceId: string,
  playerId: string,
  isGoalkeeper: boolean,
) {
  await requireAdmin();
  await db.player.update({
    where: { id: playerId },
    data: { isGoalkeeper },
  });
  await db.attendance.updateMany({
    where: { id: attendanceId, matchId },
    data: { asGoalkeeper: isGoalkeeper },
  });
  touch(matchId);
  revalidatePath("/admin/jogadores");
  revalidatePath("/historico");
}

/* ---------- Votação ---------- */

export async function openVoting(matchId: string) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status === "FINISHED") return;
  await db.match.update({ where: { id: matchId }, data: { votingOpen: true } });
  touch(matchId);
}

/** Fecha a votação, aplica as médias nas notas base e encerra a partida. */
export async function closeVoting(matchId: string) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status === "FINISHED") return;

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

/** Reabre a votação de uma partida já finalizada, revertendo temporariamente as notas incorporadas. */
export async function reopenVoting(matchId: string) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "FINISHED") return;

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
    db.match.update({
      where: { id: matchId },
      data: { status: "OPEN", votingOpen: true },
    }),
  ]);

  touch(matchId);
  revalidatePath("/admin");
  revalidatePath("/historico");
}

export async function resetPlayerPin(playerId: string) {
  await requireAdmin();
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return;

  await db.player.update({
    where: { id: playerId },
    data: { pin: null },
  });

  revalidatePath(`/admin/jogadores`);
  revalidatePath(`/perfil/${playerId}`);
  revalidatePath(`/historico`);
}
