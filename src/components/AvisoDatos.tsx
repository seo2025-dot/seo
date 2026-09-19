"use client";

import { haySupabase } from "@/lib/supabaseClient";
import { useSocial } from "@/context/SocialContext";

/** Avisos de configuración: variables de entorno ausentes o esquema SQL sin aplicar. */
export default function AvisoDatos() {
  const { errorDatos } = useSocial();

  if (!haySupabase) {
    return (
      <div role="alert" className="bg-rose-100 px-4 py-3 text-center text-sm text-rose-900">
        <strong>Falta configurar Supabase.</strong> Crea <code>.env.local</code> con <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (ver <code>.env.example</code>) y reinicia el servidor.
      </div>
    );
  }
  if (errorDatos === "TABLAS_NO_CREADAS") {
    return (
      <div role="alert" className="bg-amber-100 px-4 py-3 text-center text-sm text-amber-900">
        <strong>La base de datos aún no tiene las tablas.</strong> En tu proyecto de Supabase abre <em>SQL Editor</em>, pega el contenido de{" "}
        <code>supabase/schema.sql</code> y pulsa <em>Run</em> (después, opcionalmente, <code>supabase/seed.sql</code> para datos de ejemplo).
      </div>
    );
  }
  if (errorDatos) {
    return (
      <div role="alert" className="bg-rose-100 px-4 py-2 text-center text-sm text-rose-900">
        {errorDatos}
      </div>
    );
  }
  return null;
}
