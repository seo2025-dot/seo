import { PRECIOS_DEFECTO, dolares, textoMonedas } from "@/lib/monedas";
import type { Errores } from "@/lib/directorio/validacion";

/**
 * Lógica del panel de administración de monedas (`/admin/monedas`): tipos de lo que devuelven las funciones `admin_*` de la
 * actualización 011, validaciones (mismos límites que SQL; hay pruebas de paridad) y cálculos de resumen.
 */

// ── Lo que devuelven las funciones de SQL ───────────────────────────────────
export interface VentasPeriodo {
  pagos: number;
  centavos: number;
  monedas: number;
  bonificadas: number;
  pendientes: number;
  fallidos: number;
  cancelados: number;
}

export interface EstadisticasMonedas {
  dias: number;
  ventas: VentasPeriodo;
  por_pasarela: { pasarela: string; pagos: number; centavos: number }[];
  por_paquete: { paquete: string; pagos: number; centavos: number }[];
  compradores: { periodo: number; total: number; repetidores: number };
  /** Ajustes numéricos de `coin_settings` (p. ej. `first_purchase_bonus_pct`). */
  ajustes: Record<string, number>;
  usuarios: number;
  circulacion: number;
  emitidas: Partial<Record<CategoriaEmision, number>>;
  gastadas: { accion: string; monedas: number; usos: number }[];
  diario: { dia: string; centavos: number; pagos: number }[];
}

export type EstadoPago = "pending" | "paid" | "failed" | "cancelled";

export interface PagoAdmin {
  id: string;
  user_id: string;
  persona: string;
  handle: string | null;
  paquete: string;
  pasarela: string;
  centavos: number;
  coins: number;
  bonificadas: number;
  estado: EstadoPago;
  ref_pasarela: string | null;
  client_ref: string;
  created_at: string;
  paid_at: string | null;
  motivo: string | null;
}

export interface PersonaEncontrada {
  id: string;
  nombre: string;
  handle: string | null;
  email: string;
  monedas: number;
}

export interface FichaMonedasPersona {
  persona: { id: string; nombre: string; handle: string | null; email: string; verificada: boolean; demo: boolean };
  monedas: number;
  usos: { accion: string; gratis: number; pagados: number; gastadas: number }[];
  pagos: { id: string; paquete: string; pasarela: string; centavos: number; coins: number; estado: EstadoPago; created_at: string }[];
  movimientos: { delta: number; motivo: string; created_at: string }[];
}

export interface EntradaLog {
  id: number;
  accion: string;
  detalle: Record<string, unknown>;
  created_at: string;
  admin: string | null;
}

// ── Textos ──────────────────────────────────────────────────────────────────
export type CategoriaEmision = "compras" | "retos" | "bonos" | "invitaciones" | "devoluciones" | "admin" | "otros";

/** De dónde salen las monedas (las mismas categorías que agrupa `admin_coin_stats`). El orden es el de la pantalla. */
export const ORIGEN_MONEDAS: { id: CategoriaEmision; etiqueta: string; gratis: boolean }[] = [
  { id: "compras", etiqueta: "Compradas", gratis: false },
  { id: "retos", etiqueta: "Retos y misiones", gratis: true },
  { id: "bonos", etiqueta: "Bono diario y ruleta", gratis: true },
  { id: "invitaciones", etiqueta: "Invitaciones", gratis: true },
  { id: "devoluciones", etiqueta: "Devoluciones", gratis: false },
  { id: "admin", etiqueta: "Regalos del equipo", gratis: true },
  { id: "otros", etiqueta: "Otros (bienvenida, primer negocio…)", gratis: true },
];

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, { etiqueta: string; clase: string }> = {
  paid: { etiqueta: "Pagado", clase: "bg-emerald-50 text-emerald-700" },
  pending: { etiqueta: "Pendiente", clase: "bg-amber-50 text-amber-800" },
  failed: { etiqueta: "Fallido", clase: "bg-rose-50 text-rose-700" },
  cancelled: { etiqueta: "Cancelado", clase: "bg-slate-100 text-slate-600" },
};

