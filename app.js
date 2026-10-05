/* =========================================================
   Calendarización Carteleras Digitales — Somos Coto
   ---------------------------------------------------------
   1) Pegá tu configuración de Firebase en `firebaseConfig`.
      Mientras diga "TU_API_KEY", la app funciona en MODO LOCAL
      (los datos se guardan solo en este navegador).
   2) Publicá las reglas de `firestore.rules` en Firebase.
   ========================================================= */

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

const FIREBASE_VERSION = "10.12.2";
const COLLECTION = "comunicaciones";

/* ---------- Datos fijos ---------- */

const CATEGORIAS = {
  coto:       { label: "Somos Coto",       bg: "#E8473A", fg: "#ffffff" },
  familia:    { label: "Somos Familia",    bg: "#4FA83F", fg: "#ffffff" },
  argentinos: { label: "Somos Argentinos", bg: "#5BC0E3", fg: "#06303f" },
  innovacion: { label: "Somos Innovación", bg: "#F47B2A", fg: "#2b1300" },
  mas:        { label: "Somos Más",        bg: "#FDD835", fg: "#3b3000" },
  compromiso: { label: "Somos Compromiso", bg: "#6B4A8A", fg: "#ffffff" },
};

const CARTELERAS = {
  central:    "Central",
  sucursales: "Sucursales",
  logisu:     "Logisu (CD)",
};

const MESES = [
  { year: 2026, month: 9,  name: "Octubre" },
  { year: 2026, month: 10, name: "Noviembre" },
  { year: 2026, month: 11, name: "Diciembre" },
];

// Feriados y días no laborables (Argentina, 2026). Fijos: no se editan.
const FERIADOS = {
  "2026-10-12": { tipo: "Feriado",      nombre: "Día del Respeto a la Diversidad Cultural" },
  "2026-11-23": { tipo: "Feriado",      nombre: "Día de la Soberanía Nacional (trasladado del 20/11)" },
  "2026-12-07": { tipo: "No laborable", nombre: "Día no laborable con fines turísticos" },
  "2026-12-08": { tipo: "Feriado",      nombre: "Inmaculada Concepción de María" },
  "2026-12-25": { tipo: "Feriado",      nombre: "Navidad" },
};

// Carga inicial (tomada del PDF original). Se crea una sola vez.
const SEMILLA = [
  { id: "seed-bonda",         titulo: "BONDA",                fecha: "2026-10-01", categoria: "argentinos", carteleras: ["central"] },
  { id: "seed-octubre-rosa",  titulo: "Octubre Rosa",         fecha: "2026-10-05", categoria: "coto",       carteleras: ["central"] },
  { id: "seed-sportclub",     titulo: "SportClub",            fecha: "2026-10-06", categoria: "argentinos", carteleras: ["central"] },
  { id: "seed-convenios-edu", titulo: "Convenios Educativos", fecha: "2026-10-07", categoria: "compromiso", carteleras: ["sucursales"] },
  { id: "seed-dia-madre",     titulo: "Día de la Madre",      fecha: "2026-10-16", categoria: "familia",    carteleras: ["central", "sucursales"] },
  { id: "seed-carnicero",     titulo: "Día del Carnicero",    fecha: "2026-10-19", categoria: "mas",        carteleras: ["sucursales"] },
].map((s) => ({ descripcion: "", completa: false, completadaEl: null, ...s }));

/* ---------- Utilidades de fecha ---------- */

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
const fmtLarga = (iso) =>
  new Date(utc(iso)).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
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

function setStatus(mode, text) {
  const s = $("#status");
  s.dataset.mode = mode;
  s.textContent = text;
}

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
    setStatus("local", "Modo local: los cambios se guardan solo en este navegador");
    return crearStoreLocal();
  }
  try {
    const store = await crearStoreFirebase();
    setStatus("firebase", "En línea: los cambios se ven en tiempo real");
    return store;
  } catch (err) {
    console.error("No se pudo conectar con Firebase:", err);
    setStatus("error", "Sin conexión con Firebase: se usa el modo local");
    return crearStoreLocal();
  }
}

/* ---------- Estado ---------- */

let store;
let items = [];
let mesIdx = 0;
let hoy = hoyISO();
let detalleId = null;
let formModo = "nuevo"; // "nuevo" | "editar"
let formId = null;

const itemValido = (i) =>
  i && typeof i.titulo === "string" && typeof i.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.fecha);

const catDe = (i) => CATEGORIAS[i.categoria] ?? { label: "Sin categoría", bg: "#9aa0a6", fg: "#ffffff" };
const cartelerasDe = (i) =>
  Object.keys(CARTELERAS).filter((k) => Array.isArray(i.carteleras) && i.carteleras.includes(k));
