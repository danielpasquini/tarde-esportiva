import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Loading } from "@/components/ui";
import SpotlightCard from "@/components/SpotlightCard";
import SplitText from "@/components/SplitText";
import Link from "next/link";

async function VotarRedirectInner({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;

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

export const metadata: Metadata = {
  title: "Cédula de Votação",
  description: "Organização de partidas de futebol: histórico de partidas e notas.",
  openGraph: {
    title: "Tarde Esportiva",
    description: "Organização de partidas de futebol: histórico de partidas e notas.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Tarde Esportiva" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarde Esportiva",
    description: "Organização de partidas de futebol: histórico de partidas e notas.",
    images: ["/opengraph-image"],
  },
};

export default function VotarRootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<Loading label="Localizando votação aberta…" />}>
      <VotarRedirectInner searchParams={searchParams} />
    </Suspense>
  );
}
