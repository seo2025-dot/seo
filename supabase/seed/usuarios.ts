import type { Usuario } from "@/types/social";

const todas = { identidad: true, telefono: true, email: true };
const img = (id: string) => `https://images.unsplash.com/${id}?w=600&q=75&auto=format&fit=crop`;

// Comunidad de ejemplo. Sustituir por usuarios reales de tu backend.
export const USUARIOS: Usuario[] = [
  // — Anfitriones y vendedores (dueños de las ofertas de ejemplo) —
  {
    id: "u1", nombre: "Lucía Ferrer", usuario: "@lucia.ferrer",
    bio: "Anfitriona desde 2021. Me encanta que la gente encuentre un hogar donde sentirse bien.",
    ubicacion: "Zona Norte", intereses: ["anfitrion", "inversor"], zonas: ["Zona Norte", "Las Lomas"],
    badges: ["superhost", "respuesta-rapida", "fundador"], verificaciones: todas,
    rating: 4.9, resenas: 48, respuesta: 98, miembroDesde: 2021, signo: "leo", edad: 38,
  },
  {
    id: "u2", nombre: "Martín Sosa", usuario: "@martin.sosa",
    bio: "Alquileres céntricos, trato directo y sin sorpresas.",
    ubicacion: "Centro", intereses: ["anfitrion"], zonas: ["Centro"],
    badges: ["respuesta-rapida"], verificaciones: todas,
    rating: 4.7, resenas: 31, respuesta: 94, miembroDesde: 2022, signo: "virgo", edad: 41,
  },
  {
    id: "u3", nombre: "Carolina Vidal", usuario: "@caro.vidal",
    bio: "Terrenos y proyectos. Si buscas dónde construir, hablemos.",
    ubicacion: "Zona Sur", intereses: ["anfitrion", "inversor"], zonas: ["Zona Sur", "Valle Alto"],
    badges: ["inversor-pro"], verificaciones: { identidad: true, telefono: true, email: false },
    rating: 4.6, resenas: 12, respuesta: 88, miembroDesde: 2023, signo: "capricornio", edad: 36,
  },
  {
    id: "u4", nombre: "Andrés Molina", usuario: "@andres.molina",
    bio: "Propiedades premium, autos de colección y oportunidades de inversión.",
    ubicacion: "Las Lomas", intereses: ["anfitrion", "inversor"], zonas: ["Las Lomas", "Country Los Pinos"],
    badges: ["superhost", "inversor-pro"], verificaciones: todas,
    rating: 4.8, resenas: 57, respuesta: 96, miembroDesde: 2020, signo: "escorpio", edad: 44,
  },
  {
    id: "u5", nombre: "Valeria Núñez", usuario: "@vale.nunez",
    bio: "Lofts y espacios con carácter en el casco histórico.",
    ubicacion: "Barrio Histórico", intereses: ["anfitrion"], zonas: ["Barrio Histórico", "Centro"],
    badges: ["respuesta-rapida", "vecino-activo"], verificaciones: todas,
    rating: 4.9, resenas: 22, respuesta: 99, miembroDesde: 2023, signo: "piscis", edad: 33,
  },
  {
    id: "u6", nombre: "Diego Paredes", usuario: "@diego.paredes",
    bio: "Departamentos con vista, motos y buena rentabilidad.",
    ubicacion: "Puerto Nuevo", intereses: ["anfitrion", "inversor"], zonas: ["Puerto Nuevo"],
    badges: ["inversor-pro"], verificaciones: { identidad: true, telefono: false, email: true },
    rating: 4.5, resenas: 17, respuesta: 85, miembroDesde: 2022, signo: "tauro", edad: 39,
  },
  {
    id: "u7", nombre: "Sofía Aguirre", usuario: "@sofi.aguirre",
    bio: "Casas familiares en barrios cerrados. Mudanzas sin estrés.",
    ubicacion: "Country Los Pinos", intereses: ["anfitrion"], zonas: ["Country Los Pinos"],
    badges: ["superhost"], verificaciones: todas,
    rating: 4.8, resenas: 39, respuesta: 97, miembroDesde: 2021, signo: "cancer", edad: 35,
  },
  {
    id: "u8", nombre: "Ricardo Beltrán", usuario: "@ricardo.beltran",
    bio: "Residencias señoriales, transporte y patrimonio familiar.",
    ubicacion: "Valle Alto", intereses: ["anfitrion", "inversor"], zonas: ["Valle Alto", "Las Lomas"],
    badges: ["inversor-pro", "fundador"], verificaciones: todas,
    rating: 4.7, resenas: 26, respuesta: 90, miembroDesde: 2020, signo: "sagitario", edad: 52,
  },
  // — Personas de la comunidad (citas, roomies, inversores, compradores) —
  {
    id: "u9", nombre: "Camila Rojas", usuario: "@cami.rojas",
    bio: "Diseñadora gráfica. Busco roomie tranquila, con buena onda y plantas 🌿.",
    ubicacion: "Centro", intereses: ["roomie", "inquilino", "amigos"], zonas: ["Centro", "Barrio Histórico"],
    badges: ["roomie-ideal", "vecino-activo"], verificaciones: todas,
    rating: 4.9, resenas: 8, respuesta: 95, miembroDesde: 2024, presupuesto: "USD 400–600 / mes",
    signo: "geminis", edad: 29, relaciones: ["amistad", "roomie"], estilo: ["Creativa", "Amante de las plantas", "Foodie"],
  },
  {
    id: "u10", nombre: "Javier Ortega", usuario: "@javi.ortega",
    bio: "Primera vivienda en camino. Comparto lo que voy aprendiendo del proceso.",
    ubicacion: "Zona Norte", intereses: ["comprador", "inversor"], zonas: ["Zona Norte", "Puerto Nuevo"],
    badges: ["explorador"], verificaciones: todas,
    rating: 4.6, resenas: 4, respuesta: 90, miembroDesde: 2025, presupuesto: "USD 150–250 mil",
    signo: "aries", edad: 32, relaciones: ["pareja", "socios"], estilo: ["Deportista", "Emprendedor", "Viajero"],
  },
  {
    id: "u11", nombre: "Paula Herrera", usuario: "@pau.herrera",
    bio: "Nueva en la ciudad. Busco gente para compartir depto y salir a descubrir barrios.",
    ubicacion: "Puerto Nuevo", intereses: ["amigos", "roomie"], zonas: ["Centro", "Puerto Nuevo"],
    badges: ["explorador", "respuesta-rapida"], verificaciones: { identidad: false, telefono: true, email: true },
    rating: 4.8, resenas: 5, respuesta: 97, miembroDesde: 2025, presupuesto: "USD 350–500 / mes",
    signo: "libra", edad: 27, relaciones: ["amistad", "pareja", "roomie"], estilo: ["Nocturna", "Viajera", "Mascotas"],
  },
  {
    id: "u12", nombre: "Tomás Iglesias", usuario: "@tomas.iglesias",
    bio: "Inversor en propiedades para renta. Busco socios para proyectos pequeños.",
    ubicacion: "Zona Sur", intereses: ["inversor"], zonas: ["Zona Sur", "Valle Alto"],
    badges: ["inversor-pro"], verificaciones: todas,
    rating: 4.7, resenas: 14, respuesta: 86, miembroDesde: 2022, presupuesto: "USD 80–300 mil",
    signo: "tauro", edad: 40, relaciones: ["socios"], estilo: ["Emprendedor", "Lector", "Casero"],
  },
  {
    id: "u13", nombre: "Nadia Campos", usuario: "@nadia.campos",
    bio: "Familia de cuatro buscando casa con jardín. Fan de los barrios cerrados.",
    ubicacion: "Las Lomas", intereses: ["comprador", "amigos"], zonas: ["Las Lomas", "Country Los Pinos"],
    badges: ["vecino-activo"], verificaciones: { identidad: true, telefono: true, email: false },
    rating: 4.5, resenas: 3, respuesta: 92, miembroDesde: 2024, presupuesto: "USD 300–450 mil",
    signo: "acuario", edad: 37, relaciones: ["amistad"], estilo: ["Familiar", "Mascotas", "Casera"],
  },
  {
    id: "u14", nombre: "Bruno Salvatierra", usuario: "@bruno.salva",
    bio: "Desarrollador remoto. Roomie ordenado, cocino los domingos.",
    ubicacion: "Centro", intereses: ["roomie", "inquilino"], zonas: ["Centro", "Zona Norte"],
    badges: ["roomie-ideal"], verificaciones: todas,
    rating: 4.9, resenas: 11, respuesta: 93, miembroDesde: 2023, presupuesto: "USD 450–700 / mes",
    signo: "virgo", edad: 31, relaciones: ["roomie", "amistad"], estilo: ["Casero", "Foodie", "Gamer"],
  },
  // — Freelancers —
  {
    id: "u15", nombre: "Elena Quiroga", usuario: "@elena.foto",
    bio: "Fotógrafa inmobiliaria: haz que tu propiedad se venda sola.",
    ubicacion: "Centro", intereses: ["amigos"], zonas: ["Centro", "Zona Norte"],
    badges: ["freelancer-top", "respuesta-rapida"], verificaciones: todas,
    rating: 5.0, resenas: 64, respuesta: 99, miembroDesde: 2021, signo: "leo", edad: 34,
    relaciones: ["amistad", "pareja"], estilo: ["Creativa", "Viajera", "Deportista"],
    profesional: {
      titular: "Fotógrafa y video inmobiliario",
      skills: ["Fotografía HDR", "Drone", "Tour 360°", "Edición"],
      portafolio: [img("photo-1600585154340-be6161a56a0c"), img("photo-1512917774080-9991f1c4c750"), img("photo-1522708323590-d24dbb6b0267")],
    },
  },
  {
    id: "u16", nombre: "Marcos Duarte", usuario: "@marcos.arq",
    bio: "Arquitecto: remodelaciones, planos y dirección de obra.",
    ubicacion: "Zona Sur", intereses: ["inversor"], zonas: ["Zona Sur", "Valle Alto"],
    badges: ["freelancer-top"], verificaciones: todas,
    rating: 4.8, resenas: 37, respuesta: 92, miembroDesde: 2020, signo: "capricornio", edad: 45,
    relaciones: ["socios"], estilo: ["Emprendedor", "Lector"],
    profesional: {
      titular: "Arquitecto y director de obra",
      skills: ["Planos", "Remodelación", "Render 3D", "Permisos"],
      portafolio: [img("photo-1503387762-592deb58ef4e"), img("photo-1580587771525-78b9dba3b914")],
    },
  },
  {
    id: "u17", nombre: "Nicolás Ferro", usuario: "@nico.plomero",
    bio: "Plomería y gasfitería 24 h. Presupuesto sin cargo.",
    ubicacion: "Zona Norte", intereses: ["amigos"], zonas: ["Zona Norte", "Centro"],
    badges: ["respuesta-rapida"], verificaciones: { identidad: true, telefono: true, email: false },
    rating: 4.7, resenas: 88, respuesta: 96, miembroDesde: 2022, signo: "aries", edad: 42,
    relaciones: ["amistad"], estilo: ["Deportista", "Familiar"],
    profesional: {
      titular: "Plomero matriculado",
      skills: ["Fugas", "Instalaciones", "Calefones", "Urgencias"],
      portafolio: [img("photo-1504148455328-c376907d081c")],
    },
  },
  {
    id: "u18", nombre: "Renata Silva", usuario: "@renata.legal",
    bio: "Abogada inmobiliaria: escrituras, contratos y sucesiones.",
    ubicacion: "Centro", intereses: ["inversor"], zonas: ["Centro"],
    badges: ["freelancer-top"], verificaciones: todas,
    rating: 4.9, resenas: 52, respuesta: 94, miembroDesde: 2021, signo: "libra", edad: 39,
    relaciones: ["socios", "amistad"], estilo: ["Lectora", "Viajera"],
    profesional: {
      titular: "Abogada especialista en derecho inmobiliario",
      skills: ["Contratos", "Escrituras", "Due diligence", "Sucesiones"],
      portafolio: [img("photo-1589829545856-d10d557cf95f")],
    },
  },
  {
    id: "u19", nombre: "Mariana Ortiz", usuario: "@luna.tarot",
    bio: "Tarotista y astróloga. Lecturas con cariño y sin promesas mágicas ✨",
    ubicacion: "Barrio Histórico", intereses: ["amigos"], zonas: ["Barrio Histórico"],
    badges: ["guia-astral", "respuesta-rapida"], verificaciones: todas,
    rating: 4.9, resenas: 120, respuesta: 97, miembroDesde: 2022, signo: "piscis", edad: 35,
    relaciones: ["amistad", "pareja"], estilo: ["Espiritual", "Nocturna", "Mascotas"],
    profesional: {
      titular: "Tarotista y astróloga",
      skills: ["Tarot", "Carta astral", "Sinastría", "Retorno solar"],
      portafolio: [img("photo-1601158935942-52255782d322")],
    },
  },
  {
    id: "u20", nombre: "Gabriel Lima", usuario: "@gabo.diseno",
    bio: "Diseñador gráfico y de marca para negocios inmobiliarios.",
    ubicacion: "Centro", intereses: ["amigos"], zonas: ["Centro"],
    badges: ["freelancer-top"], verificaciones: { identidad: true, telefono: true, email: true },
    rating: 4.8, resenas: 41, respuesta: 91, miembroDesde: 2023, signo: "geminis", edad: 30,
    relaciones: ["amistad", "pareja", "socios"], estilo: ["Creativo", "Gamer", "Foodie"],
    profesional: {
      titular: "Diseñador de marca y contenido",
      skills: ["Logos", "Branding", "Redes sociales", "Presentaciones"],
      portafolio: [img("photo-1561070791-2526d30994b5")],
    },
  },
  // — Más personas para Citas —
  {
    id: "u21", nombre: "Sebastián Vera", usuario: "@sebas.vera",
    bio: "Amante de los viajes y del buen café. Busco conexión real, sin prisa.",
    ubicacion: "Puerto Nuevo", intereses: ["amigos", "comprador"], zonas: ["Puerto Nuevo", "Centro"],
    badges: ["explorador"], verificaciones: { identidad: true, telefono: true, email: true },
    rating: 4.7, resenas: 6, respuesta: 90, miembroDesde: 2024,
    signo: "sagitario", edad: 33, relaciones: ["pareja", "amistad"], estilo: ["Viajero", "Deportista", "Foodie"],
  },
  {
    id: "u22", nombre: "Antonella Ríos", usuario: "@anto.rios",
    bio: "Psicóloga, lectora y fan de las plantas. Busco algo bonito y honesto.",
    ubicacion: "Barrio Histórico", intereses: ["amigos", "inquilino"], zonas: ["Barrio Histórico", "Centro"],
    badges: ["vecino-activo"], verificaciones: todas,
    rating: 4.9, resenas: 9, respuesta: 96, miembroDesde: 2024,
    signo: "escorpio", edad: 30, relaciones: ["pareja"], estilo: ["Lectora", "Espiritual", "Amante de las plantas"],
  },
  {
    id: "u23", nombre: "Mateo Blanco", usuario: "@mateo.blanco",
    bio: "Emprendedor serial. Busco socios y gente con ganas de construir cosas.",
    ubicacion: "Zona Norte", intereses: ["inversor", "amigos"], zonas: ["Zona Norte", "Las Lomas"],
    badges: ["inversor-pro"], verificaciones: todas,
    rating: 4.6, resenas: 10, respuesta: 88, miembroDesde: 2023, presupuesto: "USD 50–200 mil",
    signo: "acuario", edad: 34, relaciones: ["socios", "amistad"], estilo: ["Emprendedor", "Viajero", "Nocturno"],
  },
];

export const ESTILOS_VIDA = [
  "Deportista", "Viajero", "Foodie", "Creativo", "Emprendedor", "Casero",
  "Nocturno", "Mascotas", "Espiritual", "Lector", "Gamer", "Familiar", "Amante de las plantas",
];

export const YO_INICIAL: Usuario = {
  id: "yo",
  nombre: "Tú",
  usuario: "@tu_usuario",
  bio: "Cuéntale a la comunidad qué buscas: edita tu perfil para recibir mejores matches.",
  ubicacion: "",
  intereses: [],
  zonas: [],
  badges: ["explorador"],
  verificaciones: { identidad: false, telefono: false, email: false },
  rating: 0,
  resenas: 0,
  respuesta: 100,
  miembroDesde: new Date().getFullYear(),
};

export const obtenerUsuarioSeed = (id: string) => USUARIOS.find((u) => u.id === id);
