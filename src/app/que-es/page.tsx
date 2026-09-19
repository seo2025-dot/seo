import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LEMA, PRINCIPALES } from "@/lib/marca";

export const metadata: Metadata = {
  title: "¿Qué es conectari.com?",
  description: "conectari.com reúne en un solo lugar inmuebles, vehículos, negocios, empleos freelance y comunidad, con trato directo y perfiles verificados.",
};

const SECCIONES: Record<string, string> = {
  inmuebles: "Encuentra casa, departamento o local comercial para comprar o alquilar de forma directa.",
  vehiculos: "Compra y vende autos o motos con total confianza entre particulares locales.",
  negocios: "Descubre comercios de tu zona, productos únicos y profesionales listos para ayudarte.",
  empleos: "El espacio ideal para ofrecer tus habilidades independientes o encontrar talento local para tus proyectos.",
  comunidad: "Un espacio moderno para conocer gente nueva, hacer amigos o conectar con personas que comparten tus mismos intereses y estilo de vida.",
};

const TITULOS: Record<string, string> = {
  inmuebles: "Inmuebles",
  vehiculos: "Vehículos",
  negocios: "Negocios y Servicios",
  empleos: "Empleos Freelance",
  comunidad: "Comunidad y Citas",
};

const MOTIVOS = [
  { emoji: "🤝", titulo: "Trato directo", texto: "Hablas directamente con la persona, lo que significa mejores acuerdos y sin comisiones ocultas." },
  { emoji: "🛡️", titulo: "Reputación y confianza", texto: "Cuentas con perfiles y valoraciones verificadas para que sepas siempre con quién estás haciendo tratos." },
  { emoji: "📍", titulo: "Hiperlocal", texto: "Todo lo que buscas está cerca de ti, adaptado a tu ciudad y a tu ritmo de vida." },
];

export default function QueEsPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-marca px-4 pb-16 pt-12 text-center">
        <div aria-hidden className="absolute -left-20 top-10 h-64 w-64 animate-blob rounded-full bg-sun/50 blur-3xl" />
        <div aria-hidden className="absolute -right-16 bottom-0 h-72 w-72 animate-blob rounded-full bg-flame/50 blur-3xl [animation-delay:-6s]" />
        <div className="relative mx-auto max-w-3xl">
          <Image src="/brand/conectari-icono.png" alt="" aria-hidden width={586} height={512} priority className="mx-auto h-20 w-auto animate-flotar drop-shadow-xl" />
          <h1 className="mt-4 text-4xl font-black text-ink sm:text-5xl">
            conectari<span className="text-white">.com</span>
          </h1>
          <p className="mt-2 text-xl font-extrabold text-ink/90 sm:text-2xl [font-family:var(--font-display)]">{LEMA}</p>
          <p className="mx-auto mt-5 max-w-2xl rounded-2xl bg-white/85 p-5 text-left leading-relaxed text-slate-700 shadow-lg backdrop-blur sm:text-lg">
            <strong className="text-ink">conectari.com</strong> es la plataforma digital definitiva que reúne en un solo lugar todo lo que las personas necesitan para su día a día. Se acabó el tener que navegar por diez páginas distintas; aquí conectamos directamente a las personas que ofrecen algo con quienes lo están buscando en su propia ciudad, de forma rápida, segura y sin intermediarios molestos.
          </p>
        </div>
      </section>

      <section aria-labelledby="que-puedes" className="mx-auto max-w-5xl px-4 py-14">
        <h2 id="que-puedes" className="text-center text-3xl font-black text-ink">
          ¿Qué puedes hacer en <span className="texto-marca">conectari.com</span>?
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-slate-600">
          La plataforma está diseñada para resolver las necesidades cotidianas de manera práctica a través de diferentes secciones:
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPALES.map((s) => (
            <li key={s.id} className={s.id === "comunidad" ? "sm:col-span-2 lg:col-span-1" : ""}>
              <Link href={s.href} className="tarjeta-viva group flex h-full gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${s.degradado} text-2xl shadow-md`}>
                  <span className="emoji-vivo">{s.emoji}</span>
                </span>
                <span>
                  <span className="block text-lg font-extrabold text-ink [font-family:var(--font-display)]">{TITULOS[s.id]}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-600">{SECCIONES[s.id]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="por-que" className="bg-ink px-4 py-14 text-white">
        <div className="mx-auto max-w-5xl">
          <h2 id="por-que" className="text-center text-3xl font-black">
            ¿Por qué elegir <span className="texto-marca">conectari.com</span>?
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {MOTIVOS.map((m) => (
              <li key={m.titulo} className="tarjeta-viva rounded-2xl border border-white/10 bg-white/5 p-6">
                <span className="emoji-vivo text-3xl" aria-hidden>{m.emoji}</span>
                <h3 className="mt-3 text-lg font-extrabold text-brand-300">{m.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{m.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <p className="text-xl font-extrabold leading-snug text-ink [font-family:var(--font-display)]">
          conectari.com es la app de la comunidad: un espacio vivo donde puedes vivir, moverte y conectar con tu entorno con un solo clic.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/registro" className="boton-marca rounded-full px-7 py-3 font-bold text-white">
            Crear mi cuenta
          </Link>
          <Link href="/propiedades" className="rounded-full border-2 border-ink px-7 py-3 font-bold text-ink transition hover:bg-ink hover:text-white">
            Explorar ahora
          </Link>
        </div>
      </section>
    </>
  );
}
