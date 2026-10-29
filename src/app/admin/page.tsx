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
import SpotlightCard from "@/components/SpotlightCard";
import CountUp from "@/components/CountUp";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";

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
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between border-b border-moss/15 pb-3">
        <div>
          <span className="hud-tag bg-moss text-paper border-transparent mb-1">
            <ShinyText text="MANAGER MODE" color="#f6f4ef" shineColor="#d9a520" speed={2.2} />
          </span>
          <h2 className="font-serif text-3xl text-moss">
            <SplitText text="Organizador" tag="span" />
          </h2>
          <p className="text-xs text-moss-soft">Painel de controle e partidas</p>
        </div>
        <form action={logout}>
          <SubmitButton className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider bg-paper-dark/80 text-brick border-moss/15" id="sair-admin">
            <LogOut className="size-3.5 mr-1" />
            Sair
          </SubmitButton>
        </form>
      </header>

      {/* Atalho para Gerenciamento de Elenco */}
      <SpotlightCard className="border border-moss/15 bg-paper-dark/65 rounded-2xl shadow-hard-sm transition-all active:scale-[0.99]">
        <Link
          href="/admin/jogadores"
          className="flex items-center justify-between p-4 group"
          id="link-jogadores"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-moss text-paper flex items-center justify-center shadow-hard-brick">
              <Users className="size-5" />
            </div>
            <div>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-brick">Cadastro • Elenco</span>
              <span className="font-serif text-xl text-moss group-hover:text-brick transition-colors">
                <CountUp to={playerCount} duration={1} /> Jogadores Ativos
              </span>
            </div>
          </div>
          <ArrowRight className="size-5 text-moss group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </SpotlightCard>

      {/* Formulário: Nova Partida */}
      <SpotlightCard className="border border-moss/15 bg-paper p-5 rounded-2xl shadow-hard flex flex-col gap-4">
        <h3 className="font-serif text-xl border-b border-moss/10 pb-2">Marcar Nova Partida</h3>
        <form action={createMatch} className="flex flex-col gap-4">
          <div className="w-full min-w-0">
            <label htmlFor="date" className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
              Data e Horário
            </label>
            <input
              id="date"
              name="date"
              type="datetime-local"
              className="block w-full min-w-0 h-10 rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-xs font-mono text-moss outline-none"
              defaultValue={defaultDate()}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="location" className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
                Local do Jogo (Opcional)
              </label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="Ex: Arena Futebol Clube, Campo 2"
                className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-xs text-moss outline-none"
              />
            </div>
            <div>
              <label htmlFor="cost" className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
                Valor por Jogador em R$ (Opcional)
              </label>
              <input
                id="cost"
                name="cost"
                type="number"
                step="0.50"
                placeholder="Ex: 25,00"
                className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-xs font-mono text-moss outline-none"
              />
            </div>
          </div>

          <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-3 text-xs font-extrabold uppercase tracking-widest shadow-hard-brick border-transparent" id="criar-partida">
            Criar Partida
          </SubmitButton>
        </form>
      </SpotlightCard>

      {/* Lista de Partidas */}
      <section className="flex flex-col gap-3">
        <h3 className="font-serif text-2xl">Todas as Partidas</h3>
        {matches.length ? (
          <ul className="flex flex-col gap-2.5">
            {matches.map((m) => {
              return (
                <li key={m.id}>
                  <SpotlightCard className="border border-moss/15 bg-paper rounded-2xl shadow-hard overflow-hidden">
                    <div className="flex items-center justify-between p-4 hover:bg-paper-dark/40 transition-colors">
                      <Link
                        href={`/admin/partida/${m.id}`}
                        className="flex-1 block min-w-0 group"
                        id={`admin-partida-${m.id}`}
                      >
                        <div className="flex items-start justify-between gap-3 pr-2">
                          <div>
                            <span className="font-serif text-lg leading-tight first-letter:uppercase block group-hover:text-brick transition-colors">
                              {formatMatchDate(m.date)}
                            </span>
                            {(m.location || m.cost != null) && (
                              <span className="text-[11px] text-moss-soft font-medium flex items-center gap-2 mt-0.5">
                                {m.location && <span>📍 {m.location}</span>}
                                {m.cost != null && <span>💰 R$ {m.cost.toFixed(2).replace(".", ",")}</span>}
                              </span>
                            )}
                          </div>
                          <StatusStamp status={m.status} votingOpen={m.votingOpen} />
                        </div>
                        <div className="mt-2 pt-2 border-t border-moss/10 flex items-center justify-between text-xs text-moss-soft font-semibold pr-2 flex-wrap gap-1">
                          <span className="font-mono">
                            <CountUp to={m._count.attendances} duration={0.9} /> jogadores confirmados
                          </span>
                          <span className="text-brick font-extrabold uppercase text-[10px]">Gerenciar Presença e Notas →</span>
                        </div>
                      </Link>

                      <form action={deleteMatch.bind(null, m.id)} className="pl-3 border-l border-moss/10">
                        <SubmitButton
                          className="size-8 p-0 flex items-center justify-center border border-moss/15 bg-paper-dark/80 hover:bg-brick hover:text-paper text-brick/80 rounded-lg transition-colors shadow-none text-xs"
                          confirm="Deseja realmente apagar esta partida?"
                          title="Apagar partida"
                        >
                          <Trash2 className="size-4" />
                        </SubmitButton>
                      </form>
                    </div>
                  </SpotlightCard>
                </li>
              );
            })}
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
