/* =========================================================
   Recordatorio diario por Teams — Calendarización Carteleras
   ---------------------------------------------------------
   Lee las comunicaciones de Firestore y manda UNA tarjeta al
   canal/chat de Teams con:
     · las atrasadas (fecha pasada y sin tilde de completa)
     · las que vencen hoy
     · las que vencen en los próximos días hábiles
   Si no hay nada pendiente, no manda nada (para no hacer ruido).

   Lo ejecuta GitHub Actions (ver .github/workflows/recordatorios-teams.yml).
   No necesita instalar dependencias: usa Node 20+.

   Variables de entorno:
     FIREBASE_PROJECT_ID  (obligatoria) id del proyecto de Firebase
     TEAMS_WEBHOOK_URL    (obligatoria salvo en --prueba) URL del Workflow de Teams
     CALENDARIO_URL       (opcional) link al calendario, para el botón "Abrir calendario"
     DIAS_AVISO           (opcional, por defecto 3) cuántos días hábiles hacia adelante avisar
     ENVIAR_SI_VACIO      (opcional, "true"/"false") mandar mensaje aunque esté todo al día
     FECHA_HOY            (opcional, AAAA-MM-DD) simular otro día, útil para probar

   Uso:
     node recordatorios/enviar-recordatorio.mjs            → envía a Teams
     node recordatorios/enviar-recordatorio.mjs --prueba   → solo muestra la tarjeta, no envía
   ========================================================= */

const ZONA_HORARIA = "America/Buenos_Aires";
const COLECCION = "comunicaciones";
const MAX_POR_GRUPO = 15; // para no pasarnos del tamaño máximo de tarjeta de Teams

// Copias de las listas de app.js (si cambian allá, actualizarlas acá también).
const CATEGORIAS = {
  coto:       { label: "Somos Coto",       emoji: "🔴" },
  familia:    { label: "Somos Familia",    emoji: "🟢" },
  argentinos: { label: "Somos Argentinos", emoji: "🔵" },
  innovacion: { label: "Somos Innovación", emoji: "🟠" },
  mas:        { label: "Somos Más",        emoji: "🟡" },
  compromiso: { label: "Somos Compromiso", emoji: "🟣" },
};

const CARTELERAS = {
  central:    "Central",
  sucursales: "Sucursales",
  logisu:     "Logisu (CD)",
};

// Días en que no se manda recordatorio y que no cuentan como hábiles.
const FERIADOS = {
  "2026-10-12": "Día del Respeto a la Diversidad Cultural",
  "2026-11-23": "Día de la Soberanía Nacional",
  "2026-12-07": "Día no laborable con fines turísticos",
  "2026-12-08": "Inmaculada Concepción de María",
  "2026-12-25": "Navidad",
};

/* ---------- Configuración ---------- */

const argumentos = new Set(process.argv.slice(2));
const MODO_PRUEBA = argumentos.has("--prueba") || process.env.MODO_PRUEBA === "true";

const cfg = {
  proyecto: (process.env.FIREBASE_PROJECT_ID || "").trim(),
  webhook: (process.env.TEAMS_WEBHOOK_URL || "").trim(),
  calendario: (process.env.CALENDARIO_URL || "").trim(),
  diasAviso: Math.max(0, Number.parseInt(process.env.DIAS_AVISO || "3", 10) || 0),
  enviarSiVacio: process.env.ENVIAR_SI_VACIO === "true",
  hoy: (process.env.FECHA_HOY || "").trim() || hoyEnArgentina(),
};

/* ---------- Fechas ---------- */

function hoyEnArgentina() {
  // "en-CA" da el formato AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
}

const utc = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const isoDe = (ms) => new Date(ms).toISOString().slice(0, 10);
const sumarDias = (iso, n) => isoDe(utc(iso) + n * 86400000);
const diffDias = (a, b) => Math.round((utc(a) - utc(b)) / 86400000);
const esFinDeSemana = (iso) => [0, 6].includes(new Date(utc(iso)).getUTCDay());
const esHabil = (iso) => !esFinDeSemana(iso) && !FERIADOS[iso];

