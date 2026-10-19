# Recordatorios por Teams — Calendarización Carteleras Digitales

Todos los días hábiles a las **6:45** (hora Argentina), GitHub lee las comunicaciones
de Firestore y manda **una tarjeta** a Teams con:

- ⚠️ **Atrasadas**: fecha vencida y sin el tilde de completa.
- ⏰ **Vencen hoy**.
- 🗓️ **Próximas**: las que vencen en los próximos 3 días hábiles (configurable).

Si está todo al día, no manda nada. Fines de semana y feriados tampoco envía.
La página del calendario no se toca: el robot solo **lee** los datos.

```
Calendario web ──► Firestore ◄── GitHub Actions (6:45, lun a vie) ──► Workflow de Teams ──► canal / chat
```

> Los "Incoming Webhooks" (conectores de Office 365) de Teams dejaron de funcionar en
> mayo de 2026. Por eso se usa un **Workflow** de Teams, que es su reemplazo oficial.

---

## 1. Crear el Workflow en Teams (te da la URL donde se mandan los avisos)

1. En Teams, andá al **canal** donde querés recibir los avisos → `···` (más opciones) → **Workflows**.
   - Si preferís un **chat grupal**, es igual: `···` del chat → **Workflows**.
2. Elegí la plantilla **"Enviar alertas de webhook a un canal"**
   (en inglés: *Send webhook alerts to a channel*; para chat: *Send webhook alerts to a chat*).
3. Poné un nombre (ej.: *Recordatorio carteleras*), confirmá equipo y canal → **Agregar flujo de trabajo**.
4. Copiá la **URL** que te muestra al final. Guardala: es la llave para publicar en ese canal,
   así que no la compartas ni la pegues en el código.

## 2. Datos de Firebase

Solo necesitás el **ID del proyecto** (Firebase Console → ⚙️ Configuración del proyecto →
"ID del proyecto"; es el mismo `projectId` de `app.js`).
Las reglas de `firestore.rules` ya permiten la lectura, no hay que cambiar nada.

## 3. Subir los archivos a GitHub

Al repositorio del calendario agregale estos dos archivos, respetando las carpetas:

```
.github/workflows/recordatorios-teams.yml
recordatorios/enviar-recordatorio.mjs
```

> Ojo: la carpeta `.github` empieza con punto y a veces no se sube al arrastrar desde el
> explorador. Si pasa, en GitHub usá **Add file → Create new file**, escribí como nombre
> `.github/workflows/recordatorios-teams.yml` y pegá el contenido.

## 4. Cargar la configuración en GitHub

En el repo: **Settings → Secrets and variables → Actions**.

**Pestaña *Secrets*** → *New repository secret*:

| Nombre | Valor |
|---|---|
| `TEAMS_WEBHOOK_URL` | la URL que copiaste del Workflow |

**Pestaña *Variables*** → *New repository variable*:

| Nombre | Valor | ¿Obligatoria? |
|---|---|---|
| `FIREBASE_PROJECT_ID` | el ID del proyecto de Firebase | Sí |
| `CALENDARIO_URL` | el link del calendario (para el botón "Abrir calendario") | Recomendada |
| `DIAS_AVISO` | cuántos días hábiles de anticipación (por defecto `3`) | No |
| `ENVIAR_SI_VACIO` | `true` si querés el mensaje aunque esté todo al día | No |

## 5. Probar

1. En el repo, pestaña **Actions** → **Recordatorio Teams** → **Run workflow**.
2. Primero tildá **"Solo mostrar la tarjeta en el log"** y ejecutalo: en el log vas a ver
   cuántas comunicaciones leyó y la tarjeta armada, sin mandar nada.
3. Después ejecutalo sin tildar: tiene que llegar la tarjeta a Teams.
4. Para ver cómo se vería otro día, completá el campo de fecha (ej.: `2026-10-23`).

Listo: desde ahí corre solo de lunes a viernes.

---

## Cosas a tener en cuenta

- **Cambiar el horario**: en `recordatorios-teams.yml`, la línea `cron: "45 9 * * 1-5"` está en
  hora UTC (Argentina = UTC − 3). Ej.: para las 9:00 usá `"0 12 * * 1-5"`.
  GitHub puede demorar el disparo entre 5 y 20 minutos.
- **"Fulano usó Workflows para enviar esta tarjeta"**: Teams agrega esa línea al pie.
  Si molesta: abrí el flujo en make.powerautomate.com → *Guardar como* (copia) → usá la URL
  de la copia y borrá el original.
- **El Workflow queda a nombre de quien lo crea.** Si esa cuenta se da de baja, deja de
  andar. Conviene que lo cree alguien estable del equipo (o una cuenta de servicio, si IT tiene).
- **Repos públicos**: GitHub pausa las tareas programadas después de 60 días sin commits.
  Si dejan de llegar los avisos, entrá a Actions y volvé a habilitarlo (o hacé cualquier commit).
- **Feriados**: la lista en `enviar-recordatorio.mjs` llega hasta diciembre 2026, igual que
  `app.js`. Cuando extiendan el calendario a 2027, actualizá ambas.
- **Si IT bloquea Workflows en Teams**: la URL no se va a poder crear; hay que pedir que
  habiliten la app *Workflows* (Power Automate) para el equipo.
