# Recordatorios por Teams — Calendarización Carteleras Digitales

Los **lunes y miércoles** (alrededor de las **7:15**, hora Argentina), GitHub lee las
comunicaciones de Firestore y manda **una tarjeta** a Teams con lo que todavía **no está subida**:

- ⚠️ **Atrasadas**: la fecha límite ya pasó.
- ⏰ **Vencen hoy**.
- 🗓️ **Próximas**: las que vencen en los próximos **7 días corridos**.

Reglas:
- Solo cuenta el tilde de **Subida**. **Publicada** y **Bajada** son seguimiento y no generan avisos.
- Si el lunes o el miércoles es **feriado / no laborable**, el aviso se corre al **siguiente día hábil**
  (ej.: lunes 23/11 feriado → sale el martes 24/11). Sábados y domingos nunca.
- Si está todo al día, no manda nada.

```
Calendario web ──► Firestore ◄── GitHub Actions (días hábiles 7:10) ──► Workflow de Teams ──► canal / chat
```

> Los "Incoming Webhooks" (conectores de Office 365) de Teams dejaron de funcionar en
> mayo de 2026. Por eso se usa un **Workflow** de Teams, que es su reemplazo oficial.

---

## Cómo actualizar a esta versión (si ya tenías la anterior andando)

1. **Reglas de Firestore (obligatorio, hacerlo primero):** Firebase Console → Firestore Database →
   pestaña **Reglas** → reemplazá todo por el contenido de `firestore.rules` → **Publicar**.
   Sin esto, la página no puede guardar los campos nuevos (nombre de archivo y etapas).
2. **Archivos en GitHub:** reemplazá `index.html`, `app.js`, `styles.css`, `firestore.rules`,
   `recordatorios/enviar-recordatorio.mjs` y `.github/workflows/recordatorios-teams.yml`.
3. **Variable `DIAS_AVISO`:** si la habías creado con otro valor (ej.: `3`), borrala o ponela en `7`.
   Si no existe, ya usa 7 por defecto.

Los datos que ya cargaste siguen funcionando: lo que estaba "completa" ahora figura como **Subida**,
y las comunicaciones viejas muestran su título en gris en el historial hasta que les cargues el
nombre de archivo (con **Editar**).

---

## Configuración inicial (solo la primera vez)

### 1. Crear el Workflow en Teams (te da la URL donde se mandan los avisos)

1. En Teams, andá al **canal** donde querés recibir los avisos → `···` → **Flujos de trabajo** (Workflows).
   Si no ves la plantilla, tocá **Crear flujos de trabajo** y buscá **webhook**.
2. Elegí la plantilla **"Enviar alertas de webhook a un canal"** (la que **no** dice "de personas
   específicas" ni "de una organización"). Para un chat grupal, la versión "…a un chat".
3. Poné un nombre (ej.: *Recordatorio carteleras*), confirmá equipo y canal → **Guardar**.
4. Copiá la **URL** de la pantalla de detalle. Es la llave para publicar en ese canal: no la compartas.

### 2. Cargar la configuración en GitHub

En el repo: **Settings → Secrets and variables → Actions**.

**Pestaña *Secrets*** → *New repository secret*:

| Nombre | Valor |
|---|---|
| `TEAMS_WEBHOOK_URL` | la URL que copiaste del Workflow |

**Pestaña *Variables*** → *New repository variable*:

| Nombre | Valor | ¿Obligatoria? |
|---|---|---|
| `FIREBASE_PROJECT_ID` | el ID del proyecto de Firebase (el mismo `projectId` de `app.js`) | Sí |
| `CALENDARIO_URL` | el link del calendario (botón "Abrir calendario") | Recomendada |
| `DIAS_AVISO` | días corridos de anticipación (por defecto `7`) | No |
| `ENVIAR_SI_VACIO` | `true` si querés el mensaje aunque esté todo al día | No |

### 3. Probar

**Actions → Recordatorio Teams → Run workflow.** Las ejecuciones manuales **siempre envían**,
sea el día que sea (el filtro de lunes/miércoles solo rige para el horario automático).

- Tildá **"Solo mostrar la tarjeta en el log"** para ver qué mandaría sin enviar nada.
- Completá la fecha (AAAA-MM-DD) para simular otro día.

---

## Cosas a tener en cuenta

- **Horario**: la línea `cron: "10 10 * * 1-5"` está en hora UTC (Argentina = UTC − 3), o sea 7:10.
  GitHub suele demorar el disparo unos minutos, por eso el aviso llega cerca de las 7:15.
  El workflow corre todos los días hábiles y el script decide si toca enviar (lunes, miércoles o
  el día hábil que reemplaza a un feriado), así no hay que tocar el cron para los feriados.
- **Feriados**: la lista de `enviar-recordatorio.mjs` llega hasta diciembre 2027, igual que `app.js`.
  Los días no laborables con fines turísticos de 2027 se suman a ambas cuando se publiquen (y la regla de fechas de `firestore.rules` llega hasta 2027-12-31).
- **"Fulano usó Workflows para enviar esta tarjeta"**: Teams agrega esa línea al pie. Si molesta:
  abrí el flujo en make.powerautomate.com → *Guardar como* (copia) → usá la URL de la copia.
- **El Workflow queda a nombre de quien lo crea.** Si esa cuenta se da de baja, deja de andar.
- **Repos públicos**: GitHub pausa las tareas programadas tras 60 días sin actividad. Si dejan de
  llegar los avisos, entrá a Actions y volvé a habilitarlo (o hacé cualquier commit).
- **Excel del historial**: usa la librería SheetJS desde cdnjs. Si el navegador no puede cargarla
  (red corporativa que la bloquea), descarga un CSV, que también abre en Excel.
