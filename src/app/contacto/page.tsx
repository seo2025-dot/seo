export const metadata = { title: "Contacto | Inmobiliaria" };

export default function ContactoPage() {
  const campo =
    "w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-bold">Contacto</h1>
      <p className="mt-2 text-slate-500">
        Cuéntanos qué buscas y un asesor se pondrá en contacto contigo.
      </p>
      {/* TODO: conectar con un Server Action o endpoint /api/contacto */}
      <form className="mt-8 space-y-4">
        <input name="nombre" placeholder="Nombre" required className={campo} />
        <input name="email" type="email" placeholder="Email" required className={campo} />
        <input name="telefono" type="tel" placeholder="Teléfono" className={campo} />
        <textarea name="mensaje" rows={5} placeholder="Mensaje" required className={campo} />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
