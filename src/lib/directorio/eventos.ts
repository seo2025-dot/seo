import { instanteEcuador, valorLocalEcuador } from "@/lib/directorio/horarios";
import type { Errores } from "@/lib/directorio/validacion";
import type { Proveedor } from "@/types/directorio";

// ── Categorías (las mismas que el `check` de events.category en SQL; hay una prueba de paridad) ──────────────
export const CATEGORIAS_EVENTO = [
  { id: "concierto", etiqueta: "Conciertos", emoji: "🎸" },
  { id: "teatro", etiqueta: "Teatro y danza", emoji: "🎭" },
  { id: "taller", etiqueta: "Talleres", emoji: "🛠️" },
  { id: "feria", etiqueta: "Ferias y festivales", emoji: "🎪" },
  { id: "deporte", etiqueta: "Deporte", emoji: "⚽" },
  { id: "gastronomia", etiqueta: "Gastronomía", emoji: "🍽️" },
  { id: "infantil", etiqueta: "Infantil", emoji: "🧸" },
  { id: "cultural", etiqueta: "Cultura y arte", emoji: "🏛️" },
  { id: "otro", etiqueta: "Otros", emoji: "✨" },
] as const;
export type CategoriaEvento = (typeof CATEGORIAS_EVENTO)[number]["id"];
export const categoriaEvento = (id: string) => CATEGORIAS_EVENTO.find((c) => c.id === id) ?? CATEGORIAS_EVENTO[CATEGORIAS_EVENTO.length - 1];
const esCategoria = (id: string): id is CategoriaEvento => CATEGORIAS_EVENTO.some((c) => c.id === id);

/** Límites iguales a los de las tablas y funciones de SQL. */
export const LIMITES_EVENTO = { tituloMin: 5, tituloMax: 120, descripcionMax: 2000, lugarMax: 100, direccionMax: 160, zonaMax: 80, imagenesMax: 6, eventosFuturosMax: 30 } as const;
export const LIMITES_ENTRADA = { nombreMin: 2, nombreMax: 60, precioMax: 999_999.99, cupoMax: 100_000, porPedidoMax: 20 } as const;

/** Sin hora de fin, un evento se considera «en curso» durante 3 horas desde que empieza. */
export const DURACION_SUPUESTA_MS = 3 * 3_600_000;
const HORA = 3_600_000;
const DIA = 86_400_000;
const OFFSET_EC = 5 * HORA; // Ecuador continental: UTC-5 todo el año

export type EstadoEvento = "published" | "cancelled" | "review";
export type EstadoReserva = "reserved" | "cancelled" | "checked_in";

// ── Filas y modelo ──────────────────────────────────────────────────────────
export interface FilaEvento {
  id: string;
  provider_id: string;
  title: string;
  description: string;
  category: string;
  venue_name: string;
  address: string;
  zone: string;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  images: string[] | null;
  is_free: boolean;
  external_ticket_url: string | null;
  status: string;
  created_at: string;
}

export interface FilaTipoEntrada {
  id: string;
  event_id: string;
  name: string;
  price: number | string;
  quantity: number;
  sold: number;
  max_per_order: number;
  sales_end: string | null;
}

export interface FilaReserva {
  id: string;
  event_id: string;
  ticket_type_id: string;
  user_id: string;
  qty: number;
  total: number | string;
  code: string;
  status: string;
  created_at: string;
}

export interface Evento {
  id: string;
  proveedorId: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaEvento;
  lugar: string;
  direccion: string;
  zona: string;
  inicia: number;
  termina?: number;
  portadaUrl?: string;
  imagenes: string[];
  gratis: boolean;
  enlaceEntradas?: string;
  estado: EstadoEvento;
  creado: number;
}

export interface TipoEntrada {
  id: string;
  eventoId: string;
  nombre: string;
  precio: number;
  cupo: number;
  vendidas: number;
  maxPorPedido: number;
  ventaHasta?: number;
}

export interface Reserva {
  id: string;
  eventoId: string;
  tipoId: string;
  usuarioId: string;
  cantidad: number;
  total: number;
  codigo: string;
  estado: EstadoReserva;
  creado: number;
}

