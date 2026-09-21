"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { CODIGO_ENTRADA, contenidoQR } from "@/lib/directorio/eventos";

/**
 * Código QR de una entrada. Se genera en el navegador, sin llamadas externas. Solo se dibuja si el valor tiene el formato de un código
 * de entrada (10 caracteres hexadecimales): así el SVG que se incrusta nunca contiene texto de una persona.
 */
export default function CodigoQR({ codigo, etiqueta, ancho = 176 }: { codigo: string; etiqueta: string; ancho?: number }) {
  const svg = useMemo(() => {
    if (!CODIGO_ENTRADA.test(codigo)) return null;
    const qr = qrcode(0, "M");
    qr.addData(contenidoQR(codigo));
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [codigo]);
  if (!svg) return null;
  return <div role="img" aria-label={etiqueta} style={{ width: ancho }} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-1 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
