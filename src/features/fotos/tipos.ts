/** Elemento de una galería en edición: una foto nueva (aún sin subir) o una ya guardada en el servidor. */
export type ItemFoto = { key: string } & (
  | { tipo: "nueva"; file: File; preview: string }
  | { tipo: "guardada"; id: string; url: string; thumbUrl: string }
);

export interface FotoGuardada {
  id: string;
  url: string;
  thumbUrl: string;
  ancho?: number;
  alto?: number;
}
