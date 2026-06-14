TOPDJS CRM v11.4.12 - FECHA DE ANTICIPO

Nuevo:
- En la sección Totales del cotizador se agregó el campo “Fecha del anticipo”.
- Al guardar una cotización con anticipo, el movimiento inicial de pago usa esa fecha.
- La fecha se refleja en Movimientos de Pago del evento.

Importante:
- No requiere SQL nuevo.
- La fecha queda registrada en la tabla event_payments como payment_date cuando se crea el anticipo inicial.
- El campo expenses_jsonb y las mejoras de gastos se mantienen.

Mantiene:
- TopDJs CRM v11.4.11 - Sin botón liquidar.
- Botón directo de archivo.
- Total gastos staff.
- Botón directo de gastos.

Instalación:
1. Subir los 7 archivos a GitHub.
2. Commit: TopDJs CRM v11.4.12 - Fecha de anticipo
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
