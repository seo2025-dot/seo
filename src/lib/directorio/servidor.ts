import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, haySupabase } from "@/lib/supabaseClient";
import type { VerticalId } from "@/data/directorio";
import { argumentosBusqueda, type FiltrosLista, TAM_PAGINA } from "@/lib/directorio/filtros";
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
