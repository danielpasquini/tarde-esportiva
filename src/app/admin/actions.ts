"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, signIn, signOut } from "@/lib/auth";
import { getMatch } from "@/lib/match";
import { splitRoster, snakeDraft, balanceWithBorrows, type Assignment, type Candidate } from "@/lib/draw";
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
  const location = str(formData, "location") || null;
  const rawCost = str(formData, "cost").replace(",", ".");
  const cost = rawCost && !Number.isNaN(Number(rawCost)) ? Math.max(0, Number(rawCost)) : null;

  const match = await db.match.create({
    data: {
      date,
      location,
      cost,
      numTeams: intIn(str(formData, "numTeams"), 2, 4, 2),
      lineSize: intIn(str(formData, "lineSize"), 3, 6, 5),
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

  const numTeams = intIn(str(formData, "numTeams"), 2, 4, match.numTeams);
  const lineSize = intIn(str(formData, "lineSize"), 3, 6, match.lineSize);

  const rawStatus = str(formData, "status");
  const validStatuses = ["OPEN", "DRAWN", "FINISHED"];
  const status = validStatuses.includes(rawStatus) ? rawStatus : match.status;

  const votingOpenRaw = str(formData, "votingOpen");
  const votingOpen = status === "OPEN" ? false : votingOpenRaw === "true";

  const validTeams = teamsFor(numTeams) as string[];

  await db.$transaction(async (tx) => {
    if (status === "OPEN" && match.status !== "OPEN") {
      await tx.attendance.updateMany({
        where: { matchId },
        data: { team: null, asGoalkeeper: false, ratingAtDraw: null, borrowedToTeam: null, borrowedAsGk: false },
      });
    } else if (numTeams < match.numTeams) {
      await tx.attendance.updateMany({
        where: {
          matchId,
          team: { notIn: validTeams },
        },
        data: { team: null, asGoalkeeper: false, ratingAtDraw: null, borrowedToTeam: null, borrowedAsGk: false },
      });
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        ...(date ? { date } : {}),
        location,
        cost,
        numTeams,
        lineSize,
        status,
        votingOpen,
      },
    });
  });

  touch(matchId);
  revalidatePath("/admin");
  revalidatePath("/historico");
  revalidatePath(`/partida/${matchId}`);
}

