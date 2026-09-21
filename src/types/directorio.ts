import type { CanalId, Horario, VerticalId } from "@/data/directorio";

/** Tarjeta de un negocio en listados (lo que devuelve `search_providers`). */
export interface ResultadoLista {
  id: string;
  slug: string;
  vertical: VerticalId;
  subtipo: string;
  nombre: string;
  descripcion: string;
  zona: string;
  logoUrl?: string;
  portadaUrl?: string;
  canales: CanalId[];
  abiertoAhora: boolean;
  deTurno: boolean;
  verificado: boolean;
  rating: number;
  resenas: number;
  costoEnvio: number;
  pedidoMinimo: number;
  distanciaKm?: number;
  impulsado: boolean;
}

/** Ficha completa de un negocio (tabla `providers`). */
export interface Proveedor {
  id: string;
  ownerId: string;
  slug: string;
  vertical: VerticalId;
  subtipo: string;
  nombre: string;
  descripcion: string;
  ciudad: string;
  /** Código ISO del país (EC, CO, ES…). */
  pais: string;
  zona: string;
  lat?: number;
  lng?: number;
  logoUrl?: string;
  portadaUrl?: string;
  canales: CanalId[];
  abierto24h: boolean;
  horario: Horario;
  costoEnvio: number;
  pedidoMinimo: number;
  estado: "active" | "paused" | "review" | "suspended";
  verificado: boolean;
  rating: number;
  resenas: number;
  pedidos: number;
  creado: number;
}

export type TipoItem = "menu_item" | "product" | "service" | "rate";

export interface ItemCatalogo {
  id: string;
  proveedorId: string;
  tipo: TipoItem;
  seccion: string;
  nombre: string;
  descripcion: string;
  /** null = «a convenir». */
  precio: number | null;
  precioHasta: number | null;
  unidad: string;
  imagen?: string;
  disponible: boolean;
  /** Medicamento de venta con receta: se muestra pero no se puede pedir por la app. */
  receta: boolean;
  orden: number;
}

export interface TurnoGuardia {
  id: string;
  desde: number;
  hasta: number;
  nota: string;
}

export interface Resena {
  id: string;
  autor: string;
  foto?: string;
  rating: number;
  comentario: string;
  compraVerificada: boolean;
  fecha: number;
}

/** Contacto (solo con sesión). */
export interface ContactoProveedor {
  telefono?: string;
  whatsapp?: string;
  direccion?: string;
}

/** Resultado del buscador universal: un negocio o un producto/plato de un negocio. */
export interface HitBusqueda {
  tipo: "negocio" | "producto";
  proveedorId: string;
  slug: string;
  vertical: VerticalId;
  subtipo: string;
  nombre: string;
  zona: string;
  logoUrl?: string;
  verificado: boolean;
  abierto: boolean;
  deTurno: boolean;
  rating: number;
  item?: { nombre: string; precio: number | null; receta: boolean };
}

export interface ConteoSeccion {
  vertical: VerticalId;
  negocios: number;
  verificados: number;
}
