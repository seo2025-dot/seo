"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Propiedad } from "@/types/propiedad";
import type { Anuncio, Demanda, Gig, Negocio, Notificacion, Vacante, Vehiculo } from "@/types/mercado";
import type { Conversacion, Post, Solicitud, TipoPost, Usuario } from "@/types/social";
import { negocioAAnuncio, propiedadAAnuncio, vehiculoAAnuncio } from "@/lib/anuncios";
import { MISIONES } from "@/lib/recompensas";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import type {
  AmistadFila,
  ChatResumenFila,
  ComentarioFila,
  JobFila,
  LikeFila,
  ListingFila,
  MensajeFila,
  MonederoFila,
  NotificacionFila,
  PerfilFila,
  PostFila,
  TarotFila,
} from "@/lib/supabase/filas";
import {
  PERFIL_INVITADO,
  aIdApp,
  aIdDb,
  mapearChat,
  mapearJobs,
  mapearListings,
  mapearMensaje,
  mapearNotificacion,
  mapearPerfil,
  mapearPosts,
  mapearSolicitud,
} from "@/lib/supabase/mapeo";
import { subirKyc, subirMedia, subirVarias } from "@/lib/supabase/subida";

// ───────────────────────────── Tipos públicos ─────────────────────────────

interface TiradaTarot {
  cartas: number[];
  ts: number;
}

/** Vista derivada de los datos de Supabase con la forma que consumen las pantallas. */
export interface Estado {
  yo: Usuario;
  guardadas: string[];
  vistasProp: string[];
  vistasPersonas: string[];
  matchesPersonas: string[];
  amigos: string[];
  solicitudes: Solicitud[];
  conversaciones: Record<string, Conversacion>;
  posts: Post[];
  demandas: Demanda[];
  notificaciones: Notificacion[];
  postulaciones: string[];
  contratados: string[];
  monedas: number;
  ultimoCheckin: string;
  racha: number;
  ultimaRuleta: string;
  superLikes: number;
  tiradasPremium: number;
  boosts: Record<string, number>;
  misiones: string[];
  tarotDia?: TiradaTarot;
  tarotPremium?: TiradaTarot;
  kyc: "ninguno" | "revision" | "verificado" | "rechazado";
}

export type DatosPropiedad = Omit<Propiedad, "id" | "duenoId" | "publicadaHace" | "guardados" | "relampago">;
export type DatosVehiculo = Omit<Vehiculo, "id" | "duenoId" | "publicadaHace" | "guardados" | "relampago">;
export type DatosNegocio = Omit<Negocio, "id" | "duenoId" | "publicadaHace" | "guardados">;
export type DatosDemanda = Omit<Demanda, "id" | "autorId" | "ts">;
export type DatosGig = Omit<Gig, "id" | "autorId" | "ventas">;
export type DatosVacante = Omit<Vacante, "id" | "autorId" | "ts">;
export type DatosPost = { tipo: TipoPost; texto: string; zona?: string; imagen?: string };

export type ResultadoSwipe = { resultado: "match" | "enviado" | "sin-superlikes" | "error"; chatId?: string };

interface Sesion {
  lista: boolean;
  uid: string | null;
  email: string | null;
}

// ───────────────────────────── Datos crudos ─────────────────────────────

interface Crudo {
  perfiles: PerfilFila[];
  listings: ListingFila[];
  jobs: JobFila[];
  posts: PostFila[];
  likes: LikeFila[];
  comentarios: ComentarioFila[];
  conteos: Record<string, number>; // oferta → compradores que la buscan
  // Privados (solo con sesión)
  monedero: MonederoFila | null;
  nacimiento: string | null;
  swipesListing: { listing_id: string; action: "save" | "pass" }[];
  swipesPersona: { to_user: string }[];
  matches: { user_a: string; user_b: string }[];
  amistades: AmistadFila[];
  notificaciones: NotificacionFila[];
  tarot: TarotFila[];
  misiones: string[];
  aplicaciones: { job_id: string; status: string }[];
  chats: ChatResumenFila[];
  mensajes: Record<string, MensajeFila[]>;
  esAdmin: boolean;
}

const PRIVADO_VACIO: Pick<Crudo, "monedero" | "nacimiento" | "swipesListing" | "swipesPersona" | "matches" | "amistades" | "notificaciones" | "tarot" | "misiones" | "aplicaciones" | "chats" | "mensajes" | "esAdmin"> = {
  monedero: null,
  nacimiento: null,
  swipesListing: [],
  swipesPersona: [],
  matches: [],
  amistades: [],
  notificaciones: [],
  tarot: [],
  misiones: [],
  aplicaciones: [],
  chats: [],
  mensajes: {},
  esAdmin: false,
};

const CRUDO_VACIO: Crudo = {
  perfiles: [],
  listings: [],
  jobs: [],
  posts: [],
  likes: [],
  comentarios: [],
  conteos: {},
  ...PRIVADO_VACIO,
};

const upsertId = <T extends { id: string }>(lista: T[], fila: T, alFrente = false): T[] => {
  const i = lista.findIndex((x) => x.id === fila.id);
  if (i === -1) return alFrente ? [fila, ...lista] : [...lista, fila];
  const copia = [...lista];
  copia[i] = fila;
  return copia;
};

const finDelDia = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
};

// ───────────────────────────── Interfaz del contexto ─────────────────────────────

interface SocialContextValue {
  estado: Estado;
  sesion: Sesion;
  esAdmin: boolean;
  hidratado: boolean; // datos públicos cargados
  privadoListo: boolean; // datos privados (chats, monedero…) cargados para el usuario con sesión
  errorDatos: string | null;
  escribiendo: Record<string, boolean>;
  noLeidosTotal: number;
  solicitudesPendientes: number;
  notificacionesSinLeer: number;
  usuarios: Usuario[]; // toda la comunidad (sin el usuario actual)
  todasPropiedades: Propiedad[];
  vehiculos: Vehiculo[];
  negocios: Negocio[];
  anuncios: Anuncio[]; // destacados (boost) primero
  gigs: Gig[];
  vacantes: Vacante[];
  misionesCumplidas: string[];
  obtenerUsuario: (id: string) => Usuario | undefined;
  obtenerPropiedad: (id: string) => Propiedad | undefined;
  obtenerAnuncio: (id: string) => Anuncio | undefined;
  obtenerGig: (id: string) => Gig | undefined;
  obtenerVacante: (id: string) => Vacante | undefined;
  enLinea: (usuarioId: string) => boolean;
  enBoost: (id: string) => boolean;
  compradoresBuscando: (a: Anuncio) => number;
  cidDe: (tipo: "servicio" | "empleo", refId: string) => string | undefined;

  cerrarSesion: () => Promise<void>;

  pasarAnuncio: (id: string) => void;
  alternarGuardada: (id: string) => void;
  conectarAnuncio: (id: string) => Promise<string | null>;
  eliminarAnuncio: (id: string) => Promise<void>;
  publicarPropiedad: (d: DatosPropiedad, relampago?: number) => Promise<string | null>;
  publicarVehiculo: (d: DatosVehiculo, relampago?: number) => Promise<string | null>;
  publicarNegocio: (d: DatosNegocio) => Promise<string | null>;
  publicarDemanda: (d: DatosDemanda) => Promise<number | null>;
  eliminarDemanda: (id: string) => Promise<void>;

  pasarPersona: (id: string) => void;
  likePersona: (id: string, relacion?: string) => Promise<ResultadoSwipe>;
  superLikePersona: (id: string, relacion?: string) => Promise<ResultadoSwipe>;
  solicitarAmistad: (id: string) => Promise<void>;
  responderSolicitud: (id: string, aceptar: boolean) => Promise<void>;
  abrirChatDirecto: (usuarioId: string) => Promise<string | null>;

