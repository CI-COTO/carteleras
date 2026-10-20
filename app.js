/* =========================================================
   Calendarización Carteleras Digitales — Somos Coto
   ---------------------------------------------------------
   1) Pegá tu configuración de Firebase en `firebaseConfig`.
      Mientras diga "TU_API_KEY", la app funciona en MODO LOCAL
      (los datos se guardan solo en este navegador).
   2) Publicá las reglas de `firestore.rules` en Firebase.
   ========================================================= */

const firebaseConfig = {
 apiKey: "AIzaSyDjwOMahzo3jvxkSLShUV4YR4lXpnh26Jg",
  authDomain: "calendario-cartelera.firebaseapp.com",
  projectId: "calendario-cartelera",
  storageBucket: "calendario-cartelera.firebasestorage.app",
  messagingSenderId: "360395549011",
  appId: "1:360395549011:web:b9af6933d54f1fcea359a6"
};

const FIREBASE_VERSION = "10.12.2";
const COLLECTION = "comunicaciones";
const EXCELJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";

/* ---------- Datos fijos ---------- */

const CATEGORIAS = {
  coto:       { label: "Somos Coto",       bg: "#E8473A", fg: "#ffffff" },
  familia:    { label: "Somos Familia",    bg: "#4FA83F", fg: "#ffffff" },
  argentinos: { label: "Somos Argentinos", bg: "#5BC0E3", fg: "#06303f" },
  innovacion: { label: "Somos Innovación", bg: "#F47B2A", fg: "#2b1300" },
  mas:        { label: "Somos Más",        bg: "#FDD835", fg: "#3b3000" },
  compromiso: { label: "Somos Compromiso", bg: "#6B4A8A", fg: "#ffffff" },
};

// Se llamaba "Carteleras destino"; ahora se muestra como "Campaña".
// Las claves internas (campo `carteleras`) no cambian, así los datos viejos siguen funcionando.
const CARTELERAS = {
  central:    "Central",
  sucursales: "Sucursales",
  logisu:     "Logisu (CD)",
};

// Etapas de una cartelera, en orden obligatorio.
// `completa` / `completadaEl` es la etapa "Subida" (así se llamaba antes el tilde único).
const ETAPAS = [
  { key: "completa",  fecha: "completadaEl", nombre: "Subida",    pendiente: "Pendiente de subir.",    bloqueo: null },
  { key: "publicada", fecha: "publicadaEl",  nombre: "Publicada", pendiente: "Pendiente de publicar.", bloqueo: "Se habilita cuando esté subida." },
  { key: "bajada",    fecha: "bajadaEl",     nombre: "Bajada",    pendiente: "Pendiente de bajar.",    bloqueo: "Se habilita cuando esté publicada." },
];
const ESTADOS = ["Pendiente", "Subida", "Publicada", "Bajada"];
// Cuánto tiempo tiene que estar publicada. "Estática" no vence nunca; las demás tienen "Fecha hasta".
const VIGENCIAS = { estatica: "Estática", dias: "Días", mensual: "Mensual", quincenal: "Quincenal" };
// Símbolo de cada etapa (se ve en las barras del calendario y en el historial)
const ICONOS = { Subida: "✓", Publicada: "▶", Bajada: "↓" };

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// De octubre de 2026 a diciembre de 2027
const MESES = Array.from({ length: 15 }, (_, i) => {
  const n = 9 + i;
  return { year: 2026 + Math.floor(n / 12), month: n % 12, name: NOMBRES_MES[n % 12] };
});
const FECHA_MIN = "2026-10-01";
const FECHA_MAX = "2027-12-31";

// Feriados y días no laborables (Argentina, 2026). Fijos: no se editan.
const FERIADOS = {
  "2026-10-12": { tipo: "Feriado",      nombre: "Día del Respeto a la Diversidad Cultural" },
  "2026-11-23": { tipo: "Feriado",      nombre: "Día de la Soberanía Nacional (trasladado del 20/11)" },
  "2026-12-07": { tipo: "No laborable", nombre: "Día no laborable con fines turísticos" },
  "2026-12-08": { tipo: "Feriado",      nombre: "Inmaculada Concepción de María" },
  "2026-12-25": { tipo: "Feriado",      nombre: "Navidad" },
  // 2027 (los días no laborables con fines turísticos se suman cuando se publiquen)
  "2027-01-01": { tipo: "Feriado",      nombre: "Año Nuevo" },
  "2027-02-08": { tipo: "Feriado",      nombre: "Carnaval" },
  "2027-02-09": { tipo: "Feriado",      nombre: "Carnaval" },
  "2027-03-24": { tipo: "Feriado",      nombre: "Día Nacional de la Memoria por la Verdad y la Justicia" },
  "2027-03-25": { tipo: "No laborable", nombre: "Jueves Santo" },
  "2027-03-26": { tipo: "Feriado",      nombre: "Viernes Santo" },
  "2027-04-02": { tipo: "Feriado",      nombre: "Día del Veterano y de los Caídos en la Guerra de Malvinas" },
  "2027-05-25": { tipo: "Feriado",      nombre: "Día de la Revolución de Mayo" },
  "2027-06-21": { tipo: "Feriado",      nombre: "Paso a la Inmortalidad del Gral. Güemes (trasladado del 17/6)" },
  "2027-07-09": { tipo: "Feriado",      nombre: "Día de la Independencia" },
  "2027-08-16": { tipo: "Feriado",      nombre: "Paso a la Inmortalidad del Gral. San Martín (trasladado del 17/8)" },
  "2027-10-11": { tipo: "Feriado",      nombre: "Día del Respeto a la Diversidad Cultural (trasladado del 12/10)" },
  "2027-12-08": { tipo: "Feriado",      nombre: "Inmaculada Concepción de María" },
};

