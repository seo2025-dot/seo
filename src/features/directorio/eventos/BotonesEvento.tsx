"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { mensajeErrorEventos } from "@/lib/directorio/eventos";
import { haySupabase, supabase } from "@/lib/supabaseClient";

/** «Me interesa»: guarda el evento en tu lista (solo tú la ves). Sin sesión lleva a iniciar sesión. */
export function BotonInteres({ eventoId }: { eventoId: string }) {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [guardado, setGuardado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    if (!hidratado || !uid || !haySupabase) return;
    let vivo = true;
    void (async () => {
      const { data } = await supabase().from("event_interest").select("event_id").eq("event_id", eventoId).maybeSingle();
      if (vivo) setGuardado(Boolean(data));
    })();
    return () => {
      vivo = false;
    };
  }, [hidratado, uid, eventoId]);

  if (hidratado && !uid) {
    return (
      <Link href={`/login?next=/directorio/evento/${eventoId}`} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
        ☆ Me interesa
      </Link>
    );
  }

  const alternar = async () => {
    setOcupado(true);
    setFallo(null);
    const { data, error } = await supabase().rpc("toggle_event_interest", { p_event: eventoId });
    setOcupado(false);
    if (error) return setFallo(mensajeErrorEventos(error.message));
    setGuardado(Boolean(data));
  };

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={() => void alternar()} disabled={ocupado || guardado === null} aria-pressed={guardado === true} className={`rounded-full border px-5 py-2.5 text-sm font-bold transition disabled:opacity-60 ${guardado ? "border-amber-400 bg-amber-50 text-amber-900" : "border-slate-300 text-ink hover:border-brand-400"}`}>
        {guardado ? "★ Guardado" : "☆ Me interesa"}
      </button>
      {fallo && (
        <span role="alert" className="mt-1 text-xs text-rose-600">
          {fallo}
        </span>
      )}
    </span>
  );
}

/** Comparte el enlace con el menú del celular o, si no existe, lo copia. */
export function BotonCompartir({ titulo, ruta }: { titulo: string; ruta: string }) {
  const [copiado, setCopiado] = useState(false);
  const compartir = async () => {
    const url = `${window.location.origin}${ruta}`;
    try {
      if (navigator.share) await navigator.share({ title: titulo, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      }
    } catch {
      /* el usuario cerró el menú de compartir */
    }
  };
  return (
    <button type="button" onClick={() => void compartir()} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
      {copiado ? "✓ Enlace copiado" : "↗ Compartir"}
    </button>
  );
}
