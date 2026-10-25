import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Playfair_Display, Courier_Prime, Work_Sans } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const type = Courier_Prime({
  variable: "--font-type",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const body = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Tarde Esportiva", template: "%s · Tarde Esportiva" },
  description:
    "Organize a pelada sem burocracia: lista de presença, sorteio equilibrado de times e votação pós-jogo.",
  applicationName: "Tarde Esportiva",
  appleWebApp: { capable: true, title: "Tarde Esportiva", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1A2E22",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${type.variable} ${body.variable} antialiased`}>
      <body className="min-h-dvh flex flex-col">
        <header className="masthead">
          <div className="mx-auto w-full max-w-xl px-4 pt-4 pb-2">
            <div className="flex items-center justify-between kicker">
              <span>Edição Semanal</span>
              <span>Desde 1970</span>
            </div>
            <hr className="rule my-2" />
            <Link href="/" className="block text-center">
              <span className="masthead-title">Tarde Esportiva</span>
            </Link>
            <p className="kicker text-center mt-1">O jornal da sua pelada</p>
            <nav className="mt-3 flex justify-center gap-1" aria-label="Principal">
              <Link href="/" className="nav-link" id="nav-inicio">
                Início
              </Link>
              <Link href="/historico" className="nav-link" id="nav-historico">
                Histórico
              </Link>
              <Link href="/admin" className="nav-link" id="nav-admin">
                Organizador
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-xl px-4 pb-8">
          <hr className="rule-gold mb-3" />
          <p className="kicker text-center">Tarde Esportiva · Futebol raiz, sem burocracia</p>
        </footer>
      </body>
    </html>
  );
}
