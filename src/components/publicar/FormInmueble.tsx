"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Operacion, Propiedad, TipoPropiedad } from "@/types/propiedad";
import { COMODIDADES_SUGERIDAS, ZONAS } from "@/data/catalogos";
import { useSocial } from "@/context/SocialContext";
import { BotonPublicar, Campo, campoCls, CasillaRelampago, Chips, irAlPrimerError, SelectorFotos } from "@/components/publicar/comunes";

const TIPOS = [
  { id: "casa", label: "🏠 Casa" },
  { id: "villa", label: "🏡 Villa" },
  { id: "departamento", label: "🏢 Departamento" },
  { id: "terreno", label: "🌄 Terreno" },
  { id: "local", label: "🏬 Local" },
];

type Errores = Partial<Record<"titulo" | "descripcion" | "precio" | "ubicacion" | "superficie" | "fotos", string>>;

export default function FormInmueble() {
  const router = useRouter();
  const { publicarPropiedad } = useSocial();

  const [operacion, setOperacion] = useState<Operacion>("venta");
  const [tipo, setTipo] = useState<TipoPropiedad>("casa");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [moneda, setMoneda] = useState<Propiedad["moneda"]>("USD");
  const [ubicacion, setUbicacion] = useState("");
  const [dormitorios, setDormitorios] = useState("0");
  const [banos, setBanos] = useState("0");
  const [superficie, setSuperficie] = useState("");
  const [comodidades, setComodidades] = useState<string[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);
  const [relampago, setRelampago] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);

  const esTerreno = tipo === "terreno";

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Errores = {};
    if (titulo.trim().length < 5) e.titulo = "Escribe un título de al menos 5 caracteres.";
    if (descripcion.trim().length < 20) e.descripcion = "Describe la propiedad en al menos 20 caracteres.";
    if (!(Number(precio) > 0)) e.precio = "Indica un precio mayor que 0.";
    if (!ubicacion.trim()) e.ubicacion = "Indica la zona o ciudad.";
    if (!(Number(superficie) > 0)) e.superficie = "Indica la superficie en m².";
    if (fotos.length === 0) e.fotos = "Sube al menos una foto.";
    setErrores(e);
    if (Object.keys(e).length > 0) return irAlPrimerError();

    setEnviando(true);
    const id = await publicarPropiedad(
      {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        tipo,
        operacion,
        precio: Number(precio),
        moneda,
        ubicacion: ubicacion.trim(),
        dormitorios: esTerreno ? 0 : Number(dormitorios) || 0,
        banos: esTerreno ? 0 : Number(banos) || 0,
        superficie: Number(superficie),
        imagen: fotos[0],
        galeria: fotos.slice(1),
        comodidades,
      },
      relampago ? 10 : undefined,
    );
    setEnviando(false);
    if (id) router.push(`/propiedades/${id}`);
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">¿Qué quieres hacer?</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["venta", "alquiler"] as const).map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={operacion === o}
              onClick={() => setOperacion(o)}
              className={`rounded-xl border-2 px-4 py-3 text-left transition ${operacion === o ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-brand-300"}`}
            >
              <span className="block font-semibold">{o === "venta" ? "Vender" : "Alquilar"}</span>
              <span className="text-xs text-slate-500">{o === "venta" ? "Precio total de venta" : "Precio por mes"}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Tipo de propiedad</legend>
        <Chips opciones={TIPOS} valor={tipo} onChange={(v) => setTipo(v as TipoPropiedad)} />
      </fieldset>

      <div className="space-y-4">
        <Campo id="titulo" label="Título del anuncio" error={errores.titulo}>
          <input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} placeholder="Ej.: Villa con piscina y vista al mar" aria-invalid={!!errores.titulo} className={campoCls} />
        </Campo>
        <Campo id="descripcion" label="Descripción" error={errores.descripcion}>
          <textarea id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} maxLength={800} placeholder="Cuenta qué hace especial a tu propiedad, el entorno, condiciones…" aria-invalid={!!errores.descripcion} className={campoCls} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Campo id="precio" label={operacion === "alquiler" ? "Precio mensual" : "Precio de venta"} error={errores.precio}>
          <input id="precio" type="number" min="0" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} aria-invalid={!!errores.precio} className={campoCls} />
        </Campo>
        <Campo id="moneda" label="Moneda">
          <select id="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Propiedad["moneda"])} className={campoCls}>
            {(["USD", "EUR", "ARS", "MXN"] as const).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="ubicacion" label="Zona / ciudad" error={errores.ubicacion}>
          <input id="ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} list="zonas-inmueble" placeholder="Ej.: Zona Norte" aria-invalid={!!errores.ubicacion} className={campoCls} />
          <datalist id="zonas-inmueble">
            {ZONAS.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </Campo>
        <Campo id="superficie" label="Superficie (m²)" error={errores.superficie}>
          <input id="superficie" type="number" min="0" value={superficie} onChange={(e) => setSuperficie(e.target.value)} aria-invalid={!!errores.superficie} className={campoCls} />
        </Campo>
      </div>

      {!esTerreno && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="dormitorios" label="Dormitorios">
            <input id="dormitorios" type="number" min="0" value={dormitorios} onChange={(e) => setDormitorios(e.target.value)} className={campoCls} />
          </Campo>
          <Campo id="banos" label="Baños">
            <input id="banos" type="number" min="0" value={banos} onChange={(e) => setBanos(e.target.value)} className={campoCls} />
          </Campo>
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Comodidades</legend>
        <Chips
          multiple
          color="emerald"
          opciones={COMODIDADES_SUGERIDAS.map((c) => ({ id: c, label: c }))}
          valor={comodidades}
          onChange={(c) => setComodidades((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))}
        />
      </fieldset>

      <SelectorFotos fotos={fotos} onChange={setFotos} max={4} error={errores.fotos} />
      <CasillaRelampago activa={relampago} onChange={setRelampago} />
      <BotonPublicar disabled={enviando}>{enviando ? "Publicando…" : "Publicar propiedad"}</BotonPublicar>
    </form>
  );
}
