"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoriaVehiculo, Vehiculo } from "@/types/mercado";
import type { Operacion } from "@/types/propiedad";
import { ZONAS } from "@/data/catalogos";
import { useSocial } from "@/context/SocialContext";
import { BotonPublicar, Campo, campoCls, CasillaRelampago, Chips, irAlPrimerError, SelectorFotos } from "@/components/publicar/comunes";

const CATEGORIAS = [
  { id: "auto", label: "🚗 Auto" },
  { id: "moto", label: "🏍️ Moto" },
  { id: "transporte", label: "🚌 Transporte" },
];

const EXTRAS = ["Aire acondicionado", "Papeles al día", "Único dueño", "GNC", "Seguro incluido", "Baúl", "Permuta"];

type Errores = Partial<Record<"titulo" | "marca" | "modelo" | "anio" | "precio" | "ubicacion" | "descripcion" | "fotos", string>>;

export default function FormVehiculo() {
  const router = useRouter();
  const { publicarVehiculo } = useSocial();

  const [categoria, setCategoria] = useState<CategoriaVehiculo>("auto");
  const [operacion, setOperacion] = useState<Operacion>("venta");
  const [titulo, setTitulo] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState("");
  const [km, setKm] = useState("0");
  const [precio, setPrecio] = useState("");
  const [moneda, setMoneda] = useState<Vehiculo["moneda"]>("USD");
  const [ubicacion, setUbicacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);
  const [relampago, setRelampago] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Errores = {};
    const anioN = Number(anio);
    if (titulo.trim().length < 5) e.titulo = "Escribe un título de al menos 5 caracteres.";
    if (!marca.trim()) e.marca = "Indica la marca.";
    if (!modelo.trim()) e.modelo = "Indica el modelo.";
    if (!(anioN >= 1950 && anioN <= new Date().getFullYear() + 1)) e.anio = "Indica un año válido.";
    if (!(Number(precio) > 0)) e.precio = "Indica un precio mayor que 0.";
    if (!ubicacion.trim()) e.ubicacion = "Indica la zona o ciudad.";
    if (descripcion.trim().length < 20) e.descripcion = "Describe el vehículo en al menos 20 caracteres.";
    if (fotos.length === 0) e.fotos = "Sube al menos una foto.";
    setErrores(e);
    if (Object.keys(e).length > 0) return irAlPrimerError();

    setEnviando(true);
    const id = await publicarVehiculo(
      {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoria,
        marca: marca.trim(),
        modelo: modelo.trim(),
        anio: anioN,
        km: Number(km) || 0,
        operacion,
        precio: Number(precio),
        moneda,
        ubicacion: ubicacion.trim(),
        imagen: fotos[0],
        extras,
      },
      relampago ? 10 : undefined,
    );
    setEnviando(false);
    if (id) router.push(`/mercado/${id}`);
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Tipo de vehículo</legend>
        <Chips opciones={CATEGORIAS} valor={categoria} onChange={(v) => setCategoria(v as CategoriaVehiculo)} />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">¿Qué quieres hacer?</legend>
        <Chips opciones={[{ id: "venta", label: "Vender" }, { id: "alquiler", label: "Alquilar" }]} valor={operacion} onChange={(v) => setOperacion(v as Operacion)} />
      </fieldset>

      <Campo id="v-titulo" label="Título del anuncio" error={errores.titulo}>
        <input id="v-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} placeholder="Ej.: Sedán familiar económico" className={campoCls} />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="v-marca" label="Marca" error={errores.marca}>
          <input id="v-marca" value={marca} onChange={(e) => setMarca(e.target.value)} className={campoCls} />
        </Campo>
        <Campo id="v-modelo" label="Modelo" error={errores.modelo}>
          <input id="v-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} className={campoCls} />
        </Campo>
        <Campo id="v-anio" label="Año" error={errores.anio}>
          <input id="v-anio" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} className={campoCls} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_120px]">
        <Campo id="v-km" label="Kilometraje">
          <input id="v-km" type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} className={campoCls} />
        </Campo>
        <Campo id="v-precio" label={operacion === "alquiler" ? "Precio por período" : "Precio de venta"} error={errores.precio}>
          <input id="v-precio" type="number" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} className={campoCls} />
        </Campo>
        <Campo id="v-moneda" label="Moneda">
          <select id="v-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Vehiculo["moneda"])} className={campoCls}>
            {(["USD", "EUR", "ARS", "MXN"] as const).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo id="v-ubicacion" label="Zona / ciudad" error={errores.ubicacion}>
        <input id="v-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} list="zonas-vehiculo" className={campoCls} />
        <datalist id="zonas-vehiculo">
          {ZONAS.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </Campo>

      <Campo id="v-descripcion" label="Descripción" error={errores.descripcion}>
        <textarea id="v-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} maxLength={800} className={campoCls} />
      </Campo>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Extras</legend>
        <Chips multiple color="emerald" opciones={EXTRAS.map((x) => ({ id: x, label: x }))} valor={extras} onChange={(x) => setExtras((l) => (l.includes(x) ? l.filter((y) => y !== x) : [...l, x]))} />
      </fieldset>

      <SelectorFotos fotos={fotos} onChange={setFotos} max={4} error={errores.fotos} />
      <CasillaRelampago activa={relampago} onChange={setRelampago} />
      <BotonPublicar disabled={enviando}>{enviando ? "Publicando…" : "Publicar vehículo"}</BotonPublicar>
    </form>
  );
}