const ESTADOS_EVENTO: readonly string[] = ["published", "cancelled", "review"];
const ESTADOS_RESERVA: readonly string[] = ["reserved", "cancelled", "checked_in"];

export function mapearEvento(f: FilaEvento): Evento | null {
  if (!ESTADOS_EVENTO.includes(f.status)) return null;
  return {
    id: f.id,
    proveedorId: f.provider_id,
    titulo: f.title,
    descripcion: f.description ?? "",
    categoria: esCategoria(f.category) ? f.category : "otro",
    lugar: f.venue_name ?? "",
    direccion: f.address ?? "",
    zona: f.zone ?? "",
    inicia: new Date(f.starts_at).getTime(),
    termina: f.ends_at ? new Date(f.ends_at).getTime() : undefined,
    portadaUrl: f.cover_url ?? undefined,
    imagenes: f.images ?? [],
    gratis: f.is_free,
    enlaceEntradas: f.external_ticket_url ?? undefined,
    estado: f.status as EstadoEvento,
    creado: new Date(f.created_at).getTime(),
  };
}

export const mapearTipoEntrada = (f: FilaTipoEntrada): TipoEntrada => ({
  id: f.id,
  eventoId: f.event_id,
  nombre: f.name,
  precio: Number(f.price),
  cupo: f.quantity,
  vendidas: f.sold,
  maxPorPedido: f.max_per_order,
  ventaHasta: f.sales_end ? new Date(f.sales_end).getTime() : undefined,
});

export function mapearReserva(f: FilaReserva): Reserva | null {
  if (!ESTADOS_RESERVA.includes(f.status)) return null;
  return { id: f.id, eventoId: f.event_id, tipoId: f.ticket_type_id, usuarioId: f.user_id, cantidad: f.qty, total: Number(f.total), codigo: f.code, estado: f.status as EstadoReserva, creado: new Date(f.created_at).getTime() };
}

// ── Fase del evento y estado de las entradas ────────────────────────────────
export type FaseEvento = "proximo" | "en_curso" | "finalizado" | "cancelado";

export const finEvento = (e: Pick<Evento, "inicia" | "termina">) => e.termina ?? e.inicia + DURACION_SUPUESTA_MS;

export function faseEvento(e: Pick<Evento, "inicia" | "termina" | "estado">, ahora = Date.now()): FaseEvento {
  if (e.estado === "cancelled") return "cancelado";
  if (ahora < e.inicia) return "proximo";
  return ahora < finEvento(e) ? "en_curso" : "finalizado";
}

export const disponibles = (t: Pick<TipoEntrada, "cupo" | "vendidas">) => Math.max(0, t.cupo - t.vendidas);

export type EstadoVenta = "disponible" | "pocas" | "agotada" | "cerrada";

/** Qué se puede hacer con un tipo de entrada. La venta cierra al empezar el evento (`reserve_tickets` lo exige) o en `ventaHasta`. */
export function estadoVenta(t: TipoEntrada, e: Pick<Evento, "inicia" | "termina" | "estado">, ahora = Date.now()): { estado: EstadoVenta; texto: string } {
  if (faseEvento(e, ahora) !== "proximo" || (t.ventaHasta !== undefined && t.ventaHasta <= ahora)) return { estado: "cerrada", texto: "Venta cerrada" };
  const quedan = disponibles(t);
  if (quedan === 0) return { estado: "agotada", texto: "Agotada" };
  if (quedan <= Math.max(5, Math.ceil(t.cupo * 0.1))) return { estado: "pocas", texto: quedan === 1 ? "Queda 1" : `Quedan ${quedan}` };
  return { estado: "disponible", texto: "Disponible" };
}

/** Máximo de entradas que una persona puede reservar de este tipo ahora mismo (0 = ninguna). */
export function maxReservable(t: TipoEntrada, e: Pick<Evento, "inicia" | "termina" | "estado">, ahora = Date.now()): number {
  const s = estadoVenta(t, e, ahora).estado;
  return s === "disponible" || s === "pocas" ? Math.min(t.maxPorPedido, disponibles(t)) : 0;
}

/** Total en dólares calculado en centavos (igual que `price * qty` en numeric de SQL). */
export const totalReserva = (t: Pick<TipoEntrada, "precio">, cantidad: number) => Math.round(Math.round(t.precio * 100) * cantidad) / 100;

