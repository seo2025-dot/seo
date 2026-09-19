export const metadata = { title: "Mensajes" };

export default function MensajesVacioPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <p className="text-5xl">💬</p>
      <h2 className="mt-4 text-xl font-bold">Tus mensajes</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Elige una conversación para chatear con dueños de propiedades y con tus amigos de la comunidad.
      </p>
    </div>
  );
}
