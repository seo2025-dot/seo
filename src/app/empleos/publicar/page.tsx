"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CategoriaServicio, Gig, Vacante } from "@/types/mercado";
import { ETIQUETA_SERVICIO } from "@/data/catalogos";
import { useSocial } from "@/context/SocialContext";
import { BotonPublicar, Campo, campoCls, Chips, irAlPrimerError, SelectorFotos } from "@/components/publicar/comunes";

type ErroresGig = Partial<Record<"titulo" | "descripcion" | "precio" | "entrega" | "fotos", string>>;
type ErroresVac = Partial<Record<"titulo" | "descripcion" | "presupuesto" | "ubicacion" | "skills", string>>;

function FormServicio() {
  const router = useRouter();
  const { publicarServicio } = useSocial();
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<CategoriaServicio>("fotografia");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [moneda, setMoneda] = useState<Gig["moneda"]>("USD");
  const [entrega, setEntrega] = useState("3");
  const [fotos, setFotos] = useState<string[]>([]);
  const [errores, setErrores] = useState<ErroresGig>({});
  const [enviando, setEnviando] = useState(false);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: ErroresGig = {};
    if (titulo.trim().length < 8) e.titulo = "Escribe un título de al menos 8 caracteres.";
    if (descripcion.trim().length < 20) e.descripcion = "Describe tu servicio en al menos 20 caracteres.";
    if (!(Number(precio) > 0)) e.precio = "Indica un precio base mayor que 0.";
    if (!(Number(entrega) >= 1)) e.entrega = "Indica el plazo en días (mínimo 1).";
    if (fotos.length === 0) e.fotos = "Sube una imagen representativa.";
    setErrores(e);
    if (Object.keys(e).length > 0) return irAlPrimerError();
    setEnviando(true);
    const id = await publicarServicio({
      titulo: titulo.trim(),
      categoria,
      descripcion: descripcion.trim(),
      precioDesde: Number(precio),
      moneda,
      entregaDias: Math.round(Number(entrega)),
      imagen: fotos[0],
    });
    setEnviando(false);
    if (id) router.push("/empleos");
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Categoría</legend>
        <Chips
          opciones={(Object.keys(ETIQUETA_SERVICIO) as CategoriaServicio[]).map((c) => ({ id: c, label: `${ETIQUETA_SERVICIO[c].emoji} ${ETIQUETA_SERVICIO[c].label}` }))}
          valor={categoria}
          onChange={(v) => setCategoria(v as CategoriaServicio)}
        />
      </fieldset>
      <Campo id="g-titulo" label="Título del servicio" error={errores.titulo}>
        <input id="g-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={90} placeholder="Ej.: Fotos HDR y tour 360° de tu propiedad" className={campoCls} />
      </Campo>
      <Campo id="g-desc" label="Descripción" error={errores.descripcion}>
        <textarea id="g-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} maxLength={600} className={campoCls} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px_1fr]">
        <Campo id="g-precio" label="Precio desde" error={errores.precio}>
          <input id="g-precio" type="number" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} className={campoCls} />
        </Campo>
        <Campo id="g-moneda" label="Moneda">
          <select id="g-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Gig["moneda"])} className={campoCls}>
            {(["USD", "EUR", "ARS", "MXN"] as const).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Campo>
        <Campo id="g-entrega" label="Entrega (días)" error={errores.entrega}>
          <input id="g-entrega" type="number" min="1" value={entrega} onChange={(e) => setEntrega(e.target.value)} className={campoCls} />
        </Campo>
      </div>
      <SelectorFotos fotos={fotos} onChange={setFotos} max={1} error={errores.fotos} />
      <BotonPublicar disabled={enviando}>{enviando ? "Publicando…" : "Publicar servicio"}</BotonPublicar>
    </form>
  );
}