/** Por qué no se puede reservar (null = se puede). Mismas reglas que `reserve_tickets()`; hay una prueba de paridad. */
export function bloqueoReserva(t: TipoEntrada, e: Pick<Evento, "inicia" | "termina" | "estado">, cantidad: number, ahora = Date.now()): string | null {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) return "Elige entre 1 y 20 entradas.";
  const s = estadoVenta(t, e, ahora);
  if (s.estado === "cerrada") return "La venta de esta entrada está cerrada.";
  if (s.estado === "agotada") return "Esta entrada está agotada.";
  if (cantidad > t.maxPorPedido) return `Puedes reservar hasta ${t.maxPorPedido} por persona.`;
  if (cantidad > disponibles(t)) return `Solo quedan ${disponibles(t)}.`;
  return null;
}

export const textoPrecioEntrada = (precio: number) => (precio === 0 ? "Gratis" : `$${precio.toFixed(2)}`);

/** «Gratis», «$12.50», «Desde $5.00» o «Agotado» para una tarjeta o la cabecera de la ficha. */
export function textoPrecioEvento(e: Pick<Evento, "gratis" | "enlaceEntradas" | "inicia" | "termina" | "estado">, tipos: TipoEntrada[], ahora = Date.now()): string {
  const visibles = tipos.filter((t) => t.ventaHasta === undefined || t.ventaHasta > ahora);
  if (visibles.length === 0) return e.gratis ? "Entrada libre" : e.enlaceEntradas ? "Entradas en línea" : "Consultar";
  const proximo = faseEvento(e, ahora) === "proximo";
  if (proximo && visibles.every((t) => disponibles(t) === 0)) return "Agotado";
  // Antes del evento se anuncian solo los precios de lo que aún se puede reservar; después, todos.
  const precios = (proximo ? visibles.filter((t) => disponibles(t) > 0) : visibles).map((t) => t.precio);
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  if (max === 0) return "Gratis";
  return min === max ? textoPrecioEntrada(min) : `Desde ${textoPrecioEntrada(min)}`;
}

// ── Fechas (siempre en hora de Ecuador) ─────────────────────────────────────
const fmt = (opciones: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", ...opciones });
const FMT_DIA_CORTO = fmt({ weekday: "short", day: "numeric", month: "short" });
const FMT_DIA_LARGO = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const FMT_HORA = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
const limpiar = (t: string) => t.replace(/[.,]/g, "").replace(/\s+/g, " ").trim(); // ICU añade «sáb, 6 jun.»: se quitan comas y puntos

/** Inicio (00:00 hora de Ecuador) del día que contiene ese instante. */
export const inicioDia = (ms: number) => Math.floor((ms - OFFSET_EC) / DIA) * DIA + OFFSET_EC;
export const claveDia = (ms: number) => new Date(ms - OFFSET_EC).toISOString().slice(0, 10);

export const textoHora = (ms: number) => FMT_HORA.format(ms);
/** «sáb 6 jun · 20:00» */
export const textoFechaCorta = (ms: number) => `${limpiar(FMT_DIA_CORTO.format(ms))} · ${textoHora(ms)}`;
/** «sábado 6 de junio de 2026, 20:00» */
export const textoFechaLarga = (ms: number) => `${limpiar(FMT_DIA_LARGO.format(ms))}, ${textoHora(ms)}`;

/** «Hoy», «Mañana» o «sáb 6 jun» (encabezado de un grupo de la cartelera). */
export function etiquetaDia(ms: number, ahora = Date.now()): string {
  const d = (inicioDia(ms) - inicioDia(ahora)) / DIA;
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  return limpiar(FMT_DIA_CORTO.format(ms));
}

/** «sáb 6 jun · 20:00 – 23:00» (o solo el inicio si no hay hora de fin; con otra fecha de fin, la indica). */
export function textoRango(e: Pick<Evento, "inicia" | "termina">): string {
  if (!e.termina) return textoFechaCorta(e.inicia);
  return claveDia(e.termina) === claveDia(e.inicia) ? `${textoFechaCorta(e.inicia)} – ${textoHora(e.termina)}` : `${textoFechaCorta(e.inicia)} → ${textoFechaCorta(e.termina)}`;
}

// ── Cartelera: filtros y agrupación ─────────────────────────────────────────
export type Cuando = "" | "hoy" | "finde" | "semana" | "mes";
export const CUANDO: { id: Exclude<Cuando, "">; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "finde", etiqueta: "Este fin de semana" },
  { id: "semana", etiqueta: "Próximos 7 días" },
  { id: "mes", etiqueta: "Próximos 30 días" },
];

