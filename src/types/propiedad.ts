export type TipoPropiedad = "casa" | "departamento" | "terreno" | "local" | "villa";
export type Operacion = "venta" | "alquiler";

export interface Propiedad {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: TipoPropiedad;
  operacion: Operacion;
  precio: number;
  moneda: "USD" | "EUR" | "ARS" | "MXN";
  ubicacion: string;
  dormitorios: number;
  banos: number;
  superficie: number; // m²
  imagen: string; // portada (URL o data URL)
  galeria?: string[]; // fotos adicionales
  comodidades: string[];
  duenoId: string; // id de usuario (host)
  publicadaHace: number; // días
  guardados: number; // veces guardada
  relampago?: number; // % de descuento de la oferta relámpago vigente
  relampagoHasta?: number; // marca de tiempo (ms) en que termina
}
