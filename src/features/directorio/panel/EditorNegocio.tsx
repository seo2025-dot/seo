"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { VERTICAL_POR_ID, etiquetaSubtipo } from "@/data/directorio";
import { ResumenErrores } from "@/features/directorio/alta/Campos";
import EditorHorario from "@/features/directorio/alta/EditorHorario";
import { FormContacto, FormDatos } from "@/features/directorio/alta/Formularios";
import SubidaImagen from "@/features/directorio/alta/SubidaImagen";
import GestorCatalogo from "@/features/directorio/panel/GestorCatalogo";
import GestorTurnos from "@/features/directorio/panel/GestorTurnos";
import MedidorNegocio from "@/features/directorio/panel/MedidorNegocio";
import { completitudNegocio } from "@/lib/directorio/completitud";
import { mapearItem, mapearProveedor, mapearTurno, type FilaItem, type FilaProveedor, type FilaTurno } from "@/lib/directorio/mapeo";
import { borradorDesdeProveedor, filaActualizacion, validarPasoContacto, validarPasoDatos, validarPasoHorario, type BorradorNegocio, type Errores } from "@/lib/directorio/validacion";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import { subirMedia } from "@/lib/supabase/subida";
import type { ContactoProveedor, ItemCatalogo, Proveedor, TurnoGuardia } from "@/types/directorio";

type Pestana = "datos" | "contacto" | "horario" | "catalogo" | "turnos" | "visibilidad";

interface FilaContacto {
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
}

const ESTADOS = {
  active: { texto: "Publicado: todo el mundo puede verte.", clase: "bg-emerald-50 text-emerald-800" },
  paused: { texto: "Pausado: tu negocio no aparece en el directorio.", clase: "bg-slate-100 text-slate-700" },
  review: { texto: "En revisión: varias personas denunciaron este perfil y la moderación lo está revisando.", clase: "bg-amber-50 text-amber-900" },
  suspended: { texto: "Suspendido por la moderación. Escríbenos desde Contacto si crees que es un error.", clase: "bg-rose-50 text-rose-800" },
} as const;

