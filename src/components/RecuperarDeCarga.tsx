"use client";

import { useEffect } from "react";
import { esErrorDeCarga, puedeRecargarPorCarga } from "@/lib/carga";

/**
 * Si el navegador no puede cargar un archivo de la aplicación (por ejemplo, tras publicar una versión nueva con la pestaña abierta),
 * recarga la página una vez para traer la versión actual. No dibuja nada.
 */
export default function RecuperarDeCarga() {
  useEffect(() => {
    const recuperar = (motivo: unknown) => {
      if (!esErrorDeCarga(motivo)) return;
      let almacen: Storage | null = null;
      try {
        almacen = window.sessionStorage;
      } catch {
        /* almacenamiento bloqueado */
      }
      if (puedeRecargarPorCarga(Date.now(), almacen)) window.location.reload();
    };
    const alError = (e: ErrorEvent) => recuperar(e.error ?? e.message);
    const alRechazo = (e: PromiseRejectionEvent) => recuperar(e.reason);
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, []);
  return null;
}
