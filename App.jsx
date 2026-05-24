import { useState, useEffect, useRef, useCallback } from "react";

// ── Supabase client (inline, no npm needed) ────────────
const SUPABASE_URL = "https://wcfgauwolpjzbdsoyfms.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZmdhdXdvbHBqemJkc295Zm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODI4NTEsImV4cCI6MjA5NTE1ODg1MX0.2xS6O7w8-Fq3xgVE0P4uBiOuiAfK-qQTK0BqgGhjkKE";

const sb = {
  headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
  url: (table, query = "") => `${SUPABASE_URL}/rest/v1/${table}${query}`,

  async get(table, query = "") {
    const r = await fetch(this.url(table, query), { headers: { ...this.headers, "Accept": "application/json" } });
    return r.ok ? r.json() : [];
  },
  async upsert(table, body) {
    await fetch(this.url(table), { method: "POST", headers: { ...this.headers, "Prefer": "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(body) });
  },
  async insert(table, body) {
    await fetch(this.url(table), { method: "POST", headers: this.headers, body: JSON.stringify(body) });
  },
  async delete(table, query) {
    await fetch(this.url(table, query), { method: "DELETE", headers: this.headers });
  },

  // Real-time via Supabase Realtime websocket
  subscribe(table, cb) {
    const wsUrl = SUPABASE_URL.replace("https://", "wss://") + "/realtime/v1/websocket?apikey=" + SUPABASE_ANON_KEY + "&vsn=1.0.0";
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ topic: `realtime:public:${table}`, event: "phx_join", payload: {}, ref: "1" }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "INSERT" || msg.event === "UPDATE" || msg.event === "DELETE") cb(msg);
    };
    ws.onerror = () => {}; // silent — app works without real-time
    return () => ws.close();
  }
};

const PEOPLE = {
  alex:   { name: "Alex",     color: "#F2A4C0", emoji: "🌸" },
  liam:   { name: "Liam",     color: "#82C4F0", emoji: "⚡" },
  rotate: { name: "Rotating", color: "#A8D8A8", emoji: "🔄" },
};

const CATEGORIES = [
  { key: "all",           label: "All",           emoji: "🏠" },
  { key: "whole-house",   label: "Whole House",   emoji: "🌀" },
  { key: "kitchen",       label: "Kitchen",       emoji: "🍳" },
  { key: "living-room",   label: "Living Room",   emoji: "🛋️" },
  { key: "primary-bed",   label: "Primary Bed",   emoji: "🛏️" },
  { key: "spare-room",    label: "Spare Room",    emoji: "💼" },
  { key: "main-bathroom", label: "Main Bathroom", emoji: "🚿" },
  { key: "powder-room",   label: "Powder Room",   emoji: "🚽" },
  { key: "outdoor",          label: "Outdoor",        emoji: "🌿" },
  { key: "home-maintenance", label: "Maintenance",    emoji: "🔨" },
  { key: "pet-care",         label: "Pet Care",       emoji: "🐶" },
  { key: "admin",            label: "Admin",          emoji: "📋" },
  { key: "restocking",       label: "Restocking",     emoji: "🛍️" },
];

const PERSON_FILTERS = [
  { key: "everyone", label: "Everyone", emoji: "👥" },
  { key: "alex",     label: "Alex",     emoji: PEOPLE.alex.emoji },
  { key: "liam",     label: "Liam",     emoji: PEOPLE.liam.emoji },
  { key: "overdue",  label: "Overdue",  emoji: "⚠️" },
];

const FREQ_LABELS = {
  "every-few-days": "Every few days",
  daily:            "Daily",
  "twice-weekly":   "2× week",
  weekly:           "Weekly",
  fortnightly:      "Fortnightly",
  monthly:          "Monthly",
  "every-2-months": "Every 2 months",
  seasonal:         "Seasonal",
  yearly:           "Yearly",
};

const OVERDUE_DAYS = {
  daily:            1,
  "every-few-days": 4,
  "twice-weekly":   5,
  weekly:           9,
  fortnightly:      16,
  monthly:          35,
  "every-2-months": 65,
  seasonal:         100,
  yearly:           370,
};

// Frequency → times per month
const FREQ_PER_MONTH = {
  daily:            30,
  "every-few-days": 10,
  "twice-weekly":    8,
  weekly:            4,
  fortnightly:       2,
  monthly:           1,
  "every-2-months":  0.5,
  seasonal:          0.17,
  yearly:            0.083,
};

// effort (1-5) and mentalLoad (1-3) for original chores
const CHORE_WEIGHTS = {
  1:  { effort: 2, mentalLoad: 1 },  6:  { effort: 3, mentalLoad: 1 },
  2:  { effort: 2, mentalLoad: 3 },  7:  { effort: 3, mentalLoad: 1 },
  3:  { effort: 3, mentalLoad: 2 },  8:  { effort: 2, mentalLoad: 2 },
  4:  { effort: 1, mentalLoad: 1 },  9:  { effort: 2, mentalLoad: 2 },
  5:  { effort: 2, mentalLoad: 1 },  10: { effort: 2, mentalLoad: 1 },
  11: { effort: 4, mentalLoad: 1 },  25: { effort: 2, mentalLoad: 1 },
  12: { effort: 2, mentalLoad: 1 },  26: { effort: 2, mentalLoad: 2 },
  13: { effort: 2, mentalLoad: 1 },  27: { effort: 3, mentalLoad: 1 },
  15: { effort: 2, mentalLoad: 1 },  28: { effort: 2, mentalLoad: 1 },
  16: { effort: 1, mentalLoad: 2 },  29: { effort: 2, mentalLoad: 2 },
  17: { effort: 2, mentalLoad: 2 },  30: { effort: 2, mentalLoad: 1 },
  18: { effort: 3, mentalLoad: 1 },  31: { effort: 1, mentalLoad: 2 },
  19: { effort: 3, mentalLoad: 1 },  32: { effort: 2, mentalLoad: 2 },
  20: { effort: 2, mentalLoad: 1 },  33: { effort: 2, mentalLoad: 3 },
  21: { effort: 3, mentalLoad: 1 },  34: { effort: 2, mentalLoad: 3 },
  22: { effort: 1, mentalLoad: 2 },  35: { effort: 2, mentalLoad: 3 },
  23: { effort: 1, mentalLoad: 2 },  36: { effort: 1, mentalLoad: 1 },
  24: { effort: 1, mentalLoad: 1 },  37: { effort: 1, mentalLoad: 1 },
                                     38: { effort: 1, mentalLoad: 1 },
};

// Works for any chore — uses stored effort/mentalLoad for new ones, table for originals
function calcScore(chore) {
  const freq = FREQ_PER_MONTH[chore.frequency] ?? 1;
  const w = (chore.effort != null && chore.mentalLoad != null)
    ? { effort: chore.effort, mentalLoad: chore.mentalLoad }
    : (CHORE_WEIGHTS[chore.id] ?? { effort: 2, mentalLoad: 1 });
  return freq * w.effort * w.mentalLoad;
}

