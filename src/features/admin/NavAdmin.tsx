import Link from "next/link";

const AREAS = [
  { href: "/admin", etiqueta: "Resumen" },
  { href: "/admin/kyc", etiqueta: "Identidad" },
  { href: "/admin/monedas", etiqueta: "Monedas" },
  { href: "/admin/personas", etiqueta: "Personas demo" },
] as const;

/** Pestañas para moverse entre las áreas de administración. `actual` es la ruta de la página donde se muestra. */
export default function NavAdmin({ actual }: { actual: (typeof AREAS)[number]["href"] }) {
  return (
    <nav aria-label="Áreas de administración" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 text-sm">
      {AREAS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          aria-current={a.href === actual ? "page" : undefined}
          className={`whitespace-nowrap rounded-full border px-4 py-1.5 font-semibold transition ${a.href === actual ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 text-slate-600 hover:border-brand-400"}`}
        >
          {a.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
