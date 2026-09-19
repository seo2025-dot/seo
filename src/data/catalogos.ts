import type { CategoriaServicio } from "@/types/mercado";

// Catálogos de referencia de la interfaz (los datos reales viven en Supabase).

export const ZONAS = [
  "Zona Norte",
  "Centro",
  "Zona Sur",
  "Las Lomas",
  "Barrio Histórico",
  "Puerto Nuevo",
  "Country Los Pinos",
  "Valle Alto",
];

export const COMODIDADES_SUGERIDAS = [
  "Wifi",
  "Piscina",
  "Jardín",
  "Garaje",
  "Parrilla",
  "Aire acondicionado",
  "Amoblado",
  "Pet friendly",
  "Balcón",
  "Seguridad 24 h",
  "Gimnasio",
  "Terraza",
];

export const ESTILOS_VIDA = [
  "Deportista", "Viajero", "Foodie", "Creativo", "Emprendedor", "Casero",
  "Nocturno", "Mascotas", "Espiritual", "Lector", "Gamer", "Familiar", "Amante de las plantas",
];

export const ETIQUETA_SERVICIO: Record<CategoriaServicio, { label: string; emoji: string }> = {
  fotografia: { label: "Fotografía inmobiliaria", emoji: "📸" },
  arquitectura: { label: "Arquitectura", emoji: "📐" },
  plomeria: { label: "Plomería", emoji: "🔧" },
  legal: { label: "Legal", emoji: "⚖️" },
  tarot: { label: "Tarot y astrología", emoji: "🔮" },
  diseno: { label: "Diseño", emoji: "🎨" },
  mudanzas: { label: "Mudanzas", emoji: "📦" },
};
