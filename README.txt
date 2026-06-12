TOPDJS CRM v10.1 - ARCHIVOS DEL EVENTO FIX

Nuevo:
- Sección visible dentro del botón VER:
  📎 ARCHIVOS DEL EVENTO
  + AGREGAR ARCHIVO
  VER / DESCARGAR
  ELIMINAR

- Sube a Supabase Storage bucket: event-files
- Guarda relación en tabla: event_files
- Contador 📎 en la tabla de registros
- Si borras evento, intenta borrar también:
  1. topdjs_records
  2. event_files
  3. archivos físicos del bucket event-files

Instalación:
1. Subir estos 6 archivos a GitHub reemplazando los existentes.
2. Commit: TopDJs CRM v10.1 - Event Files Fix
3. Esperar Vercel Ready.
4. Abrir https://topdjs-crm.vercel.app
5. Forzar actualización con Cmd + Shift + R.
