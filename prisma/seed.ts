import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { nextBaseRating } from "../src/lib/rating";

const url =
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  "file:./dev.db";

const adapter = url.startsWith("file:")
  ? new PrismaBetterSqlite3({ url })
  : new PrismaPg(new Pool({ connectionString: url }));

const db = new PrismaClient({ adapter });

const VALID_SCORES = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

function randomScore(): number {
  // Distribuição realista entre 1.0 e 5.0 em passos de 0.5
  return VALID_SCORES[Math.floor(Math.random() * VALID_SCORES.length)];
}

async function main() {
  console.log("Iniciando seed do Tarde Esportiva (branch main + 5 partidas completas)...");

  // Limpar base anterior para garantir exatamente os jogadores e partidas da main + 5 jogos completos
  await db.vote.deleteMany();
  await db.attendance.deleteMany();
  await db.match.deleteMany();
  await db.player.deleteMany();

  // Lista oficial da branch main fornecida pelo organizador
  const userListText = `
    1. Paulo Ricardo 
    2. Tuguinho
    3. Ricardo
    4. Reinaldo 
    5. Claudemir 
    6. Thailyne 
    7. Caio 
    8. Guilherme 
    9. Ge
    10. Alex
    11. Victor 
    12. Rodrigo 
    13. marcio14.  Godoy
    15.  Marques 
    16. Lut
    17. Jota
    18. Queslei
    19. Jhonatan 
    20. Calebe
    21. Anezio
    22. marcelo
    23. Daniel
    24. Claudecir
  `;

  // Parse e normalização com deduplicação (idêntico à branch main)
  const rawLines = userListText
    .replace(/([^\s\d])\s*(\d+[\.\-\)])/g, "$1\n$2")
    .split(/[\r\n]+/);

  const seen = new Set<string>();
  const officialPlayers: { name: string; isGoalkeeper: boolean; baseRating: number | null }[] = [];

  for (const line of rawLines) {
    const clean = line.replace(/^[\s\d.-]+/, "").trim();
    if (!clean) continue;
    const words = clean.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const formatted = words.join(" ");
    const key = formatted.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      officialPlayers.push({ name: formatted, isGoalkeeper: false, baseRating: null });
    }
  }

  const createdPlayers = [];
  for (const p of officialPlayers) {
    const created = await db.player.create({
      data: { ...p, active: true, ratedMatches: 0 },
    });
    createdPlayers.push(created);
  }
  console.log(`${createdPlayers.length} jogadores da branch main importados.`);

  // Calcular próximo sábado às 15:00 (como na branch main)
  const nextSaturday = new Date();
  nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7));
  nextSaturday.setHours(15, 0, 0, 0);

  // Estado em memória para atualizar baseRating e ratedMatches após cada partida encerrada
  const playerStats = new Map<string, { baseRating: number | null; ratedMatches: number }>(
    createdPlayers.map((p) => [p.id, { baseRating: p.baseRating, ratedMatches: p.ratedMatches }])
  );

  // Criar 5 partidas completas fictícias nos 5 sábados anteriores onde todos votaram em todos
  for (let weekOffset = 5; weekOffset >= 1; weekOffset--) {
    const matchDate = new Date(nextSaturday);
    matchDate.setDate(matchDate.getDate() - weekOffset * 7);

    // Selecionar 16 jogadores rotacionando a lista para todos participarem ao longo das 5 partidas
    const startIdx = ((5 - weekOffset) * 4) % createdPlayers.length;
    const matchPlayers = [];
    for (let i = 0; i < 16; i++) {
      matchPlayers.push(createdPlayers[(startIdx + i) % createdPlayers.length]);
    }

    const finishedMatch = await db.match.create({
      data: {
        date: matchDate,
        numTeams: 2,
        lineSize: 5,
        status: "FINISHED",
        votingOpen: false,
      },
    });

    // Registrar presença de todos os participantes da partida
    await db.attendance.createMany({
      data: matchPlayers.map((p) => ({
        matchId: finishedMatch.id,
        playerId: p.id,
      })),
    });

    // Todos votam em todos (voterId !== targetId) com notas aleatórias
    const votesData: { matchId: string; voterId: string; targetId: string; score: number }[] = [];
    const scoresByTarget = new Map<string, number[]>();

    for (const voter of matchPlayers) {
      for (const target of matchPlayers) {
        if (voter.id === target.id) continue;
        const score = randomScore();
        votesData.push({
          matchId: finishedMatch.id,
          voterId: voter.id,
          targetId: target.id,
          score,
        });
        const list = scoresByTarget.get(target.id) ?? [];
        list.push(score);
        scoresByTarget.set(target.id, list);
      }
    }

    await db.vote.createMany({ data: votesData });

    // Atualizar baseRating e ratedMatches de cada jogador avaliado na partida
    for (const p of matchPlayers) {
      const scores = scoresByTarget.get(p.id) ?? [];
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const st = playerStats.get(p.id)!;
        st.baseRating = nextBaseRating(st.baseRating, st.ratedMatches, avg);
        st.ratedMatches += 1;
      }
    }

    console.log(
      `Partida finalizada #${6 - weekOffset} criada (${matchDate.toLocaleDateString("pt-BR")}) com ${matchPlayers.length} jogadores e ${votesData.length} votos.`
    );
  }

  // Persistir baseRating e ratedMatches atualizados no banco
  for (const [playerId, st] of playerStats.entries()) {
    await db.player.update({
      where: { id: playerId },
      data: {
        baseRating: st.baseRating,
        ratedMatches: st.ratedMatches,
      },
    });
  }

  // Criar a partida aberta da branch main (próximo sábado às 15:00 com os 8 primeiros confirmados)
  const openMatch = await db.match.create({
    data: {
      date: nextSaturday,
      numTeams: 2,
      lineSize: 5,
      status: "OPEN",
    },
  });

  const firstEight = createdPlayers.slice(0, 8);
  for (const p of firstEight) {
    await db.attendance.create({
      data: {
        matchId: openMatch.id,
        playerId: p.id,
      },
    });
  }
  console.log(`Partida aberta da branch main criada para ${nextSaturday.toLocaleDateString("pt-BR")} com ${firstEight.length} confirmados.`);
  console.log("Seed finalizado com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
