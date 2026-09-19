"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { campoCls } from "@/components/publicar/comunes";

/** Destino del enlace de recuperación: el callback ya creó una sesión temporal para cambiar la contraseña. */
export default function NuevaContrasenaPage() {
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (clave.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    setCargando(true);
    const { error: err } = await supabase().auth.updateUser({ password: clave });
    if (err) {
      setError(err.message);
      setCargando(false);
      return;
    }
    window.location.assign("/perfil");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">Nueva contraseña</h1>
      <form onSubmit={guardar} className="mt-8 space-y-4" noValidate>
        <div>
          <label htmlFor="clave" className="mb-1 block text-sm font-medium">Nueva contraseña (mínimo 8 caracteres)</label>
          <input id="clave" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} className={campoCls} />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={cargando} className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {cargando ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}
