/* Sesión del navegador: solo guarda el token opaco y los datos públicos del usuario. */
const CLAVE = "valora-sesion-v1";

export function leerSesion() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (!guardada || typeof guardada.token !== "string" || !guardada.usuario) return null;
    return guardada;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
    return true;
  } catch {
    return false;
  }
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* El cierre de sesión del servidor sigue siendo válido aunque el navegador no borre la copia. */
  }
}

export function esAdmin(sesion = leerSesion()) {
  return Boolean(sesion?.usuario?.roles?.includes("ADMINISTRADOR"));
}

export function primerNombre(nombre = "") {
  return nombre.trim().split(/\s+/u)[0] || "Tu cuenta";
}
