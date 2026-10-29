"use client";

import { useFormStatus } from "react-dom";
import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function tabClass(active: boolean) {
  return cn(
    "flex-1 text-center py-2 px-3 rounded-lg text-[11px] font-extrabold uppercase tracking-[0.1em] transition-all relative flex items-center justify-center gap-1.5",
    active
      ? "bg-moss text-paper shadow-sm"
      : "text-moss/75 hover:text-moss hover:bg-white/60",
  );
}

function MainNavInner() {
  const pathname = usePathname() || "/";
  const isHome = pathname === "/" || pathname.startsWith("/votar");
  const isHistorico = pathname.startsWith("/historico") || pathname.startsWith("/perfil") || pathname.startsWith("/partida");
  const isAdmin = pathname.startsWith("/admin");

  return (
    <nav className="flex items-center gap-1 p-1.5 border-t border-moss/12 bg-paper-dark/85" aria-label="Navegação Principal">
      <Link href="/" id="nav-inicio" aria-current={isHome ? "page" : undefined} className={tabClass(isHome)}>
        {isHome && <span className="size-1.5 rounded-full bg-team-amarelo shrink-0" aria-hidden="true" />}
        <span>Início</span>
      </Link>
      <Link
        href="/historico"
        id="nav-historico"
        aria-current={isHistorico ? "page" : undefined}
        className={tabClass(isHistorico)}
      >
        {isHistorico && <span className="size-1.5 rounded-full bg-team-amarelo shrink-0" aria-hidden="true" />}
        <span>Histórico</span>
      </Link>
      <Link href="/admin" id="nav-admin" aria-current={isAdmin ? "page" : undefined} className={tabClass(isAdmin)}>
        {isAdmin && <span className="size-1.5 rounded-full bg-team-amarelo shrink-0" aria-hidden="true" />}
        <span>Organizador</span>
      </Link>
    </nav>
  );
}

export function MainNav() {
  return (
    <Suspense
      fallback={
        <nav className="flex items-center gap-1 p-1.5 border-t border-moss/12 bg-paper-dark/85" aria-label="Navegação Principal">
          <Link href="/" id="nav-inicio" className={tabClass(false)}>
            <span>Início</span>
          </Link>
          <Link href="/historico" id="nav-historico" className={tabClass(false)}>
            <span>Histórico</span>
          </Link>
          <Link href="/admin" id="nav-admin" className={tabClass(false)}>
            <span>Organizador</span>
          </Link>
        </nav>
      }
    >
      <MainNavInner />
    </Suspense>
  );
}

export function SubmitButton({
  children,
  className,
  pendingLabel = "Enviando…",
  confirm,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...rest}
      type="submit"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-moss/20 px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none cursor-pointer",
        className || "bg-paper text-moss hover:bg-paper-dark",
      )}
      disabled={pending || rest.disabled}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
        rest.onClick?.(e);
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function CopyLink({ url, id, className }: { url: string; id: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      id={id}
      type="button"
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border border-moss/25 bg-white/80 hover:bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition-all active:scale-[0.99] text-moss cursor-pointer",
        className,
      )}
      onClick={async () => {
        const full = new URL(url, window.location.origin).toString();
        if (navigator.share) {
          try {
            await navigator.share({ title: "Votação · Tarde Esportiva", url: full });
            return;
          } catch {}
        }
        await navigator.clipboard.writeText(full);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <>
          <Check className="size-4 text-moss" aria-hidden="true" />
          <span>Link copiado!</span>
        </>
      ) : (
        <>
          <Copy className="size-4 text-moss" aria-hidden="true" />
          <span>Copiar Link</span>
        </>
      )}
    </button>
  );
}

export function ShareVotingLink({
  url,
  matchDate,
  className,
}: {
  url: string;
  matchDate?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const getFullUrl = () => {
    if (typeof window === "undefined") return url;
    return new URL(url, window.location.origin).toString();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getFullUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex flex-col gap-2.5 p-3.5 bg-paper-dark/65 rounded-xl border border-moss/15", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-brick block">
            Votação Aberta • Link dos Participantes
          </span>
          <span className="text-xs text-moss font-mono truncate block select-all">{url}</span>
        </div>
        <Link
          href={url}
          className="rounded-lg border border-moss/20 bg-white/90 hover:bg-white text-moss px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider shadow-2xs"
        >
          Ver Cédula ↗
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-moss/20 bg-white hover:bg-paper-dark py-2 px-3 text-xs font-extrabold uppercase tracking-wider text-moss shadow-hard-sm transition-all active:scale-[0.99] cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-moss" />
              <span>Link Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5 text-moss" />
              <span>Copiar Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
