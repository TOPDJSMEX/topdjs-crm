TOPDJS CRM v10 - ARCHIVOS DEL EVENTO

Nuevo:
- Botón + AGREGAR ARCHIVO dentro de VER evento.
- Sube archivos a Supabase Storage bucket event-files.
- Registra archivos en tabla event_files.
- Permite VER / DESCARGAR.
- Permite ELIMINAR archivos.
- Si borras un evento, intenta borrar también sus archivos asociados.

Requisitos ya configurados:
- Bucket público: event-files
- Tabla: public.event_files
  id, record_local_id, file_name, file_url, created_at
