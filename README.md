# Válora frontend

Frontend estático de Válora para publicar como **Static Site** en Render.

El frontend espera la API en `https://valora-backend.onrender.com`, configurada en las etiquetas `meta[name="valora-api-url"]` de las páginas HTML. Si Render asigna otra URL al backend, actualiza ese valor antes de publicar.

En Render usa:

- **Build Command:** vacío
- **Publish Directory:** `.`

## Validación CI/CD

Cada cambio en `main` o en un pull request ejecuta GitHub Actions para comprobar:

- Sintaxis de todos los archivos JavaScript.
- Versiones y compatibilidad con Node.js 24.
- Catálogos JSON y configuración de la API `/api/v1/`.
- Auditoría de dependencias con `npm audit`.
- Análisis de seguridad JavaScript con CodeQL.

En cada `push` a `main`, si todas las validaciones pasan, el mismo workflow publica el sitio en GitHub Pages.

La página publicada queda en `https://kine2003.github.io/VALORA-frontend/`.
