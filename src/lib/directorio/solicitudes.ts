import { mensajeSaldoInsuficiente } from "@/lib/monedas";
import { VERTICAL_POR_ID, VERTICALES, type VerticalId } from "@/data/directorio";
import type { Errores } from "@/lib/directorio/validacion";
import type { Proveedor } from "@/types/directorio";

/** Secciones en las que se publican solicitudes («busco…») y los profesionales responden con ofertas. */
export const VERTICALES_SOLICITUD: VerticalId[] = VERTICALES.filter((v) => v.capacidades.solicitudes).map((v) => v.id);

/** Límites iguales a los de `create_service_request()` y `send_offer()` en SQL. */
export const MAX_SOLICITUDES_ABIERTAS = 5;
export const DIAS_MAX_PROGRAMADA = 90;
export const MAX_MINUTOS_OFERTA = 10080;
const HORA = 3_600_000;

export type MomentoSolicitud = "now" | "today" | "scheduled";
export const MOMENTOS: Record<MomentoSolicitud, { etiqueta: string; ayuda: string }> = {
  now: { etiqueta: "Ahora mismo", ayuda: "Recibe ofertas durante 1 hora." },
  today: { etiqueta: "Hoy", ayuda: "Recibe ofertas durante 12 horas." },
  scheduled: { etiqueta: "Otro día", ayuda: "Elige fecha y hora: las ofertas llegan hasta 2 h después." },
};

export type EstadoSolicitud = "open" | "accepted" | "closed";
export type EstadoVisible = EstadoSolicitud | "expired";
export type EstadoOferta = "sent" | "accepted" | "rejected" | "withdrawn";

// ── Detalles según la categoría ─────────────────────────────────────────────
export type ValorDetalle = string | number | boolean;
export type CampoDetalle =
  | { id: string; etiqueta: string; tipo: "opciones"; opciones: { valor: string; etiqueta: string }[] }
  | { id: string; etiqueta: string; tipo: "numero"; min: number; max: number }
  | { id: string; etiqueta: string; tipo: "si_no"; ayuda?: string };

const TAMANOS = [
  { valor: "sobre", etiqueta: "Sobre o documento" },
  { valor: "pequeno", etiqueta: "Pequeño (cabe en una mochila)" },
  { valor: "mediano", etiqueta: "Mediano (caja)" },
  { valor: "grande", etiqueta: "Grande o pesado" },
];

/** Datos extra que ayudan a los profesionales a cotizar. Solo estos campos se envían (nunca texto libre en `details`). */
export function camposDetalle(vertical: VerticalId, subtipo: string): CampoDetalle[] {
  if (vertical === "movilidad") {
    return subtipo === "encomienda" || subtipo === "moto_mensajero"
      ? [{ id: "tamano", etiqueta: "¿Qué envías?", tipo: "opciones", opciones: TAMANOS }]
      : [{ id: "pasajeros", etiqueta: "Pasajeros", tipo: "numero", min: 1, max: 6 }];
  }
  if (vertical === "hogar") return [{ id: "urgente", etiqueta: "Es una urgencia", tipo: "si_no", ayuda: "Fuga, corte de luz, cerradura bloqueada…" }];
  if (vertical === "mascotas") {
    return [{ id: "mascota", etiqueta: "¿Qué mascota?", tipo: "opciones", opciones: [{ valor: "perro", etiqueta: "Perro" }, { valor: "gato", etiqueta: "Gato" }, { valor: "otra", etiqueta: "Otra" }] }];
  }
  return [];
}

/** Se queda solo con los campos conocidos y valores válidos (el navegador puede estar manipulado). */
export function limpiarDetalles(campos: CampoDetalle[], valores: Record<string, unknown>): Record<string, ValorDetalle> {
  const salida: Record<string, ValorDetalle> = {};
  for (const c of campos) {
    const v = valores[c.id];
    if (c.tipo === "opciones" && typeof v === "string" && c.opciones.some((o) => o.valor === v)) salida[c.id] = v;
    else if (c.tipo === "numero" && typeof v === "number" && Number.isInteger(v) && v >= c.min && v <= c.max) salida[c.id] = v;
    else if (c.tipo === "si_no" && v === true) salida[c.id] = true;
  }
  return salida;
}

