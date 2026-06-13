TOPDJS CRM v11.4 - COBRANZA + EVENTOS OPERATIVOS

IMPORTANTE: antes de usar pagos, crear tabla en Supabase:

create table if not exists public.event_payments (
  id uuid primary key default gen_random_uuid(),
  record_local_id text not null,
  payment_date date,
  amount numeric default 0,
  method text,
  note text,
  created_at timestamptz default now()
);

Nuevo:
- Movimientos de pago por evento.
- Métodos:
  1 Efectivo
  2 NU
  3 BBVA
  4 Manuel
- Botón PAGO en Cotizaciones/Eventos.
- Sección MOVIMIENTOS DE PAGO dentro de VER EVENTO.
- Total recibido y saldo se calculan desde los pagos.
- Registra bitácora al agregar/eliminar pagos.
- Eventos Operativos:
  próximos visibles,
  pasados con saldo pendiente visibles,
  pasados liquidados ocultos de la vista principal.

Instalación:
1. Ejecutar SQL de event_payments en Supabase.
2. Subir estos 7 archivos:
   index.html, app.js, style.css, manifest.json, sw.js, README.txt, topdjs-logo.png
3. Commit: TopDJs CRM v11.4 - Cobranza Eventos
4. Desplegar en Vercel.
5. Recarga fuerte: Option + Command + R.
