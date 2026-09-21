"use client";

import { useState } from "react";
import EleccionUnica from "@/components/EleccionUnica";
import { useSocial } from "@/context/SocialContext";
import { BUSCAS, GENEROS, type Busca, type Genero } from "@/lib/genero";

/**
 * Aviso para quienes ya estaban inscritas antes de que se preguntara el género: sin ese dato no podemos mostrarles a las personas indicadas
 * ni mostrarlas a quienes buscan algo concreto. Aparece solo si falta alguno de los dos datos y desaparece al guardarlos.
 */
export default function AvisoGenero() {
  const { estado, sesion, hidratado, editarPerfil } = useSocial();
  const [genero, setGenero] = useState<Genero | "">("");
  const [busca, setBusca] = useState<Busca | "">("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hidratado || !sesion.uid || !estado.yo.onboardingCompleto) return null;
  const g = estado.yo.genero ?? genero;
  const b = estado.yo.quiereConocer ?? busca;
  if (estado.yo.genero && estado.yo.quiereConocer) return null;

  const guardar = async () => {
    if (!g || !b) return setError("Elige las dos opciones para continuar.");
    setError(null);
    setGuardando(true);
    const ok = await editarPerfil({ genero: g as Genero, quiereConocer: b as Busca });
    setGuardando(false);
    if (!ok) setError("No pudimos guardarlo. Inténtalo de nuevo.");
  };

  return (
    <section aria-label="Completa tus preferencias" className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
      <h2 className="font-black text-ink">Ayúdanos a mostrarte a las personas indicadas</h2>
      <p className="mt-1 text-sm text-slate-600">Es privado: nadie ve estas respuestas. Solo te recomendamos a quienes también quieran conocerte.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <EleccionUnica leyenda="Eres" nombre="aviso-genero" opciones={GENEROS} valor={g} onChange={setGenero} />
        <EleccionUnica leyenda="¿A quién te gustaría conocer?" nombre="aviso-busca" opciones={BUSCAS} valor={b} onChange={setBusca} />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {error}
        </p>
      )}
      <button type="button" onClick={() => void guardar()} disabled={guardando} className="boton-marca mt-3 rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </section>
  );
}