/** «2 pasajeros · Urgente · Perro»: los detalles de una solicitud en una línea. */
export function resumenDetalles(vertical: VerticalId, subtipo: string, detalles: Record<string, unknown>): string {
  const partes: string[] = [];
  for (const c of camposDetalle(vertical, subtipo)) {
    const v = detalles[c.id];
    if (c.tipo === "opciones") {
      const o = c.opciones.find((x) => x.valor === v);
      if (o) partes.push(o.etiqueta.replace(/ \(.*\)$/, ""));
    } else if (c.tipo === "numero" && typeof v === "number") partes.push(`${v} ${v === 1 ? "pasajero" : "pasajeros"}`);
    else if (c.tipo === "si_no" && v === true) partes.push("Urgente");
  }
  return partes.join(" · ");
}

/** Los viajes y encomiendas necesitan origen y destino; el resto, solo la zona. */
export const requiereDestino = (vertical: VerticalId, subtipo: string) => vertical === "movilidad" && subtipo !== "moto_mensajero";

// ── Filas y modelo ──────────────────────────────────────────────────────────
export interface FilaSolicitud {
  id: string;
  requester_id: string;
  vertical: string;
  subtype: string;
  title: string;
  description: string;
  zone: string;
  dest_zone: string;
  when_kind: string;
  scheduled_at: string | null;
  budget_max: number | string | null;
  details: Record<string, unknown> | null;
  status: string;
  accepted_offer_id: string | null;
  expires_at: string;
  created_at: string;
}

export interface FilaOferta {
  id: string;
  request_id: string;
  provider_id: string;
  price: number | string;
  eta_minutes: number;
  message: string;
  status: string;
  chat_id: string | null;
  created_at: string;
}

export interface Solicitud {
  id: string;
  solicitanteId: string;
  vertical: VerticalId;
  subtipo: string;
  titulo: string;
  descripcion: string;
  zona: string;
  destino: string;
  momento: MomentoSolicitud;
  programada?: number;
  presupuesto?: number;
  detalles: Record<string, unknown>;
  estado: EstadoSolicitud;
  ofertaAceptadaId?: string;
  caduca: number;
  creado: number;
}

export interface Oferta {
  id: string;
  solicitudId: string;
  proveedorId: string;
  precio: number;
  minutos: number;
  mensaje: string;
  estado: EstadoOferta;
  chatId?: string;
  creado: number;
}

const MOMENTOS_VALIDOS: readonly string[] = ["now", "today", "scheduled"];
const ESTADOS_SOLICITUD: readonly string[] = ["open", "accepted", "closed"];
const ESTADOS_OFERTA: readonly string[] = ["sent", "accepted", "rejected", "withdrawn"];

export function mapearSolicitud(f: FilaSolicitud): Solicitud | null {
  if (!(f.vertical in VERTICAL_POR_ID) || !MOMENTOS_VALIDOS.includes(f.when_kind) || !ESTADOS_SOLICITUD.includes(f.status)) return null;
  return {
    id: f.id,
    solicitanteId: f.requester_id,
    vertical: f.vertical as VerticalId,
    subtipo: f.subtype,
    titulo: f.title,
    descripcion: f.description ?? "",
    zona: f.zone ?? "",
    destino: f.dest_zone ?? "",
    momento: f.when_kind as MomentoSolicitud,
    programada: f.scheduled_at ? new Date(f.scheduled_at).getTime() : undefined,
    presupuesto: f.budget_max === null ? undefined : Number(f.budget_max),
    detalles: f.details && typeof f.details === "object" ? f.details : {},
    estado: f.status as EstadoSolicitud,
    ofertaAceptadaId: f.accepted_offer_id ?? undefined,
    caduca: new Date(f.expires_at).getTime(),
    creado: new Date(f.created_at).getTime(),
  };
}

