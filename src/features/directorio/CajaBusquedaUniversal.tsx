import { OPCIONES_ZONA } from "@/features/directorio/Bloques";

const campo = "w-full rounded-full border-0 bg-transparent px-4 py-3 text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate-400";

/**
 * Buscador universal del directorio: encuentra negocios y lo que venden («paracetamol», «ceviche»), en todas las secciones.
 * Es un formulario GET a /directorio/buscar: funciona sin JavaScript y el resultado se puede compartir como enlace.
 */
export default function CajaBusquedaUniversal({ q = "", zona = "", autoFoco = false }: { q?: string; zona?: string; autoFoco?: boolean }) {
  return (
    <form
      action="/directorio/buscar"
      method="get"
      role="search"
      aria-label="Buscar en el directorio"
      className="grid gap-1 rounded-[1.75rem] bg-white p-2 shadow-[0_24px_60px_-24px_rgb(2_7_14/0.35)] ring-1 ring-slate-200/80 sm:grid-cols-[1fr_15rem_auto] sm:items-center sm:rounded-full"
    >
      <label className="sr-only" htmlFor="uni-q">
        ¿Qué buscas?
      </label>
      <input id="uni-q" name="q" type="search" defaultValue={q} maxLength={60} required minLength={2} autoFocus={autoFoco} autoComplete="off" placeholder="Busca un plato, un medicamento o un negocio…" className={campo} />
      <label className="sr-only" htmlFor="uni-zona">
        Zona
      </label>
      <select id="uni-zona" name="zona" defaultValue={zona} className={`${campo} cursor-pointer sm:border-l sm:border-slate-200`}>
        <option value="">📍 Toda la ciudad</option>
        {OPCIONES_ZONA.map((z) => (
          <option key={z} value={z}>
            📍 {z}
          </option>
        ))}
      </select>
      <button type="submit" className="boton-marca flex items-center justify-center gap-2 rounded-full px-8 py-3 text-[15px] font-bold text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        Buscar
      </button>
    </form>
  );
}