const textoCarteleras = (i) => cartelerasDe(i).map((k) => CARTELERAS[k]).join(" / ");
const estaAtrasada = (i) => !i.completa && i.fecha < hoy;

/* ---------- Render del calendario ---------- */

function renderTabs() {
  const tabs = $("#monthTabs");
  tabs.replaceChildren(
    ...MESES.map((m, idx) =>
      h("button", {
        type: "button",
        class: "tab",
        "aria-current": idx === mesIdx ? "true" : "false",
        onclick: () => { mesIdx = idx; render(); },
        text: m.name,
      })
    )
  );
  $("#prevMonth").disabled = mesIdx === 0;
  $("#nextMonth").disabled = mesIdx === MESES.length - 1;
}

function crearBarra(item) {
  const cat = catDe(item);
  const atrasada = estaAtrasada(item);
  const meta = textoCarteleras(item);

  const btn = h(
    "button",
    {
      type: "button",
      class: "bar" + (item.completa ? " is-done" : "") + (atrasada ? " is-late" : ""),
      style: `--bg:${cat.bg};--fg:${cat.fg}`,
      title: `${item.titulo}${meta ? " — " + meta : ""}`,
      onclick: () => abrirDetalle(item.id),
    },
    h("span", { class: "bar-title" },
      item.completa ? h("span", { class: "check", "aria-label": "Completa" }, "✓") : null,
      item.titulo),
    meta ? h("span", { class: "bar-meta", text: meta }) : null,
    atrasada ? h("span", { class: "late-pill", text: "ATRASADA" }) : null
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

function render() {
  hoy = hoyISO();
  const { year, month, name } = MESES[mesIdx];

  $("#monthName").textContent = name;
  $("#yearNum").textContent = year;
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

  // Si hay un detalle abierto, lo refrescamos (o lo cerramos si ya no existe)
  const dlg = $("#detailDialog");
  if (dlg.open && detalleId) {
    const it = items.find((i) => i.id === detalleId);
    if (it) renderDetalle(it);
    else dlg.close();
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

function renderDetalle(it) {
  const cat = catDe(it);
  const atrasada = estaAtrasada(it);
  const meta = textoCarteleras(it);

  // Estado de cumplimiento
  let notaClase = "";
  let nota = "Pendiente de completar.";
  if (it.completa) {
    const f = it.completadaEl;
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
      const d = diffDias(f, it.fecha);
      const cuando = d === 0 ? "justo a tiempo" : d < 0 ? `${plural(-d, "día", "días")} antes` : `${plural(d, "día", "días")} de atraso`;
      nota = `Completada el ${fmtCorta(f)} · ${cuando}`;
      notaClase = d > 0 ? "late" : "ok";
    } else {
      nota = "Completada.";
      notaClase = "ok";
    }
  } else if (atrasada) {
    const d = diffDias(hoy, it.fecha);
    nota = `Atrasada: la fecha era hace ${plural(d, "día", "días")}.`;
    notaClase = "late";
  }

  const chk = h("input", {
    type: "checkbox",
    id: "dDone",
    onchange: async (e) => {
      const marcada = e.target.checked;
      try {
        await store.update(it.id, { completa: marcada, completadaEl: marcada ? hoyISO() : null });
        toast(marcada ? "Marcada como completa" : "Marca de completa quitada");
      } catch (err) {
        console.error(err);
        e.target.checked = !marcada;
        toast("No se pudo guardar el cambio. Probá de nuevo.");
      }
    },
  });
  chk.checked = !!it.completa;

  const accionesNormales = h("div", { class: "actions", id: "dActions" },
    h("button", { type: "button", class: "btn danger", onclick: () => pedirConfirmacion(it) , text: "Eliminar" }),
    h("button", { type: "button", class: "btn ghost", onclick: () => abrirForm("editar", { item: it }), text: "Editar" }),
    h("button", { type: "button", class: "btn primary", onclick: () => $("#detailDialog").close(), text: "Cerrar" })
  );

  $("#detailSheet").replaceChildren(
    h("span", { class: "d-cat", style: `background:${cat.bg};color:${cat.fg}`, text: cat.label }),
    h("h3", { class: "d-title", id: "detailTitle", text: it.titulo }),
    h("p", { class: "d-date", text: `Debe estar terminada: ${fmtLarga(it.fecha)}` }),
    h("div", { class: "d-row" },
      h("b", { text: "Carteleras destino" }),
      meta || h("span", { class: "d-empty", text: "Sin cartelera asignada" })
    ),
    h("div", { class: "d-row" },
      h("b", { text: "Descripción" }),
      it.descripcion
        ? h("div", { class: "d-desc", text: it.descripcion })
        : h("span", { class: "d-empty", text: "Sin descripción" })
    ),
    h("div", { class: "done-box " + notaClase },
      chk,
      h("div", {},
        h("label", { for: "dDone", text: "Completa / subida" }),
        h("span", { class: "done-note", text: nota })
      )
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
  $("#fCategorias").replaceChildren(
    ...Object.entries(CATEGORIAS).map(([k, c]) =>
      h("label", { class: "chip" },
        h("input", { type: "radio", name: "categoria", value: k }),
        h("span", {}, h("i", { style: `background:${c.bg}` }), c.label)
      )
    )
  );
  $("#fCarteleras").replaceChildren(
    ...Object.entries(CARTELERAS).map(([k, label]) =>
      h("label", {},
        h("input", { type: "checkbox", name: "cartelera", value: k }),
        label
      )
    )
  );
}

function abrirForm(modo, { fecha, item } = {}) {
  formModo = modo;
  formId = item?.id ?? null;
  $("#formHeading").textContent = modo === "editar" ? "Editar comunicación" : "Nueva comunicación";
  $("#formSave").textContent = "Guardar";
  $("#formError").hidden = true;

  $("#fTitulo").value = item?.titulo ?? "";
  $("#fFecha").value = item?.fecha ?? fecha ?? "";
  $("#fDescripcion").value = item?.descripcion ?? "";
  document.querySelectorAll('input[name="categoria"]').forEach((r) => (r.checked = r.value === item?.categoria));
  document.querySelectorAll('input[name="cartelera"]').forEach((c) => (c.checked = !!item && cartelerasDe(item).includes(c.value)));

  $("#detailDialog").close();
  $("#formDialog").showModal();
  $("#fTitulo").focus();
}

function mostrarError(msg) {
  const e = $("#formError");
  e.textContent = msg;
  e.hidden = false;
}

async function guardarForm(ev) {
  ev.preventDefault();

  const titulo = $("#fTitulo").value.trim();
  const fecha = $("#fFecha").value;
  const descripcion = $("#fDescripcion").value.trim();
  const categoria = document.querySelector('input[name="categoria"]:checked')?.value;
  const carteleras = [...document.querySelectorAll('input[name="cartelera"]:checked')].map((c) => c.value);

  if (!titulo) return mostrarError("Escribí un título para la comunicación.");
  if (!fecha) return mostrarError("Elegí la fecha en que debe estar terminada.");
  if (fecha < "2026-10-01" || fecha > "2026-12-31") return mostrarError("La fecha tiene que estar entre octubre y diciembre de 2026.");
  if (!categoria) return mostrarError("Elegí una categoría.");
  if (!carteleras.length) return mostrarError("Tildá al menos una cartelera destino.");

  const btn = $("#formSave");
  btn.disabled = true;
  try {
    if (formModo === "editar") {
      await store.update(formId, { titulo, fecha, descripcion, categoria, carteleras });
      toast("Cambios guardados");
    } else {
      await store.add({ titulo, fecha, descripcion, categoria, carteleras, completa: false, completadaEl: null });
      toast("Comunicación agregada");
    }
    $("#formDialog").close();

    // Si la fecha cae en otro mes, nos movemos hasta allí para que se vea
    const idx = MESES.findIndex((m) => fecha.startsWith(`${m.year}-${pad(m.month + 1)}`));
    if (idx >= 0) { mesIdx = idx; render(); }
  } catch (err) {
    console.error(err);
    mostrarError("No se pudo guardar. Revisá la conexión e intentá de nuevo.");
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

  // Mes inicial: el actual si está en el rango, si no octubre
  const t = new Date();
  const idx = MESES.findIndex((m) => m.year === t.getFullYear() && m.month === t.getMonth());
  mesIdx = idx >= 0 ? idx : 0;

  $("#prevMonth").addEventListener("click", () => { if (mesIdx > 0) { mesIdx--; render(); } });
  $("#nextMonth").addEventListener("click", () => { if (mesIdx < MESES.length - 1) { mesIdx++; render(); } });
  $("#commForm").addEventListener("submit", guardarForm);
  $("#formCancel").addEventListener("click", () => $("#formDialog").close());
  cerrarAlClickearFondo($("#detailDialog"));
  cerrarAlClickearFondo($("#formDialog"));

  render(); // calendario vacío mientras conecta

  store = await crearStore();
  store.subscribe(
    (lista) => { items = lista; render(); },
    (err) => {
      console.error(err);
      setStatus("error", "Se perdió la conexión con Firebase. Recargá la página.");
    }
  );

  // Si pasa la medianoche con la página abierta, se actualizan las "atrasadas"
  setInterval(() => { if (hoyISO() !== hoy) render(); }, 60 * 1000);
}

iniciar();
