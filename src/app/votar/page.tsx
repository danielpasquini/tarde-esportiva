import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import SpotlightCard from "@/components/SpotlightCard";
import SplitText from "@/components/SplitText";
import Link from "next/link";

export default async function VotarRootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;

  // Busca a partida atualmente com votação aberta
  const openMatch = await db.match.findFirst({
    where: { votingOpen: true },
    orderBy: { date: "desc" },
    select: { voteToken: true },
  });

  if (openMatch) {
    const query = new URLSearchParams();
    if (typeof sp.jogador === "string") {
      query.set("jogador", sp.jogador);
    }
    const qs = query.toString();
    redirect(`/votar/${openMatch.voteToken}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <SpotlightCard className="border border-moss/15 bg-paper p-6 rounded-2xl text-center shadow-hard fut-grid-bg">
        <h2 className="font-serif text-2xl text-moss">
          <SplitText text="Nenhuma Votação Aberta" tag="span" textAlign="center" />
        </h2>
        <p className="mt-2 text-xs text-moss-soft">
          Não há nenhuma partida recebendo votos no momento. Assim que o organizador abrir a votação, o link estará ativo.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center rounded-lg border border-moss/20 bg-paper-dark px-4 py-2 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm text-moss"
        >
          Voltar ao Início
        </Link>
      </SpotlightCard>
    </div>
  );
}
