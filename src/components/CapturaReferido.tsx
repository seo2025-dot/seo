"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import { codigoValido } from "@/lib/referidos";

const CLAVE = "conectari:ref";

/**
 * Recuerda el código de invitación (?ref=…) de cualquier página de entrada y lo aplica cuando hay sesión. Cubre los registros con
 * OAuth o desde otro navegador, donde el código no viaja en los metadatos del registro. El servidor valida todo (código existente,
 * cuenta reciente, un solo invitador, sin autoinvitación).
 */
export default function CapturaReferido() {
  const pathname = usePathname();
  const { sesion, hidratado } = useSocial();

  useEffect(() => {
    try {
      const c = new URLSearchParams(window.location.search).get("ref");
      if (codigoValido(c)) localStorage.setItem(CLAVE, c.trim().toLowerCase());
    } catch {}
  }, [pathname]);

  useEffect(() => {
    if (!hidratado || !sesion.uid || !haySupabase) return;
    let codigo: string | null = null;
    try {
      codigo = localStorage.getItem(CLAVE);
    } catch {}
    if (!codigo) return;
    void Promise.resolve(supabase().rpc("apply_referral", { p_code: codigo })).then(({ error }) => {
      if (error) return; // se reintenta en la próxima carga
      try {
        localStorage.removeItem(CLAVE);
      } catch {}
    });
  }, [hidratado, sesion.uid]);

  return null;
}