function FormVacante() {
  const router = useRouter();
  const { publicarVacante } = useSocial();
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<Vacante["tipo"]>("contrato");
  const [modalidad, setModalidad] = useState<Vacante["modalidad"]>("remoto");
  const [ubicacion, setUbicacion] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [skills, setSkills] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [errores, setErrores] = useState<ErroresVac>({});
  const [enviando, setEnviando] = useState(false);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const lista = skills.split(",").map((s) => s.trim()).filter(Boolean);
    const e: ErroresVac = {};
    if (titulo.trim().length < 5) e.titulo = "Escribe un título de al menos 5 caracteres.";
    if (descripcion.trim().length < 20) e.descripcion = "Describe la vacante en al menos 20 caracteres.";
    if (!presupuesto.trim()) e.presupuesto = "Indica la remuneración o presupuesto.";
    if (!ubicacion.trim()) e.ubicacion = "Indica la ubicación.";
    if (lista.length === 0) e.skills = "Añade al menos una habilidad (separadas por comas).";
    setErrores(e);
    if (Object.keys(e).length > 0) return irAlPrimerError();
    setEnviando(true);
    const id = await publicarVacante({ titulo: titulo.trim(), tipo, modalidad, ubicacion: ubicacion.trim(), presupuesto: presupuesto.trim(), skills: lista, descripcion: descripcion.trim() });
    setEnviando(false);
    if (id) router.push("/empleos");
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <Campo id="e-titulo" label="Título de la vacante o proyecto" error={errores.titulo}>
        <input id="e-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={90} className={campoCls} />
      </Campo>
      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Tipo</legend>
          <Chips
            opciones={[{ id: "tiempo-completo", label: "Tiempo completo" }, { id: "contrato", label: "Contrato" }, { id: "proyecto", label: "Proyecto" }]}
            valor={tipo}
            onChange={(v) => setTipo(v as Vacante["tipo"])}
          />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Modalidad</legend>
          <Chips
            opciones={[{ id: "remoto", label: "Remoto" }, { id: "presencial", label: "Presencial" }, { id: "hibrido", label: "Híbrido" }]}
            valor={modalidad}
            onChange={(v) => setModalidad(v as Vacante["modalidad"])}
          />
        </fieldset>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="e-ubicacion" label="Ubicación" error={errores.ubicacion}>
          <input id="e-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={campoCls} />
        </Campo>
        <Campo id="e-presupuesto" label="Remuneración / presupuesto" error={errores.presupuesto}>
          <input id="e-presupuesto" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} placeholder="USD 600 por proyecto" className={campoCls} />
        </Campo>
      </div>
      <Campo id="e-skills" label="Habilidades requeridas (separadas por comas)" error={errores.skills}>
        <input id="e-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Fotografía, Edición, Drone" className={campoCls} />
      </Campo>
      <Campo id="e-desc" label="Descripción" error={errores.descripcion}>
        <textarea id="e-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} maxLength={600} className={campoCls} />
      </Campo>
      <BotonPublicar disabled={enviando}>{enviando ? "Publicando…" : "Publicar vacante"}</BotonPublicar>
    </form>
  );
}

export default function PublicarEmpleoPage() {
  const [tab, setTab] = useState<"servicio" | "vacante">("servicio");
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/empleos" className="text-sm text-brand-600 hover:underline">
        ← Volver a empleos y servicios
      </Link>
      <h1 className="mt-3 text-3xl font-bold">Publicar en Empleos</h1>
      <div role="tablist" className="mt-6 grid grid-cols-2 gap-3">
        {(
          [
            ["servicio", "🛠️ Ofrezco un servicio", "Vende tus habilidades (gig)"],
            ["vacante", "💼 Busco talento", "Publica una vacante o proyecto"],
          ] as const
        ).map(([id, titulo, sub]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-2xl border-2 p-4 text-left transition ${tab === id ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-brand-300"}`}
          >
            <span className="block font-bold">{titulo}</span>
            <span className="text-xs text-slate-500">{sub}</span>
          </button>
        ))}
      </div>
      <div className="mt-8">{tab === "servicio" ? <FormServicio /> : <FormVacante />}</div>
    </div>
  );
}