function enDiasHabiles(desde, n) {
  let f = desde;
  let contados = 0;
  while (contados < n) {
    f = sumarDias(f, 1);
    if (esHabil(f)) contados++;
  }
  return f;
}

const fmtCorta = (iso) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
const fmtLarga = (iso) =>
  new Date(utc(iso)).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
const diaSemana = (iso) =>
  new Date(utc(iso)).toLocaleDateString("es-AR", { weekday: "long", timeZone: "UTC" });
const plural = (n, uno, otros) => `${n} ${n === 1 ? uno : otros}`;

/* ---------- Firestore (API REST, lectura pública según firestore.rules) ---------- */

function valor(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(valor);
  if ("mapValue" in v) {
    return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, valor(x)]));
  }
  return null;
}

async function leerComunicaciones() {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.proyecto)}` +
    `/databases/(default)/documents/${COLECCION}`;
  const docs = [];
  let pagina = "";

  do {
    const url = new URL(base);
    url.searchParams.set("pageSize", "300");
    if (pagina) url.searchParams.set("pageToken", pagina);

    const res = await fetch(url);
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => "");
      throw new Error(`Firestore respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
    }
    const data = await res.json();
    for (const d of data.documents || []) {
      const campos = Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, valor(v)]));
      docs.push({ id: d.name.split("/").pop(), ...campos });
    }
    pagina = data.nextPageToken || "";
  } while (pagina);

  return docs;
}

/* ---------- Clasificación ---------- */

const esValida = (i) =>
  i && typeof i.titulo === "string" && typeof i.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.fecha);

function clasificar(items) {
  const limite = enDiasHabiles(cfg.hoy, cfg.diasAviso);
  const pendientes = items.filter((i) => esValida(i) && !i.completa);
  const porFecha = (a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo, "es");

  return {
    limite,
    atrasadas: pendientes.filter((i) => i.fecha < cfg.hoy).sort(porFecha),
    hoy: pendientes.filter((i) => i.fecha === cfg.hoy).sort(porFecha),
    proximas: cfg.diasAviso > 0
      ? pendientes.filter((i) => i.fecha > cfg.hoy && i.fecha <= limite).sort(porFecha)
      : [],
  };
}

/* ---------- Tarjeta adaptable de Teams ---------- */

function textoCarteleras(i) {
  const lista = Array.isArray(i.carteleras) ? i.carteleras : [];
  return Object.keys(CARTELERAS).filter((k) => lista.includes(k)).map((k) => CARTELERAS[k]).join(" / ");
}

function cuandoVence(i) {
  const d = diffDias(i.fecha, cfg.hoy);
  if (d < 0) return `Venció el ${fmtCorta(i.fecha)} · ${plural(-d, "día", "días")} de atraso`;
  if (d === 0) return "Vence hoy";
  if (d === 1) return `Vence mañana (${fmtCorta(i.fecha)})`;
  return `Vence el ${diaSemana(i.fecha)} ${fmtCorta(i.fecha)} · en ${d} días`;
}

function filaItem(i) {
  const cat = CATEGORIAS[i.categoria] || { label: "Sin categoría", emoji: "⚪" };
  const carteleras = textoCarteleras(i);
  return {
    type: "Container",
    spacing: "Small",
    items: [
      { type: "TextBlock", text: `${cat.emoji} **${i.titulo}**`, wrap: true },
      {
        type: "TextBlock",
        text: [cuandoVence(i), cat.label, carteleras].filter(Boolean).join(" · "),
        wrap: true, isSubtle: true, size: "Small", spacing: "None",
      },
    ],
  };
}

