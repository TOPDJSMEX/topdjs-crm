TOPDJS CRM v11.4.40 - FACTURA OPCIONAL / IVA EN DASHBOARD

Nuevo:
- El cotizador conserva el campo Producción sin IVA.
- Se agrega casilla: Solicita factura (+ IVA 16%).
- Si NO se solicita factura:
  - Dashboard, cobranza, saldo y PDF usan el monto capturado sin IVA.
  - El IVA aparece en $0.
- Si SÍ se solicita factura:
  - El CRM calcula IVA 16%.
  - Dashboard, cobranza, saldo y PDF usan el total con IVA.
- El PDF cliente conserva el formato aprobado, footer @topdjs.mx y 5530260203.

Instalación:
1. Subir estos archivos al repo.
2. Commit: TopDJs CRM v11.4.40 - Factura opcional con IVA en dashboard
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
