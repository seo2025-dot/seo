"use client";

import { useState } from "react";
import Chips from "@/components/Chips";
import { ZONAS } from "@/data/catalogos";
import { CANALES, VERTICALES, VERTICAL_POR_ID, type CanalId, type VerticalId } from "@/data/directorio";
import { Campo, claseCampo } from "@/features/directorio/alta/Campos";
import { pedirGps } from "@/features/geo/ubicacion";
import { CIUDADES, PAISES, PAIS_POR_CODIGO, redondearCoordenada } from "@/lib/geo";
import { LIMITES, type BorradorNegocio, type Errores } from "@/lib/directorio/validacion";

type Cambio = (parche: Partial<BorradorNegocio>) => void;

/** Paso «Tipo»: sección y categoría. Las secciones que aún no tienen interfaz se muestran deshabilitadas. */
export function SelectorTipo({ b, onElegir, errores }: { b: BorradorNegocio; onElegir: (vertical: VerticalId, subtipo: string) => void; errores: Errores }) {
  const v = b.vertical ? VERTICAL_POR_ID[b.vertical] : undefined;
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">¿En qué sección quieres aparecer?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {VERTICALES.map((s) => {
            const activo = b.vertical === s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!s.activa}
                aria-pressed={activo}
                onClick={() => onElegir(s.id, activo ? b.subtipo : "")}
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${activo ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.degradado} text-2xl`} aria-hidden>
                  {s.emoji}
                </span>
                <span>
                  <span className="block font-black text-ink">{s.etiqueta}</span>
                  <span className="block text-xs text-slate-500">{s.activa ? s.lema : "Muy pronto"}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errores.vertical && (
          <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">
            {errores.vertical}
          </p>
        )}
      </fieldset>

      {v && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">¿Qué tipo de negocio eres?</legend>
          <div className="flex flex-wrap gap-2">
            {v.subtipos.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={b.subtipo === s.id}
                onClick={() => onElegir(v.id, s.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${b.subtipo === s.id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}
              >
                {s.emoji} {s.etiqueta}
              </button>
            ))}
          </div>
          {errores.subtipo && (
            <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">
              {errores.subtipo}
            </p>
          )}
          {v.plantilla.aviso && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">ℹ️ {v.plantilla.aviso}</p>}
        </fieldset>
      )}
    </div>
  );
}

/** País, ciudad y punto en el mapa del negocio. Sin coordenadas el negocio se lista igual, pero no sale ordenado en «Cerca de mí». */
function UbicacionNegocio({ b, onChange }: { b: BorradorNegocio; onChange: Cambio }) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ciudades = CIUDADES.filter((c) => c.pais === (b.pais || "EC"));

  const ubicarme = async () => {
    setBuscando(true);
    setAviso(null);
    const r = await pedirGps();
    setBuscando(false);
    if (!r.ok) return setAviso("No pudimos ubicarte. Puedes elegir el país y la ciudad y dejar el punto sin marcar.");
    // Un negocio es un lugar público: se guarda con 3 decimales (≈110 m), no con la precisión completa del GPS.
    onChange({ pais: r.ubicacion.pais, ciudad: r.ubicacion.ciudad ?? b.ciudad, lat: redondearCoordenada(r.ubicacion.lat, 3), lng: redondearCoordenada(r.ubicacion.lng, 3) });
    setAviso("Listo: ubicamos tu negocio. Asegúrate de estar en el local al pulsarlo.");
  };

  return (
    <fieldset className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <legend className="px-1 text-sm font-bold text-ink">Dónde está tu negocio</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="neg-pais" etiqueta="País">
          <select id="neg-pais" value={b.pais || "EC"} onChange={(e) => onChange({ pais: e.target.value, ciudad: PAIS_POR_CODIGO[e.target.value]?.capital ?? "", zona: e.target.value === "EC" ? b.zona : "", lat: undefined, lng: undefined })} className={claseCampo}>
            {PAISES.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="neg-ciudad" etiqueta="Ciudad">
          <input id="neg-ciudad" list="neg-ciudades" value={b.ciudad ?? ""} onChange={(e) => onChange({ ciudad: e.target.value, lat: undefined, lng: undefined })} maxLength={60} className={claseCampo} />
          <datalist id="neg-ciudades">
            {ciudades.map((c) => (
              <option key={c.nombre} value={c.nombre} />
            ))}
          </datalist>
        </Campo>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void ubicarme()} disabled={buscando} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-ink hover:border-brand-400 disabled:opacity-60">
          {buscando ? "Buscando…" : b.lat !== undefined ? "📍 Actualizar el punto de mi negocio" : "📍 Marcar mi negocio en el mapa"}
        </button>
        {b.lat !== undefined && b.lng !== undefined && <span className="text-xs font-semibold text-emerald-700">Punto marcado ({b.lat}, {b.lng})</span>}
      </div>
      <p className="text-xs text-slate-500">Así te encuentran «cerca de mí». Solo se guarda un punto aproximado del local (~100 m).</p>
      {aviso && (
        <p role="status" className="text-xs font-medium text-slate-700">
          {aviso}
        </p>
      )}
    </fieldset>
  );
}

/** Nombre, descripción, zona, cómo atiende y costos de entrega. */
export function FormDatos({ b, onChange, errores }: { b: BorradorNegocio; onChange: Cambio; errores: Errores }) {
  const entrega = b.canales.includes("entrega");
  return (
    <div className="space-y-5">
      <Campo id="neg-nombre" etiqueta="Nombre del negocio" error={errores.nombre}>
        <input id="neg-nombre" value={b.nombre} onChange={(e) => onChange({ nombre: e.target.value })} maxLength={LIMITES.nombreMax} placeholder="Ej.: Sabor Cuencano" aria-invalid={!!errores.nombre} autoComplete="organization" className={claseCampo} />
      </Campo>
      <Campo id="neg-desc" etiqueta={<>Descripción <span className="font-normal text-slate-400">(opcional)</span></>} ayuda={`${b.descripcion.trim().length}/${LIMITES.descripcionMax} · Cuenta qué te hace especial: especialidad, años de experiencia, entrega rápida…`} error={errores.descripcion}>
        <textarea id="neg-desc" value={b.descripcion} onChange={(e) => onChange({ descripcion: e.target.value })} rows={3} maxLength={LIMITES.descripcionMax} aria-invalid={!!errores.descripcion} className={claseCampo} />
      </Campo>
      <UbicacionNegocio b={b} onChange={onChange} />
      <Campo id="neg-zona" etiqueta="Zona o barrio" error={errores.zona}>
        {(b.pais || "EC") !== "EC" ? (
          <input id="neg-zona" value={b.zona} onChange={(e) => onChange({ zona: e.target.value })} maxLength={LIMITES.zonaMax} placeholder="Barrio, sector o colonia" aria-invalid={!!errores.zona} className={claseCampo} />
        ) : (
        <select id="neg-zona" value={b.zona} onChange={(e) => onChange({ zona: e.target.value })} aria-invalid={!!errores.zona} className={claseCampo}>
          <option value="">Elige tu zona…</option>
          {ZONAS.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
          {b.zona && !ZONAS.includes(b.zona) && <option value={b.zona}>{b.zona}</option>}
        </select>
        )}
      </Campo>
      <fieldset>
        <legend className="mb-1 text-sm font-bold text-ink">¿Cómo atiendes?</legend>
        <Chips<CanalId> opciones={CANALES.map((c) => c.id)} valor={b.canales} onChange={(canales) => onChange({ canales })} etiqueta={(id) => CANALES.find((c) => c.id === id)?.etiqueta ?? id} color="border-brand-600 bg-brand-600 text-white" />
        {errores.canales && (
          <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">
            {errores.canales}
          </p>
        )}
      </fieldset>
      {entrega && (
        <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
          <Campo id="neg-envio" etiqueta="Costo de envío ($)" ayuda="Déjalo vacío si el envío es gratis." error={errores.costoEnvio}>
            <input id="neg-envio" value={b.costoEnvio} onChange={(e) => onChange({ costoEnvio: e.target.value })} inputMode="decimal" placeholder="1.50" aria-invalid={!!errores.costoEnvio} className={claseCampo} />
          </Campo>
          <Campo id="neg-minimo" etiqueta="Pedido mínimo ($)" ayuda="Déjalo vacío si no hay mínimo." error={errores.pedidoMinimo}>
            <input id="neg-minimo" value={b.pedidoMinimo} onChange={(e) => onChange({ pedidoMinimo: e.target.value })} inputMode="decimal" placeholder="5" aria-invalid={!!errores.pedidoMinimo} className={claseCampo} />
          </Campo>
        </div>
      )}
    </div>
  );
}

/** WhatsApp, teléfono y dirección. Solo los ven personas con sesión iniciada. */
export function FormContacto({ b, onChange, errores }: { b: BorradorNegocio; onChange: Cambio; errores: Errores }) {
  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
        🔒 Tu contacto <strong>solo lo ven personas registradas</strong>: así evitamos que lo copien programas automáticos y todo el mundo puede escribirte igual.
      </p>
      {errores.contacto && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {errores.contacto}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="neg-wa" etiqueta="WhatsApp" ayuda="Es por donde más te van a escribir." error={errores.whatsapp}>
          <input id="neg-wa" value={b.whatsapp} onChange={(e) => onChange({ whatsapp: e.target.value })} type="tel" inputMode="tel" placeholder="099 123 4567" autoComplete="tel" aria-invalid={!!errores.whatsapp} className={claseCampo} />
        </Campo>
        <Campo id="neg-tel" etiqueta={<>Teléfono <span className="font-normal text-slate-400">(opcional)</span></>} error={errores.telefono}>
          <input id="neg-tel" value={b.telefono} onChange={(e) => onChange({ telefono: e.target.value })} type="tel" inputMode="tel" placeholder="07 234 5678" aria-invalid={!!errores.telefono} className={claseCampo} />
        </Campo>
      </div>
      <Campo id="neg-dir" etiqueta={b.canales.includes("local") ? "Dirección del local" : <>Dirección <span className="font-normal text-slate-400">(opcional)</span></>} error={errores.direccion}>
        <input id="neg-dir" value={b.direccion} onChange={(e) => onChange({ direccion: e.target.value })} maxLength={LIMITES.direccionMax} placeholder="Calle principal, número y referencia" autoComplete="street-address" aria-invalid={!!errores.direccion} className={claseCampo} />
      </Campo>
    </div>
  );
}
