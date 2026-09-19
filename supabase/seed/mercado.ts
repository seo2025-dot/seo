import type { Demanda, Gig, Negocio, Vacante, Vehiculo } from "@/types/mercado";

const img = (id: string) => `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;

// Datos de ejemplo del marketplace. Sustituir por base de datos / API.

export const VEHICULOS: Vehiculo[] = [
  {
    id: "v1", titulo: "Coupé deportivo en excelente estado", categoria: "auto", marca: "Porsche", modelo: "911",
    anio: 2018, km: 42000, operacion: "venta", precio: 89000, moneda: "USD", ubicacion: "Las Lomas",
    descripcion: "Único dueño, servicios oficiales al día, interior cuero. Se acepta inspección mecánica.",
    imagen: img("photo-1503376780353-7e6692767b70"), extras: ["Cuero", "Techo solar", "Cámara trasera"],
    duenoId: "u4", publicadaHace: 2, guardados: 31, relampago: 8,
  },
  {
    id: "v2", titulo: "Sedán familiar económico", categoria: "auto", marca: "Toyota", modelo: "Corolla",
    anio: 2020, km: 58000, operacion: "venta", precio: 17500, moneda: "USD", ubicacion: "Zona Norte",
    descripcion: "Muy bien cuidado, bajo consumo, papeles al día. Ideal primer auto o uso familiar.",
    imagen: img("photo-1494976388531-d1058494cdd8"), extras: ["Aire acondicionado", "Bluetooth", "Airbags"],
    duenoId: "u1", publicadaHace: 5, guardados: 14,
  },
  {
    id: "v3", titulo: "Auto rojo para alquilar por día", categoria: "auto", marca: "Mazda", modelo: "3",
    anio: 2021, km: 30000, operacion: "alquiler", precio: 45, moneda: "USD", ubicacion: "Centro",
    descripcion: "Alquiler por día con seguro incluido. Depósito reembolsable. Entrega en el centro.",
    imagen: img("photo-1552519507-da3b142c6e3d"), extras: ["Seguro incluido", "Kilometraje libre"],
    duenoId: "u2", publicadaHace: 1, guardados: 9,
  },
  {
    id: "v4", titulo: "Moto de aventura lista para ruta", categoria: "moto", marca: "Honda", modelo: "XR 300",
    anio: 2022, km: 12000, operacion: "venta", precio: 6200, moneda: "USD", ubicacion: "Puerto Nuevo",
    descripcion: "Muy poco uso, equipada con baúl y protectores. Permuta por auto pequeño.",
    imagen: img("photo-1558981806-ec527fa84c39"), extras: ["Baúl", "Protectores", "Escape deportivo"],
    duenoId: "u6", publicadaHace: 3, guardados: 18,
  },
  {
    id: "v5", titulo: "Scooter urbana en alquiler mensual", categoria: "moto", marca: "Vespa", modelo: "Primavera",
    anio: 2021, km: 9000, operacion: "alquiler", precio: 160, moneda: "USD", ubicacion: "Barrio Histórico",
    descripcion: "Perfecta para moverte por el centro. Incluye casco y seguro básico.",
    imagen: img("photo-1568772585407-9361f9bf3a87"), extras: ["Casco incluido", "Seguro básico"],
    duenoId: "u5", publicadaHace: 0, guardados: 6,
  },
  {
    id: "v6", titulo: "Minibús turístico de 20 plazas", categoria: "transporte", marca: "Mercedes-Benz", modelo: "Sprinter",
    anio: 2019, km: 120000, operacion: "venta", precio: 38000, moneda: "USD", ubicacion: "Valle Alto",
    descripcion: "Habilitado para turismo, con aire y asientos reclinables. Ideal para emprendimiento de traslados.",
    imagen: img("photo-1544620347-c4fd4a3d5957"), extras: ["Habilitación turística", "Aire acondicionado", "Baúl"],
    duenoId: "u8", publicadaHace: 7, guardados: 12,
  },
];

export const NEGOCIOS: Negocio[] = [
  {
    id: "n1", titulo: "Cafetería de especialidad en pleno centro", rubro: "Gastronomía",
    inversion: 45000, moneda: "USD", retorno: "18–24 meses", ubicacion: "Centro",
    descripcion: "Local equipado con clientela fija y marca propia. Se vende por cambio de ciudad; incluye capacitación.",
    imagen: img("photo-1559526324-4b87b5e36e44"), duenoId: "u2", publicadaHace: 4, guardados: 22,
  },
  {
    id: "n2", titulo: "Coworking con 40 puestos, busca socio inversor", rubro: "Inmobiliario / Servicios",
    inversion: 80000, moneda: "USD", retorno: "24–30 meses", ubicacion: "Puerto Nuevo",
    descripcion: "Espacio ya operativo con 70 % de ocupación. Buscamos socio para abrir una segunda sede.",
    imagen: img("photo-1521737604893-d14cc237f11d"), duenoId: "u6", publicadaHace: 8, guardados: 17,
  },
  {
    id: "n3", titulo: "Agencia de gestión de alquileres temporales", rubro: "Servicios",
    inversion: 25000, moneda: "USD", retorno: "12–18 meses", ubicacion: "Zona Norte",
    descripcion: "Cartera de 18 propiedades gestionadas. Se traspasa con procesos, marca y plataforma de reservas.",
    imagen: img("photo-1556761175-5973dc0f32e7"), duenoId: "u1", publicadaHace: 6, guardados: 13,
  },
];

const SERV_IMG = {
  fotografia: img("photo-1516035069371-29a1b244cc32"),
  arquitectura: img("photo-1503387762-592deb58ef4e"),
  plomeria: img("photo-1504148455328-c376907d081c"),
  legal: img("photo-1589829545856-d10d557cf95f"),
  tarot: img("photo-1601158935942-52255782d322"),
  diseno: img("photo-1561070791-2526d30994b5"),
};

export const GIGS: Gig[] = [
  { id: "g1", autorId: "u15", titulo: "Fotos profesionales HDR + tour 360° de tu propiedad", categoria: "fotografia", descripcion: "Sesión de hasta 25 fotos editadas y tour virtual. Entrega en 48 h.", precioDesde: 120, moneda: "USD", entregaDias: 2, imagen: SERV_IMG.fotografia, ventas: 214 },
  { id: "g2", autorId: "u16", titulo: "Planos y proyecto de remodelación", categoria: "arquitectura", descripcion: "Relevamiento, planos y render 3D para tu remodelación o ampliación.", precioDesde: 350, moneda: "USD", entregaDias: 10, imagen: SERV_IMG.arquitectura, ventas: 67 },
  { id: "g3", autorId: "u17", titulo: "Reparación de fugas y revisión de instalaciones", categoria: "plomeria", descripcion: "Visita con diagnóstico y presupuesto sin cargo. Urgencias 24 h.", precioDesde: 40, moneda: "USD", entregaDias: 1, imagen: SERV_IMG.plomeria, ventas: 530 },
  { id: "g4", autorId: "u18", titulo: "Revisión legal de contrato de compraventa o alquiler", categoria: "legal", descripcion: "Análisis del contrato, riesgos y recomendaciones por escrito.", precioDesde: 90, moneda: "USD", entregaDias: 3, imagen: SERV_IMG.legal, ventas: 143 },
  { id: "g5", autorId: "u19", titulo: "Lectura de tarot y carta astral completa", categoria: "tarot", descripcion: "Sesión de 45 min por videollamada o audio. Solo entretenimiento y orientación personal.", precioDesde: 30, moneda: "USD", entregaDias: 1, imagen: SERV_IMG.tarot, ventas: 380 },
  { id: "g6", autorId: "u20", titulo: "Logo y kit de marca para tu inmobiliaria", categoria: "diseno", descripcion: "Logo, paleta, tipografías y plantillas para redes en 5 días.", precioDesde: 180, moneda: "USD", entregaDias: 5, imagen: SERV_IMG.diseno, ventas: 96 },
];

export const VACANTES: Vacante[] = [
  { id: "e1", autorId: "u1", titulo: "Asesor/a inmobiliario/a remoto/a", tipo: "tiempo-completo", modalidad: "remoto", ubicacion: "Zona Norte", presupuesto: "USD 900–1.400 / mes + comisiones", skills: ["Ventas", "CRM", "Atención al cliente"], descripcion: "Buscamos alguien con ganas de acompañar compradores y propietarios de principio a fin.", ts: Date.now() - 20 * 3_600_000 },
  { id: "e2", autorId: "u4", titulo: "Fotógrafo/a de autos para catálogo", tipo: "proyecto", modalidad: "presencial", ubicacion: "Las Lomas", presupuesto: "USD 600 por proyecto", skills: ["Fotografía", "Edición", "Vehículos"], descripcion: "Sesión de 12 vehículos de colección. Se valora experiencia en fotografía automotriz.", ts: Date.now() - 2 * 24 * 3_600_000 },
  { id: "e3", autorId: "u6", titulo: "Community manager para coworking", tipo: "contrato", modalidad: "hibrido", ubicacion: "Puerto Nuevo", presupuesto: "USD 700 / mes (6 meses)", skills: ["Redes sociales", "Eventos", "Diseño"], descripcion: "Dinamizar la comunidad del coworking, organizar eventos y gestionar redes.", ts: Date.now() - 3 * 24 * 3_600_000 },
  { id: "e4", autorId: "u7", titulo: "Servicio de mudanzas y montaje de muebles", tipo: "contrato", modalidad: "presencial", ubicacion: "Country Los Pinos", presupuesto: "Por servicio (USD 80–200)", skills: ["Logística", "Montaje", "Carga"], descripcion: "Buscamos equipo confiable para mudanzas de inquilinos en barrios cerrados.", ts: Date.now() - 5 * 24 * 3_600_000 },
  { id: "e5", autorId: "u12", titulo: "Analista financiero/a para proyectos de inversión", tipo: "proyecto", modalidad: "remoto", ubicacion: "Zona Sur", presupuesto: "USD 400 por informe", skills: ["Excel", "Flujo de caja", "Mercado inmobiliario"], descripcion: "Informes de rentabilidad y riesgo para pequeños desarrollos de 2 a 6 unidades.", ts: Date.now() - 6 * 24 * 3_600_000 },
];

export const DEMANDAS_INICIALES: Omit<Demanda, "ts">[] = [
  { id: "d1", autorId: "u14", categoria: "inmueble", operacion: "alquilar", tipo: "departamento", zona: "Centro", presupuestoMax: 900, moneda: "USD", nota: "Busco depto de 2 ambientes en el centro, con wifi y cerca del transporte." },
  { id: "d2", autorId: "u10", categoria: "inmueble", operacion: "comprar", tipo: "casa", zona: "Zona Norte", presupuestoMax: 350000, moneda: "USD", nota: "Primera casa, con jardín y cochera. Puedo cerrar en 30 días." },
  { id: "d3", autorId: "u13", categoria: "inmueble", operacion: "alquilar", tipo: "casa", zona: "Country", presupuestoMax: 2500, moneda: "USD", nota: "Familia de cuatro, buscamos barrio cerrado con seguridad." },
  { id: "d4", autorId: "u12", categoria: "inmueble", operacion: "comprar", tipo: "terreno", zona: "Zona Sur", presupuestoMax: 100000, moneda: "USD", superficieMin: 400, nota: "Busco terreno de 400 m² o más para desarrollo." },
  { id: "d5", autorId: "u9", categoria: "inmueble", operacion: "alquilar", tipo: "departamento", zona: "Barrio Histórico", presupuestoMax: 1200, moneda: "USD", nota: "Busco loft o depto con carácter, pet friendly." },
  { id: "d6", autorId: "u21", categoria: "vehiculo", operacion: "comprar", tipo: "auto", zona: "", presupuestoMax: 20000, moneda: "USD", nota: "Sedán confiable y económico, hasta 70.000 km." },
  { id: "d7", autorId: "u11", categoria: "vehiculo", operacion: "alquilar", tipo: "moto", zona: "", presupuestoMax: 200, moneda: "USD", nota: "Scooter para moverme por la ciudad un par de meses." },
];

export const ETIQUETA_SERVICIO: Record<Gig["categoria"], { label: string; emoji: string }> = {
  fotografia: { label: "Fotografía inmobiliaria", emoji: "📸" },
  arquitectura: { label: "Arquitectura", emoji: "📐" },
  plomeria: { label: "Plomería", emoji: "🔧" },
  legal: { label: "Legal", emoji: "⚖️" },
  tarot: { label: "Tarot y astrología", emoji: "🔮" },
  diseno: { label: "Diseño", emoji: "🎨" },
  mudanzas: { label: "Mudanzas", emoji: "📦" },
};