export interface FiltrosEvento {
  categoria: CategoriaEvento | "";
  zona: string;
  cuando: Cuando;
  gratis: boolean;
  q: string;
  pagina: number;
}
export const FILTROS_EVENTO_INICIALES: FiltrosEvento = { categoria: "", zona: "", cuando: "", gratis: false, q: "", pagina: 1 };
export const TAM_PAGINA_EVENTOS = 12;

type Params = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Filtros desde la URL: se ignora lo que no es válido (nada de la URL llega a la base sin pasar por aquí). */
export function filtrosEventoDesdeParams(sp: Params): FiltrosEvento {
  const cat = uno(sp.cat);
  const cuando = uno(sp.cuando);
  const pagina = Number.parseInt(uno(sp.pagina), 10);
  return {
    categoria: esCategoria(cat) ? cat : "",
    zona: uno(sp.zona).trim().slice(0, LIMITES_EVENTO.zonaMax),
    cuando: CUANDO.some((c) => c.id === cuando) ? (cuando as Cuando) : "",
    gratis: uno(sp.gratis) === "1",
    q: uno(sp.q).trim().slice(0, 60),
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 50 ? pagina : 1,
  };
}

export const filtrosEventoActivos = (f: FiltrosEvento) => [f.categoria, f.zona, f.cuando, f.gratis, f.q].filter(Boolean).length;

/** Enlace de la cartelera con estos filtros (y cambios encima). Cualquier cambio vuelve a la página 1, salvo que se indique `pagina`. Los valores por defecto no ensucian la URL. */
export function hrefCartelera(f: FiltrosEvento, cambios: Partial<FiltrosEvento> = {}): string {
  const x = { ...f, pagina: 1, ...cambios };
  const p = new URLSearchParams();
  if (x.categoria) p.set("cat", x.categoria);
  if (x.zona) p.set("zona", x.zona);
  if (x.cuando) p.set("cuando", x.cuando);
  if (x.gratis) p.set("gratis", "1");
  if (x.q) p.set("q", x.q);
  if (x.pagina > 1) p.set("pagina", String(x.pagina));
  const s = p.toString();
  return `/directorio/eventos${s ? `?${s}` : ""}`;
}

/** Ventana de fechas de cada atajo, en instantes. `hasta` excluyente. Todo en hora de Ecuador. */
export function rangoCuando(cuando: Exclude<Cuando, "">, ahora = Date.now()): { desde: number; hasta: number } {
  const hoy = inicioDia(ahora);
  if (cuando === "hoy") return { desde: hoy, hasta: hoy + DIA };
  if (cuando === "semana") return { desde: hoy, hasta: hoy + 7 * DIA };
  if (cuando === "mes") return { desde: hoy, hasta: hoy + 30 * DIA };
  const dow = new Date(hoy - OFFSET_EC).getUTCDay(); // 0 domingo … 6 sábado
  if (dow === 6) return { desde: hoy, hasta: hoy + 2 * DIA };
  if (dow === 0) return { desde: hoy, hasta: hoy + DIA };
  return { desde: hoy + (6 - dow) * DIA, hasta: hoy + (8 - dow) * DIA };
}

/** Patrón seguro para `ilike`: escapa los comodines de LIKE para que «100%» se busque literalmente. */
export const patronBusqueda = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Quita los eventos ya terminados (la base sigue mostrándolos como publicados) y ordena por fecha de inicio. */
export const vigentes = (eventos: Evento[], ahora = Date.now()) => eventos.filter((e) => faseEvento(e, ahora) !== "finalizado" && e.estado === "published").sort((a, b) => a.inicia - b.inicia || a.titulo.localeCompare(b.titulo));

export interface GrupoDia {
  clave: string;
  etiqueta: string;
  eventos: Evento[];
}

