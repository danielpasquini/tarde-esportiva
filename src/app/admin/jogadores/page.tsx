import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, Lock, Unlock } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createPlayer, deletePlayer, importPlayersBatch, updatePlayer, resetPlayerPin } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import { Empty, Loading, GloveBadge } from "@/components/ui";
import SpotlightCard from "@/components/SpotlightCard";
import CountUp from "@/components/CountUp";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";

export const metadata = { title: "Elenco" };

const RATINGS = Array.from({ length: 9 }, (_, i) => 1 + i * 0.5);

function RatingSelect({ id, defaultValue }: { id: string; defaultValue?: number | null }) {
  return (
    <select
      id={id}
      name="baseRating"
      className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-sm text-moss outline-none"
      defaultValue={defaultValue != null ? String(defaultValue) : ""}
    >
      <option value="">Sem nota inicial (calculada após jogos)</option>
      {defaultValue != null && !RATINGS.includes(defaultValue) && (
        <option value={defaultValue}>★ {defaultValue.toFixed(1).replace(".", ",")}</option>
      )}
      {RATINGS.map((r) => (
        <option key={r} value={r}>
          ★ {r.toFixed(1).replace(".", ",")}
        </option>
      ))}
    </select>
  );
}

async function Players() {
  await connection();
  await requireAdmin();
  const players = await db.player.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-moss-soft hover:text-brick transition-colors w-fit"
        >
          <ArrowLeft className="size-3.5" /> Painel do Organizador
        </Link>
        <div>
          <span className="hud-tag bg-moss text-paper border-transparent mb-1">
            <ShinyText text="CLUB ROSTER • GESTÃO" color="#f6f4ef" shineColor="#d9a520" speed={2.2} />
          </span>
          <h2 className="font-serif text-3xl text-moss">
            <SplitText text="Cadastro de Elenco" tag="span" />
          </h2>
        </div>
      </header>

      {/* Formulário: Novo Jogador */}
      <SpotlightCard className="border border-moss/15 bg-paper p-5 rounded-2xl shadow-hard flex flex-col gap-4">
        <h3 className="font-serif text-xl border-b border-moss/10 pb-2 text-moss">Novo Jogador</h3>
        <form action={createPlayer} className="flex flex-col gap-3">
          <div>
            <label htmlFor="new-name" className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
              Nome do Jogador
            </label>
            <input
              id="new-name"
              name="name"
              className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-sm text-moss outline-none"
              maxLength={40}
              required
              placeholder="Ex: Zico"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label htmlFor="new-rating" className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
                Nota Base Inicial (Opcional)
              </label>
              <RatingSelect id="new-rating" defaultValue={null} />
            </div>
            <label className="flex items-center gap-2 h-10 px-1 text-xs font-bold text-moss cursor-pointer">
              <input type="checkbox" name="isGoalkeeper" className="size-4 accent-moss" /> Goleiro Fixo
            </label>
          </div>
          <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-2.5 text-xs font-extrabold uppercase tracking-widest shadow-hard-brick border-transparent" id="criar-jogador">
            Adicionar Jogador
          </SubmitButton>
        </form>

        {/* Cadastro em Lote (Lista Numerada ou Texto Livre) */}
        <details className="pt-2 border-t border-moss/10">
          <summary className="text-xs font-extrabold uppercase tracking-wider text-brick cursor-pointer underline">
            + Cadastrar Vários Jogadores (Colar Lista Numerada)
          </summary>
          <form action={importPlayersBatch} className="flex flex-col gap-3 mt-3">
            <div>
              <label htmlFor="batch-names" className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
                Cole a lista (um nome por linha ou lista numerada)
              </label>
              <textarea
                id="batch-names"
                name="names"
                rows={5}
                className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white/85 px-3 py-2 text-xs font-mono text-moss outline-none"
                placeholder={`1. Nome Sobrenome\n2. Nome Sobrenome\n3. Nome Sobrenome...`}
                required
              />
            </div>
            <div>
              <label htmlFor="batch-rating" className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
                Nota Base Inicial para todos (Opcional)
              </label>
              <RatingSelect id="batch-rating" defaultValue={null} />
            </div>
            <SubmitButton className="w-full bg-paper-dark text-moss hover:bg-paper py-2 text-xs font-extrabold uppercase tracking-wider border border-moss/20 shadow-hard-sm">
              Cadastrar Lista em Lote
            </SubmitButton>
          </form>
        </details>
      </SpotlightCard>

      {/* Lista de Jogadores Cadastrados */}
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between border-b border-moss/15 pb-2">
          <h3 className="font-serif text-2xl text-moss">Jogadores Cadastrados</h3>
          <span className="hud-tag bg-paper-dark text-moss font-mono">
            <span>
              <CountUp to={players.length} duration={1} /> jogadores
            </span>
          </span>
        </div>

        {players.length ? (
          <ul className="flex flex-col gap-2">
            {players.map((p, idx) => (
              <li key={p.id} className={`border border-moss/15 rounded-xl bg-paper shadow-hard-sm overflow-hidden ${p.active ? "" : "opacity-60"}`}>
                <details className="group">
                  <summary className="flex items-center justify-between p-3.5 cursor-pointer bg-white/70 hover:bg-white transition-colors gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-md bg-moss/10 text-moss font-mono text-[10px] font-extrabold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm truncate text-moss">{p.name}</span>
                      {p.isGoalkeeper && <GloveBadge className="ml-0.5" />}
                      {p.pin ? (
                        <span className="inline-flex items-center justify-center bg-moss/12 text-moss p-1 rounded-xs shrink-0" title="PIN cadastrado">
                          <Lock className="size-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center text-moss-soft/60 p-1 shrink-0" title="Sem PIN cadastrado">
                          <Unlock className="size-3" />
                        </span>
                      )}
                      {!p.active && (
                        <span className="rounded-xs border border-moss/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-moss-soft">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {p.baseRating != null ? (
                        <span className="inline-flex items-center rounded-sm border border-moss/20 bg-paper-dark/80 px-2 py-0.5 font-mono text-xs font-extrabold text-moss">
                          ★ {p.baseRating.toFixed(1).replace(".", ",")}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-moss-soft bg-paper-dark/60 border border-moss/12 rounded-sm px-2 py-0.5">
                          Sem nota
                        </span>
                      )}
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-brick underline">
                        Editar
                      </span>
                    </div>
                  </summary>

                  <form action={updatePlayer.bind(null, p.id)} className="grid gap-3 p-4 border-t border-moss/10 bg-paper-dark/55 fut-grid-bg">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
                        Nome
                      </label>
                      <input
                        name="name"
                        defaultValue={p.name}
                        className="w-full rounded-lg border border-moss/20 focus:border-moss bg-white px-3 py-1.5 text-sm text-moss outline-none"
                        maxLength={40}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
                        Nota Base
                      </label>
                      <RatingSelect id={`rating-${p.id}`} defaultValue={p.baseRating} />
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-moss cursor-pointer">
                        <input type="checkbox" name="isGoalkeeper" defaultChecked={p.isGoalkeeper} className="size-4 accent-moss" /> Goleiro Fixo
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-moss cursor-pointer">
                        <input type="checkbox" name="active" defaultChecked={p.active} className="size-4 accent-moss" /> Ativo
                      </label>
                    </div>
                    <p className="text-[10px] text-moss-soft font-semibold">
                      {p.ratedMatches} {p.ratedMatches === 1 ? "partida avaliada" : "partidas avaliadas"}
                    </p>
                    <div className="flex gap-2">
                      <SubmitButton className="flex-1 bg-moss text-paper hover:bg-moss-soft py-2 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm border-transparent">
                        Salvar Alterações
                      </SubmitButton>
                    </div>
                  </form>

                  {/* Gestão de PIN e Perfil */}
                  <div className="p-3.5 border-t border-moss/10 bg-paper flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {p.pin ? (
                        <>
                          <Lock className="size-4 text-brick shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-moss block">PIN Cadastrado</span>
                            <span className="text-[10px] text-moss-soft">Votos e perfil protegidos</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <Unlock className="size-4 text-moss-soft shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-moss block">Sem PIN cadastrado</span>
                            <span className="text-[10px] text-moss-soft">O jogador pode cadastrar ao votar</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/perfil/${p.id}`}
                        className="rounded-md text-[11px] font-extrabold uppercase tracking-wider text-moss hover:underline flex items-center gap-1 border border-moss/20 px-2.5 py-1 bg-white/80"
                      >
                        Ver Perfil <ArrowUpRight className="size-3" />
                      </Link>

                      {p.pin && (
                        <form action={resetPlayerPin.bind(null, p.id)}>
                          <SubmitButton
                            className="bg-brick text-paper hover:bg-brick/90 py-1 px-2.5 text-[10px] font-extrabold uppercase tracking-wider shadow-none cursor-pointer border-transparent"
                            confirm={`Tem certeza que deseja resetar o PIN de ${p.name}? Se alguém cadastrou por engano, ele poderá cadastrar um novo PIN.`}
                          >
                            ⚡ Resetar PIN
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="px-4 pb-4 pt-2 bg-paper-dark/45 border-t border-moss/10 flex justify-end">
                    <form action={deletePlayer.bind(null, p.id)}>
                      <SubmitButton
                        className="bg-brick text-paper hover:bg-brick/90 py-1.5 px-3 text-[11px] font-extrabold uppercase tracking-wider shadow-none border-transparent"
                        confirm={`Tem certeza que deseja excluir permanentemente o jogador ${p.name}? Se ele tiver histórico de partidas, os dados relacionados serão afetados.`}
                      >
                        Excluir Jogador
                      </SubmitButton>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhum jogador cadastrado.</Empty>
        )}
      </section>
    </div>
  );
}

export default function PlayersPage() {
  return (
    <Suspense fallback={<Loading label="Carregando elenco…" />}>
      <Players />
    </Suspense>
  );
}
