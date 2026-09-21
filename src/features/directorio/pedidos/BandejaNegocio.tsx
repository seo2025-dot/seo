"use client";

import { useState } from "react";
import Link from "next/link";
import { FalloOperacion, CosteAccion } from "@/features/monedas/Piezas";
import { AvisoCaducidad, InsigniaEstado, useAhora } from "@/features/directorio/pedidos/Piezas";
import { cambiarEstadoPedido, usePedidos, type PedidoConCliente } from "@/features/directorio/pedidos/usePedidos";
import { textoDinero } from "@/lib/directorio/mapeo";
import { accionesNegocio, agruparBandeja, haceCuanto, resumenLineas, type GrupoBandeja } from "@/lib/directorio/pedidos";

const GRUPOS: { id: GrupoBandeja; titulo: string; vacio: string }[] = [
  { id: "nuevos", titulo: "🔔 Nuevos", vacio: "No hay pedidos nuevos." },
  { id: "en_curso", titulo: "👨‍🍳 En curso", vacio: "No tienes pedidos en curso." },
  { id: "finalizados", titulo: "✅ Finalizados", vacio: "Aquí verás los pedidos ya entregados, rechazados o cancelados." },
];

const CLASE_BOTON = {
  principal: "boton-marca text-white",
  secundaria: "border border-slate-300 text-ink hover:border-brand-400",
  peligro: "text-rose-600 hover:bg-rose-50",
} as const;

/** Bandeja de pedidos del negocio: nuevos primero, aceptar o rechazar con un toque, en tiempo real. */
export default function BandejaNegocio() {
  const { pedidos, error, cargando, recargar } = usePedidos("negocio");
  const ahora = useAhora();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  if (cargando) return <div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-10" />;
  const g = agruparBandeja(pedidos ?? []);

  const cambiar = async (p: PedidoConCliente, estado: Parameters<typeof cambiarEstadoPedido>[1]) => {
    if (estado === "rejected" && !window.confirm("¿Rechazar este pedido? La persona recibirá un aviso.")) return;
    setOcupado(p.id);
    setFallo(await cambiarEstadoPedido(p.id, estado));
    setOcupado(null);
    void recargar();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm">
        <Link href="/directorio/mi-negocio" className="font-semibold text-brand-700 hover:underline">
          ← Mi negocio
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-black text-ink">Pedidos recibidos</h1>
      <p className="text-slate-500">Responde rápido: los pedidos sin respuesta se cancelan solos a las 3 horas.</p>

      {(error || fallo) && (
        <FalloOperacion texto={error ?? fallo ?? ""} className="mt-4" />
      )}

      {GRUPOS.map(({ id, titulo, vacio }) => (
        <section key={id} aria-labelledby={`bandeja-${id}`} className="mt-8">
          <h2 id={`bandeja-${id}`} className="mb-2 flex items-center gap-2 text-lg font-black text-ink">
            {titulo}
            {g[id].length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{g[id].length}</span>}
          </h2>
          {g[id].length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">{vacio}</p>
          ) : (
            <ul className="space-y-3">
              {g[id].map((p) => (
                <li key={p.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${id === "nuevos" ? "border-amber-300" : "border-slate-200"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/directorio/pedidos/${p.id}`} className="block truncate font-black text-ink hover:text-brand-700">
                        {p.clienteNombre ?? "Cliente"} · {textoDinero(p.total)}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {p.negocio} · {p.tipo === "delivery" ? "🛵 A domicilio" : "🏪 Retiro"} · {haceCuanto(p.creado, ahora)}
                      </p>
                    </div>
                    <InsigniaEstado tipo={p.tipo} estado={p.estado} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{resumenLineas(p.lineas, 4)}</p>
                  {p.notas && <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">📝 {p.notas}</p>}
                  <div className="mt-1">
                    <AvisoCaducidad pedido={p} ahora={ahora} comoNegocio />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {accionesNegocio(p.tipo, p.estado).some((a) => a.estado === "accepted") && <CosteAccion accion="order_accept" className="self-center" />}
                    {accionesNegocio(p.tipo, p.estado).map((a) => (
                      <button key={a.estado} type="button" disabled={ocupado === p.id} onClick={() => void cambiar(p, a.estado)} className={`rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60 ${CLASE_BOTON[a.tono]}`}>
                        {a.etiqueta}
                      </button>
                    ))}
                    <Link href={`/directorio/pedidos/${p.id}`} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                      Ver detalle
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
