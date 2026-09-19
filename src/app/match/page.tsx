"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import type { Anuncio } from "@/types/mercado";
import type { Usuario } from "@/types/social";
import { useSocial } from "@/context/SocialContext";
import { rompehielosAnuncio } from "@/lib/rompehielos";
import SwipeDeck, { type Direccion } from "@/components/SwipeDeck";
import MatchModal from "@/components/MatchModal";
import { ContenidoAnuncio } from "@/components/TarjetasSwipe";

type Filtro = "todos" | Anuncio["tipo"];

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todo" },
  { id: "propiedad", label: "🏡 Inmuebles" },
  { id: "vehiculo", label: "🚗 Vehículos" },
  { id: "negocio", label: "💼 Negocios" },
];

export default function MatchPage() {
  const router = useRouter();
  const { estado, hidratado, anuncios, obtenerUsuario, conectarAnuncio, pasarAnuncio, enviarMensaje, reiniciar } = useSocial();

  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [modal, setModal] = useState<{ anuncio: Anuncio; dueno: Usuario; cid: string } | null>(null);

  const mazo = useMemo(
    () =>
      anuncios.filter(
        (a) => a.duenoId !== "yo" && !estado.vistasProp.includes(a.id) && (filtro === "todos" || a.tipo === filtro),
      ),
    [anuncios, estado.vistasProp, filtro],
  );

  const alDeslizar = useCallback(
    async (anuncio: Anuncio, dir: Direccion) => {
      if (dir === "pass") return pasarAnuncio(anuncio.id);
      const dueno = obtenerUsuario(anuncio.duenoId);
      // Abre (o recupera) el chat con el dueño en el servidor y guarda la oferta.
      const cid = await conectarAnuncio(anuncio.id);
      if (!cid || !dueno) return;
      setModal({ anuncio, dueno, cid });
    },
    [pasarAnuncio, conectarAnuncio, obtenerUsuario],
  );

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
        <h1 className="text-3xl font-bold">Match de ofertas</h1>
        <p className="mt-1 text-slate-500">
          Desliza a la derecha para guardar y conectar con el dueño. ¿Buscas personas?{" "}
          <Link href="/citas" className="font-medium text-brand-600 hover:underline">
            Ve a Citas
          </Link>
          .
        </p>
      </header>

      <div className="mx-auto mb-8 flex max-w-md flex-wrap justify-center gap-2" role="group" aria-label="Filtrar ofertas">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              filtro === f.id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:border-brand-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!hidratado ? (
        <div className="mx-auto aspect-[3/4] w-full max-w-sm animate-pulse rounded-3xl bg-slate-200" />
      ) : mazo.length > 0 ? (
        <>
          <SwipeDeck
            mazo={mazo}
            onSwipe={alDeslizar}
            deshabilitado={modal !== null}
            etiquetaCard={(a) => `${a.titulo}, ${a.ubicacion}`}
            renderCard={(a, esTop) => <ContenidoAnuncio anuncio={a} dueno={obtenerUsuario(a.duenoId)} esTop={esTop} />}
            pie={(a) => (
              <Link href={a.href} className="text-brand-600 hover:underline">
                Ver ficha completa
              </Link>
            )}
          />
          <p className="mt-4 text-center text-xs text-slate-400">
            {mazo.length} {mazo.length === 1 ? "oferta restante" : "ofertas restantes"}
          </p>
        </>
      ) : (
        <div className="mx-auto max-w-sm rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-4xl">🎉</p>
          <h2 className="mt-3 text-xl font-bold">¡Has visto todas las ofertas!</h2>
          <p className="mt-2 text-sm text-slate-500">Guardaste {estado.guardadas.length}. Publica tu búsqueda para que te avisemos de nuevas coincidencias.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/publicar?modo=busco" className="rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700">
              Publicar lo que busco
            </Link>
            <button type="button" onClick={reiniciar} className="rounded-xl px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-100">
              Volver a ver todas las tarjetas
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <MatchModal
            key={modal.anuncio.id}
            otro={modal.dueno}
            imagen={modal.anuncio.imagen}
            descripcion={
              <>
                Guardaste <em>{modal.anuncio.titulo}</em> y ya puedes hablar con <strong>{modal.dueno.nombre}</strong>. Rompe el hielo:
              </>
            }
            opciones={rompehielosAnuncio(modal.anuncio, modal.dueno)}
            onCerrar={cerrarModal}
            onEnviar={enviarYAbrirChat}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
