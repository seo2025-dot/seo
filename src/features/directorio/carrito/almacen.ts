"use client";

import { useCallback, useSyncExternalStore } from "react";
import { cambiarCantidad, leerCarrito, reemplazarNegocio, serializarCarrito, type Carrito, type InfoNegocio, type ResultadoCambio } from "@/lib/directorio/carrito";
import type { ItemCatalogo } from "@/types/directorio";

const CLAVE = "conectari:carrito:v1";
const CLAVE_DATOS = "conectari:datos-entrega:v1";

type Producto = Pick<ItemCatalogo, "id" | "nombre"> & { precio: number };

// El carrito vive en el dispositivo (localStorage) y se comparte entre todos los componentes y pestañas mediante un almacén mínimo
// compatible con useSyncExternalStore. Sin sesión también funciona: se inicia sesión solo al pagar y el carrito se conserva.
let actual: Carrito | null | undefined; // undefined = todavía no leído
const oyentes = new Set<() => void>();

function leer(): Carrito | null {
  try {
    return leerCarrito(localStorage.getItem(CLAVE));
  } catch {
    return null;
  }
}

export function obtenerCarrito(): Carrito | null {
  if (typeof window === "undefined") return null;
  if (actual === undefined) actual = leer();
  return actual;
}

export function guardarCarrito(c: Carrito | null) {
  actual = c;
  try {
    if (c) localStorage.setItem(CLAVE, serializarCarrito(c));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento bloqueado o lleno: el carrito sigue vivo mientras la pestaña esté abierta */
  }
  oyentes.forEach((f) => f());
}

function suscribir(aviso: () => void) {
  oyentes.add(aviso);
  const alCambiarOtraPestana = (e: StorageEvent) => {
    if (e.key === CLAVE || e.key === null) {
      actual = leer();
      aviso();
    }
  };
  window.addEventListener("storage", alCambiarOtraPestana);
  return () => {
    oyentes.delete(aviso);
    window.removeEventListener("storage", alCambiarOtraPestana);
  };
}

/** Datos de entrega recordados para no escribirlos en cada pedido. */
export interface DatosEntrega {
  direccion: string;
  zona: string;
  telefono: string;
}

export function leerDatosEntrega(): DatosEntrega {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_DATOS) ?? "{}") as Partial<DatosEntrega>;
    return { direccion: typeof d.direccion === "string" ? d.direccion.slice(0, 200) : "", zona: typeof d.zona === "string" ? d.zona.slice(0, 80) : "", telefono: typeof d.telefono === "string" ? d.telefono.slice(0, 20) : "" };
  } catch {
    return { direccion: "", zona: "", telefono: "" };
  }
}

export function guardarDatosEntrega(d: DatosEntrega) {
  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(d));
  } catch {
    /* nada */
  }
}

/** El carrito actual y sus operaciones. `conflicto` = el producto es de otro negocio: la interfaz decide si vacía el carrito. */
export function useCarrito() {
  const carrito = useSyncExternalStore(suscribir, obtenerCarrito, () => null);

  const cambiar = useCallback((info: InfoNegocio, item: Producto, cantidad: number): ResultadoCambio => {
    const r = cambiarCantidad(obtenerCarrito(), info, item, cantidad);
    if (!r.conflicto && !r.limite) guardarCarrito(r.carrito);
    return r;
  }, []);
  const reemplazar = useCallback((info: InfoNegocio, item: Producto, cantidad: number) => guardarCarrito(reemplazarNegocio(info, item, cantidad)), []);
  const vaciar = useCallback(() => guardarCarrito(null), []);

  return { carrito, cambiar, reemplazar, vaciar };
}