function seccion(titulo, estilo, lista) {
  if (!lista.length) return [];
  const visibles = lista.slice(0, MAX_POR_GRUPO);
  const resto = lista.length - visibles.length;
  return [{
    type: "Container",
    style: estilo,
    bleed: true,
    spacing: "Medium",
    items: [
      { type: "TextBlock", text: `${titulo} (${lista.length})`, weight: "Bolder", size: "Medium" },
      ...visibles.map(filaItem),
      ...(resto > 0
        ? [{ type: "TextBlock", text: `… y ${plural(resto, "más", "más")}. Miralas en el calendario.`, isSubtle: true, wrap: true }]
        : []),
    ],
  }];
}

function armarTarjeta(g) {
  const total = g.atrasadas.length + g.hoy.length + g.proximas.length;
  const fechaTitulo = fmtLarga(cfg.hoy);
  const fechaCap = fechaTitulo.charAt(0).toUpperCase() + fechaTitulo.slice(1);

  const resumen = total === 0
    ? "Todo al día: no hay comunicaciones pendientes para estos días. ✅"
    : [
        g.atrasadas.length ? plural(g.atrasadas.length, "atrasada", "atrasadas") : null,
        g.hoy.length ? `${g.hoy.length} para hoy` : null,
        g.proximas.length ? `${g.proximas.length} en los próximos ${plural(cfg.diasAviso, "día hábil", "días hábiles")}` : null,
      ].filter(Boolean).join(" · ");

  const body = [
    { type: "TextBlock", text: "📅 Carteleras digitales · Recordatorio", weight: "Bolder", size: "Large", wrap: true },
    { type: "TextBlock", text: fechaCap, isSubtle: true, spacing: "None", wrap: true },
    { type: "TextBlock", text: resumen, wrap: true, spacing: "Medium" },
    ...seccion("⚠️ Atrasadas", "attention", g.atrasadas),
    ...seccion("⏰ Vencen hoy", "warning", g.hoy),
    ...seccion("🗓️ Próximas", "accent", g.proximas),
  ];

  const actions = cfg.calendario
    ? [{ type: "Action.OpenUrl", title: "Abrir calendario", url: cfg.calendario }]
    : [];

  return {
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      contentUrl: null,
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        msteams: { width: "Full" },
        body,
        actions,
      },
    }],
  };
}

/* ---------- Envío ---------- */

async function enviarATeams(payload) {
  const res = await fetch(cfg.webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    throw new Error(`Teams respondió ${res.status}: ${cuerpo.slice(0, 300)}`);
  }
}

/* ---------- Principal ---------- */

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.hoy)) throw new Error(`FECHA_HOY inválida: "${cfg.hoy}"`);
  if (!cfg.proyecto) throw new Error("Falta FIREBASE_PROJECT_ID.");
  if (!MODO_PRUEBA && !cfg.webhook) throw new Error("Falta TEAMS_WEBHOOK_URL (o usá --prueba).");

  if (!esHabil(cfg.hoy) && !MODO_PRUEBA) {
    console.log(`Hoy (${cfg.hoy}) no es día hábil: no se envía recordatorio.`);
    return;
  }

  const items = await leerComunicaciones();
  const grupos = clasificar(items);
  const total = grupos.atrasadas.length + grupos.hoy.length + grupos.proximas.length;

  console.log(
    `Hoy: ${cfg.hoy} · comunicaciones leídas: ${items.length} · ` +
    `atrasadas: ${grupos.atrasadas.length} · hoy: ${grupos.hoy.length} · ` +
    `próximas (hasta ${grupos.limite}): ${grupos.proximas.length}`
  );

  if (total === 0 && !cfg.enviarSiVacio) {
    console.log("No hay nada pendiente: no se envía mensaje.");
    return;
  }

  const payload = armarTarjeta(grupos);

  if (MODO_PRUEBA) {
    console.log("MODO PRUEBA — no se envió nada. Tarjeta generada:");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  await enviarATeams(payload);
  console.log("Recordatorio enviado a Teams.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
