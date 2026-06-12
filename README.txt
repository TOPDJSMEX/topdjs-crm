TOPDJS CRM v10.5 - EDIT + DELETE FIX DEFINITIVO

Correcciones:
- EDITAR busca por local_id.
- Si falla, busca por id UUID.
- Si falla Supabase, usa el registro local visible.
- No abre editor vacío; muestra error si no encuentra datos.
- BORRAR EVENTO:
  1. Busca archivos por record_local_id.
  2. Borra objetos del bucket event-files.
  3. Borra filas event_files.
  4. Borra evento topdjs_records.
  5. Sincroniza todos los dispositivos.

Instalación:
1. Sube estos 6 archivos a GitHub reemplazando los actuales.
2. Commit: TopDJs CRM v10.5 - Edit Delete Fix
3. Espera Vercel Ready.
4. Recarga fuerte: Option + Command + R.
