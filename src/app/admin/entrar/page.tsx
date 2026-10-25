import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isAdmin } from "@/lib/auth";
import { login } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";

async function ErrorNote({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  if (!sp.erro) return null;
  return (
    <div role="alert" className="border-2 border-brick bg-[#F3DEDA] p-2.5 text-xs text-brick font-bold text-center">
      PIN incorreto. Verifique e tente novamente.
    </div>
  );
}

export const metadata = { title: "Acesso Organizador" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/entrar">) {
  await connection();
  if (await isAdmin()) {
    redirect("/admin");
  }
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-serif text-3xl">Acesso do Organizador</h2>
        <p className="mt-1 text-xs text-moss-soft">Digite o PIN configurado para gerenciar partidas e elenco.</p>
      </header>

      <form action={login} className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <div>
          <label htmlFor="pin" className="block text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-1">
            PIN de Acesso
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            className="w-full border-2 border-moss bg-paper px-3 py-2 text-center font-mono text-2xl tracking-[0.5em] text-moss outline-none"
            placeholder="••••"
            required
          />
        </div>

        <Suspense>
          <ErrorNote searchParams={searchParams} />
        </Suspense>

        <SubmitButton className="w-full bg-moss text-paper hover:bg-moss-soft py-3 text-xs font-bold uppercase tracking-widest shadow-hard-sm" id="entrar-admin">
          Acessar Painel
        </SubmitButton>
      </form>
    </div>
  );
}
