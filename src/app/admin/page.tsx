import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, LogOut, Trash2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatMatchDate } from "@/lib/format";
import { createMatch, deleteMatch, logout } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import { Empty, Loading, StatusStamp } from "@/components/ui";

export const metadata = { title: "Organizador" };

function defaultDate() {
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
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between border-b-2 border-moss pb-3">
        <div>
          <h2 className="font-serif text-3xl">Organizador</h2>
          <p className="text-xs text-moss-soft">Painel de controle e partidas</p>
        </div>
        <form action={logout}>
          <SubmitButton className="h-8 px-2.5 text-[10px] font-bold uppercase tracking-wider bg-paper-dark text-brick" id="sair-admin">
            <LogOut className="size-3.5 mr-1" />
            Sair
          </SubmitButton>
        </form>
      </header>

      {/* Atalho para Gerenciamento de Elenco */}
      <Link
        href="/admin/jogadores"
        className="flex items-center justify-between border-[3px] border-moss bg-paper-dark p-4 shadow-hard-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        id="link-jogadores"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 border-2 border-moss bg-paper flex items-center justify-center">
            <Users className="size-5 text-moss" />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Cadastro</span>
            <span className="font-serif text-xl">{playerCount} Jogadores Ativos</span>
          </div>
        </div>
        <ArrowRight className="size-5 text-moss" />
      </Link>

      {/* Formulário: Nova Partida */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <h3 className="font-serif text-xl border-b-2 border-moss/20 pb-2">Marcar Nova Partida</h3>
        <form action={createMatch} className="flex flex-col gap-4">
          <div>
            <label htmlFor="date" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
              Data e Horário
            </label>
            <input
              id="date"
              name="date"
              type="datetime-local"
              className="w-full border-2 border-moss bg-paper px-3 py-2 text-sm text-moss outline-none"
              defaultValue={defaultDate()}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="numTeams" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                Número de Times
              </label>
              <select id="numTeams" name="numTeams" className="w-full border-2 border-moss bg-paper px-3 py-2 text-sm text-moss outline-none" defaultValue="2">
                <option value="2">2 Times (Azul / Vermelho)</option>
                <option value="3">3 Times (+ Preto)</option>
                <option value="4">4 Times (+ Amarelo)</option>
              </select>
            </div>
            <div>
              <label htmlFor="lineSize" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                Jogadores na Linha
              </label>
              <select id="lineSize" name="lineSize" className="w-full border-2 border-moss bg-paper px-3 py-2 text-sm text-moss outline-none" defaultValue="5">
                {[4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n} por time
                  </option>
                ))}
              </select>
            </div>
          </div>

          <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-3 text-xs font-bold uppercase tracking-widest shadow-hard-sm" id="criar-partida">
            Criar Partida e Abrir Lista
          </SubmitButton>
        </form>
      </section>

      {/* Lista de Partidas */}
      <section className="flex flex-col gap-3">
        <h3 className="font-serif text-2xl">Todas as Partidas</h3>
        {matches.length ? (
          <ul className="flex flex-col gap-3">
            {matches.map((m) => (
              <li key={m.id} className="border-[3px] border-moss bg-paper shadow-hard overflow-hidden">
                <div className="flex items-center justify-between p-4 hover:bg-paper-dark/40 transition-colors">
                  <Link
                    href={`/admin/partida/${m.id}`}
                    className="flex-1 block"
                    id={`admin-partida-${m.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 pr-2">
                      <span className="font-serif text-lg leading-tight first-letter:uppercase">{formatMatchDate(m.date)}</span>
                      <StatusStamp status={m.status} votingOpen={m.votingOpen} />
                    </div>
                    <div className="mt-2 pt-2 border-t border-moss/20 flex items-center justify-between text-xs text-moss-soft font-semibold pr-2">
                      <span>{m.numTeams} times × {m.lineSize} na linha</span>
                      <span>{m._count.attendances} atletas confirmados</span>
                    </div>
                  </Link>

                  <form action={deleteMatch.bind(null, m.id)} className="pl-3 border-l border-moss/20">
                    <SubmitButton
                      className="size-8 p-0 flex items-center justify-center border border-moss/30 bg-paper-dark hover:bg-brick hover:text-paper text-brick/80 rounded transition-colors shadow-none text-xs"
                      confirm="Deseja realmente apagar esta partida?"
                      title="Apagar partida"
                    >
                      <Trash2 className="size-4" />
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhuma partida registrada.</Empty>
        )}
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<Loading label="Carregando painel…" />}>
      <Dashboard />
    </Suspense>
  );
}
