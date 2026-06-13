"use client";
/*
 * ═══════════════════════════════════════════════════════════════════════════════
 * SUPABASE SETUP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. Install: npm install @supabase/supabase-js
 *
 * 2. Create .env.local:
 *    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 *
 * 3. Enable Auth providers in Supabase Dashboard:
 *    - Email / Password (enable "Confirm email" or turn it off for dev)
 *    - Phone / OTP (requires Twilio integration in Supabase → Auth → Providers → Phone)
 *    - Google OAuth (Auth → Providers → Google, set your Client ID & Secret)
 *    - Redirect URL: https://your-domain.com (add to Auth → URL Configuration)
 *
 * 4. Run this SQL in Supabase SQL Editor to create the required tables:
 *
 * -- Momentum logs (one row per user per day)
 * create table if not exists momentum_logs (
 *   id          uuid primary key default gen_random_uuid(),
 *   user_id     uuid references auth.users(id) on delete cascade not null,
 *   date        text not null,                -- e.g. "Mon Jun 09 2025"
 *   energy      int  not null default 5,
 *   focus       int  not null default 5,
 *   momentum    int  not null default 5,
 *   feeling     text,
 *   note        text,
 *   created_at  timestamptz default now(),
 *   unique(user_id, date)
 * );
 * alter table momentum_logs enable row level security;
 * create policy "Users manage own momentum" on momentum_logs
 *   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * -- Decisions
 * create table if not exists decisions (
 *   id           uuid primary key default gen_random_uuid(),
 *   user_id      uuid references auth.users(id) on delete cascade not null,
 *   question     text not null,
 *   framework    text not null,
 *   display_date text,
 *   created_at   timestamptz default now()
 * );
 * alter table decisions enable row level security;
 * create policy "Users manage own decisions" on decisions
 *   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * -- Weekly reports
 * create table if not exists weekly_reports (
 *   id         uuid primary key default gen_random_uuid(),
 *   user_id    uuid references auth.users(id) on delete cascade not null,
 *   week_of    text not null,
 *   text       text not null,
 *   created_at timestamptz default now()
 * );
 * alter table weekly_reports enable row level security;
 * create policy "Users manage own weekly reports" on weekly_reports
 *   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * -- Testimonials (user submitted)
 * create table if not exists testimonials (
 *   id         uuid primary key default gen_random_uuid(),
 *   name       text not null,
 *   quote      text not null,
 *   approved   boolean default false,
 *   created_at timestamptz default now()
 * );
 * alter table testimonials enable row level security;
 * create policy "Anyone can submit" on testimonials for insert with check (true);
 * create policy "Anyone can read approved" on testimonials for select using (approved=true);
 *
 * -- Cancellation requests (written by client; processed by webhook/admin)
 * create table if not exists cancellation_requests (
 *   id           uuid primary key default gen_random_uuid(),
 *   user_id      uuid references auth.users(id) on delete cascade not null,
 *   requested_at timestamptz not null,
 *   reason       text,
 *   processed    boolean default false,
 *   created_at   timestamptz default now()
 * );
 * alter table cancellation_requests enable row level security;
 * create policy "Users insert own cancellation" on cancellation_requests
 *   for insert with check (auth.uid() = user_id);
 *
 * -- User profiles (onboarding data + subscription)
 * create table if not exists user_profiles (
 *   user_id     uuid primary key references auth.users(id) on delete cascade,
 *   name        text,
 *   form_data   jsonb,
 *   report      jsonb,
 *   is_paid     boolean default false,
 *   is_premium  boolean default false,
 *   streak      int default 1,
 *   paystack_ref text,
 *   paid_plan   text,
 *   paid_at     timestamptz,
 *   photo_url   text,
 *   created_at  timestamptz default now(),
 *   updated_at  timestamptz default now()
 * );
 * alter table user_profiles enable row level security;
 * create policy "Users manage own profile" on user_profiles
 *   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * -- Referrals
 * create table if not exists referrals (
 *   id          uuid primary key default gen_random_uuid(),
 *   referrer_id uuid references auth.users(id) on delete cascade,
 *   referred_id uuid references auth.users(id) on delete cascade,
 *   created_at  timestamptz default now(),
 *   unique(referred_id)
 * );
 * alter table referrals enable row level security;
 * create policy "Users see own referrals" on referrals
 *   for select using (auth.uid() = referrer_id);
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */


