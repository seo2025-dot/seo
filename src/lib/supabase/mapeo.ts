import type { Propiedad, TipoPropiedad } from "@/types/propiedad";
import type { CategoriaServicio, Demanda, Gig, Negocio, Notificacion, Vacante, Vehiculo } from "@/types/mercado";
import type {
  BadgeId,
  Comentario,
  Conversacion,
  Interes,
  Mensaje,
  Post,
  Signo,
  Solicitud,
  TipoConversacion,
  TipoRelacion,
  Usuario,
} from "@/types/social";
import type {
  AmistadFila,
  ChatResumenFila,
  ComentarioFila,
  JobFila,
  LikeFila,
  ListingFila,
  MensajeFila,
  NotificacionFila,
  PerfilFila,
  PostFila,
} from "@/lib/supabase/filas";

/**
 * La interfaz usa el id especial "yo" para el usuario actual (así las pantallas no necesitan conocer su uuid).
 * Estas funciones traducen uuid ↔ "yo" en ambos sentidos.
 */
export const aIdApp = (id: string, yo: string | null) => (yo && id === yo ? "yo" : id);
export const aIdDb = (id: string, yo: string | null) => (id === "yo" && yo ? yo : id);

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
const ms = (iso: string) => new Date(iso).getTime();
const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - ms(iso)) / 86_400_000));
const texto = (v: unknown) => (typeof v === "string" ? v : "");
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Imagen de reserva para publicaciones sin fotos (evita <Image src="">). */
export const IMAGEN_VACIA =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#e2e8f0"/><text x="400" y="310" font-family="sans-serif" font-size="28" fill="#94a3b8" text-anchor="middle">Sin foto</text></svg>',
  );

// ── Perfiles ────────────────────────────────────────────────────────────────
export function mapearPerfil(p: PerfilFila, yo: string | null, nacimiento?: string | null): Usuario {
  const prof = p.professional;
  return {
    id: aIdApp(p.id, yo),
    nombre: p.display_name,
    usuario: p.handle ?? "",
    bio: p.bio,
    ubicacion: p.location,
    intereses: p.interests as Interes[],
    zonas: p.zones,
    badges: p.badges as BadgeId[],
    verificaciones: { identidad: p.identity_verified, telefono: p.phone_verified, email: p.email_verified },
    rating: Number(p.rating),
    resenas: p.reviews_count,
    respuesta: p.response_rate,
    miembroDesde: new Date(p.created_at).getFullYear(),
    presupuesto: p.budget ?? undefined,
    foto: p.avatar_url ?? undefined,
    confianza: p.trust_score,
    onboardingCompleto: p.onboarding_completed,
    demo: p.is_demo,
    signo: (p.sign as Signo | null) ?? undefined,
    nacimiento: nacimiento ?? undefined,
    edad: p.age ?? undefined,
    relaciones: p.relations as TipoRelacion[],
    estilo: p.lifestyle,
    profesional: prof
      ? { titular: prof.headline ?? "", skills: prof.skills ?? [], portafolio: prof.portfolio ?? [] }
      : undefined,
  };
}

/** Perfil provisional del visitante sin sesión / mientras carga. */
export const PERFIL_INVITADO: Usuario = {
  id: "yo",
  nombre: "Invitado",
  usuario: "",
  bio: "Inicia sesión para publicar, guardar y conectar con la comunidad.",
  ubicacion: "",
  intereses: [],
  zonas: [],
  badges: [],
  verificaciones: { identidad: false, telefono: false, email: false },
  rating: 0,
  resenas: 0,
  respuesta: 100,
  miembroDesde: new Date().getFullYear(),
};

// ── Anuncios ────────────────────────────────────────────────────────────────
export interface AnunciosMapeados {
  propiedades: Propiedad[];
  vehiculos: Vehiculo[];
  negocios: Negocio[];
  demandas: Demanda[];
  boosts: Record<string, number>;
}

