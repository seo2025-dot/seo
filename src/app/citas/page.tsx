"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import type { Signo, TipoRelacion, Usuario } from "@/types/social";
import { ESTILOS_VIDA } from "@/data/catalogos";
import { useSocial } from "@/context/SocialContext";
import { SIGNOS } from "@/lib/astrologia";
import { rompehielosPersona } from "@/lib/rompehielos";
import { compatibilidad, ETIQUETA_RELACION, primerNombre } from "@/lib/social";
import SwipeDeck, { type Direccion } from "@/components/SwipeDeck";
import MatchModal from "@/components/MatchModal";
import { ContenidoPersona } from "@/components/TarjetasSwipe";
import Icono from "@/components/Icono";

const RELACIONES: (TipoRelacion | "todas")[] = ["todas", "pareja", "amistad", "roomie", "socios"];

const selectCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export default function CitasPage() {
  const router = useRouter();
  const { estado, hidratado, usuarios, likePersona, superLikePersona, pasarPersona, enviarMensaje, reiniciar } = useSocial();

  const [relacion, setRelacion] = useState<TipoRelacion | "todas">("todas");
  const [signo, setSigno] = useState<Signo | "">("");
  const [estilo, setEstilo] = useState("");
  const [modal, setModal] = useState<{ persona: Usuario; cid: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const mazo = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          !estado.amigos.includes(u.id) &&
          !estado.vistasPersonas.includes(u.id) &&
          (u.relaciones?.length ?? 0) > 0 &&
          (relacion === "todas" || u.relaciones?.includes(relacion)) &&
          (!signo || u.signo === signo) &&
          (!estilo || u.estilo?.includes(estilo)),
      ).sort((a, b) => compatibilidad(estado.yo, b).puntaje - compatibilidad(estado.yo, a).puntaje),
    [usuarios, estado.amigos, estado.vistasPersonas, estado.yo, relacion, signo, estilo],
  );

  const contexto: TipoRelacion = relacion === "todas" ? "pareja" : relacion;

  const alDeslizar = useCallback(
    async (persona: Usuario, dir: Direccion) => {
      if (dir === "pass") return pasarPersona(persona.id);
      // El match solo existe si la otra persona ya te dio like (lo decide el servidor).
      const r = await likePersona(persona.id, contexto);
      if (r.resultado === "match" && r.chatId) setModal({ persona, cid: r.chatId });
      else if (r.resultado === "enviado") setAviso(`Le diste like a ${primerNombre(persona.nombre)}. Te avisaremos si hay match 💌`);
    },
    [pasarPersona, likePersona, contexto],
  );

  const superLike = async () => {
    const top = mazo[0];
    if (!top || modal) return;
    const r = await superLikePersona(top.id, contexto);
    if (r.resultado === "match" && r.chatId) setModal({ persona: top, cid: r.chatId });
    else if (r.resultado === "enviado") setAviso(`⭐ Super Like enviado: ${primerNombre(top.nombre)} recibe un aviso al instante. Si te devuelve el like, habrá match.`);
    else if (r.resultado === "sin-superlikes") setAviso("No te quedan Super Likes. Canjéalos con monedas en Recompensas 💰");
  };

  const cerrarModal = useCallback(() => setModal(null), []);

  const enviarYAbrirChat = useCallback(
    async (texto: string) => {
      if (!modal) return;
      await enviarMensaje(modal.cid, texto);
      router.push(`/mensajes/${modal.cid}`);
    },
    [modal, enviarMensaje, router],
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold">Citas y conexiones</h1>
        <p className="mt-1 text-slate-500">Pareja, amistad, roomies o socios: encuentra a tu gente con afinidad astral incluida ✨</p>
      </header>

      <div className="mx-auto mb-6 max-w-2xl space-y-3">
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Tipo de relación">
          {RELACIONES.map((r) => (
            <button
              key={r}
              onClick={() => setRelacion(r)}
              aria-pressed={relacion === r}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                relacion === r ? "border-pink-600 bg-pink-600 text-white" : "border-slate-200 text-slate-600 hover:border-pink-300"
              }`}
            >
              {r === "todas" ? "Todas" : ETIQUETA_RELACION[r]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <select aria-label="Signo zodiacal" value={signo} onChange={(e) => setSigno(e.target.value as Signo | "")} className={selectCls}>
            <option value="">Todos los signos</option>
            {SIGNOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.simbolo} {s.nombre}
              </option>
            ))}
          </select>
          <select aria-label="Estilo de vida" value={estilo} onChange={(e) => setEstilo(e.target.value)} className={selectCls}>
            <option value="">Cualquier estilo de vida</option>
            {ESTILOS_VIDA.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {!estado.yo.signo && (
          <p className="rounded-xl bg-violet-50 p-3 text-center text-sm text-violet-800">
            Añade tu fecha de nacimiento en{" "}
            <Link href="/astrologia" className="font-semibold underline">
              Astrología
            </Link>{" "}
            para ver tu compatibilidad astral con cada persona.
          </p>
        )}
      </div>

      {!hidratado ? (
        <div className="mx-auto aspect-[3/4] w-full max-w-sm animate-pulse rounded-3xl bg-slate-200" />
      ) : mazo.length > 0 ? (
        <>
          <SwipeDeck
            mazo={mazo}
            onSwipe={alDeslizar}
            deshabilitado={modal !== null}
            etiquetaCard={(u) => `${u.nombre}, ${u.ubicacion}`}
            renderCard={(u) => <ContenidoPersona persona={u} yo={estado.yo} contexto={contexto} modoCita />}
            pie={(u) => (
              <Link href={`/usuarios/${u.id}`} className="text-brand-600 hover:underline">
                Ver perfil completo
              </Link>
            )}
          />
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={superLike}
              className="flex items-center gap-2 rounded-full boton-marca px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:scale-105"
            >
              <Icono nombre="astrologia" className="h-4 w-4" relleno /> Super Like ({estado.superLikes})
            </button>
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-sm rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-4xl">💫</p>
          <h2 className="mt-3 text-xl font-bold">No hay más personas con estos filtros</h2>
          <p className="mt-2 text-sm text-slate-500">Prueba con otros filtros o vuelve a ver a quienes descartaste.</p>
          <button type="button" onClick={reiniciar} className="mt-6 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700">
            Volver a ver tarjetas
          </button>
        </div>
      )}

      {aviso && (
        <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm text-white shadow-xl md:bottom-8">
          {aviso}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <MatchModal
            key={modal.persona.id}
            otro={modal.persona}
            yo={estado.yo}
            descripcion={
              <>
                <strong>{modal.persona.nombre}</strong> también quiere conectar contigo. Ya pueden chatear: rompe el hielo.
              </>
            }
            opciones={rompehielosPersona(estado.yo, modal.persona)}
            onCerrar={cerrarModal}
            onEnviar={enviarYAbrirChat}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
