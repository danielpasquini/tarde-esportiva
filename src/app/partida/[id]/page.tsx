import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, User } from "lucide-react";
import { db } from "@/lib/db";
import { formatMatchDate } from "@/lib/format";
import { GloveBadge, Loading, StatusStamp } from "@/components/ui";

async function MatchView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const match = await db.match.findUnique({
    where: { id },
    include: {
      attendances: {
        include: { player: true },
        orderBy: { player: { name: "asc" } },
      },
    },
  });
  if (!match) notFound();

  const votesCount = await db.vote.count({ where: { matchId: match.id } });
  const showTop5 = match.status === "FINISHED" || votesCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="border-[3px] border-moss bg-paper p-4 shadow-hard">
        <Link href="/" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-moss-soft mb-2">
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">Partida</span>
            <h1 className="font-serif text-3xl first-letter:uppercase leading-tight">{formatMatchDate(match.date)}</h1>
            {(match.location || match.cost != null) && (
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-moss font-semibold">
                {match.location && <span>📍 {match.location}</span>}
                {match.cost != null && <span>💰 R$ {match.cost.toFixed(2).replace(".", ",")} por jogador</span>}
              </div>
            )}
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>
        <div className="mt-3 pt-3 border-t-2 border-moss/20 flex items-center justify-between text-xs text-moss-soft font-semibold">
          <span>{match.attendances.length} jogadores confirmados</span>
        </div>
      </header>

      {match.votingOpen && (
        <Link
          href={`/votar/${match.voteToken}`}
          className="flex items-center justify-between border-[3px] border-moss bg-paper-dark px-4 py-3.5 shadow-hard-brick text-moss transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          id="ir-votacao"
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Urna aberta</span>
            <span className="block font-serif text-lg leading-tight">Votação Pós-Jogo</span>
          </div>
          <ArrowRight className="size-5 text-brick" />
        </Link>
      )}

      {/* Imagem e Destaques do Jogador do Dia / Top 5 */}
      {showTop5 && (
        <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
          <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Destaques</span>
              <h2 className="font-serif text-2xl">Top 5 da Rodada</h2>
            </div>
            <a
              href={`/api/partida/${match.id}/destaques`}
              target="_blank"
              download={`craque-da-rodada-${match.id}.png`}
              className="inline-flex items-center gap-1 border-2 border-moss bg-moss text-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-moss-soft"
            >
              Baixar Imagem ↗
            </a>
          </div>

          <div className="overflow-hidden border-2 border-moss shadow-hard-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/partida/${match.id}/destaques`}
              alt="Jogador do Dia e Top 5 da partida"
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          </div>

          <p className="text-[11px] text-moss-soft text-center italic">
            Apenas o Top 5 é revelado publicamente. O restante das avaliações é restrito ao organizador.
          </p>
        </section>
      )}

      {/* Lista de Jogadores da Partida */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
          <h2 className="font-serif text-2xl">Jogadores da Partida</h2>
          <span className="text-xs text-moss-soft font-semibold">{match.attendances.length} presentes</span>
        </div>

        {match.attendances.length ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {match.attendances.map((a, i) => (
              <li
                key={a.id}
                className="flex items-center justify-between p-2.5 border border-moss/20 bg-paper-dark text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 font-mono text-[10px] text-moss-soft">{i + 1}.</span>
                  <span className="truncate font-semibold text-moss">{a.player.name}</span>
                  {a.player.isGoalkeeper && <GloveBadge />}
                </div>

                <Link
                  href={`/perfil/${a.playerId}`}
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brick hover:underline shrink-0"
                >
                  <User className="size-3" /> Perfil
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-moss-soft italic">Nenhum jogador registrado nesta partida.</p>
        )}
      </section>
    </div>
  );
}

export default function MatchPage({ params }: PageProps<"/partida/[id]">) {
  return (
    <Suspense fallback={<Loading label="Carregando partida…" />}>
      <MatchView params={params} />
    </Suspense>
  );
}
