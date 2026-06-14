TOPDJS CRM v11.4.29 - PENDIENTE CONFIRMACIÓN

Corrección del dashboard:
- La tarjeta PENDIENTE ya no significa pendiente con anticipo.
- PENDIENTE ahora muestra eventos en estado COTIZADO, es decir pendientes de confirmación y sin anticipo.
- La tarjeta COTIZADO TOTAL muestra el total de cotizaciones/eventos activos visibles.
- CONFIRMADO SIN ANTICIPO queda separado.
- CONFIRMADO CON ANTICIPO queda separado.

Estados:
- Cotizado = pendiente de confirmación, sin anticipo.
- Confirmado sin anticipo = ya cerrado, pero sin pago.
- Confirmado con anticipo = ya cerrado y con pago inicial.
- Liquidado = pagado completo.
- Cancelado / Perdido = no cuentan en operación.

Instalación:
1. Subir los 7 archivos a GitHub.
2. Commit: TopDJs CRM v11.4.29 - Pendiente confirmación
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