export function mapearListings(filas: ListingFila[], yo: string | null): AnunciosMapeados {
  const out: AnunciosMapeados = { propiedades: [], vehiculos: [], negocios: [], demandas: [], boosts: {} };
  const ahora = Date.now();

  for (const l of filas) {
    const dueno = aIdApp(l.owner_id, yo);
    const imagenes = l.images ?? [];
    const relampago = l.flash_discount && l.flash_until && ms(l.flash_until) > ahora ? l.flash_discount : undefined;
    if (l.boosted_until && ms(l.boosted_until) > ahora) out.boosts[l.id] = ms(l.boosted_until);
    const a = l.attrs ?? {};
    const relampagoHasta = relampago && l.flash_until ? ms(l.flash_until) : undefined;

    if (l.kind === "demand") {
      out.demandas.push({
        id: l.id,
        autorId: dueno,
        categoria: l.category === "vehicle" ? "vehiculo" : "inmueble",
        operacion: l.operation === "sale" ? "comprar" : "alquilar",
        tipo: l.subtype,
        zona: l.zone,
        presupuestoMax: num(l.budget_max),
        moneda: l.currency,
        superficieMin: l.min_area ? num(l.min_area) : undefined,
        nota: l.description,
        ts: ms(l.created_at),
      });
      continue;
    }

    const operacion = l.operation === "sale" ? "venta" : "alquiler";
    if (l.category === "property") {
      out.propiedades.push({
        id: l.id,
        titulo: l.title,
        descripcion: l.description,
        tipo: l.subtype as TipoPropiedad,
        operacion,
        precio: num(l.price),
        moneda: l.currency,
        ubicacion: l.zone,
        dormitorios: Number(a.bedrooms ?? 0),
        banos: Number(a.bathrooms ?? 0),
        superficie: num(l.area),
        imagen: imagenes[0] ?? IMAGEN_VACIA,
        galeria: imagenes.slice(1),
        comodidades: lista(a.amenities),
        duenoId: dueno,
        publicadaHace: diasDesde(l.created_at),
        guardados: 0,
        relampago,
        relampagoHasta,
      });
    } else if (l.category === "vehicle") {
      out.vehiculos.push({
        id: l.id,
        titulo: l.title,
        descripcion: l.description,
        categoria: l.subtype as Vehiculo["categoria"],
        marca: texto(a.brand),
        modelo: texto(a.model),
        anio: Number(a.year ?? 0),
        km: Number(a.km ?? 0),
        operacion,
        precio: num(l.price),
        moneda: l.currency,
        ubicacion: l.zone,
        imagen: imagenes[0] ?? IMAGEN_VACIA,
        extras: lista(a.extras),
        duenoId: dueno,
        publicadaHace: diasDesde(l.created_at),
        guardados: 0,
        relampago,
        relampagoHasta,
      });
    } else {
      out.negocios.push({
        id: l.id,
        titulo: l.title,
        descripcion: l.description,
        rubro: l.subtype,
        inversion: num(l.price),
        moneda: l.currency,
        retorno: texto(a.return),
        ubicacion: l.zone,
        imagen: imagenes[0] ?? IMAGEN_VACIA,
        duenoId: dueno,
        publicadaHace: diasDesde(l.created_at),
        guardados: 0,
      });
    }
  }
  return out;
}

// ── Servicios y empleos ─────────────────────────────────────────────────────
export function mapearJobs(filas: JobFila[], yo: string | null): { gigs: Gig[]; vacantes: Vacante[] } {
  const gigs: Gig[] = [];
  const vacantes: Vacante[] = [];
  for (const j of filas) {
    if (j.kind === "gig") {
      gigs.push({
        id: j.id,
        autorId: aIdApp(j.owner_id, yo),
        titulo: j.title,
        categoria: (j.category ?? "diseno") as CategoriaServicio,
        descripcion: j.description,
        precioDesde: num(j.price_from),
        moneda: j.currency,
        entregaDias: j.delivery_days ?? 1,
        imagen: j.image_url ?? IMAGEN_VACIA,
        ventas: j.sales_count,
      });
    } else {
      vacantes.push({
        id: j.id,
        autorId: aIdApp(j.owner_id, yo),
        titulo: j.title,
        tipo: (j.job_type ?? "contrato") as Vacante["tipo"],
        modalidad: (j.modality ?? "remoto") as Vacante["modalidad"],
        ubicacion: j.location,
        presupuesto: j.budget_text ?? "",
        skills: j.skills,
        descripcion: j.description,
        ts: ms(j.created_at),
      });
    }
  }
  return { gigs, vacantes };
}

