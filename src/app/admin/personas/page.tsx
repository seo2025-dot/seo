/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import Visor from "@/features/fotos/Visor";
import type { FotoGuardada } from "@/features/fotos/tipos";
import { fotosDeVarios } from "@/features/fotos/useFotosPerfil";
import { supabase } from "@/lib/supabaseClient";

interface Persona {
  id: string;
  display_name: string;
  handle: string;
  location: string | null;
  bio: string | null;
}

type Accion = "like" | "super" | "pass" | "friend_request" | "message";

const ETIQUETAS: Record<Accion, string> = {
  like: "❤️ Me gustas",
  super: "⭐ Superlike",
  pass: "✕ Descartar",
  friend_request: "🤝 Solicitud de amistad",
  message: "💬 Enviar mensaje",
};

const RESULTADOS: Record<string, string> = {
  liked: "Le ha dado like a tu perfil. Si tú también le das like, habrá match.",
  match: "¡Es un match!",
  passed: "Te ha descartado.",
  superliked: "Te ha dado superlike.",
  sent: "Solicitud de amistad enviada.",
  already: "Ya había una interacción previa.",
};

/**
 * Persona Engine (administración): lista las personas simuladas (perfiles demo con su galería de 10 fotos) y permite
 * hacer que interactúen contigo (like, superlike, amistad, mensaje) para probar notificaciones, matches y chat.
 * Las acciones las ejecuta la función `admin_simulate`, que la base de datos limita a administradores y a perfiles demo.
 */
export default function AdminPersonasPage() {
  const { esAdmin, sesion } = useSocial();
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [galerias, setGalerias] = useState<Record<string, FotoGuardada[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [texto, setTexto] = useState<Record<string, string>>({});
  const [visor, setVisor] = useState<{ fotos: FotoGuardada[]; inicio: number } | null>(null);

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase().from("profiles").select("id, display_name, handle, location, bio").eq("is_demo", true).order("display_name");
    if (e) return setError(e.message);
    const lista = (data ?? []) as Persona[];
    setPersonas(lista);
    setGalerias(await fotosDeVarios(lista.map((p) => p.id)));
  }, []);

  useEffect(() => {
    if (esAdmin) void cargar();
  }, [esAdmin, cargar]);

  const totalFotos = useMemo(() => Object.values(galerias).reduce((n, g) => n + g.length, 0), [galerias]);
  const completas = useMemo(() => Object.values(galerias).filter((g) => g.length === 10).length, [galerias]);

  const simular = async (p: Persona, accion: Accion) => {
    if (!sesion.uid) return;
    setOcupado(`${p.id}:${accion}`);
    setError(null);
    setAviso(null);
    const cuerpo = accion === "message" ? (texto[p.id] ?? "").trim() || "¡Hola! Vi tu perfil y me gustaron tus fotos 😊" : null;
    const { data, error: e } = await supabase().rpc("admin_simulate", { p_persona: p.id, p_action: accion, p_target: sesion.uid, p_body: cuerpo });
    setOcupado(null);
    if (e) {
      setError(/no_chat/.test(e.message) ? `${p.display_name} aún no tiene un chat contigo: primero hace falta un match o una amistad.` : e.message);
      return;
    }
    const r = (data as { result?: string } | null)?.result;
    setAviso(`${p.display_name}: ${accion === "message" ? "mensaje enviado." : (r && RESULTADOS[r]) || "hecho."}`);
  };

  if (!sesion.lista) return <div className="mx-auto h-64 max-w-5xl animate-pulse px-4 py-10" />;

  if (!esAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 text-xl font-bold">Acceso restringido</h1>
        <p className="mt-1 text-sm text-slate-500">Solo los administradores pueden usar el simulador de personas.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Persona Engine</h1>
          <p className="mt-1 text-slate-500">Personas simuladas con su galería. Haz que interactúen contigo para probar matches, notificaciones y chat.</p>
        </div>
        {personas && (
          <dl className="flex gap-4 text-center text-sm">
            <div>
              <dt className="text-slate-500">Personas</dt>
              <dd className="text-xl font-bold">{personas.length}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Fotos</dt>
              <dd className="text-xl font-bold">{totalFotos}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Con 10 fotos</dt>
              <dd className="text-xl font-bold">{completas}</dd>
            </div>
          </dl>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {aviso}
        </p>
      )}

      {personas === null ? (
        <div className="mt-6 h-48 animate-pulse rounded-2xl bg-slate-100" />
      ) : personas.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No hay personas simuladas. Ejecuta <code className="rounded bg-slate-100 px-1">supabase/seed_personas.sql</code> en el SQL Editor (o genera más con <code className="rounded bg-slate-100 px-1">npx tsx supabase/seed/personas.ts --count 20</code>).
        </p>
      ) : (
        <ul className="mt-6 space-y-6">
          {personas.map((p) => {
            const fotos = galerias[p.id] ?? [];
            return (
              <li key={p.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/usuarios/${encodeURIComponent(p.id)}`} className="font-semibold hover:underline">
                      {p.display_name}
                    </Link>{" "}
                    <span className="text-sm text-slate-400">
                      {p.handle}
                      {p.location ? ` · ${p.location}` : ""}
                    </span>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${fotos.length === 10 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{fotos.length}/10 fotos</span>
                </div>
                {p.bio && <p className="mt-1 text-sm text-slate-600">{p.bio}</p>}

                {fotos.length > 0 && (
                  <ul className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                    {fotos.map((f, i) => (
                      <li key={f.id}>
                        <button type="button" onClick={() => setVisor({ fotos, inicio: i })} aria-label={`Ver foto ${i + 1} de ${p.display_name}`} className="block aspect-[4/5] w-full overflow-hidden rounded-md bg-slate-100 ring-brand-400 hover:ring-2">
                          <img src={f.thumbUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {(["like", "super", "pass", "friend_request"] as Accion[]).map((a) => (
                    <button key={a} type="button" disabled={ocupado !== null} onClick={() => simular(p, a)} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                      {ETIQUETAS[a]}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={texto[p.id] ?? ""}
                    onChange={(e) => setTexto((t) => ({ ...t, [p.id]: e.target.value }))}
                    maxLength={500}
                    placeholder="Mensaje (por defecto, un saludo)"
                    aria-label={`Mensaje de ${p.display_name}`}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <button type="button" disabled={ocupado !== null} onClick={() => simular(p, "message")} className="shrink-0 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                    {ETIQUETAS.message}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {visor && <Visor fotos={visor.fotos} inicio={visor.inicio} onCerrar={() => setVisor(null)} />}
    </div>
  );
}
