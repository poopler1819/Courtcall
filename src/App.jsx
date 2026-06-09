import { useState, useEffect, useCallback } from "react";

// ── Storage helpers ────────────────────────────────────────────────────────
const KEYS = { users: "tb_users", slots: "tb_slots", polls: "tb_polls" };
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid  = () => Math.random().toString(36).slice(2, 9);

// ── Date / time helpers ────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
};
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${m.toString().padStart(2,"0")}${ampm}`;
};
const today = () => new Date().toISOString().split("T")[0];

// ── Singapore tennis venues ────────────────────────────────────────────────
const VENUES = [
  { name: "SAFRA Punggol",          area: "Punggol",      url: "https://www.safra.sg/facilities/tennis",                          emoji: "🎾" },
  { name: "SAFRA Jurong",           area: "Jurong",       url: "https://www.safra.sg/facilities/tennis",                          emoji: "🎾" },
  { name: "SAFRA Toa Payoh",        area: "Toa Payoh",    url: "https://www.safra.sg/facilities/tennis",                          emoji: "🎾" },
  { name: "SAFRA Mount Faber",      area: "Telok Blangah",url: "https://www.safra.sg/facilities/tennis",                          emoji: "🎾" },
  { name: "ActiveSG – Kallang",     area: "Kallang",      url: "https://members.myactivesg.com/facilities/view/activity/tennis",  emoji: "🏟" },
  { name: "ActiveSG – Queenstown",  area: "Queenstown",   url: "https://members.myactivesg.com/facilities/view/activity/tennis",  emoji: "🏟" },
  { name: "ActiveSG – Bishan",      area: "Bishan",       url: "https://members.myactivesg.com/facilities/view/activity/tennis",  emoji: "🏟" },
  { name: "ActiveSG – Woodlands",   area: "Woodlands",    url: "https://members.myactivesg.com/facilities/view/activity/tennis",  emoji: "🏟" },
  { name: "Kallang Tennis Centre",  area: "Kallang",      url: "https://www.kallangtennis.com.sg/book-a-court/",                  emoji: "🏆" },
  { name: "Singapore Tennis Centre",area: "East Coast",   url: "https://www.singaporetennis.com.sg/facilities/",                  emoji: "🏆" },
  { name: "Tanglin Club",           area: "Tanglin",      url: "https://www.tanglinclub.org.sg/sports/tennis/",                   emoji: "🌿" },
  { name: "Hollandse Club",         area: "Holland",      url: "https://www.hollandseclub.org.sg/sports/tennis",                  emoji: "🌿" },
];

// ── Weather emoji mapper ───────────────────────────────────────────────────
const wxEmoji = (forecast = "") => {
  const f = forecast.toLowerCase();
  if (f.includes("thunder"))    return "⛈";
  if (f.includes("heavy rain")) return "🌧";
  if (f.includes("rain") || f.includes("shower")) return "🌦";
  if (f.includes("cloudy"))     return "☁️";
  if (f.includes("hazy"))       return "🌫";
  if (f.includes("fair"))       return "☀️";
  if (f.includes("windy"))      return "💨";
  return "🌤";
};

const wxBg = (forecast = "") => {
  const f = forecast.toLowerCase();
  if (f.includes("thunder") || f.includes("heavy rain")) return "#2d3748";
  if (f.includes("rain") || f.includes("shower"))        return "#2b6cb0";
  if (f.includes("fair"))                                 return "#276749";
  return "#4a5568";
};

// ── NEA Weather hook ───────────────────────────────────────────────────────
// NEA API blocks direct browser calls (CORS). We try the direct URL first,
// then fall back to a public CORS proxy if needed.
const NEA_2H  = "https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast";
const NEA_24H = "https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast";
const PROXY   = "https://corsproxy.io/?url=";

async function neaFetch(url) {
  // Try direct first (works if hosted on same domain or CORS is open)
  try {
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if (r.ok) { const d = await r.json(); if (d?.data) return d; }
  } catch {}
  // Fall back to CORS proxy
  const r2 = await fetch(PROXY + encodeURIComponent(url), { headers: { "Accept": "application/json" } });
  if (!r2.ok) throw new Error("proxy failed");
  return r2.json();
}

function useWeather() {
  const [wx, setWx]         = useState(null);
  const [wx24, setWx24]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  const fetch2h = useCallback(async () => {
    try {
      const d = await neaFetch(NEA_2H);
      const items = d?.data?.items;
      if (!items?.length) throw new Error("no items");
      const forecasts = items[0].forecasts;
      const central = forecasts.find(f =>
        ["Bishan","Toa Payoh","Novena","Orchard","Newton"].includes(f.area)
      ) || forecasts[0];
      setWx({ area: central.area, forecast: central.forecast, updated: items[0].timestamp });
      setError(false);
    } catch (e) { console.error("2h weather:", e); setError(true); }
  }, []);

  const fetch24h = useCallback(async () => {
    try {
      const d = await neaFetch(NEA_24H);
      const items = d?.data?.items;
      if (!items?.length) throw new Error("no items");
      const rec = items[0];
      setWx24({ general: rec.general, periods: rec.periods });
    } catch (e) { console.error("24h weather:", e); }
  }, []);

  useEffect(() => {
    Promise.all([fetch2h(), fetch24h()]).finally(() => setLoading(false));
    const t = setInterval(() => { fetch2h(); fetch24h(); }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetch2h, fetch24h]);

  return { wx, wx24, loading, error };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
export default function TennisApp() {
  const [users, setUsers]           = useState(() => load(KEYS.users));
  const [slots, setSlots]           = useState(() => load(KEYS.slots));
  const [polls, setPolls]           = useState(() => load(KEYS.polls));
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView]             = useState("home");
  const [toast, setToast]           = useState(null);

  // Auth
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authPin,  setAuthPin]  = useState("");
  const [authErr,  setAuthErr]  = useState("");

  // Slot form
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [newSlot, setNewSlot] = useState({ date:"", timeFrom:"", timeTo:"", court:"", notes:"" });

  // Poll form
  const [showPollForm, setShowPollForm] = useState(false);
  const [newPoll, setNewPoll] = useState({ title:"", options:["",""] });

  // Venues filter
  const [venueFilter, setVenueFilter] = useState("All");

  // Weather
  const { wx, wx24, loading: wxLoading, error: wxError } = useWeather();

  useEffect(() => save(KEYS.users, users), [users]);
  useEffect(() => save(KEYS.slots, slots), [slots]);
  useEffect(() => save(KEYS.polls, polls), [polls]);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  // ── Auth ─────────────────────────────────────────────────────────────────
  const handleAuth = () => {
    const name = authName.trim();
    const pin  = authPin.trim();
    if (!name || pin.length < 4) { setAuthErr("Enter your name and a 4-digit PIN."); return; }
    if (authMode === "register") {
      if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
        setAuthErr("That name is already taken."); return;
      }
      const user = { id: uid(), name, pin };
      setUsers(p => [...p, user]);
      setCurrentUser(user);
      showToast(`Welcome, ${name}! 🎾`);
    } else {
      const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.pin === pin);
      if (!user) { setAuthErr("Name or PIN doesn't match."); return; }
      setCurrentUser(user);
      showToast(`Good to see you, ${user.name}!`);
    }
    setAuthName(""); setAuthPin(""); setAuthErr("");
    setView("home");
  };

  const logout = () => { setCurrentUser(null); setView("home"); };

  // ── Slots ─────────────────────────────────────────────────────────────────
  const postSlot = () => {
    const { date, timeFrom, timeTo, court } = newSlot;
    if (!date || !timeFrom || !timeTo || !court) { showToast("Fill in date, time, and court.", "err"); return; }
    setSlots(p => [{ id:uid(), ...newSlot, postedBy:currentUser.id, postedByName:currentUser.name, signups:[], createdAt:Date.now() }, ...p]);
    setNewSlot({ date:"", timeFrom:"", timeTo:"", court:"", notes:"" });
    setShowSlotForm(false);
    showToast("Slot posted!");
  };

  const toggleSignup = (slotId) =>
    setSlots(p => p.map(s => s.id !== slotId ? s : {
      ...s, signups: s.signups.includes(currentUser.id)
        ? s.signups.filter(id => id !== currentUser.id)
        : [...s.signups, currentUser.id]
    }));

  const deleteSlot = (id) => { setSlots(p => p.filter(s => s.id !== id)); showToast("Slot removed."); };

  // ── Polls ─────────────────────────────────────────────────────────────────
  const postPoll = () => {
    const title   = newPoll.title.trim();
    const options = newPoll.options.map(o => o.trim()).filter(Boolean);
    if (!title || options.length < 2) { showToast("Add a title and at least 2 options.", "err"); return; }
    setPolls(p => [{ id:uid(), title, options:options.map(o=>({label:o,votes:[]})), createdBy:currentUser.id, createdByName:currentUser.name, createdAt:Date.now() }, ...p]);
    setNewPoll({ title:"", options:["",""] });
    setShowPollForm(false);
    showToast("Poll created!");
  };

  const votePoll = (pollId, optIdx) =>
    setPolls(p => p.map(poll => poll.id !== pollId ? poll : {
      ...poll, options: poll.options.map((o, i) => i !== optIdx ? o : {
        ...o, votes: o.votes.includes(currentUser.id)
          ? o.votes.filter(id => id !== currentUser.id)
          : [...o.votes, currentUser.id]
      })
    }));

  const deletePoll = (id) => { setPolls(p => p.filter(x => x.id !== id)); showToast("Poll removed."); };

  // ── Venue areas for filter ────────────────────────────────────────────────
  const venueAreas = ["All", ...Array.from(new Set(VENUES.map(v => v.area.split(" ")[0])))];
  const filteredVenues = venueFilter === "All" ? VENUES : VENUES.filter(v => v.area.startsWith(venueFilter));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {toast && <div style={{...S.toast, background: toast.type==="err"?"#e53e3e":"#276749"}}>{toast.msg}</div>}

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <span style={S.logoIcon}>🎾</span>
            <span style={S.logoText}>CourtCall</span>
            <span style={S.logoBadge}>SG</span>
          </div>
          {currentUser && (
            <div style={S.headerRight}>
              <span style={S.userBadge}>👤 {currentUser.name}</span>
              <button style={S.btnHeaderLogout} onClick={logout}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      {/* Nav */}
      {currentUser && (
        <nav style={S.nav}>
          {[["home","🏠 Home"],["slots","📅 Court Slots"],["polls","🗳 Polls"],["venues","📍 Venues"],["weather","🌤 Weather"]].map(([k,l]) => (
            <button key={k} style={{...S.navBtn, ...(view===k?S.navBtnActive:{})}} onClick={() => setView(k)}>{l}</button>
          ))}
        </nav>
      )}

      <main style={S.main}>

        {/* ── AUTH ── */}
        {!currentUser && (
          <div style={S.authCard}>
            <div style={S.authEmoji}>🎾</div>
            <h1 style={S.authTitle}>CourtCall SG</h1>
            <p style={S.authSub}>Your crew's tennis planner — slots, polls & courts in one place.</p>
            <div style={S.tabRow}>
              {["login","register"].map(m => (
                <button key={m} style={{...S.tabBtn,...(authMode===m?S.tabBtnActive:{})}} onClick={() => { setAuthMode(m); setAuthErr(""); }}>
                  {m === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>
            <div style={S.fg}><label style={S.label}>Your name</label>
              <input style={S.input} placeholder="e.g. Marcus" value={authName} onChange={e=>setAuthName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} />
            </div>
            <div style={S.fg}><label style={S.label}>4-digit PIN</label>
              <input style={S.input} type="password" inputMode="numeric" maxLength={6} placeholder="••••" value={authPin} onChange={e=>setAuthPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAuth()} />
            </div>
            {authErr && <p style={S.errMsg}>{authErr}</p>}
            <button style={S.btnPrimary} onClick={handleAuth}>{authMode==="login"?"Sign in →":"Create account →"}</button>
          </div>
        )}

        {/* ── HOME ── */}
        {currentUser && view === "home" && (
          <div>
            <h2 style={S.pageTitle}>Hey {currentUser.name} 👋</h2>
            <p style={S.pageSub}>Here's what's on for your crew.</p>

            {/* Weather snapshot */}
            <WeatherSnapshot wx={wx} wx24={wx24} loading={wxLoading} error={wxError} onMore={() => setView("weather")} />

            {/* Stats */}
            <div style={S.grid3}>
              {[["📅", slots.length, "Open slots", "slots"], ["🗳", polls.length, "Active polls", "polls"], ["👥", users.length, "Players", null]].map(([ic,n,lb,v]) => (
                <div key={lb} style={S.statCard} onClick={() => v && setView(v)}>
                  <div style={S.statIcon}>{ic}</div>
                  <div style={S.statNum}>{n}</div>
                  <div style={S.statLabel}>{lb}</div>
                </div>
              ))}
            </div>

            <h3 style={S.sectionTitle}>Upcoming slots</h3>
            {slots.length === 0
              ? <div style={S.empty}>No slots yet — post one under Court Slots!</div>
              : slots.slice(0,3).map(s => <SlotCard key={s.id} slot={s} currentUser={currentUser} users={users} onSignup={toggleSignup} onDelete={deleteSlot} />)
            }
            {slots.length > 3 && <button style={S.btnLink} onClick={() => setView("slots")}>View all {slots.length} slots →</button>}
          </div>
        )}

        {/* ── COURT SLOTS ── */}
        {currentUser && view === "slots" && (
          <div>
            <div style={S.pageHeader}>
              <div><h2 style={S.pageTitle}>Court Slots</h2><p style={S.pageSub}>Post a slot or join someone's game.</p></div>
              <button style={S.btnPrimarySmall} onClick={() => setShowSlotForm(v=>!v)}>{showSlotForm?"Cancel":"+ Post slot"}</button>
            </div>
            {showSlotForm && (
              <div style={S.formCard}>
                <h3 style={S.formTitle}>New court slot</h3>
                <div style={S.fg}><label style={S.label}>Date</label>
                  <input style={S.input} type="date" min={today()} value={newSlot.date} onChange={e=>setNewSlot(p=>({...p,date:e.target.value}))} />
                </div>
                <div style={S.formRow}>
                  <div style={S.fg}><label style={S.label}>From</label>
                    <input style={S.input} type="time" value={newSlot.timeFrom} onChange={e=>setNewSlot(p=>({...p,timeFrom:e.target.value}))} />
                  </div>
                  <div style={S.fg}><label style={S.label}>To</label>
                    <input style={S.input} type="time" value={newSlot.timeTo} onChange={e=>setNewSlot(p=>({...p,timeTo:e.target.value}))} />
                  </div>
                </div>
                <div style={S.fg}><label style={S.label}>Court / Venue</label>
                  <input style={S.input} placeholder="e.g. SAFRA Punggol, Court 2" value={newSlot.court} onChange={e=>setNewSlot(p=>({...p,court:e.target.value}))} />
                </div>
                <div style={S.fg}><label style={S.label}>Notes (optional)</label>
                  <input style={S.input} placeholder="e.g. max 4 pax, bring your own racket" value={newSlot.notes} onChange={e=>setNewSlot(p=>({...p,notes:e.target.value}))} />
                </div>
                <button style={S.btnPrimary} onClick={postSlot}>Post slot</button>
              </div>
            )}
            {slots.length === 0
              ? <div style={S.empty}>No slots yet. Be the first to post!</div>
              : slots.map(s => <SlotCard key={s.id} slot={s} currentUser={currentUser} users={users} onSignup={toggleSignup} onDelete={deleteSlot} />)
            }
          </div>
        )}

        {/* ── POLLS ── */}
        {currentUser && view === "polls" && (
          <div>
            <div style={S.pageHeader}>
              <div><h2 style={S.pageTitle}>Availability Polls</h2><p style={S.pageSub}>Propose times and see who's free.</p></div>
              <button style={S.btnPrimarySmall} onClick={() => setShowPollForm(v=>!v)}>{showPollForm?"Cancel":"+ New poll"}</button>
            </div>
            {showPollForm && (
              <div style={S.formCard}>
                <h3 style={S.formTitle}>New poll</h3>
                <div style={S.fg}><label style={S.label}>Poll title</label>
                  <input style={S.input} placeholder="e.g. Weekend game — who's free?" value={newPoll.title} onChange={e=>setNewPoll(p=>({...p,title:e.target.value}))} />
                </div>
                <label style={S.label}>Time options</label>
                {newPoll.options.map((opt,i) => (
                  <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                    <input style={{...S.input,flex:1}} placeholder={`Option ${i+1} — e.g. Sat 14 Jun, 8–10am`} value={opt}
                      onChange={e => { const o=[...newPoll.options]; o[i]=e.target.value; setNewPoll(p=>({...p,options:o})); }} />
                    {newPoll.options.length > 2 && (
                      <button style={S.btnDanger} onClick={() => setNewPoll(p=>({...p,options:p.options.filter((_,j)=>j!==i)}))}>✕</button>
                    )}
                  </div>
                ))}
                <button style={S.btnGhost} onClick={() => setNewPoll(p=>({...p,options:[...p.options,""]}))}>+ Add option</button>
                <div style={{marginTop:16}}><button style={S.btnPrimary} onClick={postPoll}>Create poll</button></div>
              </div>
            )}
            {polls.length === 0
              ? <div style={S.empty}>No polls yet — create one to find the best time.</div>
              : polls.map(p => <PollCard key={p.id} poll={p} currentUser={currentUser} users={users} onVote={votePoll} onDelete={deletePoll} />)
            }
          </div>
        )}

        {/* ── VENUES ── */}
        {currentUser && view === "venues" && (
          <div>
            <h2 style={S.pageTitle}>Singapore Tennis Venues</h2>
            <p style={S.pageSub}>Tap any card to open the booking page directly.</p>

            {/* Area filter */}
            <div style={S.filterRow}>
              {["All","SAFRA","ActiveSG","Kallang","East","Tanglin","Holland","Jurong","Queenstown","Bishan","Woodlands","Punggol","Toa"].map(area => (
                VENUES.some(v => area==="All" || v.area.startsWith(area)) || area==="All"
                  ? <button key={area} style={{...S.filterBtn,...(venueFilter===area?S.filterBtnActive:{})}} onClick={() => setVenueFilter(area)}>{area}</button>
                  : null
              ))}
            </div>

            <div style={S.venueGrid}>
              {filteredVenues.map(v => (
                <a key={v.name} href={v.url} target="_blank" rel="noopener noreferrer" style={S.venueCard}>
                  <div style={S.venueEmoji}>{v.emoji}</div>
                  <div style={S.venueName}>{v.name}</div>
                  <div style={S.venueArea}>📍 {v.area}</div>
                  <div style={S.venueLink}>Book now →</div>
                </a>
              ))}
            </div>

            <div style={S.venueNote}>
              ℹ️ Live slot availability isn't accessible via public APIs — these links take you directly to each venue's booking portal where you can check real-time availability.
            </div>
          </div>
        )}

        {/* ── WEATHER ── */}
        {currentUser && view === "weather" && (
          <div>
            <h2 style={S.pageTitle}>Singapore Weather</h2>
            <p style={S.pageSub}>Live data from NEA — updated every 10 minutes.</p>
            <WeatherFull wx={wx} wx24={wx24} loading={wxLoading} error={wxError} />
          </div>
        )}

      </main>
    </div>
  );
}

// ── Weather Snapshot (Home) ────────────────────────────────────────────────
function WeatherSnapshot({ wx, wx24, loading, error, onMore }) {
  const forecast = wx?.forecast || "";
  const bg = wxBg(forecast);
  const emoji = wxEmoji(forecast);
  const isGood = !forecast.toLowerCase().includes("rain") && !forecast.toLowerCase().includes("thunder");

  return (
    <div style={{...S.wxSnap, background: bg}} onClick={onMore}>
      {loading ? (
        <div style={S.wxSnapText}>☁️ Loading weather…</div>
      ) : error || !wx ? (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={S.wxSnapEmoji}>📡</div>
            <div style={S.wxSnapForecast}>Weather unavailable</div>
            <div style={S.wxSnapArea}>NEA API temporarily unreachable</div>
          </div>
          <a href="https://www.nea.gov.sg/weather" target="_blank" rel="noopener noreferrer"
            style={{color:"#b7e4c7",fontSize:12,fontWeight:600,textDecoration:"none",flexShrink:0}}>
            NEA site →
          </a>
        </div>
      ) : (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={S.wxSnapEmoji}>{emoji}</div>
            <div style={S.wxSnapForecast}>{forecast}</div>
            <div style={S.wxSnapArea}>📍 {wx?.area} · Now</div>
            <div style={{...S.wxSnapAdvice, color: isGood?"#b7e4c7":"#fbd38d"}}>
              {isGood ? "✅ Good conditions for tennis" : "⚠️ Check before heading out"}
            </div>
          </div>
          {wx24?.general && (
            <div style={S.wxSnapRight}>
              <div style={S.wxSnapRightLabel}>Today</div>
              <div style={S.wxSnapRightTemp}>
                {wx24.general.temperature?.low}°–{wx24.general.temperature?.high}°C
              </div>
              <div style={S.wxSnapRightHum}>
                💧 {wx24.general.relativeHumidity?.low}–{wx24.general.relativeHumidity?.high}%
              </div>
              <div style={{...S.wxSnapRightMore}}>Full forecast →</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Weather Full Page ──────────────────────────────────────────────────────
function WeatherFull({ wx, wx24, loading, error }) {
  if (loading) return <div style={S.empty}>☁️ Fetching NEA data…</div>;
  if (error || !wx) return (
    <div style={{...S.wxBig, background:"#4a5568", textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:12}}>📡</div>
      <div style={{color:"#fff",fontWeight:700,marginBottom:8}}>Weather data unavailable</div>
      <div style={{color:"rgba(255,255,255,0.65)",fontSize:13,lineHeight:1.6,marginBottom:12}}>
        The NEA API may be temporarily unreachable.<br/>Check back in a few minutes.
      </div>
      <a href="https://www.nea.gov.sg/weather" target="_blank" rel="noopener noreferrer"
        style={{color:"#b7e4c7",fontSize:13,fontWeight:600,textDecoration:"none"}}>
        View NEA weather directly →
      </a>
    </div>
  );

  const forecast = wx?.forecast || "";
  const emoji    = wxEmoji(forecast);
  const bg       = wxBg(forecast);
  const isGood   = !forecast.toLowerCase().includes("rain") && !forecast.toLowerCase().includes("thunder");

  return (
    <div>
      {/* Current */}
      <div style={{...S.wxBig, background: bg}}>
        <div style={S.wxBigEmoji}>{emoji}</div>
        <div style={S.wxBigForecast}>{forecast}</div>
        <div style={S.wxBigArea}>📍 {wx?.area} · 2-hour forecast</div>
        <div style={{...S.wxBigAdvice, color: isGood?"#b7e4c7":"#fbd38d"}}>
          {isGood
            ? "✅ Conditions look good — get out there!"
            : "⚠️ Might want to wait this one out"}
        </div>
      </div>

      {/* 24-hour general */}
      {wx24?.general && (
        <div style={S.wxCard}>
          <div style={S.wxCardTitle}>24-Hour Outlook</div>
          <div style={S.wxGenRow}>
            <div style={S.wxGenItem}><div style={S.wxGenVal}>{wx24.general.temperature?.low}°–{wx24.general.temperature?.high}°C</div><div style={S.wxGenLabel}>Temperature</div></div>
            <div style={S.wxGenItem}><div style={S.wxGenVal}>{wx24.general.relativeHumidity?.low}–{wx24.general.relativeHumidity?.high}%</div><div style={S.wxGenLabel}>Humidity</div></div>
            <div style={S.wxGenItem}><div style={S.wxGenVal}>{wxEmoji(wx24.general.forecast)}</div><div style={S.wxGenLabel}>{wx24.general.forecast}</div></div>
          </div>
        </div>
      )}

      {/* Time periods */}
      {wx24?.periods?.length > 0 && (
        <div style={S.wxCard}>
          <div style={S.wxCardTitle}>Period Breakdown</div>
          {wx24.periods.map((period, i) => {
            const start = new Date(period.timePeriod?.start);
            const end   = new Date(period.timePeriod?.end);
            const label = start.toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:true}) + " – " + end.toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:true});
            const regions = period.regions || {};
            return (
              <div key={i} style={S.periodRow}>
                <div style={S.periodTime}>{label}</div>
                <div style={S.periodRegions}>
                  {Object.entries(regions).map(([region, fc]) => (
                    <div key={region} style={S.periodItem}>
                      <span style={S.periodRegion}>{region.charAt(0).toUpperCase()+region.slice(1)}</span>
                      <span style={S.periodFc}>{wxEmoji(fc)} {fc}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={S.wxSource}>Data source: NEA Singapore (data.gov.sg) · Refreshed every 10 min</div>
    </div>
  );
}

// ── Slot Card ──────────────────────────────────────────────────────────────
function SlotCard({ slot, currentUser, users, onSignup, onDelete }) {
  const isSignedUp  = slot.signups.includes(currentUser.id);
  const isOwner     = slot.postedBy === currentUser.id;
  const signupNames = slot.signups.map(id => users.find(u => u.id === id)?.name).filter(Boolean);

  return (
    <div style={S.card}>
      <div style={S.cardTop}>
        <div>
          <div style={S.cardDate}>{fmtDate(slot.date)}</div>
          <div style={S.cardTime}>{fmtTime(slot.timeFrom)} – {fmtTime(slot.timeTo)}</div>
          <div style={S.cardCourt}>📍 {slot.court}</div>
          {slot.notes && <div style={S.cardNotes}>{slot.notes}</div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"flex-start",flexShrink:0}}>
          <button style={{...S.btnSignup,...(isSignedUp?S.btnSignupActive:{})}} onClick={() => onSignup(slot.id)}>
            {isSignedUp ? "✓ Joined" : "Join"}
          </button>
          {isOwner && <button style={S.btnDanger} onClick={() => onDelete(slot.id)}>✕</button>}
        </div>
      </div>
      <div style={S.cardFooter}>
        <span style={S.postedBy}>Posted by {slot.postedByName}</span>
        {signupNames.length > 0 && <span style={S.signups}>{signupNames.join(", ")} {signupNames.length===1?"is":"are"} in</span>}
      </div>
    </div>
  );
}

// ── Poll Card ──────────────────────────────────────────────────────────────
function PollCard({ poll, currentUser, users, onVote, onDelete }) {
  const isOwner     = poll.createdBy === currentUser.id;
  const totalVoters = new Set(poll.options.flatMap(o => o.votes)).size;
  const maxVotes    = Math.max(...poll.options.map(o => o.votes.length), 1);

  return (
    <div style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={S.pollTitle}>{poll.title}</div>
        {isOwner && <button style={S.btnDanger} onClick={() => onDelete(poll.id)}>✕</button>}
      </div>
      {poll.options.map((opt,i) => {
        const voted      = opt.votes.includes(currentUser.id);
        const pct        = totalVoters===0 ? 0 : Math.round(opt.votes.length/totalVoters*100);
        const isTop      = opt.votes.length===maxVotes && opt.votes.length>0;
        const voterNames = opt.votes.map(id => users.find(u => u.id===id)?.name).filter(Boolean);
        return (
          <div key={i} style={S.pollOption} onClick={() => onVote(poll.id,i)}>
            <div style={S.pollBar}><div style={{...S.pollBarFill, width:`${pct}%`, background:isTop?"#276749":"#b7e4c7"}} /></div>
            <div style={S.pollMeta}>
              <span style={{fontWeight:voted?700:400,color:voted?"#276749":"#2d3748"}}>{opt.label}</span>
              <span style={S.pollCount}>{isTop&&opt.votes.length>0?"🏆 ":""}{opt.votes.length} {opt.votes.length===1?"vote":"votes"}</span>
            </div>
            {voterNames.length > 0 && <div style={S.voterNames}>{voterNames.join(", ")}</div>}
          </div>
        );
      })}
      <div style={{...S.cardFooter,marginTop:12}}>
        <span style={S.postedBy}>By {poll.createdByName}</span>
        <span style={S.signups}>{totalVoters} {totalVoters===1?"person":"people"} responded</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  root:     { minHeight:"100vh", background:"#f0f7f4", fontFamily:"'Inter','Helvetica Neue',sans-serif", color:"#2d3748" },
  header:   { background:"#1a4731", padding:"0 16px" },
  headerInner: { maxWidth:700, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", height:56 },
  logo:     { display:"flex", alignItems:"center", gap:8 },
  logoIcon: { fontSize:20 },
  logoText: { fontSize:18, fontWeight:800, color:"#fff", letterSpacing:"-0.4px" },
  logoBadge:{ fontSize:10, fontWeight:700, color:"#b7e4c7", background:"rgba(255,255,255,0.15)", padding:"2px 6px", borderRadius:4, letterSpacing:"0.5px" },
  headerRight: { display:"flex", alignItems:"center", gap:10 },
  userBadge:   { fontSize:12, color:"#b7e4c7", fontWeight:500 },
  btnHeaderLogout: { fontSize:12, color:"#b7e4c7", background:"none", border:"1px solid rgba(183,228,199,0.4)", borderRadius:6, padding:"5px 10px", cursor:"pointer" },

  nav:         { background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", overflowX:"auto" },
  navBtn:      { padding:"12px 14px", border:"none", background:"none", cursor:"pointer", fontSize:13, fontWeight:500, color:"#718096", whiteSpace:"nowrap", borderBottom:"2px solid transparent", flexShrink:0 },
  navBtnActive:{ color:"#276749", borderBottom:"2px solid #276749" },

  main: { maxWidth:700, margin:"0 auto", padding:"24px 16px 72px" },

  // Auth
  authCard:  { maxWidth:380, margin:"40px auto 0", background:"#fff", borderRadius:16, padding:"32px 24px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)" },
  authEmoji: { fontSize:44, textAlign:"center", marginBottom:8 },
  authTitle: { fontSize:24, fontWeight:800, textAlign:"center", color:"#1a4731", margin:"0 0 6px" },
  authSub:   { fontSize:13, color:"#718096", textAlign:"center", marginBottom:24, lineHeight:1.5 },
  tabRow:    { display:"flex", background:"#f0f7f4", borderRadius:8, padding:4, marginBottom:20 },
  tabBtn:    { flex:1, padding:"8px 0", border:"none", background:"none", borderRadius:6, cursor:"pointer", fontSize:14, fontWeight:500, color:"#718096" },
  tabBtnActive: { background:"#fff", color:"#276749", fontWeight:700, boxShadow:"0 1px 4px rgba(0,0,0,0.1)" },

  // Forms
  fg:       { marginBottom:14, flex:1 },
  formRow:  { display:"flex", gap:12 },
  label:    { display:"block", fontSize:11, fontWeight:700, color:"#4a5568", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px" },
  input:    { width:"100%", padding:"10px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box", background:"#fff", color:"#2d3748" },
  errMsg:   { color:"#e53e3e", fontSize:13, marginBottom:10, marginTop:-6 },
  formCard: { background:"#fff", borderRadius:12, padding:"20px", marginBottom:20, border:"1px solid #e2e8f0" },
  formTitle:{ fontSize:15, fontWeight:700, marginBottom:16, color:"#1a4731" },

  // Buttons
  btnPrimary:      { width:"100%", padding:"12px", background:"#276749", color:"#fff", border:"none", borderRadius:8, fontSize:15, fontWeight:700, cursor:"pointer" },
  btnPrimarySmall: { padding:"9px 16px", background:"#276749", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" },
  btnGhost:  { padding:"8px 14px", background:"none", border:"1.5px solid #276749", color:"#276749", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" },
  btnLink:   { background:"none", border:"none", color:"#276749", fontSize:14, fontWeight:600, cursor:"pointer", padding:"8px 0", display:"block" },
  btnSignup: { padding:"7px 14px", background:"#f0f7f4", border:"1.5px solid #b7e4c7", color:"#276749", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" },
  btnSignupActive: { background:"#276749", color:"#fff", border:"1.5px solid #276749" },
  btnDanger: { padding:"7px 10px", background:"#fff0f0", border:"1px solid #feb2b2", color:"#e53e3e", borderRadius:8, fontSize:13, cursor:"pointer" },

  // Cards
  card:       { background:"#fff", borderRadius:12, padding:"18px", marginBottom:14, border:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" },
  cardTop:    { display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 },
  cardDate:   { fontSize:11, fontWeight:700, color:"#276749", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:2 },
  cardTime:   { fontSize:20, fontWeight:800, color:"#1a4731", letterSpacing:"-0.5px" },
  cardCourt:  { fontSize:13, color:"#4a5568", marginTop:4 },
  cardNotes:  { fontSize:12, color:"#718096", marginTop:4, fontStyle:"italic" },
  cardFooter: { display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, paddingTop:12, borderTop:"1px solid #f0f7f4" },
  postedBy:   { fontSize:12, color:"#a0aec0" },
  signups:    { fontSize:12, color:"#276749", fontWeight:600 },

  // Polls
  pollTitle:   { fontSize:15, fontWeight:700, color:"#1a4731", lineHeight:1.3, flex:1 },
  pollOption:  { marginBottom:10, cursor:"pointer", borderRadius:8, padding:"10px 12px", background:"#f8fffe", border:"1px solid #e2e8f0", position:"relative", overflow:"hidden" },
  pollBar:     { position:"absolute", inset:0, borderRadius:8, overflow:"hidden" },
  pollBarFill: { height:"100%", transition:"width 0.4s ease", opacity:0.18 },
  pollMeta:    { display:"flex", justifyContent:"space-between", alignItems:"center", position:"relative", fontSize:14 },
  pollCount:   { fontSize:12, color:"#718096", fontWeight:600, flexShrink:0, marginLeft:8 },
  voterNames:  { fontSize:11, color:"#718096", marginTop:3, position:"relative" },

  // Home stats
  grid3:     { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:24 },
  statCard:  { background:"#fff", borderRadius:12, padding:"14px 10px", textAlign:"center", border:"1px solid #e2e8f0", cursor:"pointer" },
  statIcon:  { fontSize:18, marginBottom:4 },
  statNum:   { fontSize:26, fontWeight:800, color:"#276749" },
  statLabel: { fontSize:11, color:"#718096", marginTop:2 },

  // Page layout
  pageTitle:  { fontSize:22, fontWeight:800, color:"#1a4731", marginBottom:4, letterSpacing:"-0.5px" },
  pageSub:    { fontSize:14, color:"#718096", marginBottom:20 },
  pageHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, gap:12 },
  sectionTitle:{ fontSize:12, fontWeight:700, color:"#718096", textTransform:"uppercase", letterSpacing:"0.5px", margin:"24px 0 12px" },
  empty:      { textAlign:"center", color:"#a0aec0", padding:"40px 0", fontSize:14 },
  toast:      { position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", color:"#fff", padding:"12px 24px", borderRadius:50, fontSize:14, fontWeight:600, zIndex:9999, boxShadow:"0 4px 16px rgba(0,0,0,0.2)", pointerEvents:"none", whiteSpace:"nowrap" },

  // Venues
  filterRow: { display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 },
  filterBtn: { padding:"6px 12px", border:"1.5px solid #e2e8f0", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", background:"#fff", color:"#4a5568" },
  filterBtnActive: { background:"#276749", color:"#fff", border:"1.5px solid #276749" },
  venueGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12, marginBottom:16 },
  venueCard: { background:"#fff", borderRadius:12, padding:"16px 14px", border:"1px solid #e2e8f0", textDecoration:"none", color:"#2d3748", display:"block", transition:"box-shadow 0.15s", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" },
  venueEmoji:{ fontSize:24, marginBottom:8 },
  venueName: { fontSize:13, fontWeight:700, color:"#1a4731", marginBottom:4, lineHeight:1.3 },
  venueArea: { fontSize:12, color:"#718096", marginBottom:8 },
  venueLink: { fontSize:12, fontWeight:700, color:"#276749" },
  venueNote: { fontSize:12, color:"#a0aec0", lineHeight:1.6, background:"#fff", borderRadius:10, padding:"12px 14px", border:"1px solid #e2e8f0" },

  // Weather snapshot (home)
  wxSnap:        { borderRadius:14, padding:"18px 20px", marginBottom:24, cursor:"pointer" },
  wxSnapText:    { color:"rgba(255,255,255,0.7)", fontSize:14 },
  wxSnapEmoji:   { fontSize:28, marginBottom:4 },
  wxSnapForecast:{ fontSize:16, fontWeight:700, color:"#fff", marginBottom:2 },
  wxSnapArea:    { fontSize:12, color:"rgba(255,255,255,0.65)", marginBottom:6 },
  wxSnapAdvice:  { fontSize:12, fontWeight:600 },
  wxSnapRight:   { textAlign:"right" },
  wxSnapRightLabel: { fontSize:11, color:"rgba(255,255,255,0.6)", marginBottom:4 },
  wxSnapRightTemp:  { fontSize:20, fontWeight:800, color:"#fff" },
  wxSnapRightHum:   { fontSize:12, color:"rgba(255,255,255,0.7)", marginTop:2 },
  wxSnapRightMore:  { fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:6 },

  // Weather full page
  wxBig:        { borderRadius:16, padding:"28px 24px", marginBottom:20, textAlign:"center" },
  wxBigEmoji:   { fontSize:52, marginBottom:10 },
  wxBigForecast:{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:6 },
  wxBigArea:    { fontSize:13, color:"rgba(255,255,255,0.65)", marginBottom:10 },
  wxBigAdvice:  { fontSize:14, fontWeight:700 },
  wxCard:       { background:"#fff", borderRadius:12, padding:"18px", marginBottom:14, border:"1px solid #e2e8f0" },
  wxCardTitle:  { fontSize:12, fontWeight:700, color:"#718096", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:14 },
  wxGenRow:     { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 },
  wxGenItem:    { textAlign:"center" },
  wxGenVal:     { fontSize:18, fontWeight:800, color:"#1a4731" },
  wxGenLabel:   { fontSize:11, color:"#718096", marginTop:4 },
  periodRow:    { marginBottom:14, paddingBottom:14, borderBottom:"1px solid #f0f7f4" },
  periodTime:   { fontSize:12, fontWeight:700, color:"#276749", marginBottom:6 },
  periodRegions:{ display:"flex", flexDirection:"column", gap:4 },
  periodItem:   { display:"flex", justifyContent:"space-between", fontSize:13 },
  periodRegion: { color:"#4a5568", fontWeight:600 },
  periodFc:     { color:"#718096" },
  wxSource:     { fontSize:11, color:"#a0aec0", textAlign:"center", marginTop:16 },
};
