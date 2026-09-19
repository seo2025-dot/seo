import { MAX_BYTES, MAX_FOTOS, type CodigoErrorImagen } from "@/lib/media/config";
import type { Almacenamiento } from "@/lib/media/almacenamiento";
import { ErrorImagen, procesarImagen } from "@/lib/media/procesar";

/** Todo lo que necesitan los endpoints, inyectado: así se prueban sin Next.js ni Supabase reales. */
export interface Dependencias {
  usuario(): Promise<{ id: string } | null>;
  rpc(nombre: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  almacenamiento: Almacenamiento;
  /** Miniatura (ruta) de la foto principal del usuario, o null si no tiene fotos. */
  primeraMiniatura(uid: string): Promise<string | null>;
  actualizarAvatar(uid: string, url: string | null): Promise<void>;
  urlMedia(ruta: string): string;
  nuevoId(): string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADO_POR_CODIGO: Record<CodigoErrorImagen, number> = {
  vacio: 400,
  demasiado_grande: 413,
  formato_no_permitido: 415,
  corrupta: 422,
  muy_grande_en_pixeles: 413,
  muy_pequena: 422,
};

const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

/** Traduce un error de la base de datos a una respuesta HTTP con un mensaje útil para el usuario. */
function errorDb(e: { message: string; code?: string }) {
  if (/max_photos/.test(e.message)) return json({ codigo: "max_fotos", mensaje: "Ya tienes 10 fotos. Elimina alguna para subir otra." }, 409);
  if (/No autenticado/.test(e.message)) return json({ codigo: "no_autenticado", mensaje: "Inicia sesión para continuar." }, 401);
  if (/no encontrada/i.test(e.message)) return json({ codigo: "no_encontrada", mensaje: "La foto no existe." }, 404);
  if (/exactamente|tu carpeta|inválid/i.test(e.message)) return json({ codigo: "invalido", mensaje: e.message }, 400);
  return json({ codigo: "error", mensaje: "No se pudo completar la operación." }, 500);
}

export function crearManejadores(d: Dependencias) {
  /** Mantiene profiles.avatar_url = miniatura de la foto principal. Un fallo aquí no debe romper la operación. */
  async function sincronizarAvatar(uid: string) {
    try {
      const ruta = await d.primeraMiniatura(uid);
      await d.actualizarAvatar(uid, ruta ? d.urlMedia(ruta) : null);
    } catch (e) {
      console.error("[fotos] no se pudo actualizar el avatar", e);
    }
  }

  return {
    /** POST /api/photos — multipart con un campo `file`. Valida, procesa, guarda original+miniatura y registra la foto. */
    async subir(req: Request): Promise<Response> {
      const usuario = await d.usuario();
      if (!usuario) return json({ codigo: "no_autenticado", mensaje: "Inicia sesión para subir fotos." }, 401);

      const declarado = Number(req.headers.get("content-length") ?? 0);
      if (declarado > MAX_BYTES + 64 * 1024) return json({ codigo: "demasiado_grande", mensaje: "La imagen es demasiado grande." }, 413);

      let archivo: FormDataEntryValue | null;
      try {
        archivo = (await req.formData()).get("file");
      } catch {
        return json({ codigo: "peticion_invalida", mensaje: "Petición no válida (se espera multipart/form-data con el campo «file»)." }, 400);
      }
      if (!archivo || typeof archivo === "string") return json({ codigo: "peticion_invalida", mensaje: "Falta el archivo (campo «file»)." }, 400);
      if (archivo.size > MAX_BYTES) return json({ codigo: "demasiado_grande", mensaje: "La imagen supera los 5 MB." }, 413);

      let img;
      try {
        img = await procesarImagen(Buffer.from(await archivo.arrayBuffer()));
      } catch (e) {
        if (e instanceof ErrorImagen) return json({ codigo: e.codigo, mensaje: e.message }, ESTADO_POR_CODIGO[e.codigo]);
        console.error("[fotos] error procesando imagen", e);
        return json({ codigo: "error", mensaje: "No se pudo procesar la imagen." }, 500);
      }

      const base = `${usuario.id}/fotos/${d.nuevoId()}`;
      const rutaCompleta = `${base}.webp`;
      const rutaMiniatura = `${base}_thumb.webp`;
      try {
        await Promise.all([d.almacenamiento.guardar(rutaCompleta, img.completa, img.mime), d.almacenamiento.guardar(rutaMiniatura, img.miniatura, img.mime)]);
      } catch (e) {
        console.error("[fotos] error guardando archivos", e);
        await d.almacenamiento.borrar([rutaCompleta, rutaMiniatura]).catch(() => {});
        return json({ codigo: "error_almacenamiento", mensaje: "No se pudo guardar la imagen." }, 502);
      }

      const { data, error } = await d.rpc("add_profile_photo", {
        p_path: rutaCompleta, p_thumb: rutaMiniatura, p_width: img.ancho, p_height: img.alto, p_bytes: img.bytes, p_mime: img.mime,
      });
      if (error || typeof data !== "string") {
        // Sin fila en la base de datos no debe quedar ningún archivo huérfano.
        await d.almacenamiento.borrar([rutaCompleta, rutaMiniatura]).catch(() => {});
        return errorDb(error ?? { message: "sin id" });
      }

      await sincronizarAvatar(usuario.id);
      return json({ foto: { id: data, url: d.urlMedia(rutaCompleta), thumbUrl: d.urlMedia(rutaMiniatura), ancho: img.ancho, alto: img.alto, bytes: img.bytes } }, 201);
    },

    /** PATCH /api/photos — body JSON { ids: string[] } con TODAS las fotos en el orden deseado. */
    async reordenar(req: Request): Promise<Response> {
      const usuario = await d.usuario();
      if (!usuario) return json({ codigo: "no_autenticado", mensaje: "Inicia sesión." }, 401);
      const cuerpo = (await req.json().catch(() => null)) as { ids?: unknown } | null;
      const ids = cuerpo?.ids;
      if (!Array.isArray(ids) || ids.length > MAX_FOTOS || !ids.every((x) => typeof x === "string" && UUID.test(x))) {
        return json({ codigo: "peticion_invalida", mensaje: `Se espera { ids: [hasta ${MAX_FOTOS} uuid] }.` }, 400);
      }
      const { error } = await d.rpc("reorder_profile_photos", { p_ids: ids });
      if (error) return errorDb(error);
      await sincronizarAvatar(usuario.id);
      return json({ ok: true });
    },

    /** DELETE /api/photos/:id — elimina la fila (compactando el orden) y después los archivos. */
    async borrar(id: string): Promise<Response> {
      const usuario = await d.usuario();
      if (!usuario) return json({ codigo: "no_autenticado", mensaje: "Inicia sesión." }, 401);
      if (!UUID.test(id)) return json({ codigo: "peticion_invalida", mensaje: "Identificador no válido." }, 400);
      const { data, error } = await d.rpc("delete_profile_photo", { p_id: id });
      if (error) return errorDb(error);
      const rutas = (Array.isArray(data) ? data : []).flatMap((f: { storage_path?: string; thumb_path?: string }) => [f.storage_path, f.thumb_path]).filter((r): r is string => !!r && !/^https?:/.test(r));
      if (rutas.length) await d.almacenamiento.borrar(rutas).catch((e) => console.error("[fotos] no se pudieron borrar archivos", e));
      await sincronizarAvatar(usuario.id);
      return json({ ok: true });
    },
  };
}
