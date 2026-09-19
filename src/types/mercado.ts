import type { Operacion } from "@/types/propiedad";

export type CategoriaVehiculo = "auto" | "moto" | "transporte";

export interface Vehiculo {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaVehiculo;
  marca: string;
  modelo: string;
  anio: number;
  km: number;
  operacion: Operacion;
  precio: number;
  moneda: "USD" | "EUR" | "ARS" | "MXN";
  ubicacion: string;
  imagen: string;
  extras: string[];
  duenoId: string;
  publicadaHace: number;
  guardados: number;
  relampago?: number; // % de descuento de la oferta relámpago vigente
  relampagoHasta?: number; // marca de tiempo (ms) en que termina
}

export interface Negocio {
  id: string;
  titulo: string;
  descripcion: string;
  rubro: string;
  inversion: number;
  moneda: "USD" | "EUR" | "ARS" | "MXN";
  retorno: string; // ej.: "12–18 meses"
  ubicacion: string;
  imagen: string;
  duenoId: string;
  publicadaHace: number;
  guardados: number;
}

/** Requerimiento publicado por un comprador/inquilino ("Busco…"). */
export interface Demanda {
  id: string;
  autorId: string;
  categoria: "inmueble" | "vehiculo";
  operacion: "comprar" | "alquilar";
  tipo: string; // TipoPropiedad | CategoriaVehiculo | "" (cualquiera)
  zona: string; // "" = cualquiera
  presupuestoMax: number;
  moneda: "USD" | "EUR" | "ARS" | "MXN";
  superficieMin?: number;
  nota: string;
  ts: number;
}

export interface Notificacion {
  id: string;
  tipo: "match-demanda" | "match-persona" | "solicitud" | "oferta" | "kyc" | "recompensa" | "sistema";
  texto: string;
  href?: string;
  ts: number;
  leida: boolean;
}

export type CategoriaServicio =
  | "fotografia"
  | "arquitectura"
  | "plomeria"
  | "legal"
  | "tarot"
  | "diseno"
  | "mudanzas";

export interface Gig {
  id: string;
  autorId: string;
  titulo: string;
  categoria: CategoriaServicio;
  descripcion: string;
  precioDesde: number;
  moneda: "USD" | "EUR" | "ARS" | "MXN";
  entregaDias: number;
  imagen: string;
  ventas: number;
}

export interface Vacante {
  id: string;
  autorId: string;
  titulo: string;
  tipo: "tiempo-completo" | "contrato" | "proyecto";
  modalidad: "remoto" | "presencial" | "hibrido";
  ubicacion: string;
  presupuesto: string;
  skills: string[];
  descripcion: string;
  ts: number;
}

/** Vista común de cualquier oferta (inmueble, vehículo, negocio) para tarjetas, swipe y chat. */
export interface Anuncio {
  id: string;
  tipo: "propiedad" | "vehiculo" | "negocio";
  subtipo: string; // tipo de inmueble, categoría de vehículo o rubro
  titulo: string;
  descripcion: string;
  imagen: string;
  precio: number;
  moneda: string;
  operacion?: Operacion; // undefined en negocios
  ubicacion: string;
  duenoId: string;
  chips: string[];
  publicadaHace: number;
  guardados: number;
  relampago?: number;
  relampagoHasta?: number;
  superficie?: number;
  href: string;
}
