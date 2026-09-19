import type { BadgeId, Interes, TipoRelacion, Usuario, Verificaciones } from "@/types/social";
import { infoSigno, sinastria } from "@/lib/astrologia";
import { nivelConfianza, puntajeConfianza } from "@/lib/confianza";
import { BADGES, ETIQUETA_INTERES } from "@/lib/social";
import Icono from "@/components/Icono";

/** Insignia azul de identidad verificada (KYC). */
export function VerificadoCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      title="Identidad verificada"
      role="img"
      aria-label="Identidad verificada"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-sky-500 text-white ${className}`}
    >
      <Icono nombre="check" className="h-2.5 w-2.5" />
    </span>
  );
}

/** Puntaje de confianza P2P (0–100) con nivel. */
export function ConfianzaBadge({ usuario, compacto = false }: { usuario: Usuario; compacto?: boolean }) {
  const p = usuario.confianza ?? puntajeConfianza(usuario); // el servidor lo calcula (profiles.trust_score)
  const n = nivelConfianza(p);
  return (
    <span
      title={`Puntaje de confianza P2P: ${p}/100 (identidad, reseñas, respuesta y antigüedad)`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${n.clases}`}
    >
      <span aria-hidden>🛡️</span>
      {p}
      {!compacto && <span className="font-medium"> · {n.label}</span>}
    </span>
  );
}

/** Compatibilidad astral (sinastría) entre dos usuarios; no muestra nada si falta algún signo. */
export function AstralBadge({
  yo,
  otro,
  contexto = "pareja",
  compacto = false,
  className = "",
}: {
  yo: Usuario;
  otro: Usuario;
  contexto?: TipoRelacion;
  compacto?: boolean;
  className?: string;
}) {
  if (!yo.signo || !otro.signo) return null;
  const s = sinastria(yo.signo, otro.signo, contexto);
  const a = infoSigno(yo.signo);
  const b = infoSigno(otro.signo);
  return (
    <span
      title={s.detalle}
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow-sm ${className}`}
    >
      <span aria-hidden>
        {a.simbolo}
        {b.simbolo}
      </span>
      {s.puntaje}%{!compacto && <span className="font-medium"> · {s.titulo} ({s.resumen})</span>}
    </span>
  );
}

export function BadgesFila({ badges }: { badges: BadgeId[] }) {
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {badges.map((id) => {
        const b = BADGES[id];
        return (
          <li
            key={id}
            title={b.descripcion}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
          >
            <span aria-hidden>{b.emoji}</span> {b.label}
          </li>
        );
      })}
    </ul>
  );
}

export function InteresesFila({ intereses }: { intereses: Interes[] }) {
  if (intereses.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {intereses.map((i) => (
        <li key={i} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          {ETIQUETA_INTERES[i]}
        </li>
      ))}
    </ul>
  );
}

const ETIQUETAS_VERIF: [keyof Verificaciones, string][] = [
  ["identidad", "Identidad"],
  ["telefono", "Teléfono"],
  ["email", "Email"],
];

export function VerificacionesFila({
  verificaciones,
  onVerificar,
  hrefIdentidad,
}: {
  verificaciones: Verificaciones;
  /** Si se pasa, muestra un botón para verificar teléfono/email (demo). */
  onVerificar?: (clave: keyof Verificaciones) => void;
  /** Enlace al flujo KYC de identidad. */
  hrefIdentidad?: string;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {ETIQUETAS_VERIF.map(([clave, label]) => {
        const ok = verificaciones[clave];
        return (
          <li
            key={clave}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-500 ring-slate-200"
            }`}
          >
            <Icono nombre={ok ? "check" : "x"} className="h-3 w-3" />
            {label} {ok ? "verificado" : "sin verificar"}
            {!ok && clave === "identidad" && hrefIdentidad && (
              <a href={hrefIdentidad} className="ml-1 font-semibold text-brand-600 hover:underline">
                Verificar con selfie
              </a>
            )}
            {!ok && clave !== "identidad" && onVerificar && (
              <button
                type="button"
                onClick={() => onVerificar(clave)}
                className="ml-1 font-semibold text-brand-600 hover:underline"
              >
                Verificar
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Reputacion({
  rating,
  resenas,
  respuesta,
}: {
  rating: number;
  resenas: number;
  respuesta?: number;
}) {
  if (resenas === 0) return <span className="text-xs text-slate-500">Sin reseñas todavía</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
      <span className="font-semibold text-slate-800">
        <span className="text-amber-500" aria-hidden>
          ★
        </span>{" "}
        {rating.toFixed(1)}
      </span>
      <span className="text-slate-500">
        ({resenas} {resenas === 1 ? "reseña" : "reseñas"})
      </span>
      {respuesta !== undefined && <span className="text-slate-500">· {respuesta}% respuesta</span>}
    </span>
  );
}
