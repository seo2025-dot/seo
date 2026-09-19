"use client";

import { useEffect, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "@/lib/supabaseClient";

const PROVEEDORES = [
  { id: "google", nombre: "Google", icono: "G", clases: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50" },
  { id: "github", nombre: "GitHub", icono: "⌥", clases: "border-slate-800 bg-slate-900 text-white hover:bg-slate-800" },
] as const;

type Id = (typeof PROVEEDORES)[number]["id"];

/**
 * Inicio de sesión social. Solo muestra los proveedores que estén ACTIVADOS en el proyecto
 * (Supabase > Authentication > Providers); si no hay ninguno, no renderiza nada.
 */
export default function BotonesOAuth({ destino }: { destino: string }) {
  const [activos, setActivos] = useState<Id[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<Id | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s: { external?: Record<string, boolean> }) => {
        if (vivo) setActivos(PROVEEDORES.filter((p) => s.external?.[p.id]).map((p) => p.id));
      })
      .catch(() => vivo && setActivos([]));
    return () => {
      vivo = false;
    };
  }, []);

  const entrar = async (proveedor: Id) => {
    setError(null);
    setCargando(proveedor);
    const { error: e } = await supabase().auth.signInWithOAuth({
      provider: proveedor,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}` },
    });
    if (e) {
      setCargando(null);
      setError(e.message);
    }
  };

  const visibles = PROVEEDORES.filter((p) => activos?.includes(p.id));
  if (visibles.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        <div className={`grid gap-3 ${visibles.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {visibles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => entrar(p.id)}
              disabled={cargando !== null}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${p.clases}`}
            >
              <span aria-hidden className="text-base font-bold">{p.icono}</span>
              {cargando === p.id ? "Redirigiendo…" : `Continuar con ${p.nombre}`}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> o con tu correo <span className="h-px flex-1 bg-slate-200" />
      </div>
    </>
  );
}
