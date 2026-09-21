import Link from "next/link";

export const metadata = { title: "Página no encontrada" };

/** 404 en español y con salidas claras (antes salía la pantalla en inglés por defecto de Next.js). */
export default function NoEncontrada() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>
        🧭
      </p>
      <h1 className="mt-4 text-2xl font-black text-ink">No encontramos esta página</h1>
      <p className="mt-2 text-slate-600">Puede que el enlace esté mal escrito o que ya no exista.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="boton-marca rounded-full px-6 py-3 font-bold text-white">
          Ir al inicio
        </Link>
        <Link href="/directorio" className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50">
          Ver el directorio
        </Link>
      </div>
    </div>
  );
}