export async function applySuggestedFormat(matchId: string, formData: FormData) {
  await requireAdmin();
  const lineSize = intIn(str(formData, "lineSize"), 3, 6, 5);
  const numTeamsRaw = str(formData, "numTeams");
  const numTeams = numTeamsRaw ? intIn(numTeamsRaw, 2, 4, 2) : undefined;

  await db.match.update({
    where: { id: matchId },
    data: {
      lineSize,
      ...(numTeams ? { numTeams } : {}),
    },
  });

  touch(matchId);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/partida/${matchId}`);
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

export async function drawTeams(matchId: string, formData?: FormData) {
  await requireAdmin();
  const match = await getMatch(matchId);
  if (!match || match.status === "FINISHED") return;

  const fixedGkParam = formData ? str(formData, "fixedGk") !== "false" : true;

  const candidates = match.attendances.map((a) => ({
    playerId: a.playerId,
    rating: a.player.baseRating,
    isGoalkeeper: fixedGkParam ? a.player.isGoalkeeper : false,
  }));
  const ratingOf = new Map(candidates.map((c) => [c.playerId, c.rating]));
  const { goalkeepers, line } = splitRoster(candidates, match.numTeams, match.lineSize);
  const assignments = snakeDraft(teamsFor(match.numTeams), goalkeepers, line, match.lineSize);

  await db.$transaction([
    db.attendance.updateMany({
      where: { matchId },
      data: {
        team: null,
        asGoalkeeper: false,
        ratingAtDraw: null,
        borrowedToTeam: null,
        borrowedAsGk: false,
        isUnavailable: false,
        unavailableReason: null,
      },
    }),
    ...assignments.map((a) =>
      db.attendance.update({
        where: { matchId_playerId: { matchId, playerId: a.playerId } },
        data: {
          team: a.team,
          asGoalkeeper: a.asGoalkeeper,
          ratingAtDraw: ratingOf.get(a.playerId),
          borrowedToTeam: a.borrowedToTeam ?? null,
          borrowedAsGk: a.borrowedAsGk ?? false,
        },
      }),
    ),
    db.match.update({ where: { id: matchId }, data: { status: "DRAWN" } }),
  ]);
  touch(matchId);
}

export async function toggleFixedGkMode(matchId: string) {
  await requireAdmin();
  const match = await getMatch(matchId);
  if (!match || match.status !== "DRAWN") return;

  const hasAnyGk = match.attendances.some((a) => a.asGoalkeeper);

  if (hasAnyGk) {
    // Desativa goleiros fixos: todos viram jogadores normais
    await db.attendance.updateMany({
      where: { matchId },
      data: { asGoalkeeper: false },
    });
  } else {
    // Ativa goleiros fixos: jogadores cadastrados como goleiro viram fixos
    const gkAttendances = match.attendances.filter((a) => a.player.isGoalkeeper && a.team);
    const usedTeams = new Set<string>();
    for (const att of gkAttendances) {
      if (att.team && !usedTeams.has(att.team)) {
        usedTeams.add(att.team);
        await db.attendance.update({
          where: { id: att.id },
          data: { asGoalkeeper: true },
        });
      }
    }
  }

  touch(matchId);
}

export async function reopenList(matchId: string) {
  await requireAdmin();
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "DRAWN") return;
  await db.$transaction([
    db.attendance.updateMany({
      where: { matchId },
      data: {
        team: null,
        asGoalkeeper: false,
        ratingAtDraw: null,
        borrowedToTeam: null,
        borrowedAsGk: false,
        isUnavailable: false,
        unavailableReason: null,
      },
    }),
    db.match.update({ where: { id: matchId }, data: { status: "OPEN", votingOpen: false } }),
  ]);
  touch(matchId);
}

/** Marca ou desmarca jogador como indisponível */
export async function togglePlayerUnavailable(matchId: string, attendanceId: string, reason?: string) {
  await requireAdmin();
  const att = await db.attendance.findFirst({ where: { id: attendanceId, matchId } });
  if (!att) return;

  const newUnavailable = !att.isUnavailable;
  await db.attendance.update({
    where: { id: att.id },
    data: {
      isUnavailable: newUnavailable,
      unavailableReason: newUnavailable ? (reason || "Indisponível") : null,
      borrowedToTeam: newUnavailable ? null : att.borrowedToTeam,
    },
  });
  touch(matchId);
}

/**
 * Microreorganização balanceada:
 * Se houver desfalques ou diferença de jogadores:
 * É estritamente proibido que um time tenha 6 jogadores (contando o goleiro, fixo ou não) e outro 7.
 * O balanceamento se dará por empréstimo do time que não está jogando.
 */
export async function microReorganize(matchId: string) {
  await requireAdmin();
  const match = await getMatch(matchId);
  if (!match || match.status !== "DRAWN") return;

  const validTeams = teamsFor(match.numTeams) as string[];
  const matchPlayers = match.attendances.filter(
    (a) => a.team && validTeams.includes(a.team)
  );

  const unavailableIds = new Set(
    match.attendances.filter((a) => a.isUnavailable).map((a) => a.playerId)
  );

  const assignments: Assignment[] = matchPlayers.map((a) => ({
    playerId: a.playerId,
    team: a.team!,
    asGoalkeeper: a.asGoalkeeper,
    borrowedToTeam: null,
  }));

  const allCandidates: Candidate[] = matchPlayers.map((a) => ({
    playerId: a.playerId,
    rating: a.ratingAtDraw ?? a.player.baseRating,
    isGoalkeeper: a.asGoalkeeper,
  }));

  balanceWithBorrows(validTeams, assignments, allCandidates, match.lineSize, unavailableIds);

  await db.$transaction([
    db.attendance.updateMany({
      where: { matchId },
      data: { borrowedToTeam: null },
    }),
    ...assignments
      .filter((a) => a.borrowedToTeam)
      .map((a) =>
        db.attendance.update({
          where: { matchId_playerId: { matchId, playerId: a.playerId } },
          data: { borrowedToTeam: a.borrowedToTeam },
        })
      ),
  ]);

  touch(matchId);
}

/**
 * Plano B: Reorganização definitiva pequena nos times e goleiros.
 * Regra Estrita: É estritamente proibido que um time tenha 6 jogadores (contando o goleiro, fixo ou não) e outro tenha 7.
 * O balanceamento se dará por empréstimo do time que não está jogando,
 * ou por tirar um goleiro fixo (definido previamente via sorteio), e um jogador toma lugar de goleiro.
 */
export async function planBReorganize(matchId: string) {
  await requireAdmin();
  const match = await getMatch(matchId);
  if (!match || match.status !== "DRAWN") return;

  const validTeams = teamsFor(match.numTeams) as string[];

  // 1. Ajuste de goleiros caso haja times desfalcados de goleiro fixo
  const hasFixedGk = match.attendances.some((a) => a.asGoalkeeper);
  if (hasFixedGk) {
    for (const team of validTeams) {
      const hasKeeper = match.attendances.some((a) => a.team === team && a.asGoalkeeper && !a.isUnavailable);
      if (!hasKeeper) {
        // Se outro time tem goleiro extra, remaneja
        const donorKeeper = match.attendances.find((a) => a.team !== team && a.asGoalkeeper && !a.isUnavailable);
        if (donorKeeper) {
          await db.attendance.update({
            where: { id: donorKeeper.id },
            data: { team, borrowedToTeam: null },
          });
          donorKeeper.team = team;
        } else {
          // "um jogador toma lugar de goleiro"
          const candidatePlayer = match.attendances.find((a) => a.team === team && !a.isUnavailable);
          if (candidatePlayer) {
            await db.attendance.update({
              where: { id: candidatePlayer.id },
              data: { asGoalkeeper: true },
            });
            candidatePlayer.asGoalkeeper = true;
          }
        }
      }
    }
  }

  // 2. Rebalanceamento permanente contando o goleiro (fixo ou não)
  const getTotalTeamCount = (t: string) =>
    match.attendances.filter((a) => a.team === t && !a.isUnavailable).length;

  let minTeam = validTeams.reduce((min, t) => (getTotalTeamCount(t) < getTotalTeamCount(min) ? t : min), validTeams[0]);
  let maxTeam = validTeams.reduce((max, t) => (getTotalTeamCount(t) > getTotalTeamCount(max) ? t : max), validTeams[0]);

  while (getTotalTeamCount(maxTeam) - getTotalTeamCount(minTeam) >= 2) {
    const donorPlayers = match.attendances.filter(
      (a) => a.team === maxTeam && !a.asGoalkeeper && !a.isUnavailable
    );
    if (!donorPlayers.length) break;

    donorPlayers.sort((a, b) => (b.ratingAtDraw ?? b.player.baseRating) - (a.ratingAtDraw ?? a.player.baseRating));
    const chosen = donorPlayers[Math.floor(donorPlayers.length / 2)] ?? donorPlayers[0];

    await db.attendance.update({
      where: { id: chosen.id },
      data: { team: minTeam, borrowedToTeam: null },
    });
    chosen.team = minTeam;

    minTeam = validTeams.reduce((min, t) => (getTotalTeamCount(t) < getTotalTeamCount(min) ? t : min), validTeams[0]);
    maxTeam = validTeams.reduce((max, t) => (getTotalTeamCount(t) > getTotalTeamCount(max) ? t : max), validTeams[0]);
  }

  // Se houver 2 times e a contagem for diferente (ex: 5 vs 6, ou 6 vs 7):
  // Regra Estrita: Não pode haver um número diferente em cada time!
  // O balanceamento se dará por tirar um goleiro fixo (definido previamente via sorteio), e um jogador toma lugar de goleiro.
  if (
    validTeams.length === 2 &&
    getTotalTeamCount(maxTeam) !== getTotalTeamCount(minTeam)
  ) {
    const fixedGks = match.attendances.filter((a) => a.asGoalkeeper && !a.isUnavailable);
    if (fixedGks.length >= 2) {
      // Sorteia qual goleiro fixo perde o posto
      const chosenGkToRemove = fixedGks[Math.floor(Math.random() * fixedGks.length)];
      await db.attendance.update({
        where: { id: chosenGkToRemove.id },
        data: { asGoalkeeper: false, team: null },
      });
      chosenGkToRemove.asGoalkeeper = false;
      chosenGkToRemove.team = null;

      // Um jogador toma lugar de goleiro no outro time
      const playerForGk = match.attendances.find(
        (a) => a.team !== chosenGkToRemove.team && !a.asGoalkeeper && !a.isUnavailable
      );
      if (playerForGk) {
        await db.attendance.update({
          where: { id: playerForGk.id },
          data: { asGoalkeeper: true },
        });
        playerForGk.asGoalkeeper = true;
      }
    } else {
      // Se não há 2 goleiros fixos, remove o jogador excedente do time maior para manter paridade absoluta
      const donor = match.attendances.find(
        (a) => a.team === maxTeam && !a.asGoalkeeper && !a.isUnavailable
      );
      if (donor) {
        await db.attendance.update({
          where: { id: donor.id },
          data: { team: null, borrowedToTeam: null },
        });
        donor.team = null;
      }
    }
  }

  // Limpa empréstimos temporários para manter a reorganização limpa
  await db.attendance.updateMany({
    where: { matchId },
    data: { borrowedToTeam: null },
  });

  // Se houver 3+ times e qualquer time tiver menos que o máximo (ex: 6 vs 7):
  // "o balanceamento se dará por empréstimo do time que não está jogando"
  if (validTeams.length >= 3) {
    const maxCount = Math.max(...validTeams.map(getTotalTeamCount));
    const minCount = Math.min(...validTeams.map(getTotalTeamCount));
    if (maxCount !== minCount) {
      await microReorganize(matchId);
      return;
    }
  }

  touch(matchId);
}

/** Troca de colete de um atleta. */
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
      borrowedToTeam: team === att.borrowedToTeam ? null : att.borrowedToTeam,
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