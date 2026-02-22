// ============================================================
// BJJ PUNKTE SYSTEM — app.js
// Supabase Auth + Punkte-Tracking + Leaderboard
// ============================================================

// ─── SUPABASE CONFIG ─────────────────────────────────────────
// WICHTIG: Ersetze diese Werte mit deinen Supabase-Credentials!
// Umgebungsvariablen für Netlify: VITE_ oder direkt eintragen
const SUPABASE_URL = window.ENV_SUPABASE_URL || "DEINE_SUPABASE_URL_HIER";
const SUPABASE_ANON_KEY =
  window.ENV_SUPABASE_ANON_KEY || "DEIN_SUPABASE_ANON_KEY_HIER";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── CONSTANTS ───────────────────────────────────────────────
const MAX_POINTS = 192; // 4 mal / Woche * 48 Wochen
const BELT_THRESHOLD = 200; // Punkte für Gürtel-Aufstieg (inkl. Turnierpunkte)
const TOURNAMENT_POINTS = 50;
const TRAINING_POINTS = 1;

const BELTS = [
  { key: "white", name: "Weißgurt", next: "Blaugurt", threshold: 200 },
  { key: "blue", name: "Blaugurt", next: "Lillagurt", threshold: 200 },
  { key: "purple", name: "Lillagurt", next: "Braungurt", threshold: 200 },
  { key: "brown", name: "Braungurt", next: "Schwarzgurt", threshold: 200 },
  { key: "black", name: "Schwarzgurt", next: null, threshold: null },
];

// ─── STATE ───────────────────────────────────────────────────
let currentUser = null;
let currentProfile = null;
let currentActivities = [];
let lastActivityId = null;

// ─── INIT ─────────────────────────────────────────────────────
(async () => {
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session) {
    await onLogin(session.user);
  } else {
    showScreen("auth");
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session) {
      await onLogin(session.user);
    } else if (event === "SIGNED_OUT") {
      showScreen("auth");
    }
  });
})();

// ─── AUTH EVENTS ─────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".auth-form")
      .forEach((f) => f.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`${btn.dataset.tab}-form`).classList.add("active");
    setAuthMessage("", "");
  });
});

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password)
    return setAuthMessage("Bitte alle Felder ausfüllen.", "error");

  setAuthMessage("Wird eingeloggt…", "");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) setAuthMessage(error.message, "error");
});

document.getElementById("btn-register").addEventListener("click", async () => {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const belt = document.getElementById("reg-belt").value;

  if (!name || !email || !password)
    return setAuthMessage("Bitte alle Felder ausfüllen.", "error");
  if (password.length < 6)
    return setAuthMessage("Passwort mindestens 6 Zeichen.", "error");

  setAuthMessage("Account wird erstellt…", "");

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, belt } },
  });

  if (error) return setAuthMessage(error.message, "error");

  // Profil anlegen
  if (data.user) {
    await sb.from("profiles").upsert({
      id: data.user.id,
      full_name: name,
      email,
      belt,
      created_at: new Date().toISOString(),
    });
    setAuthMessage("✓ Account erstellt! Du wirst eingeloggt…", "success");
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await sb.auth.signOut();
});

// ─── ON LOGIN ─────────────────────────────────────────────────
async function onLogin(user) {
  currentUser = user;
  await loadProfile();
  await loadActivities();
  renderAll();
  showScreen("app");

  // Realtime für Leaderboard
  sb.channel("public:activities")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activities" },
      () => {
        loadLeaderboard();
      },
    )
    .subscribe();
}

// ─── DATA LOADING ─────────────────────────────────────────────
async function loadProfile() {
  const { data } = await sb
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (data) {
    currentProfile = data;
  } else {
    // Fallback: Profil aus User-Metadata
    const meta = currentUser.user_metadata;
    currentProfile = {
      id: currentUser.id,
      full_name: meta.full_name || currentUser.email.split("@")[0],
      email: currentUser.email,
      belt: meta.belt || "white",
    };
    await sb.from("profiles").upsert(currentProfile);
  }
}

async function loadActivities() {
  const year = new Date().getFullYear();
  const { data } = await sb
    .from("activities")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("created_at", `${year}-01-01`)
    .order("created_at", { ascending: false });

  currentActivities = data || [];
}

