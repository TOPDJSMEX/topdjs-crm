TOPDJS CRM v11.4.27 - ESTADOS COMERCIALES

Nuevo:
- Campo Estado del evento en el cotizador/editor.
- Estados:
  Cotizado
  Confirmado sin anticipo
  Confirmado con anticipo
  Liquidado
  Cancelado
  Perdido

Reglas:
- Eventos antiguos con pago se clasifican como Confirmado con anticipo.
- Eventos antiguos liquidados se clasifican como Liquidado.
- Eventos sin pago se clasifican como Cotizado y pueden cambiarse manualmente a Confirmado sin anticipo.
- Cancelado y Perdido quedan como estados manuales.

Dashboard:
- Cotizado no confirmado
- Cobrado
- Pendiente confirmado
- Confirmado sin anticipo
- Confirmado con anticipo
- Vencido

Mantiene:
- Fecha Día/Mes/Año
- Clientes acciones alineadas
- Calendario anual con años
- Monto y saldo neon
- Gastos por evento
- Archivo directo
- Sin botón liquidar

Instalación:
1. Subir los 7 archivos a GitHub.
2. Commit: TopDJs CRM v11.4.27 - Estados comerciales
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
