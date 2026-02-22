// ============================================================
// BJJ TRAINER APP — app.js
// Trainer-only Dashboard: Athleten verwalten, Punkte eintragen
// ============================================================

// ─── SUPABASE CONFIG ─────────────────────────────────────────
const LOCAL_SUPABASE_URL = "https://ktwgvuasjezokhsfpfqb.supabase.co"; // nur für lokales Testen
const LOCAL_SUPABASE_ANON_KEY = "sb_publishable_Ep1SfoAKBOgshy1A6c--9g_Qjx0T1LL"; // nur für lokales Testen

const { createClient } = supabase;
let sb;

async function initSupabase() {
  try {
    const res = await fetch("/.netlify/functions/config");
    if (res.ok) {
      const { supabaseUrl, supabaseAnonKey } = await res.json();
      if (supabaseUrl && supabaseAnonKey) {
        sb = createClient(supabaseUrl, supabaseAnonKey);
        return;
      }
    }
  } catch (_) {}

  if (LOCAL_SUPABASE_URL && LOCAL_SUPABASE_ANON_KEY) {
    sb = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    return;
  }

  showLoginMsg(
    "⚠ Supabase nicht konfiguriert. Netlify Env Vars oder lokale Credentials setzen.",
    "error",
  );
  throw new Error("No Supabase config");
}

// ─── CONSTANTS ───────────────────────────────────────────────
const MAX_POINTS = 192;
const BELT_THRESHOLD = 200;

const BELT_NAMES = {
  white: "Weißgurt",
  blue: "Blaugurt",
  purple: "Lillagurt",
  brown: "Braungurt",
  black: "Schwarzgurt",
};

const BELT_NEXT = {
  white: "blue",
  blue: "purple",
  purple: "brown",
  brown: "black",
  black: null,
};

const ENTRY_TYPES = {
  training: { label: "Training", icon: "🥋", points: 1 },
  tournament: { label: "Turnier", icon: "🏅", points: 50 },
  penalty: { label: "Verwarnung", icon: "⚠", points: -5 },
  misconduct: { label: "Fehlverhalten", icon: "🚫", points: -20 },
};

// ─── STATE ───────────────────────────────────────────────────
let currentUser = null;
let athletes = []; // alle Athleten aus DB
let activities = {}; // { athlete_id: [...] } für aktuelles Jahr
let selectedType = "training";
let openAthleteId = null;

const YEAR = new Date().getFullYear();

// ─── INIT ─────────────────────────────────────────────────────
(async () => {
  await initSupabase();

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session) {
    await onLogin(session.user);
  } else {
    showScreen("login");
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session) await onLogin(session.user);
    if (event === "SIGNED_OUT") showScreen("login");
  });
})();

// ─── LOGIN / LOGOUT ──────────────────────────────────────────
document.getElementById("btn-login").addEventListener("click", async () => {
  if (!sb) return;
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password)
    return showLoginMsg("Bitte alle Felder ausfüllen.", "error");

  showLoginMsg("Wird eingeloggt…", "");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message.includes("Invalid login")
      ? "E-Mail oder Passwort falsch."
      : error.message;
    return showLoginMsg(msg, "error");
  }
  if (data?.user) await onLogin(data.user);
});

// Enter key on password
document.getElementById("login-password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-login").click();
});

document
  .getElementById("btn-logout")
  .addEventListener("click", () => sb.auth.signOut());

async function onLogin(user) {
  currentUser = user;

  // Trainer-Check: is_trainer Flag in profiles prüfen
  const { data: profile } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_trainer) {
    await sb.auth.signOut();
    return showLoginMsg("Kein Trainer-Account. Zugriff verweigert.", "error");
  }

  document.getElementById("sidebar-trainer").textContent =
    profile.full_name || user.email;
  document
    .querySelectorAll("#dash-year, #rank-year, #lb-year")
    .forEach((el) => {
      if (el) el.textContent = YEAR;
    });
  document.getElementById("dash-year").textContent = YEAR;
  document.getElementById("rank-year").textContent = YEAR;

  await loadAllData();
  showScreen("app");
  showView("dashboard");
}

// ─── DATA ────────────────────────────────────────────────────
async function loadAllData() {
  await Promise.all([loadAthletes(), loadActivities()]);
  renderAll();
}

async function loadAthletes() {
  const { data, error } = await sb.from("athletes").select("*").order("name");
  if (error) {
    console.error(error);
    return;
  }
  athletes = data || [];
}

