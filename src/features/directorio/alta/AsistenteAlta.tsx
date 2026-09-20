"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { VERTICAL_POR_ID, VERTICALES_ACTIVAS, type VerticalId } from "@/data/directorio";
import { ResumenErrores } from "@/features/directorio/alta/Campos";
import EditorHorario from "@/features/directorio/alta/EditorHorario";
import EditorItems from "@/features/directorio/alta/EditorItems";
import { FormContacto, FormDatos, SelectorTipo } from "@/features/directorio/alta/Formularios";
import SubidaImagen from "@/features/directorio/alta/SubidaImagen";
import TarjetaProveedor from "@/features/directorio/TarjetaProveedor";
import { presetHorario } from "@/lib/directorio/horarios";
import { vistaPreviaDesdeBorrador } from "@/lib/directorio/mapeo";
import {
  borradorVacio, filaContacto, filaProveedor, filasItems, itemVacio, validarBorrador, validarPasoCatalogo, validarPasoContacto, validarPasoDatos, validarPasoHorario, validarPasoSeccion,
  type BorradorNegocio, type Errores,
} from "@/lib/directorio/validacion";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import { subirMedia } from "@/lib/supabase/subida";

const CLAVE_BORRADOR = "conectari:alta-negocio:v1";
const FILAS_INICIALES = 3;

const PASOS = ["Tipo", "Tu negocio", "Contacto", "Horario", "Fotos", "Catálogo"] as const;

/** A qué paso pertenece cada error (para volver al primero con problemas al publicar). */
function pasoDeError(clave: string): number {
  if (clave === "vertical" || clave === "subtipo") return 0;
  if (["nombre", "descripcion", "zona", "canales", "costoEnvio", "pedidoMinimo"].includes(clave)) return 1;
  if (["contacto", "whatsapp", "telefono", "direccion"].includes(clave)) return 2;
  if (clave === "horario") return 3;
  return 5;
}

const validadorDe = (paso: number, b: BorradorNegocio): Errores =>
  paso === 0 ? validarPasoSeccion(b) : paso === 1 ? validarPasoDatos(b) : paso === 2 ? validarPasoContacto(b) : paso === 3 ? validarPasoHorario(b) : paso === 5 ? validarPasoCatalogo(b) : {};

/** Mensaje claro para los errores más probables de la base de datos. */
function mensajeDe(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/máximo de 5 perfiles/.test(m)) return "Ya tienes 5 negocios publicados, que es el máximo. Elimina o edita alguno desde «Mi negocio».";
  if (/no existe en esta secci/.test(m)) return "Esa categoría no existe en la sección elegida. Vuelve al primer paso.";
  if (/horario no es válido/.test(m)) return "El horario no es válido. Revisa las horas de apertura y cierre.";
  if (/permission denied|No autenticado|JWT/.test(m)) return "Tu sesión caducó. Inicia sesión de nuevo (tus datos quedan guardados en este dispositivo).";
  return m;
}

function leerBorrador(): BorradorNegocio | null {
  try {
    const t = localStorage.getItem(CLAVE_BORRADOR);
    return t ? ({ ...borradorVacio(), ...JSON.parse(t) } as BorradorNegocio) : null;
  } catch {
    return null;
  }
}
const guardarBorrador = (b: BorradorNegocio) => {
  try {
    // Las imágenes no se guardan en el borrador: pesan y se vuelven a elegir en un momento.
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ ...b, logo: undefined, portada: undefined }));
  } catch {
    /* almacenamiento lleno o bloqueado: el asistente sigue funcionando sin borrador */
  }
};
const borrarBorrador = () => {
  try {
    localStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    /* nada */
  }
};

interface Publicado {
  id: string;
  slug: string;
  vertical: VerticalId;
  avisos: string[];
}

