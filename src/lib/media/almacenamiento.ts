import fs from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Abstracción del almacenamiento de archivos. Los manejadores no saben dónde se guardan:
 *  · `local`    → carpeta del disco (desarrollo, sin depender de ningún servicio);
 *  · `supabase` → bucket `media` de Supabase Storage (producción; compatible con S3).
 * Para otro proveedor (S3 directo, Cloudflare R2…) basta con implementar esta interfaz.
 */
export interface Almacenamiento {
  guardar(ruta: string, datos: Buffer, mime: string): Promise<void>;
  borrar(rutas: string[]): Promise<void>;
}

/** Rechaza rutas con `..`, absolutas o con caracteres raros (path traversal). */
export function rutaSegura(ruta: string): string {
  const limpia = ruta.replace(/\\/g, "/");
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(limpia) || limpia.split("/").some((p) => p === ".." || p === "." || p === "")) {
    throw new Error("Ruta de archivo no válida");
  }
  return limpia;
}

export function almacenamientoLocal(directorio: string): Almacenamiento {
  const raiz = path.resolve(directorio);
  const resolver = (ruta: string) => {
    const destino = path.resolve(raiz, rutaSegura(ruta));
    if (destino !== raiz && !destino.startsWith(raiz + path.sep)) throw new Error("Ruta fuera del directorio de medios");
    return destino;
  };
  return {
    async guardar(ruta, datos) {
      const destino = resolver(ruta);
      await fs.mkdir(path.dirname(destino), { recursive: true });
      await fs.writeFile(destino, datos);
    },
    async borrar(rutas) {
      await Promise.all(rutas.map((r) => fs.rm(resolver(r), { force: true })));
    },
  };
}

/** Lee un archivo del driver local (lo usa la ruta /api/media). Devuelve null si no existe. */
export async function leerLocal(directorio: string, ruta: string): Promise<Buffer | null> {
  const raiz = path.resolve(directorio);
  const destino = path.resolve(raiz, rutaSegura(ruta));
  if (!destino.startsWith(raiz + path.sep)) return null;
  try {
    return await fs.readFile(destino);
  } catch {
    return null;
  }
}

export function almacenamientoSupabase(cliente: SupabaseClient, bucket = "media"): Almacenamiento {
  return {
    async guardar(ruta, datos, mime) {
      const { error } = await cliente.storage.from(bucket).upload(rutaSegura(ruta), datos, { contentType: mime, upsert: false, cacheControl: "31536000" });
      if (error) throw new Error(`Storage: ${error.message}`);
    },
    async borrar(rutas) {
      const { error } = await cliente.storage.from(bucket).remove(rutas.map(rutaSegura));
      if (error) throw new Error(`Storage: ${error.message}`);
    },
  };
}