export function mapearOferta(f: FilaOferta): Oferta | null {
  if (!ESTADOS_OFERTA.includes(f.status)) return null;
  return { id: f.id, solicitudId: f.request_id, proveedorId: f.provider_id, precio: Number(f.price), minutos: f.eta_minutes, mensaje: f.message ?? "", estado: f.status as EstadoOferta, chatId: f.chat_id ?? undefined, creado: new Date(f.created_at).getTime() };
}

/** Una solicitud abierta cuya hora pasó ya no recibe ofertas, aunque la base no haya cambiado su estado. */
export const estadoVisible = (s: Pick<Solicitud, "estado" | "caduca">, ahora = Date.now()): EstadoVisible => (s.estado === "open" && s.caduca <= ahora ? "expired" : s.estado);

export const ETIQUETA_ESTADO_SOLICITUD: Record<EstadoVisible, { etiqueta: string; clase: string }> = {
  open: { etiqueta: "Abierta", clase: "bg-emerald-50 text-emerald-700" },
  accepted: { etiqueta: "Oferta aceptada", clase: "bg-sky-50 text-sky-800" },
  closed: { etiqueta: "Cerrada", clase: "bg-slate-100 text-slate-600" },
  expired: { etiqueta: "Caducada", clase: "bg-amber-50 text-amber-800" },
};

export const ETIQUETA_ESTADO_OFERTA: Record<EstadoOferta, { etiqueta: string; clase: string }> = {
  sent: { etiqueta: "Enviada", clase: "bg-amber-50 text-amber-800" },
  accepted: { etiqueta: "Aceptada", clase: "bg-emerald-50 text-emerald-700" },
  rejected: { etiqueta: "No elegida", clase: "bg-slate-100 text-slate-600" },
  withdrawn: { etiqueta: "Retirada", clase: "bg-slate-100 text-slate-500" },
};

/** «Quedan 45 min» / «Quedan 2 h 10 min» / «Caducada». */
export function tiempoRestante(caduca: number, ahora = Date.now()): string {
  const min = Math.ceil((caduca - ahora) / 60_000);
  if (min <= 0) return "Caducada";
  if (min < 60) return `Quedan ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `Quedan ${h} h${min % 60 ? ` ${min % 60} min` : ""}` : `Quedan ${Math.floor(h / 24)} d`;
}

/** «~12 min», «1 h 30 min», «2 días». */
export function textoTiempoOferta(min: number): string {
  if (min < 60) return `~${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
  const d = Math.round(min / 1440);
  return `${d} ${d === 1 ? "día" : "días"}`;
}

/** Cuándo se necesita: «Ahora mismo», «Hoy» o «Mar 3 jun, 15:30». */
export function textoMomento(s: Pick<Solicitud, "momento" | "programada">): string {
  if (s.momento === "now") return "Ahora mismo";
  if (s.momento === "today") return "Hoy";
  if (!s.programada) return "Otro día";
  return new Intl.DateTimeFormat("es-EC", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }).format(s.programada);
}

// ── Publicar una solicitud ──────────────────────────────────────────────────
export interface DatosSolicitud {
  vertical: VerticalId;
  subtipo: string;
  titulo: string;
  descripcion: string;
  zona: string;
  destino: string;
  momento: MomentoSolicitud;
  /** Valor de un `<input type="datetime-local">` (hora de Ecuador) o cadena vacía. */
  programada: string;
  presupuesto: string;
  detalles: Record<string, unknown>;
}

/** `2026-06-03T15:30` (hora de Ecuador, UTC-5 todo el año) → instante. NaN si no es válido. */
export function instanteDesdeLocal(texto: string): number {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto) ? Date.parse(`${texto}:00-05:00`) : NaN;
}