export default function EditorNegocio({ id }: { id: string }) {
  const router = useRouter();
  const { sesion, hidratado } = useSocial();
  const [pestana, setPestana] = useState<Pestana>("datos");
  const [p, setP] = useState<Proveedor | null | undefined>(undefined);
  const [b, setB] = useState<BorradorNegocio | null>(null);
  const [contacto, setContacto] = useState<ContactoProveedor | null>(null);
  const [tieneContacto, setTieneContacto] = useState(false);
  const [items, setItems] = useState<ItemCatalogo[]>([]);
  const [turnos, setTurnos] = useState<TurnoGuardia[]>([]);
  const [errores, setErrores] = useState<Errores>({});
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!sesion.uid || !haySupabase) return;
    const sb = supabase();
    const { data } = await sb.from("providers").select("*").eq("id", id).maybeSingle();
    const prov = data ? mapearProveedor(data as FilaProveedor) : null;
    if (!prov || prov.ownerId !== sesion.uid) {
      setP(null);
      return;
    }
    const [it, co, tu] = await Promise.all([
      sb.from("provider_items").select("*").eq("provider_id", id).order("sort_order"),
      sb.from("provider_contacts").select("*").eq("provider_id", id).maybeSingle(),
      sb.from("provider_duty_shifts").select("*").eq("provider_id", id).order("starts_at"),
    ]);
    const c = co.data as FilaContacto | null;
    const contactoActual = c ? { telefono: c.phone ?? undefined, whatsapp: c.whatsapp ?? undefined, direccion: c.address ?? undefined } : null;
    setP(prov);
    setContacto(contactoActual);
    setTieneContacto(!!c);
    setB(borradorDesdeProveedor(prov, contactoActual));
    setItems(((it.data ?? []) as FilaItem[]).map(mapearItem));
    setTurnos(((tu.data ?? []) as FilaTurno[]).map(mapearTurno));
  }, [id, sesion.uid]);

  useEffect(() => {
    if (hidratado) void cargar();
  }, [hidratado, cargar]);

  const medidor = useMemo(() => (p ? completitudNegocio(p, contacto, items, VERTICAL_POR_ID[p.vertical].capacidades.catalogo.length > 0) : null), [p, contacto, items]);

  if (!hidratado || p === undefined) return <div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-10" />;
  if (!sesion.uid || p === null || !b) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden>
          🔍
        </p>
        <h1 className="mt-3 text-xl font-black">No encontramos ese negocio</h1>
        <p className="mt-1 text-sm text-slate-500">Puede que no sea tuyo o que ya no exista.</p>
        <Link href="/directorio/mi-negocio" className="boton-marca mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-bold text-white">
          Ir a mi negocio
        </Link>
      </div>
    );
  }

  const v = VERTICAL_POR_ID[p.vertical];
  const cambiar = (parche: Partial<BorradorNegocio>) => setB((prev) => (prev ? { ...prev, ...parche } : prev));
  const ok = (texto: string) => setMensaje({ tipo: "ok", texto });
  const fallo = (texto: string) => setMensaje({ tipo: "error", texto });

  /** Guarda los datos del perfil (nombre, zona, canales, envío, horario e imágenes). */
  const guardarPerfil = async (validar: (b: BorradorNegocio) => Errores) => {
    const e = validar(b);
    setErrores(e);
    if (Object.keys(e).length > 0 || !sesion.uid) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const logoUrl = b.logo === p.logoUrl ? undefined : b.logo ? await subirMedia(b.logo, sesion.uid) : null;
      const portadaUrl = b.portada === p.portadaUrl ? undefined : b.portada ? await subirMedia(b.portada, sesion.uid) : null;
      const { data, error } = await supabase().from("providers").update(filaActualizacion(b, { logoUrl, portadaUrl })).eq("id", p.id).select("*").single();
      if (error) throw error;
      const nuevo = mapearProveedor(data as FilaProveedor);
      if (nuevo) {
        setP(nuevo);
        setB((prev) => (prev ? { ...prev, logo: nuevo.logoUrl, portada: nuevo.portadaUrl } : prev));
      }
      ok("Cambios guardados ✓");
    } catch (err) {
      fallo(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarContacto = async () => {
    const e = validarPasoContacto(b);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setMensaje(null);
    const cols = { phone: b.telefono.trim() || null, whatsapp: b.whatsapp.trim() || null, address: b.direccion.trim() || null };
    const { error } = tieneContacto ? await supabase().from("provider_contacts").update(cols).eq("provider_id", p.id) : await supabase().from("provider_contacts").insert({ provider_id: p.id, ...cols });
    setGuardando(false);
    if (error) return fallo(error.message);
    setTieneContacto(true);
    setContacto({ telefono: cols.phone ?? undefined, whatsapp: cols.whatsapp ?? undefined, direccion: cols.address ?? undefined });
    ok("Contacto guardado ✓");
  };

  const alternarVisible = async () => {
    const activar = p.estado !== "active";
    const { error } = await supabase().rpc("set_provider_active", { p_provider: p.id, p_active: activar });
    if (error) return fallo(error.message);
    setP({ ...p, estado: activar ? "active" : "paused" });
    ok(activar ? "Tu negocio vuelve a estar visible ✓" : "Tu negocio quedó pausado ✓");
  };

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar «${p.nombre}» para siempre? Se borrarán también su catálogo, sus reseñas y sus turnos.`)) return;
    const { error } = await supabase().from("providers").delete().eq("id", p.id);
    if (error) return fallo(error.message);
    router.push("/directorio/mi-negocio");
  };

  const pestanas: { id: Pestana; etiqueta: string }[] = [
    { id: "datos", etiqueta: "Datos y fotos" },
    { id: "contacto", etiqueta: "Contacto" },
    { id: "horario", etiqueta: "Horario" },
    ...(v.capacidades.catalogo.length > 0 ? [{ id: "catalogo" as const, etiqueta: `${v.plantilla.item.plural[0].toUpperCase()}${v.plantilla.item.plural.slice(1)} (${items.length})` }] : []),
    ...(v.capacidades.turnos ? [{ id: "turnos" as const, etiqueta: "Turnos" }] : []),
    { id: "visibilidad", etiqueta: "Visibilidad" },
  ];
  const estado = ESTADOS[p.estado];
  const botonGuardar = (accion: () => void) => (
    <button type="button" onClick={accion} disabled={guardando} className="boton-marca rounded-full px-7 py-2.5 text-sm font-bold text-white disabled:opacity-60">
      {guardando ? "Guardando…" : "Guardar cambios"}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm font-semibold text-brand-700">
        <Link href="/directorio/mi-negocio" className="hover:underline">
          Mi negocio
        </Link>{" "}
        › Editar
      </p>
      <header className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-ink">{p.nombre}</h1>
          <p className="text-sm text-slate-500">
            {v.emoji} {v.etiqueta} · {etiquetaSubtipo(p.vertical, p.subtipo)}
          </p>
        </div>
        <Link href={`/directorio/${p.vertical}/${p.slug}`} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-ink hover:border-brand-400">
          Ver mi ficha pública
        </Link>
      </header>

      <p className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-medium ${estado.clase}`}>{estado.texto}</p>
      {medidor && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <MedidorNegocio c={medidor} />
        </div>
      )}

      <div role="tablist" aria-label="Secciones del negocio" className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {pestanas.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={pestana === t.id}
            onClick={() => {
              setPestana(t.id);
              setErrores({});
              setMensaje(null);
            }}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${pestana === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6" role="tabpanel">
        {mensaje && (
          <p role={mensaje.tipo === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm font-medium ${mensaje.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
            {mensaje.texto}
          </p>
        )}

        {pestana === "datos" && (
          <>
            <FormDatos b={b} onChange={cambiar} errores={errores} />
            <div className="grid gap-6 sm:grid-cols-2">
              <SubidaImagen etiqueta="Logo o foto del local" valor={b.logo} onChange={(logo) => cambiar({ logo })} maxLado={480} forma="cuadrado" />
              <SubidaImagen etiqueta="Foto de portada" valor={b.portada} onChange={(portada) => cambiar({ portada })} maxLado={1200} />
            </div>
            <ResumenErrores errores={errores} />
            {botonGuardar(() => void guardarPerfil(validarPasoDatos))}
          </>
        )}

        {pestana === "contacto" && (
          <>
            <FormContacto b={b} onChange={cambiar} errores={errores} />
            <ResumenErrores errores={errores} />
            {botonGuardar(() => void guardarContacto())}
          </>
        )}

        {pestana === "horario" && (
          <>
            <EditorHorario valor={{ horario: b.horario, abierto24h: b.abierto24h }} onChange={(h) => cambiar(h)} error={errores.horario} />
            {botonGuardar(() => void guardarPerfil(validarPasoHorario))}
          </>
        )}

        {pestana === "catalogo" && <GestorCatalogo proveedorId={p.id} vertical={p.vertical} items={items} onChange={setItems} />}

        {pestana === "turnos" && <GestorTurnos proveedorId={p.id} verificado={p.verificado} turnos={turnos} onChange={setTurnos} />}

        {pestana === "visibilidad" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-black text-ink">Mostrar en el directorio</h2>
              <p className="mt-1 text-sm text-slate-600">Si pausas tu negocio deja de aparecer en búsquedas y listados, pero no pierdes nada: puedes volver a publicarlo cuando quieras.</p>
              {p.estado === "active" || p.estado === "paused" ? (
                <button type="button" onClick={() => void alternarVisible()} className={`mt-4 rounded-full px-6 py-2.5 text-sm font-bold ${p.estado === "active" ? "border border-slate-300 text-ink hover:border-brand-400" : "boton-marca text-white"}`}>
                  {p.estado === "active" ? "Pausar mi negocio" : "Publicar de nuevo"}
                </button>
              ) : (
                <p className="mt-3 text-sm text-slate-500">La visibilidad de este perfil la gestiona ahora la moderación.</p>
              )}
            </section>
            <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
              <h2 className="font-black text-rose-900">Eliminar mi negocio</h2>
              <p className="mt-1 text-sm text-rose-900/80">Se borra para siempre, junto con su catálogo, sus turnos y sus reseñas.</p>
              <button type="button" onClick={() => void eliminar()} className="mt-4 rounded-full bg-rose-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-700">
                Eliminar definitivamente
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