/** Agrupa por día (Ecuador) conservando el orden: «Hoy», «Mañana», «sáb 6 jun»… */
export function agruparPorDia(eventos: Evento[], ahora = Date.now()): GrupoDia[] {
  const grupos: GrupoDia[] = [];
  for (const e of eventos) {
    const ref = e.inicia < ahora ? ahora : e.inicia; // un evento en curso se muestra bajo «Hoy»
    const clave = claveDia(ref);
    const g = grupos.find((x) => x.clave === clave);
    if (g) g.eventos.push(e);
    else grupos.push({ clave, etiqueta: etiquetaDia(ref, ahora), eventos: [e] });
  }
  return grupos;
}

// ── Publicar y editar un evento ─────────────────────────────────────────────
export interface BorradorEvento {
  proveedorId: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaEvento | "";
  lugar: string;
  direccion: string;
  zona: string;
  /** Valores de `datetime-local` (hora de Ecuador). */
  inicia: string;
  termina: string;
  gratis: boolean;
  enlaceEntradas: string;
  portada?: string;
}

export const borradorEventoVacio = (proveedorId = ""): BorradorEvento => ({ proveedorId, titulo: "", descripcion: "", categoria: "", lugar: "", direccion: "", zona: "", inicia: "", termina: "", gratis: false, enlaceEntradas: "", portada: undefined });

export const borradorDesdeEvento = (e: Evento): BorradorEvento => ({
  proveedorId: e.proveedorId,
  titulo: e.titulo,
  descripcion: e.descripcion,
  categoria: e.categoria,
  lugar: e.lugar,
  direccion: e.direccion,
  zona: e.zona,
  inicia: valorLocalEcuador(e.inicia),
  termina: e.termina ? valorLocalEcuador(e.termina) : "",
  gratis: e.gratis,
  enlaceEntradas: e.enlaceEntradas ?? "",
  portada: e.portadaUrl,
});

const ENLACE_HTTPS = /^https:\/\/[^ ]+$/i;

/**
 * Reglas iguales a las de la tabla `events` y su disparador. `nuevo` exige fecha futura (en SQL solo se comprueba al crear).
 * Además pide lugar y zona, que la base admite vacíos pero sin los cuales el evento no se puede encontrar.
 */
export function validarEvento(d: BorradorEvento, opciones: { nuevo: boolean; ahora?: number }): Errores {
  const ahora = opciones.ahora ?? Date.now();
  const e: Errores = {};
  if (!d.proveedorId) e.proveedorId = "Elige el perfil de organizador que publica el evento.";
  const titulo = d.titulo.trim();
  if (titulo.length < LIMITES_EVENTO.tituloMin) e.titulo = "Ponle un título al evento (mínimo 5 letras).";
  else if (titulo.length > LIMITES_EVENTO.tituloMax) e.titulo = `El título admite como máximo ${LIMITES_EVENTO.tituloMax} caracteres.`;
  if (d.descripcion.trim().length > LIMITES_EVENTO.descripcionMax) e.descripcion = `La descripción admite como máximo ${LIMITES_EVENTO.descripcionMax} caracteres.`;
  if (!d.categoria || !esCategoria(d.categoria)) e.categoria = "Elige una categoría.";
  if (!d.lugar.trim()) e.lugar = "Indica el lugar (teatro, sala, parque…).";
  else if (d.lugar.trim().length > LIMITES_EVENTO.lugarMax) e.lugar = `El lugar admite como máximo ${LIMITES_EVENTO.lugarMax} caracteres.`;
  if (d.direccion.trim().length > LIMITES_EVENTO.direccionMax) e.direccion = `La dirección admite como máximo ${LIMITES_EVENTO.direccionMax} caracteres.`;
  if (!d.zona.trim()) e.zona = "Elige la zona para que te encuentren.";
  else if (d.zona.trim().length > LIMITES_EVENTO.zonaMax) e.zona = `La zona admite como máximo ${LIMITES_EVENTO.zonaMax} caracteres.`;
  const inicio = instanteEcuador(d.inicia);
  const t0 = inicio ? Date.parse(inicio) : NaN;
  if (Number.isNaN(t0)) e.inicia = "Elige la fecha y la hora de inicio.";
  else if (opciones.nuevo && t0 <= ahora) e.inicia = "La fecha del evento debe ser futura.";
  if (d.termina.trim()) {
    const fin = instanteEcuador(d.termina);
    const t1 = fin ? Date.parse(fin) : NaN;
    if (Number.isNaN(t1)) e.termina = "La hora de fin no es válida.";
    else if (!Number.isNaN(t0) && t1 <= t0) e.termina = "El fin debe ser posterior al inicio.";
  }
  const enlace = d.enlaceEntradas.trim();
  if (enlace && !ENLACE_HTTPS.test(enlace)) e.enlaceEntradas = "El enlace debe empezar por https:// y no llevar espacios.";
  return e;
}

