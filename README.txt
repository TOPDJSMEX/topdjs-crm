TOPDJS CRM v11.4.50 - PORTAL MANUEL CON EQUIPO TOPDJS

Nuevo:
- En manuel.html Manuel puede seleccionar equipo propio y equipo de TopDJs/Carlos.
- El portal mantiene dos bloques: Equipo de Manuel y Equipo TopDJs / Carlos.
- Todo lo seleccionado se guarda en el evento como quote_catalog, sin costos.
- George lo ve en george.html al dar click en el evento, separado por rubro y con etiqueta MANUEL o TOPDJS en cada equipo.

Manuel NO tiene acceso a:
- Dashboard de cobranza.
- Montos, anticipos, saldos o utilidad.
- CRM completo.

Links después del deploy:
Portal Manuel:
https://topdjs-crm.vercel.app/manuel.html

Calendario George:
https://topdjs-crm.vercel.app/george.html

Mantiene:
- PDF cliente español e inglés corregido.
- Fix PDF cliente abre correcto.
- Fix PDF iluminación sin encimados.
- George con equipo al click.
- Catálogo actualizado con MARTIN SUB CSX 118 bajo MARTIN SUB SXP218.
- GRAVITY STAND en adicionales.
- Estados comerciales, calendario, cobranza, gastos, clientes y pedido de bodega.

Nota:
- Esto separa acceso a nivel interfaz. Para seguridad real por usuario/contraseña se requiere Supabase Auth + RLS.

Instalación:
1. Subir los archivos a GitHub.
2. Commit: TopDJs CRM v11.4.50 - Portal Manuel con equipo TopDJs
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
