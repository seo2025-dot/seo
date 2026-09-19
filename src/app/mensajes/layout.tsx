"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Conversacion, TipoConversacion } from "@/types/social";
import { useSocial } from "@/context/SocialContext";
import { formatearHora } from "@/lib/formato";
import { tiempoRelativo } from "@/lib/social";
import Avatar from "@/components/Avatar";
import { VerificadoCheck } from "@/components/PerfilBadges";

type Pestana = "todos" | "negociaciones" | "personas" | "servicios" | "solicitudes";

const EMOJI_TIPO: Record<TipoConversacion, string> = {
  propiedad: "🏡",
  vehiculo: "🚗",
  negocio: "💼",
  servicio: "🛠️",
  empleo: "📋",
  directo: "💬",
};

const PERTENECE: Record<Exclude<Pestana, "todos" | "solicitudes">, TipoConversacion[]> = {
  negociaciones: ["propiedad", "vehiculo", "negocio"],
  personas: ["directo"],
  servicios: ["servicio", "empleo"],
};

export default function MensajesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    estado,
    hidratado,
    obtenerUsuario,
    obtenerAnuncio,
    obtenerGig,
    obtenerVacante,
    enLinea,
    escribiendo,
    solicitudesPendientes,
    responderSolicitud,
    abrirChatDirecto,
  } = useSocial();

  const [pestana, setPestana] = useState<Pestana>("todos");
  const [busqueda, setBusqueda] = useState("");

  const cidActual = pathname.split("/")[2];
  const enChat = Boolean(cidActual);
  const q = busqueda.trim().toLowerCase();

  const tituloRef = (c: Conversacion) => {
    if (!c.refId) return undefined;
    if (c.tipo === "servicio") return obtenerGig(c.refId)?.titulo;
    if (c.tipo === "empleo") return obtenerVacante(c.refId)?.titulo;
    return obtenerAnuncio(c.refId)?.titulo;
  };

  const conversaciones = Object.values(estado.conversaciones)
    .filter((c) => {
      if (pestana !== "todos" && pestana !== "solicitudes" && !PERTENECE[pestana].includes(c.tipo)) return false;
      if (!q) return true;
      const otro = obtenerUsuario(c.usuarioId);
      return (otro?.nombre.toLowerCase().includes(q) ?? false) || (tituloRef(c)?.toLowerCase().includes(q) ?? false);
    })
    .sort((a, b) => b.actualizada - a.actualizada);

  const amigosEnLinea = estado.amigos.filter((id) => enLinea(id));
  const entrantes = estado.solicitudes.filter((s) => s.paraId === "yo" && s.estado === "pendiente");
  const salientes = estado.solicitudes.filter((s) => s.deId === "yo" && s.estado === "pendiente");

  const abrirDm = async (id: string) => {
    const cid = await abrirChatDirecto(id);
    if (cid) router.push(`/mensajes/${cid}`);
  };

  const pestanas: { id: Pestana; label: string; n?: number }[] = [
    { id: "todos", label: "Todos" },
    { id: "negociaciones", label: "Negociaciones" },
    { id: "personas", label: "Citas y amigos" },
    { id: "servicios", label: "Servicios" },
    { id: "solicitudes", label: "Solicitudes", n: solicitudesPendientes },
  ];

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-6xl overflow-hidden border-slate-200 md:border-x lg:h-[calc(100dvh-4rem)]">
      <aside
        className={`${enChat ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-slate-200 md:w-96`}
        aria-label="Conversaciones"
      >
        <div className="space-y-3 p-4 pb-2">
          <h1 className="text-2xl font-bold">Mensajes</h1>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar personas, ofertas o servicios…"
            aria-label="Buscar conversaciones"
            className="w-full rounded-full bg-slate-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {pestanas.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={pestana === t.id}
                onClick={() => setPestana(t.id)}
                className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  pestana === t.id ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t.label}
                {t.n ? <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">{t.n}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {hidratado && amigosEnLinea.length > 0 && pestana !== "solicitudes" && (
          <div className="border-b border-slate-100 px-4 pb-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Activos ahora</p>
            <div className="flex gap-3 overflow-x-auto">
              {amigosEnLinea.map((id) => {
                const u = obtenerUsuario(id);
                if (!u) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => abrirDm(id)}
                    className="flex w-14 shrink-0 flex-col items-center gap-1 text-[11px] text-slate-600"
                    aria-label={`Chatear con ${u.nombre}, en línea`}
                  >
                    <Avatar nombre={u.nombre} enLinea />
                    <span className="w-full truncate">{u.nombre.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {!hidratado ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : pestana === "solicitudes" ? (
            <div className="space-y-4 p-4">
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recibidas</h2>
                {entrantes.length === 0 ? (
                  <p className="text-sm text-slate-500">No tienes solicitudes pendientes.</p>
                ) : (
                  <ul className="space-y-3">
                    {entrantes.map((s) => {
                      const u = obtenerUsuario(s.deId);
                      if (!u) return null;
                      return (
                        <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center gap-3">
                            <Link href={`/usuarios/${u.id}`}>
                              <Avatar nombre={u.nombre} enLinea={enLinea(u.id)} />
                            </Link>
                            <div className="min-w-0 flex-1">
                              <Link href={`/usuarios/${u.id}`} className="flex items-center gap-1 truncate text-sm font-semibold hover:underline">
                                {u.nombre}
                                {u.verificaciones.identidad && <VerificadoCheck className="h-3.5 w-3.5" />}
                              </Link>
                              <p className="truncate text-xs text-slate-500">
                                {u.zonas.join(" · ")} · {tiempoRelativo(s.ts)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button type="button" onClick={() => responderSolicitud(s.id, true)} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
                              Aceptar
                            </button>
                            <button type="button" onClick={() => responderSolicitud(s.id, false)} className="flex-1 rounded-lg bg-slate-100 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">
                              Rechazar
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              {salientes.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Enviadas</h2>
                  <ul className="space-y-2">
                    {salientes.map((s) => {
                      const u = obtenerUsuario(s.paraId);
                      if (!u) return null;
                      return (
                        <li key={s.id} className="flex items-center gap-3 rounded-xl p-2">
                          <Avatar nombre={u.nombre} tamano="sm" />
                          <span className="flex-1 truncate text-sm">{u.nombre}</span>
                          <span className="text-xs text-slate-400">Pendiente</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <ul>
              {conversaciones.map((c) => {
                const otro = obtenerUsuario(c.usuarioId);
                if (!otro) return null;
                const titulo = tituloRef(c);
                const ultimo = c.mensajes[c.mensajes.length - 1];
                const activa = cidActual === c.id;
                const escribe = escribiendo[c.id];
                const vista =
                  ultimo?.tipo === "oferta" ? `💰 ${ultimo.texto}` : ultimo?.tipo === "cotizacion" ? "📄 Cotización recibida" : ultimo?.texto ?? "";
                return (
                  <li key={c.id}>
                    <Link
                      href={`/mensajes/${c.id}`}
                      aria-current={activa ? "page" : undefined}
                      className={`flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 ${activa ? "bg-brand-50" : ""}`}
                    >
                      <Avatar nombre={otro.nombre} foto={otro.foto} enLinea={enLinea(otro.id)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`flex items-center gap-1 truncate text-sm ${c.noLeidos > 0 ? "font-bold" : "font-semibold"}`}>
                            <span className="truncate">{otro.nombre}</span>
                            {otro.verificaciones.identidad && <VerificadoCheck className="h-3.5 w-3.5" />}
                            {c.origen === "cita" && <span title="Match de citas">💘</span>}
                          </p>
                          <time className="shrink-0 text-[11px] text-slate-400">{formatearHora(c.actualizada)}</time>
                        </div>
                        {titulo && (
                          <p className="truncate text-[11px] text-brand-600">
                            {EMOJI_TIPO[c.tipo]} {titulo}
                          </p>
                        )}
                        <p className={`truncate text-sm ${escribe ? "italic text-emerald-600" : c.noLeidos > 0 ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                          {escribe ? "escribiendo…" : `${ultimo?.autor === "yo" ? "Tú: " : ""}${vista}`}
                        </p>
                      </div>
                      {c.noLeidos > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white" aria-label={`${c.noLeidos} mensajes sin leer`}>
                          {c.noLeidos}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}

              {pestana === "personas" &&
                estado.amigos
                  .filter((id) => !Object.values(estado.conversaciones).some((c) => c.tipo === "directo" && c.usuarioId === id))
                  .map((id) => {
                    const u = obtenerUsuario(id);
                    if (!u || (q && !u.nombre.toLowerCase().includes(q))) return null;
                    return (
                      <li key={id}>
                        <button type="button" onClick={() => abrirDm(id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
                          <Avatar nombre={u.nombre} enLinea={enLinea(id)} />
                          <div>
                            <p className="text-sm font-semibold">{u.nombre}</p>
                            <p className="text-xs text-slate-500">Iniciar conversación</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}

              {conversaciones.length === 0 && (
                <li className="p-8 text-center">
                  <p className="text-3xl">💬</p>
                  <p className="mt-2 text-sm text-slate-500">{q ? "Sin resultados para tu búsqueda." : "Aún no hay conversaciones aquí."}</p>
                  {!q && (
                    <Link href="/match" className="mt-4 inline-block rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                      Hacer match
                    </Link>
                  )}
                </li>
              )}
            </ul>
          )}
        </div>
      </aside>

      <section className={`${enChat ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>{children}</section>
    </div>
  );
}
