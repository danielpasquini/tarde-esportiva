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
  console.log("Banco de dados pronto (sem dados mock de jogadores ou partidas).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
