"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { RAZONES_DENUNCIA } from "@/data/directorio";
import { haySupabase, supabase } from "@/lib/supabaseClient";

const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

/** Traduce los errores de las funciones de la base de datos a mensajes claros. */
function mensajeDe(e: { message: string } | null): string {
  if (!e) return "";
  if (/hayas contactado o contratado/.test(e.message)) return "Solo puedes valorar a un negocio con el que hayas hablado o al que hayas comprado. Contáctalo primero y vuelve.";
  if (/tu propio perfil/.test(e.message)) return "No puedes valorar tu propio negocio.";
  if (/tu propio contenido/.test(e.message)) return "No puedes denunciar tu propio negocio.";
  if (/permission denied|No autenticado/.test(e.message)) return "Inicia sesión para continuar.";
  return e.message;
}

/** Formulario de reseña. El servidor decide si puedes reseñar (contacto previo o compra) y marca la «compra verificada». */
export function FormResena({ proveedorId, ruta }: { proveedorId: string; ruta: string }) {
  const router = useRouter();
  const { sesion, hidratado } = useSocial();
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "hecho">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!hidratado) return null;
  if (!sesion.uid) {
    return (
      <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        <Link href={`/login?next=${encodeURIComponent(ruta)}`} className="font-bold text-brand-700 underline">
          Inicia sesión
        </Link>{" "}
        para dejar tu opinión.
      </p>
    );
  }
  if (estado === "hecho") return <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">¡Gracias! Tu reseña ya está publicada.</p>;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || !haySupabase) return;
    setEstado("enviando");
    setError(null);
    const { error: err } = await supabase().rpc("review_provider", { p_provider: proveedorId, p_rating: rating, p_comment: comentario.trim() });
    if (err) {
      setError(mensajeDe(err));
      setEstado("idle");
      return;
    }
    setEstado("hecho");
    router.refresh();
  };

  return (
    <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <fieldset>
        <legend className="text-sm font-bold text-ink">Tu valoración</legend>
        <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Estrellas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              onClick={() => setRating(n)}
              className={`text-3xl leading-none transition hover:scale-110 ${n <= rating ? "text-amber-400" : "text-slate-200"}`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="resena-texto" className="sr-only">
          Comentario
        </label>
        <textarea id="resena-texto" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} maxLength={500} placeholder="Cuéntanos cómo fue tu experiencia (opcional)" className={campo} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={rating < 1 || estado === "enviando"} className="boton-marca rounded-full px-6 py-2 text-sm font-bold text-white disabled:opacity-50">
        {estado === "enviando" ? "Publicando…" : "Publicar reseña"}
      </button>
    </form>
  );
}

/** Denuncia de un perfil. Con 3 denuncias de personas distintas el perfil se oculta hasta que lo revise la moderación. */
export function BotonDenunciar({ proveedorId }: { proveedorId: string }) {
  const { sesion, hidratado } = useSocial();
  const [abierto, setAbierto] = useState(false);
  const [razon, setRazon] = useState<string>("");
  const [nota, setNota] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "hecho">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!hidratado || !sesion.uid) return null;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razon || !haySupabase) return;
    setEstado("enviando");
    setError(null);
    const { error: err } = await supabase().rpc("report_content", { p_type: "provider", p_id: proveedorId, p_reason: razon, p_note: nota.trim() });
    if (err) {
      setError(mensajeDe(err));
      setEstado("idle");
      return;
    }
    setEstado("hecho");
  };

  if (estado === "hecho") return <p role="status" className="text-xs text-slate-500">Gracias por avisar. Revisaremos este perfil.</p>;

  return (
    <div className="text-xs">
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="font-semibold text-slate-400 underline hover:text-rose-600">
        Denunciar este perfil
      </button>
      {abierto && (
        <form onSubmit={enviar} className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <label htmlFor="denuncia-razon" className="block font-bold text-ink">
            ¿Qué pasa con este perfil?
          </label>
          <select id="denuncia-razon" value={razon} onChange={(e) => setRazon(e.target.value)} className={campo} required>
            <option value="">Elige un motivo…</option>
            {RAZONES_DENUNCIA.map((r) => (
              <option key={r.id} value={r.id}>
                {r.etiqueta}
              </option>
            ))}
          </select>
          <label htmlFor="denuncia-nota" className="sr-only">
            Detalles
          </label>
          <textarea id="denuncia-nota" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={300} placeholder="Detalles (opcional)" className={campo} />
          {error && (
            <p role="alert" className="text-rose-600">
              {error}
            </p>
          )}
          <button type="submit" disabled={!razon || estado === "enviando"} className="rounded-full bg-rose-600 px-4 py-1.5 font-bold text-white disabled:opacity-50">
            {estado === "enviando" ? "Enviando…" : "Enviar denuncia"}
          </button>
        </form>
      )}
    </div>
  );
}

/** Si eres la persona dueña del perfil, atajo para editarlo. */
export function AccionesDueno({ proveedorId, ownerId }: { proveedorId: string; ownerId: string }) {
  const { sesion, hidratado } = useSocial();
  if (!hidratado || sesion.uid !== ownerId) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm">
      <span className="font-semibold text-brand-900">Este es tu negocio.</span>
      <Link href={`/directorio/mi-negocio/${proveedorId}`} className="boton-marca rounded-full px-4 py-1.5 font-bold text-white">
        Editar
      </Link>
    </div>
  );
}
