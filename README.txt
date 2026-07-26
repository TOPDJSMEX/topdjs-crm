TOPDJS CRM v11.4.47 - PDF cliente sin URL del CRM

Cambio principal:
- El PDF para cliente ya no se imprime desde la ventana directa del CRM.
- Ahora se abre desde un documento temporal data:, para evitar que aparezca la dirección topdjs-crm.vercel.app en el pie del PDF.
- Se mantiene el logo original cargado correctamente.
- Aplica para PDF PARA CLIENTE y PDF CLIENTE INGLÉS.

Importante:
- Si el navegador todavía muestra encabezados/pies automáticos, ya no debe exponer la URL interna del CRM.
- Para un PDF totalmente limpio, en el diálogo de impresión conviene dejar desactivados encabezados y pies de página si el navegador lo ofrece.

Mantiene:
- Fix de PDF iluminación sin encimados.
- Calendario George con equipo al click.
- PDF cliente español e inglés.
- Catálogo actualizado con MARTIN SUB CSX 118 bajo MARTIN SUB SXP218.
- GRAVITY STAND en adicionales.

Instalación:
1. Subir los archivos a GitHub.
2. Commit: TopDJs CRM v11.4.47 - PDF cliente sin URL CRM
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
