import type { Post } from "@/types/social";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;

const MIN = 60_000;

/** Publicaciones de ejemplo de la comunidad. `ts` se calcula respecto al momento actual. */
export function crearPostsIniciales(ahora: number): Post[] {
  const c = (id: string, autorId: string, texto: string, min: number) => ({
    id,
    autorId,
    texto,
    ts: ahora - min * MIN,
  });

  const posts: Omit<Post, "reacciones">[] = [
    {
      id: "post1",
      autorId: "u4",
      tipo: "propiedad",
      texto:
        "Nuestra villa en Las Lomas recién terminada: ventanales de piso a techo y piscina climatizada. Abierta a visitas este fin de semana 🏊",
      zona: "Las Lomas",
      imagen: img("photo-1512917774080-9991f1c4c750"),
      ts: ahora - 35 * MIN,
      likes: ["u1", "u9", "u13"],
      comentarios: [c("c1", "u13", "¡Qué belleza! ¿Aceptan visitas con niños?", 20)],
    },
    {
      id: "post2",
      autorId: "u9",
      tipo: "consulta",
      texto:
        "¿Alguien vive en Barrio Histórico o Centro? Estoy evaluando mudarme y quiero saber cómo es el ruido de noche y el transporte 🚌",
      zona: "Barrio Histórico",
      ts: ahora - 2 * 60 * MIN,
      likes: ["u5", "u14"],
      comentarios: [
        c("c2", "u5", "Vivo en el casco histórico: de noche es tranquilo salvo viernes y sábado. El transporte es excelente.", 90),
        c("c3", "u14", "En el Centro hay más movimiento, pero todo a mano. Si quieres te cuento más.", 70),
      ],
    },
    {
      id: "post3",
      autorId: "u10",
      tipo: "historia",
      texto:
        "Después de 8 meses buscando, ¡hoy firmé la reserva de mi primera casa! Consejo: visiten en distintos horarios, cambia todo 🏡",
      zona: "Zona Norte",
      imagen: img("photo-1568605114967-8130f3a36994"),
      ts: ahora - 5 * 60 * MIN,
      likes: ["u1", "u2", "u9", "u11", "u13"],
      comentarios: [c("c4", "u1", "¡Felicidades, Javi! Bienvenido al barrio 🎉", 280)],
    },
    {
      id: "post4",
      autorId: "u7",
      tipo: "experiencia",
      texto:
        "Balance de 3 años como anfitriona: lo que más valoran los inquilinos es la comunicación rápida, más que cualquier amenity. Respondan en menos de 1 hora y verán la diferencia.",
      zona: "Country Los Pinos",
      ts: ahora - 9 * 60 * MIN,
      likes: ["u1", "u4", "u5", "u8"],
      comentarios: [],
    },
    {
      id: "post5",
      autorId: "u12",
      tipo: "consulta",
      texto:
        "Inversores: ¿cómo están viendo la rentabilidad en Zona Sur? Analizo comprar dos lotes para desarrollar y quiero contrastar números.",
      zona: "Zona Sur",
      ts: ahora - 22 * 60 * MIN,
      likes: ["u3"],
      comentarios: [
        c("c5", "u3", "Tengo un lote en venta ahí, te paso info por mensaje. La demanda de alquiler crece.", 1200),
      ],
    },
    {
      id: "post6",
      autorId: "u5",
      tipo: "propiedad",
      texto:
        "El loft del Barrio Histórico tiene nuevas fotos ✨ Luz natural todo el día y pet friendly.",
      zona: "Barrio Histórico",
      imagen: img("photo-1522708323590-d24dbb6b0267"),
      ts: ahora - 30 * 60 * MIN,
      likes: ["u9", "u11", "u14"],
      comentarios: [],
    },
    {
      id: "post7",
      autorId: "u11",
      tipo: "historia",
      texto:
        "Llevo 2 semanas en Puerto Nuevo y ya conocí a tres vecinos gracias a la comunidad. ¡Qué bueno no empezar de cero! Si alguien quiere un café por la zona, avisen ☕",
      zona: "Puerto Nuevo",
      ts: ahora - 48 * 60 * MIN,
      likes: ["u6", "u9"],
      comentarios: [],
    },
  ];
  return posts.map((p) => ({ ...p, reacciones: Object.fromEntries(p.likes.map((id) => [id, "like" as const])) }));
}
