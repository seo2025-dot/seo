/**
 * Catálogo de los directorios colaborativos (Movilidad, Delivery, Salud, Eventos, Mascotas y Hogar).
 * Las secciones, categorías, canales y estados deben coincidir con supabase/update_006_directorios.sql
 * (`_directory_catalog()`, checks de `providers.channels`, `orders.status`…); hay tests de paridad.
 *
 * Toda la interfaz de los directorios se genera a partir de esta configuración: añadir una sección o una categoría
 * no requiere escribir páginas nuevas.
 */

export type VerticalId = "movilidad" | "delivery" | "salud" | "eventos" | "mascotas" | "hogar";
export type CanalId = "local" | "entrega" | "retiro" | "visita" | "en_linea";
export type EstadoPedido = "placed" | "accepted" | "preparing" | "on_the_way" | "delivered" | "rejected" | "cancelled";

export interface Subtipo {
  id: string;
  etiqueta: string;
  emoji: string;
}

/** Qué módulos transaccionales usa cada sección (decide qué paneles y botones se muestran). */
export interface Capacidades {
  /** Pedidos con carrito (delivery, farmacias, tiendas de mascotas). */
  pedidos: boolean;
  /** «Busco»: la persona pide un servicio y los profesionales ofertan (viajes, encomiendas, reparaciones…). */
  solicitudes: boolean;
  /** Tipo de elementos del catálogo del perfil. */
  catalogo: ("menu_item" | "product" | "service" | "rate")[];
  /** Turnos de guardia o «de turno». */
  turnos: boolean;
  /** Publica eventos con entradas. */
  eventos: boolean;
  /** Exige identidad verificada (KYC) para ofertar: seguridad en viajes y encomiendas. */
  ofertaRequiereKyc: boolean;
}

/** Plantilla de alta de una sección: lo que el asistente propone para que publicar sea rápido. */
export interface PlantillaAlta {
  /** Canales marcados por defecto. */
  canales: CanalId[];
  /** Tipo de elemento del catálogo que se sube primero. */
  tipoItem: "menu_item" | "product" | "service" | "rate";
  /** Cómo se llama en singular / plural (interfaz). */
  item: { singular: string; plural: string };
  /** Secciones del catálogo que se sugieren al escribir el primero. */
  secciones: string[];
  /** Ejemplos de nombre para el campo del catálogo. */
  ejemplos: { nombre: string; precio: string }[];
  /** Preajuste de horario que se propone. */
  horario: string;
  /** Aviso importante de la sección (se muestra en el alta). */
  aviso?: string;
}

export interface Vertical {
  id: VerticalId;
  /** false = la sección existe en la base de datos pero su interfaz llega en otra fase (se muestra como «Muy pronto»). */
  activa: boolean;
  /** Texto de ayuda del buscador de la sección. */
  buscador: string;
  plantilla: PlantillaAlta;
  /** Ruta amigable (alias de /directorio/<id> mediante rewrites de Next). */
  alias: string;
  etiqueta: string;
  emoji: string;
  degradado: string;
  lema: string;
  /** Cómo se llama a quien publica («Conductor o servicio», «Negocio», «Organizador»…). */
  proveedor: string;
  subtipos: Subtipo[];
  capacidades: Capacidades;
}

