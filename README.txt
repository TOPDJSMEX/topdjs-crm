TOPDJS CRM v11.4.5 - GASTOS POR EVENTO

Nuevo sobre v11.4.4 Dashboard Real:
- Se agrega módulo de Gastos del Evento dentro del detalle de cada evento.
- El staff se calcula automáticamente desde el cotizador:
  Ing. audio = $1,800 por persona
  Ing. iluminación/video = $1,500 por persona
  Stage hands = $1,250 por persona
- Se agrega Montaje día anterior: personas x $750.
- Se agregan campos manuales:
  Extras montaje
  Extras staff
  Planta de luz
  DJs
- Se agrega sección Varios / Otros gastos con múltiples filas:
  concepto, descripción y monto.
- Se calculan:
  Staff
  Planta de luz
  DJs
  Varios
  Total gastos
  Utilidad real = cobrado - gastos
  Utilidad proyectada = cotizado - gastos
- Los gastos se guardan en topdjs_records.expenses_jsonb.
- Se renombra en cotizador: ING ILUMINACION -> ING ILUMINACION/VIDEO.

Mantiene:
- Dashboard real de cobranza.
- Pagos y métodos de pago.
- Eventos operativos.
- Historial / bitácora.
- Archivos de evento.
- Pedido de bodega PDF.
- Estilo Black Neon.

Requiere en Supabase:
alter table topdjs_records
add column if not exists expenses_jsonb jsonb default '{}'::jsonb;

Instalación:
1. Subir los 7 archivos:
   index.html, app.js, style.css, manifest.json, sw.js, README.txt, topdjs-logo.png
2. Commit: TopDJs CRM v11.4.5 - Gastos por Evento
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
5. Abrir un evento, capturar gastos y probar que se guarden al cerrar y volver a abrir.
