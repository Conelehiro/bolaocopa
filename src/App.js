import { useState, useEffect, useRef } from "react";

// ─── SUPABASE STORAGE ADAPTER ──────────────────────────────────────────────────
// Reads/writes a shared key-value table so ALL participants see the same data
// (users, matches, predictions) in real time, regardless of device or browser.
const SUPABASE_URL = "https://ggjjysldvldpshvilcnr.supabase.co";
const SUPABASE_KEY = "sb_publishable_O76sReUKmdK-6mUS5uohBA_BqqmS-wC";
const SUPABASE_HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

const storage = {
  async get(key) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/bolao_data?key=eq.${encodeURIComponent(key)}&select=key,value`,
        { headers: SUPABASE_HEADERS }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows.length) return null;
      return { key, value: rows[0].value };
    } catch { return null; }
  },
  async set(key, value) {
    try {
      // Check if the key already exists
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/bolao_data?key=eq.${encodeURIComponent(key)}&select=key`,
        { headers: SUPABASE_HEADERS }
      );
      const existing = checkRes.ok ? await checkRes.json() : [];

      if (existing.length > 0) {
        // UPDATE
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/bolao_data?key=eq.${encodeURIComponent(key)}`,
          { method: "PATCH", headers: SUPABASE_HEADERS, body: JSON.stringify({ value }) }
        );
        if (!res.ok) return null;
      } else {
        // INSERT
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/bolao_data`,
          { method: "POST", headers: SUPABASE_HEADERS, body: JSON.stringify({ key, value }) }
        );
        if (!res.ok) return null;
      }
      return { key, value };
    } catch { return null; }
  },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PHASE_MULTIPLIERS = {
  "Fase de Grupos": 1,
  "Segunda Fase": 2,
  "Oitavas de Final": 4,
  "Quartas de Final": 8,
  "Semifinal": 16,
  "Disputa 3º Lugar": 16,
  "Final": 32,
};
const BASE_POINTS = { exact: 10, winner: 5 };
const LOCK_MINUTES_BEFORE = 10;
const NOTIFY_MINUTES_BEFORE = 30;

