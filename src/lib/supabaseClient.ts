import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el NAVEGADOR (Client Components).
 * Usa la clave pública (publishable/anon): la seguridad real la imponen las políticas RLS de la base de datos.
 * Para Server Components, Route Handlers y middleware ver src/lib/supabase/server.ts y middleware.ts.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** false si faltan las variables de entorno (la app muestra una pantalla de configuración). */
export const haySupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!haySupabase) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example)");
  }
  cliente ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cliente;
}

/** Nombre de los buckets de Storage (creados por supabase/schema.sql). */
export const BUCKET_MEDIA = "media";
export const BUCKET_KYC = "kyc";
