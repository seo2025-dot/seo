"use client";

import { useEffect } from "react";
import { esErrorDeCarga, puedeRecargarPorCarga } from "@/lib/carga";

/**
 * Último recurso: se muestra cuando falla el propio diseño general de la aplicación. Sustituye a todo el documento, así que lleva su propio
 * <html> y estilos en línea (no depende de ningún archivo que pudiera ser justo el que falló).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!esErrorDeCarga(error)) return;
    try {
      if (puedeRecargarPorCarga(Date.now(), window.sessionStorage)) window.location.reload();
    } catch {
      /* se queda la pantalla de error */
    }
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", background: "#fff", color: "#0f172a" }}>
        <main role="alert" style={{ maxWidth: 420, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>conectari.com</h1>
          <p style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Algo no salió bien</p>
          <p style={{ color: "#475569", margin: "0 0 24px" }}>No pudimos cargar la página. Suele arreglarse al intentarlo de nuevo.</p>
          <button type="button" onClick={() => reset()} style={{ background: "#ff5202", color: "#fff", border: 0, borderRadius: 999, padding: "12px 28px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Intentar de nuevo
          </button>{" "}
          {/* Un enlace normal (no <Link>): tiene que funcionar aunque la navegación interna esté rota */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ display: "inline-block", marginTop: 12, color: "#334155", fontWeight: 600 }}>
            Ir al inicio
          </a>
        </main>
      </body>
    </html>
  );
}