// Carga inicial (tomada del PDF original). Se crea una sola vez.
const SEMILLA = [
  { id: "seed-bonda",         titulo: "BONDA",                fecha: "2026-10-01", categoria: "argentinos", carteleras: ["central"] },
  { id: "seed-octubre-rosa",  titulo: "Octubre Rosa",         fecha: "2026-10-05", categoria: "coto",       carteleras: ["central"] },
  { id: "seed-sportclub",     titulo: "SportClub",            fecha: "2026-10-06", categoria: "argentinos", carteleras: ["central"] },
  { id: "seed-convenios-edu", titulo: "Convenios Educativos", fecha: "2026-10-07", categoria: "compromiso", carteleras: ["sucursales"] },
  { id: "seed-dia-madre",     titulo: "Día de la Madre",      fecha: "2026-10-16", categoria: "familia",    carteleras: ["central", "sucursales"] },
  { id: "seed-carnicero",     titulo: "Día del Carnicero",    fecha: "2026-10-19", categoria: "mas",        carteleras: ["sucursales"] },
].map((s) => ({
  descripcion: "", archivo: "",
  completa: false, completadaEl: null,
  publicada: false, publicadaEl: null,
  bajada: false, bajadaEl: null,
  ...s,
}));

/* ---------- Utilidades de fecha ---------- */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, "0");
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const hoyISO = () => {
  const t = new Date();
  return toISO(t.getFullYear(), t.getMonth(), t.getDate());
};
const utc = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const diffDias = (a, b) => Math.round((utc(a) - utc(b)) / 86400000);
const fmtCorta = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const fmtOpc = (iso) => (typeof iso === "string" && ISO_RE.test(iso) ? fmtCorta(iso) : "");
const fmtLarga = (iso) =>
  new Date(utc(iso)).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
const desdeUTC = (ms) => {
  const d = new Date(ms);
  return toISO(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const sumarDias = (iso, n) => desdeUTC(utc(iso) + n * 86400000);
// Mismo día del mes siguiente (si no existe, el último día de ese mes)
const sumarMes = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return desdeUTC(Date.UTC(y, m, Math.min(d, ultimo)));
};
const plural = (n, uno, otros) => `${n} ${n === 1 ? uno : otros}`;

/* ---------- Helpers de DOM (siempre textContent: sin inyección de HTML) ---------- */

const $ = (sel) => document.querySelector(sel);

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.setAttribute("style", v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// El estado que informa la conexión con la base; si el navegador no tiene internet, manda "Sin conexión".
let estadoBase = { mode: "", text: "" };

function pintarEstado() {
  const s = $("#status");
  const sinRed = !navigator.onLine;
  s.dataset.mode = sinRed ? "error" : estadoBase.mode;
  s.textContent = sinRed ? "Sin conexión" : estadoBase.text;
}

function setStatus(mode, text) {
  estadoBase = { mode, text };
  pintarEstado();
}

window.addEventListener("online", pintarEstado);
window.addEventListener("offline", pintarEstado);

/* ---------- Almacenamiento: Firebase o modo local ---------- */

const quitarId = ({ id, ...resto }) => resto;

async function crearStoreFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const [{ initializeApp }, fs] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, getDoc } = fs;

  const db = getFirestore(initializeApp(firebaseConfig));
  const col = collection(db, COLLECTION);

  // Carga inicial: una sola vez (los ids fijos evitan duplicados si dos personas abren a la vez).
  const metaRef = doc(db, "meta", "init");
  const meta = await getDoc(metaRef);
  if (!meta.exists()) {
    await Promise.all(SEMILLA.map((s) => setDoc(doc(db, COLLECTION, s.id), quitarId(s))));
    await setDoc(metaRef, { sembrado: true });
  }

  return {
    modo: "firebase",
    subscribe(cb, onError) {
      return onSnapshot(
        col,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        onError
      );
    },
    add: (data) => addDoc(col, data),
    update: (id, data) => updateDoc(doc(db, COLLECTION, id), data),
    remove: (id) => deleteDoc(doc(db, COLLECTION, id)),
  };
}

