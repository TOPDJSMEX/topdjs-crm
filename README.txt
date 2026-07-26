TOPDJS CRM v11.4.48 - FIX PDF CLIENTE ABRE CORRECTO

Correccion:
- Se corrige el problema donde el PDF del cliente abria una ventana en blanco.
- La causa era la apertura como data URL agregada para ocultar la URL del CRM; Safari puede bloquear o dejar en blanco esa vista.
- Ahora el PDF cliente vuelve a abrirse correctamente en una ventana generada.
- Se mantiene el logo con URL absoluta para que cargue bien.

Mantiene:
- PDF cliente español e ingles.
- Fix de iluminacion sin encimados.
- Calendario George con equipo al click.
- Catalogo CSX118 / Gravity.

Nota:
- Si al guardar como PDF el navegador muestra encabezados/pies automáticos, desactiva “Headers and Footers / Encabezados y pies” en el dialogo de impresion. El contenido del PDF no incluye la URL del CRM.

Instalacion:
1. Subir los archivos a GitHub.
2. Commit: TopDJs CRM v11.4.48 - Fix PDF cliente abre correcto
3. Deploy to Production en Vercel.
4. Recarga fuerte: Option + Command + R.
