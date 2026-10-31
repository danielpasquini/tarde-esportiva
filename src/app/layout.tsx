import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Barlow_Condensed, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Star } from "lucide-react";
import "./globals.css";
import { cn } from "@/lib/utils";
import GlareHover from "@/components/GlareHover";
import SplitText from "@/components/SplitText";
import { MainNav } from "@/components/client";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-dm-serif",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tarde-esportiva.vercel.app"),
  title: { default: "Tarde Esportiva", template: "%s · Tarde Esportiva" },
  description: "Organização de partidas de futebol: confirmação de presença, notas e histórico pós-jogo.",
  applicationName: "Tarde Esportiva",
  appleWebApp: { capable: true, title: "Tarde Esportiva", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Tarde Esportiva",
    title: "Tarde Esportiva",
    description: "Organização de partidas de futebol: confirmação de presença, notas e histórico pós-jogo.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarde Esportiva",
    description: "Organização de partidas de futebol: confirmação de presença, notas e histórico pós-jogo.",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#16281E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={cn(barlowCondensed.variable, jakarta.variable, jetbrainsMono.variable, "font-sans")}
    >
      <body className="antialiased min-h-dvh flex flex-col">
        {/* Header Principal */}
        <header className="px-4 sm:px-6 lg:px-8 pt-4 pb-1 max-w-2xl lg:max-w-4xl mx-auto w-full transition-all">
          <div className="border border-moss/20 bg-paper rounded-2xl shadow-hard overflow-hidden">
            {/* Top Brand Banner */}
            <GlareHover
              glareColor="#d9a520"
              glareOpacity={0.14}
              className="bg-moss fut-header-stripes px-5 pt-6 pb-5 text-center text-paper relative"
            >
              {/* Team Color Accent Bar: Azul - Vermelho - Preto - Amarelo */}
              <div className="absolute inset-x-0 top-0 h-1.5 flex" aria-hidden="true">
                <span className="flex-1 bg-team-azul" />
                <span className="flex-1 bg-team-vermelho" />
                <span className="flex-1 bg-team-preto" />
                <span className="flex-1 bg-team-amarelo" />
              </div>

              {/* 3 Estrelas Centralizadas */}
              <div className="flex items-center justify-center gap-1.5 text-team-amarelo mb-1.5" aria-hidden="true">
                <Star className="size-2.5 fill-current opacity-80" />
                <Star className="size-3.5 fill-current drop-shadow-xs" />
                <Star className="size-2.5 fill-current opacity-80" />
              </div>

              <div>
                <Link href="/" className="inline-block group focus:outline-none">
                  <h1 className="font-serif text-3xl sm:text-4xl lg:text-[40px] font-extrabold uppercase tracking-[0.06em] leading-none group-hover:opacity-90 transition-opacity">
                    <SplitText
                      text="TARDE ESPORTIVA"
                      tag="span"
                      effect="fade"
                      duration={0.45}
                      delay={16}
                      textAlign="center"
                    />
                  </h1>
                </Link>
              </div>
            </GlareHover>

            {/* Segmented Navigation Bar */}
            <MainNav />
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl lg:max-w-4xl flex-1 px-4 sm:px-6 lg:px-8 py-5 transition-all">{children}</main>

        <footer className="mx-auto w-full max-w-2xl lg:max-w-4xl px-4 sm:px-6 lg:px-8 pb-8 pt-4 text-center transition-all">
          <p className="border-t border-moss/10 pt-4 text-[11px] leading-relaxed text-moss/65 italic">
            &ldquo;Portanto, quer comais, quer bebais ou façais outra coisa qualquer, fazei tudo para a glória de Deus.&rdquo;
            <span className="block not-italic font-sans text-[10px] uppercase tracking-wider font-bold text-moss/45 mt-1">
              1 Coríntios 10:31
            </span>
          </p>
        </footer>
      </body>
    </html>
  );
}
