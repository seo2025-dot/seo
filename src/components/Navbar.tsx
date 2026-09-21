"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import { tiempoRelativo } from "@/lib/social";
import Avatar from "@/components/Avatar";
import Icono, { type NombreIcono } from "@/components/Icono";

const esActivo = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function Insignia({ n, className = "-right-2 -top-1.5" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      className={`absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ${className}`}
      aria-label={`${n} pendientes`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function Notificaciones() {
  const { estado, notificacionesSinLeer, leerNotificaciones } = useSocial();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const alternar = () => {
    setAbierto((v) => !v);
    if (!abierto && notificacionesSinLeer > 0) setTimeout(leerNotificaciones, 1500);
  };

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label="Notificaciones"
        aria-expanded={abierto}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
      >
        <Icono nombre="campana" className="h-5 w-5" />
        <Insignia n={notificacionesSinLeer} className="-right-0.5 -top-0.5" />
      </button>
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold">Notificaciones</p>
            <ul className="max-h-96 overflow-y-auto">
              {estado.notificaciones.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Sin novedades por ahora.</li>}
              {estado.notificaciones.slice(0, 12).map((n) => {
                const contenido = (
                  <>
                    <p className="text-sm">{n.texto}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{tiempoRelativo(n.ts)}</p>
                  </>
                );
                return (
                  <li key={n.id} className={n.leida ? "" : "bg-brand-50/60"}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => setAbierto(false)} className="block px-4 py-3 hover:bg-slate-50">
                        {contenido}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{contenido}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const { estado, sesion } = useSocial();

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="conectari.com — Inicio" className="shrink-0 transition-opacity hover:opacity-80">
          <Image
            src="/brand/conectari-header.png"
            alt="conectari.com"
            width={720}
            height={95}
            priority
            sizes="(min-width: 1024px) 240px, 160px"
            className="h-5 w-auto min-[400px]:h-6 sm:h-7 lg:h-8"
          />
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {sesion.uid ? (
            <>
              <Link
                href="/monedas"
                title="Mis monedas"
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-brand-300 hover:text-brand-700"
              >
                <Icono nombre="recompensas" className="h-4 w-4 text-brand-600" />
                <span className="tabular-nums">{estado.monedas}</span>
              </Link>
              <Notificaciones />
              <Link href="/perfil" aria-label="Mi perfil" className="hidden rounded-full transition hover:opacity-80 md:block">
                <Avatar nombre={estado.yo.nombre} foto={estado.yo.foto} tamano="sm" />
              </Link>
              <Link
                href="/publicar"
                aria-label="Publicar"
                className="boton-marca flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold text-white sm:px-5"
              >
                <Icono nombre="mas" className="h-4 w-4" />
                <span className="hidden sm:inline">Publicar</span>
              </Link>
            </>
          ) : sesion.lista ? (
            <>
              <Link href="/login" className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-4 sm:text-sm">
                <span className="sm:hidden">Entrar</span>
                <span className="hidden sm:inline">Iniciar sesión</span>
              </Link>
              <Link href="/registro" className="boton-marca rounded-full px-3 py-2 text-xs font-bold text-white sm:px-5 sm:text-sm">
                Registrarse
              </Link>
            </>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
/** Barra de pestañas inferior, solo en pantallas pequeñas. */
export function BottomNav() {
  const pathname = usePathname();
  const { noLeidosTotal, solicitudesPendientes } = useSocial();

  const items: { href: string; label: string; icono: NombreIcono; n?: number }[] = [
    { href: "/", label: "Inicio", icono: "inicio" },
    { href: "/match", label: "Match", icono: "match" },
    { href: "/citas", label: "Citas", icono: "citas" },
    { href: "/mensajes", label: "Mensajes", icono: "mensajes", n: noLeidosTotal + solicitudesPendientes },
    { href: "/perfil", label: "Perfil", icono: "perfil" },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 flex h-16 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
    >
      {items.map((e) => {
        const activo = e.href === "/" ? pathname === "/" : esActivo(pathname, e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activo ? "text-brand-600" : "text-slate-500"
            }`}
          >
            <span className="relative">
              <Icono nombre={e.icono} className="h-5 w-5" relleno={activo && e.icono === "match"} />
              {e.n ? <Insignia n={e.n} /> : null}
            </span>
            {e.label}
          </Link>
        );
      })}
    </nav>
  );
}
