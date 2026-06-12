TOPDJS CRM v11.0 - AUDITORÍA Y BITÁCORA

Requiere:
- Tabla public.event_history.
- Columnas topdjs_records.updated_by y topdjs_records.updated_at.

Nuevo:
- Al crear, editar o borrar evento pide responsable:
  1 = Carlos
  2 = Vane
- Guarda updated_by y updated_at.
- Registra bitácora en event_history.
- Muestra última actualización en VER EVENTO.
- Botón VER BITÁCORA.
- Compara cambios importantes: datos del evento, monto, anticipo, estatus, equipo y staff.

Instalación:
1. Subir 6 archivos a GitHub.
2. Commit: TopDJs CRM v11.0 - Auditoria Bitacora
3. Esperar Vercel Ready.
4. Recarga fuerte: Option + Command + R.
