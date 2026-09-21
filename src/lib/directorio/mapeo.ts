import { estaAbierto, horarioValido, VERTICAL_POR_ID, type CanalId, type Horario, type VerticalId } from "@/data/directorio";
import { numeroDecimal, type BorradorNegocio } from "@/lib/directorio/validacion";
import type { ConteoSeccion, HitBusqueda, ItemCatalogo, Proveedor, Resena, ResultadoLista, TipoItem, TurnoGuardia } from "@/types/directorio";

// ── Filas tal como las devuelve Supabase ────────────────────────────────────
export interface FilaBusqueda {
  id: string;
  slug: string;
  vertical: string;
  subtype: string;
  name: string;
  description: string;
  zone: string;
  logo_url: string | null;
  cover_url: string | null;
  channels: string[];
  open_now: boolean;
  on_duty: boolean;
  verified: boolean;
  rating: number | string;
  reviews_count: number;
  delivery_fee: number | string;
  min_order: number | string;
  distance_km: number | string | null;
  boosted: boolean;
}

export interface FilaProveedor {
  id: string;
  owner_id: string;
  slug: string;
  vertical: string;
  subtype: string;
  name: string;
  description: string;
  city: string;
  country?: string;
  zone: string;
  lat: number | string | null;
  lng: number | string | null;
  logo_url: string | null;
  cover_url: string | null;
  channels: string[];
  open_24h: boolean;
  hours: unknown;
  delivery_fee: number | string;
  min_order: number | string;
  status: string;
  verified_at: string | null;
  rating: number | string;
  reviews_count: number;
  orders_count: number;
  created_at: string;
}

export interface FilaItem {
  id: string;
  provider_id: string;
  kind: string;
  section: string;
  name: string;
  description: string;
  price: number | string | null;
  price_to: number | string | null;
  unit: string;
  image_url: string | null;
  available: boolean;
  requires_prescription: boolean;
  sort_order: number;
}

export interface FilaTurno {
  id: string;
  starts_at: string;
  ends_at: string;
  note: string;
}

export interface FilaResena {
  id: string;
  rating: number;
  comment: string;
  verified_purchase: boolean;
  created_at: string;
  autor?: { display_name: string; avatar_url: string | null } | null;
}

export interface FilaHit {
  kind: string;
  provider_id: string;
  slug: string;
  vertical: string;
  subtype: string;
  name: string;
  zone: string;
  logo_url: string | null;
  verified: boolean;
  open_now: boolean;
  on_duty: boolean;
  rating: number | string;
  item_name: string | null;
  item_price: number | string | null;
  requires_prescription: boolean | null;
}

