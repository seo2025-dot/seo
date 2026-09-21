"use client";

import { useCallback, useState } from "react";
import { mensajeErrorAdmin } from "@/lib/adminMonedas";
import { supabase } from "@/lib/supabaseClient";

/** Llama a una función `admin_*` y devuelve { datos } o { error } ya traducido. Todas comprueban `is_admin()` en la base de datos. */
export async function llamarAdmin<T>(funcion: string, args: Record<string, unknown> = {}): Promise<{ datos: T } | { error: string }> {
  const { data, error } = await supabase().rpc(funcion, args);
  return error ? { error: mensajeErrorAdmin(error.message) } : { datos: data as T };
}

/** Estado de una acción que guarda algo: aviso de éxito o error y bandera de «guardando». */
export function useAccion() {
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const ejecutar = useCallback(async (clave: string, f: () => Promise<{ error?: string } | { datos: unknown }>, textoOk: string, despues?: () => void | Promise<void>) => {
    setGuardando(clave);
    setAviso(null);
    const r = await f();
    setGuardando(null);
    if ("error" in r && r.error) return setAviso({ tipo: "error", texto: r.error });
    setAviso({ tipo: "ok", texto: textoOk });
    await despues?.();
  }, []);
  return { guardando, aviso, ejecutar, limpiar: () => setAviso(null) };
}

export function AvisoAccion({ aviso }: { aviso: { tipo: "ok" | "error"; texto: string } | null }) {
  if (!aviso) return null;
  return (
    <p role={aviso.tipo === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm font-medium ${aviso.tipo === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
      {aviso.texto}
    </p>
  );
}

export const FMT_FECHA = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" });
export const fechaHora = (iso: string) => FMT_FECHA.format(new Date(iso));

export const claseInput = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 aria-[invalid=true]:border-rose-400";

export function Tarjeta({ titulo, valor, ayuda, tono = "normal" }: { titulo: string; valor: string; ayuda?: string; tono?: "normal" | "bien" | "atencion" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${tono === "bien" ? "text-emerald-700" : tono === "atencion" ? "text-amber-700" : "text-ink"}`}>{valor}</p>
      {ayuda && <p className="mt-0.5 text-xs text-slate-500">{ayuda}</p>}
    </div>
  );
}
