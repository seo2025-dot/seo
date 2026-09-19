"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import PruebaSocial from "@/components/PruebaSocial";
import TarjetaAfinidad from "@/components/TarjetaAfinidad";
import { FILTROS_VACIOS, useRecomendaciones, type FiltrosGaleria } from "@/features/conexion/hooks";
import { primerNombre } from "@/lib/mensajes";

const EDAD = { min: 18, max: 70 };
const ALTURA = { min: 140, max: 210 };

/** Par de deslizadores (desde / hasta). Un extremo en su tope significa «sin límite» y se envía como null. */
function Rango({
  etiqueta,
  unidad,
  tope,
  min,
  max,
  onChange,
}: {
  etiqueta: string;
  unidad: string;
  tope: { min: number; max: number };
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const desde = min ?? tope.min;
  const hasta = max ?? tope.max;
  const emitir = (d: number, h: number) => onChange(d <= tope.min ? null : d, h >= tope.max ? null : h);
  return (
    <fieldset className="min-w-0">
      <legend className="flex w-full items-baseline justify-between text-sm font-bold text-ink">
        {etiqueta}
        <span className="text-xs font-semibold tabular-nums text-brand-700">
          {min === null && max === null ? "Cualquiera" : `${min === null ? "sin mínimo" : min} – ${max === null ? "sin máximo" : max} ${unidad}`}
        </span>
      </legend>
      <div className="mt-2 grid gap-1">
        <input
          type="range"
          aria-label={`${etiqueta}: desde`}
          min={tope.min}
          max={tope.max}
          value={desde}
          onChange={(e) => emitir(Math.min(Number(e.target.value), hasta), hasta)}
          className="w-full accent-brand-500"
        />
        <input
          type="range"
          aria-label={`${etiqueta}: hasta`}
          min={tope.min}
          max={tope.max}
          value={hasta}
          onChange={(e) => emitir(desde, Math.max(Number(e.target.value), desde))}
          className="w-full accent-brand-500"
        />
      </div>
    </fieldset>
  );
}

export default function ExplorarPage() {
  const { estado, sesion, hidratado, usuarios, likePersona } = useSocial();
  const [filtros, setFiltros] = useState<FiltrosGaleria>(FILTROS_VACIOS);
  const [aviso, setAviso] = useState<{ texto: string; href?: string } | null>(null);
  const { items, cargando, hayMas, error, masResultados } = useRecomendaciones(filtros);

  const porId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);
  const tarjetas = items.flatMap((rec) => {
    const usuario = porId.get(rec.id);
    return usuario ? [{ rec, usuario }] : [];
  });
  const activos = Object.values(filtros).some((v) => v !== null);

  const conectar = async (id: string, nombre: string) => {
    const r = await likePersona(id);
    if (r.resultado === "match") setAviso({ texto: `🎉 ¡Es un match con ${primerNombre(nombre)}! Ya pueden conversar.`, href: r.chatId ? `/mensajes/${r.chatId}` : "/mensajes" });
    else if (r.resultado === "enviado") setAviso({ texto: `💌 Le avisamos a ${primerNombre(nombre)} que quieres conectar.` });
  };

  if (!hidratado) return <div className="mx-auto h-96 max-w-6xl animate-pulse px-4 py-8" />;

  if (!sesion.uid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl">💞</p>
        <h1 className="mt-4 text-2xl font-black">Descubre a quién encaja contigo</h1>
        <p className="mt-2 text-slate-500">Crea tu perfil, cuéntanos cómo es tu pareja ideal y te mostraremos a las personas más afines.</p>
        <PruebaSocial className="mt-4" />
        <Link href="/registro?next=/explorar" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 font-bold text-white">
          Crear mi cuenta
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-black text-ink sm:text-4xl">
          Personas afines a <span className="texto-marca">ti</span>
        </h1>
        <p className="mt-1 max-w-2xl text-slate-600">Ordenadas por compatibilidad: lo que buscas en tu pareja ideal, formación, intereses y estilo de vida.</p>
        <PruebaSocial className="mt-3 justify-start" />
      </header>

      {!estado.yo.parejaIdeal && (
        <Link href="/perfil" className="mb-6 block rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 transition hover:bg-brand-100">
          <strong>Mejora tus recomendaciones:</strong> describe a tu pareja ideal en tu perfil (es privado) y el motor buscará a quien mejor encaje. <span className="font-bold underline">Completar ahora</span>
        </Link>
      )}

      <section aria-label="Filtros" className="mb-6 grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <Rango etiqueta="Edad" unidad="años" tope={EDAD} min={filtros.edadMin} max={filtros.edadMax} onChange={(a, b) => setFiltros((f) => ({ ...f, edadMin: a, edadMax: b }))} />
        <Rango etiqueta="Estatura" unidad="cm" tope={ALTURA} min={filtros.alturaMin} max={filtros.alturaMax} onChange={(a, b) => setFiltros((f) => ({ ...f, alturaMin: a, alturaMax: b }))} />
        <button
          type="button"
          onClick={() => setFiltros(FILTROS_VACIOS)}
          disabled={!activos}
          className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-300 disabled:opacity-40"
        >
          Quitar filtros
        </button>
      </section>

      {aviso && (
        <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <span>{aviso.texto}</span>
          <span className="flex shrink-0 items-center gap-3">
            {aviso.href && (
              <Link href={aviso.href} className="font-bold underline">
                Ir al chat
              </Link>
            )}
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-emerald-700">
              ✕
            </button>
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
          No pudimos cargar las recomendaciones ({error}). ¿Ya aplicaste la actualización 003 de la base de datos?
        </p>
      )}

      <p className="mb-3 text-sm text-slate-500" aria-live="polite">
        {cargando && tarjetas.length === 0 ? "Buscando afinidades…" : `${tarjetas.length} ${tarjetas.length === 1 ? "persona" : "personas"}${activos ? " con estos filtros" : ""}${hayMas ? " (y más)" : ""}`}
      </p>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cargando && tarjetas.length === 0 && Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-slate-100" />)}
        {tarjetas.map(({ rec, usuario }) => (
          <TarjetaAfinidad key={usuario.id} usuario={usuario} rec={rec} enviado={estado.vistasPersonas.includes(usuario.id)} onConectar={() => void conectar(usuario.id, usuario.nombre)} />
        ))}
      </div>

      {!cargando && tarjetas.length === 0 && !error && (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-4xl">🔎</p>
          <p className="mt-3 font-bold text-ink">Nadie coincide con estos filtros por ahora</p>
          <p className="mt-1 text-sm text-slate-500">Amplía los rangos: cada semana se suman personas nuevas a la comunidad.</p>
        </div>
      )}

      {hayMas && (
        <div className="mt-8 text-center">
          <button type="button" onClick={() => void masResultados()} disabled={cargando} className="rounded-full border border-slate-300 px-8 py-3 font-semibold text-ink transition hover:border-brand-400 disabled:opacity-50">
            {cargando ? "Cargando…" : "Ver más personas"}
          </button>
        </div>
      )}
    </div>
  );
}