/** Fila para `insert` (solo columnas concedidas a `authenticated`). `portadaUrl` es la URL ya subida. */
export function filaEvento(d: BorradorEvento, portadaUrl: string | null) {
  const inicio = instanteEcuador(d.inicia);
  const fin = d.termina.trim() ? instanteEcuador(d.termina) : null;
  return {
    provider_id: d.proveedorId,
    title: d.titulo.trim(),
    description: d.descripcion.trim(),
    category: d.categoria,
    venue_name: d.lugar.trim(),
    address: d.direccion.trim(),
    zone: d.zona.trim(),
    starts_at: inicio,
    ends_at: fin,
    cover_url: portadaUrl,
    is_free: d.gratis,
    external_ticket_url: d.enlaceEntradas.trim() || null,
  };
}

/** Columnas de `update` (no incluye `provider_id`: un evento no cambia de organizador). */
export function filaActualizacionEvento(d: BorradorEvento, portadaUrl?: string | null) {
  const fila: Partial<ReturnType<typeof filaEvento>> = filaEvento(d, portadaUrl ?? null);
  delete fila.provider_id;
  if (portadaUrl === undefined) delete fila.cover_url; // sin cambio de portada: no se toca la columna
  return fila;
}

// ── Tipos de entrada ────────────────────────────────────────────────────────
export interface BorradorEntrada {
  nombre: string;
  precio: string;
  cupo: string;
  maxPorPedido: string;
  /** `datetime-local` (hora de Ecuador) o vacío = hasta que empiece el evento. */
  ventaHasta: string;
}

export const entradaVacia = (): BorradorEntrada => ({ nombre: "General", precio: "0", cupo: "50", maxPorPedido: "6", ventaHasta: "" });

export const borradorDesdeEntrada = (t: TipoEntrada): BorradorEntrada => ({
  nombre: t.nombre,
  precio: String(t.precio),
  cupo: String(t.cupo),
  maxPorPedido: String(t.maxPorPedido),
  ventaHasta: t.ventaHasta ? valorLocalEcuador(t.ventaHasta) : "",
});

function decimal(texto: string): number | null {
  const t = texto.trim().replace(",", ".").replace(/^\$/, "");
  return /^\d{1,6}(\.\d{1,2})?$/.test(t) ? Number(t) : null;
}
const entero = (texto: string): number | null => (/^\d{1,6}$/.test(texto.trim()) ? Number(texto.trim()) : null);

/** Reglas iguales a las de `event_ticket_types`. `vendidas` evita bajar el cupo por debajo de lo ya reservado (también lo impide la base). */
export function validarEntrada(d: BorradorEntrada, opciones: { vendidas?: number; iniciaEvento?: number } = {}): Errores {
  const e: Errores = {};
  const nombre = d.nombre.trim();
  if (nombre.length < LIMITES_ENTRADA.nombreMin) e.nombre = "Ponle un nombre (por ejemplo «General» o «VIP»).";
  else if (nombre.length > LIMITES_ENTRADA.nombreMax) e.nombre = `El nombre admite como máximo ${LIMITES_ENTRADA.nombreMax} caracteres.`;
  const precio = decimal(d.precio);
  if (precio === null || precio > LIMITES_ENTRADA.precioMax) e.precio = "Escribe un precio válido en dólares (0 si es gratis).";
  const cupo = entero(d.cupo);
  if (cupo === null || cupo < 1 || cupo > LIMITES_ENTRADA.cupoMax) e.cupo = `El cupo debe estar entre 1 y ${LIMITES_ENTRADA.cupoMax}.`;
  else if (opciones.vendidas !== undefined && cupo < opciones.vendidas) e.cupo = `Ya hay ${opciones.vendidas} reservadas: el cupo no puede ser menor.`;
  const max = entero(d.maxPorPedido);
  if (max === null || max < 1 || max > LIMITES_ENTRADA.porPedidoMax) e.maxPorPedido = `Por persona: entre 1 y ${LIMITES_ENTRADA.porPedidoMax}.`;
  if (d.ventaHasta.trim()) {
    const iso = instanteEcuador(d.ventaHasta);
    if (!iso) e.ventaHasta = "La fecha de cierre de la venta no es válida.";
    else if (opciones.iniciaEvento !== undefined && Date.parse(iso) > opciones.iniciaEvento) e.ventaHasta = "La venta debe cerrar antes de que empiece el evento.";
  }
  return e;
}

