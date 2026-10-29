import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Shield } from "lucide-react";
import { isAdmin } from "@/lib/auth";
import { login } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import SpotlightCard from "@/components/SpotlightCard";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";

async function ErrorNote({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  if (!sp.erro) return null;
  return (
    <div role="alert" className="rounded-lg border border-brick/40 bg-[#F9EED9] p-2.5 text-xs text-brick font-bold text-center">
      PIN incorreto. Verifique e tente novamente.
    </div>
  );
}

export const metadata = { title: "Acesso Organizador" };

async function LoginForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  if (await isAdmin()) {
    redirect("/admin");
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <span className="hud-tag bg-moss text-paper border-transparent mb-1.5">
          <Shield className="size-3 text-brick" />
          <ShinyText text="MANAGER ACCESS • RESTRITO" color="#f6f4ef" shineColor="#d9a520" speed={2.2} />
        </span>
        <h2 className="font-serif text-3xl text-moss">
          <SplitText text="Acesso do Organizador" tag="span" />
        </h2>
        <p className="mt-1 text-xs text-moss-soft">Digite o PIN configurado para gerenciar partidas e elenco.</p>
      </header>

      <SpotlightCard className="border border-moss/15 bg-paper p-5 rounded-2xl shadow-hard fut-grid-bg">
        <form action={login} className="flex flex-col gap-4">
          <div>
            <label htmlFor="pin" className="block text-[10px] font-extrabold uppercase tracking-wider text-moss-soft mb-1">
              PIN de Acesso
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              className="w-full rounded-xl border border-moss/25 focus:border-moss bg-white px-3 py-2.5 text-center font-mono text-2xl tracking-[0.5em] text-moss outline-none"
              placeholder="••••"
              required
            />
          </div>

          <ErrorNote searchParams={searchParams} />

          <SubmitButton
            className="w-full bg-moss text-paper hover:bg-moss-soft py-3 text-xs font-extrabold uppercase tracking-widest shadow-hard-brick border-transparent"
            id="entrar-admin"
          >
            Acessar Painel
          </SubmitButton>
        </form>
      </SpotlightCard>
    </div>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/admin/entrar">) {
  return (
    <Suspense fallback={null}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}
