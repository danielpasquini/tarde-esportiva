import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { DM_Serif_Display, Work_Sans, Figtree } from "next/font/google";
import { Star } from "lucide-react";
import "./globals.css";
import { cn } from "@/lib/utils";

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  title: { default: "Tarde Esportiva", template: "%s · Tarde Esportiva" },
  description: "Organização de partidas de futebol: confirmação de presença, notas e histórico pós-jogo.",
  applicationName: "Tarde Esportiva",
  appleWebApp: { capable: true, title: "Tarde Esportiva", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#1A2E22",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={cn(dmSerif.variable, workSans.variable, "font-sans", figtree.variable)}>
      <body className="antialiased min-h-dvh flex flex-col">
        {/* Header Elegante & Minimalista */}
        <header className="px-4 pt-5 pb-1 max-w-md mx-auto w-full">
          <div className="border-[3px] border-moss bg-paper shadow-hard overflow-hidden">
            {/* Top Brand Banner */}
            <div className="bg-moss px-5 pt-5 pb-4 text-center text-paper relative">
              <div className="flex items-center justify-center gap-1.5 text-brick/90 mb-1.5" aria-hidden="true">
                <Star className="size-2.5 fill-current" />
                <Star className="size-3.5 fill-current" />
                <Star className="size-2.5 fill-current" />
              </div>

              <Link href="/" className="inline-block group focus:outline-none">
                <h1 className="font-serif text-3xl tracking-wide group-hover:opacity-90 transition-opacity">
                  TARDE <span className="font-normal text-paper/95">ESPORTIVA</span>
                </h1>
              </Link>

              <div className="mx-auto mt-2.5 h-0.5 w-12 bg-brick rounded-full" aria-hidden="true" />
            </div>

            {/* Navigation Bar integrativa */}
            <nav className="flex items-stretch border-t-[3px] border-moss bg-paper-dark" aria-label="Navegação Principal">
              <Link
                href="/"
                id="nav-inicio"
                className="flex-1 text-center py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-moss hover:bg-paper transition-colors"
              >
                Início
              </Link>
              <Link
                href="/historico"
                id="nav-historico"
                className="flex-1 text-center py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-moss hover:bg-paper transition-colors border-x-2 border-moss/20"
              >
                Histórico
              </Link>
              <Link
                href="/admin"
                id="nav-admin"
                className="flex-1 text-center py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-moss hover:bg-paper transition-colors"
              >
                Organizador
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">{children}</main>

        <footer className="mx-auto w-full max-w-md px-4 pb-8 pt-4 text-center">
          <p className="border-t border-moss/20 pt-4 font-serif text-[11px] leading-relaxed text-moss/70 italic">
            &ldquo;Portanto, quer comais, quer bebais ou façais outra coisa qualquer, fazei tudo para a glória de Deus.&rdquo;
            <span className="block not-italic font-sans text-[10px] uppercase tracking-wider font-semibold text-moss/50 mt-1">
              1 Coríntios 10:31
            </span>
          </p>
        </footer>
      </body>
    </html>
  );
}