async function loadActivities() {
  const { data, error } = await sb
    .from("activities")
    .select("*")
    .gte("date", `${YEAR}-01-01`)
    .lte("date", `${YEAR}-12-31`)
    .order("date", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  // Gruppieren nach athlete_id
  activities = {};
  (data || []).forEach((a) => {
    if (!activities[a.athlete_id]) activities[a.athlete_id] = [];
    activities[a.athlete_id].push(a);
  });
}

// ─── RENDER ALL ───────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderAthletesGrid();
  populateAthleteSelects();
  updateGroupCount();
}

// ─── DASHBOARD ────────────────────────────────────────────────
function renderDashboard() {
  const activeAthletes = athletes.filter((a) => a.active !== false);
  document.getElementById("stat-total-athletes").textContent =
    activeAthletes.length;

  // Heute eingetragene Trainings
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrainings = Object.values(activities)
    .flat()
    .filter((a) => a.type === "training" && a.date === todayStr).length;
  document.getElementById("stat-trainings-today").textContent = todayTrainings;

  // Durchschnittspunkte
  const pts = activeAthletes.map((a) => getAthletePoints(a.id));
  const avg = pts.length
    ? Math.round(pts.reduce((s, p) => s + p, 0) / pts.length)
    : 0;
  document.getElementById("stat-avg-points").textContent = avg;

  // Gürtel-bereit (≥200 Punkte und nicht Schwarzgurt)
  const beltReady = activeAthletes.filter((a) => {
    const p = getAthletePoints(a.id);
    return p >= BELT_THRESHOLD && a.belt !== "black";
  });
  document.getElementById("stat-belt-ready").textContent = beltReady.length;

  // Rangliste
  const ranked = [...activeAthletes]
    .map((a) => ({ ...a, pts: getAthletePoints(a.id) }))
    .sort((a, b) => b.pts - a.pts);

  const rankList = document.getElementById("ranking-list");
  rankList.innerHTML = "";
  const maxPts = ranked[0]?.pts || 1;

  ranked.slice(0, 15).forEach((a, i) => {
    const pct = Math.min((a.pts / MAX_POINTS) * 100, 100);
    const rankClass = i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : "";
    const isBeltReady = a.pts >= BELT_THRESHOLD && a.belt !== "black";

    const el = document.createElement("div");
    el.className = "rank-item";
    el.innerHTML = `
      <div class="rank-num ${rankClass}">${i + 1}</div>
      <div class="rank-belt belt-${a.belt}"></div>
      <div class="rank-name">${esc(a.name)}</div>
      <div class="rank-bar-wrap">
        <div class="rank-bar" style="width:${pct}%"></div>
      </div>
      <div class="rank-pts">${a.pts}</div>
      ${isBeltReady ? `<div class="rank-belt-badge">🏆 ${BELT_NAMES[BELT_NEXT[a.belt]] || ""}</div>` : ""}
    `;
    el.addEventListener("click", () => openAthleteModal(a.id));
    rankList.appendChild(el);
  });

  // Gürtel-bereit Section
  const beltSection = document.getElementById("belt-ready-section");
  const beltList = document.getElementById("belt-ready-list");
  if (beltReady.length) {
    beltSection.style.display = "block";
    beltList.innerHTML = beltReady
      .map(
        (a) => `
      <div class="belt-ready-card" onclick="openAthleteModal('${a.id}')">
        <div class="rank-belt belt-${BELT_NEXT[a.belt]} rank-belt" style="width:28px;height:7px;border-radius:2px;flex-shrink:0"></div>
        <strong>${esc(a.name)}</strong>
        <span style="font-size:12px;color:var(--text3)">${getAthletePoints(a.id)} Punkte → ${BELT_NAMES[BELT_NEXT[a.belt]] || ""}</span>
      </div>
    `,
      )
      .join("");
  } else {
    beltSection.style.display = "none";
  }
}

// ─── ATHLETES GRID ────────────────────────────────────────────
function renderAthletesGrid(filter = "") {
  const grid = document.getElementById("athletes-grid");
  grid.innerHTML = "";

  const filtered = athletes.filter(
    (a) => !filter || a.name.toLowerCase().includes(filter.toLowerCase()),
  );

  if (!filtered.length) {
    grid.innerHTML =
      '<p style="color:var(--text3);grid-column:1/-1;padding:20px">Keine Athleten gefunden.</p>';
    return;
  }

  filtered.forEach((a) => {
    const pts = getAthletePoints(a.id);
    const pct = Math.min((pts / MAX_POINTS) * 100, 100);
    const ready = pts >= BELT_THRESHOLD && a.belt !== "black";

    const card = document.createElement("div");
    card.className = `athlete-card ${a.active === false ? "inactive" : ""}`;
    card.innerHTML = `
      ${ready ? '<div class="ac-belt-ready-dot"></div>' : ""}
      <div class="ac-belt belt-${a.belt}"></div>
      <div class="ac-name">${esc(a.name)}</div>
      <div class="ac-belt-label">${BELT_NAMES[a.belt] || a.belt}</div>
      <div class="ac-pts">${pts}</div>
      <div class="ac-pts-label">Punkte ${YEAR}</div>
      <div class="ac-progress">
        <div class="ac-progress-bar" style="width:${pct}%"></div>
      </div>
    `;
    card.addEventListener("click", () => openAthleteModal(a.id));
    grid.appendChild(card);
  });
}