export const VERTICALES: Vertical[] = [
  {
    id: "movilidad",
    activa: true,
    buscador: "Taxi, encomienda, moto mensajero…",
    plantilla: { canales: ["visita"], tipoItem: "rate", item: { singular: "tarifa", plural: "tarifas" }, secciones: ["Viajes", "Encomiendas"], ejemplos: [{ nombre: "Carrera urbana", precio: "3" }], horario: "24h" },
    alias: "taxis",
    etiqueta: "Taxis y mandados",
    emoji: "🚖",
    degradado: "from-sun to-mango",
    lema: "Viajes y encomiendas express con conductores verificados",
    proveedor: "Conductor o servicio",
    subtipos: [
      { id: "taxi", etiqueta: "Taxi", emoji: "🚕" },
      { id: "viaje_particular", etiqueta: "Viaje particular", emoji: "🚗" },
      { id: "encomienda", etiqueta: "Encomiendas y mandados", emoji: "📦" },
      { id: "moto_mensajero", etiqueta: "Moto mensajero", emoji: "🛵" },
    ],
    capacidades: { pedidos: false, solicitudes: true, catalogo: ["rate"], turnos: false, eventos: false, ofertaRequiereKyc: true },
  },
  {
    id: "delivery",
    activa: true,
    buscador: "Ceviche, pizza, café, almuerzos…",
    plantilla: {
      canales: ["local", "entrega"],
      tipoItem: "menu_item",
      item: { singular: "plato", plural: "platos" },
      secciones: ["Entradas", "Platos fuertes", "Bebidas", "Postres"],
      ejemplos: [{ nombre: "Ceviche mixto", precio: "6.50" }, { nombre: "Jugo de naranjilla", precio: "2" }, { nombre: "Almuerzo del día", precio: "3.50" }],
      horario: "restaurante",
    },
    alias: "delivery",
    etiqueta: "Delivery",
    emoji: "🍔",
    degradado: "from-flame to-brand-500",
    lema: "Comida a domicilio de los negocios de tu barrio",
    proveedor: "Negocio",
    subtipos: [
      { id: "restaurante", etiqueta: "Restaurante", emoji: "🍽️" },
      { id: "cafeteria", etiqueta: "Cafetería", emoji: "☕" },
      { id: "panaderia", etiqueta: "Panadería", emoji: "🥖" },
      { id: "mercado", etiqueta: "Mercado y tienda", emoji: "🛒" },
      { id: "comida_rapida", etiqueta: "Comida rápida", emoji: "🍟" },
    ],
    capacidades: { pedidos: true, solicitudes: false, catalogo: ["menu_item", "product"], turnos: false, eventos: false, ofertaRequiereKyc: false },
  },
  {
    id: "salud",
    activa: true,
    buscador: "Paracetamol, farmacia de turno, laboratorio…",
    plantilla: {
      canales: ["local", "entrega"],
      tipoItem: "product",
      item: { singular: "producto", plural: "productos" },
      secciones: ["Analgésicos", "Vitaminas", "Cuidado personal", "Bebés", "Primeros auxilios"],
      ejemplos: [{ nombre: "Paracetamol 500 mg", precio: "1.80" }, { nombre: "Suero oral", precio: "2.50" }, { nombre: "Alcohol antiséptico 250 ml", precio: "1.90" }],
      horario: "farmacia",
      aviso: "Los medicamentos que se venden con receta médica no se pueden pedir por la app: márcalos como «con receta» para que se muestren solo como información.",
    },
    alias: "farmacias",
    etiqueta: "Farmacias y salud",
    emoji: "💊",
    degradado: "from-aqua to-cyan-700",
    lema: "Farmacias de turno, consultorios y entrega a domicilio",
    proveedor: "Establecimiento",
    subtipos: [
      { id: "farmacia", etiqueta: "Farmacia", emoji: "💊" },
      { id: "clinica", etiqueta: "Clínica", emoji: "🏥" },
      { id: "consultorio", etiqueta: "Consultorio", emoji: "🩺" },
      { id: "laboratorio", etiqueta: "Laboratorio", emoji: "🧪" },
      { id: "odontologia", etiqueta: "Odontología", emoji: "🦷" },
    ],
    capacidades: { pedidos: true, solicitudes: false, catalogo: ["product", "service"], turnos: true, eventos: false, ofertaRequiereKyc: false },
  },
  {
    id: "eventos",
    activa: false,
    buscador: "Concierto, teatro, taller…",
    plantilla: { canales: ["local"], tipoItem: "service", item: { singular: "servicio", plural: "servicios" }, secciones: [], ejemplos: [], horario: "lun-vie" },
    alias: "eventos",
    etiqueta: "Eventos y entradas",
    emoji: "🎟️",
    degradado: "from-[#7a3cff] to-[#ff4d9d]",
    lema: "Conciertos, teatro y talleres de tu ciudad",
    proveedor: "Organizador o sala",
    subtipos: [
      { id: "organizador", etiqueta: "Organizador", emoji: "🎤" },
      { id: "teatro", etiqueta: "Teatro", emoji: "🎭" },
      { id: "sala_de_conciertos", etiqueta: "Sala de conciertos", emoji: "🎸" },
      { id: "centro_cultural", etiqueta: "Centro cultural", emoji: "🏛️" },
    ],
    capacidades: { pedidos: false, solicitudes: false, catalogo: [], turnos: false, eventos: true, ofertaRequiereKyc: false },
  },
  {
    id: "mascotas",
    activa: true,
    buscador: "Veterinaria, paseador, alimento…",
    plantilla: { canales: ["local"], tipoItem: "product", item: { singular: "producto", plural: "productos" }, secciones: ["Alimento", "Accesorios", "Salud"], ejemplos: [{ nombre: "Alimento para perro 2 kg", precio: "6" }], horario: "lun-sab" },
    alias: "mascotas",
    etiqueta: "Mascotas",
    emoji: "🐾",
    degradado: "from-[#2fbf71] to-aqua",
    lema: "Veterinarias, paseadores y tiendas para tu mejor amigo",
    proveedor: "Negocio o profesional",
    subtipos: [
      { id: "veterinaria", etiqueta: "Veterinaria", emoji: "🐶" },
      { id: "paseador", etiqueta: "Paseador", emoji: "🦮" },
      { id: "tienda_de_mascotas", etiqueta: "Tienda de mascotas", emoji: "🛍️" },
      { id: "peluqueria_canina", etiqueta: "Peluquería canina", emoji: "✂️" },
      { id: "guarderia", etiqueta: "Guardería", emoji: "🏠" },
    ],
    capacidades: { pedidos: true, solicitudes: true, catalogo: ["product", "service"], turnos: false, eventos: false, ofertaRequiereKyc: false },
  },
  {
    id: "hogar",
    activa: true,
    buscador: "Plomero, electricista, cerrajero…",
    plantilla: { canales: ["visita"], tipoItem: "service", item: { singular: "servicio", plural: "servicios" }, secciones: ["Reparaciones", "Instalaciones"], ejemplos: [{ nombre: "Revisión y presupuesto", precio: "15" }], horario: "lun-sab" },
    alias: "hogar",
    etiqueta: "Servicios del hogar",
    emoji: "🛠️",
    degradado: "from-ink-soft to-ink",
    lema: "Reparaciones express: pide y recibe ofertas",
    proveedor: "Profesional",
    subtipos: [
      { id: "plomero", etiqueta: "Plomero", emoji: "🔧" },
      { id: "electricista", etiqueta: "Electricista", emoji: "💡" },
      { id: "cerrajero", etiqueta: "Cerrajero", emoji: "🔑" },
      { id: "limpieza", etiqueta: "Limpieza", emoji: "🧹" },
      { id: "carpintero", etiqueta: "Carpintero", emoji: "🪚" },
      { id: "pintor", etiqueta: "Pintor", emoji: "🎨" },
      { id: "tecnico_electrodomesticos", etiqueta: "Técnico de electrodomésticos", emoji: "🔌" },
    ],
    capacidades: { pedidos: false, solicitudes: true, catalogo: ["service"], turnos: true, eventos: false, ofertaRequiereKyc: false },
  },
];

