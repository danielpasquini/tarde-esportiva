"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "inline-flex items-center justify-center gap-1.5 border-2 border-moss px-3 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
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

export function CopyLink({ url, id }: { url: string; id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      id={id}
      type="button"
      className="flex w-full items-center justify-center gap-2 border-[3px] border-moss bg-paper-dark px-4 py-3 text-xs font-bold uppercase tracking-widest shadow-hard-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none text-moss"
      onClick={async () => {
        const full = new URL(url, window.location.origin).toString();
        if (navigator.share) {
          try {
            await navigator.share({ title: "Votação · Tarde Esportiva", url: full });
            return;
          } catch {
            /* usuário cancelou */
          }
        }
        await navigator.clipboard.writeText(full);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <>
          <Check className="size-4 text-moss" />
          Link copiado
        </>
      ) : (
        <>
          <Copy className="size-4 text-moss" />
          Compartilhar link da votação
        </>
      )}
    </button>
  );
}
