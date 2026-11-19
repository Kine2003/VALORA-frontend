# Despliegue de Válora: frontend y backend

Este documento resume el proceso utilizado para publicar Válora con el frontend en GitHub Pages, el backend en Render y PostgreSQL como base de datos administrada.

## 1. Separar el proyecto

Se dividió el proyecto en dos repositorios:

- Frontend: `Kine2003/VALORA-frontend`
- Backend: `Kine2003/VALORA-backend`

El frontend contiene las páginas HTML, estilos, JavaScript del navegador, imágenes y archivos JSON estáticos. El backend contiene el servidor Node.js, las rutas de la API, los repositorios y los scripts de base de datos.

## 2. Preparar el backend

El backend se adaptó de MySQL a PostgreSQL:

1. Se reemplazó `mysql2` por `pg`.
2. Se configuró la conexión mediante `DATABASE_URL`.
3. Se convirtió el esquema SQL a PostgreSQL.
4. Se agregaron los scripts:
   - `npm run db:migrate`: crea tablas, índices y vistas.
   - `npm run db:seed`: carga los catálogos iniciales.
5. Se mantuvo `npm start` para iniciar la API.

Los comandos principales del backend son:

```text
npm ci
npm run db:migrate
npm run db:seed
npm start
```

No se deben subir contraseñas, archivos `.env` ni URLs con credenciales al repositorio.

## 3. Crear PostgreSQL en Render

En Render se creó una base de datos PostgreSQL gratuita:

1. Abrir **New +** y seleccionar **PostgreSQL**.
2. Nombrar la base `valora-db`.
3. Seleccionar el plan **Free** y la región **Oregon**.
4. Esperar a que el estado sea **Available**.
5. Copiar la **Internal Database URL** únicamente desde Render.

El plan gratuito puede suspenderse por inactividad y tiene un periodo limitado. Para producción real se debe revisar la política vigente de Render.

## 4. Crear el Web Service del backend

En Render se creó el servicio `valora-api` conectado al repositorio `Kine2003/VALORA-backend`:

1. Seleccionar **New + > Web Service**.
2. Elegir el repositorio del backend y la rama `main`.
3. Usar el entorno Node.
4. Configurar:

```text
Build Command: npm ci && npm run db:migrate && npm run db:seed
Start Command: npm start
```

5. Seleccionar el plan **Free**.
6. Agregar estas variables de entorno:

```text
DATABASE_URL=<Internal Database URL de valora-db>
FRONTEND_ORIGIN=https://kine2003.github.io/VALORA-frontend/
NODE_ENV=production
```

`DATABASE_URL` debe crearse desde el panel de Render y nunca escribirse en este archivo.

La URL pública obtenida para la API fue:

```text
https://valora-api-9thl.onrender.com
```

## 5. Conectar el frontend con la API

El frontend define la URL del backend en cada página mediante esta etiqueta:

```html
<meta name="valora-api-url" content="https://valora-api-9thl.onrender.com">
```

El archivo `js/api.js` toma esa URL y construye las rutas bajo `/api/v1/`. Por ejemplo:

```text
https://valora-api-9thl.onrender.com/api/v1/servicios
https://valora-api-9thl.onrender.com/api/v1/productos
```

## 6. Publicar GitHub Pages

En GitHub:

1. Abrir `Kine2003/VALORA-frontend`.
2. Entrar a **Settings > Pages**.
3. En **Build and deployment**, seleccionar **GitHub Actions**.
4. Guardar la configuración.
5. Publicar los cambios en la rama `main`.
6. Esperar a que termine el workflow de Pages.

La página quedó publicada en:

```text
https://kine2003.github.io/VALORA-frontend/
```

## 7. Verificar el despliegue

Primero se comprueba la API directamente:

```text
GET https://valora-api-9thl.onrender.com/api/v1/salud
GET https://valora-api-9thl.onrender.com/api/v1/productos
GET https://valora-api-9thl.onrender.com/api/v1/servicios
```

La respuesta de salud debe indicar que PostgreSQL está conectado y las rutas de catálogos deben devolver JSON.

Después se abre GitHub Pages en una ventana privada o se fuerza la recarga con `Ctrl + F5`. En las herramientas del navegador, pestaña **Network**, se verifica que las solicitudes vayan a `valora-api-9thl.onrender.com` y no a `localhost` ni a una ruta relativa de GitHub Pages.

## 8. Problema encontrado y solución

El primer despliegue del backend fallaba durante `db:seed` porque el script importaba un módulo frontend que no existía dentro del repositorio del backend. Se separó el validador del catálogo en `lib/validar-catalogo.js` y se actualizó el seed.

Después, GitHub Pages no mostraba los datos del backend porque el frontend apuntaba a una URL antigua (`valora-backend.onrender.com`). Se actualizaron `index.html`, `privacidad.html` y `condiciones.html` para usar la URL real de `valora-api`.

## 9. Mantenimiento

- Revisar los logs de Render cuando un despliegue falle.
- No borrar `DATABASE_URL` del Web Service.
- Mantener la región del Web Service y PostgreSQL igual para mejorar la conexión privada.
- Volver a ejecutar las pruebas de API después de cada cambio.
- Si se cambia la URL del backend, actualizar la etiqueta `valora-api-url` y publicar nuevamente Pages.