  cargarChat: (cid: string) => Promise<void>;
  suscribirEscritura: (cid: string) => () => void;
  avisarEscribiendo: (cid: string) => void;
  enviarMensaje: (cid: string, texto: string) => Promise<void>;
  hacerOferta: (cid: string, monto: number) => Promise<void>;
  enviarCotizacion: (cid: string, monto: number, dias: number) => Promise<void>;
  responderOferta: (cid: string, mensajeId: string, aceptar: boolean) => Promise<void>;
  leer: (cid: string) => void;

  contratarServicio: (gigId: string) => Promise<string | null>;
  postularVacante: (vacanteId: string) => Promise<string | null>;
  publicarServicio: (d: DatosGig) => Promise<string | null>;
  publicarVacante: (d: DatosVacante) => Promise<string | null>;

  editarPerfil: (cambios: Partial<Usuario>) => Promise<boolean>;
  publicarPost: (d: DatosPost) => Promise<void>;
  eliminarPost: (id: string) => Promise<void>;
  alternarLikePost: (postId: string) => Promise<void>;
  comentarPost: (postId: string, texto: string) => Promise<void>;
  leerNotificaciones: () => void;

  checkin: () => Promise<number | null>;
  girarRuleta: () => Promise<{ indice: number; monto: number } | null>;
  canjearBoost: (anuncioId: string) => Promise<boolean>;
  canjearSuperLikes: () => Promise<boolean>;
  canjearTirada: () => Promise<boolean>;
  reclamarMision: (id: string) => Promise<void>;

  sacarCartaDelDia: () => Promise<number | null>;
  hacerTiradaPremium: () => Promise<number[] | null>;

  enviarKyc: (documento: File, selfie: File) => Promise<boolean>;
  reiniciar: () => Promise<void>;

  /** Cierra el onboarding: el servidor valida nombre, usuario, fecha de nacimiento y al menos una foto. */
  completarOnboarding: () => Promise<boolean>;
  /** Vuelve a leer tu perfil (p. ej. tras cambiar tus fotos, que actualizan el avatar en el servidor). */
  refrescarPerfil: () => Promise<void>;
}

const SocialContext = createContext<SocialContextValue | null>(null);

