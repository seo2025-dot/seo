const campo =
  "w-full cursor-pointer appearance-none bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate-400";

function Grupo({ id, etiqueta, children, divisor = true }: { id: string; etiqueta: string; children: React.ReactNode; divisor?: boolean }) {
  return (
    <div
      className={`group relative rounded-2xl px-5 py-2.5 transition-colors focus-within:bg-brand-50/70 hover:bg-slate-50 sm:rounded-full ${
        divisor ? "sm:after:absolute sm:after:-right-0.5 sm:after:top-1/4 sm:after:h-1/2 sm:after:w-px sm:after:bg-slate-200" : ""
      }`}
    >
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {etiqueta}
      </label>
      {children}
    </div>
  );
}

/** Búsqueda principal de la portada: una sola pieza, con etiquetas discretas y separadores finos. */
export default function SearchBar() {
  return (
    <form
      action="/propiedades"
      role="search"
      aria-label="Buscar inmuebles"
      className="grid gap-1 rounded-[1.75rem] bg-white p-2 shadow-[0_24px_60px_-24px_rgb(2_7_14/0.35)] ring-1 ring-slate-200/80 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-center sm:rounded-full"
    >
      <Grupo id="buscar-operacion" etiqueta="Operación">
        <select id="buscar-operacion" name="operacion" className={campo} defaultValue="">
          <option value="">Venta o alquiler</option>
          <option value="venta">Venta</option>
          <option value="alquiler">Alquiler</option>
        </select>
      </Grupo>
      <Grupo id="buscar-tipo" etiqueta="Tipo">
        <select id="buscar-tipo" name="tipo" className={campo} defaultValue="">
          <option value="">Cualquier tipo</option>
          <option value="casa">Casa</option>
          <option value="departamento">Departamento</option>
          <option value="terreno">Terreno</option>
          <option value="local">Local</option>
        </select>
      </Grupo>
      <Grupo id="buscar-ubicacion" etiqueta="Ubicación" divisor={false}>
        <input id="buscar-ubicacion" name="ubicacion" placeholder="Ciudad, zona o barrio" autoComplete="off" className={campo} />
      </Grupo>
      <button
        type="submit"
        className="boton-marca flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-bold text-white sm:ml-1 sm:py-4"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        Buscar
      </button>
    </form>
  );
}
