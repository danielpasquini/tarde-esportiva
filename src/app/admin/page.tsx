import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatMatchDate } from "@/lib/format";
import { createMatch, logout } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import { Empty, Loading, StatusStamp } from "@/components/ui";

export const metadata = { title: "Organizador" };

function defaultDate() {
  // Próximo sábado, 15h (horário de Brasília)
  const now = new Date(Date.now() - 3 * 3600_000);
  const d = new Date(now);
  d.setUTCDate(now.getUTCDate() + ((6 - now.getUTCDay() + 7) % 7 || 7));
  return `${d.toISOString().slice(0, 10)}T15:00`;
}

async function Dashboard() {
  await connection();
  await requireAdmin();
  const [matches, playerCount] = await Promise.all([
    db.match.findMany({ orderBy: { date: "desc" }, take: 30, include: { _count: { select: { attendances: true } } } }),
    db.player.count({ where: { active: true } }),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-3 rise">
        <div>
          <p className="kicker">Prancheta do técnico</p>
          <h1 className="display text-3xl mt-1">Organizador</h1>
        </div>
        <form action={logout}>
          <SubmitButton className="btn btn-sm" id="sair-admin" pendingLabel="…">
            Sair
          </SubmitButton>
        </form>
      </header>

      <Link href="/admin/jogadores" className="card card-pad card-link flex items-center justify-between" id="link-jogadores">
        <span>
          <span className="kicker block">Elenco</span>
          <span className="card-title">{playerCount} jogadores ativos</span>
        </span>
        <span className="display text-2xl">→</span>
      </Link>

      <section className="card card-pad space-y-4 rise">
        <h2 className="display text-xl">Marcar nova pelada</h2>
        <form action={createMatch} className="grid gap-4">
          <div>
            <label htmlFor="date" className="label">
              Data e hora
            </label>
            <input id="date" name="date" type="datetime-local" className="field" defaultValue={defaultDate()} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="numTeams" className="label">
                Times
              </label>
              <select id="numTeams" name="numTeams" className="field" defaultValue="2">
                <option value="2">2 · Azul e Vermelho</option>
                <option value="3">3 · + Preto</option>
                <option value="4">4 · + Amarelo</option>
              </select>
            </div>
            <div>
              <label htmlFor="lineSize" className="label">
                Jogadores na linha
              </label>
              <select id="lineSize" name="lineSize" className="field" defaultValue="5">
                {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} por time
                  </option>
                ))}
              </select>
            </div>
          </div>
          <SubmitButton className="btn btn-moss btn-block" id="criar-partida" pendingLabel="Abrindo lista…">
            Abrir lista de presença
          </SubmitButton>
        </form>
      </section>

      <section>
        <div className="section-head">
          <h2 className="display text-2xl">Partidas</h2>
          <span className="kicker">{matches.length}</span>
        </div>
        {matches.length ? (
          <ul className="grid gap-3">
            {matches.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/partida/${m.id}`} className="card card-pad card-link" id={`admin-partida-${m.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="card-title text-base! first-letter:uppercase">{formatMatchDate(m.date)}</span>
                    <StatusStamp status={m.status} votingOpen={m.votingOpen} />
                  </div>
                  <p className="mono text-xs mt-2">
                    {m.numTeams}×{m.lineSize} · {m._count.attendances} confirmados
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhuma partida criada</Empty>
        )}
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}
