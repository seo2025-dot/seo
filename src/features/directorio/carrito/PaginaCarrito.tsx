"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { ZONAS } from "@/data/catalogos";
import { Campo, claseCampo, ResumenErrores } from "@/features/directorio/alta/Campos";
import { guardarCarrito, guardarDatosEntrega, leerDatosEntrega, useCarrito } from "@/features/directorio/carrito/almacen";
import { MAX_CANTIDAD, reconciliar, tiposDisponibles, totales, type TipoPedido } from "@/lib/directorio/carrito";
import { textoEstadoAbierto } from "@/lib/directorio/horarios";
import { mapearItem, mapearProveedor, textoDinero, type FilaItem, type FilaProveedor } from "@/lib/directorio/mapeo";
import { PAGOS, argumentosPedido, mensajeErrorPedido, validarPago, type DatosPago, type FormaPago } from "@/lib/directorio/pedidos";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import type { Proveedor } from "@/types/directorio";

/**
 * Carrito y pago. Antes de pagar se contrasta con el catálogo actual (precios, agotados, recetas, datos de entrega); el total que se
 * muestra es una estimación: el definitivo lo calcula el servidor con los precios vigentes.
 */
export default function PaginaCarrito() {
  const router = useRouter();
  const { sesion, hidratado } = useSocial();
  const { carrito, cambiar, vaciar } = useCarrito();
  const [negocio, setNegocio] = useState<Proveedor | null>(null);
  const [cambios, setCambios] = useState<string[]>([]);
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const revisado = useRef<string | null>(null);

  const [tipo, setTipo] = useState<TipoPedido>("delivery");
  const [direccion, setDireccion] = useState("");
  const [zona, setZona] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [pago, setPago] = useState<FormaPago>("cash");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  // Recuerda la última dirección y teléfono usados.
  useEffect(() => {
    const d = leerDatosEntrega();
    setDireccion(d.direccion);
    setZona(d.zona);
    setTelefono(d.telefono);
  }, []);

  // Contrasta el carrito con el catálogo actual, una vez por negocio.
  useEffect(() => {
    if (!carrito || !haySupabase || revisado.current === carrito.id) return;
    revisado.current = carrito.id;
    let vivo = true;
    setVerificando(true);
    void (async () => {
      const sb = supabase();
      const [prov, items] = await Promise.all([sb.from("providers").select("*").eq("id", carrito.id).maybeSingle(), sb.from("provider_items").select("*").eq("provider_id", carrito.id)]);
      if (!vivo) return;
      const p = prov.data ? mapearProveedor(prov.data as FilaProveedor) : null;
      setNegocio(p);
      const r = reconciliar(carrito, ((items.data ?? []) as FilaItem[]).map(mapearItem), {
        activo: p?.estado === "active",
        canales: p?.canales ?? carrito.canales,
        costoEnvio: p?.costoEnvio ?? carrito.costoEnvio,
        pedidoMinimo: p?.pedidoMinimo ?? carrito.pedidoMinimo,
      });
      setCambios(r.cambios);
      setBloqueo(r.bloqueo);
      if (r.cambios.length > 0 || r.carrito !== carrito) guardarCarrito(r.carrito);
      setVerificando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [carrito]);

  const tipos = carrito ? tiposDisponibles(carrito.canales) : [];
  const tipoEfectivo: TipoPedido = tipos.includes(tipo) ? tipo : (tipos[0] ?? "delivery");
  const t = totales(carrito, tipoEfectivo);
  const estado = negocio ? textoEstadoAbierto(negocio.horario, negocio.abierto24h) : null;

  if (!hidratado) return <div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />;

  if (!carrito) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl" aria-hidden>
          🛒
        </p>
        <h1 className="mt-4 text-2xl font-black text-ink">Tu carrito está vacío</h1>
        <p className="mt-2 text-slate-500">Elige un restaurante o una farmacia y agrega lo que necesites.</p>
        {cambios.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl bg-amber-50 p-3 text-left text-sm text-amber-900" role="status">
            {cambios.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <Link href="/directorio" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 text-sm font-bold text-white">
          Ver el directorio
        </Link>
      </div>
    );
  }

  const datos: DatosPago = { tipo: tipoEfectivo, direccion, zona, telefono, notas, pago };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFallo(null);
    const err = validarPago(datos, carrito);
    setErrores(err);
    if (Object.keys(err).length > 0 || bloqueo || !haySupabase) return;
    setEnviando(true);
    const { data, error } = await supabase().rpc("place_order", argumentosPedido(datos, carrito));
    setEnviando(false);
    if (error) {
      setFallo(mensajeErrorPedido(error.message));
      return;
    }
    guardarDatosEntrega({ direccion: tipoEfectivo === "delivery" ? direccion.trim() : leerDatosEntrega().direccion, zona: zona.trim(), telefono: telefono.trim() });
    vaciar();
    router.push(`/directorio/pedidos/${data as string}?nuevo=1`);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm text-slate-500">
        <Link href={`/directorio/${carrito.vertical}/${carrito.slug}`} className="font-semibold text-brand-700 hover:underline">
          ← Seguir agregando
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-black text-ink">Tu pedido en {carrito.nombre}</h1>

      {verificando && <p className="mt-3 text-sm text-slate-500">Comprobando precios y disponibilidad…</p>}
      {cambios.length > 0 && (
        <ul role="status" className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {cambios.map((c) => (
            <li key={c}>ℹ️ {c}</li>
          ))}
        </ul>
      )}
      {bloqueo && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
          {bloqueo}
        </p>
      )}
      {estado && !estado.abierto && !bloqueo && (
        <p role="status" className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
          🕐 {estado.texto}. Puedes enviar el pedido igualmente: lo verán cuando abran. Si no responden en 3 horas, se cancela solo.
        </p>
      )}

      <form onSubmit={enviar} noValidate className="mt-6 space-y-8">
        <section aria-labelledby="lineas-titulo">
          <h2 id="lineas-titulo" className="mb-2 text-lg font-black text-ink">
            Productos
          </h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {carrito.lineas.map((l) => (
              <li key={l.itemId} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{l.nombre}</p>
                  <p className="text-xs text-slate-500">{textoDinero(l.precio)} c/u</p>
                </div>
                <div role="group" aria-label={`Cantidad de ${l.nombre}`} className="inline-flex items-center overflow-hidden rounded-full border border-slate-300">
                  <button type="button" onClick={() => cambiar(carrito, { id: l.itemId, nombre: l.nombre, precio: l.precio }, l.cantidad - 1)} aria-label={`Quitar una unidad de ${l.nombre}`} className="h-8 w-8 text-lg font-bold hover:bg-slate-100">
                    −
                  </button>
                  <output aria-live="polite" className="w-7 text-center text-sm font-black tabular-nums">
                    {l.cantidad}
                  </output>
                  <button type="button" onClick={() => cambiar(carrito, { id: l.itemId, nombre: l.nombre, precio: l.precio }, l.cantidad + 1)} disabled={l.cantidad >= MAX_CANTIDAD} aria-label={`Agregar una unidad de ${l.nombre}`} className="h-8 w-8 text-lg font-bold hover:bg-slate-100 disabled:opacity-40">
                    +
                  </button>
                </div>
                <p className="w-16 text-right font-black tabular-nums">{textoDinero(l.precio * l.cantidad)}</p>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => vaciar()} className="mt-2 text-xs font-semibold text-slate-400 underline hover:text-rose-600">
            Vaciar carrito
          </button>
        </section>

        <fieldset>
          <legend className="mb-2 text-lg font-black text-ink">¿Cómo lo quieres?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {tipos.map((k) => (
              <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${tipoEfectivo === k ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"}`}>
                <input type="radio" name="tipo" value={k} checked={tipoEfectivo === k} onChange={() => setTipo(k)} className="mt-1 accent-brand-600" />
                <span>
                  <span className="block font-black text-ink">{k === "delivery" ? "🛵 A domicilio" : "🏪 Retiro en el local"}</span>
                  <span className="block text-xs text-slate-500">{k === "delivery" ? (carrito.costoEnvio > 0 ? `Envío ${textoDinero(carrito.costoEnvio)}` : "Envío gratis") : "Sin costo de envío"}</span>
                </span>
              </label>
            ))}
          </div>
          {errores.tipo && (
            <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">
              {errores.tipo}
            </p>
          )}
        </fieldset>

        <section aria-labelledby="datos-titulo" className="space-y-4">
          <h2 id="datos-titulo" className="text-lg font-black text-ink">
            Tus datos
          </h2>
          {tipoEfectivo === "delivery" && (
            <>
              <Campo id="ped-dir" etiqueta="Dirección de entrega" ayuda="Calle principal, número, referencia y piso o departamento." error={errores.direccion}>
                <input id="ped-dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={200} autoComplete="street-address" aria-invalid={!!errores.direccion} className={claseCampo} />
              </Campo>
              <Campo id="ped-zona" etiqueta={<>Zona o barrio <span className="font-normal text-slate-400">(opcional)</span></>}>
                <select id="ped-zona" value={zona} onChange={(e) => setZona(e.target.value)} className={claseCampo}>
                  <option value="">Elige tu zona…</option>
                  {ZONAS.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </Campo>
            </>
          )}
          <Campo
            id="ped-tel"
            etiqueta={tipoEfectivo === "delivery" ? "Teléfono" : <>Teléfono <span className="font-normal text-slate-400">(opcional)</span></>}
            ayuda={tipoEfectivo === "delivery" ? "Para que puedan llamarte al entregar." : "Por si necesitan avisarte cuando esté listo."}
            error={errores.telefono}
          >
            <input id="ped-tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="099 123 4567" aria-invalid={!!errores.telefono} className={claseCampo} />
          </Campo>
          <Campo id="ped-notas" etiqueta={<>Notas para el negocio <span className="font-normal text-slate-400">(opcional)</span></>} ayuda={`${notas.trim().length}/300 · Ej.: sin picante, traer cambio de $20, tocar el timbre.`} error={errores.notas}>
            <textarea id="ped-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={300} aria-invalid={!!errores.notas} className={claseCampo} />
          </Campo>
        </section>

        <fieldset>
          <legend className="mb-2 text-lg font-black text-ink">Forma de pago</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(PAGOS) as FormaPago[]).map((k) => (
              <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${pago === k ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"}`}>
                <input type="radio" name="pago" value={k} checked={pago === k} onChange={() => setPago(k)} className="mt-1 accent-brand-600" />
                <span>
                  <span className="block font-black text-ink">{k === "cash" ? "💵" : "🏦"} {PAGOS[k].etiqueta}</span>
                  <span className="block text-xs text-slate-500">{PAGOS[k].ayuda}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <section aria-labelledby="resumen-titulo" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 id="resumen-titulo" className="sr-only">
            Resumen
          </h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Subtotal ({t.unidades} {t.unidades === 1 ? "producto" : "productos"})</dt>
              <dd className="font-semibold tabular-nums">{textoDinero(t.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">{tipoEfectivo === "delivery" ? "Envío" : "Retiro en el local"}</dt>
              <dd className="font-semibold tabular-nums">{t.envio > 0 ? textoDinero(t.envio) : "Gratis"}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
              <dt className="font-black text-ink">Total estimado</dt>
              <dd className="font-black tabular-nums text-ink">{textoDinero(t.total)}</dd>
            </div>
          </dl>
          {t.faltaMinimo > 0 && (
            <p role="status" className="mt-2 text-sm font-semibold text-amber-800">
              Te faltan {textoDinero(t.faltaMinimo)} para llegar al pedido mínimo de {textoDinero(carrito.pedidoMinimo)}.
            </p>
          )}
        </section>

        <ResumenErrores errores={errores} />
        {fallo && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
            {fallo}
          </p>
        )}

        {sesion.uid ? (
          <div>
            <button type="submit" disabled={enviando || !!bloqueo || verificando} className="boton-marca w-full rounded-full px-8 py-3.5 text-base font-bold text-white disabled:opacity-60">
              {enviando ? "Enviando…" : `Enviar pedido · ${textoDinero(t.total)}`}
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">El negocio confirmará tu pedido. El total definitivo lo calcula la plataforma con los precios vigentes.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-center">
            <p className="text-sm font-semibold text-brand-900">Inicia sesión para enviar tu pedido. Tu carrito se conserva.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link href="/login?next=/directorio/carrito" className="boton-marca rounded-full px-6 py-2.5 text-sm font-bold text-white">
                Iniciar sesión
              </Link>
              <Link href="/registro?next=/directorio/carrito" className="rounded-full border border-brand-300 bg-white px-6 py-2.5 text-sm font-bold text-brand-800">
                Crear cuenta
              </Link>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
