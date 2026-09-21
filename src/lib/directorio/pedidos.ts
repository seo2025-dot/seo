import { transicionesPedido, type EstadoPedido } from "@/data/directorio";
import { cambiarCantidad, totales, tiposDisponibles, type Carrito, type InfoNegocio, type TipoPedido } from "@/lib/directorio/carrito";
import { telefonoValido } from "@/lib/directorio/contacto";
import type { Errores } from "@/lib/directorio/validacion";

export type FormaPago = "cash" | "transfer";
export const PAGOS: Record<FormaPago, { etiqueta: string; ayuda: string }> = {
  cash: { etiqueta: "Efectivo", ayuda: "Pagas al recibir. Avisa en las notas si necesitas cambio." },
  transfer: { etiqueta: "Transferencia", ayuda: "Coordina los datos de la transferencia por el chat del pedido." },
};

/** Un pedido que nadie responde en 3 horas se cancela solo (`_expire_stale_orders()` en SQL). */
export const TTL_SIN_RESPUESTA_MS = 3 * 3_600_000;

// ── Filas y modelo ──────────────────────────────────────────────────────────
export interface FilaPedido {
  id: string;
  provider_id: string | null;
  provider_owner_id: string;
  provider_name: string;
  customer_id: string;
  kind: string;
  status: string;
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string;
  payment_method: string;
  address: string;
  zone: string;
  notes: string;
  customer_phone: string | null;
  chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FilaLineaPedido {
  order_id: string;
  line_no: number;
  item_id?: string | null;
  name: string;
  unit_price: number | string;
  qty: number;
}

export interface LineaPedido {
  itemId?: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface Pedido {
  id: string;
  proveedorId: string | null;
  negocio: string;
  duenoId: string;
  clienteId: string;
  tipo: TipoPedido;
  estado: EstadoPedido;
  subtotal: number;
  envio: number;
  total: number;
  pago: FormaPago;
  direccion: string;
  zona: string;
  notas: string;
  telefono?: string;
  chatId?: string;
  creado: number;
  actualizado: number;
  lineas: LineaPedido[];
}

const ESTADOS: readonly string[] = ["placed", "accepted", "preparing", "on_the_way", "delivered", "rejected", "cancelled"];

export function mapearPedido(f: FilaPedido, lineas: FilaLineaPedido[] = []): Pedido | null {
  if (!ESTADOS.includes(f.status) || (f.kind !== "delivery" && f.kind !== "pickup")) return null;
  return {
    id: f.id,
    proveedorId: f.provider_id,
    negocio: f.provider_name,
    duenoId: f.provider_owner_id,
    clienteId: f.customer_id,
    tipo: f.kind,
    estado: f.status as EstadoPedido,
    subtotal: Number(f.subtotal),
    envio: Number(f.delivery_fee),
    total: Number(f.total),
    pago: f.payment_method === "transfer" ? "transfer" : "cash",
    direccion: f.address ?? "",
    zona: f.zone ?? "",
    notas: f.notes ?? "",
    telefono: f.customer_phone ?? undefined,
    chatId: f.chat_id ?? undefined,
    creado: new Date(f.created_at).getTime(),
    actualizado: new Date(f.updated_at).getTime(),
    lineas: lineas
      .filter((l) => l.order_id === f.id)
      .sort((a, b) => a.line_no - b.line_no)
      .map((l) => ({ itemId: l.item_id ?? undefined, nombre: l.name, precio: Number(l.unit_price), cantidad: l.qty })),
  };
}

// ── Estados: textos, seguimiento y acciones ─────────────────────────────────
/** «En camino» y «entregado» cambian de palabra cuando la persona retira el pedido en el local. */
export function etiquetaEstado(tipo: TipoPedido, estado: EstadoPedido): { etiqueta: string; emoji: string } {
  switch (estado) {
    case "placed":
      return { etiqueta: "Enviado al negocio", emoji: "🕐" };
    case "accepted":
      return { etiqueta: "Aceptado", emoji: "✅" };
    case "preparing":
      return { etiqueta: "Preparando", emoji: "👨‍🍳" };
    case "on_the_way":
      return tipo === "pickup" ? { etiqueta: "Listo para retirar", emoji: "📦" } : { etiqueta: "En camino", emoji: "🛵" };
    case "delivered":
      return tipo === "pickup" ? { etiqueta: "Retirado", emoji: "🎉" } : { etiqueta: "Entregado", emoji: "🎉" };
    case "rejected":
      return { etiqueta: "Rechazado", emoji: "❌" };
    case "cancelled":
      return { etiqueta: "Cancelado", emoji: "🚫" };
  }
}

const RUTA_FELIZ: EstadoPedido[] = ["placed", "accepted", "preparing", "on_the_way", "delivered"];

export interface PasoSeguimiento {
  estado: EstadoPedido;
  etiqueta: string;
  emoji: string;
  hecho: boolean;
  actual: boolean;
}

/** Línea de tiempo del pedido. En pedidos rechazados o cancelados no hay progreso que mostrar (`terminal` dice por qué). */
export function seguimiento(tipo: TipoPedido, estado: EstadoPedido): { pasos: PasoSeguimiento[]; terminal: "rejected" | "cancelled" | null } {
  const terminal = estado === "rejected" || estado === "cancelled" ? estado : null;
  const indice = RUTA_FELIZ.indexOf(estado);
  return {
    terminal,
    pasos: RUTA_FELIZ.map((e, i) => ({ estado: e, ...etiquetaEstado(tipo, e), hecho: terminal === null && i <= indice, actual: terminal === null && i === indice })),
  };
}

export interface AccionPedido {
  estado: EstadoPedido;
  etiqueta: string;
  tono: "principal" | "secundaria" | "peligro";
}

const TEXTO_ACCION: Record<EstadoPedido, { delivery: string; pickup: string }> = {
  placed: { delivery: "", pickup: "" },
  accepted: { delivery: "Aceptar pedido", pickup: "Aceptar pedido" },
  preparing: { delivery: "Empezar a preparar", pickup: "Empezar a preparar" },
  on_the_way: { delivery: "Salió a entregar", pickup: "Listo para retirar" },
  delivered: { delivery: "Marcar entregado", pickup: "Marcar retirado" },
  rejected: { delivery: "Rechazar", pickup: "Rechazar" },
  cancelled: { delivery: "", pickup: "" },
};

/** Botones que ve el negocio según el estado (derivados de la máquina de estados de SQL: nunca ofrece una transición imposible). */
export function accionesNegocio(tipo: TipoPedido, estado: EstadoPedido): AccionPedido[] {
  return transicionesPedido("negocio", estado).map((e) => ({
    estado: e,
    etiqueta: TEXTO_ACCION[e][tipo],
    tono: e === "rejected" ? "peligro" : e === "delivered" || e === "accepted" ? "principal" : "secundaria",
  }));
}

export const puedeCancelarCliente = (estado: EstadoPedido) => transicionesPedido("cliente", estado).includes("cancelled");

/**
 * «Repetir pedido»: un carrito nuevo con las mismas cantidades. Los artículos que el negocio ya borró (sin `itemId`) se omiten.
 * Los precios son los del pedido anterior: al abrir el pago se contrastan con el catálogo actual (`reconciliar`).
 */
export function carritoDesdePedido(p: Pick<Pedido, "lineas">, negocio: InfoNegocio, ahora = Date.now()): { carrito: Carrito | null; omitidos: number } {
  let carrito: Carrito | null = null;
  let omitidos = 0;
  for (const l of p.lineas) {
    if (!l.itemId) {
      omitidos++;
      continue;
    }
    carrito = cambiarCantidad(carrito, negocio, { id: l.itemId, nombre: l.nombre, precio: l.precio }, l.cantidad, ahora).carrito;
  }
  return { carrito, omitidos };
}

// ── Bandejas ────────────────────────────────────────────────────────────────
export type GrupoBandeja = "nuevos" | "en_curso" | "finalizados";

export const grupoDe = (estado: EstadoPedido): GrupoBandeja => (estado === "placed" ? "nuevos" : ["accepted", "preparing", "on_the_way"].includes(estado) ? "en_curso" : "finalizados");

/** Agrupa para la bandeja del negocio: los nuevos y en curso del más antiguo al más reciente (lo más urgente primero); los finalizados al revés. */
export function agruparBandeja<T extends Pedido>(pedidos: T[]): Record<GrupoBandeja, T[]> {
  const g: Record<GrupoBandeja, T[]> = { nuevos: [], en_curso: [], finalizados: [] };
  for (const p of pedidos) g[grupoDe(p.estado)].push(p);
  g.nuevos.sort((a, b) => a.creado - b.creado);
  g.en_curso.sort((a, b) => a.creado - b.creado);
  g.finalizados.sort((a, b) => b.actualizado - a.actualizado);
  return g;
}

/** Cuánto le queda a un pedido sin responder antes de caducar (null si ya no está «enviado»). */
export function tiempoParaCaducar(p: Pick<Pedido, "estado" | "creado">, ahora = Date.now()): number | null {
  return p.estado === "placed" ? Math.max(0, p.creado + TTL_SIN_RESPUESTA_MS - ahora) : null;
}

export function haceCuanto(ts: number, ahora = Date.now()): string {
  const min = Math.max(0, Math.floor((ahora - ts) / 60_000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

/** «2 × Ceviche mixto, 1 × Jugo» (acortado si son muchos). */
export function resumenLineas(lineas: LineaPedido[], max = 3): string {
  const partes = lineas.slice(0, max).map((l) => `${l.cantidad} × ${l.nombre}`);
  return lineas.length > max ? `${partes.join(", ")} y ${lineas.length - max} más` : partes.join(", ");
}

// ── Pago (validación y argumentos de place_order) ───────────────────────────
export interface DatosPago {
  tipo: TipoPedido;
  direccion: string;
  zona: string;
  telefono: string;
  notas: string;
  pago: FormaPago;
}

/** Reglas iguales a las de `place_order()`: si aquí pasa, el servidor no debería rechazarlo por datos. */
export function validarPago(d: DatosPago, c: Carrito | null): Errores {
  const e: Errores = {};
  if (!c || c.lineas.length === 0) return { carrito: "Tu carrito está vacío." };
  if (!tiposDisponibles(c.canales).includes(d.tipo)) e.tipo = d.tipo === "delivery" ? "Este negocio no entrega a domicilio." : "Este negocio no ofrece retiro en el local.";
  if (d.tipo === "delivery") {
    const dir = d.direccion.trim();
    if (dir.length < 5) e.direccion = "Indica la dirección de entrega (calle, número y referencia).";
    else if (dir.length > 200) e.direccion = "La dirección admite como máximo 200 caracteres.";
  }
  const tel = d.telefono.trim();
  if (!tel && d.tipo === "delivery") e.telefono = "Indica un teléfono para que puedan llamarte al entregar.";
  else if (tel && !telefonoValido(tel)) e.telefono = "Escribe un teléfono válido (por ejemplo 099 123 4567).";
  if (d.notas.trim().length > 300) e.notas = "Las notas admiten como máximo 300 caracteres.";
  if (d.zona.trim().length > 80) e.zona = "La zona admite como máximo 80 caracteres.";
  if (d.pago !== "cash" && d.pago !== "transfer") e.pago = "Elige una forma de pago.";
  const t = totales(c, d.tipo);
  if (t.faltaMinimo > 0) e.minimo = `El pedido mínimo de este negocio es de $${c.pedidoMinimo.toFixed(2)}: te faltan $${t.faltaMinimo.toFixed(2)}.`;
  return e;
}

/** Argumentos de `place_order()` (los nombres deben coincidir con los parámetros SQL; hay un test). */
export function argumentosPedido(d: DatosPago, c: Carrito) {
  return {
    p_provider: c.id,
    p_kind: d.tipo,
    p_lines: c.lineas.map((l) => ({ item_id: l.itemId, qty: l.cantidad })),
    p_address: d.tipo === "delivery" ? d.direccion.trim() : "",
    p_zone: d.zona.trim(),
    p_notes: d.notas.trim(),
    p_payment: d.pago,
    p_phone: d.telefono.trim() || null,
  };
}

/** Mensaje claro para los errores de `place_order()` y `set_order_status()`. */
export function mensajeErrorPedido(mensaje: string): string {
  if (/demasiados pedidos sin responder/.test(mensaje)) return "Tienes varios pedidos esperando respuesta. Espera a que los atiendan o cancélalos desde «Mis pedidos».";
  if (/ya no está disponible|Este perfil no está disponible/.test(mensaje)) return "Algo de tu pedido ya no está disponible. Revisa tu carrito.";
  if (/pedido mínimo/.test(mensaje)) return mensaje;
  if (/requiere receta/.test(mensaje)) return "Un medicamento de tu pedido requiere receta médica y no se puede pedir por la app.";
  if (/No se puede pasar el pedido/.test(mensaje)) return "Ese pedido ya cambió de estado. Actualiza la pantalla.";
  if (/permission denied|No autenticado|JWT/.test(mensaje)) return "Tu sesión caducó. Inicia sesión otra vez (tu carrito se conserva).";
  return mensaje;
}
