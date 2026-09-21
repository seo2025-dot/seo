"use client";

import { useCallback, useEffect, useState } from "react";
import { AvisoAccion, claseInput, llamarAdmin, useAccion } from "@/features/monedas/admin/util";
import { dolaresACentavos, validarBonificacion, validarPaquete, validarReto, validarTarifa, type EstadisticasMonedas } from "@/lib/adminMonedas";
import { BONO_PRIMERA_COMPRA_PCT, dolares } from "@/lib/monedas";
import { supabase } from "@/lib/supabaseClient";


interface FilaPrecio { action: string; label: string; free_uses: number; cost: number; active: boolean }
interface FilaPaquete { id: string; label: string; price_cents: number; coins: number; badge: string | null; active: boolean }
interface FilaReto { id: string; period: string; target: number; prize: number; emoji: string; title: string; active: boolean }

const Interruptor = ({ valor, onChange, etiqueta }: { valor: boolean; onChange: (v: boolean) => void; etiqueta: string }) => (
  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600">
    <input type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-brand-600" aria-label={etiqueta} />
    {valor ? "Activa" : "Apagada"}
  </label>
);

function FilaTarifa({ f, guardar, ocupado }: { f: FilaPrecio; guardar: (a: string, gratis: number, coste: number, activa: boolean) => void; ocupado: boolean }) {
  const [gratis, setGratis] = useState(String(f.free_uses));
  const [coste, setCoste] = useState(String(f.cost));
  const [activa, setActiva] = useState(f.active);
  const errores = validarTarifa({ gratis, coste });
  const cambio = gratis !== String(f.free_uses) || coste !== String(f.cost) || activa !== f.active;
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{f.label}</p>
          <p className="font-mono text-xs text-slate-400">{f.action}</p>
        </div>
        <Interruptor valor={activa} onChange={setActiva} etiqueta={`Tarifa ${f.label} activa`} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-semibold text-slate-500">
          {f.action === "chat_message" ? "Mensajes gratis por conversación" : "Usos gratis por persona"}
          <input value={gratis} onChange={(e) => setGratis(e.target.value)} inputMode="numeric" aria-invalid={!!errores.gratis} className={`${claseInput} mt-1`} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {f.action === "chat_message" ? "Monedas cada 5 mensajes" : "Monedas por uso"}
          <input value={coste} onChange={(e) => setCoste(e.target.value)} inputMode="numeric" aria-invalid={!!errores.coste} className={`${claseInput} mt-1`} />
        </label>
        <button type="button" disabled={!cambio || ocupado || Object.keys(errores).length > 0} onClick={() => guardar(f.action, Number(gratis), Number(coste), activa)} className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
          Guardar
        </button>
      </div>
      {Object.values(errores)[0] && <p className="mt-1 text-xs font-semibold text-rose-600">{Object.values(errores)[0]}</p>}
    </li>
  );
}

