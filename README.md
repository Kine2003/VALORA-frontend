# Válora frontend

Interfaz de clientes y administradores. Conserva el catálogo e incorpora platos, recetas, compras, existencias y una vista renovada de pedidos propios.

La aplicación autenticada se entrega bajo el mismo origen que la API de VALORA-backend. Usa cookies HttpOnly y conserva solo el usuario público en memoria.

## Inicio local

Inicia npm start en ../VALORA-backend y abre http://127.0.0.1:3001/.

Para trabajar con un servidor de desarrollo separado, inicia también npm start en esta carpeta y abre http://127.0.0.1:3002/. El servidor local utiliza un proxy bajo /api/ hacia el backend de 3001 para conservar las cookies del mismo origen. API_BASE_URL solo admite destinos HTTP locales.

## Administrar cocina

Después del login, admin.valora.1 entra al dashboard. Cocina y catálogo contiene Recetas y existencias, Catálogo y Tablas avanzadas. Puedes crear platos, definir cantidades por porción, registrar compras y planificar producción. Los ingredientes y proveedores se añaden en Inventario y compras.

Las 207 opciones existentes se conservan. Una receta sin cantidades aparece pendiente. Para varios platos que comparten ingredientes utiliza la planificación conjunta.

Mis pedidos y cotizaciones incluye resumen, filtros, progreso y detalle de platos. Los pagos de prueba se identifican como simulación; no realizan cobros bancarios.

## Verificación y publicación

Ejecuta npm run validate y npm test. GitHub Actions ejecuta ambas comprobaciones y CodeQL.

Para publicar la aplicación autenticada, Render descarga este frontend al construir el backend y sustituye la configuración API por el mismo origen. Primero hay que publicar ambos repositorios y configurar Render. Editar esta copia local no cambia el sitio remoto anterior.

Consulta DESPLIEGUE.md y el README del backend para el orden de publicación.