function crearStoreLocal() {
  const KEY = "carteleras-calendario:v1";
  const oyentes = new Set();
  let items;

  const leer = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* almacenamiento no disponible */ }
    return null;
  };
  const guardar = () => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_) { /* ignorar */ }
    oyentes.forEach((cb) => cb(items.slice()));
  };

  items = leer() ?? SEMILLA.map((s) => ({ ...s }));

  return {
    modo: "local",
    subscribe(cb) {
      oyentes.add(cb);
      cb(items.slice());
      return () => oyentes.delete(cb);
    },
    async add(data) {
      items.push({ id: "loc-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
      guardar();
    },
    async update(id, data) {
      items = items.map((i) => (i.id === id ? { ...i, ...data } : i));
      guardar();
    },
    async remove(id) {
      items = items.filter((i) => i.id !== id);
      guardar();
    },
  };
}

async function crearStore() {
  const configurado = !firebaseConfig.apiKey.startsWith("TU_");
  if (!configurado) {
    setStatus("local", "Modo local");
    return crearStoreLocal();
  }
  try {
    const store = await crearStoreFirebase();
    setStatus("firebase", "En línea");
    return store;
  } catch (err) {
    console.error("No se pudo conectar con Firebase:", err);
    setStatus("error", "Sin conexión");
    return crearStoreLocal();
  }
}

/* ---------- Estado ---------- */

let store;
let items = [];
let mesIdx = 0;
let hoy = hoyISO();
let vista = "calendario"; // "calendario" | "historial"
let detalleId = null;
let formModo = "nuevo"; // "nuevo" | "editar"
let formId = null;
const filtros = { categoria: "", campana: "", estado: "" };

const itemValido = (i) =>
  i && typeof i.titulo === "string" && typeof i.fecha === "string" && ISO_RE.test(i.fecha);

const catDe = (i) => CATEGORIAS[i.categoria] ?? { label: "Sin categoría", bg: "#9aa0a6", fg: "#ffffff" };
const cartelerasDe = (i) =>
  Object.keys(CARTELERAS).filter((k) => Array.isArray(i.carteleras) && i.carteleras.includes(k));
const textoCarteleras = (i) => cartelerasDe(i).map((k) => CARTELERAS[k]).join(" / ");

// Estado actual = la etapa más avanzada que está tildada.
const estadoDe = (i) => (i.bajada ? "Bajada" : i.publicada ? "Publicada" : i.completa ? "Subida" : "Pendiente");
// Solo "Subida" cuenta para el cartel de atrasada (la fecha del calendario es el límite para subirla).
const estaAtrasada = (i) => !i.completa && i.fecha < hoy;
// Vigencia sugerida: quincenal = 15 días corridos, mensual = hasta el día anterior del mes siguiente.
const hastaSugerida = (vigencia, desde) =>
  !desde ? "" : vigencia === "quincenal" ? sumarDias(desde, 14) : vigencia === "mensual" ? sumarDias(sumarMes(desde), -1) : "";
const fechaHastaDe = (i) => (typeof i.fechaHasta === "string" && ISO_RE.test(i.fechaHasta) ? i.fechaHasta : "");
// Publicada, venció la vigencia y todavía no se bajó
const hayQueBajar = (i) => i.publicada && !i.bajada && !!fechaHastaDe(i) && fechaHastaDe(i) < hoy;
const textoVigencia = (i) => VIGENCIAS[i.vigencia] ?? "";
const nombreArchivo = (i) => (typeof i.archivo === "string" ? i.archivo.trim() : "");

/* ---------- Vistas ---------- */

function cambiarVista(v) {
  vista = v;
  render();
}

function actualizarVista() {
  const esCal = vista === "calendario";
  $("#viewCalendario").hidden = !esCal;
  $("#viewHistorial").hidden = esCal;
  $("#monthNav").hidden = !esCal;
  $("#subtitle").textContent = esCal ? "CALENDARIZACIÓN CARTELERAS DIGITALES" : "HISTORIAL DE CARTELERAS";
  $("#btnVistaCal").setAttribute("aria-current", String(esCal));
  $("#btnVistaHist").setAttribute("aria-current", String(!esCal));
}

function render() {
  hoy = hoyISO();
  actualizarVista();
  if (vista === "calendario") renderCalendario();
  else renderHistorial();

  // Si hay un detalle abierto, lo refrescamos (o lo cerramos si ya no existe)
  const dlg = $("#detailDialog");
  if (dlg.open && detalleId) {
    const it = items.find((i) => i.id === detalleId);
    if (it) renderDetalle(it);
    else dlg.close();
  }
}

/* ---------- Render del calendario ---------- */

function renderTabs() {
  const anios = [...new Set(MESES.map((m) => m.year))];
  const actual = MESES[mesIdx];
  $("#yearTabs").replaceChildren(
    ...anios.map((y) =>
      h("button", {
        type: "button",
        class: "tab",
        "aria-current": y === actual.year ? "true" : "false",
        // Al cambiar de año se va al mismo mes (o al más cercano disponible de ese año)
        onclick: () => {
          const delAnio = MESES.filter((m) => m.year === y);
          const igual = delAnio.find((m) => m.month === actual.month);
          mesIdx = MESES.indexOf(igual || (y < actual.year ? delAnio.at(-1) : delAnio[0]));
          render();
        },
        text: y,
      })
    )
  );
  $("#stepName").textContent = actual.name;
  // Un punto por mes del año elegido
  $("#monthDots").replaceChildren(
    ...MESES.map((m, idx) => (m.year === actual.year ? { m, idx } : null)).filter(Boolean).map(({ m, idx }) =>
      h("button", {
        type: "button",
        class: "dot",
        "aria-current": idx === mesIdx ? "true" : "false",
        "aria-label": `${m.name} ${m.year}`,
        title: m.name,
        onclick: () => { mesIdx = idx; render(); },
      })
    )
  );
  $("#prevMonth").disabled = mesIdx === 0;
  $("#nextMonth").disabled = mesIdx === MESES.length - 1;
}

function crearBarra(item) {
  const cat = catDe(item);
  const atrasada = estaAtrasada(item);
  const baja = hayQueBajar(item);
  const meta = textoCarteleras(item);

  const btn = h(
    "button",
    {
      type: "button",
      class: "bar" + (item.completa ? " is-done" : "") + (atrasada ? " is-late" : "") + (baja ? " is-baja" : ""),
      style: `--bg:${cat.bg};--fg:${cat.fg}`,
      title: `${item.titulo}${meta ? " — " + meta : ""}`,
      onclick: () => abrirDetalle(item.id),
    },
    h("span", { class: "bar-title" },
      ICONOS[estadoDe(item)] ? h("span", { class: "check", "aria-label": estadoDe(item) }, ICONOS[estadoDe(item)]) : null,
      item.titulo),
    meta ? h("span", { class: "bar-meta", text: meta }) : null,
    atrasada ? h("span", { class: "late-pill", text: "PENDIENTE" }) : null,
    baja ? h("span", { class: "late-pill baja", text: "DAR DE BAJA" }) : null
  );
  return btn;
}

function crearBarraFeriado(f) {
  return h(
    "div",
    { class: "bar locked", title: f.nombre },
    h("span", { class: "bar-title", text: f.tipo }),
    h("span", { class: "bar-meta", text: f.nombre })
  );
}

function renderCalendario() {
  const { year, month } = MESES[mesIdx];

  renderTabs();

  const porFecha = new Map();
  for (const it of items.filter(itemValido)) {
    if (!porFecha.has(it.fecha)) porFecha.set(it.fecha, []);
    porFecha.get(it.fecha).push(it);
  }
  porFecha.forEach((lista) => lista.sort((a, b) => a.titulo.localeCompare(b.titulo, "es")));

  const primerDia = new Date(year, month, 1).getDay();
  const totalDias = new Date(year, month + 1, 0).getDate();
  const filas = Math.ceil((primerDia + totalDias) / 7);
  const celdas = [];

  for (let c = 0; c < filas * 7; c++) {
    const dia = c - primerDia + 1;
    if (dia < 1 || dia > totalDias) {
      celdas.push(h("div", { class: "day blank", "aria-hidden": "true" }));
      continue;
    }
    const iso = toISO(year, month, dia);
    const lista = porFecha.get(iso) ?? [];
    const feriado = FERIADOS[iso];
    const hayAtrasada = lista.some(estaAtrasada);

    const clases = ["day"];
    if (iso === hoy) clases.push("today");
    if (feriado) clases.push("holiday");
    if (hayAtrasada) clases.push("has-late");

    celdas.push(
      h("div", { class: clases.join(" "), "data-date": iso },
        h("div", { class: "day-head" },
          h("button", {
            type: "button",
            class: "add-btn",
            "aria-label": `Agregar comunicación el ${fmtCorta(iso)}`,
            title: "Agregar comunicación",
            onclick: () => abrirForm("nuevo", { fecha: iso }),
            text: "+",
          }),
          h("span", { class: "day-num", text: dia })
        ),
        h("div", { class: "day-items" },
          feriado ? crearBarraFeriado(feriado) : null,
          lista.map(crearBarra)
        )
      )
    );
  }
  $("#grid").replaceChildren(...celdas);
}

/* ---------- Historial ---------- */

function armarFiltros() {
  const llenar = (sel, todas, opciones) =>
    $(sel).replaceChildren(
      h("option", { value: "", text: todas }),
      ...opciones.map(([v, t]) => h("option", { value: v, text: t }))
    );
  llenar("#fltCategoria", "Todas", Object.entries(CATEGORIAS).map(([k, c]) => [k, c.label]));
  llenar("#fltCampana", "Todas", Object.entries(CARTELERAS));
  llenar("#fltEstado", "Todos", ESTADOS.map((e) => [e, e]));

  const enlazar = (sel, clave) =>
    $(sel).addEventListener("change", (e) => { filtros[clave] = e.target.value; renderHistorial(); });
  enlazar("#fltCategoria", "categoria");
  enlazar("#fltCampana", "campana");
  enlazar("#fltEstado", "estado");

  $("#fltLimpiar").addEventListener("click", () => {
    filtros.categoria = filtros.campana = filtros.estado = "";
    ["#fltCategoria", "#fltCampana", "#fltEstado"].forEach((s) => ($(s).value = ""));
    renderHistorial();
  });
  $("#btnExcel").addEventListener("click", descargarExcel);
}

// Las filas que se ven (y que baja el Excel): todas las comunicaciones, filtradas y de la más reciente a la más vieja.
function itemsFiltrados() {
  return items
    .filter(itemValido)
    .filter((i) => !filtros.categoria || i.categoria === filtros.categoria)
    .filter((i) => !filtros.campana || cartelerasDe(i).includes(filtros.campana))
    .filter((i) => !filtros.estado || estadoDe(i) === filtros.estado)
    .sort((a, b) =>
      b.fecha.localeCompare(a.fecha) ||
      (nombreArchivo(a) || a.titulo).localeCompare(nombreArchivo(b) || b.titulo, "es")
    );
}

const slugEstado = (e) => e.toLowerCase();

function crearFila(i) {
  const cat = catDe(i);
  const estado = estadoDe(i);
  const nombre = nombreArchivo(i);
  const abrir = () => abrirDetalle(i.id);

  return h("tr", {
      class: "hist-row",
      tabindex: "0",
      onclick: abrir,
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } },
    },
    h("td", { class: "c-fecha", "data-label": "Fecha límite", text: fmtCorta(i.fecha) }),
    h("td", { class: "c-archivo", "data-label": "Nombre de archivo" },
      nombre
        ? nombre
        : h("span", { class: "sin-archivo", title: "Sin nombre de archivo: se muestra el título", text: i.titulo })),
    h("td", { "data-label": "Campaña", text: textoCarteleras(i) || "—" }),
    h("td", { "data-label": "Categoría" },
      h("span", { class: "cat-pill" },
        h("i", { style: `background:${cat.bg}` }),
        cat.label)),
    h("td", { "data-label": "Estado actual" },
      h("span", { class: `estado estado-${slugEstado(estado)}`, text: ICONOS[estado] ? `${ICONOS[estado]} ${estado}` : estado }),
      estaAtrasada(i) ? h("span", { class: "late-pill inline", text: "PENDIENTE" }) : null)
  );
}

