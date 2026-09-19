import sharp, { type Metadata } from "sharp";
import {
  MAX_BYTES,
  MAX_PIXELES,
  MENSAJES_ERROR,
  MIN_LADO,
  TAMANO_COMPLETA,
  TAMANO_MINIATURA,
  type CodigoErrorImagen,
} from "@/lib/media/config";

export class ErrorImagen extends Error {
  constructor(public codigo: CodigoErrorImagen) {
    super(MENSAJES_ERROR[codigo]);
    this.name = "ErrorImagen";
  }
}

export interface ImagenProcesada {
  completa: Buffer;
  miniatura: Buffer;
  ancho: number;
  alto: number;
  bytes: number;
  mime: "image/webp";
}

/** Formato real según los primeros bytes (no se fía de la extensión ni del Content-Type declarado). */
export function detectarFormato(b: Buffer): "jpeg" | "png" | "webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

/**
 * Valida y procesa una imagen subida:
 *  · rechaza vacíos, >5 MB, formatos no permitidos (SVG, GIF, HTML disfrazado…), archivos corruptos y bombas de píxeles;
 *  · corrige la orientación EXIF y ELIMINA todos los metadatos (GPS, cámara…);
 *  · genera la versión completa (máx. 1600×2000, WebP) y la miniatura (320×400 recortada, WebP).
 */
export async function procesarImagen(entrada: Buffer): Promise<ImagenProcesada> {
  if (entrada.length === 0) throw new ErrorImagen("vacio");
  if (entrada.length > MAX_BYTES) throw new ErrorImagen("demasiado_grande");
  if (!detectarFormato(entrada)) throw new ErrorImagen("formato_no_permitido");

  const opciones = { limitInputPixels: MAX_PIXELES, failOn: "error" as const };
  let meta: Metadata;
  try {
    meta = await sharp(entrada, opciones).metadata();
  } catch (e) {
    throw new ErrorImagen(/pixel limit/i.test(String(e)) ? "muy_grande_en_pixeles" : "corrupta");
  }
  const { width = 0, height = 0 } = meta;
  if (width * height > MAX_PIXELES) throw new ErrorImagen("muy_grande_en_pixeles");
  // Con orientación EXIF 5–8 el ancho y el alto vienen intercambiados: lo que importa es el lado corto.
  if (Math.min(width, height) < MIN_LADO) throw new ErrorImagen("muy_pequena");

  try {
    const completa = await sharp(entrada, opciones)
      .rotate()
      .resize({ width: TAMANO_COMPLETA.ancho, height: TAMANO_COMPLETA.alto, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const miniatura = await sharp(entrada, opciones)
      .rotate()
      .resize({ width: TAMANO_MINIATURA.ancho, height: TAMANO_MINIATURA.alto, fit: "cover", position: "attention" })
      .webp({ quality: 75 })
      .toBuffer();
    return {
      completa: completa.data,
      miniatura,
      ancho: completa.info.width,
      alto: completa.info.height,
      bytes: completa.data.length,
      mime: "image/webp",
    };
  } catch (e) {
    throw new ErrorImagen(/pixel limit/i.test(String(e)) ? "muy_grande_en_pixeles" : "corrupta");
  }
}
