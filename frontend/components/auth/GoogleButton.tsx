"use client";

import { useEffect, useRef } from "react";

type GoogleId = {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SCRIPT = "https://accounts.google.com/gsi/client";

/** Google's own button. Only rendered when the server has a GOOGLE_CLIENT_ID. */
export function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (credential: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const render = () => {
      const g = window.google?.accounts.id;
      if (!g || !holder.current) return;
      g.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential) });
      g.renderButton(holder.current, { theme: "filled_black", size: "large", width: holder.current.clientWidth || 360, text: "continue_with", shape: "rectangular" });
    };
    if (window.google) return render();
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    return () => script.removeEventListener("load", render);
  }, [clientId, onCredential]);

  return <div ref={holder} className="flex min-h-11 w-full justify-center" />;
}
