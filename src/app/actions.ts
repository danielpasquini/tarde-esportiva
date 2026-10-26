"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { normalizeScore } from "@/lib/rating";

function touch(matchId: string) {
  revalidatePath(`/partida/${matchId}`);
  revalidatePath(`/admin/partida/${matchId}`);
}

export async function confirmPresence(matchId: string, formData: FormData) {
  const playerId = String(formData.get("playerId") ?? "");
  const [match, player] = await Promise.all([
    db.match.findUnique({ where: { id: matchId } }),
    db.player.findFirst({ where: { id: playerId, active: true } }),
  ]);
  if (!match || match.status === "FINISHED" || !player) return;
  await db.attendance.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: { matchId, playerId },
    update: {},
  });
  touch(matchId);
}

export async function cancelPresence(matchId: string, formData: FormData) {
  const playerId = String(formData.get("playerId") ?? "");
  const match = await db.match.findUnique({ where: { id: matchId } });
  // Depois do sorteio, desistências são tratadas pelo organizador.
  if (!match || match.status !== "OPEN") return;
  await db.attendance.deleteMany({ where: { matchId, playerId } });
  touch(matchId);
}

export type VoteInput = { targetId: string; score: number };

export async function submitVotes(
  token: string,
  voterId: string,
  votes: VoteInput[],
): Promise<{ ok: boolean; error?: string; saved?: number }> {
  const match = await db.match.findUnique({
    where: { voteToken: token },
    include: { attendances: true },
  });
  if (!match || !match.votingOpen) return { ok: false, error: "A votação desta partida está fechada." };

  const played = new Set(match.attendances.map((a) => a.playerId));
  if (!played.has(voterId)) return { ok: false, error: "Jogador não encontrado nesta partida." };

  const alreadyVoted = await db.vote.findFirst({
    where: { matchId: match.id, voterId },
  });
  if (alreadyVoted) {
    return { ok: false, error: "Você já enviou seu voto para esta partida e não pode votar novamente." };
  }

  const clean = new Map<string, number>();
  for (const v of Array.isArray(votes) ? votes : []) {
    const score = normalizeScore(Number(v?.score));
    if (score == null || v.targetId === voterId || !played.has(v.targetId)) continue;
    clean.set(v.targetId, score);
  }
  if (clean.size === 0) return { ok: false, error: "Avalie pelo menos um jogador para confirmar seu voto." };

  await db.$transaction(
    [...clean].map(([targetId, score]) =>
      db.vote.upsert({
        where: { matchId_voterId_targetId: { matchId: match.id, voterId, targetId } },
        create: { matchId: match.id, voterId, targetId, score },
        update: { score },
      }),
    ),
  );
  revalidatePath(`/votar/${token}`);
  return { ok: true, saved: clean.size };
}

export async function setPlayerPin(
  playerId: string,
  pin: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanPin = pin.trim();
  if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
    return { ok: false, error: "O PIN deve conter exatamente 4 números." };
  }
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return { ok: false, error: "Jogador não encontrado." };

  await db.player.update({
    where: { id: playerId },
    data: { pin: cleanPin },
  });

  const cookieStore = await cookies();
  cookieStore.set(`player_pin_${playerId}`, cleanPin, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });

  revalidatePath(`/perfil/${playerId}`);
  revalidatePath(`/historico`);
  return { ok: true };
}

export async function verifyPlayerPin(
  playerId: string,
  pin: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanPin = pin.trim();
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return { ok: false, error: "Jogador não encontrado." };
  if (!player.pin) return { ok: true };

  if (player.pin !== cleanPin) {
    return {
      ok: false,
      error: "PIN incorreto. Se você esqueceu seu PIN, peça para o organizador resetá-lo.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(`player_pin_${playerId}`, cleanPin, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return { ok: true };
}

export async function togglePlayerPublic(
  playerId: string
): Promise<{ ok: boolean; isPublic?: boolean }> {
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return { ok: false };
  const updated = await db.player.update({
    where: { id: playerId },
    data: { isPublic: !player.isPublic },
  });
  revalidatePath(`/perfil/${playerId}`);
  revalidatePath(`/historico`);
  return { ok: true, isPublic: updated.isPublic };
}
