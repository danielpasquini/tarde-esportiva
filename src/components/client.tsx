"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";

export function SubmitButton({
  children,
  className = "btn",
  pendingLabel = "Enviando…",
  confirm,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...rest}
      type="submit"
      className={className}
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
      className="btn btn-gold btn-block"
      onClick={async () => {
        const full = new URL(url, window.location.origin).toString();
        if (navigator.share) {
          try {
            await navigator.share({ title: "Votação · Tarde Esportiva", url: full });
            return;
          } catch {
            /* usuário cancelou: cai para copiar */
          }
        }
        await navigator.clipboard.writeText(full);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? "Link copiado ✓" : "Compartilhar link da votação"}
    </button>
  );
}
