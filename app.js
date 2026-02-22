// ============================================================
// BJJ TRAINER APP — app.js  (mobile-first rewrite)
// ============================================================

const LOCAL_SUPABASE_URL = "https://ktwgvuasjezokhsfpfqb.supabase.c";
const LOCAL_SUPABASE_ANON_KEY =
  "sb_publishable_Ep1SfoAKBOgshy1A6c--9g_Qjx0T1LL";

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
  setLoginMsg("⚠ Supabase nicht konfiguriert.", "error");
  throw new Error("No Supabase config");
}

// ── CONSTANTS ───────────────────────────────────────────────
const MAX_PTS = 192;
const BELT_THRESHOLD = 200;
const YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);

const BELT_NAMES = {
  white: "Weißgurt",
  blue: "Blaugurt",
  purple: "Lillagurt",
  brown: "Braungurt",
  black: "Schwarzgurt",
};
const BELT_ORDER = ["white", "blue", "purple", "brown", "black"];
const BELT_NEXT = {
  white: "blue",
  blue: "purple",
  purple: "brown",
  brown: "black",
  black: null,
};

const TYPES = {
  training: { label: "Training", icon: "🥋", pts: 1 },
  tournament: { label: "Turnier", icon: "🏅", pts: 50 },
  penalty: { label: "Verwarnung", icon: "⚠️", pts: -5 },
  misconduct: { label: "Fehlverhalten", icon: "🚫", pts: -20 },
};

// ── STATE ────────────────────────────────────────────────────
let currentUser = null;
let athletes = [];
let activitiesMap = {}; // { athlete_id: [...] }
let openAthleteId = null;
let selectedNewBelt = "white";
let selectedPromoteBelt = "blue";
let selectedModalBelt = "blue";

// ── INIT ─────────────────────────────────────────────────────
(async () => {
  await initSupabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session) await doLogin(session.user);
  else showScreen("login");

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session) await doLogin(session.user);
    if (event === "SIGNED_OUT") showScreen("login");
  });
})();

// ── LOGIN ────────────────────────────────────────────────────
$("btn-login").addEventListener("click", login);
$("login-password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
$("btn-logout").addEventListener("click", () => sb.auth.signOut());

async function login() {
  const email = $("login-email").value.trim();
  const password = $("login-password").value;
  if (!email || !password)
    return setLoginMsg("Bitte alle Felder ausfüllen.", "error");
  setLoginMsg("…", "");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error)
    return setLoginMsg(
      error.message.includes("Invalid login")
        ? "E-Mail oder Passwort falsch."
        : error.message,
      "error",
    );
  if (data?.user) await doLogin(data.user);
}

async function doLogin(user) {
  currentUser = user;
  const { data: profile } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile?.is_trainer) {
    await sb.auth.signOut();
    return setLoginMsg("Kein Trainer-Account. Zugriff verweigert.", "error");
  }
  $("topbar-trainer").textContent =
    profile.full_name || user.email.split("@")[0];
  $("rank-year").textContent = YEAR;
  await loadAll();
  showScreen("app");
  showView("dashboard");
}

// ── DATA ─────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadAthletes(), loadActivities()]);
  renderAll();
}

async function loadAthletes() {
  const { data } = await sb.from("athletes").select("*").order("name");
  athletes = data || [];
}

async function loadActivities() {
  const { data } = await sb
    .from("activities")
    .select("*")
    .gte("date", `${YEAR}-01-01`)
    .lte("date", `${YEAR}-12-31`)
    .order("date", { ascending: false });
  activitiesMap = {};
  (data || []).forEach((a) => {
    if (!activitiesMap[a.athlete_id]) activitiesMap[a.athlete_id] = [];
    activitiesMap[a.athlete_id].push(a);
  });
}

function getPoints(id) {
  return (activitiesMap[id] || []).reduce((s, a) => s + (a.points || 0), 0);
}

// ── RENDER ALL ───────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderAthletesList();
  renderBeltAthleteSelect();
  setGroupLabel();
}

