import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createPlayer, updatePlayer } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import { Empty, Loading, GloveBadge } from "@/components/ui";

export const metadata = { title: "Elenco" };

const RATINGS = Array.from({ length: 9 }, (_, i) => 1 + i * 0.5);

function RatingSelect({ id, defaultValue }: { id: string; defaultValue: number }) {
  return (
    <select
      id={id}
      name="baseRating"
      className="w-full border-2 border-moss bg-paper px-3 py-2 text-sm text-moss outline-none"
      defaultValue={String(defaultValue)}
    >
      {!RATINGS.includes(defaultValue) && <option value={defaultValue}>{defaultValue.toFixed(2)}</option>}
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-moss-soft">
          <ArrowLeft className="size-3.5" /> Painel do Organizador
        </Link>
        <h2 className="font-serif text-3xl">Cadastro de Elenco</h2>
      </header>

      {/* Formulário: Novo Jogador */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <h3 className="font-serif text-xl border-b-2 border-moss/20 pb-2">Novo Jogador</h3>
        <form action={createPlayer} className="flex flex-col gap-3">
          <div>
            <label htmlFor="new-name" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
              Nome do Atleta
            </label>
            <input
              id="new-name"
              name="name"
              className="w-full border-2 border-moss bg-paper px-3 py-2 text-sm text-moss outline-none"
              maxLength={40}
              required
              placeholder="Ex: Zico"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label htmlFor="new-rating" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                Nota Base Inicial (1 a 5)
              </label>
              <RatingSelect id="new-rating" defaultValue={3} />
            </div>
            <label className="flex items-center gap-2 h-10 text-xs font-semibold cursor-pointer">
              <input type="checkbox" name="isGoalkeeper" className="size-4 accent-moss" /> Goleiro Fixo
            </label>
          </div>
          <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-2.5 text-xs font-bold uppercase tracking-widest shadow-hard-sm" id="criar-jogador">
            Adicionar Jogador
          </SubmitButton>
        </form>
      </section>

      {/* Lista de Jogadores Cadastrados */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between border-b-2 border-moss pb-1">
          <h3 className="font-serif text-2xl">Jogadores Cadastrados</h3>
          <span className="text-[10px] font-bold uppercase tracking-wider text-moss-soft">
            {players.length} atletas
          </span>
        </div>

        {players.length ? (
          <ul className="flex flex-col gap-3">
            {players.map((p) => (
              <li key={p.id} className={`border-[3px] border-moss bg-paper shadow-hard ${p.active ? "" : "opacity-60"}`}>
                <details>
                  <summary className="flex items-center justify-between p-3.5 cursor-pointer bg-paper hover:bg-paper-dark transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm truncate">{p.name}</span>
                      {p.isGoalkeeper && <GloveBadge className="size-4" />}
                      {!p.active && (
                        <span className="border border-moss px-1 text-[9px] font-bold uppercase text-moss-soft">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-serif text-base font-bold text-moss">
                        ★ {p.baseRating.toFixed(1).replace(".", ",")}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-moss-soft underline">
                        Editar
                      </span>
                    </div>
                  </summary>

                  <form action={updatePlayer.bind(null, p.id)} className="grid gap-3 p-4 border-t-2 border-moss bg-paper-dark">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                        Nome
                      </label>
                      <input
                        name="name"
                        defaultValue={p.name}
                        className="w-full border-2 border-moss bg-paper px-3 py-1.5 text-sm text-moss outline-none"
                        maxLength={40}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
                        Nota Base
                      </label>
                      <RatingSelect id={`rating-${p.id}`} defaultValue={p.baseRating} />
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input type="checkbox" name="isGoalkeeper" defaultChecked={p.isGoalkeeper} className="size-4 accent-moss" /> Goleiro Fixo
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input type="checkbox" name="active" defaultChecked={p.active} className="size-4 accent-moss" /> Ativo
                      </label>
                    </div>
                    <p className="text-[10px] text-moss-soft">
                      {p.ratedMatches} {p.ratedMatches === 1 ? "partida avaliada" : "partidas avaliadas"}
                    </p>
                    <SubmitButton className="bg-moss text-paper hover:bg-moss-soft py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm">
                      Salvar Alterações
                    </SubmitButton>
                  </form>
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
