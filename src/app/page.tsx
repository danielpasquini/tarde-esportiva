import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { formatMatchDate } from "@/lib/format";
import { Empty, Loading, StatusStamp } from "@/components/ui";

async function UpcomingMatches() {
  await connection();
  const matches = await db.match.findMany({
    where: { status: { not: "FINISHED" } },
    orderBy: { date: "asc" },
    include: { _count: { select: { attendances: true } } },
  });

  if (!matches.length) {
    return (
      <div className="card card-pad text-center">
        <p className="display text-xl">Nenhuma pelada marcada</p>
        <p className="kicker mt-2">O organizador ainda não abriu a lista desta semana</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4">
      {matches.map((m, i) => (
        <li key={m.id} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
          <Link href={`/partida/${m.id}`} className="card card-pad card-link" id={`partida-${m.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="kicker">Próxima rodada</p>
                <p className="card-title mt-1 first-letter:uppercase">{formatMatchDate(m.date)}</p>
              </div>
              <StatusStamp status={m.status} votingOpen={m.votingOpen} />
            </div>
            <hr className="rule my-3" />
            <div className="flex items-center justify-between mono text-sm">
              <span>
                {m.numTeams} times × {m.lineSize} na linha
              </span>
              <span>
                {m._count.attendances}/{m.numTeams * m.lineSize} confirmados
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="text-center rise">
        <p className="kicker">Manchete do dia</p>
        <h1 className="display text-4xl mt-2">
          Bola rolando, <span className="text-brick">sem burocracia.</span>
        </h1>
        <p className="mt-3 text-ink/80">
          Confirme presença, confira seu colete e vote nos companheiros depois do jogo. Sem senha, sem cadastro.
        </p>
      </section>

      <section>
        <div className="section-head">
          <h2 className="display text-2xl">Peladas marcadas</h2>
          <Link href="/historico" className="kicker underline">
            Ver histórico
          </Link>
        </div>
        <Suspense fallback={<Loading />}>
          <UpcomingMatches />
        </Suspense>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        {[
          ["01", "Confirme", "Escolha seu nome na lista"],
          ["02", "Sorteio", "Times equilibrados pela nota"],
          ["03", "Vote", "Avalie quem jogou com você"],
        ].map(([n, t, d]) => (
          <div key={n} className="card p-3">
            <p className="display text-2xl text-gold">{n}</p>
            <p className="font-semibold mt-1">{t}</p>
            <p className="text-xs text-ink/70 mt-1">{d}</p>
          </div>
        ))}
      </section>
      <Empty>Organizador? Acesse a área do organizador no topo.</Empty>
    </div>
  );
}
