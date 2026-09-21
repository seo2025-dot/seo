"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import type { Mensaje, TipoRelacion } from "@/types/social";
import { precioFinal } from "@/lib/anuncios";
import { formatearHora, formatearPrecio } from "@/lib/formato";
import { RESPUESTAS_RAPIDAS } from "@/lib/rompehielos";
import Avatar from "@/components/Avatar";
import Icono from "@/components/Icono";
import { AvisoMensajesCita } from "@/features/monedas/Piezas";
import { AstralBadge, ConfianzaBadge, VerificadoCheck } from "@/components/PerfilBadges";

const ESTADO_OFERTA: Record<NonNullable<Mensaje["estado"]>, { texto: string; clases: string }> = {
  pendiente: { texto: "Pendiente", clases: "bg-amber-100 text-amber-800" },
  aceptada: { texto: "Aceptada ✓", clases: "bg-emerald-100 text-emerald-800" },
  rechazada: { texto: "Rechazada", clases: "bg-rose-100 text-rose-800" },
  contraoferta: { texto: "Contraoferta recibida", clases: "bg-sky-100 text-sky-800" },
};

function TarjetaNegociacion({ mensaje, onResponder }: { mensaje: Mensaje; onResponder: (aceptar: boolean) => void }) {
  const mio = mensaje.autor === "yo";
  const esCotizacion = mensaje.tipo === "cotizacion";
  const estado = ESTADO_OFERTA[mensaje.estado ?? "pendiente"];
  return (
    <div className={`flex ${mio ? "justify-end" : "justify-start"}`}>
      <div className="w-72 max-w-[85%] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`px-4 py-2 text-xs font-bold ${esCotizacion ? "bg-violet-600 text-white" : "bg-brand-600 text-white"}`}>
          {esCotizacion ? "📄 Cotización" : mio ? "💰 Tu oferta" : "💰 Oferta recibida"}
        </div>
        <div className="space-y-1 p-4">
          {mensaje.monto !== undefined && mensaje.moneda && (
            <p className="text-2xl font-extrabold text-slate-900">{formatearPrecio(mensaje.monto, mensaje.moneda)}</p>
          )}
          {mensaje.dias && <p className="text-sm text-slate-500">Entrega en {mensaje.dias} día(s)</p>}
          <p className="text-sm text-slate-600">{mensaje.texto}</p>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${estado.clases}`}>{estado.texto}</span>
        </div>
        {!mio && mensaje.estado === "pendiente" && (
          <div className="flex gap-2 border-t border-slate-100 p-3">
            <button type="button" onClick={() => onResponder(true)} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Aceptar
            </button>
            <button type="button" onClick={() => onResponder(false)} className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">
              Rechazar
            </button>
          </div>
        )}
        <time className="block px-4 pb-2 text-right text-[10px] text-slate-400">{formatearHora(mensaje.ts)}</time>
      </div>
    </div>
  );
}

function Burbuja({
  mensaje,
  nombre,
  foto,
  mostrarAvatar,
  onResponder,
}: {
  mensaje: Mensaje;
  nombre: string;
  foto?: string;
  mostrarAvatar: boolean;
  onResponder: (aceptar: boolean) => void;
}) {
  if (mensaje.autor === "sistema") {
    return (
      <p className="mx-auto max-w-xs rounded-full bg-emerald-50 px-4 py-1.5 text-center text-xs font-medium text-emerald-700">{mensaje.texto}</p>
    );
  }
  if (mensaje.tipo) return <TarjetaNegociacion mensaje={mensaje} onResponder={onResponder} />;

  const mio = mensaje.autor === "yo";
  return (
    <div className={`flex items-end gap-2 ${mio ? "justify-end" : "justify-start"}`}>
      {!mio && (mostrarAvatar ? <Avatar nombre={nombre} foto={foto} tamano="xs" /> : <span className="w-7 shrink-0" />)}
      <div className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm ${mio ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-slate-100 text-slate-800"}`}>
        <p className="whitespace-pre-wrap break-words">{mensaje.texto}</p>
        <time className={`mt-1 block text-right text-[10px] ${mio ? "text-brand-100" : "text-slate-400"}`}>{formatearHora(mensaje.ts)}</time>
      </div>
    </div>
  );
}

