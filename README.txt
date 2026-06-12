TOPDJS CRM v10.3 - EDITAR DESDE SUPABASE

Corrección:
- Al presionar EDITAR, la app primero busca el evento actualizado en Supabase.
- Luego precarga el formulario con la versión más reciente.
- Si no hay internet o Supabase no responde, usa la copia local como respaldo.
- Evita que Carlos y Vane editen datos incompletos o viejos.

Mantiene:
- Archivos por evento.
- Ver / descargar / eliminar archivos.
- Sincronización multiusuario.
- Botón EDITAR en la tabla y dentro del modal VER.

Instalación:
1. Subir estos 6 archivos a GitHub reemplazando los existentes.
2. Commit: TopDJs CRM v10.3 - Edit From Cloud
3. Esperar Vercel Ready.
4. Abrir app y forzar recarga con Cmd + Shift + R.
