import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url =
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  "file:./dev.db";

const adapter = url.startsWith("file:")
  ? new PrismaBetterSqlite3({ url })
  : new PrismaPg(new Pool({ connectionString: url }));

const db = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando seed do Tarde Esportiva...");

  // Criar jogadores clássicos com notas 1 a 5 (meias estrelas)
  const players = [
    { name: "Zico", isGoalkeeper: false, baseRating: 5.0 },
    { name: "Sócrates", isGoalkeeper: false, baseRating: 4.5 },
    { name: "Falcão", isGoalkeeper: false, baseRating: 4.5 },
    { name: "Rivelino", isGoalkeeper: false, baseRating: 4.5 },
    { name: "Júnior", isGoalkeeper: false, baseRating: 4.0 },
    { name: "Toninho Cerezo", isGoalkeeper: false, baseRating: 4.0 },
    { name: "Éder Aleixo", isGoalkeeper: false, baseRating: 4.0 },
    { name: "Cláudio Adão", isGoalkeeper: false, baseRating: 3.5 },
    { name: "Careca", isGoalkeeper: false, baseRating: 4.0 },
    { name: "Reinaldo", isGoalkeeper: false, baseRating: 3.5 },
    { name: "Nelinho", isGoalkeeper: false, baseRating: 3.5 },
    { name: "Leandro", isGoalkeeper: false, baseRating: 4.0 },
    { name: "Batista", isGoalkeeper: false, baseRating: 3.0 },
    { name: "Dirceu", isGoalkeeper: false, baseRating: 3.5 },
    { name: "Serginho Chulapa", isGoalkeeper: false, baseRating: 3.0 },
    { name: "Waldir Peres", isGoalkeeper: true, baseRating: 3.5 },
    { name: "Carlos Gallo", isGoalkeeper: true, baseRating: 4.0 },
    { name: "Emerson Leão", isGoalkeeper: true, baseRating: 4.5 },
  ];

  for (const p of players) {
    await db.player.upsert({
      where: { name: p.name },
      create: { ...p, ratedMatches: 3 },
      update: {},
    });
  }

  // Criar uma partida aberta para sábado às 15:00
  const existingMatch = await db.match.findFirst();
  if (!existingMatch) {
    const nextSaturday = new Date();
    nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7));
    nextSaturday.setHours(15, 0, 0, 0);

    const match = await db.match.create({
      data: {
        date: nextSaturday,
        numTeams: 2,
        lineSize: 5,
        status: "OPEN",
      },
    });

    // Confirmar os 8 primeiros como demonstração
    const all = await db.player.findMany({ take: 8 });
    for (const p of all) {
      await db.attendance.create({
        data: {
          matchId: match.id,
          playerId: p.id,
        },
      });
    }
    console.log(`Partida de demonstração criada para ${nextSaturday.toLocaleDateString("pt-BR")}`);
  }

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