async function loadLeaderboard() {
  const year = new Date().getFullYear();

  // Punkte pro User für das aktuelle Jahr
  const { data } = await sb
    .from("activities")
    .select("user_id, points, profiles(full_name, belt)")
    .gte("created_at", `${year}-01-01`);

  if (!data) return;

  // Aggregieren
  const aggregated = {};
  data.forEach((row) => {
    const uid = row.user_id;
    if (!aggregated[uid]) {
      aggregated[uid] = {
        uid,
        name: row.profiles?.full_name || "Unbekannt",
        belt: row.profiles?.belt || "white",
        points: 0,
      };
    }
    aggregated[uid].points += row.points;
  });

  const sorted = Object.values(aggregated).sort((a, b) => b.points - a.points);
  renderLeaderboard(sorted);
}

// ─── ACTIONS ──────────────────────────────────────────────────
document
  .getElementById("btn-add-training")
  .addEventListener("click", async () => {
    await addActivity("training", TRAINING_POINTS);
  });

document
  .getElementById("btn-add-tournament")
  .addEventListener("click", async () => {
    await addActivity("tournament", TOURNAMENT_POINTS);
  });

document.getElementById("btn-undo").addEventListener("click", async () => {
  if (!lastActivityId) return;
  const { error } = await sb
    .from("activities")
    .delete()
    .eq("id", lastActivityId);
  if (!error) {
    showToast("Eintrag rückgängig gemacht", "");
    lastActivityId = null;
    document.getElementById("btn-undo").disabled = true;
    await loadActivities();
    renderAll();
    loadLeaderboard();
  }
});

async function addActivity(type, points) {
  const today = new Date().toISOString();
  const label = type === "training" ? "Training" : "Turnier";

  const { data, error } = await sb
    .from("activities")
    .insert({
      user_id: currentUser.id,
      type,
      points,
      created_at: today,
    })
    .select()
    .single();

  if (error) {
    showToast("Fehler: " + error.message, "");
    return;
  }

  lastActivityId = data.id;
  document.getElementById("btn-undo").disabled = false;

  await loadActivities();
  renderAll();
  loadLeaderboard();

  if (type === "training") {
    showToast(`🥋 Training eingetragen! +${points} Punkt`, "success");
  } else {
    showToast(`🏅 Turnier eingetragen! +${points} Punkte`, "tournament");
  }

  // Punkte-Animation
  const pd = document.getElementById("points-display");
  pd.classList.remove("pulse");
  void pd.offsetWidth;
  pd.classList.add("pulse");
}

// ─── RENDER ────────────────────────────────────────────────────
function renderAll() {
  if (!currentProfile) return;

  const year = new Date().getFullYear();
  const totalPoints = currentActivities.reduce(
    (s, a) => s + (a.points || 0),
    0,
  );
  const trainingCount = currentActivities.filter(
    (a) => a.type === "training",
  ).length;
  const tournamentCount = currentActivities.filter(
    (a) => a.type === "tournament",
  ).length;

  // Header
  document.getElementById("header-username").textContent =
    currentProfile.full_name;
  document.getElementById("header-year").textContent = year;
  document.getElementById("points-year").textContent = year;
  document.getElementById("lb-year").textContent = year;

  // Points
  document.getElementById("points-display").textContent = totalPoints;

  // Progress Bar
  const pct = Math.min((totalPoints / MAX_POINTS) * 100, 100);
  document.getElementById("progress-bar").style.width = pct + "%";
  document.getElementById("progress-label").textContent =
    Math.round(pct) + "% abgeschlossen";
  const sessionsLeft = Math.max(0, MAX_POINTS - trainingCount);
  document.getElementById("sessions-left").textContent =
    sessionsLeft + " Trainings übrig";

  // Belt
  const belt = getBeltInfo(currentProfile.belt);
  document.getElementById("belt-name").textContent = belt.name;
  const beltVisual = document.getElementById("belt-visual");
  beltVisual.className = "belt-visual " + currentProfile.belt;
  if (belt.next) {
    document.getElementById("belt-next-info").textContent =
      `→ Nächster Gürtel: ${belt.next} (${BELT_THRESHOLD} Punkte)`;
  } else {
    document.getElementById("belt-next-info").textContent =
      "Höchster Gürtel erreicht 🏆";
  }

  // Belt Achievement
  const achievementEl = document.getElementById("belt-achievement");
  if (totalPoints >= BELT_THRESHOLD && belt.next) {
    achievementEl.style.display = "block";
    document.getElementById("achievement-sub").textContent =
      `${totalPoints} Punkte erreicht – bereit für den ${belt.next}!`;
  } else {
    achievementEl.style.display = "none";
  }

  // Stats
  document.getElementById("stat-trainings").textContent = trainingCount;
  document.getElementById("stat-tournaments").textContent = tournamentCount;

  // Diese Woche
  const weekStart = getWeekStart();
  const weekCount = currentActivities.filter(
    (a) => a.type === "training" && new Date(a.created_at) >= weekStart,
  ).length;
  document.getElementById("stat-week").textContent = weekCount;

  // Streak (vereinfacht: Wochen mit mind. 1 Training in Folge)
  document.getElementById("stat-streak").textContent =
    calcStreak(currentActivities);

  // History
  renderHistory();

  // Leaderboard laden
  loadLeaderboard();
}