// ── DASHBOARD ────────────────────────────────────────────────
function renderDashboard() {
  const active = athletes.filter((a) => a.active !== false);

  $("stat-athletes").textContent = active.length;

  const todayActs = Object.values(activitiesMap)
    .flat()
    .filter((a) => a.type === "training" && a.date === TODAY).length;
  $("stat-today").textContent = todayActs;

  const beltReady = active.filter(
    (a) => getPoints(a.id) >= BELT_THRESHOLD && a.belt !== "black",
  );
  $("stat-belt-ready").textContent = beltReady.length;

  const pts = active.map((a) => getPoints(a.id));
  $("stat-avg").textContent = pts.length
    ? Math.round(pts.reduce((s, p) => s + p, 0) / pts.length)
    : 0;

  // Belt alert
  const alert = $("belt-alert");
  if (beltReady.length) {
    alert.style.display = "flex";
    $("ba-names").textContent = beltReady
      .map((a) => `${a.name} → ${BELT_NAMES[BELT_NEXT[a.belt]]}`)
      .join(", ");
  } else {
    alert.style.display = "none";
  }

  // Ranking – grouped by belt (black first → white last)
  const rankList = $("ranking-list");
  rankList.innerHTML = "";

  const beltOrder = ["black", "brown", "purple", "blue", "white"];
  beltOrder.forEach((belt) => {
    const group = active
      .filter((a) => a.belt === belt)
      .map((a) => ({ ...a, pts: getPoints(a.id) }))
      .sort((a, b) => b.pts - a.pts);
    if (!group.length) return;

    // Group header
    const hd = document.createElement("div");
    hd.className = "rank-group-hd";
    hd.innerHTML = `
      <div class="rgh-belt belt-${belt}"></div>
      <div class="rgh-label">${BELT_NAMES[belt]}</div>
      <div class="rgh-count">${group.length} Athleten</div>
    `;
    rankList.appendChild(hd);

    group.forEach((a, i) => {
      const pct = Math.min((a.pts / MAX_PTS) * 100, 100);
      const ready = a.pts >= BELT_THRESHOLD && a.belt !== "black";
      const div = document.createElement("div");
      div.className = "rank-row";
      div.innerHTML = `
        <div class="rr-num">${i + 1}</div>
        <div class="rr-name">${esc(a.name)}</div>
        <div class="rr-bar-wrap"><div class="rr-bar" style="width:${pct}%"></div></div>
        <div class="rr-pts">${a.pts}</div>
        ${ready ? `<div class="rr-badge">🏆</div>` : ""}
      `;
      div.addEventListener("click", () => openModal(a.id));
      rankList.appendChild(div);
    });
  });
}

// ── ATHLETES VIEW ────────────────────────────────────────────
function renderAthletesList(filter = "") {
  const list = $("athletes-list");
  list.innerHTML = "";
  const filtered = athletes.filter(
    (a) => !filter || a.name.toLowerCase().includes(filter.toLowerCase()),
  );
  if (!filtered.length) {
    list.innerHTML =
      '<div style="padding:24px 16px;text-align:center;color:var(--text3);font-size:14px">Keine Athleten gefunden</div>';
    return;
  }
  filtered.forEach((a) => {
    const pts = getPoints(a.id);
    const pct = Math.min((pts / MAX_PTS) * 100, 100);
    const ready = pts >= BELT_THRESHOLD && a.belt !== "black";
    const row = document.createElement("div");
    row.className = `athlete-row${a.active === false ? " inactive" : ""}`;
    row.innerHTML = `
      <div class="ar-belt belt-${a.belt}"></div>
      <div class="ar-info">
        <div class="ar-name">${esc(a.name)}</div>
        <div class="ar-belt-lbl">${BELT_NAMES[a.belt] || a.belt}</div>
      </div>
      <div class="ar-quick">
        <button class="ar-btn minus" data-id="${a.id}" title="−1 Punkt">−</button>
        <span class="ar-pts-inline">${pts}</span>
        <button class="ar-btn plus" data-id="${a.id}" title="Training +1">+</button>
      </div>
      <div class="ar-prog-wrap">
        <div class="ar-prog"><div class="ar-prog-fill" style="width:${pct}%"></div></div>
        ${ready ? '<div class="ar-belt-ready"></div>' : ""}
      </div>
    `;
    // Quick +1 training
    row.querySelector(".ar-btn.plus").addEventListener("click", async (e) => {
      e.stopPropagation();
      await quickEntry(a.id, "training");
    });
    // Quick -1 Punkt
    row.querySelector(".ar-btn.minus").addEventListener("click", async (e) => {
      e.stopPropagation();
      await quickEntryCustom(a.id, "penalty", -1, "−1 Punkt");
    });
    row.addEventListener("click", () => openModal(a.id));
    list.appendChild(row);
  });
}

// ── GROUP TRAINING ───────────────────────────────────────────
function setGroupLabel() {
  const n = athletes.filter((a) => a.active !== false).length;
  $("quick-count-label").textContent = `${n} Athleten · +1 Punkt`;
}

$("btn-quick-group").addEventListener("click", async () => {
  const active = athletes.filter((a) => a.active !== false);
  if (!active.length) return toast("Keine aktiven Athleten", "err");

  const rows = active.map((a) => ({
    athlete_id: a.id,
    type: "training",
    points: 1,
    date: TODAY,
    note: "Gruppen-Training",
    created_by: currentUser.id,
  }));

  const { error } = await sb.from("activities").insert(rows);
  if (error) return toast("Fehler: " + error.message, "err");

  toast(`🥋 Gruppen-Training · ${active.length} Athleten +1`, "ok");
  await loadActivities();
  renderAll();
});