const INITIAL_MATCHES = [
  // ── Fase de Grupos ──
  { id: 1,  phase: "Fase de Grupos", group: "A", date: "2026-06-11", time: "15:00", home: "🇺🇸 EUA",       away: "🇲🇽 México",      homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 2,  phase: "Fase de Grupos", group: "A", date: "2026-06-11", time: "18:00", home: "🇨🇦 Canadá",   away: "🇨🇴 Colômbia",    homeScore: null, awayScore: null, stadium: "BMO Field" },
  { id: 3,  phase: "Fase de Grupos", group: "B", date: "2026-06-12", time: "15:00", home: "🇧🇷 Brasil",   away: "🇩🇪 Alemanha",    homeScore: null, awayScore: null, stadium: "SoFi Stadium" },
  { id: 4,  phase: "Fase de Grupos", group: "B", date: "2026-06-12", time: "18:00", home: "🇦🇷 Argentina",away: "🇫🇷 França",      homeScore: null, awayScore: null, stadium: "Rose Bowl" },
  { id: 5,  phase: "Fase de Grupos", group: "C", date: "2026-06-13", time: "15:00", home: "🇪🇸 Espanha",  away: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra",homeScore: null, awayScore: null, stadium: "AT&T Stadium" },
  { id: 6,  phase: "Fase de Grupos", group: "C", date: "2026-06-13", time: "18:00", home: "🇵🇹 Portugal", away: "🇳🇱 Holanda",    homeScore: null, awayScore: null, stadium: "Levi's Stadium" },
  { id: 7,  phase: "Fase de Grupos", group: "D", date: "2026-06-14", time: "15:00", home: "🇯🇵 Japão",    away: "🇸🇦 Arábia",     homeScore: null, awayScore: null, stadium: "Mercedes-Benz Stadium" },
  { id: 8,  phase: "Fase de Grupos", group: "D", date: "2026-06-14", time: "18:00", home: "🇲🇦 Marrocos", away: "🇸🇳 Senegal",    homeScore: null, awayScore: null, stadium: "Estadio Azteca" },
  { id: 9,  phase: "Fase de Grupos", group: "E", date: "2026-06-15", time: "15:00", home: "🇧🇷 Brasil",   away: "🇨🇴 Colômbia",   homeScore: null, awayScore: null, stadium: "Hard Rock Stadium" },
  { id: 10, phase: "Fase de Grupos", group: "E", date: "2026-06-15", time: "18:00", home: "🇩🇪 Alemanha", away: "🇨🇦 Canadá",     homeScore: null, awayScore: null, stadium: "Gillette Stadium" },
  // ── Segunda Fase ──
  { id: 51, phase: "Segunda Fase", group: null, date: "2026-06-27", time: "15:00", home: "🏆 1º Grupo A", away: "🥈 2º Grupo C", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 52, phase: "Segunda Fase", group: null, date: "2026-06-27", time: "19:00", home: "🏆 1º Grupo B", away: "🥈 2º Grupo D", homeScore: null, awayScore: null, stadium: "SoFi Stadium" },
  { id: 53, phase: "Segunda Fase", group: null, date: "2026-06-28", time: "15:00", home: "🏆 1º Grupo C", away: "🥈 2º Grupo A", homeScore: null, awayScore: null, stadium: "Rose Bowl" },
  { id: 54, phase: "Segunda Fase", group: null, date: "2026-06-28", time: "19:00", home: "🏆 1º Grupo D", away: "🥈 2º Grupo B", homeScore: null, awayScore: null, stadium: "AT&T Stadium" },
  { id: 55, phase: "Segunda Fase", group: null, date: "2026-06-29", time: "15:00", home: "🏆 1º Grupo E", away: "🥈 2º Grupo F", homeScore: null, awayScore: null, stadium: "Levi's Stadium" },
  { id: 56, phase: "Segunda Fase", group: null, date: "2026-06-29", time: "19:00", home: "🏆 1º Grupo F", away: "🥈 2º Grupo E", homeScore: null, awayScore: null, stadium: "Hard Rock Stadium" },
  // ── Oitavas de Final ──
  { id: 101, phase: "Oitavas de Final", group: null, date: "2026-07-04", time: "16:00", home: "🏆 Vencedor SF1", away: "🏆 Vencedor SF2", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 102, phase: "Oitavas de Final", group: null, date: "2026-07-04", time: "20:00", home: "🏆 Vencedor SF3", away: "🏆 Vencedor SF4", homeScore: null, awayScore: null, stadium: "SoFi Stadium" },
  { id: 103, phase: "Oitavas de Final", group: null, date: "2026-07-05", time: "16:00", home: "🏆 Vencedor SF5", away: "🏆 Vencedor SF6", homeScore: null, awayScore: null, stadium: "Rose Bowl" },
  { id: 104, phase: "Oitavas de Final", group: null, date: "2026-07-05", time: "20:00", home: "🏆 Vencedor SF7", away: "🏆 Vencedor SF8", homeScore: null, awayScore: null, stadium: "AT&T Stadium" },
  // ── Quartas de Final ──
  { id: 201, phase: "Quartas de Final", group: null, date: "2026-07-09", time: "20:00", home: "🏆 Vencedor OI1", away: "🏆 Vencedor OI2", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 202, phase: "Quartas de Final", group: null, date: "2026-07-10", time: "20:00", home: "🏆 Vencedor OI3", away: "🏆 Vencedor OI4", homeScore: null, awayScore: null, stadium: "SoFi Stadium" },
  // ── Semifinal ──
  { id: 301, phase: "Semifinal", group: null, date: "2026-07-14", time: "20:00", home: "🏆 Vencedor QF1", away: "🏆 Vencedor QF2", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
  { id: 302, phase: "Semifinal", group: null, date: "2026-07-15", time: "20:00", home: "🏆 Vencedor QF3", away: "🏆 Vencedor QF4", homeScore: null, awayScore: null, stadium: "Rose Bowl" },
  // ── Disputa 3º Lugar ──
  { id: 350, phase: "Disputa 3º Lugar", group: null, date: "2026-07-18", time: "16:00", home: "🏆 Perdedor SF1", away: "🏆 Perdedor SF2", homeScore: null, awayScore: null, stadium: "AT&T Stadium" },
  // ── Final ──
  { id: 401, phase: "Final", group: null, date: "2026-07-19", time: "20:00", home: "🏆 Semifinalista 1", away: "🏆 Semifinalista 2", homeScore: null, awayScore: null, stadium: "MetLife Stadium" },
];

// ─── UTILS ────────────────────────────────────────────────────────────────────
function matchDateTime(m) {
  return new Date(`${m.date}T${m.time}:00`);
}
function minutesUntilMatch(m) {
  return (matchDateTime(m) - Date.now()) / 60000;
}
function isLocked(m) {
  return minutesUntilMatch(m) <= LOCK_MINUTES_BEFORE;
}
function hasPred(pred) {
  return pred && pred.home !== undefined && pred.home !== "" && pred.away !== undefined && pred.away !== "";
}
function calcPoints(pred, real, phase) {
  if (!hasPred(pred) || real.homeScore === null) return 0;
  const mult = PHASE_MULTIPLIERS[phase] || 1;
  if (Number(pred.home) === real.homeScore && Number(pred.away) === real.awayScore) return BASE_POINTS.exact * mult;
  const pw = Number(pred.home) > Number(pred.away) ? "H" : Number(pred.home) < Number(pred.away) ? "A" : "D";
  const rw = real.homeScore > real.awayScore ? "H" : real.homeScore < real.awayScore ? "A" : "D";
  if (pw === rw) return BASE_POINTS.winner * mult;
  return 0;
}
function getResultLabel(pts, phase) {
  const mult = PHASE_MULTIPLIERS[phase] || 1;
  if (pts === 10 * mult) return { label: "🎯 Placar Cravado!", color: "#00e676" };
  if (pts === 5 * mult)  return { label: "✅ Acertou Resultado", color: "#ffeb3b" };
  return { label: "❌ Errou", color: "#ef5350" };
}
function hashPassword(str) {
  // Simple deterministic hash for demo (not cryptographic)
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return h.toString(36);
}
function formatCountdown(mins) {
  if (mins <= 0) return "Encerrado";
  if (mins < 60) return `${Math.floor(mins)}min`;
  const h = Math.floor(mins / 60), m = Math.floor(mins % 60);
  return `${h}h ${m}min`;
}

// ─── AI FETCH ─────────────────────────────────────────────────────────────────
// ─── COUNTRY → FLAG EMOJI MAP ─────────────────────────────────────────────────
const FLAGS = {
  "Mexico": "🇲🇽", "South Africa": "🇿🇦", "South Korea": "🇰🇷", "Czech Republic": "🇨🇿",
  "Canada": "🇨🇦", "Qatar": "🇶🇦", "Switzerland": "🇨🇭", "Brazil": "🇧🇷", "Morocco": "🇲🇦",
  "Haiti": "🇭🇹", "Scotland": "🏴", "USA": "🇺🇸", "Paraguay": "🇵🇾", "Australia": "🇦🇺",
  "Germany": "🇩🇪", "Curaçao": "🇨🇼", "Ivory Coast": "🇨🇮", "Ecuador": "🇪🇨",
  "Netherlands": "🇳🇱", "Japan": "🇯🇵", "Tunisia": "🇹🇳", "Belgium": "🇧🇪", "Egypt": "🇪🇬",
  "Iran": "🇮🇷", "New Zealand": "🇳🇿", "Spain": "🇪🇸", "Cape Verde": "🇨🇻",
  "Saudi Arabia": "🇸🇦", "Uruguay": "🇺🇾", "France": "🇫🇷", "Senegal": "🇸🇳", "Norway": "🇳🇴",
  "Argentina": "🇦🇷", "Algeria": "🇩🇿", "Austria": "🇦🇹", "Jordan": "🇯🇴", "Portugal": "🇵🇹",
  "Uzbekistan": "🇺🇿", "Colombia": "🇨🇴", "England": "🏴", "Croatia": "🇭🇷",
  "Ghana": "🇬🇭", "Panama": "🇵🇦",
};
function flagify(team) {
  if (!team) return team;
  const flag = FLAGS[team];
  return flag ? `${flag} ${team}` : `🏆 ${team}`;
}

// ─── ROUND → PHASE MAP ─────────────────────────────────────────────────────────
function mapRoundToPhase(round) {
  if (round.startsWith("Matchday")) return "Fase de Grupos";
  if (round === "Round of 32") return "Segunda Fase";
  if (round === "Round of 16") return "Oitavas de Final";
  if (round === "Quarter-final") return "Quartas de Final";
  if (round === "Semi-final") return "Semifinal";
  if (round === "Match for third place") return "Disputa 3º Lugar";
  if (round === "Final") return "Final";
  return "Fase de Grupos";
}

// ─── FETCH REAL WORLD CUP 2026 FIXTURES (free, no API key) ─────────────────────
// Source: openfootball/worldcup.json — public domain (CC0), updated daily.
async function fetchMatchesFromAI() {
  const res = await fetch("https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json");
  if (!res.ok) throw new Error("Falha ao buscar dados");
  const data = await res.json();
  return data.matches.map((m, i) => ({
    id: m.num ? 1000 + Number(m.num) : i + 1,
    phase: mapRoundToPhase(m.round),
    group: m.group ? m.group.replace("Group ", "") : null,
    date: m.date,
    time: (m.time || "").split(" ")[0] || "00:00",
    home: flagify(m.team1),
    away: flagify(m.team2),
    homeScore: typeof m.score1 === "number" ? m.score1 : null,
    awayScore: typeof m.score2 === "number" ? m.score2 : null,
    stadium: m.ground || "",
  }));
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 36 }) => {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["#ff6b35","#00bcd4","#9c27b0","#4caf50","#ff9800","#e91e63","#2196f3","#ff5722"];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: colors[name.charCodeAt(0) % colors.length], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.35, color: "#fff", flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }}>
      {initials}
    </div>
  );
};

// ─── NOTIFICATION TOAST ───────────────────────────────────────────────────────
const Toast = ({ toasts, removeToast }) => (
  <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, width: "calc(100% - 32px)", maxWidth: 440 }}>
    {toasts.map(t => (
      <div key={t.id} onClick={() => removeToast(t.id)} style={{ background: t.type === "warning" ? "linear-gradient(90deg,#ff6f00,#ffa000)" : "linear-gradient(90deg,#1b5e20,#388e3c)", color: "#fff", borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, animation: "slideDown 0.3s ease" }}>
        <span style={{ fontSize: 22 }}>{t.type === "warning" ? "⏰" : "✅"}</span>
        <span style={{ flex: 1 }}>{t.message}</span>
        <span style={{ opacity: 0.6, fontSize: 11 }}>Toque para fechar</span>
      </div>
    ))}
  </div>
);

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const ADMIN_USER = { id: 0, username: "admin", displayName: "Admin", passwordHash: hashPassword("formula1+"), isAdmin: true };
const DEFAULT_USERS = [ADMIN_USER];

