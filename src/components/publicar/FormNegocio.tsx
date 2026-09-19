"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Negocio } from "@/types/mercado";
import { ZONAS } from "@/data/catalogos";
import { useSocial } from "@/context/SocialContext";
import { BotonPublicar, Campo, campoCls, irAlPrimerError, SelectorFotos } from "@/components/publicar/comunes";

type Errores = Partial<Record<"titulo" | "rubro" | "inversion" | "retorno" | "ubicacion" | "descripcion" | "fotos", string>>;

export default function FormNegocio() {
  const router = useRouter();
  const { publicarNegocio } = useSocial();

  const [titulo, setTitulo] = useState("");
  const [rubro, setRubro] = useState("");
  const [inversion, setInversion] = useState("");
  const [moneda, setMoneda] = useState<Negocio["moneda"]>("USD");
  const [retorno, setRetorno] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Errores = {};
    if (titulo.trim().length < 5) e.titulo = "Escribe un título de al menos 5 caracteres.";
    if (!rubro.trim()) e.rubro = "Indica el rubro.";
    if (!(Number(inversion) > 0)) e.inversion = "Indica la inversión requerida.";
    if (!retorno.trim()) e.retorno = "Indica el plazo estimado de retorno (ej.: 12–18 meses).";
    if (!ubicacion.trim()) e.ubicacion = "Indica la zona o ciudad.";
    if (descripcion.trim().length < 20) e.descripcion = "Describe la oportunidad en al menos 20 caracteres.";
    if (fotos.length === 0) e.fotos = "Sube al menos una foto.";
    setErrores(e);
    if (Object.keys(e).length > 0) return irAlPrimerError();

    setEnviando(true);
    const id = await publicarNegocio({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      rubro: rubro.trim(),
      inversion: Number(inversion),
      moneda,
      retorno: retorno.trim(),
      ubicacion: ubicacion.trim(),
      imagen: fotos[0],
    });
    setEnviando(false);
    if (id) router.push(`/mercado/${id}`);
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Sé transparente con las cifras: los rendimientos son estimaciones y no constituyen una promesa de ganancias.
      </p>
      <Campo id="n-titulo" label="Título de la oportunidad" error={errores.titulo}>
        <input id="n-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} placeholder="Ej.: Cafetería de especialidad en el centro" className={campoCls} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="n-rubro" label="Rubro" error={errores.rubro}>
          <input id="n-rubro" value={rubro} onChange={(e) => setRubro(e.target.value)} placeholder="Gastronomía, servicios…" className={campoCls} />
        </Campo>
        <Campo id="n-retorno" label="Retorno estimado" error={errores.retorno}>
          <input id="n-retorno" value={retorno} onChange={(e) => setRetorno(e.target.value)} placeholder="12–18 meses" className={campoCls} />
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Campo id="n-inversion" label="Inversión requerida" error={errores.inversion}>
          <input id="n-inversion" type="number" min="0" value={inversion} onChange={(e) => setInversion(e.target.value)} className={campoCls} />
        </Campo>
        <Campo id="n-moneda" label="Moneda">
          <select id="n-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Negocio["moneda"])} className={campoCls}>
            {(["USD", "EUR", "ARS", "MXN"] as const).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo id="n-ubicacion" label="Zona / ciudad" error={errores.ubicacion}>
        <input id="n-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} list="zonas-negocio" className={campoCls} />
        <datalist id="zonas-negocio">
          {ZONAS.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </Campo>
      <Campo id="n-descripcion" label="Descripción" error={errores.descripcion}>
        <textarea id="n-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} maxLength={800} className={campoCls} />
      </Campo>
      <SelectorFotos fotos={fotos} onChange={setFotos} max={2} error={errores.fotos} />
      <BotonPublicar disabled={enviando}>{enviando ? "Publicando…" : "Publicar oportunidad"}</BotonPublicar>
    </form>
  );
}
