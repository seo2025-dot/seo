"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { Campo, claseCampo } from "@/features/directorio/alta/Campos";
import { useAhora } from "@/features/directorio/pedidos/Piezas";
import { DatosSolicitud, InsigniaEstadoOferta, InsigniaEstadoSolicitud, Oferente_, textoOferta } from "@/features/directorio/solicitudes/Piezas";
import { aceptarOferta, cerrarSolicitud, retirarOferta, useMisPerfiles, useSolicitud, type OfertaConOferente } from "@/features/directorio/solicitudes/useSolicitudes";
import {
  argumentosOferta, bloqueoOferta, destacadas, estadoVisible, mensajeErrorSolicitud, ordenarOfertas, perfilesQueEncajan, validarOferta, type DatosOferta,
} from "@/lib/directorio/solicitudes";
import { haySupabase, supabase } from "@/lib/supabaseClient";

/** Una solicitud: quien la publicó compara ofertas y elige; cada profesional ve la solicitud y manda o retira la suya. */
export default function DetalleSolicitud({ id }: { id: string }) {
  const nueva = useSearchParams().get("nueva") === "1";
  const { sesion } = useSocial();
  const { estado, error, recargar } = useSolicitud(id);
  const mios = useMisPerfiles();
  const ahora = useAhora();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  if (estado === undefined && !error) return <div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />;
  const s = estado?.solicitud;
  if (!s) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl" aria-hidden>
          🔎
        </p>
        <h1 className="mt-4 text-2xl font-black text-ink">{error ? "No pudimos cargar la solicitud" : "Esta solicitud ya no está disponible"}</h1>
        <p className="mt-2 text-slate-500">{error ?? "Puede que haya caducado o que el enlace sea incorrecto."}</p>
        <Link href="/directorio/solicitudes" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 text-sm font-bold text-white">
          Ir a mis solicitudes
        </Link>
      </div>
    );
  }

  const soyYo = sesion.uid === s.solicitanteId;
  const visible = estadoVisible(s, ahora);
  const abierta = visible === "open";
  const ofertas = ordenarOfertas(estado?.ofertas ?? []);
  const marcas = destacadas(ofertas);

  const accion = async (clave: string, f: () => Promise<string | null>, confirmar?: string) => {
    if (confirmar && !window.confirm(confirmar)) return;
    setOcupado(clave);
    setFallo(await f());
    setOcupado(null);
    void recargar();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm">
        <Link href="/directorio/solicitudes" className="font-semibold text-brand-700 hover:underline">
          ← Solicitudes
        </Link>
      </p>

      {nueva && soyYo && (
        <p role="status" className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          🎉 ¡Solicitud publicada! Avisamos a los profesionales de la categoría. Las ofertas aparecerán aquí y en tus notificaciones.
        </p>
      )}

      <header className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-ink">{s.titulo}</h1>
          {!soyYo && <p className="text-sm text-slate-500">Publicada por {estado?.solicitante ?? "una persona"}</p>}
        </div>
        <InsigniaEstadoSolicitud solicitud={s} ahora={ahora} />
      </header>

      <section aria-label="Datos de la solicitud" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <DatosSolicitud s={s} ahora={ahora} />
        {s.descripcion && <p className="mt-3 whitespace-pre-line border-t border-slate-100 pt-3 text-sm text-slate-700">{s.descripcion}</p>}
      </section>

      {(fallo || error) && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {fallo ?? error}
        </p>
      )}

      {soyYo ? (
        <section aria-labelledby="sol-ofertas" className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="sol-ofertas" className="text-lg font-black text-ink">
              Ofertas {ofertas.length > 0 && <span className="text-slate-400">({ofertas.length})</span>}
            </h2>
            {abierta && (
              <button type="button" disabled={ocupado !== null} onClick={() => void accion("cerrar", () => cerrarSolicitud(s.id), "¿Cerrar la solicitud? Ya no recibirás más ofertas.")} className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                Cerrar solicitud
              </button>
            )}
          </div>
          {ofertas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              {abierta ? "Todavía no hay ofertas. Esta pantalla se actualiza sola cuando llegue la primera." : "Esta solicitud no recibió ofertas."}
            </p>
          ) : (
            <ul className="space-y-3">
              {ofertas.map((o) => (
                <TarjetaOferta key={o.id} o={o} etiquetas={[o.id === marcas.barata ? "💰 La más barata" : "", o.id === marcas.rapida ? "⚡ La más rápida" : ""].filter(Boolean)}>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {abierta && o.estado === "sent" && (
                      <button type="button" disabled={ocupado !== null} onClick={() => void accion(o.id, () => aceptarOferta(o.id), `¿Aceptar la oferta de ${o.oferente?.nombre ?? "este profesional"} por ${textoOferta(o)}? Se rechazarán las demás.`)} className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
                        Aceptar oferta
                      </button>
                    )}
                    {o.chatId && o.estado !== "withdrawn" && (
                      <Link href={`/mensajes/${o.chatId}`} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-ink hover:border-brand-400">
                        💬 {o.estado === "accepted" ? "Coordinar por chat" : "Preguntar"}
                      </Link>
                    )}
                    {o.estado === "accepted" && o.oferente && (
                      <Link href={`/directorio/${o.oferente.vertical}/${o.oferente.slug}`} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                        Ver ficha para reseñar
                      </Link>
                    )}
                  </div>
                </TarjetaOferta>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <ZonaProfesional
          solicitud={s}
          abierta={abierta}
          ofertas={ofertas}
          mios={mios}
          onCambio={() => void recargar()}
          onRetirar={(oid) => void accion(oid, () => retirarOferta(oid), "¿Retirar tu oferta?")}
          ocupado={ocupado}
        />
      )}
    </div>
  );
}

function TarjetaOferta({ o, etiquetas, children }: { o: OfertaConOferente; etiquetas: string[]; children?: React.ReactNode }) {
  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm ${o.estado === "accepted" ? "border-emerald-300" : "border-slate-200"} ${o.estado === "sent" ? "" : "opacity-90"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Oferente_ o={o.oferente} />
        <InsigniaEstadoOferta estado={o.estado} />
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums text-ink">{textoOferta(o)}</p>
      {etiquetas.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-2">
          {etiquetas.map((e) => (
            <span key={e} className="rounded-full bg-sun/30 px-2.5 py-0.5 text-xs font-bold text-ink">
              {e}
            </span>
          ))}
        </p>
      )}
      {o.mensaje && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">“{o.mensaje}”</p>}
      {children}
    </li>
  );
}

/** Lo que ve un profesional: su oferta (si ya la mandó) o el formulario para mandarla con uno de sus perfiles. */
function ZonaProfesional({
  solicitud, abierta, ofertas, mios, onCambio, onRetirar, ocupado,
}: {
  solicitud: NonNullable<ReturnType<typeof useSolicitud>["estado"]>["solicitud"] & object;
  abierta: boolean;
  ofertas: OfertaConOferente[];
  mios: ReturnType<typeof useMisPerfiles>;
  onCambio: () => void;
  onRetirar: (id: string) => void;
  ocupado: string | null;
}) {
  const [perfilId, setPerfilId] = useState("");
  const [datos, setDatos] = useState<DatosOferta>({ precio: "", minutos: "30", mensaje: "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  if (!mios) return <div className="mt-6 h-24 animate-pulse rounded-2xl bg-slate-100" />;
  const encajan = perfilesQueEncajan(solicitud, mios.perfiles);
  const miOferta = ofertas[0]; // RLS: un profesional solo ve las suyas
  const bloqueo = bloqueoOferta(solicitud, { identidadVerificada: mios.identidadVerificada, perfilesQueEncajan: encajan.length });
  const perfilElegido = encajan.find((p) => p.id === perfilId) ?? encajan[0];
  // Se puede ofertar si nada lo impide y no hay una oferta vigente sin editar (una retirada se puede volver a enviar).
  const puedeFormulario = !bloqueo && (!miOferta || miOferta.estado === "withdrawn" || (miOferta.estado === "sent" && editando));

  const mandar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFallo(null);
    const err = validarOferta(datos);
    setErrores(err);
    if (Object.keys(err).length > 0 || !perfilElegido || !haySupabase) return;
    setEnviando(true);
    const { error } = await supabase().rpc("send_offer", argumentosOferta(solicitud.id, perfilElegido.id, datos));
    setEnviando(false);
    if (error) return setFallo(mensajeErrorSolicitud(error.message));
    setEditando(false);
    onCambio();
  };

  return (
    <section aria-labelledby="sol-mi-oferta" className="mt-6">
      <h2 id="sol-mi-oferta" className="mb-2 text-lg font-black text-ink">
        Tu oferta
      </h2>

      {miOferta && (
        <ul className="mb-4">
          <TarjetaOferta o={miOferta} etiquetas={[]}>
            <div className="mt-3 flex flex-wrap gap-2">
              {miOferta.chatId && (
                <Link href={`/mensajes/${miOferta.chatId}`} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-ink hover:border-brand-400">
                  💬 {miOferta.estado === "accepted" ? "Coordinar con el cliente" : "Chat con el cliente"}
                </Link>
              )}
              {abierta && miOferta.estado === "sent" && !editando && (
                <>
                  <button type="button" onClick={() => { setEditando(true); setDatos({ precio: String(miOferta.precio), minutos: String(miOferta.minutos), mensaje: miOferta.mensaje }); setPerfilId(miOferta.proveedorId); }} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-ink hover:border-brand-400">
                    Cambiar precio
                  </button>
                  <button type="button" disabled={ocupado !== null} onClick={() => onRetirar(miOferta.id)} className="rounded-full px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                    Retirar oferta
                  </button>
                </>
              )}
            </div>
          </TarjetaOferta>
        </ul>
      )}

      {bloqueo && !miOferta && (
        <div role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold">{bloqueo}</p>
          {encajan.length === 0 && (
            <Link href={`/directorio/mi-negocio/nuevo?seccion=${solicitud.vertical}`} className="mt-2 inline-block font-bold text-brand-700 hover:underline">
              Registrar mi perfil →
            </Link>
          )}
          {solicitud.vertical === "movilidad" && !mios.identidadVerificada && (
            <Link href="/verificacion" className="mt-2 inline-block font-bold text-brand-700 hover:underline">
              Verificar mi identidad →
            </Link>
          )}
        </div>
      )}

      {puedeFormulario && perfilElegido && (
        <form onSubmit={mandar} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          {encajan.length > 1 && (
            <Campo id="of-perfil" etiqueta="Ofertar como">
              <select id="of-perfil" value={perfilElegido.id} onChange={(e) => setPerfilId(e.target.value)} className={claseCampo}>
                {encajan.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="of-precio" etiqueta="Tu precio (USD)" error={errores.precio}>
              <input id="of-precio" value={datos.precio} onChange={(e) => setDatos({ ...datos, precio: e.target.value })} inputMode="decimal" placeholder="Ej.: 12.50" aria-invalid={!!errores.precio} className={claseCampo} />
            </Campo>
            <Campo id="of-min" etiqueta="¿En cuántos minutos puedes atender?" error={errores.minutos}>
              <input id="of-min" value={datos.minutos} onChange={(e) => setDatos({ ...datos, minutos: e.target.value })} inputMode="numeric" aria-invalid={!!errores.minutos} className={claseCampo} />
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {[15, 30, 60, 120].map((m) => (
                  <button key={m} type="button" onClick={() => setDatos({ ...datos, minutos: String(m) })} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600 hover:border-brand-300">
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </button>
                ))}
              </span>
            </Campo>
          </div>
          <Campo id="of-msg" etiqueta={<>Mensaje <span className="font-normal text-slate-400">(opcional)</span></>} ayuda={`${datos.mensaje.trim().length}/300 · Ej.: «Llevo repuestos y doy garantía».`} error={errores.mensaje}>
            <textarea id="of-msg" value={datos.mensaje} onChange={(e) => setDatos({ ...datos, mensaje: e.target.value })} rows={2} maxLength={300} aria-invalid={!!errores.mensaje} className={claseCampo} />
          </Campo>
          {fallo && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {fallo}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={enviando} className="boton-marca rounded-full px-7 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {enviando ? "Enviando…" : miOferta ? "Actualizar oferta" : "Enviar oferta"}
            </button>
            {editando && (
              <button type="button" onClick={() => setEditando(false)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                Cancelar
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">Se abre un chat con quien pidió: pueden aclarar los detalles antes de que elija.</p>
        </form>
      )}
    </section>
  );
}