function renderHistorial() {
  const total = items.filter(itemValido).length;
  const lista = itemsFiltrados();

  $("#histCount").textContent =
    lista.length === total
      ? plural(total, "comunicación", "comunicaciones")
      : `${lista.length} de ${plural(total, "comunicación", "comunicaciones")}`;

  $("#histBody").replaceChildren(
    ...(lista.length
      ? lista.map(crearFila)
      : [h("tr", {}, h("td", { colspan: "5", class: "hist-empty", text: "No hay comunicaciones con estos filtros." }))])
  );
}

/* ---------- Descarga a Excel ---------- */

const COLUMNAS_EXCEL = [
  "Categorías", "Campaña", "Publicación (archivo)", "Vigencia", "Fecha Desde", "Fecha Hasta", "Mes", "Estado", "Fecha carga",
];

function filasExcel(lista) {
  return lista.map((i) => ({
    "Categorías": catDe(i).label,
    "Campaña": textoCarteleras(i),
    // Las comunicaciones viejas sin nombre de archivo salen con su título, igual que en pantalla.
    "Publicación (archivo)": nombreArchivo(i) || i.titulo,
    "Vigencia": textoVigencia(i),
    // La fecha del calendario es desde cuando tiene que estar subida
    "Fecha Desde": fmtCorta(i.fecha),
    "Fecha Hasta": fmtOpc(fechaHastaDe(i)),
    "Mes": NOMBRES_MES[Number(i.fecha.slice(5, 7)) - 1],
    "Estado": estadoDe(i),
    "Fecha carga": fmtOpc(i.completadaEl),
  }));
}

function cargarExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = EXCELJS_URL;
    s.async = true;
    s.onload = () => (window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error("ExcelJS no se inicializó")));
    s.onerror = () => reject(new Error("No se pudo cargar ExcelJS"));
    document.head.append(s);
  });
}

// Arma el libro con el mismo diseño del Excel de referencia: título, encabezado rojo y filas centradas con bordes.
async function armarLibro(filas) {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Historial");
  // Ancho de cada columna = lo que ocupa su texto más largo (encabezado con lugar para la flecha del filtro) + un margen
  const anchos = COLUMNAS_EXCEL.map((col) => {
    const celda = Math.max(0, ...filas.map((f) => String(f[col] || "").length));
    return Math.ceil(Math.max(col.length * 1.35 + 4, celda * 1.2 + 3));
  });
  ws.columns = anchos.map((width) => ({ width }));

  ws.mergeCells("A1:I1");
  const titulo = ws.getCell("A1");
  titulo.value = "Planificación Carteleras Digitales";
  titulo.font = { name: "Roboto", size: 24, bold: true, color: { argb: "FFCF1F1B" } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 45.6;

  const borde = { style: "thin", color: { argb: "FF000000" } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };
  const centrado = { horizontal: "center", vertical: "middle" };

  const enc = ws.addRow(COLUMNAS_EXCEL);
  enc.height = 25.8;
  enc.eachCell((c) => {
    c.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFEAEAEA" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE43631" } };
    c.alignment = centrado;
    c.border = bordes;
  });

  for (const f of filas) {
    const fila = ws.addRow(COLUMNAS_EXCEL.map((c) => f[c] || ""));
    fila.height = 15.6;
    fila.eachCell({ includeEmpty: true }, (c) => {
      c.font = { name: "Calibri", size: 12 };
      c.alignment = centrado;
      c.border = bordes;
    });
  }
  // Filtros en los encabezados (fila 2)
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2 + filas.length, column: COLUMNAS_EXCEL.length } };
  return wb;
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Plan B si no se puede cargar la librería de Excel: CSV con ";" y BOM, que Excel en español abre bien.
function descargarCSV(filas, nombre) {
  const celda = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lineas = [COLUMNAS_EXCEL.map(celda).join(";"), ...filas.map((f) => COLUMNAS_EXCEL.map((c) => celda(f[c])).join(";"))];
  descargarBlob(new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${nombre}.csv`);
}

async function descargarExcel() {
  const lista = itemsFiltrados();
  if (!lista.length) return toast("No hay filas para descargar con estos filtros.");

  const filas = filasExcel(lista);
  const nombre = `historial-carteleras-${hoyISO()}`;
  const btn = $("#btnExcel");
  btn.disabled = true;
  try {
    const wb = await armarLibro(filas);
    const buffer = await wb.xlsx.writeBuffer();
    descargarBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${nombre}.xlsx`);
    toast(`Excel descargado (${plural(filas.length, "fila", "filas")})`);
  } catch (err) {
    console.error(err);
    descargarCSV(filas, nombre);
    toast("No se pudo armar el .xlsx: se descargó un CSV, que también abre en Excel.");
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Detalle ---------- */

function abrirDetalle(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  detalleId = id;
  renderDetalle(it);
  const dlg = $("#detailDialog");
  if (!dlg.open) dlg.showModal();
}

async function copiarTexto(texto, boton) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(texto);
    ok = true;
  } catch (_) {
    // Plan B para navegadores o contextos sin acceso al portapapeles
    const t = h("textarea", { readonly: true, style: "position:fixed;opacity:0;top:0;left:0" });
    t.value = texto;
    document.body.append(t);
    t.select();
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    t.remove();
  }
  if (ok) {
    toast("Nombre de archivo copiado");
    if (boton) {
      boton.textContent = "¡Copiado!";
      setTimeout(() => { boton.textContent = "Copiar"; }, 1600);
    }
  } else {
    toast("No se pudo copiar. Seleccioná el texto y copialo a mano.");
  }
}