/** Fila para `insert`/`update` de `event_ticket_types` (sin `sold`: lo gestiona el servidor). */
export function filaEntrada(d: BorradorEntrada, eventoId?: string) {
  return {
    ...(eventoId ? { event_id: eventoId } : {}),
    name: d.nombre.trim(),
    price: decimal(d.precio) ?? 0,
    quantity: entero(d.cupo) ?? 1,
    max_per_order: entero(d.maxPorPedido) ?? 6,
    sales_end: d.ventaHasta.trim() ? instanteEcuador(d.ventaHasta) : null,
  };
}

/** Un evento de pago necesita al menos un tipo de entrada o un enlace de venta; uno gratuito puede ser de entrada libre. */
export function validarVenta(gratis: boolean, enlace: string, tipos: number): string | null {
  if (gratis || tipos > 0 || enlace.trim()) return null;
  return "Agrega al menos un tipo de entrada, o el enlace donde se venden, o marca «entrada libre».";
}

// ── Reservas, asistentes y puerta ───────────────────────────────────────────
export const ETIQUETA_RESERVA: Record<EstadoReserva, { etiqueta: string; clase: string }> = {
  reserved: { etiqueta: "Reservada", clase: "bg-emerald-50 text-emerald-700" },
  checked_in: { etiqueta: "Ya ingresó", clase: "bg-sky-50 text-sky-800" },
  cancelled: { etiqueta: "Cancelada", clase: "bg-slate-100 text-slate-600" },
};

/** Las claves de una entrada son 10 caracteres hexadecimales en mayúsculas (`upper(substr(md5(...), 1, 10))` en SQL). */
export const CODIGO_ENTRADA = /^[0-9A-F]{10}$/;
export const normalizarCodigo = (texto: string) => texto.replace(/[\s-]/g, "").toUpperCase();
export const codigoValido = (texto: string) => CODIGO_ENTRADA.test(normalizarCodigo(texto));
/** «A1B2C-3D4E5»: más fácil de leer y dictar en la puerta. */
export const codigoLegible = (codigo: string) => (codigo.length === 10 ? `${codigo.slice(0, 5)}-${codigo.slice(5)}` : codigo);

/** Lo que codifica el QR de una entrada: solo el código (el organizador lo escanea o lo escribe en «Control de acceso»). */
export const contenidoQR = (codigo: string) => codigo;

/** Una reserva vigente todavía se puede cancelar mientras el evento no haya empezado (la base solo exige que siga «reservada»). */
export const puedeCancelarReserva = (r: Pick<Reserva, "estado">, e: Pick<Evento, "inicia" | "termina" | "estado">, ahora = Date.now()) => r.estado === "reserved" && faseEvento(e, ahora) === "proximo";

export interface ResumenAsistentes {
  reservadas: number;
  ingresaron: number;
  pendientes: number;
  ingresos: number;
}

/** Totales de entradas (no de personas ni de reservas) y lo que se recaudará en la puerta. Las canceladas no cuentan. */
export function resumenAsistentes(reservas: Pick<Reserva, "estado" | "cantidad" | "total">[]): ResumenAsistentes {
  let reservadas = 0;
  let ingresaron = 0;
  let centavos = 0;
  for (const r of reservas) {
    if (r.estado === "cancelled") continue;
    reservadas += r.cantidad;
    centavos += Math.round(r.total * 100);
    if (r.estado === "checked_in") ingresaron += r.cantidad;
  }
  return { reservadas, ingresaron, pendientes: reservadas - ingresaron, ingresos: centavos / 100 };
}