// ── ADD ATHLETE ──────────────────────────────────────────────
// Belt picker (new athlete)
document.querySelectorAll("#belt-picker .bg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll("#belt-picker .bg-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedNewBelt = btn.dataset.belt;
  });
});

$("btn-add-athlete").addEventListener("click", async () => {
  const name = $("new-name").value.trim();
  if (!name) return showAddMsg("Name ist erforderlich.", "error");

  const { error } = await sb.from("athletes").insert({
    name,
    email: $("new-email").value.trim() || null,
    belt: selectedNewBelt,
    birth_year: $("new-birthyear").value || null,
    active: true,
    created_by: currentUser.id,
  });
  if (error) return showAddMsg("Fehler: " + error.message, "error");

  showAddMsg(`✓ ${name} angelegt!`, "success");
  $("new-name").value = "";
  $("new-email").value = "";
  $("new-birthyear").value = "";
  setTimeout(() => showAddMsg("", ""), 2500);

  await loadAthletes();
  renderAll();
});

// Belt promote
document.querySelectorAll("#promote-picker .bg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll("#promote-picker .bg-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedPromoteBelt = btn.dataset.belt;
  });
});

function renderBeltAthleteSelect() {
  const sel = $("belt-athlete");
  const val = sel.value;
  sel.innerHTML =
    '<option value="">— Athlet wählen —</option>' +
    athletes
      .filter((a) => a.active !== false)
      .map(
        (a) =>
          `<option value="${a.id}">${esc(a.name)} · ${BELT_NAMES[a.belt]}</option>`,
      )
      .join("");
  if (val) sel.value = val;
}

$("btn-belt-promote").addEventListener("click", async () => {
  const id = $("belt-athlete").value;
  if (!id) return toast("Athlet wählen", "err");
  const { error } = await sb
    .from("athletes")
    .update({ belt: selectedPromoteBelt })
    .eq("id", id);
  if (error) return toast("Fehler: " + error.message, "err");
  const a = athletes.find((x) => x.id === id);
  toast(`🥋 ${a?.name} → ${BELT_NAMES[selectedPromoteBelt]}`, "ok");
  await loadAthletes();
  renderAll();
});

// ── NAV ──────────────────────────────────────────────────────
document.querySelectorAll(".bnav").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".bnav")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    showView(btn.dataset.view);
  });
});

$("btn-goto-add").addEventListener("click", () => {
  document
    .querySelectorAll(".bnav")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector('.bnav[data-view="add"]').classList.add("active");
  showView("add");
});

// Search athletes
$("search-athletes").addEventListener("input", (e) =>
  renderAthletesList(e.target.value),
);

// ── MODAL ────────────────────────────────────────────────────
function openModal(athleteId) {
  const a = athletes.find((x) => x.id === athleteId);
  if (!a) return;
  openAthleteId = athleteId;

  const acts = activitiesMap[athleteId] || [];
  const pts = acts.reduce((s, x) => s + (x.points || 0), 0);
  const trainings = acts.filter((x) => x.type === "training").length;
  const tournaments = acts.filter((x) => x.type === "tournament").length;
  const penalties = acts.filter((x) => x.points < 0).length;
  const pct = Math.min((trainings / MAX_PTS) * 100, 100);

  $("modal-name").textContent = a.name;
  $("modal-belt-lbl").textContent = BELT_NAMES[a.belt] || a.belt;
  $("modal-pts").textContent = pts;
  $("ms-trainings").textContent = trainings;
  $("ms-tournaments").textContent = tournaments;
  $("ms-penalties").textContent = penalties;
  $("modal-prog-fill").style.width = pct + "%";
  $("modal-prog-txt").textContent = `${trainings} Trainings`;

  const bar = $("modal-belt-bar");
  bar.className = `modal-belt-bar belt-${a.belt}`;

  // Modal belt picker
  const nextBelt = BELT_NEXT[a.belt];
  selectedModalBelt = nextBelt || a.belt;
  const grid = $("modal-belt-grid");
  grid.innerHTML = BELT_ORDER.filter((b) => b !== a.belt)
    .map(
      (b) => `
    <button class="bg-btn${b === selectedModalBelt ? " active" : ""}" data-belt="${b}" id="mbi-${b}">
      <span class="bg-dot ${b}"></span>${BELT_NAMES[b].replace("gurt", "")}
    </button>
  `,
    )
    .join("");
  grid.querySelectorAll(".bg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      grid
        .querySelectorAll(".bg-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedModalBelt = btn.dataset.belt;
    });
  });

  // History
  const hist = $("modal-history");
  hist.innerHTML =
    acts.length === 0
      ? '<div style="padding:8px;color:var(--text3);font-size:13px">Noch keine Einträge</div>'
      : acts
          .slice(0, 40)
          .map((x) => {
            const t = TYPES[x.type] || { label: x.type, icon: "●" };
            const pos = x.points >= 0;
            return `
          <div class="hist-row ${x.type}">
            <span class="hist-ico">${t.icon}</span>
            <div class="hist-info">
              <div class="hist-title">${esc(x.note || t.label)}</div>
              <div class="hist-date">${x.date}</div>
            </div>
            <div class="hist-pts ${pos ? "pos" : "neg"}">${pos ? "+" : ""}${x.points}</div>
          </div>`;
          })
          .join("");

  $("btn-deactivate").textContent =
    a.active === false ? "Athlet reaktivieren" : "Athlet deaktivieren";

  // ── Modal quick-entry buttons ─────────────────────────────
  document.querySelectorAll(".mqs-btn").forEach((btn) => {
    // Clone to remove old listeners
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", async () => {
      if (!openAthleteId) return;
      const t = TYPES[fresh.dataset.type];
      if (!t) return;
      const { error } = await sb.from("activities").insert({
        athlete_id: openAthleteId,
        type: fresh.dataset.type,
        points: t.pts,
        date: TODAY,
        note: t.label,
        created_by: currentUser.id,
      });
      if (error) return toast("Fehler", "err");
      const athlete = athletes.find((x) => x.id === openAthleteId);
      toast(
        `${t.icon} ${athlete?.name} · ${t.pts > 0 ? "+" : ""}${t.pts}`,
        "ok",
      );
      await loadActivities();
      renderAll();
      openModal(openAthleteId); // refresh modal with updated pts
    });
  });

  $("modal").classList.add("open");
}