// Texto y color de la nota de cada etapa
function notaEtapa(it, idx) {
  const e = ETAPAS[idx];
  const marcada = !!it[e.key];
  const f = it[e.fecha];
  const fechaOk = typeof f === "string" && ISO_RE.test(f);

  if (marcada) {
    if (!fechaOk) return { clase: "ok", texto: `${e.nombre}.` };
    if (idx === 0) {
      const d = diffDias(f, it.fecha);
      const cuando = d === 0 ? "justo a tiempo" : d < 0 ? `${plural(-d, "día", "días")} antes` : `${plural(d, "día", "días")} de atraso`;
      return { clase: d > 0 ? "late" : "ok", texto: `Subida el ${fmtCorta(f)} · ${cuando}` };
    }
    return { clase: "ok", texto: `${e.nombre} el ${fmtCorta(f)}` };
  }
  if (idx === 0 && estaAtrasada(it)) {
    const d = diffDias(hoy, it.fecha);
    return { clase: "late", texto: `Pendiente: la fecha límite era hace ${plural(d, "día", "días")}.` };
  }
  if (idx === 2 && hayQueBajar(it)) {
    const d = diffDias(hoy, fechaHastaDe(it));
    return { clase: "late", texto: `Dar de baja: la vigencia terminó hace ${plural(d, "día", "días")} (${fmtCorta(fechaHastaDe(it))}).` };
  }
  const previaOk = idx === 0 || !!it[ETAPAS[idx - 1].key];
  return { clase: "", texto: previaOk ? e.pendiente : e.bloqueo };
}

function crearEtapa(it, idx) {
  const e = ETAPAS[idx];
  const marcada = !!it[e.key];
  const previaOk = idx === 0 || !!it[ETAPAS[idx - 1].key];
  const nota = notaEtapa(it, idx);
  const id = `dEtapa${idx}`;

  const chk = h("input", {
    type: "checkbox",
    id,
    disabled: !marcada && !previaOk,
    onchange: async (ev) => {
      const marca = ev.target.checked;
      const cambios = {};
      if (marca) {
        cambios[e.key] = true;
        cambios[e.fecha] = hoyISO();
      } else {
        // Al destildar una etapa se destildan también las siguientes (y se borran sus fechas)
        for (const s of ETAPAS.slice(idx)) {
          cambios[s.key] = false;
          cambios[s.fecha] = null;
        }
      }
      try {
        await store.update(it.id, cambios);
        toast(marca ? `Marcada como ${e.nombre.toLowerCase()}` : `Marca de ${e.nombre.toLowerCase()} quitada`);
      } catch (err) {
        console.error(err);
        ev.target.checked = !marca;
        toast("No se pudo guardar el cambio. Probá de nuevo.");
      }
    },
  });
  chk.checked = marcada;

  return h("div", { class: "done-box " + nota.clase + (!marcada && !previaOk ? " is-locked" : "") },
    chk,
    h("div", {},
      h("label", { for: id, text: e.nombre }),
      h("span", { class: "done-note", text: nota.texto })
    )
  );
}

function renderDetalle(it) {
  const cat = catDe(it);
  const meta = textoCarteleras(it);
  const nombre = nombreArchivo(it);

  const accionesNormales = h("div", { class: "actions", id: "dActions" },
    h("button", { type: "button", class: "btn danger", onclick: () => pedirConfirmacion(it) , text: "Eliminar" }),
    h("button", { type: "button", class: "btn ghost", onclick: () => abrirForm("editar", { item: it }), text: "Editar" }),
    h("button", { type: "button", class: "btn primary", onclick: () => $("#detailDialog").close(), text: "Cerrar" })
  );

  $("#detailSheet").replaceChildren(
    h("span", { class: "d-cat", style: `background:${cat.bg};color:${cat.fg}`, text: cat.label }),
    h("h3", { class: "d-title", id: "detailTitle", text: it.titulo }),
    h("p", { class: "d-date", text: `Fecha límite para subirla: ${fmtLarga(it.fecha)}` }),
    h("div", { class: "d-row" },
      h("b", { text: "Nombre de archivo" }),
      nombre
        ? h("div", { class: "d-file" },
            h("code", { text: nombre }),
            h("button", {
              type: "button",
              class: "btn ghost copy-btn",
              onclick: (ev) => copiarTexto(nombre, ev.currentTarget),
              text: "Copiar",
            }))
        : h("span", { class: "d-empty", text: "Sin nombre de archivo (tocá Editar para cargarlo)" })
    ),
    h("div", { class: "d-row" },
      h("b", { text: "Campaña" }),
      meta || h("span", { class: "d-empty", text: "Sin campaña asignada" })
    ),
    h("div", { class: "d-row" },
      h("b", { text: "Vigencia" }),
      textoVigencia(it)
        ? `${textoVigencia(it)}${fechaHastaDe(it) ? " · hasta el " + fmtCorta(fechaHastaDe(it)) : ""}`
        : h("span", { class: "d-empty", text: "Sin vigencia (tocá Editar para cargarla)" })
    ),
    h("div", { class: "d-row" },
      h("b", { text: "Descripción" }),
      it.descripcion
        ? h("div", { class: "d-desc", text: it.descripcion })
        : h("span", { class: "d-empty", text: "Sin descripción" })
    ),
    h("div", { class: "stages" },
      h("b", { class: "stages-title", text: "Seguimiento" }),
      ETAPAS.map((_, idx) => crearEtapa(it, idx))
    ),
    accionesNormales
  );
}

