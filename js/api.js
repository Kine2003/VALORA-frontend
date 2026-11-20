import { leerSesion } from "./sesion.js";

export const servidorLocal = () => Boolean(globalThis.document?.querySelector('meta[name="valora-api"], meta[name="valora-api-url"]')?.content);

export function urlApi(recurso) {
  const base = globalThis.document?.querySelector('meta[name="valora-api-url"]')?.content;
  return new URL("/api/v1/" + recurso, base || globalThis.location?.origin || import.meta.url);
}

export async function solicitarApi(recurso, { metodo = "GET", cuerpo, token } = {}) {
  const sesion = leerSesion();
  const autorizacion = token !== undefined ? token : sesion?.token;
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }
  if (autorizacion) opciones.headers.Authorization = "Bearer " + autorizacion;

  let respuesta;
  try {
    respuesta = await fetch(urlApi(recurso), opciones);
  } catch {
    throw new Error("No pudimos conectar con el servidor. Revisa tu conexión e inténtalo otra vez.");
  }
  let resultado = {};
  try {
    resultado = await respuesta.json();
  } catch {
    resultado = {};
  }
  if (!respuesta.ok) {
    const error = new Error(resultado.error || "No se pudo completar la operación.");
    error.estado = respuesta.status;
    throw error;
  }
  return resultado;
}

export async function registrarSolicitud(tipo, datos) {
  return solicitarApi(tipo, { metodo: "POST", cuerpo: datos });
}