export const VERTICALES_ACTIVAS = VERTICALES.filter((v) => v.activa);

export const VERTICAL_POR_ID = Object.fromEntries(VERTICALES.map((v) => [v.id, v])) as Record<VerticalId, Vertical>;
export const VERTICAL_POR_ALIAS = Object.fromEntries(VERTICALES.map((v) => [v.alias, v])) as Record<string, Vertical>;

/** Secciones en las que se puede pedir un servicio y recibir ofertas («Busco»). */
export const VERTICALES_CON_SOLICITUDES = VERTICALES.filter((v) => v.capacidades.solicitudes);

export function etiquetaSubtipo(vertical: VerticalId, subtipo: string): string {
  return VERTICAL_POR_ID[vertical]?.subtipos.find((s) => s.id === subtipo)?.etiqueta ?? subtipo;
}

export const CANALES: { id: CanalId; etiqueta: string; ayuda: string }[] = [
  { id: "local", etiqueta: "Atiende en local", ayuda: "Las personas van a tu establecimiento" },
  { id: "entrega", etiqueta: "Entrega a domicilio", ayuda: "Llevas el pedido al cliente" },
  { id: "retiro", etiqueta: "Retiro en el local", ayuda: "El cliente lo recoge" },
  { id: "visita", etiqueta: "Va donde el cliente", ayuda: "Servicios a domicilio del cliente" },
  { id: "en_linea", etiqueta: "En línea", ayuda: "Atiende por videollamada o chat" },
];