function pedirConfirmacion(it) {
  const zona = $("#dActions");
  zona.replaceChildren(
    h("div", { class: "confirm-row" },
      h("span", { text: "¿Eliminar esta comunicación?" }),
      h("button", { type: "button", class: "btn ghost", onclick: () => renderDetalle(it), text: "No, volver" }),
      h("button", {
        type: "button",
        class: "btn danger-solid",
        onclick: async () => {
          try {
            await store.remove(it.id);
            $("#detailDialog").close();
            toast("Comunicación eliminada");
          } catch (err) {
            console.error(err);
            toast("No se pudo eliminar. Probá de nuevo.");
          }
        },
        text: "Sí, eliminar",
      })
    )
  );
}

/* ---------- Formulario ---------- */

function armarCamposFijos() {
  $("#fCatList").replaceChildren(
    ...Object.entries(CATEGORIAS).map(([k, c]) =>
      h("button", {
        type: "button", class: "cat-opt", role: "option", "data-value": k,
        onclick: () => { elegirCategoria(k); cerrarListaCategorias(); $("#fCatBtn").focus(); },
      }, h("i", { class: "cat-dot", style: `background:${c.bg}` }), c.label)
    )
  );
  $("#fCatBtn").addEventListener("click", () => {
    const abrir = $("#fCatList").hidden;
    $("#fCatList").hidden = !abrir;
    $("#fCatBtn").setAttribute("aria-expanded", String(abrir));
  });
  // Esc cierra solo la lista (no el formulario) y un clic afuera también la cierra
  $("#fCatSelect").addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#fCatList").hidden) { e.preventDefault(); e.stopPropagation(); cerrarListaCategorias(); $("#fCatBtn").focus(); }
  });
  $("#formDialog").addEventListener("click", (e) => { if (!e.target.closest("#fCatSelect")) cerrarListaCategorias(); });
  $("#btnAddDesc").addEventListener("click", () => { mostrarDescripcion(true); $("#fDescripcion").focus(); });
  $("#fCarteleras").replaceChildren(
    ...Object.entries(CARTELERAS).map(([k, label]) =>
      h("label", {},
        h("input", { type: "checkbox", name: "cartelera", value: k }),
        label
      )
    )
  );
}

function cerrarListaCategorias() {
  $("#fCatList").hidden = true;
  $("#fCatBtn").setAttribute("aria-expanded", "false");
}

function elegirCategoria(k) {
  const c = CATEGORIAS[k];
  $("#fCategoria").value = c ? k : "";
  $("#fCatBtn").replaceChildren(
    ...(c
      ? [h("i", { class: "cat-dot", style: `background:${c.bg}` }), c.label]
      : [h("span", { class: "vacio", text: "Elegí una categoría" })])
  );
  document.querySelectorAll(".cat-opt").forEach((o) => o.setAttribute("aria-selected", String(o.dataset.value === k)));
}

// La descripción es opcional: arranca oculta detrás de un botón
function mostrarDescripcion(ver) {
  $("#fDescCampo").hidden = !ver;
  $("#btnAddDesc").hidden = ver;
}

function abrirForm(modo, { fecha, item } = {}) {
  formModo = modo;
  formId = item?.id ?? null;
  $("#formHeading").textContent = modo === "editar" ? "Editar comunicación" : "Nueva comunicación";
  $("#formSave").textContent = "Guardar";
  $("#formError").hidden = true;

  $("#fTitulo").value = item?.titulo ?? "";
  $("#fArchivo").value = item ? nombreArchivo(item) : "";
  $("#fFecha").value = item?.fecha ?? fecha ?? "";
  $("#fDescripcion").value = item?.descripcion ?? "";
  mostrarDescripcion(!!item?.descripcion);
  $("#fVigencia").value = item?.vigencia ?? "estatica";
  $("#fHasta").value = item ? fechaHastaDe(item) : "";
  actualizarCampoHasta();
  elegirCategoria(item?.categoria);
  cerrarListaCategorias();
  document.querySelectorAll('input[name="cartelera"]').forEach((c) => (c.checked = !!item && cartelerasDe(item).includes(c.value)));

  $("#detailDialog").close();
  $("#formDialog").showModal();
  $("#fTitulo").focus();
}

