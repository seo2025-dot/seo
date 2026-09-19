"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BotonesOAuth from "@/components/auth/BotonesOAuth";
import { campoCls } from "@/components/publicar/comunes";

const destinoSeguro = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/perfil");

function Formulario() {
  const params = useSearchParams();
  const destino = destinoSeguro(params.get("next"));
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [adulto, setAdulto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 2) return setError("Escribe tu nombre.");
    if (clave.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!adulto) return setError("Debes confirmar que eres mayor de 18 años.");

    setCargando(true);
    const { data, error: err } = await supabase().auth.signUp({
      email: email.trim(),
      password: clave,
      options: {
        data: { full_name: nombre.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
      },
    });
    setCargando(false);
    if (err) {
      setError(/already registered|already been registered/i.test(err.message) ? "Ese correo ya tiene una cuenta. Inicia sesión." : err.message);
      return;
    }
    // Supabase devuelve un usuario sin identidades cuando el correo ya existe (para no revelarlo).
    if (data.user && data.user.identities?.length === 0) {
      setError("Ese correo ya tiene una cuenta. Inicia sesión.");
      return;
    }
    if (data.session) window.location.assign(destino); // confirmación de correo desactivada en el proyecto
    else setEnviado(true);
  };

  if (enviado) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" role="status">
        <p className="text-5xl">📬</p>
        <h1 className="mt-4 text-2xl font-bold">Revisa tu correo</h1>
        <p className="mt-2 text-slate-500">
          Te enviamos un enlace de confirmación a <strong>{email}</strong>. Al pulsarlo tu cuenta quedará activa y entrarás automáticamente.
        </p>
        <Link href="/login" className="mt-8 inline-block text-sm font-semibold text-brand-600 hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">Crear cuenta</h1>
      <p className="mt-1 text-slate-500">Únete a la comunidad: publica, conecta y gana recompensas.</p>

      <div className="mt-8">
        <BotonesOAuth destino={destino} />
      </div>
      <form onSubmit={registrar} className="space-y-4" noValidate>
        <div>
          <label htmlFor="nombre" className="mb-1 block text-sm font-medium">Nombre</label>
          <input id="nombre" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} className={campoCls} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campoCls} />
        </div>
        <div>
          <label htmlFor="clave" className="mb-1 block text-sm font-medium">Contraseña (mínimo 8 caracteres)</label>
          <input id="clave" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} className={campoCls} />
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
          <input type="checkbox" checked={adulto} onChange={(e) => setAdulto(e.target.checked)} className="mt-1 h-4 w-4" />
          Confirmo que tengo 18 años o más y acepto las normas de la comunidad.
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={cargando} className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
          {cargando ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-md animate-pulse px-4 py-12" />}>
      <Formulario />
    </Suspense>
  );
}
