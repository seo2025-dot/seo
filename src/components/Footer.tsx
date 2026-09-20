import Image from "next/image";
import Link from "next/link";
import { LEMA } from "@/lib/marca";

const COLUMNAS: { titulo: string; enlaces: { href: string; label: string }[] }[] = [
  {
    titulo: "Explora",
    enlaces: [
      { href: "/propiedades", label: "Inmuebles" },
      { href: "/mercado?cat=vehiculos", label: "Vehículos" },
      { href: "/mercado?cat=negocios", label: "Negocios y servicios" },
      { href: "/empleos", label: "Empleos freelance" },
      { href: "/comunidad", label: "Comunidad y citas" },
    ],
  },
  {
    titulo: "Directorio",
    enlaces: [
      { href: "/directorio", label: "Todo el directorio" },
      { href: "/directorio/delivery", label: "Delivery" },
      { href: "/directorio/salud", label: "Farmacias y salud" },
      { href: "/directorio/mi-negocio/nuevo", label: "Registrar mi negocio" },
    ],
  },
  {
    titulo: "conectari.com",
    enlaces: [
      { href: "/que-es", label: "¿Qué es conectari.com?" },
      { href: "/publicar", label: "Publicar gratis" },
      { href: "/verificacion", label: "Verificar mi identidad" },
      { href: "/recompensas", label: "Recompensas" },
      { href: "/contacto", label: "Contacto" },
    ],
  },
  {
    titulo: "Tu cuenta",
    enlaces: [
      { href: "/login", label: "Iniciar sesión" },
      { href: "/registro", label: "Crear cuenta" },
      { href: "/perfil", label: "Mi perfil" },
      { href: "/mensajes", label: "Mensajes" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-slate-300">
      <div aria-hidden className="bg-marca h-1" />
      {/* Resplandor decorativo */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.3fr_2fr]">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <Link href="/" aria-label="conectari.com — Inicio" className="transition-transform duration-300 hover:rotate-[-4deg] hover:scale-105">
            <Image src="/brand/conectari-icono.png" alt="conectari.com" width={586} height={512} className="h-20 w-auto drop-shadow-[0_8px_24px_rgba(255,105,8,0.45)]" />
          </Link>
          <p className="mt-4 max-w-xs text-lg font-extrabold leading-snug text-white [font-family:var(--font-display)]">
            conectari<span className="texto-marca">.com</span>
          </p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">{LEMA}</p>
        </div>

        <nav aria-label="Pie de página" className="grid grid-cols-2 gap-8 text-center sm:grid-cols-3 sm:text-left">
          {COLUMNAS.map((c) => (
            <div key={c.titulo} className={c.titulo === "Tu cuenta" ? "col-span-2 sm:col-span-1" : ""}>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-brand-400">{c.titulo}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {c.enlaces.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-block text-slate-300 transition duration-200 hover:translate-x-1 hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="relative border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} conectari.com · Todos los derechos reservados
        </p>
      </div>
    </footer>
  );
}
