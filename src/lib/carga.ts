/**
 * Errores de carga de la aplicación. Tras publicar una versión nueva, una pestaña que sigue abierta (o una página guardada en una caché) pide
 * archivos de la versión anterior que ya no existen: el navegador falla al cargar el JavaScript y la página queda rota o «sin vida».
 * Se recupera recargando UNA vez; si vuelve a fallar se muestra la pantalla de error con un botón, nunca un bucle de recargas.
 */

/** ¿El mensaje corresponde a un fallo al cargar archivos de la aplicación (y no a un error de lógica)? */
export function esErrorDeCarga(mensaje: unknown): boolean {
  const t = typeof mensaje === "string" ? mensaje : mensaje instanceof Error ? `${mensaje.name} ${mensaje.message}` : "";
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to load chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unexpected token '<'/i.test(t);
}

const CLAVE = "conectari:recarga-por-carga";
const VENTANA_MS = 30_000;

/** ¿Se puede recargar ya? Solo una vez cada 30 segundos, para no entrar nunca en un bucle. Guarda la hora en sessionStorage. */
export function puedeRecargarPorCarga(ahora: number, almacen: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null): boolean {
  try {
    const ultima = Number(almacen?.getItem(CLAVE) ?? 0);
    if (Number.isFinite(ultima) && ultima > 0 && ahora - ultima < VENTANA_MS) return false;
    almacen?.setItem(CLAVE, String(ahora));
    return true;
  } catch {
    return false; // sin almacenamiento no se arriesga un bucle: se muestra la pantalla de error
  }
}
