import Link from "next/link";
import type { Vertical } from "@/data/directorio";
import { ZONAS } from "@/data/catalogos";

/** Tarjeta de una sección en el hub. Las que aún no tienen interfaz se muestran como «Muy pronto». */
export function TarjetaSeccion({ v, negocios, verificados }: { v: Vertical; negocios?: number; verificados?: number }) {
  const contenido = (
    <>
      <span className="emoji-vivo text-5xl">{v.emoji}</span>
      <span className="mt-auto pt-4 text-xl font-black leading-tight">{v.etiqueta}</span>
      <span className="mt-1 text-xs font-medium text-white/90">{v.lema}</span>
      <span className="mt-3 self-start rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-bold">
        {!v.activa ? "Muy pronto" : negocios === undefined ? "Explorar" : negocios === 0 ? "Sé el primero en aparecer" : `${negocios} ${negocios === 1 ? "negocio" : "negocios"}${verificados ? ` · ${verificados} verificado${verificados === 1 ? "" : "s"}` : ""}`}
      </span>
    </>
  );
  const clases = `flex h-full min-h-44 flex-col rounded-3xl bg-gradient-to-br ${v.degradado} p-5 text-white shadow-lg`;
  return v.activa ? (
    <Link href={`/directorio/${v.id}`} className={`tarjeta-viva ${clases}`}>
      {contenido}
    </Link>
  ) : (
    <div className={`${clases} opacity-60 saturate-50`} aria-label={`${v.etiqueta}: muy pronto`}>
      {contenido}
    </div>
  );
}

export function AvisoConfiguracion({ mensaje }: { mensaje: string }) {
  return (
    <p role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <strong>No pudimos cargar el directorio.</strong> {mensaje}
    </p>
  );
}

export function EstadoVacio({ emoji, titulo, texto, accion }: { emoji: string; titulo: string; texto: string; accion?: { href: string; etiqueta: string } }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
      <p className="text-4xl" aria-hidden>
        {emoji}
      </p>
      <p className="mt-3 font-bold text-ink">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{texto}</p>
      {accion && (
        <Link href={accion.href} className="boton-marca mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-bold text-white">
          {accion.etiqueta}
        </Link>
      )}
    </div>
  );
}

/** Invitación a publicar el propio negocio: es el motor de crecimiento del directorio (todo el contenido lo sube la comunidad). */
export function InvitacionAlta({ vertical, className = "" }: { vertical?: string; className?: string }) {
  const href = `/directorio/mi-negocio/nuevo${vertical ? `?seccion=${vertical}` : ""}`;
  return (
    <section aria-labelledby="alta-titulo" className={`overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8 ${className}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-sun">¿Tienes un negocio o una farmacia?</p>
      <h2 id="alta-titulo" className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
        Aparece gratis ante toda la ciudad
      </h2>
      <p className="mt-2 max-w-xl text-sm text-white/75">
        Sube tu menú o tus productos, tu horario y tu WhatsApp en menos de 5 minutos. Sin comisiones y sin esperar aprobación. Ganas <strong className="text-sun">+30 🪙</strong> al publicar tu primer perfil.
      </p>
      <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        {["Elige tu categoría", "Cuéntanos cómo atiendes", "Sube tu menú y publica"].map((p, i) => (
          <li key={p} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sun text-xs font-black text-ink">{i + 1}</span>
            {p}
          </li>
        ))}
      </ol>
      <Link href={href} className="boton-marca mt-5 inline-block rounded-full px-7 py-3 text-sm font-bold text-white">
        Registrar mi negocio
      </Link>
    </section>
  );
}

/** Zonas del catálogo de la app (las mismas del alta y los filtros). */
export const OPCIONES_ZONA = ZONAS;
