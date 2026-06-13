TOPDJS CRM v11.4.1 - ANTICIPO CON MÉTODO + COBRANZA

Requiere tabla Supabase event_payments:

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
- En cotizador agrega MÉTODO DEL ANTICIPO:
  Efectivo, NU, BBVA, Manuel.
- Si el anticipo es mayor a 0 y se selecciona método,
  crea automáticamente el primer movimiento de pago:
  Anticipo inicial.
- En VER EVENTO:
  Total recibido aparece en verde.
  Saldo pendiente aparece en rojo.
- Mantiene eventos operativos:
  próximos visibles,
  pasados no liquidados visibles,
  pasados liquidados ocultos.

Instalación:
1. Crear event_payments en Supabase si aún no existe.
2. Subir 7 archivos a GitHub.
3. Commit: TopDJs CRM v11.4.1 - Anticipo Metodo
4. Deploy to Production en Vercel.
5. Recarga fuerte: Option + Command + R.
