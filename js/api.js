export const servidorLocal = () => Boolean(globalThis.document?.querySelector('meta[name="valora-api"], meta[name="valora-api-url"]')?.content);

export function urlApi(recurso) {
  const base = globalThis.document?.querySelector('meta[name="valora-api-url"]')?.content;
  return new URL("/api/v1/" + recurso, base || globalThis.location?.origin || import.meta.url);
}

export async function registrarSolicitud(tipo, datos) {
  const respuesta = await fetch(urlApi(tipo), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.error || "No se pudo registrar la solicitud.");
  return resultado;
}
