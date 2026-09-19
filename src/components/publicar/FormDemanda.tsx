"use client";

import { useState } from "react";
import Link from "next/link";
import type { Demanda } from "@/types/mercado";
import { ZONAS } from "@/data/catalogos";
import { useSocial } from "@/context/SocialContext";
import { BotonPublicar, Campo, campoCls, Chips, irAlPrimerError } from "@/components/publicar/comunes";

const TIPOS_INMUEBLE = [
  { id: "", label: "Cualquiera" },
  { id: "casa", label: "Casa" },
  { id: "villa", label: "Villa" },
  { id: "departamento", label: "Departamento" },
  { id: "terreno", label: "Terreno" },
  { id: "local", label: "Local" },
];
const TIPOS_VEHICULO = [
  { id: "", label: "Cualquiera" },
  { id: "auto", label: "Auto" },
  { id: "moto", label: "Moto" },
  { id: "transporte", label: "Transporte" },
];

type Errores = Partial<Record<"presupuesto" | "nota", string>>;

export default function FormDemanda() {
  const { publicarDemanda } = useSocial();

  const [categoria, setCategoria] = useState<Demanda["categoria"]>("inmueble");
  const [operacion, setOperacion] = useState<Demanda["operacion"]>("alquilar");
  const [tipo, setTipo] = useState("");
  const [zona, setZona] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [moneda, setMoneda] = useState<Demanda["moneda"]>("USD");
  const [superficie, setSuperficie] = useState("");
  const [nota, setNota] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<number | null>(null);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Errores = {};
    if (!(Number(presupuesto) > 0)) e.presupuesto = "Indica tu presupuesto máximo.";
    if (nota.trim().length < 10) e.nota = "Cuéntanos un poco más de lo que buscas (mínimo 10 caracteres).";
    setErrores(e);
    if (Object.keys(e).length > 0) return irAlPrimerError();

    setEnviando(true);
    const n = await publicarDemanda({
      categoria,
      operacion,
      tipo,
      zona: zona.trim(),
      presupuestoMax: Number(presupuesto),
      moneda,
      superficieMin: categoria === "inmueble" && Number(superficie) > 0 ? Number(superficie) : undefined,
      nota: nota.trim(),
    });
    setEnviando(false);
    if (n !== null) setResultado(n);
  };

  if (resultado !== null) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center" role="status">
        <p className="text-4xl">{resultado > 0 ? "⚡" : "📡"}</p>
        <h2 className="mt-3 text-xl font-bold">
          {resultado > 0
            ? `¡${resultado} ${resultado === 1 ? "oferta coincide" : "ofertas coinciden"} con tu búsqueda!`
            : "Tu búsqueda está publicada"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {resultado > 0
            ? "Los dueños ya fueron notificados al instante: si les interesa, te escribirán por Mensajes."
            : "Te avisaremos apenas alguien publique algo que coincida con lo que buscas."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/mensajes" className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
            Ir a mis mensajes
          </Link>
          <button type="button" onClick={() => setResultado(null)} className="rounded-xl px-6 py-3 font-medium text-slate-600 hover:bg-white">
            Publicar otra búsqueda
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
        Publica lo que buscas y el motor de match avisará al instante a los dueños e inmobiliarias con inventario que coincida.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Busco…</legend>
          <Chips
            opciones={[{ id: "inmueble", label: "🏡 Inmueble" }, { id: "vehiculo", label: "🚗 Vehículo" }]}
            valor={categoria}
            onChange={(v) => {
              setCategoria(v as Demanda["categoria"]);
              setTipo("");
            }}
          />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Para…</legend>
          <Chips opciones={[{ id: "comprar", label: "Comprar" }, { id: "alquilar", label: "Alquilar" }]} valor={operacion} onChange={(v) => setOperacion(v as Demanda["operacion"])} />
        </fieldset>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Tipo</legend>
        <Chips opciones={categoria === "inmueble" ? TIPOS_INMUEBLE : TIPOS_VEHICULO} valor={tipo} onChange={setTipo} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="d-zona" label="Zona (opcional)">
          <input id="d-zona" value={zona} onChange={(e) => setZona(e.target.value)} list="zonas-demanda" placeholder="Ej.: Zona Norte" className={campoCls} />
          <datalist id="zonas-demanda">
            {ZONAS.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </Campo>
        {categoria === "inmueble" && (
          <Campo id="d-sup" label="Superficie mínima m² (opcional)">
            <input id="d-sup" type="number" min="0" value={superficie} onChange={(e) => setSuperficie(e.target.value)} placeholder="500" className={campoCls} />
          </Campo>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Campo id="d-presupuesto" label={operacion === "alquilar" ? "Presupuesto máximo por mes" : "Presupuesto máximo"} error={errores.presupuesto}>
          <input id="d-presupuesto" type="number" min="0" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} placeholder="600" className={campoCls} />
        </Campo>
        <Campo id="d-moneda" label="Moneda">
          <select id="d-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Demanda["moneda"])} className={campoCls}>
            {(["USD", "EUR", "ARS", "MXN"] as const).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo id="d-nota" label="Cuéntanos lo que buscas" error={errores.nota}>
        <textarea id="d-nota" value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={400} placeholder="Ej.: Busco departamento de $600/mes en zona norte, con wifi y pet friendly." className={campoCls} />
      </Campo>

      <BotonPublicar disabled={enviando}>{enviando ? "Publicando…" : "Publicar lo que busco"}</BotonPublicar>
    </form>
  );
}