const INITIAL_CHORES = [
  // ── WHOLE HOUSE ────────────────────────────────────────
  {
    id: 6, name: "Vacuuming", owner: "alex", icon: "🌀", accent: "#3A90D4", category: "whole-house",
    subtasks: [
      { id: "6a", text: "Hallway & stairs", done: false },
      { id: "6b", text: "Living room", done: false },
      { id: "6c", text: "Primary bedroom", done: false },
      { id: "6d", text: "Spare room / office", done: false },
      { id: "6e", text: "Under furniture where possible", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },
  {
    id: 7, name: "Mopping", owner: "rotate", icon: "🫧", accent: "#2B7FC0", category: "whole-house", rotationTurn: "liam",
    subtasks: [
      { id: "7a", text: "Kitchen floor", done: false },
      { id: "7b", text: "Bathroom floors", done: false },
      { id: "7c", text: "Hallway floor", done: false },
      { id: "7d", text: "Any other hard floors", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },
  {
    id: 8, name: "Laundry", owner: "alex", icon: "👕", accent: "#4AAAD0", category: "whole-house",
    subtasks: [
      { id: "8a", text: "Sort & load the washing machine", done: false },
      { id: "8b", text: "Move to dryer or hang to dry", done: false },
      { id: "8c", text: "Fold & put away", done: false },
    ],
    lastDone: null, frequency: "twice-weekly",
  },
  {
    id: 16, name: "Bins", owner: "rotate", icon: "🗑️", accent: "#5A9E5A", category: "whole-house", rotationTurn: "liam",
    subtasks: [
      { id: "16a", text: "Put bins out the night before collection", done: false },
      { id: "16b", text: "Bring bins back inside after collection", done: false },
      { id: "16c", text: "Wipe bin lids if needed", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },
  {
    id: 2, name: "Groceries", owner: "liam", icon: "🛒", accent: "#C06090", category: "whole-house",
    subtasks: [
      { id: "2a", text: "Check fridge, freezer & cupboards", done: false },
      { id: "2b", text: "Write or update the shopping list", done: false },
      { id: "2c", text: "Shop or place online order", done: false },
      { id: "2d", text: "Put everything away", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },
  {
    id: 9, name: "Washing machine", owner: "liam", icon: "🔧", accent: "#5590C0", category: "whole-house",
    subtasks: [
      { id: "9a", text: "Run a hot empty clean cycle", done: false },
      { id: "9b", text: "Clean the detergent drawer", done: false },
      { id: "9c", text: "Wipe door seal / drum rim", done: false },
      { id: "9d", text: "Clean the pump filter", done: false },
      { id: "9e", text: "Wipe outside of machine", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },
  {
    id: 5, name: "Dusting — furniture & shelves", owner: "alex", icon: "🪴", accent: "#E8849A", category: "whole-house",
    subtasks: [
      { id: "5a", text: "Living room shelves & surfaces", done: false },
      { id: "5b", text: "Primary bedroom furniture & surfaces", done: false },
      { id: "5c", text: "Spare room / office desk & shelves", done: false },
      { id: "5d", text: "TV unit & electronics", done: false },
      { id: "5e", text: "Windowsills throughout", done: false },
    ],
    lastDone: null, frequency: "fortnightly",
  },
  {
    id: 18, name: "Dusting — skirting & detail", owner: "rotate", icon: "🧹", accent: "#72B050", category: "whole-house", rotationTurn: "liam",
    subtasks: [
      { id: "18a", text: "Skirting boards — living areas", done: false },
      { id: "18b", text: "Skirting boards — bedrooms", done: false },
      { id: "18c", text: "Chair & table legs", done: false },
      { id: "18d", text: "Chair feet pads — wipe & check condition", done: false },
      { id: "18e", text: "Light fittings & ceiling corners", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },

  // ── KITCHEN ────────────────────────────────────────────
  {
    id: 1, name: "Kitchen surfaces", owner: "liam", icon: "🍳", accent: "#E8749A", category: "kitchen",
    subtasks: [
      { id: "1a", text: "Wipe counters & splashback", done: false },
      { id: "1b", text: "Clean stovetop", done: false },
      { id: "1c", text: "Wipe microwave inside & out", done: false },
      { id: "1d", text: "Wipe down cupboard fronts", done: false },
      { id: "1e", text: "Empty & wipe sink", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },
  {
    id: 20, name: "Washing dishes", owner: "rotate", icon: "🫧", accent: "#E07060", category: "kitchen", rotationTurn: "alex",
    subtasks: [
      { id: "20a", text: "Wash up / run dishwasher", done: false },
      { id: "20b", text: "Dry & put away", done: false },
      { id: "20c", text: "Wipe down sink", done: false },
    ],
    lastDone: null, frequency: "daily",
  },
  {
    id: 3, name: "Fridge", owner: "liam", icon: "🧊", accent: "#9B59A0", category: "kitchen",
    subtasks: [
      { id: "3a", text: "Remove & discard old/expired items", done: false },
      { id: "3b", text: "Take out shelves & drawers", done: false },
      { id: "3c", text: "Wipe shelves, drawers & walls inside", done: false },
      { id: "3d", text: "Wipe door seals", done: false },
      { id: "3e", text: "Replace shelves & restock neatly", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },
  {
    id: 10, name: "Dishwasher", owner: "liam", icon: "🍽️", accent: "#2D80B8", category: "kitchen",
    subtasks: [
      { id: "10a", text: "Remove & rinse the filter", done: false },
      { id: "10b", text: "Wipe door seal & edges", done: false },
      { id: "10c", text: "Run a cleaning cycle (with tablet)", done: false },
      { id: "10d", text: "Wipe down outside & controls", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },

  // ── LIVING ROOM ────────────────────────────────────────
  {
    id: 15, name: "Couch covers", owner: "rotate", icon: "🛋️", accent: "#6AAD6A", category: "living-room", rotationTurn: "alex",
    subtasks: [
      { id: "15a", text: "Remove all covers / cushion cases", done: false },
      { id: "15b", text: "Wash & dry", done: false },
      { id: "15c", text: "Put back on neatly", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },
  {
    id: 21, name: "Rug", owner: "rotate", icon: "🟫", accent: "#B07840", category: "living-room", rotationTurn: "liam",
    subtasks: [
      { id: "21a", text: "Vacuum rug thoroughly", done: false },
      { id: "21b", text: "Spot clean any stains", done: false },
      { id: "21c", text: "Shake out or air outside if possible", done: false },
    ],
    lastDone: null, frequency: "every-2-months",
  },

  // ── PRIMARY BEDROOM ────────────────────────────────────
  {
    id: 13, name: "Bedsheets — primary", owner: "rotate", icon: "🛏️", accent: "#60B060", category: "primary-bed", rotationTurn: "alex",
    subtasks: [
      { id: "13a", text: "Strip the bed", done: false },
      { id: "13b", text: "Wash sheets & pillowcases", done: false },
      { id: "13c", text: "Remake the bed", done: false },
    ],
    lastDone: null, frequency: "fortnightly",
  },
  {
    id: 22, name: "Water plants — primary bedroom", owner: "rotate", icon: "🪴", accent: "#50A870", category: "primary-bed", rotationTurn: "alex",
    subtasks: [
      { id: "22a", text: "Check soil moisture", done: false },
      { id: "22b", text: "Water plants as needed", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },

  // ── SPARE ROOM ─────────────────────────────────────────
  {
    id: 23, name: "Water plants — spare room", owner: "rotate", icon: "🪴", accent: "#60B870", category: "spare-room", rotationTurn: "liam",
    subtasks: [
      { id: "23a", text: "Check soil moisture", done: false },
      { id: "23b", text: "Water plants as needed", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },

  // ── MAIN BATHROOM ──────────────────────────────────────
  {
    id: 11, name: "Main bathroom", owner: "rotate", icon: "🚿", accent: "#4BAD7A", category: "main-bathroom", rotationTurn: "alex",
    subtasks: [
      { id: "11a", text: "Scrub toilet inside & out", done: false },
      { id: "11b", text: "Wipe sink, tap & vanity", done: false },
      { id: "11c", text: "Scrub shower / bath & screen", done: false },
      { id: "11d", text: "Mop floor", done: false },
      { id: "11e", text: "Replace towels & bath mat", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },
  {
    id: 4, name: "Mirror — main bathroom", owner: "alex", icon: "🪞", accent: "#D47BA0", category: "main-bathroom",
    subtasks: [
      { id: "4a", text: "Spray & wipe mirror", done: false },
      { id: "4b", text: "Polish to streak-free finish", done: false },
    ],
    lastDone: null, frequency: "fortnightly",
  },
  {
    id: 25, name: "Exhaust fan", owner: "rotate", icon: "💨", accent: "#6AAAC0", category: "main-bathroom", rotationTurn: "alex",
    subtasks: [
      { id: "25a", text: "Turn off power at switch", done: false },
      { id: "25b", text: "Remove & wipe fan cover", done: false },
      { id: "25c", text: "Vacuum / wipe fan blades & housing", done: false },
      { id: "25d", text: "Replace cover & restore power", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },

  // ── POWDER ROOM ────────────────────────────────────────
  {
    id: 12, name: "Powder room", owner: "rotate", icon: "🚽", accent: "#3A9A68", category: "powder-room", rotationTurn: "liam",
    subtasks: [
      { id: "12a", text: "Scrub toilet inside & out", done: false },
      { id: "12b", text: "Wipe sink & tap", done: false },
      { id: "12c", text: "Wipe surfaces & floor", done: false },
      { id: "12d", text: "Replace hand towel", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },
  {
    id: 24, name: "Mirror — powder room", owner: "alex", icon: "🪞", accent: "#C46898", category: "powder-room",
    subtasks: [
      { id: "24a", text: "Spray & wipe mirror", done: false },
      { id: "24b", text: "Polish to streak-free finish", done: false },
    ],
    lastDone: null, frequency: "fortnightly",
  },

  // ── OUTDOOR ────────────────────────────────────────────
  {
    id: 17, name: "Poop scooping", owner: "rotate", icon: "🐾", accent: "#8BBD5A", category: "outdoor", rotationTurn: "alex",
    subtasks: [
      { id: "17a", text: "Scoop the yard", done: false },
      { id: "17b", text: "Bag & dispose", done: false },
    ],
    lastDone: null, frequency: "every-few-days",
  },
  {
    id: 19, name: "Leaf clearing", owner: "liam", icon: "🍂", accent: "#C08040", category: "outdoor",
    subtasks: [
      { id: "19a", text: "Rake / blow leaves from yard", done: false },
      { id: "19b", text: "Clear gutters if needed", done: false },
      { id: "19c", text: "Bag or compost leaves", done: false },
    ],
    lastDone: null, frequency: "seasonal",
  },
  {
    id: 27, name: "Weeding", owner: "rotate", icon: "🌱", accent: "#6AA840", category: "outdoor", rotationTurn: "alex",
    subtasks: [
      { id: "27a", text: "Check garden beds & paths for weeds", done: false },
      { id: "27b", text: "Pull weeds by root", done: false },
      { id: "27c", text: "Dispose of weeds", done: false },
    ],
    lastDone: null, frequency: "fortnightly",
  },
  {
    id: 28, name: "Sweep front porch", owner: "rotate", icon: "🚪", accent: "#A09060", category: "outdoor", rotationTurn: "liam",
    subtasks: [
      { id: "28a", text: "Sweep porch & steps", done: false },
      { id: "28b", text: "Wipe down door & frame if needed", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },

  // ── HOME MAINTENANCE ───────────────────────────────────
  {
    id: 26, name: "Smoke alarms", owner: "rotate", icon: "🚨", accent: "#E05050", category: "home-maintenance", rotationTurn: "liam",
    subtasks: [
      { id: "26a", text: "Test each alarm with test button", done: false },
      { id: "26b", text: "Replace batteries if needed", done: false },
      { id: "26c", text: "Note any that need replacing", done: false },
    ],
    lastDone: new Date(Date.now() - 14 * 86400000).toISOString(), frequency: "yearly",
  },

  // ── PET CARE ───────────────────────────────────────────
  {
    id: 29, name: "Worming", owner: "rotate", icon: "💊", accent: "#A06080", category: "pet-care", rotationTurn: "alex",
    subtasks: [
      { id: "29a", text: "Administer worming treatment (due 21st)", done: false },
      { id: "29b", text: "Note date given", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },
  {
    id: 30, name: "Grooming", owner: "liam", icon: "✂️", accent: "#C080A0", category: "pet-care",
    subtasks: [
      { id: "30a", text: "Book grooming appointment", done: false },
      { id: "30b", text: "Drop off & collect pet", done: false },
    ],
    lastDone: null, frequency: "every-2-months",
  },
  {
    id: 31, name: "Annual vet check-up", owner: "rotate", icon: "🏥", accent: "#70A0C0", category: "pet-care", rotationTurn: "liam",
    subtasks: [
      { id: "31a", text: "Book appointment (vet sends reminder)", done: false },
      { id: "31b", text: "Attend appointment", done: false },
      { id: "31c", text: "Note any follow-up care needed", done: false },
    ],
    lastDone: null, frequency: "yearly",
  },
  {
    id: 32, name: "Pet food restock", owner: "liam", icon: "🦴", accent: "#B09050", category: "pet-care",
    subtasks: [
      { id: "32a", text: "Check food & treat supplies", done: false },
      { id: "32b", text: "Order or buy what's needed", done: false },
      { id: "32c", text: "Put away", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },

  // ── ADMIN ──────────────────────────────────────────────
  {
    id: 33, name: "Bills & finances", owner: "alex", icon: "💰", accent: "#5080C0", category: "admin",
    subtasks: [
      { id: "33a", text: "Check & pay any outstanding bills", done: false },
      { id: "33b", text: "Review bank/credit card statements", done: false },
      { id: "33c", text: "File any paperwork", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },
  {
    id: 34, name: "Shared calendar", owner: "alex", icon: "📅", accent: "#6070D0", category: "admin",
    subtasks: [
      { id: "34a", text: "Check upcoming week & flag clashes", done: false },
      { id: "34b", text: "Add any new events or appointments", done: false },
      { id: "34c", text: "Confirm anything needing a response", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },
  {
    id: 35, name: "Scheduling & RSVPs", owner: "alex", icon: "📬", accent: "#7060C0", category: "admin",
    subtasks: [
      { id: "35a", text: "Respond to any outstanding invites", done: false },
      { id: "35b", text: "Follow up on catch-ups to organise", done: false },
      { id: "35c", text: "Update calendar with confirmed plans", done: false },
    ],
    lastDone: null, frequency: "weekly",
  },

  // ── RESTOCKING ─────────────────────────────────────────
  {
    id: 36, name: "Toilet paper", owner: "alex", icon: "🧻", accent: "#B0A070", category: "restocking",
    subtasks: [
      { id: "36a", text: "Check stock level", done: false },
      { id: "36b", text: "Place online order if running low", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },
  {
    id: 37, name: "Dishwasher tablets", owner: "alex", icon: "✨", accent: "#70A0B0", category: "restocking",
    subtasks: [
      { id: "37a", text: "Check stock level", done: false },
      { id: "37b", text: "Place online order if running low", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },
  {
    id: 38, name: "Laundry detergent", owner: "alex", icon: "🧺", accent: "#A070B0", category: "restocking",
    subtasks: [
      { id: "38a", text: "Check stock level", done: false },
      { id: "38b", text: "Place online order if running low", done: false },
    ],
    lastDone: null, frequency: "monthly",
  },
];

// ── Helpers ────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function isOverdue(chore) {
  const days = daysSince(chore.lastDone);
  if (days === null) return true;
  return days >= (OVERDUE_DAYS[chore.frequency] || 9);
}

function calcLoads(chores) {
  let alex = 0, liam = 0;
  chores.forEach(c => {
    const s = calcScore(c);
    if (c.owner === "alex") alex += s;
    else if (c.owner === "liam") liam += s;
    else { alex += s / 2; liam += s / 2; }
  });
  return { alex: Math.round(alex), liam: Math.round(liam), total: Math.round(alex + liam) };
}

// ── Sub-components ─────────────────────────────────────
function ProgressRing({ percent, color, size = 38 }) {
  const r = (size - 7) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EDEDED" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={circ - (percent/100)*circ}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.45s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
}

function LastDoneLabel({ date, frequency }) {
  const days = daysSince(date);
  if (days === null) return <span style={{ color: "#bbb", fontSize: 11 }}>Never done</span>;
  if (days === 0) return <span style={{ color: "#5BAD7A", fontSize: 11, fontWeight: 700 }}>Done today ✓</span>;
  if (days === 1) return <span style={{ color: "#5BAD7A", fontSize: 11 }}>Yesterday</span>;
  const over = days >= (OVERDUE_DAYS[frequency] || 9);
  return (
    <span style={{ color: over ? "#D06060" : "#A0906A", fontSize: 11, fontWeight: over ? 700 : 400 }}>
      {over ? "⚠ " : ""}{days}d ago
    </span>
  );
}

function OwnerBadge({ chore }) {
  const isRotate = chore.owner === "rotate";
  const person = isRotate ? PEOPLE[chore.rotationTurn] : PEOPLE[chore.owner];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700,
      background: person.color + "30", color: person.color,
      borderRadius: 5, padding: "2px 6px", border: `1px solid ${person.color}50`,
    }}>
      {person.emoji} {isRotate ? `${person.name}'s turn` : person.name}
    </span>
  );
}

// ── Swap Modal ─────────────────────────────────────────
function SwapModal({ chore, onClose, onSwap, onCoveredFor, onToggleRotation, onFrequencyChange, onEdit }) {
  const isRotating = chore.owner === "rotate";
  const currentPerson = isRotating ? chore.rotationTurn : chore.owner;
  const other = currentPerson === "alex" ? "liam" : "alex";
  const otherP = PEOPLE[other];
  const currentP = PEOPLE[currentPerson];

  const SectionLabel = ({ children }) => (
    <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 }}>
      {children}
    </p>
  );

  const ModalButton = ({ onClick, borderColor, bg, icon, title, subtitle }) => (
    <button onClick={onClick} style={{
      width: "100%", padding: "13px 16px", borderRadius: 12,
      border: `1.5px solid ${borderColor}`, background: bg,
      cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
      marginBottom: 8,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C2E" }}>{title}</div>
        <div style={{ fontSize: 11, color: "#AAA", marginTop: 1 }}>{subtitle}</div>
      </div>
    </button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: "20px 20px 0 0", padding: "24px 20px 36px",
        width: "100%", maxWidth: 520,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
        animation: "slideUp 0.25s ease",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, background: "#E0E0E0", borderRadius: 2, margin: "0 auto 20px" }} />

        <h3 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 18, color: "#1C1C2E", marginBottom: 2 }}>
          {chore.icon} {chore.name}
        </h3>
        <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
            background: isRotating ? PEOPLE.rotate.color + "30" : currentP.color + "30",
            color: isRotating ? "#4A8A4A" : currentP.color,
            border: `1px solid ${isRotating ? PEOPLE.rotate.color + "60" : currentP.color + "50"}`,
          }}>
            {isRotating ? `🔄 Rotating — ${currentP.name}'s turn` : `${currentP.emoji} ${currentP.name}'s chore`}
          </span>
        </div>

        {/* Frequency picker */}
        <SectionLabel>Change frequency</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
          {Object.entries(FREQ_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onFrequencyChange(chore, key)}
              style={{
                padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                background: chore.frequency === key ? "#1C1C2E" : "#F0EEEB",
                color: chore.frequency === key ? "white" : "#666",
                transition: "all 0.15s",
              }}
            >{label}</button>
          ))}
        </div>

        {/* One-time cover */}
        <SectionLabel>One-time cover</SectionLabel>
        <ModalButton
          onClick={() => onCoveredFor(chore, other)}
          borderColor="#E0EEE0" bg="#F5FBF5"
          icon={otherP.emoji}
          title={`${otherP.name} will do it this time`}
          subtitle="Logs as covered, ownership stays the same"
        />
        <ModalButton
          onClick={() => onCoveredFor(chore, "guest")}
          borderColor="#F5ECD8" bg="#FFFAF3"
          icon="🧑‍🤝‍🧑"
          title="A guest or helper did it"
          subtitle="Logs as done, neither person gets credit"
        />

        {/* Permanent transfer */}
        <SectionLabel>Permanent transfer</SectionLabel>
        <ModalButton
          onClick={() => onSwap(chore)}
          borderColor="#E0E8F8" bg="#F5F8FD"
          icon="🔁"
          title={isRotating ? `Give to ${otherP.name} on rotation` : `Transfer to ${otherP.name} permanently`}
          subtitle={isRotating ? `Next turn goes to ${otherP.name} instead` : `${otherP.name} takes over going forward`}
        />

        {/* Rotate ↔ Owned toggle */}
        <SectionLabel>Change chore type</SectionLabel>
        {isRotating ? (
          <>
            <ModalButton
              onClick={() => onToggleRotation(chore, "alex")}
              borderColor="#F0E0F8" bg="#FBF5FD"
              icon="🌸"
              title="Make Alex's permanently"
              subtitle="Removes from rotation — Alex owns it going forward"
            />
            <ModalButton
              onClick={() => onToggleRotation(chore, "liam")}
              borderColor="#E0EEF8" bg="#F5F8FD"
              icon="⚡"
              title="Make Liam's permanently"
              subtitle="Removes from rotation — Liam owns it going forward"
            />
          </>
        ) : (
          <ModalButton
            onClick={() => onToggleRotation(chore, "rotate")}
            borderColor="#E0F0E0" bg="#F5FBF5"
            icon="🔄"
            title="Make this a rotating chore"
            subtitle={`Both take turns — starting with ${currentP.name}`}
          />
        )}

        <button onClick={onClose} style={{
          marginTop: 6, width: "100%", padding: "11px", borderRadius: 12,
          border: "none", background: "#F5F5F5", color: "#888",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>Cancel</button>

        {/* Edit / delete */}
        <button onClick={() => onEdit(chore)} style={{
          marginTop: 8, width: "100%", padding: "11px", borderRadius: 12,
          border: "1.5px solid #EEE", background: "white", color: "#666",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>✏️ Edit name, subtasks or scoring</button>
      </div>
    </div>
  );
}

// ── Add Chore Modal ────────────────────────────────────
const CATEGORY_OPTIONS = [
  { key: "whole-house",      label: "Whole House"   },
  { key: "kitchen",          label: "Kitchen"       },
  { key: "living-room",      label: "Living Room"   },
  { key: "primary-bed",      label: "Primary Bed"   },
  { key: "spare-room",       label: "Spare Room"    },
  { key: "main-bathroom",    label: "Main Bathroom" },
  { key: "powder-room",      label: "Powder Room"   },
  { key: "outdoor",          label: "Outdoor"       },
  { key: "home-maintenance", label: "Maintenance"   },
  { key: "pet-care",         label: "Pet Care"      },
  { key: "admin",            label: "Admin"         },
  { key: "restocking",       label: "Restocking"    },
];

const ICON_OPTIONS = ["🏠","🍳","🛋️","🛏️","🚿","🚽","🌿","🔨","🐶","📋","🛍️","🧹","🪣","🫧","🧽","🪴","🪞","🗑️","💊","✂️","🦴","💰","📅","📬","🧻","🌱","🚪","💡","🔧","⚙️","🛒","🧊","👕","🌀","🐾","🍂","💨","🚨","🟫","🏥"];

function AddChoreModal({ onClose, onAdd, nextId }) {
  const [name, setName]         = useState("");
  const [icon, setIcon]         = useState("🧹");
  const [category, setCategory] = useState("whole-house");
  const [owner, setOwner]       = useState("rotate");
  const [rotationTurn, setRotationTurn] = useState("alex");
  const [frequency, setFrequency] = useState("weekly");
  const [subtaskText, setSubtaskText] = useState("");
  const [subtasks, setSubtasks] = useState([]);
  const [effort, setEffort] = useState(2);
  const [mentalLoad, setMentalLoad] = useState(1);

  const addSubtask = () => {
    const t = subtaskText.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, { id: `new-${Date.now()}`, text: t, done: false }]);
    setSubtaskText("");
  };

  const removeSubtask = (id) => setSubtasks(prev => prev.filter(s => s.id !== id));

  const handleSubmit = () => {
    if (!name.trim()) return;
    const ACCENT_POOL = ["#E8749A","#3A90D4","#4BAD7A","#C08040","#9B59A0","#5590C0","#E05050","#6AA840","#A06080","#5080C0","#B07840","#70A0C0"];
    const accent = ACCENT_POOL[nextId % ACCENT_POOL.length];
    const newChore = {
      id: nextId,
      name: name.trim(),
      icon,
      accent,
      category,
      owner,
      effort,
      mentalLoad,
      ...(owner === "rotate" ? { rotationTurn } : {}),
      subtasks: subtasks.length > 0 ? subtasks : [{ id: `${nextId}-a`, text: `Do ${name.trim().toLowerCase()}`, done: false }],
      lastDone: null,
      frequency,
    };
    onAdd(newChore);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1.5px solid #E8E5E0", fontSize: 13, color: "#1C1C2E",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
    background: "white",
  };

  const LabelText = ({ children }) => (
    <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7, marginTop: 14 }}>
      {children}
    </p>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px",
        width: "100%", maxWidth: 520,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
        animation: "slideUp 0.25s ease",
        maxHeight: "92vh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, background: "#E0E0E0", borderRadius: 2, margin: "0 auto 20px" }} />
        <h3 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 20, color: "#1C1C2E", marginBottom: 2 }}>
          Add a new chore
        </h3>
        <p style={{ fontSize: 12, color: "#AAA", marginBottom: 4 }}>Fill in what you can — you can always change things later via ⇄</p>

        {/* Name */}
        <LabelText>Chore name</LabelText>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Clean blinds"
          style={inputStyle}
          autoFocus
        />

        {/* Icon picker */}
        <LabelText>Icon</LabelText>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ICON_OPTIONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)} style={{
              width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 18,
              background: icon === ic ? "#1C1C2E" : "#F0EEEB",
              transition: "all 0.12s",
            }}>{ic}</button>
          ))}
        </div>

        {/* Category */}
        <LabelText>Category</LabelText>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
          {CATEGORY_OPTIONS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>

        {/* Frequency */}
        <LabelText>Frequency</LabelText>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(FREQ_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setFrequency(key)} style={{
              padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              background: frequency === key ? "#1C1C2E" : "#F0EEEB",
              color: frequency === key ? "white" : "#666",
              transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {/* Owner */}
        <LabelText>Who owns it?</LabelText>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {[
            { key: "alex",   label: "Alex",     emoji: "🌸" },
            { key: "liam",   label: "Liam",     emoji: "⚡" },
            { key: "rotate", label: "Rotating", emoji: "🔄" },
          ].map(o => (
            <button key={o.key} onClick={() => setOwner(o.key)} style={{
              flex: 1, padding: "9px 6px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              background: owner === o.key ? "#1C1C2E" : "#F0EEEB",
              color: owner === o.key ? "white" : "#666",
              transition: "all 0.15s",
            }}>{o.emoji} {o.label}</button>
          ))}
        </div>

        {owner === "rotate" && (
          <>
            <p style={{ fontSize: 11, color: "#AAA", marginBottom: 7 }}>Who goes first?</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              {[{ key: "alex", label: "Alex 🌸" }, { key: "liam", label: "Liam ⚡" }].map(o => (
                <button key={o.key} onClick={() => setRotationTurn(o.key)} style={{
                  flex: 1, padding: "8px", borderRadius: 10, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                  background: rotationTurn === o.key ? "#1C1C2E" : "#F0EEEB",
                  color: rotationTurn === o.key ? "white" : "#666",
                  transition: "all 0.15s",
                }}>{o.label}</button>
              ))}
            </div>
          </>
        )}

        {/* Effort */}
        <LabelText>Physical effort</LabelText>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { val: 1, label: "Light", sub: "quick & easy" },
            { val: 2, label: "Moderate", sub: "takes some effort" },
            { val: 3, label: "Heavy", sub: "tiring or messy" },
            { val: 4, label: "Hard", sub: "really demanding" },
          ].map(o => (
            <button key={o.val} onClick={() => setEffort(o.val)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              background: effort === o.val ? "#1C1C2E" : "#F0EEEB",
              color: effort === o.val ? "white" : "#666",
              lineHeight: 1.4, transition: "all 0.15s",
            }}>
              <div>{o.label}</div>
              <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 400 }}>{o.sub}</div>
            </button>
          ))}
        </div>

        {/* Mental load */}
        <LabelText>Mental load</LabelText>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { val: 1, label: "Low", sub: "just do it" },
            { val: 2, label: "Medium", sub: "needs tracking" },
            { val: 3, label: "High", sub: "lots of thinking" },
          ].map(o => (
            <button key={o.val} onClick={() => setMentalLoad(o.val)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              background: mentalLoad === o.val ? "#1C1C2E" : "#F0EEEB",
              color: mentalLoad === o.val ? "white" : "#666",
              lineHeight: 1.4, transition: "all 0.15s",
            }}>
              <div>{o.label}</div>
              <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 400 }}>{o.sub}</div>
            </button>
          ))}
        </div>

        {/* Score preview */}
        {(() => {
          const previewScore = (FREQ_PER_MONTH[frequency] ?? 1) * effort * mentalLoad;
          return (
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: "#F8F5F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#AAA" }}>Estimated monthly load score</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1C1C2E" }}>{previewScore.toFixed(1)}</span>
            </div>
          );
        })()}

        {/* Subtasks */}
        <LabelText>Subtasks (optional)</LabelText>
        {subtasks.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "#888", flex: 1, background: "#F8F5F0", borderRadius: 8, padding: "8px 10px" }}>{s.text}</span>
            <button onClick={() => removeSubtask(s.id)} style={{
              width: 28, height: 28, borderRadius: 7, border: "none", background: "#FEE8E8",
              color: "#D06060", fontSize: 14, cursor: "pointer", flexShrink: 0,
            }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={subtaskText}
            onChange={e => setSubtaskText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addSubtask()}
            placeholder="Add a step, press Enter"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addSubtask} style={{
            padding: "10px 14px", borderRadius: 10, border: "none",
            background: "#1C1C2E", color: "white", fontSize: 18, cursor: "pointer", flexShrink: 0,
          }}>+</button>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          style={{
            marginTop: 20, width: "100%", padding: "13px",
            background: name.trim() ? "linear-gradient(135deg, #3A70C4, #2A50A4)" : "#E0E0E0",
            color: name.trim() ? "white" : "#AAA",
            border: "none", borderRadius: 12, cursor: name.trim() ? "pointer" : "default",
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontWeight: 700, fontSize: 15,
            boxShadow: name.trim() ? "0 4px 14px rgba(58,112,196,0.35)" : "none",
            transition: "all 0.2s",
          }}
        >
          Add chore
        </button>
        <button onClick={onClose} style={{
          marginTop: 8, width: "100%", padding: "11px", borderRadius: 12,
          border: "none", background: "#F5F5F5", color: "#888",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Edit Chore Modal ───────────────────────────────────
function EditChoreModal({ chore, onClose, onSave, onDelete }) {
  const weights = (chore.effort != null && chore.mentalLoad != null)
    ? { effort: chore.effort, mentalLoad: chore.mentalLoad }
    : (CHORE_WEIGHTS[chore.id] ?? { effort: 2, mentalLoad: 1 });

  const [name, setName]           = useState(chore.name);
  const [icon, setIcon]           = useState(chore.icon);
  const [category, setCategory]   = useState(chore.category);
  const [frequency, setFrequency] = useState(chore.frequency);
  const [effort, setEffort]       = useState(weights.effort);
  const [mentalLoad, setMentalLoad] = useState(weights.mentalLoad);
  const [subtasks, setSubtasks]   = useState(chore.subtasks.map(s => ({ ...s })));
  const [subtaskText, setSubtaskText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const addSubtask = () => {
    const t = subtaskText.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, { id: `edit-${Date.now()}`, text: t, done: false }]);
    setSubtaskText("");
  };
  const removeSubtask = (id) => setSubtasks(prev => prev.filter(s => s.id !== id));

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...chore,
      name: name.trim(),
      icon,
      category,
      frequency,
      effort,
      mentalLoad,
      subtasks: subtasks.length > 0 ? subtasks : chore.subtasks,
    });
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1.5px solid #E8E5E0", fontSize: 13, color: "#1C1C2E",
    fontFamily: "'DM Sans', sans-serif", outline: "none", background: "white",
  };
  const LabelText = ({ children }) => (
    <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7, marginTop: 14 }}>
      {children}
    </p>
  );

  const previewScore = (FREQ_PER_MONTH[frequency] ?? 1) * effort * mentalLoad;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px",
        width: "100%", maxWidth: 520,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        animation: "slideUp 0.25s ease",
        maxHeight: "92vh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, background: "#E0E0E0", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 20, color: "#1C1C2E", marginBottom: 2 }}>
              Edit chore
            </h3>
            <p style={{ fontSize: 12, color: "#AAA" }}>Changes save immediately</p>
          </div>
          {/* Delete button */}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              padding: "6px 12px", borderRadius: 8,
              border: "1.5px solid #F0D8D8", background: "#FEF5F5",
              color: "#C06060", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}>🗑️ Delete</button>
          ) : (
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#C06060", marginBottom: 4, fontWeight: 600 }}>Sure?</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setConfirmDelete(false)} style={{
                  padding: "5px 10px", borderRadius: 7, border: "1px solid #E0E0E0",
                  background: "white", color: "#888", fontSize: 11, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}>Keep</button>
                <button onClick={() => onDelete(chore.id)} style={{
                  padding: "5px 10px", borderRadius: 7, border: "none",
                  background: "#D06060", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}>Delete</button>
              </div>
            </div>
          )}
        </div>

        {/* Name */}
        <LabelText>Chore name</LabelText>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />

        {/* Icon */}
        <LabelText>Icon</LabelText>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ICON_OPTIONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)} style={{
              width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 18,
              background: icon === ic ? "#1C1C2E" : "#F0EEEB", transition: "all 0.12s",
            }}>{ic}</button>
          ))}
        </div>

        {/* Category */}
        <LabelText>Category</LabelText>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
          {CATEGORY_OPTIONS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>

        {/* Frequency */}
        <LabelText>Frequency</LabelText>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(FREQ_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setFrequency(key)} style={{
              padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              background: frequency === key ? "#1C1C2E" : "#F0EEEB",
              color: frequency === key ? "white" : "#666", transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {/* Effort */}
        <LabelText>Physical effort</LabelText>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { val: 1, label: "Light",    sub: "quick & easy" },
            { val: 2, label: "Moderate", sub: "some effort" },
            { val: 3, label: "Heavy",    sub: "tiring or messy" },
            { val: 4, label: "Hard",     sub: "very demanding" },
          ].map(o => (
            <button key={o.val} onClick={() => setEffort(o.val)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              background: effort === o.val ? "#1C1C2E" : "#F0EEEB",
              color: effort === o.val ? "white" : "#666", lineHeight: 1.4, transition: "all 0.15s",
            }}>
              <div>{o.label}</div>
              <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 400 }}>{o.sub}</div>
            </button>
          ))}
        </div>

        {/* Mental load */}
        <LabelText>Mental load</LabelText>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { val: 1, label: "Low",    sub: "just do it" },
            { val: 2, label: "Medium", sub: "needs tracking" },
            { val: 3, label: "High",   sub: "lots of thinking" },
          ].map(o => (
            <button key={o.val} onClick={() => setMentalLoad(o.val)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              background: mentalLoad === o.val ? "#1C1C2E" : "#F0EEEB",
              color: mentalLoad === o.val ? "white" : "#666", lineHeight: 1.4, transition: "all 0.15s",
            }}>
              <div>{o.label}</div>
              <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 400 }}>{o.sub}</div>
            </button>
          ))}
        </div>

        {/* Score preview */}
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: "#F8F5F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#AAA" }}>Estimated monthly load score</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1C1C2E" }}>{previewScore.toFixed(1)}</span>
        </div>

        {/* Subtasks */}
        <LabelText>Subtasks</LabelText>
        {subtasks.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "#888", flex: 1, background: "#F8F5F0", borderRadius: 8, padding: "8px 10px" }}>{s.text}</span>
            <button onClick={() => removeSubtask(s.id)} style={{
              width: 28, height: 28, borderRadius: 7, border: "none", background: "#FEE8E8",
              color: "#D06060", fontSize: 14, cursor: "pointer", flexShrink: 0,
            }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={subtaskText}
            onChange={e => setSubtaskText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addSubtask()}
            placeholder="Add a step, press Enter"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addSubtask} style={{
            padding: "10px 14px", borderRadius: 10, border: "none",
            background: "#1C1C2E", color: "white", fontSize: 18, cursor: "pointer", flexShrink: 0,
          }}>+</button>
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={!name.trim()} style={{
          marginTop: 20, width: "100%", padding: "13px",
          background: name.trim() ? "linear-gradient(135deg, #4BAD7A, #3A9060)" : "#E0E0E0",
          color: name.trim() ? "white" : "#AAA",
          border: "none", borderRadius: 12, cursor: name.trim() ? "pointer" : "default",
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontWeight: 700, fontSize: 15,
          boxShadow: name.trim() ? "0 4px 14px rgba(75,173,122,0.35)" : "none",
          transition: "all 0.2s",
        }}>
          Save changes
        </button>
        <button onClick={onClose} style={{
          marginTop: 8, width: "100%", padding: "11px", borderRadius: 12,
          border: "none", background: "#F5F5F5", color: "#888",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>Cancel</button>
      </div>
    </div>
  );
}


