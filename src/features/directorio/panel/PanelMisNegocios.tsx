"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { MAX_PERFILES_POR_PERSONA, VERTICAL_POR_ID, etiquetaSubtipo } from "@/data/directorio";
import MedidorNegocio from "@/features/directorio/panel/MedidorNegocio";
import { completitudNegocio } from "@/lib/directorio/completitud";
import { mapearProveedor, type FilaProveedor } from "@/lib/directorio/mapeo";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import type { ContactoProveedor, Proveedor } from "@/types/directorio";

interface Extras {
  contacto: ContactoProveedor | null;
  items: number;
}

const ETIQUETA_ESTADO = {
  active: { texto: "Publicado", clase: "bg-emerald-50 text-emerald-700" },
  paused: { texto: "Pausado", clase: "bg-slate-100 text-slate-600" },
  review: { texto: "En revisión", clase: "bg-amber-50 text-amber-800" },
  suspended: { texto: "Suspendido", clase: "bg-rose-50 text-rose-700" },
} as const;

/** «Mi negocio»: los perfiles que publicaste, su estado y qué les falta para estar completos. */
export default function PanelMisNegocios() {
  const { sesion, hidratado } = useSocial();
  const [negocios, setNegocios] = useState<Proveedor[] | null>(null);
  const [extras, setExtras] = useState<Record<string, Extras>>({});
  const [error, setError] = useState<string | null>(null);
  const [nuevosPedidos, setNuevosPedidos] = useState(0);

  const cargar = useCallback(async () => {
    if (!sesion.uid || !haySupabase) return;
    const sb = supabase();
    const { data, error: err } = await sb.from("providers").select("*").eq("owner_id", sesion.uid).order("created_at", { ascending: false });
    if (err) {
      setError(/schema cache|does not exist/i.test(err.message) ? "Aplica las actualizaciones 006 y 007 de la base de datos." : err.message);
      setNegocios([]);
      return;
    }
    const lista = ((data ?? []) as FilaProveedor[]).flatMap((f) => mapearProveedor(f) ?? []);
    setNegocios(lista);
    if (lista.length === 0) return;
    // Pedidos que esperan respuesta (si la 008 no está aplicada la consulta falla y simplemente no hay insignia).
    const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("provider_owner_id", sesion.uid).eq("status", "placed");
    setNuevosPedidos(count ?? 0);
    const ids = lista.map((n) => n.id);
    const [items, contactos] = await Promise.all([sb.from("provider_items").select("provider_id").in("provider_id", ids), sb.from("provider_contacts").select("*").in("provider_id", ids)]);
    const mapa: Record<string, Extras> = Object.fromEntries(ids.map((i) => [i, { contacto: null, items: 0 }]));
    for (const it of (items.data ?? []) as { provider_id: string }[]) mapa[it.provider_id].items++;
    for (const c of (contactos.data ?? []) as { provider_id: string; phone: string | null; whatsapp: string | null; address: string | null }[]) {
      mapa[c.provider_id].contacto = { telefono: c.phone ?? undefined, whatsapp: c.whatsapp ?? undefined, direccion: c.address ?? undefined };
    }
    setExtras(mapa);
  }, [sesion.uid]);

  useEffect(() => {
    if (hidratado) void cargar();
  }, [hidratado, cargar]);

  const alternar = async (n: Proveedor) => {
    const activar = n.estado !== "active";
    const { error: err } = await supabase().rpc("set_provider_active", { p_provider: n.id, p_active: activar });
    if (err) return setError(err.message);
    setNegocios((prev) => prev?.map((x) => (x.id === n.id ? { ...x, estado: activar ? "active" : "paused" } : x)) ?? prev);
  };

  const puedeCrear = useMemo(() => (negocios?.length ?? 0) < MAX_PERFILES_POR_PERSONA, [negocios]);

  if (!hidratado || negocios === null) return <div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-10" />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-ink">Mi negocio</h1>
          <p className="text-slate-500">Los negocios que publicaste en el directorio.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {negocios.some((n) => n.vertical === "eventos") && (
            <Link href="/directorio/mi-negocio/eventos" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
              🎟️ Mis eventos
            </Link>
          )}
          {negocios.some((n) => n.vertical === "movilidad" || n.vertical === "hogar" || n.vertical === "mascotas") && (
            <Link href="/directorio/solicitudes" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
              🙋 Solicitudes
            </Link>
          )}
          {negocios.length > 0 && (
            <Link href="/directorio/mi-negocio/pedidos" className="relative rounded-full border border-slate-300 px-6 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
              🧾 Pedidos recibidos
              {nuevosPedidos > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white" aria-label={`${nuevosPedidos} pedidos nuevos`}>
                  {nuevosPedidos}
                </span>
              )}
            </Link>
          )}
          {puedeCrear && (
            <Link href="/directorio/mi-negocio/nuevo" className="boton-marca rounded-full px-6 py-2.5 text-sm font-bold text-white">
              + Registrar un negocio
            </Link>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {negocios.length === 0 && !error ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-4xl" aria-hidden>
            🏪
          </p>
          <p className="mt-3 font-bold text-ink">Aún no has publicado ningún negocio</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Restaurantes, cafeterías, farmacias y más: aparece gratis ante toda la ciudad. Ganas +30 🪙 con tu primer perfil.</p>
          <Link href="/directorio/mi-negocio/nuevo" className="boton-marca mt-5 inline-block rounded-full px-7 py-3 text-sm font-bold text-white">
            Registrar mi negocio
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {negocios.map((n) => {
            const v = VERTICAL_POR_ID[n.vertical];
            const e = extras[n.id];
            const est = ETIQUETA_ESTADO[n.estado];
            return (
              <li key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-ink">{n.nombre}</h2>
                    <p className="text-xs text-slate-500">
                      {v.emoji} {v.etiqueta} · {etiquetaSubtipo(n.vertical, n.subtipo)}
                      {n.zona && <> · 📍 {n.zona}</>}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${est.clase}`}>{est.texto}</span>
                </div>
                {e && (
                  <div className="mt-3">
                    <MedidorNegocio c={completitudNegocio(n, e.contacto, Array.from({ length: e.items }, (_, i) => ({ id: String(i) })), v.capacidades.catalogo.length > 0)} compacto />
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/directorio/mi-negocio/${n.id}`} className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white">
                    Editar
                  </Link>
                  {(n.estado === "active" || n.estado === "paused") && (
                    <Link href={`/directorio/${n.vertical}/${n.slug}`} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-ink hover:border-brand-400">
                      Ver ficha
                    </Link>
                  )}
                  {(n.estado === "active" || n.estado === "paused") && (
                    <button type="button" onClick={() => void alternar(n)} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                      {n.estado === "active" ? "Pausar" : "Publicar de nuevo"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
