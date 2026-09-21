"use client";

import { useState } from "react";
import { useCarrito } from "@/features/directorio/carrito/almacen";
import { MAX_CANTIDAD, cantidadDe, type InfoNegocio } from "@/lib/directorio/carrito";

/** «Agregar» / cantidad con − y + de un producto del menú. Pedir a otro negocio pregunta antes de vaciar el carrito actual. */
export default function BotonAgregar({ item, negocio }: { item: { id: string; nombre: string; precio: number }; negocio: InfoNegocio }) {
  const { carrito, cambiar, reemplazar } = useCarrito();
  const [aviso, setAviso] = useState<string | null>(null);
  const n = cantidadDe(carrito, item.id);

  const poner = (cantidad: number) => {
    setAviso(null);
    const r = cambiar(negocio, item, cantidad);
    if (r.conflicto) {
      const otro = carrito?.nombre ?? "otro negocio";
      if (window.confirm(`Tu carrito tiene productos de ${otro}. ¿Vaciarlo y empezar un pedido en ${negocio.nombre}?`)) reemplazar(negocio, item, cantidad);
    } else if (r.limite) {
      setAviso("Un pedido admite hasta 30 productos distintos.");
    }
  };

  if (n === 0) {
    return (
      <div className="text-right">
        <button
          type="button"
          onClick={() => poner(1)}
          aria-label={`Agregar ${item.nombre} al carrito`}
          className="rounded-full border border-brand-500 px-4 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
        >
          + Agregar
        </button>
        {aviso && (
          <p role="alert" className="mt-1 text-[11px] text-rose-600">
            {aviso}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="text-right">
      <div role="group" aria-label={`Cantidad de ${item.nombre}`} className="inline-flex items-center overflow-hidden rounded-full border border-brand-500 bg-brand-50">
        <button type="button" onClick={() => poner(n - 1)} aria-label={`Quitar una unidad de ${item.nombre}`} className="h-8 w-8 text-lg font-bold text-brand-700 hover:bg-brand-100">
          −
        </button>
        <output aria-live="polite" className="w-7 text-center text-sm font-black tabular-nums text-ink">
          {n}
        </output>
        <button type="button" onClick={() => poner(n + 1)} disabled={n >= MAX_CANTIDAD} aria-label={`Agregar una unidad de ${item.nombre}`} className="h-8 w-8 text-lg font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-40">
          +
        </button>
      </div>
      {aviso && (
        <p role="alert" className="mt-1 text-[11px] text-rose-600">
          {aviso}
        </p>
      )}
    </div>
  );
}
