import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const api = new URL(process.env.API_BASE_URL || "http://127.0.0.1:3001").origin;
const tipos = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      return res.end();
    }
    const ruta = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const archivo = resolve(root, "." + (ruta === "/" ? "/index.html" : ruta));
    const tipo = tipos[extname(archivo)];
    if (!archivo.startsWith(root.endsWith(sep) ? root : root + sep) || !tipo ||
        ruta.split("/").some(parte => parte.startsWith("."))) {
      res.writeHead(404);
      return res.end();
    }
    let datos = await readFile(archivo);
    if (extname(archivo) === ".html") {
      datos = datos.toString("utf8").replace(
        /(<meta name="valora-api-url" content=")[^"]*(")/,
        (_, inicio, fin) => inicio + api + fin,
      );
    }
    res.writeHead(200, { "Content-Type": tipo, "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : datos);
  } catch (error) {
    res.writeHead(error.code === "ENOENT" || error instanceof URIError ? 404 : 500);
    res.end();
  }
}).listen(Number(process.env.PORT || 3002), "127.0.0.1", () => {
  console.log("Válora local en http://127.0.0.1:" + (process.env.PORT || 3002));
});
