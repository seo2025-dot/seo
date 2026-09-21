"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { dolares, textoMonedas } from "@/lib/monedas";
import { haySupabase, supabase } from "@/lib/supabaseClient";

interface Pago {
  status: "pending" | "paid" | "failed" | "cancelled";
  amount_cents: number;
  coins: number;
}

/**
 * Resultado de un pago: a donde vuelven las pasarelas. Muestra el estado REAL guardado en la base (no lo que diga la URL) y, si el pago
 * sigue pendiente (p. ej. PayPal aún avisando por webhook), lo consulta unos segundos más antes de rendirse.
 */
export default function ResultadoPago() {
  const params = useSearchParams();
  const ref = params.get("ref") ?? "";
  const { estado, sesion, hidratado, refrescarMonedero } = useSocial();
  const [pago, setPago] = useState<Pago | null | undefined>(undefined);
  const [intentos, setIntentos] = useState(0);
  const uid = sesion.uid;

  useEffect(() => {
    if (!hidratado || !uid || !haySupabase || !/^[0-9a-f]{32}$/.test(ref)) {
      if (hidratado) setPago(null);
      return;
    }
    let vivo = true;
    const t = setTimeout(
      async () => {
        const { data } = await supabase().from("coin_payments").select("status, amount_cents, coins").eq("client_ref", ref).maybeSingle();
        if (!vivo) return;
        const p = (data as Pago | null) ?? null;
        setPago(p);
        if (p?.status === "paid") void refrescarMonedero();
        else if (p?.status === "pending" && intentos < 8) setIntentos((n) => n + 1);
      },
      intentos === 0 ? 0 : 2500,
    );
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [hidratado, uid, ref, intentos, refrescarMonedero]);

  if (!hidratado || pago === undefined) return <div className="mx-auto h-72 max-w-md animate-pulse px-4 py-10" />;

  const boton = (href: string, texto: string, principal = true) => (
    <Link href={href} className={principal ? "boton-marca rounded-full px-7 py-3 text-sm font-bold text-white" : "rounded-full border border-slate-300 px-7 py-3 text-sm font-bold text-ink hover:border-brand-400"}>
      {texto}
    </Link>
  );

  let cuerpo: React.ReactNode;
  if (pago?.status === "paid") {
    cuerpo = (
      <>
        <p className="text-6xl" aria-hidden>
          🎉
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink">¡Pago recibido!</h1>
        <p className="mt-2 text-slate-600">
          Acreditamos <strong className="text-ink">{textoMonedas(pago.coins)}</strong> por tu recarga de {dolares(pago.amount_cents)}.
        </p>
        <p className="mt-3 text-3xl font-black tabular-nums text-brand-700">🪙 {estado.monedas}</p>
        <p className="text-xs text-slate-500">Tu saldo ahora</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {boton("/directorio", "Seguir usando conectari.com")}
          {boton("/monedas", "Ver mi saldo", false)}
        </div>
      </>
    );
  } else if (pago?.status === "pending") {
    cuerpo = (
      <>
        <p className="text-6xl" aria-hidden>
          ⏳
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink">Confirmando tu pago…</h1>
        <p className="mt-2 text-slate-600">{intentos < 8 ? "Estamos esperando la confirmación de la pasarela. No cierres esta página." : "La confirmación tarda más de lo normal. Si ya pagaste, tus monedas llegarán solas en unos minutos."}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">{boton("/monedas", "Volver a Monedas", false)}</div>
      </>
    );
  } else if (pago?.status === "cancelled" || params.get("estado") === "cancelado") {
    cuerpo = (
      <>
        <p className="text-6xl" aria-hidden>
          🙅
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink">Pago cancelado</h1>
        <p className="mt-2 text-slate-600">No se cobró nada. Puedes intentarlo de nuevo cuando quieras.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">{boton("/monedas", "Volver a Monedas")}</div>
      </>
    );
  } else {
    cuerpo = (
      <>
        <p className="text-6xl" aria-hidden>
          😕
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink">No pudimos confirmar el pago</h1>
        <p className="mt-2 text-slate-600">Si te cobraron, escríbenos con tu comprobante y lo resolvemos enseguida. Si no, puedes intentarlo otra vez.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {boton("/monedas", "Volver a Monedas")}
          {boton("/contacto", "Contactar soporte", false)}
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 text-center" role="status" aria-live="polite">
      {cuerpo}
    </div>
  );
}
