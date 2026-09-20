/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { useAfinidades } from "@/features/conexion/hooks";
import { usePuestoTop } from "@/features/comunidad/hooks";
import Avatar from "@/components/Avatar";
import { VerificadoCheck } from "@/components/PerfilBadges";
import TopConectorBadge from "@/components/TopConectorBadge";

const MAX_TARJETAS = 10;
/** Motivos que tienen sentido en una amistad (los de pareja o astrales no). */
const MOTIVOS_UTILES = /zona|inter[eé]s|estilo|universidad|colegio|valores/i;

/**
 * «Personas que quizá conozcas»: carrusel de sugerencias con la afinidad real que calcula el servidor (recommend_people).
 * Excluye a quien ya es amistad o tiene una solicitud pendiente, y cada tarjeta se puede descartar.
 */
export default function SugerenciasAmistad() {
  const { estado, sesion, hidratado, usuarios, solicitarAmistad, responderSolicitud } = useSocial();
  const afinidades = useAfinidades();
  const puestoTop = usePuestoTop();
  const [descartadas, setDescartadas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState<string[]>([]);
  const carrusel = useRef<HTMLUListElement>(null);

  const tarjetas = useMemo(() => {
    const porId = new Map(usuarios.map((u) => [u.id, u]));
    return [...afinidades.values()]
      .sort((a, b) => b.puntaje - a.puntaje)
      .flatMap((rec) => {
        const usuario = porId.get(rec.id);
        if (!usuario || estado.amigos.includes(usuario.id) || descartadas.includes(usuario.id)) return [];
        const pendienteEnviada = estado.solicitudes.some((s) => s.deId === "yo" && s.paraId === usuario.id && s.estado === "pendiente");
        const recibida = estado.solicitudes.find((s) => s.deId === usuario.id && s.paraId === "yo" && s.estado === "pendiente");
        return [{ rec, usuario, pendienteEnviada, recibida }];
      })
      .slice(0, MAX_TARJETAS);
  }, [afinidades, usuarios, estado.amigos, estado.solicitudes, descartadas]);

  if (!hidratado) return null;

  if (!sesion.uid) {
    return (
      <section aria-labelledby="sugerencias-titulo" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="sugerencias-titulo" className="text-lg font-black text-ink">Personas que quizá conozcas</h2>
        <p className="mt-1 text-sm text-slate-600">Crea tu cuenta y te mostraremos a las personas de tu ciudad que más encajan contigo, con su porcentaje de afinidad.</p>
        <Link href="/registro" className="boton-marca mt-3 inline-block rounded-full px-6 py-2.5 text-sm font-bold text-white">
          Crear mi cuenta
        </Link>
      </section>
    );
  }

  if (tarjetas.length === 0) return null;

  const desplazar = (dir: 1 | -1) => carrusel.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  const agregar = async (id: string) => {
    setEnviando((l) => [...l, id]);
    await solicitarAmistad(id);
    setEnviando((l) => l.filter((x) => x !== id));
  };

  return (
    <section aria-labelledby="sugerencias-titulo" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 id="sugerencias-titulo" className="text-lg font-black text-ink">Personas que quizá conozcas</h2>
        <div className="hidden gap-1 sm:flex">
          <button type="button" onClick={() => desplazar(-1)} aria-label="Anteriores" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-brand-300">
            ‹
          </button>
          <button type="button" onClick={() => desplazar(1)} aria-label="Siguientes" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-brand-300">
            ›
          </button>
        </div>
      </div>

      <ul ref={carrusel} className="-mx-1 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {tarjetas.map(({ rec, usuario, pendienteEnviada, recibida }) => {
          const motivos = rec.motivos.filter((m) => MOTIVOS_UTILES.test(m)).slice(0, 2);
          const puesto = puestoTop(usuario.id);
          return (
            <li key={usuario.id} className="relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white sm:w-48">
              <button
                type="button"
                onClick={() => setDescartadas((l) => [...l, usuario.id])}
                aria-label={`Quitar a ${usuario.nombre} de las sugerencias`}
                className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white hover:bg-black/70"
              >
                ✕
              </button>
              <Link href={`/usuarios/${usuario.id}`} className="relative block aspect-square bg-slate-100" aria-label={`Ver el perfil de ${usuario.nombre}`}>
                {usuario.foto ? (
                  <img src={usuario.foto} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <Avatar nombre={usuario.nombre} tamano="xl" />
                  </span>
                )}
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-black tabular-nums text-brand-700 shadow" title="Afinidad contigo">
                  {rec.puntaje}% afín
                </span>
                {usuario.demo && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/75 px-2 py-0.5 text-[9px] font-bold uppercase text-white">Demo</span>}
              </Link>
              <div className="space-y-1.5 p-2.5">
                <Link href={`/usuarios/${usuario.id}`} className="flex items-center gap-1 text-sm font-extrabold text-ink hover:underline">
                  <span className="truncate">{usuario.nombre}</span>
                  {usuario.verificaciones.identidad && <VerificadoCheck className="h-3.5 w-3.5" />}
                </Link>
                {puesto !== null && <TopConectorBadge puesto={puesto} />}
                <p className="truncate text-[11px] text-slate-500">{usuario.ubicacion ? `📍 ${usuario.ubicacion}` : usuario.zonas.slice(0, 2).map((z) => `📍 ${z}`).join(" · ")}</p>
                <p className="min-h-[2rem] text-[11px] font-medium leading-tight text-emerald-700">{motivos.length > 0 ? motivos.join(" · ") : "Podrían llevarse bien"}</p>
                {recibida ? (
                  <button type="button" onClick={() => void responderSolicitud(recibida.id, true)} className="boton-marca w-full rounded-full py-1.5 text-xs font-bold text-white">
                    Aceptar solicitud
                  </button>
                ) : pendienteEnviada ? (
                  <span className="block w-full rounded-full bg-slate-100 py-1.5 text-center text-xs font-semibold text-slate-500">Solicitud enviada ✓</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void agregar(usuario.id)}
                    disabled={enviando.includes(usuario.id)}
                    className="w-full rounded-full border border-brand-600 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
                  >
                    Agregar a amigos
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Link href="/explorar" className="mt-1 block text-center text-sm font-bold text-brand-700 hover:underline">
        Ver todas las personas afines →
      </Link>
    </section>
  );
}