// ─── ATHLETE SELECTS ──────────────────────────────────────────
function populateAthleteSelects() {
  const actives = athletes.filter((a) => a.active !== false);
  const opts =
    `<option value="">— Athlet wählen —</option>` +
    actives
      .map(
        (a) =>
          `<option value="${a.id}">${esc(a.name)} (${BELT_NAMES[a.belt]})</option>`,
      )
      .join("");

  document.getElementById("single-athlete").innerHTML = opts;
  document.getElementById("belt-athlete").innerHTML = opts;
}

function updateGroupCount() {
  const n = athletes.filter((a) => a.active !== false).length;
  document.getElementById("group-athlete-count").textContent = `${n} Athleten`;
}

// ─── HELPERS ──────────────────────────────────────────────────
function getAthletePoints(id) {
  return (activities[id] || []).reduce((s, a) => s + (a.points || 0), 0);
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── NAV ──────────────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-item")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    showView(btn.dataset.view);
  });
});

function showView(name) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  const v = document.getElementById(`view-${name}`);
  if (v) v.classList.add("active");
}

// ─── TRAINING ACTIONS ─────────────────────────────────────────

// Datum-Felder auf heute setzen
const today = new Date().toISOString().slice(0, 10);
document.getElementById("group-date").value = today;
document.getElementById("single-date").value = today;

// Gruppen-Training: alle aktiven Athleten +1
document
  .getElementById("btn-group-training")
  .addEventListener("click", async () => {
    const date = document.getElementById("group-date").value;
    const actives = athletes.filter((a) => a.active !== false);
    if (!actives.length) return toast("Keine aktiven Athleten", "err");

    const rows = actives.map((a) => ({
      athlete_id: a.id,
      type: "training",
      points: 1,
      date,
      note: "Gruppen-Training",
      created_by: currentUser.id,
    }));

    const { error } = await sb.from("activities").insert(rows);
    if (error) return toast("Fehler: " + error.message, "err");

    toast(`✓ ${actives.length} Athleten +1 Punkt eingetragen`, "ok");
    await loadActivities();
    renderAll();
  });

// Entry-Type Buttons
document.querySelectorAll(".entry-type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".entry-type-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedType = btn.dataset.type;
  });
});

// Einzel-Eintrag
document
  .getElementById("btn-single-entry")
  .addEventListener("click", async () => {
    const athleteId = document.getElementById("single-athlete").value;
    const date = document.getElementById("single-date").value;
    const note = document.getElementById("single-note").value.trim();

    if (!athleteId) return toast("Bitte einen Athleten wählen", "err");
    if (!date) return toast("Bitte ein Datum wählen", "err");

    const entry = ENTRY_TYPES[selectedType];
    const { error } = await sb.from("activities").insert({
      athlete_id: athleteId,
      type: selectedType,
      points: entry.points,
      date,
      note: note || entry.label,
      created_by: currentUser.id,
    });

    if (error) return toast("Fehler: " + error.message, "err");

    const a = athletes.find((a) => a.id === athleteId);
    const ptsStr = entry.points > 0 ? `+${entry.points}` : `${entry.points}`;
    toast(`${entry.icon} ${a?.name || "Athlet"} — ${ptsStr} Punkte`, "ok");
    document.getElementById("single-note").value = "";

    await loadActivities();
    renderAll();
  });

// Gürtel vergeben
document
  .getElementById("btn-belt-promote")
  .addEventListener("click", async () => {
    const athleteId = document.getElementById("belt-athlete").value;
    const newBelt = document.getElementById("belt-new").value;
    if (!athleteId) return toast("Bitte einen Athleten wählen", "err");

    const { error } = await sb
      .from("athletes")
      .update({ belt: newBelt })
      .eq("id", athleteId);
    if (error) return toast("Fehler: " + error.message, "err");

    const a = athletes.find((a) => a.id === athleteId);
    toast(`🥋 ${a?.name || "Athlet"} → ${BELT_NAMES[newBelt]}`, "ok");
    await loadAthletes();
    renderAll();
  });

