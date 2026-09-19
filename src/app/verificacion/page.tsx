/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import Icono from "@/components/Icono";
import { ConfianzaBadge, VerificadoCheck } from "@/components/PerfilBadges";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 8;

/**
 * Los archivos se suben a un bucket PRIVADO de Supabase Storage (`kyc`), en tu carpeta. Solo tú y los
 * administradores de la plataforma pueden verlos. La vista previa local se descarta al enviar.
 */
function Paso({
  n,
  titulo,
  ayuda,
  archivo,
  onArchivo,
  captura,
}: {
  n: number;
  titulo: string;
  ayuda: string;
  archivo: File | null;
  onArchivo: (f: File | null) => void;
  captura?: "user" | "environment";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!archivo) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(archivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo]);

  const elegir = (f: File | null) => {
    setError(null);
    if (f && !TIPOS.includes(f.type)) return setError("Usa una imagen JPG, PNG o WebP.");
    if (f && f.size > MAX_MB * 1024 * 1024) return setError(`La imagen supera los ${MAX_MB} MB.`);
    onArchivo(f);
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{n}</span>
        <div className="flex-1">
          <h2 className="font-bold">{titulo}</h2>
          <p className="text-sm text-slate-500">{ayuda}</p>
          {url && <img src={url} alt={`Vista previa: ${titulo}`} className="mt-3 max-h-48 rounded-xl object-cover" />}
          <input ref={input} type="file" accept={TIPOS.join(",")} capture={captura} onChange={(e) => elegir(e.target.files?.[0] ?? null)} className="hidden" />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
              <Icono nombre="foto" className="h-4 w-4" /> {archivo ? "Cambiar imagen" : "Subir imagen"}
            </button>
            {archivo && (
              <button type="button" onClick={() => onArchivo(null)} className="text-sm text-slate-500 hover:underline">
                Quitar
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-rose-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerificacionPage() {
  const { estado, hidratado, enviarKyc } = useSocial();
  const [documento, setDocumento] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const verificado = estado.yo.verificaciones.identidad || estado.kyc === "verificado";
  const enRevision = estado.kyc === "revision";
  const rechazado = estado.kyc === "rechazado";

  const enviar = async () => {
    if (!documento || !selfie || !acepto) return;
    setEnviando(true);
    const ok = await enviarKyc(documento, selfie);
    setEnviando(false);
    if (ok) {
      setDocumento(null);
      setSelfie(null);
    }
  };

  if (!hidratado) return <div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/perfil" className="text-sm text-brand-600 hover:underline">
        ← Volver a mi perfil
      </Link>
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold">
        Verificación de identidad <VerificadoCheck className="h-6 w-6" />
      </h1>
      <p className="mt-1 text-slate-500">
        Obtén la insignia azul y aumenta tu puntaje de confianza: los perfiles verificados reciben más respuestas y cierran más tratos.
      </p>

      <div className="mt-6 flex items-center gap-2 text-sm">
        <span className="text-slate-500">Tu confianza actual:</span>
        <ConfianzaBadge usuario={estado.yo} />
      </div>

      {verificado ? (
        <div className="mt-8 rounded-2xl border border-sky-200 bg-sky-50 p-8 text-center" role="status">
          <p className="text-5xl">🛡️</p>
          <h2 className="mt-3 text-xl font-bold">¡Identidad verificada!</h2>
          <p className="mt-1 text-sm text-slate-600">Tu perfil muestra la insignia azul en publicaciones, citas y chats.</p>
          <Link href="/perfil" className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
            Ver mi perfil
          </Link>
        </div>
      ) : enRevision ? (
        <div className="mt-8 rounded-2xl border border-slate-200 p-8 text-center" role="status">
          <p className="text-5xl">⏳</p>
          <h2 className="mt-3 text-xl font-bold">Tu verificación está en revisión</h2>
          <p className="mt-1 text-sm text-slate-500">
            Un miembro del equipo comparará tu selfie con el documento. Te avisaremos aquí y por notificación en cuanto termine.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {rechazado && (
            <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
              No pudimos verificar tu identidad con la solicitud anterior. Vuelve a intentarlo con fotos más nítidas y bien iluminadas.
            </p>
          )}
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <strong>Privacidad:</strong> las imágenes se guardan cifradas en un almacenamiento privado, accesible solo para ti y para el equipo de
            verificación. No se muestran a otros usuarios. Solo se publica la insignia azul.
          </div>
          <Paso n={1} titulo="Documento de identidad" ayuda="Foto nítida del frente de tu DNI, cédula o pasaporte, sin reflejos." archivo={documento} onArchivo={setDocumento} captura="environment" />
          <Paso n={2} titulo="Selfie" ayuda="Una foto de tu rostro, con buena luz y sin gafas de sol." archivo={selfie} onArchivo={setSelfie} captura="user" />
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-1 h-4 w-4" />
            Autorizo el tratamiento de estas imágenes con el único fin de verificar mi identidad.
          </label>
          <button
            type="button"
            onClick={enviar}
            disabled={!documento || !selfie || !acepto || enviando}
            className="w-full rounded-xl bg-brand-600 px-6 py-4 text-lg font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {enviando ? "Subiendo…" : "Enviar a verificación"}
          </button>
        </div>
      )}
    </div>
  );
}
