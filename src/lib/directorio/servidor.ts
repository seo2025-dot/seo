import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, haySupabase } from "@/lib/supabaseClient";
import type { VerticalId } from "@/data/directorio";
import { argumentosBusqueda, type FiltrosLista, TAM_PAGINA } from "@/lib/directorio/filtros";
import {
  DURACION_SUPUESTA_MS,
  TAM_PAGINA_EVENTOS,
  mapearEvento,
  mapearTipoEntrada,
  patronBusqueda,
  rangoCuando,
  vigentes,
  type Evento,
  type FiltrosEvento,
  type FilaEvento,
  type FilaTipoEntrada,
  type TipoEntrada,
} from "@/lib/directorio/eventos";
import {
  mapearConteos,
  mapearHit,
  mapearItem,
  mapearProveedor,
  mapearResena,
  mapearResultado,
  mapearTurno,
  type FilaBusqueda,
  type FilaHit,
  type FilaItem,
  type FilaProveedor,
  type FilaResena,
  type FilaTurno,
} from "@/lib/directorio/mapeo";
import type { ConteoSeccion, HitBusqueda, ItemCatalogo, Proveedor, Resena, ResultadoLista, TurnoGuardia } from "@/types/directorio";

/**
 * Consultas de servidor del directorio (Server Components). Usan la clave pública SIN sesión: todo lo que devuelven es público
 * por diseño (perfiles activos, catálogo, turnos y reseñas). Lo privado —el contacto— se pide en el navegador y solo con sesión.
 * Si faltan las variables de entorno o la consulta falla devuelven vacío y `error` con el motivo: las pantallas lo explican
 * en vez de romperse.
 */

let cliente: SupabaseClient | null = null;
function anonimo(): SupabaseClient | null {
  if (!haySupabase) return null;
  cliente ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}

export interface Resultado<T> {
  datos: T;
  /** null si todo fue bien. */
  error: string | null;
}

const SIN_CONFIGURAR = "Falta configurar Supabase (ver .env.example).";
const mensaje = (e: { message: string; code?: string }) =>
  e.code === "PGRST202" || /schema cache|does not exist|Could not find the function/i.test(e.message) ? "Aplica las actualizaciones 006 y 007 de la base de datos." : e.message;

export async function buscarProveedores(vertical: VerticalId, filtros: FiltrosLista): Promise<Resultado<{ items: ResultadoLista[]; hayMas: boolean }>> {
  const sb = anonimo();
  if (!sb) return { datos: { items: [], hayMas: false }, error: SIN_CONFIGURAR };
  const { data, error } = await sb.rpc("search_providers", argumentosBusqueda(vertical, filtros));
  if (error) return { datos: { items: [], hayMas: false }, error: mensaje(error) };
  const todos = ((data ?? []) as FilaBusqueda[]).flatMap((f) => mapearResultado(f) ?? []);
  return { datos: { items: todos.slice(0, TAM_PAGINA), hayMas: todos.length > TAM_PAGINA }, error: null };
}

/** Farmacias (o cualquier sección con turnos) que están de turno en este momento. */
export async function proveedoresDeTurno(vertical: VerticalId, limite = 6): Promise<Resultado<ResultadoLista[]>> {
  const sb = anonimo();
  if (!sb) return { datos: [], error: SIN_CONFIGURAR };
  const { data, error } = await sb.rpc("search_providers", { p_vertical: vertical, p_on_duty: true, p_limit: limite });
  if (error) return { datos: [], error: mensaje(error) };
  return { datos: ((data ?? []) as FilaBusqueda[]).flatMap((f) => mapearResultado(f) ?? []), error: null };
}

/** Negocios abiertos ahora (para el hub). */
export async function proveedoresAbiertos(vertical: VerticalId, limite = 6): Promise<Resultado<ResultadoLista[]>> {
  const sb = anonimo();
  if (!sb) return { datos: [], error: SIN_CONFIGURAR };
  const { data, error } = await sb.rpc("search_providers", { p_vertical: vertical, p_open_now: true, p_limit: limite });
  if (error) return { datos: [], error: mensaje(error) };
  return { datos: ((data ?? []) as FilaBusqueda[]).flatMap((f) => mapearResultado(f) ?? []), error: null };
}