// Athlet anlegen
document
  .getElementById("btn-add-athlete")
  .addEventListener("click", async () => {
    const name = document.getElementById("new-name").value.trim();
    const email = document.getElementById("new-email").value.trim();
    const belt = document.getElementById("new-belt").value;
    const by = document.getElementById("new-birthyear").value;

    if (!name) return showAddMsg("Name ist erforderlich.", "error");

    const { error } = await sb.from("athletes").insert({
      name,
      email: email || null,
      belt,
      birth_year: by || null,
      active: true,
      created_by: currentUser.id,
    });

    if (error) return showAddMsg("Fehler: " + error.message, "error");

    showAddMsg(`✓ ${name} wurde angelegt!`, "success");
    document.getElementById("new-name").value = "";
    document.getElementById("new-email").value = "";
    document.getElementById("new-birthyear").value = "";
    document.getElementById("new-belt").value = "white";

    await loadAthletes();
    renderAll();
  });

// Suche
document.getElementById("search-athletes").addEventListener("input", (e) => {
  renderAthletesGrid(e.target.value);
});

// ─── ATHLETE MODAL ────────────────────────────────────────────
window.openAthleteModal = function (athleteId) {
  const a = athletes.find((x) => x.id === athleteId);
  if (!a) return;
  openAthleteId = athleteId;

  const acts = activities[athleteId] || [];
  const pts = acts.reduce((s, x) => s + (x.points || 0), 0);
  const trainings = acts.filter((x) => x.type === "training").length;
  const tournaments = acts.filter((x) => x.type === "tournament").length;
  const penalties = acts.filter((x) => x.points < 0).length;
  const pct = Math.min((trainings / MAX_POINTS) * 100, 100);

  document.getElementById("modal-name").textContent = a.name;
  document.getElementById("modal-belt-label").textContent =
    BELT_NAMES[a.belt] || a.belt;
  document.getElementById("modal-points").textContent = pts;
  document.getElementById("ms-trainings").textContent = trainings;
  document.getElementById("ms-tournaments").textContent = tournaments;
  document.getElementById("ms-penalties").textContent = penalties;
  document.getElementById("modal-progress-bar").style.width = pct + "%";
  document.getElementById("modal-progress-label").textContent =
    `${trainings} Trainings`;

  // Belt bar color
  const bar = document.getElementById("modal-belt-bar");
  bar.className = `modal-belt-bar belt-${a.belt}`;

  // History
  const hist = document.getElementById("modal-history");
  hist.innerHTML =
    acts.length === 0
      ? '<p style="color:var(--text3);font-size:13px;padding:8px">Noch keine Einträge.</p>'
      : acts
          .slice(0, 40)
          .map((x) => {
            const e = ENTRY_TYPES[x.type] || {
              label: x.type,
              icon: "●",
              points: x.points,
            };
            const pos = x.points >= 0;
            const pStr = pos ? `+${x.points}` : `${x.points}`;
            return `
          <div class="hist-item ${x.type}">
            <span class="hist-icon">${e.icon}</span>
            <div class="hist-info">
              <div class="hist-title">${esc(x.note || e.label)}</div>
              <div class="hist-date">${x.date}</div>
            </div>
            <div class="hist-pts ${pos ? "pos" : "neg"}">${pStr}</div>
          </div>
        `;
          })
          .join("");

  // Deactivate button text
  const btn = document.getElementById("btn-deactivate-athlete");
  btn.textContent =
    a.active === false ? "Athlet reaktivieren" : "Athlet deaktivieren";

  document.getElementById("modal-overlay").classList.add("open");
};

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  openAthleteId = null;
}

document
  .getElementById("btn-deactivate-athlete")
  .addEventListener("click", async () => {
    if (!openAthleteId) return;
    const a = athletes.find((x) => x.id === openAthleteId);
    const active = a?.active !== false ? false : true;
    const { error } = await sb
      .from("athletes")
      .update({ active })
      .eq("id", openAthleteId);
    if (error) return toast("Fehler: " + error.message, "err");
    toast(`${a.name} ${active ? "reaktiviert" : "deaktiviert"}`, "ok");
    closeModal();
    await loadAthletes();
    renderAll();
  });

// ─── UI HELPERS ───────────────────────────────────────────────
function showScreen(name) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  const s = document.getElementById(`screen-${name}`);
  if (s) s.classList.add("active");
  if (name === "app") s.style.display = "flex";
}

function showLoginMsg(msg, type) {
  const el = document.getElementById("login-msg");
  el.textContent = msg;
  el.className = `login-msg ${type || ""}`;
}

function showAddMsg(msg, type) {
  const el = document.getElementById("add-msg");
  el.textContent = msg;
  el.className = `add-msg ${type || ""}`;
  setTimeout(() => {
    el.textContent = "";
  }, 3000);
}

let toastTimer;
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 3000);
}
