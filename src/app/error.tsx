"use client";

import Link from "next/link";
import { useEffect } from "react";
import { esErrorDeCarga, puedeRecargarPorCarga } from "@/lib/carga";

/**
 * Pantalla de error de cualquier página: en vez de una página rota o en blanco, la persona ve un mensaje claro con dos salidas (reintentar o ir al
 * inicio). Si el fallo es de carga de archivos (versión nueva publicada) se recarga sola una vez.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!esErrorDeCarga(error)) return;
    try {
      if (puedeRecargarPorCarga(Date.now(), window.sessionStorage)) window.location.reload();
    } catch {
      /* se queda la pantalla de error */
    }
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>
        😕
      </p>
      <h1 className="mt-4 text-2xl font-black text-ink">Algo no salió bien</h1>
      <p className="mt-2 text-slate-600">No pudimos mostrar esta página. Suele arreglarse al intentarlo de nuevo.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => reset()} className="boton-marca rounded-full px-6 py-3 font-bold text-white">
          Intentar de nuevo
        </button>
        <Link href="/" className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50">
          Ir al inicio
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-slate-400">Código de referencia: {error.digest}</p>}
    </div>
  );
}
