import type { CanalId, VerticalId } from "@/data/directorio";
import type { ItemCatalogo } from "@/types/directorio";

/** Límites iguales a los de `place_order()` en SQL. */
export const MAX_CANTIDAD = 20;
export const MAX_LINEAS = 30;
/** Un carrito olvidado más de una semana se descarta (los precios y la disponibilidad ya no son fiables). */
export const CADUCIDAD_CARRITO_MS = 7 * 86_400_000;

export type TipoPedido = "delivery" | "pickup";

/** Lo que el carrito recuerda del negocio (se refresca al abrir el pago). */
export interface InfoNegocio {
  id: string;
  slug: string;
  vertical: VerticalId;
  nombre: string;
  canales: CanalId[];
  costoEnvio: number;
  pedidoMinimo: number;
}

export interface LineaCarrito {
  itemId: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

/** Un carrito pertenece a UN negocio (como en las apps de reparto): pedir a otro negocio pregunta si se vacía el actual. */
export interface Carrito extends InfoNegocio {
  lineas: LineaCarrito[];
  actualizado: number;
}

// Los importes se suman en centavos enteros para no arrastrar errores de coma flotante (0.1 + 0.2).
const aCentavos = (n: number) => Math.round(n * 100);
const deCentavos = (c: number) => c / 100;

export const cantidadDe = (c: Carrito | null, itemId: string): number => c?.lineas.find((l) => l.itemId === itemId)?.cantidad ?? 0;
export const unidadesEnCarrito = (c: Carrito | null): number => c?.lineas.reduce((n, l) => n + l.cantidad, 0) ?? 0;

const acotar = (cantidad: number) => Math.max(0, Math.min(MAX_CANTIDAD, Math.trunc(Number.isFinite(cantidad) ? cantidad : 0)));

export interface ResultadoCambio {
  carrito: Carrito | null;
  /** true si el producto es de otro negocio distinto al del carrito: la interfaz debe preguntar antes de vaciarlo. */
  conflicto: boolean;
  /** true si se intentó pasar de MAX_LINEAS productos distintos. */
  limite: boolean;
}

/** Fija la cantidad de un producto (0 lo quita). No muta el carrito recibido. */
export function cambiarCantidad(c: Carrito | null, info: InfoNegocio, item: Pick<ItemCatalogo, "id" | "nombre"> & { precio: number }, cantidad: number, ahora = Date.now()): ResultadoCambio {
  const n = acotar(cantidad);
  if (c && c.id !== info.id) return { carrito: c, conflicto: n > 0, limite: false };
  const base: Carrito = c ? { ...c, ...info } : { ...info, lineas: [], actualizado: ahora };
  const existe = base.lineas.some((l) => l.itemId === item.id);
  if (!existe && n > 0 && base.lineas.length >= MAX_LINEAS) return { carrito: c, conflicto: false, limite: true };
  const lineas =
    n === 0
      ? base.lineas.filter((l) => l.itemId !== item.id)
      : existe
        ? base.lineas.map((l) => (l.itemId === item.id ? { ...l, cantidad: n, precio: item.precio, nombre: item.nombre } : l))
        : [...base.lineas, { itemId: item.id, nombre: item.nombre, precio: item.precio, cantidad: n }];
  return { carrito: lineas.length === 0 ? null : { ...base, lineas, actualizado: ahora }, conflicto: false, limite: false };
}

/** Empieza un carrito nuevo de otro negocio (tras confirmar que se descarta el anterior). */
export function reemplazarNegocio(info: InfoNegocio, item: Pick<ItemCatalogo, "id" | "nombre"> & { precio: number }, cantidad: number, ahora = Date.now()): Carrito | null {
  return cambiarCantidad(null, info, item, cantidad, ahora).carrito;
}

/** Formas de recibir el pedido que ofrece el negocio (mismas reglas que `place_order()`). */
export function tiposDisponibles(canales: readonly CanalId[]): TipoPedido[] {
  const tipos: TipoPedido[] = [];
  if (canales.includes("entrega")) tipos.push("delivery");
  if (canales.includes("retiro") || canales.includes("local")) tipos.push("pickup");
  return tipos;
}

export interface Totales {
  unidades: number;
  subtotal: number;
  envio: number;
  total: number;
  /** Cuánto falta para llegar al pedido mínimo (0 si ya se llegó). El mínimo se aplica al subtotal, con envío o sin él. */
  faltaMinimo: number;
}

/** Estimación para mostrar; el total definitivo lo calcula el servidor con los precios vigentes. */
export function totales(c: Carrito | null, tipo: TipoPedido): Totales {
  if (!c) return { unidades: 0, subtotal: 0, envio: 0, total: 0, faltaMinimo: 0 };
  const sub = c.lineas.reduce((n, l) => n + aCentavos(l.precio) * l.cantidad, 0);
  const envio = tipo === "delivery" ? aCentavos(c.costoEnvio) : 0;
  return {
    unidades: unidadesEnCarrito(c),
    subtotal: deCentavos(sub),
    envio: deCentavos(envio),
    total: deCentavos(sub + envio),
    faltaMinimo: deCentavos(Math.max(0, aCentavos(c.pedidoMinimo) - sub)),
  };
}

/** Las líneas tal como las espera `place_order()`: solo producto y cantidad, NUNCA precios. */
export const lineasParaRpc = (c: Carrito) => c.lineas.map((l) => ({ item_id: l.itemId, qty: l.cantidad }));

// ── Persistencia ────────────────────────────────────────────────────────────
export const serializarCarrito = (c: Carrito | null): string => JSON.stringify(c);

const CANALES: readonly string[] = ["local", "entrega", "retiro", "visita", "en_linea"];
const VERTICALES: readonly string[] = ["movilidad", "delivery", "salud", "eventos", "mascotas", "hogar"];
const esTexto = (v: unknown, max = 200): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const esImporte = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1_000_000;

/**
 * Lee un carrito guardado en el dispositivo desconfiando de él (puede estar corrupto, ser de una versión anterior o haber
 * sido manipulado): descarta lo inválido, acota cantidades y devuelve null si no queda nada aprovechable o si caducó.
 */
export function leerCarrito(texto: string | null, ahora = Date.now()): Carrito | null {
  if (!texto) return null;
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof crudo !== "object" || crudo === null) return null;
  const c = crudo as Record<string, unknown>;
  if (!esTexto(c.id, 64) || !esTexto(c.slug, 120) || !esTexto(c.nombre, 120) || typeof c.vertical !== "string" || !VERTICALES.includes(c.vertical)) return null;
  if (!esImporte(c.costoEnvio) || !esImporte(c.pedidoMinimo) || !Array.isArray(c.canales) || !Array.isArray(c.lineas)) return null;
  const actualizado = typeof c.actualizado === "number" ? c.actualizado : 0;
  if (ahora - actualizado > CADUCIDAD_CARRITO_MS) return null;
  const vistos = new Set<string>();
  const lineas: LineaCarrito[] = [];
  for (const l of c.lineas.slice(0, MAX_LINEAS * 2)) {
    if (typeof l !== "object" || l === null) continue;
    const { itemId, nombre, precio, cantidad } = l as Record<string, unknown>;
    if (!esTexto(itemId, 64) || vistos.has(itemId) || !esTexto(nombre, 120) || !esImporte(precio)) continue;
    const n = acotar(typeof cantidad === "number" ? cantidad : 0);
    if (n < 1) continue;
    vistos.add(itemId);
    lineas.push({ itemId, nombre, precio, cantidad: n });
    if (lineas.length === MAX_LINEAS) break;
  }
  if (lineas.length === 0) return null;
  return {
    id: c.id,
    slug: c.slug,
    vertical: c.vertical as VerticalId,
    nombre: c.nombre,
    canales: c.canales.filter((x): x is CanalId => typeof x === "string" && CANALES.includes(x)),
    costoEnvio: c.costoEnvio,
    pedidoMinimo: c.pedidoMinimo,
    lineas,
    actualizado,
  };
}

