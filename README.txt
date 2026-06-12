TOPDJS CRM v9.2 - DELETE FIX

Corrección:
- El botón BORRAR ahora elimina directamente de Supabase usando local_id.
- Al sincronizar, si un registro ya no existe en Supabase, se quita también de la app local.
- BORRAR funciona para cotizaciones/eventos y contactos.
- Si no hay internet, avisa que el borrado no puede completarse globalmente.

Cómo probar:
1. Abrir con servidor local:
   python3 -m http.server 3000
2. Entrar a:
   http://localhost:3000
3. Borrar un registro.
4. En otra computadora presionar SINCRONIZAR.
5. Debe desaparecer.