/** Ocupación de un tipo de entrada, 0-100. */
export const ocupacion = (t: Pick<TipoEntrada, "cupo" | "vendidas">) => (t.cupo > 0 ? Math.min(100, Math.round((t.vendidas / t.cupo) * 100)) : 0);

/** Mensaje claro para los errores de las funciones de eventos y entradas. */
export function mensajeErrorEventos(mensaje: string): string {
  if (/agotadas, venta cerrada|cantidad no permitida/.test(mensaje)) return "Ya no quedan entradas o se cerró la venta. Actualiza la pantalla.";
  if (/Ya tienes una reserva/.test(mensaje)) return "Ya tienes una reserva de esta entrada. Cancélala desde «Mis entradas» si quieres cambiarla.";
  if (/propio evento/.test(mensaje)) return "No puedes reservar entradas de tu propio evento.";
  if (/entre 1 y 20/.test(mensaje)) return "Elige entre 1 y 20 entradas.";
  if (/No se puede cancelar esa reserva/.test(mensaje)) return "Esa reserva ya no se puede cancelar. Actualiza la pantalla.";
  if (/No se puede cancelar ese evento/.test(mensaje)) return "Ese evento ya no se puede cancelar. Actualiza la pantalla.";
  if (/Código no válido/.test(mensaje)) return "Ese código no corresponde a ninguno de tus eventos.";
  if (/ya fue usada/.test(mensaje)) return "Esta entrada ya fue usada.";
  if (/reserva fue cancelada/.test(mensaje)) return "Esta reserva fue cancelada.";
  if (/máximo 30 eventos futuros/.test(mensaje)) return "Ya tienes 30 eventos próximos publicados. Cancela o espera a que pase alguno.";
  if (/fecha del evento debe ser futura/.test(mensaje)) return "La fecha del evento debe ser futura.";
  if (/Solo un perfil de la sección Eventos/.test(mensaje)) return "Solo un perfil de la sección Eventos puede publicar eventos.";
  if (/permission denied|No autenticado|JWT/.test(mensaje)) return "Tu sesión caducó. Inicia sesión otra vez.";
  return mensaje;
}

// ── Datos estructurados (Google «Evento») ───────────────────────────────────
/**
 * JSON-LD de un evento para el buscador. La dirección del local sí es pública (es lo que se anuncia); no se incluye ningún dato de
 * asistentes ni contacto privado del organizador.
 */
export function jsonLdEvento(e: Evento, organizador: Pick<Proveedor, "nombre">, tipos: TipoEntrada[], url: string, urlOrganizador: string, ahora = Date.now()): Record<string, unknown> {
  const ofertas = tipos.map((t) => ({
    "@type": "Offer",
    name: t.nombre,
    price: t.precio.toFixed(2),
    priceCurrency: "USD",
    url,
    availability: estadoVenta(t, e, ahora).estado === "agotada" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    ...(t.ventaHasta ? { validThrough: new Date(t.ventaHasta).toISOString() } : {}),
  }));
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.titulo,
    startDate: new Date(e.inicia).toISOString(),
    ...(e.termina ? { endDate: new Date(e.termina).toISOString() } : {}),
    eventStatus: e.estado === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(e.descripcion ? { description: e.descripcion } : {}),
    ...(e.portadaUrl ? { image: [e.portadaUrl] } : {}),
    location: {
      "@type": "Place",
      name: e.lugar || "Cuenca",
      address: { "@type": "PostalAddress", addressLocality: "Cuenca", addressCountry: "EC", ...(e.direccion ? { streetAddress: e.direccion } : {}), ...(e.zona ? { addressRegion: e.zona } : {}) },
    },
    organizer: { "@type": "Organization", name: organizador.nombre, url: urlOrganizador },
    ...(ofertas.length > 0 ? { offers: ofertas } : e.gratis ? { isAccessibleForFree: true } : {}),
    url,
  };
}