function dinero(texto: string): number | null {
  const t = texto.trim().replace(",", ".").replace(/^\$/, "");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/** Reglas iguales a las de `create_service_request()` (y algo más estrictas: pide zona y destino donde hacen falta). */
export function validarSolicitud(d: DatosSolicitud, ahora = Date.now()): Errores {
  const e: Errores = {};
  const v = VERTICAL_POR_ID[d.vertical];
  if (!v || !v.capacidades.solicitudes) return { vertical: "Esta sección no admite solicitudes." };
  if (!v.subtipos.some((s) => s.id === d.subtipo)) e.subtipo = "Elige qué necesitas.";
  const titulo = d.titulo.trim();
  if (titulo.length < 5) e.titulo = "Cuéntalo en pocas palabras (mínimo 5 letras).";
  else if (titulo.length > 100) e.titulo = "El título admite como máximo 100 caracteres.";
  if (d.descripcion.trim().length > 600) e.descripcion = "Los detalles admiten como máximo 600 caracteres.";
  const zona = d.zona.trim();
  if (!zona) e.zona = requiereDestino(d.vertical, d.subtipo) ? "Indica desde dónde." : "Indica tu zona o barrio.";
  else if (zona.length > 80) e.zona = "La zona admite como máximo 80 caracteres.";
  const destino = d.destino.trim();
  if (requiereDestino(d.vertical, d.subtipo) && !destino) e.destino = "Indica hacia dónde.";
  else if (destino.length > 80) e.destino = "El destino admite como máximo 80 caracteres.";
  if (!MOMENTOS_VALIDOS.includes(d.momento)) e.momento = "Elige cuándo lo necesitas.";
  if (d.momento === "scheduled") {
    const t = instanteDesdeLocal(d.programada);
    if (Number.isNaN(t)) e.programada = "Elige la fecha y la hora.";
    else if (t <= ahora) e.programada = "La fecha y la hora deben ser futuras.";
    else if (t > ahora + DIAS_MAX_PROGRAMADA * 24 * HORA) e.programada = `Solo puedes programar dentro de los próximos ${DIAS_MAX_PROGRAMADA} días.`;
  }
  if (d.presupuesto.trim() && dinero(d.presupuesto) === null) e.presupuesto = "Escribe un importe válido en dólares (por ejemplo 8 o 12.50).";
  return e;
}

/** Argumentos de `create_service_request()` (los nombres deben coincidir con los parámetros SQL; hay un test). */
export function argumentosSolicitud(d: DatosSolicitud) {
  return {
    p_vertical: d.vertical,
    p_subtype: d.subtipo,
    p_title: d.titulo.trim(),
    p_description: d.descripcion.trim(),
    p_zone: d.zona.trim(),
    p_dest_zone: requiereDestino(d.vertical, d.subtipo) ? d.destino.trim() : "",
    p_when: d.momento,
    p_scheduled_at: d.momento === "scheduled" ? new Date(instanteDesdeLocal(d.programada)).toISOString() : null,
    p_budget: d.presupuesto.trim() ? dinero(d.presupuesto) : null,
    p_details: limpiarDetalles(camposDetalle(d.vertical, d.subtipo), d.detalles),
  };
}

// ── Ofertas ─────────────────────────────────────────────────────────────────
export interface DatosOferta {
  precio: string;
  minutos: string;
  mensaje: string;
}

/** Reglas iguales a las de `send_offer()`. */
export function validarOferta(d: DatosOferta): Errores {
  const e: Errores = {};
  if (dinero(d.precio) === null) e.precio = "Indica un precio válido en dólares (por ejemplo 9.50).";
  const m = d.minutos.trim();
  if (!/^\d{1,5}$/.test(m) || Number(m) < 1 || Number(m) > MAX_MINUTOS_OFERTA) e.minutos = "Indica en cuántos minutos puedes atender (entre 1 y 10080).";
  if (d.mensaje.trim().length > 300) e.mensaje = "El mensaje admite como máximo 300 caracteres.";
  return e;
}

/** Argumentos de `send_offer()` (los nombres deben coincidir con los parámetros SQL; hay un test). */
export function argumentosOferta(solicitudId: string, proveedorId: string, d: DatosOferta) {
  return { p_request: solicitudId, p_provider: proveedorId, p_price: dinero(d.precio), p_eta: Number(d.minutos.trim()), p_message: d.mensaje.trim() };
}

/** Perfiles propios que pueden ofertar en una solicitud: activos y de la misma sección y categoría. */
export const perfilesQueEncajan = <T extends Pick<Proveedor, "id" | "vertical" | "subtipo" | "estado">>(s: Pick<Solicitud, "vertical" | "subtipo">, perfiles: T[]): T[] =>
  perfiles.filter((p) => p.estado === "active" && p.vertical === s.vertical && p.subtipo === s.subtipo);

/** Por qué una persona no puede ofertar todavía (null = puede). En Movilidad se exige identidad verificada. */
export function bloqueoOferta(s: Pick<Solicitud, "vertical" | "estado" | "caduca">, opciones: { identidadVerificada: boolean; perfilesQueEncajan: number }, ahora = Date.now()): string | null {
  if (estadoVisible(s, ahora) !== "open") return "Esta solicitud ya no recibe ofertas.";
  if (opciones.perfilesQueEncajan === 0) return "Necesitas un perfil activo de esta categoría para ofertar.";
  if (s.vertical === "movilidad" && !opciones.identidadVerificada) return "Para ofertar viajes y encomiendas debes verificar tu identidad.";
  return null;
}

/** Ofertas vigentes primero, de la más barata a la más cara y, a igual precio, la más rápida; después las resueltas. */
export function ordenarOfertas<T extends Pick<Oferta, "estado" | "precio" | "minutos" | "creado">>(ofertas: T[]): T[] {
  const peso = (o: T) => (o.estado === "accepted" ? 0 : o.estado === "sent" ? 1 : 2);
  return [...ofertas].sort((a, b) => peso(a) - peso(b) || a.precio - b.precio || a.minutos - b.minutos || a.creado - b.creado);
}

/** Ids de la oferta vigente más barata y de la más rápida (solo si hay al menos dos para comparar). */
export function destacadas(ofertas: Pick<Oferta, "id" | "estado" | "precio" | "minutos">[]): { barata?: string; rapida?: string } {
  const v = ofertas.filter((o) => o.estado === "sent");
  if (v.length < 2) return {};
  return {
    barata: [...v].sort((a, b) => a.precio - b.precio || a.minutos - b.minutos)[0].id,
    rapida: [...v].sort((a, b) => a.minutos - b.minutos || a.precio - b.precio)[0].id,
  };
}

/** Mensaje claro para los errores de las funciones de solicitudes y ofertas. */
export function mensajeErrorSolicitud(mensaje: string): string {
  const saldo = mensajeSaldoInsuficiente(mensaje);
  if (saldo) return saldo; // «🪙 Necesitas 5 monedas para aceptar este pedido…»
  if (/5 solicitudes abiertas/.test(mensaje)) return "Ya tienes 5 solicitudes abiertas. Cierra alguna o espera a que caduque.";
  if (/verificar tu identidad/.test(mensaje)) return "Para ofertar viajes y encomiendas debes verificar tu identidad.";
  if (/ya no está abierta/.test(mensaje)) return "Esa solicitud ya no está abierta.";
  if (/no ofrece este tipo de servicio|no es tuyo o no está activo/.test(mensaje)) return "Ese perfil no ofrece este tipo de servicio o no está activo.";
  if (/ya fue resuelta|ya no está vigente/.test(mensaje)) return "Esa oferta ya fue resuelta. Actualiza la pantalla.";
  if (/No se puede retirar|No se puede cerrar/.test(mensaje)) return "Ya no se puede hacer ese cambio. Actualiza la pantalla.";
  if (/próximos 90 días/.test(mensaje)) return "La fecha programada debe estar en los próximos 90 días.";
  if (/permission denied|No autenticado|JWT/.test(mensaje)) return "Tu sesión caducó. Inicia sesión otra vez.";
  return mensaje;
}
