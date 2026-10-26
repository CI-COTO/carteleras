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
- `index.html`, `styles.css`, `app.js`: la página (vistas Calendario, Activas y Registro, formulario, detalle con etapas).
- `firestore.rules`: copia de las reglas de Firestore que están publicadas. Es la fuente de verdad: cualquier cambio de campos, etapas o rango de fechas en `app.js` se refleja acá, y después hay que pegarlas y **Publicar** a mano en Firebase → Firestore Database → Reglas (Claude no puede publicarlas). Al cambiar algo, avisar siempre al usuario que debe publicarlas.
  La regla de fecha es un regex (`d.fecha.matches(...)`) que hoy acepta 2026-01 a 2027-12 (el calendario de la página arranca en octubre de 2026; lo anterior viene de la planilla vieja y se ve en Historial/Activas); al extender el rango hay que tocarlo ahí, en `app.js` (`MESES`, `FECHA_MIN/MAX`), en `index.html` (min/max) y en los feriados del script.
- `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`: ícono de la pestaña (calendario rojo con tilde); se enlazan en el `<head>` de `index.html`.
- `recordatorios/enviar-recordatorio.mjs`: lee Firestore por REST y manda una tarjeta adaptable a Teams. Node 20+, sin dependencias.
- `.github/workflows/recordatorios-teams.yml`: cron de lunes a viernes 7:10 (hora Argentina); el script decide si toca enviar.
- `recordatorios/LEEME.md`: guía de configuración (Workflow de Teams, secrets y variables de GitHub, pruebas).

## Modelo de datos (colección `comunicaciones`)
`titulo`, `archivo` (nombre de archivo sin extensión, obligatorio en el formulario), `fecha` (AAAA-MM-DD, "Fecha de subida": fecha límite para SUBIRLA),
`categoria` (coto, familia, argentinos, innovacion, mas, compromiso), `carteleras` (lista: central, sucursales, logisu; se muestra como "Campaña"),
`descripcion`, `fechaHasta` (AAAA-MM-DD: hasta cuándo debe estar la cartelera; null = "Sin fecha límite", se elige con un check en el formulario) y las etapas en orden obligatorio:
`completa`/`completadaEl` = **Subida**, `publicada`/`publicadaEl` = **Publicada**, `bajada`/`bajadaEl` = **Bajada**.
Destildar una etapa destilda las siguientes y borra sus fechas. Estado actual = la etapa más avanzada tildada, o "Pendiente".
Las comunicaciones viejas pueden no tener `archivo`: se muestra el título en gris.
El campo `vigencia` (estatica, dias, mensual, quincenal) ya no se usa ni se muestra: las comunicaciones viejas pueden conservarlo, por eso `firestore.rules` lo sigue aceptando. Sin `fechaHasta` = "Sin fecha límite".

## Reglas de negocio
- Solo **Subida** genera el cartel PENDIENTE (internamente `estaAtrasada`) y los avisos de Teams. Publicada y Bajada son solo seguimiento.
- Rango de fechas: calendario de octubre de 2026 a diciembre de 2027; las fechas válidas arrancan en enero de 2026 (en `app.js`, `index.html`, `firestore.rules` y la lista de feriados del script). Los no laborables turísticos de 2027 se suman cuando se publiquen.
- Feriados fijos en `app.js` (`FERIADOS`) y copia en `enviar-recordatorio.mjs`: si cambian, actualizar los dos.
- Alerta de Teams: lunes y miércoles; si caen en feriado/no laborable, el siguiente día hábil; sábados y domingos nunca.
  Avisa atrasadas, las de hoy y las de los próximos 7 días corridos (`DIAS_AVISO`). Si no hay nada pendiente, no envía.
  Las ejecuciones manuales (workflow_dispatch) siempre envían.
- Registro (antes "Historial" en el menú principal; internamente `vista = "historial"`): submenú Historial | Gráfico. El Historial es una tabla con Categoría, Campaña, Nombre de archivo, Fecha Desde (= `fecha`), Fecha Hasta ("-" si no tiene fecha límite), Mes, Estado; filtros por Categoría, Campaña, Estado y Mes (varios meses a la vez; el mes sale de la Fecha Desde); se ordena tocando el encabezado de cada columna (por defecto, más reciente primero; las filas sin fecha hasta van al final);
  "Descargar Excel" baja solo lo filtrado y en el orden que se ve en pantalla con el diseño del Excel de referencia (título, encabezado rojo, filas centradas con bordes) usando ExcelJS desde cdnjs (plan B: CSV).
- El Gráfico (dentro de Registro) es el **Resumen de carteleras**, réplica de la estructura del informe de referencia, pero con el diseño de la página (tipografías Oswald/Montserrat, cajas con borde, rojo de Somos Coto en botones y los mismos colores de categoría del calendario): título, desplegable de mes (un mes o Todos, con cantidades; solo afecta a los datos clave, el resumen y los gráficos por categoría, por campaña, tiempo en pantalla y carga), 4 KPIs (piezas, categoría con más piezas, duración mediana, sin Fecha Hasta), resumen en texto con "Copiar resumen" y 7 gráficos de Chart.js (Piezas por mes apiladas por categoría, Por categoría, Por campaña, Tiempo en pantalla por días de vigencia, Cuándo se carga cada pieza, En pantalla hoy y Ya bajadas top 10; los dos últimos no dependen del mes). Cuenta todas las comunicaciones (también las pendientes). Días de vigencia = Fecha Hasta - Fecha Desde + 1. Todos los cuadros se ven por defecto; una fila de botones con el nombre de cada cuadro (Datos clave, Resumen, Piezas por mes, Por categoría, Por campaña, Tiempo en pantalla, Cuándo se carga, Más tiempo en pantalla) los oculta o muestra, y "Ver todo" los muestra a todos (no se guarda entre visitas). "Descargar PDF" (jsPDF) arma el resumen con los cuadros visibles. Chart.js y jsPDF salen de cdnjs con plan B en jsDelivr.
- "DAR DE BAJA": cartel en la barra del calendario cuando está Publicada, no Bajada y pasó `fechaHasta` (sin fecha hasta nunca aparece). Es solo visual: no entra en los avisos de Teams.
- Excel (orden fijo): Categorías, Campaña, Publicación (archivo), Fecha Desde (= `fecha`), Fecha Hasta ("-" si no tiene fecha límite), Mes, Estado, Fecha carga (= `completadaEl`). Con autofiltro y ancho de columna según el texto.
- Pestaña **Activas (N)**: activa = Publicada, no Bajada y dentro de `fechaHasta` (o sin fecha límite); el número cuenta solo esas. La lista muestra arriba las vencidas (cartel DAR DE BAJA, no suman), después las activas por fecha hasta y al final las sin fecha límite. "Dar de baja" pide confirmación en la misma fila y marca `bajada` + `bajadaEl` = hoy.
- Símbolos de etapa: ✓ Subida, ▶ Publicada, ↓ Bajada (barras del calendario y píldora de estado del historial).

## Cómo probar
- Página: servir la carpeta con `python3 -m http.server` y abrir `index.html` (módulos ES: no abre por `file://`). Con `TU_API_KEY` funciona en modo local.
- Alerta: `FIREBASE_PROJECT_ID=... FECHA_HOY=2026-10-19 node recordatorios/enviar-recordatorio.mjs --prueba` imprime la tarjeta sin enviar.

## Pendiente / ideas
- Verificar la configuración real de Firebase si la página dice "Modo local" (la config se pisa al reemplazar `app.js`).
