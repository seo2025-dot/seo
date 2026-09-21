import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabaseClient";

/**
 * Cliente de Supabase con la clave de SERVICIO: se salta las políticas de seguridad. Solo para código de servidor que ya verificó
 * lo que hace (p. ej. acreditar un pago que la pasarela confirmó). Nunca se importa desde componentes de cliente (`server-only`)
 * y la clave no lleva el prefijo NEXT_PUBLIC_, así que no llega al navegador.
 */
let cliente: SupabaseClient | null = null;

export function clienteAdmin(): SupabaseClient | null {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!clave || !SUPABASE_URL) return null;
  cliente ??= createClient(SUPABASE_URL, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}
