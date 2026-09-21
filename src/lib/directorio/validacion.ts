import { CANALES, DIAS, VERTICAL_POR_ID, horarioValido, type CanalId, type Horario, type VerticalId } from "@/data/directorio";
import { telefonoValido } from "@/lib/directorio/contacto";
import type { ContactoProveedor, Proveedor } from "@/types/directorio";

/** Límites iguales a los de la base de datos (supabase/update_006_directorios.sql). */
export const LIMITES = {
  nombreMin: 3,
  nombreMax: 80,
  descripcionMax: 1000,
  zonaMax: 80,
  direccionMax: 160,
  itemNombreMin: 2,
  itemNombreMax: 100,
  itemDescripcionMax: 400,
  seccionMax: 60,
  itemsMax: 200,
  /** Elementos que se piden en el asistente de alta (el resto se añade después desde el panel). */
  itemsAlta: 40,
  /** numeric(10,2) y numeric(8,2) */
  precioMax: 99_999_999.99,
  envioMax: 999_999.99,
} as const;

export interface BorradorItem {
  seccion: string;
  nombre: string;
  descripcion: string;
  /** Texto del campo: admite «1,5» y «1.50». */
  precio: string;
  receta: boolean;
}

/** Estado completo del asistente de alta (se guarda como borrador mientras se rellena). */
export interface BorradorNegocio {
  vertical: VerticalId | "";
  subtipo: string;
  nombre: string;
  descripcion: string;
  zona: string;
  canales: CanalId[];
  costoEnvio: string;
  pedidoMinimo: string;
  telefono: string;
  whatsapp: string;
  direccion: string;
  horario: Horario;
  abierto24h: boolean;
  /** Dónde está el negocio (código de país y ciudad). Por defecto Ecuador / Cuenca. */
  pais: string;
  ciudad: string;
  /** Coordenadas del local (3 decimales ≈ 110 m; un negocio es un lugar público). Opcionales: sin ellas no sale en «cerca de mí». */
  lat?: number;
  lng?: number;
  logo?: string;
  portada?: string;
  items: BorradorItem[];
}

export const itemVacio = (seccion = ""): BorradorItem => ({ seccion, nombre: "", descripcion: "", precio: "", receta: false });

export const borradorVacio = (): BorradorNegocio => ({
  vertical: "",
  subtipo: "",
  nombre: "",
  descripcion: "",
  zona: "",
  canales: [],
  costoEnvio: "",
  pedidoMinimo: "",
  telefono: "",
  whatsapp: "",
  direccion: "",
  horario: {},
  abierto24h: false,
  pais: "EC",
  ciudad: "Cuenca",
  items: [],
});

export type Errores = Record<string, string>;

