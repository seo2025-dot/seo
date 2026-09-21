"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { ZONAS } from "@/data/catalogos";
import { VERTICAL_POR_ID, type VerticalId } from "@/data/directorio";
import { Campo, claseCampo, ResumenErrores } from "@/features/directorio/alta/Campos";
import {
  MOMENTOS, VERTICALES_SOLICITUD, argumentosSolicitud, camposDetalle, mensajeErrorSolicitud, requiereDestino, validarSolicitud, type DatosSolicitud, type MomentoSolicitud,
} from "@/lib/directorio/solicitudes";
import { haySupabase, supabase } from "@/lib/supabaseClient";

const esVerticalSolicitud = (v: string | null): v is VerticalId => v !== null && (VERTICALES_SOLICITUD as string[]).includes(v);

/** «Pide ofertas»: describe lo que necesitas y los profesionales de la categoría te responden con precio y tiempo. */
export default function NuevaSolicitud() {
  const router = useRouter();
  const params = useSearchParams();
  const { sesion, hidratado } = useSocial();
  const seccionInicial = params.get("seccion");
  const tipoInicial = params.get("tipo");

  const [d, setD] = useState<DatosSolicitud>(() => {
    const vertical = esVerticalSolicitud(seccionInicial) ? seccionInicial : "hogar";
    const subtipos = VERTICAL_POR_ID[vertical].subtipos;
    return { vertical, subtipo: subtipos.some((s) => s.id === tipoInicial) ? (tipoInicial as string) : "", titulo: "", descripcion: "", zona: "", destino: "", momento: "today", programada: "", presupuesto: "", detalles: {} };
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const v = VERTICAL_POR_ID[d.vertical];
  const campos = d.subtipo ? camposDetalle(d.vertical, d.subtipo) : [];
  const conDestino = d.subtipo !== "" && requiereDestino(d.vertical, d.subtipo);
  const poner = (parche: Partial<DatosSolicitud>) => setD((x) => ({ ...x, ...parche }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFallo(null);
    const err = validarSolicitud(d);
    setErrores(err);
    if (Object.keys(err).length > 0 || !haySupabase) return;
    setEnviando(true);
    const { data, error } = await supabase().rpc("create_service_request", argumentosSolicitud(d));
    setEnviando(false);
    if (error) return setFallo(mensajeErrorSolicitud(error.message));
    router.push(`/directorio/solicitudes/${data as string}?nueva=1`);
  };

  if (hidratado && !sesion.uid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-black text-ink">Inicia sesión para pedir ofertas</h1>
        <p className="mt-2 text-slate-500">Así los profesionales pueden responderte por el chat de la app.</p>
        <Link href="/login?next=/directorio/solicitudes/nueva" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 text-sm font-bold text-white">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm">
        <Link href="/directorio/solicitudes" className="font-semibold text-brand-700 hover:underline">
          ← Mis solicitudes
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-black text-ink">Pide ofertas</h1>
      <p className="text-slate-600">Cuéntanos qué necesitas: los profesionales de la categoría te responden con su precio y en cuánto tiempo pueden atenderte. Tú eliges.</p>

      <form onSubmit={enviar} noValidate className="mt-6 space-y-6">
        <fieldset>
          <legend className="mb-2 text-lg font-black text-ink">¿Qué necesitas?</legend>
          <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Sección">
            {VERTICALES_SOLICITUD.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={d.vertical === id}
                onClick={() => poner({ vertical: id, subtipo: "", detalles: {} })}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition ${d.vertical === id ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 bg-white text-slate-600 hover:border-brand-300"}`}
              >
                {VERTICAL_POR_ID[id].emoji} {VERTICAL_POR_ID[id].etiqueta}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Categoría">
            {v.subtipos.map((s) => (
              <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3.5 py-2.5 text-sm font-semibold transition ${d.subtipo === s.id ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"}`}>
                <input type="radio" name="subtipo" value={s.id} checked={d.subtipo === s.id} onChange={() => poner({ subtipo: s.id, detalles: {} })} className="accent-brand-600" />
                <span aria-hidden>{s.emoji}</span> {s.etiqueta}
              </label>
            ))}
          </div>
          {errores.subtipo && (
            <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">
              {errores.subtipo}
            </p>
          )}
        </fieldset>

        <Campo id="sol-titulo" etiqueta="Resumen" ayuda={`${d.titulo.trim().length}/100 · Ej.: «Fuga bajo el lavabo de la cocina» o «Del Centro al terminal terrestre».`} error={errores.titulo}>
          <input id="sol-titulo" value={d.titulo} onChange={(e) => poner({ titulo: e.target.value })} maxLength={100} aria-invalid={!!errores.titulo} className={claseCampo} />
        </Campo>

        <div className={conDestino ? "grid gap-4 sm:grid-cols-2" : ""}>
          <Campo id="sol-zona" etiqueta={conDestino ? "Desde" : "Tu zona o barrio"} ayuda="Solo la zona: la dirección exacta la das por el chat cuando elijas una oferta." error={errores.zona}>
            <select id="sol-zona" value={d.zona} onChange={(e) => poner({ zona: e.target.value })} aria-invalid={!!errores.zona} className={claseCampo}>
              <option value="">Elige una zona…</option>
              {ZONAS.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Campo>
          {conDestino && (
            <Campo id="sol-destino" etiqueta="Hasta" error={errores.destino}>
              <select id="sol-destino" value={d.destino} onChange={(e) => poner({ destino: e.target.value })} aria-invalid={!!errores.destino} className={claseCampo}>
                <option value="">Elige una zona…</option>
                {ZONAS.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">¿Cuándo lo necesitas?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(MOMENTOS) as MomentoSolicitud[]).map((k) => (
              <label key={k} className={`cursor-pointer rounded-xl border-2 p-3 transition ${d.momento === k ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"}`}>
                <input type="radio" name="momento" value={k} checked={d.momento === k} onChange={() => poner({ momento: k })} className="sr-only" />
                <span className="block text-sm font-black text-ink">{MOMENTOS[k].etiqueta}</span>
                <span className="block text-xs text-slate-500">{MOMENTOS[k].ayuda}</span>
              </label>
            ))}
          </div>
          {d.momento === "scheduled" && (
            <div className="mt-3">
              <Campo id="sol-fecha" etiqueta="Fecha y hora (hora de Ecuador)" error={errores.programada}>
                <input id="sol-fecha" type="datetime-local" value={d.programada} onChange={(e) => poner({ programada: e.target.value })} aria-invalid={!!errores.programada} className={claseCampo} />
              </Campo>
            </div>
          )}
        </fieldset>

        {campos.map((c) => (
          <div key={c.id}>
            {c.tipo === "opciones" && (
              <Campo id={`sol-${c.id}`} etiqueta={c.etiqueta}>
                <select id={`sol-${c.id}`} value={String(d.detalles[c.id] ?? "")} onChange={(e) => poner({ detalles: { ...d.detalles, [c.id]: e.target.value } })} className={claseCampo}>
                  <option value="">Sin especificar</option>
                  {c.opciones.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            {c.tipo === "numero" && (
              <Campo id={`sol-${c.id}`} etiqueta={c.etiqueta}>
                <select id={`sol-${c.id}`} value={String(d.detalles[c.id] ?? "")} onChange={(e) => poner({ detalles: { ...d.detalles, [c.id]: e.target.value ? Number(e.target.value) : undefined } })} className={claseCampo}>
                  <option value="">Sin especificar</option>
                  {Array.from({ length: c.max - c.min + 1 }, (_, i) => c.min + i).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            {c.tipo === "si_no" && (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-3.5 text-sm">
                <input type="checkbox" checked={d.detalles[c.id] === true} onChange={(e) => poner({ detalles: { ...d.detalles, [c.id]: e.target.checked } })} className="mt-0.5 h-4 w-4 accent-brand-600" />
                <span>
                  <span className="font-bold text-ink">{c.etiqueta}</span>
                  {c.ayuda && <span className="block text-xs text-slate-500">{c.ayuda}</span>}
                </span>
              </label>
            )}
          </div>
        ))}

        <Campo id="sol-desc" etiqueta={<>Más detalles <span className="font-normal text-slate-400">(opcional)</span></>} ayuda={`${d.descripcion.trim().length}/600`} error={errores.descripcion}>
          <textarea id="sol-desc" value={d.descripcion} onChange={(e) => poner({ descripcion: e.target.value })} rows={3} maxLength={600} aria-invalid={!!errores.descripcion} className={claseCampo} />
        </Campo>

        <Campo id="sol-presupuesto" etiqueta={<>Presupuesto máximo en dólares <span className="font-normal text-slate-400">(opcional)</span></>} ayuda="Si lo indicas, los profesionales sabrán qué esperas pagar." error={errores.presupuesto}>
          <input id="sol-presupuesto" value={d.presupuesto} onChange={(e) => poner({ presupuesto: e.target.value })} inputMode="decimal" placeholder="Ej.: 15" aria-invalid={!!errores.presupuesto} className={claseCampo} />
        </Campo>

        <ResumenErrores errores={errores} />
        {fallo && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
            {fallo}
          </p>
        )}
        <button type="submit" disabled={enviando} className="boton-marca w-full rounded-full px-8 py-3.5 text-base font-bold text-white disabled:opacity-60">
          {enviando ? "Publicando…" : "Pedir ofertas"}
        </button>
        <p className="text-center text-xs text-slate-500">Avisamos a los profesionales de la categoría. Máximo 5 solicitudes abiertas a la vez.</p>
      </form>
    </div>
  );
}
