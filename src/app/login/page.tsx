"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BotonesOAuth from "@/components/auth/BotonesOAuth";
import { campoCls } from "@/components/publicar/comunes";

/** Solo rutas internas (evita open redirect). */
const destinoSeguro = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

function traducir(mensaje: string) {
  if (/Invalid login credentials/i.test(mensaje)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(mensaje)) return "Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.";
  if (/rate limit|too many/i.test(mensaje)) return "Demasiados intentos. Espera unos minutos.";
  return mensaje;
}

function Formulario() {
  const params = useSearchParams();
  const destino = destinoSeguro(params.get("next"));
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [info, setInfo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setCargando(true);
    const { error: err } = await supabase().auth.signInWithPassword({ email: email.trim(), password: clave });
    if (err) {
      setError(traducir(err.message));
      setCargando(false);
      return;
    }
    // Navegación completa para que el middleware vea la cookie de sesión.
    window.location.assign(destino);
  };

  const olvide = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Escribe tu correo arriba y vuelve a pulsar.");
      return;
    }
    const { error: err } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/nueva-contrasena`,
    });
    if (err) setError(traducir(err.message));
    else setInfo("Si el correo existe, recibirás un enlace para crear una nueva contraseña.");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">Iniciar sesión</h1>
      <p className="mt-1 text-slate-500">Accede para publicar, hacer match y chatear.</p>

      <div className="mt-8">
        <BotonesOAuth destino={destino} />
      </div>
      <form onSubmit={entrar} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campoCls} />
        </div>
        <div>
          <label htmlFor="clave" className="mb-1 block text-sm font-medium">Contraseña</label>
          <input id="clave" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} className={campoCls} />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {info}
          </p>
        )}
        <button type="submit" disabled={cargando || !email || !clave} className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
          {cargando ? "Entrando…" : "Entrar"}
        </button>
        <button type="button" onClick={olvide} className="w-full text-sm text-brand-600 hover:underline">
          ¿Olvidaste tu contraseña?
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        ¿No tienes cuenta?{" "}
        <Link href={`/registro?next=${encodeURIComponent(destino)}`} className="font-semibold text-brand-600 hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-md animate-pulse px-4 py-12" />}>
      <Formulario />
    </Suspense>
  );
}