export default function BolaoApp() {
  const [storageReady, setStorageReady] = useState(false);

  // Auth state
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState(null);
  const [screen, setScreen] = useState("landing");

  // Game state
  const [matches, setMatches] = useState(INITIAL_MATCHES);
  const [predictions, setPredictions] = useState({});
  const [tempPredictions, setTempPredictions] = useState({});
  const [activePhase, setActivePhase] = useState("Fase de Grupos");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminScores, setAdminScores] = useState({});
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [savedAlert, setSavedAlert] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState([]);
  const notifiedRef = useRef(new Set());

  // ── LOAD FROM STORAGE ──
  useEffect(() => {
    async function load() {
      try {
        const [u, m, p] = await Promise.all([
          storage.get("bolao:users"),
          storage.get("bolao:matches"),
          storage.get("bolao:predictions"),
        ]);
        if (u) {
          const loaded = JSON.parse(u.value);
          // Always ensure admin user is present with current credentials
          const withAdmin = [ADMIN_USER, ...loaded.filter(x => !x.isAdmin)];
          setUsers(withAdmin);
        }
        if (m) setMatches(JSON.parse(m.value));
        if (p) setPredictions(JSON.parse(p.value));
      } catch(e) {
        // First run or storage empty — use defaults
      }
      setStorageReady(true);
    }
    load();
  }, []);

  // ── SAVE USERS TO STORAGE ──
  useEffect(() => {
    if (!storageReady) return;
    storage.set("bolao:users", JSON.stringify(users)).catch(() => {});
  }, [users, storageReady]);

  // ── SAVE MATCHES TO STORAGE ──
  useEffect(() => {
    if (!storageReady) return;
    storage.set("bolao:matches", JSON.stringify(matches)).catch(() => {});
  }, [matches, storageReady]);

  // ── SAVE PREDICTIONS TO STORAGE ──
  useEffect(() => {
    if (!storageReady) return;
    storage.set("bolao:predictions", JSON.stringify(predictions)).catch(() => {});
  }, [predictions, storageReady]);

  // Tick every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── SYNC: poll Supabase every 20s so all participants see fresh data ──
  useEffect(() => {
    if (!storageReady) return;
    const sync = async () => {
      try {
        const [u, m, p] = await Promise.all([
          storage.get("bolao:users"),
          storage.get("bolao:matches"),
          storage.get("bolao:predictions"),
        ]);
        if (u) {
          const loaded = JSON.parse(u.value);
          setUsers([ADMIN_USER, ...loaded.filter(x => !x.isAdmin)]);
        }
        if (m) setMatches(JSON.parse(m.value));
        if (p) setPredictions(JSON.parse(p.value));
      } catch {}
    };
    const t = setInterval(sync, 20000);
    return () => clearInterval(t);
  }, [storageReady]);

  // Notification checker
  useEffect(() => {
    if (!currentUser) return;
    matches.forEach(m => {
      const mins = minutesUntilMatch(m);
      const key30 = `notify-30-${m.id}`;
      const key10 = `notify-10-${m.id}`;
      if (mins > 28 && mins <= 32 && !notifiedRef.current.has(key30)) {
        notifiedRef.current.add(key30);
        addToast(`⚽ Faltam 30min para ${m.home} × ${m.away}! Dê seu palpite antes que feche!`, "warning");
      }
      if (mins > 8 && mins <= 12 && !notifiedRef.current.has(key10)) {
        notifiedRef.current.add(key10);
        addToast(`🔒 Últimos ${LOCK_MINUTES_BEFORE}min! Salve seu palpite para ${m.home} × ${m.away}!`, "warning");
      }
    });
  }, [now, matches, currentUser]);

  function addToast(message, type = "info") {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 8000);
  }
  function removeToast(id) { setToasts(p => p.filter(t => t.id !== id)); }

  // Load user predictions into temp (runs only when the logged-in user changes)
  const predictionsRef = useRef(predictions);
  predictionsRef.current = predictions;
  useEffect(() => {
    if (currentUser) setTempPredictions({ ...(predictionsRef.current[currentUser.id] || {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const ranking = users.filter(u => !u.isAdmin && !u.inactive).map(u => {
    const preds = predictions[u.id] || {};
    let total = 0, exact = 0;
    matches.forEach(m => {
      if (m.homeScore === null) return;
      const pts = calcPoints(preds[m.id], m, m.phase);
      total += pts;
      if (pts === BASE_POINTS.exact * (PHASE_MULTIPLIERS[m.phase] || 1)) exact++;
    });
    return { ...u, total, exact };
  }).sort((a, b) => b.total - a.total || b.exact - a.exact);

  const phases = [...new Set(matches.map(m => m.phase))];

  const handleSavePredictions = async () => {
    // Fetch the freshest predictions from Supabase first, so we don't
    // overwrite other participants' saves that happened concurrently.
    let latest = predictions;
    try {
      const remote = await storage.get("bolao:predictions");
      if (remote) latest = JSON.parse(remote.value);
    } catch {}
    const merged = { ...latest, [currentUser.id]: { ...tempPredictions } };
    setPredictions(merged);
    setSavedAlert(true);
    addToast("💾 Palpites salvos com sucesso!", "success");
    setTimeout(() => setSavedAlert(false), 3000);
  };

  const [aiMatches, setAiMatches] = useState(null);
  const handleFetchAI = async () => {
    setLoadingAI(true); setAiError(null); setAiMatches(null);
    try {
      const ai = await fetchMatchesFromAI();
      setAiMatches(ai);
    } catch { setAiError("Não foi possível buscar a tabela agora. Tente novamente em alguns minutos."); }
    setLoadingAI(false);
  };

  const logout = () => { setCurrentUser(null); setScreen("landing"); };

  // ── LOADING SCREEN ──
  if (!storageReady) return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ fontSize: 52, animation: "pulse 1.2s infinite" }}>🏆</div>
      <p style={{ color: "#546e7a", fontFamily: "system-ui", fontSize: 14 }}>Carregando bolão...</p>
    </div>
  );

  // ── ROUTER ──
  const regularUsers = users.filter(u => !u.isAdmin && !u.inactive);
  const allNonAdminUsers = users.filter(u => !u.isAdmin);
  const props = { users: regularUsers, allUsers: users, allNonAdminUsers, setUsers, currentUser, setCurrentUser, matches, setMatches, predictions, setPredictions, tempPredictions, setTempPredictions, activePhase, setActivePhase, phases, adminUnlocked, setAdminUnlocked, adminScores, setAdminScores, loadingAI, aiError, aiMatches, setAiMatches, savedAlert, handleSavePredictions, handleFetchAI, ranking, setScreen, logout, now, addToast };

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.6 } }
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0 }
        input[type=number] { -moz-appearance:textfield }
        ::-webkit-scrollbar { width:4px; height:4px }
        ::-webkit-scrollbar-thumb { background:#37474f; border-radius:4px }
      `}</style>
      <Toast toasts={toasts} removeToast={removeToast} />
      {screen === "landing"     && <LandingScreen {...props} />}
      {screen === "login"       && <LoginScreen {...props} allUsers={users} />}
      {screen === "register"    && <RegisterScreen {...props} />}
      {screen === "home"        && <HomeScreen {...props} />}
      {screen === "predictions" && <PredictionsScreen {...props} users={users} />}
      {screen === "ranking"     && <RankingScreen {...props} />}
      {screen === "results"     && <ResultsScreen {...props} />}
      {screen === "admin"       && <AdminScreen {...props} addToast={addToast} />}
    </div>
  );
}

// ─── LANDING ──────────────────────────────────────────────────────────────────
function LandingScreen({ setScreen }) {
  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.trophyGlow}>🏆</div>
        <h1 style={styles.heroTitle}>BOLÃO<br /><span style={{ color: "#ffd600" }}>COPA 2026</span></h1>
        <p style={styles.heroSub}>FIFA World Cup • USA • México • Canadá</p>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "center" }}>
          <button onClick={() => setScreen("login")} style={{ ...styles.btn, background: "#ffd600", color: "#0a0e1a", flex: 1, maxWidth: 160 }}>Entrar</button>
          <button onClick={() => setScreen("register")} style={{ ...styles.btn, background: "transparent", border: "2px solid #ffd600", color: "#ffd600", flex: 1, maxWidth: 160 }}>Cadastrar</button>
        </div>
        <button onClick={() => setScreen("ranking")} style={{ background: "none", border: "none", color: "#546e7a", fontSize: 12, marginTop: 14, cursor: "pointer", textDecoration: "underline" }}>Ver classificação sem entrar</button>
      </div>
      <div style={{ padding: "0 20px 40px" }}>
        <div style={styles.infoGrid}>
          {[["🎯","Placar Cravado","10 pts × fase"],["✅","Resultado Certo","5 pts × fase"],["📐","Fase a Fase","Pontos dobram a cada rodada"],["🔒","Palpites Fecham","10min antes do jogo"]].map(([ic,t,d]) => (
            <div key={t} style={styles.infoCard}>
              <span style={{ fontSize: 24 }}>{ic}</span>
              <div style={{ marginTop: 6, fontWeight: 700, fontSize: 13, color: "#e0e0e0" }}>{t}</div>
              <div style={{ fontSize: 11, color: "#78909c", marginTop: 2 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PASSWORD INPUT ───────────────────────────────────────────────────────────
function PasswordInput({ value, onChange, onEnter, placeholder, hasError }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        style={{ ...styles.input, marginBottom: 0, paddingRight: 44, ...(hasError ? styles.inputErr : {}) }}
        placeholder={placeholder}
      />
      <button
        onClick={() => setShow(s => !s)}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: show ? "#00bcd4" : "#546e7a", fontSize: 18, lineHeight: 1 }}
        tabIndex={-1}
        type="button"
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ allUsers, setCurrentUser, setScreen }) {
  const users = allUsers;
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState("");
  const handle = () => {
    const user = users.find(x => x.username.toLowerCase() === u.trim().toLowerCase());
    if (!user || user.passwordHash !== hashPassword(p)) { setErr("Usuário ou senha incorretos."); return; }
    if (user.inactive) { setErr("Sua conta foi desativada. Fale com o administrador."); return; }
    setCurrentUser(user); setScreen("home");
  };
  return (
    <div style={styles.page}>
      <TopBar title="Entrar" onBack={() => setScreen("landing")} />
      <div style={styles.formBox}>
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>⚽</div>
        <p style={{ color: "#90a4ae", textAlign: "center", marginBottom: 20, fontSize: 14 }}>Acesse sua conta do bolão</p>
        <label style={styles.label}>Usuário</label>
        <input value={u} onChange={e => setU(e.target.value)} style={styles.input} placeholder="seu_usuario" autoCapitalize="none" />
        <label style={styles.label}>Senha</label>
        <PasswordInput value={p} onChange={setP} onEnter={handle} placeholder="••••••" />
        {err && <p style={styles.errMsg}>{err}</p>}
        <button onClick={handle} style={{ ...styles.btn, ...styles.btnFull, marginTop: 8 }}>Entrar</button>
        <p style={{ textAlign: "center", color: "#546e7a", fontSize: 13, marginTop: 16 }}>
          Não tem conta?{" "}
          <button onClick={() => setScreen("register")} style={styles.linkBtn}>Cadastrar-se</button>
        </p>
      </div>
    </div>
  );
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
function RegisterScreen({ allUsers, users, setUsers, setCurrentUser, setScreen }) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [usernameOk, setUsernameOk] = useState(null);

  const checkUsername = (val) => {
    const clean = val.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(clean);
    if (!clean) { setUsernameOk(null); return; }
    setUsernameOk(!allUsers.find(u => u.username.toLowerCase() === clean));
  };

  const handle = async () => {
    const errs = {};
    if (!displayName.trim()) errs.displayName = "Nome é obrigatório";
    if (!username) errs.username = "Usuário é obrigatório";
    if (usernameOk === false) errs.username = "Usuário já existe";
    if (password.length < 4) errs.password = "Senha mínima 4 caracteres";
    if (password !== confirm) errs.confirm = "Senhas não conferem";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Re-check against the freshest user list to avoid duplicate usernames
    // created by two people registering at the same time.
    let latest = allUsers;
    try {
      const remote = await storage.get("bolao:users");
      if (remote) latest = [ADMIN_USER, ...JSON.parse(remote.value).filter(x => !x.isAdmin)];
    } catch {}
    if (latest.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      setErrors({ username: "Usuário já existe" });
      return;
    }

    const newUser = { id: Date.now(), username, displayName: displayName.trim(), passwordHash: hashPassword(password) };
    const merged = [...latest.filter(u => !u.isAdmin), newUser];
    setUsers(merged);
    setCurrentUser(newUser);
    setScreen("home");
  };

  return (
    <div style={styles.page}>
      <TopBar title="Criar Conta" onBack={() => setScreen("landing")} />
      <div style={styles.formBox}>
        <div style={{ fontSize: 36, textAlign: "center", marginBottom: 16 }}>👤</div>

        <label style={styles.label}>Nome (aparece no ranking) *</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ ...styles.input, ...(errors.displayName ? styles.inputErr : {}) }} placeholder="Ex: Carlos Silva" />
        {errors.displayName && <p style={styles.errMsg}>{errors.displayName}</p>}

        <label style={styles.label}>Usuário (para login) *</label>
        <div style={{ position: "relative" }}>
          <input value={username} onChange={e => checkUsername(e.target.value)} style={{ ...styles.input, ...(errors.username ? styles.inputErr : {}), paddingRight: 36 }} placeholder="Ex: carlos_silva" autoCapitalize="none" />
          {usernameOk === true  && <span style={styles.usernameOk}>✓</span>}
          {usernameOk === false && <span style={styles.usernameErr}>✗</span>}
        </div>
        {errors.username && <p style={styles.errMsg}>{errors.username}</p>}
        {usernameOk === false && <p style={styles.errMsg}>Usuário já cadastrado. Escolha outro.</p>}
        {usernameOk === true  && <p style={{ color: "#4caf50", fontSize: 12, marginTop: -8, marginBottom: 10 }}>✓ Usuário disponível</p>}

        <label style={styles.label}>Senha *</label>
        <PasswordInput value={password} onChange={setPassword} placeholder="Mínimo 4 caracteres" hasError={!!errors.password} />
        {errors.password && <p style={styles.errMsg}>{errors.password}</p>}

        <label style={styles.label}>Confirmar senha *</label>
        <PasswordInput value={confirm} onChange={setConfirm} onEnter={handle} placeholder="Repita a senha" hasError={!!errors.confirm} />
        {errors.confirm && <p style={styles.errMsg}>{errors.confirm}</p>}

        <button onClick={handle} style={{ ...styles.btn, ...styles.btnFull, marginTop: 8 }}>Criar Conta e Entrar</button>
        <p style={{ textAlign: "center", color: "#546e7a", fontSize: 13, marginTop: 14 }}>
          Já tem conta?{" "}
          <button onClick={() => setScreen("login")} style={styles.linkBtn}>Entrar</button>
        </p>
      </div>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({ currentUser, ranking, setScreen, logout, matches, now, setActivePhase }) {
  const nextMatch = [...matches].filter(m => minutesUntilMatch(m) > 0).sort((a, b) => matchDateTime(a) - matchDateTime(b))[0];
  const myRank = ranking.findIndex(r => r.id === currentUser.id) + 1;
  const myData = ranking.find(r => r.id === currentUser.id);

  const goToNextMatch = () => {
    if (!nextMatch) return;
    setActivePhase(nextMatch.phase);
    setScreen("predictions");
  };

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0 4px" }}>
          <div>
            <p style={{ color: "#78909c", fontSize: 12, margin: "0 0 2px" }}>Bem-vindo,</p>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: 20, color: "#fff" }}>{currentUser.displayName}</h2>
          </div>
          <button onClick={logout} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#78909c", padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Sair</button>
        </div>
        {myData && (
          <div style={styles.myStatsRow}>
            <div style={styles.statBox}><span style={styles.statNum}>{myData.total}</span><span style={styles.statLabel}>pontos</span></div>
            <div style={styles.statBox}><span style={styles.statNum}>{myRank}º</span><span style={styles.statLabel}>posição</span></div>
            <div style={styles.statBox}><span style={styles.statNum}>{myData.exact}</span><span style={styles.statLabel}>cravados</span></div>
          </div>
        )}
        {nextMatch && (
          <div
            onClick={!isLocked(nextMatch) ? goToNextMatch : undefined}
            style={{ ...styles.nextMatchBadge, ...(isLocked(nextMatch) ? {} : { cursor: "pointer", borderColor: "rgba(255,214,0,0.4)", boxShadow: "0 0 0 1px rgba(255,214,0,0.15)" }) }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#ffd600", fontWeight: 700 }}>⏰ PRÓXIMO JOGO</span>
              {!isLocked(nextMatch) && <span style={{ fontSize: 10, color: "#ffd600", fontWeight: 700, background: "rgba(255,214,0,0.15)", padding: "2px 8px", borderRadius: 10 }}>Apostar →</span>}
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: "6px 0 3px", display: "block" }}>{nextMatch.home} × {nextMatch.away}</span>
            <span style={{ fontSize: 11, color: minutesUntilMatch(nextMatch) <= 30 ? "#ff7043" : "#90a4ae" }}>
              {isLocked(nextMatch) ? "🔒 Palpites encerrados" : `🕐 Fecha em ${formatCountdown(minutesUntilMatch(nextMatch) - LOCK_MINUTES_BEFORE)}`}
            </span>
          </div>
        )}
      </div>

      <div style={styles.cardGrid}>
        {[
          { icon: "⚽", label: "Meus Palpites", color: "#00bcd4", screen: "predictions" },
          { icon: "🏅", label: "Classificação",  color: "#ff9800", screen: "ranking" },
          { icon: "📊", label: "Resultados",      color: "#4caf50", screen: "results" },
          ...(currentUser.isAdmin ? [{ icon: "🔐", label: "Admin", color: "#ef5350", screen: "admin" }] : []),
        ].map(c => (
          <button key={c.screen} onClick={() => setScreen(c.screen)} style={{ ...styles.actionCard, borderColor: c.color + "55", background: c.color + "18" }}>
            <span style={{ fontSize: 28 }}>{c.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0", marginTop: 6 }}>{c.label}</span>
          </button>
        ))}
      </div>

      {ranking.length > 0 && (
        <div style={{ margin: "0 16px" }}>
          <h3 style={styles.sectionTitle}>🥇 Top 3</h3>
          {ranking.slice(0, 3).map((p, i) => (
            <div key={p.id} style={{ ...styles.rankRow, ...(p.id === currentUser.id ? { background: "rgba(255,214,0,0.06)", borderRadius: 10, padding: "8px 10px" } : {}) }}>
              <span style={{ fontSize: 20, width: 28 }}>{["🥇","🥈","🥉"][i]}</span>
              <Avatar name={p.displayName} />
              <span style={{ flex: 1, marginLeft: 10, fontWeight: 600, fontSize: 14 }}>{p.displayName}</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: "#ffd600" }}>{p.total} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ALL PREDICTIONS MODAL ────────────────────────────────────────────────────
function AllPredictionsModal({ match, users, predictions, onClose }) {
  const mult = PHASE_MULTIPLIERS[match.phase] || 1;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0f1e30", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "20px 20px 40px", border: "1px solid rgba(255,255,255,0.12)", borderBottom: "none", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: "#37474f", borderRadius: 2, margin: "0 auto 18px" }} />
        <h3 style={{ margin: "0 0 2px", fontWeight: 800, fontSize: 16, color: "#fff" }}>{match.home} × {match.away}</h3>
        <p style={{ margin: "0 0 14px", color: "#78909c", fontSize: 12 }}>📅 {match.date} {match.time} • {match.phase} • multiplicador ×{mult}</p>

        {match.homeScore !== null && (
          <div style={{ background: "rgba(0,188,212,0.1)", border: "1px solid rgba(0,188,212,0.3)", borderRadius: 10, padding: "10px 14px", textAlign: "center", marginBottom: 14 }}>
            <span style={{ color: "#90a4ae", fontSize: 12 }}>Resultado oficial: </span>
            <strong style={{ color: "#fff", fontSize: 20 }}>{match.homeScore} × {match.awayScore}</strong>
          </div>
        )}

        <p style={{ color: "#546e7a", fontSize: 11, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Palpites dos participantes</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map(u => {
            const pred = predictions[u.id]?.[match.id];
            const noPred = !hasPred(pred);
            const pts = (!noPred && match.homeScore !== null) ? calcPoints(pred, match, match.phase) : null;
            const res = pts !== null ? getResultLabel(pts, match.phase) : null;
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: noPred ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 12px", border: `1px solid ${res ? res.color + "44" : "rgba(255,255,255,0.07)"}` }}>
                <Avatar name={u.displayName} size={34} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: noPred ? "#546e7a" : "#e0e0e0" }}>{u.displayName}</span>
                {noPred ? (
                  <span style={{ color: "#37474f", fontSize: 12, fontStyle: "italic" }}>sem palpite</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 17, color: "#fff", background: "rgba(255,255,255,0.09)", padding: "4px 12px", borderRadius: 8, letterSpacing: 1 }}>
                      {pred.home} × {pred.away}
                    </span>
                    {res && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: res.color, minWidth: 50, textAlign: "right" }}>
                        {pts > 0 ? `+${pts}pts` : "0pts"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={onClose} style={{ marginTop: 20, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#90a4ae", padding: "12px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Fechar</button>
      </div>
    </div>
  );
}

// ─── PREDICTIONS ──────────────────────────────────────────────────────────────
function PredictionsScreen({ currentUser, users, matches, phases, activePhase, setActivePhase, tempPredictions, setTempPredictions, predictions, handleSavePredictions, savedAlert, setScreen, now }) {
  const mult = PHASE_MULTIPLIERS[activePhase] || 1;
  const filtered = matches.filter(m => m.phase === activePhase);
  const savedPreds = predictions[currentUser.id] || {};
  const [modalMatch, setModalMatch] = useState(null);

  const setPred = (id, side, val) => {
    const n = val === "" ? "" : Math.max(0, parseInt(val) || 0);
    setTempPredictions(p => ({ ...p, [id]: { ...p[id], [side]: n } }));
  };

  const hasPendingChanges = filtered.some(m => {
    if (isLocked(m)) return false;
    const temp = tempPredictions[m.id];
    const saved = savedPreds[m.id];
    if (!temp) return false;
    return temp.home !== saved?.home || temp.away !== saved?.away;
  });

  return (
    <div style={styles.page}>
      {modalMatch && <AllPredictionsModal match={modalMatch} users={users} predictions={predictions} onClose={() => setModalMatch(null)} />}
      <TopBar title={`⚽ Palpites — ${currentUser.displayName}`} onBack={() => setScreen("home")} />

      <div style={styles.multBadge}>
        <span>📐 Multiplicador: </span><strong style={{ color: "#ffd600" }}>×{mult}</strong>
        <span style={{ marginLeft: 8, color: "#78909c" }}>| Placar: {10*mult}pts | Resultado: {5*mult}pts</span>
      </div>

      <div style={styles.tabRow}>
        {phases.map(ph => (
          <button key={ph} onClick={() => setActivePhase(ph)} style={{ ...styles.tab, ...(activePhase === ph ? styles.tabActive : {}) }}>
            {ph.replace(" de Final","").replace("Fase de ","")}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 100px" }}>
        {filtered.map(m => {
          const mins = minutesUntilMatch(m);
          const locked = isLocked(m);
          const pred = tempPredictions[m.id] || {};
          const saved = savedPreds[m.id];
          const hasSaved = hasPred(saved);
          const result = m.homeScore !== null && hasSaved ? getResultLabel(calcPoints(saved, m, m.phase), m.phase) : null;
          const closingSoon = mins > LOCK_MINUTES_BEFORE && mins <= NOTIFY_MINUTES_BEFORE;

          return (
            <div
              key={m.id}
              onClick={locked ? () => setModalMatch(m) : undefined}
              style={{ ...styles.matchCard, ...(locked ? { borderColor: "rgba(239,83,80,0.25)", cursor: "pointer" } : closingSoon ? { borderColor: "rgba(255,152,0,0.4)", boxShadow: "0 0 0 1px rgba(255,152,0,0.2)" } : {}) }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                <span style={{ color: "#78909c", fontSize: 11 }}>📅 {m.date} {m.time}</span>
                {m.group && <span style={styles.groupBadge}>Grupo {m.group}</span>}
                {locked && m.homeScore === null && <span style={{ background: "rgba(239,83,80,0.15)", color: "#ef5350", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>🔒 Toque p/ ver palpites</span>}
                {locked && m.homeScore !== null && <span style={{ background: "rgba(76,175,80,0.15)", color: "#4caf50", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>✅ Toque p/ ver resultados</span>}
                {!locked && mins <= NOTIFY_MINUTES_BEFORE && <span style={{ background: "rgba(255,152,0,0.15)", color: "#ff9800", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, animation: "pulse 1.5s infinite" }}>⏰ Fecha em {formatCountdown(mins - LOCK_MINUTES_BEFORE)}</span>}
                {!locked && mins > NOTIFY_MINUTES_BEFORE && <span style={{ color: "#546e7a", fontSize: 10 }}>🕐 {formatCountdown(mins - LOCK_MINUTES_BEFORE)} para fechar</span>}
              </div>

              <div style={styles.matchRow}>
                <span style={styles.team}>{m.home}</span>
                {locked ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ ...styles.scoreBox, opacity: hasSaved ? 1 : 0.35 }}>{hasSaved ? saved.home : "–"}</span>
                    <span style={{ color: "#546e7a" }}>×</span>
                    <span style={{ ...styles.scoreBox, opacity: hasSaved ? 1 : 0.35 }}>{hasSaved ? saved.away : "–"}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="number" min={0} max={20} value={pred.home ?? ""} onChange={e => setPred(m.id, "home", e.target.value)} style={styles.scoreInput} placeholder="–" />
                    <span style={{ color: "#546e7a", fontSize: 18 }}>×</span>
                    <input type="number" min={0} max={20} value={pred.away ?? ""} onChange={e => setPred(m.id, "away", e.target.value)} style={styles.scoreInput} placeholder="–" />
                  </div>
                )}
                <span style={styles.team}>{m.away}</span>
              </div>

              {m.homeScore !== null && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                  <span style={{ color: "#90a4ae", fontSize: 11 }}>Resultado: </span>
                  <strong style={{ color: "#e0e0e0" }}>{m.homeScore} × {m.awayScore}</strong>
                  {result && <span style={{ color: result.color, marginLeft: 10, fontSize: 11, fontWeight: 700 }}>{result.label} (+{calcPoints(saved, m, m.phase)} pts)</span>}
                  {!hasSaved && <span style={{ color: "#546e7a", marginLeft: 10, fontSize: 11 }}>sem palpite (0 pts)</span>}
                </div>
              )}
              <span style={{ color: "#546e7a", fontSize: 10, display: "block", textAlign: "center", marginTop: 4 }}>🏟 {m.stadium}</span>
            </div>
          );
        })}
      </div>

      {hasPendingChanges && (
        <div style={styles.bottomBar}>
          <button onClick={handleSavePredictions} style={styles.btnSave}>💾 Salvar Palpites</button>
        </div>
      )}
      {!hasPendingChanges && (
        <div style={{ ...styles.bottomBar, background: "rgba(10,14,26,0.8)" }}>
          <p style={{ textAlign: "center", color: "#546e7a", margin: 0, fontSize: 13 }}>
            {savedAlert ? "✅ Palpites salvos!" : "Todos os palpites estão salvos"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── RANKING ──────────────────────────────────────────────────────────────────
function RankingScreen({ ranking, currentUser, setScreen }) {
  return (
    <div style={styles.page}>
      <TopBar title="🏅 Classificação" onBack={() => setScreen(currentUser ? "home" : "landing")} />
      <div style={{ padding: "12px 16px 32px" }}>
        <p style={{ color: "#546e7a", textAlign: "center", fontSize: 12, marginBottom: 16 }}>
          {ranking.length} participante(s) • Desempate: placares cravados
        </p>
        {ranking.map((p, i) => (
          <div key={p.id} style={{ ...styles.rankCard, ...(i===0?styles.rankFirst:i===1?styles.rankSecond:i===2?styles.rankThird:{}), ...(currentUser?.id===p.id?{outline:"2px solid #ffd600"}:{}) }}>
            <span style={{ fontSize: 22, width: 32, textAlign: "center" }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}º`}</span>
            <Avatar name={p.displayName} size={40} />
            <div style={{ flex: 1, marginLeft: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: currentUser?.id===p.id?"#ffd600":"#e0e0e0" }}>{p.displayName} {currentUser?.id===p.id&&"(você)"}</div>
              <div style={{ fontSize: 11, color: "#78909c" }}>🎯 {p.exact} placar(es) cravado(s)</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: i===0?"#ffd600":"#e0e0e0" }}>{p.total}</div>
              <div style={{ fontSize: 10, color: "#546e7a" }}>pontos</div>
            </div>
          </div>
        ))}
        {ranking.length === 0 && <p style={{ color: "#546e7a", textAlign: "center" }}>Nenhum participante ainda.</p>}
      </div>
    </div>
  );
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
function ResultsScreen({ matches, predictions, users, setScreen, currentUser, phases, activePhase, setActivePhase }) {
  const filtered = matches.filter(m => m.phase === activePhase);
  return (
    <div style={styles.page}>
      <TopBar title="📊 Resultados" onBack={() => setScreen(currentUser ? "home" : "landing")} />
      <div style={styles.tabRow}>
        {phases.map(ph => (
          <button key={ph} onClick={() => setActivePhase(ph)} style={{ ...styles.tab, ...(activePhase===ph?styles.tabActive:{}) }}>
            {ph.replace(" de Final","").replace("Fase de ","")}
          </button>
        ))}
      </div>
      <div style={{ padding: "0 16px 32px" }}>
        {filtered.map(m => (
          <div key={m.id} style={styles.matchCard}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#78909c", fontSize: 11 }}>📅 {m.date} {m.time}</span>
              {m.group && <span style={styles.groupBadge}>Grupo {m.group}</span>}
              {m.homeScore !== null ? <span style={{ color: "#4caf50", fontSize: 11, fontWeight: 700 }}>✅ Finalizado</span> : <span style={{ color: "#546e7a", fontSize: 11 }}>Aguardando...</span>}
            </div>
            <div style={styles.matchRow}>
              <span style={styles.team}>{m.home}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {m.homeScore !== null ? (
                  <><span style={{ ...styles.scoreBox, background: "#1e3a5f" }}>{m.homeScore}</span><span style={{ color: "#546e7a" }}>×</span><span style={{ ...styles.scoreBox, background: "#1e3a5f" }}>{m.awayScore}</span></>
                ) : <span style={{ color: "#546e7a", fontSize: 12 }}>– × –</span>}
              </div>
              <span style={styles.team}>{m.away}</span>
            </div>
            {m.homeScore !== null && users.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                {users.map(u => {
                  const pred = predictions[u.id]?.[m.id];
                  const noPred = !hasPred(pred);
                  const pts = noPred ? 0 : calcPoints(pred, m, m.phase);
                  const res = noPred ? null : getResultLabel(pts, m.phase);
                  return (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", padding: "4px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <Avatar name={u.displayName} size={22} />
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#90a4ae", flex: 1 }}>{u.displayName}</span>
                      {noPred
                        ? <span style={{ fontSize: 11, color: "#37474f", fontStyle: "italic" }}>sem palpite</span>
                        : <>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#cfd8dc", marginRight: 8 }}>{pred.home}×{pred.away}</span>
                            <span style={{ fontSize: 11, color: res.color, fontWeight: 700 }}>{pts > 0 ? `+${pts}pts` : "0pts"}</span>
                          </>
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN USERS PANEL ───────────────────────────────────────────────────────
function AdminUsersPanel({ allNonAdminUsers, setUsers }) {
  const [filter, setFilter] = useState("all"); // all | active | inactive
  const inactive = allNonAdminUsers.filter(u => u.inactive);
  const active   = allNonAdminUsers.filter(u => !u.inactive);
  const shown = filter === "inactive" ? inactive : filter === "active" ? active : allNonAdminUsers;

  const toggle = (id) => setUsers(prev => prev.map(x => x.id === id ? { ...x, inactive: !x.inactive } : x));

  return (
    <div style={styles.infoCard2}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <strong style={{ color: "#e0e0e0", fontSize: 14 }}>👥 Jogadores</strong>
        <div style={{ display: "flex", gap: 4 }}>
          {[["all", `Todos (${allNonAdminUsers.length})`], ["active", `Ativos (${active.length})`], ["inactive", `Inativos (${inactive.length})`]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{ background: filter === val ? "#ffd600" : "rgba(255,255,255,0.07)", border: "none", borderRadius: 16, padding: "3px 9px", fontSize: 10, fontWeight: 700, color: filter === val ? "#0a0e1a" : "#78909c", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 && (
        <p style={{ color: "#546e7a", fontSize: 12, textAlign: "center", padding: "12px 0" }}>
          {filter === "inactive" ? "Nenhum jogador inativo." : "Nenhum jogador encontrado."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map(u => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: u.inactive ? "rgba(239,83,80,0.06)" : "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 10px", border: `1px solid ${u.inactive ? "rgba(239,83,80,0.25)" : "rgba(255,255,255,0.07)"}` }}>
            <Avatar name={u.displayName} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: u.inactive ? "#546e7a" : "#e0e0e0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {u.displayName}
                {u.inactive && <span style={{ fontSize: 10, color: "#ef5350", fontWeight: 700, background: "rgba(239,83,80,0.15)", padding: "1px 6px", borderRadius: 8 }}>INATIVO</span>}
              </div>
              <div style={{ fontSize: 11, color: "#546e7a" }}>@{u.username}</div>
            </div>
            <button
              onClick={() => toggle(u.id)}
              style={{ background: u.inactive ? "rgba(76,175,80,0.15)" : "rgba(239,83,80,0.15)", border: `1px solid ${u.inactive ? "rgba(76,175,80,0.35)" : "rgba(239,83,80,0.35)"}`, borderRadius: 8, color: u.inactive ? "#4caf50" : "#ef5350", fontSize: 11, fontWeight: 700, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {u.inactive ? "✅ Ativar" : "🚫 Desativar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminScreen({ matches, setMatches, adminScores, setAdminScores, setScreen, handleFetchAI, loadingAI, aiError, aiMatches, setAiMatches, phases, activePhase, setActivePhase, currentUser, allNonAdminUsers, setUsers, addToast }) {
  const filtered = matches.filter(m => m.phase === activePhase);

  if (!currentUser?.isAdmin) return (
    <div style={styles.page}>
      <TopBar title="Acesso Negado" onBack={() => setScreen("home")} />
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <p style={{ color: "#ef5350", marginTop: 12 }}>Acesso restrito ao administrador.</p>
      </div>
    </div>
  );

  const saveScore = (id) => {
    const sc = adminScores[id];
    if (sc?.home === undefined || sc?.away === undefined || sc?.home === "" || sc?.away === "") return;
    setMatches(p => p.map(m => m.id === id ? { ...m, homeScore: Number(sc.home), awayScore: Number(sc.away) } : m));
  };



  return (
    <div style={styles.page}>
      <TopBar title="⚙️ Administrador" onBack={() => setScreen("home")} />
      <div style={{ padding: "0 16px" }}>
        <button onClick={handleFetchAI} disabled={loadingAI} style={{ ...styles.btn, ...styles.btnFull, background: loadingAI ? "#37474f" : "#0288d1", color: "#fff", marginBottom: 6 }}>
          {loadingAI ? "🔍 Buscando jogos da Copa..." : "🌐 Buscar Tabela Oficial da Copa 2026"}
        </button>
        <p style={{ color: "#546e7a", fontSize: 10, textAlign: "center", marginTop: -2, marginBottom: 8 }}>Fonte: dados públicos atualizados diariamente</p>
        {aiError && <p style={{ color: "#ef5350", fontSize: 12, textAlign: "center", marginBottom: 8 }}>{aiError}</p>}

        {aiMatches && (
          <div style={{ background: "rgba(2,136,209,0.08)", border: "1px solid rgba(2,136,209,0.3)", borderRadius: 12, padding: "12px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: "#0288d1", fontWeight: 700, fontSize: 13 }}>✅ {aiMatches.length} jogos encontrados</span>
              <button
                onClick={() => { setMatches(aiMatches); setAiMatches(null); addToast(`✅ ${aiMatches.length} jogos da Copa salvos!`, "success"); }}
                style={{ background: "linear-gradient(90deg,#00bcd4,#0097a7)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 800, fontSize: 13, padding: "7px 14px", cursor: "pointer" }}
              >
                💾 Salvar Todos
              </button>
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {aiMatches.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#90a4ae", background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "4px 8px" }}>
                  <span>{m.home} × {m.away}</span>
                  <span>{m.date} {m.time}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setAiMatches(null)} style={{ marginTop: 8, width: "100%", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#546e7a", padding: "6px", fontSize: 12, cursor: "pointer" }}>
              Descartar
            </button>
          </div>
        )}

        <AdminUsersPanel allNonAdminUsers={allNonAdminUsers} setUsers={setUsers} />

        <div style={styles.tabRow}>
          {phases.map(ph => (
            <button key={ph} onClick={() => setActivePhase(ph)} style={{ ...styles.tab, ...(activePhase===ph?styles.tabActive:{}) }}>
              {ph.replace(" de Final","").replace("Fase de ","")}
            </button>
          ))}
        </div>

        <p style={{ color: "#78909c", fontSize: 12, marginBottom: 10, marginTop: 12 }}>Registrar resultados dos jogos:</p>
        {filtered.map(m => (
          <div key={m.id} style={styles.adminMatchCard}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#78909c", fontSize: 11 }}>📅 {m.date} {m.time}</span>
              {m.homeScore !== null ? <span style={{ color: "#4caf50", fontSize: 11, fontWeight: 700 }}>✅ {m.homeScore}×{m.awayScore}</span> : <span style={{ color: "#546e7a", fontSize: 11 }}>Aguardando</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#cfd8dc", flex: 1, minWidth: 80 }}>{m.home}</span>
              <input type="number" min={0} max={30} value={adminScores[m.id]?.home ?? (m.homeScore !== null ? m.homeScore : "")} onChange={e => setAdminScores(p => ({ ...p, [m.id]: { ...p[m.id], home: e.target.value } }))} style={styles.scoreInputSm} placeholder="0" />
              <span style={{ color: "#546e7a" }}>×</span>
              <input type="number" min={0} max={30} value={adminScores[m.id]?.away ?? (m.awayScore !== null ? m.awayScore : "")} onChange={e => setAdminScores(p => ({ ...p, [m.id]: { ...p[m.id], away: e.target.value } }))} style={styles.scoreInputSm} placeholder="0" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#cfd8dc", flex: 1, minWidth: 80, textAlign: "right" }}>{m.away}</span>
              <button onClick={() => saveScore(m.id)} style={styles.btnSaveSmall}>Salvar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TOP BAR ──────────────────────────────────────────────────────────────────
function TopBar({ title, onBack }) {
  return (
    <div style={styles.topBar}>
      <button onClick={onBack} style={styles.backBtn}>← Voltar</button>
      <span style={styles.topBarTitle}>{title}</span>
      <div style={{ width: 64 }} />
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  root: { background: "#0a0e1a", minHeight: "100vh" },
  page: { minHeight: "100vh", background: "linear-gradient(160deg,#0a0e1a 0%,#0d1b2a 60%,#0a1628 100%)", fontFamily: "'Segoe UI',system-ui,sans-serif", color: "#e0e0e0", maxWidth: 480, margin: "0 auto", paddingBottom: 40 },
  hero: { background: "linear-gradient(135deg,#0d2137 0%,#1a3a5c 50%,#0d2137 100%)", borderBottom: "3px solid #ffd600", padding: "28px 20px 20px", textAlign: "center" },
  trophyGlow: { fontSize: 52, lineHeight: 1, marginBottom: 8, filter: "drop-shadow(0 0 20px #ffd60066)" },
  heroTitle: { fontSize: 32, fontWeight: 900, margin: "0 0 4px", lineHeight: 1.1, letterSpacing: -1, color: "#fff" },
  heroSub: { color: "#78909c", fontSize: 13, margin: "0 0 0" },
  myStatsRow: { display: "flex", gap: 10, justifyContent: "center", marginTop: 16 },
  statBox: { background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 18px", display: "flex", flexDirection: "column", alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: 900, color: "#ffd600" },
  statLabel: { fontSize: 10, color: "#78909c", marginTop: 2 },
  nextMatchBadge: { background: "rgba(255,214,0,0.06)", border: "1px solid rgba(255,214,0,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: 14, display: "flex", flexDirection: "column", gap: 2 },
  cardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "20px 16px 8px" },
  actionCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 12px", borderRadius: 14, border: "1px solid", cursor: "pointer", transition: "transform 0.15s", color: "#e0e0e0" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  infoCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 12px", textAlign: "center" },
  infoCard2: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px", marginBottom: 12 },
  sectionTitle: { margin: "16px 0 10px", fontSize: 13, fontWeight: 700, color: "#90a4ae", letterSpacing: 0.5, textTransform: "uppercase" },
  rankRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(10px)" },
  topBarTitle: { fontWeight: 700, fontSize: 14, color: "#e0e0e0", textAlign: "center", flex: 1 },
  backBtn: { background: "none", border: "none", color: "#00bcd4", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "4px 0", width: 64 },
  formBox: { padding: "24px 20px" },
  label: { display: "block", color: "#90a4ae", fontSize: 12, fontWeight: 600, marginBottom: 5, letterSpacing: 0.3 },
  input: { width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "12px 14px", color: "#e0e0e0", fontSize: 15, marginBottom: 14, boxSizing: "border-box", outline: "none" },
  inputErr: { borderColor: "#ef5350" },
  errMsg: { color: "#ef5350", fontSize: 12, marginTop: -10, marginBottom: 10 },
  btn: { borderRadius: 10, padding: "12px 20px", fontWeight: 800, fontSize: 15, cursor: "pointer", border: "none", letterSpacing: 0.3 },
  btnFull: { width: "100%", display: "block", background: "#ffd600", color: "#0a0e1a" },
  linkBtn: { background: "none", border: "none", color: "#00bcd4", cursor: "pointer", fontWeight: 700, fontSize: 13, padding: 0 },
  usernameOk: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#4caf50", fontWeight: 700, fontSize: 16, marginTop: -7 },
  usernameErr: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#ef5350", fontWeight: 700, fontSize: 16, marginTop: -7 },
  multBadge: { background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.2)", borderRadius: 8, padding: "8px 16px", margin: "12px 16px 0", fontSize: 12, color: "#cfd8dc" },
  tabRow: { display: "flex", gap: 6, padding: "12px 16px 0", overflowX: "auto", scrollbarWidth: "none" },
  tab: { flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "6px 14px", color: "#90a4ae", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" },
  tabActive: { background: "#ffd600", color: "#0a0e1a", fontWeight: 700, border: "1px solid #ffd600" },
  matchCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px", marginBottom: 10, marginTop: 12 },
  matchRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 },
  team: { flex: 1, fontSize: 12, fontWeight: 600, color: "#e0e0e0", textAlign: "center" },
  groupBadge: { background: "rgba(255,214,0,0.15)", color: "#ffd600", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 },
  scoreInput: { width: 44, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", fontSize: 18, fontWeight: 700, textAlign: "center", padding: "6px 2px", outline: "none" },
  scoreInputSm: { width: 38, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#fff", fontSize: 14, fontWeight: 700, textAlign: "center", padding: "4px 2px", outline: "none" },
  scoreBox: { background: "rgba(0,188,212,0.15)", border: "1px solid rgba(0,188,212,0.3)", borderRadius: 6, color: "#e0e0e0", fontSize: 18, fontWeight: 700, textAlign: "center", padding: "4px 10px" },
  bottomBar: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(10,14,26,0.95)", backdropFilter: "blur(10px)", padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)", zIndex: 20 },
  btnSave: { width: "100%", background: "linear-gradient(90deg,#00bcd4,#0097a7)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontWeight: 800, fontSize: 15, cursor: "pointer" },
  btnSaveSmall: { background: "#00bcd4", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  rankCard: { display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px", marginBottom: 10 },
  rankFirst: { background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.3)" },
  rankSecond: { background: "rgba(207,216,220,0.06)", border: "1px solid rgba(207,216,220,0.2)" },
  rankThird: { background: "rgba(255,152,0,0.06)", border: "1px solid rgba(255,152,0,0.2)" },
  adminMatchCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px", marginBottom: 10 },
};
