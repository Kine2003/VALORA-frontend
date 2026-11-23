let sesionActual = null;
try { localStorage.removeItem("valora-sesion-v1"); } catch { /* almacenamiento bloqueado */ }
export function leerSesion() { return sesionActual; }
export function guardarSesion(sesion) { sesionActual = sesion?.usuario ? { usuario: sesion.usuario } : null; return true; }
export function borrarSesion() { sesionActual = null; }
export function esAdmin(sesion = leerSesion()) { return Boolean(sesion?.usuario?.roles?.some(rol => ["ADMINISTRADOR", "CATALOGO", "OPERACIONES", "FINANZAS"].includes(rol))); }
export function primerNombre(nombre = "") { return nombre.trim().split(/\s+/u)[0] || "Tu cuenta"; }
export async function restaurarSesion() {
  const { solicitarApi } = await import("./api.js");
  try { let sesion = await solicitarApi("auth/sesion"); if (!sesion) sesion = await solicitarApi("auth/renovar", { metodo: "POST", cuerpo: {}, reintentar: false }); guardarSesion(sesion?.usuario ? sesion : sesion ? { usuario: sesion } : null); return leerSesion(); }
  catch (error) { borrarSesion(); if (error.estado !== 401) throw error; return null; }
}