export const DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;
export type DiaId = (typeof DIAS)[number];
export const ETIQUETA_DIA: Record<DiaId, string> = { lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado", dom: "Domingo" };

export const CATEGORIAS_EVENTO = [
  { id: "concierto", etiqueta: "Concierto", emoji: "🎶" },
  { id: "teatro", etiqueta: "Teatro", emoji: "🎭" },
  { id: "taller", etiqueta: "Taller", emoji: "🧑‍🏫" },
  { id: "feria", etiqueta: "Feria", emoji: "🎪" },
  { id: "deporte", etiqueta: "Deporte", emoji: "⚽" },
  { id: "gastronomia", etiqueta: "Gastronomía", emoji: "🍷" },
  { id: "infantil", etiqueta: "Infantil", emoji: "🧸" },
  { id: "cultural", etiqueta: "Cultural", emoji: "🏛️" },
  { id: "otro", etiqueta: "Otro", emoji: "✨" },
] as const;

export const RAZONES_DENUNCIA = [
  { id: "fraude", etiqueta: "Fraude o estafa" },
  { id: "informacion_falsa", etiqueta: "Información falsa" },
  { id: "contenido_inapropiado", etiqueta: "Contenido inapropiado" },
  { id: "peligroso", etiqueta: "Puede poner en riesgo a alguien" },
  { id: "duplicado", etiqueta: "Duplicado" },
  { id: "otro", etiqueta: "Otro motivo" },
] as const;

/** Denuncias de personas distintas que ocultan un contenido hasta que lo revise la moderación. */
export const DENUNCIAS_PARA_OCULTAR = 3;
/** Perfiles que puede tener una misma persona. */
export const MAX_PERFILES_POR_PERSONA = 5;
/** Monedas al publicar el primer perfil del directorio (una sola vez). */
export const MONEDAS_PRIMER_PERFIL = 30;

// ── Pedidos ─────────────────────────────────────────────────────────────────
export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, { etiqueta: string; emoji: string }> = {
  placed: { etiqueta: "Enviado", emoji: "🕐" },
  accepted: { etiqueta: "Aceptado", emoji: "✅" },
  preparing: { etiqueta: "Preparando", emoji: "👨‍🍳" },
  on_the_way: { etiqueta: "En camino", emoji: "🛵" },
  delivered: { etiqueta: "Entregado", emoji: "🎉" },
  rejected: { etiqueta: "Rechazado", emoji: "❌" },
  cancelled: { etiqueta: "Cancelado", emoji: "🚫" },
};

/** Estados a los que puede pasar un pedido según quién lo mueve. Igual que `set_order_status()` en SQL. */
export function transicionesPedido(rol: "negocio" | "cliente", estado: EstadoPedido): EstadoPedido[] {
  if (rol === "cliente") return estado === "placed" ? ["cancelled"] : [];
  switch (estado) {
    case "placed":
      return ["accepted", "rejected"];
    case "accepted":
      return ["preparing", "on_the_way", "rejected"];
    case "preparing":
      return ["on_the_way", "delivered"];
    case "on_the_way":
      return ["delivered"];
    default:
      return [];
  }
}

export const esPedidoAbierto = (estado: EstadoPedido) => !["delivered", "rejected", "cancelled"].includes(estado);

// ── Horarios ────────────────────────────────────────────────────────────────
export type Horario = Partial<Record<DiaId, [string, string][]>>;

const HORA_INICIO = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const HORA_FIN = /^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$/;

/** Mismas reglas que `_valid_hours()`: días válidos, hasta 4 tramos por día, «HH:MM» y apertura < cierre. */
export function horarioValido(h: unknown): h is Horario {
  if (typeof h !== "object" || h === null || Array.isArray(h)) return false;
  for (const [dia, tramos] of Object.entries(h)) {
    if (!(DIAS as readonly string[]).includes(dia) || !Array.isArray(tramos) || tramos.length > 4) return false;
    for (const t of tramos) {
      if (!Array.isArray(t) || t.length !== 2 || typeof t[0] !== "string" || typeof t[1] !== "string") return false;
      if (!HORA_INICIO.test(t[0]) || !HORA_FIN.test(t[1]) || t[0] >= t[1]) return false;
    }
  }
  return true;
}

/** Ecuador continental: UTC-5 todo el año, sin horario de verano. */
const DESFASE_ECUADOR_MS = -5 * 3_600_000;

/** Día de la semana y hora («HH:MM») en Ecuador para un instante. */
export function partesEcuador(ahora: Date): { dia: DiaId; indiceDia: number; hora: string } {
  const local = new Date(ahora.getTime() + DESFASE_ECUADOR_MS);
  const indiceDia = (local.getUTCDay() + 6) % 7; // getUTCDay: 0 = domingo → índice 6
  return {
    dia: DIAS[indiceDia],
    indiceDia,
    hora: `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`,
  };
}

/** ¿Está abierto en ese instante? Misma lógica que `_is_open()`. */
export function estaAbierto(horario: Horario, abierto24h: boolean, ahora: Date = new Date()): boolean {
  if (abierto24h) return true;
  const { dia, hora } = partesEcuador(ahora);
  return (horario[dia] ?? []).some(([desde, hasta]) => hora >= desde && hora < hasta);
}

/** Resumen legible del horario de un día: «08:00–13:00 · 15:00–19:00» o «Cerrado». */
export function textoHorarioDia(horario: Horario, dia: DiaId): string {
  const tramos = horario[dia] ?? [];
  return tramos.length === 0 ? "Cerrado" : tramos.map(([a, b]) => `${a}–${b}`).join(" · ");
}

// ── Rutas ───────────────────────────────────────────────────────────────────
export const rutaVertical = (v: VerticalId) => `/directorio/${v}`;
export const rutaProveedor = (v: VerticalId, slug: string) => `/directorio/${v}/${slug}`;
