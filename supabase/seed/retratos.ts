/**
 * Avatares de los 23 usuarios demo de seed.sql (id de usuarios.ts → nº de foto en pravatar.cc).
 * Elegidos a mano entre el catálogo (solo adultos, sin figuras públicas) según el nombre de cada perfil; ninguno coincide
 * con los retratos de las personas de Ecuador (23, 28, 49, 55, 59). Son fotos de muestra: por eso los perfiles son is_demo.
 */
export const RETRATOS: Record<string, number> = {
  u1: 45, u2: 13, u3: 32, u4: 8, u5: 36, u6: 12, u7: 5, u8: 18, u9: 26, u10: 52, u11: 27, u12: 60,
  u13: 16, u14: 11, u15: 47, u16: 53, u17: 54, u18: 9, u19: 24, u20: 14, u21: 57, u22: 21, u23: 68,
};

export const avatarDemo = (idUsuario: string): string | null => (RETRATOS[idUsuario] ? `https://i.pravatar.cc/400?img=${RETRATOS[idUsuario]}` : null);
