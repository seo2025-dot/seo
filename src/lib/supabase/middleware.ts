import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, haySupabase } from "@/lib/supabaseClient";

/** Rutas que exigen sesión. El resto (explorar, mercado, empleos, comunidad, perfiles públicos) se puede ver como invitado. */
const PROTEGIDAS = [
  "/publicar",
  "/match",
  "/citas",
  "/mensajes",
  "/perfil",
  "/verificacion",
  "/recompensas",
  "/retos",
  "/invitar",
  "/astrologia",
  "/empleos/publicar",
  "/directorio/mi-negocio",
  "/directorio/pedidos",
  "/directorio/solicitudes",
  "/admin",
  "/onboarding",
];

const esProtegida = (ruta: string) => PROTEGIDAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

/** Refresca la sesión de Supabase en cada petición y redirige según el estado de autenticación. */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  if (!haySupabase) return respuesta;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valida el token contra Supabase Auth (no confiar solo en la cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;

  if (!user && esProtegida(ruta)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(ruta + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (user && (ruta === "/login" || ruta === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return respuesta;
}
