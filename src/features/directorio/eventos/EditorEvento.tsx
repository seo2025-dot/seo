"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FalloOperacion, CosteAccion } from "@/features/monedas/Piezas";
import { useRouter, useSearchParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { ZONAS } from "@/data/catalogos";
import { Campo, claseCampo, ResumenErrores } from "@/features/directorio/alta/Campos";
import SubidaImagen from "@/features/directorio/alta/SubidaImagen";
import { nombresDeAsistentes, useMisEventos, useMisOrganizadores, type EventoDelPanel } from "@/features/directorio/eventos/useEventosPanel";
import {
  CATEGORIAS_EVENTO, ETIQUETA_RESERVA, LIMITES_EVENTO, borradorDesdeEntrada, borradorDesdeEvento, borradorEventoVacio, codigoLegible, entradaVacia, faseEvento, filaActualizacionEvento, filaEntrada,
  filaEvento, mensajeErrorEventos, resumenAsistentes, textoFechaCorta, validarEntrada, validarEvento, validarVenta,
  type BorradorEntrada, type BorradorEvento, type CategoriaEvento,
} from "@/lib/directorio/eventos";
import { instanteEcuador } from "@/lib/directorio/horarios";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import { subirMedia } from "@/lib/supabase/subida";

interface Fila {
  /** Presente si la entrada ya existe en la base. */
  id?: string;
  d: BorradorEntrada;
  vendidas: number;
}

/** Publicar o editar un evento: datos, tipos de entrada con cupo, portada y —al editar— la lista de asistentes. */
export default function EditorEvento({ id }: { id?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const nuevoParam = params.get("nuevo") === "1";
  const sinEntradas = params.get("sinentradas") === "1";
  const { sesion } = useSocial();
  const { organizadores } = useMisOrganizadores();
  const { eventos, recargar, cargando } = useMisEventos();
  const existente: EventoDelPanel | undefined = useMemo(() => (id ? eventos?.find((e) => e.evento.id === id) : undefined), [eventos, id]);

  const [b, setB] = useState<BorradorEvento>(borradorEventoVacio());
  const [filas, setFilas] = useState<Fila[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(
    nuevoParam
      ? sinEntradas
        ? "El evento se publicó, pero no se pudieron guardar las entradas. Añádelas aquí abajo y pulsa «Guardar cambios»."
        : "🎉 ¡Evento publicado! Ya aparece en la cartelera. Aquí puedes ajustar entradas y ver quién reserva."
      : null,
  );
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [listo, setListo] = useState(false);

  const activos = (organizadores ?? []).filter((o) => o.estado === "active");

  // Carga inicial: al editar, con los datos del evento; al crear, con el primer perfil de organizador activo.
  useEffect(() => {
    if (listo) return;
    if (id) {
      if (!existente) return;
      setB(borradorDesdeEvento(existente.evento));
      setFilas(existente.tipos.map((t) => ({ id: t.id, d: borradorDesdeEntrada(t), vendidas: t.vendidas })));
      setListo(true);
    } else if (organizadores !== null) {
      setB((x) => ({ ...x, proveedorId: activos[0]?.id ?? "" }));
      setFilas([{ d: entradaVacia(), vendidas: 0 }]);
      setListo(true);
    }
  }, [id, existente, organizadores, activos, listo]);

  useEffect(() => {
    if (existente) void nombresDeAsistentes(existente.reservas.map((r) => r.usuarioId)).then(setNombres);
  }, [existente]);

  if (cargando || organizadores === null || !listo) {
    if (!cargando && id && !existente) {
      return (
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-2xl font-black text-ink">No encontramos este evento</h1>
          <p className="mt-2 text-slate-500">Puede que sea de otra cuenta o que ya no exista.</p>
          <Link href="/directorio/mi-negocio/eventos" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 text-sm font-bold text-white">
            Ir a mis eventos
          </Link>
        </div>
      );
    }
    if (!cargando && organizadores !== null && !id && activos.length === 0) {
      return (
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-5xl" aria-hidden>
            🎤
          </p>
          <h1 className="mt-4 text-2xl font-black text-ink">Necesitas un perfil de organizador activo</h1>
          <p className="mt-2 text-slate-500">Crea el perfil una vez (gratis) y podrás publicar todos los eventos que quieras.</p>
          <Link href="/directorio/mi-negocio/nuevo?seccion=eventos" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 text-sm font-bold text-white">
            Crear mi perfil de organizador
          </Link>
        </div>
      );
    }
    return <div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />;
  }

  const editando = Boolean(id && existente);
  const evento = existente?.evento;
  const fase = evento ? faseEvento(evento) : "proximo";
  const soloLectura = editando && (fase === "cancelado" || fase === "finalizado");
  const reservas = existente?.reservas ?? [];
  const resumen = resumenAsistentes(reservas);
  const poner = (parche: Partial<BorradorEvento>) => setB((x) => ({ ...x, ...parche }));
  const ponerFila = (i: number, parche: Partial<BorradorEntrada>) => setFilas((f) => f.map((x, j) => (j === i ? { ...x, d: { ...x.d, ...parche } } : x)));
  const inicioMs = (() => {
    const iso = instanteEcuador(b.inicia);
    return iso ? Date.parse(iso) : undefined;
  })();

  const validarTodo = (): Record<string, string> => {
    const e: Record<string, string> = { ...validarEvento(b, { nuevo: !editando }) };
    const venta = validarVenta(b.gratis, b.enlaceEntradas, filas.length);
    if (venta) e.entradas = venta;
    filas.forEach((f, i) => {
      for (const [campo, msg] of Object.entries(validarEntrada(f.d, { vendidas: f.id ? f.vendidas : undefined, iniciaEvento: inicioMs }))) e[`entradas.${i}.${campo}`] = msg;
    });
    return e;
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFallo(null);
    setAviso(null);
    const err = validarTodo();
    setErrores(err);
    if (Object.keys(err).length > 0 || !haySupabase || !sesion.uid) return;
    const cambioFecha = editando && evento && b.inicia !== borradorDesdeEvento(evento).inicia && reservas.some((r) => r.estado === "reserved");
    if (cambioFecha && !window.confirm(`Cambiaste la fecha. Se avisará a quienes tienen una reserva vigente (${reservas.filter((r) => r.estado === "reserved").length}). ¿Continuar?`)) return;
    setGuardando(true);
    try {
      const sb = supabase();
      if (!editando) {
        const portadaUrl = b.portada ? await subirMedia(b.portada, sesion.uid) : null;
        const { data, error } = await sb.from("events").insert(filaEvento(b, portadaUrl)).select("id").single();
        if (error) throw error;
        if (filas.length > 0) {
          const { error: e2 } = await sb.from("event_ticket_types").insert(filas.map((f) => filaEntrada(f.d, data.id)));
          // El evento ya existe: se abre su editor (no se deja el formulario en blanco, para no publicarlo dos veces).
          if (e2) {
            router.push(`/directorio/mi-negocio/eventos/${data.id}?nuevo=1&sinentradas=1`);
            return;
          }
        }
        router.push(`/directorio/mi-negocio/eventos/${data.id}?nuevo=1`);
        return;
      }
      const original = borradorDesdeEvento(evento!);
      const portadaUrl = b.portada === original.portada ? undefined : b.portada ? await subirMedia(b.portada, sesion.uid) : null;
      const { error } = await sb.from("events").update(filaActualizacionEvento(b, portadaUrl)).eq("id", id!);
      if (error) throw error;
      for (const f of filas) {
        const { error: e2 } = f.id ? await sb.from("event_ticket_types").update(filaEntrada(f.d)).eq("id", f.id) : await sb.from("event_ticket_types").insert(filaEntrada(f.d, id));
        if (e2) throw new Error(mensajeErrorEventos(e2.message));
      }
      setAviso("✅ Cambios guardados.");
      await recargar();
      setListo(false); // vuelve a leer las entradas (con sus ids y ventas actualizadas)
    } catch (ex) {
      setFallo(mensajeErrorEventos(ex instanceof Error ? ex.message : (ex as { message?: string }).message ?? "No se pudo guardar."));
    } finally {
      setGuardando(false);
    }
  };

  const quitarFila = async (i: number) => {
    const f = filas[i];
    if (!f.id) return setFilas((x) => x.filter((_, j) => j !== i));
    if (f.vendidas > 0) return;
    if (!window.confirm(`¿Quitar la entrada «${f.d.nombre}»?`)) return;
    const { error } = await supabase().from("event_ticket_types").delete().eq("id", f.id);
    if (error) return setFallo(mensajeErrorEventos(error.message));
    setFilas((x) => x.filter((_, j) => j !== i));
    void recargar();
  };

  const cancelarEvento = async () => {
    if (!evento) return;
    const n = reservas.filter((r) => r.estado === "reserved").length;
    if (!window.confirm(`¿Cancelar «${evento.titulo}»? ${n > 0 ? `Se cancelarán ${n} ${n === 1 ? "reserva" : "reservas"} y se avisará a los asistentes.` : "Nadie tiene reservas todavía."} No se puede deshacer.`)) return;
    const { error } = await supabase().rpc("cancel_event", { p_event: evento.id });
    if (error) return setFallo(mensajeErrorEventos(error.message));
    await recargar();
    setListo(false);
    setAviso("El evento se canceló y se avisó a los asistentes.");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm">
        <Link href="/directorio/mi-negocio/eventos" className="font-semibold text-brand-700 hover:underline">
          ← Mis eventos
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-black text-ink">{editando ? evento?.titulo : "Publicar un evento"}</h1>
      {editando && evento && (
        <p className="text-sm text-slate-500">
          {textoFechaCorta(evento.inicia)} ·{" "}
          {evento.estado === "published" && (
            <Link href={`/directorio/evento/${evento.id}`} className="font-semibold text-brand-700 hover:underline">
              Ver página pública
            </Link>
          )}
        </p>
      )}
      {soloLectura && (
        <p role="status" className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">
          {fase === "cancelado" ? "Este evento está cancelado y ya no se puede editar." : "Este evento ya terminó. Solo puedes consultar los asistentes."}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
          {aviso}
        </p>
      )}

      <form onSubmit={guardar} noValidate className="mt-6 space-y-8">
        <fieldset disabled={soloLectura} className="space-y-4">
          <legend className="mb-1 text-lg font-black text-ink">Datos del evento</legend>
          {!editando && activos.length > 1 && (
            <Campo id="ev-org" etiqueta="Publicar como" error={errores.proveedorId}>
              <select id="ev-org" value={b.proveedorId} onChange={(e) => poner({ proveedorId: e.target.value })} className={claseCampo}>
                {activos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo id="ev-titulo" etiqueta="Título" ayuda={`${b.titulo.trim().length}/${LIMITES_EVENTO.tituloMax}`} error={errores.titulo}>
            <input id="ev-titulo" value={b.titulo} onChange={(e) => poner({ titulo: e.target.value })} maxLength={LIMITES_EVENTO.tituloMax} aria-invalid={!!errores.titulo} className={claseCampo} />
          </Campo>
          <Campo id="ev-cat" etiqueta="Categoría" error={errores.categoria}>
            <select id="ev-cat" value={b.categoria} onChange={(e) => poner({ categoria: e.target.value as CategoriaEvento })} aria-invalid={!!errores.categoria} className={claseCampo}>
              <option value="">Elige una categoría…</option>
              {CATEGORIAS_EVENTO.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="ev-inicia" etiqueta="Empieza (hora de Ecuador)" error={errores.inicia}>
              <input id="ev-inicia" type="datetime-local" value={b.inicia} onChange={(e) => poner({ inicia: e.target.value })} aria-invalid={!!errores.inicia} className={claseCampo} />
            </Campo>
            <Campo id="ev-termina" etiqueta={<>Termina <span className="font-normal text-slate-400">(opcional)</span></>} error={errores.termina}>
              <input id="ev-termina" type="datetime-local" value={b.termina} onChange={(e) => poner({ termina: e.target.value })} aria-invalid={!!errores.termina} className={claseCampo} />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="ev-lugar" etiqueta="Lugar" ayuda="Teatro, sala, parque…" error={errores.lugar}>
              <input id="ev-lugar" value={b.lugar} onChange={(e) => poner({ lugar: e.target.value })} maxLength={LIMITES_EVENTO.lugarMax} aria-invalid={!!errores.lugar} className={claseCampo} />
            </Campo>
            <Campo id="ev-zona" etiqueta="Zona" error={errores.zona}>
              <select id="ev-zona" value={b.zona} onChange={(e) => poner({ zona: e.target.value })} aria-invalid={!!errores.zona} className={claseCampo}>
                <option value="">Elige una zona…</option>
                {ZONAS.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo id="ev-dir" etiqueta={<>Dirección <span className="font-normal text-slate-400">(opcional)</span></>} error={errores.direccion}>
            <input id="ev-dir" value={b.direccion} onChange={(e) => poner({ direccion: e.target.value })} maxLength={LIMITES_EVENTO.direccionMax} aria-invalid={!!errores.direccion} className={claseCampo} />
          </Campo>
          <Campo id="ev-desc" etiqueta={<>Descripción <span className="font-normal text-slate-400">(opcional)</span></>} ayuda={`${b.descripcion.trim().length}/${LIMITES_EVENTO.descripcionMax}`} error={errores.descripcion}>
            <textarea id="ev-desc" value={b.descripcion} onChange={(e) => poner({ descripcion: e.target.value })} rows={5} maxLength={LIMITES_EVENTO.descripcionMax} aria-invalid={!!errores.descripcion} className={claseCampo} />
          </Campo>
          <SubidaImagen etiqueta="Imagen del evento" ayuda="Horizontal: el afiche o una foto del lugar." valor={b.portada} onChange={(portada) => poner({ portada })} maxLado={1200} />
        </fieldset>

        <fieldset disabled={soloLectura} className="space-y-4">
          <legend className="mb-1 text-lg font-black text-ink">Entradas</legend>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-3.5 text-sm">
            <input type="checkbox" checked={b.gratis} onChange={(e) => poner({ gratis: e.target.checked })} className="mt-0.5 h-4 w-4 accent-brand-600" />
            <span>
              <span className="font-bold text-ink">Entrada libre</span>
              <span className="block text-xs text-slate-500">Marca esta opción si no hace falta reservar. Puedes añadir igualmente tipos de entrada con cupo (gratis o de pago).</span>
            </span>
          </label>
          <Campo id="ev-enlace" etiqueta={<>Enlace para comprar en otro sitio <span className="font-normal text-slate-400">(opcional)</span></>} ayuda="Debe empezar por https://" error={errores.enlaceEntradas}>
            <input id="ev-enlace" type="url" value={b.enlaceEntradas} onChange={(e) => poner({ enlaceEntradas: e.target.value })} placeholder="https://" aria-invalid={!!errores.enlaceEntradas} className={claseCampo} />
          </Campo>

          <div className="space-y-3">
            {filas.map((f, i) => (
              <div key={f.id ?? `nueva-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo id={`ent-${i}-nombre`} etiqueta="Nombre" error={errores[`entradas.${i}.nombre`]}>
                    <input id={`ent-${i}-nombre`} value={f.d.nombre} onChange={(e) => ponerFila(i, { nombre: e.target.value })} placeholder="General, VIP…" maxLength={60} className={claseCampo} />
                  </Campo>
                  <Campo id={`ent-${i}-precio`} etiqueta="Precio (USD, 0 si es gratis)" error={errores[`entradas.${i}.precio`]}>
                    <input id={`ent-${i}-precio`} value={f.d.precio} onChange={(e) => ponerFila(i, { precio: e.target.value })} inputMode="decimal" className={claseCampo} />
                  </Campo>
                  <Campo id={`ent-${i}-cupo`} etiqueta="Cupo" ayuda={f.id ? `${f.vendidas} reservadas` : undefined} error={errores[`entradas.${i}.cupo`]}>
                    <input id={`ent-${i}-cupo`} value={f.d.cupo} onChange={(e) => ponerFila(i, { cupo: e.target.value })} inputMode="numeric" className={claseCampo} />
                  </Campo>
                  <Campo id={`ent-${i}-max`} etiqueta="Máximo por persona" error={errores[`entradas.${i}.maxPorPedido`]}>
                    <input id={`ent-${i}-max`} value={f.d.maxPorPedido} onChange={(e) => ponerFila(i, { maxPorPedido: e.target.value })} inputMode="numeric" className={claseCampo} />
                  </Campo>
                </div>
                <div className="mt-3">
                  <Campo id={`ent-${i}-cierre`} etiqueta={<>Cierre de la venta <span className="font-normal text-slate-400">(opcional; por defecto, al empezar el evento)</span></>} error={errores[`entradas.${i}.ventaHasta`]}>
                    <input id={`ent-${i}-cierre`} type="datetime-local" value={f.d.ventaHasta} onChange={(e) => ponerFila(i, { ventaHasta: e.target.value })} className={claseCampo} />
                  </Campo>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {f.id && f.vendidas > 0 ? <p className="text-xs text-slate-500">Ya tiene reservas: no se puede quitar. Puedes subir el cupo o cerrar la venta.</p> : <span />}
                  {!(f.id && f.vendidas > 0) && (
                    <button type="button" onClick={() => void quitarFila(i)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                      Quitar esta entrada
                    </button>
                  )}
                </div>
              </div>
            ))}
            {errores.entradas && (
              <p role="alert" className="text-xs font-semibold text-rose-600">
                {errores.entradas}
              </p>
            )}
            <button type="button" onClick={() => setFilas((x) => [...x, { d: entradaVacia(), vendidas: 0 }])} disabled={filas.length >= 10} className="rounded-full border border-dashed border-slate-300 px-5 py-2 text-sm font-bold text-slate-600 hover:border-brand-400 disabled:opacity-50">
              + Añadir otro tipo de entrada
            </button>
          </div>
        </fieldset>

        <ResumenErrores errores={errores} />
        {fallo && (
          <FalloOperacion texto={fallo ?? ""} />
        )}
        {!soloLectura && !editando && (
          <p className="text-center">
            <CosteAccion accion="event_publish" />
          </p>
        )}
        {!soloLectura && (
          <button type="submit" disabled={guardando} className="boton-marca w-full rounded-full px-8 py-3.5 text-base font-bold text-white disabled:opacity-60">
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Publicar evento"}
          </button>
        )}
      </form>

      {editando && (
        <section aria-labelledby="asistentes-titulo" className="mt-10">
          <h2 id="asistentes-titulo" className="text-lg font-black text-ink">
            Asistentes
          </h2>
          <p className="text-sm text-slate-600">
            <strong className="text-ink">{resumen.reservadas}</strong> entradas reservadas · <strong className="text-ink">{resumen.ingresaron}</strong> ya ingresaron · <strong className="text-ink">{resumen.pendientes}</strong> pendientes
            {resumen.ingresos > 0 && <> · a cobrar en la puerta: <strong className="text-ink">${resumen.ingresos.toFixed(2)}</strong></>}
          </p>
          {reservas.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Todavía nadie reservó.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {reservas.map((r) => {
                const est = ETIQUETA_RESERVA[r.estado];
                const tipo = existente?.tipos.find((t) => t.id === r.tipoId);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{nombres.get(r.usuarioId) ?? "Asistente"}</p>
                      <p className="text-xs text-slate-500">
                        {r.cantidad} × {tipo?.nombre ?? "entrada"} · <span className="font-mono">{codigoLegible(r.codigo)}</span>
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${est.clase}`}>{est.etiqueta}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {!soloLectura && evento?.estado === "published" && (
            <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-bold text-rose-900">Cancelar el evento</p>
              <p className="text-xs text-rose-800">Se cancelan todas las reservas y se avisa a cada asistente. No se puede deshacer.</p>
              <button type="button" onClick={() => void cancelarEvento()} className="mt-2 rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-700">
                Cancelar evento
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
