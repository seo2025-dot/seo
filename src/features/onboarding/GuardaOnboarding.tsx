"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSocial } from "@/context/SocialContext";

const LIBRES = ["/onboarding", "/login", "/registro", "/auth"];

/**
 * Lleva a /onboarding a quien ya inició sesión pero aún no completó su perfil (nombre, fecha de nacimiento, fotos…).
 * Solo actúa cuando el servidor dice explícitamente `false`: si la columna no existe (esquema sin actualizar) no redirige.
 */
export default function GuardaOnboarding() {
  const { sesion, hidratado, privadoListo, estado } = useSocial();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!sesion.uid || !hidratado || !privadoListo) return;
    if (estado.yo.onboardingCompleto !== false) return;
    if (LIBRES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    router.replace("/onboarding");
  }, [sesion.uid, hidratado, privadoListo, estado.yo.onboardingCompleto, pathname, router]);

  return null;
}