// ── Reconciliación con lo que hay ahora en el catálogo ──────────────────────
export interface EstadoNegocio {
  activo: boolean;
  canales: CanalId[];
  costoEnvio: number;
  pedidoMinimo: number;
}

export interface Reconciliado {
  carrito: Carrito | null;
  /** Mensajes para la persona: qué cambió desde que agregó los productos. */
  cambios: string[];
  /** Si no se puede pedir a este negocio ahora (pausado, sin entrega…), el motivo. */
  bloqueo: string | null;
}

const m = (n: number) => `$${n.toFixed(2)}`;

/**
 * Antes de pagar se contrasta el carrito con el catálogo actual: quita lo que ya no está disponible, lo que requiere receta
 * o no tiene precio fijo, actualiza los precios que cambiaron y refresca los datos de entrega. Así la persona nunca sorprende
 * al negocio ni se sorprende con el total.
 */
export function reconciliar(c: Carrito, items: Pick<ItemCatalogo, "id" | "nombre" | "precio" | "disponible" | "receta">[], negocio: EstadoNegocio): Reconciliado {
  const cambios: string[] = [];
  const porId = new Map(items.map((i) => [i.id, i]));
  const lineas: LineaCarrito[] = [];
  for (const l of c.lineas) {
    const i = porId.get(l.itemId);
    if (!i || !i.disponible) cambios.push(`«${l.nombre}» ya no está disponible y se quitó de tu carrito.`);
    else if (i.receta) cambios.push(`«${i.nombre}» requiere receta médica y no se puede pedir por la app: se quitó.`);
    else if (i.precio === null) cambios.push(`«${i.nombre}» no tiene precio fijo: consúltalo con el negocio. Se quitó.`);
    else {
      if (aCentavos(i.precio) !== aCentavos(l.precio)) cambios.push(`El precio de «${i.nombre}» cambió de ${m(l.precio)} a ${m(i.precio)}.`);
      lineas.push({ ...l, nombre: i.nombre, precio: i.precio });
    }
  }
  const actualizado: Carrito = { ...c, canales: negocio.canales, costoEnvio: negocio.costoEnvio, pedidoMinimo: negocio.pedidoMinimo, lineas };
  const bloqueo = !negocio.activo ? "Este negocio no está disponible ahora." : tiposDisponibles(negocio.canales).length === 0 ? "Este negocio no recibe pedidos por la app." : null;
  return { carrito: lineas.length === 0 ? null : actualizado, cambios, bloqueo };
}
