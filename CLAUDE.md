# Calendarización Carteleras Digitales — Somos Coto

App web estática (HTML/CSS/JS, sin build) publicada en GitHub Pages: https://ci-coto.github.io/carteleras/
Datos compartidos en Firebase (Firestore). Un recordatorio por Teams corre en GitHub Actions.

## Cómo trabajar acá
- Idioma: español rioplatense (voseo) en la interfaz y en las respuestas. Trato amable y sofisticado.
- Hacer cambios chicos y precisos; probar en el navegador antes de dar algo por terminado.
- **Nunca pisar `firebaseConfig` en `app.js`**: en el repo real tiene las claves reales. Al editar, usar cambios puntuales (Edit), no reescribir el archivo entero ni reemplazarlo por una copia con `TU_API_KEY`.
- No poner secretos en el repo. La URL del Workflow de Teams vive en el secret `TEAMS_WEBHOOK_URL` de GitHub.
- El repo es público (Pages): todo lo que se suba es visible.

## Archivos
- `index.html`, `styles.css`, `app.js`: la página (vistas Calendario e Historial, formulario, detalle con etapas).
- `firestore.rules`: copia de las reglas de Firestore que están publicadas. Es la fuente de verdad: cualquier cambio de campos, etapas o rango de fechas en `app.js` se refleja acá, y después hay que pegarlas y **Publicar** a mano en Firebase → Firestore Database → Reglas (Claude no puede publicarlas). Al cambiar algo, avisar siempre al usuario que debe publicarlas.
  La regla de fecha es un regex (`d.fecha.matches(...)`) que hoy acepta 2026-10 a 2027-12; al extender el rango hay que tocarlo ahí, en `app.js` (`MESES`, `FECHA_MIN/MAX`), en `index.html` (min/max) y en los feriados del script.
- `recordatorios/enviar-recordatorio.mjs`: lee Firestore por REST y manda una tarjeta adaptable a Teams. Node 20+, sin dependencias.
- `.github/workflows/recordatorios-teams.yml`: cron de lunes a viernes 7:10 (hora Argentina); el script decide si toca enviar.
- `recordatorios/LEEME.md`: guía de configuración (Workflow de Teams, secrets y variables de GitHub, pruebas).

## Modelo de datos (colección `comunicaciones`)
`titulo`, `archivo` (nombre de archivo sin extensión, obligatorio en el formulario), `fecha` (AAAA-MM-DD, fecha límite para SUBIRLA),
`categoria` (coto, familia, argentinos, innovacion, mas, compromiso), `carteleras` (lista: central, sucursales, logisu; se muestra como "Campaña"),
`descripcion`, y las etapas en orden obligatorio:
`completa`/`completadaEl` = **Subida**, `publicada`/`publicadaEl` = **Publicada**, `bajada`/`bajadaEl` = **Bajada**.
Destildar una etapa destilda las siguientes y borra sus fechas. Estado actual = la etapa más avanzada tildada, o "Pendiente".
Las comunicaciones viejas pueden no tener `archivo`: se muestra el título en gris.

## Reglas de negocio
- Solo **Subida** genera el cartel ATRASADA y los avisos de Teams. Publicada y Bajada son solo seguimiento.
- Rango de fechas: octubre de 2026 a diciembre de 2027 (en `app.js`, `index.html`, `firestore.rules` y la lista de feriados del script). Los no laborables turísticos de 2027 se suman cuando se publiquen.
- Feriados fijos en `app.js` (`FERIADOS`) y copia en `enviar-recordatorio.mjs`: si cambian, actualizar los dos.
- Alerta de Teams: lunes y miércoles; si caen en feriado/no laborable, el siguiente día hábil; sábados y domingos nunca.
  Avisa atrasadas, las de hoy y las de los próximos 7 días corridos (`DIAS_AVISO`). Si no hay nada pendiente, no envía.
  Las ejecuciones manuales (workflow_dispatch) siempre envían.
- Historial: tabla con Fecha límite, Nombre de archivo, Campaña, Categoría, Estado actual; filtros por Categoría, Campaña y Estado;
  "Descargar Excel" baja solo lo filtrado (con fechas de subida, publicación y bajada, sin el título) con el diseño del Excel de referencia (título, encabezado rojo, filas centradas con bordes) usando ExcelJS desde cdnjs (plan B: CSV).
- Símbolos de etapa: ✓ Subida, ▶ Publicada, ↓ Bajada (barras del calendario y píldora de estado del historial).

## Cómo probar
- Página: servir la carpeta con `python3 -m http.server` y abrir `index.html` (módulos ES: no abre por `file://`). Con `TU_API_KEY` funciona en modo local.
- Alerta: `FIREBASE_PROJECT_ID=... FECHA_HOY=2026-10-19 node recordatorios/enviar-recordatorio.mjs --prueba` imprime la tarjeta sin enviar.

## Pendiente / ideas
- Verificar la configuración real de Firebase si la página dice "Modo local" (la config se pisa al reemplazar `app.js`).
