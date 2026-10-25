import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createPlayer, updatePlayer } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import { Empty, Loading } from "@/components/ui";

export const metadata = { title: "Elenco" };

const RATINGS = Array.from({ length: 9 }, (_, i) => 1 + i * 0.5);

function RatingSelect({ id, defaultValue }: { id: string; defaultValue: number }) {
  return (
    <select id={id} name="baseRating" className="field" defaultValue={String(defaultValue)}>
      {!RATINGS.includes(defaultValue) && <option value={defaultValue}>{defaultValue.toFixed(2)}</option>}
      {RATINGS.map((r) => (
        <option key={r} value={r}>
          {"★".repeat(Math.floor(r))}
          {r % 1 ? "½" : ""} {r.toString().replace(".", ",")}
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
    <div className="space-y-8">
      <header className="rise">
        <Link href="/admin" className="kicker underline">
          ← Organizador
        </Link>
        <h1 className="display text-3xl mt-2">Elenco</h1>
      </header>

      <section className="card card-pad space-y-4">
        <h2 className="display text-xl">Novo jogador</h2>
        <form action={createPlayer} className="grid gap-3">
          <div>
            <label htmlFor="new-name" className="label">
              Nome ou apelido
            </label>
            <input id="new-name" name="name" className="field" maxLength={40} required placeholder="Ex: Zé da Lateral" />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label htmlFor="new-rating" className="label">
                Nota base
              </label>
              <RatingSelect id="new-rating" defaultValue={3} />
            </div>
            <label className="flex items-center gap-2 min-h-11">
              <input type="checkbox" name="isGoalkeeper" className="check" /> Goleiro fixo
            </label>
          </div>
          <SubmitButton className="btn btn-moss btn-block" id="criar-jogador">
            Adicionar ao elenco
          </SubmitButton>
        </form>
      </section>

      <section>
        <div className="section-head">
          <h2 className="display text-2xl">Jogadores</h2>
          <span className="kicker">{players.length}</span>
        </div>
        {players.length ? (
          <ul className="grid gap-3">
            {players.map((p) => (
              <li key={p.id} className={`card ${p.active ? "" : "opacity-60"}`}>
                <details>
                  <summary className="roster-row">
                    <span className="flex-1 font-semibold truncate">{p.name}</span>
                    {p.isGoalkeeper && <span className="tag tag-gk">GK</span>}
                    {!p.active && <span className="tag">Inativo</span>}
                    <span className="mono text-sm">{p.baseRating.toFixed(2).replace(".", ",")}</span>
                    <span className="kicker">editar</span>
                  </summary>
                  <form action={updatePlayer.bind(null, p.id)} className="grid gap-3 p-3 border-t-2 border-ink">
                    <input name="name" defaultValue={p.name} className="field" maxLength={40} aria-label="Nome" />
                    <RatingSelect id={`rating-${p.id}`} defaultValue={p.baseRating} />
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="isGoalkeeper" defaultChecked={p.isGoalkeeper} className="check" /> Goleiro
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="active" defaultChecked={p.active} className="check" /> Ativo
                      </label>
                    </div>
                    <p className="kicker">{p.ratedMatches} partidas avaliadas</p>
                    <SubmitButton className="btn btn-sm btn-gold">Salvar</SubmitButton>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Cadastre o elenco para abrir a lista</Empty>
        )}
      </section>
    </div>
  );
}

export default function PlayersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Players />
    </Suspense>
  );
}
