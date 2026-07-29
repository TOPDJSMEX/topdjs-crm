TOPDJS CRM v11.4.51 - PORTAL MANUEL INVENTARIO CORREGIDO

Cambio principal:
- Se corrigió el inventario propio de Manuel en manuel.html.
- Se quitaron de equipo de Manuel:
  - MARTIN SUB CSX 118
  - MARTIN FLEXPOINT FP8
- Esos equipos pueden seguir disponibles como equipo TopDJs, pero ya no aparecen como inventario propio de Manuel.

Inventario Manuel actualizado:
AUDIO:
- AXIOM AX12C
- AXIOM AX6C
- AXIOM SUB SW2100A
- HK POLAR 12

CABINA Y DJ:
- PIONEER XDJ XZ

ILUMINACIÓN:
- BEAM STEEL PRO
- SUNSTAR ORACLE LASER 3W

VIDEO:
- PANTALLA LED 3X2
- PANTALLA LG 70”
- SWITCHER LIVE PRO

Mantiene:
- Portal Manuel sin dashboard de cobranza.
- Manuel puede seleccionar equipo propio y equipo TopDJs.
- George ve los eventos de Manuel en george.html.
- George puede dar click al evento y ver equipo seleccionado.
- PDF cliente español e inglés corregido.
- Fix PDF cliente abre correcto.
- Fix PDF iluminación sin encimados.
- Catálogo TopDJs con MARTIN SUB CSX 118 bajo MARTIN SUB SXP218.
- GRAVITY STAND en adicionales.

Portal Manuel después del deploy:
https://topdjs-crm.vercel.app/manuel.html

Calendario George después del deploy:
https://topdjs-crm.vercel.app/george.html

Nota:
- Esto separa el acceso a nivel interfaz. Para seguridad real por usuario/contraseña se requiere Supabase Auth + RLS.

Instalación:
1. Subir los archivos a GitHub.
2. Commit: TopDJs CRM v11.4.51 - Portal Manuel inventario corregido
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
