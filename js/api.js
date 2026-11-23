import { guardarSesion, borrarSesion } from "./sesion.js";
export const servidorLocal = () => Boolean(globalThis.document?.querySelector('meta[name="valora-api"], meta[name="valora-api-url"]'));
export function urlApi(recurso) {
  const base = globalThis.document?.querySelector('meta[name="valora-api-url"]')?.content;
  return new URL("/api/v1/" + recurso, base ? new URL(base, globalThis.location?.href || import.meta.url) : globalThis.location?.origin || import.meta.url);
}
let renovacion;
export async function solicitarApi(recurso, { metodo = "GET", cuerpo, reintentar = true } = {}) {
  if(cuerpo===undefined&&['POST','PATCH','DELETE'].includes(metodo))cuerpo={};
  const opciones = { method: metodo, credentials: "include", headers: {} };
  if (cuerpo !== undefined) { opciones.headers["Content-Type"] = "application/json"; opciones.body = JSON.stringify(cuerpo); }
  let respuesta;
  try { respuesta = await fetch(urlApi(recurso), opciones); }
  catch { throw new Error("No pudimos conectar con el servidor. Revisa tu conexión e inténtalo otra vez."); }
  if (respuesta.status === 401 && reintentar && !["auth/login", "auth/registro", "auth/renovar", "auth/logout"].includes(recurso)) {
    if (!renovacion) renovacion = solicitarApi("auth/renovar", { metodo: "POST", cuerpo: {}, reintentar: false }).then(sesion => { guardarSesion(sesion); }).catch(error => { borrarSesion(); throw error; }).finally(() => { renovacion = null; });
    await renovacion;
    return solicitarApi(recurso, { metodo, cuerpo, reintentar: false });
  }
  let resultado = {};
  try { resultado = await respuesta.json(); } catch { /* respuesta sin cuerpo */ }
  if (!respuesta.ok) { const error = new Error(resultado?.error || "No se pudo completar la operación."); error.estado = respuesta.status; throw error; }
  return resultado;
}
export async function registrarSolicitud(tipo, datos) { return solicitarApi(tipo, { metodo: "POST", cuerpo: datos }); }
