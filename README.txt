TOPDJS CRM v11.4.3 - COBRAR MONTO VISIBLE

Nuevo:
- En Eventos Operativos, si el evento ya pasó y sigue con saldo pendiente,
  la etiqueta ahora muestra el monto exacto:
  🔴 COBRAR $35,000

Mantiene:
- Método del anticipo.
- Movimientos de pago.
- Total recibido en verde.
- Saldo pendiente en rojo.
- Eventos próximos / pasados pendientes.
- Oculta eventos pasados liquidados.

Requiere:
- Tabla event_payments ya creada en Supabase.

Instalación:
1. Subir los 7 archivos a GitHub:
   index.html, app.js, style.css, manifest.json, sw.js, README.txt, topdjs-logo.png
2. Commit: TopDJs CRM v11.4.3 - Cobrar Monto
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
