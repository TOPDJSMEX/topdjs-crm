TOPDJS CRM v10.6 - SETINPUT FIX

Corrección:
- Se agregó la función setInput().
- Corrige el error:
  ReferenceError: Can't find variable: setInput
- El botón EDITAR ya debe precargar los campos del evento.

Mantiene:
- Edición por local_id/id.
- Borrado completo evento + archivos.
- Supabase Storage.
- Sincronización multiusuario.

Instalación:
1. Subir estos 6 archivos a GitHub reemplazando los actuales.
2. Commit: TopDJs CRM v10.6 - SetInput Fix
3. Esperar Vercel Ready.
4. Recarga fuerte: Option + Command + R.