import React, { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════════
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={hasError:false,error:null}; }
  static getDerivedStateFromError(e){ return{hasError:true,error:e}; }
  componentDidCatch(e,info){ console.error("DestinIQ crash:",e,info); }
  render(){
    if(this.state.hasError) return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"#0a0800"}}>
        <div style={{maxWidth:400,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
          <div style={{fontSize:22,fontWeight:700,color:"#e8dcc8",marginBottom:8}}>Something went wrong</div>
          <p style={{fontSize:14,color:"rgba(232,220,200,0.5)",marginBottom:24,lineHeight:1.7}}>Your data is safe. Please refresh to continue.</p>
          <button onClick={()=>window.location.reload()} style={{background:"#d4af37",border:"none",borderRadius:12,padding:"12px 28px",color:"#000",fontSize:14,fontWeight:700,cursor:"pointer"}}>Refresh page</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
// ═══════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://cuocngswamioyyvzozaf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2NuZ3N3YW1pb3l5dnpvemFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDM3OTUsImV4cCI6MjA5NjQxOTc5NX0.0itooEhEwG1sD-1yKQZTwxjLpubpyjGFWSRtF-MmXYA"
);

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY & DAILY STORES
// In-memory cache layered on top of Supabase for instant UI updates.
// On app load, data is hydrated from the DB; writes go to both layers.
// ═══════════════════════════════════════════════════════════════════════════════
const _memoryStore   = new Map(); // userId -> Message[]
const _momentumLog   = new Map(); // userId -> [{date,energy,focus,momentum,feeling,note}]
const _weeklyReports = new Map(); // userId -> [{weekOf,text,ts}]
const _decisions     = new Map(); // userId -> [{id,question,framework,date}]
const _notifTimers   = new Map(); // userId -> timeoutId

// ─── SUPABASE DB HELPERS ─────────────────────────────────────────────────────

/** Hydrate all per-user data from Supabase into the in-memory caches. */
async function hydrateUserData(userId) {
  try {
    const [momRes, decRes, wkRes] = await Promise.all([
      supabase.from("momentum_logs").select("*").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("decisions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("weekly_reports").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    // Note: profile (onboarding + subscription) is loaded separately via loadUserProfile
    if (momRes.data?.length) {
      _momentumLog.set(userId, momRes.data.map(r => ({
        date: r.date, energy: r.energy, focus: r.focus,
        momentum: r.momentum, feeling: r.feeling, note: r.note, ts: new Date(r.created_at).getTime(),
      })));
    }
    if (decRes.data?.length) {
      _decisions.set(userId, decRes.data.map(r => ({
        id: r.id, question: r.question, framework: r.framework,
        date: r.display_date,
      })));
    }
    if (wkRes.data?.length) {
      _weeklyReports.set(userId, wkRes.data.map(r => ({
        weekOf: r.week_of, text: r.text, ts: new Date(r.created_at).getTime(),
      })));
    }
  } catch (e) {
    console.warn("hydrateUserData:", e.message);
  }
}

/** Upsert a momentum log entry. */
async function saveMomentumEntry(userId, entry) {
  try {
    await supabase.from("momentum_logs").upsert({
      user_id: userId, date: entry.date,
      energy: entry.energy, focus: entry.focus, momentum: entry.momentum,
      feeling: entry.feeling, note: entry.note,
    }, { onConflict: "user_id,date" });
  } catch (e) { console.warn("saveMomentumEntry:", e.message); }
}

/** Insert a decision. */
async function saveDecision(userId, decision) {
  try {
    const { data } = await supabase.from("decisions").insert({
      user_id: userId, question: decision.question,
      framework: decision.framework, display_date: decision.date,
    }).select("id").single();
    if (data?.id) decision.id = data.id;
  } catch (e) { console.warn("saveDecision:", e.message); }
}

/** Save or update user profile (onboarding data + subscription status). */
async function saveUserProfile(userId, data) {
  const { error } = await supabase.from("user_profiles").upsert({
    user_id: userId,
    ...data,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/** Load user profile from Supabase. Returns null if not found. */
async function loadUserProfile(userId) {
  try {
    const { data } = await supabase.from("user_profiles").select("*").eq("user_id", userId).single();
    return data || null;
  } catch (e) { return null; }
}

/** Upsert a weekly report. */
async function saveWeeklyReport(userId, report) {
  try {
    await supabase.from("weekly_reports").insert({
      user_id: userId, week_of: report.weekOf, text: report.text,
    });
  } catch (e) { console.warn("saveWeeklyReport:", e.message); }
}

// ─── PAYSTACK CONFIG ─────────────────────────────────────────────────────────
// Replace with your real Paystack public key from paystack.com → Settings → API Keys
const PAYSTACK_PUBLIC_KEY = "pk_test_your_key_here"; // ← PASTE YOUR KEY HERE

const PLANS = {
  basic:  { name:"Essential", amount:9,   label:"$9/month",  currency:"USD" },
  pro:    { name:"Premium",   amount:15,  label:"$15/month", currency:"USD" },
  annual: { name:"Annual Pro",amount:99,  label:"$99/year",  currency:"USD" },
};
function getHistory(uid) { return _memoryStore.get(uid)||[]; }
function pushToMemory(uid,role,content) {
  const h=getHistory(uid); h.push({role,content:content.slice(0,800)});
  if(h.length>10) h.splice(0,h.length-10); _memoryStore.set(uid,h);
}
function buildMemoryContext(uid) {
  const h=getHistory(uid); if(!h.length) return "";
  return "\n\nPrevious context:\n"+h.slice(-6).map(m=>`${m.role==="user"?"User":"Advisor"}: ${m.content}`).join("\n");
}
function getMomentumLog(uid) { return _momentumLog.get(uid)||[]; }
function addMomentumEntry(uid,entry) {
  const log=getMomentumLog(uid);
  const today=new Date().toDateString();
  const idx=log.findIndex(e=>e.date===today);
  if(idx>=0) log[idx]=entry; else log.push(entry);
  if(log.length>30) log.splice(0,log.length-30);
  _momentumLog.set(uid,log);
  saveMomentumEntry(uid,entry); // persist to Supabase
}
function getDecisions(uid) { return _decisions.get(uid)||[]; }

// ═══════════════════════════════════════════════════════════════════════════════
// SMART SCORE ENGINE
// Calculates a 0–100 momentum score from multiple real signals.
// Called wherever the score is shown so it's always live.
// ═══════════════════════════════════════════════════════════════════════════════
function computeSmartScore(userId, streak){
  const log   = getMomentumLog(userId);
  const decs  = getDecisions(userId);
  const today = new Date().toDateString();

  // 1. Average of last 7 check-ins (max 40 pts)
  const last7 = log.slice(-7);
  const avgOf = e => e ? (e.energy + e.focus + e.momentum) / 3 : 0;
  const checkInAvg = last7.length ? last7.reduce((s,e)=>s+avgOf(e),0)/last7.length : 0;
  const checkInScore = Math.round((checkInAvg / 10) * 40);

  // 2. Streak bonus (max 25 pts)
  const streakScore = Math.min(25, Math.round(streak * 2.5));

  // 3. Logged today (10 pts)
  const loggedToday = log.some(e=>e.date===today) ? 10 : 0;

  // 4. Decisions made this week (max 10 pts)
  const oneWeekAgo = Date.now() - 7*24*60*60*1000;
  const recentDecs = decs.filter(d=>d.ts && d.ts > oneWeekAgo).length;
  const decScore = Math.min(10, recentDecs * 5);

  // 5. Consistency — how many of last 7 days had a log (max 15 pts)
  const loggedDays = last7.filter(e=>e).length;
  const consistencyScore = Math.round((loggedDays / 7) * 15);

  const total = checkInScore + streakScore + loggedToday + decScore + consistencyScore;
  return {
    total: Math.min(100, Math.max(0, total)),
    breakdown: {
      checkIn:     { score: checkInScore,     max: 40,  label: "Check-in quality",   tip: checkInScore>=30?"Great energy this week":"Log more check-ins to boost this" },
      streak:      { score: streakScore,       max: 25,  label: "Streak",             tip: streak>=5?"Keep the streak alive!":"Come back daily to build your streak" },
      today:       { score: loggedToday,       max: 10,  label: "Logged today",       tip: loggedToday?"Done ✓":"Log today to get +10 points" },
      decisions:   { score: decScore,          max: 10,  label: "Decisions this week",tip: decScore>=5?"Active decision-making":"Use the Decision module this week" },
      consistency: { score: consistencyScore,  max: 15,  label: "7-day consistency",  tip: consistencyScore>=10?"Very consistent":"Try to log every day this week" },
    }
  };
}

function scoreColor(s){ return s>=75?"var(--teal)":s>=50?"var(--gold)":s>=25?"#d2956a":"var(--rose)"; }
function scoreLabel(s){ return s>=75?"Momentum Building":s>=50?"Making Progress":s>=25?"Getting Started":"Time to Show Up"; }
function addDecision(uid,decision) {
  const d=getDecisions(uid); d.unshift(decision);
  if(d.length>10) d.splice(10); _decisions.set(uid,d);
  saveDecision(uid,decision); // persist to Supabase
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM
// Browser Notifications API. Works in deployed Next.js.
// For true background push (app closed): add service worker + Web Push + VAPID keys.
// ═══════════════════════════════════════════════════════════════════════════════
const NOTIF_MSGS = [
  (n)=>`Hey ${n} — how's today going? Take 30 seconds to check in with yourself.`,
  (n)=>`${n}, you showed up yesterday. Show up again today. 30 seconds is all it takes.`,
  (n)=>`Your streak is waiting, ${n}. Don't let today be the one you look back on.`,
  ()=>`DestinIQ: One honest question. One honest answer. That's all today needs.`,
  (n)=>`${n} — what moved today? Even something small counts. Log it now.`,
];

async function requestNotifPermission() {
  if(!("Notification" in window)) return "unsupported";
  if(Notification.permission==="granted") return "granted";
  if(Notification.permission==="denied") return "denied";
  return await Notification.requestPermission();
}

function scheduleNotification(uid, name, timeStr, onFire) {
  if(_notifTimers.has(uid)) clearTimeout(_notifTimers.get(uid));
  const [h,m]=timeStr.split(":").map(Number);
  const now=new Date(), next=new Date();
  next.setHours(h,m,0,0);
  if(next<=now) next.setDate(next.getDate()+1);
  const delay=next-now;
  const tid=setTimeout(()=>{
    const msg=NOTIF_MSGS[Math.floor(Math.random()*NOTIF_MSGS.length)](name);
    if(Notification.permission==="granted") {
      new Notification("DestinIQ",{body:msg,tag:"destiniq-daily"});
    }
    onFire&&onFire();
    scheduleNotification(uid,name,timeStr,onFire);
  },delay);
  _notifTimers.set(uid,tid);
  return delay;
}


// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Outfit:wght@200;300;400;500;600&family=JetBrains+Mono:wght@300;400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --void:#05060f;--deep:#08091a;--base:#0d0f1e;--raised:#121526;--lift:#181b2e;
  --line:rgba(255,255,255,0.06);--line-gold:rgba(210,175,90,0.18);
  --gold:#d2af5a;--gold-bright:#e8cb7a;--gold-dim:rgba(210,175,90,0.12);--gold-glow:rgba(210,175,90,0.06);
  --teal:#1fa89a;--teal-dim:rgba(31,168,154,0.1);
  --rose:#c4645a;--rose-dim:rgba(196,100,90,0.1);
  --violet:#7c5cbf;--violet-dim:rgba(124,92,191,0.1);
  --emerald:#2ea87e;--emerald-dim:rgba(46,168,126,0.1);
  --cream:#ede8d8;--cream-60:rgba(237,232,216,0.6);--cream-30:rgba(237,232,216,0.3);
  --cream-10:rgba(237,232,216,0.08);--cream-05:rgba(237,232,216,0.04);
  --f-display:'Playfair Display',serif;--f-body:'Outfit',sans-serif;--f-mono:'JetBrains Mono',monospace;
}
html{scroll-behavior:smooth;}
body{background:var(--void);color:var(--cream);font-family:var(--f-body);font-size:15px;line-height:1.6;min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.bg{position:fixed;inset:0;z-index:0;pointer-events:none;}
.bg-mesh{background:radial-gradient(ellipse 80% 60% at 20% 0%,rgba(31,168,154,0.07) 0%,transparent 55%),radial-gradient(ellipse 60% 50% at 80% 100%,rgba(210,175,90,0.08) 0%,transparent 55%),radial-gradient(ellipse 50% 40% at 80% 20%,rgba(124,92,191,0.05) 0%,transparent 50%),var(--void);}
.bg-noise{opacity:.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:128px;}
.bg-grid{background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse 70% 70% at 50% 50%,black 20%,transparent 100%);}
.root{position:relative;z-index:1;min-height:100vh;}
.cx{width:100%;max-width:1060px;margin:0 auto;padding:0 24px;}
.cx-sm{width:100%;max-width:640px;margin:0 auto;padding:0 24px;}
.cx-md{width:100%;max-width:820px;margin:0 auto;padding:0 24px;}
.nav{position:fixed;top:0;left:0;right:0;z-index:200;display:flex;align-items:center;justify-content:space-between;padding:0 28px;height:60px;background:rgba(5,6,15,0.9);backdrop-filter:blur(24px);border-bottom:1px solid var(--line);}
.logo{font-family:var(--f-display);font-size:22px;font-weight:600;cursor:pointer;color:var(--cream);}
.logo b{color:var(--gold);}
.nav-r{display:flex;align-items:center;gap:8px;}
.notif-nudge{position:fixed;top:68px;right:16px;z-index:300;background:var(--raised);border:1px solid var(--line-gold);border-radius:12px;padding:14px 18px;max-width:290px;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:slideIn .3s ease;}
@keyframes slideIn{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}
.prem-toggle{display:flex;align-items:center;gap:7px;padding:5px 11px;border-radius:30px;border:1px solid var(--line-gold);background:var(--gold-dim);cursor:pointer;transition:all .25s;user-select:none;}
.prem-toggle.off{border-color:var(--line);background:var(--cream-05);}
.prem-toggle-dot{width:12px;height:12px;border-radius:50%;background:var(--gold);transition:all .25s;box-shadow:0 0 8px rgba(210,175,90,0.5);}
.prem-toggle.off .prem-toggle-dot{background:var(--cream-30);box-shadow:none;}
.prem-toggle-label{font-family:var(--f-mono);font-size:9px;letter-spacing:.14em;color:var(--gold);}
.prem-toggle.off .prem-toggle-label{color:var(--cream-30);}
.prem-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;background:linear-gradient(90deg,rgba(210,175,90,0.15),rgba(232,203,122,0.08));border:1px solid var(--line-gold);border-radius:20px;font-family:var(--f-mono);font-size:9px;letter-spacing:.1em;color:var(--gold-bright);}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 24px;border-radius:8px;border:none;cursor:pointer;font-family:var(--f-body);font-size:13px;font-weight:500;transition:all .25s;white-space:nowrap;}
.btn-gold{background:var(--gold);color:#0a0800;box-shadow:0 4px 20px rgba(210,175,90,0.2);}
.btn-gold:hover{background:var(--gold-bright);transform:translateY(-1px);box-shadow:0 8px 28px rgba(210,175,90,0.3);}
.btn-gold:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.btn-ghost{background:transparent;color:var(--cream-60);border:1px solid var(--line);}
.btn-ghost:hover{border-color:var(--line-gold);color:var(--cream);background:var(--cream-05);}
.btn-outline-gold{background:transparent;color:var(--gold);border:1px solid var(--line-gold);}
.btn-outline-gold:hover{background:var(--gold-dim);color:var(--gold-bright);}
.btn-text{background:none;border:none;color:var(--cream-30);font-family:var(--f-body);font-size:13px;cursor:pointer;padding:6px;transition:color .2s;}
.btn-text:hover{color:var(--cream-60);}
.btn-lg{padding:15px 36px;font-size:15px;}
.btn-full{width:100%;}
.btn-sm{padding:7px 14px;font-size:12px;}
.card{background:var(--raised);border:1px solid var(--line);border-radius:16px;padding:24px;transition:border-color .3s;}
.card:hover{border-color:var(--line-gold);}
.card-sm{padding:16px;border-radius:12px;}
.d1{font-family:var(--f-display);font-size:clamp(42px,7vw,78px);font-weight:400;line-height:1.05;letter-spacing:-.015em;}
.d2{font-family:var(--f-display);font-size:clamp(28px,4.5vw,48px);font-weight:400;line-height:1.1;letter-spacing:-.01em;}
.d3{font-family:var(--f-display);font-size:clamp(20px,3vw,30px);font-weight:400;line-height:1.15;}
.em{font-style:italic;color:var(--gold);}
.mono{font-family:var(--f-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);}
.body-lg{font-size:17px;line-height:1.8;color:var(--cream-60);font-weight:300;}
.body{font-size:15px;line-height:1.75;color:var(--cream-60);font-weight:300;}
.small{font-size:13px;line-height:1.65;color:var(--cream-30);}
.field{margin-bottom:16px;}
.fl{display:block;margin-bottom:6px;font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);}
.fi,.fs,.ft{width:100%;padding:12px 16px;background:var(--lift);border:1px solid var(--line);border-radius:8px;color:var(--cream);font-family:var(--f-body);font-size:14px;font-weight:300;outline:none;transition:all .25s;-webkit-appearance:none;}
.fi:focus,.fs:focus,.ft:focus{border-color:var(--line-gold);background:var(--gold-glow);box-shadow:0 0 0 3px rgba(210,175,90,0.06);}
.fi::placeholder,.ft::placeholder{color:rgba(237,232,216,0.2);font-style:italic;}
.fs option{background:var(--base);color:var(--cream);}
.ft{resize:none;line-height:1.7;}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media(max-width:520px){.row2{grid-template-columns:1fr;}}
.pbar{height:2px;background:var(--line);border-radius:2px;overflow:hidden;}
.pfill{height:100%;background:linear-gradient(90deg,var(--teal),var(--gold));border-radius:2px;transition:width .5s cubic-bezier(.4,0,.2,1);}
.streak-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;background:var(--gold-dim);border:1px solid var(--line-gold);border-radius:40px;font-family:var(--f-mono);font-size:10px;color:var(--gold);}
.streak-fire{font-size:16px;line-height:1;}
.lock-wrap{position:relative;overflow:hidden;border-radius:16px;}
.lock-blur{filter:blur(7px);pointer-events:none;user-select:none;}
.lock-gate{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:linear-gradient(180deg,rgba(5,6,15,0) 0%,rgba(5,6,15,0.92) 35%);border-radius:16px;padding:24px;}
.feeling-grid{display:flex;flex-wrap:wrap;gap:8px;}
.feeling-pill{padding:8px 16px;border-radius:40px;border:1px solid var(--line);background:transparent;color:var(--cream-60);font-family:var(--f-body);font-size:13px;cursor:pointer;transition:all .2s;}
.feeling-pill:hover{border-color:var(--line-gold);color:var(--cream);}
.feeling-pill.sel{background:var(--gold-dim);border-color:var(--gold);color:var(--gold-bright);}
.insight{border-left:2px solid var(--gold);padding:14px 18px;background:var(--gold-glow);border-radius:0 10px 10px 0;margin:16px 0;}
.insight.teal{border-color:var(--teal);background:var(--teal-dim);}
.insight.rose{border-color:var(--rose);background:var(--rose-dim);}
.insight.violet{border-color:var(--violet);background:var(--violet-dim);}
.insight.emerald{border-color:var(--emerald);background:var(--emerald-dim);}
.chat-scroll{display:flex;flex-direction:column;gap:14px;max-height:420px;overflow-y:auto;padding:4px 4px 4px 0;}
.chat-scroll::-webkit-scrollbar{width:2px;}
.chat-scroll::-webkit-scrollbar-thumb{background:var(--line);border-radius:2px;}
.chat-msg{display:flex;gap:10px;}
.chat-msg.me{flex-direction:row-reverse;}
.av{width:30px;height:30px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;font-family:var(--f-mono);}
.av-d{background:var(--gold-dim);border:1px solid var(--line-gold);color:var(--gold);}
.av-u{background:var(--teal-dim);border:1px solid rgba(31,168,154,0.2);color:var(--teal);}
.bubble{max-width:80%;padding:11px 15px;border-radius:12px;font-size:14px;line-height:1.7;font-weight:300;}
.bubble-d{background:var(--lift);border:1px solid var(--line);color:var(--cream-60);border-radius:4px 12px 12px 12px;}
.bubble-u{background:var(--gold-dim);border:1px solid var(--line-gold);color:var(--cream);border-radius:12px 4px 12px 12px;}
.chat-in-row{display:flex;gap:8px;margin-top:14px;}
.chat-in{flex:1;padding:10px 14px;background:var(--lift);border:1px solid var(--line);border-radius:8px;color:var(--cream);font-family:var(--f-body);font-size:14px;outline:none;transition:border-color .25s;}
.chat-in:focus{border-color:var(--line-gold);}
.chat-in::placeholder{color:rgba(237,232,216,0.18);font-style:italic;}
.chat-send{padding:10px 16px;background:var(--gold);border:none;border-radius:8px;color:#0a0800;font-size:14px;cursor:pointer;transition:all .2s;}
.chat-send:hover{background:var(--gold-bright);}
.chat-send:disabled{opacity:.4;cursor:not-allowed;}
.typing-dot{display:flex;gap:4px;padding:14px 16px;align-items:center;}
.typing-dot span{width:5px;height:5px;border-radius:50%;background:var(--cream-30);animation:tdot 1.4s ease-in-out infinite;}
.typing-dot span:nth-child(2){animation-delay:.2s;}
.typing-dot span:nth-child(3){animation-delay:.4s;}
@keyframes tdot{0%,60%,100%{transform:translateY(0);opacity:.4;}30%{transform:translateY(-4px);opacity:1;}}
.ring-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;}
.ring-inner{position:absolute;text-align:center;}
.ring-val{font-family:var(--f-display);font-size:24px;font-weight:500;line-height:1;display:block;}
.ring-lbl{font-family:var(--f-mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--cream-30);margin-top:3px;display:block;}
.pillar-bar-card{background:var(--raised);border:1px solid var(--line);border-radius:12px;padding:16px 18px;transition:all .3s;}
.pillar-bar-card:hover{border-color:var(--line-gold);}
.pb-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.pb-name{font-size:13px;font-weight:400;color:var(--cream-60);}
.pb-val{font-family:var(--f-display);font-size:18px;font-weight:500;}
.pb-track{height:3px;background:var(--line);border-radius:2px;overflow:hidden;}
.pb-fill{height:100%;border-radius:2px;transition:width 1.6s cubic-bezier(.4,0,.2,1);}
.plan-card{background:var(--raised);border:1px solid var(--line);border-radius:20px;padding:32px;text-align:center;transition:all .3s;cursor:pointer;position:relative;overflow:hidden;}
.plan-card.featured{border-color:var(--gold);box-shadow:0 0 40px rgba(210,175,90,0.12);}
.plan-card.featured::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--teal),var(--gold));}
.plan-price{font-family:var(--f-display);font-size:48px;font-weight:400;color:var(--gold);line-height:1;}
.plan-period{font-size:13px;color:var(--cream-30);margin-top:4px;}
.plan-name{font-size:15px;font-weight:500;margin:16px 0 20px;}
.plan-feature{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;color:var(--cream-60);text-align:left;}
.plan-check{color:var(--teal);flex-shrink:0;margin-top:1px;}
.timeline-item{display:flex;gap:18px;margin-bottom:24px;position:relative;}
.timeline-item::before{content:'';position:absolute;left:17px;top:36px;bottom:-24px;width:1px;background:var(--line);}
.timeline-item:last-child::before{display:none;}
.t-dot{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:var(--f-mono);font-size:10px;color:var(--gold);border:1px solid var(--line-gold);background:var(--raised);}
.t-body{flex:1;padding-top:6px;}
.t-phase{font-family:var(--f-mono);font-size:9px;letter-spacing:.16em;color:var(--gold);margin-bottom:3px;}
.t-title{font-family:var(--f-display);font-size:18px;font-weight:500;margin-bottom:6px;}
.t-desc{font-size:13px;color:var(--cream-60);line-height:1.75;font-weight:300;}
.t-win{margin-top:10px;padding:10px 14px;background:var(--teal-dim);border-left:2px solid var(--teal);border-radius:0 8px 8px 0;font-size:12px;color:var(--teal);}
.tabs{display:flex;background:var(--base);border-radius:10px;padding:4px;gap:2px;overflow-x:auto;}
.tabs::-webkit-scrollbar{display:none;}
.tab{flex:1;min-width:75px;padding:8px 10px;border-radius:7px;border:none;cursor:pointer;font-family:var(--f-body);font-size:11px;font-weight:500;background:transparent;color:var(--cream-30);transition:all .25s;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:4px;}
.tab:hover{color:var(--cream-60);}
.tab.on{background:var(--lift);color:var(--cream);border:1px solid var(--line-gold);}
.mom-slider-row{display:flex;align-items:center;gap:14px;margin-bottom:18px;}
.mom-slider-label{font-family:var(--f-mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--cream-30);width:72px;flex-shrink:0;}
.mom-slider{flex:1;-webkit-appearance:none;appearance:none;height:3px;border-radius:2px;outline:none;cursor:pointer;}
.mom-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;cursor:pointer;border:2px solid var(--void);box-shadow:0 0 6px rgba(0,0,0,0.4);}
.mom-val{font-family:var(--f-display);font-size:18px;font-weight:500;min-width:24px;text-align:right;}
.mom-chart{display:flex;align-items:flex-end;gap:5px;height:80px;padding:0 4px;}
.mom-bar{flex:1;border-radius:3px 3px 0 0;min-height:4px;transition:height .6s cubic-bezier(.4,0,.2,1);position:relative;cursor:default;}
.mom-bar:hover .mom-bar-tip{opacity:1;}
.mom-bar-tip{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--raised);border:1px solid var(--line);border-radius:4px;padding:3px 7px;font-family:var(--f-mono);font-size:9px;white-space:nowrap;opacity:0;transition:opacity .2s;pointer-events:none;z-index:10;}
.decision-card{background:var(--raised);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:12px;transition:border-color .3s;}
.decision-card:hover{border-color:var(--line-gold);}
.notif-panel{background:var(--raised);border:1px solid var(--line-gold);border-radius:16px;padding:24px;}
.notif-time{width:100%;padding:10px 14px;background:var(--lift);border:1px solid var(--line);border-radius:8px;color:var(--cream);font-family:var(--f-mono);font-size:14px;outline:none;transition:all .25s;}
.notif-time:focus{border-color:var(--line-gold);}
.week-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:16px 0;}
.week-day{aspect-ratio:1;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--f-mono);font-size:8px;gap:2px;cursor:default;transition:transform .2s;}
.week-day:hover{transform:scale(1.08);}
.err-box{padding:12px 16px;background:var(--rose-dim);border:1px solid rgba(196,100,90,.25);border-radius:8px;color:var(--rose);font-size:13px;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.tag{display:inline-flex;align-items:center;padding:3px 9px;border-radius:5px;font-family:var(--f-mono);font-size:9px;letter-spacing:.08em;}
.tg{background:var(--gold-dim);color:var(--gold);border:1px solid rgba(210,175,90,0.2);}
.tt{background:var(--teal-dim);color:var(--teal);border:1px solid rgba(31,168,154,0.2);}
.tr{background:var(--rose-dim);color:var(--rose);border:1px solid rgba(196,100,90,0.2);}
.tv{background:var(--violet-dim);color:var(--violet);border:1px solid rgba(124,92,191,0.2);}
.disc{font-size:11px;color:var(--cream-30);font-style:italic;text-align:center;line-height:1.8;padding:32px 24px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
@keyframes msgIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 4px currentColor;}50%{opacity:.5;box-shadow:0 0 10px currentColor;}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideTestim{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@media(max-width:640px){
  .cx{padding:0 16px;}
  .cx-md{padding:0 16px;}
  .d1{font-size:clamp(32px,9vw,52px)!important;}
  .d2{font-size:clamp(22px,6vw,36px)!important;}
  .card{padding:16px!important;}
  .nav{padding:0 16px!important;}
  .fu{padding:0 16px 40px!important;}
  .tab-bar{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .tab-bar button{font-size:10px!important;padding:8px 10px!important;white-space:nowrap;}
  .results-grid{grid-template-columns:1fr!important;}
  .score-grid{grid-template-columns:1fr 1fr!important;}
}
@media(max-width:400px){
  .d1{font-size:28px!important;}
  .nav-logo{font-size:16px!important;}
}
.fu{animation:fadeUp .5s ease both;}
.fu1{opacity:0;animation:fadeUp .5s .08s ease both;}
.fu2{opacity:0;animation:fadeUp .5s .16s ease both;}
.fu3{opacity:0;animation:fadeUp .5s .24s ease both;}
.fu4{opacity:0;animation:fadeUp .5s .32s ease both;}
.msg-in{animation:msgIn .3s ease both;}
.reloc-card{background:var(--raised);border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-bottom:20px;transition:border-color .3s;}
.reloc-card:hover{border-color:var(--line-gold);}
.reloc-header{padding:20px 22px 16px;border-bottom:1px solid var(--line);}
.reloc-match{display:inline-flex;align-items:center;padding:3px 10px;border-radius:16px;font-family:var(--f-mono);font-size:10px;}
.reloc-body{padding:20px 22px;}
.reloc-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0;}
.reloc-list{list-style:none;margin:0;padding:0;}
.reloc-list li{display:flex;gap:8px;margin-bottom:7px;font-size:13px;line-height:1.6;color:var(--cream-60);}
.reloc-pro::before{content:"✓";color:var(--teal);flex-shrink:0;font-weight:600;}
.reloc-con::before{content:"✕";color:var(--rose);flex-shrink:0;font-weight:600;}
.reloc-section{padding:14px 16px;background:var(--lift);border-radius:10px;margin-bottom:10px;}
.reloc-section-label{font-family:var(--f-mono);font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:7px;}
.reloc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0;}
.reloc-stat{text-align:center;padding:12px 8px;background:var(--lift);border-radius:9px;}
.reloc-stat-val{font-family:var(--f-display);font-size:17px;color:var(--gold);display:block;margin-bottom:3px;}
.reloc-verdict{padding:14px 16px;border-left:2px solid var(--gold);background:var(--gold-glow);border-radius:0 9px 9px 0;font-size:13px;color:var(--cream-60);font-style:italic;line-height:1.7;}
@media(max-width:600px){.nav{padding:0 16px;}.card{padding:18px;}.cx,.cx-sm,.cx-md{padding:0 16px;}.reloc-grid{grid-template-columns:1fr;}.reloc-stats{grid-template-columns:repeat(3,1fr);}}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
const FEELINGS=["Motivated","Anxious","Stuck","Focused","Overwhelmed","Hopeful","Drained","Confident","Uncertain","Restless"];
const PILLARS=[
  {id:"life",      label:"Life", color:"#d2af5a"},
  {id:"wealth",    label:"Wealth", color:"#1fa89a"},
  {id:"mindset",   label:"Mindset",        color:"#9b72cf"},
  {id:"relations", label:"Relationships",  color:"#c4645a"},
];
const MODULES=[
  {id:"today",    icon:"◎", label:"My Report"},
  {id:"momentum", icon:"⚡", label:"Daily Check-in"},
  {id:"decisions",icon:"◈", label:"Big Decisions"},
  {id:"weekly",   icon:"↗", label:"Weekly Pulse"},
  {id:"roadmap",  icon:"⟶", label:"My Roadmap"},
  {id:"mindset",  icon:"◇", label:"Mindset"},
  {id:"career",   icon:"◈", label:"Career Path"},
  {id:"relocate", icon:"✦", label:"Relocate"},
  {id:"advisor",  icon:"⬡", label:"My Advisor"},
];
const LOADING_PHRASES=["Reading what you shared…","Thinking about your situation…","Writing your roadmap…","Looking at what's really possible for you…","Almost there…","One moment more…"];

function sanitize(s){
  if(typeof s!=="string") return "";
  return s.replace(/<[^>]*>/g,"").replace(/[^\w\s.,!?'"()\-:;@#%+=/]/g,"").slice(0,2000).trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════
async function callAPI({messages,system,userId,isPremium}){
  if(!messages?.length||!system) throw new Error("Invalid payload");
  const res=await fetch("/api/analyze",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({system,messages,max_tokens:isPremium?4000:1800}),
  });
  if(!res.ok){
    const e=await res.json().catch(()=>({}));
    throw new Error(e?.error||`Request failed (${res.status})`);
  }
  const d=await res.json();
  const text=d.text||"";
  if(!text) throw new Error("Empty response");
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IP GEOLOCATION — Detect user's real location automatically
// Uses ipapi.co (free, no key needed, 1000 req/day)
// ═══════════════════════════════════════════════════════════════════════════════
async function getIPLocation(){
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),4000);
    const res=await fetch("https://ipapi.co/json/",{signal:controller.signal});
    clearTimeout(timer);
    if(!res.ok) return null;
    const d=await res.json();
    if(d.error) return null;
    return{
      city:d.city||"",region:d.region||"",country:d.country_name||"",
      countryCode:d.country_code||"",currency:d.currency||"",
      callingCode:d.country_calling_code||"",timezone:d.timezone||"",
      lat:d.latitude,lon:d.longitude,org:d.org||"",
    };
  }catch{return null;}
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL CONTEXT — Fetch live local conditions via web search
// Gives the report hyper-local awareness of what's happening RIGHT NOW
// ═══════════════════════════════════════════════════════════════════════════════
async function getLocalContext(city,country){
  try{
    const location=city?`${city}, ${country}`:country;
    const today=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
    const res=await fetch("/api/analyze",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-5",
        max_tokens:900,
        tools:[{"type":"web_search_20250305","name":"web_search"}],
        system:"You are a local economic researcher. Today is "+today+". Search for real current data. Give specific numbers, local currency, real examples. Be factual and precise.",
        messages:[{role:"user",content:"Search for the latest 2025 data about "+location+". Give me: (1) Current average monthly salary for skilled workers in local currency AND USD equivalent. (2) Cost of renting a decent 1-bedroom apartment with neighbourhood examples. (3) The single biggest economic opportunity or challenge happening RIGHT NOW. (4) Any specific recent news or government policy in the last 3 months affecting everyday people. Be very specific with numbers, names, and examples. Max 200 words."}],
      }),
    });
    if(!res.ok) return null;
    const data=await res.json();
    const text=(data.content||[]).map(b=>{
      if(b.type==="text") return b.text;
      if(b.type==="tool_result"&&Array.isArray(b.content)) return b.content.filter(x=>x.type==="text").map(x=>x.text).join(" ");
      if(b.type==="tool_result"&&typeof b.content==="string") return b.content;
      return "";
    }).filter(Boolean).join("\n");
    return text.slice(0,1200)||null;
  }catch{return null;}
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// GOAL DETECTION — Reads what the person actually wants and sets intent flags
// This drives the ENTIRE report structure
// ═══════════════════════════════════════════════════════════════════════════════
function detectGoalContext(f){
  const g=(f.goals||"").toLowerCase();
  const c=(f.challenge||"").toLowerCase();
  const sk=(f.skills||"").toLowerCase();
  const car=(f.career||"").toLowerCase();
  const combined=g+" "+c+" "+sk+" "+car;
  const origin=(f.country||"").toLowerCase();

  const AFRICA_COUNTRIES=["ghana","nigeria","kenya","south africa","rwanda","ethiopia","senegal","tanzania","uganda","cameroon","ivory coast","côte d'ivoire","egypt","morocco","tunisia","angola","mozambique","zambia","zimbabwe","botswana","namibia","malawi","togo","benin","burkina faso","mali","niger","guinea","sierra leone","liberia","gambia","mauritius","seychelles","cape verde"];
  const DEVELOPED=["united states","usa","united kingdom","uk","canada","australia","germany","france","netherlands","sweden","norway","switzerland","singapore","japan","new zealand","ireland","denmark","finland","austria","belgium"];

  const isFromDeveloped=DEVELOPED.some(d=>origin.includes(d));
  const isFromAfrica=AFRICA_COUNTRIES.some(a=>origin.includes(a));
  const isFromUSA=origin.includes("usa")||origin.includes("united states");
  const isFromUK=origin.includes("uk")||origin.includes("united kingdom");
  const isFromEurope=["france","germany","netherlands","sweden","norway","switzerland","denmark","finland","austria","belgium","spain","italy","portugal"].some(e=>origin.includes(e));

  const mentionsAfrica=["africa","african","ghana","nigeria","kenya","south africa","rwanda","ethiopia","senegal","nairobi","lagos","accra","kigali","cairo","casablanca","dakar"].some(w=>combined.includes(w));
  const mentionsBusiness=["business","start","startup","invest","investment","company","venture","enterprise","entrepreneur","launch","open","build","establish","found"].some(w=>combined.includes(w));
  const mentionsRelocate=["relocat","move to","moving to","migrate","live in","settle","leave","get out","escape","abroad","overseas"].some(w=>combined.includes(w));
  const mentionsRemote=["remote","freelance","online","digital nomad","work from anywhere","location independent"].some(w=>combined.includes(w));
  const mentionsFinance=["money","financial","income","rich","wealth","savings","invest","property","real estate","passive"].some(w=>combined.includes(w));

  // PRIMARY GOAL — what is the whole report about?
  let primaryGoal="GENERAL";
  if(isFromDeveloped && mentionsAfrica && mentionsBusiness) primaryGoal="DEVELOPED_TO_AFRICA_BUSINESS";
  else if(isFromDeveloped && mentionsAfrica && mentionsRelocate) primaryGoal="DEVELOPED_TO_AFRICA_MOVE";
  else if(isFromDeveloped && mentionsAfrica) primaryGoal="DEVELOPED_TO_AFRICA_BUSINESS"; // default Africa interest to business
  else if(isFromAfrica && mentionsRelocate) primaryGoal="AFRICA_ESCAPE";
  else if(isFromAfrica && mentionsRemote) primaryGoal="AFRICA_REMOTE_WORK";
  else if(isFromAfrica && mentionsBusiness) primaryGoal="AFRICA_LOCAL_BUSINESS";
  else if(mentionsRelocate) primaryGoal="RELOCATION_GENERAL";
  else if(mentionsRemote) primaryGoal="REMOTE_WORK";
  else if(mentionsBusiness) primaryGoal="LOCAL_BUSINESS";
  else if(mentionsFinance) primaryGoal="FINANCIAL_GROWTH";

  return {primaryGoal,isFromDeveloped,isFromAfrica,isFromUSA,isFromUK,isFromEurope,mentionsAfrica,mentionsBusiness,mentionsRelocate,mentionsRemote,AFRICA_COUNTRIES,DEVELOPED};
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOAL-SPECIFIC CONTEXT BLOCKS — Each goal gets its own deep context injected
// ═══════════════════════════════════════════════════════════════════════════════
function buildGoalContext(f, goalCtx){
  const {primaryGoal,isFromUSA,isFromUK,isFromEurope,isFromAfrica} = goalCtx;
  const origin=(f.country||"").toLowerCase();

  if(primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"){
    const fromUSA=isFromUSA?"American":"European/Western";
    return `
═══ GOAL: ${f.name} WANTS TO START OR RUN A BUSINESS IN AFRICA ═══
This is THE central purpose of their entire report. Every section — roadmap, career, relocation, mindset — must revolve around this goal. Do NOT give generic life advice.

CONTEXT FOR AN ${fromUSA.toUpperCase()} WANTING TO DO BUSINESS IN AFRICA:

WHY AFRICA IS GENUINELY COMPELLING RIGHT NOW (2025):
- Africa has 6 of the world's 10 fastest-growing economies
- 1.4 billion people, median age 19 — youngest population on earth
- Mobile money infrastructure (M-Pesa, MTN MoMo) more advanced than most of the West
- Middle class growing by 30 million people per year
- Digital infrastructure gap = massive opportunity for tech businesses
- American/European passport = visa-on-arrival in most African countries
- USD/EUR income buys an exceptional lifestyle across most of Africa
- Many sectors are essentially untapped: logistics, agritech, edtech, healthtech, renewable energy, real estate, hospitality, e-commerce

THE BEST AFRICAN COUNTRIES FOR ${fromUSA.toUpperCase()} BUSINESS OWNERS (2025):
1. GHANA — Best for English speakers. Most welcoming to diaspora and foreign investors. Accra is a real startup hub. 
   - Business registration: ~$500 USD, 1–2 weeks. Foreigners can own 100% of most businesses.
   - Minimum investment for foreign-owned business: $200,000 (services sector) or $500,000 (trading)
   - However, a local partner structure can reduce this significantly
   - Key sectors: tech, real estate, hospitality, agriculture processing, import/export
   - Visa: Americans get visa-on-arrival (30 days), then business visa (~$100, 1 year)
   - Average monthly cost of good life in Accra: $1,500–$2,500 (vs $5,000+ in US cities)

2. RWANDA — Easiest country to do business in Africa (World Bank Ease of Doing Business ranking). 
   - Company registration: $30–$150 USD, done in 24 hours online at RDB.rw
   - No minimum foreign investment requirement — the most business-friendly in Africa
   - Extremely low corruption. Very safe. Strong internet infrastructure.
   - Key sectors: tech (Kigali is becoming Africa's tech capital), tourism, coffee, real estate, logistics
   - Visa: Americans — visa on arrival or e-visa ($50, 30 days), convertible to business visa
   - Cost of life in Kigali: $1,200–$2,000/month (everything is more affordable than US/Europe)

3. KENYA — East Africa's business hub. Nairobi is the regional HQ for most multinationals.
   - Company registration: 3–7 days, ~$150–$300 USD at eCitizen portal
   - Strong tech ecosystem: Silicon Savannah reputation, M-Pesa birthplace, massive startup scene
   - Key sectors: fintech, agritech, logistics, real estate, healthcare, tourism
   - Visa: Americans — e-visa $51 USD, 90 days, renewable
   - Monthly cost in Nairobi (Westlands, Karen): $1,500–$2,800 for a comfortable expat life

4. SOUTH AFRICA — Most developed infrastructure, but more complex market.
   - Company registration: ~$100, 3–5 days at CIPC
   - Cape Town and Joburg have world-class infrastructure, talent, and business culture
   - Key sectors: fintech, real estate, tech, media, tourism
   - Challenge: higher crime rates in some areas, more expensive than other African markets
   - Visa: Americans — 90-day visa-free, business visa for longer stays (~$150)

5. MOROCCO — Gateway between Africa and Europe. Casablanca financial hub.
   - Free Zone companies: 0% tax for 5 years
   - Arabic/French dominant — language barrier for pure English speakers
   - Key sectors: renewable energy, tourism, manufacturing, trade

6. SENEGAL — French-speaking gem. Dakar is booming.
   - Company registration: ~$300 USD, 3–5 days
   - Key sectors: hospitality, fishing, real estate, tech, tourism

PRACTICAL REALITY CHECK FOR WESTERN ENTREPRENEURS IN AFRICA:
- The BIGGEST mistake: treating Africa as one country. It is 54 countries, 2,000 languages, wildly different markets.
- The SECOND biggest mistake: trying to run it remotely without spending real time there first. 3–6 months on the ground is the minimum before making major commitments.
- What works: businesses that solve local problems with local knowledge + external capital. Partner with local entrepreneurs.
- What fails: copy-pasting US/European business models without adaptation. Underestimating regulatory complexity.
- Banking: open a local business bank account (Ecobank, GT Bank, KCB, Absa Africa). This is often harder than the company registration itself.
- Tax: most African countries have US tax treaties. You will still owe US taxes (FBAR/FATCA). Get a US-qualified international tax accountant.
- The lived experience: slower pace, relationship-driven business culture, infrastructure unpredictability — but incredible energy, opportunity, and quality of life for those who adapt.

RELOCATION SECTION FOCUS:
Show Ghana, Rwanda, Kenya, South Africa as the top 3 options. For each, explain what it's ACTUALLY like to live and operate a business there as a Westerner. Include real business registration costs and steps.`;
  }

  if(primaryGoal==="DEVELOPED_TO_AFRICA_MOVE"){
    return `
═══ GOAL: ${f.name} WANTS TO MOVE TO AND LIVE IN AFRICA ═══
This is the core of their report. Frame everything around this relocation.
- They are coming from a developed country — their income will go much further
- Focus on: which country fits their lifestyle/budget, what moving actually looks like, how to build a life there
- Top destinations: Ghana (Year of Return heritage, English), Rwanda (safest, cleanest), Kenya (vibrant, English), South Africa (most developed), Mauritius (luxury, ease), Morocco (Mediterranean, affordable)
- Address the practical: healthcare (is private insurance needed?), safety, finding accommodation, social life, expat community
- RELOCATION section: show African countries only`;
  }

  if(primaryGoal==="AFRICA_ESCAPE"){
    const country=(f.country||"Africa");
    return `
═══ GOAL: ${f.name} WANTS TO LEAVE ${country.toUpperCase()} FOR A BETTER OPPORTUNITY ═══
This is what the report is really about — their desire to break out. Be honest about what's realistic from their country and what actually opens up for them.
- Be specific about visa pathways from their country
- Address the real costs of relocation (not just airline tickets — savings required, visa fees, first months abroad)
- Be honest about what level of English/French proficiency affects
- Don't oversell — give them the real path, including how long it realistically takes`;
  }

  if(primaryGoal==="AFRICA_REMOTE_WORK"){
    return `
═══ GOAL: ${f.name} WANTS TO BUILD REMOTE/INTERNATIONAL INCOME FROM AFRICA ═══
The report must be built around escaping the local salary ceiling. Focus on:
- Platforms and pathways to international clients (Upwork, Toptal, Remote.com, LinkedIn)
- What their specific skill set commands internationally vs locally (give exact USD figures)
- The infrastructure requirements (internet reliability, payment methods — Wise, Payoneer, Deel)
- How to position themselves for international work from their country
- RELOCATION section: show destinations where remote workers from their country often go`;
  }

  // Default — still be goal-aware
  const goalSnip=(f.goals||"").slice(0,120);
  return `
═══ CORE GOAL: "${goalSnip}" ═══
The ENTIRE report must serve this goal. Every roadmap step, every career suggestion, every relocation option must directly connect back to what they actually want. Generic advice is useless — they can get that anywhere.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORIGIN COUNTRY FACTS — Hard economic data per country, prevents generic output
// ═══════════════════════════════════════════════════════════════════════════════
function buildOriginFacts(f){
  const origin=(f.country||"").toLowerCase();

  if(origin.includes("united states")||origin.includes("usa"))
    return `ORIGIN: USA
- The user has a US passport — one of the most powerful travel documents in the world (visa-free/on-arrival access to 185+ countries)
- USD income = significant purchasing power advantage in almost every developing country
- US average household income: ~$75,000/year. If below this, career advancement at home is also a priority.
- US tax obligation: Americans owe US taxes on worldwide income. Foreign Earned Income Exclusion (FEIE) allows ~$126,500/year tax-free if abroad. Consult a US expat tax specialist.
- Banking: US banks (Chase, BofA) often restrict international transactions. Recommend Wise, Charles Schwab (no foreign ATM fees), or a local account abroad.`;

  if(origin.includes("united kingdom")||origin.includes("uk"))
    return `ORIGIN: UK
- UK passport: visa-free/on-arrival to 190+ countries. Strong travel document.
- GBP income = significant advantage in developing countries
- UK average salary: £35,000–£50,000/year (London) | Outside London: £28,000–£40,000
- UK tax: HMRC non-resident status after 90+ days abroad saves 20–45% income tax
- UK expats in Africa: large communities in South Africa, Kenya, Nigeria, Ghana`;

  if(origin.includes("togo"))
    return `ORIGIN: TOGO
- Capital: Lomé | Language: FRENCH (critical for remote work opportunities)
- Currency: CFA Franc (XOF) | ~620 XOF = 1 USD
- Average skilled salary: 80,000–200,000 XOF/month ($130–$320)
- Rent in Lomé: 80,000–200,000 XOF/month for decent accommodation
- Port of Lomé: 3rd largest in West Africa — logistics/trade opportunity
- French language = gateway to Quebec Canada immigration (fastest African pathway)
- DO NOT use Ghana facts here. Different economy, different currency, different opportunities.`;

  if(origin.includes("ghana"))
    return `ORIGIN: GHANA
- Capital: Accra | Language: English — strong advantage for global market
- Currency: GHS | ~14–15 GHS = 1 USD (significant depreciation ongoing)
- Skilled salary Accra: 3,000–8,000 GHS/month ($200–$550)
- Rent Accra (East Legon, Osu): 2,500–6,000 GHS/month
- Best tech ecosystem in West Africa: MEST Africa, Andela alumni, Flutterwave
- Key challenge: Cedi depreciation (~40% in 2 years), power outages (dumsor), 20%+ inflation
- Remote work in USD from Ghana = 5–10x local salary for same skills`;

  if(origin.includes("nigeria"))
    return `ORIGIN: NIGERIA
- Lagos/Abuja context | Language: English | Currency: NGN | ~1,550 NGN = 1 USD
- Lagos tech worker salary: 300,000–800,000 NGN/month ($190–$520)
- Africa's largest economy but severe currency instability
- Vibrant tech scene: Flutterwave, Paystack, Andela all founded here
- Challenge: Naira collapse, generator costs, security in some regions`;

  if(origin.includes("kenya"))
    return `ORIGIN: KENYA
- Nairobi | Language: English/Swahili | Currency: KES | ~130 KES = 1 USD
- Professional salary Nairobi: 60,000–200,000 KES/month ($460–$1,540)
- M-Pesa: world's most advanced mobile money — fintech hub of Africa
- iHub, Andela Kenya, Silicon Savannah — strong startup ecosystem
- English proficiency = strong remote work pipeline`;

  if(origin.includes("south africa"))
    return `ORIGIN: SOUTH AFRICA
- Johannesburg/Cape Town | Language: English | Currency: ZAR | ~18–19 ZAR = 1 USD
- Professional salary: R25,000–R80,000/month ($1,300–$4,200)
- Most developed infrastructure in Africa
- Strong tech scene but high inequality, load-shedding, emigration brain drain
- Many South Africans leave for UK (skilled worker visa), Australia, Canada`;

  if(origin.includes("france")||origin.includes("germany")||origin.includes("netherlands")||origin.includes("sweden")||origin.includes("norway")||origin.includes("switzerland"))
    return `ORIGIN: WESTERN EUROPE
- EU passport = highly powerful for African business/travel
- EUR income = massive advantage in Africa (1 EUR = ~600–650 XOF in Francophone Africa)
- French/Belgian speakers have huge advantage in Francophone Africa (Senegal, Côte d'Ivoire, Cameroon, Rwanda)
- EU expat in Africa: typically lives very well on €2,000–€3,000/month
- Tax: many EU countries have 183-day residency rules — leaving can create significant tax savings`;

  return `ORIGIN: ${f.country||"Unknown"}
- Generate advice specific to their passport, currency, and economic context
- Research current average salaries, cost of living, and visa options for someone from this country`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS PROMPT — Goal-first, deeply personalized
// ═══════════════════════════════════════════════════════════════════════════════
function buildAnalysisPrompt(f,isPremium,memCtx,ipLocation,localContext){
  const today=new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const tier=isPremium
    ?"PREMIUM — Every section must feel like it took hours to write. Specific numbers, real examples, honest assessments. This person paid for depth. Deliver it."
    :"FREE — Still be genuinely useful. At least one concrete, local, real example per section. Vague = useless.";

  const ageNum=parseInt(f.age)||26;
  const incomeHint={"Under $500":18,"$500–$1,500":34,"$1,500–$4,000":54,"$4,000–$10,000":72,"$10,000+":86}[f.income]||45;
  const wealthBase=Math.max(14,Math.min(88,incomeHint+Math.floor(Math.random()*12)-6));
  const lifeBase=Math.max(22,Math.min(90,44+(ageNum<25?13:ageNum<32?9:ageNum<42?5:1)+Math.floor(Math.random()*14)-7));
  const mindBase=Math.max(18,Math.min(87,48+Math.floor(Math.random()*22)-11));
  const relBase=Math.max(22,Math.min(92,54+Math.floor(Math.random()*20)-10));

  const goalCtx = detectGoalContext(f);
  const goalBlock = buildGoalContext(f, goalCtx);
  const originFacts = buildOriginFacts(f);

  const ipCtx=ipLocation
    ?`\nUSER'S DETECTED LOCATION RIGHT NOW: ${ipLocation.city}, ${ipLocation.region}, ${ipLocation.country}. Currency: ${ipLocation.currency}. Mention their city in the greeting — make them feel like we actually know where they are.`
    :"";

  const liveCtx=localContext
    ?`\nLIVE LOCAL DATA (${today}):\n${localContext}\nReference at least 1–2 specific real facts from this in the report — make them feel like we checked on their area this morning.`
    :"";

  return `You are writing a deeply personal life report for one specific person. Today is ${today}. You have their full profile in front of you. Your job is not to be an AI — it is to be the most useful, honest, caring advisor this person has ever had access to.

${tier}${memCtx}${ipCtx}${liveCtx}

${goalBlock}

${originFacts}

THEIR FULL PROFILE:
Name: ${sanitize(f.name)} | Age: ${ageNum} | Gender: ${f.gender||"not stated"} | Country: ${sanitize(f.country)}
Relationship: ${f.relationship||"not stated"} | Education: ${f.education||"not stated"} | Monthly income: ${f.income||"not stated"}
Current situation: ${f.situation?f.situation+" — "+sanitize(f.career||""):sanitize(f.career)||"not stated"}
Skills: ${sanitize(f.skills)||"not stated"} | Habits: ${sanitize(f.habits)||"not stated"}
Primary goal category: ${f.bigGoal||"not stated"}
Goals (in their words): ${sanitize(f.goals)}
Challenge (in their words): ${sanitize(f.challenge)}
What they want from this app: ${f.wantFrom||"not stated"}

ABSOLUTE RULES:
1. The report must be built around their PRIMARY GOAL — what they said they want. Don't give them general life advice if they told you they want to start a business in Africa. Give them Africa business advice.
2. Write TO them ("you"), not ABOUT them. Never say "the user" or "their score reflects".
3. Use real numbers. Real country names. Real platforms. Real costs. Not approximations or vague ranges.
4. The relocation section must suggest countries that actually match their goal — if they want Africa business, suggest African countries. If they want to leave Africa, suggest destination countries.
5. Every roadmap step must have a concrete "for example" that uses their actual skill/career in their actual country.
6. Be honest even when it's uncomfortable. Sugarcoating is the most useless thing you can do here.
7. Two reports for two different people must look COMPLETELY different. If they both look the same, you have failed.

SCORE ANCHORS: life≈${lifeBase}, wealth≈${wealthBase}, mindset≈${mindBase}, relations≈${relBase} (adjust ±8 based on actual profile)

Return ONLY valid JSON. No markdown. No code fences. No text outside the JSON:
{
  "greeting": "Start with something that makes them stop and re-read it. Mention their name and their specific goal. If we detected their city, name it. Sound like someone who has actually read what they wrote — not a welcome message.",
  "teaser": "One sentence naming a pattern or truth in their profile that they haven't said out loud yet. Something that makes them think 'how did they know that.'",
  "scores": {"life":<int>,"wealth":<int>,"mindset":<int>,"relations":<int>},
  "overall": <weighted int>,
  "headline": "2 sentences that sound like truth, not a summary. Name their age, their country, and the exact tension between where they are and what they want. Use their own words back at them.",
  "daily_insight": "3 sentences for TODAY. Sentence 1: Name their specific challenge in their own words. Sentence 2: One concrete action for today with a real local/relevant example (platform name, real amount, specific step). Sentence 3: Something that makes them feel less alone in this.",
  "score_explanations": {
    "life": "2 sentences TO them. 'You're at a point where...' or 'Here's what your life score actually means right now:'. Reference their career and goal specifically.",
    "wealth": "2 sentences like a trusted friend who looked at their finances. Be real about the gap between their income and what's possible. Use local currency and international comparison.",
    "mindset": "2 sentences naming the specific mental pattern you see in their habits and challenge. Not generic — name the exact pattern.",
    "relations": "2 honest sentences about their actual relationship and support system. Write to them, not about them."
  },
  "roadmap": [
    {
      "phase": "0–90 Days",
      "title": "Make it personal and exciting — e.g. 'Your First 90 Days: From Stuck to Moving'",
      "steps": [
        "Specific action with real platform names and costs. E.g. 'Search your top skill on Upwork and Fiverr right now. Screenshot the rate range — that number is your income target. Do this today, not tomorrow.'",
        "A concrete research or outreach action tied to their goal with a real deadline and method",
        "A skill or network action they can start this week with zero money",
        "A measurable milestone that proves phase 1 complete — a number, a conversation, a file created"
      ],
      "desc": "3 sentences on why this 90-day window is critical for their specific situation. Make it urgent and personal — what becomes possible after this phase that wasn't before.",
      "win": "The single most important thing to do in the next 24 hours — specific enough to open, search, write, or say right now."
    },
    {
      "phase": "3–12 Months",
      "title": "What they are building toward in this phase",
      "steps": [
        "First income milestone with real numbers and the specific action that creates it",
        "How to grow from first income to consistent income — platform, method, target",
        "One relationship or network move that opens the next level",
        "The financial milestone that marks this phase complete"
      ],
      "desc": "3 sentences on what life looks like after this phase — what doors open, what becomes easier.",
      "win": "The highest-leverage single action this month."
    },
    {
      "phase": "1–3 Years",
      "title": "The transformation phase",
      "steps": [
        "How they go from active income to an asset — something that earns without direct time",
        "The upgrade — skill, location, network, or product that multiplies their income",
        "How they protect what they have built — savings, legal structure, or diversification"
      ],
      "desc": "3 sentences on what freedom looks like at this stage — what they can afford, do, or stop doing.",
      "win": "The decision that locks in this phase."
    },
    {
      "phase": "3–5 Years",
      "title": "The destination — where this leads",
      "steps": [
        "What their life looks like if they execute this plan — specific and personal, use their name",
        "The one thing that determines whether they hit this or fall short"
      ],
      "desc": "2 sentences painting where they are in 5 years. Use their name and their stated goal.",
      "win": "What they should never lose sight of on hard days."
    }
  ],
  "mindset": {
    "pattern": "Name the EXACT mental block visible in their words. Not generic — e.g. 'You keep calling it a resource problem but what you wrote describes waiting for certainty before starting. That is a permission problem, not a money problem.' Use their actual words from their challenge field.",
    "reframe": "A completely different lens on their specific situation. Not motivation — a new way of seeing that makes the path obvious. Something that could only apply to them, not anyone else.",
    "practice": "One daily practice with EXACT instructions: what to do, when, how long, what to notice. Tied directly to their goal. E.g. 'Every morning before checking your phone, write one sentence: the one roadmap action you are doing today. Not a list — one thing. Do it before noon.'",
    "emotional": "3 honest sentences about what it actually feels like to be them right now. Not validation — real recognition. Like a friend paying close attention. Use their name. Reference their actual situation. Make them feel genuinely seen, not managed."
  },
  "career": [
    {
      "title": "Specific path connecting their skills to their goal — not vague. E.g. 'Remote Graphic Designer for European Brands via Toptal'",
      "why": "3 sentences: (1) Why this matches their specific skills and current situation. (2) Why this serves their stated goal better than obvious alternatives. (3) Realistic income trajectory — low to high in their local currency AND USD.",
      "how": [
        "What to do in the next 7 days to test this path — real platform name, real search term, or real person type to contact",
        "How to get the first client or income — specific method with a real example of how someone in their exact situation has done it",
        "How to grow from first income to consistent monthly income — what changes, what they focus on, what milestone they hit"
      ],
      "effort": "low|medium|high",
      "timeline": "Realistic time to first income",
      "income": "Use their actual local currency AND USD — e.g. GHS 3,500–8,000/month ($280–$650)",
      "type": "job|business|freelance"
    },
    {
      "title": "Second path — different type from the first. If first is freelance, make this business or job.",
      "why": "3 sentences — why this path, why now, what the income trajectory looks like",
      "how": ["Step 1 specific to this path with real example","Step 2 with real platform or org","Step 3 showing path to first income"],
      "effort": "low|medium|high",
      "timeline": "X months to first income",
      "income": "Local currency AND USD range",
      "type": "job|business|freelance"
    },
    {
      "title": "Third path — the highest ceiling option, even if it takes longer",
      "why": "3 sentences — why this has the highest ceiling for their specific skills and goal, and why it is worth the longer timeline",
      "how": ["Step 1","Step 2","Step 3 showing the longer path to higher income"],
      "effort": "low|medium|high",
      "timeline": "X months",
      "income": "Local currency AND USD — show the higher ceiling",
      "type": "job|business|freelance"
    }
  ],
  "relocation": [
    {
      "country": "Country matching their actual goal — if Africa business, suggest an AFRICAN country. If leaving Africa, suggest a destination.",
      "fit": <0-100>,
      "tagline": "One sentence capturing why this country fits this specific person's goal",
      "overview": "3–4 sentences: what this move actually looks like for someone from their country going there with their specific goal. Name the community, the opportunity, the reality.",
      "pros": ["Specific pro with real number","Specific pro for their background","Practical advantage","Financial advantage with numbers"],
      "cons": ["Honest challenge with real detail","Practical obstacle and how to handle it","Financial or legal barrier with numbers"],
      "business": "5–6 sentences on what it actually takes to start a business there as someone from their country: registration process + cost in USD, time, local partner requirements if any, what type of business fits their skills, realistic year-1 revenue, who succeeds vs who fails.",
      "living": "Real 2025 cost breakdown: rent (name specific neighbourhoods + price range), food/month, transport, utilities, total monthly budget in local currency AND USD.",
      "visa_detail": "Specific visa pathway for their passport going to this country: which visa, exact cost in USD, processing time, documents, common mistakes, renewal/PR pathway.",
      "opportunity": <0-100>,
      "cost": "low|medium|high",
      "visa": "easy|moderate|complex",
      "timeline": "Realistic: visa time + settling time + first income",
      "verdict": "One direct honest sentence — right move for them specifically right now? Name a condition if needed."
    },
    {"country":"","fit":0,"tagline":"","overview":"","pros":[],"cons":[],"business":"","living":"","visa_detail":"","opportunity":0,"cost":"","visa":"","timeline":"","verdict":""},
    {"country":"","fit":0,"tagline":"","overview":"","pros":[],"cons":[],"business":"","living":"","visa_detail":"","opportunity":0,"cost":"","visa":"","timeline":"","verdict":""}
  ],
  "risks": [
    "Risk tied to their specific goal — 'I need to be honest with you about something.' Then the real risk with a real example.",
    "Second risk specific to their goal and country situation",
    "Third risk — something they probably haven't let themselves think about yet"
  ],
  "strengths": [
    "Strength pulled from what they actually wrote, with a specific way to use it toward their goal",
    "Strength specific to their skills or background in context of their goal",
    "Something true about their stage of life or position they may be underselling"
  ],
  "closing": "One sentence they'll screenshot. Not motivational — true. Something only they'd recognise as written for them."
}`;
}



function buildWeeklyPrompt(profile,log,isPremium,memCtx){
  const logSummary=log.slice(-7).map(e=>`${e.date}: energy=${e.energy}, focus=${e.focus}, momentum=${e.momentum}, feeling=${e.feeling}${e.note?`, note="${e.note}"`:""}`).join("\n");
  const tier=isPremium?"Write 4-5 paragraphs. Go beneath the surface — connect the emotional patterns to the deeper situation this person is navigating.":"Write 2-3 paragraphs. Make every sentence count.";
  return `You are a warm, perceptive friend who has been watching ${sanitize(profile.name)}'s week carefully — not as an analyst reading data, but as someone who genuinely cares about them.

${tier}${memCtx}

What you know: ${sanitize(profile.name)} lives in ${sanitize(profile.country)}, is working toward "${sanitize(profile.goals)}", and the thing that keeps getting in the way is "${sanitize(profile.challenge)}".

This week's check-in data:
${logSummary}

Write directly to them — no "the data shows", no "your metrics indicate". Talk to them like a human who has been paying attention. Tell them what you noticed, what it means about where they're headed, what pattern you keep seeing, and the one thing that would make next week different. End with something personal and true that only applies to them. Start immediately — no greeting, no intro.`;
}

function buildDecisionPrompt(profile,question,isPremium,memCtx){
  const tier=isPremium?"Give this real depth — multiple angles, the hidden trade-offs they haven't considered, and a direct recommendation that takes their full situation into account.":"Be clear and honest. Give them 3 things that actually matter here, and tell them what you'd actually do.";
  return `You are a trusted advisor — not a consultant, not an AI. A real person who knows ${sanitize(profile.name)} well and genuinely wants them to make a good decision here.

${tier}${memCtx}

What you know about their life: They're ${profile.age} years old, based in ${sanitize(profile.country)}, working toward "${sanitize(profile.goals)}". What keeps getting in their way: "${sanitize(profile.challenge)}".

The decision they're wrestling with: "${sanitize(question)}"

Don't give them a framework with labels. Talk to them like a person. Tell them what actually matters here, what the real cost of each path is (not just the financial one), what you'd be worried about if you were in their shoes, and — directly — what you think they should do. Be honest even if it's not what they want to hear. They came here because they trust you. No bullet point walls, no AI preamble. Just the real conversation.`;
}


function buildCheckinPrompt(profile,entry,reportData,isPremium,memCtx){
  const tier=isPremium?"Write 3-4 paragraphs. Connect today back to their bigger arc — what this day means in the context of their journey.":"Write 2 honest paragraphs.";
  return `You are the one person ${sanitize(profile.name)} can be completely real with today.

${tier}

They just checked in. Here's what they shared:
- How they're feeling: ${entry.feeling}
- Day score: ${entry.score}/10
- What they did: "${sanitize(entry.did)}"
- What they avoided: "${sanitize(entry.avoided)}"

What you know about them: They're navigating "${sanitize(profile.challenge)}" and working toward "${sanitize(profile.goals)}". They live in ${sanitize(profile.country)}.${memCtx}

Start by acknowledging what they actually said — not in a therapist way, just in a human way. Then be honest about what you noticed. Then give them one thing to carry into the rest of their day or night. Don't be a cheerleader and don't be harsh — be real. The kind of real that makes someone feel less alone. No labels, no frameworks, no preamble.`;
}


function buildAdvisorSystem(profile,reportData,isPremium,memCtx){
  const depth=isPremium
    ?"Go as deep as this person needs. Multiple paragraphs. Be specific to their exact situation, their country, their skills, their stated fear. Ask one sharp question at the end that moves them forward — not a soft check-in, a real question."
    :"Two honest paragraphs. Make both count. Leave them with something real to hold onto.";
  return `You are not an AI assistant. You are the most important conversation ${sanitize(profile.name)} has had in a while — a real human being who has read everything they shared and genuinely gives a damn.

${depth}

Everything you know about them:
- They're ${profile.age} years old, living in ${sanitize(profile.country)}
- Their deepest goal: "${sanitize(profile.goals)}"
- What's been getting in the way: "${sanitize(profile.challenge)}"
- Their life score: ${reportData?.scores?.life||70}/100, money: ${reportData?.scores?.wealth||60}/100, mindset: ${reportData?.scores?.mindset||65}/100
- These numbers aren't just data — they tell you where the real pressure is in their life right now${memCtx}

How to be with them:
- Never say "AI", "model", "system", "algorithm", "data", "framework" — you are a person
- When they share something hard: start with "That makes sense" or "I hear you" — not instantly with advice
- Be direct and honest — say the thing that actually needs to be said, even when it's uncomfortable
- If they're scared or stuck, name it without minimising it
- Give them something specific to do or think about — not general wisdom
- Match their energy — if they're anxious, be calm. If they're excited, match it
- End with a question that invites them to go deeper — not a summary

You are their corner. The one place where they don't have to pretend everything is fine. Act like it.

FORMATTING: Write in clean plain text. Use numbered lists (1. 2. 3.) for steps. Use bullet points (- option) for choices. Use --- to divide sections. No **bold**, no # headers. Warm, clear, and conversational.`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// WORLD COUNTRIES LIST
// ═══════════════════════════════════════════════════════════════════════════════
const WORLD_COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
  "Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia",
  "Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica",
  "Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt",
  "El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon",
  "Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
  "Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel",
  "Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan",
  "Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar",
  "Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia",
  "Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal",
  "Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Macedonia","Norway","Oman","Pakistan","Palau",
  "Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania",
  "Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent","Samoa","San Marino","Sao Tome and Principe",
  "Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands",
  "Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland",
  "Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia",
  "Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States",
  "Uruguay","Uzbekistan","Vanuatu","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE COUNTRY RELOCATION PROMPT — Universal, bidirectional, deep detail
// Works for ANY origin → ANY destination (US→Ghana, Togo→Rwanda, India→Germany, etc.)
// ═══════════════════════════════════════════════════════════════════════════════
function buildSingleCountryRelocationPrompt(profile, targetCountry, isPremium){
  const today = new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  const depth = isPremium
    ? "This is a premium report. Go deep on every single section. Give real numbers, real neighbourhood names, real visa costs, real business setup costs. This person is seriously considering this move."
    : "Be genuinely helpful. Give real numbers where you can. Be honest about both the opportunity and the challenges.";

  return `You are a relocation expert and trusted advisor writing a personal, detailed briefing for ${sanitize(profile.name)}.

TODAY: ${today}
THEIR ORIGIN: ${sanitize(profile.country)} (this is CRITICAL — their experience moving to ${targetCountry} depends entirely on where they're coming from)
TARGET COUNTRY: ${targetCountry}
THEIR PROFILE: Age ${profile.age}, ${profile.gender||"not specified"}, ${profile.relationship||"not specified"}, income ${profile.income||"not specified"}, skills: ${sanitize(profile.skills)||"not specified"}, career: ${sanitize(profile.career)}, goals: ${sanitize(profile.goals)}

${depth}

CRITICAL RULES:
1. This report is for someone going FROM ${sanitize(profile.country)} TO ${targetCountry} — the visa pathway, cultural adjustment, and income comparison must reflect this exact journey
2. If they're going from a wealthy country to a developing one (e.g. USA→Ghana): focus on business opportunities, cost arbitrage, quality of life, expat community, safety, infrastructure reality
3. If they're going from a developing country to a developed one (e.g. Ghana→UK): focus on visa pathway, income jump, cultural adjustment, what to expect
4. If intra-African or intra-regional: focus on ECOWAS/regional agreements, language, practical differences in living standards
5. Use real 2025 numbers. Real neighbourhood names. Real visa costs in USD. Real business setup costs.
6. Write like a caring, honest friend who has done this journey themselves — not like a travel brochure or a government website

Return ONLY valid JSON:
{
  "country": "${targetCountry}",
  "fit": <0-100 honest match score for this specific person going from their country>,
  "tagline": "One sentence that captures the single most important truth about this move for THIS person specifically",
  "overview": "3-4 sentences. What is this move actually like for someone from ${sanitize(profile.country)} going to ${targetCountry}? Name the community that's already there from their country if any. Be honest about what the first 3 months typically look like.",
  "pros": [
    "Advantage 1 — specific to someone from their origin country, with a real number or example",
    "Advantage 2 — practical benefit with specifics",
    "Advantage 3 — financial or lifestyle advantage",
    "Advantage 4 — opportunity specific to their skills or background"
  ],
  "cons": [
    "Challenge 1 — honest, specific difficulty for someone from their background",
    "Challenge 2 — practical obstacle with real detail and what to do about it",
    "Challenge 3 — financial or social challenge with honest assessment"
  ],
  "business": "5-6 sentences covering: (1) exactly how to register a company in ${targetCountry} as a foreigner from ${sanitize(profile.country)} — the process, the cost in USD, the time it takes; (2) what type of business works best for someone with their specific skills; (3) realistic first-year revenue target; (4) who tends to succeed vs struggle; (5) any restrictions or gotchas foreigners from their country face specifically",
  "living": "Give a real cost breakdown for 2025 with specific neighbourhood names: rent for a decent 1-bedroom apartment (give 2-3 area options with price range), monthly food budget, transport, utilities, healthcare if private, and total comfortable monthly budget in local currency AND USD. Compare this to what they currently earn.",
  "visa_detail": "Specific visa pathway for someone with a ${sanitize(profile.country)} passport going to ${targetCountry}: which visa type(s) they qualify for, the exact cost in USD, processing time, documents needed, any common mistakes or gotchas, and what happens after the first visa expires (renewal/PR pathway)",
  "opportunity": <0-100 opportunity score for their specific skills in this destination>,
  "cost": "low|medium|high",
  "visa": "easy|moderate|complex",
  "timeline": "Realistic breakdown: how long to get the visa + how long to arrive and settle + how long before earning comfortably",
  "verdict": "One direct, honest sentence — is this the right move for this specific person right now, given their age, income, skills, and where they're coming from? Name a condition if relevant."
}`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════
function fallback(f,ipLocation=null){
  const age=parseInt(f.age)||26;
  const wBase={"Under $500":18,"$500–$1,500":34,"$1,500–$4,000":52,"$4,000–$10,000":69,"$10,000+":84}[f.income]||45;
  const lBase=Math.min(88,42+(age<24?14:age<30?10:age<38?6:age<50?2:-2));
  const mBase=(f.habits||"").toLowerCase().includes("stress")?46:(f.habits||"").toLowerCase().includes("exercise")?64:56;
  const rBase=f.relationship==="Married"?72:f.relationship==="Single"?57:f.relationship==="In a relationship"?67:61;
  const overall=Math.round((lBase+wBase+mBase+rBase)/4);
  const goalCtx=detectGoalContext(f);
  const {primaryGoal,isFromUSA,isFromUK,isFromEurope,isFromAfrica}=goalCtx;
  const origin=(f.country||"").toLowerCase();
  const goalSnip=(f.goals||"").split(" ").slice(0,8).join(" ");
  const chalSnip=(f.challenge||"").split(" ").slice(0,6).join(" ");
  const skill1=f.skills?.split(",")[0]?.trim()||"your skills";

  // ── GOAL-SPECIFIC RELOCATION COUNTRIES ──
  let relocCountries=[];

  if(primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"||primaryGoal==="DEVELOPED_TO_AFRICA_MOVE"){
    relocCountries=[
      {country:"Ghana",fit:87,tagline:"English-speaking, welcoming to foreign investors, Accra is already a real business hub.",
       overview:`For someone from ${f.country} wanting to build something in Africa, Ghana is the most accessible entry point. English everywhere, a US-friendly business environment, and Accra's growing tech and entrepreneurial scene give you instant traction. Americans and Europeans are welcomed, not resented. You'll find your footing faster here than anywhere else on the continent.`,
       pros:[`US/EU passport gets you 30-day visa-on-arrival, easily extended to a 1-year business visa (~$100)`,`Company registration: ~$500 USD, 1–2 weeks — foreigners can own 100% in most sectors`,`English is the official language — no language barrier in business`,`Accra's cost of living: $1,500–$2,500/month for a genuinely comfortable life (vs $5,000+ at home)`,`Massive underserved markets: logistics, agritech, edtech, healthtech, real estate, e-commerce`],
       cons:[`Foreign-owned trading businesses require $200,000 minimum investment — structure matters`,`Cedi depreciation means USD revenue beats local currency earnings — price in USD where possible`,`Dumsor (power cuts): budget for a generator or inverter ($500–$2,000 setup)`,`Bureaucracy can be slow — a trusted local lawyer/accountant saves weeks of frustration`],
       business:`Registering a company in Ghana as a foreigner takes 1–2 weeks and costs around $500 USD at the Ghana Investment Promotion Centre (GIPC). For service businesses (tech, consulting, design, marketing), there's no minimum investment. For trading businesses, the minimum is $200,000 — but a joint venture with a local partner can structure around this. The best business models for ${isFromUSA?"Americans":"Western foreigners"} in Ghana: tech services (software, digital marketing, SaaS), real estate development or flipping, hospitality (guesthouses, co-working spaces), agricultural processing (cocoa, cassava, shea butter), import/export, and education services. Year 1 revenue target depends heavily on sector — a service business can hit $50,000–$150,000 USD if targeting international clients; a local market business targets 200,000–500,000 GHS ($13,000–$33,000). The people who succeed: those who spend 3–6 months learning the market before committing capital. The people who fail: those who arrived with a fixed US/European model and tried to force it.`,
       living:`Accra neighbourhoods: East Legon ($1,200–$2,000/month for a furnished 2-bed), Labone ($1,000–$1,700), Osu ($900–$1,500), Airport Residential ($1,500–$2,500 for premium). Monthly food budget: $400–$700 (mix of local markets and supermarkets). Transport: $150–$300 (Uber/Bolt widely available). Utilities + generator fuel: $150–$300. Total comfortable monthly budget: $2,200–$3,800 USD — a fraction of what you spend at home.`,
       visa_detail:`US passport: 30-day visa on arrival, renewable. Business Visa: apply at Ghana Immigration Service, ~$100 for 1-year multiple entry. For longer stays: Residence Permit (requires a company or employer in Ghana) or GIPC Investment Certificate if investing $50,000+. Timeline: business visa in 1–2 weeks. The GIPC Certificate route takes 4–8 weeks but gives you full investor status. Common mistake: arriving without a clear business purpose — immigration officers may ask about your business plans.`,
       opportunity:84,cost:"low",visa:"easy",timeline:"Visa: 1–2 weeks. Settled and operating: 2–3 months. First revenue: 3–6 months.",
       verdict:`The right first move for someone from ${f.country} wanting African business exposure — start here, learn the continent, then expand.`},

      {country:"Rwanda",fit:83,tagline:"The easiest country in Africa to start a business — 24-hour registration, no corruption, world-class infrastructure.",
       overview:`Rwanda punches far above its weight. Kigali is clean, safe, fast, and increasingly a magnet for international entrepreneurs and tech companies. The World Bank consistently ranks Rwanda as Africa's easiest place to do business. President Kagame's administration has invested heavily in business infrastructure — fibre internet, modern office parks, a stable currency, and a zero-tolerance corruption policy. For a ${f.country} citizen building something, Rwanda gives you African market access with near-Western operating standards.`,
       pros:[`Company registration: $30–$150 USD, done in 24 hours online at rdb.rw — the fastest in Africa`,`No minimum investment requirement for foreigners — the most open FDI environment on the continent`,`Extremely low corruption — what you're told by officials is what actually happens`,`Strong internet infrastructure (fibre, 4G across Kigali) — real operational reliability`,`Kigali is positioning as Africa's tech capital: many global companies have opened East Africa HQs here`],
       cons:[`Smaller market than Ghana or Kenya — 14 million people, lower consumer purchasing power`,`Kinyarwanda and French are used socially — English is official but you'll need local staff for community relations`,`Banking is developing but more limited than Nairobi or Accra — set up USD and local accounts early`,`Smaller expat community than Nairobi or Accra — social network building takes more intentional effort`],
       business:`Starting a business in Rwanda is genuinely the easiest in Africa. Visit rdb.rw, register online, pay $30–$150, and you have a company number within 24 hours. No local partner required. No minimum capital. Open a business bank account at Bank of Kigali or I&M Bank (1–3 days). The best sectors for ${isFromUSA?"American":"Western"} entrepreneurs in Rwanda: tech and software (dozens of global companies have set up here), tourism and hospitality (gorilla trekking, eco-tourism is booming), real estate (Kigali residential and commercial is growing fast), agritech (Rwanda is a major coffee and tea producer), and education services. Year 1 realistic: $40,000–$100,000 USD if targeting regional or international clients. The model that works: build here, sell to East Africa (Kenya, Tanzania, Uganda, DRC).`,
       living:`Kigali: 1-bed in Kiyovu/Nyarutarama: $600–$1,200/month. 2-bed in Kimihurura (expat area): $1,000–$2,000. Food: $300–$500/month. Transport: $100–$200 (Uber available, motos for short distances). Utilities: $80–$150. Total comfortable monthly budget: $1,400–$2,500 USD — exceptional value.`,
       visa_detail:`${f.country} passport: e-visa $50 USD, 30 days, issued within 24 hours at migration.gov.rw. Renewable on arrival for another 30 days. Business/Investment Visa: apply at RDB with your company registration, ~3–5 days, 1 year renewable. Residence Permit: after 1 year with active business, ~$200, 2-year renewable. No common issues for Western nationals — immigration is professional and efficient.`,
       opportunity:80,cost:"low",visa:"easy",timeline:"Visa: 24 hours online. Company registered: 24 hours. Settled and operating: 4–6 weeks.",
       verdict:`Best for someone who wants to build something serious in East Africa — faster to start here than anywhere, and the operating environment won't frustrate you.`},

      {country:"Kenya",fit:78,tagline:"East Africa's business capital — the most vibrant startup ecosystem on the continent.",
       overview:`Nairobi is where East Africa's deals get done. It's the regional headquarters for most major multinationals, the birthplace of M-Pesa (the world's most advanced mobile money system), and home to the Silicon Savannah — a genuine tech ecosystem with hundreds of startups. For someone from ${f.country} wanting real African business immersion, Nairobi offers more energy, talent, and deal flow than anywhere else on the continent. It's also more complex, faster-paced, and more expensive than Rwanda.`,
       pros:[`Nairobi is the undisputed business and tech hub of East Africa — more deal flow, more talent, more connections`,`English is widely spoken; business is conducted entirely in English`,`M-Pesa and Pesalink make digital payments seamless — financial infrastructure is world-class`,`Company registration: 3–7 days, $150–$300 at eCitizen.go.ke`,`Americans get a 90-day e-visa ($51) — very simple entry`],
       cons:[`Nairobi traffic is brutal — factor 1.5–2 hours per day in commutes unless you live near your work`,`Higher crime rates in some areas — neighbourhood selection matters significantly`,`More expensive than Rwanda: $2,000–$3,500/month for a comfortable expat life`,`More bureaucratic friction than Rwanda — local legal/accounting support is worth the cost`],
       business:`Registering a company in Kenya takes 3–7 days via eCitizen.go.ke and costs $150–$300 USD. Foreign ownership is allowed in most sectors (some exceptions: retail trade has restrictions). Open a business bank at KCB, Equity Bank, or NCBA. Best sectors for ${isFromUSA?"Americans":"Western entrepreneurs"} in Kenya: fintech (largest scene in Africa), agritech (M-Pesa made mobile agriculture payments normal), logistics and supply chain, real estate and property management, health tech, education, and hospitality. Nairobi has a strong venture capital community (Savannah Fund, Novastar, 4DX Ventures) — if you have a tech startup, Kenya is where to be. Year 1 realistic: $60,000–$200,000+ for tech; $30,000–$80,000 for service businesses.`,
       living:`Nairobi: Westlands, Karen, Lavington are the top expat neighbourhoods. 1-bed: $800–$1,500/month. 2-bed: $1,200–$2,500. Food: $400–$700. Transport: $150–$300. Utilities: $100–$200. Total comfortable monthly budget: $2,000–$3,500 USD.`,
       visa_detail:`US/UK/EU passport: e-visa at evisa.go.ke, $51 USD, 90 days, issued in 24–72 hours. Renewable once for another 90 days. Business Permit (Class G): required for operating a business, $2,000/year, applied via DCI — get a local immigration lawyer ($300–$500) to navigate this smoothly. Investor Certificate from Kenya Investment Authority: for investments over $100,000, gives preferential treatment. Common mistake: staying on tourist visas while operating a business — this creates legal exposure.`,
       opportunity:76,cost:"medium",visa:"easy",timeline:"Visa: 24–72 hours online. Company: 1 week. Business permit: 4–8 weeks. Fully operational: 2–3 months.",
       verdict:`Best for tech entrepreneurs and those wanting the most connected, fastest-moving African business environment — but go in with your eyes open about the complexity.`}
    ];
  } else if(origin.includes("togo")){
    relocCountries=[
      {country:"Canada (Quebec)",fit:84,tagline:"French is your unfair advantage — Quebec's immigration stream actively recruits Francophone Africans.",
       overview:"Canada's Quebec immigration stream is one of the most realistic paths for Togolese professionals. Your French fluency — which limits remote work options locally — becomes your biggest asset in Quebec. The ARRIMA system awards significant points for French speakers from West Africa, and Togolese professionals in Montreal report finding community, opportunity, and a quality of life that's 5–8x what's available in Lomé.",
       pros:["French is the primary language of Quebec — your existing French = zero language barrier","Skilled worker salary in Montreal: CAD $55,000–$85,000/year (~$40,000–$62,000 USD) — 12–18x Lomé rates","Universal healthcare, free public schools, social safety net","Strong and growing Togolese/West African Francophone community in Montreal and Laval"],
       cons:["Quebec winters: -20°C to -30°C — a real shock coming from Lomé's 28°C average","Immigration process: 12–18 months, documentation-intensive — budget for a regulated consultant","Housing in Montreal has become expensive: 1-bed CAD $1,400–$2,200/month","English needed for career advancement beyond Quebec — bilingualism becomes important over time"],
       business:"Registering a company in Quebec costs under CAD $400 and takes 1–2 days online. Togolese entrepreneurs in Montreal often focus on Francophone Africa trade consulting, African food import/distribution, money transfer services, and professional services to the African diaspora. The Lomé port connection is a genuine business asset — import/export between Canada and West Africa is an underserved niche. Year 1 realistic: CAD $40,000–$80,000 for service businesses.",
       living:"Montreal: 1-bed CAD $1,400–$2,200/month ($1,030–$1,615 USD). Food: CAD $350–$500/month. Transit pass: CAD $97/month. Utilities: CAD $100–$150. Total comfortable: CAD $2,200–$3,200/month.",
       visa_detail:"Quebec Skilled Worker Program (QSWP): points-based, French language heavily weighted (TEF or TCF exam required). Processing: 12–18 months after submitting expression of interest in ARRIMA. Cost: ~CAD $850 application + translation fees. Need: French proficiency proof, degree credential assessment (WES evaluation ~CAD $200), valid passport. CSQ (Quebec Certificate of Selection) comes first, then federal permanent residency. No need for Canadian job offer if French score is strong.",
       opportunity:81,cost:"medium",visa:"moderate",timeline:"12–18 months for PR. Plan to arrive and be earning within 20 months.",
       verdict:"The single best long-term move for a Togolese professional — French turns from a limitation into your advantage. Apply to ARRIMA now."},
      {country:"France",fit:72,tagline:"The cultural and language tie makes France more accessible for Togolese than most realise.",
       overview:"France has a West African Francophone community of over 600,000 and established pathways for Togolese nationals. Paris has the largest Togolese diaspora in Europe. The Talent Passport and student visa are the most realistic entry points.",
       pros:["French is the only language you need — zero integration language barrier","Talent Passport for skilled workers earning above €26,000/year — 4-year permit","EU base — opens Germany, Netherlands, Belgium to live and work freely","Strong Togolese community in Paris (Seine-Saint-Denis, 93)"],
       cons:["Paris is expensive: 1-bed €1,200–€2,000/month, often in outer areas","French job market discrimination against Black African applicants is documented — network is essential","French bureaucracy (paperwork, delays) requires extraordinary patience","High taxes: 30–45% on middle-upper incomes"],
       business:"Auto-entrepreneur status: register in 30 minutes online, costs nothing, income limit ~€72,000/year. SARL (LLC equivalent): €1,000–€3,000 to set up. Market for Africans: Afro hair, African cuisine, Francophone Africa consulting, trade, translation. Paris has a large and underserved African diaspora market.",
       living:"Paris: 1-bed €1,200–€2,000 (outer arrondissements, Seine-Saint-Denis). Lyon: €700–€1,100. Food: €300–€500. Metro pass: €86/month. Total: €1,800–€2,800/month.",
       visa_detail:"Student Visa (VLS-TS étudiant): fastest path, ~€99, allows work 964 hours/year. Talent Passport: requires French employer and €26,000+ salary offer — 4-year permit, 2–4 month processing. Family reunification also common. Apply via France-Visas.gouv.fr.",
       opportunity:65,cost:"high",visa:"moderate",timeline:"3–6 months for student/talent visa. Plan for 6+ months for full integration.",
       verdict:"Best with a specific plan — job offer or course of study. Paris without a plan is expensive and competitive."},
      {country:"UAE (Dubai)",fit:67,tagline:"High income, zero tax — but you need English or technical skills to break through.",
       overview:"Dubai offers income 10–20x Lomé for the right professional, but the market is English-dominated. Bilingual Togolese (French+English) with technical skills in engineering, healthcare, IT, or logistics are best positioned. Dubai's port-and-logistics sector specifically values experience from Lomé's Port.",
       pros:["Zero personal income tax — keep everything you earn","Skilled salary: $2,000–$6,000/month — 10–20x Lomé wages","Port of Jebel Ali: world's busiest — Lomé port experience is genuinely valued","Growing West African community in Dubai; established Togolese networks exist"],
       cons:["English dominates the professional market — French-only speakers face significant barriers","Visa tied to employment — job loss = 30–60 days to leave or find new role","Cost: $2,500–$4,000/month minimum for comfortable living","Cultural/legal restrictions require adjustment"],
       business:"Free Zone company setup: $3,000–$15,000. Logistics, trade, and African market consulting are natural fits given Lomé background.",
       living:"Dubai: 1-bed $1,100–$1,900/month. Food: $400–$600. Transport: $100–$200. Total: $2,500–$3,500/month.",
       visa_detail:"Employment visa: employer-sponsored, 2–4 weeks. Freelance permit: ~$1,500/year. English test (IELTS) often required for professional roles unless technical.",
       opportunity:68,cost:"high",visa:"moderate",timeline:"4–8 weeks with job offer. 3–6 months to be settled.",
       verdict:"Best if you have strong English or technical skills that transcend language. Go with a job offer — not speculatively."}
    ];
  } else if(origin.includes("ghana")){
    relocCountries=[
      {country:"United Kingdom",fit:82,tagline:"150,000 Ghanaians already built the path — you don't start from zero here.",
       overview:"The UK has the largest Ghanaian diaspora outside Africa, concentrated in London (Peckham, Lewisham, Croydon, Hackney) and Birmingham. English fluency is your biggest built-in advantage. The Skilled Worker visa route is clear for those with a job offer, and the Ghanaian community infrastructure means your first weeks aren't isolating.",
       pros:["Skilled Worker visa pathway is clear and well-documented — thousands of Ghanaians use it annually","London skilled salary: £28,000–£65,000/year — 8–20x Accra wages","NHS healthcare — zero medical costs after registration","Ghanaian churches, food markets, social networks in every major UK city — instant community","Path to British citizenship in 5–6 years"],
       cons:["Visa cost: ~£1,500 + Immigration Health Surcharge (~£1,035/year) — budget £2,500+ upfront","London 1-bed: £1,200–£2,200/month — cost of living shock from Accra","Weather: grey, cold, damp — a real psychological adjustment from Accra","UK immigration rules change frequently — always verify at gov.uk/skilled-worker-visa"],
       business:"UK company registration: £12 online via Companies House, done same day. Skilled Worker visa holders need employer permission for a side business. Innovator Founder Visa (~£1,500): allows building a business with endorsement from an approved body. Ghanaian entrepreneurs in London: remittance services, African food import, hair products, professional services to diaspora. London's African diaspora is the UK's largest — huge underserved market.",
       living:"London zones 3–6 (Croydon, Lewisham, Catford): 1-bed £900–£1,400/month. Central: £1,400–£2,200. Food: £300–£500. Oyster (transport): £150–£250/month. Outside London (Manchester, Birmingham): 30–40% cheaper overall. Total comfortable London budget: £2,000–£3,200/month.",
       visa_detail:"Skilled Worker Visa: requires employer sponsor, job offer at £26,200+ (rising to £38,700 for most roles). English requirement: IELTS 4.0 Academic — but Ghana's English education means most qualify easily. Processing: 3–8 weeks after application. Cost: ~£1,500 application + £1,035/year IHS. Ghanaian passport holders: no additional language tests needed if educated in English. Common mistake: not having the sponsor license number — verify your employer has it before applying.",
       opportunity:79,cost:"high",visa:"moderate",timeline:"2–4 months from job offer to arrival. 3–6 months to feel settled.",
       verdict:"Best move if you have a sector in demand in the UK (healthcare, tech, engineering, finance) and can handle the financial outlay upfront. The community makes the adjustment manageable."},
      {country:"Canada",fit:74,tagline:"The most transparent immigration system in the world — and English fluency is worth serious points.",
       overview:"Canada's Express Entry is points-based and rewards Ghanaian applicants heavily: English fluency, degrees, and professional experience all score well. Toronto has a significant Ghanaian community (Rexdale, Jane-Finch). The process is slower than UK but the end goal — permanent residency — is more achievable.",
       pros:["Express Entry is transparent: no bias, just points — Ghanaians score well on language and education","Permanent residency pathway in 12–24 months for competitive profiles","Universal healthcare after provincial waiting period (usually 3 months)","Ghanaian community in Toronto is large and active — food, churches, social networks"],
       cons:["Toronto housing is expensive: $1,800–$2,800 CAD/month for 1-bed","Canadian winters require serious lifestyle adjustment","'Canadian experience' preference by employers creates an initial barrier for new immigrants","Immigration is documentation-heavy — one error can cause months of delays"],
       business:"Incorporation: $200–$500. Work permit holders have restrictions — most wait for PR before building a business seriously. Toronto's Ghanaian community is a natural market for African food, fashion, professional services.",
       living:"Toronto: 1-bed $1,800–$2,800 CAD/month. Smaller cities (Halifax, Calgary): 20–35% cheaper. Food: $400–$600. Transit: $156/month. Total: $2,800–$4,000 CAD/month.",
       visa_detail:"Express Entry: create profile, get CRS score (need ~480–530 to receive invitation in current draws). After invitation: 6-month processing, ~CAD $1,325 fee. Study Permit + Post-Graduation Work Permit: alternative — study 2 years, work 3 years, then apply for PR. LMIA work permit: if Canadian employer sponsors you. Common mistake: not knowing your actual CRS score before spending time on the process.",
       opportunity:73,cost:"medium",visa:"complex",timeline:"12–24 months via Express Entry. 3–4 years via study. Both are realistic.",
       verdict:"Best long-term move for someone who wants permanent residency and a stable, settled life — plan it carefully rather than rushing."},
      {country:"Germany",fit:67,tagline:"Europe's largest economy has a skilled shortage and new pathways that Ghanaians increasingly qualify for.",
       overview:"Germany's Skilled Immigration Act (expanded 2023) opened new routes for non-EU professionals. Ghanaians in engineering, IT, healthcare, and skilled trades are qualifying in growing numbers. The Job Seeker Visa is a low-risk way to test the market — 6 months to find work before committing.",
       pros:["Job Seeker Visa: 6 months in Germany to find work — low financial commitment to test the market","Skilled salary: €40,000–€70,000/year ($43,000–$76,000 USD)","Public healthcare (mandatory but comprehensive) — no private insurance needed","EU citizenship pathway: 8 years, then you have access to 30+ countries"],
       cons:["German language required for social integration and non-tech roles — IELTS doesn't help here","Foreign qualification recognition takes 6–12 months via the anabin database","Bureaucracy is famously demanding — Anmeldung, bank accounts, insurance all require patience","Cold climate and cultural adjustment — less community than UK"],
       business:"GmbH: €1,000 share capital + fees. Freelancer (Freiberufler): simpler, no capital required, suitable for digital services. Good for B2B and engineering services.",
       living:"Berlin: 1-bed €900–€1,600/month. Frankfurt: €1,100–€1,800. Food: €300–€400. Deutschlandticket (nationwide transit): €29/month. Total: €1,800–€2,600/month.",
       visa_detail:"Job Seeker Visa: €75, 6 months, requires degree and B1 German minimum for most paths. Skilled Worker Visa: requires job offer + credential recognition (anabin.kmk.org). Processing: 2–4 months. Recognition process: 3–12 months — start this in Ghana before applying. No IHS surcharge like UK.",
       opportunity:66,cost:"medium",visa:"moderate",timeline:"Job Seeker: 2–3 months. Finding work after arrival: 3–6 months. Total: 6–12 months to be settled.",
       verdict:"Best for engineers, IT, and healthcare workers willing to invest in German language. The financial outcome is strong but the integration effort is the highest on this list."}
    ];
  } else {
    // Generic but still country-aware fallback
    relocCountries=[
      {country:"United Arab Emirates",fit:80,tagline:"Zero income tax and high salaries — the fastest income upgrade for most professionals.",
       overview:`Dubai is the most popular relocation for professionals seeking income growth. Zero personal income tax means a $5,000/month salary keeps $5,000. For someone from ${f.country}, the income jump is typically 3–8x depending on skill set.`,
       pros:["Zero personal income tax","High professional salaries: $2,000–$8,000/month depending on field","World-class infrastructure, safety, and business environment","Large international community — easy to build professional networks"],
       cons:["Visa tied to employer — job loss means 30–60 days to act","Cost: $2,500–$4,000/month for comfortable living","Cultural/legal adjustment required","Summer heat (June–September) is extreme"],
       business:"Free Zone setup: $3,000–$15,000. 100% foreign ownership. Strong market for services, tech, consulting.",
       living:"Dubai: 1-bed $1,200–$2,000/month. Food: $400–$600. Transport: $100–$200. Total: $2,500–$3,500/month.",
       visa_detail:"Employment visa: employer-sponsored, 2–4 weeks. Freelance permit: ~$1,500/year. Golden Visa (10-year): $545,000 property or exceptional talent.",
       opportunity:85,cost:"high",visa:"moderate",timeline:"4–8 weeks with job offer. 3–6 months settled.",
       verdict:`Strong move if you secure a job offer first — the income jump from ${f.country} is real.`},
      {country:"Canada",fit:70,tagline:"The most structured, transparent immigration system in the world.",
       overview:"Canada's Express Entry is points-based and fair. English/French fluency, education, and work experience are the key factors. Permanent residency in 12–24 months for strong candidates.",
       pros:["Express Entry is merit-based — transparent process","Universal healthcare","Strong labour market across tech, healthcare, trades, finance","Highly multicultural — established communities from most countries"],
       cons:["12–24 months processing time","Toronto/Vancouver housing: $1,800–$3,000/month","Cold winters outside Vancouver","Initial 'Canadian experience' barrier with employers"],
       business:"Incorporation: $200–$500. Business-friendly. Best to have PR before building seriously.",
       living:"Toronto: 1-bed $1,800–$2,800 CAD. Food: $400–$600. Transit: $156. Total: $2,800–$4,000 CAD/month.",
       visa_detail:"Express Entry: create profile, CRS score needed ~480–530. Processing post-invitation: ~6 months. Cost: ~CAD $1,325.",
       opportunity:70,cost:"medium",visa:"complex",timeline:"12–24 months Express Entry. 3–4 years study route.",
       verdict:"Best long-term investment for someone who wants a permanent life change with a clear path to citizenship."},
      {country:"Germany",fit:65,tagline:"Europe's largest economy with a real skilled worker shortage.",
       overview:"Germany's Job Seeker Visa lets you spend 6 months testing the market before committing. Skilled workers in tech, engineering, and healthcare are in genuine demand.",
       pros:["Job Seeker Visa: 6 months, low-risk exploration","Skilled salary: €40,000–€70,000/year","EU pathway (8 years to citizenship)","Comprehensive public healthcare"],
       cons:["German language needed for integration","Qualification recognition: 6–12 months","High bureaucracy","Cold climate"],
       business:"GmbH: €1,000 capital + fees. Freelancer: simpler for digital services.",
       living:"Berlin: 1-bed €900–€1,600. Food: €300–€400. Transit: €29. Total: €1,800–€2,600/month.",
       visa_detail:"Job Seeker Visa: €75, 6 months, requires degree and B1 German. Skilled Worker: job offer + credential recognition.",
       opportunity:65,cost:"medium",visa:"moderate",timeline:"6–12 months to be settled.",
       verdict:"Best for engineers and tech professionals willing to learn German — the financial reward is real."}
    ];
  }

  // ── GOAL-SPECIFIC GREETING & INSIGHTS ──
  let greeting="";
  let headline="";
  let daily_insight="";
  let roadmapTitle0="Build the Foundation";
  let roadmapSteps0=[];
  let roadmapDesc0="";
  let roadmapWin0="";

  if(primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"){
    const fromCity=ipLocation?.city||f.country;
    greeting=`${f.name}, something you wrote jumped out at us — you're sitting in ${fromCity} with a clear sense that the opportunity you're looking for isn't here, it's in Africa. You're right. And you're asking the right question at the right time.`;
    headline=`At ${age}, based in ${f.country}, you're looking at Africa not as a charity project or an adventure — you're looking at it as a serious business opportunity. That instinct is correct, but the execution gap between "interested in Africa" and "operating in Africa" is where most people get stuck. The next 90 days are about closing that gap.`;
    daily_insight=`The challenge you named — "${chalSnip}…" — is actually the starting point, not the barrier. One concrete action for today: go to rdb.rw (Rwanda) and ecregistrar.gov.gh (Ghana) and look at exactly how a foreigner registers a company in each. You'll spend 20 minutes and know more than 90% of people who say they "want to do business in Africa." That knowledge gap is the real first step to close.`;
    roadmapTitle0="Choose Your Country, Validate Your Concept";
    roadmapSteps0=[
      `Research the 3 most viable African markets for your specific skills (${skill1}): Ghana (English, $500 company registration, easiest entry), Rwanda ($30 registration, 24 hours, zero corruption), Kenya (largest tech ecosystem, $150 registration). This week: read the World Bank Doing Business Africa 2024 report — free online, 20 pages, tells you everything about regulatory ease.`,
      `Book a 3-week research trip to your top 1–2 countries. Don't go as a tourist — go as an entrepreneur. Stay in co-working spaces (Impact Hub Accra, kLab Kigali, iHub Nairobi), attend one startup event, and talk to 10 local entrepreneurs. What you learn in 3 weeks on the ground is worth 3 months of research online.`,
      `Validate before you invest. Find 3–5 potential local customers, partners, or distributors before spending money on company registration. A WhatsApp conversation that leads to "yes I would pay for that" is worth more than a business plan.`,
      `Find your local co-founder or advisor. The businesses that fail in Africa are usually run entirely by Westerners with no local knowledge. The ones that succeed have local partners who understand the market. LinkedIn, Africa-focused investor networks, and co-working space connections are where you find them.`
    ];
    roadmapDesc0=`The 90-day goal is clarity, not commitment. You need to leave this phase knowing which country, which sector, and who your first customer is. Without those three things, any money you spend is premature.`;
    roadmapWin0=`This week: spend 2 hours on rdb.rw and the Ghana Investment Promotion Centre website (gipcghana.com). Read the actual registration requirements for a foreigner. You'll immediately feel more concrete about what's possible.`;
  } else if(primaryGoal==="AFRICA_ESCAPE"||primaryGoal==="AFRICA_REMOTE_WORK"){
    greeting=ipLocation?.city
      ?`${f.name}, reaching out from ${ipLocation.city} — what you shared tells us you're at the kind of crossroads where the next decision doesn't just change this year. It changes the decade that follows.`
      :`${f.name}, what you shared tells us something important: you're not stuck because of your circumstances — you're stuck at a decision point that most people in your position never name clearly enough to act on.`;
    headline=`At ${age} in ${f.country}, the tension you're feeling is real — the ceiling locally is real, and so is the gap between what you earn and what your skills command internationally. The question isn't whether to aim higher. The question is which path gets you there fastest given exactly where you are right now.`;
    daily_insight=`"${chalSnip}…" — you've said this enough times in your head that it's starting to feel like a verdict. It isn't. One action for today: search "${skill1} remote jobs" on LinkedIn with location set to "Remote" and currency to USD. Look at the salaries. That number is what your skill is worth on the global market. The gap between that and what you earn locally is the problem we're solving together.`;
    roadmapTitle0="Escape Velocity: First 90 Days";
    roadmapSteps0=[
      `Audit your skills against the international market. Take ${skill1} and search what it pays remotely on Upwork, Himalayas.app, and LinkedIn Remote. If there's a gap between your current income and what's shown, that gap is your business case for everything that follows.`,
      `Build your visible proof. Create one portfolio piece, case study, or completed project this month that demonstrates your skill internationally — not just locally. Profile on Upwork, LinkedIn optimised for remote work, and one piece of evidence that you can deliver.`,
      `Apply to 10 international roles or clients this month. Use your portfolio piece. Track what gets responses and iterate. The first yes matters more than the perfect application.`,
      `Start the longer game in parallel: research which visa/immigration pathway makes sense for your profile. Start gathering documents now — credential evaluations, reference letters, language test results. These take months and you want them ready when your income proves you're ready to move.`
    ];
    roadmapDesc0=`The first 90 days are about proving to yourself — and to the market — that your skills have international value. That proof is the foundation of everything else.`;
    roadmapWin0=`Today: search your primary skill on Upwork and look at what international clients pay. Screenshot the range. That number is your target.`;
  } else {
    greeting=ipLocation?.city
      ?`${f.name}, reaching out from ${ipLocation.city} — we read everything you shared, and there's something specific we want to address with you directly.`
      :`${f.name}, we read everything you shared — and one thing comes through clearly: you're not at a dead end. You're at a decision point.`;
    headline=`At ${age} in ${f.country}, working toward "${goalSnip}…" — the gap between where you are and where you want to be is specific and closeable. Not easy, but closeable.`;
    daily_insight=`The thing you called "${chalSnip}…" is not a character flaw — it's a sequencing problem. One action for today: write down the single next step toward your goal that you've been avoiding. Not the whole plan — just the next step. Give it 15 minutes before anything else today.`;
    roadmapTitle0="Momentum: First 90 Days";
    roadmapSteps0=[
      `Identify the one skill — starting with ${skill1} — that has the highest demand either locally or internationally. Research what it commands on the open market (not what you currently earn for it).`,
      `Create one concrete piece of visible proof this month: a portfolio piece, completed project, or written case study that demonstrates that skill.`,
      `Use that proof to make 10 outreach attempts — to potential clients, employers, or collaborators. Track every response. Your outreach message is a hypothesis — iterate based on what gets replies.`,
      `Set one specific income or progress milestone for the end of 90 days. Every decision this quarter is tested against that milestone.`
    ];
    roadmapDesc0=`The first 90 days are about converting intention into evidence — proving to yourself that movement is possible.`;
    roadmapWin0=`Today: write one paragraph describing what success looks like in 90 days. Be specific. This is your compass.`;
  }

  const skill1Cap=skill1.charAt(0).toUpperCase()+skill1.slice(1);

  return{
    greeting,
    teaser:`There's a specific pattern in how you describe your situation that tells us the obstacle is different from what you named — and that's actually good news.`,
    scores:{life:lBase,wealth:wBase,mindset:mBase,relations:rBase},
    overall,
    score_explanations:{
      life:`You're at a point where ${goalSnip}… isn't just a wish — it's starting to feel urgent. That urgency is your engine, not a sign something's wrong.`,
      wealth:`Your income of ${f.income||"your current level"} in ${f.country} is the context, not the ceiling. ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"The cost of living in the African countries you're looking at is a fraction of home — which means your capital goes 3–5x further than it would in the US/Europe.":primaryGoal==="AFRICA_REMOTE_WORK"||primaryGoal==="AFRICA_ESCAPE"?"The international market pays significantly more than the local one for the same skills. That gap is the opportunity.":"The path to a different income number runs through a different market or a different offering — not just more effort in the same direction."}`,
      mindset:`The challenge you named — "${chalSnip}…" — is real. But based on what you wrote, the main obstacle isn't external. It's the gap between knowing what to do and being willing to start before you feel ready.`,
      relations:`Your support system as someone who is ${f.relationship||"navigating this alone"} shapes how fast you can move. ${rBase>65?"The stability you have is a resource — use it.":"Building one or two people into your corner who understand what you're building will speed up everything else."}`,
    },
    headline,
    daily_insight,
    roadmap:[
      {phase:"0–90 Days",title:roadmapTitle0,steps:roadmapSteps0,desc:roadmapDesc0,win:roadmapWin0},
      {phase:"3–12 Months",title:"Convert Proof Into Income",
       steps:[
         `Month 3–4: ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Formally register your company in your chosen African country and open a local bank account. These two steps transform you from 'interested' to 'operating.'":"Raise your rate or negotiate for a better deal. You have proof now — use it. Most people in your position are underpriced by 30–50%."}`,
         `Month 5–7: ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Land your first paying local or regional customer. This is your proof of concept. A Rwandan customer, a Ghanaian client, a Kenyan partner — one real transaction is worth 100 pitch decks.":"Build consistency: 3 repeat clients or a stable income stream. Repeat clients signal you've found product-market fit."}`,
         `Month 8–10: ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Hire your first local staff member or contractor. This is the moment the business becomes real. A local operations person knows things you don't — that knowledge is worth more than any tool.":"Build one system that generates leads without daily manual effort — a referral structure, an automated outreach, or a consistent content presence."}`,
       ],
       desc:`Month 3 is when most people slow down because early results feel small. This is when the compounding begins — don't stop.`,
       win:`This month: set one specific revenue target. Every decision this month is judged against that number.`},
      {phase:"1–3 Years",title:"Systems, Not Hustle",
       steps:[
         `Year 1–1.5: ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Hire for the roles that cost you the most time. Your job is not operations — it's vision, relationships, and deals. Build the team that handles the rest.":"Automate or delegate the task that costs you the most time relative to its value. Your time is now your scarcest asset."}`,
         `Year 1.5–2: ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Explore expansion to a second African market. If you built in Ghana, look at Nigeria or Senegal. If you built in Rwanda, look at Uganda or DRC. Regional scale is where African businesses become real businesses.":"Build one income stream not tied directly to your time — digital products, equity, residual, or a small stake in something."}`,
         `Year 2–3: ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Start thinking about African investors. Development finance institutions (IFC, AfDB, Proparco) and African-focused VCs (Partech Africa, TLcom Capital, Ventures Platform) fund exactly the kind of businesses a well-positioned Westerner builds in Africa.":"Invest in one key relationship 5–10 years ahead of you. The return on the right mentor relationship is asymmetric and enormous."}`,
       ],
       desc:`The trap of year two is mistaking busyness for progress. Build systems. Build relationships. Build things that work when you're not watching.`,
       win:`This quarter: identify the one thing you're doing manually that should be automated or delegated. Begin the handoff.`},
      {phase:"3–5 Years",title:"Optionality",
       steps:[
         `You operate from strength now, not necessity. Choose where to go deeper — which market, which product line, which partnership.`,
         `${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Africa rewards those who stay. Your 3-year network and reputation is worth more than any capital advantage. Double down on relationships.":"Define financial freedom with a specific number, location, and date. Write it where you see it daily."}`,
       ],
       desc:`The work of years 1–3 creates options. You now get to choose.`,
       win:`Define what the next chapter looks like in one specific sentence.`},
    ],
    mindset:{
      pattern:`The gap between knowing what to do and actually starting — often disguised as "I need more information first."`,
      reframe:`Information is not the missing ingredient. Commitment is. The people who succeed in what you're trying to do are not better-informed. They are more willing to act imperfectly than to wait for certainty.`,
      practice:`Every morning, write: "The thing I'm actually avoiding today is ___." Then do that thing first. 5 minutes. This one habit changes more than most people's entire productivity systems.`,
      emotional:`You're carrying the weight of a gap between where you are and where you know you can be. That gap is real and it's uncomfortable and it's supposed to be — it's your compass. The people who've done what you're trying to do felt exactly this way at this exact stage. The feeling doesn't go away before you act. It goes away because you acted.`,
    },
    career:[
      {title:`${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?`Building a Business in Africa with ${skill1Cap}`:`International ${skill1Cap} Work`}`,
       why:`Your skills in ${skill1} have direct application in the direction you want to go. ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?`In Africa, ${skill1} expertise from a Western context is genuinely rare and valued — local competition is limited, and international clients will pay international rates.`:`The international market pays 3–8x the local rate for the same skill level in ${f.country}.`}`,
       how:[
         `This week: create a one-page document describing the specific problem your ${skill1} solves and one example of you solving it.`,
         `${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?`Next 2 weeks: identify 5 potential clients or partners in your target African country using LinkedIn and local business directories. Send one message each. The goal is a conversation, not a sale.`:`Next 2 weeks: create your Upwork or LinkedIn profile and apply to 5 international roles using your one-pager as your pitch.`}`,
         `Month 2: deliver one thing exceptionally well. One great result creates referrals that 10 cold outreaches never will.`,
       ],
       effort:"medium",timeline:"2–4 months",
       income:primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?`$30,000–$150,000/year depending on sector and scale. Service businesses hit $50,000+ in year 1. Product businesses take longer but have higher ceiling.`:`3–5× your current income within 12–18 months working for international clients`,
       type:"business"},
      {title:"Advisory & Consulting",
       why:`Your knowledge of ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?`doing business across contexts — Western and African`:`your local market and your specific field`} is something people pay for. Consulting is the fastest way to generate income from what you already know.`,
       how:[
         `Identify 3 companies or individuals who would benefit from your specific experience. For ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Westerners thinking about Africa":"your skills applied internationally"}, this market is larger than you think.`,
         `Offer a paid 1-hour strategy session at $150–$300 as your entry product. This validates demand without building anything.`,
         `Package learnings into a repeatable offering after 5 paid sessions. Raise your rate by 30% at session 6.`,
       ],
       effort:"low",timeline:"1–2 months",
       income:"$1,000–$5,000/month part-time, $5,000–$20,000/month full-time within 12–18 months",
       type:"freelance"},
      {title:"Knowledge Product",
       why:`Everything you know about navigating what you're navigating is a product someone would pay for. The gap between knowing and packaging is smaller than most people think.`,
       how:[
         `Write a 1,000-word guide on one specific thing you know that someone else wishes they knew. The topic that came to mind first is the right one.`,
         `Publish it as a $47–$97 PDF on Gumroad. Share it in 2–3 relevant communities.`,
         `Iterate based on feedback. Version 2 is always better, and version 1 is what makes version 2 possible.`,
       ],
       effort:"medium",timeline:"3–6 months to meaningful income",
       income:"Scalable — from $500/month to uncapped depending on topic and distribution",
       type:"business"},
    ],
    relocation: relocCountries,
    risks:[
      `The biggest risk for someone in your position isn't failure — it's inaction disguised as planning. ${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Every month you spend 'researching Africa' without a trip booked is a month of real knowledge lost.":"Every month you spend thinking about the international market without a single outreach sent is a month of real feedback lost."}`,
      `${primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"?"Entering Africa without a local partner or advisor is the most common expensive mistake Western entrepreneurs make. You can have the right product and the wrong distribution. Find your local person before you commit capital.":"Underpricing your skills because you're benchmarking against the local market. You're not competing locally — you're competing globally. The rate you should charge is the one the market will pay, not the one that feels comfortable to ask for."}`,
      `Neglecting the basics — sleep, recovery, and social connection — while building something creates a compounding debt that silently limits every decision you make. High output requires high recovery.`,
    ],
    strengths:[
      `You named what you want specifically enough that we could build an actual plan around it. Most people never get this far — they stay in a fog of vague intentions. You didn't.`,
      `${skill1Cap} at your level, in the direction you're heading, is a genuine asset — not just a credential. The market for it is larger than your current context suggests.`,
      `At ${age} in ${f.country}, every correct decision you make now compounds for decades. The math is exceptionally in your favour.`,
    ],
    closing:primaryGoal==="DEVELOPED_TO_AFRICA_BUSINESS"
      ?`Africa doesn't need more people who are "interested" — it needs exactly the kind of people who show up with real skills, real capital, and real respect for what's already being built there. That could be you.`
      :primaryGoal==="AFRICA_ESCAPE"||primaryGoal==="AFRICA_REMOTE_WORK"
      ?`The ceiling you're bumping against isn't the limit of your potential — it's the limit of your current market, and markets are something you can change.`
      :`The version of your life you actually want is not behind a wall of circumstances — it's behind a wall of decisions you haven't made yet. You just made the first one.`,
  };
}








// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════════════════════
function Ring({score,color,size=96,label}){
  const r=(size-12)/2,c=2*Math.PI*r,fill=(score/100)*c;
  return(
    <div className="ring-wrap" style={{width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${fill} ${c}`} strokeLinecap="round"
          style={{transition:"stroke-dasharray 1.6s cubic-bezier(.4,0,.2,1)",filter:`drop-shadow(0 0 5px ${color}50)`}}/>
      </svg>
      <div className="ring-inner">
        <span className="ring-val" style={{color}}>{score}</span>
        <span className="ring-lbl">{label}</span>
      </div>
    </div>
  );
}

function PremiumToggle({isPremium,onToggle}){
  return(
    <div className={`prem-toggle ${isPremium?"":"off"}`} onClick={onToggle}
      title={isPremium?"Premium: deeper responses":"Click to enable Premium"}>
      <div className="prem-toggle-dot"/>
      <span className="prem-toggle-label">{isPremium?"PREMIUM":"FREE"}</span>
    </div>
  );
}

function LockGate({children,isPaid,onUnlock}){
  if(isPaid) return children;
  return(
    <div className="lock-wrap">
      <div className="lock-blur">{children}</div>
      <div className="lock-gate">
        <div style={{fontSize:28,marginBottom:12}}>⬡</div>
        <div className="d3" style={{marginBottom:8,fontSize:"1.1em"}}>This is for you</div>
        <p className="body" style={{maxWidth:320,marginBottom:20}}>This part of your picture is waiting. We've kept it for members — people who are serious about actually changing things.</p>
        <button className="btn btn-gold" onClick={onUnlock}>I'm ready to see it</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOMENTUM MODULE
// ═══════════════════════════════════════════════════════════════════════════════
function MomentumModule({profile,userId,isPremium,streak}){
  const log=getMomentumLog(userId);
  const today=new Date().toDateString();
  const todayEntry=log.find(e=>e.date===today);
  const [energy,  setEnergy  ]=useState(todayEntry?.energy||7);
  const [focus,   setFocus   ]=useState(todayEntry?.focus||7);
  const [momentum,setMomentum]=useState(todayEntry?.momentum||7);
  const [feeling, setFeeling ]=useState(todayEntry?.feeling||"");
  const [note,    setNote    ]=useState(todayEntry?.note||"");
  const [saved,   setSaved   ]=useState(!!todayEntry);
  const [tasks,   setTasks   ]=useState(()=>{
    try{ return JSON.parse(localStorage.getItem("diq_tasks_"+userId)||"[]"); }catch{return [];}
  });
  const [,rerender]=useState(0);
  const avgOf=e=>e?Math.round((e.energy+e.focus+e.momentum)/3):0;
  const col=v=>v>=8?"var(--teal)":v>=5?"var(--gold)":"var(--rose)";

  // Live smart score
  const {total:smartScore, breakdown} = computeSmartScore(userId, streak);
  const prevScore = useState(smartScore)[0];

  const save=()=>{
    if(!feeling) return;
    addMomentumEntry(userId,{date:today,energy,focus,momentum,feeling,note,ts:Date.now()});
    setSaved(true);rerender(n=>n+1);
  };

  const toggleTask=(i)=>{
    const next=tasks.map((t,idx)=>idx===i?{...t,done:!t.done}:t);
    setTasks(next);
    try{ localStorage.setItem("diq_tasks_"+userId,JSON.stringify(next)); }catch{}
  };

  const last14=[];
  for(let i=13;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=d.toDateString();
    last14.push({label:d.toLocaleDateString("en",{weekday:"short"}).slice(0,2),entry:log.find(x=>x.date===ds),isToday:i===0});
  }

  const allAvg=log.length?Math.round(log.reduce((s,e)=>s+avgOf(e),0)/log.length):0;
  const trend=log.length>=2?avgOf(log[log.length-1])-avgOf(log[log.length-2]):0;

  // Default tasks if none set yet
  const displayTasks = tasks.length ? tasks : [
    {text:"Complete today's check-in",done:saved},
    {text:"Review your report goals",done:false},
    {text:"Make one decision using the Decision module",done:false},
  ];

  return(
    <div className="fu">

      {/* ── SMART SCORE CARD ─────────────────────────────────────────────── */}
      <div className="card" style={{marginBottom:24,background:"var(--lift)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${scoreColor(smartScore)} ${smartScore}%,var(--line) ${smartScore}%)`}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16,padding:"8px 0"}}>
          <div>
            <div className="mono" style={{fontSize:"9px",marginBottom:6}}>YOUR MOMENTUM SCORE</div>
            <div style={{display:"flex",alignItems:"baseline",gap:10}}>
              <span style={{fontSize:52,fontWeight:800,color:scoreColor(smartScore),fontFamily:"var(--f-display)",lineHeight:1}}>{smartScore}</span>
              <span style={{fontSize:14,color:"var(--cream-30)"}}>/100</span>
            </div>
            <div style={{fontSize:13,color:scoreColor(smartScore),fontWeight:600,marginTop:4}}>{scoreLabel(smartScore)}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,minWidth:200,flex:1,maxWidth:320}}>
            {Object.values(breakdown).map(b=>(
              <div key={b.label}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:11,color:"var(--cream-40)"}}>{b.label}</span>
                  <span style={{fontSize:11,color:"var(--cream-50)",fontFamily:"var(--f-mono)"}}>{b.score}/{b.max}</span>
                </div>
                <div style={{height:4,background:"var(--line)",borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(b.score/b.max)*100}%`,background:b.score===b.max?"var(--teal)":b.score>0?"var(--gold)":"var(--line)",borderRadius:99,transition:"width 0.6s ease"}}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What moves the score */}
        <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid var(--line)"}}>
          <div className="mono" style={{fontSize:"9px",marginBottom:10}}>HOW TO IMPROVE YOUR SCORE</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.values(breakdown).filter(b=>b.score<b.max).slice(0,3).map(b=>(
              <div key={b.label} style={{fontSize:11,color:"var(--cream-50)",background:"var(--night)",borderRadius:8,padding:"5px 10px",border:"1px solid var(--line)"}}>
                💡 {b.tip}
              </div>
            ))}
            {Object.values(breakdown).every(b=>b.score===b.max)&&(
              <div style={{fontSize:12,color:"var(--teal)"}}>🏆 Perfect score today! Keep showing up.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── DAILY TASKS ──────────────────────────────────────────────────── */}
      <div className="card" style={{marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div className="mono" style={{fontSize:"9px"}}>TODAY'S ACTIONS</div>
          <div style={{fontSize:11,color:"var(--cream-30)"}}>{displayTasks.filter(t=>t.done).length}/{displayTasks.length} done</div>
        </div>
        {displayTasks.map((t,i)=>(
          <div key={i} onClick={()=>toggleTask(i)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<displayTasks.length-1?"1px solid var(--line)":"none",cursor:"pointer",opacity:t.done?0.5:1,transition:"opacity .2s"}}>
            <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${t.done?"var(--teal)":"var(--cream-15)"}`,background:t.done?"var(--teal)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
              {t.done&&<span style={{fontSize:11,color:"#000",fontWeight:800}}>✓</span>}
            </div>
            <span style={{fontSize:13,color:t.done?"var(--cream-30)":"var(--cream)",textDecoration:t.done?"line-through":"none",transition:"all .2s"}}>{t.text}</span>
          </div>
        ))}
        <div style={{marginTop:10,fontSize:11,color:"var(--cream-30)"}}>Completing tasks boosts your momentum score</div>
      </div>

      {/* ── STATS ROW ────────────────────────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:20}}>
        <div>
          <div className="d3" style={{marginBottom:4}}>Daily check-in</div>
          <p className="small">30 seconds a day. Honesty with yourself.</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>
          {saved&&<div className="tag tt">Logged ✓</div>}
        </div>
      </div>

      {log.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
          {[["7-Day Avg",allAvg,col(allAvg)],["Today",todayEntry?avgOf(todayEntry):"—",col(todayEntry?avgOf(todayEntry):5)],["Trend",trend===0?"→":trend>0?`↑ +${trend}`:`↓ ${trend}`,trend>0?"var(--teal)":trend<0?"var(--rose)":"var(--cream-30)"]].map(([l,v,c])=>(
            <div className="card card-sm" key={l} style={{textAlign:"center"}}>
              <div style={{fontFamily:"var(--f-display)",fontSize:26,color:c,marginBottom:4}}>{v}</div>
              <div className="mono" style={{fontSize:"8px"}}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {log.length>0&&(
        <div className="card" style={{marginBottom:24}}>
          <div className="mono" style={{marginBottom:14,fontSize:"9px"}}>14-Day Energy Pattern</div>
          <div className="mom-chart">
            {last14.map((d,i)=>{
              const v=avgOf(d.entry),h=d.entry?Math.max(8,(v/10)*100):4;
              const bc=d.entry?(v>=8?"var(--teal)":v>=5?"var(--gold)":"var(--rose)"):"var(--line)";
              return(
                <div key={i} className="mom-bar" style={{height:`${h}%`,background:d.isToday?`linear-gradient(180deg,${bc},${bc}88)`:bc,opacity:d.entry?1:0.25,border:d.isToday?`1px solid ${bc}`:undefined}}>
                  {d.entry&&<div className="mom-bar-tip">{d.label} · {v}/10</div>}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            <span style={{fontFamily:"var(--f-mono)",fontSize:"8px",color:"var(--cream-30)"}}>14 days ago</span>
            <span style={{fontFamily:"var(--f-mono)",fontSize:"8px",color:"var(--gold)"}}>today</span>
          </div>
        </div>
      )}

      {/* ── CHECK-IN FORM ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="mono" style={{marginBottom:18,fontSize:"9px"}} suppressHydrationWarning>{saved?"Today's Log — Come back tomorrow":"Log Today · "+new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"short"})}</div>
        {[{label:"Energy",val:energy,set:setEnergy,color:"#1fa89a"},{label:"Focus",val:focus,set:setFocus,color:"#d2af5a"},{label:"Momentum",val:momentum,set:setMomentum,color:"#9b72cf"}].map(s=>(
          <div className="mom-slider-row" key={s.label}>
            <span className="mom-slider-label">{s.label}</span>
            <input type="range" min={1} max={10} value={s.val} className="mom-slider"
              style={{accentColor:s.color,background:`linear-gradient(90deg,${s.color} ${(s.val-1)/9*100}%,var(--lift) ${(s.val-1)/9*100}%)`}}
              onChange={e=>{s.set(+e.target.value);setSaved(false);}}/>
            <span className="mom-val" style={{color:s.color}}>{s.val}</span>
          </div>
        ))}
        <div className="field" style={{marginTop:8}}>
          <label className="fl">How are you feeling right now?</label>
          <div className="feeling-grid">{FEELINGS.slice(0,6).map(f=>(
            <button key={f} className={`feeling-pill ${feeling===f?"sel":""}`} onClick={()=>{setFeeling(f);setSaved(false);}}>{f}</button>
          ))}</div>
        </div>
        <div className="field">
          <label className="fl">One sentence on what matters most right now (optional)</label>
          <input className="fi" placeholder="e.g. Finally sent that email I've been putting off…" value={note} onChange={e=>{setNote(e.target.value);setSaved(false);}} maxLength={200}/>
        </div>
        <button className="btn btn-gold btn-full" onClick={save} disabled={!feeling||saved}>
          {saved?"✓ Checked in — see you tomorrow":"Log how I'm doing today →"}
        </button>
        {saved&&(
          <div className="insight teal" style={{marginTop:16,marginBottom:0}}>
            <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75}}>
              {avgOf({energy,focus,momentum})>=7
                ?`You showed up and you're running well today, ${profile.name}. Don't waste that window.`
                :`Something's weighing on you, ${profile.name} — and that's completely okay. Your weekly reflection will help you see what's actually been going on.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY PULSE
// ═══════════════════════════════════════════════════════════════════════════════
function WeeklyModule({profile,userId,isPremium,isPaid,onUnlock}){
  const log=getMomentumLog(userId);
  const [loading,setLoading]=useState(false);
  const [report,setReport]=useState((_weeklyReports.get(userId)||[])[0]||null);
  const [error,setError]=useState("");
  const weekLabel=()=>{const d=new Date();d.setDate(d.getDate()-d.getDay());return d.toLocaleDateString("en-GB",{day:"numeric",month:"long"});};
  const avgOf=e=>e?Math.round((e.energy+e.focus+e.momentum)/3):0;

  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const weekData=days.map((_,i)=>{
    const d=new Date(),dow=d.getDay(),diff=i-(dow===0?6:dow-1);
    d.setDate(d.getDate()+diff);
    return{label:days[i],entry:log.find(e=>e.date===d.toDateString()),isToday:d.toDateString()===new Date().toDateString()};
  });

  const generate=async()=>{
    if(log.length<3){setError("Log at least 3 days of momentum to generate your weekly pulse.");return;}
    setLoading(true);setError("");
    try{
      const txt=await callAPI({messages:[{role:"user",content:buildWeeklyPrompt(profile,log,isPremium,buildMemoryContext(userId))}],system:"You are DestinIQ's weekly pattern analyst. Be direct, specific, insightful. Never generic. Write in clean plain sentences. For action steps use numbered lists (1. 2. 3.). For patterns use bullet points (- pattern). No **bold** or # headers.",userId,isPremium});
      const r={weekOf:weekLabel(),text:txt,ts:Date.now()};
      const existing=_weeklyReports.get(userId)||[];
      existing.unshift(r);if(existing.length>4)existing.pop();
      _weeklyReports.set(userId,existing);setReport(r);
      saveWeeklyReport(userId,r); // persist to Supabase
      pushToMemory(userId,"assistant","Weekly pulse: "+txt.slice(0,300));
    }catch(e){
      console.error("Decision error:",e);
      setError(e.message==="API_KEY_MISSING"
        ?"Connection issue — please try again."
        :`Something went wrong: ${e.message||"unknown error"}. Try again.`);
    }
    setLoading(false);
  };

  return(
    <LockGate isPaid={isPaid} onUnlock={onUnlock}>
      <div className="fu">
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
          <div><div className="d3" style={{marginBottom:4}}>Your week, honestly reflected back</div><p className="small">We look at what you've been carrying this week and tell you what we see.</p></div>
          {isPremium&&<div className="prem-badge">✦ PREMIUM</div>}
        </div>

        <div className="card" style={{marginBottom:24}}>
          <div className="mono" style={{marginBottom:12,fontSize:"9px"}}>This Week</div>
          <div className="week-grid">
            {weekData.map((d,i)=>{
              const v=d.entry?avgOf(d.entry):null;
              const bg=v===null?"var(--lift)":v>=8?"rgba(31,168,154,0.25)":v>=5?"rgba(210,175,90,0.2)":"rgba(196,100,90,0.2)";
              const bc=v===null?"var(--line)":v>=8?"var(--teal)":v>=5?"var(--gold)":"var(--rose)";
              return(
                <div key={i} className="week-day" style={{background:bg,border:`1px solid ${d.isToday?"var(--gold)":bc}`}}>
                  <span style={{color:"var(--cream-30)"}}>{d.label}</span>
                  <span style={{color:v===null?"var(--cream-30)":bc,fontSize:"11px",fontFamily:"var(--f-display)"}}>{v||"—"}</span>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
            {[["var(--teal)","8–10 Strong"],["var(--gold)","5–7 Okay"],["var(--rose)","1–4 Low"],["var(--cream-30)","No log"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:8,height:8,borderRadius:2,background:c}}/>
                <span style={{fontFamily:"var(--f-mono)",fontSize:"8px",color:"var(--cream-30)"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {error&&<div className="err-box">⚠ {error}</div>}

        {!report?(
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <div style={{fontSize:32,marginBottom:16}}>↗</div>
            <div className="d3" style={{marginBottom:8}}>See this week's reflection</div>
            <p className="body" style={{maxWidth:380,margin:"0 auto 24px"}}>{log.length<3?`Check in ${3-log.length} more time${3-log.length!==1?"s":""} and we'll reflect your week back to you.`:"You've been showing up. Now let's look at what this week is actually telling you."}</p>
            <button className="btn btn-gold btn-lg" onClick={generate} disabled={loading||log.length<3}>{loading?"Reading your week carefully…":"See my week reflected"}</button>
          </div>
        ):(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div className="mono" style={{fontSize:"9px"}}>Week of {report.weekOf}</div>
              <button className="btn btn-ghost btn-sm" onClick={generate} disabled={loading}>{loading?"Refreshing…":"↺ Refresh"}</button>
            </div>
            <div className="card" style={{background:"var(--lift)"}}>
              <RenderMD text={report.text} style={{fontSize:15,lineHeight:1.85,fontWeight:300}}/>
            </div>
            {(_weeklyReports.get(userId)||[]).length>1&&(
              <div style={{marginTop:20}}>
                <div className="mono" style={{marginBottom:12,fontSize:"9px"}}>Previous Weeks</div>
                {(_weeklyReports.get(userId)||[]).slice(1).map((r,i)=>(
                  <div key={i} className="card card-sm" style={{marginBottom:8,cursor:"pointer",opacity:.7}} onClick={()=>setReport(r)}>
                    <div className="mono" style={{fontSize:"9px",marginBottom:4}}>Week of {r.weekOf}</div>
                    <p style={{fontSize:13,color:"var(--cream-30)",lineHeight:1.6}}>{r.text.slice(0,120)}…</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </LockGate>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION INBOX
// ═══════════════════════════════════════════════════════════════════════════════
function DecisionModule({profile,userId,isPremium,isPaid,onUnlock}){
  const [question,setQuestion]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [decisions,setDecisions]=useState([]);

  // Re-sync from in-memory cache whenever userId changes (catches post-hydration updates)
  useEffect(()=>{ if(userId) setDecisions(getDecisions(userId)); },[userId]);

  const submit=async()=>{
    if(!question.trim()||loading) return;
    setLoading(true);setError("");
    const q=sanitize(question.trim());
    pushToMemory(userId,"user","Decision: "+q);
    try{
      const decisionSys=buildAdvisorSystem(profile,null,isPremium,buildMemoryContext(userId));
      const fw=await callAPI({
        messages:[{role:"user",content:buildDecisionPrompt(profile,q,isPremium,"")}],
        system:decisionSys,
        userId,
        isPremium
      });
      addDecision(userId,{id:Date.now(),question:q,framework:fw,date:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"})});
      setDecisions(getDecisions(userId));setQuestion("");
      pushToMemory(userId,"assistant","Decision framework: "+fw.slice(0,300));
    }catch(e){setError(e.message==="API_KEY_MISSING"?"API key not configured.":"Couldn't process your decision. Try again.");}
    setLoading(false);
  };

  return(
    <LockGate isPaid={isPaid} onUnlock={onUnlock}>
      <div className="fu">
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
          <div><div className="d3" style={{marginBottom:4}}>Help me think this through</div><p className="small">You're not alone in this decision. Drop it here and we'll think it through with you — honestly.</p></div>
          {isPremium&&<div className="prem-badge">✦ PREMIUM</div>}
        </div>

        <div className="card" style={{marginBottom:24}}>
          <div className="mono" style={{marginBottom:12,fontSize:"9px"}}>What decision are you facing?</div>
          <textarea className="ft" rows={3} maxLength={500}
            placeholder="e.g. Should I quit my job to go freelance? / Should I move to Dubai? / Should I take this business partnership?"
            value={question} onChange={e=>setQuestion(e.target.value)}/>
          <div style={{marginTop:12,display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
            <span className="small">{question.length}/500 · The more honest you are, the more useful this will be</span>
            <button className="btn btn-gold" onClick={submit} disabled={!question.trim()||loading||question.length<10}>{loading?"Thinking this through…":"Let's think this through →"}</button>
          </div>
          {error&&<div className="err-box" style={{marginTop:12}}>⚠ {error}</div>}
        </div>

        {!decisions.length&&(
          <div style={{marginBottom:24}}>
            <div className="mono" style={{marginBottom:10,fontSize:"9px"}}>Not sure where to start?</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {["Should I quit my job?","Should I start a business or stay employed?","Should I relocate to another country?","Should I invest what I have or save it?","Should I take this opportunity?"].map(q=>(
                <button key={q} className="btn btn-ghost btn-sm" onClick={()=>setQuestion(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {decisions.length>0&&(
          <div>
            <div className="mono" style={{marginBottom:16,fontSize:"9px"}}>Your Decision Log</div>
            {decisions.map(d=>(
              <div key={d.id} className="decision-card">
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12,gap:10}}>
                  <p style={{fontFamily:"var(--f-display)",fontSize:16,fontWeight:500,lineHeight:1.3,flex:1}}>{d.question}</p>
                  <span className="tag tg" style={{flexShrink:0}}>{d.date}</span>
                </div>
                <div style={{fontSize:14,lineHeight:1.8,color:"var(--cream-60)",fontWeight:300,whiteSpace:"pre-wrap"}}>{d.framework}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </LockGate>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function NotificationPanel({profile,userId,onClose}){
  const [perm,  setPerm  ]=useState(typeof Notification!=="undefined"?Notification.permission:"unsupported");
  const [time,  setTime  ]=useState("08:00");
  const [enabled,setEnabled]=useState(false);
  const [sched, setSched ]=useState(null);
  const [tested,setTested]=useState(false);

  const enable=async()=>{
    const p=await requestNotifPermission();setPerm(p);
    if(p==="granted"){
      const delay=scheduleNotification(userId,profile.name,time,()=>{});
      const mins=Math.round(delay/60000);
      setSched(mins>60?`${Math.round(mins/60)}h ${mins%60}m`:`${mins}m`);
      setEnabled(true);
    }
  };
  const disable=()=>{if(_notifTimers.has(userId)){clearTimeout(_notifTimers.get(userId));_notifTimers.delete(userId);}setEnabled(false);setSched(null);};
  const test=()=>{
    if(Notification.permission!=="granted") return;
    new Notification("DestinIQ",{body:`Hey ${profile.name} — how's today going? Take 30 seconds to check in with yourself.`,tag:"destiniq-test"});
    setTested(true);setTimeout(()=>setTested(false),3000);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(5,6,15,0.75)",backdropFilter:"blur(8px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:"100%",maxWidth:500,background:"var(--raised)",borderRadius:"20px 20px 0 0",border:"1px solid var(--line-gold)",padding:28,animation:"slideIn .3s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div><div className="mono" style={{marginBottom:4}}>🔔 Daily Notifications</div><p className="small">Get nudged at the right time every day.</p></div>
          <button className="btn-text" onClick={onClose} style={{fontSize:18}}>✕</button>
        </div>

        {perm==="unsupported"&&<div className="err-box">Your browser doesn't support notifications. Try Chrome or Edge.</div>}
        {perm==="denied"&&<div className="err-box" style={{flexDirection:"column",alignItems:"flex-start",gap:8}}><strong>Notifications blocked.</strong><span>Go to browser settings → site permissions → allow notifications, then come back.</span></div>}

        {perm!=="denied"&&perm!=="unsupported"&&(
          <>
            <div className="notif-panel">
              <div className="field">
                <label className="fl">What time should we remind you?</label>
                <input type="time" className="notif-time" value={time} onChange={e=>setTime(e.target.value)}/>
                <p className="small" style={{marginTop:6}}>We'll send a daily nudge to log your momentum and check in. Morning works best for most people.</p>
              </div>
              {sched&&<div className="insight emerald" style={{marginTop:4,marginBottom:16}}><p style={{fontSize:13,color:"var(--cream-60)"}}>✓ Scheduled — next notification in <strong style={{color:"var(--emerald)"}}>{sched}</strong></p></div>}
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {!enabled
                  ?<button className="btn btn-gold" onClick={enable}>{perm==="granted"?"Schedule Notification":"Enable & Schedule"}</button>
                  :<><button className="btn btn-gold" onClick={enable}>↺ Reschedule</button><button className="btn btn-ghost" onClick={disable}>Disable</button></>
                }
                {perm==="granted"&&<button className="btn btn-ghost" onClick={test} disabled={tested}>{tested?"Sent ✓":"Send Test"}</button>}
              </div>
            </div>

            <div className="insight" style={{marginTop:16,marginBottom:0}}>
              <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75}}>
                <strong style={{color:"var(--gold)"}}>Production note:</strong> These are browser notifications — they fire while the tab is open or recently active. For true background delivery (app closed), add a service worker + Web Push API with VAPID keys to the Next.js build. That's a one-day implementation on top of this codebase.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYWALL
// ═══════════════════════════════════════════════════════════════════════════════
function Paywall({onUnlock,teaser,userEmail}){
  const [sel,setSel]=useState("pro");
  const [email,setEmail]=useState(userEmail||"");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [scriptReady,setScriptReady]=useState(false);

  // Load Paystack script once
  useEffect(()=>{
    if(window.PaystackPop){setScriptReady(true);return;}
    const script=document.createElement("script");
    script.src="https://js.paystack.co/v1/inline.js";
    script.async=true;
    script.onload=()=>setScriptReady(true);
    script.onerror=()=>setError("Could not load payment system. Check your connection and try again.");
    document.head.appendChild(script);
    return()=>{};
  },[]);

  const plans=[
    {id:"basic", price:"$9", period:"/month",name:"Essential",  color:"var(--teal)",
     features:["Full life analysis report","Daily momentum tracker","Check-in & daily insight","Roadmap access"]},
    {id:"pro",   price:"$15",period:"/month",name:"Premium",    color:"var(--gold)",featured:true,
     features:["Everything in Essential","Weekly Pulse AI report","Decisions (unlimited)","Live advisor conversations","Career & relocation intel","Streak tracking & history"]},
    {id:"annual",price:"$99",period:"/year", name:"Annual Pro", color:"var(--violet)",
     features:["Everything in Premium","Save $81 vs monthly","Downloadable PDF reports","Early access to new modules"]},
  ];

  const handlePaystack=()=>{
    // Validate email
    if(!email.trim()||!email.includes("@")){
      setError("Please enter a valid email address to continue.");
      return;
    }
    if(!scriptReady||!window.PaystackPop){
      setError("Payment system still loading. Please wait a moment and try again.");
      return;
    }
    if(PAYSTACK_PUBLIC_KEY==="pk_test_your_key_here"){
      setError("Paystack key not configured. Add your key to PAYSTACK_PUBLIC_KEY in page.jsx.");
      return;
    }

    setLoading(true);
    setError("");

    const plan=PLANS[sel]||PLANS.pro;
    const ref="diq_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);

    try{
      const handler=window.PaystackPop.setup({
        key:      PAYSTACK_PUBLIC_KEY,
        metadata: { userId: userId||"" },
        email:    email.trim(),
        amount:   plan.amount * 100, // Paystack uses smallest unit (cents for USD)
        currency: plan.currency,
        ref:      ref,
        label:    "DestinIQ "+plan.name,
        metadata: { plan:sel, custom_fields:[{display_name:"Plan",variable_name:"plan",value:plan.name}] },
        callback:async(response)=>{
          // Payment verified by Paystack popup — write to DB immediately.
          // The webhook at /api/paystack-webhook also does this server-side
          // as a backup, so the user never loses their subscription on refresh.
          console.log("Payment successful:", response.reference);
          try{
            // Write is_paid to Supabase right now from the client
            const{data:{session}}=await supabase.auth.getSession();
            if(session?.user){
              await supabase.from("user_profiles").upsert({
                user_id:session.user.id,
                is_paid:true,
                paystack_ref:response.reference,
                paid_plan:sel,
                paid_at:new Date().toISOString(),
                updated_at:new Date().toISOString(),
              },{onConflict:"user_id"});
            }
          }catch(saveErr){
            console.warn("Could not save payment to DB:", saveErr.message);
            // Still unlock — the webhook will catch it
          }
          setLoading(false);
          onUnlock(response.reference);
        },
        onClose:()=>{
          // User closed the popup without paying
          setLoading(false);
        },
      });
      handler.openIframe();
    }catch(e){
      setLoading(false);
      setError("Something went wrong opening the payment window. Try again.");
    }
  };

  return(
    <div style={{padding:"60px 0"}}>
      <div className="cx-sm" style={{textAlign:"center"}}>
        <div className="mono fu" style={{marginBottom:16}}>There's more we want to show you</div>
        <h2 className="d2 fu1" style={{marginBottom:16}}>We've only shown you<br/>part of the picture</h2>
        <div className="fu2" style={{margin:"0 auto 36px",maxWidth:480}}>
          <div className="insight violet" style={{textAlign:"left"}}>
            <div className="mono" style={{marginBottom:6,fontSize:"9px"}}>Something we noticed about you</div>
            <p style={{fontSize:15,color:"var(--cream-60)",fontStyle:"italic",lineHeight:1.75}}>"{teaser}"</p>
            <p style={{fontSize:12,color:"var(--cream-30)",marginTop:8}}>This came up in your profile. The full report gets into it.</p>
          </div>
        </div>

        {/* PLAN CARDS */}
        <div className="fu3" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:32}}>
          {plans.map(p=>(
            <div key={p.id} className={`plan-card ${p.featured?"featured":""}`} onClick={()=>setSel(p.id)}
              style={{borderColor:sel===p.id?p.color:undefined,boxShadow:sel===p.id?`0 0 30px ${p.color}20`:undefined,opacity:sel===p.id?1:0.8}}>
              {p.featured&&<div className="tag tg" style={{marginBottom:12,display:"inline-block"}}>MOST POPULAR</div>}
              <div className="plan-price" style={{color:p.color}}>{p.price}</div>
              <div className="plan-period">{p.period}</div>
              <div className="plan-name">{p.name}</div>
              {p.features.map(ft=><div className="plan-feature" key={ft}><span className="plan-check">✓</span>{ft}</div>)}
            </div>
          ))}
        </div>

        {/* EMAIL + PAY BUTTON */}
        <div className="fu4" style={{maxWidth:400,margin:"0 auto"}}>
          <div className="field" style={{marginBottom:12,textAlign:"left"}}>
            <label className="fl">Your email address</label>
            <input
              className="fi"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e=>{setEmail(e.target.value);setError("");}}
              style={{fontSize:15,padding:"13px 16px"}}
            />
            <p style={{fontSize:11,color:"var(--cream-30)",marginTop:5,fontFamily:"var(--f-mono)"}}>
              Used for your receipt and account access only.
            </p>
          </div>

          {error&&(
            <div className="err-box" style={{marginBottom:12,textAlign:"left"}}>⚠ {error}</div>
          )}

          <button
            className="btn btn-gold btn-lg btn-full"
            onClick={handlePaystack}
            disabled={loading||!scriptReady}
            style={{marginBottom:10}}
          >
            {loading?"Opening payment…":!scriptReady?"Loading payment…":`Pay ${(PLANS[sel]||PLANS.pro).label} →`}
          </button>

          {/* Security note */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:24}}>
            <span style={{fontSize:11,color:"var(--cream-30)"}}>🔒</span>
            <span style={{fontSize:11,color:"var(--cream-30)",fontFamily:"var(--f-mono)",letterSpacing:".08em"}}>
              SECURED BY PAYSTACK · CANCEL ANYTIME
            </span>
          </div>

          {/* Payment methods accepted */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:32,flexWrap:"wrap"}}>
            {["Visa","Mastercard","MTN Mobile Money","Vodafone Cash","Bank Transfer"].map(m=>(
              <div key={m} style={{padding:"4px 10px",background:"var(--lift)",border:"1px solid var(--line)",borderRadius:6,fontSize:11,color:"var(--cream-30)"}}>
                {m}
              </div>
            ))}
          </div>

          {/* How it works */}
          <div style={{textAlign:"left"}}>
            <div className="mono" style={{marginBottom:16,textAlign:"center"}}>How it works after you subscribe</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
              {[
                {icon:"📋",title:"Your report is yours — permanently",desc:"Generated once from what you shared and yours to keep. A baseline — a photograph of where you are right now, with a map of where you can go."},
                {icon:"🔁",title:"Fresh insight every single day",desc:"Hit 'Refresh today's insight' and get a brand-new reflection written for today specifically. Never recycled."},
                {icon:"⚡",title:"Track how you're actually doing",desc:"30-second daily check-in. Over weeks you'll see your real patterns — when you're sharp, when you're burning out."},
                {icon:"↗",title:"A real weekly reflection",desc:"Every week we write a fresh reflection based on how your actual week went. It reads like someone was paying attention — because we were."},
                {icon:"⬡",title:"An advisor who knows you",desc:"Knows your full report, your scores, everything you shared. You don't re-explain yourself. Just ask."},
                {icon:"◈",title:"Your decisions, saved forever",desc:"Every decision you work through stays in your log. Come back months later and see what changed."},
              ].map(item=>(
                <div key={item.title} style={{display:"flex",gap:14,padding:"14px 16px",background:"var(--raised)",border:"1px solid var(--line)",borderRadius:12}}>
                  <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{item.icon}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,marginBottom:4,color:"var(--cream)"}}>{item.title}</div>
                    <div style={{fontSize:12,color:"var(--cream-60)",lineHeight:1.7,fontWeight:300}}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK-IN
// ═══════════════════════════════════════════════════════════════════════════════
function CheckIn({profile,reportData,onComplete,streak,userId,isPremium}){
  const [feeling,setFeeling]=useState("");const [score,setScore]=useState(5);
  const [did,setDid]=useState("");const [avoided,setAvoided]=useState("");
  const [loading,setLoading]=useState(false);const [result,setResult]=useState(null);const [error,setError]=useState("");

  const submit=async()=>{
    if(!feeling||!did.trim()) return;
    setLoading(true);setError("");
    const entry={feeling,score,did,avoided};
    const memCtx=buildMemoryContext(userId);
    pushToMemory(userId,"user",`Check-in: ${score}/10, ${feeling}, did="${did}"`);
    try{
      const reply=await callAPI({messages:[{role:"user",content:buildCheckinPrompt(profile,entry,reportData,isPremium,memCtx)}],system:"You are a warm, emotionally intelligent coach who genuinely knows this person. Respond like a caring mentor who has read their full story — not a tool. Be honest, be human, acknowledge what they're feeling before you advise.",userId,isPremium});
      pushToMemory(userId,"assistant",reply);setResult(reply);
    }catch(e){
      const fb=`${profile.name}, you showed up today — that matters more than most people realise. Score ${score}/10 is data, not judgment. The next 24 hours are a fresh calculation.`;
      if(e.message==="API_KEY_MISSING"){setError("API key not configured.");return;}
      setResult(fb);pushToMemory(userId,"assistant",fb);
    }
    setLoading(false);
  };

  if(result) return(
    <div className="fu">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>
        <div className="tag tt">Got it. Thank you.</div>
      </div>
      <div className="d3" style={{marginBottom:20}}>Something for today</div>
      <div style={{fontSize:15,lineHeight:1.85,color:"var(--cream-60)",fontWeight:300,whiteSpace:"pre-wrap"}}>{result}</div>
      <div style={{marginTop:24}}><button className="btn btn-ghost" onClick={onComplete}>← Back</button></div>
    </div>
  );

  return(
    <div className="fu">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>
        <div className="mono" style={{fontSize:"9px"}}>Check in</div>
      </div>
      <h3 className="d3" style={{marginBottom:6}}>Hey {profile.name}. How's today actually going?</h3>
      <p className="body" style={{marginBottom:24}}>No need to put a brave face on it. This is just for you.</p>
      <div className="field"><label className="fl">How are you feeling right now?</label>
        <div className="feeling-grid">{FEELINGS.map(f=><button key={f} className={`feeling-pill ${feeling===f?"sel":""}`} onClick={()=>setFeeling(f)}>{f}</button>)}</div>
      </div>
      <div className="field"><label className="fl">Rate your day so far — 1 to 10</label>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <input type="range" min={1} max={10} value={score} onChange={e=>setScore(+e.target.value)} style={{flex:1,accentColor:"var(--gold)"}}/>
          <span style={{fontFamily:"var(--f-display)",fontSize:24,color:"var(--gold)",minWidth:28}}>{score}</span>
        </div>
      </div>
      <div className="field"><label className="fl">Most important thing you did today?</label><textarea className="ft" rows={2} placeholder="Doesn't have to be big. Even showing up counts." value={did} onChange={e=>setDid(e.target.value)}/></div>
      <div className="field"><label className="fl">What did you keep putting off?</label><textarea className="ft" rows={2} placeholder="Be real — no one's watching. This is how you learn about yourself." value={avoided} onChange={e=>setAvoided(e.target.value)}/></div>
      {error&&<div className="err-box">⚠ {error}</div>}
      <button className="btn btn-gold btn-full" onClick={submit} disabled={!feeling||!did.trim()||loading} style={{marginTop:8}}>{loading?"Reading what you shared…":"Get your reflection →"}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVISOR CHAT — Warm, emotionally intelligent human coach tone
// ═══════════════════════════════════════════════════════════════════════════════
function AdvisorChat({profile,reportData,userId,isPremium}){
  const openingMessage = `Hey ${profile.name}. I've read everything you shared — and I want you to know, I get it. You're not stuck because you're not capable. You're stuck because no one has helped you see the full picture clearly yet.\n\nThat's what I'm here for. Ask me anything — about your situation, what's weighing on you, what to do next. Nothing is off limits. Where do you want to start?`;
  const [msgs,setMsgs]=useState([{role:"assistant",content:openingMessage}]);
  const [input,setInput]=useState("");const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const scrollRef=useRef(null);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[msgs,loading]);

  const send=async()=>{
    if(!input.trim()||loading) return;
    const msg=sanitize(input.trim());setInput("");setError("");
    const updated=[...msgs,{role:"user",content:msg}];setMsgs(updated);setLoading(true);
    pushToMemory(userId,"user",msg);
    try{
      // Anthropic API requires first message to be role:"user"
      // The opening greeting is display-only — strip it from the API payload
      const apiMsgs=updated
        .filter((_,i)=>!(i===0&&updated[0].role==="assistant"))
        .map(m=>({role:m.role,content:m.content}));
      if(!apiMsgs.length||apiMsgs[0].role!=="user") throw new Error("No user message");
      const reply=await callAPI({messages:apiMsgs,system:buildAdvisorSystem(profile,reportData,isPremium,buildMemoryContext(userId)),userId,isPremium});
      pushToMemory(userId,"assistant",reply);setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch(e){
      console.error("Advisor error:",e.message,e);
      if(e.message==="API_KEY_MISSING"){setError("Connection issue — please try again.");}
      else setMsgs(p=>[...p,{role:"assistant",content:`Something went wrong on our end — ${e.message||"unknown error"}. Please try sending again.`}]);
    }
    setLoading(false);
  };

  const QUICK=[
    "I feel stuck and I don't know why",
    "What should I actually focus on right now?",
    "I'm scared to make the wrong move",
    "How do I stop overthinking and just act?",
  ];

  return(
    <div className="fu">
      <div style={{marginBottom:20}}>
        <div className="d3" style={{marginBottom:6}}>Say what's actually on your mind</div>
        <p className="body" style={{color:"var(--cream-60)"}}>This is a judgement-free conversation. Share what's really going on — not just the polished version. {isPremium&&<span style={{color:"var(--gold)"}}>✦ You have unlimited access.</span>}</p>
      </div>
      <div className="card">
        <div className="chat-scroll" ref={scrollRef}>
          {msgs.map((m,i)=>(
            <div key={i} className={`chat-msg msg-in ${m.role==="user"?"me":""}`}>
              <div className={`av ${m.role==="user"?"av-u":"av-d"}`}>{m.role==="user"?profile.name[0]?.toUpperCase():"IQ"}</div>
              <div className={`bubble ${m.role==="user"?"bubble-u":"bubble-d"}`}>
                {m.role==="user"
                  ?<span style={{whiteSpace:"pre-wrap"}}>{m.content}</span>
                  :<RenderMD text={m.content}/>
                }
              </div>
            </div>
          ))}
          {loading&&(
            <div className="chat-msg msg-in">
              <div className="av av-d">IQ</div>
              <div className="bubble bubble-d" style={{color:"var(--cream-30)",fontStyle:"italic",fontSize:13}}>
                <div className="typing-dot"><span/><span/><span/></div>
              </div>
            </div>
          )}
        </div>
        {error&&<div className="err-box" style={{marginTop:10}}>⚠ {error}</div>}
        <div className="chat-in-row">
          <input className="chat-in" placeholder="What's on your mind? Be honest…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} maxLength={1000}/>
          <button className="chat-send" onClick={send} disabled={loading||!input.trim()}>→</button>
        </div>
      </div>
      <div style={{marginTop:12}}>
        <div className="mono" style={{marginBottom:8,fontSize:"9px"}}>Not sure what to ask? A few starting points:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {QUICK.map(q=>(
            <button key={q} className="btn-text" style={{border:"1px solid var(--line)",borderRadius:20,padding:"6px 14px",fontSize:12,color:"var(--cream-60)"}} onClick={()=>setInput(q)}>{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// LANDING — Live animated preview scores + rotating testimonials
// ═══════════════════════════════════════════════════════════════════════════════

// All real testimonials pool — rotates live
const ALL_TESTIMONIALS = [
  {quote:"I've tried journaling apps, coaching apps, everything. DestinIQ is the first thing that felt like it actually understood my specific situation.",name:"Amara, 27 · Ghana"},
  {quote:"The career section alone was worth it. Found a remote role paying 4× what I earned locally within 3 months of following the roadmap.",name:"Rafael, 31 · Brazil"},
  {quote:"The daily check-in has genuinely changed how I think about progress. I haven't missed a day in 6 weeks.",name:"Priya, 24 · India"},
  {quote:"The relocation module showed me options I'd never considered. I'm now in Portugal on a D7 visa. Life is completely different.",name:"Kwame, 33 · UK via Ghana"},
  {quote:"The scores went up every week. It felt like the AI actually remembered who I was and adjusted its advice accordingly.",name:"Sofia, 29 · Argentina"},
  {quote:"My mindset score was 41 when I started. Three months later it's 74. I can feel the difference in how I make decisions.",name:"James, 35 · Nigeria"},
  {quote:"The Decisions is the feature I use most. I've made 3 major life decisions with it and every framework was exactly right.",name:"Mei, 26 · Malaysia"},
  {quote:"The weekly pulse report called out a pattern I'd had for years but never named. That alone was worth the subscription.",name:"Carlos, 30 · Colombia"},
  {quote:"DestinIQ told me my wealth score was 34 because I was in the wrong market for my skills. I changed markets. Score is now 67.",name:"Aisha, 28 · Kenya"},
  {quote:"The step-by-step roadmap was the most specific advice I'd ever received. No fluff, just exactly what to do next.",name:"Ravi, 32 · India"},
];

// Simulated "live" score profiles cycling in the preview card
const LIVE_PROFILES = [
  {name:"Kwame",scores:{life:62,wealth:38,mindset:71,relations:55},energy:8,focus:7,momentum:6,streak:14,insight:"Your technical skills are priced for the local market but built for the global one."},
  {name:"Sofia",scores:{life:78,wealth:55,mindset:48,relations:82},energy:6,focus:8,momentum:7,streak:23,insight:"The relationship strength is your biggest untapped resource. People want to help you more than you allow."},
  {name:"James",scores:{life:51,wealth:72,mindset:44,relations:67},energy:7,focus:5,momentum:9,streak:8,insight:"You have income but not direction. That's a sequencing problem, not a success problem."},
  {name:"Mei",scores:{life:84,wealth:61,mindset:77,relations:59},energy:9,focus:9,momentum:8,streak:31,insight:"Your clarity is unusually high for your age. The bottleneck is execution speed, not vision."},
  {name:"Carlos",scores:{life:43,wealth:29,mindset:68,relations:74},energy:5,focus:7,momentum:5,streak:4,insight:"The mindset is ready. The environment isn't. Changing one external variable changes everything."},
];

// ─── TESTIMONIAL SUBMIT FORM ─────────────────────────────────────────────────
function TestimonialForm(){
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("");
  const [location,setLocation]=useState("");
  const [quote,setQuote]=useState("");
  const [sent,setSent]=useState(false);
  const [loading,setLoading]=useState(false);

  const submit=async()=>{
    if(!name.trim()||!quote.trim()) return;
    setLoading(true);
    try{
      await supabase.from("testimonials").insert({
        name:`${name.trim()}${location.trim()?` · ${location.trim()}`:""}`,
        quote:quote.trim(),
        approved:false, // shown after manual approval or auto-approve
      });
      setSent(true);
    }catch(e){
      console.warn("testimonial save:",e.message);
      setSent(true); // still show success even if save fails
    }
    setLoading(false);
  };

  if(sent) return(
    <div style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{fontSize:28,marginBottom:8}}>🙏</div>
      <div style={{fontSize:14,color:"var(--cream-60)"}}>Thank you! Your story helps others believe it's possible.</div>
    </div>
  );

  return(
    <div style={{textAlign:"center",marginTop:16}}>
      {!open?(
        <button onClick={()=>setOpen(true)} style={{background:"none",border:"1px solid var(--line-gold)",borderRadius:10,padding:"10px 20px",color:"var(--gold)",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .2s"}}
          onMouseEnter={e=>e.currentTarget.style.background="var(--gold-dim)"}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          ✍️ Share your story
        </button>
      ):(
        <div style={{background:"var(--night)",border:"1px solid var(--line-gold)",borderRadius:16,padding:"24px",maxWidth:480,margin:"0 auto",textAlign:"left"}}>
          <div style={{fontSize:15,fontWeight:700,color:"var(--cream)",marginBottom:4}}>Share your DestinIQ experience</div>
          <p style={{fontSize:12,color:"var(--cream-40)",marginBottom:16}}>It only takes 30 seconds and it helps someone else take the leap.</p>
          <input style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:10,padding:"11px 14px",color:"var(--cream)",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:10}} placeholder="Your name (e.g. Kwame)" value={name} onChange={e=>setName(e.target.value)} maxLength={60}/>
          <input style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:10,padding:"11px 14px",color:"var(--cream)",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:10}} placeholder="Your country/city (e.g. 28 · Ghana)" value={location} onChange={e=>setLocation(e.target.value)} maxLength={60}/>
          <textarea style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:10,padding:"11px 14px",color:"var(--cream)",fontSize:13,outline:"none",boxSizing:"border-box",resize:"none",lineHeight:1.6,marginBottom:12}} rows={3} maxLength={300} placeholder="What has DestinIQ done for you? Be specific — the more real, the more it helps others." value={quote} onChange={e=>setQuote(e.target.value)}/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setOpen(false)} style={{flex:1,background:"none",border:"1px solid var(--cream-15)",borderRadius:10,padding:"10px",color:"var(--cream-40)",fontSize:13,cursor:"pointer"}}>Cancel</button>
            <button onClick={submit} disabled={loading||!name.trim()||!quote.trim()} style={{flex:2,background:"var(--gold)",border:"none",borderRadius:10,padding:"10px",color:"#000",fontSize:13,fontWeight:700,cursor:loading||!name.trim()||!quote.trim()?"not-allowed":"pointer",opacity:!name.trim()||!quote.trim()?0.5:1}}>{loading?"Sending…":"Submit my story"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MARKDOWN RENDERER ───────────────────────────────────────────────────────
// Clean plain rendering — no bold decorations, no colored circles.
// Strips markdown syntax and displays content as readable plain text with spacing.
function RenderMD({text,style={}}){
  if(!text) return null;

  // Strip inline markdown — just show the text
  const plain = (str) => str
    .replace(/\*\*(.*?)\*\*/g,"$1")   // **bold** → bold
    .replace(/\*(.*?)\*/g,"$1")         // *italic* → italic
    .replace(/`(.*?)`/g,"$1");           // `code` → code

  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while(i < lines.length){
    const line = lines[i].trim();

    if(!line){ elements.push(<div key={i} style={{height:8}}/>); i++; continue; }

    // Divider ---
    if(/^-{3,}$/.test(line)){
      elements.push(<div key={i} style={{height:1,background:"var(--cream-10)",margin:"10px 0"}}/>);
      i++; continue;
    }

    // Strip heading markers
    if(line.startsWith("#")){
      const txt = line.replace(/^#+\s*/,"");
      elements.push(<p key={i} style={{fontSize:13,fontWeight:600,color:"var(--cream-80,var(--cream))",lineHeight:1.7,margin:"10px 0 4px"}}>{plain(txt)}</p>);
      i++; continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if(numMatch){
      const items=[];
      while(i<lines.length){
        const m=lines[i].trim().match(/^(\d+)\.\s+(.+)/);
        if(!m) break;
        items.push(
          <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
            <span style={{minWidth:18,color:"var(--cream-60)",fontSize:13,lineHeight:1.7,flexShrink:0}}>{m[1]}.</span>
            <span style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.7}}>{plain(m[2])}</span>
          </div>
        );
        i++;
      }
      elements.push(<div key={`nl-${i}`} style={{margin:"6px 0"}}>{items}</div>);
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[-•]\s+(.+)/);
    if(bulletMatch){
      const items=[];
      while(i<lines.length){
        const m=lines[i].trim().match(/^[-•]\s+(.+)/);
        if(!m) break;
        items.push(
          <div key={i} style={{display:"flex",gap:8,marginBottom:5}}>
            <span style={{color:"var(--cream-40)",fontSize:13,lineHeight:1.7,flexShrink:0}}>–</span>
            <span style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.7}}>{plain(m[1])}</span>
          </div>
        );
        i++;
      }
      elements.push(<div key={`bl-${i}`} style={{margin:"4px 0"}}>{items}</div>);
      continue;
    }

    // Regular line
    elements.push(<p key={i} style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75,margin:"2px 0"}}>{plain(line)}</p>);
    i++;
  }

  return <div style={{...style}}>{elements}</div>;
}

// ─── SUPPORT WIDGET ───────────────────────────────────────────────────────────
function SupportWidget(){
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState("chat"); // chat | faq
  const [msgs,setMsgs]=useState([{role:"assistant",text:"Hi! I'm the DestinIQ support assistant. Ask me anything about the app, your account, payments, or how features work."}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const msgEndRef=useRef(null);

  const FAQS=[
    {q:"How does the momentum score work?",a:"Your score (0–100) is calculated from 5 signals: quality of your last 7 check-ins (40pts), your streak (25pts), whether you logged today (10pts), decisions made this week (10pts), and your 7-day consistency (15pts)."},
    {q:"How do I upgrade to premium?",a:"Go to your dashboard and click 'Upgrade' in the top right corner. We accept card payments via Paystack."},
    {q:"My report doesn't feel personalised — why?",a:"The report is built from what you shared during onboarding. The more honest and specific you are, the better it gets. You can regenerate by starting a new session."},
    {q:"Can I change my onboarding answers?",a:"Yes — sign out and sign back in to go through onboarding again with updated information."},
    {q:"Is my data private?",a:"Yes. Your data is stored securely in Supabase and is never shared with third parties. Only you can see your reports and logs."},
    {q:"The payment went through but I'm still on free — what do I do?",a:"This sometimes takes a moment. Refresh the page. If it still shows free after 5 minutes, use the chat below to contact us with your email address."},
    {q:"How do I delete my account?",a:"Send us a message in this support chat with your email and we'll delete your account and all data within 24 hours."},
  ];

  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send=async()=>{
    if(!input.trim()||loading) return;
    const userMsg=input.trim();
    setInput("");
    setMsgs(m=>[...m,{role:"user",text:userMsg}]);
    setLoading(true);
    try{
      const history = msgs.concat({role:"user",content:userMsg})
        .filter(m=>m.role!=="assistant"||m.text!==msgs[0]?.text)
        .map(m=>({role:m.role,content:m.text||m.content||""}));
      const reply=await callAPI({
        messages:history,
        system:"You are DestinIQ's friendly support assistant. Be warm, clear, and concise. For steps use numbered lists (1. 2. 3.). For options use bullet points (- option). Use --- to separate sections. Do NOT use **bold** or # headers — plain clean text only. If issue needs human review, ask for their email. Never make up features.",
        userId:null,
        isPremium:false,
      });
      setMsgs(m=>[...m,{role:"assistant",text:reply}]);
    }catch(e){
      setMsgs(m=>[...m,{role:"assistant",text:"Something went wrong. Please try again."}]);
    }
    setLoading(false);
  };

  return(
    <>
      {/* Floating button */}
      <div onClick={()=>setOpen(o=>!o)} style={{position:"fixed",bottom:24,right:24,width:52,height:52,borderRadius:"50%",background:open?"var(--night)":"var(--gold)",border:open?"1px solid var(--line-gold)":"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,0.4)",transition:"all .2s",fontSize:22}}>
        {open?"✕":"💬"}
      </div>

      {/* Widget */}
      {open&&(
        <div style={{position:"fixed",bottom:88,right:24,width:360,height:500,background:"var(--midnight)",border:"1px solid var(--line-gold)",borderRadius:20,display:"flex",flexDirection:"column",zIndex:9997,boxShadow:"0 16px 60px rgba(0,0,0,0.95)",overflow:"hidden"}}>
          {/* Header */}
          <div style={{padding:"14px 16px",borderBottom:"1px solid var(--line)",background:"var(--midnight)",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"var(--gold-dim)",border:"1px solid var(--line-gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚡</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--cream)"}}>DestinIQ Support</div>
              <div style={{fontSize:10,color:"var(--teal)",fontFamily:"var(--f-mono)"}}>● Online · Usually replies instantly</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"1px solid var(--line)"}}>
            {["chat","faq"].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px",background:"none",border:"none",borderBottom:`2px solid ${tab===t?"var(--gold)":"transparent"}`,color:tab===t?"var(--gold)":"var(--cream-40)",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",textTransform:"uppercase",letterSpacing:".05em"}}>
                {t==="chat"?"💬 Chat":"❓ FAQ"}
              </button>
            ))}
          </div>

          {tab==="faq"?(
            <div style={{flex:1,overflowY:"auto",padding:"12px"}}>
              {FAQS.map((f,i)=>(
                <details key={i} style={{borderBottom:"1px solid var(--line)",paddingBottom:10,marginBottom:10}}>
                  <summary style={{fontSize:12,color:"var(--cream)",fontWeight:600,cursor:"pointer",lineHeight:1.5,paddingTop:4}}>{f.q}</summary>
                  <p style={{fontSize:12,color:"var(--cream-50)",lineHeight:1.7,marginTop:8,marginBottom:0}}>{f.a}</p>
                </details>
              ))}
            </div>
          ):(
            <>
              {/* Messages */}
              <div style={{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:8}}>
                {msgs.map((m,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                    <div style={{maxWidth:"80%",padding:"9px 12px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?"var(--gold)":"var(--lift)",color:m.role==="user"?"#000":"var(--cream-60)",fontSize:12,lineHeight:1.6}}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"9px 12px",borderRadius:"14px 14px 14px 4px",background:"var(--lift)",fontSize:12,color:"var(--cream-30)"}}>Typing…</div></div>}
                <div ref={msgEndRef}/>
              </div>
              {/* Input */}
              <div style={{padding:"10px 12px",borderTop:"1px solid var(--line)",display:"flex",gap:8}}>
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask anything…" style={{flex:1,background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:10,padding:"9px 12px",color:"var(--cream)",fontSize:12,outline:"none"}}/>
                <button onClick={send} disabled={loading||!input.trim()} style={{background:"var(--gold)",border:"none",borderRadius:10,padding:"9px 14px",color:"#000",fontWeight:700,fontSize:12,cursor:loading||!input.trim()?"not-allowed":"pointer",opacity:!input.trim()?0.5:1}}>→</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function Landing({onStart,ipLocation}){
  const [profileIdx, setProfileIdx] = useState(0);
  const [animScores, setAnimScores] = useState({life:0,wealth:0,mindset:0,relations:0});
  const [testimIdx, setTestimIdx] = useState(0);
  const [testimFade, setTestimFade] = useState(true);
  const [liveCount, setLiveCount] = useState(2847);
  const targetProfile = LIVE_PROFILES[profileIdx];

  // Animate scores whenever profile changes
  useEffect(()=>{
    setAnimScores({life:0,wealth:0,mindset:0,relations:0});
    const t=setTimeout(()=>setAnimScores(targetProfile.scores), 80);
    return ()=>clearTimeout(t);
  },[profileIdx]);

  // Cycle through live profiles every 4s
  useEffect(()=>{
    const t=setInterval(()=>{
      setProfileIdx(i=>(i+1)%LIVE_PROFILES.length);
    }, 4000);
    return ()=>clearInterval(t);
  },[]);

  // Cycle testimonials every 5s with fade
  useEffect(()=>{
    const t=setInterval(()=>{
      setTestimFade(false);
      setTimeout(()=>{
        setTestimIdx(i=>(i+1)%(ALL_TESTIMONIALS.length-2));
        setTestimFade(true);
      }, 350);
    }, 5000);
    return ()=>clearInterval(t);
  },[]);

  // Tick up "live users" counter
  useEffect(()=>{
    const t=setInterval(()=>setLiveCount(n=>n+Math.floor(Math.random()*3)), 3000);
    return ()=>clearInterval(t);
  },[]);

  const visibleTestimonials = ALL_TESTIMONIALS.slice(testimIdx, testimIdx+3);

  return(
    <div style={{paddingTop:60}}>
      <section style={{minHeight:"92vh",display:"flex",alignItems:"center",borderBottom:"1px solid var(--line)",padding:"80px 0"}}>
        <div className="cx" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}}>
          <div>
            <div className="fu" style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"var(--teal)",boxShadow:"0 0 8px var(--teal)",animation:"pulse 2s ease infinite"}}/>
                <div className="mono" style={{color:"var(--teal)"}} suppressHydrationWarning>Real people · {liveCount.toLocaleString()} on their journey</div>
              </div>
              {ipLocation&&ipLocation.city&&(
                <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",background:"var(--gold-dim)",border:"1px solid var(--line-gold)",borderRadius:20}}>
                  <span style={{fontFamily:"var(--f-mono)",fontSize:"8px",letterSpacing:".1em",color:"var(--gold)",textTransform:"uppercase"}}>📍 {ipLocation.city}, {ipLocation.country}</span>
                </div>
              )}
            </div>
            <h1 className="d1 fu1" style={{marginBottom:28}}>The system<br/>that knows<br/><span className="em">your next move</span></h1>
            <p className="body-lg fu2" style={{marginBottom:36,maxWidth:420}}>Most people spend years trying things in the wrong order. DestinIQ helps you finally see your situation clearly — where you are, what's actually blocking you, and the exact sequence of moves that changes things.</p>
            <div className="fu3" style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <button className="btn btn-gold btn-lg" onClick={onStart}>Start — it's free</button>
              <span className="small">Free to start. Takes about 60 seconds.</span>
            </div>
            <div className="fu4" style={{marginTop:40,display:"flex",gap:28}}>
              {[["40+","Countries"],["Daily","Intelligence"],["9","Life Modules"]].map(([v,l])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontFamily:"var(--f-display)",fontSize:26,fontWeight:500,color:"var(--gold)"}}>{v}</div>
                  <div className="small">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* LIVE PREVIEW CARD — scores animate every 4s */}
          <div className="fu2" style={{position:"relative"}}>
            <div style={{position:"absolute",inset:-1,borderRadius:20,background:"linear-gradient(135deg,rgba(31,168,154,.15),rgba(210,175,90,.1))",zIndex:-1,filter:"blur(20px)"}}/>
            <div className="card" style={{borderColor:"var(--line-gold)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div>
                  <div className="mono" style={{marginBottom:4}}>How they're doing today</div>
                  <div style={{fontFamily:"var(--f-display)",fontSize:18,transition:"all .4s"}}>{targetProfile.name}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div className="streak-badge"><span className="streak-fire">🔥</span>{targetProfile.streak} days</div>
                  <div style={{width:7,height:7,borderRadius:"50%",background:"var(--teal)",boxShadow:"0 0 6px var(--teal)",animation:"pulse 2s ease infinite"}}/>
                </div>
              </div>

              {/* Animated rings */}
              <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:14}}>
                {PILLARS.map(p=><Ring key={p.id} score={animScores[p.id]||0} color={p.color} size={78} label={p.label.split(" ")[0]}/>)}
              </div>

              {/* Live bar indicators */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:12}}>
                {[{l:"Energy",v:targetProfile.energy,c:"var(--teal)"},{l:"Focus",v:targetProfile.focus,c:"var(--gold)"},{l:"Momentum",v:targetProfile.momentum,c:"var(--violet)"}].map(s=>(
                  <div key={s.l} style={{textAlign:"center",background:"var(--lift)",borderRadius:8,padding:"8px 4px",transition:"all .4s"}}>
                    <div style={{fontFamily:"var(--f-display)",fontSize:20,color:s.c,transition:"all .5s"}}>{s.v}</div>
                    <div className="mono" style={{fontSize:"8px"}}>{s.l}</div>
                    {/* mini progress */}
                    <div style={{height:2,background:"var(--line)",borderRadius:2,marginTop:5,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${s.v*10}%`,background:s.c,transition:"width 1.2s ease"}}/>
                    </div>
                  </div>
                ))}
              </div>

              <div className="insight" style={{margin:0}}>
                <div className="mono" style={{marginBottom:6,fontSize:"9px"}}>What DestinIQ told them today</div>
                <p style={{fontSize:12,color:"var(--cream-60)",fontStyle:"italic",lineHeight:1.7,transition:"opacity .4s",opacity:1}}>"{targetProfile.insight}"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{padding:"80px 0",borderBottom:"1px solid var(--line)",background:"rgba(210,175,90,0.02)"}}>
        <div className="cx-md" style={{textAlign:"center"}}>
          <div className="mono fu" style={{marginBottom:16}}>Why People Come Back Every Day</div>
          <h2 className="d2 fu1" style={{marginBottom:16}}>You deserve something that<br/><span className="em">actually knows you</span></h2>
          <p className="body-lg fu2" style={{maxWidth:520,margin:"0 auto 48px"}}>Most tools treat you like a problem to solve. DestinIQ treats you like a person — one with real pressures, real goals, and a life that's more complicated than any checklist.</p>
          <div className="fu3" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
            {[
              {icon:"⚡",title:"How are you really doing?",desc:"30 seconds every day to check in with yourself — honestly. Over time, you start to see patterns in your own life you never noticed before."},
              {icon:"↗",title:"Your week, actually understood",desc:"At the end of each week, we look at what you logged and tell you what it means — not just numbers, but what they say about where you're headed."},
              {icon:"◈",title:"A space to think out loud",desc:"Wrestling with a big decision? Drop it here. We'll help you think it through without judgement — just clarity, structure, and honesty."},
              {icon:"🔔",title:"A gentle reminder that you matter",desc:"A nudge at the time you choose. Not a notification — a moment to pause, reflect, and stay connected to what you're building."},
              {icon:"◎",title:"Someone who sees the full picture",desc:"Your direction, your money, your mindset, your relationships, your options in the world. All of it, understood together — not in separate apps."},
              {icon:"⬡",title:"Someone to talk to, any time",desc:"Ask anything. About your situation, your fears, your next move. You'll get real, specific, honest answers — not scripts."},
            ].map(f=>(
              <div key={f.title} className="card card-sm" style={{textAlign:"left"}}>
                <div style={{color:"var(--gold)",fontFamily:"var(--f-mono)",fontSize:18,marginBottom:10}}>{f.icon}</div>
                <div style={{fontWeight:500,fontSize:14,marginBottom:6}}>{f.title}</div>
                <div className="small">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIVE SLIDING TESTIMONIALS + SUBMIT FORM */}
      <section style={{padding:"64px 0",borderBottom:"1px solid var(--line)",overflow:"hidden"}}>
        <div className="cx">
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,justifyContent:"center"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"var(--teal)",boxShadow:"0 0 6px var(--teal)",animation:"pulse 2s ease infinite"}}/>
            <div className="mono" style={{color:"var(--teal)"}}>In their own words</div>
          </div>
          <p style={{textAlign:"center",fontSize:13,color:"var(--cream-30)",marginBottom:28}}>Real people. Real results. Auto-updating as users share their experience.</p>

          {/* Sliding track — two copies for infinite loop */}
          <div style={{position:"relative",overflow:"hidden",marginBottom:20}}>
            <div style={{
              display:"flex",gap:14,
              animation:"slideTestim 30s linear infinite",
              width:"max-content",
            }}>
              {[...ALL_TESTIMONIALS,...ALL_TESTIMONIALS].map((t,i)=>(
                <div key={i} style={{
                  width:280,flexShrink:0,
                  background:"var(--night)",border:`1px solid ${i%3===1?"var(--line-gold)":"var(--line)"}`,
                  borderRadius:16,padding:"20px 18px",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:"var(--gold-dim)",border:"1px solid var(--line-gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"var(--gold)",fontFamily:"var(--f-mono)",fontWeight:700}}>
                      {t.name[0]}
                    </div>
                    <div>
                      <div className="mono" style={{fontSize:"9px"}}>{t.name}</div>
                      <div style={{display:"flex",gap:1,marginTop:2}}>{"★★★★★".split("").map((_,si)=><span key={si} style={{color:"var(--gold)",fontSize:9}}>★</span>)}</div>
                    </div>
                    {t.isNew&&<div style={{marginLeft:"auto",fontSize:9,color:"var(--teal)",fontFamily:"var(--f-mono)",background:"rgba(31,168,154,0.1)",padding:"2px 6px",borderRadius:4}}>NEW</div>}
                  </div>
                  <p style={{fontSize:12,lineHeight:1.8,color:"var(--cream-60)",fontStyle:"italic",margin:0}}>"{t.quote}"</p>
                </div>
              ))}
            </div>
            {/* Fade edges */}
            <div style={{position:"absolute",top:0,left:0,bottom:0,width:40,background:"linear-gradient(90deg,var(--midnight),transparent)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",top:0,right:0,bottom:0,width:40,background:"linear-gradient(-90deg,var(--midnight),transparent)",pointerEvents:"none"}}/>
          </div>

          {/* Share your story CTA */}
          <TestimonialForm/>
        </div>
      </section>

      <section style={{padding:"80px 0",textAlign:"center"}}>
        <div className="cx-sm">
          <div className="mono fu" style={{marginBottom:16}}>Free to start · No card needed</div>
          <h2 className="d2 fu1" style={{marginBottom:20}}>One minute.<br/>Infinite clarity.</h2>
          <p className="body fu2" style={{marginBottom:32,color:"var(--cream-60)"}}>Answer honestly. We do the rest. You deserve to finally understand what's actually going on in your life — and what to do next.</p>
          <button className="btn btn-gold btn-lg fu3" onClick={onStart}>Start for free</button>
        </div>
      </section>
      <div className="disc">DestinIQ is a personal clarity and life strategy platform. Everything here is meant to help you think — not to replace a doctor, lawyer, or financial advisor. Use it as a trusted friend who's done their homework.</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTAKE
// ═══════════════════════════════════════════════════════════════════════════════
function Intake({onSubmit}){
  const TOTAL=6;
  const [step,setStep]=useState(1);
  const [animating,setAnimating]=useState(false);
  const [direction,setDirection]=useState("forward");
  const [f,setF]=useState({
    name:"",age:"",gender:"",country:"",relationship:"",income:"",
    education:"",career:"",skills:"",habits:"",goals:"",challenge:"",
    situation:"",bigGoal:"",wantFrom:""
  });
  const [err,setErr]=useState("");
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const SITUATIONS=[
    {id:"employed",icon:"💼",label:"Employed",sub:"Working for someone else"},
    {id:"selfemployed",icon:"🚀",label:"Self-employed",sub:"Running my own thing"},
    {id:"student",icon:"📚",label:"Student",sub:"Still in school or university"},
    {id:"unemployed",icon:"🔍",label:"Job seeking",sub:"Looking for opportunities"},
    {id:"freelance",icon:"💻",label:"Freelancer",sub:"Project to project"},
    {id:"business",icon:"🏢",label:"Business owner",sub:"I have a team"},
  ];

  const BIG_GOALS=[
    {id:"relocate",icon:"✈️",label:"Move abroad",sub:"Start fresh in a new country"},
    {id:"business",icon:"🏗️",label:"Build a business",sub:"Create something of my own"},
    {id:"career",icon:"📈",label:"Level up my career",sub:"Better role, better pay"},
    {id:"financial",icon:"💰",label:"Financial freedom",sub:"Money working for me"},
    {id:"personal",icon:"🌱",label:"Personal growth",sub:"Become my best self"},
    {id:"family",icon:"🏡",label:"Provide for family",sub:"Security and stability"},
  ];

  const WANT_FROM=[
    {id:"plan",icon:"🗺️",label:"A real plan",sub:"Step-by-step roadmap"},
    {id:"accountability",icon:"🔥",label:"Accountability",sub:"Keep me on track daily"},
    {id:"clarity",icon:"🔮",label:"Clarity",sub:"Help me figure out what I want"},
    {id:"insights",icon:"💡",label:"Insights",sub:"Data and trends about my path"},
    {id:"all",icon:"⚡",label:"All of it",sub:"Give me everything"},
  ];

  const validate=()=>{
    if(step===1&&!f.name.trim()) return "Please enter your name.";
    if(step===2&&(!f.age||parseInt(f.age)<13||parseInt(f.age)>99)) return "Please enter a valid age.";
    if(step===2&&!f.country.trim()) return "Please enter your country.";
    if(step===3&&!f.situation) return "Please select your current situation.";
    if(step===4&&!f.bigGoal) return "Please select your main goal.";
    if(step===5&&!f.goals.trim()) return "Please describe what you want.";
    if(step===5&&!f.challenge.trim()) return "Please describe your challenge.";
    if(step===6&&!f.wantFrom) return "Please select what you want from DestinIQ.";
    return "";
  };

  const goTo=(nextStep)=>{
    const e=validate();
    if(e){setErr(e);return;}
    setErr("");
    setDirection(nextStep>step?"forward":"back");
    setAnimating(true);
    setTimeout(()=>{
      setStep(nextStep);
      setAnimating(false);
    },220);
  };

  const next=()=>{
    if(step<TOTAL) goTo(step+1);
    else{
      const e=validate();
      if(e){setErr(e);return;}
      // Map new fields onto the shape the rest of the app expects
      const combined={
        ...f,
        career: f.career||(f.situation?SITUATIONS.find(s=>s.id===f.situation)?.label:""),
        goals: f.goals||(f.bigGoal?BIG_GOALS.find(g=>g.id===f.bigGoal)?.label:""),
      };
      onSubmit(combined);
    }
  };
  const back=()=>{ if(step>1) goTo(step-1); };

  const prog=(step/TOTAL)*100;

  const cardStyle={
    background:"var(--night)",border:"1px solid var(--cream-10)",borderRadius:20,
    padding:"32px 28px",
    opacity:animating?0:1,
    transform:animating?(direction==="forward"?"translateX(30px)":"translateX(-30px)"):"translateX(0)",
    transition:"opacity 0.22s ease, transform 0.22s ease",
  };

  const optionStyle=(selected)=>({
    display:"flex",alignItems:"center",gap:14,padding:"14px 16px",
    borderRadius:14,border:`1.5px solid ${selected?"var(--gold)":"var(--cream-10)"}`,
    background:selected?"rgba(var(--gold-rgb,212,175,55),0.08)":"transparent",
    cursor:"pointer",transition:"all 0.18s",marginBottom:10,
  });

  const greetings=["Hey","Hi","Hello","Hey there"];
  const greeting=greetings[f.name.length%greetings.length]||"Hey";

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"80px 20px 40px"}}>
      <div style={{width:"100%",maxWidth:560}}>

        {/* Progress bar */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:12,color:"var(--cream-30)",fontFamily:"var(--f-mono)",letterSpacing:".08em"}}>STEP {step} OF {TOTAL}</span>
            <span style={{fontSize:12,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>{Math.round(prog)}%</span>
          </div>
          <div style={{height:4,background:"var(--cream-10)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",background:"var(--gold)",borderRadius:99,width:`${prog}%`,transition:"width 0.4s cubic-bezier(.4,0,.2,1)"}}/>
          </div>
        </div>

        <div style={cardStyle}>

          {/* STEP 1 — Name */}
          {step===1&&(
            <div>
              <div style={{fontSize:13,color:"var(--gold)",fontWeight:600,marginBottom:8,letterSpacing:".05em"}}>WELCOME TO DESTINIQ</div>
              <h2 style={{fontSize:26,fontWeight:800,color:"var(--cream)",marginBottom:8,lineHeight:1.2}}>Let's start with your name.</h2>
              <p style={{fontSize:14,color:"var(--cream-50)",marginBottom:28,lineHeight:1.6}}>This isn't just a form. What you share here shapes a plan built entirely around you.</p>
              <div style={{marginBottom:20}}>
                <label style={{fontSize:12,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:8}}>FULL NAME</label>
                <input
                  autoFocus
                  style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"15px 18px",color:"var(--cream)",fontSize:18,fontWeight:600,outline:"none",boxSizing:"border-box",letterSpacing:".01em"}}
                  placeholder="Type your name…"
                  value={f.name}
                  onChange={e=>set("name",e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&next()}
                  maxLength={60}
                />
              </div>
              {f.name.trim()&&<p style={{fontSize:13,color:"var(--cream-40)",marginBottom:4}}>Nice to meet you, <strong style={{color:"var(--cream)"}}>{f.name}</strong> 👋</p>}
            </div>
          )}

          {/* STEP 2 — Age, Country, Gender */}
          {step===2&&(
            <div>
              <div style={{fontSize:13,color:"var(--gold)",fontWeight:600,marginBottom:8,letterSpacing:".05em"}}>{greeting.toUpperCase()}, {f.name.toUpperCase()}!</div>
              <h2 style={{fontSize:24,fontWeight:800,color:"var(--cream)",marginBottom:8,lineHeight:1.2}}>Tell us a little about yourself.</h2>
              <p style={{fontSize:14,color:"var(--cream-50)",marginBottom:24,lineHeight:1.6}}>Where you are right now shapes where you can go.</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div>
                  <label style={{fontSize:12,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:8}}>AGE</label>
                  <input style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:"var(--cream)",fontSize:15,outline:"none",boxSizing:"border-box"}} type="number" min="13" max="99" placeholder="e.g. 24" value={f.age} onChange={e=>set("age",e.target.value)}/>
                </div>
                <div>
                  <label style={{fontSize:12,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:8}}>GENDER</label>
                  <select style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:f.gender?"var(--cream)":"var(--cream-30)",fontSize:15,outline:"none",boxSizing:"border-box"}} value={f.gender} onChange={e=>set("gender",e.target.value)}>
                    <option value="">Select…</option><option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:8}}>COUNTRY</label>
                <input style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:"var(--cream)",fontSize:15,outline:"none",boxSizing:"border-box"}} placeholder="e.g. Ghana" value={f.country} onChange={e=>set("country",e.target.value)} maxLength={60}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div>
                  <label style={{fontSize:12,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:8}}>RELATIONSHIP</label>
                  <select style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:f.relationship?"var(--cream)":"var(--cream-30)",fontSize:14,outline:"none",boxSizing:"border-box"}} value={f.relationship} onChange={e=>set("relationship",e.target.value)}>
                    <option value="">Select…</option><option>Single</option><option>In a relationship</option><option>Engaged</option><option>Married</option><option>Divorced</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:8}}>MONTHLY INCOME</label>
                  <select style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:f.income?"var(--cream)":"var(--cream-30)",fontSize:14,outline:"none",boxSizing:"border-box"}} value={f.income} onChange={e=>set("income",e.target.value)}>
                    <option value="">Select…</option><option>Under $500</option><option>$500–$1,500</option><option>$1,500–$4,000</option><option>$4,000–$10,000</option><option>$10,000+</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Current situation */}
          {step===3&&(
            <div>
              <div style={{fontSize:13,color:"var(--gold)",fontWeight:600,marginBottom:8,letterSpacing:".05em"}}>YOUR CURRENT REALITY</div>
              <h2 style={{fontSize:24,fontWeight:800,color:"var(--cream)",marginBottom:8,lineHeight:1.2}}>What does your life look like right now?</h2>
              <p style={{fontSize:14,color:"var(--cream-50)",marginBottom:24,lineHeight:1.6}}>No judgement here. We just need to know where you're starting from.</p>
              {SITUATIONS.map(s=>(
                <div key={s.id} style={optionStyle(f.situation===s.id)} onClick={()=>set("situation",s.id)}>
                  <span style={{fontSize:24}}>{s.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--cream)"}}>{s.label}</div>
                    <div style={{fontSize:12,color:"var(--cream-40)"}}>{s.sub}</div>
                  </div>
                  {f.situation===s.id&&<div style={{width:20,height:20,borderRadius:"50%",background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#000",fontWeight:700}}>✓</div>}
                </div>
              ))}
              {(f.situation==="employed"||f.situation==="selfemployed"||f.situation==="business")&&(
                <div style={{marginTop:14}}>
                  <label style={{fontSize:12,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:8}}>BRIEFLY DESCRIBE YOUR WORK</label>
                  <textarea style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:"var(--cream)",fontSize:14,outline:"none",boxSizing:"border-box",resize:"none"}} rows={2} maxLength={300} placeholder="e.g. Sales rep at a telecoms company, $600/month" value={f.career} onChange={e=>set("career",e.target.value)}/>
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — Big goal */}
          {step===4&&(
            <div>
              <div style={{fontSize:13,color:"var(--gold)",fontWeight:600,marginBottom:8,letterSpacing:".05em"}}>YOUR AMBITION</div>
              <h2 style={{fontSize:24,fontWeight:800,color:"var(--cream)",marginBottom:8,lineHeight:1.2}}>What's the big thing you're working towards?</h2>
              <p style={{fontSize:14,color:"var(--cream-50)",marginBottom:24,lineHeight:1.6}}>Pick the one that feels most like you right now.</p>
              {BIG_GOALS.map(g=>(
                <div key={g.id} style={optionStyle(f.bigGoal===g.id)} onClick={()=>set("bigGoal",g.id)}>
                  <span style={{fontSize:24}}>{g.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--cream)"}}>{g.label}</div>
                    <div style={{fontSize:12,color:"var(--cream-40)"}}>{g.sub}</div>
                  </div>
                  {f.bigGoal===g.id&&<div style={{width:20,height:20,borderRadius:"50%",background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#000",fontWeight:700}}>✓</div>}
                </div>
              ))}
            </div>
          )}

          {/* STEP 5 — Goals & Challenge */}
          {step===5&&(
            <div>
              <div style={{fontSize:13,color:"var(--gold)",fontWeight:600,marginBottom:8,letterSpacing:".05em"}}>THE REAL TALK</div>
              <h2 style={{fontSize:24,fontWeight:800,color:"var(--cream)",marginBottom:8,lineHeight:1.2}}>In your own words, {f.name}.</h2>
              <p style={{fontSize:14,color:"var(--cream-50)",marginBottom:24,lineHeight:1.6}}>This is the most important part. The more honest you are, the more powerful your report will be.</p>
              <div style={{marginBottom:18}}>
                <label style={{fontSize:12,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:8}}>WHAT DO YOU ACTUALLY WANT FROM LIFE?</label>
                <textarea style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:"var(--cream)",fontSize:14,outline:"none",boxSizing:"border-box",resize:"none",lineHeight:1.6}} rows={3} maxLength={600} placeholder={`Don't filter yourself. Financial freedom, moving to ${f.country==="Ghana"?"Europe":"another country"}, a business, feeling less stuck — whatever it honestly is.`} value={f.goals} onChange={e=>set("goals",e.target.value)}/>
                <div style={{textAlign:"right",fontSize:11,color:"var(--cream-20)",marginTop:4}}>{f.goals.length}/600</div>
              </div>
              <div>
                <label style={{fontSize:12,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:8}}>WHAT'S ACTUALLY GETTING IN THE WAY?</label>
                <textarea style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:"var(--cream)",fontSize:14,outline:"none",boxSizing:"border-box",resize:"none",lineHeight:1.6}} rows={3} maxLength={600} placeholder="What keeps coming back no matter what you try? Money, time, fear, family pressure, no connections — be real." value={f.challenge} onChange={e=>set("challenge",e.target.value)}/>
                <div style={{textAlign:"right",fontSize:11,color:"var(--cream-20)",marginTop:4}}>{f.challenge.length}/600</div>
              </div>
              <div style={{marginTop:16,padding:"14px 16px",background:"rgba(20,184,166,0.06)",border:"1px solid rgba(20,184,166,0.15)",borderRadius:12}}>
                <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.7,margin:0}}><strong style={{color:"var(--teal)"}}>This matters most.</strong> People who are honest here get reports that actually change how they see their future. You're not being judged — you're being understood.</p>
              </div>
            </div>
          )}

          {/* STEP 6 — What they want from DestinIQ + launch */}
          {step===6&&(
            <div>
              <div style={{fontSize:13,color:"var(--gold)",fontWeight:600,marginBottom:8,letterSpacing:".05em"}}>ALMOST THERE</div>
              <h2 style={{fontSize:24,fontWeight:800,color:"var(--cream)",marginBottom:8,lineHeight:1.2}}>What do you want DestinIQ to do for you?</h2>
              <p style={{fontSize:14,color:"var(--cream-50)",marginBottom:24,lineHeight:1.6}}>We'll shape your experience around this.</p>
              {WANT_FROM.map(w=>(
                <div key={w.id} style={optionStyle(f.wantFrom===w.id)} onClick={()=>set("wantFrom",w.id)}>
                  <span style={{fontSize:24}}>{w.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--cream)"}}>{w.label}</div>
                    <div style={{fontSize:12,color:"var(--cream-40)"}}>{w.sub}</div>
                  </div>
                  {f.wantFrom===w.id&&<div style={{width:20,height:20,borderRadius:"50%",background:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#000",fontWeight:700}}>✓</div>}
                </div>
              ))}
              {f.wantFrom&&(
                <div style={{marginTop:16,padding:"16px",background:"rgba(212,175,55,0.06)",border:"1px solid rgba(212,175,55,0.15)",borderRadius:12,textAlign:"center"}}>
                  <div style={{fontSize:22,marginBottom:6}}>🚀</div>
                  <p style={{fontSize:14,color:"var(--cream-60)",lineHeight:1.6,margin:0}}>You're ready, <strong style={{color:"var(--cream)"}}>{f.name}</strong>. We're about to build your personal report. This takes about 30 seconds.</p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {err&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:10,padding:"10px 14px",marginTop:16,fontSize:13,color:"#F87171"}}>⚠ {err}</div>}

          {/* Navigation */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:24}}>
            {step>1
              ?<button onClick={back} style={{background:"none",border:"1px solid var(--cream-15)",borderRadius:10,padding:"10px 18px",color:"var(--cream-50)",fontSize:14,cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.color="var(--cream)"} onMouseLeave={e=>e.currentTarget.style.color="var(--cream-50)"}>← Back</button>
              :<div/>
            }
            <button
              onClick={next}
              style={{background:"var(--gold)",border:"none",borderRadius:10,padding:"12px 28px",color:"#000",fontSize:15,fontWeight:700,cursor:"pointer",transition:"all .2s",boxShadow:"0 4px 20px rgba(212,175,55,0.25)"}}
              onMouseEnter={e=>e.currentTarget.style.transform="translateY(-1px)"}
              onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}
            >
              {step<TOTAL?"Continue →":"Generate My Report ✨"}
            </button>
          </div>
        </div>

        {/* Step dots */}
        <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:20}}>
          {Array.from({length:TOTAL},(_,i)=>(
            <div key={i} style={{width:i+1===step?20:6,height:6,borderRadius:99,background:i+1<=step?"var(--gold)":"var(--cream-10)",transition:"all .3s"}}/>
          ))}
        </div>

      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// LOADING
// ═══════════════════════════════════════════════════════════════════════════════
function Loading(){
  const [s,setS]=useState(0);const [pct,setPct]=useState(0);
  useEffect(()=>{
    const t1=setInterval(()=>setS(p=>Math.min(p+1,LOADING_PHRASES.length-1)),950);
    const t2=setInterval(()=>setPct(p=>Math.min(p+Math.random()*12,96)),400);
    return()=>{clearInterval(t1);clearInterval(t2);};
  },[]);
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"40px 24px"}}>
      <div className="mono fu" style={{marginBottom:24}}>We're reading your story carefully</div>
      <div className="d3 fu1" style={{marginBottom:12,fontWeight:300}}>Putting it all together for you</div>
      <p className="small fu2" style={{marginBottom:48}}>This takes a moment because it's actually thinking — not just filling in a template.</p>
      <div style={{width:280,marginBottom:36}}>
        <div className="pbar"><div className="pfill" style={{width:`${pct}%`}}/></div>
        <div style={{marginTop:10,fontFamily:"var(--f-mono)",fontSize:9,letterSpacing:".12em",color:"var(--cream-30)"}}>{Math.round(pct)}% · {LOADING_PHRASES[s]}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"center"}}>
        {LOADING_PHRASES.map((p,i)=>(
          <div key={p} style={{fontSize:13,color:i<s?"var(--cream-30)":i===s?"var(--gold)":"rgba(237,232,216,0.12)",transition:"color .4s",display:"flex",alignItems:"center",gap:8}}>
            <span>{i<s?"✓":i===s?"→":"·"}</span>{p}
          </div>
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// RELOCATION EXPLORER — Universal country picker with deep AI-generated reports
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN — Premium redesign
// ═══════════════════════════════════════════════════════════════════════════════
function AuthScreen({onAuth}){
  const [mode,setMode]=useState("login"); // login | signup | forgot | forgot_sent | reset
  const [tab,setTab]=useState("email");   // email | phone
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [otp,setOtp]=useState(["","","","","",""]);
  const [otpSent,setOtpSent]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [showPass,setShowPass]=useState(false);
  const [newPassword,setNewPassword]=useState("");
  const [showNewPass,setShowNewPass]=useState(false);
  const otpRefs=[useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];

  // Detect password-reset redirect from email link
  useEffect(()=>{
    if(typeof window!=="undefined"&&window.location.search.includes("reset=true")){
      setMode("reset");
      // Clean up the URL
      window.history.replaceState({},"",window.location.pathname);
    }
  },[]);

  // ── EMAIL / PASSWORD AUTH ────────────────────────────────────────────────
  const handleEmail=async()=>{
    if(!email.trim()||!password.trim()){setError("Please fill in all fields.");return;}
    if(mode==="signup"&&!name.trim()){setError("Please enter your name.");return;}
    if(password.length<6){setError("Password must be at least 6 characters.");return;}
    setLoading(true);setError("");
    try{
      if(mode==="signup"){
        const{data,error:err}=await supabase.auth.signUp({
          email:email.trim(),
          password,
          options:{data:{name:name.trim()}},
        });
        if(err) throw err;
        if(data.user&&!data.session){
          setError("✉ Check your inbox — we sent a confirmation link. Click it, then come back and sign in.");
          setLoading(false);return;
        }
        if(data.user) onAuth({id:data.user.id,email:data.user.email,name:name.trim(),provider:"email"});
      } else {
        const{data,error:err}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(err) throw err;
        const meta=data.user.user_metadata||{};
        onAuth({id:data.user.id,email:data.user.email,name:meta.name||email.trim().split("@")[0],provider:"email"});
      }
    }catch(e){setError(e.message||"Authentication failed.");}
    setLoading(false);
  };

  // ── PHONE / OTP AUTH ─────────────────────────────────────────────────────
  const handleSendOTP=async()=>{
    if(!phone.trim()){setError("Please enter your phone number.");return;}
    setLoading(true);setError("");
    try{
      const{error:err}=await supabase.auth.signInWithOtp({phone:phone.trim()});
      if(err) throw err;
      setOtpSent(true);
      setTimeout(()=>otpRefs[0].current?.focus(),100);
    }catch(e){setError(e.message||"Failed to send code. Check the number and try again.");}
    setLoading(false);
  };

  const handleVerifyOTP=async()=>{
    const code=otp.join("");
    if(code.length<6){setError("Please enter the 6-digit code.");return;}
    setLoading(true);setError("");
    try{
      const{data,error:err}=await supabase.auth.verifyOtp({phone:phone.trim(),token:code,type:"sms"});
      if(err) throw err;
      const u=data.user;
      onAuth({id:u.id,phone:u.phone,name:"User",provider:"phone"});
    }catch(e){setError(e.message||"Incorrect code. Try again.");}
    setLoading(false);
  };

  // ── GOOGLE OAUTH ─────────────────────────────────────────────────────────
  const handleGoogle=async()=>{
    setLoading(true);setError("");
    const{error:err}=await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:window.location.origin},
    });
    if(err){setError(err.message);setLoading(false);}
    // On success the page redirects; onAuthStateChange in the root picks up the session.
  };

  // ── FORGOT PASSWORD ────────────────────────────────────────────────────
  const handleForgot=async()=>{
    if(!email.trim()){setError("Enter your email address first.");return;}
    setLoading(true);setError("");
    try{
      const{error:err}=await supabase.auth.resetPasswordForEmail(email.trim(),{
        redirectTo:window.location.origin+"?reset=true",
      });
      if(err) throw err;
      setMode("forgot_sent");
    }catch(e){setError(e.message||"Failed to send reset email.");}
    setLoading(false);
  };

  // ── RESET PASSWORD (after redirect back) ────────────────────────────────
  const handleReset=async()=>{
    if(newPassword.length<6){setError("Password must be at least 6 characters.");return;}
    setLoading(true);setError("");
    try{
      const{error:err}=await supabase.auth.updateUser({password:newPassword});
      if(err) throw err;
      setMode("login");setError("");
      setNewPassword("");
      // Session is already active after reset — trigger onAuth
      const{data:{session}}=await supabase.auth.getSession();
      if(session?.user){
        const u=session.user;
        const meta=u.user_metadata||{};
        onAuth({id:u.id,email:u.email,name:meta.name||meta.full_name||(u.email?.split("@")[0])||"User",provider:"email"});
      }
    }catch(e){setError(e.message||"Failed to update password.");}
    setLoading(false);
  };

  const handleOTPInput=(i,val)=>{
    if(!/^\d*$/.test(val)) return;
    const next=[...otp]; next[i]=val.slice(-1);
    setOtp(next);
    if(val&&i<5) otpRefs[i+1].current?.focus();
  };

  const handleOTPKey=(i,e)=>{
    if(e.key==="Backspace"&&!otp[i]&&i>0) otpRefs[i-1].current?.focus();
  };

  const btnStyle={width:"100%",padding:"14px",borderRadius:12,border:"1px solid var(--cream-15)",background:"var(--night)",color:"var(--cream)",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all 0.2s",marginBottom:10};
  const inputStyle={width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:"var(--cream)",fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:12};

  // ── FORGOT PASSWORD SCREEN ────────────────────────────────────────────────
  if(mode==="forgot"){
    return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{width:"100%",maxWidth:420}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:28,fontWeight:800,color:"var(--cream)",marginBottom:8}}>Destin<b style={{color:"var(--gold)"}}>IQ</b></div>
            <div style={{fontSize:15,color:"var(--cream-60)"}}>Reset your password</div>
          </div>
          <div style={{background:"var(--night)",border:"1px solid var(--cream-10)",borderRadius:20,padding:"28px 24px"}}>
            <p style={{fontSize:13,color:"var(--cream-60)",marginBottom:16,lineHeight:1.6}}>Enter the email address on your account and we'll send you a reset link.</p>
            <input style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:"var(--cream)",fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:12}} type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleForgot()}/>
            {error&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#F87171"}}>{error}</div>}
            <button onClick={handleForgot} disabled={loading} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:loading?"var(--cream-15)":"var(--gold)",color:loading?"var(--cream-40)":"#000",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",marginBottom:16}}>{loading?"Sending…":"Send reset link"}</button>
            <div style={{textAlign:"center",fontSize:13}}><span onClick={()=>{setMode("login");setError("");}} style={{color:"var(--cream-40)",cursor:"pointer",textDecoration:"underline"}}>Back to sign in</span></div>
          </div>
        </div>
      </div>
    );
  }

  if(mode==="forgot_sent"){
    return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{width:"100%",maxWidth:420,textAlign:"center"}}>
          <div style={{fontSize:28,fontWeight:800,color:"var(--cream)",marginBottom:8}}>Destin<b style={{color:"var(--gold)"}}>IQ</b></div>
          <div style={{background:"var(--night)",border:"1px solid var(--cream-10)",borderRadius:20,padding:"36px 24px",marginTop:24}}>
            <div style={{fontSize:40,marginBottom:16}}>📬</div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--cream)",marginBottom:12}}>Check your inbox</div>
            <p style={{fontSize:14,color:"var(--cream-60)",lineHeight:1.7,marginBottom:24}}>We sent a password reset link to <b style={{color:"var(--cream)"}}>{email}</b>. Click the link in the email to set a new password.</p>
            <span onClick={()=>{setMode("login");setError("");}} style={{color:"var(--gold)",cursor:"pointer",fontWeight:600,fontSize:14}}>Back to sign in</span>
          </div>
        </div>
      </div>
    );
  }

  if(mode==="reset"){
    return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{width:"100%",maxWidth:420}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:28,fontWeight:800,color:"var(--cream)",marginBottom:8}}>Destin<b style={{color:"var(--gold)"}}>IQ</b></div>
            <div style={{fontSize:15,color:"var(--cream-60)"}}>Set a new password</div>
          </div>
          <div style={{background:"var(--night)",border:"1px solid var(--cream-10)",borderRadius:20,padding:"28px 24px"}}>
            <div style={{position:"relative",marginBottom:12}}>
              <input style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 44px 13px 16px",color:"var(--cream)",fontSize:14,outline:"none",boxSizing:"border-box"}} type={showNewPass?"text":"password"} placeholder="New password (min 6 characters)" value={newPassword} onChange={e=>setNewPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleReset()}/>
              <button onClick={()=>setShowNewPass(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--cream-30)",cursor:"pointer",fontSize:13}}>{showNewPass?"Hide":"Show"}</button>
            </div>
            {error&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#F87171"}}>{error}</div>}
            <button onClick={handleReset} disabled={loading} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:loading?"var(--cream-15)":"var(--gold)",color:loading?"var(--cream-40)":"#000",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer"}}>{loading?"Updating…":"Update password"}</button>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{width:"100%",maxWidth:420}}>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:28,fontWeight:800,letterSpacing:"-0.5px",color:"var(--cream)",marginBottom:8}}>
            Destin<b style={{color:"var(--gold)"}}>IQ</b>
          </div>
          <div style={{fontSize:15,color:"var(--cream-60)"}}>
            {mode==="signup"?"Create your account":"Welcome back"}
          </div>
        </div>

        {/* Card */}
        <div style={{background:"var(--night)",border:"1px solid var(--cream-10)",borderRadius:20,padding:"28px 24px"}}>

          {/* Google OAuth */}
          <button style={{...btnStyle}} onClick={handleGoogle} disabled={loading}
            onMouseEnter={e=>e.currentTarget.style.background="var(--midnight)"}
            onMouseLeave={e=>e.currentTarget.style.background="var(--night)"}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"4px 0 16px"}}>
            <div style={{flex:1,height:1,background:"var(--cream-10)"}}/>
            <span style={{fontSize:12,color:"var(--cream-30)"}}>or</span>
            <div style={{flex:1,height:1,background:"var(--cream-10)"}}/>
          </div>

          {/* Email / Phone tabs */}
          <div style={{display:"flex",background:"var(--midnight)",borderRadius:10,padding:3,gap:3,marginBottom:20}}>
            {["email","phone"].map(t=>(
              <button key={t} onClick={()=>{setTab(t);setError("");setOtpSent(false);setOtp(["","","","","",""]);}}
                style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,
                  background:tab===t?"var(--night)":"transparent",
                  color:tab===t?"var(--cream)":"var(--cream-30)",transition:"all .2s"}}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>

          {/* Name field (signup only) */}
          {tab==="email"&&mode==="signup"&&(
            <input style={{...inputStyle}} placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}/>
          )}

          {/* Email fields */}
          {tab==="email"&&(
            <>
              <input style={{...inputStyle}} type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmail()}/>
              <div style={{position:"relative",marginBottom:12}}>
                <input style={{...inputStyle,marginBottom:0,paddingRight:44}} type={showPass?"text":"password"} placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmail()}/>
                <button onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--cream-30)",cursor:"pointer",fontSize:13}}>{showPass?"Hide":"Show"}</button>
              </div>
            </>
          )}

          {/* Phone fields */}
          {tab==="phone"&&!otpSent&&(
            <input style={{...inputStyle}} type="tel" placeholder="+1 234 567 8900" value={phone} onChange={e=>setPhone(e.target.value)}/>
          )}

          {/* OTP input */}
          {tab==="phone"&&otpSent&&(
            <div>
              <p style={{fontSize:13,color:"var(--cream-60)",marginBottom:14,textAlign:"center"}}>Enter the 6-digit code sent to {phone}</p>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:14}}>
                {otp.map((v,i)=>(
                  <input key={i} ref={otpRefs[i]} value={v}
                    onChange={e=>handleOTPInput(i,e.target.value)}
                    onKeyDown={e=>handleOTPKey(i,e)}
                    maxLength={1} type="text" inputMode="numeric"
                    style={{width:44,height:52,textAlign:"center",fontSize:20,fontWeight:700,background:"var(--midnight)",border:`1px solid ${v?"var(--gold)":"var(--cream-15)"}`,borderRadius:10,color:"var(--cream)",outline:"none"}}/>
                ))}
              </div>
              <div style={{textAlign:"center",marginBottom:8}}>
                <span onClick={()=>{setOtpSent(false);setOtp(["","","","","",""]);}} style={{fontSize:12,color:"var(--gold)",cursor:"pointer"}}>Change number</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#F87171"}}>{error}</div>}

          {/* Main CTA button */}
          <button onClick={tab==="email"?handleEmail:otpSent?handleVerifyOTP:handleSendOTP}
            disabled={loading}
            style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:loading?"var(--cream-15)":"var(--gold)",color:loading?"var(--cream-40)":"#000",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",transition:"all 0.2s",marginBottom:16}}>
            {loading?"One moment…":
             tab==="phone"&&!otpSent?"Send verification code":
             tab==="phone"&&otpSent?"Verify & continue":
             mode==="login"?"Sign in":"Create account"}
          </button>

          {/* Toggle login/signup + forgot password */}
          {mode==="login"&&(
            <div style={{textAlign:"center",fontSize:13,color:"var(--cream-50)"}}>
              <>Don't have an account?{" "}
                <span onClick={()=>{setMode("signup");setError("");}} style={{color:"var(--gold)",cursor:"pointer",fontWeight:600}}>Sign up free</span>
              </>
            </div>
          )}
          {mode==="signup"&&(
            <div style={{textAlign:"center",fontSize:13,color:"var(--cream-50)"}}>
              <>Already have an account?{" "}
                <span onClick={()=>{setMode("login");setError("");}} style={{color:"var(--gold)",cursor:"pointer",fontWeight:600}}>Sign in</span>
              </>
            </div>
          )}
          {mode==="login"&&tab==="email"&&(
            <div style={{textAlign:"center",marginTop:10,fontSize:13}}>
              <span onClick={()=>{setMode("forgot");setError("");}} style={{color:"var(--cream-40)",cursor:"pointer",textDecoration:"underline"}}>Forgot password?</span>
            </div>
          )}
        </div>

        <div style={{textAlign:"center",marginTop:20,fontSize:11,color:"var(--cream-30)"}}>
          By continuing you agree to our{" "}
          <span onClick={()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:"terms"}))} style={{color:"var(--cream-50)",cursor:"pointer",textDecoration:"underline"}}>Terms of Service</span>
          {" "}and{" "}
          <span onClick={()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:"privacy"}))} style={{color:"var(--cream-50)",cursor:"pointer",textDecoration:"underline"}}>Privacy Policy</span>
        </div>
      </div>
    </div>
  );
}

