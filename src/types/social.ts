export type Interes =
  | "roomie"
  | "inversor"
  | "comprador"
  | "amigos"
  | "anfitrion"
  | "inquilino";

export type Signo =
  | "aries"
  | "tauro"
  | "geminis"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "escorpio"
  | "sagitario"
  | "capricornio"
  | "acuario"
  | "piscis";

export type TipoRelacion = "pareja" | "amistad" | "roomie" | "socios";

export type BadgeId =
  | "superhost"
  | "respuesta-rapida"
  | "inversor-pro"
  | "roomie-ideal"
  | "fundador"
  | "vecino-activo"
  | "explorador"
  | "freelancer-top"
  | "guia-astral";

export interface Verificaciones {
  identidad: boolean;
  telefono: boolean;
  email: boolean;
}

export interface Profesional {
  titular: string;
  skills: string[];
  portafolio: string[]; // URLs o data URLs de trabajos
}

export interface Usuario {
  id: string;
  nombre: string;
  usuario: string; // @handle
  bio: string;
  ubicacion: string;
  intereses: Interes[];
  zonas: string[];
  badges: BadgeId[];
  verificaciones: Verificaciones;
  rating: number; // 0 = sin reseñas
  resenas: number;
  respuesta: number; // % tasa de respuesta
  miembroDesde: number; // año
  presupuesto?: string;
  foto?: string; // URL pública (Storage)
  onboardingCompleto?: boolean; 
  demo?: boolean; 
  confianza?: number; // puntaje de confianza P2P calculado por el servidor (0-100)
  // — Citas y astrología —
  signo?: Signo;
  nacimiento?: string; // YYYY-MM-DD (solo perfil propio)
  edad?: number;
  relaciones?: TipoRelacion[];
  estilo?: string[]; // estilo de vida
  // — Freelance —
  profesional?: Profesional;
}

export type TipoPost = "historia" | "consulta" | "propiedad" | "experiencia";

export interface Comentario {
  id: string;
  autorId: string;
  texto: string;
  ts: number;
}

export interface Post {
  id: string;
  autorId: string;
  tipo: TipoPost;
  texto: string;
  zona?: string;
  imagen?: string;
  ts: number;
  likes: string[]; // ids de usuario
  comentarios: Comentario[];
}

export type AutorMensaje = "yo" | "otro" | "sistema";

export interface Mensaje {
  id: string;
  autor: AutorMensaje;
  texto: string;
  ts: number;
  /** Mensajes especiales de negociación P2P y cotización de servicios. */
  tipo?: "oferta" | "cotizacion";
  monto?: number;
  moneda?: string;
  dias?: number; // plazo de entrega (cotización)
  estado?: "pendiente" | "aceptada" | "rechazada" | "contraoferta";
}

export type TipoConversacion =
  | "propiedad"
  | "vehiculo"
  | "negocio"
  | "servicio"
  | "empleo"
  | "directo";

export interface Conversacion {
  id: string; // "p-<id>", "v-<id>", "n-<id>", "s-<id>", "e-<id>" o "d-<usuarioId>"
  tipo: TipoConversacion;
  usuarioId: string; // la otra persona (dueño, freelancer, amigo…)
  refId?: string; // id del anuncio/servicio/vacante
  origen?: "cita" | "match";
  mensajes: Mensaje[];
  noLeidos: number;
  actualizada: number;
}

export interface Solicitud {
  id: string;
  deId: string;
  paraId: string;
  ts: number;
  estado: "pendiente" | "aceptada" | "rechazada";
}
