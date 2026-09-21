import type { ReactNode } from "react";

/**
 * Moneda de conectari.com dibujada en SVG. Sustituye al emoji 🪙 (Unicode 13, 2020), que muchos equipos —p. ej. Windows 10— no traen
 * en su fuente de emojis y muestran como un cuadrado vacío. Este dibujo se ve igual en cualquier sistema y hereda el tamaño del texto.
 */
export default function IconoMoneda({ className = "", titulo }: { className?: string; titulo?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
      className={`inline-block shrink-0 align-[-0.14em] ${className}`}
    >
      <circle cx="12" cy="12" r="11" fill="#F2A900" />
      <circle cx="12" cy="12" r="11" fill="none" stroke="#B36B00" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="7.8" fill="#FFD23F" stroke="#D18A00" strokeWidth="1" />
      <path d="M12 7.2l1.62 3.28 3.62.53-2.62 2.55.62 3.6L12 15.45l-3.24 1.7.62-3.6-2.62-2.55 3.62-.53z" fill="#F2A900" />
    </svg>
  );
}

/** El emoji que las pantallas antiguas y los textos que vienen de la base de datos usan como marcador de «monedas». */
export const EMOJI_MONEDA = "🪙";

/** Muestra un texto sustituyendo cada 🪙 por el icono SVG (para mensajes que llegan como cadenas: avisos, notificaciones, errores). */
export function TextoConMonedas({ texto }: { texto: string }): ReactNode {
  if (!texto.includes(EMOJI_MONEDA)) return texto;
  const partes = texto.split(EMOJI_MONEDA);
  return partes.map((p, i) => (
    <span key={i}>
      {i > 0 && <IconoMoneda />}
      {p}
    </span>
  ));
}