function renderHistory() {
  const list = document.getElementById("history-list");
  document.getElementById("history-count").textContent =
    currentActivities.length;

  if (currentActivities.length === 0) {
    list.innerHTML =
      '<div class="empty-state">Noch keine Einträge – fang mit dem nächsten Training an!</div>';
    return;
  }

  list.innerHTML = currentActivities
    .slice(0, 30)
    .map((a) => {
      const date = new Date(a.created_at);
      const dateStr = date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const isTournament = a.type === "tournament";
      return `
      <div class="history-item ${isTournament ? "tournament-item" : "training-item"}">
        <span class="history-icon">${isTournament ? "🏅" : "🥋"}</span>
        <div class="history-info">
          <div class="history-title">${isTournament ? "Turnier" : "Training"}</div>
          <div class="history-date">${dateStr} · ${timeStr}</div>
        </div>
        <div class="history-points ${isTournament ? "" : "training-pts"}">+${a.points}</div>
      </div>
    `;
    })
    .join("");
}

function renderLeaderboard(data) {
  const list = document.getElementById("leaderboard-list");
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="empty-state">Noch keine Daten.</div>';
    return;
  }

  const rankClasses = ["gold", "silver", "bronze"];

  list.innerHTML = data
    .slice(0, 10)
    .map(
      (u, i) => `
    <div class="lb-item">
      <div class="lb-rank ${rankClasses[i] || ""}">${i + 1}</div>
      <div class="lb-belt ${u.belt}"></div>
      <div class="lb-name ${u.uid === currentUser?.id ? "is-me" : ""}">
        ${u.name}${u.uid === currentUser?.id ? " (Du)" : ""}
      </div>
      <div class="lb-points">${u.points}</div>
    </div>
  `,
    )
    .join("");
}

// ─── HELPERS ───────────────────────────────────────────────────
function getBeltInfo(key) {
  return BELTS.find((b) => b.key === key) || BELTS[0];
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Montag
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function calcStreak(activities) {
  // Zählt Wochen mit mind. 1 Training in Folge (rückwärts von heute)
  const trainings = activities
    .filter((a) => a.type === "training")
    .map((a) => new Date(a.created_at));

  if (trainings.length === 0) return 0;

  let streak = 0;
  let checkDate = getWeekStart();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < 52; i++) {
    const weekEnd = new Date(checkDate.getTime() + msPerWeek);
    const hasTraining = trainings.some((d) => d >= checkDate && d < weekEnd);
    if (hasTraining) {
      streak++;
      checkDate = new Date(checkDate.getTime() - msPerWeek);
    } else {
      break;
    }
  }
  return streak;
}

function showScreen(name) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(`${name}-screen`).classList.add("active");
}

function setAuthMessage(msg, type) {
  const el = document.getElementById("auth-message");
  el.textContent = msg;
  el.className = "auth-message" + (type ? " " + type : "");
}

let toastTimeout;
function showToast(msg, type) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    t.className = "toast";
  }, 2800);
}
