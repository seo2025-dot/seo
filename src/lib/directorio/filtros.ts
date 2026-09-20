import { VERTICAL_POR_ID, type VerticalId } from "@/data/directorio";

export const TAM_PAGINA = 24;
const MAX_PAGINA = 200;

/** Filtros de un listado. Viven en la URL (enlaces compartibles y sin estado oculto). */
export interface FiltrosLista {
  subtipo?: string;
  q?: string;
  zona?: string;
  abierto: boolean;
  entrega: boolean;
  verificados: boolean;
  deTurno: boolean;
  pagina: number;
}

export const FILTROS_INICIALES: FiltrosLista = { abierto: false, entrega: false, verificados: false, deTurno: false, pagina: 1 };

type Parametros = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const texto = (v: string | string[] | undefined, max: number) => {
  const t = (primero(v) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return t || undefined;
};
const marca = (v: string | string[] | undefined) => primero(v) === "1";

/** Convierte los parámetros de la URL en filtros válidos: ignora lo desconocido y limita longitudes y página. */
export function filtrosDesdeParams(sp: Parametros, vertical: VerticalId): FiltrosLista {
  const subtipoBruto = texto(sp.subtipo, 40);
  const subtipo = subtipoBruto && VERTICAL_POR_ID[vertical].subtipos.some((s) => s.id === subtipoBruto) ? subtipoBruto : undefined;
  const pagina = Number.parseInt(primero(sp.pagina) ?? "1", 10);
  const q = texto(sp.q, 60);
  const zona = texto(sp.zona, 80);
  return {
    ...(subtipo ? { subtipo } : {}),
    ...(q ? { q } : {}),
    ...(zona ? { zona } : {}),
    abierto: marca(sp.abierto),
    entrega: marca(sp.entrega),
    verificados: marca(sp.verificados),
    deTurno: VERTICAL_POR_ID[vertical].capacidades.turnos && marca(sp.turno),
    pagina: Number.isFinite(pagina) ? Math.min(MAX_PAGINA, Math.max(1, pagina)) : 1,
  };
}

/** Cadena de consulta canónica (sin valores por defecto, en orden fijo): dos filtros iguales dan la misma URL. */
export function consultaDesdeFiltros(f: FiltrosLista): string {
  const p = new URLSearchParams();
  if (f.subtipo) p.set("subtipo", f.subtipo);
  if (f.q) p.set("q", f.q);
  if (f.zona) p.set("zona", f.zona);
  if (f.abierto) p.set("abierto", "1");
  if (f.entrega) p.set("entrega", "1");
  if (f.verificados) p.set("verificados", "1");
  if (f.deTurno) p.set("turno", "1");
  if (f.pagina > 1) p.set("pagina", String(f.pagina));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Enlace de un listado con algunos filtros cambiados (al cambiar un filtro se vuelve a la página 1). */
export function hrefLista(vertical: VerticalId, base: FiltrosLista, cambios: Partial<FiltrosLista> = {}): string {
  const cambiaFiltro = Object.keys(cambios).some((k) => k !== "pagina");
  const f = { ...base, ...cambios, pagina: cambios.pagina ?? (cambiaFiltro ? 1 : base.pagina) };
  return `/directorio/${vertical}${consultaDesdeFiltros(f)}`;
}

/** Argumentos de `search_providers` a partir de los filtros. Se pide una fila de más para saber si hay página siguiente. */
export function argumentosBusqueda(vertical: VerticalId, f: FiltrosLista) {
  return {
    p_vertical: vertical,
    p_subtype: f.subtipo ?? null,
    p_zone: f.zona ?? null,
    p_q: f.q ?? null,
    p_open_now: f.abierto,
    p_delivers: f.entrega,
    p_verified: f.verificados,
    p_on_duty: f.deTurno,
    p_limit: TAM_PAGINA + 1,
    p_offset: (f.pagina - 1) * TAM_PAGINA,
  };
}

/** Cuántos filtros están activos (sin contar la página). */
export const filtrosActivos = (f: FiltrosLista) =>
  [f.subtipo, f.q, f.zona, f.abierto, f.entrega, f.verificados, f.deTurno].filter(Boolean).length;

/** Sanea el texto del buscador universal: recorta, colapsa espacios y limita la longitud. Menos de 2 caracteres = sin búsqueda. */
export function consultaUniversal(bruto: string | string[] | undefined): string {
  const t = (Array.isArray(bruto) ? bruto[0] : bruto ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return t.length >= 2 ? t : "";
}
