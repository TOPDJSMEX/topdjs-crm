TOPDJS CRM v11.4.4 - DASHBOARD REAL DE COBRANZA

Corrección:
- El resumen de Cotizaciones / Eventos ahora sí se convierte en tarjetas neón reales:
  Azul = Cotizado
  Verde = Cobrado
  Amarillo = Pendiente
  Rojo = Vencido

Nuevo:
- Tarjeta VENCIDO con monto total vencido.
- Conteo de eventos vencidos.
- Botón PAGO renombrado a REGISTRAR PAGO.
- Botón PAGADO renombrado a LIQUIDAR.

Mantiene:
- Método del anticipo.
- Movimientos de pago.
- Total recibido en verde.
- Saldo pendiente en rojo.
- Eventos operativos.
- 🔴 COBRAR $monto en eventos pasados pendientes.

Requiere:
- Tabla event_payments en Supabase.

Instalación:
1. Subir los 7 archivos:
   index.html, app.js, style.css, manifest.json, sw.js, README.txt, topdjs-logo.png
2. Commit: TopDJs CRM v11.4.4 - Dashboard Real
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