function Escribiendo({ nombre, foto }: { nombre: string; foto?: string }) {
  return (
    <div className="flex items-end gap-2" role="status" aria-label={`${nombre} está escribiendo`}>
      <Avatar nombre={nombre} foto={foto} tamano="xs" />
      <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { cid } = useParams<{ cid: string }>();
  const {
    estado,
    hidratado,
    escribiendo,
    enLinea,
    obtenerUsuario,
    obtenerAnuncio,
    obtenerGig,
    obtenerVacante,
    enviarMensaje,
    hacerOferta,
    responderOferta,
    leer,
    privadoListo,
    cargarChat,
    suscribirEscritura,
    avisarEscribiendo,
    enviarCotizacion,
  } = useSocial();
  const [borrador, setBorrador] = useState("");
  const [ofertando, setOfertando] = useState(false);
  const [monto, setMonto] = useState("");
  const [cotizando, setCotizando] = useState(false);
  const [montoCotiza, setMontoCotiza] = useState("");
  const [diasCotiza, setDiasCotiza] = useState("3");
  const fondo = useRef<HTMLDivElement>(null);

  const conv = estado.conversaciones[cid];
  const total = conv?.mensajes.length ?? 0;
  const noLeidos = conv?.noLeidos ?? 0;
  const otro = conv?.usuarioId ? obtenerUsuario(conv.usuarioId) : undefined;
  const otroEscribiendo = escribiendo[cid] ?? false;

  const anuncio = conv && (conv.tipo === "propiedad" || conv.tipo === "vehiculo" || conv.tipo === "negocio") && conv.refId ? obtenerAnuncio(conv.refId) : undefined;
  const gig = conv?.tipo === "servicio" && conv.refId ? obtenerGig(conv.refId) : undefined;
  const vacante = conv?.tipo === "empleo" && conv.refId ? obtenerVacante(conv.refId) : undefined;
  const soyComprador = !!anuncio && anuncio.duenoId !== "yo";
  const soyFreelancer = !!gig && gig.autorId === "yo";

  // Historial completo + indicador de escritura en tiempo real mientras el chat está abierto.
  useEffect(() => {
    if (!privadoListo) return;
    void cargarChat(cid);
    return suscribirEscritura(cid);
  }, [privadoListo, cid, cargarChat, suscribirEscritura]);

  useEffect(() => {
    if (noLeidos > 0) leer(cid);
  }, [noLeidos, cid, leer]);

  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [total, otroEscribiendo, cid]);

  if (!hidratado || !privadoListo) return <div className="h-full animate-pulse bg-slate-50" />;

  if (!conv || !otro) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-4xl">🔍</p>
        <h2 className="mt-3 text-xl font-bold">Conversación no encontrada</h2>
        <p className="mt-1 text-sm text-slate-500">Haz match o contacta con alguien para empezar a chatear.</p>
        <Link href="/match" className="mt-6 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700">
          Ir a Match
        </Link>
      </div>
    );
  }

  const conectado = enLinea(otro.id);
  const contextoAstral: TipoRelacion = conv.tipo === "directo" ? (conv.origen === "cita" ? "pareja" : "amistad") : "socios";
  const rapidas = conv.tipo === "directo" ? RESPUESTAS_RAPIDAS.directo : conv.tipo === "servicio" ? RESPUESTAS_RAPIDAS.servicio : conv.tipo === "empleo" ? RESPUESTAS_RAPIDAS.empleo : RESPUESTAS_RAPIDAS.anuncio;

  const enviar = (texto: string) => {
    enviarMensaje(cid, texto);
    setBorrador("");
  };
  // Solo las citas y los matches cuentan mensajes: 3 gratis por conversación y después 1 moneda cada 5.
  const escritos = conv.origen ? conv.mensajes.filter((m) => m.autor === "yo" && !m.tipo).length : 0;

  const enviarCotizar = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(montoCotiza);
    const d = Number(diasCotiza);
    if (!(n > 0) || !(d >= 1)) return;
    await enviarCotizacion(cid, n, d);
    setMontoCotiza("");
    setCotizando(false);
  };

  const enviarOferta = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(monto);
    if (!(n > 0)) return;
    hacerOferta(cid, n);
    setMonto("");
    setOfertando(false);
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Link href="/mensajes" aria-label="Volver a mensajes" className="text-slate-500 hover:text-brand-600 md:hidden">
          <Icono nombre="atras" />
        </Link>
        <Link href={`/usuarios/${otro.id}`}>
          <Avatar nombre={otro.nombre} foto={otro.foto} enLinea={conectado} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/usuarios/${otro.id}`} className="flex items-center gap-1.5 font-semibold hover:underline">
            <span className="truncate">{otro.nombre}</span>
            {otro.verificaciones.identidad && <VerificadoCheck />}
          </Link>
          <p className={`truncate text-xs ${otroEscribiendo || conectado ? "text-emerald-600" : "text-slate-400"}`}>
            {otroEscribiendo ? "escribiendo…" : conectado ? "En línea" : "Desconectado"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ConfianzaBadge usuario={otro} compacto />
          <AstralBadge yo={estado.yo} otro={otro} contexto={contextoAstral} compacto />
        </div>
      </header>

      {anuncio && (
        <Link href={anuncio.href} className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 transition hover:bg-slate-100">
          <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md">
            <Image src={anuncio.imagen} alt="" fill sizes="56px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{anuncio.titulo}</p>
            <p className="text-xs text-slate-500">
              {formatearPrecio(precioFinal(anuncio), anuncio.moneda)}
              {anuncio.operacion === "alquiler" && " /período"} · {anuncio.ubicacion}
            </p>
          </div>
          <span className="text-xs font-medium text-brand-600">Ver</span>
        </Link>
      )}
      {gig && (
        <Link href="/empleos" className="flex items-center gap-3 border-b border-slate-100 bg-violet-50 px-4 py-2 hover:bg-violet-100">
          <span className="text-2xl">🛠️</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{gig.titulo}</p>
            <p className="text-xs text-slate-500">Desde {formatearPrecio(gig.precioDesde, gig.moneda)} · entrega en {gig.entregaDias} d</p>
          </div>
        </Link>
      )}
      {vacante && (
        <Link href="/empleos" className="flex items-center gap-3 border-b border-slate-100 bg-emerald-50 px-4 py-2 hover:bg-emerald-100">
          <span className="text-2xl">📋</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{vacante.titulo}</p>
            <p className="text-xs text-slate-500">{vacante.presupuesto}</p>
          </div>
        </Link>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4" aria-live="polite">
        {conv.mensajes.map((m, i) => (
          <Burbuja
            key={m.id}
            mensaje={m}
            nombre={otro.nombre}
            foto={otro.foto}
            mostrarAvatar={conv.mensajes[i - 1]?.autor !== "otro"}
            onResponder={(aceptar) => responderOferta(cid, m.id, aceptar)}
          />
        ))}
        {otroEscribiendo && <Escribiendo nombre={otro.nombre} foto={otro.foto} />}
        <div ref={fondo} />
      </div>

      <div className="border-t border-slate-200 p-3">
        {ofertando && anuncio && (
          <form onSubmit={enviarOferta} className="mb-2 flex items-center gap-2 rounded-xl bg-brand-50 p-2">
            <label htmlFor="monto-oferta" className="pl-2 text-sm font-medium text-brand-800">
              Mi oferta ({anuncio.moneda})
            </label>
            <input
              id="monto-oferta"
              type="number"
              min="1"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder={String(precioFinal(anuncio))}
              autoFocus
              className="w-32 flex-1 rounded-lg border border-brand-200 px-3 py-1.5 text-sm"
            />
            <button type="submit" disabled={!(Number(monto) > 0)} className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
              Enviar
            </button>
            <button type="button" onClick={() => setOfertando(false)} aria-label="Cancelar oferta" className="px-2 text-slate-500">
              ✕
            </button>
          </form>
        )}
        {cotizando && gig && (
          <form onSubmit={enviarCotizar} className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 p-2">
            <label htmlFor="monto-cotiza" className="pl-2 text-sm font-medium text-violet-800">
              Cotización ({gig.moneda})
            </label>
            <input id="monto-cotiza" type="number" min="1" value={montoCotiza} onChange={(e) => setMontoCotiza(e.target.value)} placeholder={String(gig.precioDesde)} autoFocus className="w-28 rounded-lg border border-violet-200 px-3 py-1.5 text-sm" />
            <label htmlFor="dias-cotiza" className="text-sm text-violet-800">Días</label>
            <input id="dias-cotiza" type="number" min="1" value={diasCotiza} onChange={(e) => setDiasCotiza(e.target.value)} className="w-16 rounded-lg border border-violet-200 px-3 py-1.5 text-sm" />
            <button type="submit" disabled={!(Number(montoCotiza) > 0) || !(Number(diasCotiza) >= 1)} className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
              Enviar
            </button>
            <button type="button" onClick={() => setCotizando(false)} aria-label="Cancelar cotización" className="px-2 text-slate-500">
              ✕
            </button>
          </form>
        )}
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {soyFreelancer && !cotizando && (
            <button type="button" onClick={() => setCotizando(true)} className="shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
              📄 Enviar cotización
            </button>
          )}
          {soyComprador && !ofertando && (
            <button type="button" onClick={() => setOfertando(true)} className="shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
              💰 Hacer oferta
            </button>
          )}
          {rapidas.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => enviar(r.replace(/^\p{Extended_Pictographic}️?\s*/u, ""))}
              className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-brand-500 hover:text-brand-600"
            >
              {r}
            </button>
          ))}
        </div>
        {conv.origen && <AvisoMensajesCita escritos={escritos} />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(borrador);
          }}
          className="flex gap-2"
        >
          <input
            value={borrador}
            onChange={(e) => {
              setBorrador(e.target.value);
              avisarEscribiendo(cid);
            }}
            placeholder="Escribe un mensaje…"
            aria-label="Mensaje"
            className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="submit"
            disabled={!borrador.trim()}
            aria-label="Enviar mensaje"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            <Icono nombre="enviar" className="h-4 w-4" />
          </button>
        </form>
      </div>
    </>
  );
}