// ── Comunidad ───────────────────────────────────────────────────────────────
export function mapearPosts(posts: PostFila[], likes: LikeFila[], comentarios: ComentarioFila[], yo: string | null): Post[] {
  return posts.map((p) => ({
    id: p.id,
    autorId: aIdApp(p.author_id, yo),
    tipo: p.kind,
    texto: p.body,
    zona: p.zone ?? undefined,
    imagen: p.image_url ?? undefined,
    ts: ms(p.created_at),
    likes: likes.filter((l) => l.post_id === p.id).map((l) => aIdApp(l.user_id, yo)),
    comentarios: comentarios
      .filter((c) => c.post_id === p.id)
      .map<Comentario>((c) => ({ id: c.id, autorId: aIdApp(c.author_id, yo), texto: c.body, ts: ms(c.created_at) }))
      .sort((a, b) => a.ts - b.ts),
  }));
}

// ── Mensajería ──────────────────────────────────────────────────────────────
export function mapearMensaje(m: MensajeFila, yo: string | null): Mensaje {
  const estado = m.status === "pending" ? "pendiente" : m.status === "accepted" ? "aceptada" : m.status === "rejected" ? "rechazada" : undefined;
  return {
    id: m.id,
    autor: m.sender_id === null ? "sistema" : m.sender_id === yo ? "yo" : "otro",
    texto: m.body,
    ts: ms(m.created_at),
    tipo: m.kind === "offer" ? "oferta" : m.kind === "quote" ? "cotizacion" : undefined,
    monto: m.amount !== null ? Number(m.amount) : undefined,
    moneda: m.currency ?? undefined,
    dias: m.days ?? undefined,
    estado,
  };
}

/** `categoriaDe` resuelve el tipo de anuncio (propiedad/vehículo/negocio) a partir del id del listing. */
export function mapearChat(
  c: ChatResumenFila,
  yo: string | null,
  categoriaDe: (listingId: string) => "propiedad" | "vehiculo" | "negocio" | undefined,
  previos?: Conversacion,
): Conversacion {
  const tipo: TipoConversacion =
    c.kind === "direct" ? "directo" : c.kind === "gig" ? "servicio" : c.kind === "job" ? "empleo" : categoriaDe(c.listing_id ?? "") ?? "propiedad";
  const ultimo = c.last_message ? mapearMensaje(c.last_message, yo) : undefined;
  // Conserva el historial ya cargado si es más completo que el último mensaje.
  const mensajes = previos && previos.mensajes.length > 1 ? previos.mensajes : ultimo ? [ultimo] : [];
  return {
    id: c.id,
    tipo,
    usuarioId: c.other_id ? aIdApp(c.other_id, yo) : "",
    refId: c.listing_id ?? c.job_id ?? undefined,
    origen: c.origin ?? undefined,
    mensajes,
    noLeidos: c.unread,
    actualizada: ms(c.last_message_at),
  };
}

// ── Notificaciones y amistades ──────────────────────────────────────────────
export function mapearNotificacion(n: NotificacionFila): Notificacion {
  return {
    id: n.id,
    tipo: n.type,
    texto: n.body ? `${n.title} — ${n.body}` : n.title,
    href: n.href ?? undefined,
    ts: ms(n.created_at),
    leida: n.read_at !== null,
  };
}

export function mapearSolicitud(a: AmistadFila, yo: string | null): Solicitud {
  return {
    id: a.id,
    deId: aIdApp(a.requester_id, yo),
    paraId: aIdApp(a.addressee_id, yo),
    ts: ms(a.created_at),
    estado: a.status === "accepted" ? "aceptada" : a.status === "rejected" ? "rechazada" : "pendiente",
  };
}
