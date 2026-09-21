import AvisoVivo from "@/components/AvisoVivo";
import BarraCarrito from "@/features/directorio/carrito/BarraCarrito";

/** Todas las páginas del directorio: la barra flotante del carrito y los avisos en tiempo real (un pedido nuevo o un cambio de estado). */
export default function DirectorioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BarraCarrito />
      <AvisoVivo />
    </>
  );
}