export async function contarPorSeccion(): Promise<Resultado<ConteoSeccion[]>> {
  const sb = anonimo();
  if (!sb) return { datos: [], error: SIN_CONFIGURAR };
  const { data, error } = await sb.rpc("directory_counts");
  if (error) return { datos: [], error: mensaje(error) };
  return { datos: mapearConteos((data ?? []) as { vertical: string; providers: number; verified: number }[]), error: null };
}

export async function buscarEnDirectorio(q: string, zona?: string, vertical?: VerticalId): Promise<Resultado<HitBusqueda[]>> {
  const sb = anonimo();
  if (!sb) return { datos: [], error: SIN_CONFIGURAR };
  const { data, error } = await sb.rpc("search_directory", { p_q: q, p_zone: zona ?? null, p_vertical: vertical ?? null, p_limit: 40 });
  if (error) return { datos: [], error: mensaje(error) };
  return { datos: ((data ?? []) as FilaHit[]).flatMap((f) => mapearHit(f) ?? []), error: null };
}

export interface FichaCompleta {
  proveedor: Proveedor;
  items: ItemCatalogo[];
  turnos: TurnoGuardia[];
  resenas: Resena[];
}

/** Ficha por sección y slug. `datos` es null si no existe (o no está activa: la base la oculta). */
export async function obtenerFicha(vertical: VerticalId, slug: string): Promise<Resultado<FichaCompleta | null>> {
  const sb = anonimo();
  if (!sb) return { datos: null, error: SIN_CONFIGURAR };
  const { data, error } = await sb.from("providers").select("*").eq("slug", slug).eq("vertical", vertical).maybeSingle();
  if (error) return { datos: null, error: mensaje(error) };
  const proveedor = data ? mapearProveedor(data as FilaProveedor) : null;
  if (!proveedor) return { datos: null, error: null };
  const [items, turnos, resenas] = await Promise.all([
    sb.from("provider_items").select("*").eq("provider_id", proveedor.id).order("sort_order"),
    sb.from("provider_duty_shifts").select("*").eq("provider_id", proveedor.id).order("starts_at"),
    sb.from("provider_reviews").select("*, autor:profiles(display_name, avatar_url)").eq("provider_id", proveedor.id).order("created_at", { ascending: false }).limit(20),
  ]);
  return {
    datos: {
      proveedor,
      items: ((items.data ?? []) as FilaItem[]).map(mapearItem),
      turnos: ((turnos.data ?? []) as FilaTurno[]).map(mapearTurno),
      resenas: ((resenas.data ?? []) as unknown as FilaResena[]).map(mapearResena),
    },
    error: items.error?.message ?? turnos.error?.message ?? resenas.error?.message ?? null,
  };
}

// ── Eventos y entradas ──────────────────────────────────────────────────────
/** Quien organiza (su perfil es público mientras esté activo: si se pausa, sus eventos dejan de listarse). */
export type Organizador = Pick<Proveedor, "id" | "ownerId" | "nombre" | "slug" | "vertical" | "verificado" | "zona" | "logoUrl">;
const aOrganizador = (p: Proveedor): Organizador => ({ id: p.id, ownerId: p.ownerId, nombre: p.nombre, slug: p.slug, vertical: p.vertical, verificado: p.verificado, zona: p.zona, logoUrl: p.logoUrl });

export interface EventoPublico {
  evento: Evento;
  tipos: TipoEntrada[];
  organizador: Organizador;
}

async function completarEventos(sb: SupabaseClient, eventos: Evento[]): Promise<{ datos: EventoPublico[]; error: string | null }> {
  if (eventos.length === 0) return { datos: [], error: null };
  const [tipos, orgs] = await Promise.all([
    sb.from("event_ticket_types").select("*").in("event_id", eventos.map((e) => e.id)),
    sb.from("providers").select("*").in("id", [...new Set(eventos.map((e) => e.proveedorId))]),
  ]);
  const organizadores = new Map(((orgs.data ?? []) as FilaProveedor[]).flatMap((f) => mapearProveedor(f) ?? []).map((p) => [p.id, aOrganizador(p)]));
  const tiposPorEvento = new Map<string, TipoEntrada[]>();
  for (const t of ((tipos.data ?? []) as FilaTipoEntrada[]).map(mapearTipoEntrada)) tiposPorEvento.set(t.eventoId, [...(tiposPorEvento.get(t.eventoId) ?? []), t]);
  return {
    datos: eventos.flatMap((e) => {
      const organizador = organizadores.get(e.proveedorId);
      return organizador ? [{ evento: e, tipos: (tiposPorEvento.get(e.id) ?? []).sort((a, b) => a.precio - b.precio), organizador }] : []; // organizador pausado o suspendido: no se lista
    }),
    error: tipos.error?.message ?? orgs.error?.message ?? null,
  };
}

