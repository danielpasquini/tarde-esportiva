import { Suspense } from "react";
import { login } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";

async function ErrorNote({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  if (!sp.erro) return null;
  return (
    <p role="alert" className="text-sm text-brick font-semibold">
      PIN incorreto. Tente de novo.
    </p>
  );
}

export const metadata = { title: "Entrar" };

export default function LoginPage({ searchParams }: PageProps<"/admin/entrar">) {
  return (
    <div className="space-y-6">
      <header className="text-center rise">
        <p className="kicker">Vestiário restrito</p>
        <h1 className="display text-4xl mt-1">Área do organizador</h1>
      </header>
      <form action={login} className="card card-pad space-y-4 rise">
        <div>
          <label htmlFor="pin" className="label">
            PIN do organizador
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            className="field text-center mono text-2xl tracking-[0.5em]"
            required
          />
        </div>
        <Suspense>
          <ErrorNote searchParams={searchParams} />
        </Suspense>
        <SubmitButton className="btn btn-moss btn-block" id="entrar-admin" pendingLabel="Conferindo…">
          Entrar
        </SubmitButton>
      </form>
    </div>
  );
}
