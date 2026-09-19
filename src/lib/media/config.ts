/** Reglas de las fotos de perfil. Se comparten entre cliente (validación previa) y servidor (validación real). */

export const MAX_FOTOS = 10;
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB por archivo original
export const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const EXTENSIONES_PERMITIDAS = ".jpg, .jpeg, .png, .webp";
export const MIN_LADO = 300; // px del lado más corto
export const MAX_PIXELES = 50_000_000; // protege de "bombas de descompresión"

export const TAMANO_COMPLETA = { ancho: 1600, alto: 2000 };
export const TAMANO_MINIATURA = { ancho: 320, alto: 400 };

export type CodigoErrorImagen =
  | "vacio"
  | "demasiado_grande"
  | "formato_no_permitido"
  | "corrupta"
  | "muy_grande_en_pixeles"
  | "muy_pequena";

export const MENSAJES_ERROR: Record<CodigoErrorImagen, string> = {
  vacio: "El archivo está vacío.",
  demasiado_grande: `La imagen supera los ${MAX_BYTES / 1024 / 1024} MB.`,
  formato_no_permitido: "Formato no permitido: usa JPG, PNG o WebP.",
  corrupta: "No se pudo leer la imagen: el archivo está dañado o incompleto.",
  muy_grande_en_pixeles: "La imagen tiene demasiados píxeles (máx. 50 megapíxeles).",
  muy_pequena: `La imagen es demasiado pequeña (mínimo ${MIN_LADO} px en el lado más corto).`,
};

/** Validación rápida en el navegador (la definitiva la hace el servidor mirando el contenido real del archivo). */
export function validarArchivoCliente(f: { type: string; size: number; name: string }): string | null {
  if (f.size === 0) return MENSAJES_ERROR.vacio;
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(f.type)) return MENSAJES_ERROR.formato_no_permitido;
  if (f.size > MAX_BYTES) return MENSAJES_ERROR.demasiado_grande;
  return null;
}
