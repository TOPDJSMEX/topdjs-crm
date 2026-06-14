TOPDJS CRM v11.4.28 - PENDIENTE CONFIRMADO AJUSTADO

Cambio:
- La tarjeta Pendiente ya no suma los eventos Confirmados sin anticipo.
- Los eventos Confirmados sin anticipo se cuentan únicamente en su propia tarjeta.
- La tarjeta ahora se llama Pendiente con anticipo y solo suma saldos de eventos Confirmados con anticipo.

Dashboard actualizado:
- Cotizado no confirmado: monto potencial no cerrado.
- Confirmado sin anticipo: eventos cerrados sin pago recibido.
- Confirmado con anticipo: eventos cerrados con algún pago recibido.
- Pendiente con anticipo: saldo por cobrar de eventos que ya dieron anticipo.
- Vencido: saldos de eventos confirmados que ya pasaron.

Mantiene:
- Estados comerciales.
- Fecha Día/Mes/Año.
- Clientes acciones alineadas.
- Calendario anual con años.
- Gastos por evento.

Instalación:
1. Subir los 7 archivos a GitHub.
2. Commit: TopDJs CRM v11.4.28 - Pendiente confirmado ajustado
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