const num = (v: number | string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
const numONull = (v: number | string | null | undefined): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const esVertical = (v: string): v is VerticalId => v in VERTICAL_POR_ID;
const canales = (l: string[]) => (l ?? []) as CanalId[];

export function mapearResultado(f: FilaBusqueda): ResultadoLista | null {
  if (!esVertical(f.vertical)) return null;
  return {
    id: f.id,
    slug: f.slug,
    vertical: f.vertical,
    subtipo: f.subtype,
    nombre: f.name,
    descripcion: f.description ?? "",
    zona: f.zone ?? "",
    logoUrl: f.logo_url ?? undefined,
    portadaUrl: f.cover_url ?? undefined,
    canales: canales(f.channels),
    abiertoAhora: f.open_now,
    deTurno: f.on_duty,
    verificado: f.verified,
    rating: num(f.rating),
    resenas: f.reviews_count,
    costoEnvio: num(f.delivery_fee),
    pedidoMinimo: num(f.min_order),
    distanciaKm: numONull(f.distance_km),
    impulsado: f.boosted,
  };
}

export function mapearProveedor(f: FilaProveedor): Proveedor | null {
  if (!esVertical(f.vertical)) return null;
  return {
    id: f.id,
    ownerId: f.owner_id,
    slug: f.slug,
    vertical: f.vertical,
    subtipo: f.subtype,
    nombre: f.name,
    descripcion: f.description ?? "",
    ciudad: f.city,
    pais: f.country ?? "EC",
    zona: f.zone ?? "",
    lat: numONull(f.lat),
    lng: numONull(f.lng),
    logoUrl: f.logo_url ?? undefined,
    portadaUrl: f.cover_url ?? undefined,
    canales: canales(f.channels),
    abierto24h: f.open_24h,
    horario: horarioValido(f.hours) ? (f.hours as Horario) : {},
    costoEnvio: num(f.delivery_fee),
    pedidoMinimo: num(f.min_order),
    estado: f.status as Proveedor["estado"],
    verificado: f.verified_at !== null,
    rating: num(f.rating),
    resenas: f.reviews_count,
    pedidos: f.orders_count,
    creado: new Date(f.created_at).getTime(),
  };
}

export const mapearItem = (f: FilaItem): ItemCatalogo => ({
  id: f.id,
  proveedorId: f.provider_id,
  tipo: f.kind as TipoItem,
  seccion: f.section ?? "",
  nombre: f.name,
  descripcion: f.description ?? "",
  precio: numONull(f.price) ?? null,
  precioHasta: numONull(f.price_to) ?? null,
  unidad: f.unit,
  imagen: f.image_url ?? undefined,
  disponible: f.available,
  receta: f.requires_prescription,
  orden: f.sort_order,
});

export const mapearTurno = (f: FilaTurno): TurnoGuardia => ({ id: f.id, desde: new Date(f.starts_at).getTime(), hasta: new Date(f.ends_at).getTime(), nota: f.note ?? "" });

export const mapearResena = (f: FilaResena): Resena => ({
  id: f.id,
  autor: f.autor?.display_name?.split(" ")[0] || "Una persona",
  foto: f.autor?.avatar_url ?? undefined,
  rating: f.rating,
  comentario: f.comment ?? "",
  compraVerificada: f.verified_purchase,
  fecha: new Date(f.created_at).getTime(),
});

export function mapearHit(f: FilaHit): HitBusqueda | null {
  if (!esVertical(f.vertical)) return null;
  return {
    tipo: f.kind === "item" ? "producto" : "negocio",
    proveedorId: f.provider_id,
    slug: f.slug,
    vertical: f.vertical,
    subtipo: f.subtype,
    nombre: f.name,
    zona: f.zone ?? "",
    logoUrl: f.logo_url ?? undefined,
    verificado: f.verified,
    abierto: f.open_now,
    deTurno: f.on_duty,
    rating: num(f.rating),
    item: f.kind === "item" && f.item_name ? { nombre: f.item_name, precio: numONull(f.item_price) ?? null, receta: f.requires_prescription === true } : undefined,
  };
}

export function mapearConteos(filas: { vertical: string; providers: number; verified: number }[]): ConteoSeccion[] {
  return filas.filter((f) => esVertical(f.vertical)).map((f) => ({ vertical: f.vertical as VerticalId, negocios: f.providers, verificados: f.verified }));
}

// ── Presentación ────────────────────────────────────────────────────────────
/** «$1.80», «Desde $5», «$5 – $8», «A convenir». */
export function textoPrecio(i: Pick<ItemCatalogo, "precio" | "precioHasta">): string {
  const m = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  if (i.precio === null) return "A convenir";
  if (i.precioHasta !== null && i.precioHasta > i.precio) return `${m(i.precio)} – ${m(i.precioHasta)}`;
  return m(i.precio);
}

export const textoDinero = (n: number) => `$${n.toFixed(2)}`;

export interface GrupoCatalogo {
  seccion: string;
  items: ItemCatalogo[];
}

/** Agrupa por sección respetando el orden de aparición; los elementos sin sección van juntos al final. */
export function agruparCatalogo(items: ItemCatalogo[], sinSeccion = "Otros"): GrupoCatalogo[] {
  const ordenados = [...items].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
  const grupos = new Map<string, ItemCatalogo[]>();
  for (const i of ordenados) {
    const clave = i.seccion.trim();
    grupos.set(clave, [...(grupos.get(clave) ?? []), i]);
  }
  const conNombre = [...grupos.entries()].filter(([s]) => s !== "").map(([seccion, lista]) => ({ seccion, items: lista }));
  const sin = grupos.get("");
  return sin ? [...conNombre, { seccion: conNombre.length > 0 ? sinSeccion : "", items: sin }] : conNombre;
}

/** Turnos de hoy y los próximos 7 días (los ya terminados no se muestran), del más próximo al más lejano. */
export function turnosVigentes(turnos: TurnoGuardia[], ahora = Date.now()): TurnoGuardia[] {
  return turnos.filter((t) => t.hasta > ahora && t.desde < ahora + 7 * 86_400_000).sort((a, b) => a.desde - b.desde);
}

export const estaDeTurno = (turnos: TurnoGuardia[], ahora = Date.now()) => turnos.some((t) => t.desde <= ahora && ahora < t.hasta);

// ── Vista previa del alta ───────────────────────────────────────────────────
/** Tarjeta de listado a partir de un borrador (para que la persona vea cómo aparecerá antes de publicar). */
export function vistaPreviaDesdeBorrador(b: BorradorNegocio, ahora = new Date()): ResultadoLista | null {
  if (!b.vertical) return null;
  const numero = (t: string) => numeroDecimal(t) ?? 0;
  return {
    id: "vista-previa",
    slug: "vista-previa",
    vertical: b.vertical,
    subtipo: b.subtipo,
    nombre: b.nombre.trim() || "Nombre de tu negocio",
    descripcion: b.descripcion.trim(),
    zona: b.zona,
    logoUrl: b.logo,
    portadaUrl: b.portada,
    canales: b.canales,
    abiertoAhora: estaAbierto(b.horario, b.abierto24h, ahora),
    deTurno: false,
    verificado: false,
    rating: 0,
    resenas: 0,
    costoEnvio: b.canales.includes("entrega") ? numero(b.costoEnvio) : 0,
    pedidoMinimo: b.canales.includes("entrega") ? numero(b.pedidoMinimo) : 0,
    impulsado: false,
  };
}
