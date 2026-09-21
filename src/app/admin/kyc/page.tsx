/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import NavAdmin from "@/features/admin/NavAdmin";
import { fotosDeVarios } from "@/features/fotos/useFotosPerfil";
import { supabase } from "@/lib/supabaseClient";
import { urlKyc } from "@/lib/supabase/subida";

type Estado = "pending" | "approved" | "rejected";

interface Fila {
  id: string;
  user_id: string;
  status: Estado;
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  doc_path: string;
  selfie_path: string;
  display_name: string;
  handle: string | null;
  email: string | null;
  age: number | null;
  avatar_url: string | null;
  location: string | null;
}

interface Solicitud extends Fila {
  doc: string | null;
  selfie: string | null;
  perfil: string | null;
}

const PESTANAS: { id: Estado; etiqueta: string }[] = [
  { id: "pending", etiqueta: "Pendientes" },
  { id: "approved", etiqueta: "Aprobadas" },
  { id: "rejected", etiqueta: "Rechazadas" },
];

/** Motivos frecuentes de rechazo: un toque en vez de escribir. La persona los recibe en su notificación. */
const MOTIVOS = ["La foto de la cédula no se lee bien", "La cédula sale incompleta o cortada", "La selfie no se ve con claridad", "La selfie no coincide con la cédula", "Sube una cédula vigente"];

const FECHA = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" });

function Foto({ titulo, url }: { titulo: string; url: string | null }) {
  return (
    <figure>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir en grande">
          <img src={url} alt={titulo} className="h-56 w-full rounded-xl bg-slate-100 object-contain" />
        </a>
      ) : (
        <div className="flex h-56 items-center justify-center rounded-xl bg-slate-100 px-3 text-center text-sm text-slate-400">Sin imagen</div>
      )}
      <figcaption className="mt-1 text-center text-xs font-semibold text-slate-600">{titulo}</figcaption>
    </figure>
  );
}

/**
 * Verificación de identidad. Cada solicitud muestra a la persona (nombre, correo, edad) y tres fotos lado a lado: su cédula, su selfie y su foto de
 * perfil. Los enlaces de las imágenes caducan a los 10 minutos. Solo administradores (lo impone la base de datos).
 */
export default function AdminKycPage() {
  const { esAdmin, sesion } = useSocial();
  const [pestana, setPestana] = useState<Estado>("pending");
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async (estado: Estado) => {
    setLista(null);
    const { data, error: e } = await supabase().rpc("admin_kyc_queue", { p_status: estado, p_limit: 50 });
    if (e) return setError(e.message);
    setError(null);
    const filas = (data ?? []) as Fila[];
    const fotos = await fotosDeVarios([...new Set(filas.map((f) => f.user_id))]);
    setLista(
      await Promise.all(
        filas.map(async (f) => ({ ...f, doc: await urlKyc(f.doc_path), selfie: await urlKyc(f.selfie_path), perfil: fotos[f.user_id]?.[0]?.url ?? f.avatar_url })),
      ),
    );
  }, []);

  useEffect(() => {
    if (esAdmin) void cargar(pestana);
  }, [esAdmin, pestana, cargar]);

  const resolver = async (s: Solicitud, aprobar: boolean) => {
    setOcupado(s.id);
    setError(null);
    const { error: e } = await supabase().rpc("review_kyc", { p_submission: s.id, p_approve: aprobar, p_reason: aprobar ? null : motivo[s.id]?.trim() || null });
    setOcupado(null);
    if (e) return setError(e.message);
    await cargar(pestana);
  };

  if (!sesion.lista) return <div className="mx-auto h-64 max-w-4xl animate-pulse px-4 py-10" />;

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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-black text-ink">Verificación de identidad</h1>
      <p className="mb-5 mt-1 text-slate-500">Comprueba que la cédula, la selfie y la foto de perfil son de la misma persona. Toca una foto para verla en grande.</p>
      <NavAdmin actual="/admin/kyc" />

      <div role="tablist" aria-label="Estado" className="mb-5 flex gap-2">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${pestana === p.id ? "border-ink bg-ink text-white" : "border-slate-300 text-slate-600 hover:border-brand-400"}`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {lista === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          {pestana === "pending" ? "No hay solicitudes pendientes 🎉" : "Nada por aquí todavía."}
        </p>
      ) : (
        <ul className="space-y-6">
          {lista.map((s) => (
            <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-black text-ink">
                    {s.display_name} <span className="text-sm font-normal text-slate-400">{s.handle}</span>
                  </p>
                  <p className="break-all text-sm text-slate-600">{s.email ?? "—"}</p>
                  <p className="text-xs text-slate-500">
                    {s.age ? `${s.age} años · ` : ""}
                    {s.location ? `${s.location} · ` : ""}
                    enviada el {FECHA.format(new Date(s.created_at))}
                  </p>
                </div>
                {s.status !== "pending" && (
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {s.status === "approved" ? "Aprobada" : "Rechazada"}
                    {s.reviewed_at ? ` · ${FECHA.format(new Date(s.reviewed_at))}` : ""}
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Foto titulo="Cédula" url={s.doc} />
                <Foto titulo="Selfie" url={s.selfie} />
                <Foto titulo="Foto de perfil" url={s.perfil} />
              </div>

              {s.status === "pending" ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2" aria-label="Motivos frecuentes de rechazo">
                    {MOTIVOS.map((m) => (
                      <button key={m} type="button" onClick={() => setMotivo((x) => ({ ...x, [s.id]: m }))} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-700">
                        {m}
                      </button>
                    ))}
                  </div>
                  <input
                    value={motivo[s.id] ?? ""}
                    onChange={(e) => setMotivo((x) => ({ ...x, [s.id]: e.target.value }))}
                    placeholder="Motivo del rechazo (la persona lo verá)"
                    aria-label="Motivo del rechazo"
                    maxLength={200}
                    className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={ocupado === s.id} onClick={() => void resolver(s, true)} className="flex-1 rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                      Aprobar
                    </button>
                    <button type="button" disabled={ocupado === s.id} onClick={() => void resolver(s, false)} className="flex-1 rounded-xl bg-rose-600 py-3 font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                      Rechazar
                    </button>
                  </div>
                </>
              ) : (
                s.reason && <p className="mt-3 text-sm text-slate-600">Motivo: {s.reason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
