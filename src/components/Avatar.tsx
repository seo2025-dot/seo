/* eslint-disable @next/next/no-img-element */
import { iniciales } from "@/lib/formato";
import { hash } from "@/lib/social";

const DEGRADADOS = [
  "from-brand-500 to-violet-600",
  "from-rose-500 to-orange-400",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-pink-500",
  "from-sky-500 to-indigo-600",
  "from-fuchsia-500 to-purple-600",
];

export function degradadoDe(clave: string) {
  return DEGRADADOS[hash(clave) % DEGRADADOS.length];
}

const TAMANOS = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-28 w-28 text-4xl",
};

export default function Avatar({
  nombre,
  foto,
  tamano = "md",
  enLinea,
  className = "",
}: {
  nombre: string;
  foto?: string;
  tamano?: keyof typeof TAMANOS;
  /** undefined = no mostrar indicador */
  enLinea?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ${degradadoDe(nombre)} ${TAMANOS[tamano]} ${className}`}
      aria-hidden
    >
      {foto ? (
        <img src={foto} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        iniciales(nombre)
      )}
      {enLinea !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            enLinea ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
      )}
    </span>
  );
}
