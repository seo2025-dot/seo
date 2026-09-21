"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCarrito } from "@/features/directorio/carrito/almacen";
import { totales, unidadesEnCarrito } from "@/lib/directorio/carrito";
import { textoDinero } from "@/lib/directorio/mapeo";

/** Barra flotante «🛒 3 productos · $12.50 · Ver carrito» en las páginas del directorio mientras haya algo en el carrito. */
export default function BarraCarrito() {
  const { carrito } = useCarrito();
  const ruta = usePathname();
  if (!carrito || ruta.startsWith("/directorio/carrito") || ruta.startsWith("/directorio/pedidos") || ruta.startsWith("/directorio/mi-negocio")) return null;
  const n = unidadesEnCarrito(carrito);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6">
      <Link
        href="/directorio/carrito"
        className="boton-marca pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-full px-5 py-3 text-sm font-bold text-white shadow-2xl"
        aria-label={`Ver tu carrito: ${n} ${n === 1 ? "producto" : "productos"} de ${carrito.nombre}`}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>🛒</span>
          <span className="tabular-nums">{n}</span>
          <span className="max-w-40 truncate font-semibold opacity-90">{carrito.nombre}</span>
        </span>
        <span className="flex items-center gap-2 tabular-nums">
          {textoDinero(totales(carrito, "pickup").subtotal)}
          <span aria-hidden>→</span>
        </span>
      </Link>
    </div>
  );
}