/** «1,5» → 1.5 · «2» → 2 · «» o «abc» o negativo → null. */
export function numeroDecimal(texto: string): number | null {
  const t = texto.trim().replace(/^\$\s*/, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

const CANALES_VALIDOS = new Set<string>(CANALES.map((c) => c.id));

export function validarPasoSeccion(b: BorradorNegocio): Errores {
  const e: Errores = {};
  const v = b.vertical ? VERTICAL_POR_ID[b.vertical] : undefined;
  if (!v) e.vertical = "Elige en qué sección quieres aparecer.";
  else if (!v.subtipos.some((s) => s.id === b.subtipo)) e.subtipo = "Elige qué tipo de negocio eres.";
  return e;
}

export function validarPasoDatos(b: BorradorNegocio): Errores {
  const e: Errores = {};
  const nombre = b.nombre.trim();
  if (nombre.length < LIMITES.nombreMin) e.nombre = `Escribe el nombre de tu negocio (mínimo ${LIMITES.nombreMin} letras).`;
  else if (nombre.length > LIMITES.nombreMax) e.nombre = `El nombre admite como máximo ${LIMITES.nombreMax} caracteres.`;
  if (b.descripcion.trim().length > LIMITES.descripcionMax) e.descripcion = `Máximo ${LIMITES.descripcionMax} caracteres.`;
  const zona = b.zona.trim();
  if (!zona) e.zona = "Indica la zona o barrio donde atiendes.";
  else if (zona.length > LIMITES.zonaMax) e.zona = `Máximo ${LIMITES.zonaMax} caracteres.`;
  if (b.canales.length === 0) e.canales = "Marca al menos una forma de atender.";
  else if (b.canales.some((c) => !CANALES_VALIDOS.has(c))) e.canales = "Hay una forma de atender que no es válida.";
  if (b.canales.includes("entrega")) {
    const fuera = (t: string) => {
      const n = numeroDecimal(t);
      return n === null || n > LIMITES.envioMax;
    };
    if (b.costoEnvio.trim() && fuera(b.costoEnvio)) e.costoEnvio = "Escribe un costo de envío válido (por ejemplo 1.50).";
    if (b.pedidoMinimo.trim() && fuera(b.pedidoMinimo)) e.pedidoMinimo = "Escribe un pedido mínimo válido (por ejemplo 5).";
  }
  return e;
}

export function validarPasoContacto(b: BorradorNegocio): Errores {
  const e: Errores = {};
  const tel = b.telefono.trim();
  const wa = b.whatsapp.trim();
  if (!tel && !wa) e.contacto = "Indica un WhatsApp o un teléfono para que te contacten.";
  if (wa && !telefonoValido(wa)) e.whatsapp = "Escribe un número válido (por ejemplo 099 123 4567).";
  if (tel && !telefonoValido(tel)) e.telefono = "Escribe un número válido (por ejemplo 07 234 5678).";
  const dir = b.direccion.trim();
  if (dir.length > LIMITES.direccionMax) e.direccion = `Máximo ${LIMITES.direccionMax} caracteres.`;
  else if (b.canales.includes("local") && dir.length < 5) e.direccion = "Como atiendes en local, escribe la dirección para que te encuentren.";
  return e;
}

export function validarPasoHorario(b: BorradorNegocio): Errores {
  const e: Errores = {};
  if (!b.abierto24h) {
    if (!horarioValido(b.horario)) e.horario = "Revisa el horario: la hora de apertura debe ser anterior a la de cierre.";
    else if (DIAS.every((d) => (b.horario[d] ?? []).length === 0)) e.horario = "Indica cuándo atiendes o marca «24 horas».";
  }
  return e;
}

export function validarItem(i: BorradorItem, vertical: VerticalId | ""): Errores {
  const e: Errores = {};
  const nombre = i.nombre.trim();
  if (nombre.length < LIMITES.itemNombreMin || nombre.length > LIMITES.itemNombreMax) e.nombre = `El nombre debe tener entre ${LIMITES.itemNombreMin} y ${LIMITES.itemNombreMax} caracteres.`;
  const precio = numeroDecimal(i.precio);
  if (precio === null) e.precio = "Escribe el precio (por ejemplo 2.50).";
  else if (precio > LIMITES.precioMax) e.precio = "El precio es demasiado alto.";
  if (i.descripcion.trim().length > LIMITES.itemDescripcionMax) e.descripcion = `Máximo ${LIMITES.itemDescripcionMax} caracteres.`;
  if (i.seccion.trim().length > LIMITES.seccionMax) e.seccion = `Máximo ${LIMITES.seccionMax} caracteres.`;
  if (i.receta && vertical !== "salud") e.receta = "Solo los productos de salud pueden requerir receta.";
  return e;
}

/** Valida el catálogo del asistente. Las filas totalmente vacías se ignoran (no son error). */
export function validarPasoCatalogo(b: BorradorNegocio): Errores {
  const e: Errores = {};
  const llenas = b.items.map((i, idx) => ({ i, idx })).filter(({ i }) => i.nombre.trim() || i.precio.trim() || i.descripcion.trim());
  if (llenas.length > LIMITES.itemsAlta) e.items = `En este paso puedes cargar hasta ${LIMITES.itemsAlta}; el resto lo añades después desde tu panel.`;
  for (const { i, idx } of llenas) for (const [campo, msg] of Object.entries(validarItem(i, b.vertical))) e[`items.${idx}.${campo}`] = msg;
  return e;
}

export function validarBorrador(b: BorradorNegocio): Errores {
  return { ...validarPasoSeccion(b), ...validarPasoDatos(b), ...validarPasoContacto(b), ...validarPasoHorario(b), ...validarPasoCatalogo(b) };
}

/** Ordena los tramos y descarta días sin horario (para guardar un JSON limpio). */
export function horarioLimpio(h: Horario): Horario {
  const salida: Horario = {};
  for (const d of DIAS) {
    const tramos = (h[d] ?? []).filter(([a, c]) => a && c).map(([a, c]) => [a, c] as [string, string]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
    if (tramos.length > 0) salida[d] = tramos;
  }
  return salida;
}

// ── De borrador a filas de la base de datos ─────────────────────────────────
// Solo llevan columnas que `authenticated` puede insertar (ver los `grant insert (...)` de la actualización 006).

export function filaProveedor(b: BorradorNegocio, uid: string, imagenes: { logoUrl?: string | null; portadaUrl?: string | null } = {}) {
  const entrega = b.canales.includes("entrega");
  return {
    owner_id: uid,
    vertical: b.vertical,
    subtype: b.subtipo,
    name: b.nombre.trim(),
    description: b.descripcion.trim(),
    city: b.ciudad.trim() || "Cuenca",
    country: b.pais || "EC",
    ...(b.lat !== undefined && b.lng !== undefined ? { lat: b.lat, lng: b.lng } : {}),
    zone: b.zona.trim(),
    channels: b.canales,
    open_24h: b.abierto24h,
    hours: b.abierto24h ? {} : horarioLimpio(b.horario),
    delivery_fee: entrega ? (numeroDecimal(b.costoEnvio) ?? 0) : 0,
    min_order: entrega ? (numeroDecimal(b.pedidoMinimo) ?? 0) : 0,
    logo_url: imagenes.logoUrl ?? null,
    cover_url: imagenes.portadaUrl ?? null,
  };
}

/** Convierte un negocio ya publicado en un borrador editable (el catálogo se gestiona aparte, elemento a elemento). */
export function borradorDesdeProveedor(p: Proveedor, contacto: ContactoProveedor | null): BorradorNegocio {
  const texto = (n: number) => (n > 0 ? String(n) : "");
  return {
    vertical: p.vertical,
    subtipo: p.subtipo,
    nombre: p.nombre,
    descripcion: p.descripcion,
    zona: p.zona,
    canales: p.canales,
    costoEnvio: texto(p.costoEnvio),
    pedidoMinimo: texto(p.pedidoMinimo),
    telefono: contacto?.telefono ?? "",
    whatsapp: contacto?.whatsapp ?? "",
    direccion: contacto?.direccion ?? "",
    horario: p.horario,
    abierto24h: p.abierto24h,
    pais: p.pais,
    ciudad: p.ciudad,
    lat: p.lat,
    lng: p.lng,
    logo: p.logoUrl,
    portada: p.portadaUrl,
    items: [],
  };
}

/**
 * Columnas que la persona dueña puede modificar (las de `grant update (...) on public.providers`). No incluye sección ni categoría:
 * cambiar de sección exigiría un perfil nuevo. Las imágenes solo se envían si cambian (undefined = no tocar; null = quitar).
 */
export function filaActualizacion(b: BorradorNegocio, imagenes: { logoUrl?: string | null; portadaUrl?: string | null } = {}) {
  const entrega = b.canales.includes("entrega");
  return {
    name: b.nombre.trim(),
    description: b.descripcion.trim(),
    city: b.ciudad.trim() || "Cuenca",
    country: b.pais || "EC",
    ...(b.lat !== undefined && b.lng !== undefined ? { lat: b.lat, lng: b.lng } : {}),
    zone: b.zona.trim(),
    channels: b.canales,
    open_24h: b.abierto24h,
    hours: b.abierto24h ? {} : horarioLimpio(b.horario),
    delivery_fee: entrega ? (numeroDecimal(b.costoEnvio) ?? 0) : 0,
    min_order: entrega ? (numeroDecimal(b.pedidoMinimo) ?? 0) : 0,
    ...(imagenes.logoUrl !== undefined ? { logo_url: imagenes.logoUrl } : {}),
    ...(imagenes.portadaUrl !== undefined ? { cover_url: imagenes.portadaUrl } : {}),
  };
}

export function filaContacto(b: BorradorNegocio, proveedorId: string) {
  return {
    provider_id: proveedorId,
    phone: b.telefono.trim() || null,
    whatsapp: b.whatsapp.trim() || null,
    address: b.direccion.trim() || null,
  };
}

export function filasItems(b: BorradorNegocio, proveedorId: string) {
  const vertical = b.vertical ? VERTICAL_POR_ID[b.vertical] : undefined;
  const kind = vertical?.plantilla.tipoItem ?? "product";
  return b.items
    .filter((i) => i.nombre.trim())
    .map((i, orden) => ({
      provider_id: proveedorId,
      kind,
      section: i.seccion.trim(),
      name: i.nombre.trim(),
      description: i.descripcion.trim(),
      price: numeroDecimal(i.precio),
      unit: "unidad",
      available: true,
      requires_prescription: i.receta,
      sort_order: orden,
    }));
}
