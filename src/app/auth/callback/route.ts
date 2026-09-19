import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

/** Solo se permiten redirecciones internas (evita open redirect). */
function destinoSeguro(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** Recibe el código de OAuth / confirmación de correo / recuperación de contraseña y crea la sesión. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const destino = destinoSeguro(searchParams.get("next"));

  if (code) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("No se pudo completar el inicio de sesión. Inténtalo de nuevo.")}`);
}