/** Próximos eventos con los filtros de la URL (categoría, zona, cuándo, gratis y texto). Incluye los que están en curso. */
export async function eventosCartelera(f: FiltrosEvento, ahora = Date.now()): Promise<Resultado<{ items: EventoPublico[]; hayMas: boolean }>> {
  const vacio = { items: [], hayMas: false };
  const sb = anonimo();
  if (!sb) return { datos: vacio, error: SIN_CONFIGURAR };
  const rango = f.cuando ? rangoCuando(f.cuando, ahora) : null;
  // Los eventos sin hora de fin siguen «en curso» 3 h; el filtro fino de lo ya terminado se hace en `vigentes()`.
  const desde = Math.max(rango?.desde ?? 0, ahora - DURACION_SUPUESTA_MS * 2);
  let consulta = sb.from("events").select("*").eq("status", "published").gte("starts_at", new Date(desde).toISOString());
  if (rango) consulta = consulta.lt("starts_at", new Date(rango.hasta).toISOString());
  if (f.categoria) consulta = consulta.eq("category", f.categoria);
  if (f.zona) consulta = consulta.eq("zone", f.zona);
  if (f.gratis) consulta = consulta.eq("is_free", true);
  if (f.q) consulta = consulta.ilike("title", patronBusqueda(f.q));
  const { data, error } = await consulta.order("starts_at").limit(150);
  if (error) return { datos: vacio, error: mensaje(error) };
  const todos = vigentes(((data ?? []) as FilaEvento[]).flatMap((r) => mapearEvento(r) ?? []), ahora);
  const completos = await completarEventos(sb, todos);
  const desdeIdx = (f.pagina - 1) * TAM_PAGINA_EVENTOS;
  return { datos: { items: completos.datos.slice(desdeIdx, desdeIdx + TAM_PAGINA_EVENTOS), hayMas: completos.datos.length > desdeIdx + TAM_PAGINA_EVENTOS }, error: completos.error };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un evento publicado con sus entradas y su organizador. `datos` es null si no existe, no es público o el organizador está pausado. */
export async function obtenerEvento(id: string): Promise<Resultado<EventoPublico | null>> {
  const sb = anonimo();
  if (!sb) return { datos: null, error: SIN_CONFIGURAR };
  if (!UUID.test(id)) return { datos: null, error: null };
  const { data, error } = await sb.from("events").select("*").eq("id", id).maybeSingle();
  if (error) return { datos: null, error: mensaje(error) };
  const evento = data ? mapearEvento(data as FilaEvento) : null;
  if (!evento || evento.estado === "review") return { datos: null, error: null };
  const c = await completarEventos(sb, [evento]);
  return { datos: c.datos[0] ?? null, error: c.error };
}

/** Los próximos eventos de un organizador (para su ficha). */
export async function eventosDeOrganizador(proveedorId: string, limite = 6, ahora = Date.now()): Promise<Resultado<EventoPublico[]>> {
  const sb = anonimo();
  if (!sb) return { datos: [], error: SIN_CONFIGURAR };
  const { data, error } = await sb.from("events").select("*").eq("provider_id", proveedorId).eq("status", "published").gte("starts_at", new Date(ahora - DURACION_SUPUESTA_MS * 2).toISOString()).order("starts_at").limit(40);
  if (error) return { datos: [], error: mensaje(error) };
  const c = await completarEventos(sb, vigentes(((data ?? []) as FilaEvento[]).flatMap((r) => mapearEvento(r) ?? []), ahora).slice(0, limite));
  return { datos: c.datos, error: c.error };
}