// ───────────────────────────── Proveedor ─────────────────────────────

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Sesion>({ lista: false, uid: null, email: null });
  const [crudo, setCrudo] = useState<Crudo>(CRUDO_VACIO);
  const [hidratado, setHidratado] = useState(false);
  const [privadoListo, setPrivadoListo] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enLineaIds, setEnLineaIds] = useState<string[]>([]);
  const [escribiendo, setEscribiendo] = useState<Record<string, boolean>>({});

  const uid = sesion.uid;
  const uidRef = useRef<string | null>(null);
  const crudoRef = useRef(crudo);
  const chatAbierto = useRef<string | null>(null);
  const canalesEscritura = useRef<Map<string, RealtimeChannel>>(new Map());
  const ultimoAvisoEscritura = useRef(0);
  const temporizadoresEscritura = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);
  useEffect(() => {
    crudoRef.current = crudo;
  }, [crudo]);

  const parche = useCallback((f: (prev: Crudo) => Partial<Crudo>) => setCrudo((prev) => ({ ...prev, ...f(prev) })), []);

  const notificarError = useCallback((mensaje: string) => {
    setAviso(mensaje);
    setTimeout(() => setAviso((a) => (a === mensaje ? null : a)), 6000);
  }, []);

  const mensajeDeError = (e: unknown) => {
    const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Error desconocido";
    if (/insufficient_coins/.test(m)) return "No tienes suficientes monedas.";
    if (/no_super_likes/.test(m)) return "No te quedan Super Likes.";
    if (/already_claimed|already_spun/.test(m)) return "Ya lo reclamaste hoy.";
    if (/cooldown/.test(m)) return "Aún no puedes sacar otra carta.";
    if (/row-level security|permission denied/.test(m)) return "No tienes permiso para hacer esto.";
    if (/duplicate key|unique/.test(m)) return "Ese valor ya existe.";
    return m;
  };

  /** Ejecuta una mutación mostrando el error al usuario. Devuelve undefined si falla. */
  const intentar = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (e) {
        notificarError(mensajeDeError(e));
        return undefined;
      }
    },
    [notificarError],
  );

  /** Si no hay sesión, lleva al inicio de sesión y devuelve null. */
  const exigirSesion = useCallback((): string | null => {
    const id = uidRef.current;
    if (id) return id;
    if (typeof window !== "undefined") {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    return null;
  }, []);

  // ── Sesión ──
  useEffect(() => {
    if (!haySupabase) {
      setSesion({ lista: true, uid: null, email: null });
      setHidratado(true);
      return;
    }
    const sb = supabase();
    let activo = true;
    sb.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSesion({ lista: true, uid: data.session?.user.id ?? null, email: data.session?.user.email ?? null });
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evento, session) => {
      setSesion({ lista: true, uid: session?.user.id ?? null, email: session?.user.email ?? null });
    });
    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ── Carga de datos públicos (visibles también para invitados) ──
  const cargarPublico = useCallback(async () => {
    const sb = supabase();
    const [perfiles, listings, jobs, posts, conteos] = await Promise.all([
      sb.from("profiles").select("*").limit(1000),
      sb.from("listings").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("jobs").select("*").order("created_at", { ascending: false }).limit(300),
      sb.from("posts").select("*").order("created_at", { ascending: false }).limit(100),
      sb.rpc("demand_counts_for_offers"),
    ]);
    const fallo = perfiles.error ?? listings.error ?? jobs.error ?? posts.error;
    if (fallo) {
      setErrorDatos(
        fallo.code === "PGRST205" || /schema cache|does not exist/i.test(fallo.message)
          ? "TABLAS_NO_CREADAS"
          : `No se pudieron cargar los datos: ${fallo.message}`,
      );
      setHidratado(true);
      return;
    }
    setErrorDatos(null);
    const ids = (posts.data ?? []).map((p: PostFila) => p.id);
    const [likes, comentarios] = ids.length
      ? await Promise.all([
          sb.from("post_likes").select("post_id, user_id").in("post_id", ids),
          sb.from("post_comments").select("*").in("post_id", ids).order("created_at", { ascending: true }),
        ])
      : [{ data: [] as LikeFila[] }, { data: [] as ComentarioFila[] }];
    const mapaConteos: Record<string, number> = {};
    for (const c of (conteos.data ?? []) as { offer_id: string; buyers: number }[]) mapaConteos[c.offer_id] = c.buyers;

    parche(() => ({
      perfiles: (perfiles.data ?? []) as PerfilFila[],
      listings: (listings.data ?? []) as ListingFila[],
      jobs: (jobs.data ?? []) as JobFila[],
      posts: (posts.data ?? []) as PostFila[],
      likes: (likes.data ?? []) as LikeFila[],
      comentarios: (comentarios.data ?? []) as ComentarioFila[],
      conteos: mapaConteos,
    }));
    setHidratado(true);
  }, [parche]);

  useEffect(() => {
    if (!haySupabase || !sesion.lista) return;
    void cargarPublico();
  }, [sesion.lista, sesion.uid, cargarPublico]);

  // ── Carga de datos privados ──
  const recargarChats = useCallback(async () => {
    if (!uidRef.current) return;
    const { data, error } = await supabase().rpc("get_my_chats");
    if (!error) parche(() => ({ chats: (data ?? []) as ChatResumenFila[] }));
  }, [parche]);

  const recargarAmistades = useCallback(async () => {
    if (!uidRef.current) return;
    const { data } = await supabase().from("friendships").select("*");
    parche(() => ({ amistades: (data ?? []) as AmistadFila[] }));
  }, [parche]);

  const recargarMonedero = useCallback(async () => {
    const id = uidRef.current;
    if (!id) return;
    const { data } = await supabase().from("wallets").select("*").eq("user_id", id).maybeSingle();
    if (data) parche(() => ({ monedero: data as MonederoFila }));
  }, [parche]);

  const recargarPerfilPropio = useCallback(async () => {
    const id = uidRef.current;
    if (!id) return;
    const [p, priv] = await Promise.all([
      supabase().from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase().from("user_private").select("birth_date").eq("user_id", id).maybeSingle(),
    ]);
    parche((prev) => ({
      perfiles: p.data ? upsertId(prev.perfiles, p.data as PerfilFila) : prev.perfiles,
      nacimiento: (priv.data as { birth_date: string | null } | null)?.birth_date ?? prev.nacimiento,
    }));
  }, [parche]);

  const cargarPrivado = useCallback(async (id: string) => {
    const sb = supabase();
    const [monedero, priv, swL, swP, mt, am, no, ta, mi, ap, ch, adm] = await Promise.all([
      sb.from("wallets").select("*").eq("user_id", id).maybeSingle(),
      sb.from("user_private").select("birth_date").eq("user_id", id).maybeSingle(),
      sb.from("listing_swipes").select("listing_id, action").eq("user_id", id),
      sb.from("person_swipes").select("to_user").eq("from_user", id),
      sb.from("matches").select("user_a, user_b"),
      sb.from("friendships").select("*"),
      sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("tarot_draws").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
      sb.from("missions_claimed").select("mission_id").eq("user_id", id),
      sb.from("job_applications").select("job_id, status").eq("applicant_id", id),
      sb.rpc("get_my_chats"),
      sb.rpc("is_admin"),
    ]);
    parche((prev) => ({
      monedero: (monedero.data as MonederoFila | null) ?? null,
      nacimiento: (priv.data as { birth_date: string | null } | null)?.birth_date ?? null,
      swipesListing: (swL.data ?? []) as Crudo["swipesListing"],
      swipesPersona: (swP.data ?? []) as Crudo["swipesPersona"],
      matches: (mt.data ?? []) as Crudo["matches"],
      amistades: (am.data ?? []) as AmistadFila[],
      notificaciones: (no.data ?? []) as NotificacionFila[],
      tarot: (ta.data ?? []) as TarotFila[],
      misiones: ((mi.data ?? []) as { mission_id: string }[]).map((m) => m.mission_id),
      aplicaciones: (ap.data ?? []) as Crudo["aplicaciones"],
      chats: (ch.data ?? []) as ChatResumenFila[],
      esAdmin: adm.data === true,
      mensajes: prev.mensajes,
    }));
  }, [parche]);

  useEffect(() => {
    if (!haySupabase || !sesion.lista) return;
    if (uid) {
      setPrivadoListo(false);
      void cargarPrivado(uid).finally(() => setPrivadoListo(true));
    } else {
      setCrudo((prev) => ({ ...prev, ...PRIVADO_VACIO }));
      setPrivadoListo(true);
    }
  }, [sesion.lista, uid, cargarPrivado]);

  // ── Tiempo real: datos públicos ──
  useEffect(() => {
    if (!haySupabase || !sesion.lista || errorDatos === "TABLAS_NO_CREADAS") return;
    const sb = supabase();
    const refrescarConteos = async () => {
      const { data } = await sb.rpc("demand_counts_for_offers");
      const m: Record<string, number> = {};
      for (const c of (data ?? []) as { offer_id: string; buyers: number }[]) m[c.offer_id] = c.buyers;
      parche(() => ({ conteos: m }));
    };
    const canal = sb
      .channel("publico")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, (p) => {
        const nuevo = p.new as ListingFila | undefined;
        const viejo = p.old as { id?: string } | undefined;
        parche((prev) => ({
          listings:
            p.eventType === "DELETE" && viejo?.id
              ? prev.listings.filter((l) => l.id !== viejo.id)
              : nuevo
                ? nuevo.status === "active" || nuevo.owner_id === uidRef.current
                  ? upsertId(prev.listings, nuevo, true)
                  : prev.listings.filter((l) => l.id !== nuevo.id)
                : prev.listings,
        }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "listing_matches" }, () => void refrescarConteos())
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, (p) => {
        const nuevo = p.new as JobFila | undefined;
        const viejo = p.old as { id?: string } | undefined;
        parche((prev) => ({
          jobs: p.eventType === "DELETE" && viejo?.id ? prev.jobs.filter((j) => j.id !== viejo.id) : nuevo ? upsertId(prev.jobs, nuevo, true) : prev.jobs,
        }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (p) => {
        const nuevo = p.new as PerfilFila | undefined;
        if (nuevo) parche((prev) => ({ perfiles: upsertId(prev.perfiles, nuevo) }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (p) => {
        parche((prev) => ({ posts: upsertId(prev.posts, p.new as PostFila, true) }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) parche((prev) => ({ posts: prev.posts.filter((x) => x.id !== id) }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_likes" }, (p) => {
        const l = p.new as LikeFila;
        parche((prev) => (prev.likes.some((x) => x.post_id === l.post_id && x.user_id === l.user_id) ? {} : { likes: [...prev.likes, l] }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "post_likes" }, (p) => {
        const l = p.old as Partial<LikeFila>;
        parche((prev) => ({ likes: prev.likes.filter((x) => !(x.post_id === l.post_id && x.user_id === l.user_id)) }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_comments" }, (p) => {
        parche((prev) => ({ comentarios: upsertId(prev.comentarios, p.new as ComentarioFila) }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "post_comments" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) parche((prev) => ({ comentarios: prev.comentarios.filter((x) => x.id !== id) }));
      })
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [sesion.lista, errorDatos, parche]);

  // ── Tiempo real: datos privados (mensajes, notificaciones, monedero, amistades) ──
  useEffect(() => {
    if (!haySupabase || !uid) return;
    const sb = supabase();

    const alLlegarMensaje = (fila: MensajeFila) => {
      const previo = crudoRef.current;
      if (!previo.chats.some((c) => c.id === fila.chat_id)) {
        void recargarChats(); // chat nuevo (p. ej. alguien te escribió por primera vez)
        return;
      }
      const propio = fila.sender_id === uid;
      const abierto = chatAbierto.current === fila.chat_id;
      parche((prev) => ({
        mensajes: prev.mensajes[fila.chat_id] ? { ...prev.mensajes, [fila.chat_id]: upsertId(prev.mensajes[fila.chat_id], fila) } : prev.mensajes,
        chats: prev.chats.map((c) =>
          c.id !== fila.chat_id
            ? c
            : {
                ...c,
                last_message: fila,
                last_message_at: fila.created_at,
                unread: fila.sender_id && !propio && !abierto ? c.unread + 1 : c.unread,
              },
        ),
      }));
      if (abierto && !propio) void supabase().rpc("mark_chat_read", { p_chat: fila.chat_id });
    };

    const canal = sb
      .channel(`privado:${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => alLlegarMensaje(p.new as MensajeFila))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => alLlegarMensaje(p.new as MensajeFila))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (p) => {
        const n = p.new as NotificacionFila;
        parche((prev) => ({ notificaciones: upsertId(prev.notificaciones, n, true) }));
        setAviso(n.title);
        setTimeout(() => setAviso((a) => (a === n.title ? null : a)), 5000);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${uid}` }, (p) => {
        if (p.new && "coins" in p.new) parche(() => ({ monedero: p.new as MonederoFila }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        void recargarAmistades();
        void recargarChats();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, () => {
        void recargarChats();
        void supabase().from("matches").select("user_a, user_b").then(({ data }) => parche(() => ({ matches: (data ?? []) as Crudo["matches"] })));
      })
      .subscribe();

    // Presencia: quién está en línea ahora.
    const presencia = sb.channel("presencia", { config: { presence: { key: uid } } });
    presencia
      .on("presence", { event: "sync" }, () => setEnLineaIds(Object.keys(presencia.presenceState())))
      .subscribe(async (estado) => {
        if (estado === "SUBSCRIBED") await presencia.track({ en: new Date().toISOString() });
      });

    const escritura = canalesEscritura.current;
    return () => {
      void sb.removeChannel(canal);
      void sb.removeChannel(presencia);
      escritura.forEach((c) => void sb.removeChannel(c));
      escritura.clear();
    };
  }, [uid, parche, recargarChats, recargarAmistades]);

  // ───────────────────────────── Datos derivados ─────────────────────────────

  const perfilesMapeados = useMemo(() => {
    const yo = uid;
    return crudo.perfiles.map((p) => mapearPerfil(p, yo, p.id === yo ? crudo.nacimiento : null));
  }, [crudo.perfiles, crudo.nacimiento, uid]);

  const yoUsuario = useMemo(() => perfilesMapeados.find((p) => p.id === "yo") ?? PERFIL_INVITADO, [perfilesMapeados]);
  const usuarios = useMemo(() => perfilesMapeados.filter((p) => p.id !== "yo"), [perfilesMapeados]);

  const anunciosMapeados = useMemo(() => mapearListings(crudo.listings, uid), [crudo.listings, uid]);
  const todasPropiedades = anunciosMapeados.propiedades;

  const anuncios = useMemo(() => {
    const ahora = Date.now();
    const todos = [
      ...anunciosMapeados.propiedades.map(propiedadAAnuncio),
      ...anunciosMapeados.vehiculos.map(vehiculoAAnuncio),
      ...anunciosMapeados.negocios.map(negocioAAnuncio),
    ];
    return todos.sort(
      (a, b) => Number((anunciosMapeados.boosts[b.id] ?? 0) > ahora) - Number((anunciosMapeados.boosts[a.id] ?? 0) > ahora),
    );
  }, [anunciosMapeados]);

  const trabajos = useMemo(() => mapearJobs(crudo.jobs, uid), [crudo.jobs, uid]);

  const categoriaDe = useCallback(
    (listingId: string) => {
      const c = crudo.listings.find((l) => l.id === listingId)?.category;
      return c === "vehicle" ? "vehiculo" : c === "business" ? "negocio" : c === "property" ? "propiedad" : undefined;
    },
    [crudo.listings],
  );

  const conversaciones = useMemo(() => {
    const out: Record<string, Conversacion> = {};
    for (const c of crudo.chats) {
      const conv = mapearChat(c, uid, categoriaDe);
      const cargados = crudo.mensajes[c.id];
      if (cargados?.length) conv.mensajes = cargados.map((m) => mapearMensaje(m, uid)).sort((a, b) => a.ts - b.ts);
      out[c.id] = conv;
    }
    return out;
  }, [crudo.chats, crudo.mensajes, uid, categoriaDe]);

  const estado = useMemo<Estado>(() => {
    const w = crudo.monedero;
    const tarotDia = crudo.tarot.find((t) => !t.premium);
    const tarotPrem = crudo.tarot.find((t) => t.premium);
    const perfilPropio = crudo.perfiles.find((p) => p.id === uid);
    const amistades = crudo.amistades.map((a) => mapearSolicitud(a, uid));
    const otro = (a: AmistadFila) => aIdApp(a.requester_id === uid ? a.addressee_id : a.requester_id, uid);
    return {
      yo: yoUsuario,
      guardadas: crudo.swipesListing.filter((s) => s.action === "save").map((s) => s.listing_id),
      vistasProp: crudo.swipesListing.map((s) => s.listing_id),
      vistasPersonas: crudo.swipesPersona.map((s) => aIdApp(s.to_user, uid)),
      matchesPersonas: crudo.matches.map((m) => aIdApp(m.user_a === uid ? m.user_b : m.user_a, uid)),
      amigos: crudo.amistades.filter((a) => a.status === "accepted").map(otro),
      solicitudes: amistades,
      conversaciones,
      posts: mapearPosts(crudo.posts, crudo.likes, crudo.comentarios, uid),
      demandas: anunciosMapeados.demandas,
      notificaciones: crudo.notificaciones.map(mapearNotificacion),
      postulaciones: crudo.aplicaciones.map((a) => a.job_id),
      contratados: crudo.aplicaciones.filter((a) => a.status === "hired").map((a) => a.job_id),
      monedas: w?.coins ?? 0,
      ultimoCheckin: w?.last_checkin ?? "",
      racha: w?.streak ?? 0,
      ultimaRuleta: w?.last_spin ?? "",
      superLikes: w?.super_likes ?? 0,
      tiradasPremium: w?.premium_readings ?? 0,
      boosts: anunciosMapeados.boosts,
      misiones: crudo.misiones,
      tarotDia: tarotDia ? { cartas: tarotDia.cards, ts: new Date(tarotDia.created_at).getTime() } : undefined,
      tarotPremium: tarotPrem ? { cartas: tarotPrem.cards, ts: new Date(tarotPrem.created_at).getTime() } : undefined,
      kyc:
        perfilPropio?.kyc_status === "pending"
          ? "revision"
          : perfilPropio?.kyc_status === "verified"
            ? "verificado"
            : perfilPropio?.kyc_status === "rejected"
              ? "rechazado"
              : "ninguno",
    };
  }, [crudo, uid, yoUsuario, conversaciones, anunciosMapeados]);

  const misionesCumplidas = useMemo(() => {
    const ok: string[] = [];
    if (yoUsuario.zonas.length > 0 && yoUsuario.intereses.length > 0 && yoUsuario.nombre !== "Nuevo usuario") ok.push("perfil");
    if (yoUsuario.verificaciones.identidad) ok.push("kyc");
    if (crudo.listings.some((l) => l.owner_id === uid)) ok.push("publicar");
    if (estado.guardadas.length > 0) ok.push("guardar");
    if (estado.tarotDia) ok.push("tarot");
    if (estado.amigos.length > 0) ok.push("amigo");
    return ok;
  }, [yoUsuario, crudo.listings, uid, estado.guardadas, estado.tarotDia, estado.amigos]);

  const obtenerUsuario = useCallback((id: string) => perfilesMapeados.find((p) => p.id === id), [perfilesMapeados]);
  const obtenerPropiedad = useCallback((id: string) => todasPropiedades.find((p) => p.id === id), [todasPropiedades]);
  const obtenerAnuncio = useCallback((id: string) => anuncios.find((a) => a.id === id), [anuncios]);
  const obtenerGig = useCallback((id: string) => trabajos.gigs.find((g) => g.id === id), [trabajos]);
  const obtenerVacante = useCallback((id: string) => trabajos.vacantes.find((v) => v.id === id), [trabajos]);
  const enLinea = useCallback(
    (usuarioId: string) => usuarioId === "yo" || enLineaIds.some((i) => aIdApp(i, uid) === usuarioId),
    [enLineaIds, uid],
  );
  const enBoost = useCallback((id: string) => (estado.boosts[id] ?? 0) > Date.now(), [estado.boosts]);
  const compradoresBuscando = useCallback((a: Anuncio) => crudo.conteos[a.id] ?? 0, [crudo.conteos]);
  const cidDe = useCallback(
    (tipo: "servicio" | "empleo", refId: string) => Object.values(conversaciones).find((c) => c.tipo === tipo && c.refId === refId)?.id,
    [conversaciones],
  );

  // ───────────────────────────── Acciones ─────────────────────────────

  const cerrarSesion = useCallback(async () => {
    await supabase().auth.signOut();
    window.location.assign("/");
  }, []);

  // ── Ofertas ──
  const guardarSwipe = useCallback(
    async (listingId: string, accion: "save" | "pass") => {
      const id = uidRef.current;
      if (!id) return;
      const anterior = crudoRef.current.swipesListing;
      parche((prev) => ({
        swipesListing: [...prev.swipesListing.filter((s) => s.listing_id !== listingId), { listing_id: listingId, action: accion }],
      }));
      const { error } = await supabase().from("listing_swipes").upsert({ user_id: id, listing_id: listingId, action: accion }, { onConflict: "user_id,listing_id" });
      if (error) {
        parche(() => ({ swipesListing: anterior }));
        notificarError(mensajeDeError(error));
      }
    },
    [parche, notificarError],
  );

  const pasarAnuncio = useCallback((id: string) => void (exigirSesion() && guardarSwipe(id, "pass")), [exigirSesion, guardarSwipe]);
  const alternarGuardada = useCallback(
    (id: string) => {
      if (!exigirSesion()) return;
      const guardada = crudoRef.current.swipesListing.some((s) => s.listing_id === id && s.action === "save");
      void guardarSwipe(id, guardada ? "pass" : "save");
    },
    [exigirSesion, guardarSwipe],
  );

  const conectarAnuncio = useCallback(
    async (id: string) => {
      if (!exigirSesion()) return null;
      parche((prev) => ({ swipesListing: [...prev.swipesListing.filter((s) => s.listing_id !== id), { listing_id: id, action: "save" }] }));
      const cid = await intentar(async () => {
        const { data, error } = await supabase().rpc("open_chat", { p_kind: "listing", p_ref: id });
        if (error) throw error;
        return data as string;
      });
      if (!cid) {
        parche((prev) => ({ swipesListing: prev.swipesListing.filter((s) => s.listing_id !== id) }));
        return null;
      }
      await guardarSwipe(id, "save");
      await recargarChats();
      return cid;
    },
    [exigirSesion, parche, intentar, guardarSwipe, recargarChats],
  );

  const insertarListing = useCallback(
    async (fila: Record<string, unknown>): Promise<ListingFila | undefined> =>
      intentar(async () => {
        const id = uidRef.current;
        const { data, error } = await supabase().from("listings").insert({ ...fila, owner_id: id }).select().single();
        if (error) throw error;
        const l = data as ListingFila;
        parche((prev) => ({ listings: upsertId(prev.listings, l, true) }));
        return l;
      }),
    [intentar, parche],
  );

  const publicarPropiedad = useCallback(
    async (d: DatosPropiedad, relampago?: number) => {
      const id = exigirSesion();
      if (!id) return null;
      const l = await intentar(async () => {
        const imagenes = await subirVarias([d.imagen, ...(d.galeria ?? [])].filter(Boolean), id);
        return insertarListing({
          kind: "offer", category: "property", operation: d.operacion === "venta" ? "sale" : "rent", subtype: d.tipo, title: d.titulo,
          description: d.descripcion, price: d.precio, currency: d.moneda, zone: d.ubicacion, area: d.superficie,
          attrs: { bedrooms: d.dormitorios, bathrooms: d.banos, amenities: d.comodidades }, images: imagenes,
          flash_discount: relampago ?? null, flash_until: relampago ? finDelDia() : null,
        });
      });
      return l?.id ?? null;
    },
    [exigirSesion, intentar, insertarListing],
  );

  const publicarVehiculo = useCallback(
    async (d: DatosVehiculo, relampago?: number) => {
      const id = exigirSesion();
      if (!id) return null;
      const l = await intentar(async () => {
        const imagenes = await subirVarias([d.imagen].filter(Boolean), id);
        return insertarListing({
          kind: "offer", category: "vehicle", operation: d.operacion === "venta" ? "sale" : "rent", subtype: d.categoria, title: d.titulo,
          description: d.descripcion, price: d.precio, currency: d.moneda, zone: d.ubicacion,
          attrs: { brand: d.marca, model: d.modelo, year: d.anio, km: d.km, extras: d.extras }, images: imagenes,
          flash_discount: relampago ?? null, flash_until: relampago ? finDelDia() : null,
        });
      });
      return l?.id ?? null;
    },
    [exigirSesion, intentar, insertarListing],
  );

  const publicarNegocio = useCallback(
    async (d: DatosNegocio) => {
      const id = exigirSesion();
      if (!id) return null;
      const l = await intentar(async () => {
        const imagenes = await subirVarias([d.imagen].filter(Boolean), id);
        return insertarListing({
          kind: "offer", category: "business", operation: null, subtype: d.rubro, title: d.titulo, description: d.descripcion,
          price: d.inversion, currency: d.moneda, zone: d.ubicacion, attrs: { return: d.retorno }, images: imagenes,
        });
      });
      return l?.id ?? null;
    },
    [exigirSesion, intentar, insertarListing],
  );

  /** Publica la búsqueda y devuelve cuántas ofertas coinciden ahora mismo (el motor SQL ya avisó a los dueños). */
  const publicarDemanda = useCallback(
    async (d: DatosDemanda) => {
      if (!exigirSesion()) return null;
      const l = await insertarListing({
        kind: "demand", category: d.categoria === "inmueble" ? "property" : "vehicle", operation: d.operacion === "comprar" ? "sale" : "rent",
        subtype: d.tipo, title: `Busco ${d.tipo || (d.categoria === "inmueble" ? "inmueble" : "vehículo")}${d.zona ? ` en ${d.zona}` : ""}`,
        description: d.nota, budget_max: d.presupuestoMax, currency: d.moneda, zone: d.zona, min_area: d.superficieMin ?? null,
      });
      if (!l) return null;
      const { data } = await supabase().rpc("find_offers_for_demand", { p_demand: l.id });
      return Array.isArray(data) ? data.length : 0;
    },
    [exigirSesion, insertarListing],
  );

  const eliminarListing = useCallback(
    async (id: string) => {
      await intentar(async () => {
        const { error } = await supabase().from("listings").delete().eq("id", id);
        if (error) throw error;
        parche((prev) => ({ listings: prev.listings.filter((l) => l.id !== id) }));
      });
    },
    [intentar, parche],
  );

  // ── Personas ──
  const swipePersona = useCallback(
    async (id: string, accion: "like" | "pass" | "super", relacion = "pareja"): Promise<ResultadoSwipe> => {
      if (!exigirSesion()) return { resultado: "error" };
      parche((prev) => ({ swipesPersona: [...prev.swipesPersona.filter((s) => s.to_user !== aIdDb(id, uidRef.current)), { to_user: aIdDb(id, uidRef.current) }] }));
      try {
        const { data, error } = await supabase().rpc("swipe_person", { p_target: aIdDb(id, uidRef.current), p_action: accion, p_relation: relacion });
        if (error) throw error;
        const r = data as { result: string; chat_id?: string };
        if (r.result === "match") {
          await Promise.all([recargarChats(), recargarAmistades(), supabase().from("matches").select("user_a, user_b").then(({ data: m }) => parche(() => ({ matches: (m ?? []) as Crudo["matches"] })))]);
          return { resultado: "match", chatId: r.chat_id };
        }
        if (accion === "super") void recargarMonedero();
        return { resultado: "enviado" };
      } catch (e) {
        parche((prev) => ({ swipesPersona: prev.swipesPersona.filter((s) => s.to_user !== aIdDb(id, uidRef.current)) }));
        const msg = mensajeDeError(e);
        if (/Super Likes/.test(msg)) return { resultado: "sin-superlikes" };
        notificarError(msg);
        return { resultado: "error" };
      }
    },
    [exigirSesion, parche, recargarChats, recargarAmistades, recargarMonedero, notificarError],
  );

  const pasarPersona = useCallback((id: string) => void swipePersona(id, "pass"), [swipePersona]);
  const likePersona = useCallback((id: string, relacion?: string) => swipePersona(id, "like", relacion), [swipePersona]);
  const superLikePersona = useCallback((id: string, relacion?: string) => swipePersona(id, "super", relacion), [swipePersona]);

  const solicitarAmistad = useCallback(
    async (id: string) => {
      const yo = exigirSesion();
      if (!yo) return;
      await intentar(async () => {
        const { error } = await supabase().from("friendships").insert({ requester_id: yo, addressee_id: aIdDb(id, yo) });
        if (error) throw error;
        await recargarAmistades();
      });
    },
    [exigirSesion, intentar, recargarAmistades],
  );

  const responderSolicitud = useCallback(
    async (id: string, aceptar: boolean) => {
      await intentar(async () => {
        const { error } = await supabase().from("friendships").update({ status: aceptar ? "accepted" : "rejected" }).eq("id", id);
        if (error) throw error;
        await Promise.all([recargarAmistades(), recargarChats()]);
      });
    },
    [intentar, recargarAmistades, recargarChats],
  );

  const abrirChatDirecto = useCallback(
    async (usuarioId: string) => {
      const yo = exigirSesion();
      if (!yo) return null;
      const cid = await intentar(async () => {
        const { data, error } = await supabase().rpc("open_chat", { p_kind: "direct", p_ref: aIdDb(usuarioId, yo) });
        if (error) throw error;
        return data as string;
      });
      if (cid) await recargarChats();
      return cid ?? null;
    },
    [exigirSesion, intentar, recargarChats],
  );

  // ── Mensajería ──
  const cargarChat = useCallback(
    async (cid: string) => {
      chatAbierto.current = cid;
      const { data, error } = await supabase().from("messages").select("*").eq("chat_id", cid).order("created_at", { ascending: true }).limit(300);
      if (!error) parche((prev) => ({ mensajes: { ...prev.mensajes, [cid]: (data ?? []) as MensajeFila[] } }));
    },
    [parche],
  );

  const leer = useCallback(
    (cid: string) => {
      const c = crudoRef.current.chats.find((x) => x.id === cid);
      if (!c || c.unread === 0) return;
      parche((prev) => ({ chats: prev.chats.map((x) => (x.id === cid ? { ...x, unread: 0 } : x)) }));
      void supabase().rpc("mark_chat_read", { p_chat: cid });
    },
    [parche],
  );

  const insertarMensaje = useCallback(
    async (fila: Record<string, unknown>) => {
      const yo = uidRef.current;
      if (!yo) return;
      await intentar(async () => {
        const { data, error } = await supabase().from("messages").insert({ ...fila, sender_id: yo }).select().single();
        if (error) throw error;
        const m = data as MensajeFila;
        parche((prev) => ({
          mensajes: prev.mensajes[m.chat_id] ? { ...prev.mensajes, [m.chat_id]: upsertId(prev.mensajes[m.chat_id], m) } : prev.mensajes,
          chats: prev.chats.map((c) => (c.id === m.chat_id ? { ...c, last_message: m, last_message_at: m.created_at } : c)),
        }));
      });
    },
    [intentar, parche],
  );

  const enviarMensaje = useCallback(
    async (cid: string, texto: string) => {
      const limpio = texto.trim();
      if (!limpio) return;
      await insertarMensaje({ chat_id: cid, kind: "text", body: limpio });
    },
    [insertarMensaje],
  );

  const hacerOferta = useCallback(
    async (cid: string, monto: number) => {
      const chat = crudoRef.current.chats.find((c) => c.id === cid);
      const listing = crudoRef.current.listings.find((l) => l.id === chat?.listing_id);
      if (!listing || !(monto > 0)) return;
      await insertarMensaje({
        chat_id: cid, kind: "offer", body: `Mi oferta: ${monto.toLocaleString("es-ES")} ${listing.currency}`,
        amount: monto, currency: listing.currency, status: "pending",
      });
    },
    [insertarMensaje],
  );

  const enviarCotizacion = useCallback(
    async (cid: string, monto: number, dias: number) => {
      const chat = crudoRef.current.chats.find((c) => c.id === cid);
      const job = crudoRef.current.jobs.find((j) => j.id === chat?.job_id);
      if (!job || !(monto > 0) || !(dias >= 1)) return;
      await insertarMensaje({
        chat_id: cid, kind: "quote", body: `Cotización para "${job.title}"`, amount: monto, currency: job.currency, days: Math.round(dias), status: "pending",
      });
    },
    [insertarMensaje],
  );

  const responderOferta = useCallback(
    async (cid: string, mensajeId: string, aceptar: boolean) => {
      await intentar(async () => {
        const { error } = await supabase().rpc("respond_offer", { p_message: mensajeId, p_accept: aceptar });
        if (error) throw error;
        await cargarChat(cid);
        await recargarChats();
      });
    },
    [intentar, cargarChat, recargarChats],
  );

  // "Escribiendo…": canal de Broadcast por chat abierto (efímero, no se guarda).
  const suscribirEscritura = useCallback(
    (cid: string) => {
      if (!haySupabase) return () => {};
      const sb = supabase();
      const canal = sb
        .channel(`escribiendo:${cid}`)
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (payload?.uid === uidRef.current) return;
          setEscribiendo((e) => ({ ...e, [cid]: true }));
          clearTimeout(temporizadoresEscritura.current.get(cid));
          temporizadoresEscritura.current.set(
            cid,
            setTimeout(() => setEscribiendo((e) => ({ ...e, [cid]: false })), 3500),
          );
        })
        .subscribe();
      canalesEscritura.current.set(cid, canal);
      return () => {
        void sb.removeChannel(canal);
        canalesEscritura.current.delete(cid);
        if (chatAbierto.current === cid) chatAbierto.current = null;
      };
    },
    [],
  );

  const avisarEscribiendo = useCallback((cid: string) => {
    const ahora = Date.now();
    if (ahora - ultimoAvisoEscritura.current < 2000) return;
    ultimoAvisoEscritura.current = ahora;
    void canalesEscritura.current.get(cid)?.send({ type: "broadcast", event: "typing", payload: { uid: uidRef.current } });
  }, []);

  // ── Empleos y servicios ──
  const contratarServicio = useCallback(
    async (gigId: string) => {
      if (!exigirSesion()) return null;
      const cid = await intentar(async () => {
        const { data, error } = await supabase().rpc("open_chat", { p_kind: "gig", p_ref: gigId });
        if (error) throw error;
        return data as string;
      });
      if (cid) await recargarChats();
      return cid ?? null;
    },
    [exigirSesion, intentar, recargarChats],
  );

  const postularVacante = useCallback(
    async (vacanteId: string) => {
      if (!exigirSesion()) return null;
      const cid = await intentar(async () => {
        const { data, error } = await supabase().rpc("apply_job", { p_job: vacanteId });
        if (error) throw error;
        return data as string;
      });
      if (cid) {
        parche((prev) => ({ aplicaciones: [...prev.aplicaciones.filter((a) => a.job_id !== vacanteId), { job_id: vacanteId, status: "applied" }] }));
        await recargarChats();
      }
      return cid ?? null;
    },
    [exigirSesion, intentar, parche, recargarChats],
  );

  const insertarJob = useCallback(
    async (fila: Record<string, unknown>) =>
      intentar(async () => {
        const { data, error } = await supabase().from("jobs").insert({ ...fila, owner_id: uidRef.current }).select().single();
        if (error) throw error;
        const j = data as JobFila;
        parche((prev) => ({ jobs: upsertId(prev.jobs, j, true) }));
        return j.id;
      }),
    [intentar, parche],
  );

  const publicarServicio = useCallback(
    async (d: DatosGig) => {
      const yo = exigirSesion();
      if (!yo) return null;
      const id = await intentar(async () => {
        const imagen = d.imagen ? await subirMedia(d.imagen, yo) : null;
        return insertarJob({ kind: "gig", title: d.titulo, description: d.descripcion, category: d.categoria, price_from: d.precioDesde, currency: d.moneda, delivery_days: d.entregaDias, image_url: imagen });
      });
      return id ?? null;
    },
    [exigirSesion, intentar, insertarJob],
  );

  const publicarVacante = useCallback(
    async (d: DatosVacante) => {
      if (!exigirSesion()) return null;
      const id = await insertarJob({ kind: "vacancy", title: d.titulo, description: d.descripcion, job_type: d.tipo, modality: d.modalidad, location: d.ubicacion, budget_text: d.presupuesto, skills: d.skills });
      return id ?? null;
    },
    [exigirSesion, insertarJob],
  );

  // ── Perfil, feed y notificaciones ──
  const editarPerfil = useCallback(
    async (c: Partial<Usuario>) => {
      const yo = exigirSesion();
      if (!yo) return false;
      const ok = await intentar(async () => {
        const cols: Record<string, unknown> = {};
        if (c.nombre !== undefined) cols.display_name = c.nombre;
        if (c.usuario !== undefined) cols.handle = c.usuario || null;
        if (c.bio !== undefined) cols.bio = c.bio;
        if (c.ubicacion !== undefined) cols.location = c.ubicacion;
        if (c.intereses !== undefined) cols.interests = c.intereses;
        if (c.zonas !== undefined) cols.zones = c.zonas;
        if (c.relaciones !== undefined) cols.relations = c.relaciones;
        if (c.estilo !== undefined) cols.lifestyle = c.estilo;
        if ("presupuesto" in c) cols.budget = c.presupuesto ?? null;
        if ("edad" in c) cols.age = c.edad ?? null;
        if (c.signo !== undefined) cols.sign = c.signo;
        if ("foto" in c) cols.avatar_url = c.foto ? await subirMedia(c.foto, yo) : null;
        if ("profesional" in c) {
          cols.professional = c.profesional
            ? { headline: c.profesional.titular, skills: c.profesional.skills, portfolio: await subirVarias(c.profesional.portafolio, yo) }
            : null;
        }
        if (Object.keys(cols).length > 0) {
          const { data, error } = await supabase().from("profiles").update(cols).eq("id", yo).select().single();
          if (error) throw error;
          parche((prev) => ({ perfiles: upsertId(prev.perfiles, data as PerfilFila) }));
        }
        if (c.nacimiento !== undefined) {
          const { error } = await supabase().from("user_private").update({ birth_date: c.nacimiento || null }).eq("user_id", yo);
          if (error) throw error;
          parche(() => ({ nacimiento: c.nacimiento || null }));
        }
        return true;
      });
      return ok === true;
    },
    [exigirSesion, intentar, parche],
  );

  const publicarPost = useCallback(
    async (d: DatosPost) => {
      const yo = exigirSesion();
      if (!yo) return;
      await intentar(async () => {
        const imagen = d.imagen ? await subirMedia(d.imagen, yo) : null;
        const { data, error } = await supabase().from("posts").insert({ author_id: yo, kind: d.tipo, body: d.texto, zone: d.zona ?? null, image_url: imagen }).select().single();
        if (error) throw error;
        parche((prev) => ({ posts: upsertId(prev.posts, data as PostFila, true) }));
      });
    },
    [exigirSesion, intentar, parche],
  );

  const eliminarPost = useCallback(
    async (id: string) => {
      await intentar(async () => {
        const { error } = await supabase().from("posts").delete().eq("id", id);
        if (error) throw error;
        parche((prev) => ({ posts: prev.posts.filter((p) => p.id !== id) }));
      });
    },
    [intentar, parche],
  );

  const alternarLikePost = useCallback(
    async (postId: string) => {
      const yo = exigirSesion();
      if (!yo) return;
      const tiene = crudoRef.current.likes.some((l) => l.post_id === postId && l.user_id === yo);
      parche((prev) => ({
        likes: tiene ? prev.likes.filter((l) => !(l.post_id === postId && l.user_id === yo)) : [...prev.likes, { post_id: postId, user_id: yo }],
      }));
      const { error } = tiene
        ? await supabase().from("post_likes").delete().eq("post_id", postId).eq("user_id", yo)
        : await supabase().from("post_likes").insert({ post_id: postId, user_id: yo });
      if (error) {
        parche((prev) => ({
          likes: tiene ? [...prev.likes, { post_id: postId, user_id: yo }] : prev.likes.filter((l) => !(l.post_id === postId && l.user_id === yo)),
        }));
        notificarError(mensajeDeError(error));
      }
    },
    [exigirSesion, parche, notificarError],
  );

  const comentarPost = useCallback(
    async (postId: string, texto: string) => {
      const yo = exigirSesion();
      const limpio = texto.trim();
      if (!yo || !limpio) return;
      await intentar(async () => {
        const { data, error } = await supabase().from("post_comments").insert({ post_id: postId, author_id: yo, body: limpio }).select().single();
        if (error) throw error;
        parche((prev) => ({ comentarios: upsertId(prev.comentarios, data as ComentarioFila) }));
      });
    },
    [exigirSesion, intentar, parche],
  );

  const leerNotificaciones = useCallback(() => {
    if (!uidRef.current) return;
    const ahora = new Date().toISOString();
    parche((prev) => ({ notificaciones: prev.notificaciones.map((n) => (n.read_at ? n : { ...n, read_at: ahora })) }));
    void supabase().rpc("mark_notifications_read");
  }, [parche]);

  // ── Recompensas (las monedas solo cambian en el servidor) ──
  const checkin = useCallback(async () => {
    if (!exigirSesion()) return null;
    const r = await intentar(async () => {
      const { data, error } = await supabase().rpc("daily_checkin");
      if (error) throw error;
      await recargarMonedero();
      return (data as { amount: number }).amount;
    });
    return r ?? null;
  }, [exigirSesion, intentar, recargarMonedero]);

  const girarRuleta = useCallback(async () => {
    if (!exigirSesion()) return null;
    const r = await intentar(async () => {
      const { data, error } = await supabase().rpc("spin_wheel");
      if (error) throw error;
      await recargarMonedero();
      const d = data as { index: number; amount: number };
      return { indice: d.index, monto: d.amount };
    });
    return r ?? null;
  }, [exigirSesion, intentar, recargarMonedero]);

  const canjear = useCallback(
    async (rpc: string, args?: Record<string, unknown>) => {
      if (!exigirSesion()) return false;
      const ok = await intentar(async () => {
        const { error } = await supabase().rpc(rpc, args);
        if (error) throw error;
        await Promise.all([recargarMonedero(), cargarPublico()]);
        return true;
      });
      return ok === true;
    },
    [exigirSesion, intentar, recargarMonedero, cargarPublico],
  );

  const canjearBoost = useCallback((id: string) => canjear("redeem_boost", { p_listing: id }), [canjear]);
  const canjearSuperLikes = useCallback(() => canjear("redeem_super_likes"), [canjear]);
  const canjearTirada = useCallback(() => canjear("redeem_premium_reading"), [canjear]);

  const reclamarMision = useCallback(
    async (id: string) => {
      if (!MISIONES.some((m) => m.id === id)) return;
      await intentar(async () => {
        const { error } = await supabase().rpc("claim_mission", { p_mission: id });
        if (error) throw error;
        parche((prev) => ({ misiones: [...prev.misiones, id] }));
        await recargarMonedero();
      });
    },
    [intentar, parche, recargarMonedero],
  );

  // ── Tarot ──
  const tirar = useCallback(
    async (premium: boolean) => {
      if (!exigirSesion()) return null;
      const r = await intentar(async () => {
        const { data, error } = await supabase().rpc("draw_tarot", { p_premium: premium });
        if (error) throw error;
        const { data: filas } = await supabase().from("tarot_draws").select("*").eq("user_id", uidRef.current!).order("created_at", { ascending: false }).limit(20);
        parche(() => ({ tarot: (filas ?? []) as TarotFila[] }));
        if (premium) void recargarMonedero();
        return (data as { cards: number[] }).cards;
      });
      return r ?? null;
    },
    [exigirSesion, intentar, parche, recargarMonedero],
  );

  const sacarCartaDelDia = useCallback(async () => (await tirar(false))?.[0] ?? null, [tirar]);
  const hacerTiradaPremium = useCallback(() => tirar(true), [tirar]);

  // ── KYC ──
  const enviarKyc = useCallback(
    async (documento: File, selfie: File) => {
      const yo = exigirSesion();
      if (!yo) return false;
      const ok = await intentar(async () => {
        const [ruta1, ruta2] = await Promise.all([subirKyc(documento, yo, "documento"), subirKyc(selfie, yo, "selfie")]);
        const { error } = await supabase().rpc("submit_kyc", { p_doc_path: ruta1, p_selfie_path: ruta2 });
        if (error) throw error;
        await recargarPerfilPropio();
        return true;
      });
      return ok === true;
    },
    [exigirSesion, intentar, recargarPerfilPropio],
  );

  const completarOnboarding = useCallback(async () => {
    if (!exigirSesion()) return false;
    const ok = await intentar(async () => {
      const { error } = await supabase().rpc("complete_onboarding");
      if (error) throw new Error(error.message.replace(/^onboarding:\s*/, ""));
      await recargarPerfilPropio();
      return true;
    });
    return ok === true;
  }, [exigirSesion, intentar, recargarPerfilPropio]);

  const reiniciar = useCallback(async () => {
    if (!exigirSesion()) return;
    await intentar(async () => {
      const { error } = await supabase().rpc("reset_swipes");
      if (error) throw error;
      if (uidRef.current) await cargarPrivado(uidRef.current);
    });
  }, [exigirSesion, intentar, cargarPrivado]);

  // ───────────────────────────── Valor del contexto ─────────────────────────────

  const valor = useMemo<SocialContextValue>(() => {
    const noLeidosTotal = crudo.chats.reduce((s, c) => s + c.unread, 0);
    const solicitudesPendientes = estado.solicitudes.filter((s) => s.paraId === "yo" && s.estado === "pendiente").length;
    const notificacionesSinLeer = crudo.notificaciones.filter((n) => !n.read_at).length;
    return {
      estado,
      sesion,
      esAdmin: crudo.esAdmin,
      hidratado,
      privadoListo,
      errorDatos,
      escribiendo,
      noLeidosTotal,
      solicitudesPendientes,
      notificacionesSinLeer,
      usuarios,
      todasPropiedades,
      vehiculos: anunciosMapeados.vehiculos,
      negocios: anunciosMapeados.negocios,
      anuncios,
      gigs: trabajos.gigs,
      vacantes: trabajos.vacantes,
      misionesCumplidas,
      obtenerUsuario,
      obtenerPropiedad,
      obtenerAnuncio,
      obtenerGig,
      obtenerVacante,
      enLinea,
      enBoost,
      compradoresBuscando,
      cidDe,
      cerrarSesion,
      pasarAnuncio,
      alternarGuardada,
      conectarAnuncio,
      eliminarAnuncio: eliminarListing,
      publicarPropiedad,
      publicarVehiculo,
      publicarNegocio,
      publicarDemanda,
      eliminarDemanda: eliminarListing,
      pasarPersona,
      likePersona,
      superLikePersona,
      solicitarAmistad,
      responderSolicitud,
      abrirChatDirecto,
      cargarChat,
      suscribirEscritura,
      avisarEscribiendo,
      enviarMensaje,
      hacerOferta,
      enviarCotizacion,
      responderOferta,
      leer,
      contratarServicio,
      postularVacante,
      publicarServicio,
      publicarVacante,
      editarPerfil,
      publicarPost,
      eliminarPost,
      alternarLikePost,
      comentarPost,
      leerNotificaciones,
      checkin,
      girarRuleta,
      canjearBoost,
      canjearSuperLikes,
      canjearTirada,
      reclamarMision,
      sacarCartaDelDia,
      hacerTiradaPremium,
      enviarKyc,
      reiniciar,
      completarOnboarding,
      refrescarPerfil: recargarPerfilPropio,
    };
  }, [
    estado, sesion, crudo.esAdmin, crudo.chats, crudo.notificaciones, hidratado, privadoListo, errorDatos, escribiendo, usuarios, todasPropiedades, anunciosMapeados, anuncios, trabajos,
    misionesCumplidas, obtenerUsuario, obtenerPropiedad, obtenerAnuncio, obtenerGig, obtenerVacante, enLinea, enBoost, compradoresBuscando, cidDe,
    cerrarSesion, pasarAnuncio, alternarGuardada, conectarAnuncio, eliminarListing, publicarPropiedad, publicarVehiculo, publicarNegocio, publicarDemanda,
    pasarPersona, likePersona, superLikePersona, solicitarAmistad, responderSolicitud, abrirChatDirecto, cargarChat, suscribirEscritura, avisarEscribiendo,
    enviarMensaje, hacerOferta, enviarCotizacion, responderOferta, leer, contratarServicio, postularVacante, publicarServicio, publicarVacante,
    editarPerfil, publicarPost, eliminarPost, alternarLikePost, comentarPost, leerNotificaciones, checkin, girarRuleta, canjearBoost,
    canjearSuperLikes, canjearTirada, reclamarMision, sacarCartaDelDia, hacerTiradaPremium, enviarKyc, reiniciar,
    completarOnboarding, recargarPerfilPropio,
  ]);

  return (
    <SocialContext.Provider value={valor}>
      {children}
      {aviso && (
        <div role="status" className="fixed bottom-24 left-1/2 z-[200] max-w-[90vw] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm text-white shadow-xl lg:bottom-8">
          {aviso}
        </div>
      )}
    </SocialContext.Provider>
  );
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial debe usarse dentro de <SocialProvider>");
  return ctx;
}

/** Fecha de hoy en UTC (los bonos diarios se rigen por la fecha del servidor). */
export const hoyUtc = () => new Date().toISOString().slice(0, 10);
