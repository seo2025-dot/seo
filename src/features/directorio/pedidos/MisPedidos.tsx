"use client";

import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { AvisoCaducidad, InsigniaEstado, useAhora } from "@/features/directorio/pedidos/Piezas";
import { cambiarEstadoPedido, usePedidos } from "@/features/directorio/pedidos/usePedidos";
import { textoDinero } from "@/lib/directorio/mapeo";
import { haceCuanto, puedeCancelarCliente, resumenLineas } from "@/lib/directorio/pedidos";
import { useState } from "react";

/** «Mis pedidos»: lo que pediste, con su estado en tiempo real. */
export default function MisPedidos() {
  const { sesion } = useSocial();
  const { pedidos, error, cargando, recargar } = usePedidos("cliente");
  const ahora = useAhora();
  const [fallo, setFallo] = useState<string | null>(null);

  if (cargando) return <div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />;
  if (!sesion.uid) return null; // el middleware ya redirige al inicio de sesión

  const activos = (pedidos ?? []).filter((p) => !["delivered", "rejected", "cancelled"].includes(p.estado));
  const anteriores = (pedidos ?? []).filter((p) => ["delivered", "rejected", "cancelled"].includes(p.estado));

  const cancelar = async (id: string) => {
    if (!window.confirm("¿Cancelar este pedido?")) return;
    setFallo(await cambiarEstadoPedido(id, "cancelled"));
    void recargar();
  };

  const tarjeta = (p: NonNullable<typeof pedidos>[number]) => (
    <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/directorio/pedidos/${p.id}`} className="block truncate text-base font-black text-ink hover:text-brand-700">
            {p.negocio}
          </Link>
          <p className="text-xs text-slate-500">
            {p.tipo === "delivery" ? "🛵 A domicilio" : "🏪 Retiro"} · {haceCuanto(p.creado, ahora)}
          </p>
        </div>
        <InsigniaEstado tipo={p.tipo} estado={p.estado} />
      </div>
      <p className="mt-2 truncate text-sm text-slate-600">{resumenLineas(p.lineas)}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-black tabular-nums text-ink">{textoDinero(p.total)}</p>
        <div className="flex gap-2">
          {puedeCancelarCliente(p.estado) && (
            <button type="button" onClick={() => void cancelar(p.id)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700">
              Cancelar
            </button>
          )}
          <Link href={`/directorio/pedidos/${p.id}`} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-bold text-ink hover:border-brand-400">
            Ver pedido
          </Link>
        </div>
      </div>
      <div className="mt-1">
        <AvisoCaducidad pedido={p} ahora={ahora} comoNegocio={false} />
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-black text-ink">Mis pedidos</h1>
      <p className="text-slate-500">Sigue tus pedidos de comida y farmacia. Se actualizan solos.</p>

      {(error || fallo) && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error ?? fallo}
        </p>
      )}

      {(pedidos ?? []).length === 0 && !error ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-4xl" aria-hidden>
            🛵
          </p>
          <p className="mt-3 font-bold text-ink">Todavía no has hecho ningún pedido</p>
          <Link href="/directorio/delivery" className="boton-marca mt-5 inline-block rounded-full px-7 py-3 text-sm font-bold text-white">
            Pedir algo rico
          </Link>
        </div>
      ) : (
        <>
          {activos.length > 0 && (
            <section aria-labelledby="ped-activos" className="mt-6">
              <h2 id="ped-activos" className="mb-2 text-lg font-black text-ink">
                En curso
              </h2>
              <ul className="space-y-3">{activos.map(tarjeta)}</ul>
            </section>
          )}
          {anteriores.length > 0 && (
            <section aria-labelledby="ped-antes" className="mt-8">
              <h2 id="ped-antes" className="mb-2 text-lg font-black text-ink">
                Anteriores
              </h2>
              <ul className="space-y-3">{anteriores.map(tarjeta)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
