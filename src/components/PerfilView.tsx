"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Interes, TipoRelacion } from "@/types/social";
import { ESTILOS_VIDA, MAX_VALORES, VALORES, ZONAS } from "@/data/catalogos";
import { useSocial } from "@/context/SocialContext";
import { ETIQUETA_ELEMENTO, infoSigno } from "@/lib/astrologia";
import { comprimirImagen } from "@/lib/imagen";
import { completitudPerfil, datosCompletitud } from "@/lib/completitud";
import { compatibilidad, ETIQUETA_INTERES, ETIQUETA_RELACION, INTERESES_EDITABLES, primerNombre } from "@/lib/social";
import Avatar from "@/components/Avatar";
import AnuncioCard from "@/components/AnuncioCard";
import PostCard from "@/components/PostCard";
import BarraCompletitud from "@/components/BarraCompletitud";
import Chips from "@/components/Chips";
import EleccionUnica from "@/components/EleccionUnica";
import { BUSCAS, GENEROS, type Busca, type Genero } from "@/lib/genero";
import SeccionFotos from "@/features/fotos/SeccionFotos";
import { useFotosPerfil } from "@/features/fotos/useFotosPerfil";
import { estaturaCm, MAX_PAREJA_IDEAL, MIN_PAREJA_IDEAL } from "@/features/onboarding/validacion";
import {
  AstralBadge,
  BadgesFila,
  ConfianzaBadge,
  InteresesFila,
  Reputacion,
  VerificacionesFila,
  VerificadoCheck,
} from "@/components/PerfilBadges";

