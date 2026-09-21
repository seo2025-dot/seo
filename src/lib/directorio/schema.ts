import { DIAS, type DiaId } from "@/data/directorio";
import type { Proveedor } from "@/types/directorio";

/** Tipo de schema.org que mejor describe cada categoría (Google lo usa para los resultados enriquecidos). */
const TIPO_SCHEMA: Record<string, string> = {
  restaurante: "Restaurant",
  cafeteria: "CafeOrCoffeeShop",
  panaderia: "Bakery",
  mercado: "GroceryStore",
  comida_rapida: "FastFoodRestaurant",
  farmacia: "Pharmacy",
  clinica: "MedicalClinic",
  consultorio: "Physician",
  laboratorio: "MedicalBusiness",
  odontologia: "Dentist",
  veterinaria: "AnimalShelter",
  tienda_de_mascotas: "PetStore",
  plomero: "Plumber",
  electricista: "Electrician",
  cerrajero: "Locksmith",
};

const DIA_SCHEMA: Record<DiaId, string> = { lun: "Monday", mar: "Tuesday", mie: "Wednesday", jue: "Thursday", vie: "Friday", sab: "Saturday", dom: "Sunday" };

export const tipoSchema = (subtipo: string) => TIPO_SCHEMA[subtipo] ?? "LocalBusiness";

/**
 * Datos estructurados (JSON-LD) de un negocio. Deliberadamente NO incluye teléfono ni dirección exacta: en el directorio solo se
 * ven con sesión. Sí incluye ciudad, zona, horario y la valoración cuando hay reseñas.
 */
export function jsonLdProveedor(p: Proveedor, url: string): Record<string, unknown> {
  const horario = p.abierto24h
    ? DIAS.map((d) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DIA_SCHEMA[d], opens: "00:00", closes: "23:59" }))
    : DIAS.flatMap((d) => (p.horario[d] ?? []).map(([abre, cierra]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DIA_SCHEMA[d], opens: abre, closes: cierra === "24:00" ? "23:59" : cierra })));
  return {
    "@context": "https://schema.org",
    "@type": tipoSchema(p.subtipo),
    name: p.nombre,
    url,
    ...(p.descripcion ? { description: p.descripcion } : {}),
    ...(p.logoUrl ? { logo: p.logoUrl } : {}),
    ...(p.portadaUrl ? { image: p.portadaUrl } : {}),
    address: { "@type": "PostalAddress", addressLocality: p.ciudad, addressCountry: "EC", ...(p.zona ? { addressRegion: p.zona } : {}) },
    ...(p.lat !== undefined && p.lng !== undefined ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } } : {}),
    ...(horario.length > 0 ? { openingHoursSpecification: horario } : {}),
    ...(p.resenas > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.resenas, bestRating: 5, worstRating: 1 } } : {}),
  };
}

/** Serializa JSON-LD para incrustarlo en un <script>: escapa «<» para que ningún texto de un negocio pueda cerrar la etiqueta. */
const BARRA = String.fromCharCode(92);
const SEPARADORES = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");
export const jsonLdSeguro = (datos: unknown) =>
  JSON.stringify(datos)
    .replace(/</g, `${BARRA}u003c`)
    .replace(SEPARADORES, (c) => `${BARRA}u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
