import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { DM_Serif_Display, Work_Sans } from "next/font/google";
import { Star } from "lucide-react";
import "./globals.css";

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
  description: "Organização de partidas de futebol amador: confirmação, sorteio e votação pós-jogo.",
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
    <html lang="pt-BR" className={`${dmSerif.variable} ${workSans.variable}`}>
      <body className="antialiased min-h-dvh flex flex-col">
        {/* Pennant Header inspirado no modelo */}
        <header className="relative px-4 pt-4 max-w-md mx-auto w-full">
          <div className="relative drop-shadow-[4px_4px_0_#9E2A2B]">
            <div
              className="bg-moss px-6 pt-5 pb-12 text-center text-paper"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)" }}
            >
              <div className="mx-auto mb-2 flex items-center justify-center gap-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.25em] text-paper/80">
                <span className="h-px w-5 bg-paper/60" aria-hidden="true" />
                Futebol Amador
                <span className="h-px w-5 bg-paper/60" aria-hidden="true" />
              </div>

              <div className="flex items-center justify-center gap-1 text-brick" aria-hidden="true">
                <Star className="size-3 fill-current" />
                <Star className="size-4 fill-current" />
                <Star className="size-3 fill-current" />
              </div>

              <Link href="/" className="block mt-1">
                <h1 className="font-serif text-4xl leading-none tracking-wide text-balance">
                  TARDE
                  <span className="block text-5xl">ESPORTIVA</span>
                </h1>
              </Link>

              <div className="mx-auto mt-3 h-1 w-20 border-y border-paper/70 bg-brick" aria-hidden="true" />
            </div>
          </div>

          <nav className="mt-3 flex justify-center gap-2 border-[3px] border-moss bg-paper-dark p-1.5 shadow-hard-sm" aria-label="Navegação">
            <Link
              href="/"
              id="nav-inicio"
              className="flex-1 text-center py-1.5 px-3 text-xs font-bold uppercase tracking-wider text-moss hover:bg-paper transition-colors"
            >
              Início
            </Link>
            <Link
              href="/historico"
              id="nav-historico"
              className="flex-1 text-center py-1.5 px-3 text-xs font-bold uppercase tracking-wider text-moss hover:bg-paper transition-colors border-x-2 border-moss/30"
            >
              Histórico
            </Link>
            <Link
              href="/admin"
              id="nav-admin"
              className="flex-1 text-center py-1.5 px-3 text-xs font-bold uppercase tracking-wider text-moss hover:bg-paper transition-colors"
            >
              Organizador
            </Link>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">{children}</main>

        <footer className="mx-auto w-full max-w-md px-4 pb-6 pt-2 text-center text-xs text-moss-soft">
          <div className="border-t-2 border-moss/20 pt-3">
            Tarde Esportiva
          </div>
        </footer>
      </body>
    </html>
  );
}
