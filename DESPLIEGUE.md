# Desplegar la versión con acceso y cocina

Los repositorios siguen separados: Kine2003/VALORA-frontend contiene la presentación y Kine2003/VALORA-backend contiene la API y PostgreSQL. La aplicación autenticada se entrega desde Render bajo un mismo origen. GitHub Pages puede mantenerse como enlace de entrada.

1. Publicar y revisar el frontend actualizado. La construcción del backend descarga su rama main; FRONTEND_REF admite otra rama o etiqueta.
2. Publicar el backend y conservar la conexión a la base existente.
3. En Render usar Build Command npm ci && npm run frontend:build && npm run db:migrate y Start Command npm start.
4. Configurar NODE_ENV=production, FRONTEND_DIR=./public, APP_ORIGIN=https://valora-api-9thl.onrender.com, PAGO_SIMULADO=false, JWT_SECRET aleatoria y DATABASE_URL privada. Si cambia la URL del servicio, ajustar APP_ORIGIN.
5. Separar el rol de la API del propietario de migraciones mediante MIGRATION_DATABASE_URL. Mantener la verificación del certificado PostgreSQL; DB_SSL_CA admite una CA adicional cuando sea necesaria.
6. Respaldar antes de migrar. No volver a sembrar por rutina: las cuentas y el catálogo se conservan.
7. Verificar /api/v1/salud, catálogo, registro de prueba, login, permisos, Mis pedidos y logout. Comprobar cookies HttpOnly/Secure y llamadas a /api/v1/ del mismo servicio.

Las sesiones anteriores se invalidan durante la migración y se debe volver a entrar. Las recetas sin cantidades permanecen pendientes. No se ha integrado una pasarela de cobro ni la facturación electrónica del SRI.

Nunca publiques .env, secretos de firma, contraseñas ni URLs privadas de PostgreSQL. Esta actualización se probó localmente; publicar y configurar Render sigue siendo un paso separado.

La configuración de PostgreSQL verifica el certificado. En Render utiliza la URL externa completa para esta modalidad: los certificados internos son autofirmados y no admiten verify-full. Consulta la [documentación oficial](https://render.com/docs/postgresql-creating-connecting) y comprueba la conectividad y la lista de IP permitidas antes de publicar.
