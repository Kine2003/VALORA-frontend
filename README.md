# Válora frontend

Frontend de Válora publicado en GitHub Pages.

El frontend usa la API `https://valora-api-9thl.onrender.com`, configurada en las etiquetas `meta[name="valora-api-url"]` de las páginas HTML. El backend recibe y devuelve JSON y guarda las solicitudes en PostgreSQL de Render.

Para trabajar en este equipo con PostgreSQL local:

1. Ejecuta `npm start` en la carpeta `VALORA-backend`. La configuración local usa PostgreSQL en el puerto 5432 y sirve la API en el puerto 3001.
2. Ejecuta `npm start` en esta carpeta y abre `http://127.0.0.1:3002/`.

El servidor del frontend local usa la API `http://127.0.0.1:3001` al entregar las páginas HTML. Los archivos publicados en GitHub Pages apuntan a Render. Para usar otra API durante el desarrollo, define `API_BASE_URL` antes de iniciar el frontend.

## Validación CI/CD

Cada cambio en `main` o en un pull request ejecuta GitHub Actions para comprobar:

- Sintaxis de todos los archivos JavaScript.
- Versiones y compatibilidad con Node.js 24.
- Catálogos JSON y configuración de la API `/api/v1/`.
- Auditoría de dependencias con `npm audit`.
- Análisis de seguridad JavaScript con CodeQL.

En cada `push` a `main`, si todas las validaciones pasan, el mismo workflow publica el sitio en GitHub Pages.

La página publicada queda en `https://kine2003.github.io/VALORA-frontend/` cuando finaliza correctamente el workflow.
