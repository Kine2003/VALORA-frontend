import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const filesystemRoot = fileURLToPath(root);
const archivos = [];

async function recorrer(directorio) {
  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    if (entrada.name === ".git" || entrada.name === "node_modules") continue;
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) await recorrer(ruta);
    else archivos.push(ruta);
  }
}

await recorrer(filesystemRoot);

for (const archivo of archivos.filter(ruta => extname(ruta) === ".js" || extname(ruta) === ".mjs")) {
  const resultado = spawnSync(process.execPath, ["--check", archivo], { encoding: "utf8" });
  if (resultado.status !== 0) throw new Error(`JavaScript inválido en ${relative(filesystemRoot, archivo)}:\n${resultado.stderr}`);
}

const datos = {};
for (const nombre of ["productos.json", "servicios.json"]) {
  const ruta = new URL(`data/${nombre}`, root);
  try {
    datos[nombre] = JSON.parse(await readFile(ruta, "utf8"));
  } catch (error) {
    throw new Error(`JSON inválido en data/${nombre}: ${error.message}`);
  }
}

if (datos["productos.json"].version !== 2 || !Array.isArray(datos["productos.json"].productos)) {
  throw new Error("El catálogo de productos no cumple la versión 2.");
}
if (datos["servicios.json"].version !== 3 || !datos["servicios.json"].servicios ||
    Array.isArray(datos["servicios.json"].servicios)) {
  throw new Error("El catálogo de servicios no cumple la versión 3.");
}

for (const nombre of ["index.html", "condiciones.html", "privacidad.html"]) {
  const html = await readFile(new URL(nombre, root), "utf8");
  if (!/<html\b[^>]*lang="es"/u.test(html)) throw new Error(`${nombre} no declara lang="es".`);
  if (!/<meta\s+name="valora-api-url"\s+content="https:\/\//u.test(html)) {
    throw new Error(`${nombre} no tiene una URL HTTPS para la API.`);
  }
}

const api = await readFile(new URL("js/api.js", root), "utf8");
if (!api.includes("/api/v1/") || !api.includes("valora-api-url")) {
  throw new Error("La configuración del cliente API no apunta a /api/v1/.");
}

console.log(`Validación correcta: ${archivos.length} archivos inspeccionados.`);