export const etiquetaAccionUso = (accion: string) => PRECIOS_DEFECTO.find((p) => p.accion === accion)?.etiqueta ?? accion;

export const MOTIVO_PAGO: Record<string, string> = {
  importe_distinto: "El importe de la pasarela no coincide",
  moneda_distinta: "Moneda distinta de USD",
  cancelado_por_la_persona: "La persona canceló en la pasarela",
  no_se_pudo_iniciar: "No se pudo iniciar en la pasarela",
};

// ── Resumen ─────────────────────────────────────────────────────────────────
export interface ResumenEconomia {
  ingresos: string;
  ticketMedio: string;
  /** Compradores del periodo sobre el total de personas registradas (no demo), en %. */
  conversionPct: number;
  /** De todos los que alguna vez compraron, cuántos repitieron, en %. */
  repeticionPct: number;
  emitidasTotal: number;
  gratisPct: number;
  gastadasTotal: number;
  /** Monedas gastadas / emitidas en el periodo: cerca de 100 % = la economía «gira»; muy bajo = la gente acumula sin usar. */
  rotacionPct: number;
  /** Ingreso medio por persona registrada. */
  ingresoPorUsuario: string;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export function resumenEconomia(s: EstadisticasMonedas): ResumenEconomia {
  const emitidasTotal = ORIGEN_MONEDAS.reduce((n, o) => n + (s.emitidas[o.id] ?? 0), 0);
  const gratis = ORIGEN_MONEDAS.filter((o) => o.gratis).reduce((n, o) => n + (s.emitidas[o.id] ?? 0), 0);
  const gastadasTotal = s.gastadas.reduce((n, g) => n + g.monedas, 0);
  return {
    ingresos: dolares(s.ventas.centavos),
    ticketMedio: s.ventas.pagos > 0 ? dolares(Math.round(s.ventas.centavos / s.ventas.pagos)) : "—",
    conversionPct: pct(s.compradores.periodo, s.usuarios),
    repeticionPct: pct(s.compradores.repetidores, s.compradores.total),
    emitidasTotal,
    gratisPct: pct(gratis, emitidasTotal),
    gastadasTotal,
    rotacionPct: pct(gastadasTotal, emitidasTotal),
    ingresoPorUsuario: s.usuarios > 0 ? `$${(s.ventas.centavos / 100 / s.usuarios).toFixed(3)}` : "—",
  };
}

/** Alturas (0–100) de la serie diaria de ingresos para dibujar las barras; el día más alto llena el gráfico. */
export function alturasBarras(diario: { centavos: number }[]): number[] {
  const max = Math.max(0, ...diario.map((d) => d.centavos));
  return diario.map((d) => (max > 0 ? Math.max(d.centavos > 0 ? 4 : 0, Math.round((d.centavos / max) * 100)) : 0));
}

/** Descripción en español de una entrada del registro de auditoría. */
export function textoLog(e: Pick<EntradaLog, "accion" | "detalle">): string {
  const d = e.detalle as Record<string, unknown> & { antes?: Record<string, unknown> | null; despues?: Record<string, unknown> };
  const cambios = (antes?: Record<string, unknown> | null, despues?: Record<string, unknown>) =>
    Object.keys(despues ?? {})
      .filter((k) => antes?.[k] !== despues?.[k])
      .map((k) => `${k}: ${antes?.[k] ?? "—"} → ${despues?.[k] ?? "—"}`)
      .join(", ") || "sin cambios";
  switch (e.accion) {
    case "price": return `Tarifa «${etiquetaAccionUso(String(d.action))}»: ${cambios(d.antes, d.despues)}`;
    case "package": return `Paquete «${String(d.id)}»: ${cambios(d.antes, d.despues)}`;
    case "package_new": return `Paquete nuevo «${String(d.id)}»: ${dolares(Number(d.despues?.price_cents ?? 0))} → ${Number(d.despues?.coins ?? 0)} monedas`;
    case "setting": return `Ajuste «${String(d.key)}»: ${String(d.antes ?? "—")} → ${String(d.despues)}`;
    case "challenge": return `Reto «${String(d.id)}»: ${cambios(d.antes, d.despues)}`;
    case "grant": return `Regalo de ${textoMonedas(Number(d.delta))}: ${String(d.motivo ?? "")}`;
    case "adjust": return `Ajuste de ${Number(d.delta) > 0 ? "+" : ""}${Number(d.delta)} monedas: ${String(d.motivo ?? "")}`;
    default: return e.accion;
  }
}

// ── Validaciones (mismos límites que las funciones admin_* de SQL) ──────────
/** «1.50» o «1,5» o «$1.5» → 150 centavos; null si no es un importe con hasta 2 decimales. */
export function dolaresACentavos(texto: string): number | null {
  const t = texto.trim().replace(",", ".").replace(/^\$/, "");
  return /^\d{1,4}(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null;
}

const entero = (t: string): number | null => (/^\d{1,7}$/.test(t.trim()) ? Number(t.trim()) : null);

export interface BorradorTarifa {
  gratis: string;
  coste: string;
}
export function validarTarifa(b: BorradorTarifa): Errores {
  const e: Errores = {};
  const g = entero(b.gratis);
  const c = entero(b.coste);
  if (g === null || g > 1000) e.gratis = "Los usos gratis deben estar entre 0 y 1000.";
  if (c === null || c > 100000) e.coste = "El coste debe estar entre 0 y 100000 monedas.";
  return e;
}

export interface BorradorPaquete {
  id: string;
  etiqueta: string;
  precio: string;
  monedas: string;
  insignia: string;
}
export function validarPaquete(b: BorradorPaquete): Errores {
  const e: Errores = {};
  if (!/^[a-z_]{2,20}$/.test(b.id)) e.id = "El identificador solo admite letras minúsculas y guion bajo (2–20).";
  if (b.etiqueta.trim().length < 2 || b.etiqueta.trim().length > 40) e.etiqueta = "El nombre debe tener entre 2 y 40 caracteres.";
  if (b.insignia.trim().length > 30) e.insignia = "La etiqueta admite como máximo 30 caracteres.";
  const p = dolaresACentavos(b.precio);
  if (p === null || p < 10 || p > 100000) e.precio = "El precio debe estar entre $0.10 y $1000.00.";
  const m = entero(b.monedas);
  if (m === null || m < 1 || m > 1_000_000) e.monedas = "Las monedas deben estar entre 1 y 1000000.";
  return e;
}

export interface BorradorReto {
  meta: string;
  premio: string;
}
export function validarReto(b: BorradorReto): Errores {
  const e: Errores = {};
  const m = entero(b.meta);
  const p = entero(b.premio);
  if (m === null || m < 1 || m > 1000) e.meta = "La meta debe estar entre 1 y 1000.";
  if (p === null || p < 1 || p > 10000) e.premio = "El premio debe estar entre 1 y 10000 monedas.";
  return e;
}

export const validarBonificacion = (texto: string): Errores => {
  const v = entero(texto);
  return v === null || v > 200 ? { bonificacion: "La bonificación debe estar entre 0 y 200 %." } : {};
};

export interface BorradorAjuste {
  cantidad: string;
  motivo: string;
}
/** La cantidad lleva signo: «+50» suma y «-20» resta. */
export function validarAjuste(b: BorradorAjuste): Errores {
  const e: Errores = {};
  const n = /^[+-]?\d{1,5}$/.test(b.cantidad.trim()) ? Number(b.cantidad.trim()) : NaN;
  if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 10000) e.cantidad = "Indica una cantidad distinta de 0 y de 10000 como máximo (por ejemplo +50 o -20).";
  if (b.motivo.trim().length < 3) e.motivo = "Indica el motivo del ajuste.";
  return e;
}
export const cantidadAjuste = (texto: string) => Number(texto.trim());

/** Mensaje claro para los errores de las funciones admin_*. */
export function mensajeErrorAdmin(mensaje: string): string {
  if (/Solo administradores/.test(mensaje)) return "Esta acción es solo para administradores.";
  if (/La persona solo tiene (\d+) monedas/.test(mensaje)) return mensaje;
  if (/schema cache|does not exist|Could not find/i.test(mensaje)) return "Aplica la actualización 011 de la base de datos.";
  return mensaje;
}
