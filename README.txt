TOPDJS CRM v11.4.43 - CALENDARIO OPERATIVO GEORGE SIN COSTOS

Nuevo:
- Agrega en el calendario botones para George / bodega / operación:
  - ENVIAR A GEORGE
  - PDF / IMPRIMIR SIN COSTOS
  - VISTA GEORGE
- La vista y los reportes incluyen eventos confirmados y pendientes.
- Excluye eventos cancelados y perdidos.
- No muestra montos, anticipos, saldos, costos ni utilidad.
- Incluye datos operativos: fecha, cliente, proyecto, venue, pax, horarios, montaje, equipo seleccionado del cotizador y observaciones.
- Agrega george.html como vista operativa independiente para compartir a George.
- Actualiza cache del service worker a v11.4.43.

Se mantiene:
- PDF cliente español e inglés.
- Inventario agregado: MARTIN SUB CSX 118 debajo de MARTIN SUB SXP218.
- GRAVITY STAND en adicionales.
- Dashboard, cobranza, gastos por evento, calendario y pedido de bodega.

Instalación:
1. Subir los 8 archivos a GitHub.
2. Commit: TopDJs CRM v11.4.43 - Calendario operativo George sin costos
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.

Nota de seguridad:
- Esta versión oculta costos en la vista y exportes operativos.
- Para seguridad estricta a nivel base de datos, se puede crear después una vista/RLS en Supabase que entregue únicamente campos operativos.