// "Fecha hasta" solo aplica si la vigencia no es estática
function actualizarCampoHasta(sugerir = false) {
  const vigencia = $("#fVigencia").value;
  $("#fHastaCampo").hidden = vigencia === "estatica";
  $("#fHasta").min = $("#fFecha").value || "";
  if (sugerir) $("#fHasta").value = hastaSugerida(vigencia, $("#fFecha").value);
}

function mostrarError(msg) {
  const e = $("#formError");
  e.textContent = msg;
  e.hidden = false;
}

async function guardarForm(ev) {
  ev.preventDefault();

  const titulo = $("#fTitulo").value.trim();
  const archivo = $("#fArchivo").value.trim();
  const fecha = $("#fFecha").value;
  const descripcion = $("#fDescripcion").value.trim();
  const vigencia = $("#fVigencia").value;
  const fechaHasta = vigencia === "estatica" ? null : $("#fHasta").value || null;
  const categoria = $("#fCategoria").value;
  const carteleras = [...document.querySelectorAll('input[name="cartelera"]:checked')].map((c) => c.value);

  if (!titulo) return mostrarError("Escribí un título para la comunicación.");
  if (!archivo) return mostrarError("Escribí el nombre de archivo (sin extensión).");
  if (!fecha) return mostrarError("Elegí la fecha límite para subirla.");
  if (fecha < FECHA_MIN || fecha > FECHA_MAX) return mostrarError("La fecha tiene que estar entre octubre de 2026 y diciembre de 2027.");
  if (vigencia !== "estatica" && !fechaHasta) return mostrarError("Elegí hasta qué fecha tiene que estar la cartelera.");
  if (fechaHasta && fechaHasta < fecha) return mostrarError("La fecha hasta no puede ser anterior a la fecha límite.");
  if (!categoria) return mostrarError("Elegí una categoría.");
  if (!carteleras.length) return mostrarError("Tildá al menos una campaña.");

  const btn = $("#formSave");
  btn.disabled = true;
  try {
    if (formModo === "editar") {
      await store.update(formId, { titulo, archivo, fecha, descripcion, categoria, carteleras, vigencia, fechaHasta });
      toast("Cambios guardados");
    } else {
      await store.add({
        titulo, archivo, fecha, descripcion, categoria, carteleras, vigencia, fechaHasta,
        completa: false, completadaEl: null,
        publicada: false, publicadaEl: null,
        bajada: false, bajadaEl: null,
      });
      toast("Comunicación agregada");
    }
    $("#formDialog").close();

    // Si la fecha cae en otro mes, nos movemos hasta allí para que se vea
    const idx = MESES.findIndex((m) => fecha.startsWith(`${m.year}-${pad(m.month + 1)}`));
    if (idx >= 0) { mesIdx = idx; }
    render();
  } catch (err) {
    console.error(err);
    mostrarError(
      err?.code === "permission-denied"
        ? "Firebase rechazó el guardado: las reglas publicadas no coinciden con la app. Hay que publicar firestore.rules en la consola."
        : "No se pudo guardar. Revisá la conexión e intentá de nuevo."
    );
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Inicio ---------- */

function armarLeyenda() {
  $("#legend").replaceChildren(
    ...Object.values(CATEGORIAS).map((c) =>
      h("span", {}, h("i", { class: "swatch", style: `background:${c.bg}` }), c.label)
    )
  );
}

function cerrarAlClickearFondo(dlg) {
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
}

async function iniciar() {
  armarLeyenda();
  armarCamposFijos();
  armarFiltros();
  $("#fVigencia").replaceChildren(...Object.entries(VIGENCIAS).map(([k, label]) => h("option", { value: k, text: label })));
  $("#fVigencia").addEventListener("change", () => actualizarCampoHasta(true));
  $("#fFecha").addEventListener("change", () => actualizarCampoHasta($("#fVigencia").value !== "dias"));

  // Mes inicial: el actual si está en el rango, si no octubre
  const t = new Date();
  const idx = MESES.findIndex((m) => m.year === t.getFullYear() && m.month === t.getMonth());
  mesIdx = idx >= 0 ? idx : 0;

  $("#btnHoy").addEventListener("click", () => { mesIdx = idx >= 0 ? idx : 0; render(); });
  $("#prevMonth").addEventListener("click", () => { if (mesIdx > 0) { mesIdx--; render(); } });
  $("#nextMonth").addEventListener("click", () => { if (mesIdx < MESES.length - 1) { mesIdx++; render(); } });
  $("#btnVistaCal").addEventListener("click", () => cambiarVista("calendario"));
  $("#btnVistaHist").addEventListener("click", () => cambiarVista("historial"));
  $("#commForm").addEventListener("submit", guardarForm);
  $("#formCancel").addEventListener("click", () => $("#formDialog").close());
  $("#btnAyuda").addEventListener("click", () => $("#helpDialog").showModal());
  $("#helpClose").addEventListener("click", () => $("#helpDialog").close());
  cerrarAlClickearFondo($("#helpDialog"));
  cerrarAlClickearFondo($("#detailDialog"));
  cerrarAlClickearFondo($("#formDialog"));

  render(); // calendario vacío mientras conecta

  store = await crearStore();
  store.subscribe(
    (lista) => { items = lista; render(); },
    (err) => {
      console.error(err);
      setStatus("error", "Sin conexión");
    }
  );

  // Si pasa la medianoche con la página abierta, se actualizan las "atrasadas"
  setInterval(() => { if (hoyISO() !== hoy) render(); }, 60 * 1000);
}

iniciar();
