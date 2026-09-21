"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import NavAdmin from "@/features/admin/NavAdmin";
import { avisarAlEquipo } from "@/lib/avisos/ping";
import { supabase } from "@/lib/supabaseClient";

interface Resumen {
  users_total: number;
  users_24h: number;
  users_7d: number;
  businesses_total: number;
  businesses_24h: number;
  businesses_7d: number;
  kyc_pending: number;
  alerts_unsent: number;
  alerts_failed: number;
  recent_users: { id: string; name: string; handle: string | null; email: string | null; created_at: string; kyc_status: string; onboarding_completed: boolean; country: string | null }[];
  recent_businesses: { id: string; name: string; slug: string; vertical: string; subtype: string; city: string | null; country: string | null; status: string; created_at: string; owner_name: string | null; owner_email: string | null }[];
}

const ESTADO_KYC: Record<string, string> = { none: "Sin verificar", pending: "Verificación pendiente", verified: "Verificada", rejected: "Rechazada" };
const FECHA = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" });
const cuando = (iso: string) => FECHA.format(new Date(iso));

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: number; detalle: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{titulo}</p>
      <p className="mt-1 text-3xl font-black tabular-nums text-ink">{valor}</p>
      <p className="text-xs text-slate-500">{detalle}</p>
    </div>
  );
}

/**
 * Panel de administración: lo primero que ve el administrador. Muestra lo que necesita atención (verificaciones de identidad pendientes),
 * cuánta gente se registra y los últimos registros y negocios. Solo administradores (lo impone la base de datos).
 */
export default function AdminPage() {
  const { esAdmin, sesion } = useSocial();
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!esAdmin) return;
    avisarAlEquipo(); // envía ya los avisos que hubieran quedado sin mandar
    let vivo = true;
    void Promise.resolve(supabase().rpc("admin_overview")).then(({ data, error: e }) => {
      if (!vivo) return;
      if (e) setError(e.message);
      else setDatos(data as Resumen);
    });
    return () => {
      vivo = false;
    };
  }, [esAdmin]);

  if (!sesion.lista) return <div className="mx-auto h-64 max-w-5xl animate-pulse px-4 py-10" />;
  if (!esAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 text-xl font-bold">Acceso restringido</h1>
        <p className="mt-1 text-sm text-slate-500">Solo los administradores pueden entrar aquí.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-black text-ink">Panel de administración</h1>
      <p className="mb-5 mt-1 text-slate-500">Lo que necesita tu atención y cómo va la plataforma.</p>
      <NavAdmin actual="/admin" />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {!datos && !error && <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />}

      {datos && (
        <>
          <Link
            href="/admin/kyc"
            className={`mb-5 flex items-center justify-between gap-3 rounded-2xl border-2 p-5 transition ${datos.kyc_pending > 0 ? "border-amber-400 bg-amber-50 hover:bg-amber-100" : "border-slate-200 bg-white hover:border-brand-300"}`}
          >
            <span>
              <span className="block text-lg font-black text-ink">
                {datos.kyc_pending > 0 ? `${datos.kyc_pending} ${datos.kyc_pending === 1 ? "persona espera" : "personas esperan"} que verifiques su identidad` : "No hay verificaciones de identidad pendientes"}
              </span>
              <span className="text-sm text-slate-600">Compara su cédula con su selfie y su foto de perfil y apruébala o recházala.</span>
            </span>
            <span className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white">{datos.kyc_pending > 0 ? "Revisar ahora" : "Ver historial"}</span>
          </Link>

          {(datos.alerts_unsent > 0 || datos.alerts_failed > 0) && (
            <p role="status" className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {datos.alerts_failed > 0
                ? `${datos.alerts_failed} aviso${datos.alerts_failed === 1 ? "" : "s"} por correo no se pudo enviar tras varios intentos. `
                : `${datos.alerts_unsent} aviso${datos.alerts_unsent === 1 ? "" : "s"} por correo esperando salir. `}
              Comprueba que <code>RESEND_API_KEY</code> y <code>ADMIN_ALERT_EMAIL</code> estén configurados en el servidor.
            </p>
          )}

          <section aria-label="Cifras" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Cifra titulo="Registros hoy" valor={datos.users_24h} detalle="últimas 24 horas" />
            <Cifra titulo="Registros" valor={datos.users_7d} detalle="últimos 7 días" />
            <Cifra titulo="Personas" valor={datos.users_total} detalle="en total" />
            <Cifra titulo="Negocios hoy" valor={datos.businesses_24h} detalle="últimas 24 horas" />
            <Cifra titulo="Negocios" valor={datos.businesses_7d} detalle="últimos 7 días" />
            <Cifra titulo="Negocios" valor={datos.businesses_total} detalle="en total" />
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="ult-personas">
              <h2 id="ult-personas" className="text-lg font-black text-ink">
                Últimos registros
              </h2>
              {datos.recent_users.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Todavía no hay registros.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                  {datos.recent_users.map((u) => (
                    <li key={u.id} className="p-3 text-sm">
                      <p className="font-semibold text-ink">
                        {u.name} <span className="font-normal text-slate-400">{u.handle}</span>
                      </p>
                      <p className="break-all text-slate-600">{u.email ?? "—"}</p>
                      <p className="text-xs text-slate-500">
                        {cuando(u.created_at)} · {ESTADO_KYC[u.kyc_status] ?? u.kyc_status}
                        {u.country ? ` · ${u.country}` : ""}
                        {u.onboarding_completed ? " · perfil completo" : " · perfil sin completar"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="ult-negocios">
              <h2 id="ult-negocios" className="text-lg font-black text-ink">
                Últimos negocios
              </h2>
              {datos.recent_businesses.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Todavía no hay negocios registrados.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                  {datos.recent_businesses.map((b) => (
                    <li key={b.id} className="p-3 text-sm">
                      <Link href={`/directorio/${b.vertical}/${b.slug}`} className="font-semibold text-brand-700 hover:underline">
                        {b.name}
                      </Link>
                      <p className="text-slate-600">
                        {b.vertical} · {b.subtype}
                        {b.city ? ` · ${b.city}` : ""}
                        {b.country ? `, ${b.country}` : ""}
                      </p>
                      <p className="break-all text-xs text-slate-500">
                        {b.owner_name ?? "—"} · {b.owner_email ?? "—"} · {cuando(b.created_at)}
                        {b.status !== "active" ? ` · ${b.status}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
