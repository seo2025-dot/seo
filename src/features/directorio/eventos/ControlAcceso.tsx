"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { codigoLegible, codigoValido, mensajeErrorEventos, normalizarCodigo } from "@/lib/directorio/eventos";
import { supabase } from "@/lib/supabaseClient";

type Resultado = { ok: true; cantidad: number; tipo: string; nombre: string; codigo: string } | { ok: false; mensaje: string };

// BarcodeDetector aún no está en los tipos de TypeScript; existe en Chrome y Edge (Android y escritorio).
interface DetectorQR {
  detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type ConstructorDetector = new (opciones: { formats: string[] }) => DetectorQR;
const detectorDisponible = () => typeof window !== "undefined" && "BarcodeDetector" in window;

/**
 * Control de acceso en la puerta: se escribe (o se escanea con la cámara) el código de la entrada y la base de datos lo marca como usado.
 * Solo funciona para entradas de eventos del organizador y una sola vez por entrada.
 */
export default function ControlAcceso() {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [avisoCamara, setAvisoCamara] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const bloqueado = useRef(false);

  const validar = useCallback(async (crudo: string) => {
    const codigo = normalizarCodigo(crudo);
    if (!codigoValido(codigo)) {
      setResultado({ ok: false, mensaje: "El código debe tener 10 letras y números (por ejemplo A1B2C-3D4E5)." });
      return;
    }
    setEnviando(true);
    const { data, error } = await supabase().rpc("check_in", { p_code: codigo });
    setEnviando(false);
    if (error) return setResultado({ ok: false, mensaje: mensajeErrorEventos(error.message) });
    const d = data as { qty: number; type: string; name: string };
    setResultado({ ok: true, cantidad: d.qty, tipo: d.type, nombre: d.name, codigo });
    setTexto("");
  }, []);

  // Escáner: lee fotogramas de la cámara trasera y valida el primer QR con formato de entrada.
  useEffect(() => {
    if (!escaneando) return;
    let activo = true;
    let flujo: MediaStream | null = null;
    let cuadro = 0;
    void (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!activo || !video.current) return flujo.getTracks().forEach((t) => t.stop());
        video.current.srcObject = flujo;
        await video.current.play();
        const Detector = (window as unknown as { BarcodeDetector: ConstructorDetector }).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code"] });
        const leer = async () => {
          if (!activo) return;
          if (video.current && !bloqueado.current) {
            try {
              const encontrados = await detector.detect(video.current);
              const valido = encontrados.map((c) => normalizarCodigo(c.rawValue)).find((c) => codigoValido(c));
              if (valido) {
                bloqueado.current = true; // una lectura a la vez: se desbloquea 2,5 s después para no validar dos veces la misma entrada
                await validar(valido);
                setTimeout(() => (bloqueado.current = false), 2500);
              }
            } catch {
              /* fotograma sin código legible */
            }
          }
          cuadro = requestAnimationFrame(() => void leer());
        };
        void leer();
      } catch {
        setAvisoCamara("No se pudo abrir la cámara. Revisa el permiso del navegador o escribe el código.");
        setEscaneando(false);
      }
    })();
    return () => {
      activo = false;
      cancelAnimationFrame(cuadro);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [escaneando, validar]);

  return (
    <section aria-labelledby="acceso-titulo" className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 id="acceso-titulo" className="text-lg font-black text-ink">
        Control de acceso
      </h2>
      <p className="text-sm text-slate-500">Valida la entrada de quien llega. Cada código sirve una sola vez.</p>

      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void validar(texto);
        }}
      >
        <label htmlFor="codigo-entrada" className="sr-only">
          Código de la entrada
        </label>
        <input id="codigo-entrada" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="A1B2C-3D4E5" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={14} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-lg font-bold uppercase tracking-widest focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
        <button type="submit" disabled={enviando || !texto.trim()} className="boton-marca rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {enviando ? "Validando…" : "Validar"}
        </button>
        {detectorDisponible() && (
          <button type="button" onClick={() => setEscaneando((v) => !v)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
            {escaneando ? "Cerrar cámara" : "📷 Escanear QR"}
          </button>
        )}
      </form>

      {escaneando && (
        <div className="mt-3 overflow-hidden rounded-2xl bg-black">
          <video ref={video} muted playsInline className="mx-auto max-h-72 w-full object-cover" aria-label="Vista de la cámara para escanear el código QR" />
        </div>
      )}
      {avisoCamara && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {avisoCamara}
        </p>
      )}

      {resultado &&
        (resultado.ok ? (
          <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
            <span className="font-black">✅ Entrada válida</span>
            <span className="block text-sm">
              {resultado.nombre} · {resultado.cantidad} × {resultado.tipo} <span className="font-mono text-xs text-emerald-700">({codigoLegible(resultado.codigo)})</span>
            </span>
          </p>
        ) : (
          <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">
            ❌ {resultado.mensaje}
          </p>
        ))}
    </section>
  );
}
