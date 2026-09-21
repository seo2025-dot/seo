"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { guardarCarrito, obtenerCarrito } from "@/features/directorio/carrito/almacen";
import { AvisoCaducidad, InsigniaEstado, LineaTiempo, ResumenTotales, useAhora } from "@/features/directorio/pedidos/Piezas";
import { cambiarEstadoPedido, usePedido } from "@/features/directorio/pedidos/usePedidos";
import { tiposDisponibles, type InfoNegocio } from "@/lib/directorio/carrito";
import { mapearProveedor, textoDinero, type FilaProveedor } from "@/lib/directorio/mapeo";
import { PAGOS, accionesNegocio, carritoDesdePedido, haceCuanto, puedeCancelarCliente } from "@/lib/directorio/pedidos";
import { haySupabase, supabase } from "@/lib/supabaseClient";

const CLASE_BOTON = {
  principal: "boton-marca text-white",
  secundaria: "border border-slate-300 text-ink hover:border-brand-400",
  peligro: "text-rose-600 hover:bg-rose-50",
} as const;

/** Detalle de un pedido: seguimiento, productos, datos de entrega, chat y las acciones que le tocan a cada parte. */
export default function DetallePedido({ id }: { id: string }) {
  const router = useRouter();
  const nuevo = useSearchParams().get("nuevo") === "1";
  const { sesion } = useSocial();
  const { pedido, error, recargar } = usePedido(id);
  const ahora = useAhora();
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [negocio, setNegocio] = useState<{ info: InfoNegocio; activo: boolean } | null>(null);

  const proveedorId = pedido?.proveedorId ?? null;
  useEffect(() => {
    if (!proveedorId || !haySupabase) return;
    let vivo = true;
    void (async () => {
      const { data } = await supabase().from("providers").select("*").eq("id", proveedorId).maybeSingle();
      const p = data ? mapearProveedor(data as FilaProveedor) : null;
      if (vivo && p) setNegocio({ activo: p.estado === "active", info: { id: p.id, slug: p.slug, vertical: p.vertical, nombre: p.nombre, canales: p.canales, costoEnvio: p.costoEnvio, pedidoMinimo: p.pedidoMinimo } });
    })();
    return () => {
      vivo = false;
    };
  }, [proveedorId]);

  if (pedido === undefined && !error) return <div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />;

  if (!pedido) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl" aria-hidden>
          🔎
        </p>
        <h1 className="mt-4 text-2xl font-black text-ink">{error ? "No pudimos cargar el pedido" : "No encontramos este pedido"}</h1>
        <p className="mt-2 text-slate-500">{error ?? "Puede que el enlace sea incorrecto o que el pedido sea de otra persona."}</p>
        <Link href="/directorio/pedidos" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 text-sm font-bold text-white">
          Ir a mis pedidos
        </Link>
      </div>
    );
  }

  const soyNegocio = sesion.uid === pedido.duenoId;
  const cambiar = async (estado: Parameters<typeof cambiarEstadoPedido>[1], confirmacion?: string) => {
    if (confirmacion && !window.confirm(confirmacion)) return;
    setOcupado(true);
    setFallo(await cambiarEstadoPedido(pedido.id, estado));
    setOcupado(false);
    void recargar();
  };

  const repetir = () => {
    if (!negocio) return;
    const r = carritoDesdePedido(pedido, negocio.info);
    if (!r.carrito) return setFallo("Los productos de este pedido ya no están en el catálogo.");
    const actual = obtenerCarrito();
    if (actual && actual.id !== negocio.info.id && !window.confirm(`Tu carrito tiene productos de ${actual.nombre}. ¿Vaciarlo y repetir este pedido?`)) return;
    guardarCarrito(r.carrito);
    router.push("/directorio/carrito");
  };

  const puedePedirDeNuevo = !soyNegocio && negocio?.activo && tiposDisponibles(negocio.info.canales).length > 0 && pedido.lineas.some((l) => l.itemId);
  const acciones = soyNegocio ? accionesNegocio(pedido.tipo, pedido.estado) : [];
  const fichaHref = negocio ? `/directorio/${negocio.info.vertical}/${negocio.info.slug}` : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm">
        <Link href={soyNegocio ? "/directorio/mi-negocio/pedidos" : "/directorio/pedidos"} className="font-semibold text-brand-700 hover:underline">
          ← {soyNegocio ? "Pedidos recibidos" : "Mis pedidos"}
        </Link>
      </p>

      {nuevo && !soyNegocio && (
        <p role="status" className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          🎉 ¡Pedido enviado! {pedido.negocio} recibió tu pedido y te avisaremos en cuanto lo responda. Puedes escribirles desde el chat del pedido.
        </p>
      )}

      <header className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-ink">{soyNegocio ? `Pedido de ${pedido.clienteNombre ?? "un cliente"}` : pedido.negocio}</h1>
          <p className="text-sm text-slate-500">
            {pedido.tipo === "delivery" ? "🛵 A domicilio" : "🏪 Retiro en el local"} · {haceCuanto(pedido.creado, ahora)}
            {soyNegocio && <> · {pedido.negocio}</>}
          </p>
        </div>
        <InsigniaEstado tipo={pedido.tipo} estado={pedido.estado} />
      </header>

      <section aria-label="Seguimiento" className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <LineaTiempo pedido={pedido} />
        <div className="mt-2">
          <AvisoCaducidad pedido={pedido} ahora={ahora} comoNegocio={soyNegocio} />
        </div>
      </section>

      {(fallo || error) && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {fallo ?? error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {acciones.map((a) => (
          <button key={a.estado} type="button" disabled={ocupado} onClick={() => void cambiar(a.estado, a.estado === "rejected" ? "¿Rechazar este pedido? La persona recibirá un aviso." : undefined)} className={`rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-60 ${CLASE_BOTON[a.tono]}`}>
            {a.etiqueta}
          </button>
        ))}
        {!soyNegocio && puedeCancelarCliente(pedido.estado) && (
          <button type="button" disabled={ocupado} onClick={() => void cambiar("cancelled", "¿Cancelar este pedido?")} className="rounded-full px-5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
            Cancelar pedido
          </button>
        )}
        {pedido.chatId && (
          <Link href={`/mensajes/${pedido.chatId}`} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
            💬 Chat del pedido
          </Link>
        )}
      </div>

      <section aria-labelledby="det-productos" className="mt-6">
        <h2 id="det-productos" className="mb-2 text-lg font-black text-ink">
          Productos
        </h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {pedido.lineas.map((l, i) => (
            <li key={`${l.nombre}-${i}`} className="flex items-center justify-between gap-3 p-3.5 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-black tabular-nums">{l.cantidad} ×</span> {l.nombre}
              </span>
              <span className="tabular-nums text-slate-600">{textoDinero(l.precio * l.cantidad)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-2xl bg-slate-50 p-4">
          <ResumenTotales pedido={pedido} />
        </div>
      </section>

      <section aria-labelledby="det-entrega" className="mt-6">
        <h2 id="det-entrega" className="mb-2 text-lg font-black text-ink">
          {pedido.tipo === "delivery" ? "Entrega" : "Retiro"} y pago
        </h2>
        <dl className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          {pedido.tipo === "delivery" && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dirección</dt>
              <dd className="text-ink">
                {pedido.direccion || "—"}
                {pedido.zona && <span className="text-slate-500"> · {pedido.zona}</span>}
              </dd>
            </div>
          )}
          {pedido.telefono && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Teléfono</dt>
              <dd>{soyNegocio ? <a href={`tel:${pedido.telefono.replace(/[^\d+]/g, "")}`} className="font-semibold text-brand-700 hover:underline">{pedido.telefono}</a> : pedido.telefono}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pago</dt>
            <dd className="text-ink">
              {PAGOS[pedido.pago].etiqueta} <span className="text-slate-500">· {pedido.pago === "cash" ? "al recibir" : "se coordina por el chat"}</span>
            </dd>
          </div>
          {pedido.notas && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</dt>
              <dd className="whitespace-pre-line text-ink">{pedido.notas}</dd>
            </div>
          )}
        </dl>
      </section>

      {!soyNegocio && (
        <div className="mt-6 flex flex-wrap gap-2">
          {puedePedirDeNuevo && (
            <button type="button" onClick={repetir} className="boton-marca rounded-full px-6 py-2.5 text-sm font-bold text-white">
              🔁 Repetir pedido
            </button>
          )}
          {pedido.estado === "delivered" && fichaHref && (
            <Link href={fichaHref} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
              ⭐ Dejar una reseña
            </Link>
          )}
          {fichaHref && (
            <Link href={fichaHref} className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">
              Ver negocio
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