type Pestana = "publicaciones" | "ofertas" | "guardadas" | "amigos";

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export default function PerfilView({ usuarioId }: { usuarioId: string }) {
  const router = useRouter();
  const {
    estado,
    hidratado,
    obtenerUsuario,
    enLinea,
    anuncios,
    solicitarAmistad,
    responderSolicitud,
    abrirChatDirecto,
    esAdmin,
    cerrarSesion,
    sesion,
  } = useSocial();

  const [pestana, setPestana] = useState<Pestana>("publicaciones");
  const [editando, setEditando] = useState(false);

  const usuario = obtenerUsuario(usuarioId);
  const esPropio = usuarioId === "yo";

  // Las fotos del propio perfil cuentan para el porcentaje de completado; se releen cuando el perfil cambia (alta/baja de fotos).
  const fotosPropias = useFotosPerfil(esPropio ? sesion.uid : null);
  const recargarFotosPropias = fotosPropias.recargar;
  const primeraCarga = useRef(true);
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    void recargarFotosPropias();
  }, [estado.yo, recargarFotosPropias]);
  const completitud = useMemo(
    () => (esPropio ? completitudPerfil(datosCompletitud(estado.yo, fotosPropias.fotos.length)) : null),
    [esPropio, estado.yo, fotosPropias.fotos.length],
  );

  const ofertas = useMemo(() => anuncios.filter((a) => a.duenoId === usuarioId), [anuncios, usuarioId]);
  const guardadas = useMemo(() => anuncios.filter((a) => estado.guardadas.includes(a.id)), [anuncios, estado.guardadas]);
  const posts = useMemo(
    () => estado.posts.filter((p) => p.autorId === usuarioId).sort((a, b) => b.ts - a.ts),
    [estado.posts, usuarioId],
  );

  if (!hidratado) return <div className="mx-auto h-96 max-w-4xl animate-pulse px-4 py-8" />;

  if (!usuario) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl">🔍</p>
        <h1 className="mt-3 text-xl font-bold">Perfil no encontrado</h1>
        <Link href="/comunidad" className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700">
          Ir a la comunidad
        </Link>
      </div>
    );
  }

  const esAmigo = estado.amigos.includes(usuario.id);
  const enviada = estado.solicitudes.find((s) => s.deId === "yo" && s.paraId === usuario.id && s.estado === "pendiente");
  const recibida = estado.solicitudes.find((s) => s.deId === usuario.id && s.paraId === "yo" && s.estado === "pendiente");
  const comp = esPropio ? null : compatibilidad(estado.yo, usuario);
  const signo = usuario.signo ? infoSigno(usuario.signo) : null;

  const pestanas: { id: Pestana; label: string; n: number }[] = [
    { id: "publicaciones", label: "Publicaciones", n: posts.length },
    { id: "ofertas", label: "Ofertas", n: ofertas.length },
    ...(esPropio
      ? [
          { id: "guardadas" as const, label: "Guardadas", n: guardadas.length },
          { id: "amigos" as const, label: "Amigos", n: estado.amigos.length },
        ]
      : []),
  ];

  const escribir = async () => {
    const cid = await abrirChatDirecto(usuario.id);
    if (cid) router.push(`/mensajes/${cid}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-28 bg-marca sm:h-36" />
        <div className="px-5 pb-5">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-3">
            <Avatar nombre={usuario.nombre} foto={usuario.foto} tamano="xl" enLinea={esPropio ? undefined : enLinea(usuario.id)} className="ring-4 ring-white" />
            <div className="flex flex-wrap gap-2">
              {esPropio ? (
                <>
                  <button type="button" onClick={() => setEditando((v) => !v)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold hover:bg-slate-50">
                    {editando ? "Cerrar edición" : completitud && completitud.porcentaje < 100 ? `Editar información · ${completitud.porcentaje}% completado` : "Editar perfil"}
                  </button>
                  {esAdmin && (
                    <Link href="/admin/kyc" className="rounded-full border border-violet-300 px-5 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">
                      Revisar KYC
                    </Link>
                  )}
                  {esAdmin && (
                    <Link href="/admin/monedas" className="rounded-full border border-violet-300 px-5 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">
                      Administrar monedas
                    </Link>
                  )}
                  {esAdmin && (
                    <Link href="/admin/personas" className="rounded-full border border-violet-300 px-5 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">
                      Personas simuladas
                    </Link>
                  )}
                  <button type="button" onClick={() => void cerrarSesion()} className="rounded-full px-5 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                    Cerrar sesión
                  </button>
                </>
              ) : esAmigo ? (
                <>
                  <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">Amigos ✓</span>
                  <button type="button" onClick={escribir} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                    Enviar mensaje
                  </button>
                </>
              ) : recibida ? (
                <button type="button" onClick={() => responderSolicitud(recibida.id, true)} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  Aceptar solicitud
                </button>
              ) : enviada ? (
                <span className="rounded-full bg-slate-100 px-5 py-2 text-sm font-medium text-slate-500">Solicitud enviada</span>
              ) : (
                <button type="button" onClick={() => solicitarAmistad(usuario.id)} className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  Agregar amigo
                </button>
              )}
            </div>
          </div>

          <h1 className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-extrabold">
            {usuario.nombre}
            {usuario.edad && <span className="text-lg font-medium text-slate-500">{usuario.edad}</span>}
            {usuario.verificaciones.identidad && <VerificadoCheck className="h-5 w-5" />}
          </h1>
          <p className="text-sm text-slate-500">
            {usuario.usuario}
            {usuario.ubicacion && <> · 📍 {usuario.ubicacion}</>}
            {signo && (
              <>
                {" "}
                · {signo.simbolo} {signo.nombre}
              </>
            )}{" "}
            · Miembro desde {usuario.miembroDesde}
            {!esPropio && <span className={enLinea(usuario.id) ? " text-emerald-600" : ""}> · {enLinea(usuario.id) ? "En línea" : "Desconectado"}</span>}
          </p>
          {(usuario.universidad || usuario.colegio || usuario.estatura) && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
              {usuario.universidad && <span>🎓 {usuario.universidad}</span>}
              {usuario.colegio && <span>🏫 {usuario.colegio}</span>}
              {usuario.estatura && <span>📏 {usuario.estatura} cm</span>}
            </p>
          )}
          {usuario.profesional && <p className="mt-1 text-sm font-semibold text-brand-700">💼 {usuario.profesional.titular}</p>}
          <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{usuario.bio}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ConfianzaBadge usuario={usuario} />
            {!esPropio && (
              <>
                <AstralBadge yo={estado.yo} otro={usuario} contexto="pareja" />
                <AstralBadge yo={estado.yo} otro={usuario} contexto="socios" />
              </>
            )}
          </div>
          {!esPropio && !estado.yo.signo && usuario.signo && (
            <p className="mt-2 text-xs text-violet-700">
              <Link href="/astrologia" className="font-semibold underline">Añade tu fecha de nacimiento</Link> para ver vuestra compatibilidad astral.
            </p>
          )}
          {esPropio && !usuario.signo && (
            <p className="mt-2 text-xs text-violet-700">
              <Link href="/astrologia" className="font-semibold underline">Calcula tu signo</Link> para activar las insignias de compatibilidad astral.
            </p>
          )}

          {completitud && !editando && <BarraCompletitud completitud={completitud} onCompletar={() => setEditando(true)} className="mt-4" />}

          <SeccionFotos uid={esPropio ? sesion.uid : usuario.id} esPropio={esPropio} />

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-center">
            <div>
              <p className="text-lg font-bold">{ofertas.length}</p>
              <p className="text-xs text-slate-500">Ofertas</p>
            </div>
            <div>
              <p className="text-lg font-bold">{esPropio ? estado.amigos.length : posts.length}</p>
              <p className="text-xs text-slate-500">{esPropio ? "Amigos" : "Publicaciones"}</p>
            </div>
            <div>
              <p className="text-lg font-bold">{usuario.resenas}</p>
              <p className="text-xs text-slate-500">Reseñas</p>
            </div>
          </div>

          {comp && (
            <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-sm font-semibold text-brand-700">{comp.puntaje}% de afinidad de zonas e intereses contigo</p>
              <p className="mt-1 text-xs text-slate-600">
                {comp.zonasComunes.length > 0 ? `Zonas en común: ${comp.zonasComunes.join(", ")}. ` : "Aún no comparten zonas. "}
                {comp.interesesComunes.length > 0 && `Intereses en común: ${comp.interesesComunes.map((i) => ETIQUETA_INTERES[i]).join(", ")}.`}
              </p>
            </div>
          )}

          <div className="mt-5 space-y-4">
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-700">Reputación</h2>
              <Reputacion rating={usuario.rating} resenas={usuario.resenas} respuesta={usuario.respuesta} />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-700">Insignias</h2>
              <BadgesFila badges={usuario.badges} />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-700">Verificaciones</h2>
              <VerificacionesFila
                verificaciones={usuario.verificaciones}
                hrefIdentidad={esPropio ? "/verificacion" : undefined}
              />
              {esPropio && <p className="mt-2 text-xs text-slate-400">El correo se verifica al confirmar tu cuenta; la identidad, con documento y selfie.</p>}
            </div>
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-700">Intereses, zonas y estilo de vida</h2>
              {usuario.intereses.length === 0 && usuario.zonas.length === 0 && !(usuario.valores?.length) ? (
                <p className="text-sm text-slate-500">{esPropio ? "Añade tus intereses y zonas para recibir mejores matches." : "Sin información todavía."}</p>
              ) : (
                <div className="space-y-2">
                  <InteresesFila intereses={usuario.intereses} />
                  {usuario.zonas.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {usuario.zonas.map((z) => (
                        <li key={z} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          📍 {z}
                        </li>
                      ))}
                    </ul>
                  )}
                  {usuario.estilo && usuario.estilo.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {usuario.estilo.map((s) => (
                        <li key={s} className="rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700">
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                  {usuario.valores && usuario.valores.length > 0 && (
                    <ul aria-label="Valores" className="flex flex-wrap gap-2">
                      {usuario.valores.map((v) => (
                        <li key={v} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                          ✦ {v}
                        </li>
                      ))}
                    </ul>
                  )}
                  {usuario.relaciones && usuario.relaciones.length > 0 && (
                    <p className="text-sm text-slate-600">Busca: {usuario.relaciones.map((r) => ETIQUETA_RELACION[r]).join(" · ")}</p>
                  )}
                  {usuario.presupuesto && <p className="text-sm text-slate-600">💰 {usuario.presupuesto}</p>}
                  {signo && <p className="text-sm text-slate-600">{ETIQUETA_ELEMENTO[signo.elemento]}</p>}
                </div>
              )}
            </div>

            {(usuario.profesional || esPropio) && (
              <div>
                <h2 className="mb-2 text-sm font-bold text-slate-700">Perfil profesional y portafolio</h2>
                {usuario.profesional ? (
                  <>
                    <p className="font-semibold">{usuario.profesional.titular}</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {usuario.profesional.skills.map((s) => (
                        <li key={s} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          {s}
                        </li>
                      ))}
                    </ul>
                    {usuario.profesional.portafolio.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {usuario.profesional.portafolio.map((src, i) => (
                          <div key={i} className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
                            <Image src={src} alt={`Trabajo ${i + 1} del portafolio`} fill sizes="200px" className="object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Añade tu titular, habilidades y portafolio al editar tu perfil para destacar en Empleos.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {esPropio && editando && <EditarPerfil onCerrar={() => setEditando(false)} nFotos={fotosPropias.fotos.length} />}

      <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {pestanas.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={pestana === t.id}
            onClick={() => setPestana(t.id)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${pestana === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.label} <span className="text-xs font-normal text-slate-400">{t.n}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {pestana === "publicaciones" &&
          (posts.length === 0 ? (
            <Vacio texto={esPropio ? "Aún no has publicado nada en la comunidad." : `${primerNombre(usuario.nombre)} no ha publicado todavía.`} cta={esPropio ? { href: "/comunidad", label: "Ir al feed" } : undefined} />
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ))}

        {pestana === "ofertas" &&
          (ofertas.length === 0 ? (
            <Vacio texto={esPropio ? "Todavía no has publicado ofertas." : "No tiene ofertas publicadas."} cta={esPropio ? { href: "/publicar", label: "Publicar mi primera oferta" } : undefined} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {ofertas.map((a) => (
                <AnuncioCard key={a.id} anuncio={a} />
              ))}
            </div>
          ))}

        {pestana === "guardadas" &&
          (guardadas.length === 0 ? (
            <Vacio texto="No has guardado ofertas todavía." cta={{ href: "/match", label: "Empezar a hacer match" }} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {guardadas.map((a) => (
                <AnuncioCard key={a.id} anuncio={a} />
              ))}
            </div>
          ))}

        {pestana === "amigos" &&
          (estado.amigos.length === 0 ? (
            <Vacio texto="Aún no tienes amigos en la comunidad." cta={{ href: "/citas", label: "Buscar personas" }} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {estado.amigos.map((id) => {
                const a = obtenerUsuario(id);
                if (!a) return null;
                return (
                  <li key={id}>
                    <Link href={`/usuarios/${id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50">
                      <Avatar nombre={a.nombre} enLinea={enLinea(id)} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate font-semibold">
                          {a.nombre}
                          {a.verificaciones.identidad && <VerificadoCheck className="h-3.5 w-3.5" />}
                        </p>
                        <p className="truncate text-xs text-slate-500">{a.zonas.join(" · ")}</p>
                      </div>
                      <AstralBadge yo={estado.yo} otro={a} contexto="amistad" compacto />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
      </div>
    </div>
  );
}

function Vacio({ texto, cta }: { texto: string; cta?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
      <p className="text-sm text-slate-500">{texto}</p>
      {cta && (
        <Link href={cta.href} className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function EditarPerfil({ onCerrar, nFotos }: { onCerrar: () => void; nFotos: number }) {
  const { estado, editarPerfil } = useSocial();
  const yo = estado.yo;
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState(yo.nombre);
  const [handle, setHandle] = useState(yo.usuario);
  const [bio, setBio] = useState(yo.bio);
  const [ubicacion, setUbicacion] = useState(yo.ubicacion);
  const [edad, setEdad] = useState(yo.edad ? String(yo.edad) : "");
  const [presupuesto, setPresupuesto] = useState(yo.presupuesto ?? "");
  const [universidad, setUniversidad] = useState(yo.universidad ?? "");
  const [colegio, setColegio] = useState(yo.colegio ?? "");
  const [estatura, setEstatura] = useState(yo.estatura ? String(yo.estatura) : "");
  const [genero, setGenero] = useState<Genero | "">(yo.genero ?? "");
  const [quiereConocer, setQuiereConocer] = useState<Busca | "">(yo.quiereConocer ?? "");
  const [parejaIdeal, setParejaIdeal] = useState(yo.parejaIdeal ?? "");
  const [valores, setValores] = useState<string[]>(yo.valores ?? []);
  const [parejaValores, setParejaValores] = useState<string[]>(yo.parejaIdealValores ?? []);
  const [parejaEstilo, setParejaEstilo] = useState<string[]>(yo.parejaIdealEstilo ?? []);
  const [intereses, setIntereses] = useState<Interes[]>(yo.intereses);
  const [zonas, setZonas] = useState<string[]>(yo.zonas);
  const [relaciones, setRelaciones] = useState<TipoRelacion[]>(yo.relaciones ?? []);
  const [estilo, setEstilo] = useState<string[]>(yo.estilo ?? []);
  const [titular, setTitular] = useState(yo.profesional?.titular ?? "");
  const [skills, setSkills] = useState(yo.profesional?.skills.join(", ") ?? "");
  const [portafolio, setPortafolio] = useState<string[]>(yo.profesional?.portafolio ?? []);
  const [foto, setFoto] = useState(yo.foto);
  const [error, setError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const archivoPortafolio = useRef<HTMLInputElement>(null);

  // Porcentaje en vivo: se actualiza mientras editas, antes de guardar.
  const completitud = completitudPerfil({
    bio,
    fotos: nFotos,
    ubicacion,
    zonas,
    intereses,
    estilo,
    parejaIdeal,
    relaciones,
    parejaIdealValores: parejaValores,
    parejaIdealEstilo: parejaEstilo,
  });

  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const cargarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setFoto(await comprimirImagen(f, 320, 0.8));
    } catch {
      setError("No se pudo cargar esa imagen.");
    }
  };

  const cargarPortafolio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []).slice(0, 3 - portafolio.length);
    e.target.value = "";
    const res = await Promise.allSettled(archivos.map((a) => comprimirImagen(a, 700, 0.7)));
    setPortafolio((p) => [...p, ...res.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))].slice(0, 3));
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 2) {
      setError("Escribe tu nombre (mínimo 2 caracteres).");
      return;
    }
    const edadN = Number(edad);
    if (edad && !(edadN >= 18 && edadN <= 100)) {
      setError("La edad debe estar entre 18 y 100 años (la app es solo para adultos).");
      return;
    }
    // El servidor exige @ + 2-40 caracteres en minúscula (letras sin acento, números, _ o .).
    const normalizado = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^@+/, "").replace(/\s+/g, "_").replace(/[^a-z0-9_.]/g, "").slice(0, 40);
    const base = normalizado(handle) || normalizado(nombre);
    if (base.length < 2) {
      setError("El nombre de usuario debe tener al menos 2 caracteres (letras, números, _ o .).");
      return;
    }
    if (estatura.trim() && estaturaCm(estatura) === null) {
      setError("La estatura debe estar entre 120 y 230 cm.");
      return;
    }
    if (parejaIdeal.trim() && parejaIdeal.trim().length < MIN_PAREJA_IDEAL) {
      setError(`Describe a tu pareja ideal con al menos ${MIN_PAREJA_IDEAL} caracteres (o deja el campo vacío).`);
      return;
    }
    const listaSkills = skills.split(",").map((s) => s.trim()).filter(Boolean);
    setGuardando(true);
    const ok = await editarPerfil({
      nombre: nombre.trim(),
      usuario: `@${base}`,
      bio: bio.trim() || yo.bio,
      ubicacion: ubicacion.trim(),
      edad: edad ? edadN : undefined,
      presupuesto: presupuesto.trim() || undefined,
      universidad: universidad.trim(),
      colegio: colegio.trim(),
      estatura: estaturaCm(estatura) ?? undefined,
      genero: genero || undefined,
      quiereConocer: quiereConocer || undefined,
      parejaIdeal: parejaIdeal.trim(),
      valores,
      parejaIdealValores: parejaValores,
      parejaIdealEstilo: parejaEstilo,
      intereses,
      zonas,
      relaciones,
      estilo,
      profesional: titular.trim() || listaSkills.length > 0 || portafolio.length > 0 ? { titular: titular.trim(), skills: listaSkills, portafolio } : undefined,
      foto,
    });
    setGuardando(false);
    if (ok) onCerrar();
  };

  const chip = (activo: boolean, color: string) =>
    `rounded-full border px-3 py-1.5 text-xs font-medium transition ${activo ? color : "border-slate-200 hover:border-brand-300"}`;

  return (
    <form onSubmit={guardar} className="mt-4 space-y-5 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="sticky top-16 z-30 -mx-5 -mt-5 rounded-t-2xl border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
        <h2 className="text-lg font-bold">Editar información</h2>
        <BarraCompletitud completitud={completitud} compacta className="mt-1" />
      </div>

      <div className="flex items-center gap-4">
        <Avatar nombre={nombre || "Tú"} foto={foto} tamano="lg" />
        <input ref={archivo} type="file" accept="image/*" onChange={cargarFoto} className="hidden" />
        <button type="button" onClick={() => archivo.current?.click()} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50">
          Cambiar foto
        </button>
        {foto && (
          <button type="button" onClick={() => setFoto(undefined)} className="text-sm text-slate-500 hover:underline">
            Quitar
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-nombre" className="mb-1 block text-sm font-medium">Nombre</label>
          <input id="pf-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} className={campo} />
        </div>
        <div>
          <label htmlFor="pf-usuario" className="mb-1 block text-sm font-medium">Usuario</label>
          <input id="pf-usuario" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={30} placeholder="@tu_usuario (minúsculas, sin espacios)" className={campo} />
        </div>
        <div>
          <label htmlFor="pf-ubicacion" className="mb-1 block text-sm font-medium">Ciudad / barrio</label>
          <input id="pf-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} maxLength={40} className={campo} />
        </div>
        <div>
          <label htmlFor="pf-edad" className="mb-1 block text-sm font-medium">Edad (opcional, +18)</label>
          <input id="pf-edad" type="number" min="18" max="100" value={edad} onChange={(e) => setEdad(e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="pf-uni" className="mb-1 block text-sm font-medium">Universidad a la que asististe</label>
          <input id="pf-uni" value={universidad} onChange={(e) => setUniversidad(e.target.value)} maxLength={120} className={campo} />
        </div>
        <div>
          <label htmlFor="pf-col" className="mb-1 block text-sm font-medium">Colegio al que asististe</label>
          <input id="pf-col" value={colegio} onChange={(e) => setColegio(e.target.value)} maxLength={120} className={campo} />
        </div>
        <div>
          <label htmlFor="pf-est" className="mb-1 block text-sm font-medium">Estatura (cm)</label>
          <input id="pf-est" inputMode="decimal" value={estatura} onChange={(e) => setEstatura(e.target.value)} maxLength={5} placeholder="170" className={campo} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pf-presupuesto" className="mb-1 block text-sm font-medium">Presupuesto (opcional)</label>
          <input id="pf-presupuesto" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} maxLength={40} placeholder="USD 400–600 / mes" className={campo} />
        </div>
      </div>

      <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <EleccionUnica leyenda="Eres" nombre="pf-genero" opciones={GENEROS} valor={genero} onChange={setGenero} />
        <EleccionUnica leyenda="¿A quién te gustaría conocer?" nombre="pf-busca" opciones={BUSCAS} valor={quiereConocer} onChange={setQuiereConocer} />
        <p className="text-xs text-slate-500 sm:col-span-2">Privado: nadie lo ve. Solo te recomendamos a personas que también quieran conocerte.</p>
      </div>

      <div>
        <label htmlFor="pf-bio" className="mb-1 block text-sm font-medium">Sobre ti</label>
        <textarea id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={240} className={campo} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">¿Qué buscas en la comunidad?</legend>
        <div className="flex flex-wrap gap-2">
          {INTERESES_EDITABLES.map((i) => (
            <button key={i} type="button" aria-pressed={intereses.includes(i)} onClick={() => setIntereses((l) => alternar(l, i))} className={chip(intereses.includes(i), "border-brand-600 bg-brand-600 text-white")}>
              {ETIQUETA_INTERES[i]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Zonas que te interesan</legend>
        <div className="flex flex-wrap gap-2">
          {ZONAS.map((z) => (
            <button key={z} type="button" aria-pressed={zonas.includes(z)} onClick={() => setZonas((l) => alternar(l, z))} className={chip(zonas.includes(z), "border-emerald-600 bg-emerald-600 text-white")}>
              📍 {z}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tu estilo de vida</legend>
        <div className="flex flex-wrap gap-2">
          {ESTILOS_VIDA.map((s) => (
            <button key={s} type="button" aria-pressed={estilo.includes(s)} onClick={() => setEstilo((l) => alternar(l, s))} className={chip(estilo.includes(s), "border-fuchsia-600 bg-fuchsia-600 text-white")}>
              {s}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tus valores <span className="font-normal text-slate-500">(hasta {MAX_VALORES}; se muestran en tu perfil)</span></legend>
        <Chips<string> opciones={VALORES} valor={valores} onChange={setValores} etiqueta={(o) => o} color="border-violet-600 bg-violet-600 text-white" max={MAX_VALORES} />
      </fieldset>

      <section aria-labelledby="pf-pareja-titulo" className="space-y-4 rounded-xl border border-pink-200 bg-pink-50/40 p-4">
        <div>
          <h3 id="pf-pareja-titulo" className="text-sm font-bold text-ink">💞 Tu pareja ideal</h3>
          <p className="text-xs text-slate-500">
            Lo que escribes y marcas aquí es privado: solo tú lo ves. Lo usamos para calcular tu porcentaje de afinidad con cada persona en Explorar y Citas.
          </p>
        </div>
        <div>
          <label htmlFor="pf-pareja" className="mb-1 block text-sm font-medium">Descríbela con tus palabras</label>
          <textarea id="pf-pareja" value={parejaIdeal} onChange={(e) => setParejaIdeal(e.target.value)} rows={4} maxLength={MAX_PAREJA_IDEAL} className={campo} />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Tipo de relación que buscas <span className="font-normal text-slate-500">(también define en qué apartados de Citas apareces)</span></legend>
          <Chips<TipoRelacion> opciones={Object.keys(ETIQUETA_RELACION) as TipoRelacion[]} valor={relaciones} onChange={setRelaciones} etiqueta={(o) => ETIQUETA_RELACION[o]} color="border-pink-600 bg-pink-600 text-white" />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Valores que buscas <span className="font-normal text-slate-500">(hasta {MAX_VALORES})</span></legend>
          <Chips<string> opciones={VALORES} valor={parejaValores} onChange={setParejaValores} etiqueta={(o) => o} color="border-rose-600 bg-rose-600 text-white" max={MAX_VALORES} />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Estilo de vida que buscas <span className="font-normal text-slate-500">(hasta {MAX_VALORES})</span></legend>
          <Chips<string> opciones={ESTILOS_VIDA} valor={parejaEstilo} onChange={setParejaEstilo} etiqueta={(o) => o} color="border-fuchsia-600 bg-fuchsia-600 text-white" max={MAX_VALORES} />
        </fieldset>
      </section>

      <fieldset className="space-y-3 rounded-xl bg-slate-50 p-4">
        <legend className="px-1 text-sm font-medium">Perfil profesional (opcional)</legend>
        <div>
          <label htmlFor="pf-titular" className="mb-1 block text-sm font-medium">Titular</label>
          <input id="pf-titular" value={titular} onChange={(e) => setTitular(e.target.value)} maxLength={70} placeholder="Ej.: Fotógrafo inmobiliario" className={campo} />
        </div>
        <div>
          <label htmlFor="pf-skills" className="mb-1 block text-sm font-medium">Habilidades (separadas por comas)</label>
          <input id="pf-skills" value={skills} onChange={(e) => setSkills(e.target.value)} className={campo} />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Portafolio ({portafolio.length}/3)</p>
          <div className="flex flex-wrap gap-2">
            {portafolio.map((src, i) => (
              <div key={i} className="relative h-16 w-24 overflow-hidden rounded-lg bg-slate-200">
                <Image src={src} alt={`Trabajo ${i + 1}`} fill sizes="96px" className="object-cover" />
                <button type="button" aria-label={`Quitar trabajo ${i + 1}`} onClick={() => setPortafolio((p) => p.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-black/60 text-xs text-white">
                  ✕
                </button>
              </div>
            ))}
            {portafolio.length < 3 && (
              <>
                <input ref={archivoPortafolio} type="file" accept="image/*" multiple onChange={cargarPortafolio} className="hidden" />
                <button type="button" onClick={() => archivoPortafolio.current?.click()} className="flex h-16 w-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-400">
                  + Añadir
                </button>
              </>
            )}
          </div>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" onClick={onCerrar} className="rounded-xl px-6 py-2.5 font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
      </div>
    </form>
  );
}
