import { BUCKET_KYC, BUCKET_MEDIA, supabase } from "@/lib/supabaseClient";

const esDataUrl = (s: string) => s.startsWith("data:");

async function aBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

function extension(tipo: string) {
  return tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
}

/**
 * Sube una imagen (data URL o File) al bucket público `media` en la carpeta del usuario y devuelve su URL pública.
 * Si recibe una URL normal (ya subida) la devuelve tal cual.
 */
export async function subirMedia(origen: string | File, uid: string): Promise<string> {
  if (typeof origen === "string" && !esDataUrl(origen)) return origen;
  const blob = typeof origen === "string" ? await aBlob(origen) : origen;
  const ruta = `${uid}/${crypto.randomUUID()}.${extension(blob.type)}`;
  const { error } = await supabase().storage.from(BUCKET_MEDIA).upload(ruta, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
  return supabase().storage.from(BUCKET_MEDIA).getPublicUrl(ruta).data.publicUrl;
}

/** Sube varias imágenes en paralelo. */
export const subirVarias = (origenes: string[], uid: string) => Promise.all(origenes.map((o) => subirMedia(o, uid)));

/** Sube un documento KYC al bucket PRIVADO `kyc`. Devuelve la ruta (no hay URL pública). */
export async function subirKyc(archivo: File, uid: string, nombre: "documento" | "selfie"): Promise<string> {
  const ruta = `${uid}/${nombre}-${Date.now()}.${extension(archivo.type)}`;
  const { error } = await supabase().storage.from(BUCKET_KYC).upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
  return ruta;
}

/** URL temporal (10 min) para que un administrador vea un documento KYC. */
export async function urlKyc(ruta: string): Promise<string | null> {
  const { data } = await supabase().storage.from(BUCKET_KYC).createSignedUrl(ruta, 600);
  return data?.signedUrl ?? null;
}
