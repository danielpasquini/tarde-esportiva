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

  // Lista oficial fornecida pelo organizador
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

  // Parse e normalização com deduplicação
  const rawLines = userListText
    .replace(/([^\s\d])\s*(\d+[\.\-\)])/g, "$1\n$2")
    .split(/[\r\n]+/);

  const seen = new Set<string>();
  const officialPlayers: { name: string; isGoalkeeper: boolean; baseRating: number }[] = [];

  for (const line of rawLines) {
    const clean = line.replace(/^[\s\d.-]+/, "").trim();
    if (!clean) continue;
    const words = clean.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const formatted = words.join(" ");
    const key = formatted.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      officialPlayers.push({ name: formatted, isGoalkeeper: false, baseRating: 3.5 });
    }
  }

  for (const p of officialPlayers) {
    await db.player.upsert({
      where: { name: p.name },
      create: { ...p, active: true },
      update: { active: true },
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