// ── Quick entry helper ───────────────────────────────────────
async function quickEntry(athleteId, type) {
  const t = TYPES[type];
  await quickEntryCustom(athleteId, type, t.pts, t.label);
}

async function quickEntryCustom(athleteId, type, pts, note) {
  const t = TYPES[type];
  const { error } = await sb.from("activities").insert({
    athlete_id: athleteId,
    type,
    points: pts,
    date: TODAY,
    note,
    created_by: currentUser.id,
  });
  if (error) return toast("Fehler: " + error.message, "err");
  const a = athletes.find((x) => x.id === athleteId);
  const icon = t?.icon || "●";
  toast(`${icon} ${a?.name} · ${pts > 0 ? "+" : ""}${pts}`, "ok");
  await loadActivities();
  renderAll();
  if (openAthleteId === athleteId) openModal(athleteId);
}

// Belt from modal
$("modal-belt-btn").addEventListener("click", async () => {
  if (!openAthleteId) return;
  const { error } = await sb
    .from("athletes")
    .update({ belt: selectedModalBelt })
    .eq("id", openAthleteId);
  if (error) return toast("Fehler", "err");
  const a = athletes.find((x) => x.id === openAthleteId);
  toast(`🥋 ${a?.name} → ${BELT_NAMES[selectedModalBelt]}`, "ok");
  await loadAthletes();
  renderAll();
  openModal(openAthleteId);
});

// Deactivate
$("btn-deactivate").addEventListener("click", async () => {
  if (!openAthleteId) return;
  const a = athletes.find((x) => x.id === openAthleteId);
  const newActive = a?.active === false ? true : false;
  await sb
    .from("athletes")
    .update({ active: newActive })
    .eq("id", openAthleteId);
  toast(`${a.name} ${newActive ? "reaktiviert" : "deaktiviert"}`, "ok");
  closeModal();
  await loadAthletes();
  renderAll();
});

$("btn-close-modal").addEventListener("click", closeModal);
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) closeModal();
});

function closeModal() {
  $("modal").classList.remove("open");
  openAthleteId = null;
}

// ── HELPERS ──────────────────────────────────────────────────
function $(id) {
  return document.getElementById(id);
}
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.remove("active");
    s.style.display = "";
  });
  const s = $(`screen-${name}`);
  if (s) {
    s.classList.add("active");
    if (name === "app") s.style.display = "flex";
  }
}

function showView(name) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  const v = $(`view-${name}`);
  if (v) v.classList.add("active");
  // Scroll to top
  const body = document.querySelector(".app-body");
  if (body) body.scrollTop = 0;
}

function setLoginMsg(msg, type) {
  const el = $("login-msg");
  el.textContent = msg;
  el.className = `form-msg ${type || ""}`;
}

function showAddMsg(msg, type) {
  const el = $("add-msg");
  el.textContent = msg;
  el.className = `form-msg center ${type || ""}`;
}

let toastTimer;
function toast(msg, type = "") {
  const el = $("toast");
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 3000);
}

// ── EOF ──────────────────────────────────────────────────────
