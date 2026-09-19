/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import { supabase } from "@/lib/supabaseClient";
import { urlKyc } from "@/lib/supabase/subida";

interface Solicitud {
  id: string;
  user_id: string;
  doc_path: string;
  selfie_path: string;
  created_at: string;
  nombre: string;
  doc?: string | null;
  selfie?: string | null;
}

/** Cola de revisión de identidad. Solo accesible para usuarios en la tabla `app_admins` (lo impone la base de datos). */
export default function AdminKycPage() {
  const { esAdmin, sesion } = useSocial();
  const [cola, setCola] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const sb = supabase();
    const { data, error: e } = await sb.from("kyc_submissions").select("id, user_id, doc_path, selfie_path, created_at").eq("status", "pending").order("created_at");
    if (e) return setError(e.message);
    const filas = (data ?? []) as Omit<Solicitud, "nombre">[];
    const { data: perfiles } = filas.length ? await sb.from("profiles").select("id, display_name").in("id", filas.map((f) => f.user_id)) : { data: [] };
    const nombres = new Map(((perfiles ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
    const conUrls = await Promise.all(
      filas.map(async (f) => ({ ...f, nombre: nombres.get(f.user_id) ?? f.user_id, doc: await urlKyc(f.doc_path), selfie: await urlKyc(f.selfie_path) })),
    );
    setCola(conUrls);
  }, []);

  useEffect(() => {
    if (esAdmin) void cargar();
  }, [esAdmin, cargar]);

  const resolver = async (s: Solicitud, aprobar: boolean) => {
    setOcupado(s.id);
    setError(null);
    const { error: e } = await supabase().rpc("review_kyc", { p_submission: s.id, p_approve: aprobar, p_reason: aprobar ? null : motivo[s.id] || null });
    setOcupado(null);
    if (e) return setError(e.message);
    await cargar();
  };

  if (!sesion.lista) return <div className="mx-auto h-64 max-w-3xl animate-pulse px-4 py-10" />;

  if (!esAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 text-xl font-bold">Acceso restringido</h1>
        <p className="mt-1 text-sm text-slate-500">Solo los administradores pueden revisar verificaciones de identidad.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Revisión de identidad</h1>
      <p className="mt-1 text-slate-500">Compara la selfie con el documento. Los enlaces caducan a los 10 minutos.</p>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {cola === null ? (
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : cola.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No hay solicitudes pendientes 🎉</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {cola.map((s) => (
            <li key={s.id} className="rounded-2xl border border-slate-200 p-5">
              <p className="font-semibold">
                {s.nombre} <span className="text-xs font-normal text-slate-400">· {new Date(s.created_at).toLocaleString("es-ES")}</span>
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[["Documento", s.doc], ["Selfie", s.selfie]].map(([etiqueta, url]) => (
                  <figure key={etiqueta}>
                    {url ? <img src={url} alt={etiqueta ?? ""} className="max-h-64 w-full rounded-xl bg-slate-100 object-contain" /> : <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">Sin imagen</div>}
                    <figcaption className="mt-1 text-center text-xs text-slate-500">{etiqueta}</figcaption>
                  </figure>
                ))}
              </div>
              <input
                value={motivo[s.id] ?? ""}
                onChange={(e) => setMotivo((m) => ({ ...m, [s.id]: e.target.value }))}
                placeholder="Motivo del rechazo (opcional)"
                aria-label="Motivo del rechazo"
                className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={ocupado === s.id} onClick={() => resolver(s, true)} className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  Aprobar
                </button>
                <button type="button" disabled={ocupado === s.id} onClick={() => resolver(s, false)} className="flex-1 rounded-xl bg-rose-600 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