export default function AsistenteAlta() {
  const params = useSearchParams();
  const { sesion, hidratado, refrescarMonedero } = useSocial();
  const [paso, setPaso] = useState(0);
  const [b, setB] = useState<BorradorNegocio>(borradorVacio);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [publicado, setPublicado] = useState<Publicado | null>(null);
  const [cargado, setCargado] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  /** Elige sección y categoría; al cambiar de sección se proponen los canales, el horario y las filas del catálogo de esa sección. */
  const elegirSeccion = useCallback((vertical: VerticalId, subtipo: string) => {
    setB((prev) => {
      const cambio = prev.vertical !== vertical;
      const pl = VERTICAL_POR_ID[vertical].plantilla;
      const preset = presetHorario(pl.horario);
      const sinHorario = !prev.abierto24h && Object.keys(prev.horario).length === 0;
      return {
        ...prev,
        vertical,
        subtipo,
        canales: cambio || prev.canales.length === 0 ? pl.canales : prev.canales,
        horario: cambio || sinHorario ? preset.horario : prev.horario,
        abierto24h: cambio ? preset.abierto24h : prev.abierto24h,
        items: cambio || prev.items.length === 0 ? Array.from({ length: FILAS_INICIALES }, () => itemVacio(pl.secciones[0] ?? "")) : prev.items,
      };
    });
  }, []);

  // Al abrir: recupera el borrador y, si viene de una sección (?seccion=delivery), la deja elegida.
  useEffect(() => {
    const guardado = leerBorrador();
    if (guardado) setB(guardado);
    const s = params.get("seccion");
    const v = VERTICALES_ACTIVAS.find((x) => x.id === s);
    if (v && !guardado?.vertical) elegirSeccion(v.id, "");
    setCargado(true);
  }, [params, elegirSeccion]);

  useEffect(() => {
    if (cargado && !publicado) guardarBorrador(b);
  }, [b, cargado, publicado]);

  useEffect(() => {
    titulo.current?.focus();
  }, [paso, publicado]);

  const cambiar = (parche: Partial<BorradorNegocio>) => setB((prev) => ({ ...prev, ...parche }));
  const v = b.vertical ? VERTICAL_POR_ID[b.vertical] : undefined;

  const siguiente = () => {
    const e = validadorDe(paso, b);
    setErrores(e);
    if (Object.keys(e).length === 0) setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  };

  const publicar = async () => {
    const uid = sesion.uid;
    if (!uid || !haySupabase) return;
    const todos = validarBorrador(b);
    if (Object.keys(todos).length > 0) {
      setErrores(todos);
      setPaso(Math.min(...Object.keys(todos).map(pasoDeError)));
      return;
    }
    setEnviando(true);
    setFallo(null);
    try {
      const [logoUrl, portadaUrl] = await Promise.all([b.logo ? subirMedia(b.logo, uid) : null, b.portada ? subirMedia(b.portada, uid) : null]);
      const { data, error } = await supabase().from("providers").insert(filaProveedor(b, uid, { logoUrl, portadaUrl })).select("id, slug").single();
      if (error) throw error;
      const avisos: string[] = [];
      const contacto = await supabase().from("provider_contacts").insert(filaContacto(b, data.id));
      if (contacto.error) avisos.push(`No se pudo guardar tu contacto (${mensajeDe(contacto.error)}). Añádelo desde «Mi negocio».`);
      const filas = filasItems(b, data.id);
      if (filas.length > 0) {
        const items = await supabase().from("provider_items").insert(filas);
        if (items.error) avisos.push(`No se pudo guardar tu catálogo (${mensajeDe(items.error)}). Súbelo desde «Mi negocio».`);
      }
      borrarBorrador();
      setPublicado({ id: data.id, slug: data.slug, vertical: b.vertical as VerticalId, avisos });
      void refrescarMonedero();
    } catch (e) {
      setFallo(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };

  if (!hidratado) return <div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />;
  if (!sesion.uid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl" aria-hidden>
          🏪
        </p>
        <h1 className="mt-4 text-2xl font-black">Registra tu negocio</h1>
        <p className="mt-2 text-slate-500">Inicia sesión o crea tu cuenta gratis para publicar tu negocio en el directorio.</p>
        <Link href="/login?next=/directorio/mi-negocio/nuevo" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 font-bold text-white">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (publicado) {
    const url = `/directorio/${publicado.vertical}/${publicado.slug}`;
    const texto = `Ya estamos en conectari.com. Encuéntranos aquí: ${typeof window !== "undefined" ? window.location.origin : ""}${url}`;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-6xl" aria-hidden>
          🎉
        </p>
        <h1 ref={titulo} tabIndex={-1} className="mt-3 text-3xl font-black text-ink outline-none">
          ¡Tu negocio ya está publicado!
        </h1>
        <p className="mt-2 text-slate-600">Cualquier persona de la ciudad ya puede encontrarte. Si es tu primer negocio, ganaste <strong>+30 🪙</strong>.</p>
        {publicado.avisos.map((a) => (
          <p key={a} role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {a}
          </p>
        ))}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={url} className="boton-marca rounded-full px-7 py-3 text-sm font-bold text-white">
            Ver mi ficha
          </Link>
          <Link href={`/directorio/mi-negocio/${publicado.id}`} className="rounded-full border border-slate-300 px-7 py-3 text-sm font-bold text-ink hover:border-brand-400">
            Completar mi perfil
          </Link>
          <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-600 px-7 py-3 text-sm font-bold text-white hover:bg-emerald-700">
            Compartir por WhatsApp
          </a>
        </div>
        <p className="mt-8 text-sm text-slate-500">Consejo: los negocios con fotos, horario y al menos 5 {v?.plantilla.item.plural ?? "productos"} reciben muchas más visitas.</p>
      </div>
    );
  }

  const vista = paso === 5 ? vistaPreviaDesdeBorrador(b) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm font-semibold text-brand-700">
        <Link href="/directorio/mi-negocio" className="hover:underline">
          Mi negocio
        </Link>{" "}
        › Registrar
      </p>
      <h1 ref={titulo} tabIndex={-1} className="mt-1 text-3xl font-black text-ink outline-none">
        {paso === 0 ? "Registra tu negocio gratis" : PASOS[paso] === "Catálogo" ? `Tus ${v?.plantilla.item.plural ?? "productos"}` : PASOS[paso] === "Tu negocio" ? "Cuéntanos de tu negocio" : PASOS[paso] === "Contacto" ? "¿Cómo te contactan?" : PASOS[paso] === "Horario" ? "¿Cuándo atiendes?" : "Fotos de tu negocio"}
      </h1>

      <div className="mt-4" role="progressbar" aria-valuemin={1} aria-valuemax={PASOS.length} aria-valuenow={paso + 1} aria-label={`Paso ${paso + 1} de ${PASOS.length}: ${PASOS[paso]}`}>
        <div className="flex gap-1.5">
          {PASOS.map((p, i) => (
            <span key={p} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= paso ? "bg-marca" : "bg-slate-200"}`} />
          ))}
        </div>
        <p className="mt-1.5 text-xs font-semibold text-slate-500">
          Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}
        </p>
      </div>

      <form
        className="mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (paso < PASOS.length - 1) siguiente();
          else void publicar();
        }}
        noValidate
      >
        {paso === 0 && <SelectorTipo b={b} onElegir={elegirSeccion} errores={errores} />}
        {paso === 1 && <FormDatos b={b} onChange={cambiar} errores={errores} />}
        {paso === 2 && <FormContacto b={b} onChange={cambiar} errores={errores} />}
        {paso === 3 && <EditorHorario valor={{ horario: b.horario, abierto24h: b.abierto24h }} onChange={(h) => cambiar(h)} error={errores.horario} />}
        {paso === 4 && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">Las fotos hacen que confíen en ti. Puedes saltar este paso y subirlas después.</p>
            <SubidaImagen etiqueta="Logo o foto del local" ayuda="Cuadrada, se ve en las tarjetas." valor={b.logo} onChange={(logo) => cambiar({ logo })} maxLado={480} forma="cuadrado" />
            <SubidaImagen etiqueta="Foto de portada" ayuda="Horizontal: tu local, tus platos o tu mostrador." valor={b.portada} onChange={(portada) => cambiar({ portada })} maxLado={1200} />
          </div>
        )}
        {paso === 5 && v && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              Añade tus primeros {v.plantilla.item.plural} con su precio. Es lo que la gente busca (y lo que encuentra el buscador). No te preocupes por completarlo todo: podrás añadir más desde «Mi negocio».
            </p>
            {v.plantilla.aviso && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">ℹ️ {v.plantilla.aviso}</p>}
            <EditorItems vertical={v.id} items={b.items} onChange={(items) => cambiar({ items })} errores={errores} />
            {vista && (
              <section aria-label="Vista previa" className="pt-2">
                <h2 className="mb-2 text-sm font-black text-ink">Así aparecerá tu tarjeta en el directorio</h2>
                <div className="pointer-events-none max-w-sm" aria-hidden>
                  <TarjetaProveedor p={vista} />
                </div>
              </section>
            )}
          </div>
        )}

        <ResumenErrores errores={errores} />
        {fallo && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {fallo}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
          {paso > 0 ? (
            <button
              type="button"
              onClick={() => {
                setErrores({});
                setPaso(paso - 1);
              }}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              ← Atrás
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            {paso === 4 && (
              <button type="button" onClick={() => setPaso(5)} className="text-sm font-semibold text-slate-500 underline hover:text-ink">
                Saltar por ahora
              </button>
            )}
            <button type="submit" disabled={enviando} className="boton-marca rounded-full px-8 py-3 text-sm font-bold text-white disabled:opacity-60">
              {paso < PASOS.length - 1 ? "Siguiente →" : enviando ? "Publicando…" : "Publicar mi negocio"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
