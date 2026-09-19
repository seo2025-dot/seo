import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient";

/** Cliente de Supabase para Server Components y Route Handlers (lee/escribe la sesión en cookies). */
export async function supabaseServidor() {
  const almacen = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // En Server Components no se pueden escribir cookies: el middleware refresca la sesión.
        }
      },
    },
  });
}