function FormPaquete({ p, guardar, ocupado, nuevo = false }: { p?: FilaPaquete; guardar: (b: { id: string; etiqueta: string; centavos: number; monedas: number; insignia: string; activo: boolean }) => void; ocupado: boolean; nuevo?: boolean }) {
  const [id, setId] = useState(p?.id ?? "");
  const [etiqueta, setEtiqueta] = useState(p?.label ?? "");
  const [precio, setPrecio] = useState(p ? (p.price_cents / 100).toFixed(2) : "");
  const [monedas, setMonedas] = useState(p ? String(p.coins) : "");
  const [insignia, setInsignia] = useState(p?.badge ?? "");
  const [activo, setActivo] = useState(p?.active ?? true);
  const errores = validarPaquete({ id, etiqueta, precio, monedas, insignia });
  const cambio = nuevo || etiqueta !== p?.label || precio !== (p ? (p.price_cents / 100).toFixed(2) : "") || monedas !== String(p?.coins) || insignia !== (p?.badge ?? "") || activo !== p?.active;
  const cents = dolaresACentavos(precio);
  const porMoneda = cents && Number(monedas) > 0 ? (cents / Number(monedas)).toFixed(2) : null;
  return (
    <li className={`rounded-2xl border bg-white p-4 ${nuevo ? "border-dashed border-brand-300" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold text-ink">{nuevo ? "Nuevo paquete" : <><span className="font-mono text-xs text-slate-400">{p?.id}</span> {p?.label}</>}</p>
        {!nuevo && <Interruptor valor={activo} onChange={setActivo} etiqueta={`Paquete ${p?.label} activo`} />}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {nuevo && (
          <label className="text-xs font-semibold text-slate-500">
            Identificador
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder="mega" aria-invalid={!!errores.id} className={`${claseInput} mt-1 font-mono`} />
          </label>
        )}
        <label className="text-xs font-semibold text-slate-500">
          Nombre
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} aria-invalid={!!errores.etiqueta} className={`${claseInput} mt-1`} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Precio (USD)
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" aria-invalid={!!errores.precio} className={`${claseInput} mt-1`} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Monedas
          <input value={monedas} onChange={(e) => setMonedas(e.target.value)} inputMode="numeric" aria-invalid={!!errores.monedas} className={`${claseInput} mt-1`} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Etiqueta (opcional)
          <input value={insignia} onChange={(e) => setInsignia(e.target.value)} placeholder="Más popular" aria-invalid={!!errores.insignia} className={`${claseInput} mt-1`} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {porMoneda ? `Cada moneda sale a ${porMoneda} ¢. ` : ""}
          {!nuevo && "El cambio solo afecta a compras nuevas."}
        </p>
        <button
          type="button"
          disabled={!cambio || ocupado || Object.keys(errores).length > 0}
          onClick={() => guardar({ id: nuevo ? id : (p as FilaPaquete).id, etiqueta: etiqueta.trim(), centavos: cents ?? 0, monedas: Number(monedas), insignia: insignia.trim(), activo })}
          className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {nuevo ? "Crear paquete" : "Guardar"}
        </button>
      </div>
      {(cambio || nuevo) && Object.values(errores)[0] && (nuevo ? id || etiqueta || precio || monedas : true) && <p className="mt-1 text-xs font-semibold text-rose-600">{Object.values(errores)[0]}</p>}
    </li>
  );
}

function FilaReto({ r, guardar, ocupado }: { r: FilaReto; guardar: (id: string, meta: number, premio: number, activo: boolean) => void; ocupado: boolean }) {
  const [meta, setMeta] = useState(String(r.target));
  const [premio, setPremio] = useState(String(r.prize));
  const [activo, setActivo] = useState(r.active);
  const errores = validarReto({ meta, premio });
  const cambio = meta !== String(r.target) || premio !== String(r.prize) || activo !== r.active;
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold text-ink">
          {r.emoji} {r.title} <span className="text-xs font-normal text-slate-400">· {r.period === "weekly" ? "semanal" : "una vez"}</span>
        </p>
        <Interruptor valor={activo} onChange={setActivo} etiqueta={`Reto ${r.title} activo`} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-semibold text-slate-500">
          Meta (veces)
          <input value={meta} onChange={(e) => setMeta(e.target.value)} inputMode="numeric" aria-invalid={!!errores.meta} className={`${claseInput} mt-1`} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Premio (monedas)
          <input value={premio} onChange={(e) => setPremio(e.target.value)} inputMode="numeric" aria-invalid={!!errores.premio} className={`${claseInput} mt-1`} />
        </label>
        <button type="button" disabled={!cambio || ocupado || Object.keys(errores).length > 0} onClick={() => guardar(r.id, Number(meta), Number(premio), activo)} className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
          Guardar
        </button>
      </div>
      {Object.values(errores)[0] && <p className="mt-1 text-xs font-semibold text-rose-600">{Object.values(errores)[0]}</p>}
    </li>
  );
}

/** Tarifas, paquetes, bonificación de la primera compra y retos: se ajustan aquí, sin tocar SQL. Todo queda en el registro. */
export default function TabAjustes() {
  const [precios, setPrecios] = useState<FilaPrecio[] | null>(null);
  const [paquetes, setPaquetes] = useState<FilaPaquete[]>([]);
  const [retos, setRetos] = useState<FilaReto[]>([]);
  const [bono, setBono] = useState<string | null>(null);
  const { guardando, aviso, ejecutar } = useAccion();

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [p, k, r, s] = await Promise.all([
      sb.from("coin_prices").select("action, label, free_uses, cost, active, sort").order("sort"),
      sb.from("coin_packages").select("id, label, price_cents, coins, badge, active, sort").order("sort"),
      sb.from("coin_challenges").select("id, period, target, prize, emoji, title, active, sort").order("sort"),
      llamarAdmin<EstadisticasMonedas>("admin_coin_stats", { p_days: 1 }),
    ]);
    setPrecios((p.data ?? []) as FilaPrecio[]);
    setPaquetes((k.data ?? []) as FilaPaquete[]);
    setRetos((r.data ?? []) as FilaReto[]);
    setBono("datos" in s ? String(s.datos.ajustes.first_purchase_bonus_pct ?? BONO_PRIMERA_COMPRA_PCT) : String(BONO_PRIMERA_COMPRA_PCT));
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (precios === null || bono === null) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  const errBono = validarBonificacion(bono).bonificacion;

  return (
    <div className="space-y-10">
      <div aria-live="polite">
        <AvisoAccion aviso={aviso} />
      </div>

      <section aria-labelledby="aj-tarifas">
        <h2 id="aj-tarifas" className="text-xl font-black text-ink">
          Tarifas de uso
        </h2>
        <p className="mb-3 text-sm text-slate-600">Cuántos usos son gratis y cuánto cuesta cada uso después. Los cambios valen desde el siguiente uso, para todas las personas.</p>
        <ul className="space-y-3">
          {precios.map((f) => (
            <FilaTarifa
              key={`${f.action}-${f.free_uses}-${f.cost}-${f.active}`}
              f={f}
              ocupado={guardando !== null}
              guardar={(a, g, c, act) => void ejecutar(`tarifa:${a}`, () => llamarAdmin("admin_update_price", { p_action: a, p_free: g, p_cost: c, p_active: act }), "Tarifa guardada.", cargar)}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="aj-paquetes">
        <h2 id="aj-paquetes" className="text-xl font-black text-ink">
          Paquetes de recarga
        </h2>
        <p className="mb-3 text-sm text-slate-600">Lo que se vende en la tienda. Si cambias un precio, los pagos ya iniciados conservan el importe con el que se crearon.</p>
        <ul className="space-y-3">
          {paquetes.map((p) => (
            <FormPaquete
              key={`${p.id}-${p.price_cents}-${p.coins}-${p.badge}-${p.label}-${p.active}`}
              p={p}
              ocupado={guardando !== null}
              guardar={(b) => void ejecutar(`paquete:${b.id}`, () => llamarAdmin("admin_update_package", { p_id: b.id, p_label: b.etiqueta, p_price_cents: b.centavos, p_coins: b.monedas, p_badge: b.insignia, p_active: b.activo }), `Paquete «${b.etiqueta}» guardado (${dolares(b.centavos)}).`, cargar)}
            />
          ))}
          <FormPaquete
            nuevo
            ocupado={guardando !== null}
            guardar={(b) => void ejecutar("paquete:nuevo", () => llamarAdmin("admin_update_package", { p_id: b.id, p_label: b.etiqueta, p_price_cents: b.centavos, p_coins: b.monedas, p_badge: b.insignia, p_active: true }), `Paquete «${b.etiqueta}» creado.`, cargar)}
          />
        </ul>
      </section>

      <section aria-labelledby="aj-bono">
        <h2 id="aj-bono" className="text-xl font-black text-ink">
          Bonificación de la primera compra
        </h2>
        <p className="mb-3 text-sm text-slate-600">Porcentaje de monedas extra que recibe una persona en su primera recarga (0 = sin bonificación).</p>
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="text-xs font-semibold text-slate-500">
            Porcentaje
            <input value={bono} onChange={(e) => setBono(e.target.value)} inputMode="numeric" aria-invalid={!!errBono} className={`${claseInput} mt-1 w-28`} />
          </label>
          <button type="button" disabled={!!errBono || guardando !== null} onClick={() => void ejecutar("bono", () => llamarAdmin("admin_set_setting", { p_key: "first_purchase_bonus_pct", p_value: Number(bono) }), "Bonificación guardada.", cargar)} className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
            Guardar
          </button>
          {errBono && <p className="w-full text-xs font-semibold text-rose-600">{errBono}</p>}
        </div>
      </section>

      <section aria-labelledby="aj-retos">
        <h2 id="aj-retos" className="text-xl font-black text-ink">
          Retos de comunidad
        </h2>
        <p className="mb-3 text-sm text-slate-600">Metas y premios de los retos semanales y únicos. Apaga uno para ocultarlo (los ya cobrados no se tocan).</p>
        <ul className="space-y-3">
          {retos.map((r) => (
            <FilaReto
              key={`${r.id}-${r.target}-${r.prize}-${r.active}`}
              r={r}
              ocupado={guardando !== null}
              guardar={(id, m, p, a) => void ejecutar(`reto:${id}`, () => llamarAdmin("admin_update_challenge", { p_id: id, p_target: m, p_prize: p, p_active: a }), "Reto guardado.", cargar)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