function ChoreCard({ chore, onUpdate, onComplete, onOpenSwap }) {
  const [expanded, setExpanded] = useState(false);
  const done  = chore.subtasks.filter(s => s.done).length;
  const total = chore.subtasks.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total;
  const overdue = isOverdue(chore);

  const toggleSubtask = (sid) =>
    onUpdate({ ...chore, subtasks: chore.subtasks.map(s => s.id === sid ? { ...s, done: !s.done } : s) });

  const markComplete = () => {
    let updated = {
      ...chore,
      subtasks: chore.subtasks.map(s => ({ ...s, done: false })),
      lastDone: new Date().toISOString(),
      coveredBy: null,
    };
    if (chore.owner === "rotate") {
      updated.rotationTurn = chore.rotationTurn === "alex" ? "liam" : "alex";
    }
    onComplete(updated);
    setExpanded(false);
  };

  return (
    <div style={{
      background: "white", borderRadius: 14, marginBottom: 10,
      border: `1.5px solid ${overdue && !chore.lastDone ? "#F0D8D8" : allDone ? chore.accent + "66" : "#F0F0F0"}`,
      boxShadow: expanded ? `0 4px 20px ${chore.accent}22` : "0 1px 4px rgba(0,0,0,0.05)",
      transition: "all 0.2s ease", overflow: "hidden",
    }}>
      <div style={{ height: 3, background: chore.accent, borderRadius: "14px 14px 0 0", opacity: 0.7 }} />

      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer", minWidth: 0 }}>
          <ProgressRing percent={pct} color={chore.accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{chore.icon}</span>
              <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 700, fontSize: 14.5, color: "#1C1C2E" }}>
                {chore.name}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <OwnerBadge chore={chore} />
              <span style={{ fontSize: 10, color: "#B0A090", background: "#F8F5F0", borderRadius: 4, padding: "1px 5px", fontWeight: 500 }}>
                {FREQ_LABELS[chore.frequency]}
              </span>
              <span style={{ fontSize: 10, color: "#C0B0A0", background: "#F8F5F0", borderRadius: 4, padding: "1px 5px", fontWeight: 500 }} title="Monthly load score">
                ⚖ {calcScore(chore).toFixed(1)}
              </span>
              <LastDoneLabel date={chore.lastDone} frequency={chore.frequency} />
              {chore.coveredBy === "guest" && (
                <span style={{ fontSize: 10, color: "#A07840", background: "#FFF4E0", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                  🧑‍🤝‍🧑 done by guest
                </span>
              )}
              {chore.coveredBy && chore.coveredBy !== "guest" && (
                <span style={{ fontSize: 10, color: "#7AAD9A", background: "#EEF8F4", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                  covered by {PEOPLE[chore.coveredBy]?.emoji}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#C0B8B0", fontWeight: 500 }}>{done}/{total}</span>
          <button
            onClick={() => onOpenSwap(chore)}
            title="Swap or cover this chore"
            style={{
              width: 28, height: 28, borderRadius: 8, border: "1px solid #EEE",
              background: "#FAFAFA", cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#AAA",
            }}
          >⇄</button>
          <span
            onClick={() => setExpanded(e => !e)}
            style={{ fontSize: 10, color: "#CCC", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "block", cursor: "pointer", padding: "4px" }}
          >▼</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${chore.accent}20`, padding: "10px 14px 14px" }}>
          {chore.subtasks.map((s, i) => (
            <div key={s.id} onClick={() => toggleSubtask(s.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 8px",
              borderRadius: 9, cursor: "pointer",
              background: s.done ? chore.accent + "15" : "transparent",
              marginBottom: i < chore.subtasks.length - 1 ? 3 : 0,
              transition: "background 0.15s",
            }}>
              <div style={{
                width: 19, height: 19, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${s.done ? chore.accent : "#DDD"}`,
                background: s.done ? chore.accent : "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                {s.done && <span style={{ fontSize: 10, color: "white", fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{
                fontSize: 13, color: s.done ? "#AAA" : "#333",
                textDecoration: s.done ? "line-through" : "none",
                transition: "all 0.15s", lineHeight: 1.4,
              }}>{s.text}</span>
            </div>
          ))}
          {allDone && (
            <button onClick={markComplete} style={{
              marginTop: 12, width: "100%", padding: "10px 0",
              background: `linear-gradient(135deg, ${chore.accent}, ${chore.accent}CC)`,
              color: "white", border: "none", borderRadius: 10, cursor: "pointer",
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontWeight: 700, fontSize: 14,
              boxShadow: `0 4px 14px ${chore.accent}44`,
            }}>
              🎉 All done — log it!
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Weekly Load Chart ──────────────────────────────────
function WeeklyChart({ activityLog }) {
  // Build 4 week buckets: week 0 = oldest, week 3 = current
  const now = Date.now();
  const weeks = [0, 1, 2, 3].map(i => {
    const start = now - (4 - i) * 7 * 86400000;
    const end   = now - (3 - i) * 7 * 86400000;
    const entries = activityLog.filter(e => {
      const t = new Date(e.date).getTime();
      return t >= start && t < end;
    });
    const alex  = entries.filter(e => e.who === "alex").reduce((s, e) => s + e.score, 0);
    const liam  = entries.filter(e => e.who === "liam").reduce((s, e) => s + e.score, 0);
    const guest = entries.filter(e => e.who === "guest").reduce((s, e) => s + e.score, 0);
    const total = alex + liam + guest;
    const label = i === 3 ? "This wk" : i === 2 ? "Last wk" : `${4 - i}w ago`;
    return { alex, liam, guest, total, label };
  });

  const maxTotal = Math.max(...weeks.map(w => w.total), 1);
  const chartH = 90;
  const barW = 42;
  const gap = 14;
  const totalW = weeks.length * barW + (weeks.length - 1) * gap;

  const hasData = weeks.some(w => w.total > 0);

  if (!hasData) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0 8px", color: "#CCC", fontSize: 12 }}>
        Start ticking off chores to see your 4-week history here
      </div>
    );
  }

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${totalW + 20} ${chartH + 36}`} style={{ overflow: "visible" }}>
        {weeks.map((w, i) => {
          const x = i * (barW + gap);
          const alexH  = w.total > 0 ? (w.alex  / maxTotal) * chartH : 0;
          const liamH  = w.total > 0 ? (w.liam  / maxTotal) * chartH : 0;
          const guestH = w.total > 0 ? (w.guest / maxTotal) * chartH : 0;
          const totalH = alexH + liamH + guestH;
          const alexPct = w.total > 0 ? Math.round((w.alex / (w.alex + w.liam || 1)) * 100) : null;
          const isUnbalanced = w.total > 0 && alexPct !== null && (alexPct > 60 || alexPct < 40);

          // Stack from bottom: liam, guest, alex
          const liamY  = chartH - liamH;
          const guestY = liamY - guestH;
          const alexY  = guestY - alexH;

          return (
            <g key={i} transform={`translate(${x + 10}, 0)`}>
              {/* Empty bar bg */}
              <rect x={0} y={0} width={barW} height={chartH} rx={6} fill="#F5F2EF" />

              {/* Liam segment */}
              {liamH > 0 && (
                <rect x={0} y={liamY} width={barW} height={liamH}
                  rx={liamH === totalH ? 6 : 0} fill={PEOPLE.liam.color}
                  style={{ transition: "height 0.4s ease, y 0.4s ease" }}
                />
              )}
              {/* Guest segment */}
              {guestH > 0 && (
                <rect x={0} y={guestY} width={barW} height={guestH} fill="#F5D98A"
                  style={{ transition: "height 0.4s ease, y 0.4s ease" }}
                />
              )}
              {/* Alex segment */}
              {alexH > 0 && (
                <rect x={0} y={alexY} width={barW} height={alexH}
                  rx={alexH === totalH ? 6 : 0} fill={PEOPLE.alex.color}
                  style={{ transition: "height 0.4s ease, y 0.4s ease" }}
                >
                  {isUnbalanced && <title>⚠ Imbalanced week</title>}
                </rect>
              )}

              {/* Rounded top cap on the combined bar */}
              {totalH > 0 && (
                <rect x={0} y={alexY} width={barW} height={Math.min(6, alexH || guestH || liamH)}
                  rx={3} fill={alexH > 0 ? PEOPLE.alex.color : guestH > 0 ? "#F5D98A" : PEOPLE.liam.color}
                />
              )}

              {/* Imbalance dot */}
              {isUnbalanced && (
                <circle cx={barW - 5} cy={alexY - 7} r={4} fill="#D06060" />
              )}

              {/* % split label above bar */}
              {w.total > 0 && alexPct !== null && (
                <text x={barW / 2} y={alexY - 10} textAnchor="middle"
                  fontSize="9" fontWeight="700" fontFamily="DM Sans, sans-serif"
                  fill={isUnbalanced ? "#D06060" : "#AAA"}>
                  {alexPct}/{100 - alexPct}
                </text>
              )}

              {/* Week label */}
              <text x={barW / 2} y={chartH + 14} textAnchor="middle"
                fontSize="10" fontFamily="DM Sans, sans-serif" fill="#AAA">
                {w.label}
              </text>

              {/* Score total */}
              {w.total > 0 && (
                <text x={barW / 2} y={chartH + 26} textAnchor="middle"
                  fontSize="9" fontFamily="DM Sans, sans-serif" fill="#CCC">
                  {Math.round(w.total)}pts
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 2 }}>
        {[
          { color: PEOPLE.alex.color, label: "Alex" },
          { color: PEOPLE.liam.color, label: "Liam" },
          { color: "#F5D98A",         label: "Guest" },
          { color: "#D06060",         label: "⚠ Imbalanced", dot: true },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#AAA" }}>
            {l.dot
              ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
              : <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
            }
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}


function StatsBar({ chores, imbalanceAlert, activityLog }) {
  const [showChart, setShowChart] = useState(false);
  const overdueCount = chores.filter(isOverdue).length;
  const { alex, liam, total } = calcLoads(chores);
  const alexPct = Math.round((alex / total) * 100);
  const liamPct = 100 - alexPct;
  const balanced = Math.abs(alexPct - 50) <= 5;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Imbalance alert */}
      {imbalanceAlert && (
        <div style={{
          background: "#FFF3E0", border: "1.5px solid #F0A050", borderRadius: 12,
          padding: "10px 14px", marginBottom: 10,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#C06020" }}>Load imbalance alert</div>
            <div style={{ fontSize: 11, color: "#A05010", marginTop: 2 }}>
              {imbalanceAlert} has been carrying over 60% of the chore load for more than 10 days.
              Consider using the ⇄ swap button to rebalance.
            </div>
          </div>
        </div>
      )}

      {/* Balance bar */}
      <div style={{
        background: "white", borderRadius: 14, padding: "14px 16px",
        border: "1.5px solid #F0EEEB", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 8,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Monthly load balance
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: balanced ? "#5BAD7A" : "#D06060",
            background: balanced ? "#E8F8EE" : "#FDE8E8",
            borderRadius: 5, padding: "2px 7px",
          }}>
            {balanced ? "✓ Balanced" : `${Math.abs(alexPct - liamPct)}% gap`}
          </span>
        </div>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", height: 20, marginBottom: 8 }}>
          <div style={{
            width: `${alexPct}%`, background: PEOPLE.alex.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "width 0.5s ease",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "white" }}>{alexPct}%</span>
          </div>
          <div style={{ flex: 1, background: PEOPLE.liam.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "white" }}>{liamPct}%</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#AAA" }}>{PEOPLE.alex.emoji} Alex · {alex} pts</span>
          <span style={{ fontSize: 11, color: "#AAA" }}>{liam} pts · Liam {PEOPLE.liam.emoji}</span>
        </div>
        <div style={{ fontSize: 10, color: "#CCC", marginTop: 4, textAlign: "center" }}>
          Score = effort × frequency × mental load · shared chores split equally
        </div>

        {/* 4-week history toggle */}
        <button
          onClick={() => setShowChart(v => !v)}
          style={{
            marginTop: 10, width: "100%", padding: "7px",
            background: showChart ? "#F0EEEB" : "#F8F6F3",
            border: "none", borderRadius: 8, cursor: "pointer",
            fontSize: 11, fontWeight: 600, color: "#888",
            fontFamily: "'DM Sans', sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          📊 {showChart ? "Hide" : "Show"} 4-week history
          <span style={{ fontSize: 10, transform: showChart ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
        </button>

        {showChart && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F0EEEB" }}>
            <WeeklyChart activityLog={activityLog} />
          </div>
        )}
      </div>

      {/* Counts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { emoji: PEOPLE.alex.emoji, label: "Alex's chores", val: chores.filter(c => c.owner === "alex" || (c.owner === "rotate" && c.rotationTurn === "alex")).length, color: PEOPLE.alex.color },
          { emoji: PEOPLE.liam.emoji, label: "Liam's chores", val: chores.filter(c => c.owner === "liam" || (c.owner === "rotate" && c.rotationTurn === "liam")).length, color: PEOPLE.liam.color },
          { emoji: "⚠️", label: "Need attention", val: overdueCount, color: overdueCount > 0 ? "#D06060" : "#90C090" },
        ].map(s => (
          <div key={s.label} style={{
            background: "white", borderRadius: 12, padding: "10px 8px",
            textAlign: "center", border: "1.5px solid #F0EEEB",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{s.emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Instrument Serif', Georgia, serif", lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "#AAA", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Category Tabs ──────────────────────────────────────
function CategoryTabs({ active, onChange, chores }) {
  const overdueByCategory = {};
  chores.forEach(c => {
    if (isOverdue(c)) {
      overdueByCategory[c.category] = (overdueByCategory[c.category] || 0) + 1;
      overdueByCategory["all"] = (overdueByCategory["all"] || 0) + 1;
    }
  });
  return (
    <div style={{ display: "flex", gap: 0, overflowX: "auto", borderBottom: "2px solid #EDE9E4", scrollbarWidth: "none" }}>
      {CATEGORIES.map(cat => {
        const isActive = active === cat.key;
        return (
          <button key={cat.key} onClick={() => onChange(cat.key)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "10px 12px 8px", border: "none", background: "transparent", cursor: "pointer",
            borderBottom: isActive ? "2.5px solid #1C1C2E" : "2.5px solid transparent",
            marginBottom: -2, whiteSpace: "nowrap", flexShrink: 0,
            transition: "all 0.15s", position: "relative",
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{cat.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? "#1C1C2E" : "#999", fontFamily: "'DM Sans', sans-serif" }}>
              {cat.label}
            </span>
            {overdueByCategory[cat.key] > 0 && (
              <div style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "#D06060", border: "1.5px solid white" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Person Pills ───────────────────────────────────────
function PersonPills({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, paddingTop: 10, paddingBottom: 2, overflowX: "auto" }}>
      {PERSON_FILTERS.map(f => (
        <button key={f.key} onClick={() => onChange(f.key)} style={{
          padding: "5px 11px", borderRadius: 20, border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
          background: active === f.key ? "#1C1C2E" : "#EDE9E4",
          color: active === f.key ? "white" : "#666",
          transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif",
        }}>
          {f.emoji} {f.label}
        </button>
      ))}
    </div>
  );
}

// ── App ────────────────────────────────────────────────
export default function App() {
  const [chores, setChores] = useState(INITIAL_CHORES);
  const [activityLog, setActivityLog] = useState([]);
  const [dbReady, setDbReady] = useState(false);   // true once first load done
  const [syncing, setSyncing] = useState(false);

  // Track when each person's load % crossed 60%
  const [imbalanceStart, setImbalanceStart] = useState(null);

  const [category, setCategory] = useState("all");
  const [personFilter, setPersonFilter] = useState("everyone");
  const [toast, setToast] = useState(null);
  const [swapChore, setSwapChore] = useState(null);
  const [editChore, setEditChore] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const nextId = chores.reduce((max, c) => Math.max(max, c.id), 0) + 1;

  // Debounce timer ref so we batch rapid changes into one write
  const saveTimer = useRef(null);

  // ── Initial load from Supabase ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [choreRows, logRows, metaRows] = await Promise.all([
          sb.get("chores"),
          sb.get("activity_log", "?order=created_at.asc"),
          sb.get("chores", "?id=eq.__meta__"),
        ]);

        // chores: each row is { id, data } where data is the chore object
        if (choreRows.length > 0) {
          // Filter out meta row
          const loaded = choreRows.filter(r => r.id !== "__meta__").map(r => r.data);
          if (loaded.length > 0) setChores(loaded);
        } else {
          // First ever load — seed the DB with INITIAL_CHORES
          const rows = INITIAL_CHORES.map(c => ({ id: String(c.id), data: c }));
          await sb.upsert("chores", rows);
        }

        // activity log
        if (logRows.length > 0) {
          setActivityLog(logRows.map(r => ({ who: r.who, score: r.score, date: r.created_at, name: r.chore_name })));
        }

        // imbalance meta
        if (metaRows.length > 0) {
          try { setImbalanceStart(metaRows[0].data?.imbalance ?? null); } catch {}
        }

        setDbReady(true);
      } catch(e) {
        // Fallback to localStorage if network fails
        try {
          const s = localStorage.getItem("chores-v10");
          if (s) setChores(JSON.parse(s));
          const a = localStorage.getItem("chores-activity-v1");
          if (a) setActivityLog(JSON.parse(a));
        } catch {}
        setDbReady(true);
      }
    })();
  }, []);

  // ── Save chores to Supabase (debounced 800ms) ──────────
  useEffect(() => {
    if (!dbReady) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncing(true);
      try {
        const rows = chores.map(c => ({ id: String(c.id), data: c }));
        await sb.upsert("chores", rows);
        // Also mirror to localStorage as offline fallback
        localStorage.setItem("chores-v10", JSON.stringify(chores));
      } catch {}
      setSyncing(false);
    }, 800);
  }, [chores, dbReady]);

  // ── Real-time: reload chores when another device saves ─
  useEffect(() => {
    if (!dbReady) return;
    const unsub = sb.subscribe("chores", async () => {
      try {
        const rows = await sb.get("chores");
        const loaded = rows.filter(r => r.id !== "__meta__").map(r => r.data);
        if (loaded.length > 0) setChores(loaded);
      } catch {}
    });
    return unsub;
  }, [dbReady]);

  // ── Log activity to Supabase ───────────────────────────
  const logActivity = useCallback(async (chore, who) => {
    const score = calcScore(chore);
    const entry = { who, score, date: new Date().toISOString(), name: chore.name };
    setActivityLog(prev => [...prev, entry]);
    try {
      await sb.insert("activity_log", { who, score, chore_name: chore.name });
    } catch {}
  }, []);

  // ── Imbalance tracking (kept in chores meta row) ───────
  useEffect(() => {
    if (!dbReady) return;
    const { alex, total } = calcLoads(chores);
    const alexPct = Math.round((alex / total) * 100);
    const liamPct = 100 - alexPct;
    const overloaded = alexPct > 60 ? "Alex 🌸" : liamPct > 60 ? "Liam ⚡" : null;

    if (overloaded) {
      if (!imbalanceStart || imbalanceStart.person !== overloaded) {
        const newState = { person: overloaded, since: Date.now() };
        setImbalanceStart(newState);
        sb.upsert("chores", [{ id: "__meta__", data: { imbalance: newState } }]).catch(() => {});
      }
    } else if (imbalanceStart) {
      setImbalanceStart(null);
      sb.upsert("chores", [{ id: "__meta__", data: { imbalance: null } }]).catch(() => {});
    }
  }, [chores, dbReady]);

  const imbalanceAlert = (() => {
    if (!imbalanceStart) return null;
    const days = Math.floor((Date.now() - imbalanceStart.since) / 86400000);
    return days >= 10 ? imbalanceStart.person : null;
  })();

  // Show loading screen until DB is ready
  if (!dbReady) return (
    <div style={{ minHeight: "100vh", background: "#F7F4F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=DM+Sans:wght@400;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={{ fontSize: 40 }}>🏡</div>
      <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "#1C1C2E" }}>Our Home</p>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#AAA" }}>Loading your chores…</p>
    </div>
  );


  const completeChore = (u) => {
    // Determine who completed it — use the person who was current before the rotation advanced
    const who = u.owner === "rotate"
      ? (u.rotationTurn === "alex" ? "liam" : "alex") // rotationTurn already flipped, so reverse
      : u.owner;
    logActivity(u, who);
    setChores(prev => prev.map(c => c.id === u.id ? u : c));
    setToast({ type: "done", name: u.name });
    setTimeout(() => setToast(null), 2800);
  };

  // Permanent ownership swap (within same type)
  const handleSwap = (chore) => {
    const current = chore.owner === "rotate" ? chore.rotationTurn : chore.owner;
    const other = current === "alex" ? "liam" : "alex";
    let updated;
    if (chore.owner === "rotate") {
      updated = { ...chore, rotationTurn: other };
    } else {
      updated = { ...chore, owner: other };
    }
    updateChore(updated);
    setSwapChore(null);
    setToast({ type: "swap", name: `${chore.name} → ${PEOPLE[other].emoji} ${PEOPLE[other].name}` });
    setTimeout(() => setToast(null), 3000);
  };

  // Convert between rotating and permanently owned
  const handleToggleRotation = (chore, targetOwner) => {
    let updated;
    if (targetOwner === "rotate") {
      // Owned → rotating: current owner starts the rotation
      const currentOwner = chore.owner;
      updated = { ...chore, owner: "rotate", rotationTurn: currentOwner };
    } else {
      // Rotating → owned: assign to specified person, remove rotationTurn
      const { rotationTurn: _drop, ...rest } = chore;
      updated = { ...rest, owner: targetOwner };
    }
    updateChore(updated);
    setSwapChore(null);
    const label = targetOwner === "rotate"
      ? `${chore.name} → now rotating`
      : `${chore.name} → ${PEOPLE[targetOwner].emoji} ${PEOPLE[targetOwner].name} (permanent)`;
    setToast({ type: "swap", name: label });
    setTimeout(() => setToast(null), 3200);
  };

  // Change frequency of a chore
  const handleFrequencyChange = (chore, newFreq) => {
    updateChore({ ...chore, frequency: newFreq });
    setToast({ type: "swap", name: `${chore.name} → ${FREQ_LABELS[newFreq]}` });
    setTimeout(() => setToast(null), 2800);
    // Don't close modal so they can see it updated
  };

  // Add a brand new chore
  const handleAddChore = (newChore) => {
    setChores(prev => [...prev, newChore]);
    setShowAddModal(false);
    setToast({ type: "done", name: `${newChore.icon} ${newChore.name} added!` });
    setTimeout(() => setToast(null), 2800);
  };

  const handleSaveEdit = (updated) => {
    updateChore(updated);
    setEditChore(null);
    setSwapChore(null);
    setToast({ type: "swap", name: `${updated.icon} ${updated.name} updated` });
    setTimeout(() => setToast(null), 2800);
  };

  const handleDeleteChore = (id) => {
    const chore = chores.find(c => c.id === id);
    setChores(prev => prev.filter(c => c.id !== id));
    setEditChore(null);
    setSwapChore(null);
    setToast({ type: "cover", name: `${chore?.name} removed` });
    setTimeout(() => setToast(null), 2800);
  };
  const handleCoveredFor = (chore, coverer) => {
    const isGuest = coverer === "guest";
    const updated = {
      ...chore,
      subtasks: chore.subtasks.map(s => ({ ...s, done: false })),
      lastDone: new Date().toISOString(),
      coveredBy: coverer,
    };
    // For rotate chores: advance turn for a person cover, but NOT for a guest
    if (!isGuest && chore.owner === "rotate") {
      updated.rotationTurn = chore.rotationTurn === "alex" ? "liam" : "alex";
    }
    logActivity(chore, coverer);
    updateChore(updated);
    setSwapChore(null);
    const toastName = isGuest
      ? `🧑‍🤝‍🧑 Guest did ${chore.name}`
      : `${PEOPLE[coverer].emoji} ${PEOPLE[coverer].name} covered ${chore.name}`;
    setToast({ type: "cover", name: toastName });
    setTimeout(() => setToast(null), 3000);
  };

  let visible = chores.filter(c => {
    const catOk = category === "all" || c.category === category;
    const personOk =
      personFilter === "everyone" ? true :
      personFilter === "overdue"  ? isOverdue(c) :
      personFilter === "alex"     ? (c.owner === "alex" || (c.owner === "rotate" && c.rotationTurn === "alex")) :
      personFilter === "liam"     ? (c.owner === "liam" || (c.owner === "rotate" && c.rotationTurn === "liam")) :
      true;
    return catOk && personOk;
  });

  visible = [...visible].sort((a, b) => {
    const ao = isOverdue(a) ? 0 : 1;
    const bo = isOverdue(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return (daysSince(b.lastDone) ?? 9999) - (daysSince(a.lastDone) ?? 9999);
  });

  const toastColors = { done: "#1C1C2E", swap: "#3A70C4", cover: "#4AAD7A" };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4F0", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes slideDown { from { opacity:0; transform: translateY(-12px) scale(.95); } to { opacity:1; transform: none; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        button:active { opacity: 0.85; transform: scale(0.98); }
        div::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          background: toastColors[toast.type] || "#1C1C2E", color: "white",
          borderRadius: 14, padding: "12px 22px",
          fontFamily: "'Instrument Serif', serif", fontSize: 14, fontWeight: 700,
          zIndex: 999, boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          animation: "slideDown 0.35s ease", whiteSpace: "nowrap",
        }}>
          {toast.type === "done" ? "🎉" : toast.type === "swap" ? "🔁" : "🤝"} {toast.name}
        </div>
      )}

      {/* Swap modal */}
      {swapChore && (
        <SwapModal
          chore={swapChore}
          onClose={() => setSwapChore(null)}
          onSwap={handleSwap}
          onCoveredFor={handleCoveredFor}
          onToggleRotation={handleToggleRotation}
          onFrequencyChange={handleFrequencyChange}
          onEdit={(c) => { setSwapChore(null); setTimeout(() => setEditChore(c), 50); }}
        />
      )}

      {editChore && (
        <EditChoreModal
          chore={editChore}
          onClose={() => setEditChore(null)}
          onSave={handleSaveEdit}
          onDelete={handleDeleteChore}
        />
      )}

      {showAddModal && (
        <AddChoreModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddChore}
          nextId={nextId}
        />
      )}

      {/* Add chore FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          position: "fixed", bottom: 24, right: 20, zIndex: 100,
          width: 52, height: 52, borderRadius: "50%",
          background: "linear-gradient(135deg, #3A70C4, #2A50A4)",
          color: "white", border: "none", fontSize: 26, cursor: "pointer",
          boxShadow: "0 4px 20px rgba(58,112,196,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.15s",
        }}
        onMouseDown={e => e.currentTarget.style.transform = "scale(0.93)"}
        onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        title="Add a chore"
      >+</button>

      {/* Header */}
      <div style={{ background: "white", borderBottom: "1.5px solid #EDE9E4", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, color: "#1C1C2E", letterSpacing: -0.5 }}>
                Our Home 🏡
              </h1>
              <div title={syncing ? "Saving…" : "Saved"} style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: syncing ? "#F0A050" : "#5BAD7A",
                transition: "background 0.4s",
              }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(PEOPLE).map(([k, p]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#AAA" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />{p.emoji}
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "8px 0 0" }}>
            <CategoryTabs active={category} onChange={setCategory} chores={chores} />
          </div>
          <div style={{ padding: "0 16px" }}>
            <PersonPills active={personFilter} onChange={setPersonFilter} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 0" }}>
        <StatsBar chores={chores} imbalanceAlert={imbalanceAlert} activityLog={activityLog} />

        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 17, color: "#1C1C2E", fontWeight: 700 }}>
            {CATEGORIES.find(c => c.key === category)?.label || "All"}
            <span style={{ fontSize: 12, fontWeight: 400, color: "#AAA", marginLeft: 8, fontFamily: "'DM Sans', sans-serif" }}>
              {visible.length} chore{visible.length !== 1 ? "s" : ""}
            </span>
          </span>
          <span style={{ fontSize: 11, color: "#CCC" }}>⇄ to swap · tap to expand</span>
        </div>

        {visible.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#CCC", fontSize: 14 }}>Nothing here!</div>
        )}

        {visible.map(c => (
          <ChoreCard key={c.id} chore={c} onUpdate={updateChore} onComplete={completeChore} onOpenSwap={setSwapChore} />
        ))}

        <p style={{ textAlign: "center", fontSize: 11, color: "#CCC", marginTop: 20 }}>
          Saved in your browser · Tap tasks to check them off
        </p>
      </div>
    </div>
  );
}
