/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ESTILOS_VIDA, MAX_VALORES, VALORES, ZONAS } from "@/data/catalogos";
import Chips from "@/components/Chips";
import { useSocial } from "@/context/SocialContext";
import GaleriaFotos from "@/features/fotos/GaleriaFotos";
import { useFotosPerfil } from "@/features/fotos/useFotosPerfil";
import { sincronizarFotos } from "@/features/fotos/sincronizar";
import type { ItemFoto } from "@/features/fotos/tipos";
import { BORRADOR_VACIO, edadDesde, estaturaCm, MAX_PAREJA_IDEAL, MIN_PAREJA_IDEAL, normalizarUsuario, PASOS, type Borrador, type Errores } from "@/features/onboarding/validacion";
import { MARCA_BIENVENIDA } from "@/components/BienvenidaModal";
import { signoDeFecha } from "@/lib/astrologia";
import { ETIQUETA_INTERES, ETIQUETA_RELACION, INTERESES_EDITABLES } from "@/lib/social";
import type { Interes, TipoRelacion } from "@/types/social";

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Campo({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { estado, sesion, hidratado, editarPerfil, completarOnboarding, refrescarPerfil } = useSocial();
  const [paso, setPaso] = useState(0);
  const [b, setB] = useState<Borrador>(BORRADOR_VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);
  const [fallos, setFallos] = useState<string[]>([]);
  const [enServidor, setEnServidor] = useState<string[]>([]); // ids de fotos que ya existen en el servidor
  const titulo = useRef<HTMLHeadingElement>(null);
  const prefijado = useRef(false);
  const fotosPrevias = useFotosPerfil(sesion.uid);
  const fotosPrecargadas = useRef(false);

  // Rellena lo que ya se sepa del perfil (p. ej. el nombre que dio en el registro o datos de un intento anterior).
  useEffect(() => {
    if (!hidratado || prefijado.current || !sesion.uid) return;
    prefijado.current = true;
    const y = estado.yo;
    setB((prev) => ({
      ...prev,
      nombre: y.nombre !== "Nuevo usuario" ? y.nombre : "",
      usuario: y.usuario.replace(/^@/, ""),
      nacimiento: y.nacimiento ?? "",
      ubicacion: y.ubicacion,
      universidad: y.universidad ?? "",
      colegio: y.colegio ?? "",
      estatura: y.estatura ? String(y.estatura) : "",
      parejaIdeal: y.parejaIdeal ?? "",
      valores: y.valores ?? [],
      parejaIdealValores: y.parejaIdealValores ?? [],
      parejaIdealEstilo: y.parejaIdealEstilo ?? [],
      intereses: y.intereses,
      zonas: y.zonas,
      relaciones: y.relaciones ?? [],
      estilo: y.estilo ?? [],
      bio: y.bio,
    }));
  }, [hidratado, sesion.uid, estado.yo]);

  // Si ya había subido fotos en un intento anterior, se recuperan (así no se pierden ni se duplican).
  useEffect(() => {
    if (fotosPrecargadas.current || fotosPrevias.cargando) return;
    fotosPrecargadas.current = true;
    if (fotosPrevias.fotos.length === 0) return;
    setEnServidor(fotosPrevias.fotos.map((f) => f.id));
    setB((prev) => ({
      ...prev,
      fotos: [...fotosPrevias.fotos.map<ItemFoto>((f) => ({ key: f.id, tipo: "guardada", id: f.id, url: f.url, thumbUrl: f.thumbUrl })), ...prev.fotos],
    }));
  }, [fotosPrevias.cargando, fotosPrevias.fotos]);

  // Quien ya completó el onboarding no debería volver a verlo.
  useEffect(() => {
    if (hidratado && estado.yo.onboardingCompleto === true) router.replace("/");
  }, [hidratado, estado.yo.onboardingCompleto, router]);

  useEffect(() => {
    titulo.current?.focus();
  }, [paso]);

  const actualizar = <K extends keyof Borrador>(k: K, v: Borrador[K]) => {
    setB((prev) => ({ ...prev, [k]: v }));
    setErrores((prev) => {
      if (!(k in prev)) return prev;
      const resto = { ...prev };
      delete resto[k as string];
      return resto;
    });
  };

  const siguiente = () => {
    const e = PASOS[paso].validar(b);
    setErrores(e);
    if (Object.keys(e).length === 0) setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  };

  const confirmar = async () => {
    // Revalida todos los pasos por si se llegó aquí con datos incompletos.
    for (let i = 0; i < PASOS.length; i++) {
      const e = PASOS[i].validar(b);
      if (Object.keys(e).length > 0) {
        setErrores(e);
        setPaso(i);
        return;
      }
    }
    setEnviando(true);
    setFallos([]);

    const guardado = await editarPerfil({
      nombre: b.nombre.trim(),
      usuario: `@${normalizarUsuario(b.usuario || b.nombre)}`,
      bio: b.bio.trim() || undefined,
      ubicacion: b.ubicacion.trim(),
      universidad: b.universidad.trim(),
      colegio: b.colegio.trim(),
      estatura: estaturaCm(b.estatura) ?? undefined,
      parejaIdeal: b.parejaIdeal.trim(),
      valores: b.valores,
      parejaIdealValores: b.parejaIdealValores,
      parejaIdealEstilo: b.parejaIdealEstilo,
      edad: edadDesde(b.nacimiento) ?? undefined,
      intereses: b.intereses,
      zonas: b.zonas,
      relaciones: b.relaciones,
      estilo: b.estilo,
      signo: signoDeFecha(b.nacimiento),
      nacimiento: b.nacimiento, // fecha completa: solo en user_private (privada)
    });
    if (!guardado) {
      setEnviando(false);
      return;
    }

    const r = await sincronizarFotos(b.fotos, enServidor, (hecho, total) => setProgreso({ hecho, total }));
    setEnServidor(r.ids);
    // Las fotos que sí se subieron pasan a "guardadas": si hay que reintentar, solo se vuelven a enviar las que fallaron.
    setB((prev) => ({
      ...prev,
      fotos: prev.fotos.map<ItemFoto>((i) => {
        const s = r.subidas[i.key];
        if (i.tipo === "nueva" && s) {
          URL.revokeObjectURL(i.preview);
          return { key: i.key, tipo: "guardada", id: s.id, url: s.url, thumbUrl: s.thumbUrl };
        }
        return i;
      }),
    }));
    setProgreso(null);
    if (r.errores.length > 0 || r.ids.length === 0) {
      setFallos(r.errores.length ? r.errores : ["No se pudo subir ninguna foto."]);
      setPaso(PASOS.findIndex((p) => p.id === "fotos"));
      setEnviando(false);
      return;
    }

    await refrescarPerfil();
    if (await completarOnboarding()) {
      try {
        localStorage.setItem(MARCA_BIENVENIDA, sesion.uid ?? "1"); // la portada mostrará la bienvenida una sola vez
      } catch {}
      router.replace("/");
    }
    setEnviando(false);
  };

  if (!hidratado || !sesion.uid) return <div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />;

  const edad = edadDesde(b.nacimiento);
  const signo = b.nacimiento ? signoDeFecha(b.nacimiento) : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <nav aria-label="Progreso del registro" className="mb-6">
        <ol className="flex items-center gap-2">
          {PASOS.map((p, i) => (
            <li key={p.id} className="flex flex-1 items-center gap-2" aria-current={i === paso ? "step" : undefined}>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i < paso ? "bg-emerald-500 text-white" : i === paso ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < paso ? "✓" : i + 1}
              </span>
              <span className={`hidden text-xs font-medium sm:block ${i === paso ? "text-slate-800" : "text-slate-400"}`}>{p.titulo}</span>
              {i < PASOS.length - 1 && <span className={`h-0.5 flex-1 ${i < paso ? "bg-emerald-400" : "bg-slate-200"}`} />}
            </li>
          ))}
        </ol>
      </nav>

      <h1 ref={titulo} tabIndex={-1} className="text-2xl font-bold outline-none">
        {["Cuéntanos sobre ti", "¿Qué te interesa?", "¿Cómo es tu pareja ideal?", "Añade tus fotos", "Último vistazo"][paso]}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Paso {paso + 1} de {PASOS.length} ·{" "}
        {["Lo básico para tu perfil público.", "Nos ayuda a mostrarte gente y ofertas afines.", "Con tus palabras: así encontramos a quien de verdad encaja.", "Hasta 10 fotos. La primera será tu foto principal.", "Revisa y confirma."][paso]}
      </p>

      <div className="mt-6 space-y-5">
        {paso === 0 && (
          <>
            <Campo id="ob-nombre" label="Nombre" error={errores.nombre}>
              <input id="ob-nombre" value={b.nombre} onChange={(e) => actualizar("nombre", e.target.value)} maxLength={60} autoComplete="name" aria-invalid={!!errores.nombre} className={campo} />
            </Campo>
            <Campo id="ob-usuario" label="Nombre de usuario" error={errores.usuario}>
              <div className="flex items-center gap-1">
                <span className="text-slate-400">@</span>
                <input id="ob-usuario" value={b.usuario} onChange={(e) => actualizar("usuario", e.target.value)} maxLength={40} placeholder={normalizarUsuario(b.nombre) || "tu_usuario"} aria-invalid={!!errores.usuario} className={campo} />
              </div>
            </Campo>
            <Campo id="ob-nac" label="Fecha de nacimiento (privada: solo se muestra tu signo)" error={errores.nacimiento}>
              <input id="ob-nac" type="date" value={b.nacimiento} onChange={(e) => actualizar("nacimiento", e.target.value)} max={new Date().toISOString().slice(0, 10)} aria-invalid={!!errores.nacimiento} className={campo} />
              {edad !== null && edad >= 18 && signo && <p className="mt-1 text-xs text-slate-500">{edad} años · signo {signo}</p>}
            </Campo>
            <Campo id="ob-ubi" label="Ciudad o barrio (opcional)">
              <input id="ob-ubi" value={b.ubicacion} onChange={(e) => actualizar("ubicacion", e.target.value)} maxLength={60} className={campo} />
            </Campo>
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo id="ob-uni" label="Universidad a la que asististe" error={errores.universidad}>
                <input id="ob-uni" value={b.universidad} onChange={(e) => actualizar("universidad", e.target.value)} maxLength={120} autoComplete="organization" aria-invalid={!!errores.universidad} className={campo} />
              </Campo>
              <Campo id="ob-col" label="Colegio al que asististe" error={errores.colegio}>
                <input id="ob-col" value={b.colegio} onChange={(e) => actualizar("colegio", e.target.value)} maxLength={120} aria-invalid={!!errores.colegio} className={campo} />
              </Campo>
            </div>
            <Campo id="ob-est" label="Estatura en cm (opcional, permite que te encuentren con filtros)" error={errores.estatura}>
              <input id="ob-est" inputMode="decimal" value={b.estatura} onChange={(e) => actualizar("estatura", e.target.value)} maxLength={5} placeholder="170" aria-invalid={!!errores.estatura} className={campo} />
            </Campo>
            <p className="text-xs text-slate-500">Universidad y colegio se muestran en tu perfil y ayudan a encontrar afinidades reales (excompañeros, colegas, ciudad).</p>
          </>
        )}

        {paso === 1 && (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">¿Qué buscas en la comunidad?</legend>
              <Chips<Interes> opciones={INTERESES_EDITABLES} valor={b.intereses} onChange={(v) => actualizar("intereses", v)} etiqueta={(o) => ETIQUETA_INTERES[o]} color="border-brand-600 bg-brand-600 text-white" />
              {errores.intereses && <p role="alert" className="mt-1 text-xs text-rose-600">{errores.intereses}</p>}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Zonas que te interesan</legend>
              <Chips<string> opciones={ZONAS} valor={b.zonas} onChange={(v) => actualizar("zonas", v)} etiqueta={(o) => `📍 ${o}`} color="border-emerald-600 bg-emerald-600 text-white" />
              {errores.zonas && <p role="alert" className="mt-1 text-xs text-rose-600">{errores.zonas}</p>}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Estilo de vida (opcional)</legend>
              <Chips<string> opciones={ESTILOS_VIDA} valor={b.estilo} onChange={(v) => actualizar("estilo", v)} etiqueta={(o) => o} color="border-fuchsia-600 bg-fuchsia-600 text-white" />
            </fieldset>
          </>
        )}

        {paso === 2 && (
          <>
            <Campo id="ob-pareja" label={`Describe a tu pareja ideal — ${b.parejaIdeal.trim().length}/${MAX_PAREJA_IDEAL}`} error={errores.parejaIdeal}>
              <textarea
                id="ob-pareja"
                value={b.parejaIdeal}
                onChange={(e) => actualizar("parejaIdeal", e.target.value)}
                rows={7}
                maxLength={MAX_PAREJA_IDEAL}
                aria-invalid={!!errores.parejaIdeal}
                aria-describedby="ob-pareja-ayuda"
                placeholder="Cómo es su forma de ser, qué valores comparte, qué le gusta hacer, cómo pasan un domingo, qué proyecto de vida imaginas juntos…"
                className={campo}
              />
            </Campo>
            <div id="ob-pareja-ayuda" className="rounded-xl bg-brand-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-brand-800">Cómo usamos este texto</p>
              <p className="mt-1">
                Nuestro motor lo compara con cómo se describen los demás perfiles y te propone las personas que más encajan. <strong>Nadie más puede leerlo</strong>: solo tú.
                {b.parejaIdeal.trim().length < MIN_PAREJA_IDEAL && ` Escribe al menos ${MIN_PAREJA_IDEAL} caracteres.`}
              </p>
              <p className="mt-2 text-xs text-slate-500">Consejo: cuanto más concreto (valores, aficiones, ritmo de vida), mejores recomendaciones.</p>
            </div>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Tipo de relación que buscas (opcional)</legend>
              <Chips<TipoRelacion> opciones={Object.keys(ETIQUETA_RELACION) as TipoRelacion[]} valor={b.relaciones} onChange={(v) => actualizar("relaciones", v)} etiqueta={(o) => ETIQUETA_RELACION[o]} color="border-pink-600 bg-pink-600 text-white" />
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Valores que buscas en tu pareja (opcional, hasta {MAX_VALORES})</legend>
              <Chips<string> opciones={VALORES} valor={b.parejaIdealValores} onChange={(v) => actualizar("parejaIdealValores", v)} etiqueta={(o) => o} color="border-rose-600 bg-rose-600 text-white" max={MAX_VALORES} />
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Estilo de vida que buscas en tu pareja (opcional, hasta {MAX_VALORES})</legend>
              <Chips<string> opciones={ESTILOS_VIDA} valor={b.parejaIdealEstilo} onChange={(v) => actualizar("parejaIdealEstilo", v)} etiqueta={(o) => o} color="border-fuchsia-600 bg-fuchsia-600 text-white" max={MAX_VALORES} />
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Tus valores (opcional, hasta {MAX_VALORES}; se muestran en tu perfil)</legend>
              <Chips<string> opciones={VALORES} valor={b.valores} onChange={(v) => actualizar("valores", v)} etiqueta={(o) => o} color="border-violet-600 bg-violet-600 text-white" max={MAX_VALORES} />
            </fieldset>
          </>
        )}

        {paso === 3 && (
          <>
            <GaleriaFotos items={b.fotos} onChange={(f) => actualizar("fotos", f)} deshabilitado={enviando} />
            {errores.fotos && (
              <p role="alert" className="text-sm text-rose-600">
                {errores.fotos}
              </p>
            )}
            {fallos.length > 0 && (
              <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Algunas fotos no se pudieron subir:</p>
                <ul className="mt-1 list-disc pl-5">
                  {fallos.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p className="mt-1">Elimínalas o cámbialas y vuelve a confirmar: las que ya se subieron no se repiten.</p>
              </div>
            )}
          </>
        )}

        {paso === 4 && (
          <>
            <Campo id="ob-bio" label={`Sobre ti (opcional) — ${b.bio.length}/300`} error={errores.bio}>
              <textarea id="ob-bio" value={b.bio} onChange={(e) => actualizar("bio", e.target.value)} rows={4} maxLength={300} placeholder="Cuéntale a la comunidad qué buscas y cómo eres…" className={campo} />
            </Campo>
            <section aria-label="Resumen" className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start gap-4">
                {b.fotos[0] ? (
                  <img src={b.fotos[0].tipo === "nueva" ? b.fotos[0].preview : b.fotos[0].thumbUrl} alt="Foto principal" className="h-24 w-20 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-24 w-20 items-center justify-center rounded-xl bg-slate-100 text-2xl">👤</div>
                )}
                <dl className="min-w-0 flex-1 space-y-1 text-sm">
                  <div>
                    <dt className="sr-only">Nombre</dt>
                    <dd className="text-lg font-bold">
                      {b.nombre.trim()} {edad !== null && <span className="font-medium text-slate-500">{edad}</span>}
                    </dd>
                  </div>
                  <div className="text-slate-500">@{normalizarUsuario(b.usuario || b.nombre)}</div>
                  <div className="text-slate-600">{b.intereses.map((i) => ETIQUETA_INTERES[i]).join(" · ")}</div>
                  <div className="text-slate-600">📍 {b.zonas.join(" · ")}</div>
                  <div className="text-slate-600">🎓 {b.universidad.trim()} · 🏫 {b.colegio.trim()}</div>
                  <div className="text-slate-500">📸 {b.fotos.length} {b.fotos.length === 1 ? "foto" : "fotos"}</div>
                </dl>
              </div>
            </section>
            {progreso && (
              <div role="status" aria-live="polite">
                <p className="mb-1 text-sm text-slate-600">
                  Subiendo… {progreso.hecho} de {progreso.total}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(progreso.hecho / progreso.total) * 100}%` }} />
                </div>
              </div>
            )}
            {fallos.length > 0 && (
              <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Hubo problemas con algunas fotos; revísalas en el paso anterior.
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0 || enviando} className="rounded-xl px-5 py-3 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40">
          Atrás
        </button>
        {paso < PASOS.length - 1 ? (
          <button type="button" onClick={siguiente} className="rounded-xl bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700">
            Siguiente
          </button>
        ) : (
          <button type="button" onClick={confirmar} disabled={enviando} className="rounded-xl bg-emerald-600 px-8 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {enviando ? "Guardando…" : "Confirmar y entrar"}
          </button>
        )}
      </div>
    </div>
  );
}