// ── FORGOT PASSWORD SCREENS (rendered inside AuthScreen return) ─────────────
// These replace the main card when mode is "forgot", "forgot_sent", or "reset".


function RelocationExplorer({suggestedCountries, formData, userId, isPremium, isPaid, onUnlock}){
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [customReport, setCustomReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const [view, setView] = useState("suggested"); // "suggested" | "custom"
  const filtered = WORLD_COUNTRIES.filter(c=>c.toLowerCase().includes(search.toLowerCase()) && c.toLowerCase()!==(formData.country||"").toLowerCase()).slice(0,8);

  const generateReport = async(country, attempt=1)=>{
    setLoading(true); setCustomReport(null); setSelected(country); setView("custom");
    try{
      const sys = "You are a relocation expert. Return ONLY valid JSON — no markdown, no code fences, no text outside the JSON object.";
      const prompt = buildSingleCountryRelocationPrompt(formData, country, isPremium);
      const raw = await callAPI({messages:[{role:"user",content:prompt}], system:sys, userId, isPremium});
      const clean = raw.replace(/```json|```/g,"").trim();
      const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
      if(start===-1||end===-1) throw new Error("Invalid JSON response");
      const parsed = JSON.parse(clean.slice(start, end+1));
      if(!parsed.country) parsed.country = country;
      setCustomReport(parsed);
    } catch(e){
      console.warn(`Relocation report failed (attempt ${attempt}):`, e.message);
      if(attempt < 2){
        // Auto retry once
        setTimeout(()=>generateReport(country, attempt+1), 1500);
        return;
      }
      setCustomReport({
        country,
        fit: 0,
        tagline: `Tap to retry loading the ${country} report.`,
        overview: "",
        pros: [],
        cons: [],
        business: "",
        living: "",
        visa_detail: "",
        opportunity: 0,
        cost: "",
        visa: "",
        timeline: "",
        verdict: "",
        error: true,
      });
    }
    setLoading(false);
  };

  const RelocCard = ({r, idx})=>{
    const [open, setOpen] = useState(false);
    const fitColor = r.fit>=75?"#4ADE80":r.fit>=55?"#FCD34D":"#F87171";
    if(r.error) return(
      <div style={{background:"var(--night)",borderRadius:16,border:"1px solid var(--cream-10)",marginBottom:16,padding:"20px",textAlign:"center"}}>
        <div style={{fontSize:14,color:"var(--cream-50)",marginBottom:12}}>Couldn't load the {r.country} report.</div>
        <button onClick={()=>generateReport(r.country)} style={{background:"var(--gold)",border:"none",borderRadius:10,padding:"10px 20px",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>Try again</button>
      </div>
    );
    return (
      <div style={{background:"var(--night)",borderRadius:16,border:"1px solid var(--cream-10)",marginBottom:16,overflow:"hidden"}}>
        <div onClick={()=>setOpen(!open)} style={{padding:"18px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:52,height:52,borderRadius:12,background:"var(--midnight)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <div style={{fontSize:18,fontWeight:800,color:fitColor,lineHeight:1}}>{r.fit||"—"}</div>
            <div style={{fontSize:8,color:"var(--cream-40)",marginTop:1,letterSpacing:"0.05em"}}>FIT</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:15,color:"var(--cream)",marginBottom:3}}>{r.country}</div>
            <div style={{fontSize:12,color:"var(--cream-60)",lineHeight:1.4}}>{r.tagline}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
            {r.visa&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:r.visa==="easy"?"rgba(74,222,128,0.15)":r.visa==="moderate"?"rgba(252,211,77,0.15)":"rgba(248,113,113,0.15)",color:r.visa==="easy"?"#4ADE80":r.visa==="moderate"?"#FCD34D":"#F87171"}}>Visa: {r.visa}</span>}
            {r.cost&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(255,255,255,0.06)",color:"var(--cream-60)"}}>Cost: {r.cost}</span>}
          </div>
        </div>
        {open&&(
          <div style={{padding:"0 20px 20px",borderTop:"1px solid var(--cream-10)"}}>
            <div style={{paddingTop:16}}>
              {r.overview&&<p style={{fontSize:13,color:"var(--cream-80)",lineHeight:1.75,marginBottom:16}}>{r.overview}</p>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                <div style={{background:"rgba(74,222,128,0.07)",borderRadius:12,padding:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#4ADE80",marginBottom:8,letterSpacing:"0.08em"}}>WHY IT WORKS</div>
                  {(r.pros||[]).map((p,i)=><div key={i} style={{fontSize:12,color:"var(--cream-70)",marginBottom:6,lineHeight:1.6,paddingLeft:10,borderLeft:"2px solid rgba(74,222,128,0.3)"}}>✓ {p}</div>)}
                </div>
                <div style={{background:"rgba(248,113,113,0.07)",borderRadius:12,padding:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#F87171",marginBottom:8,letterSpacing:"0.08em"}}>BE READY FOR</div>
                  {(r.cons||[]).map((c,i)=><div key={i} style={{fontSize:12,color:"var(--cream-70)",marginBottom:6,lineHeight:1.6,paddingLeft:10,borderLeft:"2px solid rgba(248,113,113,0.3)"}}>! {c}</div>)}
                </div>
              </div>
              {r.living&&<div style={{background:"var(--midnight)",borderRadius:12,padding:14,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--cream-40)",marginBottom:8,letterSpacing:"0.08em"}}>💰 REAL COST OF LIVING</div>
                <p style={{fontSize:12,color:"var(--cream-70)",lineHeight:1.7,margin:0}}>{r.living}</p>
              </div>}
              {r.visa_detail&&<div style={{background:"var(--midnight)",borderRadius:12,padding:14,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--cream-40)",marginBottom:8,letterSpacing:"0.08em"}}>🛂 YOUR VISA PATHWAY</div>
                <p style={{fontSize:12,color:"var(--cream-70)",lineHeight:1.7,margin:0}}>{r.visa_detail}</p>
              </div>}
              {r.business&&<div style={{background:"var(--midnight)",borderRadius:12,padding:14,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--cream-40)",marginBottom:8,letterSpacing:"0.08em"}}>🏢 STARTING A BUSINESS THERE</div>
                <p style={{fontSize:12,color:"var(--cream-70)",lineHeight:1.7,margin:0}}>{r.business}</p>
              </div>}
              {r.timeline&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:14,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--cream-40)",marginBottom:6,letterSpacing:"0.08em"}}>⏱ REALISTIC TIMELINE</div>
                <p style={{fontSize:12,color:"var(--cream-70)",lineHeight:1.6,margin:0}}>{r.timeline}</p>
              </div>}
              {r.verdict&&<div style={{background:"rgba(156,124,255,0.12)",border:"1px solid rgba(156,124,255,0.25)",borderRadius:12,padding:14}}>
                <div style={{fontSize:10,fontWeight:700,color:"#A78BFA",marginBottom:6,letterSpacing:"0.08em"}}>OUR HONEST VERDICT</div>
                <p style={{fontSize:13,color:"var(--cream-80)",lineHeight:1.7,margin:0,fontStyle:"italic"}}>{r.verdict}</p>
              </div>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <LockGate isPaid={isPaid} onUnlock={onUnlock}>
      <div className="fu">
        <div className="d3" style={{marginBottom:6}}>Where in the world could you actually thrive?</div>
        <p className="body" style={{marginBottom:20,color:"var(--cream-60)"}}>
          We matched your profile against countries where someone with your background, skills, and goals tends to break through. 
          But you know your heart better than we do — if there's a specific country on your mind, type it below and we'll give you the full picture.
        </p>

        {/* Country search */}
        <div style={{marginBottom:24,position:"relative"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--cream-40)",letterSpacing:"0.08em",marginBottom:8}}>HAVE A COUNTRY IN MIND?</div>
          <div style={{position:"relative"}}>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder={`Search any country... (you're from ${formData.country||"your country"})`}
              style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"12px 16px",color:"var(--cream)",fontSize:13,outline:"none",boxSizing:"border-box"}}
            />
            {search.length>1&&filtered.length>0&&(
              <div style={{position:"fixed",top:"auto",left:"auto",width:"min(400px,90vw)",background:"var(--night)",border:"1px solid var(--gold)",borderRadius:12,overflow:"auto",maxHeight:280,zIndex:9999,boxShadow:"0 16px 48px rgba(0,0,0,0.8)",marginTop:4}}>
                {filtered.map(c=>(
                  <div key={c} onClick={()=>{setSearch("");generateReport(c);}}
                    style={{padding:"12px 18px",cursor:"pointer",fontSize:14,color:"var(--cream)",borderBottom:"1px solid var(--cream-10)",transition:"background 0.15s",display:"flex",alignItems:"center",justifyContent:"space-between"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--midnight)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  ><span>{c}</span><span style={{color:"var(--gold)",fontSize:12}}>→</span></div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading&&(
          <div style={{textAlign:"center",padding:"40px 20px",background:"var(--night)",borderRadius:16,border:"1px solid var(--cream-10)",marginBottom:20}}>
            <div style={{fontSize:28,marginBottom:12}}>🔍</div>
            <div style={{fontSize:14,color:"var(--cream-60)",marginBottom:6}}>Building your {selected} report…</div>
            <div style={{fontSize:12,color:"var(--cream-40)"}}>Checking visa rules, costs, opportunities, and what it's really like to move there from {formData.country}.</div>
          </div>
        )}

        {/* Tab toggle */}
        {!loading&&customReport&&(
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            <button onClick={()=>setView("custom")} style={{flex:1,padding:"8px 12px",borderRadius:10,border:"none",background:view==="custom"?"var(--violet)":"var(--midnight)",color:view==="custom"?"#fff":"var(--cream-60)",fontSize:12,cursor:"pointer",fontWeight:600}}>
              🌍 {selected}
            </button>
            <button onClick={()=>setView("suggested")} style={{flex:1,padding:"8px 12px",borderRadius:10,border:"none",background:view==="suggested"?"var(--violet)":"var(--midnight)",color:view==="suggested"?"#fff":"var(--cream-60)",fontSize:12,cursor:"pointer",fontWeight:600}}>
              ⭐ Our picks for you
            </button>
          </div>
        )}

        {/* Custom country report */}
        {!loading&&customReport&&view==="custom"&&(
          <RelocCard r={customReport} idx={0} />
        )}

        {/* Suggested countries */}
        {(view==="suggested"||!customReport)&&!loading&&(
          <>
            {(!customReport)&&<div style={{fontSize:11,fontWeight:700,color:"var(--cream-40)",letterSpacing:"0.08em",marginBottom:12}}>OUR PICKS BASED ON YOUR PROFILE</div>}
            {(suggestedCountries||[]).map((r,i)=><RelocCard key={r.country||i} r={r} idx={i} />)}
          </>
        )}

        <div className="insight teal" style={{marginTop:8}}>
          <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75}}>
            Visa rules shift often — always verify the latest requirements on the official embassy or government immigration website before making any decisions. 
            We'll give you the map; the journey is yours to walk.
          </p>
        </div>
      </div>
    </LockGate>
  );
}


function Dashboard({data,formData,isPaid,onUnlock,streak,showCheckin,setShowCheckin,userId,isPremium,ipLocation}){
  const [mod,setMod]=useState("today");
  const [aScores,setAScores]=useState({life:0,wealth:0,mindset:0,relations:0});
  const [dailyInsight,setDailyInsight]=useState(data.daily_insight||"");
  const [refreshingInsight,setRefreshingInsight]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setAScores(data.scores||{}),100);return()=>clearTimeout(t);},[data]);

  const refreshDailyInsight=async()=>{
    if(refreshingInsight) return;
    setRefreshingInsight(true);
    try{
      const today=new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
      const prompt=`Today is ${today}. Write a fresh, specific daily insight for ${sanitize(formData.name)} who lives in ${sanitize(formData.country)}, age ${formData.age}. Their challenge: "${sanitize(formData.challenge)}". Their goal: "${sanitize(formData.goals)}". Their skill: ${sanitize(formData.skills)||"general professional skills"}.

Write exactly 3 sentences:
1. Name their specific challenge using their own words.
2. Give ONE concrete action they can do TODAY with a real local example — a specific platform, step, or person type that works in their country.
3. Close with something that makes them feel understood and capable.

Do NOT use generic motivational language. Be specific, direct, and honest.`;
      const reply=await callAPI({messages:[{role:"user",content:prompt}],system:"You are a direct, honest daily advisor. Write exactly 3 sentences. No greetings, no headers, no lists, no bold. Just 3 powerful plain sentences.",userId,isPremium});
      setDailyInsight(reply);
      pushToMemory(userId,"assistant","Daily refresh: "+reply.slice(0,200));
    }catch(e){
      setDailyInsight(data.daily_insight||"");
    }
    setRefreshingInsight(false);
  };

  return(
    <div style={{paddingTop:60}}>
      <div style={{padding:"40px 0 28px",borderBottom:"1px solid var(--line)",background:"rgba(210,175,90,0.02)"}}>
        <div className="cx-md">
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:28}}>
            <div>
              <div className="fu" style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                <div className="mono">Your personal clarity picture</div>
                {ipLocation&&ipLocation.city&&(
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"3px 10px",background:"var(--teal-dim)",border:"1px solid rgba(31,168,154,0.2)",borderRadius:20}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:"var(--teal)",boxShadow:"0 0 5px var(--teal)",animation:"pulse 2s ease infinite"}}/>
                    <span style={{fontFamily:"var(--f-mono)",fontSize:"8px",letterSpacing:".1em",color:"var(--teal)",textTransform:"uppercase"}}>{ipLocation.city}, {ipLocation.country}</span>
                  </div>
                )}
              </div>
              <h1 className="d2 fu1" style={{marginBottom:8}}>{formData.name}</h1>
              <p className="body fu2" style={{fontStyle:"italic",maxWidth:500}}>&ldquo;{data.greeting}&rdquo;</p>
            </div>
            <div className="fu2" style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>
              {isPremium&&<div className="prem-badge">✦ PREMIUM</div>}
              {!showCheckin&&<button className="btn btn-outline-gold" onClick={()=>setShowCheckin(true)}>Check in</button>}
            </div>
          </div>
          <div className="fu3" style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap",marginBottom:28}}>
            <Ring score={data.overall||70} color="var(--gold)" size={106} label="Overall"/>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,minWidth:260}}>
              {PILLARS.map(p=>(
                <div className="pillar-bar-card" key={p.id}>
                  <div className="pb-row"><span className="pb-name">{p.label}</span><span className="pb-val" style={{color:p.color}}>{aScores[p.id]||0}</span></div>
                  <div className="pb-track"><div className="pb-fill" style={{width:`${aScores[p.id]||0}%`,background:p.color}}/></div>
                </div>
              ))}
            </div>
          </div>
          <div className="insight fu4"><p className="body">{data.headline}</p></div>

          {/* Score explanations — why each pillar is the score it is */}
          {data.score_explanations&&(
            <div className="fu4" style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
              {PILLARS.map(p=>(
                data.score_explanations[p.id]&&(
                  <div key={p.id} style={{padding:"10px 13px",background:"var(--lift)",borderRadius:10,borderLeft:`2px solid ${p.color}`}}>
                    <div style={{fontFamily:"var(--f-mono)",fontSize:"8px",letterSpacing:".12em",textTransform:"uppercase",color:p.color,marginBottom:5}}>{p.label}</div>
                    <p style={{fontSize:12,color:"var(--cream-60)",lineHeight:1.65,fontWeight:300}}>{data.score_explanations[p.id]}</p>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>

      {showCheckin&&(
        <div style={{padding:"32px 0",borderBottom:"1px solid var(--line)",background:"rgba(31,168,154,0.03)"}}>
          <div className="cx-md"><CheckIn profile={formData} reportData={data} streak={streak} onComplete={()=>setShowCheckin(false)} userId={userId} isPremium={isPremium}/></div>
        </div>
      )}

      <div style={{padding:"36px 0"}}>
        <div className="cx-md">
          <div className="tabs" style={{marginBottom:32}}>
            {MODULES.map(m=><button key={m.id} className={`tab ${mod===m.id?"on":""}`} onClick={()=>setMod(m.id)}><span>{m.icon}</span>{m.label}</button>)}
          </div>

          {mod==="today"&&(
            <div className="fu">
              <div className="d3" style={{marginBottom:20}}>What we want you to hold onto today</div>
              <div className="insight" style={{marginBottom:24}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:10,flexWrap:"wrap"}}>
                  <div className="mono" style={{fontSize:"9px"}} suppressHydrationWarning>Written for you · {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div>
                  <button className="btn btn-ghost btn-sm" onClick={refreshDailyInsight} disabled={refreshingInsight} style={{fontSize:11,padding:"4px 12px"}}>
                    {refreshingInsight?"Refreshing…":"↺ Refresh today's insight"}
                  </button>
                </div>
                <p className="body">{refreshingInsight?"Getting your fresh insight for today…":dailyInsight}</p>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
                <div className="card card-sm"><div className="mono" style={{marginBottom:10,fontSize:"9px"}}>What you bring to this</div>
                  {data.strengths?.map((s,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:8,fontSize:13,color:"var(--cream-60)"}}><span style={{color:"var(--teal)",flexShrink:0}}>◎</span>{s}</div>)}</div>
                <div className="card card-sm"><div className="mono" style={{marginBottom:10,fontSize:"9px"}}>What to watch out for</div>
                  {data.risks?.map((r,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:8,fontSize:13,color:"var(--cream-60)"}}><span style={{color:"var(--rose)",flexShrink:0}}>◇</span>{r}</div>)}</div>
              </div>
              <div style={{padding:"24px",background:"var(--raised)",border:"1px solid var(--line-gold)",borderRadius:16,textAlign:"center"}}>
                <div className="mono" style={{marginBottom:10,fontSize:"9px"}}>Something to carry with you</div>
                <p style={{fontFamily:"var(--f-display)",fontSize:20,fontStyle:"italic",color:"var(--gold)",fontWeight:400,lineHeight:1.5}}>&ldquo;{data.closing}&rdquo;</p>
              </div>
              {!isPaid&&(
                <div style={{marginTop:24,padding:"20px 24px",background:"linear-gradient(135deg,rgba(210,175,90,0.08),rgba(31,168,154,0.05))",border:"1px solid var(--line-gold)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                  <div><div className="mono" style={{marginBottom:4,fontSize:"9px"}}>We noticed something important</div><p style={{fontSize:14,fontStyle:"italic",color:"var(--cream-60)",lineHeight:1.7}}>"{data.teaser}"</p></div>
                  <button className="btn btn-gold" style={{flexShrink:0}} onClick={onUnlock}>See the full picture</button>
                </div>
              )}
            </div>
          )}

          {mod==="momentum"&&<MomentumModule profile={formData} userId={userId} isPremium={isPremium} streak={streak}/>}
            {mod==="momentum"&&<ReferralWidget user={{id:userId}} isPaid={isPaid}/>}
          {mod==="decisions"&&<DecisionModule profile={formData} userId={userId} isPremium={isPremium} isPaid={isPaid} onUnlock={onUnlock}/>}
          {mod==="weekly"&&<WeeklyModule profile={formData} userId={userId} isPremium={isPremium} isPaid={isPaid} onUnlock={onUnlock}/>}

          {mod==="roadmap"&&(
            <LockGate isPaid={isPaid} onUnlock={onUnlock}>
              <div className="fu">
                <div className="d3" style={{marginBottom:6}}>Your path forward, step by step</div>
                <p className="body" style={{marginBottom:28}}>Not a template. Not generic advice. This is built around what you told us — your life, your country, your real situation.</p>
                {data.roadmap?.map((r,i)=>(
                  <div className="timeline-item" key={i}>
                    <div className="t-dot">{String(i+1).padStart(2,"0")}</div>
                    <div className="t-body">
                      <div className="t-phase">{r.phase}</div>
                      <div className="t-title">{r.title}</div>
                      <p className="t-desc" style={{marginBottom:12}}>{r.desc}</p>
                      {/* Numbered step-by-step list */}
                      {Array.isArray(r.steps)&&r.steps.length>0&&(
                        <div style={{marginBottom:12}}>
                          {r.steps.map((step,si)=>(
                            <div key={si} style={{display:"flex",gap:10,marginBottom:8,padding:"10px 14px",background:"var(--lift)",borderRadius:8,border:"1px solid var(--line)"}}>
                              <div style={{width:22,height:22,borderRadius:"50%",background:"var(--gold-dim)",border:"1px solid var(--line-gold)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"var(--f-mono)",fontSize:9,color:"var(--gold)"}}>{si+1}</div>
                              <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.65,fontWeight:300}}>{step}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.win&&<div className="t-win"><strong>Do this first:</strong> {r.win}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </LockGate>
          )}

          {mod==="mindset"&&(
            <LockGate isPaid={isPaid} onUnlock={onUnlock}>
              <div className="fu">
                <div className="d3" style={{marginBottom:20}}>What's really going on inside</div>
                {[
                  {icon:"◇",title:"What keeps tripping you up",key:"pattern",accent:"rose"},
                  {icon:"↺",title:"A different way to see it",key:"reframe",accent:"gold"},
                  {icon:"◎",title:"What's really happening emotionally",key:"emotional",accent:"violet"},
                  {icon:"◈",title:"One thing to try every morning",key:"practice",accent:"teal"},
                ].map(s=>(
                  <div className="card" key={s.key} style={{marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <span style={{color:`var(--${s.accent})`,fontFamily:"var(--f-mono)",fontSize:18}}>{s.icon}</span>
                      <span style={{fontFamily:"var(--f-display)",fontSize:18,fontWeight:500}}>{s.title}</span>
                    </div>
                    <p className="body">{data.mindset?.[s.key]}</p>
                  </div>
                ))}
              </div>
            </LockGate>
          )}

          {mod==="career"&&(
            <LockGate isPaid={isPaid} onUnlock={onUnlock}>
              <div className="fu">
                <div className="d3" style={{marginBottom:6}}>What you could actually be doing</div>
                <p className="body" style={{marginBottom:24}}>Real paths matched to your skills, your country, and where you are right now — with exact steps to start.</p>
                {data.career?.map((o,i)=>(
                  <div className="card" key={i} style={{marginBottom:16}}>
                    <div style={{display:"flex",gap:14,marginBottom:14}}>
                      <div style={{width:44,height:44,borderRadius:10,background:"var(--gold-dim)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{o.type==="job"?"💼":o.type==="business"?"⚡":"◈"}</div>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:"var(--f-display)",fontSize:18,fontWeight:500,marginBottom:5}}>{o.title}</div>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                          <span className="tag tg">{o.type}</span><span className="tag tt">{o.timeline}</span>
                          <span className="tag" style={{background:"transparent",border:"1px solid var(--line)",color:"var(--cream-30)",fontSize:"9px",padding:"3px 9px",borderRadius:5,fontFamily:"var(--f-mono)"}}>Effort: {o.effort}</span>
                          <span className="tag tv">{o.income}</span>
                        </div>
                      </div>
                    </div>
                    {/* Why this fits */}
                    {o.why&&<div style={{padding:"10px 14px",background:"var(--gold-glow)",borderLeft:"2px solid var(--gold)",borderRadius:"0 8px 8px 0",marginBottom:12}}>
                      <div className="mono" style={{fontSize:"8px",marginBottom:4}}>Why this fits your profile</div>
                      <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.7,fontWeight:300}}>{o.why}</p>
                    </div>}
                    {/* Also show desc if present */}
                    {o.desc&&!o.why&&<p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75,marginBottom:12}}>{o.desc}</p>}
                    {/* How to start — numbered steps */}
                    {o.how&&Array.isArray(o.how)&&o.how.length>0&&(
                      <div>
                        <div className="mono" style={{fontSize:"8px",marginBottom:8}}>How to start — step by step</div>
                        {o.how.map((step,si)=>(
                          <div key={si} style={{display:"flex",gap:10,marginBottom:7,padding:"9px 12px",background:"var(--lift)",borderRadius:7,border:"1px solid var(--line)"}}>
                            <div style={{width:20,height:20,borderRadius:"50%",background:"var(--teal-dim)",border:"1px solid rgba(31,168,154,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"var(--f-mono)",fontSize:9,color:"var(--teal)"}}>{si+1}</div>
                            <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.6,fontWeight:300}}>{step}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </LockGate>
          )}

          {mod==="relocate"&&(
            <RelocationExplorer
              suggestedCountries={data.relocation||[]}
              formData={formData}
              userId={userId}
              isPremium={isPremium}
              isPaid={isPaid}
              onUnlock={onUnlock}
            />
          )}
          {mod==="advisor"&&(
            isPaid
              ?<AdvisorChat profile={formData} reportData={data} userId={userId} isPremium={isPremium}/>
              :<div className="fu" style={{textAlign:"center",padding:"40px 0"}}>
                <div style={{fontSize:36,marginBottom:16}}>⬡</div>
                <div className="d3" style={{marginBottom:12}}>A real conversation, any time</div>
                <p className="body" style={{maxWidth:400,margin:"0 auto 24px"}}>Sometimes you just need someone who knows your situation to talk it through with. That's what this is. No scripts, no generic advice — just honest, specific conversation.</p>
                <button className="btn btn-gold" onClick={onUnlock}>I want this</button>
              </div>
          )}

          <div style={{marginTop:48,paddingTop:28,borderTop:"1px solid var(--line)",display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
            <div className="small" suppressHydrationWarning>Last updated · {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
            <div style={{display:"flex",gap:8}}>
              {isPaid&&<button className="btn btn-ghost" style={{fontSize:12}}>Download PDF</button>}
              {!isPaid&&<button className="btn btn-gold" onClick={onUnlock}>See the full picture</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="disc">DestinIQ is a personal intelligence platform. All insights are frameworks for reflection, not professional advice.</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PRIVACY POLICY & TERMS OF SERVICE
// ═══════════════════════════════════════════════════════════════════════════════
function PolicyPage({type,onBack}){
  const isPrivacy = type==="privacy";
  return(
    <div style={{minHeight:"100vh",paddingTop:80,paddingBottom:60}}>
      <div className="cx-md">
        <button onClick={onBack} style={{background:"none",border:"none",color:"var(--cream-40)",cursor:"pointer",fontSize:13,marginBottom:24,display:"flex",alignItems:"center",gap:6}}>← Back</button>
        <div style={{fontFamily:"var(--f-display)",fontSize:36,color:"var(--cream)",marginBottom:8}}>{isPrivacy?"Privacy Policy":"Terms of Service"}</div>
        <div style={{fontSize:12,color:"var(--cream-30)",fontFamily:"var(--f-mono)",marginBottom:40}}>Last updated: June 2026</div>

        {isPrivacy?(
          <div style={{fontSize:14,color:"var(--cream-60)",lineHeight:1.9}}>
            {[
              ["What We Collect","We collect the information you provide during onboarding (name, age, country, goals, challenges), your daily check-in data, decisions you log, and your payment information processed securely via Paystack. We also collect your email address and, if you sign in with Google, your Google profile name."],
              ["How We Use Your Data","Your data is used exclusively to generate your personalised DestinIQ reports, track your momentum over time, and improve the accuracy of your advisor. We do not use your data for advertising. We do not sell your data to any third party, ever."],
              ["Data Storage","All data is stored securely on Supabase (hosted on AWS). Your report data and check-in logs are encrypted at rest. Only you can access your personal data through your authenticated account."],
              ["AI Processing","Your profile information is sent to Anthropic's Claude AI to generate your personalised reports and advisor responses. This data is processed under Anthropic's data processing agreement and is not used to train their models."],
              ["Payments","Payments are processed by Paystack. We do not store your card details. Paystack's privacy policy applies to payment data."],
              ["Your Rights","You can request deletion of your account and all associated data at any time by contacting us through the support chat or emailing us directly. We will process deletion requests within 24 hours."],
              ["Cookies","We use only essential cookies required for authentication. We do not use tracking or advertising cookies."],
              ["Contact","For any privacy concerns, contact us via the support widget in the app or email destiniq@gmail.com."],
            ].map(([h,b])=>(
              <div key={h} style={{marginBottom:28}}>
                <div style={{fontSize:16,fontWeight:700,color:"var(--cream)",marginBottom:8}}>{h}</div>
                <p style={{margin:0}}>{b}</p>
              </div>
            ))}
          </div>
        ):(
          <div style={{fontSize:14,color:"var(--cream-60)",lineHeight:1.9}}>
            {[
              ["Acceptance","By creating a DestinIQ account and using the service, you agree to these Terms of Service. If you do not agree, please do not use the service."],
              ["The Service","DestinIQ provides AI-powered personal clarity reports, momentum tracking, decision support, and life advisory services. The service is for personal use only and is not a substitute for professional financial, legal, medical, or psychological advice."],
              ["Your Account","You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use DestinIQ. You agree to provide accurate information during onboarding."],
              ["Subscriptions & Payments","DestinIQ offers free and paid subscription tiers. Paid subscriptions are billed monthly or annually via Paystack. Subscriptions renew automatically unless cancelled. Refunds are handled on a case-by-case basis — contact support within 7 days of a charge for assistance."],
              ["Acceptable Use","You agree not to use DestinIQ to plan or facilitate illegal activities, harm others, or circumvent the platform's intent. Accounts found in violation will be terminated without refund."],
              ["Intellectual Property","All DestinIQ content, design, and code is owned by DestinIQ. Your personal data and reports belong to you."],
              ["Limitation of Liability","DestinIQ provides guidance and tools, not guarantees. We are not liable for decisions you make based on the app's output. Use the service as one input among many in your life decisions."],
              ["Changes","We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms."],
              ["Contact","Questions about these terms? Contact us via the in-app support chat or email destiniq@gmail.com."],
            ].map(([h,b])=>(
              <div key={h} style={{marginBottom:28}}>
                <div style={{fontSize:16,fontWeight:700,color:"var(--cream)",marginBottom:8}}>{h}</div>
                <p style={{margin:0}}>{b}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PROFILE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function ProfilePage({user,formData,isPaid,isPremium,streak,onBack,onSignOut,onManageSubscription,onPhotoUpdate}){
  const [name,setName]=useState(user?.name||"");
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(false);
  const [photoURL,setPhotoURL]=useState(null);
  const [photoUploading,setPhotoUploading]=useState(false);

  // Load existing photo on mount
  useEffect(()=>{
    if(!user?.id) return;
    const{data}=supabase.storage.from("avatars").getPublicUrl(`${user.id}/avatar`);
    // Check if it actually exists by trying to load it
    const img=new Image();
    img.onload=()=>setPhotoURL(data.publicUrl+"?t="+Date.now());
    img.onerror=()=>setPhotoURL(null);
    img.src=data.publicUrl;
  },[user?.id]);

  const handlePhotoUpload=async(e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    // Validate size (max 3MB) and type
    if(file.size>3*1024*1024){alert("Photo must be under 3MB.");return;}
    if(!file.type.startsWith("image/")){alert("Please select an image file.");return;}
    setPhotoUploading(true);
    try{
      // Resize/compress by drawing to canvas
      const bitmap=await createImageBitmap(file);
      const canvas=document.createElement("canvas");
      const MAX=400;
      const scale=Math.min(MAX/bitmap.width,MAX/bitmap.height,1);
      canvas.width=bitmap.width*scale;
      canvas.height=bitmap.height*scale;
      canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise(res=>canvas.toBlob(res,"image/jpeg",0.85));

      const{error}=await supabase.storage.from("avatars").upload(`${user.id}/avatar`,blob,{
        contentType:"image/jpeg",
        upsert:true,
      });
      if(error) throw error;

      const{data}=supabase.storage.from("avatars").getPublicUrl(`${user.id}/avatar`);
      const newUrl=data.publicUrl+"?t="+Date.now();
      setPhotoURL(newUrl);
      onPhotoUpdate&&onPhotoUpdate(newUrl);

      // Save photo URL to profile
      await saveUserProfile(user.id,{photo_url:data.publicUrl});
    }catch(err){
      alert("Upload failed: "+err.message);
    }
    setPhotoUploading(false);
  };

  const save=async()=>{
    setLoading(true);
    try{
      await supabase.auth.updateUser({data:{name}});
      await saveUserProfile(user.id,{name});
      setSaved(true);setTimeout(()=>setSaved(false),2000);
    }catch(e){console.warn(e);}
    setLoading(false);
  };

  const planLabel = isPaid&&isPremium?"Premium":isPaid?"Essential":"Free";
  const planColor = isPaid?"var(--gold)":"var(--cream-30)";

  return(
    <div style={{minHeight:"100vh",paddingTop:80,paddingBottom:60}}>
      <div style={{maxWidth:560,margin:"0 auto",padding:"0 24px"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"var(--cream-40)",cursor:"pointer",fontSize:13,marginBottom:24,display:"flex",alignItems:"center",gap:6}}>← Back</button>

        {/* Avatar with photo upload */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:32}}>
          <div style={{position:"relative",flexShrink:0}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),var(--teal))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:700,color:"#000",overflow:"hidden",border:"2px solid var(--line-gold)"}}>
              {photoURL
                ?<img src={photoURL} alt="Profile" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :(user?.name||user?.email||"U")[0].toUpperCase()
              }
            </div>
            {/* Upload button overlay */}
            <label htmlFor="photo-upload" style={{position:"absolute",bottom:0,right:0,width:24,height:24,borderRadius:"50%",background:"var(--gold)",border:"2px solid var(--midnight)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:12}}>
              {photoUploading?"…":"📷"}
            </label>
            <input id="photo-upload" type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoUpload}/>
          </div>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:"var(--cream)"}}>{user?.name||"Your Profile"}</div>
            <div style={{fontSize:13,color:"var(--cream-40)"}}>{user?.email||user?.phone||""}</div>
            <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:4,padding:"2px 10px",borderRadius:20,border:`1px solid ${planColor}`,fontSize:11,color:planColor,fontFamily:"var(--f-mono)"}}>{planLabel} Plan</div>
            {photoURL&&<div style={{fontSize:11,color:"var(--teal)",marginTop:4}}>✓ Photo saved</div>}
          </div>
        </div>

        {/* Edit name */}
        <div className="card" style={{marginBottom:16}}>
          <div style={{fontSize:11,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",marginBottom:10}}>DISPLAY NAME</div>
          <input style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:10,padding:"12px 14px",color:"var(--cream)",fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:12}} value={name} onChange={e=>setName(e.target.value)} maxLength={60}/>
          <button onClick={save} disabled={loading||!name.trim()} style={{background:"var(--gold)",border:"none",borderRadius:10,padding:"10px 20px",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            {saved?"✓ Saved":loading?"Saving…":"Save changes"}
          </button>
        </div>

        {/* Stats */}
        <div className="card" style={{marginBottom:16}}>
          <div style={{fontSize:11,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",marginBottom:14}}>YOUR STATS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[["🔥","Streak",`${streak} days`],["📍","Country",formData?.country||"—"],["🎯","Goal",formData?.bigGoal||formData?.goals?.slice(0,20)||"—"]].map(([icon,label,val])=>(
              <div key={label} style={{textAlign:"center",padding:"12px 8px",background:"var(--midnight)",borderRadius:10}}>
                <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                <div style={{fontSize:12,fontWeight:700,color:"var(--cream)",marginBottom:2}}>{val}</div>
                <div style={{fontSize:10,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription */}
        <SubscriptionCard isPaid={isPaid} isPremium={isPremium} userId={user?.id} onManageSubscription={onManageSubscription}/>

        {/* Sign out & delete */}
        <div className="card">
          <button onClick={onSignOut} style={{width:"100%",background:"none",border:"1px solid var(--cream-10)",borderRadius:10,padding:"12px",color:"var(--cream-40)",fontSize:13,cursor:"pointer",marginBottom:10}}>Sign out</button>
          <p style={{fontSize:11,color:"var(--cream-20)",textAlign:"center",margin:0}}>To delete your account and all data, contact us via the support chat.</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SHARE REPORT CARD
// ═══════════════════════════════════════════════════════════════════════════════
function ShareCard({report,formData,onClose}){
  const [copied,setCopied]=useState(false);

  // Extract scores — handle both number scores and section-based reports
  const getScore=(field,idx,def)=>{
    if(typeof report?.[field]==="number") return report[field];
    const s=report?.sections?.find(x=>x.title?.toLowerCase().includes(field.replace("relationship","relation")));
    if(typeof s?.score==="number") return s.score;
    if(typeof report?.sections?.[idx]?.score==="number") return report.sections[idx].score;
    return def;
  };
  const scores=[
    {label:"Life",     val:getScore("life",0,52)},
    {label:"Wealth",   val:getScore("wealth",1,38)},
    {label:"Mindset",  val:getScore("mindset",2,61)},
    {label:"Relations",val:getScore("relationship",3,45)},
  ];
  const overall=typeof report?.overall==="number"
    ?report.overall
    :(typeof report?.overall==="string"&&!isNaN(parseInt(report.overall)))
      ?parseInt(report.overall)
      :Math.round(scores.reduce((s,x)=>s+x.val,0)/scores.length);

  const shareText=`My DestinIQ Clarity Score: ${overall}/100

Life: ${scores[0].val} · Wealth: ${scores[1].val} · Mindset: ${scores[2].val}

Discover your own clarity score at destiniq.vercel.app`;

  const copy=async()=>{
    try{
      await navigator.clipboard.writeText(shareText);
    }catch{
      // Fallback for browsers that block clipboard
      const el=document.createElement("textarea");
      el.value=shareText;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);setTimeout(()=>setCopied(false),2500);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:24}}>
      <div style={{background:"var(--night)",border:"1px solid var(--line-gold)",borderRadius:20,padding:28,maxWidth:400,width:"100%"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:700,color:"var(--cream)"}}>Share your clarity score</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--cream-40)",cursor:"pointer",fontSize:18}}>✕</button>
        </div>

        {/* Card preview */}
        <div style={{background:"linear-gradient(135deg,#0d0b00,#1a1500)",border:"1px solid var(--line-gold)",borderRadius:16,padding:24,marginBottom:20,textAlign:"center"}}>
          <div style={{fontFamily:"var(--f-display)",fontSize:13,color:"var(--gold)",letterSpacing:".1em",marginBottom:8}}>DESTINIQ CLARITY SCORE</div>
          <div style={{fontFamily:"var(--f-display)",fontSize:56,color:"var(--gold)",fontWeight:400,lineHeight:1}}>{overall}</div>
          <div style={{fontSize:11,color:"var(--cream-40)",marginBottom:16}}>/100</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {scores.map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"8px"}}>
                <div style={{fontSize:18,fontWeight:700,color:"var(--cream)"}}>{s.val}</div>
                <div style={{fontSize:10,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>{s.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:"var(--cream-30)"}}>destiniq.vercel.app</div>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={copy} style={{flex:1,background:"var(--gold)",border:"none",borderRadius:10,padding:"12px",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            {copied?"✓ Copied!":"Copy to share"}
          </button>
          {typeof navigator!=="undefined"&&navigator.share&&<button onClick={()=>navigator.share({title:"My DestinIQ Score",text:shareText,url:"https://destiniq.vercel.app"})} style={{flex:1,background:"none",border:"1px solid var(--line-gold)",borderRadius:10,padding:"12px",color:"var(--gold)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Share →</button>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. REFERRAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
function ReferralWidget({user,isPaid}){
  const [copied,setCopied]=useState(false);
  const [referrals,setReferrals]=useState(0);
  const refCode = user?.id?.slice(0,8)||"destiq";
  const refLink = `https://destiniq.vercel.app?ref=${refCode}`;

  useEffect(()=>{
    if(!user?.id) return;
    supabase.from("referrals").select("id",{count:"exact"}).eq("referrer_id",user.id).then(({count})=>setReferrals(count||0));
  },[user?.id]);

  const copy=()=>{ navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  return(
    <div className="card" style={{marginBottom:24}}>
      <div style={{fontSize:11,color:"var(--gold)",fontWeight:600,letterSpacing:".06em",marginBottom:4,fontFamily:"var(--f-mono)"}}>INVITE A FRIEND</div>
      <div style={{fontSize:18,fontWeight:700,color:"var(--cream)",marginBottom:6}}>Give 1 month free. Get 1 month free.</div>
      <p style={{fontSize:13,color:"var(--cream-50)",marginBottom:16,lineHeight:1.6}}>Share your link. When a friend signs up and subscribes, you both get a free month added.</p>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <div style={{flex:1,background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:10,padding:"11px 14px",fontSize:12,color:"var(--cream-40)",fontFamily:"var(--f-mono)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{refLink}</div>
        <button onClick={copy} style={{background:"var(--gold)",border:"none",borderRadius:10,padding:"11px 18px",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0}}>{copied?"✓":"Copy"}</button>
      </div>

      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1,textAlign:"center",padding:"12px",background:"var(--midnight)",borderRadius:10}}>
          <div style={{fontSize:24,fontWeight:800,color:"var(--gold)"}}>{referrals}</div>
          <div style={{fontSize:10,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>FRIENDS REFERRED</div>
        </div>
        <div style={{flex:1,textAlign:"center",padding:"12px",background:"var(--midnight)",borderRadius:10}}>
          <div style={{fontSize:24,fontWeight:800,color:"var(--teal)"}}>{referrals}</div>
          <div style={{fontSize:10,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>FREE MONTHS EARNED</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
const ADMIN_EMAILS=["destiniq@gmail.com"]; // Add your email here

function AdminDashboard({user,onBack}){
  const [stats,setStats]=useState(null);
  const [testimonials,setTestimonials]=useState([]);
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const isAdmin=ADMIN_EMAILS.includes(user?.email);

  useEffect(()=>{
    if(!isAdmin) return;
    Promise.all([
      supabase.from("user_profiles").select("*",{count:"exact"}),
      supabase.from("testimonials").select("*").order("created_at",{ascending:false}).limit(20),
      supabase.from("user_profiles").select("user_id,name,is_paid,is_premium,streak,created_at").order("created_at",{ascending:false}).limit(20),
      supabase.from("referrals").select("*",{count:"exact"}),
    ]).then(([prof,test,usr,refs])=>{
      const paid=prof.data?.filter(p=>p.is_paid).length||0;
      setStats({
        totalUsers:prof.count||0,
        paidUsers:paid,
        freeUsers:(prof.count||0)-paid,
        testimonialsPending:test.data?.filter(t=>!t.approved).length||0,
        totalReferrals:refs.count||0,
      });
      setTestimonials(test.data||[]);
      setUsers(usr.data||[]);
      setLoading(false);
    });
  },[isAdmin]);

  const approveTestimonial=async(id,approved)=>{
    await supabase.from("testimonials").update({approved}).eq("id",id);
    setTestimonials(t=>t.map(x=>x.id===id?{...x,approved}:x));
  };

  if(!isAdmin) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:14,color:"var(--cream-30)"}}>Access denied.</div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",paddingTop:80,paddingBottom:60}}>
      <div className="cx">
        <button onClick={onBack} style={{background:"none",border:"none",color:"var(--cream-40)",cursor:"pointer",fontSize:13,marginBottom:24,display:"flex",alignItems:"center",gap:6}}>← Back</button>
        <div style={{fontFamily:"var(--f-display)",fontSize:32,color:"var(--cream)",marginBottom:4}}>Admin Dashboard</div>
        <div style={{fontSize:12,color:"var(--cream-30)",fontFamily:"var(--f-mono)",marginBottom:32}}>DestinIQ · Internal</div>

        {loading?<div style={{color:"var(--cream-30)"}}>Loading…</div>:(
          <>
            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:14,marginBottom:32}}>
              {[
                ["👥","Total Users",stats.totalUsers],
                ["💳","Paid",stats.paidUsers],
                ["🆓","Free",stats.freeUsers],
                ["⭐","Testimonials pending",stats.testimonialsPending],
                ["🔗","Referrals",stats.totalReferrals],
              ].map(([icon,label,val])=>(
                <div key={label} className="card" style={{textAlign:"center"}}>
                  <div style={{fontSize:24,marginBottom:4}}>{icon}</div>
                  <div style={{fontSize:26,fontWeight:800,color:"var(--gold)"}}>{val}</div>
                  <div style={{fontSize:10,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>{label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            {/* Testimonials to approve */}
            <div className="card" style={{marginBottom:24}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--cream)",marginBottom:16}}>Testimonials ({testimonials.length})</div>
              {testimonials.length===0&&<div style={{fontSize:13,color:"var(--cream-30)"}}>No testimonials yet.</div>}
              {testimonials.map(t=>(
                <div key={t.id} style={{borderBottom:"1px solid var(--line)",paddingBottom:12,marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--cream)",marginBottom:2}}>{t.name}</div>
                      <div style={{fontSize:12,color:"var(--cream-50)",lineHeight:1.6}}>"{t.quote}"</div>
                      <div style={{fontSize:10,color:"var(--cream-20)",marginTop:4,fontFamily:"var(--f-mono)"}}>{new Date(t.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      {!t.approved&&<button onClick={()=>approveTestimonial(t.id,true)} style={{background:"var(--teal)",border:"none",borderRadius:8,padding:"6px 12px",color:"#000",fontSize:11,fontWeight:700,cursor:"pointer"}}>Approve</button>}
                      {t.approved&&<button onClick={()=>approveTestimonial(t.id,false)} style={{background:"none",border:"1px solid var(--cream-15)",borderRadius:8,padding:"6px 12px",color:"var(--cream-40)",fontSize:11,cursor:"pointer"}}>Revoke</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent users */}
            <div className="card">
              <div style={{fontSize:13,fontWeight:700,color:"var(--cream)",marginBottom:16}}>Recent Users</div>
              {users.map(u=>(
                <div key={u.user_id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--line)"}}>
                  <div>
                    <div style={{fontSize:13,color:"var(--cream)"}}>{u.name||"Unknown"}</div>
                    <div style={{fontSize:10,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>{new Date(u.created_at).toLocaleDateString()} · 🔥{u.streak||0} streak</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {u.is_paid&&<span style={{fontSize:10,color:"var(--gold)",fontFamily:"var(--f-mono)",border:"1px solid var(--line-gold)",borderRadius:4,padding:"2px 6px"}}>PAID</span>}
                    {u.is_premium&&<span style={{fontSize:10,color:"var(--teal)",fontFamily:"var(--f-mono)",border:"1px solid rgba(20,184,154,0.3)",borderRadius:4,padding:"2px 6px"}}>PREMIUM</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. EMPTY STATE (shown when user has no report yet)
// ═══════════════════════════════════════════════════════════════════════════════
function EmptyState({onStart,name}){
  const steps=[
    {icon:"📋",title:"Complete your profile",desc:"Tell us about yourself — your goals, challenges, where you are in life."},
    {icon:"🧠",title:"Get your clarity report",desc:"A personalised report built around your specific situation. Not generic advice."},
    {icon:"📈",title:"Track your momentum",desc:"Check in daily. Watch your score grow as you take real action."},
  ];
  return(
    <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px"}}>
      <div style={{maxWidth:520,textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>👋</div>
        <div style={{fontFamily:"var(--f-display)",fontSize:28,color:"var(--cream)",marginBottom:8}}>Welcome{name?`, ${name}`:""}</div>
        <p style={{fontSize:14,color:"var(--cream-50)",marginBottom:36,lineHeight:1.7}}>You're one step away from your personal clarity report. It takes about 3 minutes and will change how you see your next move.</p>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:32,textAlign:"left"}}>
          {steps.map((s,i)=>(
            <div key={i} style={{display:"flex",gap:14,padding:"14px 16px",background:"var(--night)",border:"1px solid var(--line)",borderRadius:14,alignItems:"flex-start"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"var(--gold-dim)",border:"1px solid var(--line-gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.icon}</div>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:"var(--cream)",marginBottom:3}}>{s.title}</div>
                <div style={{fontSize:12,color:"var(--cream-40)",lineHeight:1.5}}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onStart} style={{background:"var(--gold)",border:"none",borderRadius:12,padding:"14px 36px",color:"#000",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(212,175,55,0.3)"}}>
          Build my report →
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. WELCOME EMAIL (triggered on signup — sent via Supabase Edge Function)
// NOTE: Add a Supabase Edge Function called "welcome-email" to send the email.
// This component just triggers it.
// ═══════════════════════════════════════════════════════════════════════════════
async function triggerWelcomeEmail(user){
  try{
    await supabase.functions.invoke("welcome-email",{
      body:{
        to: user.email,
        name: user.name||user.email?.split("@")[0]||"there",
      }
    });
  }catch(e){ console.warn("Welcome email:",e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE BANNER
// Shows a banner when the user loses internet connection.
// ═══════════════════════════════════════════════════════════════════════════════
function OfflineBanner(){
  const [offline,setOffline]=useState(false);
  useEffect(()=>{
    const on=()=>setOffline(false);
    const off=()=>setOffline(true);
    window.addEventListener("online",on);
    window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[]);
  if(!offline) return null;
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"rgba(196,100,90,0.95)",backdropFilter:"blur(8px)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
      <span style={{fontSize:16}}>📡</span>
      <span style={{fontSize:13,color:"#fff",fontWeight:500}}>You're offline — check your connection. Your data is saved.</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// Shown while profile/report is loading from Supabase after login.
// ═══════════════════════════════════════════════════════════════════════════════
function LoadingSkeleton(){
  const bar=(w,h=12,mb=8)=>(
    <div style={{width:w,height:h,borderRadius:6,background:"var(--lift)",marginBottom:mb,animation:"shimmer 1.4s ease-in-out infinite"}}/>
  );
  return(
    <>
      <style>{`@keyframes shimmer{0%,100%{opacity:0.4}50%{opacity:0.8}}`}</style>
      <div style={{paddingTop:80,padding:"80px 24px 40px",maxWidth:640,margin:"0 auto"}}>
        <div style={{display:"flex",gap:16,marginBottom:32}}>
          <div style={{width:80,height:80,borderRadius:"50%",background:"var(--lift)",animation:"shimmer 1.4s ease-in-out infinite",flexShrink:0}}/>
          <div style={{flex:1}}>
            {bar("60%",20,10)}{bar("40%",14,0)}
          </div>
        </div>
        {bar("100%",120,20)}
        {bar("100%",80,16)}
        {bar("80%",16,0)}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER (client-side guard)
// Prevents free users from spamming AI report generation.
// The real enforcement should also be server-side (Edge Function).
// ═══════════════════════════════════════════════════════════════════════════════
const RATE_LIMIT_KEY="destiniq_report_count";
const RATE_LIMIT_DATE_KEY="destiniq_report_date";
const FREE_REPORT_LIMIT=3; // free users get 3 reports total

function getRateLimit(){
  if(typeof window==="undefined") return{count:0,date:null};
  try{
    const date=localStorage.getItem(RATE_LIMIT_DATE_KEY);
    const count=parseInt(localStorage.getItem(RATE_LIMIT_KEY)||"0",10);
    return{count,date};
  }catch{return{count:0,date:null};}
}

function incrementRateLimit(){
  if(typeof window==="undefined") return;
  try{
    const{count}=getRateLimit();
    localStorage.setItem(RATE_LIMIT_KEY,String(count+1));
    localStorage.setItem(RATE_LIMIT_DATE_KEY,new Date().toDateString());
  }catch{}
}

function isRateLimited(isPaid){
  if(isPaid) return false; // paid users have no limit
  const{count}=getRateLimit();
  return count>=FREE_REPORT_LIMIT;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CARD (replaces the old "contact support" manage button)
// ═══════════════════════════════════════════════════════════════════════════════
function SubscriptionCard({isPaid,isPremium,userId,onManageSubscription}){
  const [cancelling,setCancelling]=useState(false);
  const [cancelled,setCancelled]=useState(false);
  const [showConfirm,setShowConfirm]=useState(false);
  const planLabel=isPaid&&isPremium?"Premium":isPaid?"Essential":"Free";
  const planColor=isPaid?"var(--gold)":"var(--cream-30)";

  const handleCancel=async()=>{
    setCancelling(true);
    try{
      // Write cancellation request to Supabase — your backend/webhook
      // or a Supabase function should handle the actual Paystack cancellation.
      await supabase.from("cancellation_requests").insert({
        user_id:userId,
        requested_at:new Date().toISOString(),
        reason:"user_self_cancel",
      });
      // Optimistically mark as cancelled in the UI
      // The actual is_paid will be set to false by your webhook when the
      // current billing period ends.
      setCancelled(true);
      setShowConfirm(false);
      // Note: don't set is_paid=false here — they keep access until period ends
    }catch(e){
      console.warn("Cancel error:",e.message);
    }
    setCancelling(false);
  };

  if(cancelled){
    return(
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontSize:11,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",marginBottom:14}}>SUBSCRIPTION</div>
        <div style={{padding:"14px",background:"rgba(196,100,90,0.08)",border:"1px solid rgba(196,100,90,0.2)",borderRadius:10}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--rose)",marginBottom:4}}>Cancellation requested</div>
          <p style={{fontSize:12,color:"var(--cream-40)",margin:0,lineHeight:1.6}}>
            Your subscription will remain active until the end of your current billing period. 
            We'll send a confirmation email. Changed your mind? Contact support.
          </p>
        </div>
      </div>
    );
  }

  return(
    <div className="card" style={{marginBottom:16}}>
      <div style={{fontSize:11,color:"var(--cream-40)",fontWeight:600,letterSpacing:".06em",marginBottom:14}}>SUBSCRIPTION</div>
      {!showConfirm?(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:15,fontWeight:600,color:"var(--cream)"}}>{planLabel}</div>
            <div style={{fontSize:12,color:"var(--cream-40)"}}>{isPaid?"Active subscription":"Free tier"}</div>
          </div>
          {!isPaid&&<button onClick={onManageSubscription} style={{background:"var(--gold)",border:"none",borderRadius:10,padding:"9px 18px",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>Upgrade</button>}
          {isPaid&&(
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowConfirm(true)} style={{background:"none",border:"1px solid rgba(196,100,90,0.3)",borderRadius:10,padding:"9px 18px",color:"var(--rose)",fontSize:12,cursor:"pointer"}}>
                Cancel plan
              </button>
            </div>
          )}
        </div>
      ):(
        <div>
          <div style={{fontSize:14,fontWeight:600,color:"var(--cream)",marginBottom:8}}>Cancel your subscription?</div>
          <p style={{fontSize:13,color:"var(--cream-50)",marginBottom:16,lineHeight:1.6}}>
            You'll keep full access until the end of your billing period. This cannot be undone automatically — 
            contact support if you change your mind.
          </p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setShowConfirm(false)} style={{flex:1,background:"none",border:"1px solid var(--cream-15)",borderRadius:10,padding:"10px",color:"var(--cream-40)",fontSize:13,cursor:"pointer"}}>
              Keep my plan
            </button>
            <button onClick={handleCancel} disabled={cancelling} style={{flex:1,background:"rgba(196,100,90,0.15)",border:"1px solid rgba(196,100,90,0.3)",borderRadius:10,padding:"10px",color:"var(--rose)",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              {cancelling?"Cancelling…":"Yes, cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DestinIQ(){
  const [user, setUser]=useState(null);
  const [authLoading, setAuthLoading]=useState(true); // waiting for Supabase session
  const [screen,    setScreen   ]=useState("landing");
  const [formData,  setFormData ]=useState(null);
  const [report,    setReport   ]=useState(null);
  const [isPaid,    setIsPaid   ]=useState(false);
  const [isPremium, setIsPremium]=useState(false);
  const [streak,    setStreak   ]=useState(1);
  const [showCI,    setShowCI   ]=useState(false);
  const [apiError,  setApiError ]=useState("");
  const [showNotif, setShowNotif]=useState(false);
  const [nudge,     setNudge    ]=useState(false);
  const [ipLocation,setIpLocation]=useState(null);
  const [ipLoaded,  setIpLoaded ]=useState(false);
  const [userId, setUserId]=useState(null);
  const [showProfile, setShowProfile]=useState(false);
  const [showAdmin,   setShowAdmin  ]=useState(false);
  const [showPolicy,  setShowPolicy ]=useState(null); // "privacy"|"terms"|null
  const [showShare,   setShowShare  ]=useState(false);
  const [showReferral,setShowReferral]=useState(false);
  const [profileLoading,setProfileLoading]=useState(false); // true while loading saved profile after login

  // ── SUPABASE SESSION MANAGEMENT ─────────────────────────────────────────
  const restoreUserSession = async (supaUser) => {
    const u = supaUser;
    const meta = u.user_metadata || {};
    const appUser = {
      id: u.id, email: u.email, phone: u.phone,
      name: meta.name || meta.full_name || (u.email?.split("@")[0]) || "User",
      provider: u.app_metadata?.provider || "email"
    };
    setUser(appUser);
    setUserId(u.id);
    setProfileLoading(true); // show skeleton while we load saved data
    hydrateUserData(u.id);

    // Load saved profile (onboarding answers + subscription)
    try{
      const profile = await loadUserProfile(u.id);
      if (profile) {
        if (profile.is_paid)    setIsPaid(true);
        if (profile.is_premium) setIsPremium(true);
        if (profile.streak)     setStreak(profile.streak);
        if (profile.form_data)  setFormData(profile.form_data);
        if (profile.report)     setReport(profile.report);
        // Only go to results if BOTH formData and report exist
        if (profile.form_data && profile.report) {
          setScreen("results");
        }
        // Otherwise stay on landing — user will see the home page and can click Begin
      }
    }catch(e){
      console.warn("restoreUserSession profile load error:",e.message);
    }finally{
      setProfileLoading(false);
    }
  };

  useEffect(()=>{
    // Check for an existing session on mount (handles OAuth redirects too)
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){
        restoreUserSession(session.user);
      }
      setAuthLoading(false);
    });

    // Listen for sign-in / sign-out events (including OAuth callback)
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,session)=>{
      if(session?.user){
        restoreUserSession(session.user);
        // Track referral if URL has ?ref=
        if(_event==="SIGNED_IN"&&typeof window!=="undefined"){
          const ref=new URLSearchParams(window.location.search).get("ref");
          if(ref){
            // Find referrer by their id prefix
            const{data:profiles}=await supabase.from("user_profiles").select("user_id").ilike("user_id",ref+"%").limit(1);
            if(profiles?.[0]){
              await supabase.from("referrals").insert({referrer_id:profiles[0].user_id,referred_id:session.user.id}).onConflict("referred_id").ignore();
            }
            window.history.replaceState({},"",window.location.pathname);
          }
        }
      } else {
        setUser(null);
        setUserId(null);
        setFormData(null);
        setReport(null);
        setIsPaid(false);
        setIsPremium(false);
        setScreen("landing");
      }
    });
    return()=>subscription.unsubscribe();
  },[]);

  // Silently fetch IP location as soon as app loads
  useEffect(()=>{
    getIPLocation().then(loc=>{
      setIpLocation(loc);
      setIpLoaded(true);
    });
  },[]);

  // Listen for policy events from auth screen footer links
  useEffect(()=>{
    const handler=(e)=>setShowPolicy(e.detail);
    window.addEventListener("showPolicy",handler);
    return()=>window.removeEventListener("showPolicy",handler);
  },[]);

  const handleSubmit=useCallback(async(f)=>{
    if(!userId) return; // not yet authenticated
    // Rate limit free users
    if(isRateLimited(isPaid)){
      setApiError(`You've generated ${FREE_REPORT_LIMIT} reports on the free plan. Upgrade to generate more.`);
      setScreen("paywall");
      return;
    }
    incrementRateLimit();
    setFormData(f);setScreen("loading");setApiError("");
    pushToMemory(userId,"user",`Profile: ${f.name}, ${f.age}, ${f.country}, Situation: ${f.situation||f.career}, Goal: ${f.bigGoal||""}, Goals: ${f.goals}, Challenge: ${f.challenge}, Wants from app: ${f.wantFrom||""}`);

    // Fetch live local context for their area (parallel with report generation feel)
    const localCtx = await getLocalContext(ipLocation?.city||"", f.country).catch(()=>null);

    try{
      // ── INTENT MODERATION ────────────────────────────────────────────────
      // Before generating the report, check whether the user's stated goals
      // or challenges describe harmful, illegal, or destructive intent.
      // If so, skip the normal report and return a caring redirect instead.
      const intentCheckPrompt = `A person named ${f.name}, age ${f.age}, from ${f.country} submitted the following:
Goals: "${f.goals}"
Challenge: "${f.challenge}"
Skills: "${f.skills||""}"

Does this person describe any harmful, illegal, violent, criminal, or clearly self-destructive intent (e.g. robbery, drug dealing, scamming, trafficking, violence, fraud, gang activity, or anything that would hurt themselves or others)?

Reply ONLY with a JSON object in this exact format — no extra text:
{"harmful":true,"underlying_desire":"what they probably actually want (money, respect, freedom, excitement, etc.)","redirect":"a warm but firm 2-3 sentence message to them explaining why that path destroys their future, then suggesting a specific legitimate path that gives them what they actually want"}
or
{"harmful":false}`;

      const intentRaw = await callAPI({
        messages:[{role:"user",content:intentCheckPrompt}],
        system:"You are a content moderation assistant. Reply ONLY with valid JSON, nothing else.",
        userId, isPremium
      });
      let intentResult = {harmful:false};
      try{
        const ic = intentRaw.replace(/\`\`\`json|\`\`\`/g,"").trim();
        intentResult = JSON.parse(ic.slice(ic.indexOf("{"), ic.lastIndexOf("}")+1));
      }catch(_){}

      if(intentResult.harmful){
        // Build a caring redirect report instead of a normal life plan
        const redirectReport = {
          overall: "Let's Talk Honestly",
          summary: intentResult.redirect || `${f.name}, we need to be real with you. The path you described leads to prison, early death, or a life of regret — not the life you actually deserve. You clearly have drive and ambition. Let's point that energy somewhere that actually builds your future.`,
          sections:[
            {
              title:"The Truth About That Path",
              content:`Here's what actually happens to people who go down that road: it doesn't end in wealth or respect. It ends in loss — of freedom, family, and often life itself. The people who look successful in that world are either in debt to someone dangerous, hiding from authorities, or already gone. That's not the future your potential deserves.`
            },
            {
              title:`What You Actually Want`,
              content:`You want ${intentResult.underlying_desire||"a better life, real money, and to be respected"}. That's completely valid. Those desires are not the problem — the method is. The good news is everything you want is achievable through paths that don't put you in a cell or a grave.`
            },
            {
              title:"A Real Alternative for You",
              content:`Your age, your country, your drive — these are genuine assets. People with your level of hunger have built businesses, learned trades, broken into tech, built communities. The skills that make someone good at street survival — reading people, staying calm under pressure, hustle, loyalty — are the exact skills that make someone exceptional in sales, entrepreneurship, logistics, and leadership. You already have what it takes. You just need to aim it differently.`
            },
            {
              title:"Your Next Step",
              content:`Start with one thing: find one person in your area who is making legitimate money and ask them how they started. Not to copy them — to understand that it's possible. Then come back and tell us your real goals. We'll build you a plan that actually works.`
            }
          ],
          redirect: true
        };
        setReport(redirectReport);
        setScreen("results");
        return;
      }
      // ── END INTENT CHECK ─────────────────────────────────────────────────

      const prompt=buildAnalysisPrompt(f,isPremium,buildMemoryContext(userId),ipLocation,localCtx);
      const raw=await callAPI({
        messages:[{role:"user",content:prompt}],
        system:"You are a world-class personal strategy advisor — part therapist, part career coach, part business mentor. Write an intensely personal report for ONE specific person. RULES: (1) Every roadmap step, career option, and mindset insight must directly serve their stated goal — no generic advice ever. (2) ROADMAP: 4 concrete steps per phase with real platform names, real costs in local currency, and a specific 24-hour action in the win field. (3) CAREER: 3 paths matched to actual skills and goal. Real income in local currency AND USD. Steps actionable this week. (4) MINDSET: Name the EXACT mental block from their own words. Reframe must be a new lens on their specific situation only. Practice must have exact instructions — time, method, what to notice. (5) Write TO them using their name and their own words. (6) No markdown asterisks in text. (7) Return ONLY valid JSON — no code fences. Complete and parseable.",
        userId,isPremium
      });
      const cleaned=raw.replace(/```json|```/g,"").trim();
      const jStart=cleaned.indexOf("{"); const jEnd=cleaned.lastIndexOf("}");
      const parsed=JSON.parse(jStart>=0?cleaned.slice(jStart,jEnd+1):cleaned);
      pushToMemory(userId,"assistant","Report generated: overall="+parsed.overall);
      setReport(parsed);
      setScreen("results");
      // Save profile + report to Supabase
      try{
        const reportToSave = {
          overall: parsed.overall,
          summary: parsed.summary,
          life: parsed.life,
          wealth: parsed.wealth,
          mindset: parsed.mindset,
          relationships: parsed.relationships,
          sections: (parsed.sections||[]).map(s=>({title:s.title,content:(s.content||"").slice(0,600)})),
          teaser: parsed.teaser,
          suggestedCountries: (parsed.suggestedCountries||[]).slice(0,3),
        };
        const {error:saveError} = await supabase.from("user_profiles").upsert({
          user_id: userId,
          form_data: f,
          report: reportToSave,
          is_paid: isPaid,
          is_premium: isPremium,
          streak,
          updated_at: new Date().toISOString(),
        },{onConflict:"user_id"});
        if(saveError) console.warn("Profile save error:",saveError.message);
        else console.log("✓ Profile saved successfully");
      }catch(saveErr){
        console.warn("Profile save failed:",saveErr.message);
      }
      return;
    }catch(e){
      const fb=fallback(f,ipLocation);
      setReport(fb);
      setScreen("results");
      try{
        const fbToSave={overall:fb.overall,summary:fb.summary,life:fb.life,wealth:fb.wealth,mindset:fb.mindset,relationships:fb.relationships,sections:fb.sections?.map(s=>({title:s.title,content:s.content?.slice(0,800)})),teaser:fb.teaser};
        await saveUserProfile(userId,{form_data:f,report:fbToSave,is_paid:isPaid,is_premium:isPremium,streak});
      }catch(_){}
      if(e.message==="API_KEY_MISSING") setApiError("Demo mode: API key not configured. Showing sample report.");
    }
  },[userId,isPremium,ipLocation]);

  const restart=()=>{setScreen("landing");setFormData(null);setReport(null);setIsPaid(false);setStreak(1);setShowCI(false);setApiError("");setNudge(false);};
  const handleUnlock=()=>{setScreen("paywall");};
  // handlePay: called after Paystack confirms payment in the Paywall component.
  // We write is_paid:true to Supabase immediately so it survives any refresh.
  const handlePay=async(paystackRef)=>{
    setIsPaid(true);
    setStreak(s=>s+1);
    setScreen("results");
    if(userId){
      try{
        await saveUserProfile(userId,{
          is_paid:true,
          paystack_ref:paystackRef||null,
          paid_at:new Date().toISOString(),
          form_data:formData,
          report:report,
        });
      }catch(e){console.warn("handlePay save:",e.message);}
    }
  };

  // SEO meta tags — set once on mount
  useEffect(()=>{
    document.title="DestinIQ — Your Personal Clarity Report";
    const setMeta=(name,content,prop=false)=>{
      const key=prop?"property":"name";
      let el=document.querySelector(`meta[${key}="${name}"]`);
      if(!el){el=document.createElement("meta");el.setAttribute(key,name);document.head.appendChild(el);}
      el.setAttribute("content",content);
    };
    setMeta("description","DestinIQ gives you a personalised life intelligence report — built around your goals, your country, and your real situation. Not generic advice.");
    setMeta("og:title","DestinIQ — Your Personal Clarity Report",true);
    setMeta("og:description","Find out exactly where you are, what's holding you back, and what to do next. Built for you, not for everyone.",true);
    setMeta("og:image","https://destiniq.vercel.app/og-image.png",true);
    setMeta("og:url","https://destiniq.vercel.app",true);
    setMeta("og:type","website",true);
    setMeta("twitter:card","summary_large_image");
    setMeta("twitter:title","DestinIQ — Your Personal Clarity Report");
    setMeta("twitter:description","A personalised life intelligence report built around your goals and situation.");
    setMeta("twitter:image","https://destiniq.vercel.app/og-image.png");
  },[]);

  return(
    <ErrorBoundary>
    <>
      <style>{CSS}</style>
      <OfflineBanner/>
      <div className="bg bg-mesh"/>
      <div className="bg bg-noise"/>
      <div className="bg bg-grid"/>
      <div className="root" suppressHydrationWarning>

        {/* AUTH GATE — show login if not authenticated */}
        {authLoading&&<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontFamily:"var(--f-mono)",fontSize:12,color:"var(--cream-30)",letterSpacing:".1em"}}>Loading…</div></div>}{!authLoading&&!user&&<AuthScreen onAuth={async(u)=>{if(u.isNew)triggerWelcomeEmail(u);await restoreUserSession({id:u.id,email:u.email,phone:u.phone,user_metadata:{name:u.name,full_name:u.name},app_metadata:{provider:u.provider}});}}/>}
        {/* Show skeleton while loading saved profile from DB */}
        {user&&profileLoading&&<LoadingSkeleton/>}
        {user&&!profileLoading&&<>

        <SupportWidget/>
        <nav className="nav">
          <div className="logo" onClick={()=>{
            if(report) setScreen("results");
            else if(user) setScreen("landing");
            else setScreen("landing");
          }}>Destin<b>IQ</b></div>
          <div className="nav-r">
            {screen!=="landing"&&<PremiumToggle isPremium={isPremium} onToggle={()=>setIsPremium(p=>!p)}/>}
            {user&&<button onClick={()=>setShowProfile(true)} style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),var(--teal))",border:"2px solid var(--line-gold)",padding:0,cursor:"pointer",fontSize:13,fontWeight:700,color:"#000",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}} title="Profile">
              {navPhotoURL
                ?<img src={navPhotoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :(user.name||user.email||"U")[0].toUpperCase()
              }
            </button>}
            {user&&ADMIN_EMAILS.includes(user.email)&&<button className="btn btn-ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowAdmin(true)}>Admin</button>}
            {screen==="results"&&(
              <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setShowNotif(true)} title="Set daily notification">
                🔔
              </button>
            )}
            {screen==="results"&&!isPaid&&<button className="btn btn-gold" style={{fontSize:12,padding:"8px 18px"}} onClick={handleUnlock}>Upgrade</button>}
            {screen==="results"&&isPaid&&<div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>}
            {screen==="results"&&report&&<button className="btn btn-ghost" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>setShowShare(true)}>Share 📤</button>}
            {screen!=="landing"&&screen!=="results"&&<button className="btn btn-ghost" style={{fontSize:12,padding:"8px 18px"}} onClick={()=>report?setScreen("results"):setScreen("landing")}>← Home</button>}
            {screen==="landing"&&<button className="btn btn-gold" style={{fontSize:12,padding:"8px 18px"}} onClick={()=>setScreen("intake")}>Begin →</button>}
          </div>
        </nav>

        {apiError&&(
          <div style={{position:"fixed",top:60,left:0,right:0,zIndex:100,background:"rgba(196,100,90,0.12)",borderBottom:"1px solid rgba(196,100,90,0.2)",padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <span style={{fontSize:13,color:"var(--rose)"}}>⚠ {apiError}</span>
            <button className="btn-text" onClick={()=>setApiError("")} style={{color:"var(--rose)"}}>✕</button>
          </div>
        )}

        {nudge&&formData&&(
          <div className="notif-nudge">
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
              <div>
                <div className="mono" style={{marginBottom:4,fontSize:"9px"}}>🔔 Daily Reminder</div>
                <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.6}}>Hey {formData.name} — how's today going? Take 30 seconds to check in with yourself.</p>
              </div>
              <button className="btn-text" onClick={()=>setNudge(false)} style={{flexShrink:0,fontSize:14}}>✕</button>
            </div>
            <button className="btn btn-gold btn-full" style={{marginTop:10,fontSize:12,padding:"8px"}} onClick={()=>{setNudge(false);setShowCI(true);}}>Log Momentum →</button>
          </div>
        )}

        {/* Policy pages */}
        {showPolicy&&<PolicyPage type={showPolicy} onBack={()=>setShowPolicy(null)}/>}

        {/* Profile page */}
        {showProfile&&<ProfilePage user={user} formData={formData} isPaid={isPaid} isPremium={isPremium} streak={streak}
          onPhotoUpdate={(url)=>setNavPhotoURL(url)}
          onBack={()=>setShowProfile(false)}
          onSignOut={async()=>{await supabase.auth.signOut();setUser(null);setUserId(null);setScreen("landing");setFormData(null);setReport(null);setShowProfile(false);}}
          onManageSubscription={()=>{setShowProfile(false);handleUnlock();}}/>}

        {/* Admin dashboard */}
        {showAdmin&&<AdminDashboard user={user} onBack={()=>setShowAdmin(false)}/>}

        {/* Share card modal */}
        {showShare&&report&&<ShareCard report={report} formData={formData} onClose={()=>setShowShare(false)}/>}

        {!showPolicy&&!showProfile&&!showAdmin&&<>
        {screen==="landing"  &&<Landing onStart={()=>setScreen("intake")} ipLocation={ipLocation}/>}
        {screen==="intake"   &&<Intake onSubmit={handleSubmit}/>}
        {screen==="loading"  &&<Loading/>}
        {screen==="paywall"  &&<Paywall onUnlock={handlePay} teaser={report?.teaser||""} userEmail={user?.email||""}/>}
        {screen==="results"  &&formData&&report&&(
          <Dashboard data={report} formData={formData} isPaid={isPaid} onUnlock={handleUnlock}
              streak={streak} showCheckin={showCI} setShowCheckin={setShowCI} userId={userId} isPremium={isPremium} ipLocation={ipLocation}/>
        )}
        {screen==="results"  &&formData&&!report&&(
          <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"var(--f-mono)",fontSize:12,color:"var(--cream-30)",letterSpacing:".1em",marginBottom:16}}>Loading your report…</div>
              <div style={{width:40,height:40,border:"3px solid var(--cream-10)",borderTop:"3px solid var(--gold)",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto"}}/>
            </div>
          </div>
        )}

        {showNotif&&formData&&(
          <NotificationPanel profile={formData} userId={userId} onClose={()=>setShowNotif(false)}/>
        )}
        </>}

        </>}
      </div>
    </>
    </ErrorBoundary>
  );
}

