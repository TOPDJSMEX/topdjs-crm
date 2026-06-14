TOPDJS CRM v11.4.15 - FIX SYNC PAID_METHOD

Corrección urgente:
- El CRM ya no intenta guardar paid_method dentro de topdjs_records.
- Evita el error de Supabase:
  Could not find the 'paid_method' column of 'topdjs_records' in the schema cache.
- Los métodos de pago se siguen manejando en event_payments.
- Permite sincronizar eventos pendientes que quedaron atorados en la computadora de Vane.

Mantiene:
- Pago cancelado seguro.
- Fecha de anticipo.
- Gastos por evento.
- Archivo directo.
- Sin botón Liquidar.
- Acciones neón.
- Dashboard real de cobranza.

Instalación:
1. Subir los 7 archivos a GitHub reemplazando los actuales.
2. Commit: TopDJs CRM v11.4.15 - Fix sync paid_method
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
5. En la computadora de Vane, presionar SINCRONIZAR.
