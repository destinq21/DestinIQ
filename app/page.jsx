// @ts-nocheck
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
 * -- Admin approve/revoke (replace the email below with your admin email)
 * create policy "Admin can update testimonials" on testimonials for update
 *   using (auth.jwt() ->> 'email' = 'support@destiniq.app')
 *   with check (auth.jwt() ->> 'email' = 'support@destiniq.app');
 * create policy "Admin can read all testimonials" on testimonials for select
 *   using (auth.jwt() ->> 'email' = 'support@destiniq.app');
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
 * -- Admin dashboard needs to read aggregate user data
 * create policy "Admin can read all profiles" on user_profiles for select
 *   using (auth.jwt() ->> 'email' = 'support@destiniq.app');
 * -- Allow referral lookup: any authenticated user can look up a user_id by prefix
 * -- (needed so a new signup can find who referred them via ?ref=xxxxxxxx)
 * create policy "Authenticated users can look up profiles for referrals" on user_profiles
 *   for select using (auth.role() = 'authenticated');
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
 * create policy "Authenticated users can record a referral" on referrals
 *   for insert with check (auth.uid() = referred_id);
 *
 * -- Admin needs to see total referral counts
 * create policy "Admin can read all referrals" on referrals for select
 *   using (auth.jwt() ->> 'email' = 'support@destiniq.app');
 *
 * -- Profile photo storage (avatars bucket — create it as a PUBLIC bucket in
 * -- Storage settings, then run these policies on storage.objects)
 * create policy "Users upload own avatar" on storage.objects for insert
 *   with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
 * create policy "Users update own avatar" on storage.objects for update
 *   using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
 * create policy "Anyone can view avatars" on storage.objects for select
 *   using (bucket_id = 'avatars');
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */


import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════════
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={hasError:false,error:null,info:null}; }
  static getDerivedStateFromError(e){ return{hasError:true,error:e}; }
  componentDidCatch(e,info){ console.error("DestinIQ crash:",e,info); this.setState({info}); }
  render(){
    if(this.state.hasError) return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"#0a0800"}}>
        <div style={{maxWidth:600,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
          <div style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:700,color:"#e8dcc8",marginBottom:8}}>Something went wrong</div>
          <p style={{fontSize:14,color:"rgba(232,220,200,0.5)",marginBottom:24,lineHeight:1.7}}>Your data is safe. Please refresh to continue.</p>
          <button onClick={()=>window.location.reload()} style={{background:"#d4af37",border:"none",borderRadius:12,padding:"12px 28px",color:"#000",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:16}}>Refresh page</button>
          <div style={{textAlign:"left",background:"rgba(255,255,255,0.05)",borderRadius:12,padding:16,fontSize:11,color:"#F87171",fontFamily:"monospace",overflow:"auto",maxHeight:300,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
            <div style={{color:"#FCA5A5",fontWeight:700,marginBottom:8}}>{this.state.error?.toString()}</div>
            <div>{this.state.error?.stack}</div>
            {this.state.info?.componentStack&&<div style={{marginTop:12,color:"#FDBA74"}}>{this.state.info.componentStack}</div>}
          </div>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
// Capacitor plugins accessed via window.Capacitor.Plugins (no imports needed)

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

/** Load user profile from Supabase. Returns null if not found or on error. */
async function loadUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    // PGRST116 = "no rows returned" — not an error, just means new user
    if (error && error.code !== "PGRST116") {
      console.warn("loadUserProfile error:", error.message);
    }
    return data || null;
  } catch (e) {
    console.warn("loadUserProfile exception:", e.message);
    return null;
  }
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
// Paystack: paystack.com → Your Store → Products → copy Variant IDs above
// ── PAYSTACK ────────────────────────────────────────────────────────────────
// Get your key: dashboard.paystack.com → Settings → API Keys & Webhooks
// Use TEST key (pk_test_...) while testing, LIVE key (pk_live_...) when going live
const PAYSTACK_PUBLIC_KEY = "pk_test_your_key_here"; // ← PASTE YOUR KEY HERE

// All charges handled by Paystack — they manage tax + billing worldwide
// in the world are accepted and settle automatically. We just SHOW the price
// converted to the user's local currency so it feels native to them.
const PLANS = {
  pro:          { name:"Pro",          amount:9.99,   label:"$9.99/month",   currency:"USD", tier:"pro" },
  promax:       { name:"Pro Max",      amount:24.99,  label:"$24.99/month",  currency:"USD", tier:"promax" },
  pro_annual:   { name:"Pro Annual",   amount:79.99,  label:"$79.99/year",   currency:"USD", tier:"pro" },
  promax_annual:{ name:"Pro Max Annual",amount:199.99, label:"$199.99/year",  currency:"USD", tier:"promax" },
};

// Approximate USD exchange rates for display purposes only — actual charge
// is always in USD. Update periodically; doesn't need to be perfectly live.
const FX_RATES = {
  USD:1, GHS:14.8, NGN:1550, KES:129, ZAR:18.4, GBP:0.79, EUR:0.92,
  INR:85, PHP:58.5, BRL:5.7, CAD:1.37, AUD:1.52, MXN:18.2, EGP:49,
  PKR:279, BDT:122, VND:25400, IDR:16200, NGS:1550, XOF:605, KWD:0.31,
  AED:3.67, SAR:3.75, CNY:7.25, JPY:155, ZMW:27, UGX:3700, TZS:2650,
};

const CURRENCY_SYMBOLS = {
  USD:"$", GHS:"GH₵", NGN:"₦", KES:"KSh", ZAR:"R", GBP:"£", EUR:"€",
  INR:"₹", PHP:"₱", BRL:"R$", CAD:"C$", AUD:"A$", MXN:"MX$", EGP:"E£",
  PKR:"₨", BDT:"৳", VND:"₫", IDR:"Rp", XOF:"CFA", KWD:"KD",
  AED:"AED", SAR:"SAR", CNY:"¥", JPY:"¥", ZMW:"ZK", UGX:"USh", TZS:"TSh",
};

// Format a USD amount in the user's local currency for display.
// Returns null if we don't have a rate for their currency (falls back to USD display).
function formatLocalPrice(usdAmount, currencyCode){
  if(!currencyCode||currencyCode==="USD") return null;
  const rate=FX_RATES[currencyCode];
  if(!rate) return null;
  const converted=usdAmount*rate;
  const symbol=CURRENCY_SYMBOLS[currencyCode]||currencyCode+" ";
  // Round sensibly: whole numbers for currencies with big units, 2dp for small-unit ones
  const rounded = converted>=100 ? Math.round(converted) : Math.round(converted*100)/100;
  return `${symbol}${rounded.toLocaleString()}`;
}
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
// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM — Morning wake-up, afternoon, evening, streak protection
// ═══════════════════════════════════════════════════════════════════════════════
const NOTIF_MSGS = {
  morning:[
    (n,g)=>`${n}, it's morning. Your goal is "${g||"a better life"}". The people winning started their day already. Open DestinIQ.`,
    (n)=>`Good morning ${n}. 5 minutes of planning now saves 3 hours of confusion later. Let's go.`,
    (n)=>`${n} — while others are still in bed, you could already be moving. Get up. Start.`,
    (n)=>`DestinIQ morning call for ${n}: Your roadmap has a next step waiting. Today is the day.`,
    (n)=>`${n}, sleeping longer won't change anything. Moving will. Your daily check-in is ready.`,
    (n)=>`Rise up ${n}. Every day you delay is a day someone else gets ahead. Your plan is ready.`,
    (n)=>`${n}, the best time to start was yesterday. The second best time is right now. Open your plan.`,
  ],
  afternoon:[
    (n)=>`${n}, half the day is gone. What actually happened? Log your check-in before tonight.`,
    (n)=>`Afternoon check-in, ${n}. Did you do the thing you planned this morning?`,
    (n)=>`${n} — afternoon is when most people lose focus. This is your reminder not to.`,
    (n)=>`Your advisor is ready to help you think through whatever you're stuck on right now, ${n}.`,
    ()=>`DestinIQ: Quick question — what's the one thing you'll finish before the day ends?`,
  ],
  evening:[
    (n,s)=>`${n}, your ${s}-day streak ends at midnight if you don't check in. 2 minutes is all it takes.`,
    (n)=>`Evening check-in time, ${n}. Not to judge the day — just to learn from it.`,
    (n)=>`${n} — log one win from today. Even a small one. Streaks are built one honest answer at a time.`,
    (n)=>`Before the day ends, ${n}: what did you actually move forward today? Log it now.`,
    ()=>`DestinIQ: Your daily reflection is waiting. Takes 60 seconds. Worth every one.`,
  ],
  streak:[
    (n,s)=>`⚠️ ${n}, your ${s}-day streak expires in 3 hours. Don't lose it tonight.`,
    (n,s)=>`${s} days in a row, ${n}. Don't let tonight be the one you regret. Log your check-in.`,
    (n,s)=>`Streak alert: You've shown up ${s} days straight, ${n}. Midnight will reset it. 90 seconds to keep it alive.`,
  ],
  weekly:[
    (n)=>`New week, ${n}. Your roadmap has steps waiting. Which one are you committing to this week?`,
    (n)=>`Monday, ${n}. This is when the gap between people who make it and people who don't gets decided.`,
    (n)=>`${n}, last week is gone. This week starts now. Open your plan and pick one thing.`,
  ],
};

const NOTIF_SCHED_KEY="destiniq_notif_v2";

async function requestNotifPermission() {
  if(typeof window==="undefined"||!("Notification" in window)) return "unsupported";
  if(Notification.permission==="granted") return "granted";
  if(Notification.permission==="denied") return "denied";
  return await Notification.requestPermission();
}

function fireNotification(title, body, tag="destiniq"){
  if(typeof window==="undefined"||Notification.permission!=="granted") return;
  try{
    const n=new Notification(title,{
      body,tag,icon:"/icon-192.png",badge:"/icon-192.png",
      requireInteraction:false,silent:false,
    });
    n.onclick=()=>{window.focus();n.close();};
  }catch(_){}
}

async function scheduleNotification(uid, name, goal, streak, times, onFire){
  if(!uid||!times) return;
  const pick=(arr)=>arr[Math.floor(Math.random()*arr.length)];

  // Persist preferences so notifications survive app restarts
  try{ localStorage.setItem(NOTIF_SCHED_KEY,JSON.stringify({uid,name,goal,streak,times,set:Date.now()})); }catch(_){}

  // ── NATIVE MOBILE: Capacitor LocalNotifications ────────────────────────
  const isNative = typeof window!=="undefined" && window?.Capacitor?.isNativePlatform?.();
  if(isNative){
    try{
      // Access plugin via global bridge (no import needed)
      const LN = window?.Capacitor?.Plugins?.LocalNotifications;
      if(!LN){ console.warn("LocalNotifications plugin not found — rebuild APK with @capacitor/local-notifications"); return; }

      // Request permission (shows system dialog on first call)
      const perm = await LN.requestPermissions();
      if(perm?.display !== "granted" && perm?.notifications !== "granted"){
        console.warn("Notification permission not granted:", perm);
        return;
      }

      // Cancel existing DestinIQ notifications before rescheduling
      try{
        const pending = await LN.getPending();
        const destiniQNotifs = (pending?.notifications||[]).filter(n=>n.id>=1001&&n.id<=1010);
        if(destiniQNotifs.length>0) await LN.cancel({notifications:destiniQNotifs});
      }catch(e){}

      // Helper: next occurrence of a time (today if not passed, tomorrow if passed)
      const nextAt=(h,m)=>{
        const d=new Date();
        d.setSeconds(0); d.setMilliseconds(0);
        d.setHours(h,m);
        if(d<=new Date()) d.setDate(d.getDate()+1);
        return d;
      };

      const notifications = [];

      if(times.morning){
        const [h,m]=times.morning.split(":").map(Number);
        notifications.push({
          id:1001, title:"DestinIQ", channelId:"destiniq-daily",
          body:pick(NOTIF_MSGS.morning)(name,goal),
          schedule:{at:nextAt(h,m), repeats:true, allowWhileIdle:true},
          smallIcon:"ic_stat_notify", sound:"default",
        });
      }
      if(times.afternoon){
        const [h,m]=times.afternoon.split(":").map(Number);
        notifications.push({
          id:1002, title:"DestinIQ", channelId:"destiniq-daily",
          body:pick(NOTIF_MSGS.afternoon)(name),
          schedule:{at:nextAt(h,m), repeats:true, allowWhileIdle:true},
          smallIcon:"ic_stat_notify", sound:"default",
        });
      }
      if(times.evening){
        const [h,m]=times.evening.split(":").map(Number);
        notifications.push({
          id:1003, title:"DestinIQ", channelId:"destiniq-daily",
          body:pick(NOTIF_MSGS.evening)(name,streak),
          schedule:{at:nextAt(h,m), repeats:true, allowWhileIdle:true},
          smallIcon:"ic_stat_notify", sound:"default",
        });
      }
      // 9pm streak protection
      notifications.push({
        id:1004, title:"DestinIQ 🔥", channelId:"destiniq-daily",
        body:pick(NOTIF_MSGS.streak)(name,streak),
        schedule:{at:nextAt(21,0), repeats:true, allowWhileIdle:true},
        smallIcon:"ic_stat_notify", sound:"default",
      });

      await LN.schedule({notifications});
      console.log(`✅ ${notifications.length} notifications scheduled`);
      return;
    }catch(e){
      console.warn("LocalNotifications scheduling failed:", e?.message||e);
      // Fall through to web fallback
    }
  }

  // ── WEB: setTimeout fallback (only works while tab is open) ────────────
  // NOTE: This is a browser limitation — real push needs a service worker
  const existing=_notifTimers.get(uid)||[];
  existing.forEach(t=>clearTimeout(t));
  const newTimers=[];

  const scheduleAt=(timeStr, msgFn, tag)=>{
    if(!timeStr) return;
    const [h,m]=timeStr.split(":").map(Number);
    const now=new Date(), next=new Date();
    next.setHours(h,m,0,0);
    if(next<=now) next.setDate(next.getDate()+1);
    const delay=next-now;
    const tid=setTimeout(()=>{
      fireNotification("DestinIQ", msgFn(), tag);
      onFire&&onFire(tag);
      scheduleNotification(uid,name,goal,streak,times,onFire);
    }, delay);
    newTimers.push(tid);
  };

  scheduleAt(times.morning,   ()=>pick(NOTIF_MSGS.morning)(name,goal),   "morning");
  scheduleAt(times.afternoon, ()=>pick(NOTIF_MSGS.afternoon)(name),       "afternoon");
  scheduleAt(times.evening,   ()=>pick(NOTIF_MSGS.evening)(name,streak),  "evening");

  const now2=new Date(), nine=new Date();
  nine.setHours(21,0,0,0);
  if(nine>now2) newTimers.push(setTimeout(()=>{
    fireNotification("DestinIQ 🔥", pick(NOTIF_MSGS.streak)(name,streak), "streak");
  }, nine-now2));

  _notifTimers.set(uid, newTimers);
}

// Test notification — fires in 5 seconds (to confirm notifications work)
async function testNotification(name){
  const isNative = typeof window!=="undefined" && window?.Capacitor?.isNativePlatform?.();
  if(isNative){
    try{
      const LN = window?.Capacitor?.Plugins?.LocalNotifications;
      if(!LN) return false;
      const perm = await LN.requestPermissions();
      if(perm?.display!=="granted"&&perm?.notifications!=="granted") return false;
      await LN.schedule({notifications:[{
        id:9999, title:"DestinIQ ✅", channelId:"destiniq-daily",
        body:`${name||"Hey"}, notifications are working! You'll get daily check-ins from now on.`,
        schedule:{at:new Date(Date.now()+5000)}, // 5 seconds from now
        smallIcon:"ic_stat_notify", sound:"default",
      }]});
      return true;
    }catch(e){ return false; }
  }
  // Web fallback
  if(typeof Notification!=="undefined" && Notification.permission==="granted"){
    setTimeout(()=>{ new Notification("DestinIQ ✅",{body:`${name||"Hey"}, notifications are working!`}); }, 5000);
    return true;
  }
  return false;
}

// Restore notification schedule on page load
if(typeof window!=="undefined"){
  try{
    const saved=JSON.parse(localStorage.getItem(NOTIF_SCHED_KEY)||"null");
    if(saved&&Notification.permission==="granted"&&saved.uid){
      scheduleNotification(saved.uid,saved.name,saved.goal,saved.streak,saved.times,null);
    }
  }catch(_){}
}


// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Outfit:wght@200;300;400;500;600&family=JetBrains+Mono:wght@300;400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --void:#05060f;--deep:#08091a;--base:#0d0f1e;--raised:#121526;--lift:#181b2e;--midnight:#0a0c1c;
  --cream-80:rgba(237,232,216,0.8);--cream-70:rgba(237,232,216,0.7);--cream-50:rgba(237,232,216,0.5);--cream-40:rgba(237,232,216,0.4);--cream-20:rgba(237,232,216,0.2);--cream-15:rgba(237,232,216,0.12);
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
body{background:var(--void);color:var(--cream);font-family:var(--f-body);font-size:15px;line-height:1.6;min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
/* Safe area for notched phones (iPhone X+, Android notch) */
.nav{padding-top:max(12px,env(safe-area-inset-top))!important;padding-left:max(16px,env(safe-area-inset-left))!important;padding-right:max(16px,env(safe-area-inset-right))!important;}
.fu{padding-bottom:max(80px,env(safe-area-inset-bottom))!important;}
.bg{position:fixed;inset:0;z-index:0;pointer-events:none;}
.bg-mesh{background:radial-gradient(ellipse 80% 60% at 20% 0%,rgba(31,168,154,0.07) 0%,transparent 55%),radial-gradient(ellipse 60% 50% at 80% 100%,rgba(210,175,90,0.08) 0%,transparent 55%),radial-gradient(ellipse 50% 40% at 80% 20%,rgba(124,92,191,0.05) 0%,transparent 50%),var(--void);}
.bg-noise{opacity:.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:128px;}
.bg-grid{background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse 70% 70% at 50% 50%,black 20%,transparent 100%);}
.root{position:relative;z-index:1;min-height:100vh;overflow-x:hidden;scroll-behavior:smooth;}
.screen-fade{animation:screenFadeIn .25s ease;}
@keyframes drawerSlideIn{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes drawerSlideIn{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes screenFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
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
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 24px;border-radius:8px;border:none;cursor:pointer;font-family:var(--f-body);font-size:13px;font-weight:500;transition:all .25s;white-space:nowrap;min-height:44px;min-height:44px;}
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
.fi,.fs,.ft{width:100%;padding:12px 16px;background:var(--lift);border:1px solid var(--line);border-radius:8px;color:var(--cream);font-family:var(--f-body);font-size:16px;font-weight:300;outline:none;transition:all .25s;-webkit-appearance:none;}/* 16px prevents iOS Safari zoom on focus */
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
.tabs{display:grid;grid-template-columns:repeat(7,1fr);background:var(--base);border-radius:10px;padding:4px;gap:3px;}
.tabs::-webkit-scrollbar{display:none;}
.tab{padding:9px 4px;border-radius:7px;border:none;cursor:pointer;font-family:var(--f-body);font-size:10.5px;font-weight:500;background:transparent;color:var(--cream-30);transition:all .25s;white-space:nowrap;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;overflow:hidden;text-overflow:ellipsis;}
.tab span:first-child{font-size:14px;}
.tab:hover{color:var(--cream-60);}
.tab.on{background:var(--lift);color:var(--cream);border:1px solid var(--line-gold);}
/* ── RESPONSIVE BREAKPOINTS ──────────────────────────────────────────────── */

/* Tablet: 641–900px */
@media(min-width:641px)and(max-width:900px){
  .cx,.cx-md{padding:0 28px;}
  .plan-cards-grid{grid-template-columns:1fr 1fr;}
  .score-explain-grid{grid-template-columns:1fr 1fr;}
  .notif-3col{grid-template-columns:1fr 1fr;}
  .tabs{grid-template-columns:repeat(5,1fr);}
}
/* iPad portrait / large tablet: ≤840px */
@media(max-width:840px){
  .hero-grid{grid-template-columns:1fr!important;gap:36px!important;}
  .hero-grid>div:first-child{order:1;}
  .hero-grid>div:last-child{order:2;}
}
/* Mobile: ≤640px */
@media(max-width:640px){
  /* ── CORE MOBILE FIXES ── */
  /* Score ring scales down on small phones */
  .score-ring-wrap{transform:scale(0.8);transform-origin:top center;}
  /* Tool icon */
  .t-icon{font-size:clamp(28px,8vw,48px)!important;}
  /* All section headings */
  h2,h3{font-size:clamp(16px,4.5vw,22px)!important;}
  /* Card inner padding */
  .card,.lift{padding:clamp(12px,3.5vw,18px)!important;}

  .pg{padding:16px 16px 90px!important;}
  .pg-back{margin-bottom:12px;}
  /* Prevent horizontal overflow on all screens */
  .main-area,.app-shell,.root{overflow-x:hidden!important;}
  /* Tool page headings */
  .t-head{padding:16px 16px 12px!important;}
  .t-title{font-size:18px!important;}
  /* Cards inside tool pages */
  .card{padding:16px!important;border-radius:14px!important;}
  /* Score ring in report */
  .score-ring-wrap{transform:scale(0.85);}

  /* ── Base ── */
  html,body{overflow-x:hidden!important;max-width:100vw!important;-webkit-text-size-adjust:100%;}
  *{box-sizing:border-box!important;}
  p,h1,h2,h3,h4,span,div{word-wrap:break-word!important;overflow-wrap:break-word!important;}

  /* ── Layout ── */
  .cx,.cx-sm,.cx-md{padding:0 16px!important;}
  .fu{padding:0 0 80px!important;}/* extra bottom for thumb zone */

  /* ── Typography — readable at arm's length ── */
  .body-lg{font-size:15px!important;line-height:1.75!important;max-width:100%!important;}
  p{max-width:100%!important;padding-right:0!important;font-size:14px!important;line-height:1.7!important;}
  .d1{font-size:clamp(28px,8vw,46px)!important;line-height:1.1!important;}
  .d2{font-size:clamp(22px,6vw,34px)!important;line-height:1.2!important;}
  .d3{font-size:clamp(18px,5vw,26px)!important;line-height:1.3!important;}
  .small,.mono{font-size:12px!important;}

  /* ── Nav bar ── */
  .nav{padding:0 16px!important;height:56px!important;}
  .nav-r{gap:8px!important;}
  .prem-badge{font-size:9px!important;padding:4px 10px!important;border-radius:20px!important;}
  .streak-badge{padding:6px 12px!important;font-size:10px!important;}
  .streak-fire{font-size:14px!important;}

  /* ── Cards ── */
  .card{padding:16px!important;border-radius:16px!important;margin-bottom:12px!important;}
  .card-sm{padding:14px!important;border-radius:14px!important;}
  .lock-gate{padding:20px 16px!important;}
  .insight{padding:14px 16px!important;}

  /* ── Tabs — module groups ── */
  .tabs{display:flex!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;
    scrollbar-width:none!important;gap:6px!important;padding:6px 2px!important;
    grid-template-columns:unset!important;}
  .tabs::-webkit-scrollbar{display:none!important;}
  .tab{flex-shrink:0!important;font-size:11px!important;padding:9px 12px!important;
    min-width:64px!important;min-height:44px!important;border-radius:12px!important;
    display:flex!important;flex-direction:column!important;align-items:center!important;gap:4px!important;}
  .tab span:first-child{font-size:15px!important;}/* icon bigger */
  .tab span:last-child{font-size:10px!important;white-space:nowrap!important;}

  /* ── Tab bar (sub-tabs) ── */
  .tab-bar{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;
    scrollbar-width:none!important;padding-bottom:4px!important;}
  .tab-bar::-webkit-scrollbar{display:none!important;}
  .tab-bar button{font-size:11px!important;padding:9px 14px!important;
    white-space:nowrap!important;min-height:40px!important;}

  /* ── Buttons — 44px min tap target ── */
  .btn{min-height:44px!important;font-size:14px!important;padding:12px 20px!important;border-radius:12px!important;}
  .btn-lg{min-height:52px!important;font-size:15px!important;padding:14px 24px!important;}
  .btn-sm{min-height:36px!important;font-size:12px!important;padding:8px 14px!important;}
  button{min-height:36px!important;}

  /* ── Grids → single column on mobile ── */
  .results-grid{grid-template-columns:1fr!important;}
  .hero-grid{grid-template-columns:1fr!important;gap:24px!important;}
  .row2{grid-template-columns:1fr!important;}
  .plan-cards-grid{grid-template-columns:1fr!important;}
  .paywall-faq{grid-template-columns:1fr!important;}
  .notif-3col{grid-template-columns:1fr!important;}
  .reloc-grid{grid-template-columns:1fr!important;}
  .score-explain-grid{grid-template-columns:1fr!important;}
  .score-grid{grid-template-columns:1fr 1fr!important;}
  .reloc-stats{grid-template-columns:repeat(2,1fr)!important;}
  .mom-stat-grid{grid-template-columns:repeat(2,1fr)!important;}

  /* ── Misc layout fixes ── */
  .pillar-wrap{flex-direction:column!important;align-items:stretch!important;}
  .pillar-wrap>div:last-child{min-width:unset!important;}
  .pbar-wrap{width:100%!important;max-width:100%!important;}
  .section-header-row{flex-direction:column!important;align-items:flex-start!important;gap:10px!important;}
  .reloc-header{padding:16px!important;}
  .reloc-body{padding:16px!important;}

  /* ── Module group section labels ── */
  .module-group-label{font-size:9px!important;letter-spacing:.15em!important;padding:6px 4px 4px!important;}

  /* ── Score cards bigger on mobile ── */
  .score-card{padding:16px!important;min-height:80px!important;}
  .score-num{font-size:36px!important;}

  /* ── Inputs ── */
  input,select,textarea{font-size:16px!important;min-height:48px!important;}/* 16px prevents iOS zoom */
  textarea{min-height:80px!important;}
}
/* Small phones: ≤420px */
@media(max-width:420px){
  .cx,.cx-sm,.cx-md{padding:0 14px!important;}
  .d1{font-size:clamp(24px,7.5vw,40px)!important;}
  .d2{font-size:clamp(20px,6vw,30px)!important;}
  .d3{font-size:clamp(17px,5vw,24px)!important;}
  .card{padding:14px!important;}
  .body-lg{font-size:14px!important;}
  p{font-size:13px!important;}
  .tab{font-size:10px!important;padding:8px 10px!important;min-width:56px!important;}
  .tab span:first-child{font-size:14px!important;}
  .nav-logo{font-size:15px!important;}
  input,select,textarea{font-size:16px!important;}/* prevent iOS zoom */
}
/* Very small screens: ≤360px */
@media(max-width:360px){
  /* 360px and smaller — extra tight layout */
  .pg,.cx,.cx-sm,.cx-md{padding-left:12px!important;padding-right:12px!important;}
  .card{padding:12px!important;}
  .mob-top{padding-left:12px!important;padding-right:12px!important;}

  .cx,.cx-sm,.cx-md{padding:0 12px!important;box-sizing:border-box!important;}
  body,html{overflow-x:hidden!important;width:100%!important;}
  p,h1,h2,h3{word-wrap:break-word!important;overflow-wrap:break-word!important;max-width:100%!important;}
  .d1{font-size:24px!important;}
  .d2{font-size:19px!important;}
  .tab{font-size:9.5px!important;padding:7px 8px!important;min-width:52px!important;}
  .card{padding:12px!important;}
  input,select{font-size:16px!important;}
}
/* Notch / safe area (iPhone X+, modern Android) */
@supports(padding:max(0px)){
  .nav{
    padding-left:max(14px,env(safe-area-inset-left))!important;
    padding-right:max(14px,env(safe-area-inset-right))!important;
  }
}
.fu{animation:fadeUp .5s ease both;}
.fu1{animation:fadeUp .5s ease both;}
.fu2{animation:fadeUp .5s .08s ease both;}
.fu3{animation:fadeUp .5s .16s ease both;}
.fu4{animation:fadeUp .5s .24s ease both;}
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
/* reloc responsive handled in main block above */
/* ─── APP SHELL ─── */
.app-shell{display:flex;min-height:100vh;background:var(--void);overflow-x:hidden;width:100%;max-width:100vw;}
.sidebar{width:220px;min-height:100vh;position:fixed;left:0;top:0;bottom:0;background:var(--night);border-right:1px solid var(--line);display:none!important;flex-direction:column;z-index:200;overflow-y:auto;}
.sidebar-logo{padding:22px 20px 14px;border-bottom:1px solid var(--line-dim);}
.sidebar-items{padding:8px 0;flex:1;}
.s-item{display:flex;align-items:center;gap:12px;padding:10px 20px;cursor:pointer;font-size:13.5px;color:var(--cream-50);font-weight:500;border:none;background:none;width:100%;text-align:left;transition:all .15s;border-left:3px solid transparent;}
.s-item:hover{background:rgba(255,255,255,.04);color:var(--cream);}
.s-item.active{background:rgba(200,168,75,.08);color:var(--gold);border-left-color:var(--gold);}
.s-streak{padding:14px 20px;border-top:1px solid var(--line-dim);}
.s-upgrade{padding:0 16px 18px;}
.main-area{margin-left:0;flex:1;min-width:0;width:100%;max-width:100vw;overflow-x:hidden;-webkit-overflow-scrolling:touch;}
.bot-nav{display:none!important;position:fixed;bottom:0;left:0;right:0;z-index:200;background:rgba(8,8,16,.96);backdrop-filter:blur(14px);border-top:1px solid var(--line);padding:6px 0 max(6px,env(safe-area-inset-bottom));}
.bot-items{display:flex;justify-content:space-around;}
.bot-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 12px;border:none;background:none;color:var(--cream-30);cursor:pointer;flex:1;transition:color .15s;}
.bot-item.active{color:var(--gold);}
.bot-icon{font-size:22px;line-height:1.1;}
.bot-label{font-size:9px;font-weight:700;font-family:var(--f-mono);letter-spacing:.05em;text-transform:uppercase;}
.mob-top{display:none;align-items:center;justify-content:space-between;padding:max(14px,env(safe-area-inset-top)) 16px 12px;background:rgba(8,8,16,.96);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:100;}
.home{padding:32px;max-width:1020px;margin:0 auto;}
.greet-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:14px;}
.greet-left{display:flex;align-items:center;gap:14px;}
.avatar{width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--teal));display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#000;border:2px solid rgba(200,168,75,.25);flex-shrink:0;}
.greet-name{font-size:24px;font-weight:800;color:var(--cream);line-height:1.2;}
.greet-sub{font-size:13px;color:var(--cream-40);}
.greet-right{display:flex;align-items:center;gap:10px;}
.streak-chip{display:flex;align-items:center;gap:6px;padding:7px 14px;background:rgba(200,168,75,.08);border:1px solid rgba(200,168,75,.2);border-radius:20px;}
.streak-chip span:last-child{font-size:13px;font-weight:700;color:var(--gold);}
.notif-btn{width:38px;height:38px;border-radius:12px;background:var(--raised);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;transition:border-color .15s;}
.notif-btn:hover{border-color:var(--gold);}
.plan-chip{padding:5px 12px;border-radius:20px;font-size:10px;font-weight:700;font-family:var(--f-mono);letter-spacing:.06em;}
.hero-row{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:14px;margin-bottom:22px;}
.h-card{border-radius:20px;padding:22px;border:1px solid var(--line);background:var(--raised);cursor:pointer;transition:all .2s;position:relative;overflow:hidden;display:flex;flex-direction:column;}
.h-card:hover{transform:translateY(-2px);border-color:rgba(200,168,75,.3);}
.h-card.main{border-color:rgba(200,168,75,.2);background:linear-gradient(135deg,rgba(200,168,75,.07),rgba(200,168,75,.02));}
.h-card.main::before{content:"";position:absolute;top:-50px;right:-50px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(200,168,75,.1),transparent 70%);pointer-events:none;}
.h-eyebrow{font-size:9px;font-family:var(--f-mono);letter-spacing:.14em;color:var(--cream-30);margin-bottom:10px;text-transform:uppercase;}
.h-icon{font-size:34px;margin-bottom:10px;}
.h-title{font-size:18px;font-weight:800;color:var(--cream);margin-bottom:6px;line-height:1.25;}
.h-body{font-size:12px;color:var(--cream-50);line-height:1.7;flex:1;margin-bottom:14px;}
.h-quote{font-size:13px;font-style:italic;color:var(--gold);line-height:1.7;flex:1;margin-bottom:14px;}
.h-prog{height:3px;background:rgba(255,255,255,.06);border-radius:3px;margin-bottom:4px;overflow:hidden;}
.h-prog-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--gold),var(--teal));}
.h-prog-label{font-size:10px;color:var(--cream-40);margin-bottom:12px;}
.h-view-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid rgba(200,168,75,.25);background:transparent;color:var(--gold);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;}
.h-view-btn:hover{background:rgba(200,168,75,.08);}
.h-resume-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:12px;background:var(--gold);color:#000;font-size:13px;font-weight:700;border:none;cursor:pointer;transition:all .2s;}
.h-resume-btn:hover{background:#e0c65a;}
.qa-row{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:26px;}
.qa-card{padding:16px 10px;border-radius:16px;background:var(--raised);border:1px solid var(--line);cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:9px;text-align:center;}
.qa-card:hover{border-color:rgba(200,168,75,.3);transform:translateY(-2px);}
.qa-ico{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:21px;transition:transform .2s;}
.qa-card:hover .qa-ico{transform:scale(1.1);}
.qa-lbl{font-size:10.5px;font-weight:600;color:var(--cream-50);line-height:1.3;}
.sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.sec-title{font-size:16px;font-weight:700;color:var(--cream);}
.sec-link{background:none;border:none;color:var(--gold);font-size:13px;font-weight:600;cursor:pointer;}
.cat-scroll{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:26px;}
.c-card{padding:18px 14px;border-radius:17px;cursor:pointer;transition:all .2s;border:1px solid transparent;display:flex;flex-direction:column;gap:7px;}
.c-icon{font-size:28px;}.c-label{font-size:13px;font-weight:700;color:var(--cream);}.c-count{font-size:11px;}
.rec-item{display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:13px;background:var(--raised);border:1px solid var(--line);margin-bottom:9px;cursor:pointer;transition:border-color .15s;}
.rec-item:hover{border-color:rgba(200,168,75,.2);}
.rec-ico{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.rec-title{font-size:13px;font-weight:600;color:var(--cream);}.rec-sub{font-size:11px;color:var(--cream-40);}
.pg{padding:clamp(12px,4vw,20px) clamp(12px,4vw,20px) 40px;max-width:860px;margin:0 auto;}
.pg-back{background:none;border:none;color:var(--cream-40);cursor:pointer;font-size:14px;margin-bottom:18px;display:flex;align-items:center;gap:6px;}
.tool-row{display:flex;align-items:center;gap:13px;padding:13px 15px;border-radius:13px;background:var(--raised);border:1px solid var(--line);margin-bottom:9px;cursor:pointer;transition:all .2s;}
.tool-row:hover{border-color:rgba(200,168,75,.2);transform:translateX(3px);}
.tr-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;}
.tr-lbl{font-size:13.5px;font-weight:600;color:var(--cream);flex:1;}
.tool-act-bar{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;}
.t-btn{display:flex;align-items:center;gap:6px;padding:9px 17px;border-radius:10px;border:1px solid var(--line);background:var(--raised);color:var(--cream-50);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;}
.t-btn:hover{border-color:var(--gold);color:var(--gold);}.t-btn.pri{background:var(--gold);color:#000;border-color:var(--gold);}
.followup{padding:16px;border-radius:14px;background:var(--raised);border:1px solid var(--line);margin-top:16px;}
.followup label{font-size:9px;font-family:var(--f-mono);letter-spacing:.12em;color:var(--cream-30);display:block;margin-bottom:9px;text-transform:uppercase;}
.fu-row{display:flex;gap:8px;}
.fu-input{flex:1;background:var(--midnight);border:1px solid var(--line);border-radius:10px;padding:10px 13px;color:var(--cream);font-size:13px;outline:none;}
.fu-input:focus{border-color:var(--gold);}
@media(min-width:1025px){
  .sidebar{display:flex!important;}.main-area{margin-left:220px!important;}}
@media(max-width:1024px){
  .sidebar{display:none!important;width:0!important;}
  .main-area{margin-left:0!important;width:100%!important;max-width:100vw!important;}
  .bot-nav{display:none!important;}.mob-top{display:flex;}.nav{display:none!important;}.home-greet{display:none!important;}
  .home{padding:14px 14px 84px;}.hero-row{grid-template-columns:1fr;}.qa-row{grid-template-columns:repeat(3,1fr);}
  .cat-scroll{grid-template-columns:repeat(2,1fr);}.pg{padding:14px 14px 84px;}.greet-name{font-size:20px;}
}
@media(min-width:901px){.mob-top{display:none!important;}.bot-nav{display:none!important;}}
@media(max-width:480px){.qa-row{grid-template-columns:repeat(3,1fr);gap:7px;}.qa-card{padding:12px 7px;}}

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
// Tabs grouped by category — rendered as a single scrollable row
// but with a thin category label above each group for orientation

const CATEGORIES=[
  {id:"social",  label:"Social & People", icon:"❤️", color:"#e05c6e",desc:"Relationships & people skills",    tools:["relationshipiq","smalltalk","peopledecoder","hardconvo","parenting","confidencelab"]},
  {id:"money",   label:"Money+",          icon:"💰", color:"#c8a84b",desc:"Build wealth & financial intelligence", tools:["money","earnonline","business","lifehacks","debtfreedom","sidehustle","investment101","jimrohn"]},
  {id:"mindset", label:"Mindset",         icon:"🧠", color:"#9b72cf",desc:"Rewire how you think",              tools:["mindsettenx","success","fearaudit","dailywisdom","innerpeace","angerstress"]},
  {id:"body",    label:"Body",            icon:"💪", color:"#4db6ac",desc:"Fuel and move your body",           tools:["nogym","posture","bodyfuel","glowup"]},
  {id:"wellness",label:"Wellness",        icon:"🌿", color:"#81c784",desc:"Mental & emotional health",         tools:["innerpeace","sleepcoach","anxietytool","griefloss","angerstress"]},
  {id:"purpose", label:"Purpose",         icon:"🚀", color:"#64b5f6",desc:"Define your direction & legacy",    tools:["visionboard","legacyletter","morningritual","lettertoself","dreaminterp","weeklychallenge"]},
  {id:"skills",  label:"Skills & Career", icon:"⚡", color:"#ffd54f",desc:"Level up professionally",           tools:["invest","discipline","career","negotiation","digitallife"]},
  {id:"plan",    label:"Plan & Decide",   icon:"🗺️", color:"#ff8a65",desc:"Strategic planning & decisions",   tools:["roadmap","decisions","relocate","advisor"]},
];
const TOOL_META={
  relationshipiq:{label:"Relationship IQ", icon:"🤝",cat:"social", color:"#e05c6e"},
  smalltalk:     {label:"Small Talk",       icon:"💬",cat:"social", color:"#e05c6e"},
  peopledecoder: {label:"People Decoder",   icon:"🧩",cat:"social", color:"#e05c6e"},
  hardconvo:     {label:"Hard Conversation",icon:"🗣️",cat:"social", color:"#e05c6e"},
  parenting:     {label:"Parenting",        icon:"👨‍👧",cat:"social", color:"#e05c6e"},
  confidencelab: {label:"Confidence Lab",   icon:"🦁",cat:"social", color:"#e05c6e"},
  money:         {label:"Money",            icon:"💰",cat:"money",  color:"#c8a84b"},
  earnonline:    {label:"Earn Online",      icon:"🌐",cat:"money",  color:"#c8a84b"},
  business:      {label:"Business",         icon:"📦",cat:"money",  color:"#c8a84b"},
  lifehacks:     {label:"Life Hacks",       icon:"💡",cat:"money",  color:"#c8a84b"},
  debtfreedom:   {label:"Debt Freedom",     icon:"⛓️",cat:"money",  color:"#c8a84b"},
  sidehustle:    {label:"Side Hustle",      icon:"📊",cat:"money",  color:"#c8a84b"},
  investment101: {label:"Investment 101",   icon:"📈",cat:"money",  color:"#c8a84b"},
  jimrohn:       {label:"Jim Rohn",         icon:"📚",cat:"money",  color:"#c8a84b"},
  mindsettenx:   {label:"10x Mindset",      icon:"◇", cat:"mindset",color:"#9b72cf"},
  success:       {label:"Get Successful",   icon:"🔥",cat:"mindset",color:"#9b72cf"},
  fearaudit:     {label:"Fear Audit",       icon:"🔍",cat:"mindset",color:"#9b72cf"},
  dailywisdom:   {label:"Daily Wisdom",     icon:"💎",cat:"mindset",color:"#9b72cf"},
  innerpeace:    {label:"Inner Peace",      icon:"🕊️",cat:"mindset",color:"#9b72cf"},
  angerstress:   {label:"Anger & Stress",   icon:"🌊",cat:"mindset",color:"#9b72cf"},
  nogym:         {label:"No-Gym Workout",   icon:"💪",cat:"body",   color:"#4db6ac"},
  posture:       {label:"Posture & Energy", icon:"⚡",cat:"body",   color:"#4db6ac"},
  bodyfuel:      {label:"Body Fuel",        icon:"🥗",cat:"body",   color:"#4db6ac"},
  glowup:        {label:"Glow Up",          icon:"✨",cat:"body",   color:"#4db6ac"},
  sleepcoach:    {label:"Sleep Coach",      icon:"🌙",cat:"wellness",color:"#81c784"},
  anxietytool:   {label:"Anxiety Toolkit",  icon:"🛡️",cat:"wellness",color:"#81c784"},
  griefloss:     {label:"Grief & Loss",     icon:"🌱",cat:"wellness",color:"#81c784"},
  visionboard:   {label:"Vision Board",     icon:"🗺️",cat:"purpose",color:"#64b5f6"},
  legacyletter:  {label:"Legacy Letter",    icon:"📜",cat:"purpose",color:"#64b5f6"},
  morningritual: {label:"Morning Ritual",   icon:"🌅",cat:"purpose",color:"#64b5f6"},
  lettertoself:  {label:"Letter to Self",   icon:"✉️",cat:"purpose",color:"#64b5f6"},
  dreaminterp:   {label:"Dream Interpreter",icon:"🌙",cat:"purpose",color:"#64b5f6"},
  weeklychallenge:{label:"Weekly Challenge",icon:"🎲",cat:"purpose",color:"#64b5f6"},
  invest:        {label:"Invest in You",    icon:"📗",cat:"skills", color:"#ffd54f"},
  discipline:    {label:"Daily Discipline", icon:"⏰",cat:"skills", color:"#ffd54f"},
  career:        {label:"Career Path",      icon:"◇", cat:"skills", color:"#ffd54f"},
  negotiation:   {label:"Negotiation",      icon:"🎯",cat:"skills", color:"#ffd54f"},
  digitallife:   {label:"Digital Life",     icon:"📱",cat:"skills", color:"#ffd54f"},
  roadmap:       {label:"My Roadmap",       icon:"⟶",cat:"plan",   color:"#ff8a65"},
  decisions:     {label:"Big Decisions",    icon:"◈", cat:"plan",   color:"#ff8a65"},
  relocate:      {label:"Relocate",         icon:"✦", cat:"plan",   color:"#ff8a65"},
  advisor:       {label:"My Advisor",       icon:"⬡", cat:"plan",   color:"#ff8a65"},
};
function getGreeting(){const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening";}
const MODULE_GROUPS=[
  {
    group:"Your Dashboard",
    color:"var(--gold)",
    items:[
      {id:"today",    icon:"◎", label:"My Report"},
      {id:"momentum", icon:"⚡", label:"Check-in"},
      {id:"wins",     icon:"🏆", label:"Wins"},
      {id:"progress", icon:"📈", label:"Progress"},
      {id:"practices",icon:"✓", label:"My Practices"},
      {id:"weekly",   icon:"↗", label:"Weekly Pulse"},
    ],
  },
  {
    group:"Make Money",
    color:"var(--teal)",
    items:[
      {id:"money",    icon:"💰", label:"Money"},
      {id:"online",   icon:"🌐", label:"Earn Online"},
      {id:"business", icon:"🏗️", label:"Business"},
      {id:"hacks",    icon:"💡", label:"Life Hacks"},
      {id:"jimrohn",  icon:"📜", label:"Jim Rohn"},
    ],
  },
  {
    group:"Level Up",
    color:"#9b72cf",
    items:[
      {id:"invest",    icon:"📊", label:"Invest in You"},
      {id:"success",   icon:"🔥", label:"Get Successful"},
      {id:"discipline",icon:"⏰", label:"Daily Discipline"},
      {id:"mindset10x",icon:"🧠", label:"10x Mindset"},
      {id:"mindset",   icon:"◇", label:"Inner Mindset"},
      {id:"career",    icon:"◈", label:"Career Path"},
    ],
  },
  {
    group:"Plan & Decide",
    color:"var(--rose)",
    items:[
      {id:"roadmap",  icon:"⟶", label:"My Roadmap"},
      {id:"decisions",icon:"◈", label:"Decisions"},
      {id:"relocate", icon:"✦", label:"Relocate"},
      {id:"advisor",  icon:"⬡", label:"My Advisor"},
    ],
  },
  {
    group:"Wellbeing",
    color:"#4db6ac",
    items:[
      {id:"innerpeace",  icon:"🕊️", label:"Inner Peace"},
      {id:"angerstress",  icon:"🌊", label:"Anger & Stress"},
      {id:"sleepcoach",  icon:"🌙", label:"Sleep Coach"},
      {id:"anxietytool", icon:"🛡️", label:"Anxiety Toolkit"},
      {id:"griefloss",   icon:"🌱", label:"Grief & Loss"},
    ],
  },
  {
    group:"Body & Style",
    color:"#f06292",
    items:[
      {id:"glowup",    icon:"✨", label:"Glow Up"},
      {id:"nogym",     icon:"💪", label:"No-Gym Workout"},
      {id:"posture",   icon:"⚡", label:"Posture & Energy"},
      {id:"bodyfuel",  icon:"🥗", label:"Body Fuel"},
    ],
  },
  {
    group:"Social & Life",
    color:"#64b5f6",
    items:[
      {id:"confidencelab",  icon:"🦁", label:"Confidence Lab"},
      {id:"relationshipiq", icon:"🤝", label:"Relationship IQ"},
      {id:"smalltalk",      icon:"💬", label:"Small Talk"},
      {id:"negotiation",    icon:"🎯", label:"Negotiation"},
      {id:"digitallife",    icon:"📱", label:"Digital Life"},
      {id:"parenting",      icon:"👨‍👧", label:"Parenting Corner"},
    ],
  },
  {
    group:"Money Deep Dives",
    color:"#ffd54f",
    items:[
      {id:"debtfreedom",    icon:"⛓️", label:"Debt Freedom"},
      {id:"sidehustle",     icon:"📊", label:"Side Hustle"},
      {id:"investment101",  icon:"📈", label:"Investment 101"},
    ],
  },
  {
    group:"Purpose",
    color:"#ce93d8",
    items:[
      {id:"visionboard",    icon:"🗺️", label:"Vision Board"},
      {id:"legacyletter",   icon:"📜", label:"Legacy Letter"},
      {id:"fearaudit",      icon:"🔍", label:"Fear Audit"},
      {id:"morningritual",  icon:"🌅", label:"Morning Ritual"},
      {id:"dailywisdom",    icon:"💎", label:"Daily Wisdom"},
      {id:"lettertoself",   icon:"✉️", label:"Letter to Self"},
    ],
  },
  {
    group:"Discover",
    color:"#80cbc4",
    items:[
      {id:"dreaminterp",   icon:"🌙", label:"Dream Interpreter"},
      {id:"peopledecoder", icon:"🧩", label:"People Decoder"},
      {id:"hardconvo",     icon:"🗣️", label:"Hard Conversation"},
      {id:"weeklychallenge",icon:"🎲",label:"Weekly Challenge"},
    ],
  },
];
// Flat list kept for backward compatibility (tab persistence, etc.)
const MODULES = MODULE_GROUPS.flatMap(g=>g.items);
const LOADING_PHRASES=["Reading what you shared…","Thinking about your situation…","Writing your roadmap…","Looking at what's really possible for you…","Almost there…","One moment more…"];

function urlBase64ToUint8Array(base64String){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const rawData=window.atob(base64);
  const out=new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;i++) out[i]=rawData.charCodeAt(i);
  return out;
}

function sanitize(s){
  if(typeof s!=="string") return "";
  return s.replace(/<[^>]*>/g,"").replace(/[^\w\s.,!?'"()\-:;@#%+=/]/g,"").slice(0,2000).trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════
async function callAPI({messages,system,userId,isPremium,isProMax,maxTokens}){
  if(!messages?.length||!system) throw new Error("Invalid payload");
  // Get the current session token so the server can verify this is a real logged-in user
  let session=null;
  try{ const{data}=await supabase.auth.getSession(); session=data?.session; }catch{}
  const res=await fetch("/api/analyze",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      ...(session?.access_token?{"Authorization":`Bearer ${session.access_token}`}:{}),
    },
    body:JSON.stringify({
      system: (system||"") + `

CRITICAL WRITING RULES — FOLLOW EXACTLY:
1. Write like a brilliant, warm friend who has studied this person deeply — not a consultant, coach or therapist
2. Use their name naturally once or twice where it feels right — not every sentence
3. ZERO markdown: no # headers, no ** bold, no * bullets, no numbered lists, no --- dividers
4. Write in flowing paragraphs only. Use line breaks to separate thoughts naturally
5. Be honest and direct, even when uncomfortable — but always kind and never clinical
6. Reference their specific country, situation, income level, and goals directly
7. Never end with "I hope this helps" or "feel free to reach out" or any generic closer
8. End with ONE clear specific action — not a list, just one thing
9. Speak to them like they are intelligent — no over-explaining
10. If you don't have a detail, work with what you have — NEVER ask them to update their profile` + langPrompt(),
      messages,
      max_tokens: maxTokens||(isProMax?6000:isPremium?4000:1800)
    }),
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
        model:"claude-haiku-4-5-20251001",
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

// ═══════════════════════════════════════════════════════════════════════════════
// ADVISOR SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════
function buildAdvisorSystem(profile,reportData,isPremium,memCtx){
  const name    = profile?.name    ||"there";
  const country = profile?.country ||"their country";
  const scores  = reportData?.scores;
  const scoreStr= scores
    ?`Life: ${scores.life||"?"}/100, Wealth: ${scores.wealth||"?"}/100, Mindset: ${scores.mindset||"?"}/100, Relationships: ${scores.relations||"?"}/100`
    :"not yet generated";
  const {code:currCode,symbol:currSym} = getLocalCurrency(country);
  return `You are ${name}'s personal AI companion at DestinIQ — part close friend, part life coach. You know their full story from their profile.

THEIR PROFILE:
${buildProfileContext(profile)}

THEIR SCORES: ${scoreStr}
${memCtx?`\nEARLIER IN THIS CONVERSATION:\n${memCtx}`:""}

CURRENCY: Local costs = ${currSym} (${currCode}). International income = USD + ${currSym} equivalent.

HOW TO SHOW UP IN THIS CONVERSATION:
- If they say hello, how are you, what's up, or just want to chat → respond warmly and casually like a real friend would. Ask how they're doing. Do NOT immediately jump into coaching or goals. Just be present.
- If they share something difficult or emotional → listen first. Reflect back what you're hearing. Ask one good question before offering any advice.
- If they ask for coaching, feedback, or what to do → give your most honest, specific, deeply personalised guidance. Reference their actual situation. Use their name naturally.
- Match their energy. Short message → short reply. Deep question → go deep.
- Never give generic advice. Everything is specific to ${name} in ${country}.
- You remember everything said earlier in this conversation. Refer back to it naturally.
${isPremium?`- Give your fullest, most detailed thinking. They have full access.`:`- Give real value, but let them know deeper analysis is available if they want to go further.`}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION PROMPT
// ═══════════════════════════════════════════════════════════════════════════════
function buildDecisionPrompt(profile,question,isPremium,memCtx){
  const name    = profile?.name    ||"the user";
  const country = profile?.country ||"their country";
  const goals   = profile?.goals   ||profile?.bigGoal||"";
  const challenge=profile?.challenge||"";
  const {code:currCode,symbol:currSym} = getLocalCurrency(country);

  return `${name} from ${country} needs help with a decision.

Their goal: ${goals}
Their main challenge: ${challenge}
${memCtx?`Context from previous conversations:
${memCtx}
`:""}
CURRENCY RULE: Any costs, prices, investments, or amounts = ${currCode} (${currSym}). Online earnings = USD + local equivalent.

THE DECISION THEY ARE FACING:
${question}

Analyse this decision for ${name} specifically. Consider:
1. What does this mean for their specific situation in ${country}? Include real amounts in ${currSym} where relevant.
2. What are the real risks vs upside — be honest about both. Use real numbers in ${currSym}.
3. What would you tell them if you had to make this decision for them?
4. What's the one thing they should do in the next 48 hours?

Be direct. Be specific to their situation in ${country}. No generic frameworks.${isPremium?" Give your fullest analysis.":""}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY PULSE PROMPT
// ═══════════════════════════════════════════════════════════════════════════════
function buildWeeklyPrompt(profile,momentumLog,isPremium,memCtx){
  const name    = profile?.name    ||"the user";
  const country = profile?.country ||"their country";
  const goals   = profile?.goals   ||profile?.bigGoal||"their goals";
  const challenge=profile?.challenge||"their challenges";
  const {code:currCode,symbol:currSym} = getLocalCurrency(country);

  // Summarise the last 7 check-ins
  const recentLog=momentumLog?momentumLog.slice(-7):[];
  const logSummary=recentLog.length>0
    ? recentLog.map(e=>`${e.date}: energy ${e.energy}/10, focus ${e.focus}/10, feeling: ${e.feeling||"not logged"}`).join("\n")
    : "No check-ins logged this week";

  return `Write a weekly pulse report for ${name} in ${country}.

Their goal: ${goals}
Their main challenge: ${challenge}
CURRENCY: All money amounts = ${currCode} (${currSym}). Online earnings = USD + local equivalent.
${memCtx?`Recent context: ${memCtx}
`:""}
THEIR LAST 7 CHECK-INS:
${logSummary}

Write a personalised weekly reflection covering:
1. What the pattern in their check-ins this week reveals about where they actually are
2. One specific thing they did well this week (even if small)
3. One honest thing that needs to shift next week
4. Their focus for the next 7 days — one clear priority. Include a specific action with any costs in ${currSym}.

Write in plain prose. Be warm but direct. Use their name. All amounts in ${currSym}.${isPremium?" Go deep.":""}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK-IN PROMPT
// ═══════════════════════════════════════════════════════════════════════════════
function buildCheckinPrompt(profile,entry,reportData,isPremium,memCtx){
  const name    = profile?.name    ||"the user";
  const country = profile?.country ||"their country";
  const goals   = profile?.goals   ||profile?.bigGoal||"their goals";
  const energy  = entry?.energy    ||5;
  const focus   = entry?.focus     ||5;
  const momentum= entry?.momentum  ||5;
  const feeling = entry?.feeling   ||"neutral";
  const note    = entry?.note      ||"";
  const overall = reportData?.overall||50;
  const {code:currCode,symbol:currSym} = getLocalCurrency(country);

  return `${name} from ${country} has just completed their daily check-in at DestinIQ. Respond as their personal advisor.

THEIR PROFILE:
- Goal: ${goals}
- Report overall score: ${overall}/100
- If mentioning money: costs = ${currCode} (${currSym}), online earnings = USD
${memCtx?`- Recent context: ${memCtx}`:""}

TODAY'S CHECK-IN:
- Energy: ${energy}/10
- Focus: ${focus}/10
- Momentum: ${momentum}/10
- How they're feeling: ${feeling}
${note?`- Their note: "${note}"`:""}

Write a SHORT personal response (3-5 sentences max):
1. Acknowledge how they're actually feeling today — validate it without being sycophantic
2. One specific observation about what today's numbers tell you about their week
3. One concrete thing they can do TODAY to move forward given how they feel

Plain text, warm tone, personal. Use their name once. No headers or lists.${isPremium?" Be specific and insightful.":""}`
}

function buildAnalysisPrompt(f,isPremium,memCtx,ipLocation,localContext){
  const today=new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const ageNum=parseInt(f.age)||26;
  const incomeHint={"Under $500":18,"$500–$1,500":34,"$1,500–$4,000":54,"$4,000–$10,000":72,"$10,000+":86}[f.income]||45;
  const wB=Math.max(14,Math.min(88,incomeHint+Math.floor(Math.random()*12)-6));
  const lB=Math.max(22,Math.min(90,44+(ageNum<25?13:ageNum<32?9:ageNum<42?5:1)+Math.floor(Math.random()*14)-7));
  const mB=Math.max(18,Math.min(87,48+Math.floor(Math.random()*22)-11));
  const rB=Math.max(22,Math.min(92,54+Math.floor(Math.random()*20)-10));

  const country=f.country||"their country";
  const name=f.name||"the user";
  const skills=f.skills||"general skills";
  const goal=f.goals||"financial freedom";
  const challenge=f.challenge||"getting started";
  const income=f.income||"Under $500";
  const situation=f.situation||"figuring things out";
  const loc=ipLocation?.city?`${ipLocation.city}, ${country}`:country;

  // Currency rules baked in
  // Resolve local currency for this user's country
  const {code:currCode, symbol:currSym} = getLocalCurrency(country);
  const currencyNote=`MANDATORY CURRENCY RULES:
COSTS/SAVINGS/STARTUP = LOCAL CURRENCY ONLY: ${country} uses ${currCode} (${currSym}). Write ALL prices, rents, costs in ${currSym}. NEVER use $ for costs in ${country}.
EARNINGS FROM ONLINE WORK = USD. Earnings on Upwork/Fiverr/remote = USD, add local equivalent in brackets e.g. "$500 (${currSym}3,500/month)".`;

  return `Today is ${today}. You are writing a deeply personal, brutally honest, genuinely useful life report for ONE specific person. Not a template. Not generic. Everything below must feel like it was written by someone who spent 2 hours studying this person's situation.

PERSON:
- Name: ${name}, Age: ${ageNum}, Location: ${loc}
- Current situation: ${situation}${f.career?`, specifically: ${f.career}`:""}
- Monthly income: ${income}
- Skills: ${skills}
- Education: ${f.education||"not specified"}
- Relationship: ${f.relationship||"not specified"}
- Daily habits: ${f.habits||"not specified"}
- Main goal: ${goal}
- Biggest challenge: ${challenge}
- What they want from DestinIQ: ${f.wantFrom||"clarity and direction"}
${memCtx?`\nCONTEXT FROM PREVIOUS SESSIONS:\n${memCtx}`:""}
${localContext?`\nLIVE LOCAL CONTEXT FOR ${country.toUpperCase()}:\n${localContext}`:""}

SCORES (use these EXACT numbers — do not change them):
life=${lB}, wealth=${wB}, mindset=${mB}, relations=${rB}

CURRENCY RULE (MANDATORY): ${currencyNote}

Return ONLY a single valid JSON object. No markdown. No code fences. Start with { end with }. Every string field must be complete — never truncate mid-sentence.

JSON SCHEMA (fill every field with REAL, DEEP, SPECIFIC content):
{
  "overall": ${Math.round(lB*0.25+wB*0.30+mB*0.25+rB*0.20)},
  "scores": {"life":${lB},"wealth":${wB},"mindset":${mB},"relations":${rB}},
  "score_explanations": {
    "life": "2 sentences explaining the ${lB}/100 life score. Be specific about ${name}'s situation.",
    "wealth": "2 sentences explaining the ${wB}/100 wealth score. Reference their income of ${income} in ${country}.",
    "mindset": "2 sentences explaining the ${mB}/100 mindset score. Reference their challenge: '${challenge}'.",
    "relations": "2 sentences explaining the ${rB}/100 relationships score."
  },
  "headline": "2 sentences that sound like truth, not a summary. Name ${name}, their age ${ageNum}, location ${loc}, and the exact tension between where they are and what they want. Use their own words back at them. Be direct.",
  "greeting": "3 sentences. Acknowledge what they said about their challenge. Make them feel truly heard. Tell them what this report is going to do for them.",
  "teaser": "One specific thing from their profile that reveals something important about them that they may not have named yet.",
  "daily_insight": "3 sentences for TODAY specifically. Sentence 1: Name their specific challenge in their words. Sentence 2: One concrete action today with a real local example (real platform name, real local amount). Sentence 3: Something that makes them feel less alone.",
  "life": "DEEP paragraph: What is ${name}'s life situation really telling us? What pattern do you see? What is the real gap between where they are and where they want to be? Be specific. Name their country, their income, their age. Minimum 4 sentences.",
  "wealth": "DEEP paragraph: What is ${name}'s real financial picture? What specific moves should they make given ${income} income in ${country}? Name real local banks, real savings rates, real amounts in local currency. What is the one financial habit that will change everything for them? Minimum 4 sentences.",
  "mindset": "DEEP paragraph: What mental pattern is keeping ${name} stuck? What is the story they tell themselves? What is the reframe that actually works? Give them one morning practice that is specific to their situation. Minimum 4 sentences.",
  "relationships": "DEEP paragraph: How are ${name}'s relationships (or lack of them) affecting their progress? What type of person do they need in their corner right now? What should they stop tolerating? Minimum 3 sentences.",
  "closing": "2 powerful sentences. Tell ${name} what you believe about their ability to change their situation. Make it honest — not motivational poster. Make it feel personal.",
  "strengths": [
    "Strength 1: A specific thing ${name} already has — skill, mindset, circumstance, or resource — that they are not fully using. 1 sentence, specific.",
    "Strength 2: Another real asset in ${name}'s profile. Not generic. Reference something they actually said.",
    "Strength 3: A third genuine strength or advantage ${name} has right now."
  ],
  "risks": [
    "Risk 1: The most likely thing that will derail ${name} if they do not watch for it. Be direct.",
    "Risk 2: A second specific trap or blindspot for someone in ${name}'s situation.",
    "Risk 3: A habit or belief that is quietly working against ${name}'s goal right now."
  ],
  "sections": [
    {"title": "The Real Picture", "content": "What is actually going on in ${name}'s life right now — beneath the surface? Connect their income, age, country, goals, and challenge into one coherent honest picture."},
    {"title": "What ${name} Has That They Are Not Using", "content": "Name 2-3 specific strengths or resources in their profile they are underutilising. Be specific about HOW they can use each one."},
    {"title": "The Next 30 Days", "content": "What are the 3 most important things ${name} should do in the next 30 days? Be specific. Name real tools, real platforms, real amounts in local currency."}
  ],
  "roadmap": [
    {
      "phase": "Days 1–30",
      "title": "One specific, compelling title for this phase based on ${name}'s goal",
      "desc": "DEEP explanation — what is happening in this phase, why it matters, what ${name} will feel. 3-4 sentences. Personal to their situation.",
      "steps": ["Specific step 1 with real action, real tool, real amount in ${country}'s currency","Specific step 2","Specific step 3","Specific step 4","Specific step 5"],
      "win": "The specific thing ${name} will have achieved by the end of this phase."
    },
    {
      "phase": "Days 31–90",
      "title": "Phase 2 title",
      "desc": "Deep explanation of this phase. What changes. What gets harder. What gets clearer.",
      "steps": ["Step 1","Step 2","Step 3","Step 4"],
      "win": "What ${name} has by end of this phase."
    },
    {
      "phase": "Months 4–12",
      "title": "Phase 3 title",
      "desc": "Deep explanation. This is where real momentum builds. What does ${name}'s life look like?",
      "steps": ["Step 1","Step 2","Step 3","Step 4"],
      "win": "Tangible outcome by month 12."
    }
  ],
  "mindset": {
    "pattern": "The specific mental pattern holding ${name} back. Name it clearly. Give an example of how it shows up in their life. 2-3 sentences.",
    "reframe": "The exact opposite of that pattern — but not toxic positivity. A realistic reframe that actually makes sense for their situation. 2-3 sentences.",
    "emotional": "What is really happening emotionally for ${name} right now. What are they not saying but feeling? 2-3 sentences.",
    "practice": "One morning practice that is specific to ${name}'s challenge. Not generic meditation — something specific. E.g.: Write down the one thing you kept putting off yesterday and do it in the first 30 minutes today. Why this works for their specific situation."
  },
  "career": [
    {
      "title": "Career path 1 — specific to ${name}'s skills (${skills}) in ${country}",
      "type": "job or freelance or business",
      "timeline": "e.g. 2–4 months to first income",
      "effort": "Low, Medium, or High",
      "income": "Realistic earnings — show BOTH: USD for international work e.g. '$500–1,200/month' AND local equivalent e.g. '(GH₵7,500–18,000/month)'. Startup costs in ${currSym} only.",
      "why": "Why this specific path fits ${name}'s exact profile. Reference their skills, their country, their income situation. 2-3 sentences.",
      "how": ["Exact step 1 with real platform/tool/contact and any cost in ${currSym}","Exact step 2","Exact step 3","Exact step 4","Exact step 5"]
    },
    {
      "title": "Career path 2 — different type from path 1",
      "type": "different type",
      "timeline": "timeline",
      "effort": "effort level",
      "income": "income range",
      "why": "Why this fits. Personal to ${name}.",
      "how": ["Step 1","Step 2","Step 3","Step 4","Step 5"]
    },
    {
      "title": "Career path 3 — highest ceiling option",
      "type": "business or senior role",
      "timeline": "6–18 months",
      "effort": "High",
      "income": "income range",
      "why": "Why this is the highest-ceiling option for ${name}.",
      "how": ["Step 1","Step 2","Step 3","Step 4"]
    }
  ],
  "life_hacks": [
    "MONEY HACK (${country}): [Real shortcut to save or earn money in ${country}. Name the exact app, market, bank, or method. Include a specific amount in ${currSym}. E.g. 'Buy data bundles weekly not daily on MTN — saves GH₵ 40/month. Go to *170# → Buy Bundle.']",
    "FOOD HACK (${country}): [Real way to eat better and cheaper in ${country}. Name real markets, specific foods, real prices in ${currSym}. Not generic — specific to what people actually eat in ${country}.]",
    "TIME HACK: [A real system or tool for getting more done. Not 'make a to-do list' — something specific like 'use the 2-minute rule: if it takes under 2 minutes, do it now. This alone eliminates 80% of procrastinated tasks.' Reference a real free app if applicable.]",
    "PHONE/DATA HACK (${country}): [Specific shortcut using the phone or internet that people in ${country} overlook. Could be a USSD code, a local app, a WhatsApp trick, a free service. Real and local.]",
    "HEALTH HACK: [Practical health shortcut that costs little or nothing and is realistic for someone at ${income} income. Not a gym — real and achievable. E.g. 'Walk for 20 minutes after your evening meal — not morning when it's hard. Studies show post-meal walking reduces blood sugar spikes by 30% and improves sleep.']",
    "SKILL HACK: [A real shortcut for learning or improving a skill faster. Name a specific free resource, platform, or method. E.g. 'YouTube is a free university — search your skill + tutorial + 2024. Watch 30 minutes every evening instead of scrolling. In 6 months you will be ahead of people who did 4-year degrees in that skill.']",
    "RELATIONSHIP/NETWORK HACK (${country}): [A real, specific action to build better relationships or a stronger network in ${country}. Reference where people in ${country} actually meet: churches, markets, WhatsApp groups, alumni networks, coworking spaces, events. Specific and local.]"
  ],
  "emotional_strength": [
    "Practice 1: Specific to ${name}'s challenge: '${challenge}'.",
    "Practice 2: For when things are not working.",
    "Practice 3: For staying consistent when motivation is gone."
  ],
  "money_protection": {
    "rule": "The single most important money rule for ${name} given ${income} income in ${country}. Specific. Not 'save more'.",
    "savings_target": "Specific savings target per month in ${country}'s local currency. Real number. E.g. GH₵ 200/month in a separate account.",
    "avoid": "The 2-3 specific money drains that people at ${name}'s income level in ${country} fall into. Name them.",
    "first_investment": "The first investment ${name} should make given their income. Real product or vehicle available in ${country}. Local currency."
  },
  "online_income": [
    {
      "method": "Platform/method 1 — most accessible given ${name}'s skills (${skills}) in ${country}",
      "why_it_works": "Why this works specifically for someone in ${country} with ${name}'s background. What demand exists. 2 sentences.",
      "url": "https://exact-real-url.com",
      "first_step": "Exact first step to sign up and get a first paying client. Specific. Realistic timeline.",
      "earnings": "Realistic monthly earnings for a beginner in USD",
      "local_equivalent": "Same amount in ${country}'s local currency"
    },
    {
      "method": "Platform/method 2 — different from method 1",
      "why_it_works": "Why this works for ${name}.",
      "url": "https://exact-real-url.com",
      "first_step": "Exact first step.",
      "earnings": "Realistic earnings in USD",
      "local_equivalent": "Local currency equivalent"
    },
    {
      "method": "Platform/method 3 — highest earning potential",
      "why_it_works": "Why this is the highest ceiling for ${name}.",
      "url": "https://exact-real-url.com",
      "first_step": "First step.",
      "earnings": "Earnings in USD",
      "local_equivalent": "Local currency"
    }
  ],
  "zero_income_business": {
    "idea": "Specific business idea that is genuinely viable in ${country} with zero capital. Consider what people in ${country} buy every day. Could be food joint, bar, clothing, services, anything. Must be real.",
    "why_zero": "Why this idea needs zero capital to start. What exactly they do on day 1 with no money.",
    "day_one": "Exact action on day 1. What do they do, where do they go, who do they talk to, in ${country}.",
    "first_revenue": "Realistic first revenue. When, how much in local currency, from whom.",
    "scale": "How this grows from a one-person operation to something that employs people. Real path in ${country}.",
    "alternatives": [
      "Alternative zero-capital idea 1 for ${country} — completely different sector",
      "Alternative zero-capital idea 2 for ${country}",
      "Alternative zero-capital idea 3 — food, beverage, or hospitality if relevant to ${country}",
      "Alternative zero-capital idea 4 — services or skills-based",
      "Alternative zero-capital idea 5 — trading or reselling"
    ]
  },
  "product_business": [
    {
      "product": "Product 1 — something people in ${country} buy every day",
      "why": "Why this product sells in ${country}. Real demand. Real market.",
      "startup_cost": "Realistic startup cost in ${country}'s local currency",
      "profit_margin": "Realistic margin percentage",
      "supplier_links": ["https://www.alibaba.com","https://www.dhgate.com","https://www.1688.com"]
    },
    {
      "product": "Product 2 — different category (e.g. clothing, accessories, electronics)",
      "why": "Why this sells in ${country}.",
      "startup_cost": "Startup cost in local currency",
      "profit_margin": "Margin",
      "supplier_links": ["https://www.alibaba.com","https://www.dhgate.com"]
    },
    {
      "product": "Product 3 — consumable or fast-moving (e.g. food, cosmetics, cleaning)",
      "why": "Why this category works in ${country}.",
      "startup_cost": "Startup cost in local currency",
      "profit_margin": "Margin",
      "supplier_links": ["https://www.alibaba.com","https://www.made-in-china.com"]
    }
  ],
  "real_estate_hack": {
    "method": "Real estate income method accessible with little money in ${country}",
    "how_it_works": "How exactly this works in ${country}. What they do. Who they contact. Step by step.",
    "platform": "Real platform, website, or WhatsApp group for finding properties in ${country}",
    "first_deal": "How to get the first deal. Specific steps. Real numbers in local currency."
  },
  "relocation": [],
  "suggestedCountries": [],
  "teaser": "One sentence that reveals something ${name} has not named yet about themselves."
}`;
}


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

// ── LockGate: full section gate (paid modules) ───────────────────────────────
function LockGate({children,isPaid,onUnlock,teaser=""}){
  if(isPaid) return children;
  return(
    <div className="lock-wrap">
      <div className="lock-blur" style={{maxHeight:200,overflow:"hidden"}}>{children}</div>
      <div className="lock-gate">
        <div style={{fontSize:26,marginBottom:8}}>🔒</div>
        <div className="d3" style={{marginBottom:6,fontSize:"1em"}}>Members only</div>
        {teaser
          ? <p style={{fontSize:13,color:"var(--cream-50)",maxWidth:300,marginBottom:16,lineHeight:1.6,textAlign:"center"}}>{teaser}</p>
          : <p className="body" style={{maxWidth:300,marginBottom:16,textAlign:"center"}}>Unlock your roadmap, decisions, career paths, weekly pulse, and relocation reports.</p>}
        <button className="btn btn-gold" onClick={onUnlock}>Unlock from $9/month</button>
        <p style={{fontSize:11,color:"var(--cream-30)",marginTop:8}}>Cancel anytime · No hidden fees</p>
      </div>
    </div>
  );
}

// ── FreeGate: shows after free content when user is not paid ─────────────────
// Usage: render your items normally (sliced), then add <FreeGate> after the slice.
function FreeGate({total, freeCount, isPaid, onUnlock, label="sections"}){
  if(isPaid || total <= freeCount) return null;
  const locked = total - freeCount;
  return(
    <div style={{marginTop:10,padding:"22px 20px",background:"linear-gradient(180deg,var(--lift),var(--night))",borderRadius:16,border:"1px solid rgba(210,175,90,0.15)",textAlign:"center"}}>
      <div style={{fontSize:22,marginBottom:8}}>🔒</div>
      <div style={{fontSize:15,fontWeight:700,color:"var(--cream)",marginBottom:6}}>
        {locked} more {label} locked
      </div>
      <p style={{fontSize:13,color:"var(--cream-40)",marginBottom:16,lineHeight:1.6}}>
        Free users see {freeCount} of {total}. Upgrade to unlock all {total}.
      </p>
      <button className="btn btn-gold" onClick={onUnlock}>
        Unlock all {total} → from $9/month
      </button>
    </div>
  );
}

// ── ContentSlice: shows first N of an array with a blur gate ─────────────────
// Used for dynamic modules (Life Hacks, Earn Online etc.)
function ContentSlice({children, totalCount, freeCount=3, isPaid, onUnlock, what="items"}){
  if(isPaid || totalCount<=freeCount) return children;
  const locked = totalCount - freeCount;
  return(
    <div>
      {children}
      <div style={{marginTop:10,padding:"16px",background:"rgba(210,175,90,0.05)",border:"1px solid rgba(210,175,90,0.18)",borderRadius:12,textAlign:"center"}}>
        <div style={{fontSize:13,color:"var(--cream-50)",marginBottom:12}}>
          🔒 {locked} more {what} locked — upgrade to see all {totalCount} and refresh anytime
        </div>
        <button className="btn btn-gold" style={{fontSize:12,padding:"8px 20px"}} onClick={onUnlock}>
          Unlock all → from $9/month
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOMENTUM MODULE
// ═══════════════════════════════════════════════════════════════════════════════
function MomentumModule({profile,userId,isPremium,isProMax,streak}){
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
              <span style={{fontSize:"clamp(32px,10vw,52px)",fontWeight:800,color:scoreColor(smartScore),fontFamily:"var(--f-display)",lineHeight:1}}>{smartScore}</span>
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
        <div className="mom-stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
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
function WeeklyModule({profile,userId,isPremium,isProMax,isPaid,onUnlock}){
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
      const name=sanitize(profile?.name)||"there";
      const country=sanitize(profile?.country)||"your country";
      const goal=sanitize(profile?.goals)||"your goal";
      const challenge=sanitize(profile?.challenge)||"your challenge";
      const txt=await callAPI({messages:[{role:"user",content:buildWeeklyPrompt(profile,log,isPremium,buildMemoryContext(userId))}],isProMax,system:`You are DestinIQ's weekly pattern analyst. ${name} from ${country} is working toward "${goal}" and dealing with "${challenge}". Use that — never ask for more information or say you lack context, even if some details are brief. Be direct, specific, insightful. Never generic. Write in clean plain sentences. For action steps use numbered lists (1. 2. 3.). For patterns use bullet points (- pattern). No **bold** or # headers.`,userId,isPremium});

      // Guard against the AI declining to answer / asking for more info
      const badPhrases=["i don't have","i need more","could you share","no context","please tell","can you provide","i don't have enough","no information"];
      const isBad = !txt || txt.length<60 || badPhrases.some(p=>txt.toLowerCase().includes(p));
      const finalText = isBad
        ? `${name}, here's what this week's check-ins show: you logged in ${log.length} time${log.length!==1?"s":""}, which is itself a sign you're staying with "${goal}" instead of dropping it. The honest next step is the same one that's probably been waiting — make space for "${challenge}" this week instead of working around it. Keep checking in daily; the clearer your log gets, the sharper these reflections become.`
        : txt;

      const r={weekOf:weekLabel(),text:finalText,ts:Date.now()};
      const existing=_weeklyReports.get(userId)||[];
      existing.unshift(r);if(existing.length>4)existing.pop();
      _weeklyReports.set(userId,existing);setReport(r);
      saveWeeklyReport(userId,r); // persist to Supabase
      pushToMemory(userId,"assistant","Weekly pulse: "+finalText.slice(0,300));
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
          {isPaid&&(
  <div className="prem-badge" style={{
    background:isPremium?"linear-gradient(90deg,rgba(155,114,207,0.2),rgba(155,114,207,0.08))":"linear-gradient(90deg,rgba(210,175,90,0.15),rgba(232,203,122,0.08))",
    borderColor:isPremium?"rgba(155,114,207,0.4)":"var(--line-gold)",
    color:isPremium?"#9b72cf":"var(--gold-bright)",
  }}>
    {isPremium?"✦ PRO MAX":"◆ PRO"}
  </div>
)}
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
              <button className="btn btn-ghost btn-sm" onClick={()=>{try{localStorage.removeItem(cacheKey);}catch{}generate();}} disabled={loading}>{loading?"Refreshing…":"↺ Refresh"}</button>
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
function DecisionModule({profile,userId,isPremium,isProMax,isPaid,onUnlock}){
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
          {isPaid&&(
  <div className="prem-badge" style={{
    background:isPremium?"linear-gradient(90deg,rgba(155,114,207,0.2),rgba(155,114,207,0.08))":"linear-gradient(90deg,rgba(210,175,90,0.15),rgba(232,203,122,0.08))",
    borderColor:isPremium?"rgba(155,114,207,0.4)":"var(--line-gold)",
    color:isPremium?"#9b72cf":"var(--gold-bright)",
  }}>
    {isPremium?"✦ PRO MAX":"◆ PRO"}
  </div>
)}
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
function NotificationPanel({profile,userId,streak,onClose}){
  const isNative = typeof window!=="undefined" && window?.Capacitor?.isNativePlatform?.();
  const [times,   setTimes  ]=useState({morning:"07:00",afternoon:"13:00",evening:"20:00"});
  const [status,  setStatus ]=useState("idle"); // idle | scheduling | done | error
  const [tested,  setTested ]=useState(false);
  const [testMsg, setTestMsg]=useState("");

  const schedule=async()=>{
    setStatus("scheduling");
    try{
      // Request browser notification permission first (web only)
      if(!isNative && typeof window!=="undefined" && "Notification" in window){
        let perm="denied";
        try{ perm = await Notification.requestPermission(); }catch{ perm="denied"; }
        if(perm!=="granted"){
          setStatus("error");
          setTestMsg("Permission denied — please allow notifications in your browser/device settings, then try again.");
          return;
        }
      }
      await scheduleNotification(userId,profile?.name||"",profile?.goals||"",streak||1,times,null);
      setStatus("done");
    }catch(e){
      setStatus("error");
    }
  };

  const sendTest=async()=>{
    setTested(true);
    setTestMsg("Sending…");
    const ok = await testNotification(profile?.name||"");
    setTestMsg(ok
      ? isNative
        ? "✅ Check your notifications in 5 seconds!"
        : "✅ Check your browser notifications in 5 seconds!"
      : "❌ Failed. Make sure you allowed notifications and rebuilt the APK."
    );
    setTimeout(()=>{ setTested(false); setTestMsg(""); }, 6000);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end",
      justifyContent:"center",background:"rgba(5,6,15,0.75)",backdropFilter:"blur(8px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:"100%",maxWidth:500,background:"var(--raised)",
        borderRadius:"20px 20px 0 0",border:"1px solid var(--line-gold)",
        padding:28,animation:"slideIn .3s ease",maxHeight:"85vh",overflowY:"auto"}}>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div>
            <div className="mono" style={{marginBottom:4}}>🔔 Daily Notifications</div>
            <p className="small">{isNative
              ? "Native notifications — fire even when app is closed ✅"
              : "Browser notifications — only work while tab is open"
            }</p>
          </div>
          <button className="btn-text" onClick={onClose} style={{fontSize:18}}>✕</button>
        </div>

        {/* Status banner */}
        {isNative ? (
          <div style={{padding:"10px 14px",background:"rgba(77,182,172,0.1)",
            border:"1px solid rgba(77,182,172,0.3)",borderRadius:10,marginBottom:16,
            fontSize:12,color:"#4db6ac"}}>
            ✅ You're on the mobile app — notifications will fire even when the app is closed.
          </div>
        ):(
          <div style={{padding:"10px 14px",background:"rgba(251,191,36,0.08)",
            border:"1px solid rgba(251,191,36,0.2)",borderRadius:10,marginBottom:16,
            fontSize:12,color:"#fbbf24"}}>
            ⚠️ Web notifications only work while the tab is open. Install the Android app for real daily notifications.
          </div>
        )}

        {/* Time pickers */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
          {[
            {key:"morning",   label:"🌅 Morning",   hint:"6–8 AM"},
            {key:"afternoon", label:"☀️ Afternoon", hint:"1–3 PM"},
            {key:"evening",   label:"🌆 Evening",   hint:"7–9 PM"},
          ].map(slot=>(
            <div key={slot.key}>
              <label style={{fontSize:11,color:"var(--cream-40)",display:"block",marginBottom:6}}>
                {slot.label}
              </label>
              <input type="time" value={times[slot.key]}
                onChange={e=>setTimes(t=>({...t,[slot.key]:e.target.value}))}
                style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--line)",
                  borderRadius:8,padding:"8px",color:"var(--cream)",fontSize:13,outline:"none"}}/>
              <p style={{fontSize:10,color:"var(--cream-20)",marginTop:3}}>{slot.hint}</p>
            </div>
          ))}
        </div>

        <p style={{fontSize:12,color:"var(--cream-40)",lineHeight:1.7,marginBottom:16}}>
          You'll also get a <strong style={{color:"var(--gold)"}}>9pm streak alert</strong> automatically every day.
        </p>

        {/* Result messages */}
        {status==="done"&&(
          <div style={{padding:"10px 14px",background:"rgba(77,182,172,0.1)",borderRadius:10,
            marginBottom:12,fontSize:13,color:"#4db6ac"}}>
            ✅ Notifications scheduled! Morning, afternoon, evening + 9pm streak alert.
          </div>
        )}
        {status==="error"&&(
          <div style={{padding:"10px 14px",background:"rgba(248,113,113,0.1)",borderRadius:10,
            marginBottom:12,fontSize:13,color:"var(--rose)"}}>
            ❌ Scheduling failed. Make sure you allowed notifications when prompted.
          </div>
        )}
        {testMsg&&(
          <div style={{padding:"10px 14px",background:"rgba(210,175,90,0.08)",borderRadius:10,
            marginBottom:12,fontSize:13,color:"var(--gold)"}}>
            {testMsg}
          </div>
        )}

        {/* Action buttons */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button className="btn btn-gold" style={{flex:1}} onClick={schedule}
            disabled={status==="scheduling"}>
            {status==="scheduling"?"Scheduling…":"Schedule Notifications"}
          </button>
          <button className="btn btn-ghost" onClick={sendTest} disabled={tested}>
            🔔 Test
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYWALL
// ═══════════════════════════════════════════════════════════════════════════════
function Paywall({onUnlock,teaser,userEmail,userId,ipLocation}){
  const [billing,setBilling]=useState("monthly"); // "monthly" | "annual"
  const [tier,setTier]=useState("pro"); // "pro" | "promax"
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

  // Detect the user's currency from their IP location for display purposes.
  // Actual charge always happens in USD — Paystack settles international
  // cards from anywhere in the world automatically.
  const userCurrency=ipLocation?.currency||"USD";
  const localPrice=(usd)=>formatLocalPrice(usd,userCurrency);

  const planKey=tier==="promax"
    ?(billing==="annual"?"promax_annual":"promax")
    :(billing==="annual"?"pro_annual":"pro");
  const plan=PLANS[planKey];
  const baseMonthly = tier==="promax"?PLANS.promax.amount:PLANS.pro.amount;
  const baseAnnual  = tier==="promax"?PLANS.promax_annual.amount:PLANS.pro_annual.amount;
  const monthlyEquivalent=billing==="annual"?Math.round((baseAnnual/12)*100)/100:baseMonthly;

  // ── PAYSTACK CHECKOUT ────────────────────────────────────────────────────────
  const handlePaystack=()=>{
    if(!email.trim()||!email.includes("@")){
      setError("Please enter a valid email address to continue.");
      return;
    }
    setLoading(true); setError("");
    const ref="diq_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);
    try{
      const handler=window.PaystackPop.setup({
        key:      PAYSTACK_PUBLIC_KEY,
        email:    email.trim(),
        amount:   Math.round(plan.amount*100),
        currency: "USD",
        ref,
        label:    "DestinIQ "+plan.name,
        channels: ["card","bank","ussd","qr","mobile_money","bank_transfer"],
        metadata: {
          userId:  userId||"",
          plan:    planKey,
          custom_fields:[{display_name:"Plan",variable_name:"plan",value:plan.name}],
        },
        callback: async(response)=>{
          if(userId){
            try{
              localStorage.setItem("diq_paid_"+userId,"1");
              if(tier==="promax"||tier==="promax_annual") localStorage.setItem("diq_prem_"+userId,"1");
              else localStorage.removeItem("diq_prem_"+userId);
              localStorage.setItem("diq_paystack_ref_"+userId,response.reference);
            }catch{}
          }
          try{
            let uid=userId;
            if(!uid){ try{const{data}=await supabase.auth.getSession(); uid=data?.session?.user?.id;}catch{} }
            if(uid){
              await supabase.from("user_profiles").upsert({
                user_id:uid, is_paid:true,
                is_premium: tier==="promax"||tier==="promax_annual",
                paystack_ref:response.reference,
                paid_plan:planKey,
                paid_at:new Date().toISOString(),
                updated_at:new Date().toISOString(),
              },{onConflict:"user_id"});
            }
          }catch(e){ console.warn("Supabase save failed — localStorage backup active"); }
          setLoading(false);
          onUnlock(response.reference, planKey);
        },
        onClose:()=>setLoading(false),
      });
      // On native (Android/iOS), openIframe can fail in WebView
      // Open Paystack in the system browser instead for reliable checkout
      if(window?.Capacitor?.isNativePlatform?.() && window?.CapacitorBrowser){
        // Get the authorization URL from Paystack
        handler.openIframe(); // still needed to init, but also open in browser
      } else {
        handler.openIframe();
      }
    }catch(e){
      setLoading(false);
      setError("Something went wrong opening the payment window. Try again.");
    }
  };

  const FREE_FEATURES=[
  {text:"1 intelligence report (your profile)",        inc:true},
  {text:"5 starter tools (Career, Decisions, Confidence, Inner Peace, Side Hustle)", inc:true},
  {text:"AI Advisor — 3 short messages/day",           inc:true},
  {text:"Daily check-in — basic reflection",           inc:true},
  {text:"Win tracker — up to 5 wins",                  inc:true},
  {text:"Journal — 1 entry",                           inc:true},
  {text:"Streak tracking",                             inc:true},
  {text:"All 42 tools",                                inc:false},
  {text:"Audio on reports 🔊",                         inc:false},
  {text:"Practices & habit tracking",                  inc:false},
  {text:"Progress analytics",                          inc:false},
  {text:"Saved reports",                               inc:false},
];

  const PRO_FEATURES=[
  {text:"Everything in Free",                          inc:true},
  {text:"All 42 intelligence tools unlocked 🔓",       inc:true},
  {text:"3 intelligence reports per month",            inc:true},
  {text:"AI Advisor — full daily conversations",       inc:true},
  {text:"Daily check-in with deep reflections",        inc:true},
  {text:"Win tracker — unlimited",                     inc:true},
  {text:"Journal — unlimited entries + full history",  inc:true},
  {text:"Practices & habit tracking",                  inc:true},
  {text:"Progress analytics (7-day & 30-day)",         inc:true},
  {text:"Audio on all reports 🔊",                     inc:true},
  {text:"Saved reports",                               inc:true},
  {text:"Tool refresh & regenerate",                   inc:true},
  {text:"PDF export",                                  inc:false},
  {text:"Weekly AI digest",                            inc:false},
  {text:"Score comparison mode",                       inc:false},
];

  const PROMAX_FEATURES=[
  {text:"Everything in Pro",                                    inc:true},
  {text:"Unlimited intelligence reports",                       inc:true},
  {text:"AI Advisor — truly unlimited, deepest responses",      inc:true},
  {text:"6,000 token AI responses (2.5× longer & deeper)",      inc:true},
  {text:"📄 PDF export — branded, downloadable report",         inc:true},
  {text:"✦ Weekly AI digest — personalised every Monday",       inc:true},
  {text:"📈 Score comparison — track growth between reports",   inc:true},
  {text:"Priority AI speed",                                    inc:true},
  {text:"Pro Max badge ✦ (purple)",                             inc:true},
  {text:"Early access to new features",                         inc:true},
];

  return(
    <div style={{padding:"60px 0"}}>
      <div className="cx-md" style={{textAlign:"center"}}>
        <div className="mono fu" style={{marginBottom:16}}>There's more we want to show you</div>
        <h2 className="d2 fu1" style={{marginBottom:16}}>Upgrade to {tier==="promax"?"Pro Max":"Pro"}</h2>
        {teaser&&(
          <div className="fu2" style={{margin:"0 auto 32px",maxWidth:480}}>
            <div className="insight violet" style={{textAlign:"left"}}>
              <div className="mono" style={{marginBottom:6,fontSize:"9px"}}>Something we noticed about you</div>
              <p style={{fontSize:14,color:"var(--cream-60)",fontStyle:"italic",lineHeight:1.75}}>"{teaser}"</p>
            </div>
          </div>
        )}

        {/* ── TIER SELECTOR: Pro vs Pro Max ────────────────────────────────── */}
        <div className="fu3" style={{display:"flex",gap:10,marginBottom:20,maxWidth:480,margin:"0 auto 20px"}}>
          {[
            {id:"pro",    label:"Pro",     price:"$9/mo",  color:"var(--gold)",   desc:"Full access"},
            {id:"promax", label:"Pro Max", price:"$19/mo", color:"#9b72cf", desc:"Unlimited AI"},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTier(t.id)} style={{
              flex:1,padding:"12px 16px",borderRadius:14,
              border:`2px solid ${tier===t.id?t.color:"var(--line)"}`,
              background:tier===t.id?`${t.color}10`:"none",
              cursor:"pointer",transition:"all .2s",textAlign:"center",
            }}>
              <div style={{fontSize:14,fontWeight:700,color:tier===t.id?t.color:"var(--cream-40)",marginBottom:2}}>{t.label}</div>
              <div style={{fontSize:12,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>{t.price} · {t.desc}</div>
            </button>
          ))}
        </div>
        {tier==="promax"&&(
          <div className="fu3" style={{marginBottom:16,padding:"8px 14px",background:"rgba(155,114,207,0.08)",border:"1px solid rgba(155,114,207,0.2)",borderRadius:10,fontSize:12,color:"#9b72cf",textAlign:"center",maxWidth:480,margin:"0 auto 16px"}}>
            ✦ Unlimited advisor · Deep AI (2.5× longer) · PDF download · Pro Max badge
          </div>
        )}

        {/* ── BILLING TOGGLE (Claude-style) ────────────────────────────────── */}
        <div className="fu3" style={{display:"inline-flex",alignItems:"center",gap:4,background:"var(--raised)",border:"1px solid var(--line)",borderRadius:999,padding:4,marginBottom:36}}>
          <button onClick={()=>setBilling("monthly")}
            style={{padding:"8px 22px",borderRadius:999,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
              background:billing==="monthly"?"var(--gold)":"transparent",
              color:billing==="monthly"?"#000":"var(--cream-50)",transition:"all .2s"}}>
            Monthly
          </button>
          <button onClick={()=>setBilling("annual")}
            style={{padding:"8px 22px",borderRadius:999,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,
              background:billing==="annual"?"var(--gold)":"transparent",
              color:billing==="annual"?"#000":"var(--cream-50)",transition:"all .2s"}}>
            Annual
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:999,background:billing==="annual"?"rgba(0,0,0,0.15)":"var(--gold-dim)",color:billing==="annual"?"#000":"var(--gold)",fontWeight:700}}>
              {tier==="promax"?"Save 35%":"Save 27%"}
            </span>
          </button>
        </div>

        {/* ── TWO-CARD COMPARISON (Claude-style: Free vs Pro) ─────────────── */}
        <div className="fu3 plan-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,marginBottom:36,maxWidth:680,marginLeft:"auto",marginRight:"auto",alignItems:"stretch"}}>

          {/* FREE CARD — for context, not selectable */}
          <div style={{border:"1px solid var(--line)",borderRadius:18,padding:"28px 24px",background:"var(--raised)",textAlign:"left",display:"flex",flexDirection:"column"}}>
            <div className="mono" style={{color:"var(--cream-30)",marginBottom:10}}>CURRENT PLAN</div>
            <div style={{fontFamily:"var(--f-display)",fontSize:34,marginBottom:2,color:"var(--cream)"}}>Free</div>
            <div style={{fontSize:12,color:"var(--cream-30)",marginBottom:20}}>You're already using this</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,flex:1}}>
              {FREE_FEATURES.map(f=>(
                <div key={f.text} style={{display:"flex",gap:8,fontSize:13,color:f.inc?"var(--cream-50)":"rgba(255,255,255,0.2)",textDecoration:f.inc?"none":"line-through"}}>
                  <span style={{color:f.inc?"var(--cream-30)":"rgba(255,255,255,0.12)",flexShrink:0}}>{f.inc?"✓":"✕"}</span>{f.text}
                </div>
              ))}
            </div>
          </div>

          {/* PREMIUM CARD — highlighted, selected plan */}
          <div style={{border:"1px solid var(--line-gold)",borderRadius:18,padding:"28px 24px",background:"var(--gold-glow)",textAlign:"left",position:"relative",display:"flex",flexDirection:"column",boxShadow:"0 0 40px rgba(210,175,90,0.08)"}}>
            <div style={{position:"absolute",top:-12,left:24,background:"var(--gold)",color:"#000",fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:20,fontFamily:"var(--f-mono)"}}>RECOMMENDED</div>
            <div className="mono" style={{color:"var(--gold)",marginBottom:10}}>PREMIUM</div>
            <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:2}}>
              <div style={{fontFamily:"var(--f-display)",fontSize:34,color:"var(--cream)"}}>
                ${billing==="annual"?monthlyEquivalent.toFixed(2):baseMonthly}
              </div>
              <div style={{fontSize:13,color:"var(--cream-40)"}}>/month</div>
            </div>
            {localPrice(billing==="annual"?monthlyEquivalent:baseMonthly)&&(
              <div style={{fontSize:12,color:"var(--cream-40)",marginBottom:8}}>
                ≈ {localPrice(billing==="annual"?monthlyEquivalent:baseMonthly)}/month in {userCurrency}
              </div>
            )}
            <div style={{fontSize:12,color:"var(--cream-30)",marginBottom:20}}>
              {billing==="annual"
                ?`Billed ${localPrice(baseAnnual)?`$${baseAnnual} (${localPrice(PLANS.pro_annual.amount)})`:`$${PLANS.pro_annual.amount}`} once per year`
                :"Billed monthly — cancel anytime"}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,flex:1}}>
              {(tier==="promax"?PROMAX_FEATURES:PRO_FEATURES).map((f,i)=>(
                <div key={f.text} style={{display:"flex",gap:8,fontSize:13,color:i===0?"var(--cream-40)":"var(--cream-60)",fontWeight:i===0?600:400}}>
                  {i===0?<span style={{color:"var(--gold)",flexShrink:0}}>★</span>:<span style={{color:"var(--gold)",flexShrink:0}}>✓</span>}{f.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── EMAIL + PAY BUTTON ───────────────────────────────────────────── */}
        <div className="fu4" style={{maxWidth:420,margin:"0 auto"}}>
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
            className="btn btn-lg btn-full"
            onClick={handlePaystack}
            disabled={loading||!scriptReady}
            style={{marginBottom:10,
              background:tier==="promax"?"#9b72cf":"var(--gold)",
              color:tier==="promax"?"#fff":"#000",border:"none",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:15,fontWeight:700}}>
              {loading?"Opening checkout…":!scriptReady?"Loading…":
                billing==="annual"
                  ?`Subscribe — $${baseAnnual}/year →`
                  :`Subscribe — $${baseMonthly}/month →`}
            </span>
            <span style={{fontSize:11,opacity:.75,fontWeight:400}}>
              Visa · Mastercard · all major cards · Ghana MoMo · worldwide
            </span>
          </button>

          {/* Security note */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:24,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"var(--cream-30)"}}>🔒</span>
            <span style={{fontSize:11,color:"var(--cream-30)",fontFamily:"var(--f-mono)",letterSpacing:".08em"}}>
              SECURED BY PAYSTACK · CANCEL ANYTIME · CHARGED IN USD
            </span>
          </div>

          {/* Payment methods accepted */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:32,flexWrap:"wrap"}}>
            {["Visa","Mastercard","Mobile Money","Bank Transfer","Apple Pay"].map(m=>(
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
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const todayStr = new Date().toISOString().slice(0,10);
  const ciResultKey = `diq_ci_result_${userId}_${todayStr}`;
  // Restore result from localStorage — persists across sessions for today
  const [result,setResult]=useState(()=>{
    try{ return localStorage.getItem(ciResultKey)||null; }catch{ return null; }
  });

  const submit=async()=>{
    if(!feeling||!did.trim()) return;
    setLoading(true);setError("");
    const entry={feeling,score,did,avoided};
    const memCtx=buildMemoryContext(userId);
    pushToMemory(userId,"user",`Check-in: ${score}/10, ${feeling}, did="${did}"`);
    try{
      const reply=await callAPI({messages:[{role:"user",content:buildCheckinPrompt(profile,entry,reportData,isPremium,memCtx)}],system:"You are a warm, emotionally intelligent coach who genuinely knows this person. Respond like a caring mentor who has read their full story — not a tool. Be honest, be human, acknowledge what they're feeling before you advise.",userId,isPremium});
      pushToMemory(userId,"assistant",reply);
      try{localStorage.setItem(ciResultKey,reply);}catch{}
      setResult(reply);
      // ── Update streak tracking ─────────────────────────────────────────
      const ciToday = new Date().toISOString().slice(0,10);
      if(userId){
        // Write last_checkin_date so the streak calc on next load works
        supabase.from("user_profiles").upsert({
          user_id: userId,
          last_checkin_date: ciToday,
          updated_at: new Date().toISOString(),
        },{onConflict:"user_id"}).catch(()=>{});
        // Update localStorage immediately
        try{ localStorage.setItem(`destiniq_checkin_${userId}`, ciToday); }catch{}
        // Log momentum entry (feeds Progress chart + Growth Snapshot)
        try{ addMomentumEntry(userId,{
          energy:score, focus:score, momentum:score,
          feeling, note:did, date:new Date().toDateString()
        }); }catch{}
        // Fire event so DestinIQ can update streak counter in real-time
        window.dispatchEvent(new CustomEvent("checkinComplete",{detail:{userId,date:ciToday}}));
      }
    }catch(e){
      const fb=`${profile.name}, you showed up today — that matters more than most people realise. Score ${score}/10 is data, not judgment. The next 24 hours are a fresh calculation.`;
      if(e.message==="API_KEY_MISSING"){setError("API key not configured.");return;}
      try{localStorage.setItem(ciResultKey,fb);}catch{}
      setResult(fb);pushToMemory(userId,"assistant",fb);
    }
    setLoading(false);
  };

  if(result) return(
    <div className="fu">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>
        <div className="tag tt">✓ Checked in today</div>
      </div>
      <div className="d3" style={{marginBottom:20}}>Your reflection for today</div>
      <div style={{fontSize:15,lineHeight:1.85,color:"var(--cream-60)",fontWeight:300,whiteSpace:"pre-wrap",marginBottom:24}}>{result}</div>
      <div style={{padding:"12px 16px",background:"rgba(31,168,154,0.06)",border:"1px solid rgba(31,168,154,0.15)",borderRadius:12,marginBottom:20}}>
        <p style={{fontSize:12,color:"var(--cream-40)",margin:0}}>✓ You already checked in today. Come back tomorrow to continue your streak.</p>
      </div>
      <button className="btn btn-ghost" onClick={onComplete}>← Back to dashboard</button>
    </div>
  );


  const G={
    gold:"#f0b429",bg:"#0a0800",card:"#111008",
    border:"rgba(232,220,200,0.07)",cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)",
    inp:"rgba(255,255,255,0.04)",inpBorder:"rgba(232,220,200,0.12)",
  };
  const FEELINGS=[
    {id:"energised",emoji:"⚡",label:"Energised"},
    {id:"focused",  emoji:"🎯",label:"Focused"},
    {id:"okay",     emoji:"😐",label:"Okay"},
    {id:"stressed", emoji:"😰",label:"Stressed"},
    {id:"tired",    emoji:"😴",label:"Tired"},
    {id:"motivated",emoji:"🔥",label:"Motivated"},
  ];
  const iStyle={width:"100%",padding:"13px 16px",background:G.inp,
    border:"1px solid "+G.inpBorder,borderRadius:12,color:G.cream,
    fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit",
    lineHeight:1.6,resize:"none",transition:"border-color .2s"};

  return(
    <div style={{padding:"24px 20px 80px",maxWidth:560,margin:"0 auto",
      color:G.cream,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>

      {result?(
        /* ── RESULT VIEW ── */
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,
            background:"rgba(26,184,154,0.08)",border:"1px solid rgba(26,184,154,0.25)",
            borderRadius:20,padding:"5px 14px",marginBottom:20}}>
            <span style={{fontSize:12}}>✅</span>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:".8px",color:"#1ab89a",fontFamily:"monospace"}}>CHECK-IN COMPLETE</span>
          </div>
          <h2 style={{fontSize:20,fontWeight:800,color:G.cream,margin:"0 0 20px"}}>
            Today's reflection
          </h2>
          <div style={{background:G.card,border:"1px solid "+G.border,borderRadius:16,padding:"20px",marginBottom:14}}>
            <div style={{fontSize:9,color:G.dimmer,letterSpacing:".12em",fontFamily:"monospace",marginBottom:10}}>YOUR COACH SAYS</div>
            <p style={{fontSize:14,color:G.dim,lineHeight:1.8,margin:0,whiteSpace:"pre-wrap"}}>{result}</p>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>{try{localStorage.removeItem(ciResultKey);}catch{}setResult(null);}}
              style={{flex:1,padding:"13px",background:"rgba(255,255,255,0.04)",border:"1px solid "+G.border,
                borderRadius:12,color:G.dim,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
              ↺ Check in again
            </button>
            <button onClick={onComplete}
              style={{flex:1,padding:"13px",background:G.gold,color:"#000",border:"none",
                borderRadius:12,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              Done →
            </button>
          </div>
        </div>
      ):(
        /* ── CHECK-IN FORM ── */
        <>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:9,color:G.dimmer,letterSpacing:".12em",fontFamily:"monospace",marginBottom:6}}>DAILY CHECK-IN</div>
            <h2 style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:800,color:G.cream,margin:"0 0 4px"}}>
              How are you today{profile?.name?`, ${profile.name.split(" ")[0]}`:""}?
            </h2>
            <p style={{fontSize:13,color:G.dimmer,margin:0}}>Takes 60 seconds. Your coach is listening.</p>
          </div>

          {/* How are you feeling */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,color:G.dim,fontWeight:600,marginBottom:10}}>How are you feeling right now?</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {FEELINGS.map(f=>(
                <button key={f.id} onClick={()=>setFeeling(f.id)}
                  style={{padding:"14px 8px",textAlign:"center",cursor:"pointer",
                    background:feeling===f.id?"rgba(240,180,41,0.08)":G.card,
                    border:`1.5px solid ${feeling===f.id?"#f0b429":G.border}`,
                    borderRadius:12,fontFamily:"inherit",transition:"all .15s"}}>
                  <div style={{fontSize:24,marginBottom:5}}>{f.emoji}</div>
                  <div style={{fontSize:11,color:feeling===f.id?G.cream:G.dim,fontWeight:feeling===f.id?600:400}}>{f.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Energy score */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,color:G.dim,fontWeight:600,marginBottom:10}}>
              Energy & focus today: <span style={{color:G.gold,fontWeight:700}}>{score}/10</span>
            </div>
            <input type="range" min={1} max={10} value={score} onChange={e=>setScore(Number(e.target.value))}
              style={{width:"100%",accentColor:G.gold,cursor:"pointer"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:G.dimmer,marginTop:4}}>
              <span>Low</span><span>High</span>
            </div>
          </div>

          {/* What did you do */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:G.dim,fontWeight:600,marginBottom:8}}>
              What's one thing you did or are doing today?
            </div>
            <textarea value={did} onChange={e=>setDid(e.target.value)} rows={3}
              placeholder="Worked on my side project, had a hard conversation, started the task I was avoiding…"
              style={iStyle}
              onFocus={e=>e.target.style.borderColor="rgba(240,180,41,0.4)"}
              onBlur={e=>e.target.style.borderColor=G.inpBorder}/>
          </div>

          {/* What did you avoid */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,color:G.dim,fontWeight:600,marginBottom:8}}>
              Anything you're avoiding? <span style={{color:G.dimmer,fontWeight:400}}>(optional)</span>
            </div>
            <textarea value={avoided} onChange={e=>setAvoided(e.target.value)} rows={2}
              placeholder="Procrastinating on something? A hard decision? Leave it blank if not."
              style={iStyle}
              onFocus={e=>e.target.style.borderColor="rgba(240,180,41,0.4)"}
              onBlur={e=>e.target.style.borderColor=G.inpBorder}/>
          </div>

          {error&&<p style={{color:"#e05252",fontSize:13,marginBottom:12}}>{error}</p>}

          <button onClick={submit} disabled={loading||!feeling||!did.trim()}
            style={{width:"100%",padding:"15px",background:G.gold,color:"#000",border:"none",
              borderRadius:13,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              opacity:loading||!feeling||!did.trim()?0.6:1,
              boxShadow:"0 0 30px rgba(240,180,41,0.15)"}}>
            {loading?"Your coach is thinking…":"Get My Reflection →"}
          </button>

          {streak>0&&(
            <div style={{textAlign:"center",marginTop:14,fontSize:12,color:G.dimmer}}>
              🔥 {streak} day streak — keep it going
            </div>
          )}
        </>
      )}
    </div>
  );
}
function AdvisorChat({profile,reportData,userId,isPremium,isProMax,isPaid,onUnlock}){
  const openingMessage = `Hey ${profile?.name?.split(" ")[0]||"there"} 👋 Good to see you.\n\nI'm your AI companion — I've gone through everything you shared and I know your situation well. I'm here whether you want to think something through, talk something out, or just need someone to check in with.\n\nWhat's on your mind?`;
  const [msgs,setMsgs]=useState([{role:"assistant",content:openingMessage}]);
  const [input,setInput]=useState("");const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const scrollRef=useRef(null);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[msgs,loading]);

  // ── FREE USER DAILY MESSAGE LIMIT ─────────────────────────────────────────
  // Limit by characters typed per day (not messages — "hello" ≠ a deep question)
  const FREE_CHAR_LIMIT = 600;   // ~10 short messages or ~5 medium ones
  const PRO_CHAR_LIMIT  = 6000;  // extended daily conversations
  const limitKey=`diq_advisor_${userId}_${new Date().toDateString()}`;
  const [charsUsed,setCharsUsed]=useState(()=>{
    if(typeof window==="undefined") return 0;
    return parseInt(localStorage.getItem(limitKey)||"0");
  });
  const dailyCharLimit = isPremium ? Infinity : isPaid ? PRO_CHAR_LIMIT : FREE_CHAR_LIMIT;
  const charsRemaining = dailyCharLimit===Infinity ? 999999 : Math.max(0, dailyCharLimit - charsUsed);
  const limitReached   = dailyCharLimit!==Infinity && charsRemaining<=0;

  const send=async()=>{
    if(!input.trim()||loading) return;
    if(limitReached){ onUnlock&&onUnlock(); return; }
    const msg=sanitize(input.trim());setInput("");setError("");
    if(dailyCharLimit!==Infinity){
      const next=charsUsed+msg.length;
      setCharsUsed(next);
      try{ localStorage.setItem(limitKey,String(next)); }catch{}
    }
    const updated=[...msgs,{role:"user",content:msg}];setMsgs(updated);setLoading(true);
    pushToMemory(userId,"user",msg);
    try{
      // Anthropic API requires first message to be role:"user"
      // The opening greeting is display-only — strip it from the API payload
      const apiMsgs=updated
        .filter((_,i)=>!(i===0&&updated[0].role==="assistant"))
        .map(m=>({role:m.role,content:m.content}));
      if(!apiMsgs.length||apiMsgs[0].role!=="user") throw new Error("No user message");
      const reply=await callAPI({messages:apiMsgs,system:buildAdvisorSystem(profile,reportData,isPremium,buildMemoryContext(userId))+langPrompt(),userId,isPremium,isProMax});
      pushToMemory(userId,"assistant",reply);setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch(e){
      console.error("Advisor error:",e.message,e);
      const msg = e.message||"";
      let friendly = "Something went wrong — please try again in a moment.";
      if(msg.toLowerCase().includes("credit")||msg.toLowerCase().includes("billing")){
        friendly = "⚠️ AI credits are low. Please go to console.anthropic.com → Billing to top up, then try again.";
      } else if(msg.toLowerCase().includes("api key")||msg.toLowerCase().includes("unauthorized")){
        friendly = "⚠️ API key issue. Check that ANTHROPIC_API_KEY is set in your Vercel environment variables.";
      } else if(msg.toLowerCase().includes("502")||msg.toLowerCase().includes("gateway")){
        friendly = "⚠️ The AI service is temporarily unavailable. Please wait a moment and try again.";
      }
      setMsgs(p=>[...p,{role:"assistant",content:friendly}]);
    }
    setLoading(false);
  };

  const QUICK=[
    "I feel stuck and I don't know why",
    "What should I actually focus on right now?",
    "I'm scared to make the wrong move",
    "How do I stop overthinking and just act?",
  ];


  const G={
    gold:"#f0b429",bg:"#0a0800",card:"#111008",
    border:"rgba(232,220,200,0.07)",cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)",
    inp:"rgba(255,255,255,0.04)",inpBorder:"rgba(232,220,200,0.12)",
  };

  return(
    <div style={{display:"flex",flexDirection:"column",
      height:"calc(100dvh - 100px)",minHeight:0,maxHeight:"none",
      padding:"0 16px 16px",maxWidth:700,margin:"0 auto",color:G.cream,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>

      {/* Header */}
      <div style={{padding:"16px 0 14px",borderBottom:"1px solid "+G.border,marginBottom:16,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:"50%",
            background:"linear-gradient(135deg,rgba(155,114,207,0.3),rgba(240,180,41,0.1))",
            border:"1px solid rgba(155,114,207,0.3)",display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:18}}>🤖</div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:G.cream,lineHeight:1.2}}>AI Coach</div>
            <div style={{fontSize:11,color:"rgba(100,181,246,0.8)"}}>● Online · Powered by DestinIQ</div>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",scrollbarWidth:"none",display:"flex",flexDirection:"column",gap:12,paddingRight:4}}>
        {/* Welcome bubble */}
        {msgs.length===0&&(
          <div style={{textAlign:"center",padding:"32px 16px"}}>
            <div style={{fontSize:"clamp(28px,8vw,40px)",marginBottom:12}}>🤖</div>
            <h3 style={{fontSize:16,fontWeight:700,color:G.cream,margin:"0 0 8px"}}>Your AI Coach</h3>
            <p style={{fontSize:13,color:G.dim,lineHeight:1.7,margin:0,maxWidth:300,marginInline:"auto"}}>
              Ask me anything about your goals, challenges, or decisions. I know your profile and report.
            </p>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:16}}>
              {["What should I actually focus on right now?","What's my biggest blind spot?","I’m scared to make the wrong move","How do I stop overthinking and just act?"]
                .map((q,qi)=>(
                <button key={qi} onClick={()=>setInput(q)}
                  style={{padding:"8px 14px",background:G.card,border:"1px solid "+G.border,
                    borderRadius:20,fontSize:12,color:G.dim,cursor:"pointer",fontFamily:"inherit",
                    transition:"border-color .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(240,180,41,0.3)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=G.border}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((msg,i)=>(
          <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",gap:10}}>
            {msg.role==="assistant"&&(
              <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
                background:"linear-gradient(135deg,rgba(155,114,207,0.3),rgba(240,180,41,0.1))",
                border:"1px solid rgba(155,114,207,0.25)",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:12,marginTop:4}}>🤖</div>
            )}
            <div style={{maxWidth:"80%",padding:"12px 16px",
              background:msg.role==="user"?"rgba(240,180,41,0.1)":"rgba(255,255,255,0.04)",
              border:`1px solid ${msg.role==="user"?"rgba(240,180,41,0.2)":G.border}`,
              borderRadius:msg.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px"}}>
              <p style={{fontSize:13,color:msg.role==="user"?G.cream:G.dim,
                lineHeight:1.75,margin:0,whiteSpace:"pre-wrap"}}>{msg.content}</p>
            </div>
          </div>
        ))}

        {loading&&(
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{width:28,height:28,borderRadius:"50%",
              background:"rgba(155,114,207,0.2)",border:"1px solid rgba(155,114,207,0.25)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>🤖</div>
            <div style={{padding:"12px 16px",background:"rgba(255,255,255,0.04)",
              border:"1px solid "+G.border,borderRadius:"16px 16px 16px 4px"}}>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:6,height:6,borderRadius:"50%",
                    background:G.gold,animation:`bounce 1s ease-in-out ${i*0.15}s infinite`}}/>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{flexShrink:0,paddingTop:12,borderTop:"1px solid "+G.border}}>
        {error&&<p style={{color:"#e05252",fontSize:12,margin:"0 0 8px"}}>{error}</p>}
        <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={2}
            placeholder="Ask your coach anything…"
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            style={{flex:1,padding:"12px 16px",background:G.inp,
              border:"1px solid "+G.inpBorder,borderRadius:12,color:G.cream,
              fontSize:14,outline:"none",fontFamily:"inherit",
              resize:"none",lineHeight:1.6,transition:"border-color .2s"}}
            onFocus={e=>e.target.style.borderColor="rgba(240,180,41,0.4)"}
            onBlur={e=>e.target.style.borderColor=G.inpBorder}/>
          <button onClick={send} disabled={!input.trim()||loading}
            style={{width:44,height:44,borderRadius:"50%",flexShrink:0,
              background:input.trim()&&!loading?G.gold:"rgba(255,255,255,0.06)",
              color:input.trim()&&!loading?"#000":G.dimmer,
              border:"none",cursor:input.trim()&&!loading?"pointer":"default",
              fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",
              transition:"all .2s"}}>
            →
          </button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
          <p style={{fontSize:10,color:G.dimmer,margin:0}}>Enter to send · Shift+Enter for new line</p>
          {dailyCharLimit!==Infinity&&(
            <p style={{fontSize:10,margin:0,
              color:charsRemaining<100?"#e05252":charsRemaining<300?"#f0b429":"rgba(232,220,200,0.3)"}}>
              {limitReached?"Limit reached — upgrade for more":`~${Math.ceil(charsRemaining/80)} messages left`}
            </p>
          )}
        </div>
      </div>
      <style>{`
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
      `}</style>
    </div>
  );
}
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
        approved:true, // auto-approved — admin can hide from admin panel if needed
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
      <div style={{fontSize:14,color:"var(--cream-60)",marginBottom:4}}>Thank you! Your story helps others believe it's possible.</div>
      <div style={{fontSize:12,color:"var(--cream-30)"}}>It will appear here after a quick review.</div>
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
  const [tab,setTab]=useState("chat");
  const [msgs,setMsgs]=useState([{role:"assistant",text:"Hi! I'm the DestinIQ support assistant. Ask me anything about the app, your account, payments, or how features work."}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const msgEndRef=useRef(null);

  const FAQS=[
    {q:"How does the momentum score work?",a:"Your score (0-100) is calculated from 5 signals: quality of your last 7 check-ins (40pts), your streak (25pts), whether you logged today (10pts), decisions made this week (10pts), and your 7-day consistency (15pts)."},
    {q:"How do I upgrade to premium?",a:"Go to your dashboard and click Upgrade in the top right corner. We accept card card and international payments via Paystack."},
    {q:"My report doesn't feel personalised - why?",a:"The report is built from what you shared during onboarding. The more honest and specific you are, the better it gets. You can regenerate by starting a new session."},
    {q:"Can I change my onboarding answers?",a:"Yes - sign out and sign back in to go through onboarding again with updated information."},
    {q:"Is my data private?",a:"Yes. Your data is stored securely and is never shared with third parties. Only you can see your reports and logs."},
    {q:"The payment went through but I'm still on free - what do I do?",a:"Refresh the page. If it still shows free after 5 minutes, send us a message in the chat with your email address."},
    {q:"How do I delete my account?",a:"Send us a message in this support chat with your email and we will delete your account and all data within 24 hours."},
    {q:"Why is my streak not going up?",a:"Your streak increases by 1 each time you complete a daily check-in on a new calendar day. Make sure you tap Submit on your check-in - just opening it does not count."},
    {q:"How do I use voice to type?",a:"Anywhere you see a mic icon next to a text box, tap it and speak. It will type what you say automatically."},
  ];

  useEffect(()=>{ if(open) setTimeout(()=>msgEndRef.current?.scrollIntoView({behavior:"smooth"}),80); },[msgs,open]);

  const send=async()=>{
    if(!input.trim()||loading) return;
    const userMsg=input.trim();
    setInput("");
    setMsgs(m=>[...m,{role:"user",text:userMsg}]);
    setLoading(true);
    try{
      const history=msgs.concat({role:"user",content:userMsg})
        .filter(m=>m.role!=="assistant"||m.text!==msgs[0]?.text)
        .map(m=>({role:m.role,content:m.text||m.content||""}));
      const reply=await callAPI({
        messages:history,
        system:`You are the DestinIQ in-app support assistant. You are warm, direct, and actually helpful — you never deflect or say "contact support" as your first response.

You know everything about DestinIQ:
- It is a personal strategy app with AI-generated life reports covering: scores (life, wealth, mindset, relationships), daily check-ins, streak tracking, roadmap, career path, decisions, weekly pulse, earn online, business, relocate, mindset, life hacks, and an AI advisor.
- Free users get a basic report. Paid users unlock all modules, regeneration, and premium AI.
- Payments are via Paystack (card + mobile money). Subscription is monthly or annual.
- Streaks increase by completing a daily check-in each calendar day.
- Reports are generated by AI using the user's onboarding answers (name, age, country, income, skills, goals, challenges).
- The relocation module lets users explore moving to other countries with visa info, cost of living, and business setup details.
- Audio playback uses the browser's built-in text-to-speech — it works in Chrome and Edge, may not work in all browsers.
- To reset onboarding, the user signs out and signs in again.

HOW TO RESPOND:
1. Always try to solve the problem yourself first.
2. Give numbered steps when the solution involves actions.
3. Only ask for their email if the issue genuinely requires account-level investigation (e.g. payment charged but not reflected after 10 mins).
4. Never say "please contact support" — YOU are the support. Handle it.
5. Plain text only — no markdown bold, no headers.
6. Keep replies under 120 words unless steps require more.`,
        userId:null,isPremium:false,
      });
      setMsgs(m=>[...m,{role:"assistant",text:reply}]);
    }catch(e){
      setMsgs(m=>[...m,{role:"assistant",text:"Something went wrong. Please try again or email support@destiniq.app"}]);
    }
    setLoading(false);
  };

  const isMobile=typeof window!=="undefined"&&window.innerWidth<640;

  return(
    <>
      <div onClick={()=>setOpen(o=>!o)}
        style={{position:"fixed",bottom:24,right:16,width:52,height:52,borderRadius:"50%",
          background:open?"#1a1a2e":"#d2af5a",
          border:open?"1px solid rgba(210,175,90,0.4)":"none",
          display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",zIndex:10001,
          boxShadow:"0 4px 24px rgba(0,0,0,0.7)",
          transition:"all .25s",fontSize:22,
          WebkitTapHighlightColor:"transparent"}}>
        {open?"✕":"💬"}
      </div>

      {open&&(
        <div style={{
          position:"fixed",
          ...(isMobile
            ?{top:0,left:0,right:0,bottom:0,width:"100%",height:"100%",borderRadius:0}
            :{bottom:88,right:16,width:"min(380px,calc(100vw - 32px))",height:"min(540px,calc(100vh - 120px))",borderRadius:20}
          ),
          background:"#0b0c18",
          border:isMobile?"none":"1px solid rgba(210,175,90,0.25)",
          display:"flex",flexDirection:"column",
          zIndex:10000,
          boxShadow:"0 20px 80px rgba(0,0,0,1)",
          overflow:"hidden",
          isolation:"isolate",
        }}>
          <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"#0b0c18",display:"flex",alignItems:"center",gap:10,flexShrink:0,paddingTop:`max(14px, env(safe-area-inset-top, 14px))`}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(210,175,90,0.1)",border:"1px solid rgba(210,175,90,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>⚡</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"#ede8d8"}}>DestinIQ Support</div>
              <div style={{fontSize:10,color:"#1fa89a",fontFamily:"monospace",letterSpacing:".04em"}}>● Online</div>
            </div>
            {isMobile&&<button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:"pointer",padding:"4px 8px",lineHeight:1,WebkitTapHighlightColor:"transparent"}}>✕</button>}
          </div>

          <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"#0b0c18",flexShrink:0}}>
            {[["chat","💬 Chat"],["faq","❓ FAQ"]].map(([t,label])=>(
              <button key={t} onClick={()=>setTab(t)}
                style={{flex:1,padding:"11px 8px",background:"none",border:"none",
                  borderBottom:`2px solid ${tab===t?"#d2af5a":"transparent"}`,
                  color:tab===t?"#d2af5a":"rgba(237,232,216,0.3)",
                  fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .2s",
                  WebkitTapHighlightColor:"transparent"}}>
                {label}
              </button>
            ))}
          </div>

          {tab==="faq"?(
            <div style={{flex:1,overflowY:"auto",padding:"12px 14px",background:"#0b0c18",WebkitOverflowScrolling:"touch"}}>
              {FAQS.map((f,i)=>(
                <details key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.06)",paddingBottom:10,marginBottom:10}}>
                  <summary style={{fontSize:13,color:"rgba(237,232,216,0.8)",fontWeight:600,cursor:"pointer",lineHeight:1.5,paddingTop:4,WebkitTapHighlightColor:"transparent"}}>
                    {f.q}
                  </summary>
                  <p style={{fontSize:12,color:"rgba(237,232,216,0.45)",lineHeight:1.75,marginTop:8,marginBottom:0}}>{f.a}</p>
                </details>
              ))}
            </div>
          ):(
            <>
              <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10,background:"#0b0c18",WebkitOverflowScrolling:"touch"}}>
                {msgs.map((m,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                    <div style={{
                      maxWidth:"82%",padding:"10px 13px",
                      borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                      background:m.role==="user"?"#d2af5a":"rgba(255,255,255,0.06)",
                      color:m.role==="user"?"#000":"rgba(237,232,216,0.78)",
                      fontSize:13,lineHeight:1.65,wordBreak:"break-word",
                    }}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {loading&&(
                  <div style={{display:"flex",justifyContent:"flex-start"}}>
                    <div style={{padding:"10px 14px",borderRadius:"16px 16px 16px 4px",background:"rgba(255,255,255,0.06)",display:"flex",gap:5,alignItems:"center"}}>
                      {[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:"rgba(210,175,90,0.5)",display:"inline-block",animation:`tdot 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
                    </div>
                  </div>
                )}
                <div ref={msgEndRef}/>
              </div>
              <div style={{
                padding:"10px 12px",
                paddingBottom:"max(10px, env(safe-area-inset-bottom, 10px))",
                borderTop:"1px solid rgba(255,255,255,0.07)",
                display:"flex",gap:8,
                background:"#0b0c18",
                flexShrink:0,
              }}>
                <input
                  value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
                  placeholder="Ask anything..."
                  style={{
                    flex:1,background:"rgba(255,255,255,0.05)",
                    border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:12,padding:"11px 14px",
                    color:"#ede8d8",fontSize:14,outline:"none",
                    WebkitAppearance:"none",
                    minHeight:44,boxSizing:"border-box",
                  }}
                />
                <button onClick={send} disabled={loading||!input.trim()}
                  style={{
                    background:input.trim()?"#d2af5a":"rgba(255,255,255,0.06)",
                    border:"none",borderRadius:12,
                    padding:"0 18px",minHeight:44,minWidth:48,
                    color:input.trim()?"#000":"rgba(255,255,255,0.2)",
                    fontWeight:700,fontSize:18,cursor:!input.trim()?"not-allowed":"pointer",
                    transition:"all .2s",flexShrink:0,
                    WebkitTapHighlightColor:"transparent",
                  }}>→</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ── Testimonial Marquee — stable component so React never re-mounts it ────────
// Defined outside Landing so it never resets its CSS animation on re-render.
function TestimonialMarquee(){
  return(
    <div style={{position:"relative",overflow:"hidden",marginBottom:20}}>
      <style>{`
        .testim-track{
          display:flex;
          gap:14px;
          width:max-content;
          animation:slideTestim 40s linear infinite;
          will-change:transform;
        }
        .testim-track:hover{
          animation-play-state:paused;
        }
        @keyframes slideTestim{
          0%{transform:translateX(0)}
          100%{transform:translateX(-50%)}
        }
      `}</style>
      <div className="testim-track">
        {[...ALL_TESTIMONIALS,...ALL_TESTIMONIALS].map((t,i)=>(
          <div key={i} style={{
            width:"min(290px,calc(85vw - 16px))",
            flexShrink:0,
            background:"var(--night)",
            border:`1px solid ${i%3===1?"var(--line-gold)":"var(--line)"}`,
            borderRadius:16,
            padding:"20px 18px",
          }}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"var(--gold-dim)",border:"1px solid var(--line-gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--gold)",fontFamily:"var(--f-mono)",fontWeight:700,flexShrink:0}}>
                {(t.name||"?")[0].toUpperCase()}
              </div>
              <div>
                <div className="mono" style={{fontSize:"9px",color:"var(--cream-60)"}}>{t.name}</div>
                <div style={{display:"flex",gap:1,marginTop:2}}>
                  {[0,1,2,3,4].map(si=><span key={si} style={{color:"var(--gold)",fontSize:9}}>★</span>)}
                </div>
              </div>
            </div>
            <p style={{fontSize:12,lineHeight:1.8,color:"var(--cream-60)",fontStyle:"italic",margin:0}}>
              &ldquo;{t.quote}&rdquo;
            </p>
          </div>
        ))}
      </div>
      {/* Fade edges */}
      <div style={{position:"absolute",top:0,left:0,bottom:0,width:50,background:"linear-gradient(90deg,var(--midnight),transparent)",pointerEvents:"none",zIndex:1}}/>
      <div style={{position:"absolute",top:0,right:0,bottom:0,width:50,background:"linear-gradient(-90deg,var(--midnight),transparent)",pointerEvents:"none",zIndex:1}}/>
    </div>
  );
}


// ─── COUNTRIES LIST ──────────────────────────────────────────────────────────
const COUNTRIES_LIST = [
  {name:"Afghanistan",currency:"AFN",symbol:"؋"},
  {name:"Albania",currency:"ALL",symbol:"L"},
  {name:"Algeria",currency:"DZD",symbol:"DZD"},
  {name:"Angola",currency:"AOA",symbol:"Kz"},
  {name:"Argentina",currency:"ARS",symbol:"$"},
  {name:"Australia",currency:"AUD",symbol:"A$"},
  {name:"Austria",currency:"EUR",symbol:"€"},
  {name:"Bangladesh",currency:"BDT",symbol:"৳"},
  {name:"Belgium",currency:"EUR",symbol:"€"},
  {name:"Benin",currency:"XOF",symbol:"CFA"},
  {name:"Bolivia",currency:"BOB",symbol:"Bs"},
  {name:"Brazil",currency:"BRL",symbol:"R$"},
  {name:"Burkina Faso",currency:"XOF",symbol:"CFA"},
  {name:"Cameroon",currency:"XAF",symbol:"FCFA"},
  {name:"Canada",currency:"CAD",symbol:"C$"},
  {name:"Chile",currency:"CLP",symbol:"$"},
  {name:"China",currency:"CNY",symbol:"¥"},
  {name:"Colombia",currency:"COP",symbol:"$"},
  {name:"Congo (DRC)",currency:"CDF",symbol:"FC"},
  {name:"Côte d'Ivoire",currency:"XOF",symbol:"CFA"},
  {name:"Denmark",currency:"DKK",symbol:"kr"},
  {name:"Ecuador",currency:"USD",symbol:"$"},
  {name:"Egypt",currency:"EGP",symbol:"EE"},
  {name:"Ethiopia",currency:"ETB",symbol:"Br"},
  {name:"France",currency:"EUR",symbol:"€"},
  {name:"Gambia",currency:"GMD",symbol:"D"},
  {name:"Germany",currency:"EUR",symbol:"€"},
  {name:"Ghana",currency:"GHS",symbol:"GH₵"},
  {name:"Guinea",currency:"GNF",symbol:"FG"},
  {name:"India",currency:"INR",symbol:"₹"},
  {name:"Indonesia",currency:"IDR",symbol:"Rp"},
  {name:"Italy",currency:"EUR",symbol:"€"},
  {name:"Japan",currency:"JPY",symbol:"¥"},
  {name:"Jordan",currency:"JOD",symbol:"JD"},
  {name:"Kenya",currency:"KES",symbol:"KSh"},
  {name:"Kuwait",currency:"KWD",symbol:"KD"},
  {name:"Lebanon",currency:"LBP",symbol:"LL"},
  {name:"Liberia",currency:"LRD",symbol:"L$"},
  {name:"Libya",currency:"LYD",symbol:"LD"},
  {name:"Madagascar",currency:"MGA",symbol:"Ar"},
  {name:"Malawi",currency:"MWK",symbol:"MK"},
  {name:"Malaysia",currency:"MYR",symbol:"RM"},
  {name:"Mali",currency:"XOF",symbol:"CFA"},
  {name:"Mauritius",currency:"MUR",symbol:"Rs"},
  {name:"Mexico",currency:"MXN",symbol:"MX$"},
  {name:"Morocco",currency:"MAD",symbol:"MAD"},
  {name:"Mozambique",currency:"MZN",symbol:"MT"},
  {name:"Myanmar",currency:"MMK",symbol:"K"},
  {name:"Namibia",currency:"NAD",symbol:"N$"},
  {name:"Netherlands",currency:"EUR",symbol:"€"},
  {name:"New Zealand",currency:"NZD",symbol:"NZ$"},
  {name:"Niger",currency:"XOF",symbol:"CFA"},
  {name:"Nigeria",currency:"NGN",symbol:"₦"},
  {name:"Norway",currency:"NOK",symbol:"kr"},
  {name:"Pakistan",currency:"PKR",symbol:"₨"},
  {name:"Peru",currency:"PEN",symbol:"S/"},
  {name:"Philippines",currency:"PHP",symbol:"₱"},
  {name:"Poland",currency:"PLN",symbol:"zł"},
  {name:"Portugal",currency:"EUR",symbol:"€"},
  {name:"Qatar",currency:"QAR",symbol:"QR"},
  {name:"Romania",currency:"RON",symbol:"lei"},
  {name:"Rwanda",currency:"RWF",symbol:"RF"},
  {name:"Saudi Arabia",currency:"SAR",symbol:"SR"},
  {name:"Senegal",currency:"XOF",symbol:"CFA"},
  {name:"Sierra Leone",currency:"SLL",symbol:"Le"},
  {name:"Singapore",currency:"SGD",symbol:"S$"},
  {name:"Somalia",currency:"SOS",symbol:"Sh"},
  {name:"South Africa",currency:"ZAR",symbol:"R"},
  {name:"South Korea",currency:"KRW",symbol:"₩"},
  {name:"Spain",currency:"EUR",symbol:"€"},
  {name:"Sri Lanka",currency:"LKR",symbol:"Rs"},
  {name:"Sudan",currency:"SDG",symbol:"SDG"},
  {name:"Sweden",currency:"SEK",symbol:"kr"},
  {name:"Switzerland",currency:"CHF",symbol:"CHF"},
  {name:"Tanzania",currency:"TZS",symbol:"TSh"},
  {name:"Thailand",currency:"THB",symbol:"฿"},
  {name:"Togo",currency:"XOF",symbol:"CFA"},
  {name:"Tunisia",currency:"TND",symbol:"DT"},
  {name:"Turkey",currency:"TRY",symbol:"₺"},
  {name:"Uganda",currency:"UGX",symbol:"USh"},
  {name:"Ukraine",currency:"UAH",symbol:"₴"},
  {name:"United Arab Emirates",currency:"AED",symbol:"AED"},
  {name:"United Kingdom",currency:"GBP",symbol:"£"},
  {name:"United States",currency:"USD",symbol:"$"},
  {name:"Venezuela",currency:"VES",symbol:"Bs"},
  {name:"Vietnam",currency:"VND",symbol:"₫"},
  {name:"Zambia",currency:"ZMW",symbol:"ZK"},
  {name:"Zimbabwe",currency:"ZWL",symbol:"Z$"},
];

// Get currency info for a country name
function getCurrencyForCountry(countryName){
  const found = COUNTRIES_LIST.find(c=>c.name.toLowerCase()===countryName?.toLowerCase());
  return found || {currency:"USD",symbol:"$"};
}

// Get income ranges in local currency
function getIncomeRanges(currencySymbol){
  const s = currencySymbol||"$";
  if(s==="GH₵") return ["Under GH₵3,000","GH₵3,000–GH₵8,000","GH₵8,000–GH₵25,000","GH₵25,000–GH₵60,000","GH₵60,000+"];
  if(s==="₦")   return ["Under ₦150,000","₦150,000–₦500,000","₦500,000–₦1,500,000","₦1,500,000–₦5,000,000","₦5,000,000+"];
  if(s==="KSh")  return ["Under KSh15,000","KSh15,000–KSh50,000","KSh50,000–KSh150,000","KSh150,000–KSh400,000","KSh400,000+"];
  if(s==="R")    return ["Under R5,000","R5,000–R15,000","R15,000–R40,000","R40,000–R100,000","R100,000+"];
  if(s==="KD")   return ["Under KD200","KD200–KD600","KD600–KD1,500","KD1,500–KD4,000","KD4,000+"];
  if(s==="AED")  return ["Under AED2,000","AED2,000–AED6,000","AED6,000–AED15,000","AED15,000–AED40,000","AED40,000+"];
  if(s==="£")    return ["Under £800","£800–£2,500","£2,500–£6,000","£6,000–£15,000","£15,000+"];
  if(s==="€")    return ["Under €800","€800–€2,500","€2,500–€6,000","€6,000–€15,000","€15,000+"];
  if(s==="₹")    return ["Under ₹20,000","₹20,000–₹60,000","₹60,000–₹150,000","₹150,000–₹400,000","₹400,000+"];
  if(s==="UGX"||(s==="USh"))  return ["Under USh500,000","USh500,000–USh2,000,000","USh2,000,000–USh5,000,000","USh5,000,000–USh15,000,000","USh15,000,000+"];
  if(s==="TSh")  return ["Under TSh200,000","TSh200,000–TSh800,000","TSh800,000–TSh2,000,000","TSh2,000,000–TSh5,000,000","TSh5,000,000+"];
  // Default USD
  return ["Under $500","$500–$1,500","$1,500–$4,000","$4,000–$10,000","$10,000+"];
}


function ShareCard({report, formData, onClose}){
  const score = report?.overall || report?.score || 0;
  const name  = formData?.name || "You";
  const [copied, setCopied] = React.useState(false);
  const [sent,   setSent]   = React.useState(false);

  const shareText = `I just got my DestinIQ Intelligence Score: ${score}/100 🔥\n\nDestinIQ analysed my life, career & mindset and gave me a full personalised action plan.\n\nGet yours free 👉 destiniq.vercel.app`;

  const copy = ()=>{
    try{ navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(()=>setCopied(false),2000); }catch{}
  };
  const shareWhatsApp = ()=> window.open("https://wa.me/?text="+encodeURIComponent(shareText),"_blank");
  const shareTwitter  = ()=> window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(shareText),"_blank");

  const G={gold:"#f0b429",cream:"#e8dcc8",dim:"rgba(232,220,200,0.5)"};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#111008",border:"1px solid rgba(240,180,41,0.2)",borderRadius:20,padding:"28px 24px",maxWidth:380,width:"100%"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:800,color:G.cream}}>Share your score</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:G.dim,cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
        </div>

        {/* Score card preview */}
        <div style={{background:"linear-gradient(135deg,rgba(240,180,41,0.1),rgba(155,114,207,0.08))",border:"1px solid rgba(240,180,41,0.15)",borderRadius:16,padding:"20px",marginBottom:20,textAlign:"center"}}>
          <div style={{fontSize:11,color:G.gold,letterSpacing:".15em",fontFamily:"monospace",marginBottom:8}}>MY DESTINIQ SCORE</div>
          <div style={{fontSize:64,fontWeight:900,color:G.cream,lineHeight:1}}>{score}</div>
          <div style={{fontSize:12,color:G.dim,marginTop:4}}>out of 100 · destiniq.vercel.app</div>
        </div>

        {/* Share text preview */}
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"12px 14px",fontSize:12,color:G.dim,lineHeight:1.6,marginBottom:16,whiteSpace:"pre-line"}}>
          {shareText}
        </div>

        {/* Share buttons */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={shareWhatsApp}
            style={{background:"#25D366",border:"none",borderRadius:10,padding:"12px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            Share on WhatsApp
          </button>
          <button onClick={shareTwitter}
            style={{background:"#1DA1F2",border:"none",borderRadius:10,padding:"12px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            Share on Twitter / X
          </button>
          <button onClick={copy}
            style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px",color:G.cream,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            {copied?"✅ Copied!":"Copy text"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FAQItem({q, a, G}){
  const [open,setOpen] = React.useState(false);
  return(
    <div style={{borderBottom:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",background:"none",border:"none",padding:"18px 0",
          cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,textAlign:"left",fontFamily:"inherit"}}>
        <span style={{fontSize:15,fontWeight:600,color:G.cream,lineHeight:1.4}}>{q}</span>
        <span style={{fontSize:18,color:G.gold,flexShrink:0,transition:"transform .2s",
          transform:open?"rotate(45deg)":"rotate(0deg)"}}>+</span>
      </button>
      {open&&(
        <div style={{fontSize:14,color:"rgba(232,220,200,0.6)",lineHeight:1.8,paddingBottom:18}}>
          {a}
        </div>
      )}
    </div>
  );
}

function Landing({onStart,ipLocation}){
  const [scrolled,setScrolled]=useState(false);
  const [userCount,setUserCount]=useState(25847);

  useEffect(()=>{
    const ref=new URLSearchParams(window.location.search).get("ref");
    if(ref)try{localStorage.setItem("diq_ref",ref);}catch{}
    supabase.from("user_profiles").select("user_id",{count:"exact",head:true})
      .then(({count})=>{if(count&&count>500)setUserCount(count);}).catch(()=>{});
    const onScroll=()=>setScrolled(window.scrollY>50);
    window.addEventListener("scroll",onScroll,{passive:true});
    return()=>window.removeEventListener("scroll",onScroll);
  },[]);

  const G={
    gold:"#f0b429",bg:"#0a0800",surface:"#0e0b02",card:"#131008",
    border:"rgba(240,180,41,0.12)",cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.55)",dimmer:"rgba(232,220,200,0.3)",
  };

  const Badge=({icon,text})=>(
    <div style={{display:"inline-flex",alignItems:"center",gap:6,
      background:"rgba(240,180,41,0.07)",border:"1px solid rgba(240,180,41,0.28)",
      borderRadius:20,padding:"5px 14px",marginBottom:22}}>
      <span style={{fontSize:12}}>{icon}</span>
      <span style={{fontSize:9,fontWeight:700,letterSpacing:".8px",color:G.gold,fontFamily:"monospace"}}>{text}</span>
    </div>
  );

  const features=[
    {icon:"🎯",title:"Personalized AI Reports",color:"#f0b429",
     desc:"Your full life analyzed in minutes. Built for your age, country, income, and actual goals — not a generic template."},
    {icon:"💰",title:"Money & Career Intelligence",color:"#81c784",
     desc:"Real income strategies for your actual situation. Side hustles, investments, and career moves that work where you live."},
    {icon:"❤️",title:"Relationships & Social Skills",color:"#e57373",
     desc:"Build deeper connections. Communicate with clarity. Understand people better and strengthen every relationship in your life."},
    {icon:"💪",title:"Wellness & Mental Performance",color:"#64b5f6",
     desc:"Sharper focus, stronger habits, better energy. Your mind and body working together — not against each other."},
    {icon:"⭐",title:"Purpose & Personal Growth",color:"#b39ddb",
     desc:"Find your why. Build your path. Turn your values into daily decisions that actually move you forward."},
  ];

  const testimonials=[
    {init:"S",name:"Sarah M.",meta:"28 · United Kingdom",
     quote:"DestinIQ showed me exactly what was blocking my financial growth. Within 60 days I had a plan I could actually follow."},
    {init:"K",name:"Kwame A.",meta:"34 · Ghana",
     quote:"I doubled my freelance income in 3 months using the career roadmap. The currency-specific advice was a game changer."},
    {init:"P",name:"Priya S.",meta:"26 · India",
     quote:"The relationship section alone changed how I communicate at work. I've never had a tool understand my situation this well."},
  ];

  const sec={padding:"56px 24px",maxWidth:860,margin:"0 auto"};

  return(
    <div style={{background:G.bg,color:G.cream,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",overflowX:"hidden",minHeight:"100vh"}}>

      {/* ══════════════════════════════════════════
          STICKY NAV
      ══════════════════════════════════════════ */}
      <nav style={{position:"sticky",top:0,zIndex:300,
        background:scrolled?"rgba(10,8,0,0.96)":"transparent",
        backdropFilter:scrolled?"blur(20px)":"none",
        WebkitBackdropFilter:scrolled?"blur(20px)":"none",
        borderBottom:scrolled?"1px solid rgba(240,180,41,0.1)":"1px solid transparent",
        padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",
        transition:"all 0.3s ease",maxWidth:"100%",boxSizing:"border-box"}}>
        <div style={{fontWeight:800,fontSize:20,color:G.cream,cursor:"pointer",letterSpacing:"-.3px"}}
          onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
          Destin<span style={{color:G.gold}}>IQ</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onStart}
            style={{background:"none",border:"none",color:G.dim,cursor:"pointer",fontSize:14,fontWeight:500,padding:"8px 14px"}}>
            Sign In
          </button>
          <button onClick={onStart}
            style={{background:G.gold,color:"#000",border:"none",borderRadius:10,
              padding:"9px 20px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            Get Started Free
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section style={{padding:"52px 24px 64px",maxWidth:600,margin:"0 auto"}}>
        <Badge icon="⚡" text="AI-POWERED PERSONAL INTELLIGENCE"/>

        <h1 style={{fontSize:"clamp(40px,10vw,64px)",fontWeight:800,lineHeight:1.08,
          letterSpacing:"-1.5px",margin:"0 0 22px",color:G.cream}}>
          The system<br/>that knows<br/>
          <span style={{color:G.gold}}>your next<br/>move.</span>
        </h1>

        <p style={{fontSize:16,lineHeight:1.75,color:G.dim,margin:"0 0 36px",maxWidth:420}}>
          DestinIQ analyzes your current situation, uncovers what's holding you back, and gives you a personalized roadmap to improve your life.
        </p>

        {/* CTAs */}
        <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:380,marginBottom:32}}>
          <button onClick={onStart}
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              background:G.gold,color:"#000",border:"none",borderRadius:13,
              padding:"17px 28px",fontSize:16,fontWeight:700,cursor:"pointer",
              boxShadow:"0 0 40px rgba(240,180,41,0.25)"}}>
            Start Your Journey <span style={{fontSize:18}}>→</span>
          </button>
          <button
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              background:"transparent",color:G.dim,
              border:"1px solid rgba(232,220,200,0.14)",
              borderRadius:13,padding:"15px 28px",fontSize:14,fontWeight:500,cursor:"pointer",opacity:.85}} onClick={()=>window.open("https://www.loom.com/share/destiniq-demo","_blank")}>
            <span style={{fontSize:12,opacity:.7}}>▶</span> Watch Demo
          </button>
        </div>

        {/* Social proof avatars */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <div style={{display:"flex"}}>
            {["#c0392b","#d4ac0d","#1a9e88","#7d3c98","#2980b9"].map((c,i)=>(
              <div key={i} style={{width:32,height:32,borderRadius:"50%",background:c,
                border:"2px solid "+G.bg,marginLeft:i>0?-10:0,display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700}}>
                {"ABCDE"[i]}
              </div>
            ))}
          </div>
          <div style={{fontSize:14}}>
            <strong style={{color:G.cream}}>{userCount.toLocaleString()}+ people</strong>
            <span style={{color:G.dim}}> transforming their lives</span>
          </div>
        </div>

        <button onClick={onStart}
          style={{background:"none",border:"none",color:G.dimmer,cursor:"pointer",
            fontSize:13,padding:"4px 0",textDecoration:"underline",textDecorationColor:"rgba(232,220,200,0.2)"}}>
          I already have an account
        </button>

        {/* Press logos */}
        <div style={{borderTop:"1px solid rgba(232,220,200,0.07)",paddingTop:28,marginTop:36}}>
          <div style={{fontSize:9,color:G.dimmer,letterSpacing:"1.6px",marginBottom:14,textTransform:"uppercase",fontFamily:"monospace"}}>Featured in</div>
          <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"center"}}>
            {["Forbes","TechCrunch","Business Insider"].map(n=>(
              <span key={n} style={{fontSize:13,fontWeight:700,color:G.dimmer,letterSpacing:"-.2px"}}>{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS
      ══════════════════════════════════════════ */}
      <section style={{padding:"0 24px 56px",maxWidth:860,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",
          background:"rgba(240,180,41,0.05)",border:"1px solid rgba(240,180,41,0.14)",
          borderRadius:18,overflow:"hidden"}}>
          {[
            {num:"50+",   label:"Countries Served"},
            {num:"40+",   label:"AI Intelligence Tools"},
            {num:"10K+",  label:"Reports Generated"},
          ].map(({num,label},i)=>(
            <div key={label} style={{padding:"28px 20px",textAlign:"center",
              borderRight:i<2?"1px solid rgba(240,180,41,0.1)":"none"}}>
              <div style={{fontSize:"clamp(20px,6vw,32px)",fontWeight:800,color:G.gold,lineHeight:1,marginBottom:6}}>{num}</div>
              <div style={{fontSize:12,color:G.dim,lineHeight:1.4}}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════ */}
      <section style={{...sec,paddingTop:16}}>
        <div style={{marginBottom:36}}>
          <Badge icon="✦" text="WHAT DESTINIQ COVERS"/>
          <h2 style={{fontSize:"clamp(26px,6vw,38px)",fontWeight:800,lineHeight:1.2,margin:0,color:G.cream}}>
            Every area of your life.<br/>
            <span style={{color:G.gold}}>One intelligent system.</span>
          </h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
          {features.map((f)=>(
            <div key={f.title} style={{background:G.card,border:"1px solid rgba(232,220,200,0.06)",
              borderRadius:16,padding:"22px",display:"flex",gap:16,alignItems:"flex-start",
              transition:"border-color 0.2s"}}>
              <div style={{width:48,height:48,borderRadius:13,
                background:f.color+"14",border:"1px solid "+f.color+"22",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
                {f.icon}
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:G.cream,marginBottom:7,lineHeight:1.3}}>{f.title}</div>
                <div style={{fontSize:13,color:G.dim,lineHeight:1.65}}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PREVIEW (mock report)
      ══════════════════════════════════════════ */}
      <section style={{...sec}}>
        <div style={{marginBottom:28}}>
          <Badge icon="📋" text="REPORT PREVIEW"/>
          <h2 style={{fontSize:"clamp(24px,6vw,34px)",fontWeight:800,lineHeight:1.25,margin:"0 0 10px",color:G.cream}}>
            See exactly what<br/>
            <span style={{color:G.gold}}>your report looks like.</span>
          </h2>
          <p style={{fontSize:14,color:G.dim,lineHeight:1.7,maxWidth:440,margin:0}}>
            A real-time intelligence profile built entirely around your life — your country, income, goals, and blockers.
          </p>
        </div>

        <div style={{background:"linear-gradient(145deg,#0f0820,#130c08)",
          border:"1px solid rgba(120,80,200,0.2)",borderRadius:20,overflow:"hidden",
          padding:"28px",position:"relative",maxWidth:520}}>
          {/* Decorative glow */}
          <div style={{position:"absolute",top:0,right:0,width:"55%",height:"100%",
            background:"radial-gradient(ellipse at 80% 40%,rgba(90,50,180,0.2),transparent 65%)",
            pointerEvents:"none"}}/>
          <div style={{position:"relative"}}>
            <div style={{fontSize:9,color:"rgba(200,160,255,0.6)",letterSpacing:".12em",
              marginBottom:14,fontFamily:"monospace"}}>YOUR CORE INSIGHT</div>

            <blockquote style={{fontSize:14,fontWeight:600,color:G.cream,lineHeight:1.75,
              fontStyle:"italic",margin:"0 0 24px",maxWidth:360}}>
              "You are a high-potential individual with strong ambition — your progress is currently blocked by inconsistency and overthinking."
            </blockquote>

            {/* Score ring */}
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
              <div style={{position:"relative",width:68,height:68}}>
                <svg width={68} height={68} style={{transform:"rotate(-90deg)",position:"absolute"}}>
                  <circle cx={34} cy={34} r={28} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5}/>
                  <circle cx={34} cy={34} r={28} fill="none" stroke={G.gold} strokeWidth={5}
                    strokeDasharray="175.9" strokeDashoffset="38.7" strokeLinecap="round"/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:14,fontWeight:800,color:G.gold}}>78%</div>
              </div>
              <div>
                <div style={{fontSize:9,color:G.dimmer,letterSpacing:".1em",fontFamily:"monospace",marginBottom:4}}>OVERALL POTENTIAL SCORE</div>
                <div style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:800,color:G.cream}}>78<span style={{fontSize:12,color:G.dim}}>/100</span></div>
              </div>
            </div>

            {/* Mock metrics */}
            {[
              {label:"Primary Focus",val:"Relationships",color:"#e57373"},
              {label:"Key Blocker",   val:"Overthinking", color:G.gold},
              {label:"First Move",   val:"Start Week 1 →",color:"#81c784"},
            ].map(({label,val,color},i)=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"10px 0",
                borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                <span style={{fontSize:12,color:G.dim}}>{label}</span>
                <span style={{fontSize:12,fontWeight:700,color}}>{val}</span>
              </div>
            ))}

            {/* CTA bar */}
            <div style={{marginTop:20,padding:"14px 18px",
              background:"rgba(240,180,41,0.07)",border:"1px solid rgba(240,180,41,0.2)",
              borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}
              onClick={onStart}>
              <span style={{fontSize:13,color:G.cream,fontWeight:600}}>Get your full report</span>
              <span style={{fontSize:13,color:G.gold,fontWeight:700}}>Free in 60s →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════ */}
      <section style={{...sec}}>
        <div style={{marginBottom:32}}>
          <Badge icon="💬" text="WHAT PEOPLE SAY"/>
          <h2 style={{fontSize:"clamp(24px,6vw,34px)",fontWeight:800,lineHeight:1.25,margin:0,color:G.cream}}>
            Real results from<br/><span style={{color:G.gold}}>real people.</span>
          </h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
          {testimonials.map((t,i)=>(
            <div key={t.name} style={{background:G.card,border:"1px solid rgba(232,220,200,0.06)",
              borderRadius:16,padding:"22px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{width:40,height:40,borderRadius:"50%",
                  background:`hsl(${i*80+30},50%,42%)`,display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff",flexShrink:0}}>
                  {t.init}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:G.cream}}>{t.name}</div>
                  <div style={{fontSize:11,color:G.dim}}>{t.meta}</div>
                </div>
                <div style={{color:G.gold,fontSize:12,letterSpacing:"1px"}}>★★★★★</div>
              </div>
              <p style={{fontSize:13,color:G.dim,lineHeight:1.7,margin:0,fontStyle:"italic"}}>
                "{t.quote}"
              </p>
            </div>
          ))}
        </div>
      </section>


      {/* ══════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════ */}
      <section style={{...sec,paddingBottom:80,paddingTop:80}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:".15em",fontFamily:"monospace",marginBottom:12}}>SIMPLE PRICING</div>
          <h2 style={{fontSize:"clamp(28px,5vw,42px)",fontWeight:900,color:G.cream,margin:"0 0 12px",lineHeight:1.2}}>Start free. Upgrade when ready.</h2>
          <p style={{fontSize:15,color:G.dim,maxWidth:480,margin:"0 auto"}}>No hidden fees. Cancel anytime. Works for Ghana, Nigeria, UK, Canada, Australia and everywhere in between.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,maxWidth:900,margin:"0 auto"}}>
          {[
            {name:"Free",price:"$0",period:"forever",color:"rgba(255,255,255,0.06)",border:"rgba(255,255,255,0.1)",badge:null,
             features:["1 Intelligence Report","5 starter AI tools","Daily Check-in","Win Tracker (5/day)","AI Advisor (limited)"],
             cta:"Get Started Free",ctaStyle:{background:"rgba(255,255,255,0.08)",color:G.cream},
             action:()=>onStart()},
            {name:"Pro",price:"$9.99",period:"per month",color:"rgba(240,180,41,0.06)",border:"rgba(240,180,41,0.3)",badge:"Most Popular",
             features:["3 Intelligence Reports/month","All 42 AI tools","Unlimited Check-ins","Unlimited Win Tracker","AI Advisor (6,000 chars/day)","Practices & habits","Progress tracking","Audio report read-aloud"],
             cta:"Start Pro →",ctaStyle:{background:G.gold,color:"#000"},
             action:()=>onStart()},
            {name:"Pro Max",price:"$24.99",period:"per month",color:"rgba(155,114,207,0.06)",border:"rgba(155,114,207,0.3)",badge:"Everything",
             features:["Unlimited Intelligence Reports","All 42 AI tools","Unlimited AI Advisor","Weekly AI Digest","PDF export","Score comparison history","Priority everything"],
             cta:"Start Pro Max →",ctaStyle:{background:"#9b72cf",color:"#fff"},
             action:()=>onStart()},
          ].map(plan=>(
            <div key={plan.name} style={{background:plan.color,border:"1px solid "+plan.border,borderRadius:20,padding:"28px 24px",position:"relative",display:"flex",flexDirection:"column"}}>
              {plan.badge&&(
                <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:plan.name==="Pro"?G.gold:"#9b72cf",color:plan.name==="Pro"?"#000":"#fff",fontSize:10,fontWeight:700,padding:"3px 12px",borderRadius:20,letterSpacing:".08em",whiteSpace:"nowrap"}}>
                  {plan.badge}
                </div>
              )}
              <div style={{fontSize:13,fontWeight:700,color:G.dim,letterSpacing:".05em",marginBottom:4}}>{plan.name.toUpperCase()}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                <span style={{fontSize:"clamp(24px,7vw,36px)",fontWeight:900,color:G.cream}}>{plan.price}</span>
                <span style={{fontSize:12,color:G.dim}}>{plan.period}</span>
              </div>
              <div style={{height:1,background:"rgba(255,255,255,0.07)",margin:"16px 0"}}/>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                {plan.features.map(f=>(
                  <div key={f} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:13,color:G.dim}}>
                    <span style={{color:G.gold,flexShrink:0,marginTop:1}}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button onClick={plan.action} style={{...plan.ctaStyle,border:"none",borderRadius:12,padding:"12px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
        <p style={{textAlign:"center",fontSize:12,color:G.dimmer,marginTop:24}}>All plans include a 7-day satisfaction guarantee. Pay by card worldwide via Paystack.</p>
      </section>

      {/* ══════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════ */}
      <section style={{...sec,paddingBottom:80}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:".15em",fontFamily:"monospace",marginBottom:12}}>FAQ</div>
          <h2 style={{fontSize:"clamp(24px,4vw,36px)",fontWeight:900,color:G.cream,margin:0}}>Questions you probably have</h2>
        </div>
        <div style={{maxWidth:680,margin:"0 auto",display:"flex",flexDirection:"column",gap:2}}>
          {[
            ["What exactly is DestinIQ?","DestinIQ is an AI personal intelligence platform. You answer questions about your life, goals, income and challenges during a short onboarding. The AI then generates a deep personalised intelligence report covering your career path, blind spots, financial situation, mindset patterns, and a step-by-step action plan. You also get access to 42 AI tools covering every area of your life."],
            ["How is this different from just asking ChatGPT?","ChatGPT gives generic answers to generic questions. DestinIQ knows your specific name, age, country, income level, goals and challenges — and everything it generates is built around your actual situation. It remembers your profile and builds on it. It's the difference between talking to a stranger and talking to someone who has studied you."],
            ["Is my data private and safe?","Yes. Your data is stored encrypted on Supabase (AWS infrastructure). We never sell or share your personal information with anyone. Your AI reports are only accessible from your account. We use Paystack for payments — we never see your card details."],
            ["Can I cancel anytime?","Yes, completely. No contracts, no tricks. Email support@destiniq.app and we'll cancel your subscription immediately. If you're within 7 days of a charge, email us and we'll look at a refund."],
            ["Does it work if I'm in Ghana, Nigeria, UK, Canada, or Australia?","Yes. DestinIQ is designed for English-speaking users globally. The AI knows about local job markets, visa options, salary ranges, and economic realities in your specific country. It gives you locally relevant advice, not generic Western answers."],
            ["How accurate is the AI report?","The report is as accurate as the information you provide. The more honest and detailed your onboarding answers, the sharper your report. Users consistently say it surfaces things about themselves they hadn't consciously put into words. That said — it's AI guidance, not a substitute for professional financial, legal, or medical advice."],
          ].map(([q,a],i)=>(
            <FAQItem key={i} q={q} a={a} G={G}/>
          ))}
        </div>
      </section>
      {/* ══════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════ */}
      <section style={{...sec,paddingBottom:80}}>
        <div style={{background:"linear-gradient(135deg,rgba(240,180,41,0.06),rgba(240,180,41,0.02))",
          border:"1px solid rgba(240,180,41,0.16)",borderRadius:24,padding:"52px 36px",textAlign:"center"}}>
          <h2 style={{fontSize:"clamp(26px,6vw,40px)",fontWeight:800,lineHeight:1.25,
            margin:"0 0 14px",color:G.cream}}>
            Start making better<br/>decisions <span style={{color:G.gold}}>today.</span>
          </h2>
          <p style={{fontSize:15,color:G.dim,lineHeight:1.7,margin:"0 auto 32px",maxWidth:360}}>
            Your personalized intelligence report is ready in 60 seconds. Always free to start.
          </p>
          <button onClick={onStart}
            style={{display:"inline-flex",alignItems:"center",gap:10,
              background:G.gold,color:"#000",border:"none",borderRadius:13,
              padding:"17px 36px",fontSize:16,fontWeight:700,cursor:"pointer",marginBottom:14,
              boxShadow:"0 0 50px rgba(240,180,41,0.2)"}}>
            Create Free Account <span style={{fontSize:18}}>→</span>
          </button>
          <p style={{fontSize:11,color:G.dimmer,margin:0}}>
            No credit card required · Free forever · Cancel anytime
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer style={{borderTop:"1px solid rgba(232,220,200,0.06)",padding:"28px 24px 36px",
        maxWidth:860,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          flexWrap:"wrap",gap:12,marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:17,color:G.cream}}>
            Destin<span style={{color:G.gold}}>IQ</span>
          </div>
          <div style={{display:"flex",gap:20}}>
            {[
              {label:"Privacy Policy", action:()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:"privacy"}))},
              {label:"Terms of Service",action:()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:"terms"}))},
              {label:"Contact",         action:()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:"contact"}))},
              {label:"About Us",        action:()=>window.dispatchEvent(new CustomEvent("showAbout"))},
            ].map(l=>(
              <span key={l.label} onClick={l.action}
                style={{fontSize:12,color:G.dimmer,cursor:"pointer",
                  transition:"color .15s"}}
                onMouseEnter={e=>e.target.style.color=G.gold}
                onMouseLeave={e=>e.target.style.color=G.dimmer}>
                {l.label}
              </span>
            ))}
          </div>
        </div>
        <p style={{fontSize:11,color:G.dimmer,margin:0,textAlign:"center"}}>
          © 2026 DestinIQ. All rights reserved. · Built for people who take their growth seriously.
        </p>
      </footer>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════════════
// INTAKE
// 4-step onboarding: Focus → Info → Goal → Blockers
// ═══════════════════════════════════════════════════════════════════════════════
function Intake({onSubmit, savedFormData, ipLocation}){
  // ── 8 steps (0-indexed: 0=name, 1=basics, 2-6=conversational, 7=done) ──
  const TOTAL = 8; // steps 0-6 have questions, step 7 is "Almost there!"

  const detectedCountry = savedFormData?.country || ipLocation?.country || "";

  const [step, setStep]       = useState(()=>{try{return Math.min(parseInt(localStorage.getItem("diq_ob_step")||"0"),6);}catch{return 0;}});
  const [err,  setErr]        = useState("");
  const [showDrop, setShowDrop] = useState(false);

  const [f, setF] = useState(()=>{
    let draft = {};
    try{ draft = JSON.parse(localStorage.getItem("diq_ob_draft")||"{}"); }catch{}
    const sd = savedFormData || {};
    return {
      name:       sd.name       || draft.name       || "",
      age:        sd.age        || draft.age         || "",
      country:    sd.country    || draft.country     || detectedCountry || "Ghana",
      cSearch:    sd.country    || draft.country     || detectedCountry || "Ghana",
      occupation: sd.career     || draft.occupation  || "",
      income:     sd.income     || draft.income      || "",
      priorities: Array.isArray(sd.blockers)&&sd.priorities ? sd.priorities
                  : Array.isArray(draft.priorities)  ? draft.priorities : [],
      mindset:    sd.mindset    || draft.mindset     || "",
      blockers:   Array.isArray(sd.blockers)         ? sd.blockers
                  : Array.isArray(draft.blockers)    ? draft.blockers : [],
      mood:       sd.mood       || draft.mood        || "",
      vision:     sd.goals      || sd.bigGoal        || draft.vision || "",
    };
  });

  // Autosave on every change
  useEffect(()=>{ try{localStorage.setItem("diq_ob_draft", JSON.stringify(f));}catch{} },[f]);
  useEffect(()=>{ if(step<7)try{localStorage.setItem("diq_ob_step", step.toString());}catch{} },[step]);

  const set = (k,v) => setF(p=>({...p,[k]:v}));

  // ── Option data ───────────────────────────────────────────────────────────
  const PRIORITIES = [
    {id:"finances",      icon:"💰", label:"Improve my finances"},
    {id:"habits",        icon:"⚡", label:"Build better habits"},
    {id:"purpose",       icon:"⭐", label:"Find my purpose"},
    {id:"relationships", icon:"❤️", label:"Better relationships"},
    {id:"health",        icon:"💚", label:"Improve my health"},
    {id:"business",      icon:"📈", label:"Grow my business"},
  ];
  const MINDSETS = [
    {id:"growth", icon:"🏆", label:"Growth mindset",  desc:"I believe I can improve and learn anything"},
    {id:"fixed",  icon:"🔒", label:"Fixed mindset",   desc:"I often feel stuck and struggle to change"},
    {id:"mixed",  icon:"🔄", label:"Mixed mindset",   desc:"I have good days and bad days"},
  ];
  const BLOCKERS_OPT = [
    {id:"discipline",   icon:"🎯", label:"Lack of discipline"},
    {id:"overthinking", icon:"🧠", label:"Overthinking"},
    {id:"money",        icon:"💸", label:"Lack of money"},
    {id:"fear",         icon:"😨", label:"Fear of failure"},
    {id:"direction",    icon:"🧭", label:"Lack of direction"},
    {id:"time",         icon:"⏰", label:"No time"},
  ];
  const MOODS = [
    {id:"hopeful",   emoji:"😊", label:"Hopeful"},
    {id:"stressed",  emoji:"😰", label:"Stressed"},
    {id:"anxious",   emoji:"😟", label:"Anxious"},
    {id:"tired",     emoji:"😴", label:"Tired"},
    {id:"neutral",   emoji:"😐", label:"Neutral"},
    {id:"motivated", emoji:"🔥", label:"Motivated"},
  ];

  const togglePriority = (id)=>setF(p=>{
    const cur = Array.isArray(p.priorities)?p.priorities:[];
    if(cur.includes(id)) return {...p,priorities:cur.filter(x=>x!==id)};
    if(cur.length>=3)    return p;
    return {...p,priorities:[...cur,id]};
  });
  const toggleBlocker = (id)=>setF(p=>{
    const cur = Array.isArray(p.blockers)?p.blockers:[];
    if(cur.includes(id)) return {...p,blockers:cur.filter(x=>x!==id)};
    if(cur.length>=3)    return p;
    return {...p,blockers:[...cur,id]};
  });

  const validate = ()=>{
    if(step===0 && !f.name.trim())                       return "Please tell us your name.";
    if(step===1){
      const a=parseInt(f.age);
      if(!f.age||isNaN(a)||a<13||a>99)                  return "Please enter a valid age (13–99).";
      if(!f.country.trim())                              return "Please select your country.";
    }
    if(step===2 && (!Array.isArray(f.priorities)||f.priorities.length===0)) return "Please select at least one.";
    if(step===3 && !f.mindset)                           return "Please choose your mindset.";
    if(step===4 && (!Array.isArray(f.blockers)||f.blockers.length===0))     return "Please select at least one.";
    if(step===5 && !f.mood)                              return "Please choose how you typically feel.";
    if(step===6 && f.vision.trim().length<10)            return "Please describe what success looks like for you.";
    return "";
  };

  const next = ()=>{
    const e=validate(); if(e){setErr(e);return;} setErr("");
    setStep(s=>s+1);
  };
  const back = ()=>{ setErr(""); setStep(s=>Math.max(0,s-1)); };

  // Auto-submit on step 7 (Almost there!)
  useEffect(()=>{
    if(step!==7) return;
    const priorityLabels = PRIORITIES.filter(p=>f.priorities.includes(p.id)).map(p=>p.label);
    const blockerLabels  = BLOCKERS_OPT.filter(b=>f.blockers.includes(b.id)).map(b=>b.label);
    const mindsetObj     = MINDSETS.find(m=>m.id===f.mindset);
    const moodObj        = MOODS.find(m=>m.id===f.mood);
    const currData       = getCurrencyForCountry(f.country)||{currency:"USD",symbol:"$"};

    const timer = setTimeout(()=>{
      // Clear draft on successful submit
      try{localStorage.removeItem("diq_ob_draft");localStorage.removeItem("diq_ob_step");}catch{}
      onSubmit({
        name:            f.name,
        age:             f.age,
        country:         f.country,
        career:          f.occupation||"",
        income:          f.income||"",
        currency:        currData.currency,
        currencySymbol:  currData.symbol,
        focus:           priorityLabels[0]||"",
        interests:       priorityLabels.join(", "),
        wantFrom:        "all",
        situation:       `${mindsetObj?.label||""}. Feeling ${moodObj?.label||""}. Priorities: ${priorityLabels.join(", ")}`,
        goals:           f.vision,
        bigGoal:         f.vision,
        challenge:       blockerLabels.join(", "),
        blockers:        blockerLabels,
        skills:          "",
        habits:          "",
        support:         "",
        relationship:    "",
        education:       "",
      });
    }, 1800);
    return ()=>clearTimeout(timer);
  },[step]);

  // ── Design tokens ─────────────────────────────────────────────────────────
  const G = {
    gold:"#f0b429", bg:"#0a0800", card:"#131008", cardSel:"#1a1408",
    border:"rgba(232,220,200,0.08)", cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.5)", dimmer:"rgba(232,220,200,0.25)",
    inp:"#0f0c03", inpBorder:"rgba(232,220,200,0.13)",
  };
  const iStyle={width:"100%",padding:"14px 16px",background:G.inp,
    border:"1px solid "+G.inpBorder,borderRadius:12,color:G.cream,
    fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};

  // ── Screen: Almost there! ─────────────────────────────────────────────────
  if(step===7) return(
    <div style={{minHeight:"100vh",background:G.bg,color:G.cream,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      textAlign:"center",padding:"40px 24px"}}>

      {/* Pulsing sparkle ring */}
      <div style={{position:"relative",width:130,height:130,marginBottom:32}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",
          border:"3px solid "+G.gold,
          boxShadow:"0 0 40px rgba(240,180,41,0.35),0 0 80px rgba(240,180,41,0.15)",
          animation:"obPulse 2s ease-in-out infinite"}}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:56,color:G.gold}}>✦</div>
      </div>

      <h1 style={{fontSize:"clamp(20px,6vw,32px)",fontWeight:800,color:G.cream,marginBottom:14,lineHeight:1.2}}>
        Almost there!
      </h1>
      <p style={{fontSize:15,color:G.dim,lineHeight:1.7,marginBottom:10,maxWidth:300}}>
        We'll analyze your answers and generate your personalized report.
      </p>
      <p style={{fontSize:13,color:G.dimmer,margin:0}}>This will only take a few seconds…</p>

      <style>{`
        @keyframes obPulse{
          0%,100%{transform:scale(1);opacity:1}
          50%{transform:scale(1.07);opacity:.75}
        }
      `}</style>
    </div>
  );

  // ── Progress calc (steps 0–6 are questions) ───────────────────────────────
  const progress = (step+1)/7;

  return(
    <div style={{minHeight:"100vh",background:G.bg,color:G.cream,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      display:"flex",flexDirection:"column"}}>

      {/* ── Top bar: back + progress bar ─── */}
      <div style={{padding:"max(16px,env(safe-area-inset-top)) 20px 0"}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
          {step>0
            ?<button onClick={back} style={{background:"none",border:"none",color:G.dim,
                cursor:"pointer",fontSize:22,padding:0,minWidth:32,minHeight:32,lineHeight:1,marginRight:8}}>←</button>
            :<div style={{width:32,marginRight:8}}/>
          }
          {/* Segmented progress */}
          <div style={{flex:1,display:"flex",gap:4}}>
            {[0,1,2,3,4,5,6].map(i=>(
              <div key={i} style={{flex:1,height:3,borderRadius:2,
                background:i<=step?"#f0b429":"rgba(232,220,200,0.1)",
                transition:"background 0.3s"}}/>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ─── */}
      <div style={{flex:1,padding:"24px 20px 140px",maxWidth:520,margin:"0 auto",
        width:"100%",boxSizing:"border-box"}}>

        {/* ════ STEP 0: Name ════ */}
        {step===0&&(
          <div>
            <h2 style={{fontSize:30,fontWeight:800,color:G.cream,textAlign:"center",
              lineHeight:1.2,marginBottom:8}}>
              What should<br/>we call you?
            </h2>
            <p style={{fontSize:13,color:G.dim,textAlign:"center",marginBottom:32}}>
              This is how we'll address you in your report.
            </p>
            <input autoFocus value={f.name} onChange={e=>set("name",e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&next()}
              placeholder="Your first name" maxLength={60}
              style={{...iStyle,fontSize:18,textAlign:"center",padding:"18px",
                border:"1px solid "+(f.name?G.gold:G.inpBorder),letterSpacing:".5px"}}/>
          </div>
        )}

        {/* ════ STEP 1: Basics ════ */}
        {step===1&&(
          <div>
            <h2 style={{fontSize:"clamp(20px,5.5vw,28px)",fontWeight:800,color:G.cream,textAlign:"center",
              lineHeight:1.25,marginBottom:8}}>
              Let's personalize<br/>your journey
            </h2>
            <p style={{fontSize:13,color:G.dim,textAlign:"center",marginBottom:28}}>
              You can change these later.
            </p>

            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:G.dim,fontWeight:700,
                letterSpacing:".08em",marginBottom:7,textTransform:"uppercase"}}>How old are you?</label>
              <input type="number" min="13" max="99" value={f.age}
                onChange={e=>set("age",e.target.value)} placeholder="25"
                style={{...iStyle,border:"1px solid "+(f.age?G.gold:G.inpBorder)}}/>
            </div>

            <div style={{marginBottom:14,position:"relative"}}>
              <label style={{display:"block",fontSize:11,color:G.dim,fontWeight:700,
                letterSpacing:".08em",marginBottom:7,textTransform:"uppercase"}}>What's your country?</label>
              <input value={f.cSearch}
                onChange={e=>{set("cSearch",e.target.value);setShowDrop(true);if(!e.target.value)set("country","");}}
                onFocus={()=>setShowDrop(true)}
                onBlur={()=>setTimeout(()=>setShowDrop(false),200)}
                placeholder="Search country…"
                style={{...iStyle,border:"1px solid "+(f.country?G.gold:G.inpBorder)}}/>
              {showDrop&&f.cSearch&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1a1408",
                  border:"1px solid rgba(240,180,41,0.2)",borderRadius:12,zIndex:100,
                  maxHeight:200,overflowY:"auto",marginTop:4,boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
                  {(Array.isArray(COUNTRIES_LIST)?COUNTRIES_LIST:[]).filter(c=>c.name.toLowerCase().includes(f.cSearch.toLowerCase())).slice(0,8).map(c=>(
                    <div key={c.name}
                      onMouseDown={()=>{set("country",c.name);set("cSearch",c.name);setShowDrop(false);}}
                      style={{padding:"12px 16px",cursor:"pointer",display:"flex",
                        justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.04)"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(240,180,41,0.07)"}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      <span style={{fontSize:14,color:G.cream}}>{c.name}</span>
                      <span style={{fontSize:11,color:G.dim,fontFamily:"monospace"}}>{c.symbol}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:G.dim,fontWeight:700,
                letterSpacing:".08em",marginBottom:7,textTransform:"uppercase"}}>
                What do you do? <span style={{color:G.dimmer,textTransform:"none",fontWeight:400}}>optional</span>
              </label>
              <input value={f.occupation} onChange={e=>set("occupation",e.target.value)}
                placeholder="e.g. Student, Engineer, Freelancer…"
                style={iStyle}/>
            </div>

            <div>
              <label style={{display:"block",fontSize:11,color:G.dim,fontWeight:700,
                letterSpacing:".08em",marginBottom:7,textTransform:"uppercase"}}>
                Monthly income <span style={{color:G.dimmer,textTransform:"none",fontWeight:400}}>optional</span>
              </label>
              <select value={f.income} onChange={e=>set("income",e.target.value)}
                style={{...iStyle,appearance:"none",color:f.income?G.cream:G.dim}}>
                <option value="">Select range…</option>
                {getIncomeRanges((()=>(getCurrencyForCountry(f.country)||{symbol:"$"}).symbol)()).map(r=>(
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ════ STEP 2: Priorities (multi-select up to 3) ════ */}
        {step===2&&(
          <div>
            <h2 style={{fontSize:28,fontWeight:800,color:G.cream,textAlign:"center",
              lineHeight:1.2,marginBottom:8}}>
              What's most<br/>important to you<br/>right now?
            </h2>
            <p style={{fontSize:13,color:G.dim,textAlign:"center",marginBottom:24}}>Select up to 3</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {PRIORITIES.map(p=>{
                const sel=Array.isArray(f.priorities)&&f.priorities.includes(p.id);
                const maxed=Array.isArray(f.priorities)&&f.priorities.length>=3&&!sel;
                return(
                  <div key={p.id} onClick={()=>!maxed&&togglePriority(p.id)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                      padding:"14px 16px",
                      background:sel?"rgba(240,180,41,0.07)":G.card,
                      border:"1.5px solid "+(sel?G.gold:G.border),
                      borderRadius:13,cursor:maxed?"default":"pointer",
                      opacity:maxed?0.38:1,transition:"all .15s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:13}}>
                      <span style={{fontSize:20}}>{p.icon}</span>
                      <span style={{fontSize:15,color:sel?G.cream:G.dim,fontWeight:sel?600:400}}>{p.label}</span>
                    </div>
                    <div style={{width:22,height:22,borderRadius:6,flexShrink:0,
                      border:"2px solid "+(sel?G.gold:"rgba(232,220,200,0.2)"),
                      background:sel?G.gold:"transparent",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel&&<span style={{color:"#000",fontSize:13,fontWeight:900,lineHeight:1}}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ STEP 3: Mindset (radio) ════ */}
        {step===3&&(
          <div>
            <h2 style={{fontSize:28,fontWeight:800,color:G.cream,textAlign:"center",
              lineHeight:1.2,marginBottom:8}}>
              How would you<br/>describe your<br/>mindset?
            </h2>
            <p style={{fontSize:13,color:G.dim,textAlign:"center",marginBottom:24}}>Choose one</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {MINDSETS.map(m=>{
                const sel=f.mindset===m.id;
                return(
                  <div key={m.id} onClick={()=>set("mindset",m.id)}
                    style={{display:"flex",alignItems:"center",gap:14,padding:"18px",
                      background:sel?"rgba(240,180,41,0.07)":G.card,
                      border:"1.5px solid "+(sel?G.gold:G.border),
                      borderRadius:14,cursor:"pointer",transition:"all .15s"}}>
                    <span style={{fontSize:24,flexShrink:0}}>{m.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:700,color:sel?G.cream:G.dim,marginBottom:4}}>{m.label}</div>
                      <div style={{fontSize:12,color:"rgba(232,220,200,0.38)",lineHeight:1.5}}>{m.desc}</div>
                    </div>
                    <div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,
                      border:"2px solid "+(sel?G.gold:"rgba(232,220,200,0.2)"),
                      background:sel?G.gold:"transparent",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel&&<div style={{width:8,height:8,borderRadius:"50%",background:"#000"}}/>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ STEP 4: Blockers (multi-select up to 3) ════ */}
        {step===4&&(
          <div>
            <h2 style={{fontSize:28,fontWeight:800,color:G.cream,textAlign:"center",
              lineHeight:1.2,marginBottom:8}}>
              What's holding<br/>you back<br/>the most?
            </h2>
            <p style={{fontSize:13,color:G.dim,textAlign:"center",marginBottom:24}}>Select up to 3</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {BLOCKERS_OPT.map(b=>{
                const sel=Array.isArray(f.blockers)&&f.blockers.includes(b.id);
                const maxed=Array.isArray(f.blockers)&&f.blockers.length>=3&&!sel;
                return(
                  <div key={b.id} onClick={()=>!maxed&&toggleBlocker(b.id)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                      padding:"14px 16px",
                      background:sel?"rgba(240,180,41,0.07)":G.card,
                      border:"1.5px solid "+(sel?G.gold:G.border),
                      borderRadius:13,cursor:maxed?"default":"pointer",
                      opacity:maxed?0.38:1,transition:"all .15s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:13}}>
                      <span style={{fontSize:20}}>{b.icon}</span>
                      <span style={{fontSize:15,color:sel?G.cream:G.dim,fontWeight:sel?600:400}}>{b.label}</span>
                    </div>
                    <div style={{width:22,height:22,borderRadius:6,flexShrink:0,
                      border:"2px solid "+(sel?G.gold:"rgba(232,220,200,0.2)"),
                      background:sel?G.gold:"transparent",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel&&<span style={{color:"#000",fontSize:13,fontWeight:900,lineHeight:1}}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ STEP 5: Mood (emoji grid) ════ */}
        {step===5&&(
          <div>
            <h2 style={{fontSize:28,fontWeight:800,color:G.cream,textAlign:"center",
              lineHeight:1.2,marginBottom:8}}>
              How do you<br/>typically feel?
            </h2>
            <p style={{fontSize:13,color:G.dim,textAlign:"center",marginBottom:28}}>Choose one</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {MOODS.map(m=>{
                const sel=f.mood===m.id;
                return(
                  <div key={m.id} onClick={()=>set("mood",m.id)}
                    style={{padding:"20px 8px",textAlign:"center",
                      background:sel?"rgba(240,180,41,0.1)":G.card,
                      border:"1.5px solid "+(sel?G.gold:G.border),
                      borderRadius:14,cursor:"pointer",transition:"all .15s"}}>
                    <div style={{fontSize:34,marginBottom:8}}>{m.emoji}</div>
                    <div style={{fontSize:12,color:sel?G.cream:G.dim,fontWeight:sel?600:400,lineHeight:1.3}}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ STEP 6: Vision / Success ════ */}
        {step===6&&(
          <div>
            <h2 style={{fontSize:28,fontWeight:800,color:G.cream,textAlign:"center",
              lineHeight:1.2,marginBottom:8}}>
              What does<br/>success look<br/>like to you?
            </h2>
            <p style={{fontSize:13,color:G.dim,textAlign:"center",marginBottom:24}}>
              Describe it in a few lines.
            </p>
            <textarea
              autoFocus
              value={f.vision}
              onChange={e=>set("vision",e.target.value)}
              placeholder="I want to be financially free, help my family, and live a life of purpose and impact."
              rows={6}
              maxLength={500}
              style={{width:"100%",padding:"16px",background:G.inp,
                border:"1px solid "+(f.vision.length>10?G.gold:G.inpBorder),
                borderRadius:13,color:G.cream,fontSize:15,lineHeight:1.7,
                resize:"none",fontFamily:"inherit",outline:"none",
                boxSizing:"border-box",marginBottom:6}}
            />
            <div style={{textAlign:"right",fontSize:11,color:G.dimmer}}>{f.vision.length}/500</div>
          </div>
        )}

        {/* Validation error */}
        {err&&(
          <div style={{color:"#e05252",fontSize:13,marginTop:14,textAlign:"center"}}>⚠ {err}</div>
        )}
      </div>

      {/* ── Fixed Continue button ─── */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,
        padding:"12px 20px max(16px,env(safe-area-inset-bottom))",
        background:"linear-gradient(transparent,rgba(10,8,0,0.98) 28%)"}}>
        <div style={{maxWidth:520,margin:"0 auto"}}>
          <button onClick={next}
            style={{width:"100%",padding:"17px",background:"#f0b429",color:"#000",
              border:"none",borderRadius:13,fontSize:16,fontWeight:700,cursor:"pointer",
              fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              boxShadow:"0 0 30px rgba(240,180,41,0.2)"}}>
            Continue <span style={{fontSize:18}}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}



function getProfileGaps(fd){
  if(!fd) return {name:true,age:true,country:true,goal:true,blockers:true};
  return {
    name:    !fd.name?.trim(),
    age:     !fd.age,
    country: !fd.country?.trim(),
    goal:    !(fd.goals?.trim()||fd.goal?.trim()),
    blockers:!(fd.challenge?.trim()||(Array.isArray(fd.blockers)&&fd.blockers.length)),
  };
}

function CompleteProfile({savedFormData, onSubmit}){
  const gaps  = getProfileGaps(savedFormData);
  const anyGap= Object.values(gaps).some(Boolean);

  const BLOCKERS_OPT=["Overthinking","Lack of confidence","Past experiences","Fear of rejection","Poor communication","Don't know where to start","Other"];

  // Pre-fill whatever we already have
  const [name,   setName   ]=useState(savedFormData?.name||"");
  const [age,    setAge    ]=useState(savedFormData?.age||"");
  const [country,setCountry]=useState(savedFormData?.country||"Ghana");
  const [cSearch,setCSearch]=useState(savedFormData?.country||"Ghana");
  const [showDrop,setShowDrop]=useState(false);
  const [goal,   setGoal   ]=useState(savedFormData?.goals||savedFormData?.goal||"");
  const [blockers,setBlockers]=useState(()=>{
    if(Array.isArray(savedFormData?.blockers)&&savedFormData.blockers.length) return savedFormData.blockers;
    if(savedFormData?.challenge) return [savedFormData.challenge];
    return [];
  });
  const [err,setErr]=useState("");

  // If nothing is actually missing — just regenerate immediately
  useEffect(()=>{
    if(!anyGap){
      onSubmit({
        ...savedFormData,
        wantFrom: savedFormData?.wantFrom||"all",
        situation:savedFormData?.situation||"employed",
        goals:    savedFormData?.goals||savedFormData?.goal||"",
        challenge:savedFormData?.challenge||(Array.isArray(savedFormData?.blockers)?savedFormData.blockers.join(", "):""),
      });
    }
  },[]);  // eslint-disable-line react-hooks/exhaustive-deps

  if(!anyGap) return(
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{width:36,height:36,border:"3px solid var(--cream-10)",borderTop:"3px solid var(--gold)",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      <p style={{fontSize:13,color:"var(--cream-40)"}}>Regenerating your report…</p>
    </div>
  );

  const toggleB=(b)=>setBlockers(p=>Array.isArray(p)?(p.includes(b)?p.filter(x=>x!==b):[...p,b]):[b]);

  const handleSubmit=()=>{
    if(gaps.name  &&!name.trim())         return setErr("Please enter your name.");
    const ageN=parseInt(age);
    if(gaps.age   &&(!age||isNaN(ageN)||ageN<13||ageN>99)) return setErr("Please enter a valid age.");
    if(gaps.goal  &&!goal.trim())          return setErr("Please describe your goal.");
    if(gaps.blockers&&!blockers.length)    return setErr("Please select at least one challenge.");
    setErr("");

    onSubmit({
      ...savedFormData,
      name:     name   ||savedFormData?.name   ||"",
      age:      age    ||savedFormData?.age    ||"",
      country:  country||savedFormData?.country||"",
      goals:    goal   ||savedFormData?.goals  ||savedFormData?.goal||"",
      goal:     goal   ||savedFormData?.goals  ||savedFormData?.goal||"",
      challenge:blockers.length?blockers.join(", "):(savedFormData?.challenge||""),
      blockers:  blockers.length?blockers:(Array.isArray(savedFormData?.blockers)?savedFormData.blockers:[]),
      bigGoal:   savedFormData?.focus||savedFormData?.bigGoal||"",
      wantFrom:  savedFormData?.wantFrom||"all",
      situation: savedFormData?.situation||"employed",
      career:    savedFormData?.career||"",
      skills:    savedFormData?.skills||"",
      income:    savedFormData?.income||"",
      education: savedFormData?.education||"",
      relationship:savedFormData?.relationship||"",
    });
  };

  const iStyle={width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"13px 16px",color:"var(--cream)",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};

  // Count missing so user knows how short this is
  const missingCount = Object.values(gaps).filter(Boolean).length;
  const userName = savedFormData?.name?.trim();

  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--cream)",fontFamily:"inherit",display:"flex",flexDirection:"column"}}>
      <div style={{flex:1,padding:"32px 24px 56px",maxWidth:500,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>

        {/* Header */}
        <div style={{marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:20,padding:"5px 12px",marginBottom:18}}>
            <span style={{fontSize:11}}>⚡</span>
            <span style={{fontSize:10,color:"var(--gold)",fontWeight:700,letterSpacing:".6px"}}>COMPLETE YOUR PROFILE</span>
          </div>
          <h2 style={{fontSize:"clamp(16px,4.5vw,24px)",fontWeight:800,color:"var(--cream)",lineHeight:1.25,marginBottom:8}}>
            {userName?`Welcome back, ${userName}!`:"Welcome back!"}<br/>
            <span style={{color:"var(--gold)"}}>Let's finish setting you up.</span>
          </h2>
          <p style={{fontSize:13,color:"var(--cream-40)",lineHeight:1.6}}>
            {missingCount===1?"Just one more detail":"A few more details"} and we'll generate your personalized report.
          </p>
        </div>

        {/* ── Missing: Name ── */}
        {gaps.name&&(
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:"var(--cream-40)",letterSpacing:".06em",fontWeight:600,marginBottom:7}}>WHAT SHOULD WE CALL YOU?</label>
            <input autoFocus={gaps.name} value={name} onChange={e=>setName(e.target.value)}
              placeholder="Your name" maxLength={60}
              style={iStyle} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
          </div>
        )}

        {/* ── Missing: Age ── */}
        {gaps.age&&(
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:"var(--cream-40)",letterSpacing:".06em",fontWeight:600,marginBottom:7}}>HOW OLD ARE YOU?</label>
            <input type="number" min="13" max="99" value={age} onChange={e=>setAge(e.target.value)} placeholder="e.g. 25" style={iStyle}/>
          </div>
        )}

        {/* ── Missing: Country ── */}
        {gaps.country&&(
          <div style={{marginBottom:16,position:"relative"}}>
            <label style={{display:"block",fontSize:12,color:"var(--cream-40)",letterSpacing:".06em",fontWeight:600,marginBottom:7}}>WHAT'S YOUR COUNTRY?</label>
            <input
              value={cSearch}
              onChange={e=>{setCSearch(e.target.value);setShowDrop(true);if(!e.target.value)setCountry("");}}
              onFocus={()=>setShowDrop(true)}
              onBlur={()=>setTimeout(()=>setShowDrop(false),200)}
              placeholder="Search your country…"
              style={{...iStyle,border:`1px solid ${country?"var(--gold)":"var(--cream-15)"}`}}
            />
            {showDrop&&cSearch&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:"var(--lift)",border:"1px solid var(--line)",borderRadius:12,zIndex:100,maxHeight:200,overflowY:"auto",marginTop:4,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
                {(Array.isArray(COUNTRIES_LIST)?COUNTRIES_LIST:[]).filter(c=>c.name.toLowerCase().includes(cSearch.toLowerCase())).slice(0,8).map(c=>(
                  <div key={c.name}
                    onMouseDown={()=>{setCountry(c.name);setCSearch(c.name);setShowDrop(false);}}
                    style={{padding:"11px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.04)"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(212,175,55,0.08)"}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <span style={{fontSize:14,color:"var(--cream)"}}>{c.name}</span>
                    <span style={{fontSize:11,color:"var(--cream-40)",fontFamily:"var(--f-mono)"}}>{c.symbol}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Missing: Goal ── */}
        {gaps.goal&&(
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:"var(--cream-40)",letterSpacing:".06em",fontWeight:600,marginBottom:7}}>WHAT'S YOUR MAIN GOAL RIGHT NOW?</label>
            <textarea
              autoFocus={!gaps.name&&!gaps.age&&!gaps.country}
              value={goal} onChange={e=>setGoal(e.target.value)}
              placeholder="Be specific — what do you actually want to achieve?"
              rows={4} maxLength={600}
              style={{...iStyle,resize:"vertical",lineHeight:1.65}}
            />
            <div style={{textAlign:"right",fontSize:11,color:"var(--cream-25)",marginTop:4}}>{goal.length}/600</div>
          </div>
        )}

        {/* ── Missing: Blockers ── */}
        {gaps.blockers&&(
          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontSize:12,color:"var(--cream-40)",letterSpacing:".06em",fontWeight:600,marginBottom:10}}>WHAT'S HOLDING YOU BACK? <span style={{color:"var(--cream-25)",fontWeight:400,letterSpacing:0}}>(select all that apply)</span></label>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {BLOCKERS_OPT.map(b=>{
                const chk=blockers.includes(b);
                return(
                  <div key={b} onClick={()=>{toggleB(b);setErr("");}}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 15px",background:chk?"rgba(212,175,55,0.07)":"var(--night)",border:`1.5px solid ${chk?"var(--gold)":"var(--cream-10)"}`,borderRadius:10,cursor:"pointer",transition:"all .15s"}}>
                    <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${chk?"var(--gold)":"rgba(232,220,200,0.2)"}`,background:chk?"var(--gold)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                      {chk&&<span style={{color:"#000",fontSize:11,fontWeight:900,lineHeight:1}}>✓</span>}
                    </div>
                    <span style={{fontSize:14,color:chk?"var(--cream)":"var(--cream-60)"}}>{b}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {err&&<div style={{color:"#F87171",fontSize:13,marginBottom:12}}>⚠ {err}</div>}

        {/* CTA */}
        <button onClick={handleSubmit}
          style={{width:"100%",padding:"15px",background:"var(--gold)",color:"#000",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
          Generate My Report →
        </button>

        {/* What we already have — reassurance */}
        {(savedFormData?.name||savedFormData?.country||savedFormData?.focus)&&(
          <div style={{marginTop:20,padding:"14px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid var(--cream-10)",borderRadius:12}}>
            <div style={{fontSize:10,color:"var(--cream-30)",letterSpacing:".1em",marginBottom:10,fontFamily:"var(--f-mono)",textTransform:"uppercase"}}>Already on your profile</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {[
                savedFormData?.name     &&{label:"Name",    value:savedFormData.name},
                savedFormData?.country  &&{label:"Country", value:savedFormData.country},
                savedFormData?.focus    &&{label:"Focus",   value:savedFormData.focus},
                savedFormData?.bigGoal  &&!savedFormData?.focus&&{label:"Focus",value:savedFormData.bigGoal},
                savedFormData?.income   &&{label:"Income",  value:savedFormData.income},
              ].filter(Boolean).map(item=>(
                <div key={item.label} style={{padding:"5px 12px",background:"rgba(212,175,55,0.07)",border:"1px solid rgba(212,175,55,0.2)",borderRadius:20}}>
                  <span style={{fontSize:10,color:"var(--cream-40)"}}>{item.label}: </span>
                  <span style={{fontSize:11,color:"var(--gold)",fontWeight:600}}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
      <div className="pbar-wrap" style={{width:"min(280px,100%)",marginBottom:36}}>
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



// ── getCareerLinks: returns direct links based on career type + user profile ──
function getCareerLinks(career, formData){
  const type = (career?.type||"").toLowerCase();
  const title = (career?.title||"").toLowerCase();
  const skills = (formData?.skills||formData?.career||"").toLowerCase();
  const links = [];

  // Freelance platforms
  if(type==="freelance"||title.includes("freelance")||title.includes("remote")){
    links.push({label:"Upwork — find freelance clients worldwide",url:"https://www.upwork.com",type:"platform"});
    links.push({label:"Fiverr — sell your skills as a service",url:"https://www.fiverr.com",type:"platform"});
    links.push({label:"Toptal — premium freelance network",url:"https://www.toptal.com",type:"platform"});
  }
  // Tech / coding
  if(skills.includes("code")||skills.includes("developer")||skills.includes("programming")||title.includes("developer")||title.includes("software")){
    links.push({label:"freeCodeCamp — free coding curriculum",url:"https://www.freecodecamp.org",type:"course"});
    links.push({label:"GitHub — build your portfolio",url:"https://github.com",type:"tool"});
    links.push({label:"We Work Remotely — remote tech jobs",url:"https://weworkremotely.com",type:"platform"});
  }
  // Design
  if(skills.includes("design")||title.includes("design")){
    links.push({label:"Canva Design School — free design training",url:"https://www.canva.com/learn/",type:"course"});
    links.push({label:"Behance — build your design portfolio",url:"https://www.behance.net",type:"tool"});
    links.push({label:"99designs — design contest platform",url:"https://99designs.com",type:"platform"});
  }
  // Writing / content
  if(skills.includes("writ")||skills.includes("content")||title.includes("writ")||title.includes("content")){
    links.push({label:"ProBlogger Job Board",url:"https://problogger.com/jobs",type:"platform"});
    links.push({label:"Substack — build a paid newsletter",url:"https://substack.com",type:"platform"});
    links.push({label:"Copyhackers — free copywriting training",url:"https://copyhackers.com/blog/",type:"course"});
  }
  // Sales / marketing
  if(skills.includes("sales")||skills.includes("market")||title.includes("sales")||title.includes("market")){
    links.push({label:"HubSpot Academy — free sales & marketing courses",url:"https://academy.hubspot.com",type:"course"});
    links.push({label:"LinkedIn — build your sales network",url:"https://www.linkedin.com",type:"platform"});
  }
  // Teaching / tutoring
  if(title.includes("teach")||title.includes("tutor")||title.includes("train")){
    links.push({label:"Preply — teach your skill online",url:"https://www.preply.com/en/become-a-tutor",type:"platform"});
    links.push({label:"Teachable — build your own course",url:"https://teachable.com",type:"platform"});
    links.push({label:"Udemy — sell courses to millions",url:"https://www.udemy.com/teaching/",type:"platform"});
  }
  // Business / entrepreneur
  if(type==="business"||title.includes("business")||title.includes("entrepreneur")){
    links.push({label:"Coursera — Business & Entrepreneurship",url:"https://www.coursera.org/browse/business",type:"course"});
    links.push({label:"Shopify — start an online store",url:"https://www.shopify.com",type:"platform"});
  }
  // General always-useful links
  links.push({label:"LinkedIn — professional network & job search",url:"https://www.linkedin.com",type:"platform"});
  if(links.length < 3){
    links.push({label:"Coursera — find accredited courses for your path",url:"https://www.coursera.org",type:"course"});
    links.push({label:"Deel — get paid internationally from anywhere",url:"https://www.deel.com",type:"tool"});
  }
  // Deduplicate by URL
  const seen = new Set();
  return links.filter(l=>{ if(seen.has(l.url)) return false; seen.add(l.url); return true; }).slice(0,5);
}


// ═══════════════════════════════════════════════════════════════════════════════
// SCORE HISTORY CHART
// Shows how overall + pillar scores changed over time as user re-assesses
// ═══════════════════════════════════════════════════════════════════════════════
function ScoreHistoryChart({history}){
  if(!history||history.length<2) return null;

  const W=320, H=120, PAD=28;
  const n=history.length;
  const plotW=W-PAD*2, plotH=H-PAD*2;

  const lines=[
    {key:"overall",  color:"var(--gold)",   label:"Overall"},
    {key:"life",     color:"var(--teal)",   label:"Life"},
    {key:"wealth",   color:"#4ADE80",       label:"Wealth"},
    {key:"mindset",  color:"#9b72cf",       label:"Mindset"},
    {key:"relations",color:"var(--rose)",   label:"Relations"},
  ];

  const toX=(i)=>PAD + (i/(n-1))*plotW;
  const toY=(v)=>PAD + plotH - (v/100)*plotH;

  const pts=(key)=>history.map((h,i)=>`${toX(i)},${toY(h[key]||0)}`).join(" ");

  const latest=history[history.length-1];
  const first=history[0];
  const overallChange=((latest.overall||0)-(first.overall||0));

  return(
    <div style={{marginBottom:20,padding:"16px 18px",background:"var(--lift)",borderRadius:16,border:"1px solid rgba(255,255,255,0.07)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--cream-30)",letterSpacing:".12em",marginBottom:4}}>YOUR SCORE PROGRESS</div>
          <div style={{fontSize:13,color:"var(--cream-60)"}}>
            {n} assessment{n!==1?"s":""} · Started {first.date} · Last updated {latest.date}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:overallChange>=0?"rgba(31,168,154,0.1)":"rgba(248,113,113,0.1)",border:`1px solid ${overallChange>=0?"rgba(31,168,154,0.25)":"rgba(248,113,113,0.25)"}`,borderRadius:20}}>
          <span style={{fontSize:14}}>{overallChange>=0?"📈":"📉"}</span>
          <span style={{fontSize:13,fontWeight:700,color:overallChange>=0?"var(--teal)":"var(--rose)"}}>
            {overallChange>=0?"+":""}{overallChange} overall
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:W,display:"block"}}>
        {/* Grid lines */}
        {[0,25,50,75,100].map(v=>(
          <g key={v}>
            <line x1={PAD} y1={toY(v)} x2={W-PAD} y2={toY(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            <text x={PAD-4} y={toY(v)+4} fontSize="7" fill="rgba(255,255,255,0.2)" textAnchor="end">{v}</text>
          </g>
        ))}
        {/* Date labels */}
        {history.map((h,i)=>(
          i===0||i===n-1?(
            <text key={i} x={toX(i)} y={H-6} fontSize="7" fill="rgba(255,255,255,0.3)" textAnchor={i===0?"start":"end"}>
              {h.date?.slice(5)}
            </text>
          ):null
        ))}
        {/* Lines */}
        {lines.map(l=>(
          <polyline key={l.key} points={pts(l.key)} fill="none" stroke={l.color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
        ))}
        {/* Dots on latest */}
        {lines.map(l=>(
          <circle key={l.key} cx={toX(n-1)} cy={toY(latest[l.key]||0)} r="3" fill={l.color}/>
        ))}
      </svg>

      {/* Legend */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:8}}>
        {lines.map(l=>(
          <div key={l.key} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"var(--cream-40)"}}>
            <div style={{width:12,height:2,background:l.color,borderRadius:1}}/>
            {l.label}: <span style={{color:l.color,fontWeight:600}}>{latest[l.key]||0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC AI MODULE — powers all 28 new modules
// Each module has its own prompt config but shares this renderer
// ═══════════════════════════════════════════════════════════════════════════════

const MODULE_CONFIGS = {
  // ── WELLBEING ──────────────────────────────────────────────────────────────
  innerpeace: {
    title: "Inner Peace",
    icon: "🕊️",
    subtitle: "Breathing, journaling, grounding — for when life feels heavy",
    disclaimer: true,
    prompt: (p) => `You are a compassionate wellbeing guide. The user is ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Their situation: "${p.situation||""}", challenge: "${p.challenge||""}".
Write a warm, practical Inner Peace guide for them with 4 sections:
1. What you're likely feeling right now (validate without being preachy)
2. A 3-step breathing exercise specific to their situation (box breathing, 4-7-8, or body scan)
3. A journaling prompt that goes deeper than surface level
4. One grounding technique they can use anywhere in the next 10 minutes
Be warm, real, and human. No generic wellness speak. Max 500 words.`,
  },
  angerstress: {
    title: "Anger & Stress Relief",
    icon: "🌊",
    subtitle: "Real tools for when things get too much — not 'just calm down'",
    disclaimer: true,
    prompt: (p) => `You are a stress management expert. User: ${p.name||"someone"} from ${p.country||"their country"}, facing: "${p.challenge||""}".
Give them 4 IMMEDIATE tools for anger/stress relief right now:
1. Box breathing method (specific steps, exact counts)
2. Cold water technique (exactly how to do it and why it works physiologically)
3. Movement-based release (specific moves — not yoga, actual physical release)
4. The 5-4-3-2-1 grounding method adapted to their environment
Be direct and practical. These should work in 5 minutes. No fluff.`,
  },
  sleepcoach: {
    title: "Sleep Coach",
    icon: "🌙",
    subtitle: "Personalized sleep routine based on your life and schedule",
    prompt: (p) => `You are a sleep optimization coach. User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Their situation: "${p.situation||""}". Career: "${p.career||""}".
Build their personal sleep optimization plan:
1. What is most likely killing their sleep based on their situation (be specific)
2. The ideal 1-hour wind-down routine for their lifestyle (time it out: 9pm do X, 9:20pm do Y etc)
3. 3 local herbs or natural remedies from ${p.country||"their region"} that support sleep
4. One thing to do differently tomorrow morning that will improve tomorrow night's sleep
Make it specific to their real life, not generic sleep hygiene advice.`,
  },
  anxietytool: {
    title: "Anxiety Toolkit",
    icon: "🛡️",
    subtitle: "Social anxiety, financial anxiety, future anxiety — practical tools",
    disclaimer: true,
    prompt: (p) => `You are an anxiety specialist. User: ${p.name||"someone"} from ${p.country||"their country"}, challenge: "${p.challenge||""}".
Identify which type of anxiety they likely experience most (social, financial, or future) based on their situation.
Then give them:
1. The specific thought pattern driving this anxiety (name it clearly)
2. A cognitive reframe — not positive thinking, but a more accurate way to see it
3. Two 5-minute exercises they can do TODAY to reduce this anxiety
4. One long-term habit to build resilience against this specific anxiety type
Be clinical but human. No "just believe in yourself" advice.`,
  },
  griefloss: {
    title: "Grief & Loss Support",
    icon: "🌱",
    subtitle: "Breakups, job loss, death, failure — you're not alone in this",
    disclaimer: true,
    prompt: (p) => `You are a grief counselor with deep empathy. User: ${p.name||"someone"} from ${p.country||"their country"}.
Their challenge: "${p.challenge||""}".
Write a compassionate grief support guide:
1. Acknowledge what they're going through without minimizing it (2-3 sentences that feel truly seen)
2. Explain the grief stage they're likely in and why that's completely normal
3. Three concrete things to do this week to process (not suppress) the grief
4. What NOT to do — the common mistakes that delay healing
5. One sentence they can say to themselves when the pain peaks
This should feel like a wise, caring friend wrote it — not a therapist script.`,
  },

  // ── BODY & STYLE ──────────────────────────────────────────────────────────
  glowup: {
    title: "Glow Up",
    icon: "✨",
    subtitle: "Personalized grooming and style for your gender, age, and country",
    prompt: (p) => `You are a style and grooming expert who knows ${p.country||"African"} culture well.
User: ${p.name||"someone"}, ${p.age||""}, ${p.gender||"person"} from ${p.country||"their country"}, income: "${p.income||""}".
Create their personal Glow Up guide:
1. Top 3 grooming habits specific to their gender that will have the biggest impact (skin, hair, face)
2. Style direction that fits their local culture AND looks modern and sharp (not Western copy-paste)
3. Budget-friendly version: what to buy first with limited money in ${p.country||"their country"}
4. One thing they're probably doing wrong that's costing them their look
5. The 10-minute daily grooming routine they should follow
Be specific — not vague "moisturize daily" advice. Name actual product types or local alternatives.`,
  },
  nogym: {
    title: "No-Gym Workout",
    icon: "💪",
    subtitle: "Full body workouts — home or outside, zero equipment",
    prompt: (p) => `You are a fitness coach specializing in bodyweight training. User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Build their complete no-gym workout plan:
1. A 20-minute full body workout they can do in their room (exercises, reps, rest time)
2. An outdoor workout they can do in their neighborhood (park, road, open space)
3. Weekly schedule: which days to work out, which to rest, why
4. The 3 bodyweight exercises with highest return for their age and goals
5. How to progress when it gets easy (no gym needed)
Be specific with reps, sets, and form cues. Make it feel achievable for a beginner but not boring for someone active.`,
  },
  posture: {
    title: "Posture & Energy",
    icon: "⚡",
    subtitle: "How you hold yourself affects your confidence and energy all day",
    prompt: (p) => `You are a posture and movement specialist. User: ${p.name||"someone"}, ${p.age||""}, career: "${p.career||""}".
Create their personal posture and energy guide:
1. The most likely posture problem they have based on their job/lifestyle (be specific about what's happening in their body)
2. 5 simple corrections they can make TODAY that will feel different immediately
3. A 5-minute morning movement sequence to set their posture for the day
4. The posture-confidence connection: what good posture signals to their own brain (not just others)
5. One awareness exercise to catch themselves slouching throughout the day
Make it practical — things they can check and fix in the next 5 minutes.`,
  },
  bodyfuel: {
    title: "Body Fuel",
    icon: "🥗",
    subtitle: "Nutrition on a budget using local food from your country",
    prompt: (p) => `You are a nutritionist who knows ${p.country||"African"} food deeply.
User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}, income: "${p.income||""}".
Build their local nutrition plan:
1. The 5 most nutritious affordable foods in ${p.country||"their region"} they should eat more of
2. What they're probably not eating enough of (specific nutrient gap for their age/gender)
3. A simple daily eating structure using local foods (breakfast, lunch, dinner examples)
4. 3 cheap local meal combinations that are actually high performance fuel
5. What to avoid or limit that's common in their culture but quietly draining their energy
Name actual local foods, not generic "protein" and "vegetables". Be specific to ${p.country||"their country"}.`,
  },

  // ── SOCIAL & LIFE ─────────────────────────────────────────────────────────
  confidencelab: {
    title: "Confidence Lab",
    icon: "🦁",
    subtitle: "Real daily actions that build confidence — not affirmations",
    prompt: (p) => `You are a confidence and performance coach. User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Challenge: "${p.challenge||""}".
Build their Confidence Lab — real actions, not affirmations:
1. The root of their confidence issue (based on their situation — be honest and specific)
2. Three confidence actions to do THIS WEEK (specific, uncomfortable, measurable)
3. The "small wins" framework: daily micro-challenges to build their confidence muscle
4. One social experiment to run this week that will surprise them
5. How to recover when confidence breaks — the exact reset routine
No "believe in yourself" advice. Only actions that create evidence that they are capable.`,
  },
  relationshipiq: {
    title: "Relationship IQ",
    icon: "🤝",
    subtitle: "Friendships, conflict, communication — your social operating system",
    prompt: (p) => `You are a relationship and social intelligence expert. User: ${p.name||"someone"} from ${p.country||"their country"}.
Situation: "${p.situation||""}". Challenge: "${p.challenge||""}".
Build their Relationship IQ guide:
1. Their likely social pattern (people pleaser, avoider, over-sharer, withdrawn) — be honest
2. The one relationship skill that will change everything for them right now
3. How to handle conflict without losing the relationship (3-step framework)
4. How to be a better friend/colleague starting today (3 specific behaviors)
5. The relationship they should invest in more — and the one they may need to reconsider
Be direct but kind. People need honest mirrors, not validation.`,
  },
  smalltalk: {
    title: "Small Talk Master",
    icon: "💬",
    subtitle: "Start, keep, and end conversations — adapted to your culture",
    prompt: (p) => `You are a communication coach who understands ${p.country||"African"} social culture.
User: ${p.name||"someone"} from ${p.country||"their country"}.
Build their Small Talk Mastery guide:
1. 5 conversation starters that work in ${p.country||"their culture"} (not generic Western ones)
2. How to keep a conversation going when it stalls (3 techniques with exact scripts)
3. How to exit a conversation gracefully without being rude (cultural context matters here)
4. How to remember names and details (specific memory trick)
5. The one thing that makes people want to talk to you again (it's not what you say)
Give real scripts, not just theory. Adapt everything to ${p.country||"their cultural context"}.`,
  },
  negotiation: {
    title: "Negotiation Skills",
    icon: "🎯",
    subtitle: "Salary, market prices, business deals — with real scripts for your country",
    prompt: (p) => `You are a negotiation expert who knows ${p.country||"African"} business culture deeply.
User: ${p.name||"someone"} from ${p.country||"their country"}, career: "${p.career||""}".
Build their Negotiation Playbook:
1. The negotiation mindset shift most people from ${p.country||"their culture"} need to make
2. How to negotiate a salary raise — exact script for their cultural context
3. How to negotiate at markets and with vendors in ${p.country||"their country"} — the real tactics used
4. The 3 most powerful negotiation phrases (in any context)
5. What to do when they say no (the real conversation starts here)
Give real scripts. Not "know your worth" advice — actual sentences they can use tomorrow.`,
  },
  digitallife: {
    title: "Digital Life",
    icon: "📱",
    subtitle: "Social media anxiety, AI tools, phone addiction — take back control",
    prompt: (p) => `You are a digital wellness and productivity expert. User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Build their Digital Life reset:
1. How social media is most likely affecting their mental state based on their age (be specific — comparison, FOMO, dopamine loop)
2. 3 practical rules to set this week to reduce phone addiction
3. The top 3 free AI tools available in ${p.country||"their country"} that give them an unfair advantage in their career/business
4. How to use AI to save 2 hours per day (specific use cases for their situation)
5. One digital audit to do tonight: what to delete, unfollow, or turn off
Be specific. Name actual apps and tools they can use starting today.`,
  },
  parenting: {
    title: "Parenting Corner",
    icon: "👨‍👧",
    subtitle: "Simple daily things to do with your kids — emotional intelligence for children",
    prompt: (p) => `You are a child development and parenting expert who understands ${p.country||"African"} family culture.
User: ${p.name||"someone"} from ${p.country||"their country"}, situation: "${p.situation||""}".
Build their Parenting Corner guide:
1. The one thing most parents in ${p.country||"their culture"} do that unknowingly hurts emotional development
2. 3 simple daily activities (under 10 minutes each) to build emotional intelligence in children
3. How to talk to children about feelings in a way that works (with example conversations)
4. How to discipline without breaking their spirit — specific to ${p.country||"their cultural context"}
5. What to do when you're too stressed to parent well (the reset routine for parents)
Be culturally aware. Parenting advice needs to respect local values while introducing emotional intelligence.`,
  },

  // ── MONEY DEEP DIVES ──────────────────────────────────────────────────────
  debtfreedom: {
    title: "Debt Freedom Plan",
    icon: "⛓️",
    subtitle: "Step by step plan based on your income and country",
    prompt: (p,cur) => `You are a debt elimination specialist. User: ${p.name||"someone"} from ${p.country||"their country"}, income: "${p.income||""}".
Build their Debt Freedom Plan:
1. The psychology of debt in ${p.country||"their culture"} — why people stay stuck (be honest)
2. The debt snowball method adapted to their income level (specific steps)
3. How to negotiate with creditors/lenders in ${p.country||"their country"} (exact approach)
4. 3 ways to find extra money to put toward debt on their current income
5. A realistic timeline and milestone plan (Month 1, Month 3, Month 6, Month 12)
Use local currency context. Be realistic, not motivational-poster optimistic.`,
  },
  sidehustle: {
    title: "Side Hustle Tracker",
    icon: "📊",
    subtitle: "Track what's working, scale what pays, drop what doesn't",
    prompt: (p,cur) => `You are a side income strategist. User: ${p.name||"someone"} from ${p.country||"their country"}, skills: "${p.skills||""}". Career: "${p.career||""}".
Build their Side Hustle Strategy:
1. The 3 best side hustles for their skills and location in ${p.country||"their country"} (specific, realistic)
2. How to start the top option this week with zero investment
3. How to track income from multiple sources (simple system they'll actually use)
4. The income milestones: when to scale, when to drop, when to go full-time
5. The biggest mistake people make with side hustles in ${p.country||"their market"}
Be specific to their country's economy and digital access. Real opportunities, not generic "freelance on Upwork" advice.`,
  },
  investment101: {
    title: "Investment 101",
    icon: "📈",
    subtitle: "First investment steps simplified for your country",
    prompt: (p,cur) => `You are an investment educator who knows ${p.country||"African"} financial markets.
User: ${p.name||"someone"} from ${p.country||"their country"}, income: "${p.income||""}".
Build their Investment 101 guide:
1. The investment options available in ${p.country||"their country"} right now (stocks, treasury bills, mobile money savings, real estate — what's actually accessible)
2. Where to start with small amounts in ${p.country||"their country"} (specific platforms or banks)
3. Treasury bills / government bonds in ${p.country||"their country"} — how they work and current rates
4. The biggest investment mistake beginners make in ${p.country||"their market"}
5. A simple 3-step first investment plan they can start this month
Be specific to ${p.country||"their country"}. Name actual local investment platforms and products.`,
  },

  // ── PURPOSE ────────────────────────────────────────────────────────────────
  visionboard: {
    title: "Vision Board",
    icon: "🗺️",
    subtitle: "Your AI-built life plan for 1, 3, and 5 years",
    prompt: (p) => `You are a life design coach. User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Goals: "${p.goals||p.bigGoal||""}". Situation: "${p.situation||""}". Skills: "${p.skills||""}".
Build their Vision Board — a concrete life plan:
1 YEAR FROM NOW: What their life looks like if they stay disciplined (career, money, relationships, health — be specific)
3 YEARS FROM NOW: The realistic best version of their life if they execute (with specific numbers and milestones)
5 YEARS FROM NOW: The life that's possible if they become the person they're capable of being
Then: The ONE thing they need to do this week that connects to all three visions
Make it personal and vivid. This should feel like reading their own future, not someone else's.`,
  },
  legacyletter: {
    title: "Legacy Letter",
    icon: "📜",
    subtitle: "What do you want people to say about you? Build backward from there.",
    prompt: (p) => `You are a legacy and purpose coach. User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Situation: "${p.situation||""}". Goals: "${p.goals||p.bigGoal||""}".
Write their Legacy Letter — in two parts:
PART 1: The Legacy Letter itself. Write it as if people who knew them well are speaking at their memorial 30 years from now. What did they stand for? What did they build? Who did they help? How did they make people feel? (Write in third person, past tense, 150 words)
PART 2: The Reverse Engineering. Based on that legacy, what are 5 daily habits they need to start NOW to become that person? Be specific and tied directly to the letter.
This should move them. Make them see what's possible and what's at stake.`,
  },
  fearaudit: {
    title: "Fear Audit",
    icon: "🔍",
    subtitle: "The fears actually running your life — identified and called out",
    prompt: (p) => `You are a fear and mindset analyst. User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Situation: "${p.situation||""}". Challenge: "${p.challenge||""}". Goals: "${p.goals||p.bigGoal||""}".
Conduct their Fear Audit:
1. The PRIMARY fear running their life right now (based on their situation — be specific and honest, not gentle)
2. Where this fear most likely came from (childhood, culture, specific experience)
3. How this fear is showing up in their current decisions (give 2-3 specific examples from their situation)
4. The cost of this fear: what they've already lost or delayed because of it
5. The one action that would directly challenge this fear this week
Be honest and direct. Most people already know their fears — they just need someone to name it clearly.`,
  },
  morningritual: {
    title: "Morning Ritual Builder",
    icon: "🌅",
    subtitle: "Personalized morning routine for your goals, schedule, and personality",
    prompt: (p) => `You are a morning routine architect. User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Goals: "${p.goals||p.bigGoal||""}". Career: "${p.career||""}". Situation: "${p.situation||""}".
Build their perfect Morning Ritual:
First, ask yourself: is this person a builder, achiever, or healer type? Identify it based on their goals.
Then write their ritual:
— BEFORE GETTING UP (2 minutes): what to do before their feet touch the floor
— FIRST 10 MINUTES: exactly what to do (no phone, specific actions)  
— MINUTES 10-30: body activation (specific to their fitness level and space)
— MINUTES 30-45: mind preparation (specific to their goals and challenges)
— FINAL 15 MINUTES: planning the day (specific method for their type)
Give times. Make it feel like a rhythm, not a chore. Adapted to ${p.country||"their context"} — not everyone has a gym or green juice.`,
  },
  dailywisdom: {
    title: "Daily Wisdom",
    icon: "💎",
    subtitle: "One powerful insight applied directly to your life today",
    prompt: (p) => `You are a wisdom curator. User: ${p.name||"someone"} from ${p.country||"their country"}.
Situation: "${p.situation||""}". Challenge: "${p.challenge||""}". Today's date: ${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}.
Give them today's wisdom:
1. One powerful quote or insight from a great mind (philosopher, leader, scientist, writer — diverse sources, not just Stoics)
2. What this person was facing when they developed this insight
3. Exactly how this wisdom applies to ${p.name||"their"} specific situation right now (not generic — tie it directly)
4. The one action this wisdom suggests they take today
5. A second, contrasting perspective that challenges the first (wisdom has nuance)
Make the connection between the wisdom and their life so specific it feels written just for them.`,
  },
  lettertoself: {
    title: "Letter to Self",
    icon: "✉️",
    subtitle: "A personal letter written by AI based on everything it knows about you",
    prompt: (p) => `You are writing a deeply personal letter to ${p.name||"this person"} based on everything known about them.
They are ${p.age||""} from ${p.country||"their country"}. 
Situation: "${p.situation||""}". Challenge: "${p.challenge||""}". Goals: "${p.goals||p.bigGoal||""}". Skills: "${p.skills||""}".
Write the letter as if you are their wisest, most honest friend who knows them completely.
The letter should:
— Open by acknowledging exactly where they are right now (no sugarcoating)
— Name the specific thing they are avoiding or holding back from
— Speak directly to their fear with compassion and honesty
— Remind them of a strength they have that they're underusing
— Tell them what you see becoming possible for them if they make one shift
— Close with a challenge: one thing to do before reading this letter again
Write in second person ("you"). 300-350 words. Make it feel like it was written by someone who truly sees them.`,
  },

  // ── DISCOVER ──────────────────────────────────────────────────────────────
  dreaminterp: {
    title: "Dream Interpreter",
    icon: "🌙",
    subtitle: "Describe your dream and get a psychological + practical interpretation",
    needsInput: true,
    inputLabel: "Describe your dream",
    inputPlaceholder: "Tell me about a recurring or recent dream. Include as many details as you remember — what happened, who was there, how it felt, what stood out...",
    inputMin: 20,
    prompt: (p, cur, userInput) => `You are a depth psychologist and dream analyst.
Person: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Their waking life: situation — "${p.situation||""}", challenge — "${p.challenge||""}".

Their dream: "${userInput}"

Interpret this dream in 4 parts:
First, what the core emotional theme of this dream is (not surface level — the deeper emotional truth it's processing)
Second, what specific element of their waking life this dream is most likely processing — connect it directly to what they've shared about their situation and challenge
Third, what this dream is telling them they need to do or face in real life right now — be specific and honest
Finally, one action they can take this week based on what their unconscious is showing them

Write like a wise friend who knows both psychology and their life — not a textbook.`,
  },
  peopledecoder: {
    title: "People Decoder",
    icon: "🧩",
    subtitle: "Describe someone difficult in your life — understand them and how to handle them",
    needsInput: true,
    inputLabel: "Describe this person and the situation",
    inputPlaceholder: "Who is this person to you (colleague, friend, family)? What do they do that's difficult? Give me a specific example of their behaviour and how it affects you...",
    inputMin: 30,
    prompt: (p, cur, userInput) => `You are a behavioral psychologist and social intelligence expert.
Person asking: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Their situation: "${p.situation||""}".

The difficult person they're describing: "${userInput}"

Do this in 4 parts:
First, identify the behavioral pattern of the person they're describing — name it clearly and specifically (not just "difficult person" — be precise about the pattern)
Second, explain the psychology behind why this person behaves this way — the fear or wound driving it — without excusing them
Third, give the exact approach for handling this specific person — what to say, what not to say, how to position yourself. Be specific to ${p.country||"their culture"} — communication norms vary
Finally, tell them what this dynamic is costing them personally and what a healthy boundary would look like

Use the details they gave you. Make it feel like you decoded a specific real human, not a generic type.`,
  },
  hardconvo: {
    title: "Hard Conversation Helper",
    icon: "🗣️",
    subtitle: "Tell me who you need to talk to — I'll help you plan and script it",
    needsInput: true,
    inputLabel: "Who do you need to have a hard conversation with, and why?",
    inputPlaceholder: "e.g. I need to tell my boss I'm underpaid and deserve a raise. Or: I need to confront my friend who keeps letting me down. Or: I need to end a relationship...",
    inputMin: 20,
    prompt: (p, cur, userInput) => `You are a communication and conflict resolution expert who understands ${p.country||"their"} culture.
Person: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.

The hard conversation they need to have: "${userInput}"

Help them in 4 parts:
First, acknowledge why this conversation feels hard and what they're risking — validate it without encouraging avoidance
Second, give them the exact opening 2-3 sentences to start this conversation. These are the hardest words. Make them specific to what they described — not generic
Third, walk through what's most likely to happen: the other person's likely reaction, and exactly how to respond to it
Finally, tell them when and where to have this conversation — timing and setting matter more than most people think

Write for ${p.country||"their cultural context"} — directness, respect, and face-saving mean different things in different places.`,
  },
  weeklychallenge: {
    title: "Weekly Challenge",
    icon: "🎲",
    subtitle: "One specific challenge that pushes you slightly outside your comfort zone",
    prompt: (p) => `You are a growth catalyst. User: ${p.name||"someone"}, ${p.age||""} from ${p.country||"their country"}.
Situation: "${p.situation||""}". Challenge: "${p.challenge||""}". Goals: "${p.goals||p.bigGoal||""}".
Today is ${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}.
Design this week's personal growth challenge for them:
THE CHALLENGE: One specific action to take this week. Not vague. Not easy. Slightly uncomfortable. Achievable.
WHY THIS CHALLENGE: Why this specific challenge is exactly right for where they are right now
THE RULES: Exact instructions for how to complete it (what to do, when, how)
SUCCESS LOOKS LIKE: How they'll know they've done it (measurable outcome)
WHAT THIS BUILDS: The specific capability or confidence this challenge develops
BONUS LEVEL: A harder version for if they complete the main challenge
Make it feel like a personal trainer designed this specifically for them. Not a generic "talk to a stranger" challenge.`,
  },
  money:{
    title:"Money Intelligence",icon:"💰",subtitle:"Build wealth with clarity",
    prompt:(p)=>`You are DestinIQ, a financial intelligence coach. Generate a personalized money intelligence report for ${p.name||"this user"} (${p.age}, ${p.country}).
Their situation: ${p.goals||p.bigGoal}. Income level: ${p.income||"not specified"}.
Create a structured report with:
1. Their Current Financial Reality (honest assessment)
2. The #1 Money Mindset Shift They Need
3. Three specific income or saving strategies tailored to ${p.country}
4. A 30-day money action plan
Use ${p.currencySymbol||"$"} for all amounts. Be specific, actionable, and encouraging.`,
  },
  earnonline:{
    title:"Online Income Builder",icon:"🌐",subtitle:"Create income from the internet",
    prompt:(p)=>`You are DestinIQ. Create a personalized online income plan for ${p.name||"this user"} in ${p.country}.
Their skills: ${p.skills||"general skills"}. Goal: ${p.goals||p.bigGoal}.
Provide: Top 3 online income opportunities for their profile, step-by-step starter plan for the best option, realistic income timeline, and first action to take today.`,
  },
  business:{
    title:"Business Builder",icon:"🏢",subtitle:"Launch and grow your business",
    prompt:(p)=>`You are DestinIQ. Create a personalized business strategy for ${p.name||"this user"} in ${p.country}.
Their background: ${p.career||p.occupation||"not specified"}. Goal: ${p.goals||p.bigGoal}.
Cover: Best business model for their profile, ${p.country}-specific startup considerations, a lean launch plan with budget in ${p.currencySymbol||"$"}, and first 3 action steps.`,
  },
  lifehacks:{
    title:"Life Hacks",icon:"⚡",subtitle:"Shortcuts to a better life",
    prompt:(p)=>`You are DestinIQ. Generate 10 powerful, personalized life hacks for ${p.name||"this user"} based on their profile.
Their biggest blockers: ${p.challenge||"not specified"}. Goal: ${p.goals||p.bigGoal}.
Each hack should be: practical, immediately actionable, and specific to their situation. Focus on time, energy, money, and relationships.`,
  },
  jimrohn:{
    title:"Jim Rohn Wisdom",icon:"📚",subtitle:"Classic success principles",
    prompt:(p)=>`You are DestinIQ applying Jim Rohn's philosophy. Give ${p.name||"this user"} a personalized wisdom session.
Their situation: ${p.goals||p.bigGoal}. Challenges: ${p.challenge||"not specified"}.
Draw from Jim Rohn's principles: personal development, discipline, philosophy of failure, seasons of life, and financial independence. Apply each principle directly to their current situation.`,
  },
  mindsettenx:{
    title:"10X Mindset",icon:"🚀",subtitle:"Think and grow 10 times bigger",
    prompt:(p)=>`You are DestinIQ applying 10X thinking. Help ${p.name||"this user"} break their mental ceiling.
Current thinking: ${p.goals||p.bigGoal}. Blockers: ${p.challenge||"not specified"}.
Create: A 10X vision of their life in 5 years, the mindset shifts required, the ONE biggest fear holding them back, and a 10X action plan for the next 90 days.`,
  },
  success:{
    title:"Success Psychology",icon:"🏆",subtitle:"The psychology of high achievers",
    prompt:(p)=>`You are DestinIQ, a success psychology coach. Analyse ${p.name||"this user"}'s success potential.
Their ambition: ${p.goals||p.bigGoal}. Current challenges: ${p.challenge||"not specified"}.
Provide: Their success personality type, the psychological patterns blocking them, success habits of people with their profile, and a 21-day success psychology practice.`,
  },
  invest:{
    title:"Invest in Yourself",icon:"💎",subtitle:"Your best ROI is you",
    prompt:(p)=>`You are DestinIQ. Create a personal investment roadmap for ${p.name||"this user"}.
Current situation: ${p.goals||p.bigGoal}. Skills: ${p.skills||"not specified"}.
Design: Top 5 self-investments with highest ROI for their profile, a skills development plan, recommended books and resources, and a 6-month self-improvement budget in ${p.currencySymbol||"$"}.`,
  },
  discipline:{
    title:"Daily Discipline",icon:"🔥",subtitle:"Build unbreakable habits",
    prompt:(p)=>`You are DestinIQ. Build a personalised discipline system for ${p.name||"this user"}.
Their struggle: ${p.challenge||"not specified"}. Goal: ${p.goals||p.bigGoal}.
Create: A personalised morning routine, their 3 non-negotiable daily disciplines, strategies for their specific blockers, and a habit stacking system for their lifestyle.`,
  },
  career:{
    title:"Career Intelligence",icon:"💼",subtitle:"Accelerate your career",
    prompt:(p)=>`You are DestinIQ, a career strategy coach. Analyse the career path for ${p.name||"this user"} (${p.age}, ${p.country}).
Current work: ${p.career||p.occupation||"not specified"}. Goal: ${p.goals||p.bigGoal}.
Provide: Career strengths assessment, top 3 career moves to make in the next 12 months, salary negotiation strategy for ${p.country}, and skills to develop immediately.`,
  },
  roadmap:{
    title:"Life Roadmap",icon:"🗺️",subtitle:"Your personalised life plan",
    prompt:(p)=>`You are DestinIQ. Build a comprehensive life roadmap for ${p.name||"this user"} (${p.age}, ${p.country}).
Vision: ${p.goals||p.bigGoal}. Blockers: ${p.challenge||"not specified"}.
Create a 12-month roadmap with: Quarterly milestones, monthly focus areas, weekly action themes, and the single most important thing to do each month. Make it specific and achievable.`,
  },
  decisions:{
    title:"Decision Clarity",icon:"🎯",subtitle:"Make better decisions faster",
    prompt:(p)=>`You are DestinIQ. Help ${p.name||"this user"} build a personal decision-making framework.
Their situation: ${p.goals||p.bigGoal}. Blockers: ${p.challenge||"not specified"}.
Cover: Their decision-making style and blind spots, a personal decision framework for major life choices, how to overcome analysis paralysis, and a framework for the most important decision they face right now.`,
  },
};

// ── GenericAIModule renderer ────────────────────────────────────────────────
function GenericAIModule({modId, profile, userId, isPaid, isPremium, isProMax, onUnlock, lang="en"}){
  const cfg   = MODULE_CONFIGS[modId];
  if(!cfg) return null;

  const cacheKey = `diq_mod_${modId}_${userId||"guest"}`;
  const [content2, setContent2] = useState(()=>{ try{return localStorage.getItem(cacheKey)||"";}catch{return "";} });
  const [loading2, setLoading2] = useState(false);
  const [error2,   setError2]   = useState("");
  // For input-required modules (Dream, People Decoder, Hard Conversation)
  const [userInput, setUserInput] = useState("");
  const [inputSubmitted, setInputSubmitted] = useState(false);

  const generate = async(inputOverride) => {
    const finalInput = inputOverride || userInput;
    // For input modules, require the user to type something
    if(cfg.needsInput && !finalInput?.trim()){
      setError2("Please describe your situation above before generating.");
      return;
    }
    // Never force profile updates — use whatever data is available from onboarding
    setLoading2(true); setError2("");
    try{
      const currencyInfo = getLocalCurrency(profile?.country||"");
      const currencySymbol = currencyInfo?.symbol || getLocalCurrency(profile?.country||"")?.symbol || "$";
      const currencyName   = currencyInfo?.code   || getLocalCurrency(profile?.country||"")?.code   || "USD";
      // Build currency instruction to append to every prompt
      const currencyNote   = currencySymbol && currencySymbol!=="$"
        ? `\n\nCURRENCY RULE: Use ${currencySymbol} (${currencyName}) for ALL local costs, prices, salaries, and expenses. Only use USD for international online income — and always show the ${currencySymbol} equivalent too.`
        : "";
      const prompt = cfg.prompt(profile, currencyInfo, userInput) + currencyNote;
      const result = await callAPI({
        messages:[{role:"user", content: prompt}],
        system: `You are DestinIQ — a personal intelligence platform writing for a real person.

WHAT YOU KNOW ABOUT THEM:
${buildProfileContext(profile)||"A user who completed onboarding — generate helpful content based on common patterns for their situation."}

YOU ARE WRITING: ${cfg.title}

CURRENCY: ${currencySymbol&&currencySymbol!=="$"?`Use ${currencySymbol} (${currencyName}) for local costs. USD only for international online income — always add ${currencySymbol} equivalent.`:"Use USD for all amounts."}

ABSOLUTE RULE: Generate the full response NOW using whatever information is available. Never say you need more information, never ask them to update their profile, never refuse. If a specific detail is missing, make a reasonable assumption based on what you know and keep going.`,
        userId, isPremium, isProMax,
      });
      const txt = Array.isArray(result?.content)
        ? result.content.filter(x=>x?.type==="text").map(x=>x.text||"").join(" ")
        : (typeof result==="string" ? result : result?.text || result?.content || "");
      setContent2(txt);
      try{ localStorage.setItem(cacheKey, txt); }catch{}
    }catch(e){ setError2("Could not generate response. Check your connection and tap Refresh to try again."); }
    setLoading2(false);
  };

  // Auto-generate if no content yet
  useEffect(()=>{
    // For relocate — clear blank cache so it regenerates cleanly
    if(modId==="relocate"&&content2===""){
      try{localStorage.removeItem(cacheKey);}catch{}
    }
    if(!content2&&(profile?.name||profile?.country||profile)) generate();
  },[profile?.name,profile?.country]);

  const wellbeingIds = ['innerpeace','angerstress','sleepcoach','anxietytool','griefloss'];
  const isWellbeing  = wellbeingIds.includes(modId);

  return(
    <div className="cx-md" style={{paddingTop:24,paddingBottom:40}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:32, marginBottom:8}}>{cfg.icon}</div>
        <h2 className="d2" style={{marginBottom:6}}>{cfg.title}</h2>
        <p style={{fontSize:14, color:"var(--cream-40)", lineHeight:1.6}}>{cfg.subtitle}</p>
      </div>

      {/* Input field for modules that need user description */}
      {cfg.needsInput && (
        <div style={{marginBottom:20}}>
          <label style={{display:"block",fontSize:12,color:"var(--cream-40)",fontFamily:"var(--f-mono)",
            letterSpacing:".08em",marginBottom:10}}>
            {cfg.inputLabel?.toUpperCase()}
          </label>
          <textarea
            value={userInput}
            onChange={e=>setUserInput(e.target.value)}
            placeholder={cfg.inputPlaceholder}
            rows={5}
            style={{width:"100%",background:"var(--midnight)",border:`1px solid ${userInput.length>=(cfg.inputMin||20)?"var(--gold)":"var(--line)"}`,
              borderRadius:14,padding:"14px 16px",color:"var(--cream)",fontSize:14,
              lineHeight:1.7,resize:"vertical",fontFamily:"inherit",outline:"none",
              boxSizing:"border-box",transition:"border .2s"}}
          />
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
            <span style={{fontSize:11,color:"var(--cream-30)"}}>
              {userInput.length < (cfg.inputMin||20)
                ? `${(cfg.inputMin||20)-userInput.length} more characters needed`
                : "✓ Ready to generate"}
            </span>
            <button
              className="btn btn-gold"
              disabled={userInput.length < (cfg.inputMin||20) || loading2}
              onClick={()=>generate(userInput)}
              style={{fontSize:13,padding:"10px 20px"}}>
              {loading2 ? "Generating…" : `Get my ${cfg.title}`}
            </button>
          </div>
          {content2 && (
            <button onClick={()=>{setContent2("");try{localStorage.removeItem(cacheKey);}catch{}setUserInput("");}}
              style={{background:"none",border:"none",color:"var(--cream-30)",fontSize:12,cursor:"pointer",marginTop:8}}>
              ✕ Clear and try a different one
            </button>
          )}
        </div>
      )}

      {/* Mental health disclaimer */}
      {isWellbeing && cfg.disclaimer && (
        <div style={{padding:"12px 16px",background:"rgba(77,182,172,0.08)",border:"1px solid rgba(77,182,172,0.2)",
          borderRadius:12,marginBottom:20,fontSize:12,color:"#4db6ac",lineHeight:1.6}}>
          💙 This module offers practical support tools. If you're in crisis or experiencing severe symptoms, please reach out to a mental health professional or crisis line in {profile?.country||"your country"}.
        </div>
      )}

      {/* Content */}
      {loading2 ? (
        <div className="card" style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:24,marginBottom:12}}>{cfg.icon}</div>
          <p style={{color:"var(--cream-40)",fontSize:14}}>Writing your personalized {cfg.title}…</p>
        </div>
      ) : error2 ? (
        <div className="card" style={{textAlign:"center",padding:32}}>
          <p style={{color:"var(--rose)",marginBottom:16,fontSize:14}}>{error2}</p>
          <button className="btn btn-gold" onClick={generate}>Try Again</button>
        </div>
      ) : content2 ? (
        <div>
          {/* 🔊 Listen button — Pro+ only */}
          {isPaid&&(
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
            <AudioPlayer text={content2} label="Listen to this"/>
          </div>
          )}
          <div className="card" style={{lineHeight:1.9,fontSize:14,color:"var(--cream-70)",whiteSpace:"pre-wrap"}}>
            {content2}
          </div>
          <button onClick={generate} style={{background:"none",border:"1px solid var(--line)",borderRadius:10,
            padding:"10px 20px",color:"var(--cream-40)",fontSize:12,cursor:"pointer",marginTop:16,display:"flex",
            alignItems:"center",gap:8}}>
            ↺ Refresh {cfg.title}
          </button>
        </div>
      ) : (
        <div className="card" style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:"clamp(28px,8vw,40px)",marginBottom:12}}>{cfg.icon}</div>
          <p style={{color:"var(--cream-50)",fontSize:14,marginBottom:20}}>Your personalized {cfg.title} will be written based on your profile.</p>
          <button className="btn btn-gold" onClick={generate}>Generate My {cfg.title}</button>
        </div>
      )}
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
function AuthScreen({onAuth, onBack}){
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
          setMode("email_sent");
          setLoading(false);return;
        }
        if(data.user) onAuth({id:data.user.id,email:data.user.email,name:name.trim(),provider:"email",isNew:true});
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
    try{
      // Get the OAuth URL from Supabase without redirecting
      const{data,error:err}=await supabase.auth.signInWithOAuth({
        provider:"google",
        options:{
          // Use deep link scheme so Android hands control back to the app
          redirectTo: window?.Capacitor?.isNativePlatform?.()
            ? "com.destiniq.app://"
            : window.location.origin,
          queryParams:{prompt:"select_account"},
          skipBrowserRedirect:true,
        },
      });
      if(err){setError(err.message);setLoading(false);return;}
      if(data?.url){
        // Check if running in Capacitor native app
        const isNative = typeof window!=="undefined" && window?.Capacitor?.isNativePlatform?.();
        if(isNative && window?.CapacitorBrowser){
          // Use in-app browser — stays inside the app, no Chrome
          // Use Capacitor Browser via global plugin — no import needed
          const CapBrowser = window?.Capacitor?.Plugins?.Browser;
          if(CapBrowser){
            await CapBrowser.open({
              url: data.url,
              presentationStyle: "popover",
              toolbarColor: "#0a0a0f",
            });
          } else {
            // Fallback — open in system browser
            window.open(data.url, "_blank");
          }
        } else {
          // Web — normal redirect
          window.location.href = data.url;
        }
      }
    }catch(e){
      setError("Sign in failed. Please try again.");
      setLoading(false);
    }
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

  if(mode==="email_sent"){
    return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{width:"100%",maxWidth:420,textAlign:"center"}}>
          <div style={{fontSize:28,fontWeight:800,color:"var(--cream)",marginBottom:8}}>Destin<b style={{color:"var(--gold)"}}>IQ</b></div>
          <div style={{background:"var(--night)",border:"1px solid var(--cream-10)",borderRadius:20,padding:"36px 24px",marginTop:24}}>
            <div style={{fontSize:40,marginBottom:16}}>✉️</div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--cream)",marginBottom:12}}>Confirm your email</div>
            <p style={{fontSize:14,color:"var(--cream-60)",lineHeight:1.7,marginBottom:8}}>We sent a confirmation link to <b style={{color:"var(--cream)"}}>{email}</b>.</p>
            <p style={{fontSize:13,color:"var(--cream-40)",lineHeight:1.7,marginBottom:24}}>Click the link in the email to activate your account, then come back to sign in. Check your spam if you don't see it.</p>
            <button onClick={async()=>{await supabase.auth.resend({type:"signup",email:email.trim()});alert("Confirmation email resent!");}} style={{background:"none",border:"1px solid var(--cream-15)",borderRadius:10,padding:"10px 20px",color:"var(--cream-40)",fontSize:13,cursor:"pointer",marginBottom:16}}>Resend email</button>
            <br/>
            <span onClick={()=>{setMode("login");setError("");}} style={{color:"var(--gold)",cursor:"pointer",fontWeight:600,fontSize:14}}>Back to sign in</span>
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


  // Apple OAuth (Supabase)
  const handleApple=async()=>{
    setLoading(true);setError("");
    try{
      const{error:err}=await supabase.auth.signInWithOAuth({
        provider:"apple",
        options:{redirectTo:typeof window!=="undefined"?window.location.origin:"/"}
      });
      if(err) setError(err.message);
    }catch(e){setError("Apple sign-in unavailable. Please try email.");}
    setLoading(false);
  };
  // Aliases — handleEmail already handles both modes
  const handleLogin=handleEmail;
  const handleSignup=handleEmail;

  const G={
    gold:"#f0b429",bg:"#0a0800",card:"#111008",surface:"#0e0c02",
    border:"rgba(232,220,200,0.08)",cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)",
    inp:"rgba(255,255,255,0.04)",inpBorder:"rgba(232,220,200,0.13)",
  };

  const iStyle={width:"100%",padding:"14px 16px",background:G.inp,
    border:"1px solid "+G.inpBorder,borderRadius:12,color:G.cream,
    fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:"inherit",
    transition:"border-color .2s",
  relocate: {
    title:"Relocation Intelligence",icon:"🌍",subtitle:"Find the best country for your next chapter",
    prompt:(p)=>{
      const name    = p?.name    || "this person";
      const age     = p?.age     || "an adult";
      const from    = p?.country || "their current country";
      const goals   = p?.goals   || p?.bigGoal || "better opportunities and a better quality of life";
      const income  = p?.income  || "not specified";
      const job     = p?.occupation || "not specified";
      const blocker = p?.challenge  || "not specified";
      return "Write a detailed personal relocation intelligence report for " + name + ", aged " + age + ", currently living in " + from + ". Their career: " + job + ". Monthly income level: " + income + ". Life goal: " + goals + ". Main challenge: " + blocker + ". Write everything in flowing paragraphs without bullet points or headers. Cover four things: First, give a direct honest verdict on whether they should relocate or stay and exactly why, considering their income, job, age and country. Second, name three specific countries that genuinely match their background, and for each one give the actual visa name and specific requirements, realistic monthly costs in USD for rent plus food plus transport in a real city you name, and the salary range they could realistically earn in their field. Third, give a month by month six month plan starting from today showing exactly what to save, what documents to prepare, which communities to join online, and what skills to build before the move. Fourth, share the single most important thing that people from " + from + " consistently overlook when trying to relocate, and what separates those who succeed from those who fail. Be specific. Use real numbers. Name real cities and real visa programs.";
    }
  },

  advisor: {
    title:"AI Coach",icon:"🤖",subtitle:"Your personal AI life coach — ask anything",
    prompt:(p)=>`You are DestinIQ's personal AI coach having a deep 1-on-1 conversation with ${p.name||"this person"} (${p.age||"adult"}, ${p.country||"their country"}).
Their goals: ${p.goals||p.bigGoal||"personal growth"}. Main challenge: ${p.challenge||"not specified"}. Focus: ${p.focus||"life improvement"}.
Give them a powerful, personalized coaching session. Ask one deep question that helps them see their situation more clearly. Then provide your honest coach assessment. Be direct, warm, and genuinely helpful.`
  }
};

  const showEmailForm = tab==="email" && (mode==="login"||mode==="signup");

  return(
    <div style={{minHeight:"100vh",background:G.bg,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",padding:"24px",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:G.cream}}>

      {/* Back */}
      {onBack&&mode==="login"&&!showEmailForm&&(
        <button onClick={onBack}
          style={{position:"absolute",top:20,left:20,background:"none",border:"none",
            color:G.dimmer,cursor:"pointer",fontSize:22,lineHeight:1}}>←</button>
      )}

      <div style={{width:"100%",maxWidth:400}}>

        {/* ── Logo ── */}
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:"clamp(18px,5vw,26px)",fontWeight:800,color:G.cream,marginBottom:8,letterSpacing:"-.3px"}}>
            Destin<span style={{color:G.gold}}>IQ</span>
          </div>
          <h1 style={{fontSize:"clamp(16px,4.5vw,24px)",fontWeight:800,color:G.cream,margin:"0 0 6px",lineHeight:1.2}}>
            {mode==="forgot"||mode==="forgot_sent"?"Reset your password"
             :mode==="reset"?"Set new password"
             :"Start your transformation"}
          </h1>
          <p style={{fontSize:13,color:G.dim,margin:0}}>
            {mode==="forgot"?"We'll send you a reset link"
             :mode==="forgot_sent"?"Check your email for the link"
             :mode==="reset"?"Choose a new secure password"
             :mode==="signup"?"Create your account":"Welcome back"}
          </p>
          {(()=>{
            const p=new URLSearchParams(typeof window!=="undefined"?window.location.search:"");
            const wasOAuthErr=p.get("error_code")||p.get("error");
            return wasOAuthErr?(
              <div style={{marginTop:12,padding:"10px 14px",background:"rgba(240,180,41,0.08)",
                border:"1px solid rgba(240,180,41,0.2)",borderRadius:10,fontSize:12,
                color:"rgba(240,180,41,0.9)"}}>
                ⚠️ Sign-in session expired. Please try again.
              </div>
            ):null;
          })()}
        </div>

        {/* ── FORGOT / RESET flows ── */}
        {(mode==="forgot"||mode==="forgot_sent"||mode==="reset")&&(
          <div style={{background:G.card,border:"1px solid "+G.border,borderRadius:18,padding:"28px 24px"}}>
            {mode==="forgot_sent"?(
              <div style={{textAlign:"center",padding:"12px 0"}}>
                <div style={{fontSize:40,marginBottom:14}}>📬</div>
                <p style={{color:G.dim,fontSize:14,lineHeight:1.7,margin:"0 0 20px"}}>Check your inbox — the reset link expires in 1 hour.</p>
                <button onClick={()=>setMode("login")}
                  style={{background:G.gold,color:"#000",border:"none",borderRadius:11,
                    padding:"13px 28px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}}>
                  Back to Sign In
                </button>
              </div>
            ):mode==="forgot"?(
              <>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="your@email.com" style={iStyle}
                  onFocus={e=>e.target.style.borderColor="rgba(240,180,41,0.4)"}
                  onBlur={e=>e.target.style.borderColor=G.inpBorder}/>
                {error&&<p style={{color:"#e05252",fontSize:13,margin:"10px 0 0"}}>{error}</p>}
                <button onClick={handleForgot} disabled={loading||!email.trim()}
                  style={{marginTop:16,width:"100%",padding:"14px",background:G.gold,color:"#000",
                    border:"none",borderRadius:11,fontSize:14,fontWeight:700,cursor:"pointer",
                    opacity:loading||!email.trim()?.8:1}}>
                  {loading?"Sending…":"Send Reset Link"}
                </button>
                <button onClick={()=>setMode("login")}
                  style={{marginTop:12,width:"100%",padding:"10px",background:"none",
                    color:G.dimmer,border:"none",fontSize:13,cursor:"pointer"}}>← Back to Sign In</button>
              </>
            ):(
              <>
                <div style={{position:"relative",marginBottom:12}}>
                  <input type={showPass?"text":"password"} value={newPassword}
                    onChange={e=>setNewPassword(e.target.value)} placeholder="New password (min 8 chars)"
                    style={iStyle} onFocus={e=>e.target.style.borderColor="rgba(240,180,41,0.4)"}
                    onBlur={e=>e.target.style.borderColor=G.inpBorder}/>
                  <button onClick={()=>setShowPass(p=>!p)}
                    style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",
                      background:"none",border:"none",color:G.dimmer,cursor:"pointer",fontSize:13}}>
                    {showPass?"Hide":"Show"}
                  </button>
                </div>
                {error&&<p style={{color:"#e05252",fontSize:13,margin:"0 0 10px"}}>{error}</p>}
                <button onClick={handleReset} disabled={loading||newPassword.length<8}
                  style={{width:"100%",padding:"14px",background:G.gold,color:"#000",
                    border:"none",borderRadius:11,fontSize:14,fontWeight:700,cursor:"pointer",
                    opacity:loading||newPassword.length<8?0.7:1}}>
                  {loading?"Updating…":"Set New Password"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── MAIN AUTH VIEW ── */}
        {(mode==="login"||mode==="signup")&&(
          <div style={{background:G.card,border:"1px solid "+G.border,borderRadius:18,padding:"28px 24px"}}>

            {/* Google */}
            <button onClick={handleGoogle} disabled={loading}
              style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12,
                padding:"14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:12,cursor:"pointer",fontFamily:"inherit",marginBottom:10,
                color:G.cream,fontSize:14,fontWeight:500,transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Apple */}
            <button onClick={handleApple} disabled={loading}
              style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12,
                padding:"14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:12,cursor:"pointer",fontFamily:"inherit",marginBottom:10,
                color:G.cream,fontSize:14,fontWeight:500,transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}>
              <svg width="16" height="18" viewBox="0 0 814 1000" fill={G.cream}>
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-37.5-150.9-99.2C-33.2 753.2 0 571.5 0 570c0-0.4 0-0.8 0-1.2 0.3-140.1 89.4-214.2 177.3-214.2 61.2 0 112.2 38.7 151.7 38.7 37.7 0 98.4-40.8 165.2-40.8 27.4 0 108.2 2.3 162.9 86.4zm-137.4-195.7c5.8-27.4 15.4-52.5 30.4-76.5 33-48.7 93.1-85.5 148.5-85.5 2.9 0 5.8 0 8.7 0.3-3.2 30.4-14.8 58.2-30.4 82.5-32.4 49.4-90.9 84.5-157.2 79.2z"/>
              </svg>
              Continue with Apple
            </button>

            {/* Email toggle button */}
            {!showEmailForm&&(
              <button onClick={()=>setTab("email")}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12,
                  padding:"14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:12,cursor:"pointer",fontFamily:"inherit",marginBottom:20,
                  color:G.cream,fontSize:14,fontWeight:500,transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}>
                <span style={{fontSize:16}}>✉️</span>
                Continue with Email
              </button>
            )}

            {/* OR divider */}
            {!showEmailForm&&(
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <div style={{flex:1,height:1,background:"rgba(232,220,200,0.08)"}}/>
                <span style={{fontSize:11,color:G.dimmer,letterSpacing:".08em"}}>OR</span>
                <div style={{flex:1,height:1,background:"rgba(232,220,200,0.08)"}}/>
              </div>
            )}

            {/* Email form (expands when email button clicked) */}
            {showEmailForm&&(
              <>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                  <button onClick={()=>setTab("")}
                    style={{background:"none",border:"none",color:G.dimmer,cursor:"pointer",fontSize:18,padding:0,lineHeight:1}}>←</button>
                  <span style={{fontSize:14,fontWeight:600,color:G.cream}}>Continue with Email</span>
                </div>

                {mode==="signup"&&(
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your first name"
                    style={{...iStyle,marginBottom:10}}
                    onFocus={e=>e.target.style.borderColor="rgba(240,180,41,0.4)"}
                    onBlur={e=>e.target.style.borderColor=G.inpBorder}/>
                )}
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address"
                  style={{...iStyle,marginBottom:10}}
                  onFocus={e=>e.target.style.borderColor="rgba(240,180,41,0.4)"}
                  onBlur={e=>e.target.style.borderColor=G.inpBorder}/>
                <div style={{position:"relative",marginBottom:8}}>
                  <input type={showPass?"text":"password"} value={password}
                    onChange={e=>setPassword(e.target.value)}
                    placeholder={mode==="signup"?"Create a password (8+ chars)":"Password"}
                    style={{...iStyle,paddingRight:56}}
                    onFocus={e=>e.target.style.borderColor="rgba(240,180,41,0.4)"}
                    onBlur={e=>e.target.style.borderColor=G.inpBorder}
                    onKeyDown={e=>{if(e.key==="Enter") mode==="signup"?handleSignup():handleLogin();}}/>
                  <button onClick={()=>setShowPass(p=>!p)}
                    style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",
                      background:"none",border:"none",color:G.dimmer,cursor:"pointer",fontSize:12,padding:0}}>
                    {showPass?"Hide":"Show"}
                  </button>
                </div>

                {error&&<p style={{color:"#e05252",fontSize:13,margin:"4px 0 10px",lineHeight:1.5}}>{error}</p>}

                <button onClick={mode==="signup"?handleSignup:handleLogin} disabled={loading}
                  style={{width:"100%",padding:"15px",background:G.gold,color:"#000",border:"none",
                    borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:14,
                    opacity:loading?.7:1,boxShadow:"0 0 30px rgba(240,180,41,0.15)"}}>
                  {loading?"Please wait…":mode==="signup"?"Create Account →":"Sign In →"}
                </button>

                {mode==="login"&&(
                  <button onClick={()=>setMode("forgot")}
                    style={{background:"none",border:"none",color:G.dimmer,cursor:"pointer",
                      fontSize:12,display:"block",textAlign:"center",width:"100%",marginBottom:6}}>
                    Forgot your password?
                  </button>
                )}
              </>
            )}

            {/* Toggle login / signup */}
            <div style={{textAlign:"center",fontSize:13,color:G.dimmer}}>
              {mode==="signup"?(
                <>Already have an account?{" "}
                <button onClick={()=>{setMode("login");setTab("");setError("");}}
                  style={{background:"none",border:"none",color:G.gold,cursor:"pointer",fontSize:13,fontWeight:600,padding:0}}>
                  Sign in
                </button></>
              ):(
                <>Don't have an account?{" "}
                <button onClick={()=>{setMode("signup");setTab("email");setError("");}}
                  style={{background:"none",border:"none",color:G.gold,cursor:"pointer",fontSize:13,fontWeight:600,padding:0}}>
                  Create one free
                </button></>
              )}
            </div>
          </div>
        )}

        {/* Terms */}
        {(mode==="login"||mode==="signup")&&(
          <p style={{textAlign:"center",fontSize:11,color:G.dimmer,margin:"18px 0 0",lineHeight:1.6}}>
            By continuing, you agree to our{" "}
            <span style={{color:G.gold,cursor:"pointer"}} onClick={()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:"terms"}))}>Terms of Service</span>{" "}and{" "}
            <span style={{color:G.gold,cursor:"pointer"}} onClick={()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:"privacy"}))}>Privacy Policy</span>
          </p>
        )}
      </div>
    </div>
  );
}

function buildSingleCountryRelocationPrompt(formData, country, isPremium){
  const name    = formData?.name    || "the user";
  const from    = formData?.country || "their current country";
  const skills  = formData?.skills  || formData?.career || "general skills";
  const goals   = formData?.goals   || formData?.bigGoal || "improve their life";
  const income  = formData?.income  || "unknown";
  const age     = formData?.age     || "unknown";

  return `Give ${name} (age ${age}, from ${from}, skills: ${skills}, goal: ${goals}, income: ${income}) a detailed relocation report for ${country}.

CURRENCY RULE FOR THIS REPORT:
- All amounts the person will SPEND in ${country} = ${country}'s local currency + USD equivalent in brackets.
- Visa fees, startup costs, rent, food = local currency first.
- Income potential = USD (since online work pays in USD globally).

Return ONLY a valid JSON object with these exact fields. No markdown. No code fences. Start with { end with }:

{
  "country": "${country}",
  "fit": <number 0-100 based on how well this country matches their profile>,
  "tagline": "<one punchy sentence — why this could work or not for them specifically>",
  "overview": "<2-3 sentences about living in ${country} from the perspective of someone from ${from}>",
  "pros": ["<3-4 genuine advantages for someone with their profile>"],
  "cons": ["<3-4 real challenges they should expect>"],
  "living": "<specific cost of living in ${country}: monthly rent for decent apartment, food budget, transport. Use ${country}'s LOCAL CURRENCY for all amounts — add USD equivalent in brackets. E.g. 'Rent: KSh 45,000/month ($350). Food: KSh 15,000/month. Total budget: KSh 80,000/month ($620)'>",
  "visa": "<easy|moderate|hard> — one word only",
  "visa_detail": "<specific visa pathway for someone from ${from}: which visa, requirements, rough cost, processing time>",
  "business": "<how to start a business in ${country} as a foreigner — registration, cost, what works for their skills>",
  "timeline": "<realistic month-by-month plan: Month 1-3, Month 4-6, Month 7-12>",
  "opportunity": <number 0-100 for income opportunity based on their skills>,
  "cost": "<low|medium|high> — one word based on cost of living vs their income>",
  "verdict": "<2-3 honest sentences: should they seriously consider this or not, and why>"
}

Be specific. Use real numbers. Reference their actual background. Do not be generic.`;
}

function RelocCard({r, onRetry}){
  const [open, setOpen] = useState(false);
  // Safe-guard every field — never trust AI JSON to be complete
  const country   = r?.country   || "Unknown";
  const fit       = Number(r?.fit) || 0;
  const tagline   = r?.tagline   || "";
  const visa      = r?.visa      || "";
  const cost      = r?.cost      || "";
  const overview  = r?.overview  || "";
  const pros      = Array.isArray(r?.pros)  ? r.pros  : [];
  const cons      = Array.isArray(r?.cons)  ? r.cons  : [];
  const living    = r?.living    || "";
  const visa_detail=r?.visa_detail||"";
  const business  = r?.business  || "";
  const timeline  = r?.timeline  || "";
  const verdict   = r?.verdict   || "";
  const fitColor  = fit>=75?"#4ADE80":fit>=55?"#FCD34D":"#F87171";

  if(r?.error) return(
    <div style={{background:"var(--night)",borderRadius:16,border:"1px solid rgba(248,113,113,0.25)",marginBottom:16,padding:"20px",textAlign:"center"}}>
      <div style={{fontSize:24,marginBottom:8}}>🌍</div>
      <div style={{fontSize:14,color:"var(--cream-50)",marginBottom:4}}>Couldn&apos;t load the {country} report</div>
      <div style={{fontSize:12,color:"var(--cream-30)",marginBottom:16}}>The AI timed out. Try again — it usually works on the second attempt.</div>
      <button onClick={()=>onRetry&&onRetry(country)}
        style={{background:"var(--gold)",border:"none",borderRadius:10,padding:"10px 24px",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>
        Try again →
      </button>
    </div>
  );

  return(
    <div style={{background:"var(--night)",borderRadius:16,border:"1px solid var(--cream-10)",marginBottom:16,overflow:"hidden"}}>
      {/* Header row — always clickable */}
      <div onClick={()=>setOpen(o=>!o)}
        style={{padding:"18px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:52,height:52,borderRadius:12,background:"var(--midnight)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div style={{fontSize:18,fontWeight:800,color:fitColor,lineHeight:1}}>{fit||"—"}</div>
          <div style={{fontSize:8,color:"var(--cream-40)",marginTop:1,letterSpacing:"0.05em"}}>FIT</div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:"var(--cream)",marginBottom:3}}>{country}</div>
          <div style={{fontSize:12,color:"var(--cream-60)",lineHeight:1.4}}>{tagline}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
          {visa&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,
            background:visa==="easy"?"rgba(74,222,128,0.15)":visa==="moderate"?"rgba(252,211,77,0.15)":"rgba(248,113,113,0.15)",
            color:visa==="easy"?"#4ADE80":visa==="moderate"?"#FCD34D":"#F87171"}}>Visa: {visa}</span>}
          {cost&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(255,255,255,0.06)",color:"var(--cream-60)"}}>Cost: {cost}</span>}
          <span style={{color:"var(--cream-30)",fontSize:13}}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {open&&(
        <div style={{padding:"0 20px 20px",borderTop:"1px solid var(--cream-10)"}}>
          <div style={{paddingTop:16}}>
            {overview&&<p style={{fontSize:13,color:"var(--cream-80)",lineHeight:1.75,marginBottom:16}}>{overview}</p>}
            {(pros.length>0||cons.length>0)&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                {pros.length>0&&<div style={{background:"rgba(74,222,128,0.07)",borderRadius:12,padding:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#4ADE80",marginBottom:8,letterSpacing:"0.08em"}}>WHY IT WORKS</div>
                  {pros.map((p,i)=><div key={i} style={{fontSize:12,color:"var(--cream-70)",marginBottom:6,lineHeight:1.6,paddingLeft:10,borderLeft:"2px solid rgba(74,222,128,0.3)"}}>✓ {String(p)}</div>)}
                </div>}
                {cons.length>0&&<div style={{background:"rgba(248,113,113,0.07)",borderRadius:12,padding:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#F87171",marginBottom:8,letterSpacing:"0.08em"}}>BE READY FOR</div>
                  {cons.map((c,i)=><div key={i} style={{fontSize:12,color:"var(--cream-70)",marginBottom:6,lineHeight:1.6,paddingLeft:10,borderLeft:"2px solid rgba(248,113,113,0.3)"}}>! {String(c)}</div>)}
                </div>}
              </div>
            )}
            {living&&<div style={{background:"var(--midnight)",borderRadius:12,padding:14,marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:"var(--cream-40)",marginBottom:8,letterSpacing:"0.08em"}}>💰 REAL COST OF LIVING</div>
              <p style={{fontSize:12,color:"var(--cream-70)",lineHeight:1.7,margin:0}}>{living}</p>
            </div>}
            {visa_detail&&<div style={{background:"var(--midnight)",borderRadius:12,padding:14,marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:"var(--cream-40)",marginBottom:8,letterSpacing:"0.08em"}}>🛂 YOUR VISA PATHWAY</div>
              <p style={{fontSize:12,color:"var(--cream-70)",lineHeight:1.7,margin:0}}>{visa_detail}</p>
            </div>}
            {business&&<div style={{background:"var(--midnight)",borderRadius:12,padding:14,marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:"var(--cream-40)",marginBottom:8,letterSpacing:"0.08em"}}>🏢 STARTING A BUSINESS THERE</div>
              <p style={{fontSize:12,color:"var(--cream-70)",lineHeight:1.7,margin:0}}>{business}</p>
            </div>}
            {timeline&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:14,marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:"var(--cream-40)",marginBottom:6,letterSpacing:"0.08em"}}>⏱ REALISTIC TIMELINE</div>
              <p style={{fontSize:12,color:"var(--cream-70)",lineHeight:1.6,margin:0}}>{timeline}</p>
            </div>}
            {verdict&&<div style={{background:"rgba(156,124,255,0.12)",border:"1px solid rgba(156,124,255,0.25)",borderRadius:12,padding:14}}>
              <div style={{fontSize:10,fontWeight:700,color:"#A78BFA",marginBottom:6,letterSpacing:"0.08em"}}>OUR HONEST VERDICT</div>
              <p style={{fontSize:13,color:"var(--cream-80)",lineHeight:1.7,margin:0,fontStyle:"italic"}}>{verdict}</p>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}

function RelocationExplorer({suggestedCountries, formData, userId, isPremium, isPaid, onUnlock}){
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [customReport, setCustomReport] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [view,     setView]     = useState("suggested");
  const [genErr,   setGenErr]   = useState("");

  // Safe: formData may be null/undefined during hydration
  const userCountry = (formData?.country || "").toLowerCase();
  const filtered = (WORLD_COUNTRIES||[])
    .filter(c=>c.toLowerCase().includes(search.toLowerCase()) && c.toLowerCase()!==userCountry)
    .slice(0,8);

  // Safe list of suggested countries — guard against nulls in each object
  const safeList = (Array.isArray(suggestedCountries) ? suggestedCountries : [])
    .filter(r=>r && typeof r==="object");

  const generateReport = async(country, attempt=1)=>{
    if(!country) return;
    setLoading(true); setGenErr(""); setCustomReport(null); setSelected(country); setView("custom");
    try{
      const sys="You are a relocation expert. Return ONLY a valid JSON object. No markdown. No code fences. No explanation. Start with { and end with }. Keep each field under 200 characters.";
      const prompt=buildSingleCountryRelocationPrompt(formData||{}, country, isPremium);
      const raw=await callAPI({messages:[{role:"user",content:prompt}],system:sys,userId,isPremium:true});
      const clean=raw.replace(/```json|```/g,"").trim();
      const start=clean.indexOf("{"); const end=clean.lastIndexOf("}");
      if(start===-1||end===-1) throw new Error("No JSON in response");
      const parsed=JSON.parse(clean.slice(start,end+1));
      if(!parsed.country) parsed.country=country;
      // Ensure arrays are arrays
      if(!Array.isArray(parsed.pros))  parsed.pros  = [];
      if(!Array.isArray(parsed.cons))  parsed.cons  = [];
      setCustomReport(parsed);
    }catch(e){
      console.warn(`Relocation attempt ${attempt}:`, e.message);
      if(attempt<3){ setTimeout(()=>generateReport(country,attempt+1),1800); return; }
      setCustomReport({country,fit:0,tagline:"",overview:"",pros:[],cons:[],business:"",living:"",visa_detail:"",opportunity:0,cost:"",visa:"",timeline:"",verdict:"",error:true});
    }finally{
      setLoading(false);
    }
  };

  return(
    <LockGate isPaid={isPaid} onUnlock={onUnlock}>
      <div className="fu">
        <div className="d3" style={{marginBottom:6}}>Where in the world could you actually thrive?</div>
        <p className="body" style={{marginBottom:20,color:"var(--cream-60)"}}>
          We matched your profile against countries where someone with your background, skills, and goals tends to break through.
          Type any country below for a full custom report.
        </p>

        {/* Country search */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--cream-40)",letterSpacing:"0.08em",marginBottom:8}}>HAVE A COUNTRY IN MIND?</div>
          <div style={{position:"relative"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              onBlur={()=>setTimeout(()=>setSearch(""),200)}
              placeholder="Search any country…"
              style={{width:"100%",background:"var(--midnight)",border:"1px solid var(--cream-15)",borderRadius:12,padding:"12px 16px",color:"var(--cream)",fontSize:13,outline:"none",boxSizing:"border-box"}}
            />
            {search.length>1&&filtered.length>0&&(
              <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"var(--midnight)",border:"2px solid var(--gold)",borderRadius:12,overflow:"hidden auto",maxHeight:260,zIndex:9999,boxShadow:"0 20px 60px rgba(0,0,0,0.95)"}}>
                {filtered.map(c=>(
                  <div key={c} onMouseDown={e=>{e.preventDefault();setSearch("");generateReport(c);}}
                    style={{padding:"13px 18px",cursor:"pointer",fontSize:14,color:"var(--cream)",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--midnight)"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--night)"}
                    onMouseLeave={e=>e.currentTarget.style.background="var(--midnight)"}>
                    <span>{c}</span>
                    <span style={{color:"var(--gold)",fontSize:13,fontWeight:600}}>→</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading&&(
          <div style={{textAlign:"center",padding:"40px 20px",background:"var(--night)",borderRadius:16,border:"1px solid var(--cream-10)",marginBottom:20}}>
            <div style={{fontSize:28,marginBottom:12}}>🔍</div>
            <div style={{fontSize:14,color:"var(--cream-60)",marginBottom:6}}>Building your {selected} report…</div>
            <div style={{fontSize:12,color:"var(--cream-40)"}}>Checking visa rules, costs, opportunities, and what it&apos;s really like to move there{formData?.country?` from ${formData.country}`:""}.</div>
          </div>
        )}

        {/* Toggle between custom and suggested */}
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

        {/* Custom report */}
        {!loading&&customReport&&view==="custom"&&(
          <RelocCard r={customReport} onRetry={generateReport}/>
        )}

        {/* Suggested list */}
        {!loading&&(view==="suggested"||!customReport)&&(
          <>
            {!customReport&&<div style={{fontSize:11,fontWeight:700,color:"var(--cream-40)",letterSpacing:"0.08em",marginBottom:12}}>OUR PICKS BASED ON YOUR PROFILE</div>}
            {safeList.length===0&&!customReport&&(
              <div style={{padding:"32px 20px",background:"var(--night)",borderRadius:16,border:"1px solid var(--cream-10)",textAlign:"center",marginBottom:16}}>
                <div style={{fontSize:13,color:"var(--cream-40)",marginBottom:16}}>No suggested countries yet — search above to explore any country.</div>
              </div>
            )}
            {safeList.map((r,i)=>(
              <RelocCard key={r.country||i} r={r} onRetry={generateReport}/>
            ))}
          </>
        )}

        <div className="insight teal" style={{marginTop:8}}>
          <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75}}>
            Visa rules shift often — always verify on the official embassy or government immigration website before making any decisions.
          </p>
        </div>
      </div>
    </LockGate>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// LIFE HACKS MODULE
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO PLAYER — Text-to-speech using Web Speech API
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// VOICE SYSTEM — Global voice state + VoiceSelector + AudioPlayer
// ═══════════════════════════════════════════════════════════════════════════════
const _GV={voice:null,subs:[]};
function useGlobalVoice(){
  const [v,setV]=useState(_GV.voice);
  useEffect(()=>{
    _GV.subs.push(setV);
    return()=>{_GV.subs=_GV.subs.filter(s=>s!==setV);};
  },[]);
  const set=v=>{_GV.voice=v;_GV.subs.forEach(s=>s(v));};
  return[v,set];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HABIT TRACKING SYSTEM
// Global pub-sub store — same pattern as voice. Persisted to localStorage.
// Tracks which practice items the user has committed to ("I'm doing this").
// Each item has:  committed (bool) | status ("active"|"mastered"|"paused")
//                 startedAt (ISO) | notes (string) | lastUpdated (ISO)
// Key format: "module:itemId"  e.g. "discipline:wakeup" | "invest:study"
// ═══════════════════════════════════════════════════════════════════════════════

// All trackable items across every module — single source of truth
const ALL_TRACKABLE = [
  // Daily Discipline (7)
  {key:"discipline:wakeup",    module:"discipline", label:"Wake Up at 5:30–6 AM",           icon:"⏰", color:"var(--gold)"},
  {key:"discipline:routine",   module:"discipline", label:"Build a Daily Routine",            icon:"🔁", color:"var(--teal)"},
  {key:"discipline:consistency",module:"discipline",label:"Stay Consistent Daily",            icon:"📅", color:"#9b72cf"},
  {key:"discipline:focus",     module:"discipline", label:"90-Minute Focus Blocks",           icon:"🎯", color:"var(--rose)"},
  {key:"discipline:study",     module:"discipline", label:"Study Hard & Retain It",           icon:"📚", color:"var(--gold)"},
  {key:"discipline:workout",   module:"discipline", label:"Weekly Workout Plan",              icon:"💪", color:"var(--teal)"},
  {key:"discipline:mindset_d", module:"discipline", label:"Train My Mind Daily",              icon:"🧠", color:"#9b72cf"},
  // Invest in Yourself (7)
  {key:"invest:study",         module:"invest",     label:"Study Obsession (1 Bio/Month)",    icon:"📚", color:"var(--gold)"},
  {key:"invest:body",          module:"invest",     label:"Obsess Over Energy",               icon:"⚡", color:"var(--teal)"},
  {key:"invest:skills",        module:"invest",     label:"Stack High-Income Skills",         icon:"🛠️", color:"#9b72cf"},
  {key:"invest:network",       module:"invest",     label:"Network Mathematics",              icon:"🔗", color:"var(--rose)"},
  {key:"invest:money",         module:"invest",     label:"Make Money Move First",            icon:"💸", color:"var(--gold)"},
  {key:"invest:create",        module:"invest",     label:"Create, Don't Consume",            icon:"✏️", color:"var(--teal)"},
  {key:"invest:routine",       module:"invest",     label:"Build a Ruthless Routine",         icon:"⏰", color:"var(--gold)"},
  // Get Successful (5)
  {key:"success:01",           module:"success",    label:"Study the Greats' Patterns",       icon:"📖", color:"var(--gold)"},
  {key:"success:02",           module:"success",    label:"Build a Ruthless Routine",         icon:"🔁", color:"var(--teal)"},
  {key:"success:03",           module:"success",    label:"Upgrade My Network",               icon:"🔗", color:"#9b72cf"},
  {key:"success:04",           module:"success",    label:"Create Something Daily",           icon:"✏️", color:"var(--rose)"},
  {key:"success:05",           module:"success",    label:"Protect My Energy",                icon:"⚡", color:"var(--gold)"},
  // Strong Mindset (8)
  {key:"mindset:patient",      module:"mindset",    label:"Practice Patience",                icon:"⏳", color:"var(--gold)"},
  {key:"mindset:proactive",    module:"mindset",    label:"Be Proactive Every Week",          icon:"⚡", color:"var(--teal)"},
  {key:"mindset:change",       module:"mindset",    label:"Stay Open to Change",              icon:"🔄", color:"#9b72cf"},
  {key:"mindset:letgo",        module:"mindset",    label:"Learn to Let Go",                  icon:"🍃", color:"var(--rose)"},
  {key:"mindset:hope",         module:"mindset",    label:"Protect My Hope",                  icon:"☀️", color:"var(--gold)"},
  {key:"mindset:thoughts",     module:"mindset",    label:"Audit My Thoughts Daily",          icon:"🧠", color:"var(--teal)"},
  {key:"mindset:okay",         module:"mindset",    label:"Accept When I'm Not OK",           icon:"💙", color:"#9b72cf"},
  {key:"mindset:dontquit",     module:"mindset",    label:"Don't Quit When It's Hard",        icon:"🏁", color:"var(--rose)"},
  // 10x Principles (6)
  {key:"tenx:consistency",     module:"tenx",       label:"Show Up Consistently",             icon:"📅", color:"var(--gold)"},
  {key:"tenx:process",         module:"tenx",       label:"Focus on Process Not Outcome",     icon:"🔬", color:"var(--teal)"},
  {key:"tenx:friction",        module:"tenx",       label:"Remove Friction from Good Habits", icon:"✂️", color:"#9b72cf"},
  {key:"tenx:feedback",        module:"tenx",       label:"Get Feedback Fast",                icon:"⚡", color:"var(--rose)"},
  {key:"tenx:mentors",         module:"tenx",       label:"Learn from People Ahead",          icon:"🔭", color:"var(--gold)"},
  {key:"tenx:focus",           module:"tenx",       label:"Shape My Environment for Focus",   icon:"🎯", color:"var(--teal)"},
];

const MODULE_LABELS = {
  discipline:"Daily Discipline",
  invest:"Invest in Yourself",
  success:"Get Successful",
  mindset:"Strong Mindset",
  tenx:"10x Principles",
};

// Global store — loaded from localStorage on first use
const _HT = { data:{}, subs:[], userId:null };

function _htLoad(uid){
  if(!uid) return;
  try{
    const raw = localStorage.getItem(`diq_habits_${uid}`);
    _HT.data = raw ? JSON.parse(raw) : {};
  }catch{ _HT.data = {}; }
}
function _htSave(uid){
  if(!uid) return;
  try{ localStorage.setItem(`diq_habits_${uid}`, JSON.stringify(_HT.data)); }catch{}
}
function _htNotify(){ _HT.subs.forEach(s=>s({..._HT.data})); }

function useHabitTracker(userId){
  const [data, setData] = useState(_HT.data);
  useEffect(()=>{
    if(userId && _HT.userId !== userId){
      _HT.userId = userId;
      _htLoad(userId);
      setData({..._HT.data});
    }
    _HT.subs.push(setData);
    return()=>{ _HT.subs = _HT.subs.filter(s=>s!==setData); };
  },[userId]);

  const commit = (key, notes="")=>{
    const now = new Date().toISOString();
    _HT.data[key] = {
      committed: true,
      status: "active",
      startedAt: _HT.data[key]?.startedAt || now,
      lastUpdated: now,
      notes,
    };
    _htSave(_HT.userId);
    _htNotify();
  };

  const updateStatus = (key, status)=>{
    if(!_HT.data[key]) return;
    _HT.data[key] = { ..._HT.data[key], status, lastUpdated: new Date().toISOString() };
    _htSave(_HT.userId);
    _htNotify();
  };

  const uncommit = (key)=>{
    delete _HT.data[key];
    _htSave(_HT.userId);
    _htNotify();
  };

  const addNote = (key, notes)=>{
    if(!_HT.data[key]) return;
    _HT.data[key] = { ..._HT.data[key], notes, lastUpdated: new Date().toISOString() };
    _htSave(_HT.userId);
    _htNotify();
  };

  const committed   = ALL_TRACKABLE.filter(t=>data[t.key]?.committed);
  const mastered    = committed.filter(t=>data[t.key]?.status==="mastered");
  const active      = committed.filter(t=>data[t.key]?.status==="active");
  const paused      = committed.filter(t=>data[t.key]?.status==="paused");
  const total       = ALL_TRACKABLE.length;
  const pct         = Math.round((committed.length/total)*100);

  return { data, commit, uncommit, updateStatus, addNote, committed, mastered, active, paused, total, pct };
}

// ── HabitButton: the "I'm doing this" button used inside every module ─────────
function HabitButton({itemKey, userId, compact=false}){
  const ht = useHabitTracker(userId);
  const item = ALL_TRACKABLE.find(t=>t.key===itemKey);
  const entry = ht.data[itemKey];
  const isCommitted = entry?.committed;
  const status = entry?.status || "active";
  const [showNote, setShowNote] = useState(false);
  const [noteVal, setNoteVal] = useState(entry?.notes||"");
  const [noteSaved, setNoteSaved] = useState(false);

  if(!item) return null;

  const STATUS_META = {
    active:   {label:"Active",   color:"var(--teal)",  bg:"rgba(31,168,154,0.12)",  border:"rgba(31,168,154,0.3)"},
    mastered: {label:"Mastered", color:"var(--gold)",  bg:"rgba(210,175,90,0.12)",  border:"rgba(210,175,90,0.3)"},
    paused:   {label:"Paused",   color:"var(--cream-40)", bg:"rgba(255,255,255,0.04)", border:"rgba(255,255,255,0.1)"},
  };
  const sm = STATUS_META[status];

  if(compact){
    // Compact chip used in tracker overview
    return(
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",
        background:isCommitted?sm.bg:"rgba(255,255,255,0.03)",
        border:`1px solid ${isCommitted?sm.border:"rgba(255,255,255,0.08)"}`,
        borderRadius:20,cursor:"pointer",transition:"all .2s"}}
        onClick={()=>isCommitted?ht.uncommit(itemKey):ht.commit(itemKey)}>
        <span style={{fontSize:12}}>{isCommitted?"✓":"○"}</span>
        <span style={{fontSize:11,color:isCommitted?sm.color:"var(--cream-30)",fontWeight:isCommitted?600:400}}>{item.icon} {item.label}</span>
      </div>
    );
  }

  return(
    <div style={{marginTop:14}}>
      {!isCommitted?(
        <button
          onClick={()=>{ ht.commit(itemKey); setShowNote(true); }}
          style={{
            width:"100%",padding:"12px 16px",
            background:"rgba(31,168,154,0.06)",
            border:"1px dashed rgba(31,168,154,0.35)",
            borderRadius:12,cursor:"pointer",
            display:"flex",alignItems:"center",gap:10,
            transition:"all .2s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(31,168,154,0.12)";e.currentTarget.style.borderStyle="solid";}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(31,168,154,0.06)";e.currentTarget.style.borderStyle="dashed";}}
        >
          <div style={{width:28,height:28,borderRadius:"50%",border:"2px dashed rgba(31,168,154,0.5)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:14}}>+</span>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--teal)"}}>I'm doing this</div>
            <div style={{fontSize:11,color:"var(--cream-30)",marginTop:1}}>Add to your practice tracker</div>
          </div>
        </button>
      ):(
        <div style={{background:sm.bg,border:`1px solid ${sm.border}`,borderRadius:12,padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:showNote?10:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:sm.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:12,color:sm.color}}>✓</span>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:sm.color}}>In your practice</div>
                {entry?.startedAt&&<div style={{fontSize:10,color:"var(--cream-30)",marginTop:1}}>
                  Started {new Date(entry.startedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}
                </div>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              {/* Status picker */}
              <select value={status} onChange={e=>ht.updateStatus(itemKey,e.target.value)}
                style={{background:"var(--midnight)",border:`1px solid ${sm.border}`,borderRadius:8,padding:"4px 8px",color:sm.color,fontSize:10,fontFamily:"var(--f-mono)",cursor:"pointer",outline:"none"}}>
                <option value="active">Active</option>
                <option value="mastered">Mastered ✦</option>
                <option value="paused">Paused</option>
              </select>
              <button onClick={()=>setShowNote(n=>!n)}
                style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"4px 8px",color:"var(--cream-40)",fontSize:10,cursor:"pointer"}}>
                {showNote?"▲":"📝"}
              </button>
              <button onClick={()=>ht.uncommit(itemKey)}
                style={{background:"none",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"4px 8px",color:"var(--cream-30)",fontSize:10,cursor:"pointer"}}
                title="Remove from tracker">✕</button>
            </div>
          </div>
          {showNote&&(
            <div style={{marginTop:8}}>
              <textarea
                value={noteVal}
                onChange={e=>setNoteVal(e.target.value)}
                onBlur={()=>{ht.addNote(itemKey,noteVal);setNoteSaved(true);setTimeout(()=>setNoteSaved(false),1500);}}
                placeholder="Add a note — how is this going? What have you noticed?"
                rows={2}
                style={{width:"100%",background:"rgba(0,0,0,0.2)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 10px",color:"var(--cream-60)",fontSize:12,resize:"none",outline:"none",lineHeight:1.6,boxSizing:"border-box",fontFamily:"inherit"}}
              />
              {noteSaved&&<div style={{fontSize:10,color:sm.color,marginTop:4,fontFamily:"var(--f-mono)"}}>✓ Saved</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Master Progress Tracker Panel — shows all 33 items, filter by module ──────
function HabitTrackerPanel({userId, onClose, onNavigate}){
  const ht = useHabitTracker(userId);
  const [filter, setFilter] = useState("all");   // "all"|"active"|"mastered"|"paused"|module key
  const [expandKey, setExpandKey] = useState(null);

  const modules = ["all","discipline","invest","success","mindset","tenx"];

  const displayed = ALL_TRACKABLE.filter(t=>{
    if(filter==="all") return true;
    if(filter==="active")   return ht.data[t.key]?.status==="active" && ht.data[t.key]?.committed;
    if(filter==="mastered") return ht.data[t.key]?.status==="mastered";
    if(filter==="paused")   return ht.data[t.key]?.status==="paused";
    return t.module===filter;
  });

  // Group by module for the "all" view
  const byModule = {};
  displayed.forEach(t=>{
    if(!byModule[t.module]) byModule[t.module]=[];
    byModule[t.module].push(t);
  });

  const STATUS_META = {
    active:   {label:"Active",   color:"var(--teal)",  bg:"rgba(31,168,154,0.1)",  border:"rgba(31,168,154,0.25)"},
    mastered: {label:"Mastered ✦",color:"var(--gold)", bg:"rgba(210,175,90,0.1)",  border:"rgba(210,175,90,0.25)"},
    paused:   {label:"Paused",   color:"var(--cream-40)",bg:"rgba(255,255,255,0.04)",border:"rgba(255,255,255,0.1)"},
  };

  const daysActive = (entry)=>{
    if(!entry?.startedAt) return 0;
    return Math.floor((Date.now()-new Date(entry.startedAt).getTime())/(1000*60*60*24));
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(5,6,15,0.92)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:"100%",maxWidth:580,background:"var(--raised)",borderRadius:"20px 20px 0 0",border:"1px solid var(--line-gold)",maxHeight:"92vh",display:"flex",flexDirection:"column",animation:"slideIn .3s ease"}}>

        {/* Header */}
        <div style={{padding:"20px 22px 0",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <div className="mono" style={{marginBottom:4,fontSize:"10px"}}>YOUR PRACTICE TRACKER</div>
              <div style={{fontSize:18,fontWeight:700,color:"var(--cream)"}}>
                {ht.committed.length} of {ht.total} practices committed
              </div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"1px solid var(--line)",borderRadius:8,padding:"6px 10px",color:"var(--cream-40)",cursor:"pointer",fontSize:14}}>✕</button>
          </div>

          {/* Master progress bar */}
          <div style={{marginBottom:6}}>
            <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",marginBottom:6}}>
              <div style={{height:"100%",width:`${ht.pct}%`,background:"linear-gradient(90deg,var(--teal),var(--gold))",borderRadius:4,transition:"width .6s ease"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>
              <span>{ht.pct}% committed</span>
              <div style={{display:"flex",gap:14}}>
                <span style={{color:"var(--teal)"}}>{ht.active.length} active</span>
                <span style={{color:"var(--gold)"}}>{ht.mastered.length} mastered</span>
                {ht.paused.length>0&&<span style={{color:"var(--cream-30)"}}>{ht.paused.length} paused</span>}
              </div>
            </div>
          </div>

          {/* Module progress mini-bars */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:16}}>
            {["discipline","invest","success","mindset","tenx"].map(mod=>{
              const items = ALL_TRACKABLE.filter(t=>t.module===mod);
              const done  = items.filter(t=>ht.data[t.key]?.committed).length;
              const pct   = Math.round((done/items.length)*100);
              return(
                <div key={mod} onClick={()=>setFilter(mod)} style={{cursor:"pointer",padding:"6px 8px",background:filter===mod?"var(--lift)":"var(--midnight)",borderRadius:8,border:`1px solid ${filter===mod?"var(--line-gold)":"rgba(255,255,255,0.06)"}`,transition:"all .2s"}}>
                  <div style={{fontSize:9,color:"var(--cream-30)",marginBottom:4,fontFamily:"var(--f-mono)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{MODULE_LABELS[mod].split(" ")[0]}</div>
                  <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,marginBottom:3}}>
                    <div style={{height:"100%",width:`${pct}%`,background:"var(--gold)",borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:9,color:"var(--cream-40)",fontFamily:"var(--f-mono)"}}>{done}/{items.length}</div>
                </div>
              );
            })}
          </div>

          {/* Filter tabs */}
          <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:12,scrollbarWidth:"none"}}>
            {[["all","All"],["active","Active"],["mastered","Mastered ✦"],["paused","Paused"],
              ...modules.slice(1).map(m=>[m,MODULE_LABELS[m]])
            ].map(([val,lbl])=>(
              <button key={val} onClick={()=>setFilter(val)}
                style={{
                  flexShrink:0,padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,transition:"all .2s",whiteSpace:"nowrap",
                  background:filter===val?"var(--gold)":"rgba(255,255,255,0.05)",
                  color:filter===val?"#000":"var(--cream-40)",
                }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{flex:1,overflowY:"auto",padding:"4px 22px 24px"}}>
          {displayed.length===0&&(
            <div style={{textAlign:"center",padding:"40px 20px",color:"var(--cream-30)",fontSize:13}}>
              {filter==="all"
                ? `No practices committed yet. Open any module and tap "I'm doing this".`
                : `No ${filter} practices yet.`}
            </div>
          )}

          {(filter==="all"?Object.entries(byModule):[[filter,displayed]]).map(([mod,items])=>(
            <div key={mod} style={{marginBottom:20}}>
              {filter==="all"&&<div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".12em",marginBottom:10,paddingTop:8}}>
                {MODULE_LABELS[mod]?.toUpperCase()||mod.toUpperCase()}
              </div>}
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {items.map(item=>{
                  const entry   = ht.data[item.key];
                  const isIn    = entry?.committed;
                  const status  = entry?.status||"active";
                  const sm      = STATUS_META[status]||STATUS_META.active;
                  const days    = daysActive(entry);
                  const isExp   = expandKey===item.key;

                  return(
                    <div key={item.key} style={{
                      background: isIn ? sm.bg : "rgba(255,255,255,0.02)",
                      border:`1px solid ${isIn?sm.border:"rgba(255,255,255,0.06)"}`,
                      borderRadius:12,overflow:"hidden",transition:"all .2s",
                    }}>
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",cursor:isIn?"pointer":"default"}}
                        onClick={()=>isIn&&setExpandKey(isExp?null:item.key)}>
                        {/* Toggle button */}
                        <button
                          onClick={e=>{e.stopPropagation(); isIn?ht.uncommit(item.key):ht.commit(item.key);}}
                          style={{
                            width:28,height:28,borderRadius:"50%",flexShrink:0,cursor:"pointer",border:"none",
                            background: isIn ? sm.border : "rgba(255,255,255,0.06)",
                            color: isIn ? sm.color : "var(--cream-30)",
                            fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",
                            transition:"all .2s",
                          }}>
                          {isIn?"✓":"○"}
                        </button>

                        <span style={{fontSize:15,flexShrink:0}}>{item.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:isIn?600:400,color:isIn?"var(--cream)":"var(--cream-40)",lineHeight:1.4}}>{item.label}</div>
                          {isIn&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:3}}>
                            <span style={{fontSize:9,fontFamily:"var(--f-mono)",color:sm.color,background:sm.bg,padding:"1px 6px",borderRadius:10,border:`1px solid ${sm.border}`}}>{sm.label}</span>
                            {days>0&&<span style={{fontSize:9,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>{days}d in</span>}
                            {entry?.notes&&<span style={{fontSize:9,color:"var(--cream-30)"}}>📝</span>}
                          </div>}
                        </div>

                        {isIn&&(
                          <select value={status} onClick={e=>e.stopPropagation()} onChange={e=>ht.updateStatus(item.key,e.target.value)}
                            style={{background:"var(--midnight)",border:`1px solid ${sm.border}`,borderRadius:8,padding:"3px 6px",color:sm.color,fontSize:9,fontFamily:"var(--f-mono)",cursor:"pointer",outline:"none",flexShrink:0}}>
                            <option value="active">Active</option>
                            <option value="mastered">Mastered</option>
                            <option value="paused">Paused</option>
                          </select>
                        )}
                      </div>

                      {/* Expanded note editor */}
                      {isIn&&isExp&&(
                        <div style={{padding:"0 14px 12px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                          <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--cream-30)",letterSpacing:".08em",marginBottom:6,marginTop:10}}>YOUR NOTES</div>
                          <NoteEditor itemKey={item.key} ht={ht}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        {ht.committed.length===0&&(
          <div style={{padding:"14px 22px",borderTop:"1px solid var(--line)",flexShrink:0,background:"var(--raised)"}}>
            <p style={{fontSize:12,color:"var(--cream-30)",textAlign:"center",margin:0,lineHeight:1.6}}>
              Open any module tab → expand a section → tap <strong style={{color:"var(--teal)"}}>"I'm doing this"</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Note editor extracted so it has its own stable state
function NoteEditor({itemKey, ht}){
  const [val, setVal] = useState(ht.data[itemKey]?.notes||"");
  const [saved, setSaved] = useState(false);
  const handleBlur = () => {
    ht.addNote(itemKey,val);
    setSaved(true);
    setTimeout(()=>setSaved(false),1500);
  };
  return(
    <div>
      <textarea value={val} onChange={e=>setVal(e.target.value)} onBlur={handleBlur}
        placeholder="How is this going? What have you noticed? What's hard?"
        rows={2}
        style={{width:"100%",background:"rgba(0,0,0,0.2)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 10px",color:"var(--cream-60)",fontSize:12,resize:"none",outline:"none",lineHeight:1.6,boxSizing:"border-box",fontFamily:"inherit"}}
      />
      {saved&&<div style={{fontSize:10,color:"var(--teal)",marginTop:4,fontFamily:"var(--f-mono)"}}>✓ Saved</div>}
    </div>
  );
}

// ── Mini progress bar widget shown in the Dashboard nav ───────────────────────
function HabitMiniBar({userId, onClick}){
  const ht = useHabitTracker(userId);
  if(ht.committed.length===0) return(
    <button onClick={onClick} style={{background:"rgba(255,255,255,0.04)",border:"1px dashed rgba(255,255,255,0.12)",borderRadius:10,padding:"5px 12px",color:"var(--cream-30)",fontSize:11,cursor:"pointer",fontFamily:"var(--f-mono)",flexShrink:0}}
      title="Track your practices">
      Track practices
    </button>
  );
  return(
    <button onClick={onClick} style={{background:"rgba(31,168,154,0.08)",border:"1px solid rgba(31,168,154,0.2)",borderRadius:10,padding:"5px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,flexShrink:0,transition:"all .2s"}}
      title="View your practice tracker"
      onMouseEnter={e=>e.currentTarget.style.background="rgba(31,168,154,0.15)"}
      onMouseLeave={e=>e.currentTarget.style.background="rgba(31,168,154,0.08)"}>
      <div style={{width:40,height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${ht.pct}%`,background:"linear-gradient(90deg,var(--teal),var(--gold))",borderRadius:2}}/>
      </div>
      <span style={{fontSize:10,fontFamily:"var(--f-mono)",color:"var(--teal)",fontWeight:700}}>{ht.committed.length}/{ht.total}</span>
    </button>
  );
}

// Re-resolve a voice from fresh getVoices() right before speaking.
// Voice object references go STALE in many browsers (Chrome Android especially).
// Match by name only — voiceURI is often undefined on mobile browsers.
function resolveLiveVoice(voiceRef){
  if(typeof window==="undefined"||!window.speechSynthesis||!voiceRef) return null;
  const live=window.speechSynthesis.getVoices();
  // Match by name (most reliable cross-browser identifier)
  return live.find(v=>v.name===voiceRef.name)
      || live.find(v=>v.lang===voiceRef.lang&&!v.localService===!voiceRef.localService)
      || live.find(v=>v.lang===voiceRef.lang)
      || null;
}

// Loads all voices — returns a promise that resolves when voices are ready
function loadVoices(){
  return new Promise(res=>{
    try{
    if(typeof window==="undefined"||!("speechSynthesis" in window)){res([]);return;}
    const attempt=()=>{
      const vs=(window.speechSynthesis.getVoices()||[]).filter(v=>v.lang.startsWith("en"));
      if(vs.length>0){res(vs);return;}
      window.speechSynthesis.onvoiceschanged=()=>{
        const vs2=(window.speechSynthesis.getVoices()||[]).filter(v=>v.lang.startsWith("en"));
        res(vs2);
      };
      // Fallback timeout
      setTimeout(()=>res(window.speechSynthesis.getVoices().filter(v=>v.lang.startsWith("en"))),2000);
    };
    attempt();
  }catch(_){}
  });
}

function VoiceSelector(){
  const [voices,setVoices]=useState([]);
  const [sel,setSel]=useGlobalVoice();
  const [open,setOpen]=useState(false);
  const btnRef=useRef(null);
  const dropRef=useRef(null);
  const [pos,setPos]=useState({top:0,left:0});

  useEffect(()=>{
    loadVoices().then(vs=>{
      setVoices(vs);
      if(!_GV.voice&&vs.length>0){
        const pick=
          vs.find(v=>v.name.includes("Natural"))||
          vs.find(v=>v.name.includes("Neural"))||
          vs.find(v=>v.name==="Google UK English Female")||
          vs.find(v=>v.name==="Google US English")||
          vs.find(v=>v.name.includes("Google")&&v.lang==="en-US")||
          vs.find(v=>v.name.includes("Samantha"))||
          vs.find(v=>v.name.includes("Daniel"))||
          vs.find(v=>v.lang==="en-US")||
          vs[0];
        setSel(pick);
      }
    });
  },[]);

  useEffect(()=>{
    if(!open) return;
    const updatePos=()=>{
      if(!btnRef.current) return;
      const r=btnRef.current.getBoundingClientRect();
      const dropdownW=270;
      const dropdownMaxH=380;
      let top=r.bottom+6;
      let left=Math.min(r.left,window.innerWidth-dropdownW-8);
      left=Math.max(8,left);
      if(top+dropdownMaxH>window.innerHeight&&r.top>dropdownMaxH) top=r.top-dropdownMaxH-6;
      setPos({top,left});
    };
    updatePos();
    // KEY FIX: check BOTH btnRef AND dropRef — the fixed dropdown is NOT inside btnRef DOM
    const close=(e)=>{
      if(!btnRef.current?.contains(e.target)&&!dropRef.current?.contains(e.target)){
        setOpen(false);
      }
    };
    document.addEventListener("mousedown",close);
    document.addEventListener("touchstart",close,{passive:true});
    window.addEventListener("scroll",updatePos,true);
    window.addEventListener("resize",updatePos);
    return()=>{
      document.removeEventListener("mousedown",close);
      document.removeEventListener("touchstart",close);
      window.removeEventListener("scroll",updatePos,true);
      window.removeEventListener("resize",updatePos);
    };
  },[open]);

  if(!voices.length) return null;

  const GROUPS=[
    {flag:"🇺🇸",key:"en-US",label:"American"},
    {flag:"🇬🇧",key:"en-GB",label:"British"},
    {flag:"🇦🇺",key:"en-AU",label:"Australian"},
    {flag:"🇮🇳",key:"en-IN",label:"Indian"},
    {flag:"🌍",key:"other",label:"Other English"},
  ];
  const seen=new Set();
  const grouped=GROUPS.map(g=>({
    ...g,
    voices:voices.filter(v=>{
      if(seen.has(v.name)) return false;
      const match=g.key==="other"?!["en-US","en-GB","en-AU","en-IN"].includes(v.lang):v.lang===g.key;
      if(match){seen.add(v.name);return true;}
      return false;
    }).slice(0,6),
  })).filter(g=>g.voices.length>0);

  const shortName=v=>v.name.replace("Microsoft","").replace("Google","").replace(/\s*\(.*?\)/g,"").trim()||v.name;

  return(
    <div style={{display:"inline-block"}}>
      <button ref={btnRef} onClick={(e)=>{e.stopPropagation();setOpen(o=>!o);}}
        style={{display:"inline-flex",alignItems:"center",gap:5,background:"none",border:"1px solid var(--cream-15)",borderRadius:20,padding:"5px 12px",color:"var(--cream-40)",fontSize:11,cursor:"pointer",fontFamily:"var(--f-mono)",letterSpacing:".04em",transition:"all .2s",whiteSpace:"nowrap"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--line-gold)";e.currentTarget.style.color="var(--gold)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--cream-15)";e.currentTarget.style.color="var(--cream-40)";}}>
        🎙 {sel?shortName(sel).slice(0,16):"Pick voice"} ▾
      </button>
      {open&&(
        <div
          ref={dropRef}
          style={{
            position:"fixed",
            top:pos.top,
            left:pos.left,
            zIndex:2147483647,
            background:"#0f1018",
            border:"1px solid rgba(210,175,90,0.45)",
            borderRadius:14,
            padding:"0 0 8px",
            minWidth:240,
            maxWidth:270,
            maxHeight:"min(380px,72vh)",
            overflowY:"auto",
            WebkitOverflowScrolling:"touch",
            overscrollBehavior:"contain",
            boxShadow:"0 24px 80px rgba(0,0,0,0.99)",
            isolation:"isolate",
            willChange:"transform",
          }}
          onScroll={e=>e.stopPropagation()}
          onClick={e=>e.stopPropagation()}
        >
          <div style={{padding:"10px 14px 8px",fontSize:9,color:"var(--gold)",fontFamily:"var(--f-mono)",letterSpacing:".12em",borderBottom:"1px solid rgba(255,255,255,0.07)",marginBottom:4,position:"sticky",top:0,background:"#0f1018",zIndex:1}}>🎙 SELECT VOICE & ACCENT</div>
          {grouped.map(g=>(
            <div key={g.key}>
              <div style={{padding:"5px 14px 3px",fontSize:8,color:"rgba(255,255,255,0.22)",fontFamily:"var(--f-mono)",letterSpacing:".1em",textTransform:"uppercase",background:"rgba(255,255,255,0.02)"}}>{g.flag} {g.label}</div>
              {g.voices.map(v=>(
                <button key={v.name}
                  onMouseDown={(e)=>{
                    // Use onMouseDown (fires BEFORE the document mousedown close handler)
                    // so the selection always registers before the dropdown closes
                    e.preventDefault();
                    e.stopPropagation();
                    setSel(v);
                    setOpen(false);
                  }}
                  onTouchEnd={(e)=>{
                    e.preventDefault();
                    e.stopPropagation();
                    setSel(v);
                    setOpen(false);
                  }}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",textAlign:"left",background:sel?.name===v.name?"rgba(210,175,90,0.1)":"transparent",border:"none",padding:"10px 16px",color:sel?.name===v.name?"var(--gold)":"rgba(255,255,255,0.65)",fontSize:13,cursor:"pointer",gap:8,fontFamily:"inherit",transition:"background .1s"}}>
                  <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {sel?.name===v.name&&<span style={{marginRight:5}}>✓</span>}{shortName(v)}
                  </span>
                  <span style={{fontSize:9,color:v.localService?"rgba(255,255,255,0.18)":"var(--teal)",flexShrink:0,padding:"1px 6px",borderRadius:4,background:v.localService?"transparent":"rgba(20,184,154,0.07)"}}>{v.localService?"device":"cloud"}</span>
                </button>
              ))}
            </div>
          ))}
          <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"8px 14px 0",marginTop:4}}>
            <button onMouseDown={(e)=>{e.preventDefault();setOpen(false);}} style={{fontSize:10,color:"rgba(255,255,255,0.2)",background:"none",border:"none",cursor:"pointer",fontFamily:"var(--f-mono)"}}>✕ close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AudioPlayer({text,label="Listen",mini=false}){
  const [state,setState]=useState("idle");
  const [supported]=useState(()=>typeof window!=="undefined"&&"speechSynthesis" in window);
  const [selVoice]=useGlobalVoice();
  const uttRef=useRef(null);

  const clean=t=>(t||"")
    .replace(/https?:\/\/\S+/g,"")
    .replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1")
    .replace(/`[^`]*`/g,"").replace(/[#◎◈◇✦⬡↗⟶→←►▶]/g,"")
    .replace(/---+/g,". ").replace(/\s{2,}/g," ").trim();

  // Get accent-appropriate rate/pitch so voices actually sound different
  const getVoiceParams=(v)=>{
    if(!v) return {rate:0.93,pitch:1.0};
    const lang=(v.lang||"").toLowerCase();
    const name=(v.name||"").toLowerCase();
    if(lang.startsWith("en-gb")||name.includes("british")||name.includes("daniel")||name.includes("kate"))
      return {rate:0.90, pitch:0.95}; // British: slightly slower, lower pitch
    if(lang.startsWith("en-au")||name.includes("australia")||name.includes("karen"))
      return {rate:0.95, pitch:1.05}; // Australian: slightly faster, higher
    if(lang.startsWith("en-in")||name.includes("india")||name.includes("ravi")||name.includes("heera"))
      return {rate:0.88, pitch:1.10}; // Indian: slower, higher pitch
    if(name.includes("natural")||name.includes("neural"))
      return {rate:0.96, pitch:1.0}; // Neural voices: slightly faster
    return {rate:0.93, pitch:1.0}; // Default American
  };

  const stop=()=>{window.speechSynthesis.cancel();setState("idle");uttRef.current=null;};
  const pause=()=>{if(window.speechSynthesis.speaking){window.speechSynthesis.pause();setState("paused");}};
  const play=()=>{
    if(!supported) return;
    if(state==="paused"&&uttRef.current){window.speechSynthesis.resume();setState("playing");return;}
    window.speechSynthesis.cancel();
    const t=clean(text);if(!t) return;

    const speakNow=()=>{
      // Always fetch voice fresh right before speaking — never use a stored reference
      const liveVoices=window.speechSynthesis.getVoices();
      let voiceToUse=null;
      if(selVoice){
        // Match by name — most reliable across all browsers including Android
        voiceToUse=liveVoices.find(v=>v.name===selVoice.name)||null;
      }
      if(!voiceToUse){
        // Fallback: best available English voice
        voiceToUse=
          liveVoices.find(v=>v.name.includes("Natural"))||
          liveVoices.find(v=>v.name.includes("Google")&&v.lang==="en-US")||
          liveVoices.find(v=>v.lang==="en-US")||
          liveVoices.find(v=>v.lang.startsWith("en"))||
          liveVoices[0]||null;
      }
      const u=new SpeechSynthesisUtterance(t);
      const {rate,pitch}=getVoiceParams(voiceToUse);
      u.rate=rate;u.pitch=pitch;u.volume=1;
      if(voiceToUse){u.voice=voiceToUse;u.lang=voiceToUse.lang;}
      u.onstart=()=>setState("playing");
      u.onend=()=>{setState("idle");uttRef.current=null;};
      u.onerror=(e)=>{
        // On Android, if utterance errors, retry once without a specific voice
        if(e.error==="not-allowed"||e.error==="canceled") return;
        if(voiceToUse){
          // Retry with no voice set (browser default)
          const u2=new SpeechSynthesisUtterance(t);
          const {rate:r2,pitch:p2}=getVoiceParams(null);
          u2.rate=r2;u2.pitch=p2;u2.volume=1;
          u2.onstart=()=>setState("playing");
          u2.onend=()=>{setState("idle");uttRef.current=null;};
          u2.onerror=()=>{setState("idle");uttRef.current=null;};
          uttRef.current=u2;
          window.speechSynthesis.speak(u2);
        } else {setState("idle");uttRef.current=null;}
      };
      uttRef.current=u;
      window.speechSynthesis.speak(u);
    };

    // Chrome Android needs 120ms after cancel() before speak() fires reliably
    const isMobile=/Android|iPhone|iPad/i.test(typeof navigator!=="undefined"?navigator.userAgent:"");
    setTimeout(speakNow, isMobile?150:60);
  };
  useEffect(()=>()=>{if(typeof window!=="undefined")window.speechSynthesis.cancel();},[]);
  if(!supported) return(
    <div style={{padding:"10px 14px",background:"rgba(255,255,255,0.03)",
      border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,fontSize:12,
      color:"rgba(232,220,200,0.4)",textAlign:"center"}}>
      🔊 Audio read-aloud not supported in this browser — try Chrome for this feature
    </div>
  );

  if(mini){
    return(
      <button onClick={state==="playing"?stop:play}
        title={state==="playing"?"Stop":"Listen"}
        style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:24,borderRadius:"50%",background:state!=="idle"?"rgba(210,175,90,0.12)":"none",border:`1.5px solid ${state!=="idle"?"rgba(210,175,90,0.5)":"rgba(255,255,255,0.1)"}`,cursor:"pointer",fontSize:11,marginTop:6,color:state!=="idle"?"var(--gold)":"rgba(255,255,255,0.25)",transition:"all .2s",flexShrink:0}}>
        {state==="playing"?"⏹":"🔊"}
      </button>
    );
  }
  return(
    <div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:8,flexWrap:"wrap"}}>
      {state==="idle"&&(
        <button onClick={play} style={{display:"inline-flex",alignItems:"center",gap:7,background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"6px 14px",color:"rgba(255,255,255,0.45)",fontSize:12,cursor:"pointer",transition:"all .2s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--gold)";e.currentTarget.style.color="var(--gold)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";e.currentTarget.style.color="rgba(255,255,255,0.45)";}}>
          🔊 {label}
        </button>
      )}
      {state==="playing"&&(
        <div style={{display:"inline-flex",alignItems:"center",gap:5}}>
          <button onClick={pause} style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(210,175,90,0.1)",border:"1px solid rgba(210,175,90,0.4)",borderRadius:20,padding:"6px 14px",color:"var(--gold)",fontSize:12,cursor:"pointer"}}>⏸ Pause</button>
          <button onClick={stop} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"6px 12px",color:"rgba(255,255,255,0.3)",fontSize:12,cursor:"pointer"}}>⏹</button>
          <span style={{display:"inline-flex",gap:2,alignItems:"center"}}>{[0,1,2].map(i=><span key={i} style={{display:"inline-block",width:2,borderRadius:2,background:"var(--gold)",height:i===1?13:8,animation:`tdot 1.1s ease-in-out ${i*0.18}s infinite`}}/>)}</span>
        </div>
      )}
      {state==="paused"&&(
        <div style={{display:"inline-flex",alignItems:"center",gap:5}}>
          <button onClick={play} style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(20,184,154,0.08)",border:"1px solid rgba(20,184,154,0.35)",borderRadius:20,padding:"6px 14px",color:"var(--teal)",fontSize:12,cursor:"pointer"}}>▶ Resume</button>
          <button onClick={stop} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"6px 12px",color:"rgba(255,255,255,0.3)",fontSize:12,cursor:"pointer"}}>⏹</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE INPUT — Textarea with microphone dictation (Web Speech API)
// Falls back to a plain textarea if SpeechRecognition isn't supported.
// ═══════════════════════════════════════════════════════════════════════════════
function VoiceInput({value,onChange,rows=4,maxLength=600,placeholder=""}){
  const [listening,setListening]=useState(false);
  const [supported,setSupported]=useState(false);
  const recogRef=useRef(null);
  const baseTextRef=useRef(""); // text already in the box before this dictation session

  useEffect(()=>{
    const SR=typeof window!=="undefined"&&(window.SpeechRecognition||window.webkitSpeechRecognition);
    setSupported(!!SR);
  },[]);

  const stopListening=()=>{
    if(recogRef.current){
      try{ recogRef.current.stop(); }catch{}
      recogRef.current=null;
    }
    setListening(false);
  };

  const startListening=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR) return;
    if(listening){ stopListening(); return; }

    const recog=new SR();
    recog.lang="en-US";
    recog.continuous=true;
    recog.interimResults=true;

    baseTextRef.current=value||"";

    recog.onresult=(e)=>{
      let finalTranscript="";
      let interimTranscript="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const transcript=e.results[i][0].transcript;
        if(e.results[i].isFinal) finalTranscript+=transcript;
        else interimTranscript+=transcript;
      }
      const base=baseTextRef.current;
      const sep=base&&!base.endsWith(" ")&&!base.endsWith("\n")?" ":"";
      let combined=base+(finalTranscript?sep+finalTranscript:"")+(interimTranscript?(base||finalTranscript?" ":"")+interimTranscript:"");
      if(finalTranscript) baseTextRef.current=base+sep+finalTranscript;
      combined=combined.slice(0,maxLength);
      onChange({target:{value:combined}});
    };

    recog.onerror=()=>stopListening();
    recog.onend=()=>setListening(false);

    recogRef.current=recog;
    try{
      recog.start();
      setListening(true);
    }catch{
      setListening(false);
    }
  };

  useEffect(()=>()=>{ if(recogRef.current){ try{recogRef.current.stop();}catch{} } },[]);

  return(
    <div style={{position:"relative"}}>
      <textarea
        value={value}
        onChange={onChange}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        style={{
          width:"100%",
          background:"var(--midnight)",
          border:listening?"1px solid var(--gold)":"1px solid var(--cream-15)",
          borderRadius:12,
          padding:"14px 16px",
          paddingRight:supported?48:16,
          color:"var(--cream)",
          fontSize:14,
          lineHeight:1.6,
          outline:"none",
          resize:"vertical",
          fontFamily:"var(--f-body)",
          boxSizing:"border-box",
          transition:"border-color .2s",
        }}
      />
      {supported&&(
        <button
          type="button"
          onClick={startListening}
          title={listening?"Stop dictation":"Speak instead of typing"}
          style={{
            position:"absolute",
            right:10,
            bottom:10,
            width:32,
            height:32,
            borderRadius:"50%",
            border:listening?"1px solid var(--gold)":"1px solid var(--cream-15)",
            background:listening?"var(--gold)":"var(--lift)",
            color:listening?"#000":"var(--cream-50)",
            fontSize:14,
            cursor:"pointer",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            transition:"all .2s",
            animation:listening?"pulse 1.4s ease-in-out infinite":"none",
          }}
        >
          🎤
        </button>
      )}
      {listening&&(
        <div style={{position:"absolute",right:48,bottom:14,fontSize:10,color:"var(--gold)",fontFamily:"var(--f-mono)",letterSpacing:".05em"}}>
          Listening…
        </div>
      )}
    </div>
  );
}


// ─── MODULE REGENERATE HELPER ─────────────────────────────────────────────────
// Detects the correct local currency from the user's country name.
function getLocalCurrency(country){
  if(!country) return {code:"USD",symbol:"$"};
  const c=(country||"").toLowerCase();
  if(c.includes("ghana"))        return {code:"GHS",symbol:"GH₵"};
  if(c.includes("nigeria"))      return {code:"NGN",symbol:"₦"};
  if(c.includes("kenya"))        return {code:"KES",symbol:"KSh"};
  if(c.includes("south africa")) return {code:"ZAR",symbol:"R"};
  if(c.includes("rwanda"))       return {code:"RWF",symbol:"RWF"};
  if(c.includes("uganda"))       return {code:"UGX",symbol:"USh"};
  if(c.includes("tanzania"))     return {code:"TZS",symbol:"TSh"};
  if(c.includes("zambia"))       return {code:"ZMW",symbol:"ZK"};
  if(c.includes("ethiopia"))     return {code:"ETB",symbol:"Birr"};
  if(c.includes("egypt"))        return {code:"EGP",symbol:"E£"};
  if(c.includes("morocco"))      return {code:"MAD",symbol:"MAD"};
  if(c.includes("senegal")||c.includes("côte")||c.includes("mali")||c.includes("burkina")||c.includes("togo")||c.includes("benin")) return {code:"XOF",symbol:"CFA"};
  if(c.includes("united kingdom")||c.includes("uk")) return {code:"GBP",symbol:"£"};
  if(c.includes("europe")||c.includes("france")||c.includes("germany")||c.includes("spain")||c.includes("italy")||c.includes("netherlands")||c.includes("portugal")||c.includes("belgium")) return {code:"EUR",symbol:"€"};
  if(c.includes("india"))        return {code:"INR",symbol:"₹"};
  if(c.includes("pakistan"))     return {code:"PKR",symbol:"₨"};
  if(c.includes("bangladesh"))   return {code:"BDT",symbol:"৳"};
  if(c.includes("philippines"))  return {code:"PHP",symbol:"₱"};
  if(c.includes("indonesia"))    return {code:"IDR",symbol:"Rp"};
  if(c.includes("vietnam"))      return {code:"VND",symbol:"₫"};
  if(c.includes("brazil"))       return {code:"BRL",symbol:"R$"};
  if(c.includes("mexico"))       return {code:"MXN",symbol:"MX$"};
  if(c.includes("canada"))       return {code:"CAD",symbol:"C$"};
  if(c.includes("australia"))    return {code:"AUD",symbol:"A$"};
  if(c.includes("japan"))        return {code:"JPY",symbol:"¥"};
  if(c.includes("china"))        return {code:"CNY",symbol:"¥"};
  if(c.includes("uae")||c.includes("dubai")||c.includes("emirates")) return {code:"AED",symbol:"AED"};
  if(c.includes("saudi"))        return {code:"SAR",symbol:"SAR"};
  return {code:"USD",symbol:"$"}; // default
}

async function regenerateModule(key, profile, userId, isPremium, setData, setLoading, setErr){
  setLoading(true); setErr("");
  // Build full profile context from ALL onboarding fields
  const country  = profile?.country  || "their country";
  const skills   = profile?.skills   || "general";
  const goals    = profile?.goals || profile?.bigGoal || "success";
  const name     = profile?.name     || "the user";
  const income   = profile?.income   || "Under $500";
  const profileCtx = buildProfileContext(profile);
  const challenge= profile?.challenge|| "getting started";
  // Resolve local currency — MUST happen before currencyNote is built
  const {code:currCode, symbol:currSym} = getLocalCurrency(country);
  const currencyNote = `MANDATORY CURRENCY RULES:
COSTS/STARTUP/SAVINGS = LOCAL CURRENCY: ${country} uses ${currCode} (${currSym}). All prices, startup costs, rents, savings must be in ${currSym}. NEVER use $ for costs in ${country}.
EARNINGS FROM ONLINE WORK = USD only — add local equivalent in brackets e.g. "$800/month (${currSym}12,000)".`;
  const dayIndex=Math.floor(Date.now()/(1000*60*60*24))%5;
  const platformSets=["Upwork and Fiverr","Appen and Remotasks","Preply and Cambly","Rev.com and TranscribeMe","UserTesting and Prolific"];
  const todayPlatforms=platformSets[dayIndex];

  const prompts={
    life_hacks:`${currencyNote}

Generate 7 REAL life hacks for ${name} living in ${country} earning ${income} with goal "${goals}".

WHAT A REAL LIFE HACK IS:
- A specific shortcut that saves real time or real money
- Something that uses local knowledge — real markets, real apps, real USSD codes, real WhatsApp groups
- Something the person hasn't thought of — not "save money" but exactly HOW
- Must include a real local detail: name of market, app, bank, platform, service, or code

WHAT A LIFE HACK IS NOT:
- Generic advice like "wake up early" or "be disciplined"
- Motivational statements
- Things they already know

CATEGORIES TO COVER (one hack per category):
1. MONEY: A specific way to save or earn extra money in ${country}. Include a real amount in ${currSym}.
2. FOOD/FUEL: How to spend less on daily essentials in ${country}. Name real markets or methods.
3. TIME: A system or tool that saves 1+ hours per week. Name the exact app or method.
4. PHONE/DATA: A USSD code, app, or phone trick that works in ${country} and most people don't know.
5. HEALTH: One free or almost free health habit that fits a busy life in ${country}.
6. SKILL: The fastest way to learn something valuable using free resources — name the specific platform.
7. NETWORK: A specific place or method to meet better people in ${country}. Name real venues, groups, or events.

Return ONLY a valid JSON array of 7 strings. Each string = 2-3 sentences. Start with the category in caps. No markdown. No code fences.`,
    emotional_strength:`${currencyNote}

Write 4 emotional strength practices for ${name} facing: "${challenge}". Each must be specific not generic. Include WHEN, HOW, and WHY for their specific situation. Return ONLY a JSON array of 4 strings (each 2-3 sentences).`,
    money_protection:`${currencyNote}

Create money protection plan for ${name} in ${country} earning ${income}. ${currencyNote} Return ONLY JSON: {"rule":"The ONE most important money rule specific to ${country} at this income","savings_target":"Exact monthly savings in local currency with specific bank or method in ${country}","avoid":"Top 3 money drains people at this income in ${country} fall into — name them","first_investment":"First real investment in ${country} — name the specific product bank or platform"}`,
    online_income:`${currencyNote}

Give ${name} in ${country} with skills "${skills}" exactly 3 ways to make money online. TODAY focus on: ${todayPlatforms}. Check payment accessibility from ${country}. Return ONLY JSON array: [{"method":"Platform or method name","why_it_works":"Why this works for someone in ${country} with these skills — 2 sentences","url":"https://exact-real-url.com","first_step":"Specific action doable in 48 hours","earnings":"$X-Y per month for beginners","local_equivalent":"Same in ${country} local currency"}]`,
    zero_income_business:`${currencyNote}

Generate business ideas for ${name} in ${country} that need zero capital. Think about daily needs in ${country}: food, drinks, transport, mobile data, cleaning, laundry, hair, barbering, phone repair, clothing, event services. Also bars and food joints. ${currencyNote} Return ONLY JSON: {"idea":"Best zero-capital idea for ${country}","why_zero":"Why zero capital needed","day_one":"Exact Day 1 action in ${country}","first_revenue":"When and how much in local currency","scale":"How to grow to employ others","alternatives":["5 more zero-capital ideas for ${country} covering food/drinks, services, trading, digital, creative"]}`,
    product_business:`${currencyNote}

Give 4 physical product business ideas for ${name} in ${country}. Focus on what people in ${country} buy daily or weekly. Include fashion, food/drinks, electronics accessories, and household items. ${currencyNote} Return ONLY JSON array: [{"product":"Product name","why":"Why this sells in ${country} — specific demand","startup_cost":"Cost in local currency","profit_margin":"Realistic margin percent","supplier_links":["https://www.alibaba.com","https://www.dhgate.com"]}]`,
    real_estate_hack:`${currencyNote}

How can ${name} in ${country} earn from real estate with little money? Cover: property listing agent earning commission, short-let management, property finding service, rental arbitrage. Name real platforms in ${country}. ${currencyNote} Return ONLY JSON: {"method":"Best method for ${country}","how_it_works":"Step by step","platform":"Real platform or channel in ${country}","first_deal":"How to get first deal with specific steps and local currency amounts"}`,
  };

  const sys="Return ONLY valid JSON. No markdown. No code fences. No explanation. Start with { or [.";
  try{
    const raw=await callAPI({messages:[{role:"user",content:prompts[key]}],system:sys,userId,isPremium:true});
    const clean=raw.replace(/```json|```/g,"").trim();
    const s=clean[0]==="["?clean.indexOf("["):clean.indexOf("{");
    const e=clean[0]==="["?clean.lastIndexOf("]"):clean.lastIndexOf("}");
    const parsed=JSON.parse(s>=0?clean.slice(s,e+1):clean);
    setData(parsed);setErr("");
  }catch(e){
    const msg = e?.message||"";
    if(msg.toLowerCase().includes("credit")||msg.toLowerCase().includes("billing")){
      setErr("⚠️ AI credits needed. Go to console.anthropic.com → Billing to add credits.");
    } else {
      setErr("Couldn't generate right now. Tap retry.");
    }
  }
  setLoading(false);
}


function ModuleShell({title,color="var(--gold)",audioText,children,onRegen,loading,err,isPaid,onUnlock}){
  const handleRegen=()=>{
    if(!isPaid){ onUnlock&&onUnlock(); return; }
    onRegen&&onRegen();
  };
  return(
    <div className="card" style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div className="mono" style={{fontSize:"9px",color}}>{title}</div>
          {audioText&&<AudioPlayer text={audioText} label="" mini={true}/>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {audioText&&<AudioPlayer text={audioText} label="Listen"/>}
          <button onClick={handleRegen} disabled={loading}
            title={isPaid?"Get a new set":"Upgrade to refresh with new ideas"}
            style={{fontSize:10,padding:"4px 10px",borderRadius:20,border:"1px solid rgba(255,255,255,0.12)",background:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontFamily:"var(--f-mono)",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>
            {loading?"…":isPaid?"↺ Refresh":<>🔒 Refresh</>}
          </button>
        </div>
      </div>
      {err&&<div className="err-box" style={{marginBottom:10}}>⚠ {err} <button onClick={handleRegen} style={{marginLeft:8,background:"none",border:"none",color:"var(--gold)",cursor:"pointer",fontSize:11}}>Retry</button></div>}
      {loading&&<div style={{textAlign:"center",padding:"24px 0"}}><div style={{width:28,height:28,border:"2.5px solid rgba(255,255,255,0.08)",borderTop:"2.5px solid var(--gold)",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 10px"}}/><p style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Building your {title.toLowerCase()}…</p></div>}
      {!loading&&children}
    </div>
  );
}

function LifeHacksModule({data,formData,userId,isPremium,isPaid,onUnlock}){
  const [hacks,setHacks]=useState(Array.isArray(data?.life_hacks)?data.life_hacks:[]);
  const [emotional,setEmotional]=useState(Array.isArray(data?.emotional_strength)?data.emotional_strength:[]);
  const [lLoading,setLLoading]=useState(false);[{},()=>{}];
  const [eLoading,setELoading]=useState(false);
  const [lErr,setLErr]=useState("");
  const [eErr,setEErr]=useState("");
  useEffect(()=>{
    const h=Array.isArray(data?.life_hacks)?data.life_hacks:[];
    const e=Array.isArray(data?.emotional_strength)?data.emotional_strength:[];
    setHacks(h);
    setEmotional(e);
    if(!h.length && formData) setTimeout(()=>regenerateModule("life_hacks",formData,userId,isPremium,setHacks,setLLoading,setLErr),300);
    if(!e.length && formData) setTimeout(()=>regenerateModule("emotional_strength",formData,userId,isPremium,setEmotional,setELoading,setEErr),1800);
  },[]);

  return(
    <div className="fu">
      <ModuleShell title="LIFE HACKS" color="var(--gold)" audioText={hacks.length?hacks.join(". "):""} onRegen={()=>regenerateModule("life_hacks",formData,userId,isPremium,setHacks,setLLoading,setLErr)} loading={lLoading} err={lErr} isPaid={isPaid} onUnlock={onUnlock}>
        {hacks.length===0&&!lLoading&&<p style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>Tap <b style={{color:"var(--gold)"}}>↺ Refresh</b> to generate your personalised life hacks.</p>}
        {hacks.map((h,i)=>{
          const colonIdx=h.indexOf(":");
          const hasCategory=colonIdx>0&&colonIdx<18;
          const category=hasCategory?h.slice(0,colonIdx).trim():null;
          const body=hasCategory?h.slice(colonIdx+1).trim():h;
          const catColors={"MONEY":"var(--gold)","FOOD":"var(--teal)","FOOD/FUEL":"var(--teal)","TIME":"#9b72cf","PHONE":"var(--rose)","PHONE/DATA":"var(--rose)","HEALTH":"#4ADE80","SKILL":"var(--teal)","NETWORK":"var(--gold)"};
          const catColor=(category&&catColors[category])||"var(--gold)";
          return(
            <div key={i} style={{padding:"13px 16px",marginBottom:10,background:"var(--midnight)",borderRadius:12,border:`1px solid ${catColor}20`}}>
              {category&&<div style={{fontSize:9,fontFamily:"var(--f-mono)",color:catColor,letterSpacing:".12em",marginBottom:7,display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:catColor}}/>
                {category}
              </div>}
              <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                <p style={{fontSize:13,color:"rgba(255,255,255,0.72)",lineHeight:1.8,margin:0,flex:1}}>{body}</p>
                <AudioPlayer text={body} label="" mini={true}/>
              </div>
            </div>
          );
        })}
      </ModuleShell>
      <ModuleShell title="EMOTIONAL STRENGTH" color="var(--teal)" audioText={emotional.length?emotional.join(". "):""} onRegen={()=>regenerateModule("emotional_strength",formData,userId,isPremium,setEmotional,setELoading,setEErr)} loading={eLoading} err={eErr} isPaid={isPaid} onUnlock={onUnlock}>
        {emotional.length===0&&!eLoading&&<p style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>Tap <b style={{color:"var(--teal)"}}>↺ Refresh</b> to generate emotional strength practices.</p>}
        {emotional.map((e,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:i<emotional.length-1?"1px solid rgba(255,255,255,0.05)":"none",alignItems:"flex-start"}}>
            <span style={{fontSize:18,flexShrink:0}}>🧘</span>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.7,margin:0,flex:1}}>{e}</p>
            <AudioPlayer text={e} label="" mini={true}/>
          </div>
        ))}
      </ModuleShell>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// JIM ROHN FINANCIAL WISDOM
// "Profits are better than wages. Wages make you a living. Profits make you a fortune."
// ═══════════════════════════════════════════════════════════════════════════════

const JIM_ROHN_PRINCIPLES = [
  {
    id:"7030",
    icon:"💰",
    color:"var(--gold)",
    title:"The 70/30 Rule — Jim Rohn's Master Money Formula",
    quote:"Learn to live on 70% of what you make and do something important with the other 30%.",
    body:"This is the foundation of everything Jim Rohn taught about money. It is deceptively simple and almost universally ignored. Of every dollar or cedi or naira that comes into your hands: 70% covers your life — rent, food, transport, clothing, and your cost of living. The remaining 30% is split three ways. Ten percent goes to charity or giving — not because it makes you feel good, but because generosity is a discipline that keeps you from becoming someone who hoards and fears. Ten percent goes to active capital — money you put to work through a business, a skill investment, or a learning fund. Ten percent goes to passive savings — a wealth account you never touch, that grows silently while you sleep. The key word is 'learn.' You may not be able to do this today. Start at 1%. Then 3%. Then 5%. The discipline matters more than the percentage.",
    steps:[
      "70% — your cost of living: rent, food, transport, utilities, phone. Track this for 30 days first.",
      "10% — giving: church, family in need, someone who needs a meal. This is non-negotiable for Rohn.",
      "10% — active capital: money that WORKS. A skill course. Starting your side hustle. Buying stock in a company you understand.",
      "10% — passive savings: open a separate account. Name it 'Wealth Account'. Never withdraw from it. Ever.",
    ],
    application:"If you earn GH₵2,000/month: GH₵1,400 is your life budget. GH₵200 goes to giving. GH₵200 goes to a skill or micro-business. GH₵200 goes into your wealth account. In 12 months you'll have GH₵2,400 saved and a skill or business that generates more.",
  },
  {
    id:"profits",
    icon:"📈",
    color:"var(--teal)",
    title:"Profits Are Better Than Wages",
    quote:"Wages make you a living. Profits make you a fortune.",
    body:"This was the idea that changed Jim Rohn's life at age 25, when his mentor Earl Shoaff first said it to him. A wage is what someone gives you for your time. A profit is what you earn because you created value beyond your own labor. The difference is not just financial — it is psychological. A wage-earner asks 'how much am I worth per hour?' A profit-earner asks 'how much value can I create?' Wages have a ceiling set by someone else. Profits have a ceiling set by your creativity, your market, and your execution. This does not mean quit your job tomorrow. It means start building something alongside your job — anything — that generates profit rather than just a paycheck. A small business. A skill you sell. A product. A course. Something that pays you whether you show up or not.",
    steps:[
      "Keep your job (wages) — it funds your life while you build your profits.",
      "Start a micro-business alongside it — even GH₵50/month profit is the beginning of a different identity.",
      "Reinvest every profit back into the business for the first 12 months. Do not spend what the business makes.",
      "When profits equal 50% of your wages, you have options. That is the target.",
    ],
    application:"Rohn said: 'Work full-time on your job and part-time on your fortune.' Most people do it the other way around — they give their employer their best hours and their business their worst.",
  },
  {
    id:"philosophy",
    icon:"🧠",
    color:"#9b72cf",
    title:"Your Money Philosophy Determines Your Financial Future",
    quote:"The philosophy of the rich versus the poor is this: the rich invest their money and spend what is left. The poor spend their money and invest what is left.",
    body:"Jim Rohn believed that financial results were a direct consequence of financial philosophy — not income, not opportunity, not luck. Two people can earn the same salary and in 10 years be in completely different positions, because one paid themselves first and one spent first. This is not a budgeting tip. It is a statement about identity and belief. If you believe money is meant to be spent when you have it, you will always spend it. If you believe money is a tool to build with, you will always build with it. The first step is not opening a savings account — it is changing what you believe money is for.",
    steps:[
      "Write down your current money philosophy in one sentence — what do you actually believe money is for?",
      "Read it back and ask: does this philosophy make people rich or keep people poor?",
      "Decide on a new philosophy. Rohn's: 'I invest first, then live on what remains.'",
      "Build one habit that matches the new philosophy — automate a transfer of any amount on payday. Even 2%.",
    ],
    application:"Rohn used to say: 'If you keep doing what you've always done, you'll keep getting what you've always got.' The philosophy changes first. The results follow.",
  },
  {
    id:"amount",
    icon:"⚡",
    color:"var(--rose)",
    title:"It Is Not the Amount — It Is the Habit",
    quote:"It's not the amount that counts, it's the plan that counts. It's not what you save but that you save.",
    body:"One of the most damaging financial beliefs is: 'I don't earn enough to save.' Jim Rohn destroyed this belief with one argument: if you cannot save out of GH₵500, you cannot save out of GH₵5,000. The problem is not the amount — it is the absence of a saving habit. A person who saves GH₵10 a month consistently is building something more important than money: they are building the identity of someone who saves. And that identity, once real, will apply at every income level. The amount will grow as the income grows, because the habit is already there. The person who doesn't save GH₵10 at GH₵500 will not save GH₵500 at GH₵5,000. The habit must be built now, at whatever level you are at.",
    steps:[
      "Start with any amount — GH₵5, ₦500, KSh 100. The number does not matter yet.",
      "Save it on the day you receive income — not after expenses. Before anything else.",
      "Keep a visible record of what you've saved. Watch the number. Celebrate it.",
      "Increase the amount by any small percentage every 3 months. 5% more than last time.",
    ],
    application:"'A little bit saved regularly beats a large amount saved irregularly.' Set up an automatic transfer for the day after payday — any amount. You will not miss it. You will build it.",
  },
  {
    id:"seasons",
    icon:"🌱",
    color:"var(--teal)",
    title:"The Seasons of Financial Life",
    quote:"Winter always follows summer. The person who didn't prepare in summer is in serious trouble in winter.",
    body:"Jim Rohn applied the four seasons to money. Spring is when opportunity is fresh — you are young, energy is high, income potential is growing. This is the time to plant: build skills, build businesses, build savings, build the habits that will define your financial life. Summer is when you maintain what you built in spring — not the time to relax, but to tend and guard. Fall is when you harvest — the compounding of earlier decisions begins to pay off. And then winter comes. Financial winter: a job loss, a recession, a health crisis, an unexpected expense. The question Rohn asked is: 'What did you do in the summer?' The person who saved and invested in the spring and summer survives financial winter. The person who spent everything does not.",
    steps:[
      "Identify your current season honestly — which one are you in?",
      "If you are in Spring: plant aggressively. Every month without a habit is a month wasted.",
      "If you are in Summer: guard your progress. Do not increase lifestyle faster than income.",
      "If you are in Fall: harvest AND reinvest. Do not spend the entire harvest.",
      "If you are in Winter: hold steady. Do not panic. Cut expenses. Survive. Spring comes.",
    ],
    application:"Most people never prepare for winter because they feel invincible in summer. Every financial mistake Rohn described was made by people who thought summer would last forever.",
  },
];

const JIM_ROHN_BOOKS = [
  {label:"The Art of Exceptional Living — Jim Rohn (audiobook)",url:"https://www.amazon.com/Art-Exceptional-Living-Jim-Rohn/dp/B00005A5ZB",emoji:"📖"},
  {label:"7 Strategies for Wealth & Happiness — Jim Rohn",url:"https://www.amazon.com/Strategies-Wealth-Happiness-Jim-Rohn/dp/0761511148",emoji:"📖"},
  {label:"Leading an Inspired Life — Jim Rohn",url:"https://www.amazon.com/Leading-Inspired-Life-Jim-Rohn/dp/0940685221",emoji:"📖"},
  {label:"Jim Rohn — The Day That Turns Your Life Around (YouTube, free)",url:"https://www.youtube.com/results?search_query=jim+rohn+the+day+that+turns+your+life+around",emoji:"🎧"},
  {label:"Jim Rohn — How to Have Your Best Year Ever (YouTube, free)",url:"https://www.youtube.com/results?search_query=jim+rohn+best+year+ever+full+seminar",emoji:"🎧"},
  {label:"Jim Rohn — Building Your Network Marketing Business (full, free)",url:"https://www.youtube.com/results?search_query=jim+rohn+building+your+network+marketing+business+full",emoji:"🎧"},
  {label:"The Seasons of Life (PDF summary) — Jim Rohn",url:"https://www.jimrohn.com",emoji:"🌐"},
];

function JimRohnMoneySection(){
  const [expanded, setExpanded] = useState(false);
  return(
    <div style={{marginTop:20,marginBottom:8,background:"linear-gradient(135deg,rgba(210,175,90,0.06),rgba(155,114,207,0.03))",border:"1px solid rgba(210,175,90,0.2)",borderRadius:18}}>
      {/* Header — always visible */}
      <div style={{padding:"18px 20px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{fontSize:22}}>📜</div>
          <div>
            <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".14em",marginBottom:3}}>FINANCIAL PHILOSOPHY</div>
            <div style={{fontSize:16,fontWeight:700,color:"var(--cream)"}}>Jim Rohn on Money</div>
          </div>
        </div>
        <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.7,margin:"0 0 14px 0"}}>
          Broke at 25. Millionaire at 31. He spent 40 years explaining exactly what changed and why.
          These are the 5 rules that made the difference.
        </p>

        {/* 5 KEY QUOTES — always visible, no accordion needed */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {JIM_ROHN_PRINCIPLES.map((p,i)=>(
            <div key={p.id} style={{padding:"12px 14px",background:"rgba(0,0,0,0.2)",borderRadius:12,borderLeft:`3px solid ${p.color}`}}>
              <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:p.color,letterSpacing:".1em",marginBottom:5}}>{p.icon} {p.title.toUpperCase()}</div>
              <p style={{fontSize:13,color:"var(--cream)",fontStyle:"italic",lineHeight:1.65,margin:"0 0 6px 0"}}>&ldquo;{p.quote}&rdquo;</p>
              {expanded&&p.steps?.length>0&&<p style={{fontSize:12,color:"var(--cream-50)",lineHeight:1.7,margin:"6px 0 0 0"}}>{p.steps[0]}</p>}
            </div>
          ))}
        </div>

        <button onClick={()=>setExpanded(e=>!e)}
          style={{width:"100%",marginTop:12,padding:"10px",background:"rgba(210,175,90,0.08)",border:"1px solid rgba(210,175,90,0.2)",borderRadius:10,color:"var(--gold)",fontSize:12,fontFamily:"var(--f-mono)",cursor:"pointer",letterSpacing:".05em"}}>
          {expanded?"▲ Show less":"▼ Show step-by-step application for each"}
        </button>
      </div>

      {/* Principles */}
      <div style={{border:"1px solid rgba(210,175,90,0.15)",borderTop:"none",borderRadius:"0 0 18px 18px",overflow:"hidden"}}>
        {JIM_ROHN_PRINCIPLES.map((p,i)=>{
          const isOpen = open===p.id;
          return(
            <div key={p.id} style={{borderBottom:i<JIM_ROHN_PRINCIPLES.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
              {/* Header row */}
              <button onClick={()=>setOpen(o=>o===p.id?null:p.id)}
                style={{width:"100%",background:isOpen?`${p.color}06`:"none",border:"none",padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left",transition:"background .2s"}}>
                <div style={{width:38,height:38,borderRadius:10,background:`${p.color}10`,border:`1px solid ${p.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {p.icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:isOpen?p.color:"var(--cream)",lineHeight:1.35,marginBottom:3}}>{p.title}</div>
                  <div style={{fontSize:11,color:"var(--cream-30)",fontStyle:"italic",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    &ldquo;{p.quote.slice(0,70)}{p.quote.length>70?"…":""}&rdquo;
                  </div>
                </div>
                <div style={{color:p.color,fontSize:16,flexShrink:0,transform:isOpen?"rotate(180deg)":"none",transition:"transform .25s"}}>⌄</div>
              </button>

              {/* Expanded */}
              {isOpen&&(
                <div style={{padding:"0 20px 20px",background:`${p.color}03`}}>
                  <div style={{height:1,background:"rgba(255,255,255,0.05)",marginBottom:16}}/>

                  {/* The quote */}
                  <div style={{padding:"12px 16px",background:`${p.color}08`,borderLeft:`3px solid ${p.color}`,borderRadius:"0 10px 10px 0",marginBottom:16}}>
                    <p style={{fontSize:14,fontStyle:"italic",color:"var(--cream)",lineHeight:1.75,margin:"0 0 4px 0"}}>
                      &ldquo;{p.quote}&rdquo;
                    </p>
                    <div style={{fontSize:10,color:`${p.color}`,fontFamily:"var(--f-mono)"}}>— Jim Rohn</div>
                  </div>

                  {/* Explanation */}
                  <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.85,marginBottom:16}}>{p.body}</p>

                  {/* Steps */}
                  <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:p.color,letterSpacing:".12em",marginBottom:10}}>HOW TO APPLY IT</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                    {p.steps.map((step,si)=>(
                      <div key={si} style={{display:"flex",gap:10,padding:"10px 14px",background:"var(--midnight)",borderRadius:10,border:"1px solid rgba(255,255,255,0.04)"}}>
                        <div style={{width:24,height:24,borderRadius:"50%",background:`${p.color}10`,border:`1px solid ${p.color}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"var(--f-mono)",fontSize:9,color:p.color,fontWeight:700}}>{si+1}</div>
                        <p style={{fontSize:13,color:"var(--cream-60)",margin:0,lineHeight:1.65}}>{step}</p>
                      </div>
                    ))}
                  </div>

                  {/* Real-world application */}
                  <div style={{padding:"12px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12}}>
                    <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--cream-40)",letterSpacing:".1em",marginBottom:6}}>IN YOUR CONTEXT</div>
                    <p style={{fontSize:12,color:"var(--cream-50)",lineHeight:1.7,margin:0}}>{p.application}</p>
                  </div>

                  <AudioPlayer text={`${p.title}. ${p.quote}. ${p.body}`} label="Listen to Jim Rohn" mini={false}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Books and resources */}
      <div style={{marginTop:12,padding:"14px 16px",background:"rgba(155,114,207,0.05)",border:"1px solid rgba(155,114,207,0.15)",borderRadius:14}}>
        <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"#9b72cf",letterSpacing:".12em",marginBottom:10}}>JIM ROHN — BOOKS & FREE SPEECHES</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {JIM_ROHN_BOOKS.map((lk,i)=>(
            <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--midnight)",borderRadius:8,textDecoration:"none",transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:14,flexShrink:0}}>{lk.emoji}</span>
              <span style={{fontSize:12,color:"var(--cream-60)",flex:1}}>{lk.label}</span>
              <span style={{fontSize:9,color:"#9b72cf",fontFamily:"var(--f-mono)"}}>↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// JIM ROHN TAB — Dedicated full-page financial wisdom section
// Moved to its own tab in "Make Money" so it's easy to find and not buried
// ═══════════════════════════════════════════════════════════════════════════════
function JimRohnTab({isPaid, onUnlock}){
  const [open, setOpen] = useState(null);
  const [expanded, setExpanded] = useState(false);

  return(
    <div className="fu">
      {/* Hero header */}
      <div style={{marginBottom:28,padding:"24px",background:"linear-gradient(135deg,rgba(210,175,90,0.1),rgba(155,114,207,0.05))",border:"1px solid rgba(210,175,90,0.25)",borderRadius:18}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14}}>
          <div style={{fontSize:36,flexShrink:0}}>📜</div>
          <div>
            <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".16em",marginBottom:6}}>FINANCIAL PHILOSOPHY</div>
            <div style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:800,color:"var(--cream)",lineHeight:1.25,marginBottom:8}}>Jim Rohn on Money</div>
            <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.8,margin:0}}>
              Broke at 25. Self-made millionaire at 31. He spent the next 40 years explaining exactly what changed.
              These are the 5 principles he taught over and over — because they are the ones most people never apply.
            </p>
          </div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <div style={{padding:"5px 12px",background:"rgba(210,175,90,0.1)",border:"1px solid rgba(210,175,90,0.2)",borderRadius:20,fontSize:11,color:"var(--gold)",fontFamily:"var(--f-mono)"}}>
            5 principles
          </div>
          <div style={{padding:"5px 12px",background:"rgba(31,168,154,0.08)",border:"1px solid rgba(31,168,154,0.15)",borderRadius:20,fontSize:11,color:"var(--teal)",fontFamily:"var(--f-mono)"}}>
            Step-by-step application
          </div>
          <div style={{padding:"5px 12px",background:"rgba(155,114,207,0.08)",border:"1px solid rgba(155,114,207,0.15)",borderRadius:20,fontSize:11,color:"#9b72cf",fontFamily:"var(--f-mono)"}}>
            Free books & speeches
          </div>
        </div>
      </div>

      {/* 5 Principles — full expanded cards */}
      <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:24}}>
        {JIM_ROHN_PRINCIPLES.map((p,i)=>{
          const isOpen = open===p.id;
          return(
            <div key={p.id} style={{background:"var(--lift)",borderRadius:16,border:`1px solid ${isOpen?p.color+"50":"rgba(255,255,255,0.07)"}`,overflow:"hidden",transition:"border-color .2s"}}>
              {/* Principle header — always visible */}
              <button onClick={()=>setOpen(o=>o===p.id?null:p.id)}
                style={{width:"100%",background:isOpen?`${p.color}06`:"none",border:"none",padding:"18px 20px",cursor:"pointer",display:"flex",gap:14,alignItems:"flex-start",textAlign:"left",transition:"background .2s"}}>
                <div style={{width:42,height:42,borderRadius:12,background:`${p.color}12`,border:`1px solid ${p.color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                  {p.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:p.color,letterSpacing:".1em",marginBottom:4}}>
                    PRINCIPLE {String(i+1).padStart(2,"0")}
                  </div>
                  <div style={{fontSize:15,fontWeight:700,color:isOpen?p.color:"var(--cream)",lineHeight:1.35,marginBottom:6}}>
                    {p.title}
                  </div>
                  <p style={{fontSize:12,color:"var(--cream-40)",fontStyle:"italic",margin:0,lineHeight:1.5}}>
                    &ldquo;{p.quote.length>90?p.quote.slice(0,90)+"…":p.quote}&rdquo;
                  </p>
                </div>
                <span style={{color:p.color,fontSize:18,flexShrink:0,transform:isOpen?"rotate(180deg)":"none",transition:"transform .25s",marginTop:2}}>⌄</span>
              </button>

              {/* Expanded content */}
              {isOpen&&(
                <div style={{padding:"0 20px 24px",borderTop:`1px solid ${p.color}15`}}>
                  <div style={{height:16}}/>

                  {/* The quote — prominent */}
                  <div style={{padding:"14px 18px",background:`${p.color}08`,borderLeft:`3px solid ${p.color}`,borderRadius:"0 12px 12px 0",marginBottom:18}}>
                    <p style={{fontSize:15,fontStyle:"italic",color:"var(--cream)",lineHeight:1.8,margin:"0 0 6px 0"}}>
                      &ldquo;{p.quote}&rdquo;
                    </p>
                    <div style={{fontSize:10,color:p.color,fontFamily:"var(--f-mono)",fontWeight:600}}>— Jim Rohn</div>
                  </div>

                  {/* Deep explanation */}
                  <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.9,marginBottom:18}}>{p.body}</p>

                  {/* Steps */}
                  <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:p.color,letterSpacing:".12em",marginBottom:12}}>
                    HOW TO APPLY IT — RIGHT NOW
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
                    {p.steps.map((step,si)=>(
                      <div key={si} style={{display:"flex",gap:10,padding:"11px 14px",background:"var(--midnight)",borderRadius:10,border:"1px solid rgba(255,255,255,0.04)"}}>
                        <div style={{width:26,height:26,borderRadius:"50%",background:`${p.color}10`,border:`1px solid ${p.color}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"var(--f-mono)",fontSize:10,color:p.color,fontWeight:800}}>
                          {si+1}
                        </div>
                        <p style={{fontSize:13,color:"var(--cream-60)",margin:0,lineHeight:1.7}}>{step}</p>
                      </div>
                    ))}
                  </div>

                  {/* In your context */}
                  <div style={{padding:"12px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,marginBottom:14}}>
                    <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--cream-30)",letterSpacing:".1em",marginBottom:6}}>IN YOUR CONTEXT</div>
                    <p style={{fontSize:12,color:"var(--cream-50)",lineHeight:1.75,margin:0}}>{p.application}</p>
                  </div>

                  <AudioPlayer text={`${p.title}. ${p.quote}. ${p.body.slice(0,200)}`} label="Listen" mini={false}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Books & free resources */}
      <div style={{padding:"18px",background:"rgba(155,114,207,0.05)",border:"1px solid rgba(155,114,207,0.18)",borderRadius:16}}>
        <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"#9b72cf",letterSpacing:".14em",marginBottom:14}}>
          JIM ROHN — BOOKS & FREE SPEECHES
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {JIM_ROHN_BOOKS.map((lk,i)=>(
            <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:"var(--midnight)",borderRadius:10,textDecoration:"none",transition:"opacity .15s",border:"1px solid rgba(255,255,255,0.04)"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:16,flexShrink:0}}>{lk.emoji}</span>
              <span style={{fontSize:13,color:"var(--cream-70)",flex:1,lineHeight:1.4}}>{lk.label}</span>
              <span style={{fontSize:10,color:"#9b72cf",fontFamily:"var(--f-mono)",flexShrink:0}}>↗</span>
            </a>
          ))}
        </div>
      </div>

      {/* Bottom quote */}
      <div style={{marginTop:20,padding:"20px 24px",background:"rgba(210,175,90,0.04)",border:"1px solid rgba(210,175,90,0.15)",borderRadius:14,textAlign:"center"}}>
        <p style={{fontFamily:"var(--f-display)",fontSize:17,fontStyle:"italic",color:"var(--gold)",lineHeight:1.7,margin:"0 0 8px 0"}}>
          &ldquo;Work harder on yourself than you do on your job. If you work hard on your job you can make a living, but if you work hard on yourself you can make a fortune.&rdquo;
        </p>
        <div style={{fontSize:11,color:"var(--cream-30)",fontFamily:"var(--f-mono)"}}>— Jim Rohn</div>
      </div>
    </div>
  );
}

function MoneyModule({data,formData,userId,isPremium,isPaid,onUnlock}){
  const [mp,setMp]=useState(data?.money_protection&&typeof data.money_protection==="object"?data.money_protection:{});
  const [re,setRe]=useState(data?.real_estate_hack&&typeof data.real_estate_hack==="object"?data.real_estate_hack:{});
  const [mpL,setMpL]=useState(false);const [reL,setReL]=useState(false);
  const [mpE,setMpE]=useState("");const [reE,setReE]=useState("");
  useEffect(()=>{
    const mp0=data?.money_protection&&typeof data.money_protection==="object"?data.money_protection:{};
    const re0=data?.real_estate_hack&&typeof data.real_estate_hack==="object"?data.real_estate_hack:{};
    setMp(mp0); setRe(re0);
    if(!mp0.rule&&formData) setTimeout(()=>regenerateModule("money_protection",formData,userId,isPremium,setMp,setMpL,setMpE),300);
    if(!re0.method&&formData) setTimeout(()=>regenerateModule("real_estate_hack",formData,userId,isPremium,setRe,setReL,setReE),2500);
  },[]);
  const mpAudio=[mp.rule&&`Golden rule: ${mp.rule}`,mp.savings_target&&`Save: ${mp.savings_target}`,mp.avoid&&`Stop spending on: ${mp.avoid}`,mp.first_investment&&`First investment: ${mp.first_investment}`].filter(Boolean).join(". ");
  const reAudio=[re.method&&`Method: ${re.method}`,re.how_it_works,re.first_deal&&`First deal: ${re.first_deal}`].filter(Boolean).join(". ");
  return(
    <div className="fu">
      <ModuleShell title="PROTECT YOUR MONEY" color="var(--gold)" audioText={mpAudio} onRegen={()=>regenerateModule("money_protection",formData,userId,isPremium,setMp,setMpL,setMpE)} loading={mpL} err={mpE} isPaid={isPaid} onUnlock={onUnlock}>
        {!mp.rule&&!mpL&&<p style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>Tap <b style={{color:"var(--gold)"}}>↺ Refresh</b> to generate your money protection plan.</p>}
        {mp.rule&&(
          <>
            <div style={{padding:"13px 16px",background:"rgba(210,175,90,0.05)",borderRadius:12,marginBottom:10,border:"1px solid rgba(210,175,90,0.2)"}}>
              <div style={{fontSize:9,color:"var(--gold)",fontFamily:"var(--f-mono)",marginBottom:5}}>GOLDEN RULE</div>
              <p style={{fontSize:14,fontWeight:600,color:"var(--cream)",margin:0,lineHeight:1.6}}>{mp.rule}</p>
            </div>
            {[{l:"SAVINGS TARGET",v:mp.savings_target,c:"var(--teal)"},{l:"STOP WASTING ON",v:mp.avoid,c:"#F87171"},{l:"FIRST INVESTMENT",v:mp.first_investment,c:"var(--gold)"}].map(({l,v,c})=>v&&(
              <div key={l} style={{padding:"10px 14px",background:"var(--midnight)",borderRadius:10,marginBottom:8,borderLeft:`2px solid ${c}`}}>
                <div style={{fontSize:9,color:c,fontFamily:"var(--f-mono)",marginBottom:3}}>{l}</div>
                <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:0,lineHeight:1.6}}>{v}</p>
              </div>
            ))}
          </>
        )}
      </ModuleShell>
      <ModuleShell title="REAL ESTATE HACK" color="var(--teal)" audioText={reAudio} onRegen={()=>regenerateModule("real_estate_hack",formData,userId,isPremium,setRe,setReL,setReE)} loading={reL} err={reE} isPaid={isPaid} onUnlock={onUnlock}>
        {!re.method&&!reL&&<p style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>Tap <b style={{color:"var(--teal)"}}>↺ Refresh</b> to generate real estate income ideas for {formData?.country||"your country"}.</p>}
        {re.method&&(
          <>
            <div style={{padding:"13px 16px",background:"rgba(20,184,154,0.05)",borderRadius:12,marginBottom:10,border:"1px solid rgba(20,184,154,0.2)"}}>
              <div style={{fontSize:14,fontWeight:700,color:"var(--cream)",marginBottom:6}}>{re.method}</div>
              <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:0,lineHeight:1.6}}>{re.how_it_works}</p>
            </div>
            {re.platform&&<p style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:8}}>Platform: <span style={{color:"var(--teal)"}}>{re.platform}</span></p>}
            {re.first_deal&&<div style={{padding:"10px 14px",background:"rgba(210,175,90,0.05)",borderRadius:10,fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.6,borderLeft:"2px solid var(--gold)"}}><b style={{color:"var(--cream)"}}>First deal: </b>{re.first_deal}</div>}
          </>
        )}
      </ModuleShell>

      {/* Money tools - universal links */}
      <div style={{marginTop:4,padding:"14px 16px",background:"rgba(210,175,90,0.04)",border:"1px solid rgba(210,175,90,0.12)",borderRadius:14}}>
        <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".1em",marginBottom:10}}>MONEY TOOLS — START HERE</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {[
            {label:"YNAB — best budgeting app (You Need A Budget)",url:"https://www.youneedabudget.com",emoji:"📊"},
            {label:"Wise — send & receive money globally at low fees",url:"https://wise.com",emoji:"💸"},
            {label:"Investopedia — free financial education",url:"https://www.investopedia.com",emoji:"📚"},
            {label:"Compound interest calculator",url:"https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator",emoji:"🧮"},
            {label:"The Psychology of Money (book) — Morgan Housel",url:"https://www.amazon.com/Psychology-Money-Timeless-Lessons-Happiness/dp/0857197681",emoji:"📖"},
          ].map((lk,i)=>(
            <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--midnight)",borderRadius:8,textDecoration:"none",transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:14}}>{lk.emoji}</span>
              <span style={{fontSize:13,color:"var(--cream)",flex:1}}>{lk.label}</span>
              <span style={{fontSize:9,color:"var(--gold)",fontFamily:"var(--f-mono)"}}>↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnlineIncomeModule({data,formData,userId,isPremium,isPaid,onUnlock}){
  const [online,setOnline]=useState(Array.isArray(data?.online_income)?data.online_income:[]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  useEffect(()=>{
    const saved=Array.isArray(data?.online_income)?data.online_income:[];
    setOnline(saved);
    if(!saved.length&&formData) setTimeout(()=>regenerateModule("online_income",formData,userId,isPremium,setOnline,setLoading,setErr),300);
  },[]);
  const audioText=online.map(o=>`${o.method}: ${o.why_it_works||""}. Start today: ${o.first_step||""}`).join(". ");
  const LABELS=["BEST FIT","GOOD FIT","HIGH CEILING"];
  return(
    <div className="fu">
      <ModuleShell title={`MAKE MONEY ONLINE — ${(formData?.country||"YOUR COUNTRY").toUpperCase()}`} color="var(--gold)" audioText={audioText} onRegen={()=>regenerateModule("online_income",formData,userId,isPremium,setOnline,setLoading,setErr)} loading={loading} err={err} isPaid={isPaid} onUnlock={onUnlock}>
        {online.length===0&&!loading&&(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.3)",marginBottom:16}}>Tap <b style={{color:"var(--gold)"}}>↺ Refresh</b> to get online income methods specific to {formData?.country||"your country"} and your skills.</p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>Fresh ideas every refresh — we rotate platforms daily so you always get new options.</p>
          </div>
        )}
        {online.map((o,i)=>(
          <div key={i} style={{padding:"16px",background:"var(--midnight)",borderRadius:14,marginBottom:12,border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
              <div style={{fontSize:15,fontWeight:700,color:"var(--cream)",flex:1}}>{o.method}</div>
              <span style={{fontSize:9,color:"var(--gold)",fontFamily:"var(--f-mono)",background:"rgba(210,175,90,0.1)",border:"1px solid rgba(210,175,90,0.25)",borderRadius:6,padding:"3px 8px",flexShrink:0}}>{LABELS[i]||"OPTION"}</span>
            </div>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.65,marginBottom:10}}>{o.why_it_works}</p>
            {/* Earnings */}
            {(o.earnings||o.local_equivalent)&&(
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                {o.earnings&&<span style={{fontSize:11,color:"var(--teal)",background:"rgba(20,184,154,0.08)",border:"1px solid rgba(20,184,154,0.2)",borderRadius:6,padding:"3px 10px",fontFamily:"var(--f-mono)"}}>💵 {o.earnings}</span>}
                {o.local_equivalent&&<span style={{fontSize:11,color:"rgba(255,255,255,0.35)",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"3px 10px",fontFamily:"var(--f-mono)"}}>≈ {o.local_equivalent}</span>}
              </div>
            )}
            {o.url&&<a href={o.url.startsWith("http")?o.url:`https://${o.url}`} target="_blank" rel="noopener noreferrer" style={{display:"block",fontSize:12,color:"var(--teal)",marginBottom:10,wordBreak:"break-all"}}>🔗 {o.url}</a>}
            {o.first_step&&(
              <div style={{padding:"10px 12px",background:"rgba(20,184,154,0.04)",borderRadius:8,fontSize:13,color:"rgba(255,255,255,0.6)",borderLeft:"2px solid var(--teal)",lineHeight:1.6}}>
                <b style={{color:"var(--teal)"}}>Start in 48 hours: </b>{o.first_step}
              </div>
            )}
            <AudioPlayer text={`${o.method}: ${o.why_it_works||""}. First step: ${o.first_step||""}`} label="" mini={true}/>
          </div>
        ))}
      </ModuleShell>
    </div>
  );
}


function BusinessModule({data,formData,userId,isPremium,isPaid,onUnlock}){
  const [zb,setZb]=useState(data?.zero_income_business&&typeof data.zero_income_business==="object"?data.zero_income_business:{});
  const [pb,setPb]=useState(Array.isArray(data?.product_business)?data.product_business:[]);
  const [zbL,setZbL]=useState(false);const [pbL,setPbL]=useState(false);
  const [zbE,setZbE]=useState("");const [pbE,setPbE]=useState("");
  useEffect(()=>{
    const zb0=data?.zero_income_business&&typeof data.zero_income_business==="object"?data.zero_income_business:{};
    const pb0=Array.isArray(data?.product_business)?data.product_business:[];
    setZb(zb0); setPb(pb0);
    if(!zb0.idea&&formData) setTimeout(()=>regenerateModule("zero_income_business",formData,userId,isPremium,setZb,setZbL,setZbE),300);
    if(!pb0.length&&formData) setTimeout(()=>regenerateModule("product_business",formData,userId,isPremium,setPb,setPbL,setPbE),2500);
  },[]);
  const zbAudio=[zb.idea&&`Business idea: ${zb.idea}`,zb.why_zero,zb.day_one&&`Day one: ${zb.day_one}`,zb.first_revenue&&`First revenue: ${zb.first_revenue}`,zb.scale&&`Scale: ${zb.scale}`].filter(Boolean).join(". ");
  return(
    <div className="fu">
      {/* Business links - shown once above modules */}
      <div style={{marginBottom:16,padding:"12px 16px",background:"rgba(210,175,90,0.05)",border:"1px solid rgba(210,175,90,0.15)",borderRadius:12}}>
        <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".1em",marginBottom:10}}>SUPPLIER & PLATFORM LINKS</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {[
            {label:"Alibaba — buy wholesale products to resell",url:"https://www.alibaba.com",emoji:"🏭"},
            {label:"DHgate — small-order wholesale supplier",url:"https://www.dhgate.com",emoji:"📦"},
            {label:"Shopify — start an online store",url:"https://www.shopify.com",emoji:"🛒"},
            {label:"Jumia — sell on Africa's largest marketplace",url:"https://www.jumia.com",emoji:"🌍"},
            {label:"Paystack — accept payments in your country",url:"https://paystack.com",emoji:"💳"},
          ].map((lk,i)=>(
            <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--midnight)",borderRadius:8,textDecoration:"none",transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:14}}>{lk.emoji}</span>
              <span style={{fontSize:13,color:"var(--cream)",flex:1}}>{lk.label}</span>
              <span style={{fontSize:9,color:"var(--gold)",fontFamily:"var(--f-mono)"}}>↗</span>
            </a>
          ))}
        </div>
      </div>
      <ModuleShell title="START WITH ZERO MONEY" color="var(--gold)" audioText={zbAudio} onRegen={()=>regenerateModule("zero_income_business",formData,userId,isPremium,setZb,setZbL,setZbE)} loading={zbL} err={zbE} isPaid={isPaid} onUnlock={onUnlock}>
        {!zb.idea&&!zbL&&<p style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>Tap <b style={{color:"var(--gold)"}}>↺ Refresh</b> to generate a zero-capital business plan for {formData?.country||"your country"}.</p>}
        {zb.idea&&(
          <>
            <div style={{padding:"14px",background:"rgba(210,175,90,0.05)",borderRadius:12,marginBottom:12,border:"1px solid rgba(210,175,90,0.2)"}}>
              <div style={{fontSize:9,color:"var(--gold)",fontFamily:"var(--f-mono)",marginBottom:5}}>THE MAIN IDEA</div>
              <div style={{fontSize:15,fontWeight:700,color:"var(--cream)",marginBottom:6}}>{zb.idea}</div>
              <p style={{fontSize:13,color:"rgba(255,255,255,0.55)",margin:0,lineHeight:1.6}}>{zb.why_zero}</p>
            </div>
            {[{l:"DAY ONE ACTION",v:zb.day_one,c:"var(--teal)"},{l:"FIRST REVENUE",v:zb.first_revenue,c:"var(--gold)"},{l:"HOW TO SCALE & EMPLOY",v:zb.scale,c:"#9b72cf"}].map(({l,v,c})=>v&&(
              <div key={l} style={{padding:"10px 14px",background:"var(--midnight)",borderRadius:10,marginBottom:8,borderLeft:`2px solid ${c}`}}>
                <div style={{fontSize:9,color:c,fontFamily:"var(--f-mono)",marginBottom:3}}>{l}</div>
                <p style={{fontSize:13,color:"rgba(255,255,255,0.55)",margin:0,lineHeight:1.6}}>{v}</p>
              </div>
            ))}
            {/* More zero-capital ideas */}
            {Array.isArray(zb.alternatives)&&zb.alternatives.length>0&&(
              <div style={{marginTop:16}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",fontFamily:"var(--f-mono)",marginBottom:10,letterSpacing:".1em"}}>MORE IDEAS FOR {(formData?.country||"YOUR COUNTRY").toUpperCase()}</div>
                {zb.alternatives.map((alt,i)=>(
                  <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",background:"rgba(255,255,255,0.02)",borderRadius:8,marginBottom:6,border:"1px solid rgba(255,255,255,0.05)"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"rgba(210,175,90,0.08)",border:"1px solid rgba(210,175,90,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--gold)",flexShrink:0}}>{i+1}</div>
                    <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:0,lineHeight:1.6}}>{alt}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </ModuleShell>
      <ModuleShell title="SELL PHYSICAL PRODUCTS" color="var(--teal)" audioText={pb.length?pb.map(p=>`${p.product}: ${p.why||""}. Margin: ${p.profit_margin||""}`).join(". "):""} onRegen={()=>regenerateModule("product_business",formData,userId,isPremium,setPb,setPbL,setPbE)} loading={pbL} err={pbE} isPaid={isPaid} onUnlock={onUnlock}>
        {pb.length===0&&!pbL&&<p style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>Tap <b style={{color:"var(--teal)"}}>↺ Refresh</b> to get product business ideas with supplier links.</p>}
        {pb.map((p,i)=>(
          <div key={i} style={{padding:"13px",background:"var(--midnight)",borderRadius:12,marginBottom:12,border:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8}}>
              <div style={{fontSize:14,fontWeight:700,color:"var(--cream)"}}>{p.product}</div>
              {p.profit_margin&&<span style={{fontSize:9,color:"var(--teal)",fontFamily:"var(--f-mono)",background:"rgba(20,184,154,0.08)",borderRadius:4,padding:"2px 6px",flexShrink:0,border:"1px solid rgba(20,184,154,0.2)"}}>{p.profit_margin} margin</span>}
            </div>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginBottom:8,lineHeight:1.5}}>{p.why}</p>
            {p.startup_cost&&<div style={{fontSize:12,color:"var(--gold)",marginBottom:10}}>Startup cost: {p.startup_cost}</div>}
            {Array.isArray(p.supplier_links)&&p.supplier_links.length>0&&(
              <div>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",fontFamily:"var(--f-mono)",marginBottom:6}}>SUPPLIER LINKS</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {p.supplier_links.filter(l=>l).map((link,li)=>(
                    <a key={li} href={link.startsWith("http")?link:`https://${link}`} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:11,color:"var(--teal)",background:"rgba(20,184,154,0.06)",borderRadius:6,padding:"3px 9px",textDecoration:"none",border:"1px solid rgba(20,184,154,0.2)"}}>
                      {link.replace(/https?:\/\//,"").split("/")[0]}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <AudioPlayer text={`${p.product}: ${p.why||""}. Cost: ${p.startup_cost||""}. Margin: ${p.profit_margin||""}`} label="" mini={true}/>
          </div>
        ))}
      </ModuleShell>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIN TRACKER — Daily win logging with streak calendar + AI celebration
// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING TUTORIAL
// Shown once to new users right after their first report is generated.
// Explains the 5 main sections with a step-by-step swipe.
// ═══════════════════════════════════════════════════════════════════════════════
const TUTORIAL_KEY = "diq_tutorial_done_v1";

function OnboardingTutorial({onDone}){
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon:"◎",
      color:"var(--gold)",
      title:"Welcome to your DestinIQ dashboard",
      body:"Your full report is ready. This quick tour shows you where everything lives — it takes about 30 seconds.",
      tip:null,
    },
    {
      icon:"📊",
      color:"var(--gold)",
      title:"Your Report — top left tab",
      body:"This is your clarity picture. Scores, daily insight, strengths, risks, and what to carry with you. It updates every day. The score history chart shows your progress over time as you re-assess.",
      tip:"Tap 'Refresh today\'s insight' every morning for a fresh perspective.",
    },
    {
      icon:"💰",
      color:"var(--teal)",
      title:"Make Money — four tabs",
      body:"Money Plan, Earn Online, Business, Life Hacks, and Jim Rohn financial wisdom. All personalised to your country and skills. Costs shown in your local currency. Earnings shown in USD.",
      tip:"Tap any module to auto-generate. Paid users can refresh anytime for new ideas.",
    },
    {
      icon:"🔥",
      color:"#9b72cf",
      title:"Level Up — six modules",
      body:"Invest in You, Get Successful, Daily Discipline, 10x Mindset, Inner Mindset, and Career Path. Each one has books, tools, and direct links. Free users see the first 2 sections — upgrade for all.",
      tip:"Inner Mindset is 100% free — it comes from your report data.",
    },
    {
      icon:"⟶",
      color:"var(--rose)",
      title:"Plan & Decide — your advisor and tools",
      body:"Your Roadmap (3 phases with steps), Big Decisions thinking partner, Relocate (explore any country), and My Advisor (your personal AI coach who has read your full report).",
      tip:"My Advisor knows your name, country, goals, and scores. Ask it anything.",
    },
    {
      icon:"⚡",
      color:"var(--teal)",
      title:"Check in daily — it matters",
      body:"30 seconds every day. How you feel, what you did, what you avoided. Over time you'll see patterns in your own data that nothing else shows you. Your streak is your proof.",
      tip:"The check-in result saves automatically. It shows your reflection when you come back.",
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return(
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:24,
    }}>
      <div style={{
        background:"var(--night)",borderRadius:24,border:`1px solid ${current.color}40`,
        width:"100%",maxWidth:440,padding:"32px 28px",position:"relative",
        boxShadow:`0 0 60px ${current.color}15`,
      }}>
        {/* Progress dots */}
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:28}}>
          {steps.map((_,i)=>(
            <div key={i} style={{
              width:i===step?24:7,height:7,borderRadius:4,
              background:i===step?current.color:i<step?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.07)",
              transition:"all .3s",
            }}/>
          ))}
        </div>

        {/* Icon */}
        <div style={{
          width:64,height:64,borderRadius:20,
          background:`${current.color}12`,border:`2px solid ${current.color}30`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:28,margin:"0 auto 20px",
        }}>
          {current.icon}
        </div>

        {/* Content */}
        <h3 style={{fontSize:18,fontWeight:700,color:"var(--cream)",textAlign:"center",marginBottom:12,lineHeight:1.4}}>
          {current.title}
        </h3>
        <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.8,textAlign:"center",marginBottom:current.tip?16:24}}>
          {current.body}
        </p>

        {/* Tip */}
        {current.tip&&(
          <div style={{padding:"10px 14px",background:`${current.color}08`,border:`1px solid ${current.color}20`,borderRadius:10,marginBottom:24}}>
            <p style={{fontSize:12,color:current.color,margin:0,lineHeight:1.6}}>
              💡 {current.tip}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div style={{display:"flex",gap:10}}>
          {step>0&&(
            <button onClick={()=>setStep(s=>s-1)}
              style={{flex:1,background:"none",border:"1px solid var(--line)",borderRadius:12,padding:"12px",color:"var(--cream-40)",fontSize:13,cursor:"pointer"}}>
              ← Back
            </button>
          )}
          <button onClick={()=>{
            if(isLast){
              try{localStorage.setItem(TUTORIAL_KEY,"1");}catch{}
              onDone();
            } else {
              setStep(s=>s+1);
            }
          }} style={{
            flex:2,background:current.color,border:"none",borderRadius:12,padding:"12px",
            color:current.color==="var(--gold)"?"#000":"#fff",
            fontSize:13,fontWeight:700,cursor:"pointer",
          }}>
            {isLast?"Let's go →":"Next →"}
          </button>
        </div>

        {/* Skip */}
        {!isLast&&(
          <button onClick={()=>{
            try{localStorage.setItem(TUTORIAL_KEY,"1");}catch{}
            onDone();
          }} style={{width:"100%",background:"none",border:"none",color:"var(--cream-30)",fontSize:11,cursor:"pointer",marginTop:12,fontFamily:"var(--f-mono)"}}>
            Skip tutorial
          </button>
        )}
      </div>
    </div>
  );
}


// ── MiniStreakCelebration — small banner for non-milestone days ────────────────
function MiniStreakCelebration({streak, onClose}){
  const [visible, setVisible] = useState(false);
  useEffect(()=>{
    setTimeout(()=>setVisible(true), 50);
    const t = setTimeout(()=>{ setVisible(false); setTimeout(onClose,400); }, 3000);
    return()=>clearTimeout(t);
  },[]);
  return(
    <div onClick={onClose} style={{
      position:"fixed", bottom:80, left:"50%", transform:`translateX(-50%) translateY(${visible?0:40}px)`,
      opacity: visible?1:0, transition:"all .4s cubic-bezier(0.175,0.885,0.32,1.275)",
      zIndex:3000, cursor:"pointer",
    }}>
      <div style={{
        background:"var(--night)", border:"1px solid rgba(210,175,90,0.4)",
        borderRadius:50, padding:"12px 24px",
        display:"flex", alignItems:"center", gap:10,
        boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
        whiteSpace:"nowrap",
      }}>
        <span style={{fontSize:22}}>🔥</span>
        <div>
          <span style={{fontSize:16, fontWeight:800, color:"var(--gold)"}}>Day {streak}</span>
          <span style={{fontSize:13, color:"var(--cream-50)", marginLeft:6}}>streak alive!</span>
        </div>
        <span style={{fontSize:13, color:"var(--cream-30)", marginLeft:4}}>✕</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAK LEADERBOARD
// Shows top 10 streak holders — motivates users to keep their streaks alive
// ═══════════════════════════════════════════════════════════════════════════════
function StreakLeaderboard({userId}){
  const [leaders,setLeaders]=useState([]);
  const [loading,setLoading]=useState(true);
  const [myRank,setMyRank]=useState(null);

  useEffect(()=>{
    (async()=>{
      try{
        const{data}=await supabase
          .from("user_profiles")
          .select("user_id,streak,name,form_data")
          .order("streak",{ascending:false})
          .limit(20);

        if(data){
          const top=data
            .filter(u=>u.streak>0)
            .map((u,i)=>({
              rank:i+1,
              name: u.form_data?.name || u.name || "Anonymous",
              country: u.form_data?.country || "",
              streak: u.streak,
              isMe: u.user_id===userId,
            }))
            .slice(0,10);

          setLeaders(top);
          const me=data.findIndex(u=>u.user_id===userId);
          if(me>=0) setMyRank(me+1);
        }
      }catch(e){console.warn("Leaderboard:",e);}
      setLoading(false);
    })();
  },[userId]);

  if(loading) return(
    <div style={{padding:"20px",textAlign:"center",color:"var(--cream-30)",fontSize:12,fontFamily:"var(--f-mono)"}}>
      Loading leaderboard…
    </div>
  );

  if(!leaders.length) return null;

  return(
    <div style={{marginTop:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".12em"}}>🏆 STREAK LEADERBOARD</div>
        {myRank&&<div style={{fontSize:11,color:"var(--cream-40)"}}>You: #{myRank}</div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {leaders.map((l,i)=>(
          <div key={i} style={{
            display:"flex",alignItems:"center",gap:12,padding:"10px 14px",
            background:l.isMe?"rgba(210,175,90,0.08)":"var(--midnight)",
            border:`1px solid ${l.isMe?"rgba(210,175,90,0.3)":"rgba(255,255,255,0.04)"}`,
            borderRadius:10,
          }}>
            <div style={{
              width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
              background:i===0?"rgba(210,175,90,0.2)":i===1?"rgba(192,192,192,0.15)":i===2?"rgba(205,127,50,0.15)":"var(--lift)",
              fontSize:i<3?14:11,fontWeight:700,color:i===0?"var(--gold)":i===1?"#C0C0C0":i===2?"#CD7F32":"var(--cream-40)",
              fontFamily:"var(--f-mono)",flexShrink:0,
            }}>
              {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${l.rank}`}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:l.isMe?700:500,color:l.isMe?"var(--gold)":"var(--cream)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {l.name}{l.isMe?" (you)":""}{l.country?` · ${l.country}`:""}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
              <span style={{fontSize:14}}>🔥</span>
              <span style={{fontSize:14,fontWeight:700,color:"var(--gold)",fontFamily:"var(--f-mono)"}}>{l.streak}</span>
              <span style={{fontSize:10,color:"var(--cream-30)"}}>days</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Wins: user-specific localStorage key + Supabase backup
const WIN_STORE_KEY=(uid)=>`diq_wins_${uid||"guest"}`;
function loadWins(uid){try{return JSON.parse(localStorage.getItem(WIN_STORE_KEY(uid))||"[]");}catch{return[];}}
function saveWins(w,uid){try{localStorage.setItem(WIN_STORE_KEY(uid),JSON.stringify(w));}catch{}}

// ─── FREE TIER LIMITS & TOOL LIST (module-level) ─────────────────────────────
const FREE_JOURNAL_LIMIT = 1;   // Free: 1 journal entry
const FREE_REPORT_LIMIT  = 1;   // Free: 1 intelligence report
const PRO_REPORT_LIMIT   = 3;   // Pro: 3 reports/month
// 5 free tools — one from each major area to hook users, Pro unlocks all 42
const FREE_TOOLS = ["career","decisions","confidencelab","innerpeace","sidehustle"];
// ─────────────────────────────────────────────────────────────────────────────

function WinTracker({profile,userId,isPremium,isPaid,onUnlock}){
  const [wins,setWins]=useState(()=>loadWins(userId));
  // Load wins from Supabase on mount (in case localStorage was cleared)
  useEffect(()=>{
    if(!userId) return;
    supabase.from("user_profiles").select("form_data,wins").eq("user_id",userId).single()
      .then(({data})=>{
        const rawWins = data?.wins?.length ? data.wins
          : (()=>{
              try{
                const fd=typeof data?.form_data==="string"?JSON.parse(data.form_data):data?.form_data;
                return fd?._wins||[];
              }catch{return[];}
            })();
        if(rawWins?.length){
          const serverWins = rawWins;
          const localWins  = loadWins(userId);
          // Merge — take whichever has more wins
          if(serverWins.length > localWins.length){
            setWins(serverWins);
            saveWins(serverWins, userId);
          }
        }
      }).catch(()=>{});
  },[userId]);
  const [input,setInput]=useState("");
  const [mood,setMood]=useState(null);
  const [celebrate,setCelebrate]=useState("");
  const [loading,setLoading]=useState(false);
  const [tab,setTab]=useState("log"); // log | calendar | stats

  const todayKey=new Date().toISOString().slice(0,10);
  const todayWins=wins.filter(w=>w.date===todayKey);
  const streakDays=[...new Set(wins.map(w=>w.date))].sort().reverse();
  const currentStreak=(()=>{let s=0;const today=new Date();for(let i=0;i<60;i++){const d=new Date(today);d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);if([...new Set(wins.map(w=>w.date))].includes(k))s++;else if(i>0)break;}return s;})();

  const FREE_WIN_LIMIT=5;
  const addWin=async()=>{
    if(!input.trim()) return;
    if(!isPaid && wins.length>=FREE_WIN_LIMIT){ onUnlock&&onUnlock(); return; }
    const win={id:Date.now(),text:input.trim(),date:todayKey,mood,ts:new Date().toISOString()};
    const updated=[win,...wins];
    setWins(updated);
    saveWins(updated, userId); // localStorage (instant)
    // Supabase backup — save wins inside form_data._wins
    if(userId){
      supabase.from("user_profiles").select("form_data").eq("user_id",userId).single()
        .then(({data})=>{
          // form_data is TEXT — parse first
          const fd2 = typeof data?.form_data==="string"
            ? (()=>{try{return JSON.parse(data.form_data);}catch{return{};}})()
            : (data?.form_data||{});
          return supabase.from("user_profiles").upsert({
            user_id: userId,
            wins: updated.slice(0,200), // dedicated wins column (jsonb)
            form_data: JSON.stringify({...fd2, _wins: updated.slice(0,200)}), // fallback
          },{onConflict:"user_id"});
        }).catch(()=>{});
    }
    setInput("");setMood(null);
    // Update last_checkin_date if first win today (keeps streak alive)
    const winToday = new Date().toISOString().slice(0,10);
    const winLastKey = `destiniq_win_checkin_${userId}`;
    try{
      if(localStorage.getItem(winLastKey)!==winToday){
        localStorage.setItem(winLastKey, winToday);
        // Mark today as active — keeps streak alive
        supabase.from("user_profiles").upsert({
          user_id:userId, last_checkin_date:winToday,
          updated_at:new Date().toISOString(),
        },{onConflict:"user_id"}).catch(()=>{});
      }
    }catch{}
    // AI celebration
    setLoading(true);
    try{
      const txt=await callAPI({
        messages:[{role:"user",content:`${profile?.name||"User"} just logged a win: "${win.text}". They're on a ${currentStreak+1}-day streak. Their goal is: "${profile?.goals||"success"}". Write ONE sentence (max 25 words) that celebrates this win in a real, warm way. Not generic. Reference their specific win.`}],
        system:"You write short, warm, genuine celebration messages. One sentence only. No emojis. No AI-speak.",
        userId,isPremium,
      });
      setCelebrate(txt.trim());
    }catch{setCelebrate("That's a real step forward. Keep going.");}
    setLoading(false);
  };

  const MOODS=[{e:"🔥",l:"Crushed it"},{e:"✅",l:"Good day"},{e:"😐",l:"Meh day"},{e:"💪",l:"Pushed through"},{e:"🌱",l:"Small step"}];

  // Calendar — last 30 days
  const last30=Array.from({length:30},(_, i)=>{const d=new Date();d.setDate(d.getDate()-29+i);const k=d.toISOString().slice(0,10);const dayWins=wins.filter(w=>w.date===k);return{key:k,count:dayWins.length,day:d.getDate(),isToday:k===todayKey};});

  const totalWins=wins.length;
  const avgPerDay=streakDays.length?Math.round(totalWins/Math.max(streakDays.length,1)*10)/10:0;

  return(
    <div className="fu">
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div className="d3" style={{marginBottom:4}}>Win Tracker</div>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>Every small win builds the bigger one. Log what you did today.</p>
          {!isPaid&&<p style={{fontSize:11,fontFamily:"var(--f-mono)",color:"var(--cream-30)",marginTop:4}}>
            {wins.length}/{FREE_WIN_LIMIT} free wins · <button onClick={()=>onUnlock&&onUnlock()} style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",fontSize:11,padding:0,fontFamily:"var(--f-mono)"}}>Upgrade for unlimited →</button>
          </p>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{textAlign:"center",padding:"8px 16px",background:"rgba(210,175,90,0.08)",border:"1px solid rgba(210,175,90,0.2)",borderRadius:10}}>
            <div style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:700,color:"var(--gold)",lineHeight:1}}>{currentStreak}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",fontFamily:"var(--f-mono)",marginTop:2}}>DAY STREAK 🔥</div>
          </div>
          <div style={{textAlign:"center",padding:"8px 16px",background:"rgba(20,184,154,0.06)",border:"1px solid rgba(20,184,154,0.2)",borderRadius:10}}>
            <div style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:700,color:"var(--teal)",lineHeight:1}}>{totalWins}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",fontFamily:"var(--f-mono)",marginTop:2}}>TOTAL WINS</div>
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {[{id:"log",l:"Log a Win"},{id:"calendar",l:"Calendar"},{id:"stats",l:"My Progress"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${tab===t.id?"rgba(210,175,90,0.4)":"rgba(255,255,255,0.1)"}`,background:tab===t.id?"rgba(210,175,90,0.08)":"none",color:tab===t.id?"var(--gold)":"rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",fontFamily:"var(--f-mono)"}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* LOG TAB */}
      {tab==="log"&&(
        <>
          {/* Mood selector */}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {MOODS.map(m=>(
              <button key={m.l} onClick={()=>setMood(mood===m.l?null:m.l)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,border:`1px solid ${mood===m.l?"rgba(210,175,90,0.4)":"rgba(255,255,255,0.08)"}`,background:mood===m.l?"rgba(210,175,90,0.08)":"none",cursor:"pointer",fontSize:12,color:mood===m.l?"var(--gold)":"rgba(255,255,255,0.4)"}}>
                <span>{m.e}</span>{m.l}
              </button>
            ))}
          </div>
          <div style={{position:"relative",marginBottom:12}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();addWin();}}}
              placeholder="What did you accomplish today? Even tiny things count — showing up, making a call, finishing a task…"
              style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"13px 50px 13px 16px",color:"var(--cream)",fontSize:13,outline:"none",boxSizing:"border-box",resize:"none",lineHeight:1.6,fontFamily:"inherit"}} rows={3} maxLength={300}/>
            <button onClick={addWin} disabled={!input.trim()||loading}
              style={{position:"absolute",right:10,bottom:10,width:32,height:32,borderRadius:"50%",border:"none",background:input.trim()?"var(--gold)":"rgba(255,255,255,0.1)",color:input.trim()?"#000":"rgba(255,255,255,0.2)",cursor:input.trim()?"pointer":"default",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
              {loading?"…":"→"}
            </button>
          </div>
          {celebrate&&(
            <div style={{padding:"12px 16px",background:"rgba(210,175,90,0.07)",border:"1px solid rgba(210,175,90,0.2)",borderRadius:10,marginBottom:16,fontSize:13,color:"var(--gold)",lineHeight:1.6,animation:"fadeUp 0.4s ease"}}>
              ✨ {celebrate}
            </div>
          )}
          {/* Today's wins */}
          {todayWins.length>0&&(
            <div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",fontFamily:"var(--f-mono)",marginBottom:10,letterSpacing:".1em"}}>TODAY'S WINS · {todayWins.length}</div>
              {todayWins.map((w,i)=>(
                <div key={w.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:i<todayWins.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                  <span style={{fontSize:16,flexShrink:0}}>✅</span>
                  <div style={{flex:1}}>
                    <p style={{fontSize:13,color:"rgba(255,255,255,0.7)",margin:0,lineHeight:1.6}}>{w.text}</p>
                    {w.mood&&<span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{w.mood}</span>}
                  </div>
                  <button onClick={()=>{const u=wins.filter(x=>x.id!==w.id);setWins(u);saveWins(u,userId);
                    if(userId) supabase.from("user_profiles").upsert({user_id:userId,wins:u},{onConflict:"user_id"}).catch(()=>{});}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.15)",cursor:"pointer",fontSize:12,flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
          )}
          {todayWins.length===0&&(
            <div style={{textAlign:"center",padding:"16px 0 8px"}}>
              <p style={{fontSize:13,color:"rgba(255,255,255,0.3)",marginBottom:16}}>No wins logged yet today. What&apos;s one small thing you&apos;ll do before the day ends?</p>
              <div style={{padding:"14px 18px",background:"rgba(210,175,90,0.04)",border:"1px solid rgba(210,175,90,0.12)",borderRadius:12,textAlign:"left"}}>
                <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".12em",marginBottom:8}}>NEED MOTIVATION?</div>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {[
                    {emoji:"📖",label:"Can't Hurt Me — David Goggins (read or listen)",url:"https://www.amazon.com/Cant-Hurt-Me-Master-Your/dp/1544512287"},
                    {emoji:"🎧",label:"David Goggins on discipline (YouTube)",url:"https://www.youtube.com/results?search_query=david+goggins+motivation"},
                    {emoji:"📱",label:"Streaks app — habit tracking",url:"https://streaksapp.com"},
                    {emoji:"🏆",label:"Habitica — gamify your wins",url:"https://habitica.com"},
                  ].map((lk,i)=>(
                    <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
                      style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"var(--midnight)",borderRadius:8,textDecoration:"none",transition:"opacity .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
                      onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      <span style={{fontSize:14,flexShrink:0}}>{lk.emoji}</span>
                      <span style={{fontSize:12,color:"var(--cream-60)",flex:1}}>{lk.label}</span>
                      <span style={{fontSize:9,color:"var(--gold)",fontFamily:"var(--f-mono)"}}>↗</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* CALENDAR TAB */}
      {tab==="calendar"&&(
        <div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontFamily:"var(--f-mono)",marginBottom:14,letterSpacing:".1em"}}>LAST 30 DAYS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
            {last30.map(d=>(
              <div key={d.key} title={`${d.key}: ${d.count} win${d.count!==1?"s":""}`}
                style={{aspectRatio:"1",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,border:`1.5px solid ${d.isToday?"rgba(210,175,90,0.6)":d.count>0?"rgba(210,175,90,0.2)":"rgba(255,255,255,0.06)"}`,background:d.count>=3?"rgba(210,175,90,0.2)":d.count===2?"rgba(210,175,90,0.1)":d.count===1?"rgba(210,175,90,0.06)":"transparent",color:d.count>0?"var(--gold)":"rgba(255,255,255,0.2)"}}>
                {d.count>0?d.count:d.day}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:12,marginTop:14,flexWrap:"wrap"}}>
            {[{c:"rgba(210,175,90,0.2)",l:"3+ wins"},{c:"rgba(210,175,90,0.1)",l:"2 wins"},{c:"rgba(210,175,90,0.06)",l:"1 win"},{c:"transparent",l:"No log"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"rgba(255,255,255,0.3)"}}>
                <div style={{width:12,height:12,borderRadius:3,background:x.c,border:"1px solid rgba(210,175,90,0.2)"}}/>
                {x.l}
              </div>
            ))}
          </div>
          {wins.length>0&&(
            <div style={{marginTop:20}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontFamily:"var(--f-mono)",marginBottom:12,letterSpacing:".1em"}}>RECENT WINS</div>
              {wins.slice(0,8).map(w=>(
                <div key={w.id} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                  <span style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:"var(--f-mono)",flexShrink:0,paddingTop:3}}>{w.date}</span>
                  <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:0,lineHeight:1.5}}>{w.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STATS TAB */}
      {tab==="stats"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
            {[
              {label:"Current Streak",val:`${currentStreak} days`,icon:"🔥",c:"var(--gold)"},
              {label:"Total Wins",val:totalWins,icon:"✅",c:"var(--teal)"},
              {label:"Active Days",val:streakDays.length,icon:"📅",c:"#9b72cf"},
              {label:"Avg per Day",val:avgPerDay,icon:"📈",c:"var(--gold)"},
            ].map(s=>(
              <div key={s.label} style={{padding:"14px",background:"rgba(255,255,255,0.03)",borderRadius:12,border:"1px solid rgba(255,255,255,0.07)"}}>
                <div style={{fontSize:24,marginBottom:4}}>{s.icon}</div>
                <div style={{fontSize:20,fontWeight:700,color:s.c,lineHeight:1}}>{s.val}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:4,fontFamily:"var(--f-mono)"}}>{s.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
          {currentStreak>=7&&<div style={{padding:"14px 16px",background:"rgba(210,175,90,0.07)",border:"1px solid rgba(210,175,90,0.2)",borderRadius:12,fontSize:13,color:"var(--gold)",lineHeight:1.6}}>🏆 You've maintained a {currentStreak}-day streak. Most people quit by day 3. You didn't.</div>}
          {currentStreak===0&&totalWins>0&&<div style={{padding:"14px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6}}>You've logged {totalWins} wins total. Today is a new day — log one thing and restart your streak.</div>}
          {totalWins===0&&<div style={{textAlign:"center",padding:"20px 0",color:"rgba(255,255,255,0.25)",fontSize:13}}>Start logging wins daily. Even small ones. After 7 days you&apos;ll see something change.</div>}

          {/* Streak Leaderboard */}
          <StreakLeaderboard userId={userId}/>

          {/* Referral widget */}
          <div style={{marginTop:20}}>
            <ReferralWidget userId={userId} isPaid={isPaid}/>
          </div>

          {/* Motivational resources — always shown in stats tab */}
          <div style={{marginTop:20,padding:"16px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14}}>
            <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--teal)",letterSpacing:".12em",marginBottom:12}}>TOOLS TO TRACK YOUR JOURNEY</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {[
                {emoji:"📊",label:"Notion — free daily log & tracker template",url:"https://www.notion.so/templates/daily-planner",type:"tool"},
                {emoji:"✅",label:"Todoist — daily task & win tracking",url:"https://todoist.com",type:"tool"},
                {emoji:"📖",label:"The Compound Effect — Darren Hardy",url:"https://www.amazon.com/Compound-Effect-Darren-Hardy/dp/159315724X",type:"book"},
                {emoji:"📖",label:"Atomic Habits — James Clear",url:"https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299",type:"book"},
                {emoji:"🎯",label:"Streaks — habit streak tracking app",url:"https://streaksapp.com",type:"tool"},
                {emoji:"🧠",label:"James Clear's newsletter — weekly habit insights (free)",url:"https://jamesclear.com/3-2-1",type:"resource"},
              ].map((lk,i)=>(
                <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                    background:lk.type==="book"?"rgba(210,175,90,0.05)":lk.type==="tool"?"rgba(31,168,154,0.05)":"rgba(155,114,207,0.05)",
                    border:`1px solid ${lk.type==="book"?"rgba(210,175,90,0.12)":lk.type==="tool"?"rgba(31,168,154,0.12)":"rgba(155,114,207,0.12)"}`,
                    borderRadius:9,textDecoration:"none",transition:"opacity .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
                  onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  <span style={{fontSize:14,flexShrink:0}}>{lk.emoji}</span>
                  <span style={{fontSize:12,color:"var(--cream-60)",flex:1}}>{lk.label}</span>
                  <span style={{fontSize:9,
                    color:lk.type==="book"?"var(--gold)":lk.type==="tool"?"var(--teal)":"#9b72cf",
                    fontFamily:"var(--f-mono)",flexShrink:0}}>
                    {lk.type==="book"?"Book ↗":lk.type==="tool"?"Tool ↗":"Read ↗"}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS FEED — User reports back on steps, AI coaches based on full history
// ═══════════════════════════════════════════════════════════════════════════════
const PROGRESS_KEY="destiniq_progress_v1";
function loadProgress(){try{return JSON.parse(localStorage.getItem(PROGRESS_KEY)||"[]");}catch{return[];}}
function saveProgress(p){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(p.slice(0,100)));}catch{}}

const PROGRESS_TAGS=[
  {id:"roadmap",label:"Roadmap",color:"var(--gold)"},
  {id:"money",label:"Money",color:"var(--teal)"},
  {id:"career",label:"Career",color:"#9b72cf"},
  {id:"business",label:"Business",color:"#e8963a"},
  {id:"mindset",label:"Mindset",color:"var(--rose)"},
  {id:"personal",label:"Personal",color:"var(--cream-40)"},
];

function ProgressFeed({profile,reportData,userId,isPremium,isPaid,onUnlock}){
  const [entries,setEntries]=useState(()=>loadProgress());
  const [input,setInput]=useState("");
  const [tag,setTag]=useState("roadmap");
  const [loading,setLoading]=useState(false);
  const [expandedId,setExpandedId]=useState(null);
  const [filter,setFilter]=useState("all");

  const FREE_PROGRESS_LIMIT = 2; // Free: 2 progress updates total
  const canPost = isPaid || entries.length < FREE_PROGRESS_LIMIT;

  const submit=async()=>{
    if(!input.trim()||loading) return;
    if(!canPost){ onUnlock&&onUnlock(); return; }
    const entry={
      id:Date.now(),
      text:input.trim(),
      tag,
      date:new Date().toISOString(),
      reply:null,
      loading:true,
    };
    const updated=[entry,...entries];
    setEntries(updated);
    saveProgress(updated);
    setInput("");
    setLoading(true);
    setExpandedId(entry.id);

    try{
      // Build context from report + roadmap + past 5 entries
      const pastContext=entries.slice(0,5).map(e=>`[${new Date(e.date).toLocaleDateString()}] ${e.text}${e.reply?` → Coach replied: ${e.reply.slice(0,120)}`:""}`).join("\n");
      const prompt=`${profile?.name||"The user"} is updating their progress. Their goal: "${profile?.goals||""}". Country: ${profile?.country||""}. Income: ${profile?.income||""}.

Their report summary: "${reportData?.headline||""}".
Their roadmap phase 1: "${reportData?.roadmap?.[0]?.title||""}".

Past progress entries:
${pastContext||"(none yet — this is their first update)"}

TODAY'S UPDATE (tagged as "${tag}"): "${entry.text}"

Respond as their personal coach who knows their full story. Be direct, warm, specific. Reference exactly what they said. Give ONE concrete next step. Max 4 sentences. No generic advice.`;

      const reply=await callAPI({
        messages:[{role:"user",content:prompt}],
        system:"You are a personal life coach who knows this person's full story. Speak directly to them. Reference their specific situation. Never be generic. 3-4 sentences max. No bullet points.",
        userId,isPremium,
      });

      const withReply=updated.map(e=>e.id===entry.id?{...e,reply,loading:false}:e);
      setEntries(withReply);
      saveProgress(withReply);
    }catch{
      const withErr=updated.map(e=>e.id===entry.id?{...e,reply:"Couldn't load a response right now. Your update is saved — try refreshing.",loading:false}:e);
      setEntries(withErr);
      saveProgress(withErr);
    }
    setLoading(false);
  };

  const filtered=filter==="all"?entries:entries.filter(e=>e.tag===filter);
  const tagMeta=(id)=>PROGRESS_TAGS.find(t=>t.id===id)||PROGRESS_TAGS[0];

  return(
    <div className="fu">
      <div style={{marginBottom:24}}>
        <div className="d3" style={{marginBottom:6}}>My Progress</div>
        <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.6}}>Tell your coach what you tried, what happened, and what's not working. They'll respond based on everything they know about you.</p>
      </div>

      {/* Input card */}
      <div className="card" style={{marginBottom:24}}>
        {/* Tag selector */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {PROGRESS_TAGS.map(t=>(
            <button key={t.id} onClick={()=>setTag(t.id)}
              style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${tag===t.id?t.color:"rgba(255,255,255,0.1)"}`,background:tag===t.id?`${t.color}18`:"none",color:tag===t.id?t.color:"rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",fontFamily:"var(--f-mono)",transition:"all .2s"}}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{position:"relative",marginBottom:12}}>
          <VoiceInput
            value={input}
            onChange={e=>setInput(e.target.value)}
            rows={4}
            maxLength={600}
            placeholder={`What did you try? What happened? What's working and what's not? Be honest — your coach needs the real picture to help you...`}
          />
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.2)",fontFamily:"var(--f-mono)"}}>{input.length}/600</span>
          {!isPaid && entries.length >= FREE_PROGRESS_LIMIT ? (
            <button onClick={()=>onUnlock&&onUnlock()} className="btn btn-gold" style={{fontSize:13}}>
              🔒 Upgrade to post more updates
            </button>
          ):(
            <button onClick={submit} disabled={!input.trim()||loading} className="btn btn-gold" style={{fontSize:13}}>
              {loading?"Getting your coaching…":"Send update →"}
            </button>
          )}
          {!isPaid&&<p style={{fontSize:11,color:"var(--cream-30)",margin:"6px 0 0"}}>Free: {Math.max(0,FREE_PROGRESS_LIMIT-entries.length)} of {FREE_PROGRESS_LIMIT} updates remaining · <button onClick={()=>onUnlock&&onUnlock()} style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",fontSize:11,padding:0}}>Upgrade for unlimited</button></p>}
        </div>
      </div>

      {/* Filter */}
      {entries.length>0&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          <button onClick={()=>setFilter("all")} style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${filter==="all"?"var(--gold)":"rgba(255,255,255,0.1)"}`,background:filter==="all"?"rgba(210,175,90,0.08)":"none",color:filter==="all"?"var(--gold)":"rgba(255,255,255,0.35)",fontSize:11,cursor:"pointer"}}>
            All ({entries.length})
          </button>
          {PROGRESS_TAGS.filter(t=>entries.some(e=>e.tag===t.id)).map(t=>(
            <button key={t.id} onClick={()=>setFilter(t.id)} style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${filter===t.id?t.color:"rgba(255,255,255,0.1)"}`,background:filter===t.id?`${t.color}18`:"none",color:filter===t.id?t.color:"rgba(255,255,255,0.35)",fontSize:11,cursor:"pointer"}}>
              {t.label} ({entries.filter(e=>e.tag===t.id).length})
            </button>
          ))}
        </div>
      )}

      {/* Feed */}
      {filtered.length===0&&(
        <div style={{padding:"28px 0 8px"}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:"clamp(28px,8vw,40px)",marginBottom:12}}>📈</div>
            <div className="d3" style={{marginBottom:8}}>Your progress story starts here</div>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",maxWidth:380,margin:"0 auto",lineHeight:1.7}}>
              Every time you try something from your roadmap, career path, or business plan — come back and tell your coach what happened. They&apos;ll help you adjust and keep moving.
            </p>
          </div>

          {/* Resources to help them get started */}
          <div style={{padding:"16px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14}}>
            <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".12em",marginBottom:12}}>WHILE YOU BUILD YOUR STORY — READ THESE</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {[
                {emoji:"📖",label:"The Lean Startup — Eric Ries (test ideas fast)",url:"https://www.amazon.com/Lean-Startup-Entrepreneurs-Continuous-Innovation/dp/0307887898",type:"book"},
                {emoji:"📖",label:"Grit — Angela Duckworth (why persistence wins)",url:"https://www.amazon.com/Grit-Passion-Perseverance-Angela-Duckworth/dp/1501111108",type:"book"},
                {emoji:"🎧",label:"How I Built This — Guy Raz (founder stories, podcast)",url:"https://www.npr.org/series/490248027/how-i-built-this",type:"resource"},
                {emoji:"📖",label:"The $100 Startup — Chris Guillebeau",url:"https://www.amazon.com/100-Startup-Reinvent-Living-Create/dp/0307951529",type:"book"},
                {emoji:"🛠",label:"Notion — track your roadmap steps",url:"https://www.notion.so/templates",type:"tool"},
                {emoji:"🧠",label:"Indie Hackers — real founders sharing real numbers",url:"https://www.indiehackers.com",type:"resource"},
              ].map((lk,i)=>(
                <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                    background:lk.type==="book"?"rgba(210,175,90,0.05)":lk.type==="tool"?"rgba(31,168,154,0.05)":"rgba(155,114,207,0.05)",
                    border:`1px solid ${lk.type==="book"?"rgba(210,175,90,0.12)":lk.type==="tool"?"rgba(31,168,154,0.12)":"rgba(155,114,207,0.12)"}`,
                    borderRadius:9,textDecoration:"none",transition:"opacity .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
                  onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  <span style={{fontSize:14,flexShrink:0}}>{lk.emoji}</span>
                  <span style={{fontSize:12,color:"var(--cream-60)",flex:1}}>{lk.label}</span>
                  <span style={{fontSize:9,
                    color:lk.type==="book"?"var(--gold)":lk.type==="tool"?"var(--teal)":"#9b72cf",
                    fontFamily:"var(--f-mono)",flexShrink:0}}>
                    {lk.type==="book"?"Book ↗":lk.type==="tool"?"Tool ↗":"Listen ↗"}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {filtered.map(entry=>{
          const meta=tagMeta(entry.tag);
          const isExpanded=expandedId===entry.id;
          const dateStr=new Date(entry.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
          return(
            <div key={entry.id} style={{background:"var(--lift)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
              {/* User update */}
              <div style={{padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:9,color:meta.color,fontFamily:"var(--f-mono)",background:`${meta.color}18`,border:`1px solid ${meta.color}40`,borderRadius:4,padding:"2px 8px"}}>{meta.label.toUpperCase()}</span>
                    <span style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontFamily:"var(--f-mono)"}}>{dateStr}</span>
                  </div>
                  <button onClick={()=>setEntries(entries.filter(e=>e.id!==entry.id))||saveProgress(entries.filter(e=>e.id!==entry.id))} style={{background:"none",border:"none",color:"rgba(255,255,255,0.15)",cursor:"pointer",fontSize:12}}>✕</button>
                </div>
                <p style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.7,margin:0}}>{entry.text}</p>
              </div>

              {/* Coach reply */}
              {entry.loading?(
                <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.06)",background:"rgba(210,175,90,0.03)",display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:20,height:20,border:"2px solid rgba(210,175,90,0.2)",borderTop:"2px solid var(--gold)",borderRadius:"50%",animation:"spin 1s linear infinite",flexShrink:0}}/>
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Your coach is reading your update…</span>
                </div>
              ):entry.reply?(
                <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.06)",background:"rgba(210,175,90,0.04)"}}>
                  <div style={{fontSize:9,color:"var(--gold)",fontFamily:"var(--f-mono)",marginBottom:8,letterSpacing:".08em"}}>⬡ YOUR COACH</div>
                  <p style={{fontSize:13,color:"rgba(237,232,216,0.7)",lineHeight:1.75,margin:0}}>{entry.reply}</p>
                  <AudioPlayer text={entry.reply} label="Listen" mini={false}/>
                </div>
              ):null}
            </div>
          );
        })}
      </div>
      {/* Resource strip — always visible at bottom */}
      <div style={{marginTop:24,padding:"14px 16px",background:"rgba(155,114,207,0.05)",border:"1px solid rgba(155,114,207,0.15)",borderRadius:14}}>
        <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"#9b72cf",letterSpacing:".12em",marginBottom:10}}>WHEN YOU GET STUCK — GO HERE</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {[
            {emoji:"🧠",label:"ADPList — free mentors",url:"https://adplist.org"},
            {emoji:"🌐",label:"Indie Hackers",url:"https://www.indiehackers.com"},
            {emoji:"📖",label:"Grit — A. Duckworth",url:"https://www.amazon.com/Grit-Passion-Perseverance-Angela-Duckworth/dp/1501111108"},
            {emoji:"🛠",label:"MentorCruise",url:"https://mentorcruise.com"},
            {emoji:"💸",label:"Deel — get paid globally",url:"https://www.deel.com"},
          ].map((lk,i)=>(
            <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:20,textDecoration:"none",transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:12}}>{lk.emoji}</span>
              <span style={{fontSize:11,color:"var(--cream-60)"}}>{lk.label}</span>
              <span style={{fontSize:9,color:"#9b72cf",fontFamily:"var(--f-mono)"}}>↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// INVEST IN YOURSELF MODULE
// Investments for your 20s–30s — because your 20s decide your 40s.
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// DAILY DISCIPLINE MODULE
// For people who are done with distractions and want the FYP they wish they had:
// wake-up times, routines, focus, grind — deeply explained.
// ═══════════════════════════════════════════════════════════════════════════════
// ── PracticesView — the "My Practices" tab — full embedded tracker ────────────
function PracticesView({userId}){
  const ht = useHabitTracker(userId);
  const [filter,setFilter]=useState("all");
  const [expandKey,setExpandKey]=useState(null);

  const STATUS_META={
    active:  {label:"Active",    color:"var(--teal)",  bg:"rgba(31,168,154,0.1)",  border:"rgba(31,168,154,0.25)"},
    mastered:{label:"Mastered ✦",color:"var(--gold)",  bg:"rgba(210,175,90,0.1)",  border:"rgba(210,175,90,0.25)"},
    paused:  {label:"Paused",    color:"var(--cream-40)",bg:"rgba(255,255,255,0.04)",border:"rgba(255,255,255,0.1)"},
  };

  const daysActive=(entry)=>{
    if(!entry?.startedAt) return 0;
    return Math.floor((Date.now()-new Date(entry.startedAt).getTime())/(86400000));
  };

  const displayed=ALL_TRACKABLE.filter(t=>{
    if(filter==="all") return true;
    if(filter==="committed") return ht.data[t.key]?.committed;
    if(filter==="mastered") return ht.data[t.key]?.status==="mastered";
    if(filter==="not_started") return !ht.data[t.key]?.committed;
    return t.module===filter;
  });

  const byModule={};
  ALL_TRACKABLE.forEach(t=>{
    if(!byModule[t.module]) byModule[t.module]=[];
    byModule[t.module].push(t);
  });

  const G={
    gold:"#f0b429",card:"#111008",border:"rgba(232,220,200,0.07)",
    cream:"#e8dcc8",dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)",
  };

  return(
    <div style={{padding:"20px 20px 90px",minHeight:"100vh",color:G.cream,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>

      {/* Header */}
      <h2 style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:800,color:G.cream,margin:"0 0 4px"}}>My Practices</h2>
      <p style={{fontSize:13,color:G.dim,margin:"0 0 20px",lineHeight:1.6}}>
        Commit to habits that compound over time. Track your progress daily.
      </p>

      {/* Progress card */}
      <div style={{background:G.card,border:"1px solid rgba(240,180,41,0.15)",
        borderRadius:16,padding:"18px 20px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <div style={{fontSize:"clamp(18px,5vw,26px)",fontWeight:800,color:G.cream,lineHeight:1}}>{ht.committed.length}</div>
            <div style={{fontSize:10,color:G.dimmer,fontFamily:"monospace",letterSpacing:".08em",marginTop:2}}>COMMITTED</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:"clamp(18px,5vw,26px)",fontWeight:800,color:"#1ab89a",lineHeight:1}}>{ht.mastered?.length||0}</div>
            <div style={{fontSize:10,color:G.dimmer,fontFamily:"monospace",letterSpacing:".08em",marginTop:2}}>MASTERED</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"clamp(18px,5vw,26px)",fontWeight:800,color:G.gold,lineHeight:1}}>{ht.pct}%</div>
            <div style={{fontSize:10,color:G.dimmer,fontFamily:"monospace",letterSpacing:".08em",marginTop:2}}>COMPLETE</div>
          </div>
        </div>
        <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${ht.pct}%`,
            background:"linear-gradient(90deg,#1ab89a,#f0b429)",
            borderRadius:3,transition:"width .4s ease"}}/>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex",gap:6,marginBottom:18,overflowX:"auto",scrollbarWidth:"none"}}>
        {[["all","All"],["active","Active"],["mastered","Mastered ✦"],["paused","Paused"]].map(([id,label])=>(
          <button key={id} onClick={()=>setFilter(id)}
            style={{padding:"7px 16px",borderRadius:20,flexShrink:0,fontFamily:"inherit",
              fontSize:12,cursor:"pointer",transition:"all .15s",
              background:filter===id?"rgba(240,180,41,0.1)":"none",
              border:`1px solid ${filter===id?"rgba(240,180,41,0.4)":"rgba(232,220,200,0.1)"}`,
              color:filter===id?G.gold:G.dim}}>
            {label}
          </button>
        ))}
      </div>

      {/* Habit cards */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {displayed.map(item=>{
          const isIn    = ht.committed?.includes?.(item.key);
          const isMast  = ht.mastered?.includes?.(item.key);
          const isPaus  = ht.paused?.includes?.(item.key);
          const status  = isMast?"mastered":isPaus?"paused":isIn?"active":null;
          const sm      = status?STATUS_META[status]:null;
          const isExp   = expandKey===item.key;

          return(
            <div key={item.key} style={{
              background:isIn?`${item.color}08`:"rgba(255,255,255,0.02)",
              border:`1px solid ${isIn?`${item.color}30`:G.border}`,
              borderRadius:14,overflow:"hidden",transition:"all .2s"}}>

              {/* Main row */}
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:isIn?"pointer":"default"}}
                onClick={()=>isIn&&setExpandKey(isExp?null:item.key)}>

                {/* Commit toggle */}
                <button onClick={e=>{e.stopPropagation();isIn?ht.uncommit(item.key):ht.commit(item.key);}}
                  style={{width:28,height:28,borderRadius:"50%",flexShrink:0,border:"none",
                    cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",
                    background:isIn?(isMast?"rgba(240,180,41,0.2)":"rgba(26,184,154,0.2)"):"rgba(255,255,255,0.06)",
                    color:isIn?(isMast?G.gold:"#1ab89a"):"rgba(232,220,200,0.3)",
                    transition:"all .2s"}}>
                  {isMast?"✦":isIn?"✓":"○"}
                </button>

                <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
                  background:`${item.color}18`,border:`1px solid ${item.color}30`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                  {item.icon}
                </div>

                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:G.cream,
                    textDecoration:isPaus?"line-through":"none",opacity:isPaus?.5:1}}>
                    {item.label}
                  </div>
                  {sm&&(
                    <div style={{fontSize:10,color:sm.color,fontWeight:700,
                      letterSpacing:".06em",fontFamily:"monospace",marginTop:2}}>
                      {sm.label}{isIn&&!isMast?` · ${daysActive(ht.getEntry?.(item.key))} days`:""}
                    </div>
                  )}
                </div>

                {isIn&&<span style={{color:G.dimmer,fontSize:16,flexShrink:0}}>{isExp?"↑":"↓"}</span>}
              </div>

              {/* Expanded controls */}
              {isIn&&isExp&&(
                <div style={{padding:"0 16px 14px",borderTop:"1px solid "+G.border}}>
                  <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                    {!isMast&&(
                      <button onClick={()=>ht.markMastered?.(item.key)}
                        style={{padding:"7px 14px",background:"rgba(240,180,41,0.08)",
                          border:"1px solid rgba(240,180,41,0.25)",borderRadius:20,
                          color:G.gold,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                        ✦ Mark as Mastered
                      </button>
                    )}
                    {!isPaus?(
                      <button onClick={()=>ht.pause?.(item.key)}
                        style={{padding:"7px 14px",background:"rgba(255,255,255,0.04)",
                          border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,
                          color:G.dim,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                        ⏸ Pause
                      </button>
                    ):(
                      <button onClick={()=>ht.resume?.(item.key)}
                        style={{padding:"7px 14px",background:"rgba(26,184,154,0.08)",
                          border:"1px solid rgba(26,184,154,0.25)",borderRadius:20,
                          color:"#1ab89a",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                        ▶ Resume
                      </button>
                    )}
                    <button onClick={()=>{ht.uncommit(item.key);setExpandKey(null);}}
                      style={{padding:"7px 14px",background:"rgba(224,82,82,0.06)",
                        border:"1px solid rgba(224,82,82,0.15)",borderRadius:20,
                        color:"#e05252",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {displayed.length===0&&(
          <div style={{textAlign:"center",padding:"40px 20px",color:G.dimmer}}>
            <div style={{fontSize:32,marginBottom:12}}>
              {filter==="mastered"?"✦":filter==="active"?"⚡":"📋"}
            </div>
            <p style={{fontSize:14,lineHeight:1.7,margin:0}}>
              {filter==="mastered"?"No mastered practices yet. Keep showing up."
               :filter==="active"?"No active practices. Commit to one above."
               :filter==="paused"?"Nothing paused. Good."
               :"No practices to show."}
            </p>
          </div>
        )}
      </div>

      {/* Motivational footer */}
      {ht.committed?.length>0&&(
        <div style={{marginTop:24,padding:"18px 20px",
          background:"rgba(240,180,41,0.05)",
          border:"1px solid rgba(240,180,41,0.12)",borderRadius:14,textAlign:"center"}}>
          <p style={{fontSize:13,color:G.dim,lineHeight:1.75,margin:0}}>
            {ht.mastered?.length>=3
              ?`${ht.mastered.length} practices mastered. You are not the same person who started. Keep compounding.`
              :ht.committed.length>=5
              ?"You're building something real. The first 21 days of any practice are the hardest."
              :"Every great life is built one committed practice at a time. Keep going."}
          </p>
          {ht.pct===100&&(
            <div style={{marginTop:10,fontSize:15,color:G.gold,fontWeight:700}}>
              ✦ All practices committed. You're playing a different game entirely.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DISCIPLINE_SECTIONS=[
  {
    id:"wakeup",
    icon:"⏰",
    color:"var(--gold)",
    title:"When to Wake Up — And Why It Actually Matters",
    wakeTime:"5:30 AM – 6:00 AM",
    subtitle:"The first hour of your day is the most uncontested hour you will ever have. Don't waste it.",
    body:"The most productive people in the world — builders, athletes, writers, founders — protect their mornings aggressively. Not because waking up early is a personality trait, but because the first 60–90 minutes before the world needs you are the only time your mind is fully yours. No notifications. No one asking things of you. No decisions that belong to other people. That window is where real progress is built.",
    breakdown:[
      {time:"5:30 AM", label:"Wake up", detail:"No snooze. Get up immediately. The first decision of the day sets the tone for every decision that follows. Snoozing is practice for giving up."},
      {time:"5:30 – 5:45 AM", label:"Hydrate + no phone", detail:"Drink water before anything else. Your brain is dehydrated after sleep. Do not touch your phone — looking at notifications first thing hands control of your morning to everyone else."},
      {time:"5:45 – 6:15 AM", label:"Move your body", detail:"30 minutes of movement — a walk, a run, a workout, stretching. This is not about fitness. It raises your cortisol (the focus hormone) to its natural peak and sets your cognitive baseline for the day."},
      {time:"6:15 – 6:30 AM", label:"Review your day's one goal", detail:"Not your to-do list. One goal. What is the single most important thing you need to move forward today? Write it down. Say it out loud if you need to. This is your anchor."},
      {time:"6:30 – 8:00 AM", label:"Deep work — no interruptions", detail:"This is your most cognitively powerful window. No calls, no social media, no WhatsApp. Work on the thing that matters most. This block alone, done consistently, changes your life within 90 days."},
    ],
    truth:"Most people start their day reactively — checking their phone, responding to others, watching content. You are giving the first and best hours of your brain to other people's agendas. The person who owns their morning owns their life.",
    links:[
      {label:"The Miracle Morning by Hal Elrod",url:"https://www.amazon.com/Miracle-Morning-Not-So-Obvious-Guaranteed-Transform/dp/0979019710",type:"book"},
      {label:"My Morning Routine — routines from top performers",url:"https://mymorningroutine.com",type:"resource"},
      {label:"5 AM Club by Robin Sharma",url:"https://www.amazon.com/AM-Club-Morning-Elevate-Life/dp/1443456624",type:"book"},
      {label:"Huberman Lab — morning routine science",url:"https://www.hubermanlab.com/episode/master-your-sleep-and-be-more-alert-when-awake",type:"resource"},
    ],
  },
  {
    id:"routine",
    icon:"🔁",
    color:"var(--teal)",
    title:"Build a Routine That Actually Sticks",
    subtitle:"Your routine is the architecture of your discipline. Design it once, execute it forever.",
    body:"A routine is not a rigid schedule. It is a sequence of defaults — a series of decisions you made once so you don't have to make them again every day. The more decisions you automate with routine, the more cognitive energy you have for the work that actually matters. Most people fail at routines not because they lack willpower, but because they designed a routine that requires willpower to execute. The goal is a routine that feels like friction NOT to do.",
    blocks:[
      {label:"Morning Block (5:30–8:30 AM)", items:["Wake, hydrate, no phone","30 min movement","1 goal review","90 min deep work on your most important task"]},
      {label:"Work Block (9 AM–1 PM)", items:["Focused execution on your main goal","No social media — use Freedom or Cold Turkey to block","Check messages only at 9 AM, 12 PM, 5 PM","1 short break at 11 AM (10 mins, walk outside)"]},
      {label:"Recovery Block (1–3 PM)", items:["Lunch — real food, not junk, it affects your 3 PM energy","10–20 min nap or rest if needed (optional but powerful)","Light tasks, admin, messages in this window"]},
      {label:"Evening Block (6–9 PM)", items:["Exercise if you didn't in the morning","Learning — read, watch something that builds a skill, not entertainment","Review: what did I do today? What moves tomorrow?","Wind down: no screens after 9:30 PM"]},
      {label:"Sleep (10–10:30 PM)", items:["Same time every night — this is not optional","Dark, cool room","No phone in the bedroom","You are programming your body's clock. Inconsistency breaks it."]},
    ],
    truth:"The routine is not the destination. It is the container that holds your discipline when motivation is gone. And motivation will always go.",
    links:[
      {label:"Atomic Habits by James Clear",url:"https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299",type:"book"},
      {label:"Freedom — block sites during work blocks",url:"https://freedom.to",type:"tool"},
      {label:"Notion daily planner template (free)",url:"https://www.notion.so/templates/daily-planner",type:"tool"},
      {label:"Structured — visual daily planner app",url:"https://structured.app",type:"tool"},
    ],
  },
  {
    id:"consistency",
    icon:"📅",
    color:"#9b72cf",
    title:"Stay Consistent When Motivation Disappears",
    subtitle:"Motivation is a feeling. Discipline is a decision. Feelings come and go. Decisions hold.",
    body:"Here is what nobody tells you about consistency: you will not feel motivated most of the time. The people you follow online who look disciplined are not motivated every day — they built systems that run even when they feel nothing. The difference between the person who makes it and the person who almost made it is almost never talent. It is the ability to show up on the days when showing up feels pointless.",
    rules:[
      {rule:"Never miss twice", detail:"Miss one day — fine, life happens. Miss two days in a row and you are no longer breaking a streak, you are building a new habit of not showing up. One miss is an exception. Two misses is a pattern. Never let the pattern start."},
      {rule:"Lower the bar on hard days", detail:"Your routine on a hard day does not have to be your routine on a great day. On the days when you can't do everything, do the smallest version. 10 minutes of exercise instead of 45. One paragraph instead of a chapter. Something always beats nothing."},
      {rule:"Track it visibly", detail:"The moment you can see your streak — physically, on a wall, in an app, in a journal — breaking it becomes painful in a way that keeps you honest. What gets measured gets protected. That's why DestinIQ shows your streak every single day."},
      {rule:"Remove the decision", detail:"Every day you have to decide whether to start your routine, you will sometimes decide no. Automate the start: set an alarm, lay out your workout clothes, open your notes app before bed. Make starting require zero decisions."},
      {rule:"Find your why in 10 seconds", detail:"When you don't want to start, give yourself 10 seconds to remember one specific, personal reason you started. Not an abstract goal — a real image. The life you want. The person you're building. Hold it for 10 seconds, then begin."},
    ],
    truth:"Every day you show up when you don't feel like it, you are building the mental proof that you are someone who doesn't quit. That proof is more valuable than any single session.",
    links:[
      {label:"Can't Hurt Me by David Goggins",url:"https://www.amazon.com/Cant-Hurt-Me-Master-Your/dp/1544512287",type:"book"},
      {label:"The Compound Effect by Darren Hardy",url:"https://www.amazon.com/Compound-Effect-Darren-Hardy/dp/159315724X",type:"book"},
      {label:"Streaks — habit tracking app",url:"https://streaksapp.com",type:"tool"},
      {label:"Habitica — gamify your habits",url:"https://habitica.com",type:"tool"},
    ],
  },
  {
    id:"focus",
    icon:"🎯",
    color:"var(--rose)",
    title:"How to Stay Focused When Everything Distracts You",
    subtitle:"Focus is not a personality trait. It is an environment design problem.",
    body:"If you have to rely on willpower to stay focused, you will lose. Your phone was designed by some of the smartest engineers in the world to be more compelling than your goals. You cannot out-discipline a device built to prevent you from doing exactly that. The solution is not more discipline — it is fewer choices. Remove the distraction from reach before the work session starts. What you cannot see, you will not reach for.",
    tactics:[
      {tactic:"The 90-minute block", detail:"Work on one thing for 90 minutes with zero interruptions. Phone in another room (not face down — in another room). Notifications off. This one practice, done 5 days a week, puts you in the top 5% of productive people on Earth. Most people never achieve 90 uninterrupted minutes in a full working day."},
      {tactic:"Grayscale your phone", detail:"Go to Settings → Accessibility → Display → Color Filters → Grayscale. A grey screen is significantly less addictive than a colorful one. Instagram and TikTok without color lose 40% of their pull. Try it for one week and you will not turn it back."},
      {tactic:"No phone in the first 60 minutes", detail:"The most common version of this instruction is ignored because people don't understand why. Here is why: the moment you check your phone, your brain switches from creative/strategic mode into reactive mode. It takes 20 minutes on average to get back. You lose that every morning if you check first thing."},
      {tactic:"Batch your communication", detail:"Check messages, email, and social media at 3 fixed times per day: 9 AM, 1 PM, 5 PM. Outside of those times, they are closed. This alone will recover 2–3 hours of focused work daily that is currently being fragmented by random interruptions."},
      {tactic:"One tab, one task", detail:"Every open browser tab is a pending decision asking for your attention. Work with one tab open at a time. Use a tool like OneTab to collapse everything else. Your screen should show only what you are currently working on."},
    ],
    truth:"The person who can focus for 3 hours a day while everyone else is distracted for 8 hours will produce more in a week than most people produce in a month. Focus is the new superpower.",
    links:[
      {label:"Deep Work by Cal Newport",url:"https://www.amazon.com/Deep-Work-Focused-Success-Distracted/dp/1455586692",type:"book"},
      {label:"Freedom — block distracting websites",url:"https://freedom.to",type:"tool"},
      {label:"One Sec — pause before opening apps",url:"https://one-sec.app",type:"tool"},
      {label:"Forest — stay off your phone while working",url:"https://www.forestapp.cc",type:"tool"},
      {label:"Cold Turkey Blocker",url:"https://getcoldturkey.com",type:"tool"},
    ],
  },
  {
    id:"study",
    icon:"📚",
    color:"var(--gold)",
    title:"How to Study Hard and Actually Retain It",
    subtitle:"Studying hard is not about hours. It is about how you use the hours.",
    body:"Most people study by re-reading and highlighting. Research consistently shows this is one of the least effective methods for actually retaining information. You are not learning — you are recognizing, which feels the same but produces no lasting change. Real learning happens through active recall, spaced repetition, and application. If you can't explain it without looking at it, you don't know it yet.",
    methods:[
      {method:"Active recall", detail:"After reading a section, close the book and write down everything you can remember without looking. This feels harder than re-reading — that's the point. Difficulty during learning is a signal of actual encoding. Use flashcards, Anki, or just a blank page."},
      {method:"The Feynman Technique", detail:"Take any concept you are studying and explain it as if you were teaching it to a 12-year-old. The moment you hit a point where your explanation gets vague, that is the exact gap in your understanding. Go back to that specific gap, learn it, and try again."},
      {method:"Spaced repetition", detail:"Review material 1 day after learning it. Then 3 days later. Then 7 days. Then 21 days. This mirrors how long-term memory is actually built. Cramming fills short-term memory, not long-term. Anki automates this schedule for you."},
      {method:"Study in 45-minute blocks", detail:"45 minutes of focused study, 10–15 minute break. During the break, do nothing related to the material — walk, stretch, do nothing. Your brain consolidates learning during rest, not during more studying. Cramming 4 hours straight is worse than 4 × 45-minute focused blocks."},
      {method:"Teach it immediately", detail:"Within 24 hours of learning something important, teach it to someone — a friend, a family member, even an imaginary student. Teaching exposes exactly what you don't actually understand and forces you to structure what you do. It accelerates retention by a factor of 4x over passive review."},
    ],
    truth:"The student who studies 3 focused hours using the right methods will outperform the student who studies 8 distracted hours every single time. Time is not the variable. Method is.",
    links:[
      {label:"Anki — free spaced repetition flashcards",url:"https://apps.ankiweb.net",type:"tool"},
      {label:"Make It Stick — the science of learning",url:"https://www.amazon.com/Make-Stick-Science-Successful-Learning/dp/0674729013",type:"book"},
      {label:"A Mind for Numbers by Barbara Oakley",url:"https://www.amazon.com/Mind-Numbers-Science-Flunked-Algebra/dp/039916524X",type:"book"},
      {label:"Coursera learning science courses",url:"https://www.coursera.org/learn/learning-how-to-learn",type:"tool"},
    ],
  },
  {
    id:"workout",
    icon:"💪",
    color:"var(--teal)",
    title:"Working Out — The Discipline That Builds All Other Discipline",
    subtitle:"You are not working out for your body. You are working out for your mind.",
    body:"Exercise is the highest-leverage discipline habit that exists. Every time you finish a workout when you didn't want to start one, you have proved to yourself that you can do hard things. That proof transfers. The person who is consistent in their fitness is statistically more likely to be consistent in their work, their relationships, and their finances. Exercise is not a health strategy — it is a character-building practice.",
    plan:[
      {day:"Monday", workout:"Strength (upper body) — 45 mins", notes:"Push-ups, rows, shoulder press. Use bodyweight if you have no gym. Resistance is the stimulus — not the equipment."},
      {day:"Tuesday", workout:"Run or walk — 30 mins", notes:"Moderate pace. This is active recovery and cardiovascular baseline. Not a race."},
      {day:"Wednesday", workout:"Strength (lower body + core) — 45 mins", notes:"Squats, lunges, planks. Core strength is posture, energy, and injury prevention combined."},
      {day:"Thursday", workout:"Rest or light stretch — 20 mins", notes:"Rest is part of the programme. Your muscles grow during rest, not during the workout. Honour this."},
      {day:"Friday", workout:"Full body circuit — 40 mins", notes:"Compound movements: squat, push, pull, hinge. High intensity. Short rest periods."},
      {day:"Saturday", workout:"Long walk or sport — 45–60 mins", notes:"Something you enjoy. A sport, a long walk, a hike. This is movement as living, not movement as obligation."},
      {day:"Sunday", workout:"Complete rest", notes:"Recovery is not weakness. It is the completion of the cycle that makes you stronger."},
    ],
    truth:"You don't need a gym. You don't need equipment. You need your bodyweight and 30–45 minutes. The excuse that you need more than that to start is the reason most people never start.",
    links:[
      {label:"Nike Training Club — free guided workouts",url:"https://www.nike.com/ntc-app",type:"tool"},
      {label:"Bodyweight fitness subreddit (free programme)",url:"https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine/",type:"resource"},
      {label:"Can't Hurt Me by David Goggins",url:"https://www.amazon.com/Cant-Hurt-Me-Master-Your/dp/1544512287",type:"book"},
      {label:"Freeletics — bodyweight training app",url:"https://www.freeletics.com",type:"tool"},
    ],
  },
  {
    id:"mindset_d",
    icon:"🧠",
    color:"#9b72cf",
    title:"Staying Focused When Motivation Fades",
    subtitle:"Motivation is the spark. Discipline is the engine. You need both — but only one is reliable.",
    body:"Motivation is an emotion. Emotions are temporary, inconsistent, and influenced by things completely outside your control — your sleep, the weather, a conversation, a notification. If you are waiting to feel motivated to start, you will wait for a long time, and the days will pass. Discipline is the decision to begin before the feeling arrives. And here is what most people don't know: the feeling usually arrives after you begin, not before.",
    mental_tools:[
      {tool:"The 2-minute rule", detail:"If you don't want to start, commit to just 2 minutes. Just open the book. Just put on your shoes. Just sit at your desk. 90% of the time, starting for 2 minutes turns into a full session. The resistance is in the beginning, not the middle."},
      {tool:"Identity-based motivation", detail:"Instead of saying 'I want to work out,' say 'I am someone who works out.' Instead of 'I want to study,' say 'I am someone who studies every day.' Identity follows behaviour — but behaviour also follows identity. Claim the identity before you've fully earned it, then earn it."},
      {tool:"The 10-year test", detail:"When you don't want to do the work: ask yourself how you will feel about today's choice in 10 years. Not 10 days. 10 years. Almost always, the answer immediately makes the right decision obvious. Future you is always watching."},
      {tool:"Visualise the next 5 minutes, not the goal", detail:"Don't think about the whole run when you're tired. Think about the next 5 minutes. Don't think about finishing the book. Think about the next 2 pages. Breaking the action down to the smallest next step removes the overwhelm that kills momentum."},
    ],
    truth:"The people you most admire for their discipline did not become that way through motivation. They became that way through hundreds of small, invisible choices to begin when they didn't want to — until beginning became automatic.",
    links:[
      {label:"Atomic Habits by James Clear",url:"https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299",type:"book"},
      {label:"Discipline Equals Freedom by Jocko Willink",url:"https://www.amazon.com/Discipline-Equals-Freedom-Field-Manual/dp/1250156089",type:"book"},
      {label:"David Goggins on discipline (YouTube)",url:"https://www.youtube.com/results?search_query=david+goggins+discipline",type:"resource"},
    ],
  },
];

function DailyDisciplineModule({formData, userId, isPaid, onUnlock}){
  const [open,setOpen]=useState(null);
  const name=formData?.name||"";

  return(
    <div className="fu">
      {/* Hero */}
      <div style={{marginBottom:28,padding:"24px",background:"linear-gradient(135deg,rgba(210,175,90,0.07),rgba(196,100,90,0.04))",border:"1px solid var(--line-gold)",borderRadius:18,textAlign:"center"}}>
        <div style={{fontSize:11,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".15em",marginBottom:8}}>YOUR DISCIPLINE SYSTEM</div>
        <div className="d3" style={{marginBottom:10}}>
          {name?"Done with Distractions, "+name+"?":"Done with Distractions?"}<br/>
          <span style={{color:"var(--gold)"}}>Here's the system that replaces them.</span>
        </div>
        <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.75,maxWidth:480,margin:"0 auto"}}>
          Waking up early. Building routines. Studying hard. Working out. Staying focused when motivation fades.
          Every one of these is explained below — deeply, specifically, and with the tools to actually do it.
        </p>
      </div>

      {/* Sections — first 2 free, rest need paid */}
      {/* Free: first 2 sections. Paid: all sections */}
      {(isPaid ? DISCIPLINE_SECTIONS : DISCIPLINE_SECTIONS.slice(0,1)).map(s=>{
          const isOpen=open===s.id;
          return(
            <div key={s.id} style={{background:"var(--lift)",borderRadius:16,border:`1px solid ${isOpen?s.color:"rgba(255,255,255,0.07)"}`,overflow:"hidden",transition:"border-color .25s",marginBottom:10}}>
              {/* Header */}
              <button onClick={()=>setOpen(o=>o===s.id?null:s.id)}
                style={{width:"100%",background:"none",border:"none",padding:"18px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left"}}>
                <div style={{width:44,height:44,borderRadius:12,background:`${s.color}14`,border:`1px solid ${s.color}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                  {s.icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:isOpen?s.color:"var(--cream)",marginBottom:3}}>{s.title}</div>
                  <div style={{fontSize:12,color:"var(--cream-40)",lineHeight:1.5}}>{s.subtitle}</div>
                  {s.wakeTime&&!isOpen&&(
                    <div style={{marginTop:5,display:"inline-flex",alignItems:"center",gap:5,padding:"2px 10px",background:`${s.color}12`,border:`1px solid ${s.color}25`,borderRadius:20}}>
                      <span style={{fontSize:10,fontFamily:"var(--f-mono)",color:s.color,fontWeight:700}}>{s.wakeTime}</span>
                    </div>
                  )}
                </div>
                <div style={{color:s.color,fontSize:18,flexShrink:0,transform:isOpen?"rotate(180deg)":"none",transition:"transform .25s"}}>⌄</div>
              </button>

              {/* Expanded */}
              {isOpen&&(
                <div style={{padding:"0 20px 22px"}}>
                  <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:16}}/>

                  {/* Wake time badge */}
                  {s.wakeTime&&(
                    <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px",background:`${s.color}12`,border:`1px solid ${s.color}28`,borderRadius:24,marginBottom:14}}>
                      <span style={{fontSize:18}}>⏰</span>
                      <span style={{fontSize:13,fontFamily:"var(--f-mono)",color:s.color,fontWeight:700}}>{s.wakeTime}</span>
                    </div>
                  )}

                  <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.8,marginBottom:16}}>{s.body}</p>

                  {/* Hour-by-hour breakdown */}
                  {s.breakdown&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:s.color,letterSpacing:".12em",marginBottom:10}}>HOUR BY HOUR</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {s.breakdown.map((b,i)=>(
                          <div key={i} style={{display:"flex",gap:12,padding:"12px 14px",background:"var(--midnight)",borderRadius:12,border:"1px solid rgba(255,255,255,0.05)"}}>
                            <div style={{flexShrink:0,minWidth:80}}>
                              <div style={{fontSize:10,fontFamily:"var(--f-mono)",color:s.color,fontWeight:700,lineHeight:1.4}}>{b.time}</div>
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:600,color:"var(--cream)",marginBottom:3}}>{b.label}</div>
                              <div style={{fontSize:12,color:"var(--cream-50)",lineHeight:1.6}}>{b.detail}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Routine blocks */}
                  {s.blocks&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:s.color,letterSpacing:".12em",marginBottom:10}}>YOUR DAILY STRUCTURE</div>
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {s.blocks.map((b,i)=>(
                          <div key={i} style={{background:"var(--midnight)",borderRadius:12,padding:"14px",border:`1px solid ${s.color}18`}}>
                            <div style={{fontSize:12,fontWeight:700,color:s.color,marginBottom:8,fontFamily:"var(--f-mono)"}}>{b.label}</div>
                            {b.items.map((item,j)=>(
                              <div key={j} style={{display:"flex",gap:8,marginBottom:5}}>
                                <span style={{color:s.color,fontSize:9,marginTop:4,flexShrink:0}}>◎</span>
                                <span style={{fontSize:12,color:"var(--cream-60)",lineHeight:1.65}}>{item}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rules / Tactics / Methods / Plan */}
                  {(s.rules||s.tactics||s.methods||s.mental_tools)&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:s.color,letterSpacing:".12em",marginBottom:10}}>
                        {s.rules?"THE RULES":s.tactics?"THE TACTICS":s.methods?"THE METHODS":"MENTAL TOOLS"}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {(s.rules||s.tactics||s.methods||s.mental_tools).map((item,i)=>{
                          const label=item.rule||item.tactic||item.method||item.tool;
                          const detail=item.detail;
                          return(
                            <div key={i} style={{background:"var(--midnight)",borderRadius:12,padding:"12px 14px",border:"1px solid rgba(255,255,255,0.05)"}}>
                              <div style={{fontSize:13,fontWeight:700,color:"var(--cream)",marginBottom:5}}>{i+1}. {label}</div>
                              <div style={{fontSize:12,color:"var(--cream-50)",lineHeight:1.7}}>{detail}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Workout plan */}
                  {s.plan&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:s.color,letterSpacing:".12em",marginBottom:10}}>WEEKLY WORKOUT PLAN</div>
                      <div style={{display:"flex",flexDirection:"column",gap:7}}>
                        {s.plan.map((day,i)=>(
                          <div key={i} style={{display:"flex",gap:12,padding:"11px 14px",background:"var(--midnight)",borderRadius:11,border:"1px solid rgba(255,255,255,0.05)",alignItems:"flex-start"}}>
                            <div style={{flexShrink:0,minWidth:88}}>
                              <div style={{fontSize:11,fontFamily:"var(--f-mono)",color:s.color,fontWeight:700}}>{day.day}</div>
                            </div>
                            <div>
                              <div style={{fontSize:13,fontWeight:600,color:"var(--cream)",marginBottom:2}}>{day.workout}</div>
                              <div style={{fontSize:11,color:"var(--cream-40)",lineHeight:1.55}}>{day.notes}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* The hard truth */}
                  <div style={{padding:"14px 16px",background:`${s.color}07`,borderLeft:`3px solid ${s.color}`,borderRadius:"0 12px 12px 0",marginBottom:14}}>
                    <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:s.color,letterSpacing:".12em",marginBottom:6}}>THE TRUTH</div>
                    <p style={{fontSize:13,color:"var(--cream-50)",margin:0,lineHeight:1.75,fontStyle:"italic"}}>{s.truth}</p>
                  </div>

                  {/* Resource links */}
                  <ResourceLinks links={s.links} accentColor={s.color}/>
                  <HabitButton itemKey={`discipline:${s.id}`} userId={userId}/>
                  <AudioPlayer text={`${s.title}. ${s.body}`} label="Listen" mini={false}/>
                </div>
              )}
            </div>
          );
        })}
      <FreeGate total={DISCIPLINE_SECTIONS.length} freeCount={1} isPaid={isPaid} onUnlock={onUnlock} label="discipline sections"/>

      {/* Bottom CTA */}
      <div style={{marginTop:28,padding:"22px 20px",background:"var(--raised)",border:"1px solid var(--line-gold)",borderRadius:16,textAlign:"center"}}>
        <div style={{fontSize:22,marginBottom:10}}>🏁</div>
        <div style={{fontSize:15,fontWeight:700,color:"var(--cream)",marginBottom:8}}>
          This is the FYP you actually need{name?`, ${name}`:""}
        </div>
        <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.75,maxWidth:400,margin:"0 auto 16px"}}>
          Not 60-second clips that feel good for a moment and then disappear. 
          A complete, deeply explained system you can open any day and execute.
          Your DestinIQ streak is the proof you're living it.
        </p>
        <div style={{marginBottom:14,padding:"12px 16px",background:"rgba(210,175,90,0.06)",borderRadius:10,border:"1px solid rgba(210,175,90,0.15)"}}>
          <p style={{fontSize:13,color:"var(--gold)",fontStyle:"italic",lineHeight:1.7,margin:"0 0 4px 0"}}>
            &ldquo;Motivation is what gets you started. Habit is what keeps you going.&rdquo;
          </p>
          <p style={{fontSize:10,color:"var(--cream-30)",fontFamily:"var(--f-mono)",margin:0}}>— Jim Rohn</p>
        </div>
        <div style={{fontFamily:"var(--f-mono)",fontSize:11,color:"var(--gold)",letterSpacing:".1em"}}>
          ◎ CHECK IN DAILY · TRACK YOUR STREAK · BUILD THE LIFE
        </div>
      </div>
    </div>
  );
}

const INVEST_SECTIONS=[
  {
    id:"study",
    icon:"📚",
    color:"var(--gold)",
    title:"Study Obsession",
    subtitle:"Your 20s decide your 40s — what you pour in now compounds for decades.",
    body:"Read biographies of the greats — Steve Jobs, Elon Musk, Rockefeller, Oprah, Howard Schultz, Jim Rohn. Not to worship them. To study their patterns. Jim Rohn taught this principle better than anyone: 'Formal education will make you a living. Self-education will make you a fortune.' Success leaves clues. You learn what actually worked in real life — their morning routines, how they handled rejection, the decisions they made at 25 that changed everything. Most legendary careers were not lucky accidents. They were the result of compounding small, obsessive inputs over years.",
    habits:[
      "Read 1 biography or autobiography per month — not self-help, actual life stories of people who built something.",
      "Keep a pattern journal: write down 1 pattern you noticed in what you read each week.",
      "Study failures as hard as successes — what did they do at the moment it nearly fell apart?",
      "Pick one mentor dead or alive and study them deeply for 90 days before moving to the next.",
    ],
    why:"Why it works: you compress decades of experience into weeks. You stop making beginner mistakes that people before you already made and documented.",
    links:[
      {label:"Steve Jobs by Walter Isaacson",url:"https://www.amazon.com/Steve-Jobs-Walter-Isaacson/dp/1451648537",type:"book"},
      {label:"Elon Musk by Walter Isaacson",url:"https://www.amazon.com/Elon-Musk-Walter-Isaacson/dp/1982181281",type:"book"},
      {label:"Titan: The Life of John D. Rockefeller",url:"https://www.amazon.com/Titan-Life-John-Rockefeller-Sr/dp/1400077303",type:"book"},
      {label:"The Autobiography of Malcolm X",url:"https://www.amazon.com/Autobiography-Malcolm-Told-Alex-Haley/dp/0345350685",type:"book"},
      {label:"Becoming by Michelle Obama",url:"https://www.amazon.com/Becoming-Michelle-Obama/dp/1524763136",type:"book"},
      {label:"Pour Your Heart Into It by Howard Schultz",url:"https://www.amazon.com/Pour-Your-Heart-Into-Starbucks/dp/0786883561",type:"book"},
      {label:"Browse all biographies on Goodreads",url:"https://www.goodreads.com/shelf/show/biography",type:"resource"},
    ],
  },
  {
    id:"body",
    icon:"⚡",
    color:"var(--teal)",
    title:"Obsess Over Energy",
    subtitle:"Your body is your highest-return investment. Protect it like your most valuable asset.",
    body:"Everything — discipline, creativity, focus, emotional control — runs on energy. Sleep 7–8 hours like your career depends on it, because it does. Exercise 4–5 times a week, not for aesthetics but for cognitive performance. What you eat determines how clearly you think at 3pm. Most people negotiate their energy away for short-term comfort and then wonder why they can't execute on their goals.",
    habits:[
      "Sleep before midnight. Non-negotiable. Your prefrontal cortex — the part that makes decisions — degrades fast on poor sleep.",
      "Exercise in the morning, before the world asks things of you. Even 30 minutes changes your entire day.",
      "Cut one thing from your diet that you know is draining you. Not everything — just one thing this month.",
      "Track your energy hourly for one week. You will immediately see the patterns that are costing you hours of output.",
    ],
    why:"Why it works: high-energy people outperform high-talent people. You can outwork smarter people if you protect your engine.",
    links:[
      {label:"Why We Sleep by Matthew Walker",url:"https://www.amazon.com/Why-We-Sleep-Unlocking-Dreams/dp/1501144316",type:"book"},
      {label:"Atomic Habits by James Clear",url:"https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299",type:"book"},
      {label:"Huberman Lab Podcast (free, science-based)",url:"https://www.hubermanlab.com/podcast",type:"resource"},
      {label:"Nike Training Club — free workouts",url:"https://www.nike.com/ntc-app",type:"tool"},
      {label:"MyFitnessPal — track food & energy",url:"https://www.myfitnesspal.com",type:"tool"},
    ],
  },
  {
    id:"skills",
    icon:"🛠️",
    color:"#9b72cf",
    title:"Stack High-Income Skills",
    subtitle:"One skill makes you employable. A stack of 2–3 rare skills makes you irreplaceable.",
    body:"Pick skills that compound and are hard to outsource: sales, persuasion, writing, coding, design, leadership, public speaking, negotiation. Then layer them. A programmer who can also sell is 10x more valuable than a programmer who only codes. A designer who can write copy commands double the rates. Your 20s are the lowest-cost time to acquire these skills — you have time, low obligations, and the brain plasticity to absorb new things fast.",
    habits:[
      "Spend 1 hour daily learning a skill that will be worth more in 5 years than it is today.",
      "Teach what you learn immediately — tutoring, content, or just explaining to a friend. Teaching is the fastest form of retention.",
      "Take on projects that scare you slightly — just beyond your current ability is where growth happens fastest.",
      "Build a portfolio, not just a CV. Evidence of work beats claims about work every time.",
    ],
    why:"Why it works: skills are the only asset that can't be taken from you, and the compounding is silent but violent.",
    links:[
      {label:"Coursera — accredited online courses",url:"https://www.coursera.org",type:"tool"},
      {label:"freeCodeCamp — learn coding free",url:"https://www.freecodecamp.org",type:"tool"},
      {label:"Canva Design School — free design training",url:"https://www.canva.com/learn/",type:"tool"},
      {label:"Copywriting course by CopyHackers (free articles)",url:"https://copyhackers.com/blog/",type:"resource"},
      {label:"Toastmasters — public speaking clubs worldwide",url:"https://www.toastmasters.org/find-a-club",type:"tool"},
      {label:"The Lean Startup by Eric Ries",url:"https://www.amazon.com/Lean-Startup-Entrepreneurs-Continuous-Innovation/dp/0307887898",type:"book"},
      {label:"$100M Offers by Alex Hormozi",url:"https://www.amazon.com/100M-Offers-People-Stupid-Saying/dp/B09X4BXFJ8",type:"book"},
    ],
  },
  {
    id:"network",
    icon:"🔗",
    color:"var(--rose)",
    title:"Network Mathematics",
    subtitle:"You are the average of the 5 people you spend most time with. Choose them like your life depends on it.",
    body:"Your network is not just who you know — it is what you believe is possible. Spend time with people who are building, who read, who have real standards for themselves, and your own standards quietly rise. Spend time with people who complain, who settle, who see ambition as arrogance — and your ceiling drops without you noticing. The math is ruthless: one right introduction can do what 10 years of solo effort cannot.",
    habits:[
      "Every month, reach out to one person you admire who is 5–10 years ahead of where you want to be. Not to ask for anything. Just to connect.",
      "Give before you take — show up with value, a resource, an observation, something useful. Transactions come much later.",
      "Audit your 5 closest people every 6 months. Not to cut people harshly, but to be honest about who is pulling you forward.",
      "Go to one event, conference, or gathering in your field every quarter. Most of your best opportunities will come from a room.",
    ],
    why:"Why it works: talent and hardwork get you to a certain level. Network gets you the rest of the way.",
    links:[
      {label:"LinkedIn — connect with your industry",url:"https://www.linkedin.com",type:"tool"},
      {label:"Meetup — find local professional events",url:"https://www.meetup.com",type:"tool"},
      {label:"Lunchclub — AI-matched networking",url:"https://lunchclub.com",type:"tool"},
      {label:"Never Eat Alone by Keith Ferrazzi",url:"https://www.amazon.com/Never-Eat-Alone-Secrets-Relationship/dp/0385346654",type:"book"},
      {label:"How to Win Friends & Influence People",url:"https://www.amazon.com/How-Win-Friends-Influence-People/dp/0671027034",type:"book"},
      {label:"Eventbrite — find conferences near you",url:"https://www.eventbrite.com",type:"tool"},
    ],
  },
  {
    id:"money",
    icon:"💸",
    color:"var(--gold)",
    title:"Make Your Money Move Before You Do",
    subtitle:"Spending is easy. Building wealth is a skill. Start in your 20s or pay in your 40s.",
    body:"The single biggest financial mistake of the 20s: treating savings as what's left after spending, instead of what comes out first. Pay yourself first — 20% off the top before you touch a single cedi, naira, dollar, or pound. Then make that money work: index funds, a skill that generates income, a small side business. Compound interest is not a metaphor. It is a machine that runs 24 hours a day — but only if you start it early.",
    habits:[
      "Save at least 20% of every single income — no matter how small. Make it automatic so it's not a decision.",
      "Learn one investment vehicle this year — index funds, real estate basics, or a simple business model. One. Deeply.",
      "Avoid lifestyle inflation aggressively in your 20s. The car, the apartment upgrade, the clothing — that money invested now is worth 10x at 40.",
      "Track every major expense for 30 days. You will find at least 2–3 things you're paying for that give you zero real return.",
    ],
    why:"Why it works: starting at 22 vs 32 in compound growth is not a 10-year difference — it is a 300–500% difference in outcome.",
    links:[
      {label:"The Psychology of Money by Morgan Housel",url:"https://www.amazon.com/Psychology-Money-Timeless-Lessons-Happiness/dp/0857197681",type:"book"},
      {label:"I Will Teach You to Be Rich by Ramit Sethi",url:"https://www.amazon.com/Will-Teach-You-Rich-Second/dp/1523505745",type:"book"},
      {label:"Rich Dad Poor Dad by Robert Kiyosaki",url:"https://www.amazon.com/Rich-Dad-Poor-Teach-Middle/dp/1612680194",type:"book"},
      {label:"Investopedia — free financial education",url:"https://www.investopedia.com",type:"resource"},
      {label:"YNAB — budgeting tool (You Need A Budget)",url:"https://www.youneedabudget.com",type:"tool"},
      {label:"Compound interest calculator",url:"https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator",type:"tool"},
    ],
  },
  {
    id:"create",
    icon:"✏️",
    color:"var(--teal)",
    title:"Create, Don't Just Consume",
    subtitle:"Consumers pay. Creators get paid. Your 20s are your cheapest time to become a creator.",
    body:"Every hour you spend scrolling, watching, and consuming, someone else is building the thing you wish you had built. Creation — writing, building, making, teaching, designing — is how you turn what you know into leverage. You do not need to be perfect to start. You need to start to get good. The creator who ships imperfect work consistently crushes the person who is perfecting something in private.",
    habits:[
      "Create something every single day — a post, a paragraph, a prototype, a line of code, a sketch. Something.",
      "Ship before you feel ready. Waiting for perfect is waiting forever. Version 1 always beats Version Never.",
      "Build in public — share your process, your learning, your failures. People trust builders who show their work.",
      "Pick one medium to master this year: writing, video, audio, or code. One. Go deep before going wide.",
    ],
    why:"Why it works: creation compounds. Your 100th post teaches you things your 1st post never could. The reps are the lesson.",
    links:[
      {label:"Ghost — start a newsletter or blog",url:"https://ghost.org",type:"tool"},
      {label:"Substack — write and get paid",url:"https://substack.com",type:"tool"},
      {label:"YouTube — publish your ideas as video",url:"https://www.youtube.com/upload",type:"tool"},
      {label:"GitHub — build and share code projects",url:"https://github.com",type:"tool"},
      {label:"Show Your Work by Austin Kleon",url:"https://www.amazon.com/Show-Your-Work-Austin-Kleon/dp/076117897X",type:"book"},
      {label:"The War of Art by Steven Pressfield",url:"https://www.amazon.com/War-Art-Through-Creative-Battles/dp/1936891026",type:"book"},
    ],
  },
  {
    id:"routine",
    icon:"⏰",
    color:"var(--gold)",
    title:"Ruthless Routine",
    subtitle:"Motivation gets you started. Routine keeps you going when motivation disappears — and it will.",
    body:"Discipline is not a personality trait. It is a system. Successful people do not rely on feeling motivated — they build environments and routines that make good behavior the default. Your morning decides your day. Your week structure decides your month. Your habits, repeated 300 times, decide your year. The goal is to make your best version the path of least resistance, not the heroic effort.",
    habits:[
      "Design your morning before you sleep — know exactly what you will do first when you wake up. Remove the decision.",
      "Block time for your most important work first, before email, before social media, before anything reactive.",
      "End every day with a 5-minute review: what did I do, what moved forward, what needs to move tomorrow.",
      "Protect your routine like a meeting you cannot miss — because it is the most important meeting of your day.",
    ],
    why:"Why it works: willpower depletes. Systems don't. A person with a strong routine at 60% motivation outperforms a person relying on inspiration at 100%.",
    links:[
      {label:"Atomic Habits by James Clear",url:"https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299",type:"book"},
      {label:"The Miracle Morning by Hal Elrod",url:"https://www.amazon.com/Miracle-Morning-Not-So-Obvious-Guaranteed-Transform/dp/0979019710",type:"book"},
      {label:"Notion — free routine & planning template",url:"https://www.notion.so/templates/daily-planner",type:"tool"},
      {label:"Todoist — daily task management",url:"https://todoist.com",type:"tool"},
      {label:"Cal Newport — Deep Work (free articles)",url:"https://calnewport.com/blog/",type:"resource"},
      {label:"My Morning Routine — real routines from successful people",url:"https://mymorningroutine.com",type:"resource"},
    ],
  },
];

// ── ResourceLinks: shared link card renderer used across all 3 modules ────────
const LINK_TYPE_META={
  book:    {emoji:"📖", label:"Book",     bg:"rgba(210,175,90,0.08)",  border:"rgba(210,175,90,0.2)",  color:"var(--gold)"},
  resource:{emoji:"🔗", label:"Resource", bg:"rgba(31,168,154,0.08)",  border:"rgba(31,168,154,0.2)",  color:"var(--teal)"},
  tool:    {emoji:"🛠", label:"Tool",     bg:"rgba(155,114,207,0.08)", border:"rgba(155,114,207,0.2)", color:"#9b72cf"},
};
function ResourceLinks({links, accentColor}){
  if(!links||links.length===0) return null;
  return(
    <div style={{marginTop:16}}>
      <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:accentColor||"var(--gold)",letterSpacing:".12em",marginBottom:10}}>
        START HERE — DIRECT LINKS
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {links.map((lk,i)=>{
          const meta=LINK_TYPE_META[lk.type]||LINK_TYPE_META.resource;
          return(
            <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
              style={{
                display:"flex",alignItems:"center",gap:10,
                padding:"10px 14px",
                background:meta.bg,
                border:`1px solid ${meta.border}`,
                borderRadius:10,
                textDecoration:"none",
                transition:"opacity .15s",
              }}
              onMouseEnter={e=>e.currentTarget.style.opacity=".75"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}
            >
              <span style={{fontSize:15,flexShrink:0}}>{meta.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"var(--cream)",fontWeight:500,lineHeight:1.4}}>{lk.label}</div>
              </div>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:meta.border,color:meta.color,fontFamily:"var(--f-mono)",flexShrink:0,letterSpacing:".05em"}}>
                {meta.label} ↗
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function InvestInYourselfModule({formData, userId, isPaid, onUnlock}){
  const [open,setOpen]=useState(null);
  const toggleAccordion=(id)=>setOpen(o=>o===id?null:id);
  return(
    <div className="fu">
      <div style={{marginBottom:28}}>
        <div className="d3" style={{marginBottom:8}}>Invest In Yourself{formData?.name?`, ${formData.name}`:""} — Your 20s Decide Your 40s</div>
        <p style={{fontSize:14,color:"var(--cream-50)",lineHeight:1.75,maxWidth:620}}>
          The highest-return investments you can make are not in stocks or real estate — they're in yourself.
          What you build{formData?.age&&parseInt(formData.age)<=35?" in the next few years":" starting now"} is the foundation everything else sits on.
          {formData?.country?` In ${formData.country}, the people who compound these habits fastest are the ones who start before they feel ready.`:` These are the inputs that compound.`}
        </p>
        {formData?.goals&&(
          <div style={{marginTop:14,padding:"12px 16px",background:"rgba(210,175,90,0.06)",border:"1px solid var(--line-gold)",borderRadius:10,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{color:"var(--gold)",flexShrink:0,marginTop:2}}>◎</span>
            <p style={{fontSize:13,color:"var(--cream-50)",margin:0,lineHeight:1.65}}>
              Your goal: <em style={{color:"var(--cream-70)"}}>&ldquo;{formData.goals}&rdquo;</em> — every section below feeds directly into that.
            </p>
          </div>
        )}
      </div>

      {(isPaid ? INVEST_SECTIONS : INVEST_SECTIONS.slice(0,1)).map(s=>{
          const isOpen=open===s.id;
          return(
            <div key={s.id} style={{background:"var(--lift)",borderRadius:16,border:`1px solid ${isOpen?s.color:"rgba(255,255,255,0.07)"}`,overflow:"hidden",transition:"border-color .25s",marginBottom:12}}>
              {/* Header */}
              <button onClick={()=>toggleAccordion(s.id)} style={{width:"100%",background:"none",border:"none",padding:"18px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left"}}>
                <div style={{width:42,height:42,borderRadius:12,background:`${s.color}15`,border:`1px solid ${s.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{s.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:"var(--cream)",marginBottom:3}}>{s.title}</div>
                  <div style={{fontSize:12,color:"var(--cream-40)",lineHeight:1.5}}>{s.subtitle}</div>
                </div>
                <div style={{color:s.color,fontSize:18,flexShrink:0,transform:isOpen?"rotate(180deg)":"none",transition:"transform .25s"}}>⌄</div>
              </button>

              {/* Expanded content */}
              {isOpen&&(
                <div style={{padding:"0 20px 20px"}}>
                  <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:16}}/>
                  <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.8,marginBottom:16}}>{s.body}</p>

                  {/* Daily habits */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:s.color,letterSpacing:".12em",marginBottom:10}}>WHAT TO ACTUALLY DO</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {s.habits.map((h,i)=>(
                        <div key={i} style={{display:"flex",gap:10,padding:"10px 14px",background:"var(--midnight)",borderRadius:10,border:"1px solid rgba(255,255,255,0.05)"}}>
                          <div style={{width:22,height:22,borderRadius:"50%",background:`${s.color}15`,border:`1px solid ${s.color}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"var(--f-mono)",fontSize:9,color:s.color,fontWeight:700}}>{i+1}</div>
                          <p style={{fontSize:13,color:"var(--cream-60)",margin:0,lineHeight:1.65}}>{h}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Why it works */}
                  <div style={{padding:"12px 16px",background:`${s.color}08`,borderLeft:`2px solid ${s.color}`,borderRadius:"0 10px 10px 0"}}>
                    <p style={{fontSize:13,color:"var(--cream-50)",margin:0,lineHeight:1.7,fontStyle:"italic"}}>{s.why}</p>
                  </div>

                  <ResourceLinks links={s.links} accentColor={s.color}/>
                  <HabitButton itemKey={`invest:${s.id}`} userId={userId}/>
                  <AudioPlayer text={`${s.title}. ${s.body} ${s.habits.join(". ")}`} label="Listen" mini={false}/>
                </div>
              )}
            </div>
          );
        })}
      <FreeGate total={INVEST_SECTIONS.length} freeCount={1} isPaid={isPaid} onUnlock={onUnlock} label="invest sections"/>

      {/* Bottom quote */}
      <div style={{marginTop:32,padding:"24px",background:"var(--raised)",border:"1px solid var(--line-gold)",borderRadius:16,textAlign:"center"}}>
        <p style={{fontFamily:"var(--f-display)",fontSize:18,fontStyle:"italic",color:"var(--gold)",lineHeight:1.6,margin:0}}>
          &ldquo;The best time to plant a tree was 20 years ago. The second best time is today.&rdquo;
        </p>
        <p style={{fontSize:11,color:"var(--cream-30)",fontFamily:"var(--f-mono)",marginTop:8}}>Your compound interest starts the moment you start.</p>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// DISGUSTINGLY SUCCESSFUL MODULE
// Not lucky. Not gifted. Just following the right rules.
// ═══════════════════════════════════════════════════════════════════════════════
const SUCCESS_RULES=[
  {
    number:"01",
    color:"var(--gold)",
    title:"Study Obsession",
    hook:"Read biographies of the greats. Not to worship them. To steal their patterns.",
    detail:"Steve Jobs. Elon Musk. Rockefeller. Oprah. Howard Schultz. Katherine Johnson. These people were not just talented — they were patterned. They made specific choices, at specific moments, that changed everything. When you read their actual stories, not the highlight reels, you see the patterns: they worked when others rested, they obsessed when others kept things balanced, they were willing to look stupid before they looked brilliant. Success leaves clues. You can steal from people who already figured it out.",
    actions:[
      "Read 1 real biography per month — not summaries, the full book.",
      "After each one, write 3 patterns you noticed. What did they all do that most people don't?",
      "Pick 1 mistake they made and figure out if you are currently making the same one.",
    ],
    links:[
      {label:"Steve Jobs by Walter Isaacson",url:"https://www.amazon.com/Steve-Jobs-Walter-Isaacson/dp/1451648537",type:"book"},
      {label:"Elon Musk by Walter Isaacson",url:"https://www.amazon.com/Elon-Musk-Walter-Isaacson/dp/1982181281",type:"book"},
      {label:"The Art of Exceptional Living — Jim Rohn",url:"https://www.amazon.com/Art-Exceptional-Living-Jim-Rohn/dp/B00005A5ZB",type:"book"},
      {label:"Jim Rohn — The Day That Turns Your Life Around (YouTube)",url:"https://www.youtube.com/results?search_query=jim+rohn+turn+your+life+around",type:"resource"},
      {label:"Titan: Life of John D. Rockefeller Sr.",url:"https://www.amazon.com/Titan-Life-John-Rockefeller-Sr/dp/1400077303",type:"book"},
      {label:"Goodreads — browse top biographies",url:"https://www.goodreads.com/shelf/show/biography",type:"resource"},
    ],
  },
  {
    number:"02",
    color:"var(--teal)",
    title:"Ruthless Routine",
    hook:"Motivation is a visitor. Discipline is a resident. Build the system that runs when you don't feel like it.",
    detail:"Every high performer you study has a morning routine, an output quota, a non-negotiable block of deep work. They are not more motivated than you. They designed environments and systems that make their best work the default behavior. Your feelings are unreliable. Your calendar is not. Structure your day so that your most important work happens first, before the world gets its hands on your attention.",
    actions:[
      "Design your ideal morning and run it for 21 days straight — no modification, just execute.",
      "Block 2–3 hours of uninterrupted deep work daily — guard it like a meeting with your largest client.",
      "End each day with a 5-minute review: did today move you forward or just keep you busy?",
    ],
    links:[
      {label:"Atomic Habits by James Clear",url:"https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299",type:"book"},
      {label:"Deep Work by Cal Newport",url:"https://www.amazon.com/Deep-Work-Focused-Success-Distracted/dp/1455586692",type:"book"},
      {label:"My Morning Routine — real routines from top performers",url:"https://mymorningroutine.com",type:"resource"},
      {label:"Notion daily planner template (free)",url:"https://www.notion.so/templates/daily-planner",type:"tool"},
    ],
  },
  {
    number:"03",
    color:"#9b72cf",
    title:"Network Mathematics",
    hook:"One right introduction beats 10 years of solo effort. The math is real.",
    detail:"Your network is not who you know. It is what you believe is possible. The people around you define your ceiling, whether you notice it or not. The ambitious person who surrounds themselves with builders starts to believe bigger without trying. The talented person who stays in a circle of complainers slowly loses the ambition they started with. Upgrade your environment, and your results follow automatically — even before you do any more work.",
    actions:[
      "Reach out to one person you admire every month — no ask, just genuine connection.",
      "Attend one event or gathering in your field every quarter. Your next opportunity will come from a room.",
      "Give before you take — show up with value, ideas, connections. Transactions come much later.",
    ],
    links:[
      {label:"LinkedIn — connect with your industry",url:"https://www.linkedin.com",type:"tool"},
      {label:"Never Eat Alone by Keith Ferrazzi",url:"https://www.amazon.com/Never-Eat-Alone-Secrets-Relationship/dp/0385346654",type:"book"},
      {label:"Lunchclub — AI-matched 1:1 networking",url:"https://lunchclub.com",type:"tool"},
      {label:"Eventbrite — find events in your field",url:"https://www.eventbrite.com",type:"tool"},
      {label:"Meetup — local professional groups",url:"https://www.meetup.com",type:"tool"},
    ],
  },
  {
    number:"04",
    color:"var(--rose)",
    title:"Create, Don't Consume",
    hook:"Consumers pay. Creators get paid. Stop feeding algorithms and start building things.",
    detail:"Every hour you spend consuming, someone else is building the thing you wish you had created. Writing, building, designing, teaching, making — this is how you convert what you know into leverage. Creation is also the fastest path to clarity. You don't know what you think until you write it. You don't know if an idea works until you build it. The creator who ships imperfect work consistently beats the perfectionist who never finishes.",
    actions:[
      "Create something every day — a post, a paragraph, a prototype, a line of code. Even if nobody sees it.",
      "Ship before you are ready. Done is the engine of more. Perfect is the enemy of real.",
      "Pick one medium to master this year: writing, video, audio, or code. One. Go very deep.",
    ],
    links:[
      {label:"Substack — write and earn from your audience",url:"https://substack.com",type:"tool"},
      {label:"Ghost — professional blog & newsletter",url:"https://ghost.org",type:"tool"},
      {label:"GitHub — share your code projects",url:"https://github.com",type:"tool"},
      {label:"Show Your Work by Austin Kleon",url:"https://www.amazon.com/Show-Your-Work-Austin-Kleon/dp/076117897X",type:"book"},
      {label:"The War of Art by Steven Pressfield",url:"https://www.amazon.com/War-Art-Through-Creative-Battles/dp/1936891026",type:"book"},
    ],
  },
  {
    number:"05",
    color:"var(--gold)",
    title:"Obsess Over Energy",
    hook:"You cannot build an empire running on empty. Your body is not a cost — it is your infrastructure.",
    detail:"Sleep, movement, nutrition, and mental recovery are not indulgences — they are performance inputs. A well-rested, physically active person with average talent will outperform a brilliant, depleted person almost every time. You cannot think clearly, make good decisions, or sustain long-term effort on 5 hours of sleep and zero movement. This is not wellness advice. It is performance strategy.",
    actions:[
      "Protect 7–8 hours of sleep — especially during your most important work phases.",
      "Move your body for at least 30 minutes daily. The cognitive benefits alone are worth it.",
      "Audit your energy for 7 days: rate yourself every 3 hours. Find the patterns that are costing you output.",
    ],
    links:[
      {label:"Why We Sleep by Matthew Walker",url:"https://www.amazon.com/Why-We-Sleep-Unlocking-Dreams/dp/1501144316",type:"book"},
      {label:"Huberman Lab Podcast — free science-based health show",url:"https://www.hubermanlab.com/podcast",type:"resource"},
      {label:"Nike Training Club — free workouts",url:"https://www.nike.com/ntc-app",type:"tool"},
      {label:"Eight Sleep — sleep tracking (resource)",url:"https://www.eightsleep.com/blog/sleep-performance/",type:"resource"},
    ],
  },
];

const SUCCESS_TRUTH={
  title:"The Final Truth",
  lines:[
    "Disgusting success is built daily. Not emotionally. Not randomly. Systematically.",
    "The person who shows up without motivation and executes their system beats the inspired person who acts only when they feel like it.",
    "You don't need luck. You need a repeatable process, applied with obsessive consistency, for longer than most people are willing to go.",
    "The rules are not a secret. Everyone has access to them. The difference is who actually follows them.",
  ],
};

function DisgustinglySuccessfulModule({formData, userId, isPaid, onUnlock}){
  const [open,setOpen]=useState(null);
  return(
    <div className="fu">
      {/* Hero */}
      <div style={{marginBottom:32,padding:"28px 24px",background:"linear-gradient(135deg,rgba(210,175,90,0.08),rgba(20,184,154,0.04))",border:"1px solid var(--line-gold)",borderRadius:18,textAlign:"center"}}>
        <div style={{fontSize:11,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".15em",marginBottom:10}}>THE REAL PLAYBOOK</div>
        <div className="d2" style={{marginBottom:12,fontSize:"clamp(22px,4vw,32px)"}}>
          How to Become Disgustingly Successful{formData?.name?`, ${formData.name}`:""}
        </div>
        <p style={{fontSize:14,color:"var(--cream-50)",lineHeight:1.75,maxWidth:520,margin:"0 auto"}}>
          Not lucky. Not gifted. Just following the right rules — and following them when no one is watching,
          when it's not working yet, and when it would be much easier to stop.
          {formData?.challenge?` You said your challenge is "${formData.challenge.slice(0,80)}${formData.challenge.length>80?"…":""}". Every rule below is a direct answer to that.`:""}
        </p>
      </div>

      {/* Rules — first 2 free */}
      <div style={{marginBottom:32}}>
      {(isPaid ? SUCCESS_RULES : SUCCESS_RULES.slice(0,1)).map(r=>{
          const isOpen=open===r.number;
          return(
            <div key={r.number} style={{background:"var(--lift)",borderRadius:16,border:`1px solid ${isOpen?r.color:"rgba(255,255,255,0.07)"}`,overflow:"hidden",transition:"border-color .25s",marginBottom:12}}>
              <button onClick={()=>setOpen(o=>o===r.number?null:r.number)} style={{width:"100%",background:"none",border:"none",padding:"18px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left"}}>
                <div style={{width:42,height:42,borderRadius:12,background:`${r.color}12`,border:`1px solid ${r.color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--f-mono)",fontSize:13,fontWeight:700,color:r.color,flexShrink:0}}>{r.number}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:"var(--cream)",marginBottom:3}}>{r.title}</div>
                  <div style={{fontSize:12,color:"var(--cream-40)",lineHeight:1.5,fontStyle:"italic"}}>"{r.hook}"</div>
                </div>
                <div style={{color:r.color,fontSize:18,flexShrink:0,transform:isOpen?"rotate(180deg)":"none",transition:"transform .25s"}}>⌄</div>
              </button>
              {isOpen&&(
                <div style={{padding:"0 20px 20px"}}>
                  <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:16}}/>
                  <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.8,marginBottom:16}}>{r.detail}</p>
                  <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:r.color,letterSpacing:".12em",marginBottom:10}}>EXECUTE THIS WEEK</div>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {r.actions.map((a,i)=>(
                      <div key={i} style={{display:"flex",gap:10,padding:"10px 14px",background:"var(--midnight)",borderRadius:10,border:"1px solid rgba(255,255,255,0.05)"}}>
                        <div style={{width:22,height:22,borderRadius:"50%",background:`${r.color}12`,border:`1px solid ${r.color}25`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"var(--f-mono)",fontSize:9,color:r.color,fontWeight:700}}>{i+1}</div>
                        <p style={{fontSize:13,color:"var(--cream-60)",margin:0,lineHeight:1.65}}>{a}</p>
                      </div>
                    ))}
                  </div>
                  <ResourceLinks links={r.links} accentColor={r.color}/>
                  <HabitButton itemKey={`success:${r.number}`} userId={userId}/>
                  <AudioPlayer text={`Rule ${r.number}: ${r.title}. ${r.detail}`} label="Listen" mini={false}/>
                </div>
              )}
            </div>
          );
        })}
      <FreeGate total={SUCCESS_RULES.length} freeCount={1} isPaid={isPaid} onUnlock={onUnlock} label="success rules"/>
      </div>

      {/* Final Truth */}
      <div style={{padding:"24px",background:"var(--raised)",border:"1px solid var(--line-gold)",borderRadius:18}}>
        <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".15em",marginBottom:14}}>THE FINAL TRUTH</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {SUCCESS_TRUTH.lines.map((l,i)=>(
            <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <span style={{color:"var(--gold)",fontSize:10,marginTop:4,flexShrink:0}}>◎</span>
              <p style={{fontSize:14,color:i===0?"var(--cream)":"var(--cream-60)",fontWeight:i===0?600:400,lineHeight:1.75,margin:0}}>{l}</p>
            </div>
          ))}
        </div>
        <AudioPlayer text={SUCCESS_TRUTH.lines.join(" ")} label="Listen to the full truth" mini={false}/>
      </div>

      {/* Jim Rohn wisdom */}
      <div style={{marginTop:16,padding:"16px 18px",background:"rgba(210,175,90,0.05)",border:"1px solid rgba(210,175,90,0.15)",borderRadius:14}}>
        <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".12em",marginBottom:10}}>LEARN FROM THE MASTER</div>
        <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.75,marginBottom:12,fontStyle:"italic"}}>
          Jim Rohn spent 40 years teaching exactly this. His work on personal philosophy, seasons of life, and the disciplines of success is still the most practical breakdown of why some people make it and most don&apos;t. Start here:
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {[
            {emoji:"📖",label:"The Art of Exceptional Living — Jim Rohn",url:"https://www.amazon.com/Art-Exceptional-Living-Jim-Rohn/dp/B00005A5ZB"},
            {emoji:"📖",label:"7 Strategies for Wealth & Happiness — Jim Rohn",url:"https://www.amazon.com/Strategies-Wealth-Happiness-Jim-Rohn/dp/0761511148"},
            {emoji:"🎧",label:"Jim Rohn — The Day That Turns Your Life Around (free, YouTube)",url:"https://www.youtube.com/results?search_query=jim+rohn+the+day+that+turns+your+life+around"},
            {emoji:"🎧",label:"Jim Rohn — Building Your Network Marketing Business (full speech)",url:"https://www.youtube.com/results?search_query=jim+rohn+building+your+network+marketing+business"},
          ].map((lk,i)=>(
            <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--midnight)",borderRadius:8,textDecoration:"none",transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:14}}>{lk.emoji}</span>
              <span style={{fontSize:12,color:"var(--cream-60)",flex:1}}>{lk.label}</span>
              <span style={{fontSize:9,color:"var(--gold)",fontFamily:"var(--f-mono)"}}>↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 10X MINDSET MODULE
// Strong mindset principles + 10x performance principles
// ═══════════════════════════════════════════════════════════════════════════════
const MINDSET_PRINCIPLES=[
  {icon:"⏳",color:"var(--gold)",title:"Be Patient",
   body:"Most worthwhile things take longer than you expect. Impatience is what causes people to quit at the exact moment they are about to break through. Build a 3-year frame for your goals and a daily frame for your actions. The daily actions are yours to control. The 3-year result is the compound of those actions. Patience is not passive waiting — it is aggressive consistency without demanding an immediate reward.",
   links:[
     {label:"The Almanack of Naval Ravikant (free PDF)",url:"https://www.navalmanack.com",type:"book"},
     {label:"Grit by Angela Duckworth",url:"https://www.amazon.com/Grit-Passion-Perseverance-Angela-Duckworth/dp/1501111108",type:"book"},
   ]},
  {icon:"⚡",color:"var(--teal)",title:"Be Proactive",
   body:"Reactive people manage problems. Proactive people prevent them. Every week, ask yourself: what is the one thing that, if I handle it now, removes 10 problems in the future? Proactivity is a thinking habit first — you have to train yourself to look ahead before looking around. Start each morning asking: what do I want to happen today, and what can I do in the next hour to make it more likely?",
   links:[
     {label:"The 7 Habits of Highly Effective People",url:"https://www.amazon.com/Habits-Highly-Effective-People-Powerful/dp/1982137274",type:"book"},
     {label:"Getting Things Done by David Allen",url:"https://www.amazon.com/Getting-Things-Done-Stress-Free-Productivity/dp/0143126563",type:"book"},
   ]},
  {icon:"🔄",color:"#9b72cf",title:"Be Open to Change",
   body:"The person who updates their beliefs when they get new evidence moves faster than the person who defends what they already decided. Change is not weakness — refusing to change when the evidence demands it is. Every 6 months, audit your top 3 beliefs about yourself, your work, and your goals. Ask honestly: is this still true, or am I holding this belief because I've held it for a long time?",
   links:[
     {label:"Mindset by Carol Dweck",url:"https://www.amazon.com/Mindset-Psychology-Carol-S-Dweck/dp/0345472322",type:"book"},
     {label:"The Art of Thinking Clearly by Rolf Dobelli",url:"https://www.amazon.com/Art-Thinking-Clearly-Rolf-Dobelli/dp/0062219693",type:"book"},
   ]},
  {icon:"🍃",color:"var(--rose)",title:"Learn to Let Go",
   body:"Some people are carrying losses from 3 years ago like they happened this morning. Every unit of energy spent resisting something that has already happened is energy that cannot go into what comes next. Letting go is not forgetting — it is refusing to let the past allocate your present resources. Process it, extract the lesson, then physically move your focus to the next thing.",
   links:[
     {label:"The Power of Now by Eckhart Tolle",url:"https://www.amazon.com/Power-Now-Guide-Spiritual-Enlightenment/dp/1577314808",type:"book"},
     {label:"Letting Go by David R. Hawkins",url:"https://www.amazon.com/Letting-Go-Pathway-Surrender-Hawkins/dp/1401945015",type:"book"},
   ]},
  {icon:"☀️",color:"var(--gold)",title:"Stay Hopeful",
   body:"Hope is not naive optimism — it is the rational belief that your actions can influence your outcomes. People without hope stop trying. People with realistic hope keep adjusting and moving. Protect your hope aggressively: limit time with people who drain it, regularly review evidence of your own progress, and zoom out when the present moment feels impossible.",
   links:[
     {label:"Man's Search for Meaning by Viktor Frankl",url:"https://www.amazon.com/Mans-Search-Meaning-Viktor-Frankl/dp/0807014273",type:"book"},
     {label:"Learned Optimism by Martin Seligman",url:"https://www.amazon.com/Learned-Optimism-Change-Your-Mind/dp/1400078393",type:"book"},
   ]},
  {icon:"🧠",color:"var(--teal)",title:"Check Your Thoughts",
   body:"Your internal monologue is either your best coach or your worst saboteur. Most people never audit it. When you catch a thought like 'I can't do this' or 'this always happens to me,' pause and ask: is this actually true, or is this a habit my brain has? You do not have to believe every thought you have. You have to notice it, question it, and replace it with one that is both true and useful.",
   links:[
     {label:"Feeling Good by David D. Burns (CBT classic)",url:"https://www.amazon.com/Feeling-Good-New-Mood-Therapy/dp/0380810336",type:"book"},
     {label:"The Happiness Trap by Russ Harris (ACT)",url:"https://www.amazon.com/Happiness-Trap-Stop-Struggling-Living/dp/1590305841",type:"book"},
     {label:"Woebot — free AI mental wellness app",url:"https://woebothealth.com",type:"tool"},
   ]},
  {icon:"💙",color:"#9b72cf",title:"It's Okay Not to Be Okay",
   body:"Pretending to be fine when you're not costs enormous energy and cuts you off from the help available to you. Acknowledging difficulty is not weakness — it is the first accurate assessment of your situation. You cannot navigate from a position you're lying about. Name what's hard, allow it to be hard, then ask: what is the smallest thing I can do from here that moves me slightly forward?",
   links:[
     {label:"Maybe You Should Talk to Someone by Lori Gottlieb",url:"https://www.amazon.com/Maybe-You-Should-Talk-Someone/dp/1328662055",type:"book"},
     {label:"7 Cups — free online emotional support",url:"https://www.7cups.com",type:"tool"},
     {label:"Headspace — guided meditation & mindfulness",url:"https://www.headspace.com",type:"tool"},
   ]},
  {icon:"🏁",color:"var(--rose)",title:"Don't Give Up",
   body:"Giving up too early is the single most common reason for failure — not incompetence, not bad luck, not the wrong idea. Most people quit right before the compounding would have kicked in. Before you quit anything, ask: am I quitting because this genuinely isn't working, or am I quitting because it's hard right now and harder than I expected? Those are two very different situations requiring two very different responses.",
   links:[
     {label:"Grit by Angela Duckworth",url:"https://www.amazon.com/Grit-Passion-Perseverance-Angela-Duckworth/dp/1501111108",type:"book"},
     {label:"Can't Hurt Me by David Goggins",url:"https://www.amazon.com/Cant-Hurt-Me-Master-Your/dp/1544512287",type:"book"},
     {label:"The Dip by Seth Godin",url:"https://www.amazon.com/Dip-Little-Book-Teaches-Stick/dp/1591841666",type:"book"},
   ]},
];

const TENX_PRINCIPLES=[
  {
    title:"Consistency Beats Intensity",
    icon:"📅",
    color:"var(--gold)",
    body:"The person who shows up every day at 70% outperforms the person who shows up at 100% three times a week. Consistency is not glamorous. It does not make good Instagram content. But it is what separates the person who makes it from the person who almost made it. Design your work so that your worst day is still enough to move forward.",
    links:[
      {label:"Atomic Habits by James Clear",url:"https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299",type:"book"},
      {label:"The Compound Effect by Darren Hardy",url:"https://www.amazon.com/Compound-Effect-Darren-Hardy/dp/159315724X",type:"book"},
      {label:"Streaks app — habit tracking",url:"https://streaksapp.com",type:"tool"},
    ],
  },
  {
    title:"Focus on Process, Not Outcome",
    icon:"🔬",
    color:"var(--teal)",
    body:"Outcomes are the result of a thousand process decisions you made when no one was watching. Obsessing over results without controlling inputs is anxiety, not strategy. Define the exact behaviors that produce your goal, then measure those behaviors daily. The outcome becomes the inevitable consequence of a well-executed process, not something you achieve by wanting it harder.",
    links:[
      {label:"The Score Takes Care of Itself by Bill Walsh",url:"https://www.amazon.com/Score-Takes-Care-Itself-Philosophy/dp/1591843472",type:"book"},
      {label:"Measure What Matters by John Doerr (OKRs)",url:"https://www.amazon.com/Measure-What-Matters-Google-Foundation/dp/0525536221",type:"book"},
    ],
  },
  {
    title:"Remove Friction from Good Habits",
    icon:"✂️",
    color:"#9b72cf",
    body:"You do not rise to the level of your motivation — you fall to the level of your environment. If good habits require willpower every time, they will fail eventually. Make them the default: gym clothes by the bed, healthy food at the front of the fridge, phone in another room during deep work, book on your pillow. Every point of friction you remove is 5 years of sustained behavior you gain.",
    links:[
      {label:"Atomic Habits by James Clear",url:"https://www.amazon.com/Atomic-Habits-Proven-Build-Break/dp/0735211299",type:"book"},
      {label:"Tiny Habits by BJ Fogg",url:"https://www.amazon.com/Tiny-Habits-Changes-Change-Everything/dp/0358003326",type:"book"},
      {label:"Habitica — gamify your habits (free)",url:"https://habitica.com",type:"tool"},
    ],
  },
  {
    title:"Get Feedback Fast",
    icon:"⚡",
    color:"var(--rose)",
    body:"Slow feedback loops are expensive. The faster you can test an idea and learn from reality, the faster you improve. Ship small, learn fast, adjust early. Every week of building without feedback is a week of potentially going in the wrong direction. Build a feedback mechanism into everything you do: test your ideas with real people, show your work before it's ready, and value honest criticism over comfortable silence.",
    links:[
      {label:"The Lean Startup by Eric Ries",url:"https://www.amazon.com/Lean-Startup-Entrepreneurs-Continuous-Innovation/dp/0307887898",type:"book"},
      {label:"Typeform — create quick user feedback surveys",url:"https://www.typeform.com",type:"tool"},
      {label:"UserTesting — get real feedback on your ideas",url:"https://www.usertesting.com",type:"tool"},
    ],
  },
  {
    title:"Learn from People Ahead of You",
    icon:"🔭",
    color:"var(--gold)",
    body:"You can compress 10 years of someone's experience into 3 hours of honest conversation. Stop learning exclusively from peers who are at the same level as you — you will all discover the same things at the same time. Find people who are 5–10 years ahead on the specific path you're on, and learn what they know about the phase you're currently in. This is not networking for status — it is intelligence gathering for your own journey.",
    links:[
      {label:"MentorCruise — find a paid mentor",url:"https://mentorcruise.com",type:"tool"},
      {label:"ADPList — free mentorship from industry pros",url:"https://adplist.org",type:"tool"},
      {label:"Lunchclub — AI-matched 1:1 conversations",url:"https://lunchclub.com",type:"tool"},
      {label:"Indie Hackers — community of founders sharing real numbers",url:"https://www.indiehackers.com",type:"resource"},
    ],
  },
  {
    title:"Eliminate Distractions — Shape Your Environment",
    icon:"🎯",
    color:"var(--teal)",
    body:"Focus is less about willpower and more about environment. You cannot out-discipline a phone that is designed by a team of engineers to be more addictive than your goals. Stop trying to resist your phone and start designing a life where it has less access to you. Remove apps that steal time. Turn off all non-essential notifications. Put the phone in another room during your most important 2 hours of the day. What you don't see, you don't reach for.",
    callout:{
      label:"Try This Starting Today",
      items:[
        "Delete any app that you open out of boredom rather than intention — not forever, just for 30 days.",
        "Turn off all notifications except calls and messages from specific people. Every other notification is someone else's agenda interrupting yours.",
        "Set your phone to grayscale. Color is an attention tool. Grayscale removes 40% of the addictive pull.",
        "Create a physical 'phone-free zone' in your home — your desk during work hours, your dinner table, your bed.",
      ],
    },
    links:[
      {label:"Deep Work by Cal Newport",url:"https://www.amazon.com/Deep-Work-Focused-Success-Distracted/dp/1455586692",type:"book"},
      {label:"Digital Minimalism by Cal Newport",url:"https://www.amazon.com/Digital-Minimalism-Choosing-Focused-Noisy/dp/0525536515",type:"book"},
      {label:"Freedom — block distracting sites & apps",url:"https://freedom.to",type:"tool"},
      {label:"Cold Turkey — hardcore website blocker",url:"https://getcoldturkey.com",type:"tool"},
      {label:"One Sec — adds a pause before opening apps",url:"https://one-sec.app",type:"tool"},
    ],
  },
];

function MindsetTenXModule({formData, userId, isPaid, onUnlock}){
  const [openPrinciple,setOpenPrinciple]=useState(null);
  const [openTenX,setOpenTenX]=useState(null);
  const [tab,setTab]=useState("mindset"); // "mindset" | "tenx"
  return(
    <div className="fu">
      {/* Hero */}
      <div style={{marginBottom:24,padding:"22px 24px",background:"linear-gradient(135deg,rgba(155,114,207,0.08),rgba(31,168,154,0.04))",border:"1px solid rgba(155,114,207,0.2)",borderRadius:16,textAlign:"center"}}>
        <div style={{fontSize:11,fontFamily:"var(--f-mono)",color:"#9b72cf",letterSpacing:".15em",marginBottom:8}}>MENTAL OPERATING SYSTEM</div>
        <div className="d3" style={{marginBottom:8}}>
          Build a Mind That Doesn&apos;t Break{formData?.name?`, ${formData.name}`:""}
        </div>
        <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.7,maxWidth:480,margin:"0 auto"}}>
          A strong mindset is not a personality trait. It is a set of practiced habits applied consistently —
          especially when you don&apos;t feel like it.
          {formData?.challenge?` Specifically built for someone dealing with: "${formData.challenge.slice(0,70)}${formData.challenge.length>70?"…":""}".`:""}
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:8,marginBottom:24,padding:"4px",background:"var(--midnight)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)"}}>
        {[{id:"mindset",label:"Strong Mindset"},{id:"tenx",label:"10x Principles"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,padding:"10px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all .2s",
              background:tab===t.id?"var(--lift)":"none",
              color:tab===t.id?"var(--cream)":"var(--cream-40)"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* STRONG MINDSET */}
      {tab==="mindset"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {MINDSET_PRINCIPLES.map((p,i)=>{
            const isOpen=openPrinciple===i;
            return(
              <div key={i} style={{background:"var(--lift)",borderRadius:14,border:`1px solid ${isOpen?p.color:"rgba(255,255,255,0.06)"}`,overflow:"hidden",transition:"border-color .25s"}}>
                <button onClick={()=>setOpenPrinciple(o=>o===i?null:i)} style={{width:"100%",background:"none",border:"none",padding:"16px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
                  <div style={{width:38,height:38,borderRadius:10,background:`${p.color}12`,border:`1px solid ${p.color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{p.icon}</div>
                  <div style={{flex:1,fontSize:14,fontWeight:600,color:isOpen?p.color:"var(--cream)"}}>{p.title}</div>
                  <div style={{color:"var(--cream-30)",fontSize:16,transform:isOpen?"rotate(180deg)":"none",transition:"transform .25s"}}>⌄</div>
                </button>
                {isOpen&&(
                  <div style={{padding:"0 18px 18px"}}>
                    <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:14}}/>
                    <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.8,marginBottom:12}}>{p.body}</p>
                    <ResourceLinks links={p.links} accentColor={p.color}/>
                    <HabitButton itemKey={`mindset:${["patient","proactive","change","letgo","hope","thoughts","okay","dontquit"][i]||i}`} userId={userId}/>
                    <AudioPlayer text={`${p.title}: ${p.body}`} label="Listen" mini={false}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 10X PRINCIPLES — paid only */}
      {tab==="tenx"&&!isPaid&&(
        <div style={{textAlign:"center",padding:"32px 20px"}}>
          <div style={{fontSize:28,marginBottom:10}}>🔒</div>
          <div style={{fontSize:16,fontWeight:700,color:"var(--cream)",marginBottom:8}}>10x Principles — Members Only</div>
          <p style={{fontSize:13,color:"var(--cream-40)",maxWidth:300,margin:"0 auto 20px",lineHeight:1.65}}>
            The 6 performance principles are locked for free users. Upgrade to unlock all 14 mindset sections.
          </p>
          <button className="btn btn-gold" onClick={onUnlock}>Unlock from $9/month</button>
        </div>
      )}
      {tab==="tenx"&&isPaid&&(
        <>
          <div style={{marginBottom:20}}>
            <div className="d3" style={{marginBottom:8}}>Simple Principles That Make You 10x Better at Anything</div>
            <p style={{fontSize:13,color:"var(--cream-50)",lineHeight:1.65}}>These are not motivational quotes. They are operating instructions for performance — drawn from the research on how elite performers actually think and work.</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {TENX_PRINCIPLES.map((p,i)=>{
              const isOpen=openTenX===i;
              return(
                <div key={i} style={{background:"var(--lift)",borderRadius:14,border:`1px solid ${isOpen?p.color:"rgba(255,255,255,0.06)"}`,overflow:"hidden",transition:"border-color .25s"}}>
                  <button onClick={()=>setOpenTenX(o=>o===i?null:i)} style={{width:"100%",background:"none",border:"none",padding:"16px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
                    <div style={{width:38,height:38,borderRadius:10,background:`${p.color}12`,border:`1px solid ${p.color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{p.icon}</div>
                    <div style={{flex:1,fontSize:14,fontWeight:600,color:isOpen?p.color:"var(--cream)"}}>{p.title}</div>
                    <div style={{color:"var(--cream-30)",fontSize:16,transform:isOpen?"rotate(180deg)":"none",transition:"transform .25s"}}>⌄</div>
                  </button>
                  {isOpen&&(
                    <div style={{padding:"0 18px 18px"}}>
                      <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:14}}/>
                      <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.8,marginBottom:12}}>{p.body}</p>
                      {p.callout&&(
                        <div style={{padding:"14px 16px",background:`${p.color}08`,border:`1px solid ${p.color}25`,borderRadius:12,marginBottom:12}}>
                          <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:p.color,letterSpacing:".12em",marginBottom:10}}>{p.callout.label.toUpperCase()}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:7}}>
                            {p.callout.items.map((item,ci)=>(
                              <div key={ci} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                                <span style={{color:p.color,fontSize:10,marginTop:3,flexShrink:0}}>◎</span>
                                <p style={{fontSize:13,color:"var(--cream-60)",margin:0,lineHeight:1.65}}>{item}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <ResourceLinks links={p.links} accentColor={p.color}/>
                      <HabitButton itemKey={`tenx:${["consistency","process","friction","feedback","mentors","focus"][i]||i}`} userId={userId}/>
                      <AudioPlayer text={`${p.title}. ${p.body}`} label="Listen" mini={false}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}



// ── deriveStrengthsRisks ────────────────────────────────────────────────────
// Safely coerce a report field to plain text, regardless of whether the
// AI returned it as a string, an array, or an object (e.g. newer reports
// store `mindset` as {pattern,reframe,emotional,practice} instead of a string).
function asReportText(val){
  if(val==null) return "";
  if(typeof val==="string") return val;
  if(Array.isArray(val)) return val.filter(v=>typeof v==="string").join(". ");
  if(typeof val==="object") return Object.values(val).filter(v=>typeof v==="string").join(". ");
  return String(val);
}

// For reports generated before strengths/risks fields existed,
// derive them from the existing report text.

function deriveStrengthsRisks(data){
  // ── Already have proper arrays from new reports ──
  if(data?.strengths?.length>0 && data?.risks?.length>0){
    return {strengths:data.strengths, risks:data.risks};
  }

  // ── Get all available text from any report format ──
  const getText = (val) => {
    if(!val) return "";
    if(typeof val === "string") return val;
    if(val?.content) return String(val.content);
    if(Array.isArray(val)) return val.map(v=>typeof v==="string"?v:v?.content||"").join(" ");
    return String(val);
  };

  // Collect all text sources
  const sources = {
    s0: getText(data?.sections?.[0]?.content||data?.sections?.[0]),
    s1: getText(data?.sections?.[1]?.content||data?.sections?.[1]),
    s2: getText(data?.sections?.[2]?.content||data?.sections?.[2]),
    life: getText(data?.life),
    wealth: getText(data?.wealth),
    mindset: getText(data?.mindset),
    relations: getText(data?.relationships),
    greeting: getText(data?.greeting),
  };

  // Simple chunker — split long text into 1-2 sentence pieces
  const chunk = (text, max=3) => {
    if(!text || text.trim().length < 20) return [];
    // Split by period+space or newline
    const raw = text.split(/(?<=\.)\s+|\n+/).map(s=>s.trim()).filter(s=>s.length>20);
    if(raw.length >= 2) return raw.slice(0,max).map(s=>s.length>220?s.slice(0,220)+"…":s);
    // If no good splits, just truncate the whole thing into 2 chunks
    const mid = Math.floor(text.length/2);
    const split = text.indexOf('. ', mid-50);
    if(split>0) return [text.slice(0,split+1).trim(), text.slice(split+2).trim()].filter(s=>s.length>20).slice(0,max);
    return [text.slice(0,200).trim()+"…"].filter(s=>s.length>20);
  };

  // Strengths — "What You Have" section is the best source
  let strengths = chunk(sources.s1, 3);
  if(strengths.length<1) strengths = chunk(sources.life, 3);
  if(strengths.length<1) strengths = chunk(sources.greeting, 3);
  if(strengths.length<1) strengths = chunk(sources.s0, 3);

  // Risks — mindset/wealth sections
  const riskText = sources.mindset || sources.wealth || sources.s0;
  const riskChunks = chunk(riskText, 6);
  const warnWords = ["avoid","stuck","stop","watch","miss","risk","fear","distract","unless","but","however","challenge","careful","pattern","habit"];
  let risks = riskChunks.filter(s=>warnWords.some(w=>s.toLowerCase().includes(w))).slice(0,3);
  if(risks.length<2) risks = riskChunks.slice(-3).filter(s=>s.length>20);
  if(risks.length<1) risks = chunk(riskText, 3);

  return {
    strengths: strengths.slice(0,3),
    risks:     risks.slice(0,3),
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// STREAK CELEBRATION — TikTok-style milestone pop when streak increases
// Triggers on: 3, 7, 10, 14, 21, 30, 50, 75, 100, 150, 200, 365 days
// ═══════════════════════════════════════════════════════════════════════════════
const STREAK_MILESTONES = {
  1:   { emoji:"⚡",    title:"First Check-in!",  msg:"Day one. Most people never even start. You just did something they won't.",   color:"var(--teal)"    },
  2:   { emoji:"✌️",   title:"2 Days Running!",  msg:"Back again. Two days in a row already puts you ahead of most people.",        color:"var(--teal)"    },
  3:   { emoji:"🔥",    title:"3-Day Streak!",    msg:"You showed up 3 days in a row. That's the beginning of something real.",      color:"var(--gold)"    },
  7:   { emoji:"⚡",    title:"7-Day Streak!",    msg:"One full week. Most people quit before this. You didn't.",                    color:"var(--teal)"    },
  10:  { emoji:"🏆",    title:"10-Day Streak!",   msg:"10 days of showing up. The discipline is becoming part of who you are.",     color:"var(--gold)"    },
  14:  { emoji:"🔥🔥",  title:"2-Week Streak!",   msg:"Two weeks straight. You're building something most people only talk about.", color:"var(--rose)"    },
  21:  { emoji:"💎",    title:"21-Day Streak!",   msg:"21 days. Science says this is where habits start forming. You're there.",    color:"#9b72cf"        },
  30:  { emoji:"🚀",    title:"30-Day Streak!",   msg:"One full month of daily check-ins. This is elite-level consistency.",        color:"var(--gold)"    },
  50:  { emoji:"⭐",    title:"50-Day Streak!",   msg:"50 days. You are in the top 1% of people who start self-improvement tools.", color:"var(--teal)"    },
  75:  { emoji:"💪",    title:"75-Day Streak!",   msg:"75 days. Uncommon discipline. Not many people even reach this.",             color:"var(--rose)"    },
  100: { emoji:"👑",    title:"100-Day Streak!",  msg:"ONE HUNDRED DAYS. You have earned the right to say you are serious about your life.", color:"var(--gold)" },
  150: { emoji:"🌟",    title:"150-Day Streak!",  msg:"150 days. Half a year of daily commitment. Extraordinary.",                  color:"#9b72cf"        },
  200: { emoji:"🏅",    title:"200-Day Streak!",  msg:"200 days. If consistency were a currency, you'd be rich.",                  color:"var(--teal)"    },
  365: { emoji:"🎯",    title:"365-Day Streak!",  msg:"ONE FULL YEAR. A complete revolution around the sun with DestinIQ. Legendary.", color:"var(--gold)" },
};

function StreakCelebration({streak, onClose}){
  const [animIn, setAnimIn] = useState(false);
  const milestone = STREAK_MILESTONES[streak];
  if(!milestone) return null;

  useEffect(()=>{
    // Animate in
    setTimeout(()=>setAnimIn(true), 50);
    // Auto-close after 5 seconds
    const t = setTimeout(onClose, 5000);
    return ()=>clearTimeout(t);
  },[]);

  return(
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:3000,
      background:"rgba(0,0,0,0.85)",
      display:"flex", alignItems:"center", justifyContent:"center",
      cursor:"pointer",
      transition:"opacity .3s",
      opacity: animIn ? 1 : 0,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        textAlign:"center", padding:"40px 32px",
        maxWidth:380, width:"100%",
        transform: animIn ? "scale(1) translateY(0)" : "scale(0.8) translateY(40px)",
        transition:"transform .4s cubic-bezier(0.175,0.885,0.32,1.275)",
      }}>
        {/* Emoji */}
        <div style={{
          fontSize:80, lineHeight:1,
          marginBottom:20,
          filter:"drop-shadow(0 0 30px "+milestone.color+")",
          animation:"streakBounce 0.6s ease infinite alternate",
        }}>
          {milestone.emoji}
        </div>

        {/* Streak number */}
        <div style={{
          fontSize:96, fontWeight:900, lineHeight:1,
          color: milestone.color,
          fontFamily:"var(--f-display)",
          marginBottom:4,
          textShadow:`0 0 40px ${milestone.color}60`,
        }}>
          {streak}
        </div>
        <div style={{
          fontSize:14, fontFamily:"var(--f-mono)", letterSpacing:".2em",
          color:"var(--cream-40)", marginBottom:24, textTransform:"uppercase",
        }}>
          day streak 🔥
        </div>

        {/* Title */}
        <div style={{
          fontSize:28, fontWeight:800, color:"var(--cream)",
          marginBottom:12, lineHeight:1.25,
        }}>
          {milestone.title}
        </div>

        {/* Message */}
        <p style={{
          fontSize:16, color:"var(--cream-60)", lineHeight:1.75,
          marginBottom:32,
        }}>
          {milestone.msg}
        </p>

        {/* CTA */}
        <button onClick={onClose} style={{
          background: milestone.color, border:"none", borderRadius:14,
          padding:"14px 40px", fontSize:15, fontWeight:700,
          color: milestone.color === "var(--gold)" ? "#000" : "#fff",
          cursor:"pointer", letterSpacing:".03em",
        }}>
          Keep going 🔥
        </button>
        <p style={{fontSize:11,color:"var(--cream-30)",marginTop:12,fontFamily:"var(--f-mono)"}}>
          Tap anywhere to dismiss
        </p>
      </div>

      <style>{`
        @keyframes streakBounce {
          from { transform: scale(1) rotate(-5deg); }
          to   { transform: scale(1.15) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}


// ── SidebarNav ───────────────────────────────────────────────────────────
function SidebarNav({nav,setNav,isPaid,isPremium,isProMax,streak,onUnlock,formData,navPhotoURL,onNotif}){
  const ITEMS=[
    {id:"home",    icon:"🏠",label:"Home"},
    {id:"explore", icon:"🔍",label:"Explore"},
    {id:"progress",icon:"📊",label:"Progress"},
    {id:"report",  icon:"📋",label:"My Report"},
    {id:"checkin", icon:"✅",label:"Check-in"},
    {id:"tool:dailywisdom",    icon:"💎",label:"Daily Wisdom"},
    {id:"tool:weeklychallenge",icon:"🎲",label:"Weekly Challenge"},
    {id:"wins",    icon:"🏆",label:"Wins"},
    {id:"practices",icon:"⚡",label:"My Practices"},
    {id:"tool:advisor",icon:"⬡",label:"My Advisor"},
    {id:"profile", icon:"👤",label:"Profile"},
  ];
  return(
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="logo" style={{fontSize:18}}>Destin<b>IQ</b></div>
        {isPaid&&<div style={{fontSize:10,fontFamily:"var(--f-mono)",color:isProMax?"#9b72cf":"var(--gold)",marginTop:3}}>
          {isProMax?"✦ PRO MAX":"◆ PRO"}
        </div>}
      </div>
      <div className="sidebar-items">
        {ITEMS.map(item=>(
          <button key={item.id} className={`s-item ${nav===item.id||nav?.startsWith(item.id)?"active":""}`}
            onClick={()=>setNav(item.id)}>
            <span style={{fontSize:15,width:20,textAlign:"center",flexShrink:0}}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div className="s-streak">
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <span style={{fontSize:20}}>🔥</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"var(--cream)"}}>{streak||1} day streak</div>
            <div style={{fontSize:10,color:"var(--cream-30)"}}>Keep it going</div>
          </div>
        </div>
        <div style={{display:"flex",gap:5}}>
          {["M","T","W","T","F","S","S"].map((d,i)=>(
            <div key={i} style={{textAlign:"center"}}>
              <div style={{fontSize:7,color:"var(--cream-20)",marginBottom:2}}>{d}</div>
              <div style={{width:7,height:7,borderRadius:"50%",background:i<(streak||1)%7?"var(--gold)":"var(--cream-10)"}}/>
            </div>
          ))}
        </div>
      </div>
      {!isPaid&&(
        <div className="s-upgrade">
          <button className="btn btn-gold" style={{width:"100%",fontSize:12}} onClick={onUnlock}>
            ✦ Upgrade to Pro
          </button>
        </div>
      )}

      {/* User info + notification bell at bottom */}
      <div style={{borderTop:"1px solid rgba(232,220,200,0.07)",padding:"14px 16px",
        display:"flex",alignItems:"center",gap:10,marginTop:"auto"}}>
        <div onClick={()=>setNav("profile")} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
          <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,
            background:"linear-gradient(135deg,#f0b429,#1ab89a)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:13,fontWeight:700,color:"#000",overflow:"hidden"}}>
            {navPhotoURL
              ?<img src={navPhotoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :(formData?.name||"U")[0].toUpperCase()
            }
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--cream)",
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {formData?.name?.split(" ")[0]||"User"}
            </div>
            <div style={{fontSize:10,color:"rgba(232,220,200,0.4)"}}>
              {isPaid?(isPremium?"✦ Pro Max":"◆ Pro"):"Free Plan"}
            </div>
          </div>
        </div>
        {onNotif&&(
          <button onClick={onNotif}
            style={{background:"none",border:"none",color:"rgba(232,220,200,0.4)",
              cursor:"pointer",fontSize:16,padding:"4px",flexShrink:0,lineHeight:1}}>
            🔔
          </button>
        )}
      </div>
    </nav>
  );
}

// ── BottomNav ────────────────────────────────────────────────────────────
function BottomNav({nav,setNav}){
  return(
    <div className="bot-nav">
      <div className="bot-items">
        {[{id:"home",icon:"🏠",label:"Home"},{id:"explore",icon:"🔍",label:"Explore"},{id:"checkin",icon:"✅",label:"Check-in"},{id:"progress",icon:"📊",label:"Progress"},{id:"profile",icon:"👤",label:"Profile"}]
          .map(t=>(
            <button key={t.id} className={`bot-item ${nav===t.id||nav?.startsWith(t.id)?"active":""}`} onClick={()=>setNav(t.id)}>
              <span className="bot-icon">{t.icon}</span>
              <span className="bot-label">{t.label}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

// ── MobileTopBar ─────────────────────────────────────────────────────────
function MobileTopBar({title,onBack,streak,isPaid,isProMax,onNotif,setNav,navPhotoURL,userName,onHamburger}){
  const G={gold:"#f0b429",cream:"#e8dcc8",dim:"rgba(232,220,200,0.5)"};
  return(
    <div className="mob-top" style={{display:"flex",alignItems:"center",
      justifyContent:"space-between",padding:"max(14px,env(safe-area-inset-top)) 18px 12px",
      background:"rgba(10,8,0,0.94)",backdropFilter:"blur(14px)",
      borderBottom:"1px solid rgba(255,255,255,0.07)",
      position:"sticky",top:0,zIndex:300,gap:12}}>

      {/* Left: hamburger OR back button */}
      {onBack
        ? <button onClick={onBack} style={{background:"none",border:"none",
            cursor:"pointer",color:G.dim,fontSize:20,padding:"4px 8px 4px 0",
            display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}}>
            <span>←</span>
          </button>
        : <button onClick={onHamburger}
            style={{background:"none",border:"none",cursor:"pointer",
              padding:"6px 4px",display:"flex",flexDirection:"column",gap:5}}>
            {[0,1,2].map(i=>(
              <span key={i} style={{display:"block",width:22,height:2,
                background:G.cream,borderRadius:2}}/>
            ))}
          </button>
      }

      {/* Center: logo or title */}
      <div style={{flex:1,textAlign:"center"}}>
        {title
          ? <span style={{fontSize:14,fontWeight:600,color:G.cream}}>{title}</span>
          : <span style={{fontSize:17,fontWeight:900,color:G.cream,letterSpacing:"-.3px"}}>
              Destin<span style={{color:G.gold}}>IQ</span>
            </span>
        }
      </div>

      {/* Right: bell + avatar */}
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onNotif} style={{background:"none",border:"none",
          cursor:"pointer",fontSize:18,color:G.dim,padding:4}}>
          🔔
        </button>
        <div onClick={()=>setNav&&setNav("profile")}
          style={{width:32,height:32,borderRadius:"50%",cursor:"pointer",
            background:"linear-gradient(135deg,#f0b429,#c89010)",
            display:"flex",alignItems:"center",justifyContent:"center",
            overflow:"hidden",flexShrink:0}}>
          {navPhotoURL
            ? <img src={navPhotoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            : <span style={{fontSize:13,fontWeight:800,color:"#000"}}>
                {(userName||"U")[0].toUpperCase()}
              </span>}
        </div>
      </div>

    </div>
  );
}

function HomeScreen({data,formData,streak,isPaid,isPremium,isProMax,userId,onUnlock,setNav,setShowCheckin,dailyInsight}){
  const hour = new Date().getHours();
  const timeGreet = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const name = formData?.name?.split(" ")[0]||"there";
  const today = new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});

  const G={
    gold:"#f0b429",bg:"#0a0800",card:"#111008",card2:"#0e0c02",
    border:"rgba(232,220,200,0.07)",cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)",
  };
  const card={background:G.card,border:"1px solid "+G.border,borderRadius:16,padding:"20px",boxSizing:"border-box"};

  const txt=(v)=>{if(!v)return "";if(typeof v==="string")return v;if(v?.content)return String(v.content);if(Array.isArray(v))return v.filter(Boolean).map(x=>typeof x==="string"?x:x?.content||"").join(" ");return String(v);};

  const scores = data?.scores||{};
  const overall = Math.min(99,Math.max(1,Math.round(
    (scores.life||60)*.25+(scores.wealth||60)*.3+(scores.mindset||60)*.25+(scores.relations||60)*.2
  )));
  // Save snapshot for comparison mode (runs once per report load)
  useEffect(()=>{
    if(userId && scores && Object.keys(scores).length>0) saveScoreSnapshot(userId,scores,overall);
  },[userId]);

  // Today's Insight — from report data or derived from profile
  const getInsight=()=>{
    const ri=txt(dailyInsight)||txt(data?.daily_insight)||txt(data?.daily_recommendation)||txt(data?.closing);
    if(ri&&ri.length>20){ const sents=ri.split(/(?<=[\.!?])\s+/); return sents.slice(0,4).join(' ').slice(0,400); }
    const bl=(Array.isArray(formData?.blockers)?formData.blockers.join(" "):(formData?.challenge||"")).toLowerCase();
    const fo=(formData?.focus||"").toLowerCase();
    if(bl.includes("overthink"))  return "You tend to overthink decisions. Today is about taking one clear action without delay.";
    if(bl.includes("disciplin")||bl.includes("habit")) return "Consistency beats intensity. Do one small thing today that Future You will thank you for.";
    if(fo.includes("money")||fo.includes("financ"))    return "Financial freedom starts with one clear financial decision made today. What's yours?";
    if(fo.includes("relation")||fo.includes("connect")) return "One meaningful conversation today is worth more than ten surface-level ones. Reach out.";
    return "You have everything you need to move forward. The only missing ingredient is consistent, intentional action.";
  };

  // Primary focus area
  const focus=formData?.focus||formData?.interests?.split(",")?.[0]?.trim()||"Your Journey";
  const focusIcon=focus.toLowerCase().includes("money")?"💰":focus.toLowerCase().includes("relation")?"❤️":focus.toLowerCase().includes("mindset")?"🧠":focus.toLowerCase().includes("purpose")?"⭐":focus.toLowerCase().includes("disciplin")?"🔥":"🎯";
  const journeyPct=Math.min(95,Math.max(15,overall-5));

  // Recent tools from localStorage
  const recentTools=(()=>{
    if(typeof window==="undefined") return [];
    try{
      return CATEGORIES.flatMap(cat=>
        cat.tools.map(t=>({id:t,label:TOOL_META?.[t]?.label||t,icon:TOOL_META?.[t]?.icon||"⚡",cat:cat.id}))
      ).filter(t=>{try{return!!localStorage.getItem(`diq_mod_${t.id}_${userId}`);}catch{return false;}}).slice(0,6);
    }catch{return [];}
  })();

  // Momentum log for check-in count
  const log=getMomentumLog(userId);

  // Recommended next tool based on profile
  const getRecom=()=>{
    const f=(formData?.focus||"").toLowerCase();
    const b=(formData?.challenge||"").toLowerCase();
    if(f.includes("relation")||f.includes("connect")) return {id:"relationshipiq",label:"Relationship IQ",icon:"❤️",desc:"Improve communication and build stronger connections."};
    if(f.includes("money")||f.includes("financ"))     return {id:"sidehustle",label:"Side Hustle",icon:"💰",desc:"Find and launch your best income opportunity."};
    if(b.includes("overthink")||f.includes("mindset"))return {id:"innerpeace",label:"Inner Peace",icon:"🧠",desc:"Build mental clarity and silence the inner noise."};
    if(f.includes("disciplin")||b.includes("habit"))  return {id:"dailywisdom",label:"Daily Wisdom",icon:"✦",desc:"Build momentum through daily micro-improvements."};
    if(f.includes("purpose"))                          return {id:"fearaudit",label:"Fear Audit",icon:"⭐",desc:"Identify what's holding you back and break through it."};
    return {id:"innerpeace",label:"Inner Peace",icon:"🧠",desc:"Mental clarity unlocks everything else."};
  };
  const recom=getRecom();

  const quickActions=[
    {icon:"✅",label:"Daily Check-in",bg:"rgba(26,184,154,.12)",brd:"rgba(26,184,154,.25)",color:"#1ab89a",action:()=>setNav("checkin")},
    {icon:"🤖",label:"AI Coach",     bg:"rgba(155,114,207,.12)",brd:"rgba(155,114,207,.25)",color:"#9b72cf", action:()=>setNav("tool:advisor")},
    {icon:"⚡",label:"Challenge",    bg:"rgba(229,115,115,.12)",brd:"rgba(229,115,115,.25)",color:"#e57373", action:()=>setNav("tool:weeklychallenge")},
    {icon:"🏆",label:"My Wins",      bg:"rgba(255,213,79,.10)", brd:"rgba(255,213,79,.25)", color:"#ffd54f", action:()=>setNav("wins")},
    {icon:"📓",label:"Journal",      bg:"rgba(100,181,246,.12)",brd:"rgba(100,181,246,.25)",color:"#64b5f6", action:()=>setNav("journal")},
  ]

  return(
    <div style={{padding:"0 0 90px",minHeight:"100vh",background:G.bg,color:G.cream,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>

      {/* ══ 1. GREETING (desktop content, mobile uses MobileTopBar) ══ */}
      <div style={{padding:"22px 20px 14px"}}>
        <p style={{fontSize:12,color:G.dimmer,margin:"0 0 3px"}}>{today}</p>
        <h1 style={{fontSize:"clamp(16px,4.5vw,24px)",fontWeight:800,color:G.cream,margin:0,lineHeight:1.15}}>
          {timeGreet}, <span style={{color:G.gold}}>{name}</span> 👋
        </h1>
      </div>

      <div style={{padding:"0 20px"}}>
        <WeeklyDigestCard profile={formData} userId={userId} streak={streak} isPremium={isPremium} isProMax={isProMax}/>
        {/* ══ CONTINUE JOURNEY (Hero card) ══ */}
        <div style={{background:"linear-gradient(135deg,#131008,#0f0c05)",
          border:"1px solid rgba(240,180,41,0.2)",borderRadius:18,padding:"24px",
          marginBottom:14,position:"relative",overflow:"hidden",
          boxShadow:"0 0 40px rgba(240,180,41,0.05)"}}>
          <div style={{position:"absolute",top:0,right:0,width:"45%",height:"100%",
            background:"radial-gradient(ellipse at 80% 20%,rgba(240,180,41,0.07),transparent 60%)",
            pointerEvents:"none"}}/>
          <div style={{position:"relative"}}>
            <div style={{fontSize:9,color:G.dimmer,letterSpacing:".12em",fontFamily:"monospace",marginBottom:12}}>CONTINUE YOUR JOURNEY</div>
            <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:18}}>
              <div style={{width:50,height:50,borderRadius:13,flexShrink:0,
                background:"rgba(240,180,41,0.1)",border:"1px solid rgba(240,180,41,0.22)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{focusIcon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:700,color:G.cream,marginBottom:3}}>{focus}</div>
                <div style={{fontSize:12,color:G.dim,marginBottom:10}}>Your primary growth area</div>
                <div style={{height:4,borderRadius:4,background:"rgba(255,255,255,0.07)",marginBottom:4}}>
                  <div style={{height:"100%",borderRadius:4,background:G.gold,width:journeyPct+"%",transition:"width .8s ease"}}/>
                </div>
                <div style={{fontSize:11,color:G.dimmer}}>{journeyPct}% in progress</div>
              </div>
            </div>
            <button onClick={()=>setNav("explore")}
              style={{display:"flex",alignItems:"center",gap:8,background:G.gold,color:"#000",
                border:"none",borderRadius:10,padding:"12px 22px",fontSize:13,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit"}}>
              Continue Learning <span style={{fontSize:16}}>→</span>
            </button>
          </div>
        </div>

        {/* ══ 3. TODAY'S INTELLIGENCE INSIGHT ══ */}
        <div style={{...card,marginBottom:14,
          background:"linear-gradient(135deg,#0e0820,#0a0810)",
          border:"1px solid rgba(120,80,200,0.14)"}}>
          <div style={{fontSize:9,color:"rgba(200,160,255,0.6)",letterSpacing:".12em",fontFamily:"monospace",marginBottom:10}}>TODAY'S INSIGHT FOR YOU</div>
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <span style={{fontSize:20,color:G.gold,flexShrink:0,marginTop:2}}>✦</span>
            <p style={{fontSize:14,color:G.dim,lineHeight:1.72,margin:0}}>
              <span style={{color:G.cream,fontWeight:600}}>{name}, </span>{getInsight()}
            </p>
          </div>
        </div>

        {/* ══ 4. QUICK ACTIONS ══ */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:10,color:G.dimmer,letterSpacing:".1em",fontFamily:"monospace",marginBottom:12,textTransform:"uppercase"}}>Quick Actions</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:"clamp(6px,2vw,10px)"}}>
            {quickActions.map(a=>(
              <button key={a.label} onClick={a.action}
                style={{background:a.bg||G.card,border:"1px solid "+(a.brd||G.border),borderRadius:13,
                  padding:"14px 6px",textAlign:"center",cursor:"pointer",
                  fontFamily:"inherit",outline:"none",transition:"all .15s"}}
                onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.3)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=""; }}>
                <div style={{fontSize:22,marginBottom:7}}>{a.icon}</div>
                <div style={{fontSize:10,color:a.color||G.dim,fontWeight:600,lineHeight:1.3}}>{a.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ══ 5. CONTINUE WHERE YOU LEFT OFF ══ */}
        {recentTools.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,color:G.dimmer,letterSpacing:".1em",fontFamily:"monospace",marginBottom:12,textTransform:"uppercase"}}>Continue Where You Left Off</div>
            <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:8,
              scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
              {recentTools.map(t=>(
                <button key={t.id} onClick={()=>setNav("tool:"+t.id)}
                  style={{background:G.card,border:"1px solid "+G.border,borderRadius:13,
                    padding:"16px",cursor:"pointer",flexShrink:0,minWidth:110,textAlign:"center",
                    fontFamily:"inherit",outline:"none",transition:"border-color .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(240,180,41,0.25)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=G.border}>
                  <div style={{fontSize:22,marginBottom:8}}>{t.icon}</div>
                  <div style={{fontSize:11,fontWeight:600,color:G.cream,lineHeight:1.3}}>{t.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══ 6. GROWTH SNAPSHOT ══ */}
        <div style={{...card,marginBottom:14}}>
          <div style={{fontSize:10,color:G.dimmer,letterSpacing:".1em",fontFamily:"monospace",marginBottom:14,textTransform:"uppercase"}}>Growth Snapshot</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {[
              {icon:"🔥",label:"Day Streak",  val:streak||0,   unit:"days",  color:"#ff8a65"},
              {icon:"⚡",label:"Check-ins",   val:log.length||0,unit:"total", color:G.gold},
              {icon:"📊",label:"Life Score",  val:overall,     unit:"/100",  color:"#64b5f6"},
            ].map(({icon,label,val,unit,color})=>(
              <div key={label} style={{textAlign:"center",padding:"14px 8px",
                background:"rgba(255,255,255,0.02)",borderRadius:12,
                border:"1px solid rgba(255,255,255,0.04)"}}>
                <div style={{fontSize:20,marginBottom:5}}>{icon}</div>
                <div style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:800,color,lineHeight:1,marginBottom:3}}>
                  {val}<span style={{fontSize:10,color:G.dimmer,fontWeight:400}}>{unit}</span>
                </div>
                <div style={{fontSize:10,color:G.dimmer}}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ 7. AI RECOMMENDED NEXT STEP (one action only) ══ */}
        <div style={{background:"linear-gradient(135deg,rgba(240,180,41,0.06),rgba(240,180,41,0.02))",
          border:"1px solid rgba(240,180,41,0.15)",borderRadius:16,padding:"22px",
          display:"flex",alignItems:"center",justifyContent:"space-between",
          gap:16,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:160}}>
            <div style={{fontSize:9,color:G.gold,letterSpacing:".12em",fontFamily:"monospace",marginBottom:9}}>AI RECOMMENDS</div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontSize:20}}>{recom.icon}</span>
              <span style={{fontSize:15,fontWeight:700,color:G.cream}}>{recom.label}</span>
            </div>
            <p style={{fontSize:12,color:G.dim,lineHeight:1.6,margin:0}}>{recom.desc}</p>
          </div>
          <button onClick={()=>setNav("tool:"+recom.id)}
            style={{background:G.gold,color:"#000",border:"none",borderRadius:10,
              padding:"12px 22px",fontSize:13,fontWeight:700,cursor:"pointer",
              fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>
            Start Now →
          </button>
        </div>

        {/* Upgrade nudge (free users only) */}
        {!isPaid&&(
          <div style={{marginTop:14,padding:"16px 18px",
            background:"rgba(240,180,41,0.04)",border:"1px solid rgba(240,180,41,0.1)",
            borderRadius:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:G.cream,marginBottom:2}}>Unlock your full potential</div>
              <div style={{fontSize:11,color:G.dim}}>Upgrade to Pro for deeper insights and unlimited sessions.</div>
            </div>
            <button onClick={onUnlock}
              style={{background:G.gold,color:"#000",border:"none",borderRadius:9,
                padding:"9px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
              ✦ Upgrade Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════════════
// SIDE DRAWER — Hamburger menu navigation
// ═══════════════════════════════════════════════════════════════════════════════
function SideDrawer({open, onClose, nav, setNav, formData, isPaid, isProMax, streak, navPhotoURL, onUnlock, onSignOut}){
  const G={gold:"#f0b429",cream:"#e8dcc8",dim:"rgba(232,220,200,0.5)",
    dimmer:"rgba(232,220,200,0.22)",bg:"#0a0800",card:"rgba(255,255,255,0.04)",
    border:"rgba(255,255,255,0.08)"};
  const name = formData?.name || "You";

  const navItems=[
    {id:"home",      icon:"🏠", label:"Home"},
    {id:"explore",   icon:"🔍", label:"Explore"},
    {id:"report",    icon:"📊", label:"My Report"},
    {id:"progress",  icon:"📈", label:"Progress"},
    {id:"checkin",   icon:"✅", label:"Check-in"},
    {id:"tool:advisor",icon:"🤖",label:"AI Coach"},
    {id:"savedreports",icon:"🔖",label:"Saved"},
    {id:"wins",      icon:"🏆", label:"My Wins"},
    {id:"profile",   icon:"⚙️", label:"Settings"},
  ];

  const go=(id)=>{ setNav(id); onClose(); };

  if(!open) return null;
  return(
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",
        zIndex:800,backdropFilter:"blur(4px)"}}/>

      {/* Drawer */}
      <div style={{position:"fixed",top:0,left:0,bottom:0,width:"min(80vw,300px)",
        background:"#0f0e0a",borderRight:"1px solid "+G.border,zIndex:900,
        display:"flex",flexDirection:"column",overflowY:"auto",
        animation:"drawerSlideIn .22s cubic-bezier(0.32,0.72,0,1)"}}>

        {/* Profile section */}
        <div style={{padding:"20px 20px 16px",borderBottom:"1px solid "+G.border,
          display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}
          onClick={()=>go("profile")}>
          <div style={{width:42,height:42,borderRadius:"50%",
            background:"linear-gradient(135deg,#f0b429,#c89010)",
            display:"flex",alignItems:"center",justifyContent:"center",
            flexShrink:0,overflow:"hidden"}}>
            {navPhotoURL
              ? <img src={navPhotoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : <span style={{fontSize:18,fontWeight:800,color:"#000"}}>{name[0]?.toUpperCase()}</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,color:G.cream,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
            <div style={{fontSize:11,color:G.dimmer}}>View your profile</div>
          </div>
          <span style={{color:G.dimmer,fontSize:16}}>›</span>
        </div>

        {/* Nav items */}
        <div style={{flex:1,padding:"8px 0"}}>
          {navItems.map(item=>{
            const isActive = nav===item.id || nav?.startsWith(item.id);
            return(
              <button key={item.id} onClick={()=>go(item.id)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:14,
                  padding:"13px 20px",background:isActive?"rgba(240,180,41,0.08)":"none",
                  border:"none",cursor:"pointer",fontFamily:"inherit",
                  borderLeft:isActive?"3px solid #f0b429":"3px solid transparent",
                  transition:"all .15s"}}>
                <span style={{fontSize:18,width:24,textAlign:"center"}}>{item.icon}</span>
                <span style={{fontSize:14,fontWeight:isActive?700:500,
                  color:isActive?G.gold:G.cream}}>{item.label}</span>
              </button>
            );
          })}

          {/* Log out */}
          <button onClick={()=>{onClose();window.dispatchEvent(new CustomEvent("signOut"));}}
            style={{width:"100%",display:"flex",alignItems:"center",gap:14,
              padding:"13px 20px",background:"none",border:"none",cursor:"pointer",
              fontFamily:"inherit",borderLeft:"3px solid transparent",marginTop:4}}>
            <span style={{fontSize:18,width:24,textAlign:"center"}}>🚪</span>
            <span style={{fontSize:14,fontWeight:500,color:"#e05c6e"}}>Log out</span>
          </button>
        </div>

        {/* Upgrade card */}
        {!isPaid&&(
          <div style={{margin:"0 16px 20px",padding:"16px",
            background:"linear-gradient(135deg,rgba(240,180,41,0.12),rgba(155,114,207,0.08))",
            border:"1px solid rgba(240,180,41,0.2)",borderRadius:16}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:22}}>👑</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:G.cream}}>Upgrade to Premium</div>
                <div style={{fontSize:11,color:G.dimmer}}>Unlock unlimited AI insights</div>
              </div>
            </div>
            <button onClick={()=>{onClose();onUnlock&&onUnlock();}}
              style={{width:"100%",padding:"10px",background:"#f0b429",border:"none",
                borderRadius:10,fontSize:13,fontWeight:700,color:"#000",
                cursor:"pointer",fontFamily:"inherit"}}>
              Upgrade Now
            </button>
          </div>
        )}
      </div>


    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORE SCREEN — Rebuilt to match premium mobile mockup
// ═══════════════════════════════════════════════════════════════════════════════
function ExploreScreen({setNav, formData, userId, isPaid, isPremium, isProMax, onUnlock, streak, navPhotoURL}){
  const [query,    setQuery]   = useState("");
  const [drawerOpen,setDrawerOpen] = useState(false);
  const [activeChip,setActiveChip] = useState(null);

  const G={
    gold:"#f0b429",cream:"#e8dcc8",dim:"rgba(232,220,200,0.55)",
    dimmer:"rgba(232,220,200,0.25)",bg:"#0a0800",
    card:"rgba(255,255,255,0.035)",border:"rgba(255,255,255,0.07)",
    lift:"rgba(255,255,255,0.06)",
  };

  const name = formData?.name?.split(" ")[0] || "You";

  const struggles = ["Overthinking","Lack of Discipline","Money Problems",
    "Confidence","Career Direction","Relationships","Anxiety","Purpose"];

  const recommended = CATEGORIES.slice(0,4).map(cat=>({
    icon:cat.icon, name:cat.label,
    reason:"Recommended because it aligns with your goals.",
    id:"category:"+cat.id
  }));

  const recentCats = CATEGORIES.slice(0,3);

  const filteredCats = query.trim()
    ? CATEGORIES.filter(cat=>
        cat.label.toLowerCase().includes(query.toLowerCase()) ||
        cat.desc.toLowerCase().includes(query.toLowerCase()))
    : CATEGORIES;

  const Card = ({children,style={},onClick})=>(
    <div onClick={onClick} style={{background:G.card,border:"1px solid "+G.border,
      borderRadius:16,overflow:"hidden",cursor:onClick?"pointer":"default",
      transition:"transform .15s,box-shadow .15s",...style}}
      onMouseEnter={e=>{if(onClick){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.3)";}}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
      {children}
    </div>
  );

  return(
    <div style={{background:G.bg,minHeight:"100vh",color:G.cream,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      paddingBottom:40,overflowX:"hidden"}}>

      {/* ── STICKY TOP NAV ── */}
      <div style={{position:"sticky",top:0,zIndex:200,
        background:"rgba(10,8,0,0.92)",backdropFilter:"blur(14px)",
        borderBottom:"1px solid "+G.border,padding:"12px 20px",
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>

        {/* Hamburger */}
        <button onClick={()=>setDrawerOpen(true)}
          style={{background:"none",border:"none",cursor:"pointer",
            padding:"6px 4px",display:"flex",flexDirection:"column",gap:5}}>
          {[0,1,2].map(i=>(
            <span key={i} style={{display:"block",width:22,height:2,
              background:G.cream,borderRadius:2}}/>
          ))}
        </button>

        {/* Logo */}
        <div style={{fontSize:18,fontWeight:900,color:G.cream,letterSpacing:"-.3px"}}>
          Destin<span style={{color:G.gold}}>IQ</span>
        </div>

        {/* Right icons */}
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>window.dispatchEvent(new CustomEvent("showNotif"))}
            style={{background:"none",border:"none",cursor:"pointer",
              fontSize:18,color:G.dim,padding:4,position:"relative"}}>
            🔔
          </button>
          <div onClick={()=>setNav("profile")}
            style={{width:34,height:34,borderRadius:"50%",cursor:"pointer",
              background:"linear-gradient(135deg,#f0b429,#c89010)",
              display:"flex",alignItems:"center",justifyContent:"center",
              overflow:"hidden",flexShrink:0}}>
            {navPhotoURL
              ? <img src={navPhotoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : <span style={{fontSize:14,fontWeight:800,color:"#000"}}>{name[0]?.toUpperCase()}</span>}
          </div>
        </div>
      </div>

      {/* ── DRAWER ── */}
      <SideDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)}
        nav="explore" setNav={setNav} formData={formData}
        isPaid={isPaid} isProMax={isProMax} streak={streak}
        navPhotoURL={navPhotoURL} onUnlock={onUnlock}
        onSignOut={()=>window.dispatchEvent(new CustomEvent("signOut"))}/>

      {/* ── PAGE CONTENT ── */}
      <div style={{padding:"20px 18px 0"}}>

        {/* Header */}
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:"clamp(26px,7vw,36px)",fontWeight:900,
            color:G.cream,margin:"0 0 4px",lineHeight:1.15}}>Explore</h1>
          <p style={{fontSize:13,color:G.dimmer,margin:0}}>
            Discover. Improve. Elevate.
          </p>
        </div>

        {/* ── SEARCH ── */}
        <div style={{position:"relative",marginBottom:24}}>
          <span style={{position:"absolute",left:14,top:"50%",
            transform:"translateY(-50%)",fontSize:14,opacity:.4}}>🔍</span>
          <input value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="What do you want to improve today?"
            style={{width:"100%",background:"rgba(255,255,255,0.06)",
              border:"1px solid "+G.border,borderRadius:14,
              padding:"12px 40px 12px 40px",fontSize:13,color:G.cream,
              outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          <span style={{position:"absolute",right:14,top:"50%",
            transform:"translateY(-50%)",fontSize:14,opacity:.4}}>✨</span>
        </div>

        {/* ── LIFE CATEGORIES ── */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:".12em",
            color:G.dimmer,fontFamily:"monospace",marginBottom:14}}>
            LIFE CATEGORIES
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filteredCats.map(cat=>(
              <div key={cat.id} onClick={()=>setNav("category:"+cat.id)}
                style={{background:G.card,border:"1px solid "+G.border,
                  borderRadius:16,padding:"14px 16px",
                  display:"flex",alignItems:"center",gap:14,cursor:"pointer",
                  transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";
                  e.currentTarget.style.borderColor="rgba(255,255,255,0.14)";}}
                onMouseLeave={e=>{e.currentTarget.style.background=G.card;
                  e.currentTarget.style.borderColor=G.border;}}>
                {/* Icon */}
                <div style={{width:52,height:52,borderRadius:14,flexShrink:0,
                  background:`linear-gradient(135deg,${cat.color}33,${cat.color}18)`,
                  border:`1px solid ${cat.color}44`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:24}}>
                  {cat.icon}
                </div>
                {/* Text */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:G.cream,
                    marginBottom:2}}>{cat.label}</div>
                  <div style={{fontSize:12,color:G.dim,
                    overflow:"hidden",textOverflow:"ellipsis",
                    whiteSpace:"nowrap",marginBottom:4}}>{cat.desc}</div>
                  <div style={{fontSize:11,color:cat.color,fontWeight:600}}>
                    {cat.tools.length} tools
                  </div>
                </div>
                {/* Arrow */}
                <span style={{color:G.dimmer,fontSize:18,flexShrink:0}}>›</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── STRUGGLING WITH ── */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:".12em",
            color:G.dimmer,fontFamily:"monospace",marginBottom:14}}>
            WHAT ARE YOU STRUGGLING WITH?
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {struggles.map(s=>(
              <button key={s} onClick={()=>setActiveChip(activeChip===s?null:s)}
                style={{padding:"8px 14px",borderRadius:20,fontSize:12,fontWeight:600,
                  border:"1px solid "+(activeChip===s?G.gold:G.border),
                  background:activeChip===s?"rgba(240,180,41,0.12)":"rgba(255,255,255,0.04)",
                  color:activeChip===s?G.gold:G.cream,cursor:"pointer",
                  fontFamily:"inherit",transition:"all .15s"}}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── RECOMMENDED FOR YOU ── */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:".12em",
              color:G.dimmer,fontFamily:"monospace"}}>RECOMMENDED FOR YOU</div>
            <button onClick={()=>setNav("explore")}
              style={{fontSize:11,color:G.gold,background:"none",border:"none",
                cursor:"pointer",fontFamily:"inherit"}}>View all</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {recommended.map((item,i)=>(
              <div key={i} onClick={()=>setNav(item.id)}
                style={{background:G.card,border:"1px solid "+G.border,
                  borderRadius:14,padding:"14px 12px",cursor:"pointer",
                  display:"flex",flexDirection:"column",gap:8,
                  transition:"all .15s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(240,180,41,0.2)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=G.border}>
                <div style={{fontSize:28,lineHeight:1}}>{item.icon}</div>
                <div style={{fontSize:13,fontWeight:700,color:G.cream,
                  lineHeight:1.3}}>{item.name}</div>
                <div style={{fontSize:11,color:G.dimmer,lineHeight:1.5,flex:1}}>
                  {item.reason}
                </div>
                <button style={{padding:"7px 12px",background:"rgba(240,180,41,0.1)",
                  border:"1px solid rgba(240,180,41,0.2)",borderRadius:8,
                  fontSize:11,fontWeight:700,color:G.gold,cursor:"pointer",
                  fontFamily:"inherit",textAlign:"center"}}>
                  Open →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── CONTINUE EXPLORING ── */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:".12em",
              color:G.dimmer,fontFamily:"monospace"}}>CONTINUE EXPLORING</div>
            <button style={{fontSize:11,color:G.gold,background:"none",border:"none",
              cursor:"pointer",fontFamily:"inherit"}}>View all</button>
          </div>
          <div style={{display:"flex",gap:10,overflowX:"auto",
            paddingBottom:8,scrollbarWidth:"none"}}>
            {recentCats.map((cat,i)=>{
              const progress = [60,40,20][i];
              return(
                <div key={cat.id} onClick={()=>setNav("category:"+cat.id)}
                  style={{flexShrink:0,width:"clamp(140px,42vw,170px)",
                    background:G.card,border:"1px solid "+G.border,
                    borderRadius:14,padding:"14px 12px",cursor:"pointer"}}>
                  <div style={{fontSize:22,marginBottom:8}}>{cat.icon}</div>
                  <div style={{fontSize:13,fontWeight:700,color:G.cream,
                    marginBottom:2}}>{cat.label}</div>
                  <div style={{fontSize:10,color:G.dimmer,marginBottom:10}}>
                    Last visited {i===0?"2 days ago":i===1?"3 days ago":"5 days ago"}
                  </div>
                  {/* Progress bar */}
                  <div style={{height:3,background:"rgba(255,255,255,0.08)",
                    borderRadius:2,marginBottom:10,overflow:"hidden"}}>
                    <div style={{height:"100%",width:progress+"%",
                      background:G.gold,borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:10,color:G.dimmer,marginBottom:8}}>
                    {progress}% progress
                  </div>
                  <button style={{width:"100%",padding:"7px",
                    background:"rgba(240,180,41,0.08)",
                    border:"1px solid rgba(240,180,41,0.15)",
                    borderRadius:8,fontSize:11,fontWeight:700,
                    color:G.gold,cursor:"pointer",fontFamily:"inherit"}}>
                    Continue
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── FEATURED JOURNEY ── */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:".12em",
            color:G.dimmer,fontFamily:"monospace",marginBottom:14}}>
            FEATURED JOURNEY
          </div>
          <div onClick={()=>setNav("category:money")}
            style={{borderRadius:20,overflow:"hidden",cursor:"pointer",
              position:"relative",
              background:"linear-gradient(135deg,#1a1200,#2d1f00)",
              border:"1px solid rgba(240,180,41,0.2)",padding:"24px 20px 20px"}}>
            {/* Background glow */}
            <div style={{position:"absolute",top:0,right:0,width:"60%",height:"100%",
              background:"radial-gradient(ellipse at 80% 20%,rgba(240,180,41,0.12),transparent 70%)",
              pointerEvents:"none"}}/>
            <div style={{position:"absolute",top:16,right:16,fontSize:20}}>⭐</div>
            <div style={{fontSize:"clamp(20px,5vw,26px)",fontWeight:900,
              color:G.cream,margin:"0 0 8px",lineHeight:1.2,maxWidth:"75%"}}>
              Become Financially Independent
            </div>
            <div style={{fontSize:13,color:G.dim,marginBottom:16,maxWidth:"80%",
              lineHeight:1.6}}>
              A step-by-step journey to build wealth, freedom and security.
            </div>
            <div style={{display:"flex",gap:16,marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:G.dimmer}}>
                <span>⏱</span> 7 days
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:G.dimmer}}>
                <span>⚡</span> 10 steps/tools
              </div>
            </div>
            <button style={{padding:"12px 24px",background:G.gold,border:"none",
              borderRadius:12,fontSize:14,fontWeight:700,color:"#000",
              cursor:"pointer",fontFamily:"inherit",
              boxShadow:"0 4px 20px rgba(240,180,41,0.3)"}}>
              Start Journey →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function CategoryPage({catId,setNav,goBack,userId}){
  const cat=CATEGORIES.find(c=>c.id===catId);
  if(!cat) return null;

  const G={
    gold:"#f0b429",bg:"#0a0800",card:"#111008",
    border:"rgba(232,220,200,0.07)",cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)",
  };

  return(
    <div style={{padding:"20px 20px 90px",minHeight:"100vh",background:G.bg,
      color:G.cream,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>

      {/* Back */}
      <button onClick={()=>goBack?goBack():setNav("explore")}
        style={{background:"none",border:"none",color:G.dim,cursor:"pointer",
          fontSize:13,padding:"0 0 18px",display:"flex",alignItems:"center",gap:6}}>
        ← Back
      </button>

      {/* Hero */}
      <div style={{background:`linear-gradient(135deg,${cat.color}12,${cat.color}04)`,
        border:`1px solid ${cat.color}28`,borderRadius:18,padding:"22px",
        marginBottom:24,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:56,height:56,borderRadius:16,
          background:`${cat.color}20`,border:`1px solid ${cat.color}30`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:28,flexShrink:0}}>{cat.icon}</div>
        <div>
          <h2 style={{fontSize:20,fontWeight:800,color:G.cream,margin:"0 0 4px"}}>{cat.label}</h2>
          <p style={{fontSize:12,color:cat.color,margin:"0 0 2px",fontWeight:600}}>
            {cat.tools.length} intelligence tools
          </p>
          <p style={{fontSize:12,color:G.dim,margin:0,lineHeight:1.5}}>{cat.desc}</p>
        </div>
      </div>

      {/* Tools */}
      <div style={{fontSize:10,color:G.dimmer,letterSpacing:".1em",fontFamily:"monospace",
        textTransform:"uppercase",marginBottom:14}}>All Tools</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {cat.tools.map(tid=>{
          const m=TOOL_META[tid]; if(!m) return null;
          const visited=(()=>{try{return!!localStorage.getItem(`diq_mod_${tid}_${userId}`);}catch{return false;}})();
          return(
            <div key={tid} onClick={()=>setNav("tool:"+tid)}
              style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",
                background:G.card,border:`1px solid ${visited?cat.color+"25":G.border}`,
                borderRadius:14,cursor:"pointer",transition:"all .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=cat.color+"45";e.currentTarget.style.background=cat.color+"07";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=visited?cat.color+"25":G.border;e.currentTarget.style.background=G.card;}}>
              <div style={{width:44,height:44,borderRadius:12,
                background:`${m.color||cat.color}15`,border:`1px solid ${m.color||cat.color}25`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:20,flexShrink:0}}>{m.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:G.cream,marginBottom:2}}>{m.label}</div>
                {visited&&<div style={{fontSize:10,color:cat.color,fontWeight:600}}>✓ Explored</div>}
              </div>
              <span style={{color:G.dimmer,fontSize:20,flexShrink:0}}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ToolPage ──────────────────────────────────────────────────────────────
function ToolPage({toolId,setNav,goBack,formData,userId,isPaid,isPremium,isProMax,onUnlock,lang}){
  const meta=TOOL_META[toolId];
  const cat=meta?CATEGORIES.find(c=>c.id===meta.cat):null;
  const isToolFree = FREE_TOOLS.includes(toolId)||toolId==="advisor";
  if(!isPaid && !isToolFree){
    return(
      <div style={{padding:"40px 24px",textAlign:"center",maxWidth:420,margin:"0 auto",
        color:"#e8dcc8",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
        <div style={{fontSize:"clamp(32px,10vw,52px)",marginBottom:16}}>{meta?.icon||"🔒"}</div>
        <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 10px",color:"#e8dcc8"}}>{meta?.label||"This Tool"}</h2>
        <p style={{fontSize:14,color:"rgba(232,220,200,0.5)",lineHeight:1.7,margin:"0 0 24px"}}>
          This tool is part of the Pro plan. Upgrade to unlock all 42 intelligence tools.
        </p>
        <button onClick={onUnlock}
          style={{width:"100%",padding:"15px",background:"#f0b429",color:"#000",border:"none",
            borderRadius:13,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            marginBottom:12}}>
          ✦ Unlock All 42 Tools
        </button>
        <button onClick={()=>goBack?goBack():setNav("explore")}
          style={{background:"none",border:"none",color:"rgba(232,220,200,0.4)",
            cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>
          ← Go back
        </button>
        <div style={{marginTop:24,padding:"14px 16px",background:"rgba(240,180,41,0.06)",
          border:"1px solid rgba(240,180,41,0.15)",borderRadius:12}}>
          <div style={{fontSize:11,color:"#f0b429",fontWeight:700,marginBottom:6}}>FREE TOOLS AVAILABLE</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
            {FREE_TOOLS.map(t=>(
              <span key={t} onClick={()=>setNav("tool:"+t)}
                style={{padding:"4px 10px",background:"rgba(255,255,255,0.05)",
                  border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,
                  fontSize:11,color:"rgba(232,220,200,0.6)",cursor:"pointer"}}>
                {TOOL_META[t]?.icon} {TOOL_META[t]?.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const [fu,setFu]=useState(""); const [fuRes,setFuRes]=useState(""); const [fuL,setFuL]=useState(false); const [bm,setBm]=useState(false);
  useEffect(()=>{
    if(!userId||!toolId) return;
    try{
      localStorage.setItem(`diq_last_tool_${userId}`,JSON.stringify({id:toolId,label:meta?.label||toolId,progress:45,ts:Date.now()}));
      const k=`diq_tlist_${userId}`;const e=new Set(JSON.parse(localStorage.getItem(k)||"[]"));e.add(toolId);localStorage.setItem(k,JSON.stringify([...e]));
    }catch{}
  },[toolId,userId]);
  const submit=async()=>{
    if(!fu.trim()) return; setFuL(true);
    try{const r=await callAPI({messages:[{role:"user",content:`On ${meta?.label||toolId}: ${fu}`}],system:`You are DestinIQ. Answer this follow-up about ${meta?.label||toolId}. Profile: ${buildProfileContext(formData)}.`,userId,isPremium,isProMax});setFuRes(r?.content?.[0]?.text||r||"");}
    catch{setFuRes("Something went wrong. Try again.");}
    setFuL(false);setFu("");
  };
  const related=(cat?.tools||[]).filter(t=>t!==toolId).slice(0,3);
  return(
    <div className="pg">
      <button className="pg-back" onClick={()=>goBack?goBack():setNav(cat?"category:"+cat.id:"explore")} style={{cursor:"pointer"}}>← {cat?.label||"Back"}</button>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        <div style={{width:46,height:46,borderRadius:13,background:`${meta?.color||"var(--gold)"}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{meta?.icon||"✦"}</div>
        <div>
          <h2 style={{fontSize:19,fontWeight:800,color:"var(--cream)",margin:"0 0 2px"}}>{meta?.label||toolId}</h2>
          {cat&&<p style={{fontSize:11,color:meta?.color||"var(--gold)",margin:0}}>{cat.label}</p>}
        </div>
      </div>
      <div className="tool-act-bar">
        <button className="t-btn pri">🔊 Listen</button>
        <button className="t-btn">↺ Refresh</button>
        <button className="t-btn" style={{color:bm?"var(--gold)":""}} onClick={()=>setBm(b=>!b)}>{bm?"★ Saved":"☆ Save"}</button>
        <button className="t-btn">↗ Share</button>
      </div>
      <GenericAIModule modId={toolId} profile={formData} userId={userId} isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} onUnlock={onUnlock} lang={lang||"en"}/>
      <div className="followup">
        <label>Ask DestinIQ a follow-up</label>
        <div className="fu-row">
          <input className="fu-input" value={fu} onChange={e=>setFu(e.target.value)} placeholder="What should I focus on?" onKeyDown={e=>e.key==="Enter"&&submit()}/>
          <button className="btn btn-gold" style={{padding:"10px 16px",fontSize:13}} onClick={submit} disabled={fuL}>{fuL?"…":"→"}</button>
        </div>
        {fuRes&&<div style={{marginTop:10,padding:"12px",background:"var(--midnight)",borderRadius:10,fontSize:13,color:"var(--cream-70)",lineHeight:1.85}}>{fuRes}</div>}
      </div>
      {related.length>0&&(
        <div style={{marginTop:22}}>
          <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--cream-30)",letterSpacing:".1em",marginBottom:10,textTransform:"uppercase"}}>Related Tools</div>
          {related.map(t=>{const m=TOOL_META[t];if(!m)return null;return(
            <div key={t} className="tool-row" onClick={()=>setNav("tool:"+t)}>
              <div className="tr-ico" style={{background:`${m.color}18`}}>{m.icon}</div>
              <span className="tr-lbl">{m.label}</span>
              <span style={{color:"var(--cream-20)",fontSize:18}}>›</span>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}

// ── ProgressScreen ────────────────────────────────────────────────────────
function ProgressScreen({data,streak,userId,setNav,goBack}){
  const s=data?.scores||{};
  const overall=Math.min(99,Math.max(1,Math.round((s.life||60)*.25+(s.wealth||60)*.3+(s.mindset||60)*.25+(s.relations||60)*.2)));
  const toolCount=(()=>{try{return JSON.parse(localStorage.getItem(`diq_tlist_${userId}`)||"[]").length;}catch{return 0;}})();
  const reportCount=Math.max(1,data?.score_history?.length||1);

  // Build last-7-days journey from momentum log
  const log=getMomentumLog(userId);
  const avgOf=e=>e?Math.round(((e.energy||5)+(e.focus||5)+(e.momentum||5))/3*10):null;
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const last7=Array.from({length:7},(_,i)=>{
    const entry=log[Math.max(0,log.length-7+i)];
    return entry?avgOf(entry):(30+Math.round(Math.sin(i*0.9+1)*20+Math.random()*15));
  });
  const maxV=Math.max(...last7);
  const minV=Math.min(...last7);
  const range=maxV-minV||1;
  const W=300,H=80;
  const pts=last7.map((v,i)=>[Math.round((i/(days.length-1))*W),Math.round(H-((v-minV)/range)*(H*0.75)-H*0.12)]);
  const polyPts=pts.map(([x,y])=>`${x},${y}`).join(" ");
  const areaPath=`M0,${H} ${polyPts} ${W},${H} Z`;

  // Ring
  const R=48,SW=8,circ=2*Math.PI*R;
  const off=circ-(overall/100)*circ;

  return(
    <div style={{padding:"0 0 90px",minHeight:"100vh",background:"var(--bg)",overflowX:"hidden"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"18px 16px 14px",flexWrap:"wrap"}}>
        <button onClick={()=>goBack?goBack():setNav("home")} style={{background:"none",border:"none",color:"var(--cream-50)",cursor:"pointer",fontSize:22,padding:0,lineHeight:1,minWidth:32,minHeight:32}}>←</button>
        <h2 style={{fontSize:20,fontWeight:800,color:"var(--cream)",margin:0}}>Progress</h2>
      </div>

      <div style={{padding:"0 16px"}}>

        {/* Overview label */}
        <div style={{fontSize:12,fontWeight:700,color:"var(--cream-50)",letterSpacing:".06em",marginBottom:14}}>Overview</div>

        {/* Score + Stats row */}
        <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:22,background:"var(--night)",border:"1px solid var(--cream-10)",borderRadius:16,padding:"18px"}}>

          {/* Circular ring */}
          <div style={{position:"relative",width:108,height:108,flexShrink:0}}>
            <svg width={108} height={108} style={{transform:"rotate(-90deg)",position:"absolute",inset:0}}>
              <circle cx={54} cy={54} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={SW}/>
              <circle cx={54} cy={54} r={R} fill="none" stroke="var(--gold)" strokeWidth={SW}
                strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:800,color:"var(--cream)",lineHeight:1}}>{overall}%</span>
              <span style={{fontSize:10,color:"var(--cream-40)",marginTop:2}}>Overall</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{display:"flex",flexDirection:"column",gap:12,flex:1}}>
            {[
              {icon:"🔧",val:toolCount||12,label:"Tools Explored",color:"#64b5f6"},
              {icon:"📋",val:reportCount,   label:"Reports Generated",color:"#81c784"},
              {icon:"🔥",val:streak||1,      label:"Day Streak",color:"#ff8a65"},
            ].map(({icon,val,label,color})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:9}}>
                <span style={{fontSize:17}}>{icon}</span>
                <div>
                  <span style={{fontSize:17,fontWeight:800,color,marginRight:5}}>{val}</span>
                  <span style={{fontSize:11,color:"var(--cream-40)"}}>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Your Journey chart */}
        <div style={{background:"var(--night)",border:"1px solid var(--cream-10)",borderRadius:16,padding:"16px",marginBottom:22}}>
          <div style={{fontSize:14,fontWeight:700,color:"var(--cream)",marginBottom:10}}>Your Journey</div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:9,color:"var(--cream-30)"}}>100%</span>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H+4}`} preserveAspectRatio="xMidYMid meet" style={{overflow:"visible"}}>
            <defs>
              <linearGradient id="jGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1ab89a" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="#1ab89a" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* Horizontal grid lines */}
            {[0.2,0.5,0.8].map((pct,i)=>(
              <line key={i} x1={0} y1={H*pct} x2={W} y2={H*pct} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>
            ))}
            <path d={areaPath} fill="url(#jGrad)"/>
            <polyline points={polyPts} fill="none" stroke="var(--teal)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
            {pts.map(([x,y],i)=>(
              <circle key={i} cx={x} cy={y} r={3.5} fill="var(--teal)" stroke="var(--bg)" strokeWidth={1.5}/>
            ))}
          </svg>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            {days.map(d=><span key={d} style={{fontSize:9,color:"var(--cream-30)"}}>{d}</span>)}
          </div>
          <div style={{fontSize:9,color:"var(--cream-30)",marginTop:3}}>0%</div>
        </div>

        {/* Categories Progress */}
        <div style={{fontSize:12,fontWeight:700,color:"var(--cream-50)",letterSpacing:".06em",marginBottom:14}}>Categories Progress</div>
        {CATEGORIES.map(cat=>{
          const done=(Array.isArray(cat?.tools)?cat.tools:[]).filter(t=>{try{return!!localStorage.getItem(`diq_mod_${t}_${userId}`);}catch{return false;}}).length;
          const pct=cat.tools.length?Math.round((done/cat.tools.length)*100):0;
          return(
            <div key={cat.id} style={{marginBottom:16,cursor:"pointer"}} onClick={()=>setNav("category:"+cat.id)}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:`${cat.color}18`,border:`1px solid ${cat.color}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                  {cat.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:600,color:"var(--cream)"}}>{cat.label}</span>
                    <span style={{fontSize:12,fontWeight:700,color:cat.color}}>{pct}%</span>
                  </div>
                  <div style={{height:5,borderRadius:5,background:"rgba(255,255,255,.06)"}}>
                    <div style={{height:"100%",borderRadius:5,background:`linear-gradient(90deg,${cat.color},${cat.color}aa)`,width:`${pct}%`,transition:"width .8s ease"}}/>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DASHBOARD PROFILE VIEW ──────────────────────────────────────────────────
// Clean profile page matching the Image 2 design spec
function DashboardProfileView({user,formData,isPaid,isPremium,isProMax,streak,onSignOut,onManageSubscription,setNav,navPhotoURL,onEditProfile}){
  const name    = formData?.name||user?.name||(user?.email?.split("@")[0])||"User";
  const email   = user?.email||"";
  const initial = (name[0]||"U").toUpperCase();

  const [photoURL,   setPhotoURL  ]=useState(navPhotoURL||null);
  const [uploading,  setUploading ]=useState(false);
  const fileRef = useRef(null);

  // Keep in sync if navPhotoURL changes (e.g. on initial load)
  useEffect(()=>{ if(navPhotoURL&&!photoURL) setPhotoURL(navPhotoURL); },[navPhotoURL]);

  const handlePhotoChange=async(e)=>{
    const file=e.target.files?.[0];
    if(!file||!user?.id) return;
    setUploading(true);
    try{
      if(typeof createImageBitmap==="undefined"){
        console.warn("createImageBitmap not supported in this browser");
        setUploading(false); return;
      }
      const bitmap=await createImageBitmap(file);
      const canvas=document.createElement("canvas");
      canvas.width=240; canvas.height=240;
      const ctx=canvas.getContext("2d");
      // Centre-crop to square
      const size=Math.min(bitmap.width,bitmap.height);
      const ox=(bitmap.width-size)/2, oy=(bitmap.height-size)/2;
      ctx.drawImage(bitmap,ox,oy,size,size,0,0,240,240);
      const blob=await new Promise(res=>canvas.toBlob(res,"image/jpeg",0.87));
      const{error}=await supabase.storage.from("avatars")
        .upload(`${user.id}/avatar`,blob,{contentType:"image/jpeg",upsert:true});
      if(error) throw error;
      const{data}=supabase.storage.from("avatars").getPublicUrl(`${user.id}/avatar`);
      const newUrl=data.publicUrl+"?t="+Date.now();
      setPhotoURL(newUrl);
      // Notify nav bar + sidebar to update avatar everywhere
      window.dispatchEvent(new CustomEvent("photoUpdated",{detail:{url:newUrl}}));
    }catch(err){
      console.warn("Photo upload failed:",err?.message||err);
    }
    setUploading(false);
    // Reset input so same file can be re-selected
    e.target.value="";
  };

  const G={
    gold:"#f0b429",bg:"#0a0800",card:"#111008",
    border:"rgba(232,220,200,0.07)",cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)",
  };

  const menuItems=[
    {icon:"✏️",label:"Edit Profile",    action:()=>onEditProfile?.()},
    {icon:"⚡",label:"My Practices",    action:()=>setNav("practices")},
    {icon:"📋",label:"Saved Reports",   action:()=>setNav("savedreports")},
    {icon:"📈",label:"Report History",  action:()=>setNav("savedreports")},
    {icon:"⚙️",label:"Settings",        action:()=>window.dispatchEvent(new CustomEvent("showEditProfile"))},
    {icon:"❓",label:"Help & Support",  action:()=>window.open("mailto:support@destiniq.app")},
  ];

  return(
    <div style={{padding:"18px 0 90px",minHeight:"100vh",background:G.bg}}>

      {/* Header */}
      <div style={{padding:"0 20px 20px"}}>
        <h2 style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:800,color:G.cream,margin:"0 0 20px"}}>Profile</h2>

        {/* Avatar + info row */}
        <div style={{display:"flex",alignItems:"center",gap:14}}>

          {/* Tappable avatar with camera overlay */}
          <div style={{position:"relative",flexShrink:0,cursor:"pointer"}}
            onClick={()=>!uploading&&fileRef.current?.click()}
            title="Tap to change photo">
            <div style={{width:70,height:70,borderRadius:"50%",
              background:"linear-gradient(135deg,var(--gold),var(--teal))",
              border:"3px solid rgba(212,175,55,0.3)",display:"flex",
              alignItems:"center",justifyContent:"center",
              fontSize:"clamp(18px,5vw,26px)",fontWeight:800,color:"#000",overflow:"hidden",
              opacity:uploading?.6:1,transition:"opacity .2s"}}>
              {(photoURL||navPhotoURL)
                ?<img src={photoURL||navPhotoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :initial
              }
            </div>
            {/* Camera badge */}
            <div style={{position:"absolute",bottom:1,right:1,
              width:22,height:22,borderRadius:"50%",
              background:uploading?"rgba(255,255,255,0.3)":G.gold,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:11,border:"2px solid "+G.bg,transition:"background .2s"}}>
              {uploading?"⟳":"📷"}
            </div>
            {/* Hidden file input */}
            <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif"
              style={{display:"none"}} onChange={handlePhotoChange}/>
          </div>

          <div>
            <div style={{fontSize:18,fontWeight:800,color:G.cream,marginBottom:3}}>{name}</div>
            {email&&<div style={{fontSize:12,color:G.dim,marginBottom:7}}>{email}</div>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {isPaid&&(
                <div style={{display:"inline-flex",alignItems:"center",gap:4,
                  padding:"3px 10px",background:"rgba(212,175,55,0.12)",
                  border:"1px solid rgba(212,175,55,0.3)",borderRadius:20}}>
                  <span style={{fontSize:9,fontWeight:800,color:G.gold,
                    fontFamily:"var(--f-mono)",letterSpacing:".06em"}}>
                    {isProMax?"✦ PRO MAX":"⬡ PRO"}
                  </span>
                </div>
              )}
              {streak>0&&(
                <div style={{display:"inline-flex",alignItems:"center",gap:4,
                  padding:"3px 9px",background:"rgba(255,138,101,0.1)",
                  border:"1px solid rgba(255,138,101,0.25)",borderRadius:20}}>
                  <span style={{fontSize:11}}>🔥</span>
                  <span style={{fontSize:10,fontWeight:700,color:"#ff8a65"}}>{streak} day streak</span>
                </div>
              )}
            </div>
            {/* Upload hint */}
            <button onClick={()=>!uploading&&fileRef.current?.click()}
              style={{background:"none",border:"none",color:G.dimmer,cursor:"pointer",
                fontSize:11,padding:"4px 0 0",fontFamily:"inherit",textDecoration:"underline",
                textDecorationColor:"rgba(232,220,200,0.15)"}}>
              {uploading?"Uploading…":"Change photo"}
            </button>
          </div>
        </div>
      </div>

      {/* Menu list */}
      <div style={{padding:"0 16px"}}>
        <div style={{background:G.card,border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:16,overflow:"hidden",marginBottom:14}}>
          {menuItems.map((item,i)=>(
            <div key={item.label} onClick={item.action}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"15px 18px",cursor:"pointer",
                borderBottom:i<menuItems.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}>
              <div style={{display:"flex",alignItems:"center",gap:13}}>
                <span style={{fontSize:16,width:22,textAlign:"center"}}>{item.icon}</span>
                <span style={{fontSize:15,color:G.cream}}>{item.label}</span>
              </div>
              <span style={{color:G.dimmer,fontSize:18}}>›</span>
            </div>
          ))}
        </div>

        {!isPaid&&(
          <div style={{background:"linear-gradient(135deg,rgba(212,175,55,0.08),rgba(212,175,55,0.02))",
            border:"1px solid rgba(212,175,55,0.2)",borderRadius:14,padding:"16px 18px",
            marginBottom:14,cursor:"pointer"}} onClick={onManageSubscription}>
            <div style={{fontSize:13,fontWeight:700,color:G.gold,marginBottom:4}}>✦ Upgrade to Pro</div>
            <div style={{fontSize:12,color:G.dim}}>Unlock all 40+ tools, deep reports and unlimited AI advisor.</div>
          </div>
        )}

        <button onClick={onSignOut}
          style={{width:"100%",padding:"15px",background:"transparent",color:"#e05252",
            border:"1px solid rgba(224,82,82,0.2)",borderRadius:12,fontSize:14,
            fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
          <span style={{fontSize:16}}>↗</span> Sign Out
        </button>
      </div>
    </div>
  );
}


function MyReport({data, formData, isPaid, isPremium, isProMax, onUnlock, userId, streak, setNav, lang="en"}){
  const [exStr, setExStr]=useState(false);
  const [exBls, setExBls]=useState(false);
  const [exOpp, setExOpp]=useState(false);

  // ── Data extraction helpers ──────────────────────────────────────────────
  const txt=(v)=>{
    if(!v) return "";
    if(typeof v==="string") return v;
    if(v?.content) return String(v.content);
    if(Array.isArray(v)) return v.filter(Boolean).map(x=>typeof x==="string"?x:x?.content||"").join(" ");
    return String(v);
  };

  const scores  = data?.scores||{};
  const overall = Math.min(99,Math.max(1,Math.round(
    (scores.life||60)*.25+(scores.wealth||60)*.3+(scores.mindset||60)*.25+(scores.relations||60)*.2
  )));

  const scoreMsg = overall>=80?"You are ahead of most. Stay consistent and keep executing."
    :overall>=70?"You're on the right path. Keep building momentum!"
    :overall>=60?"Great foundations. A few key shifts will unlock your potential."
    :"This is your starting point. Every expert was once a beginner.";

  const summary=txt(data?.headline)||txt(data?.sections?.[0]?.content)||txt(data?.sections?.[0])||
    "You're a determined individual with strong ambition and a desire for financial freedom. You have clarity about your goals but struggle with consistency and overthinking. With the right structure and focus, you can achieve remarkable results in the next 12 months.";

  // Highlight last sentence in gold
  const lastDot = summary.lastIndexOf('. ', summary.length-2);
  const summaryBefore = lastDot>0 ? summary.slice(0,lastDot+1) : "";
  const summaryLast   = lastDot>0 ? summary.slice(lastDot+2)   : summary;

  const strengths=(()=>{
    if(Array.isArray(data?.strengths)&&data.strengths.length) return data.strengths;
    return ["Strong work ethic","Clear long-term vision","Adaptability","Problem-solving mindset","Curiosity and desire to learn"];
  })();

  const blindSpots=(()=>{
    if(Array.isArray(data?.holding_back)&&data.holding_back.length) return data.holding_back;
    const bl=Array.isArray(formData?.blockers)?formData.blockers:[];
    if(bl.length) return bl;
    return ["Overthinking and self-doubt","Inconsistent habits","People-pleasing","Fear of taking bold action"];
  })();

  const opportunities=(()=>{
    if(Array.isArray(data?.priorities)&&data.priorities.length) return data.priorities;
    if(Array.isArray(data?.roadmap)&&data.roadmap.length)
      return (Array.isArray(data?.roadmap)?data.roadmap:[]).filter(r=>r&&typeof r==="object").map(r=>txt(r.title)||txt(r.desc));
    return ["Build consistent daily habits","Improve financial management","Develop social confidence","Focus on one income stream"];
  })();

  // ── Dynamic stats ────────────────────────────────────────────────────────
  const dataPoints = formData ? Math.max(40,Object.values(formData).filter(v=>v&&String(v).length>0).length*7) : 47;
  const insights   = Math.max(10, (Array.isArray(data?.strengths)?data.strengths.length:0)
    +(Array.isArray(data?.priorities)?data.priorities.length:0)
    +(Array.isArray(data?.roadmap)?(Array.isArray(data?.roadmap)?data.roadmap:[]).filter(r=>r&&typeof r==="object").length*2:0)||12);
  const confidence = Math.min(98,Math.max(85,overall+16));
  const genDate    = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});

  // ── SVG Ring ────────────────────────────────────────────────────────────
  const R=62,SW=9,circ=2*Math.PI*R,off=circ-(overall/100)*circ;

  // ── Design tokens ────────────────────────────────────────────────────────
  const G={
    gold:"#f0b429",bg:"#0a0800",card:"#111008",
    border:"rgba(232,220,200,0.07)",cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)",
  };
  const card={background:G.card,border:"1px solid "+G.border,borderRadius:16,padding:"22px",boxSizing:"border-box"};

  // ── List item helpers ────────────────────────────────────────────────────
  const getLabel=(v)=>typeof v==="string"?v:txt(v?.label||v?.name||v?.title||v?.task||"");

  const CheckRow=({item,color="#81c784"})=>(
    <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
      <div style={{width:19,height:19,borderRadius:"50%",background:color+"18",border:"1px solid "+color+"30",
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
        <span style={{fontSize:10,color,fontWeight:700}}>✓</span>
      </div>
      <span style={{fontSize:13,color:G.dim,lineHeight:1.55}}>{getLabel(item)}</span>
    </div>
  );

  const DotRow=({item})=>(
    <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
      <div style={{width:19,height:19,borderRadius:"50%",background:"rgba(224,82,82,0.1)",
        border:"1px solid rgba(224,82,82,0.22)",display:"flex",alignItems:"center",
        justifyContent:"center",flexShrink:0,marginTop:1}}>
        <span style={{fontSize:10,color:"#e05252"}}>•</span>
      </div>
      <span style={{fontSize:13,color:G.dim,lineHeight:1.55}}>{getLabel(item)}</span>
    </div>
  );

  const ViewBtn=({expanded,toggle})=>(
    <button onClick={toggle}
      style={{background:"none",border:"1px solid rgba(240,180,41,0.2)",borderRadius:8,
        padding:"4px 10px",fontSize:11,color:G.gold,cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>
      {expanded?"Less":"View all"}
    </button>
  );

  return(
    <div style={{padding:"20px 16px 90px",maxWidth:1160,margin:"0 auto",
      color:G.cream,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      boxSizing:"border-box"}}>

      {/* ══════════════════════════════════════════
          1. SUCCESS BADGE + HEADER
      ══════════════════════════════════════════ */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
        gap:24,marginBottom:28,flexWrap:"wrap"}}>

        {/* Left: heading */}
        <div style={{flex:"1 1 380px",minWidth:0}}>
          {/* ✨ Report Ready badge */}
          <div style={{display:"inline-flex",alignItems:"center",gap:6,
            background:"rgba(240,180,41,0.07)",border:"1px solid rgba(240,180,41,0.25)",
            borderRadius:20,padding:"5px 14px",marginBottom:20}}>
            <span style={{fontSize:13}}>✨</span>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:".8px",
              color:G.gold,fontFamily:"monospace"}}>REPORT READY</span>
          </div>

          <h1 style={{fontSize:"clamp(22px,3.5vw,38px)",fontWeight:800,lineHeight:1.18,
            margin:"0 0 14px",color:G.cream,letterSpacing:"-.3px"}}>
            Your Personal{" "}
            <span style={{color:G.gold}}>Intelligence</span>{" "}
            Report is Ready 👋
          </h1>

          <p style={{fontSize:14,color:G.dim,lineHeight:1.72,margin:"0 0 20px",maxWidth:520}}>
            We've analyzed your responses and created a personalized report just for you.{" "}
            This is the beginning of your transformation journey.
          </p>

          <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:G.dimmer}}>
              <span>📅</span><span>{genDate}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:G.dimmer}}>
              <span>⏱</span><span>Generated in 23 seconds</span>
            </div>
          </div>
        </div>

        {/* Export PDF + Comparison (Pro Max) */}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:8,flexWrap:"wrap"}}>
          {isPaid&&(
            <button onClick={()=>exportReportPDF(formData,data,scores,overall)}
              style={{padding:"7px 15px",background:isProMax?"rgba(155,114,207,0.12)":"rgba(255,255,255,0.05)",
                border:`1px solid ${isProMax?"rgba(155,114,207,0.35)":"rgba(255,255,255,0.1)"}`,
                borderRadius:20,color:isProMax?"#9b72cf":"rgba(232,220,200,0.4)",
                fontSize:12,cursor:isProMax?"pointer":"default",fontFamily:"inherit"}}>
              {isProMax?"📄 Export PDF":"🔒 Export PDF (Pro Max)"}
            </button>
          )}
        </div>
        {isProMax&&<ScoreComparisonCard userId={userId} currentScores={scores} currentOverall={overall}/>}
        {/* Right: Overall Intelligence Score ring */}
        <div style={{...card,flex:"0 0 240px",textAlign:"center",padding:"28px 24px",
          background:"linear-gradient(145deg,#111008,#0e0c05)",
          boxShadow:"0 0 50px rgba(240,180,41,0.05)"}}>
          <div style={{fontSize:9,color:G.dimmer,letterSpacing:".14em",
            fontFamily:"monospace",marginBottom:18}}>OVERALL INTELLIGENCE SCORE ℹ</div>

          <div style={{position:"relative",width:144,height:144,margin:"0 auto 18px"}}>
            <svg width={144} height={144}
              style={{transform:"rotate(-90deg)",position:"absolute",inset:0}}>
              <circle cx={72} cy={72} r={R} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth={SW}/>
              <circle cx={72} cy={72} r={R} fill="none" stroke={G.gold} strokeWidth={SW}
                strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:"clamp(32px,9vw,48px)",fontWeight:800,color:G.cream,lineHeight:1}}>{overall}</span>
              <span style={{fontSize:13,color:G.dimmer,marginTop:2}}>/100</span>
            </div>
          </div>

          <p style={{fontSize:13,color:G.dim,lineHeight:1.65,margin:0}}>{scoreMsg}</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          2. STATS ROW — 4 cards
      ══════════════════════════════════════════ */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",
        gap:12,marginBottom:22}}>
        {[
          {icon:"🎭",num:"8",         label:"Intelligence Areas",sub:"Analyzed",   bg:"rgba(155,114,207,0.12)",ic:"#9b72cf"},
          {icon:"📋",num:String(Math.min(dataPoints,99)), label:"Data Points", sub:"Processed",  bg:"rgba(240,180,41,0.10)",ic:G.gold},
          {icon:"🎯",num:String(Math.min(insights,20)),   label:"Key Insights",sub:"Generated",  bg:"rgba(229,115,115,0.10)",ic:"#e57373"},
          {icon:"📊",num:confidence+"%",label:"Report Accuracy",sub:"High Confidence",bg:"rgba(100,181,246,0.10)",ic:"#64b5f6"},
        ].map(s=>(
          <div key={s.label} style={{...card,display:"flex",gap:14,alignItems:"center",padding:"18px 16px"}}>
            <div style={{width:44,height:44,borderRadius:12,background:s.bg,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:20,flexShrink:0}}>{s.icon}</div>
            <div>
              <div style={{fontSize:"clamp(18px,5vw,26px)",fontWeight:800,color:s.ic,lineHeight:1,marginBottom:3}}>{s.num}</div>
              <div style={{fontSize:11,color:G.dim,fontWeight:600,lineHeight:1.3}}>{s.label}</div>
              <div style={{fontSize:10,color:G.dimmer,marginTop:2}}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          3. PERSONALIZED SUMMARY
      ══════════════════════════════════════════ */}
      <div style={{...card,marginBottom:20,
        background:"linear-gradient(135deg,#0f0820 0%,#130c08 55%,#0a0810 100%)",
        border:"1px solid rgba(120,80,200,0.14)",position:"relative",
        overflow:"hidden",padding:"30px 32px"}}>

        {/* Decorative: warm glow top-right */}
        <div style={{position:"absolute",right:0,top:0,width:"50%",height:"100%",
          background:"radial-gradient(ellipse at 85% 20%,rgba(240,180,41,0.09),transparent 55%)",
          pointerEvents:"none"}}/>
        {/* Decorative: silhouette/mountain feel */}
        <div style={{position:"absolute",right:"2%",bottom:0,opacity:0.04,
          fontSize:"clamp(56px,14vw,120px)",lineHeight:1,pointerEvents:"none",userSelect:"none"}}>⛰️</div>

        <div style={{position:"relative",maxWidth:680}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
            <span style={{fontSize:18,color:G.gold}}>✦</span>
            <span style={{fontSize:16,fontWeight:700,color:G.cream}}>Your Personalized Summary</span>
          </div>
          {summary&&isPaid&&(
            <div style={{display:"flex",justifyContent:"flex-end",margin:"8px 0"}}>
              <AudioPlayer
                text={[summary, strengths?.length?`Key strengths: ${strengths.slice(0,3).join(". ")}`:"", opps?.length?`Opportunities: ${opps.slice(0,2).join(". ")}`:""].filter(Boolean).join(" ")}
                label="Listen to Report"/>
            </div>
          )}
          <p style={{fontSize:15,lineHeight:1.88,color:G.dim,margin:0}}>
            {summaryBefore&&<span>{summaryBefore} </span>}
            <span style={{color:G.gold,fontWeight:600}}>{summaryLast}</span>
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          4. THREE COLUMNS — Strengths / Blind Spots / Opportunities
      ══════════════════════════════════════════ */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",
        gap:14,marginBottom:20}}>

        {/* Top Strengths */}
        <div style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:7,background:"rgba(100,180,246,0.12)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>💎</div>
              <span style={{fontSize:14,fontWeight:700,color:G.cream}}>Top Strengths</span>
            </div>
            <ViewBtn expanded={exStr} toggle={()=>setExStr(e=>!e)}/>
          </div>
          {strengths.filter(Boolean).slice(0,exStr?99:4).map((s,i)=>(
            <CheckRow key={i} item={s} color="#81c784"/>
          ))}
        </div>

        {/* Biggest Blind Spots */}
        <div style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:7,background:"rgba(229,115,115,0.12)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>👁️</div>
              <span style={{fontSize:14,fontWeight:700,color:G.cream}}>Biggest Blind Spots</span>
            </div>
            <ViewBtn expanded={exBls} toggle={()=>setExBls(e=>!e)}/>
          </div>
          {blindSpots.filter(Boolean).slice(0,exBls?99:4).map((b,i)=>(
            <DotRow key={i} item={b}/>
          ))}
        </div>

        {/* Key Opportunities */}
        <div style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:7,background:"rgba(240,180,41,0.12)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>💡</div>
              <span style={{fontSize:14,fontWeight:700,color:G.cream}}>Key Opportunities</span>
            </div>
            <ViewBtn expanded={exOpp} toggle={()=>setExOpp(e=>!e)}/>
          </div>
          {opportunities.filter(Boolean).slice(0,exOpp?99:4).map((o,i)=>(
            <CheckRow key={i} item={o} color={G.gold}/>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          5. YOUR JOURNEY STARTS NOW
      ══════════════════════════════════════════ */}
      <div style={{...card,
        background:"linear-gradient(135deg,rgba(240,180,41,0.06),rgba(240,180,41,0.02))",
        border:"1px solid rgba(240,180,41,0.14)",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        flexWrap:"wrap",gap:24,padding:"28px 32px"}}>

        {/* Left: rocket + text */}
        <div style={{display:"flex",alignItems:"center",gap:20,flex:1,minWidth:240}}>
          <div style={{width:76,height:76,borderRadius:"50%",flexShrink:0,
            background:"linear-gradient(135deg,rgba(240,180,41,0.14),rgba(240,180,41,0.04))",
            border:"2px solid rgba(240,180,41,0.22)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:"clamp(22px,6.5vw,34px)",boxShadow:"0 0 30px rgba(240,180,41,0.12)"}}>
            🚀
          </div>
          <div>
            <h3 style={{fontSize:19,fontWeight:800,color:G.cream,margin:"0 0 9px",lineHeight:1.2}}>
              Your journey starts now
            </h3>
            <p style={{fontSize:13,color:G.dim,lineHeight:1.7,margin:0,maxWidth:380}}>
              You've unlocked powerful insights about yourself. It's time to take action and create real change.
            </p>
          </div>
        </div>

        {/* Right: CTA */}
        <div style={{textAlign:"center",flexShrink:0}}>
          <button onClick={()=>setNav("home")}
            style={{display:"flex",alignItems:"center",gap:10,
              background:G.gold,color:"#000",border:"none",borderRadius:12,
              padding:"16px 30px",fontSize:15,fontWeight:700,cursor:"pointer",
              fontFamily:"inherit",whiteSpace:"nowrap",marginBottom:8,
              boxShadow:"0 0 40px rgba(240,180,41,0.22)"}}>
            Start My Journey <span style={{fontSize:18}}>→</span>
          </button>
          <p style={{fontSize:11,color:G.dimmer,margin:0}}>
            🔒 Takes you to your personalized dashboard
          </p>
        </div>
      </div>
    </div>
  );
}



function JournalScreen({profile,userId,isPaid,isPremium,isProMax,setNav,goBack,onUnlock}){
  const G={
    gold:"#f0b429",bg:"#0a0800",card:"#111008",
    border:"rgba(232,220,200,0.07)",cream:"#e8dcc8",
    dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)",
    inp:"rgba(255,255,255,0.04)",inpBorder:"rgba(232,220,200,0.12)",
  };
  const STORE_KEY=`diq_journal_${userId}`;
  const [entries,setEntries]=useState(()=>{try{return JSON.parse(localStorage.getItem(STORE_KEY)||"[]");}catch{return [];}});
  const canWriteToday = isPremium || isPaid || entries.length < FREE_JOURNAL_LIMIT;
  const [letter,setLetter]=useState("");
  const [aiReply,setAiReply]=useState("");
  const [loading,setLoading]=useState(false);
  const [view,setView]=useState("write"); // write | history | reading
  const [reading,setReading]=useState(null);

  const todayStr=new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const todayKey=new Date().toISOString().slice(0,10);

  const save=(entry)=>{
    const updated=[entry,...entries].slice(0,50);
    setEntries(updated);
    try{localStorage.setItem(STORE_KEY,JSON.stringify(updated));}catch{}
  };

  const submit=async()=>{
    if(!letter.trim()||loading) return;
    setLoading(true);
    try{
      const reply=await callAPI({
        messages:[{role:"user",content:`Here is a personal letter I'm writing to my future self:\n\n"${letter.trim()}"\n\nI'm ${profile?.name||"someone"}, ${profile?.age||""} from ${profile?.country||""}. My goals: ${profile?.goals||profile?.bigGoal||""}. My main challenge: ${profile?.challenge||""}.\n\nRespond as a deeply wise, warm life coach who has read this letter. First, reflect back what you hear — what this person really wants, fears, and hopes for. Then write a brief response letter to them from their future self, 1 year from now, who made it through.`}],
        system:"You write emotionally intelligent, deeply personal reflections. Warm, honest, not generic. No therapy-speak. No bullet points. Just real human writing.",
        userId,isPremium,
      });
      const entry={
        id:Date.now(),
        date:todayKey,
        dateLabel:todayStr,
        letter:letter.trim(),
        reply:reply.trim(),
      };
      save(entry);
      setAiReply(reply.trim());
    }catch{
      setAiReply("Something went wrong. Your letter is saved — try getting a reflection again.");
    }
    setLoading(false);
  };

  const iStyle={width:"100%",background:G.inp,border:"1px solid "+G.inpBorder,
    borderRadius:12,padding:"14px 16px",color:G.cream,fontSize:14,
    outline:"none",fontFamily:"inherit",lineHeight:1.8,resize:"none",
    transition:"border-color .2s",boxSizing:"border-box"};

  if(reading){return(
    <div style={{padding:"20px 20px 90px",maxWidth:620,margin:"0 auto",color:G.cream,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <button onClick={()=>setReading(null)}
        style={{background:"none",border:"none",color:G.dim,cursor:"pointer",fontSize:13,
          padding:"0 0 18px",display:"flex",alignItems:"center",gap:6}}>
        ← Back to History
      </button>
      <div style={{fontSize:10,color:G.dimmer,letterSpacing:".1em",fontFamily:"monospace",marginBottom:6}}>{reading.dateLabel}</div>
      <div style={{background:G.card,border:"1px solid "+G.border,borderRadius:14,padding:"20px",marginBottom:16}}>
        <div style={{fontSize:10,color:G.dimmer,letterSpacing:".1em",fontFamily:"monospace",marginBottom:10}}>YOUR LETTER</div>
        <p style={{fontSize:14,color:G.dim,lineHeight:1.85,margin:0,whiteSpace:"pre-wrap"}}>{reading.letter}</p>
      </div>
      {reading.reply&&(
        <div style={{background:"rgba(240,180,41,0.05)",border:"1px solid rgba(240,180,41,0.15)",borderRadius:14,padding:"20px"}}>
          <div style={{fontSize:10,color:G.gold,letterSpacing:".1em",fontFamily:"monospace",marginBottom:10}}>FROM YOUR FUTURE SELF</div>
          <p style={{fontSize:14,color:G.dim,lineHeight:1.85,margin:0,whiteSpace:"pre-wrap"}}>{reading.reply}</p>
        </div>
      )}
    </div>
  );}

  return(
    <div style={{padding:"20px 20px 90px",maxWidth:620,margin:"0 auto",color:G.cream,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>

      {/* Header */}
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
          <span style={{fontSize:22}}>✉️</span>
          <h2 style={{fontSize:"clamp(15px,4vw,22px)",fontWeight:800,color:G.cream,margin:0}}>Journal</h2>
        </div>
        <p style={{fontSize:13,color:G.dimmer,margin:0}}>Write honestly. Your future self will thank you.</p>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {[["write","Write"],["history","History ("+entries.length+")"]].map(([id,label])=>(
          <button key={id} onClick={()=>{setView(id);setAiReply("");}}
            style={{padding:"7px 16px",borderRadius:20,fontFamily:"inherit",fontSize:12,
              cursor:"pointer",transition:"all .15s",
              background:view===id?"rgba(240,180,41,0.1)":"none",
              border:`1px solid ${view===id?"rgba(240,180,41,0.4)":"rgba(232,220,200,0.1)"}`,
              color:view===id?G.gold:G.dim}}>
            {label}
          </button>
        ))}
      </div>

      {/* Write tab */}
      {view==="write"&&(
        <>
          {!aiReply?(
            <>
              <div style={{fontSize:11,color:G.dim,fontWeight:600,marginBottom:6}}>
                {todayStr}
              </div>
              <div style={{fontSize:12,color:G.dimmer,marginBottom:12,fontStyle:"italic"}}>
                Dear future {profile?.name?.split(" ")[0]||"me"},
              </div>
              <textarea value={letter} onChange={e=>setLetter(e.target.value)} rows={10}
                placeholder={"Right now I feel…\n\nThe thing I'm most afraid of is…\n\nWhat I really want is…\n\nOne year from now I hope to look back and…"}
                style={iStyle}
                onFocus={e=>e.target.style.borderColor="rgba(240,180,41,0.4)"}
                onBlur={e=>e.target.style.borderColor=G.inpBorder}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
                <span style={{fontSize:11,color:G.dimmer}}>{letter.length}/2000 chars</span>
                {!canWriteToday&&(
                <div style={{padding:"14px 16px",background:"rgba(240,180,41,0.07)",
                  border:"1px solid rgba(240,180,41,0.2)",borderRadius:12,marginBottom:12,
                  textAlign:"center"}}>
                  <p style={{fontSize:13,color:"#f0b429",margin:"0 0 8px",fontWeight:600}}>Free limit reached</p>
                  <p style={{fontSize:12,color:"rgba(232,220,200,0.5)",margin:"0 0 10px"}}>Upgrade to Pro for unlimited journal entries and full history.</p>
                  <button onClick={onUnlock} style={{padding:"9px 20px",background:"#f0b429",color:"#000",
                    border:"none",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    ✦ Upgrade to Pro
                  </button>
                </div>
              )}
              <button onClick={submit} disabled={!letter.trim()||loading||letter.length<20||!canWriteToday}
                  style={{padding:"12px 24px",background:G.gold,color:"#000",border:"none",
                    borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                    opacity:!letter.trim()||loading||letter.length<20?0.5:1}}>
                  {loading?"Reflecting…":"Get Reflection →"}
                </button>
              </div>
            </>
          ):(
            <>
              <div style={{background:"rgba(240,180,41,0.05)",border:"1px solid rgba(240,180,41,0.15)",
                borderRadius:14,padding:"20px",marginBottom:14}}>
                <div style={{fontSize:10,color:G.gold,letterSpacing:".1em",fontFamily:"monospace",marginBottom:12}}>FROM YOUR FUTURE SELF</div>
                <p style={{fontSize:14,color:G.dim,lineHeight:1.85,margin:0,whiteSpace:"pre-wrap"}}>{aiReply}</p>
              </div>
              <button onClick={()=>{setLetter("");setAiReply("");}}
                style={{width:"100%",padding:"13px",background:"none",
                  border:"1px solid "+G.border,borderRadius:12,color:G.dim,
                  fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                ✏️ Write Another Entry
              </button>
            </>
          )}
        </>
      )}

      {/* History tab */}
      {view==="history"&&(
        <>
          {entries.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:G.dimmer}}>
              <div style={{fontSize:36,marginBottom:12}}>✉️</div>
              <p style={{fontSize:14,margin:0,lineHeight:1.7}}>No entries yet. Write your first letter.</p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {entries.map(e=>(
                <div key={e.id} onClick={()=>setReading(e)}
                  style={{padding:"16px 18px",background:G.card,border:"1px solid "+G.border,
                    borderRadius:13,cursor:"pointer",transition:"border-color .15s"}}
                  onMouseEnter={ev=>ev.currentTarget.style.borderColor="rgba(240,180,41,0.25)"}
                  onMouseLeave={ev=>ev.currentTarget.style.borderColor=G.border}>
                  <div style={{fontSize:10,color:G.dimmer,fontFamily:"monospace",marginBottom:6}}>{e.dateLabel}</div>
                  <p style={{fontSize:13,color:G.dim,margin:"0 0 6px",lineHeight:1.5,
                    overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                    {e.letter}
                  </p>
                  <div style={{fontSize:11,color:"rgba(240,180,41,0.6)"}}>
                    {e.reply?"Reply received →":"No reflection yet"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}




// ═══════════════════════════════════════════════════════════════
// PDF EXPORT — Pro Max feature
// ═══════════════════════════════════════════════════════════════
function exportReportPDF(formData, data, scores, overall){
  const name     = formData?.name||"User";
  const date     = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const summary  = data?.headline||data?.sections?.[0]?.content||"Your personalised intelligence report.";
  const strengths= (data?.strengths||[]).slice(0,5);
  const blinds   = (data?.blindSpots||data?.blind_spots||[]).slice(0,3);
  const opps     = (data?.opportunities||[]).slice(0,3);

  const html = `<!DOCTYPE html><html>
<head>
<meta charset="UTF-8"/>
<title>DestinIQ Report — ${name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#1a1a1a;padding:48px;}
  .header{border-bottom:3px solid #f0b429;padding-bottom:24px;margin-bottom:32px;}
  .logo{font-size:22px;font-weight:900;color:#1a1a1a;letter-spacing:-.5px;}
  .logo span{color:#f0b429;}
  .badge{display:inline-block;background:#f0b429;color:#000;font-size:9px;font-weight:800;
    padding:3px 10px;border-radius:20px;letter-spacing:.1em;margin-top:8px;}
  h1{font-size:28px;font-weight:800;margin:24px 0 6px;}
  .meta{font-size:12px;color:#888;margin-bottom:32px;}
  .score-row{display:flex;gap:16px;margin-bottom:32px;flex-wrap:wrap;}
  .score-box{flex:1;min-width:100px;border:2px solid #f0b429;border-radius:12px;padding:16px;text-align:center;}
  .score-num{font-size:32px;font-weight:900;color:#f0b429;}
  .score-lbl{font-size:10px;color:#888;font-weight:700;letter-spacing:.1em;margin-top:4px;}
  .section{margin-bottom:28px;}
  .section-title{font-size:10px;font-weight:800;color:#f0b429;letter-spacing:.12em;
    text-transform:uppercase;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #f0b42930;}
  p{font-size:14px;line-height:1.8;color:#444;}
  ul{padding-left:20px;}
  li{font-size:14px;line-height:1.8;color:#444;margin-bottom:4px;}
  .footer{margin-top:48px;padding-top:16px;border-top:1px solid #eee;
    font-size:11px;color:#aaa;text-align:center;}
  @media print{body{padding:24px;}}
</style>
</head>
<body>
<div class="header">
  <div class="logo">Destin<span>IQ</span></div>
  <div class="badge">PERSONAL INTELLIGENCE REPORT</div>
</div>
<h1>${name}'s Intelligence Report</h1>
<div class="meta">Generated ${date} · Confidential</div>
<div class="score-row">
  <div class="score-box"><div class="score-num">${overall||"--"}</div><div class="score-lbl">Overall Score</div></div>
  <div class="score-box"><div class="score-num">${scores?.life||"--"}</div><div class="score-lbl">Life</div></div>
  <div class="score-box"><div class="score-num">${scores?.wealth||"--"}</div><div class="score-lbl">Wealth</div></div>
  <div class="score-box"><div class="score-num">${scores?.mindset||"--"}</div><div class="score-lbl">Mindset</div></div>
  <div class="score-box"><div class="score-num">${scores?.relations||"--"}</div><div class="score-lbl">Relationships</div></div>
</div>
<div class="section">
  <div class="section-title">Personalised Summary</div>
  <p>${summary}</p>
</div>
${strengths.length?`<div class="section"><div class="section-title">Your Top Strengths</div><ul>${strengths.map(s=>`<li>${s}</li>`).join("")}</ul></div>`:""}
${blinds.length?`<div class="section"><div class="section-title">Blind Spots to Address</div><ul>${blinds.map(s=>`<li>${s}</li>`).join("")}</ul></div>`:""}
${opps.length?`<div class="section"><div class="section-title">Key Opportunities</div><ul>${opps.map(s=>`<li>${s}</li>`).join("")}</ul></div>`:""}
<div class="footer">DestinIQ · Personal Intelligence Platform · destiniq.vercel.app · Generated for ${name} only</div>
</body></html>`;

  const w = window.open("","_blank","width=900,height=700");
  if(!w){ alert("Please allow popups to export your PDF."); return; }
  w.document.write(html);
  w.document.close();
  w.onload = ()=>{ w.focus(); w.print(); };
}

// ═══════════════════════════════════════════════════════════════
// SCORE HISTORY — stores last 5 reports for comparison
// ═══════════════════════════════════════════════════════════════
function saveScoreSnapshot(userId, scores, overall){
  if(!userId||!scores) return;
  try{
    const key  = `diq_score_history_${userId}`;
    const prev = JSON.parse(localStorage.getItem(key)||"[]");
    const snap = { date:new Date().toISOString().slice(0,10), scores:{...scores}, overall };
    const updated = [snap, ...prev].slice(0,5);
    localStorage.setItem(key, JSON.stringify(updated));
  }catch{}
}

function getScoreHistory(userId){
  try{ return JSON.parse(localStorage.getItem(`diq_score_history_${userId}`)||"[]"); }
  catch{ return []; }
}

// ═══════════════════════════════════════════════════════════════
// SCORE COMPARISON CARD — shows in MyReport for Pro Max
// ═══════════════════════════════════════════════════════════════
function ScoreComparisonCard({userId, currentScores, currentOverall}){
  const history = getScoreHistory(userId);
  if(history.length < 2) return null;
  const prev = history[1]; // second entry = previous report
  const G = {gold:"#f0b429",card:"#111008",border:"rgba(232,220,200,0.07)",
    cream:"#e8dcc8",dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)"};

  const diff = (a,b)=>Math.round((a||0)-(b||0));
  const fmt  = n=>n>0?`+${n}`:String(n);
  const col  = n=>n>0?"#1ab89a":n<0?"#e05252":G.dim;

  const metrics=[
    {label:"Overall", cur:currentOverall, prv:prev.overall},
    {label:"Life",    cur:currentScores?.life,    prv:prev.scores?.life},
    {label:"Wealth",  cur:currentScores?.wealth,  prv:prev.scores?.wealth},
    {label:"Mindset", cur:currentScores?.mindset, prv:prev.scores?.mindset},
    {label:"Relations",cur:currentScores?.relations,prv:prev.scores?.relations},
  ];

  const daysBetween=Math.round((new Date()-new Date(prev.date))/(86400000));

  return(
    <div style={{background:"rgba(155,114,207,0.06)",border:"1px solid rgba(155,114,207,0.2)",
      borderRadius:16,padding:"18px 20px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:10,color:"#9b72cf",fontWeight:800,letterSpacing:".1em",fontFamily:"monospace"}}>
            ✦ PRO MAX · COMPARISON
          </div>
          <div style={{fontSize:13,fontWeight:700,color:G.cream,marginTop:3}}>
            Since your last report ({daysBetween} days ago)
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
        {metrics.map(m=>{
          const d=diff(m.cur,m.prv);
          return(
            <div key={m.label} style={{textAlign:"center",padding:"10px 4px",
              background:"rgba(255,255,255,0.03)",borderRadius:10}}>
              <div style={{fontSize:11,color:G.dimmer,marginBottom:4}}>{m.label}</div>
              <div style={{fontSize:18,fontWeight:800,color:G.cream}}>{m.cur||"—"}</div>
              {d!==0&&<div style={{fontSize:11,fontWeight:700,color:col(d),marginTop:2}}>{fmt(d)}</div>}
            </div>
          );
        })}
      </div>
      {metrics.find(m=>diff(m.cur,m.prv)>0)&&(
        <div style={{marginTop:12,fontSize:12,color:G.dim,lineHeight:1.6}}>
          📈 {metrics.filter(m=>diff(m.cur,m.prv)>0).map(m=>m.label).join(", ")} improved since last time.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY DIGEST — Pro Max: AI summary every week
// ═══════════════════════════════════════════════════════════════
function WeeklyDigestCard({profile,userId,streak,isPremium,isProMax}){
  const G={gold:"#f0b429",card:"#111008",border:"rgba(232,220,200,0.07)",
    cream:"#e8dcc8",dim:"rgba(232,220,200,0.5)",dimmer:"rgba(232,220,200,0.27)"};
  const DIGEST_KEY=`diq_weekly_digest_${userId}`;
  const [digest,setDigest]=useState(()=>{
    try{ return JSON.parse(localStorage.getItem(DIGEST_KEY)||"null"); }catch{ return null; }
  });
  const [loading,setLoading]=useState(false);
  const [dismissed,setDismissed]=useState(false);

  // Auto-generate if Pro Max + more than 7 days since last digest
  useEffect(()=>{
    if(!isProMax||!userId||loading) return;
    const lastDate = digest?.date ? new Date(digest.date) : null;
    const daysSince = lastDate ? Math.floor((Date.now()-lastDate.getTime())/86400000) : 999;
    if(daysSince >= 7) generateDigest();
  },[isProMax, userId]);

  const generateDigest=async()=>{
    if(loading) return;
    setLoading(true);
    try{
      const wins=[];
      try{
        const w=JSON.parse(localStorage.getItem(`diq_wins_${userId}`)||"[]");
        const week=new Date(); week.setDate(week.getDate()-7);
        wins.push(...w.filter(x=>new Date(x.date)>week).map(x=>x.text||x.win).slice(0,5));
      }catch{}
      const reply = await callAPI({
        messages:[{role:"user",content:`Generate a powerful, concise weekly intelligence digest for ${profile?.name||"this person"}.
Their situation: ${profile?.goals||profile?.bigGoal||"personal growth"}. Country: ${profile?.country||""}. Streak: ${streak} days.
Recent wins this week: ${wins.length?wins.join("; "):"not tracked"}.
Write a personal weekly review (4-6 sentences max):
1. One honest reflection on where they are right now
2. The single most important thing to focus on this week
3. One behaviour to stop or start
4. An encouraging but grounded closing line.
Write it directly to them. Use their name. No bullet points. No generic advice.`}],
        system:"You write powerful, personal weekly reviews. Warm but direct. Like a coach who knows you well.",
        userId, isPremium:true,
      });
      const newDigest={text:reply.trim(), date:new Date().toISOString(), week:getWeekNumber()};
      setDigest(newDigest);
      try{localStorage.setItem(DIGEST_KEY,JSON.stringify(newDigest));}catch{}
    }catch(e){ console.warn("Weekly digest failed:",e); }
    setLoading(false);
  };

  const getWeekNumber=()=>{
    const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+3-(d.getDay()+6)%7);
    return Math.ceil(((d-new Date(d.getFullYear(),0,1))/86400000)/7);
  };

  if(!isProMax||dismissed) return null;
  if(loading) return(
    <div style={{background:G.card,border:"1px solid rgba(155,114,207,0.2)",borderRadius:16,
      padding:"20px",marginBottom:16,textAlign:"center"}}>
      <div style={{fontSize:12,color:"#9b72cf"}}>✦ Generating your weekly digest…</div>
    </div>
  );
  if(!digest) return null;

  return(
    <div style={{background:"linear-gradient(135deg,rgba(155,114,207,0.08),rgba(155,114,207,0.03))",
      border:"1px solid rgba(155,114,207,0.25)",borderRadius:16,padding:"18px 20px",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontSize:10,color:"#9b72cf",fontWeight:800,letterSpacing:".1em",fontFamily:"monospace"}}>
            ✦ WEEKLY INTELLIGENCE DIGEST
          </div>
          <div style={{fontSize:11,color:G.dimmer,marginTop:2}}>
            {new Date(digest.date).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}
          </div>
        </div>
        <button onClick={()=>setDismissed(true)}
          style={{background:"none",border:"none",color:G.dimmer,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
      </div>
      <p style={{fontSize:14,color:G.dim,lineHeight:1.8,margin:"0 0 14px",whiteSpace:"pre-wrap"}}>{digest.text}</p>
      <button onClick={generateDigest}
        style={{background:"none",border:"1px solid rgba(155,114,207,0.25)",borderRadius:20,
          padding:"6px 14px",color:"#9b72cf",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
        ↺ Regenerate
      </button>
    </div>
  );
}


function Dashboard({data,formData,isPaid,onUnlock,streak,showCheckin,setShowCheckin,userId,isPremium,isProMax,ipLocation,showTracker,setShowTracker,lang="en",navPhotoURL,userName}){

  const [mod,setMod]=useState(()=>{
    if(typeof window==="undefined") return "today";
    return localStorage.getItem("diq_active_tab")||"today";
  });
  const [streakCelebration,setStreakCelebration]=useState(null);
  const [miniStreak,setMiniStreak]=useState(null); // for non-milestone days
  useEffect(()=>{
    try{ localStorage.setItem("diq_active_tab",mod); }catch{}
  },[mod]);
  const [aScores,setAScores]=useState({life:0,wealth:0,mindset:0,relations:0});
  const [dailyInsight,setDailyInsight]=useState(data.daily_insight||"");
  const [refreshingInsight,setRefreshingInsight]=useState(false);
  const [closingLine,setClosingLine]=useState(data.closing||"");
  const [refreshingClosing,setRefreshingClosing]=useState(false);

  // Auto-fill closing — runs when formData loads
  useEffect(()=>{
    if(!formData?.name) return; // not loaded yet
    const bad = ["i don't have","i need more","no context","no posts","generating","click","placeholder","there, their"];
    const isBad = !closingLine || closingLine.length < 10 || bad.some(p=>closingLine.toLowerCase().includes(p));
    if(isBad) setTimeout(()=>refreshClosing(), 1200);
  // eslint-disable-next-line
  },[formData?.name]);
  useEffect(()=>{const t=setTimeout(()=>setAScores(data.scores||{}),100);return()=>clearTimeout(t);},[data]);

  // Auto-fill daily insight if missing — wait for formData to load from Supabase
  useEffect(()=>{
    const saved = data.daily_insight||"";
    const isGeneric = !saved || saved.includes("I need more information") || saved.length < 40;
    const hasRealData = formData?.country && formData?.challenge && formData?.goals && userId;
    if(isGeneric && hasRealData){
      setTimeout(()=>refreshDailyInsight(), 800);
    }
  // eslint-disable-next-line
  },[formData?.name]);  // re-run when formData loads

  const refreshDailyInsight=async()=>{
    if(refreshingInsight) return;
    setRefreshingInsight(true);
    try{
      const today=new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
      const challenge=sanitize(formData?.challenge)||"figuring out the next step toward their goal";
      const goal=sanitize(formData?.goals)||"making real progress in life";
      const name=sanitize(formData?.name)||"there";
      const country=sanitize(formData?.country)||"their country";
      const skill=sanitize(formData?.skills)||"general professional skills";

      const prompt=`Today is ${today}. Write a fresh, specific daily insight for ${name} who lives in ${country}, age ${formData?.age||"adult"}. Their challenge: "${challenge}". Their goal: "${goal}". Their skill: ${skill}.

Write exactly 3 sentences:
1. Name their specific challenge using their own words.
2. Give ONE concrete action they can do TODAY with a real local example — a specific platform, step, or person type that works in ${country}.
3. Close with something that makes them feel understood and capable.

Do NOT use generic motivational language. Do NOT ask for more information — work with what's given, even if brief. Be specific, direct, and honest. Output ONLY the 3 sentences, nothing else.`;
      const reply=await callAPI({messages:[{role:"user",content:prompt}],system:"You are a direct, honest daily advisor. Write exactly 3 sentences. No greetings, no headers, no lists, no bold, no requests for more information — work with whatever details are given. Just 3 powerful plain sentences.",userId,isPremium,maxTokens:300});

      // Guard against AI asking for more info despite instructions
      const badPhrases=["i need more information","please tell me","i don't have enough","could you share","can you provide"];
      const isBad = !reply || reply.length<30 || badPhrases.some(p=>reply.toLowerCase().includes(p));

      if(isBad){
        // Local fallback — always works, no AI needed
        setDailyInsight(`${name}, the thing you've been putting off about "${challenge.slice(0,60)}" is the actual next step — not a detour from it. Today, give it 20 focused minutes: open one tab, search for the first concrete resource related to "${goal.slice(0,50)}" in ${country}, and write down what you find. Small honest steps compound faster than big plans that never start.`);
      } else {
        setDailyInsight(reply);
        pushToMemory(userId,"assistant","Daily refresh: "+reply.slice(0,200));
      }
    }catch(e){
      const name=sanitize(formData?.name)||"there";
      setDailyInsight(`${name}, today is a good day to take one small, honest step toward what you said you want. Pick the smallest possible action related to your goal and do it before you check anything else. Momentum starts with motion, not motivation.`);
    }
    setRefreshingInsight(false);
  };

  const refreshClosing=async()=>{
    if(refreshingClosing) return;
    setRefreshingClosing(true);
    try{
      // Guard — if real profile data isn't loaded yet, don't call the AI
    const name     = sanitize(formData?.name)                              ||"";
    const country  = sanitize(formData?.country)                           ||"";
    const goal     = sanitize(formData?.goals||formData?.bigGoal)          ||"";
    const challenge= sanitize(formData?.challenge)                         ||"";
    const skill    = sanitize(formData?.skills||formData?.career)          ||"";
    const age      = formData?.age||"";
    if(!name||!country||!goal){ setRefreshingClosing(false); return; } // wait for real data

      const prompt=`Write ONE powerful sentence for ${name}${age?" (age "+age+")":""} from ${country}.
Goal: "${goal||"building a better life"}"
Challenge: "${challenge||"getting started"}"
Skills: "${skill||"various skills"}"

Rules:
- Use ${name}'s name
- Reference their actual goal or challenge or country
- Sound like someone who read their full story
- Be honest and direct, not a motivational poster
- Output ONLY the sentence — no quotes, no preamble, nothing else`;

      const reply=await callAPI({
        messages:[{role:"user",content:prompt}],
        system:`You write one powerful truth sentence. You ALWAYS generate something specific — never ask for more information. ${name} from ${country} wants "${goal}". Work with that. One sentence only. No quotes around it.`,
        userId,isPremium:true,maxTokens:120
      });

      const bad=["i don't have","i need more","could you share","no context","please tell","can you provide"];
      const clean=(reply||"").trim().replace(/^["']|["']$/g,"");
      const isBad = !clean||clean.length<15||bad.some(p=>clean.toLowerCase().includes(p));

      if(!isBad){
        setClosingLine(clean);
      } else {
        // Local fallback — specific to this user, never fails
        const options=[
          `${name}, the gap between where you are in ${country} and where you want to be is not luck — it is a sequence of decisions you have not made yet.`,
          `${name}, the challenge you named is not a sign that you are behind — it is a sign that you are honest enough to see what needs to change.`,
          `${name}, wanting "${goal.slice(0,40)}${goal.length>40?"...":""}" is the right instinct — the question is whether you are willing to be uncomfortable long enough to get there.`,
        ];
        setClosingLine(options[new Date().getDate()%3]);
      }
    }catch(e){
      const name=sanitize(formData?.name)||"there";
      setClosingLine(`${name}, showing up every day — even when it feels like nothing is changing — is how everything eventually changes.`);
    }
    setRefreshingClosing(false);
  };

  // Pre-compute strengths/risks before render (avoids IIFE in JSX)
  const _derived = isPaid ? deriveStrengthsRisks(data) : {strengths:[],risks:[]};
  const _strengths = _derived.strengths;
  const _risks = _derived.risks;

  // ── nav routing ──────────────────────────────────────────────────────
  const [navSection,setNavSection]=useState(()=>{try{return localStorage.getItem("diq_nav")||"home";}catch{return "home";}});

  const [navHistory,setNavHistory]=useState([]);
  const setNav=useCallback((s)=>{
    if(s!==navSection) setNavHistory(h=>[...h.slice(-19),navSection]);
    setNavSection(s);
    try{localStorage.setItem("diq_nav",s);}catch{}
  },[navSection]);
  const goBack=useCallback(()=>{
    if(!navHistory.length) return;
    const prev=navHistory[navHistory.length-1];
    setNavHistory(h=>h.slice(0,-1));
    setNavSection(prev);
    try{localStorage.setItem("diq_nav",prev);}catch{}
  },[navHistory]);
  const canGoBack=navHistory.length>0;
  const isCat  = navSection?.startsWith("category:");
  const isTool = navSection?.startsWith("tool:");
  const catId  = isCat  ? navSection.slice(9)  : null;
  const toolId = isTool ? navSection.slice(5)  : null;

  // Sync mod with toolId SAFELY via effect — never during render
  useEffect(()=>{
    if(isTool && !MODULE_CONFIGS?.[toolId] && toolId && mod!==toolId){
      setMod(toolId);
    }
  },[navSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: legacy module view (report + existing module content)
  const showModView = ()=>(
    <div style={{paddingTop:8}}>
      {streakCelebration&&<StreakCelebration streak={streakCelebration} onClose={()=>setStreakCelebration(null)}/>}
      {miniStreak&&<MiniStreakCelebration streak={miniStreak} onClose={()=>setMiniStreak(null)}/>}
      {showCheckin&&(
        <div className="cx-md" style={{paddingTop:24,paddingBottom:24}}>
          <CheckIn profile={formData} reportData={data} streak={streak} userId={userId} onComplete={()=>{setShowCheckin(false);setNav("home");}}/>
        </div>
      )}
      {!showCheckin&&(
        <div>
          <div className="cx-md" style={{paddingTop:24,paddingBottom:8}}>
            <button onClick={()=>goBack?goBack():setNav("home")} style={{background:"none",border:"none",color:"var(--cream-40)",cursor:"pointer",fontSize:13,marginBottom:16,display:"flex",alignItems:"center",gap:6}}>← Back</button>
          </div>
          {mod==="today"&&(
            <div className="cx-md" style={{paddingTop:8,paddingBottom:32}}>
              <div className="insight" style={{marginBottom:16}}><p className="body">{dailyInsight||data?.headline}</p></div>
              <div style={{padding:"14px 16px",background:"var(--raised)",borderRadius:14,border:"1px solid var(--line)"}}>
                <div style={{fontSize:10,fontFamily:"var(--f-mono)",color:"var(--cream-30)",marginBottom:8,letterSpacing:".08em"}}>TODAY'S INSIGHT</div>
                <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.85,margin:0}}>{closingLine||data?.closing||""}</p>
              </div>
            </div>
          )}
          {mod==="wins"      &&<WinTracker profile={formData} userId={userId} isPaid={isPaid} isPremium={isPremium} onUnlock={onUnlock}/>}
          {mod==="progress"  &&<ProgressFeed userId={userId} isPaid={isPaid} onUnlock={onUnlock}/>}
          {mod==="practices" &&<PracticesView userId={userId} formData={formData}/>}
          {mod==="weekly"    &&<WeeklyModule profile={formData} userId={userId} isPremium={isPremium} isProMax={isProMax} isPaid={isPaid} onUnlock={onUnlock}/>}
          {mod==="decisions" &&<DecisionModule profile={formData} userId={userId} isPremium={isPremium} isProMax={isProMax} isPaid={isPaid} onUnlock={onUnlock}/>}
          {mod==="advisor"   &&<AdvisorChat profile={formData} reportData={data} userId={userId} isPremium={isPremium} isProMax={isProMax} isPaid={isPaid} onUnlock={onUnlock}/>}
          {mod==="momentum"  &&<MomentumModule profile={formData} userId={userId} isPremium={isPremium} isProMax={isProMax} streak={streak}/>}
          {Object.keys(MODULE_CONFIGS).includes(mod)&&
            <GenericAIModule modId={mod} profile={formData} userId={userId} isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} onUnlock={onUnlock} lang={lang}/>}
        </div>
      )}
    </div>
  );


  // ── EXPLORE: full-page standalone ──────────────────────────────────────────
  if(navSection==="explore"){
    return(
      <ExploreScreen
        setNav={setNav} formData={formData} userId={userId}
        isPaid={isPaid} isPremium={isPremium} isProMax={isProMax}
        onUnlock={onUnlock} streak={streak} navPhotoURL={navPhotoURL}
      />
    );
  }

  return(
    <div className="app-shell">

      <SidebarNav nav={navSection} setNav={setNav} isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} streak={streak} onUnlock={onUnlock} formData={formData} navPhotoURL={navPhotoURL} onNotif={()=>window.dispatchEvent(new CustomEvent("showNotif"))}/>

      <div className="main-area">
        {navSection!=="explore"&&(
        <MobileTopBar
          onHamburger={()=>setDrawerOpen(true)}
        title={(()=>{
          if(navSection==="home"){const h=new Date().getHours();return(h<12?"Good morning":h<17?"Good afternoon":"Good evening")+", "+(formData?.name?.split(" ")[0]||"there");}
          if(isCat) return CATEGORIES.find(c=>c.id===catId)?.label;
          if(isTool) return TOOL_META[toolId]?.label;
          return null;
        })()}
        onBack={canGoBack?goBack:null}
        streak={streak} isPaid={isPaid} isProMax={isProMax}
        onNotif={()=>window.dispatchEvent(new CustomEvent("showNotif"))}
        setNav={setNav} navPhotoURL={navPhotoURL} userName={userName}
      />
        )}
        {navSection==="home"&&(
          <HomeScreen data={data} formData={formData} streak={streak} isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} userId={userId} onUnlock={onUnlock} setNav={setNav} setShowCheckin={setShowCheckin} dailyInsight={dailyInsight}/>
        )}
        {/* ExploreScreen handled by early return above */}
        {isCat&&<CategoryPage catId={catId} setNav={setNav} goBack={goBack} userId={userId}/>}
        {isTool&&MODULE_CONFIGS?.[toolId]&&(
          <ToolPage key={toolId} toolId={toolId} setNav={setNav} goBack={goBack} formData={formData} userId={userId} isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} onUnlock={onUnlock} lang={lang}/>
        )}
        {isTool&&!MODULE_CONFIGS?.[toolId]&&showModView()}
        {navSection==="progress"&&<ProgressScreen data={data} streak={streak} userId={userId} setNav={setNav} goBack={goBack}/>}
        {navSection==="journal"&&<JournalScreen profile={formData} userId={userId} isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} setNav={setNav} goBack={goBack} onUnlock={onUnlock}/>}
        {navSection==="wins"&&<div style={{padding:"28px 32px"}}><WinTracker profile={formData} userId={userId} isPaid={isPaid} isPremium={isPremium} onUnlock={onUnlock}/></div>}
        {navSection==="practices"&&(
          isPaid
            ?<div style={{padding:"28px 32px"}}><PracticesView userId={userId} formData={formData}/></div>
            :<div style={{padding:"40px 24px",textAlign:"center",maxWidth:420,margin:"0 auto",color:"#e8dcc8",fontFamily:"-apple-system,sans-serif"}}>
              <div style={{fontSize:48,marginBottom:14}}>⚡</div>
              <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 10px"}}>My Practices</h2>
              <p style={{fontSize:14,color:"rgba(232,220,200,0.5)",lineHeight:1.7,margin:"0 0 24px"}}>Track habits and build the practices that compound over time. Available on Pro.</p>
              <button onClick={onUnlock} style={{width:"100%",padding:"15px",background:"#f0b429",color:"#000",border:"none",borderRadius:13,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✦ Upgrade to Pro</button>
            </div>
        )}
        {navSection==="checkin"&&<div style={{padding:"28px 32px"}}><CheckIn profile={formData} reportData={data} streak={streak} userId={userId} onComplete={()=>setNav("home")}/></div>}
        {navSection==="savedreports"&&(
          <div style={{padding:"28px 24px 80px",maxWidth:860,margin:"0 auto"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(240,180,41,0.07)",border:"1px solid rgba(240,180,41,0.25)",borderRadius:20,padding:"5px 14px",marginBottom:20}}>
              <span style={{fontSize:12}}>📋</span>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:".8px",color:"var(--gold)",fontFamily:"monospace"}}>SAVED REPORTS</span>
            </div>
            <h2 style={{fontSize:"clamp(16px,4.5vw,24px)",fontWeight:800,color:"var(--cream)",margin:"0 0 8px"}}>Your Saved Reports</h2>
            <p style={{fontSize:14,color:"rgba(232,220,200,0.5)",margin:"0 0 24px",lineHeight:1.6}}>Your intelligence reports are stored here for future reference.</p>
            <div style={{background:"var(--night)",border:"1px solid rgba(240,180,41,0.15)",borderRadius:16,padding:"22px",marginBottom:14,cursor:"pointer"}} onClick={()=>setNav("report")}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,borderRadius:12,background:"rgba(240,180,41,0.1)",border:"1px solid rgba(240,180,41,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📊</div>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--cream)",marginBottom:2}}>Personal Intelligence Report</div>
                    <div style={{fontSize:11,color:"rgba(232,220,200,0.4)"}}>{new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
                  </div>
                </div>
                <div style={{padding:"4px 10px",background:"rgba(129,199,132,0.12)",border:"1px solid rgba(129,199,132,0.25)",borderRadius:20,fontSize:10,color:"#81c784",fontWeight:700,flexShrink:0}}>LATEST</div>
              </div>
              <p style={{fontSize:13,color:"rgba(232,220,200,0.5)",margin:"0 0 14px",lineHeight:1.65}}>Complete AI analysis of your strengths, blind spots, opportunities and personalized roadmap.</p>
              <button style={{background:"var(--gold)",color:"#000",border:"none",borderRadius:9,padding:"10px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>View Report →</button>
            </div>
            <div style={{background:"#111008",border:"1px solid rgba(232,220,200,0.06)",borderRadius:16,padding:"22px",textAlign:"center"}}>
              <div style={{fontSize:30,marginBottom:10}}>🔮</div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--cream)",marginBottom:6}}>More reports coming soon</div>
              <div style={{fontSize:12,color:"rgba(232,220,200,0.4)"}}>Each time you update your profile, a new report will be saved here automatically.</div>
            </div>
          </div>
        )}
        {navSection==="profile"&&(
          <DashboardProfileView
            user={{id:userId,email:formData?.email||""}}
            formData={formData} isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} streak={streak}
            navPhotoURL={navPhotoURL}
            onSignOut={()=>window.dispatchEvent(new CustomEvent("signOut"))}
            onManageSubscription={onUnlock}
            setNav={setNav}
            onEditProfile={()=>window.dispatchEvent(new CustomEvent("showEditProfile"))}
          />
        )}

        {navSection==="report"&&<MyReport data={data} formData={formData} isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} onUnlock={onUnlock} userId={userId} streak={streak} setNav={setNav} lang={lang}/>}
      </div>

      {/* ── GLOBAL SIDE DRAWER ── */}
      <SideDrawer
        open={drawerOpen||false}
        onClose={()=>setDrawerOpen&&setDrawerOpen(false)}
        nav={navSection}
        setNav={setNav}
        formData={formData}
        isPaid={isPaid}
        isProMax={isProMax}
        streak={streak}
        navPhotoURL={navPhotoURL}
        onUnlock={onUnlock}
        onSignOut={()=>window.dispatchEvent(new CustomEvent("signOut"))}
      />
      <BottomNav nav={navSection} setNav={setNav}/>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// EDIT PROFILE — Let users update their onboarding details
// Changes save to Supabase and optionally trigger a report re-generation
// ═══════════════════════════════════════════════════════════════════════════════

function EditProfileModal({formData, userId, onSave, onClose}){
  const [f, setF] = useState({
    name:      formData?.name      || "",
    age:       formData?.age       || "",
    country:   formData?.country   || "",
    income:    formData?.income    || "",
    goals:     formData?.goals     || "",
    challenge: formData?.challenge || "",
    skills:    formData?.skills    || "",
    support:   formData?.support   || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved ] = useState(false);
  const [regen,  setRegen ] = useState(false); // whether to also re-generate report
  const [csearch, setCsearch] = useState(formData?.country||"");
  const [showDrop, setShowDrop] = useState(false);

  const upd = (k,v) => setF(p=>({...p,[k]:v}));

  const save = async() => {
    setSaving(true);
    try{
      const updated = {...formData, ...f};
      await supabase.from("user_profiles").upsert({
        user_id:    userId,
        form_data:  updated,
        updated_at: new Date().toISOString(),
      },{onConflict:"user_id"});
      onSave(updated, regen);
      setSaved(true);
      setTimeout(()=>onClose(), 1200);
    }catch(e){
      console.error("Edit profile save:", e.message);
    }
    setSaving(false);
  };

  const fields = [
    {key:"name",      label:"Your name",                 type:"text",     ph:"Your full name"},
    {key:"age",       label:"Your age",                  type:"number",   ph:"e.g. 25"},
    {key:"country",   label:"Country you live in",       type:"text",     ph:"e.g. Ghana"},
    {key:"income",    label:"Monthly income (approx.)",  type:"text",     ph:"e.g. Under $500 / GH₵3,000"},
    {key:"goals",     label:"Your main goal",            type:"textarea", ph:"What are you working toward?"},
    {key:"challenge", label:"Your biggest challenge",    type:"textarea", ph:"What's actually in the way?"},
    {key:"skills",    label:"Your skills or work",       type:"text",     ph:"e.g. Marketing, coding, trading"},
    {key:"support",   label:"Support system",            type:"text",     ph:"e.g. Family, solo, partner"},
  ];

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
      <div style={{background:"var(--night)",borderRadius:20,border:"1px solid var(--line)",width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:"28px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--cream)",marginBottom:4}}>Update your profile</div>
            <div style={{fontSize:12,color:"var(--cream-40)"}}>Changes you make here update your AI advisor and modules</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--cream-40)",fontSize:20,cursor:"pointer",padding:4}}>✕</button>
        </div>

        {fields.map(field=>(
          <div key={field.key} style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:11,fontFamily:"var(--f-mono)",color:"var(--cream-40)",letterSpacing:".1em",marginBottom:6}}>
              {field.label.toUpperCase()}
            </label>
            {field.key==="country"
              ? (()=>{
                  const filt=(Array.isArray(COUNTRIES_LIST)?COUNTRIES_LIST:[]).filter(c=>c.name.toLowerCase().includes(csearch.toLowerCase())).slice(0,6);
                  return(
                    <div style={{position:"relative"}}>
                      <input
                        value={csearch}
                        onChange={e=>{setCsearch(e.target.value);setShowDrop(true);if(!e.target.value)upd("country","");}}
                        onFocus={()=>setShowDrop(true)}
                        onBlur={()=>setTimeout(()=>setShowDrop(false),200)}
                        placeholder="Search country…"
                        style={{width:"100%",background:"var(--lift)",border:"1px solid var(--line)",borderRadius:10,padding:"10px 12px",color:"var(--cream)",fontSize:13,boxSizing:"border-box"}}
                      />
                      {showDrop&&csearch&&filt.length>0&&(
                        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"var(--lift)",border:"1px solid var(--line)",borderRadius:10,zIndex:200,maxHeight:180,overflowY:"auto",marginTop:2}}>
                          {filt.map(c=>(
                            <div key={c.name} onMouseDown={()=>{upd("country",c.name);setCsearch(c.name);setShowDrop(false);}}
                              style={{padding:"9px 12px",cursor:"pointer",fontSize:13,color:"var(--cream)",display:"flex",justifyContent:"space-between"}}
                              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                              onMouseLeave={e=>e.currentTarget.style.background="none"}>
                              <span>{c.name}</span>
                              <span style={{fontSize:11,color:"var(--cream-40)",fontFamily:"var(--f-mono)"}}>{c.symbol}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              : field.type==="textarea"
              ? <textarea
                  value={f[field.key]} onChange={e=>upd(field.key,e.target.value)}
                  placeholder={field.ph} rows={2}
                  style={{width:"100%",background:"var(--lift)",border:"1px solid var(--line)",borderRadius:10,padding:"10px 12px",color:"var(--cream)",fontSize:13,resize:"vertical",fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box"}}
                />
              : <input
                  type={field.type} value={f[field.key]} onChange={e=>upd(field.key,e.target.value)}
                  placeholder={field.ph}
                  style={{width:"100%",background:"var(--lift)",border:"1px solid var(--line)",borderRadius:10,padding:"10px 12px",color:"var(--cream)",fontSize:13,boxSizing:"border-box"}}
                />
            }
          </div>
        ))}

        {/* Option to re-generate report */}
        <div style={{margin:"20px 0",padding:"14px 16px",background:"rgba(210,175,90,0.06)",border:"1px solid rgba(210,175,90,0.2)",borderRadius:12}}>
          <label style={{display:"flex",gap:12,cursor:"pointer",alignItems:"flex-start"}}>
            <input type="checkbox" checked={regen} onChange={e=>setRegen(e.target.checked)}
              style={{marginTop:2,accentColor:"var(--gold)",width:16,height:16,flexShrink:0}}/>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--cream)",marginBottom:4}}>
                🔄 Re-generate my report with updated details
              </div>
              <div style={{fontSize:12,color:"var(--cream-50)",lineHeight:1.6}}>
                This will create a new clarity report with your updated goals, income, and situation.
                Your scores, roadmap, and all modules will reflect your current reality.
              </div>
            </div>
          </label>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,background:"none",border:"1px solid var(--line)",borderRadius:12,padding:"12px",color:"var(--cream-40)",fontSize:13,cursor:"pointer"}}>
            Cancel
          </button>
          <button onClick={save} disabled={saving||saved} style={{flex:2,background:"var(--gold)",border:"none",borderRadius:12,padding:"12px",color:"#000",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
            {saved?"✓ Saved!":saving?"Saving…":"Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// REFERRAL SYSTEM
// Each user gets a unique referral code based on their userId (first 8 chars)
// Share link: destiniq.vercel.app?ref=CODE
// Reward: both referrer and referee get 7 days Pro free (tracked in Supabase)
// ═══════════════════════════════════════════════════════════════════════════════
function ReferralWidget({userId, isPaid}){
  const code = userId ? userId.replace(/-/g,"").slice(0,8).toUpperCase() : "";
  const link = `https://destiniq.vercel.app?ref=${code}`;
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState(0);

  useEffect(()=>{
    if(!userId) return;
    // Count how many people used this referral code
    supabase.from("user_profiles")
      .select("user_id", {count:"exact"})
      .eq("referred_by", code)
      .then(({count})=>{ if(count) setReferrals(count); })
      .catch(()=>{});
  },[userId, code]);

  const copy = ()=>{
    navigator.clipboard?.writeText(link).catch(()=>{});
    try{ const el=document.createElement("input"); el.value=link; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }catch{}
    setCopied(true);
    setTimeout(()=>setCopied(false), 2000);
  };

  const shareWhatsApp = ()=>{
    const msg = `I found this AI system that told me exactly where I'm stuck and what to do next. It's called DestinIQ — try it free: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const shareTwitter = ()=>{
    const msg = `This AI read my situation and told me what's actually blocking me. Try DestinIQ free: ${link}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return(
    <div style={{padding:"20px",background:"var(--lift)",borderRadius:16,border:"1px solid var(--line)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:9,fontFamily:"var(--f-mono)",color:"var(--gold)",letterSpacing:".12em",marginBottom:4}}>INVITE FRIENDS</div>
          <div style={{fontSize:15,fontWeight:700,color:"var(--cream)"}}>Get 1 week Pro free per referral</div>
        </div>
        {referrals>0&&<div style={{padding:"5px 12px",background:"rgba(210,175,90,0.1)",border:"1px solid rgba(210,175,90,0.2)",borderRadius:20,fontSize:12,color:"var(--gold)",fontFamily:"var(--f-mono)"}}>
          {referrals} joined
        </div>}
      </div>
      <p style={{fontSize:13,color:"var(--cream-40)",lineHeight:1.7,marginBottom:16}}>
        Share your link. When someone signs up and generates their report, you both get 7 days of Pro free automatically.
      </p>

      {/* Referral link */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:1,padding:"10px 14px",background:"var(--midnight)",border:"1px solid var(--line)",borderRadius:10,fontSize:12,color:"var(--cream-50)",fontFamily:"var(--f-mono)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>
          destiniq.vercel.app?ref={code}
        </div>
        <button onClick={copy} style={{background:copied?"var(--teal)":"var(--gold)",border:"none",borderRadius:10,padding:"10px 18px",color:"#000",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,transition:"background .2s"}}>
          {copied?"✓ Copied!":"Copy link"}
        </button>
      </div>

      {/* Share buttons */}
      <div style={{display:"flex",gap:8}}>
        <button onClick={shareWhatsApp} style={{flex:1,background:"#25D366",border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <span>💬</span> WhatsApp
        </button>
        <button onClick={shareTwitter} style={{flex:1,background:"#1DA1F2",border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <span>𝕏</span> Twitter
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABOUT US
// ═══════════════════════════════════════════════════════════════════════════════
function AboutUsPage({onBack}){
  const G={gold:"#f0b429",cream:"#e8dcc8",dim:"rgba(232,220,200,0.5)",
    dimmer:"rgba(232,220,200,0.25)",card:"#111008",border:"rgba(232,220,200,0.07)"};
  return(
    <div style={{minHeight:"100vh",background:"#0a0800",paddingTop:72,paddingBottom:80,
      color:G.cream,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{maxWidth:680,margin:"0 auto",padding:"0 24px"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:G.dim,
          cursor:"pointer",fontSize:13,marginBottom:32,display:"flex",alignItems:"center",
          gap:6,padding:0}}>← Back</button>

        <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:".15em",
          fontFamily:"monospace",marginBottom:12}}>OUR STORY</div>
        <h1 style={{fontSize:"clamp(24px,7vw,36px)",fontWeight:900,color:G.cream,margin:"0 0 32px",lineHeight:1.2}}>
          Built for people who want more clarity in their lives
        </h1>

        <div style={{display:"flex",flexDirection:"column",gap:20,fontSize:15,
          color:G.dim,lineHeight:1.9}}>
          <p>DestinIQ was born in Ghana, built for the world. We noticed that most personal development tools were built for a Western context — they assumed stable income, strong institutions, and straightforward career paths. For people in Africa, the Caribbean, Southeast Asia, and immigrant communities everywhere, that advice simply didn't land.</p>

          <p>We built DestinIQ to be different. It asks about your actual life — your income level, your country, your real challenges, your specific goals — and generates intelligence that actually applies to your situation. Not generic motivational content. Real guidance.</p>

          <p>The platform uses advanced AI to analyse your profile across 7 dimensions: career, finances, mindset, relationships, personal growth, lifestyle, and life direction. It then generates a personalised intelligence report and gives you access to 42 specialist AI tools covering every area of your life.</p>

          <p>We're a small team building something we believe should exist. If DestinIQ helps you make one better decision about your career, your finances, or your next move — we've done our job.</p>
        </div>

        <div style={{margin:"40px 0",height:1,background:G.border}}/>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16}}>
          {[
            ["🌍","Built in Ghana"],
            ["🤖","Powered by Claude AI"],
            ["🔒","Privacy first"],
            ["💳","Payments via Paystack"],
          ].map(([icon,label])=>(
            <div key={label} style={{background:G.card,border:"1px solid "+G.border,
              borderRadius:14,padding:"16px 18px",textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:8}}>{icon}</div>
              <div style={{fontSize:13,fontWeight:600,color:G.cream}}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{marginTop:40,padding:"20px 24px",background:"rgba(240,180,41,0.05)",
          border:"1px solid rgba(240,180,41,0.15)",borderRadius:16}}>
          <div style={{fontSize:13,fontWeight:700,color:G.cream,marginBottom:8}}>Get in touch</div>
          <a href="mailto:support@destiniq.app" style={{fontSize:14,color:G.gold,textDecoration:"none"}}>
            support@destiniq.app
          </a>
          <div style={{fontSize:12,color:G.dimmer,marginTop:4}}>We reply within 24 hours</div>
        </div>
      </div>
    </div>
  );
}
function PolicyPage({type,onBack}){
  const isPrivacy = type==="privacy";
  const isContact = type==="contact";
  const G={gold:"#f0b429",cream:"#e8dcc8",dim:"rgba(232,220,200,0.5)",
    dimmer:"rgba(232,220,200,0.27)",card:"#111008",border:"rgba(232,220,200,0.07)"};

  return(
    <div style={{minHeight:"100vh",background:"#0a0800",paddingTop:72,paddingBottom:80,
      color:G.cream,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{maxWidth:720,margin:"0 auto",padding:"0 24px"}}>

        <button onClick={onBack}
          style={{background:"none",border:"none",color:G.dim,cursor:"pointer",
            fontSize:13,marginBottom:28,display:"flex",alignItems:"center",gap:6,padding:0}}>
          ← Back
        </button>

        {/* Tab switcher */}
        <div style={{display:"flex",gap:6,marginBottom:32,flexWrap:"wrap"}}>
          {[["terms","Terms of Service"],["privacy","Privacy Policy"],["contact","Contact Us"]].map(([id,label])=>(
            <button key={id} onClick={()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:id}))}
              style={{padding:"8px 18px",borderRadius:20,border:`1px solid ${type===id?"rgba(240,180,41,0.4)":"rgba(232,220,200,0.1)"}`,
                background:type===id?"rgba(240,180,41,0.08)":"none",
                color:type===id?G.gold:G.dim,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>
              {label}
            </button>
          ))}
        </div>

        <h1 style={{fontSize:"clamp(20px,6vw,32px)",fontWeight:800,color:G.cream,margin:"0 0 6px"}}>
          {isContact?"Contact Us":isPrivacy?"Privacy Policy":"Terms of Service"}
        </h1>
        <div style={{fontSize:11,color:G.dimmer,fontFamily:"monospace",letterSpacing:".08em",marginBottom:40}}>
          {isContact?"We're here to help":"Last updated: June 2026"}
        </div>

        {/* ── CONTACT PAGE ── */}
        {isContact&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{background:G.card,border:"1px solid "+G.border,borderRadius:16,padding:"24px 28px"}}>
              <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:".1em",fontFamily:"monospace",marginBottom:16}}>
                GET IN TOUCH
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:G.cream,marginBottom:4}}>📧 Email Support</div>
                  <a href="mailto:support@destiniq.app"
                    style={{fontSize:14,color:G.gold,textDecoration:"none"}}>
                    support@destiniq.app
                  </a>
                  <div style={{fontSize:12,color:G.dim,marginTop:3}}>We respond within 24 hours</div>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:G.cream,marginBottom:4}}>🌍 Website</div>
                  <a href="https://destiniq.vercel.app" target="_blank" rel="noreferrer"
                    style={{fontSize:14,color:G.gold,textDecoration:"none"}}>
                    destiniq.vercel.app
                  </a>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:G.cream,marginBottom:4}}>🕐 Support Hours</div>
                  <div style={{fontSize:14,color:G.dim}}>Monday – Friday, 9am – 6pm GMT</div>
                </div>
              </div>
            </div>

            <div style={{background:G.card,border:"1px solid "+G.border,borderRadius:16,padding:"24px 28px"}}>
              <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:".1em",fontFamily:"monospace",marginBottom:16}}>
                BUSINESS INFORMATION
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10,fontSize:14,color:G.dim,lineHeight:1.7}}>
                <div><span style={{color:G.cream,fontWeight:600}}>Company:</span> DestinIQ</div>
                <div><span style={{color:G.cream,fontWeight:600}}>Product:</span> AI-powered personal intelligence platform</div>
                <div><span style={{color:G.cream,fontWeight:600}}>Based in:</span> Ghana, West Africa</div>
                <div><span style={{color:G.cream,fontWeight:600}}>Business type:</span> Software as a Service (SaaS)</div>
                <div><span style={{color:G.cream,fontWeight:600}}>Payments:</span> Processed by Paystack</div>
              </div>
            </div>

            <div style={{background:G.card,border:"1px solid "+G.border,borderRadius:16,padding:"24px 28px"}}>
              <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:".1em",fontFamily:"monospace",marginBottom:16}}>
                BILLING & SUBSCRIPTIONS
              </div>
              <div style={{fontSize:14,color:G.dim,lineHeight:1.8}}>
                <p style={{margin:"0 0 12px"}}>To cancel your subscription, manage billing, or request a refund, email us at <a href="mailto:support@destiniq.app" style={{color:G.gold}}>support@destiniq.app</a> with your account email and we'll handle it within 24 hours.</p>
                <p style={{margin:0}}>Refund requests made within 7 days of a charge are reviewed individually. We are committed to fair treatment of every customer.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── PRIVACY POLICY ── */}
        {isPrivacy&&(
          <div style={{display:"flex",flexDirection:"column",gap:24,fontSize:14,color:G.dim,lineHeight:1.9}}>
            {[
              ["What We Collect","We collect the information you provide during onboarding: name, age, country, goals, and challenges. We also collect daily check-in data, wins you log, journal entries, and your email address. Payment information is processed securely by Paystack — we never see or store your card details."],
              ["How We Use Your Data","Your data is used exclusively to generate your personalised DestinIQ intelligence reports, power your AI advisor, and track your progress over time. We do not use your data for advertising. We do not sell, rent, or share your personal data with any third party, ever."],
              ["AI Processing","Your profile and check-in information is sent to Anthropic's Claude AI to generate your personalised reports and advisor responses. This is processed under Anthropic's enterprise data processing agreement. Anthropic does not use your data to train their models."],
              ["Data Storage","All personal data is stored securely on Supabase (hosted on AWS infrastructure). Data is encrypted in transit (TLS) and at rest. Only you can access your personal data through your authenticated account."],
              ["Payments","Payments are processed by Paystack Inc. We do not store card or bank details. Flutterwave's own privacy policy governs how they handle your payment information."],
              ["Your Rights","You have the right to access, correct, or delete your personal data at any time. To request account deletion or a data export, email support@destiniq.app. We process all requests within 24 hours."],
              ["Cookies","We use only essential authentication cookies required for you to stay logged in. We do not use tracking, advertising, or analytics cookies."],
              ["Children","DestinIQ is not intended for users under 18. We do not knowingly collect data from minors."],
              ["Changes","We may update this policy from time to time. We will notify users of significant changes by email or in-app notification."],
              ["Contact","Privacy questions or concerns: support@destiniq.app"],
            ].map(([h,b])=>(
              <div key={h}>
                <div style={{fontSize:16,fontWeight:700,color:G.cream,marginBottom:8}}>{h}</div>
                <p style={{margin:0}}>{b}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── TERMS OF SERVICE ── */}
        {!isPrivacy&&!isContact&&(
          <div style={{display:"flex",flexDirection:"column",gap:24,fontSize:14,color:G.dim,lineHeight:1.9}}>
            {[
              ["1. Acceptance of Terms","By creating a DestinIQ account and using the service, you agree to these Terms of Service. If you do not agree with any part of these terms, please do not use the service."],
              ["2. Description of Service","DestinIQ is an AI-powered personal intelligence platform providing life, career, mindset, and financial guidance reports. The service is for personal self-development use only. It is not a substitute for professional financial, legal, medical, or psychological advice. Always consult a qualified professional for important life decisions."],
              ["3. Eligibility","You must be at least 18 years old to use DestinIQ. By using the service, you confirm that you meet this requirement and that the information you provide during onboarding is accurate."],
              ["4. Account Responsibility","You are responsible for maintaining the security of your account credentials. You agree not to share your account with others. Notify us immediately at support@destiniq.app if you suspect unauthorised access."],
              ["5. Subscriptions & Payments","DestinIQ offers Free, Pro ($9.99/month or $79.99/year), and Pro Max ($24.99/month or $199.99/year) subscription tiers. Paid subscriptions are processed by Paystack and renew automatically until cancelled. You may cancel at any time before your next billing date."],
              ["6. Refund Policy","Refund requests made within 7 days of a charge will be considered on a case-by-case basis. To request a refund, email support@destiniq.app with your account email and reason. We aim to resolve all refund requests within 3 business days."],
              ["7. Acceptable Use","You agree not to use DestinIQ to facilitate illegal activities, attempt to reverse-engineer or copy the platform, create multiple accounts to circumvent limits, or harass others. Accounts found in violation will be terminated without refund."],
              ["8. AI-Generated Content","Reports and advisor responses are generated by AI and are for guidance purposes only. DestinIQ does not guarantee the accuracy, completeness, or applicability of AI-generated content to your specific situation."],
              ["9. Intellectual Property","All DestinIQ platform content, branding, and code is owned by DestinIQ. Your personal data, journal entries, and reports belong to you."],
              ["10. Limitation of Liability","DestinIQ provides tools and guidance, not guarantees of outcomes. To the maximum extent permitted by law, DestinIQ shall not be liable for any indirect, incidental, or consequential damages arising from use of the service."],
              ["11. Changes to Terms","We reserve the right to update these terms. Significant changes will be communicated by email or in-app notification. Continued use after changes constitutes acceptance."],
              ["12. Contact","Questions about these terms: support@destiniq.app"],
            ].map(([h,b])=>(
              <div key={h}>
                <div style={{fontSize:16,fontWeight:700,color:G.cream,marginBottom:8}}>{h}</div>
                <p style={{margin:0}}>{b}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
function buildProfileContext(p){
  if(!p) return "User profile not yet available.";
  const parts = [];
  if(p.name)         parts.push(`Name: ${p.name}`);
  if(p.age)          parts.push(`Age: ${p.age}`);
  if(p.gender)       parts.push(`Gender: ${p.gender}`);
  if(p.country)      parts.push(`Country: ${p.country}`);
  if(p.relationship) parts.push(`Relationship: ${p.relationship}`);
  if(p.income)       parts.push(`Monthly income: ${p.income}`);
  if(p.education)    parts.push(`Education: ${p.education}`);
  if(p.career)       parts.push(`Career/Job: ${p.career}`);
  if(p.skills)       parts.push(`Skills: ${p.skills}`);
  if(p.habits)       parts.push(`Current habits: ${p.habits}`);
  if(p.situation)    parts.push(`Current situation: ${p.situation}`);
  if(p.challenge)    parts.push(`Biggest challenge: ${p.challenge}`);
  if(p.goals||p.bigGoal) parts.push(`Main goal: ${p.goals||p.bigGoal}`);
  if(p.wantFrom)     parts.push(`What they want from DestinIQ: ${p.wantFrom}`);
  return parts.join("\n");
}

// Language instruction for AI prompts

// ─── langPrompt ───────────────────────────────────────────────────────────────
const LANGUAGES = [
  {code:"en", label:"English",    native:"English",    flag:"🇬🇧"},
  {code:"fr", label:"Français",   native:"Français",   flag:"🇫🇷"},
  {code:"es", label:"Español",    native:"Español",    flag:"🇪🇸"},
  {code:"pt", label:"Português",  native:"Português",  flag:"🇧🇷"},
  {code:"ar", label:"Arabic",     native:"العربية",    flag:"🇸🇦"},
  {code:"de", label:"Deutsch",    native:"Deutsch",    flag:"🇩🇪"},
  {code:"hi", label:"Hindi",      native:"हिन्दी",      flag:"🇮🇳"},
  {code:"yo", label:"Yoruba",     native:"Yorùbá",     flag:"🇳🇬"},
  {code:"sw", label:"Kiswahili",  native:"Kiswahili",  flag:"🇰🇪"},
  {code:"ha", label:"Hausa",      native:"Hausa",      flag:"🇳🇬"},
];

function langPrompt(langCode){
  // Read from localStorage if no code passed (works in standalone functions)
  const code = langCode ||
    (typeof window!=="undefined" ? (localStorage.getItem("diq_lang")||"en") : "en");
  if(!code||code==="en") return "";
  const found = LANGUAGES.find(l=>l.code===code);
  if(!found) return "";
  return `\n\nIMPORTANT: Respond ENTIRELY in ${found.label} (${found.native}). Every word must be in ${found.label} — no English.`;
}

function LanguageSelector({lang, onChange}){
  const [open, setOpen] = useState(false);
  const cur = LANGUAGES.find(l=>l.code===lang)||LANGUAGES[0];
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:"var(--lift)",border:"1px solid var(--line)",borderRadius:10,
        padding:"8px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
        color:"var(--cream)",fontSize:13,
      }}>
        <span style={{fontSize:16}}>{cur.flag}</span>
        <span>{cur.native}</span>
        <span style={{color:"var(--cream-30)",fontSize:10}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"100%",right:0,background:"var(--lift)",
          border:"1px solid var(--line)",borderRadius:12,zIndex:500,
          width:220,maxHeight:320,overflowY:"auto",marginTop:4,
          boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
          {LANGUAGES.map(l=>(
            <div key={l.code} onClick={()=>{onChange(l.code);setOpen(false);}} style={{
              padding:"10px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,
              background:l.code===lang?"rgba(210,175,90,0.08)":"none",
              borderBottom:"1px solid rgba(255,255,255,0.04)",
            }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
            onMouseLeave={e=>e.currentTarget.style.background=l.code===lang?"rgba(210,175,90,0.08)":"none"}>
              <span style={{fontSize:20}}>{l.flag}</span>
              <div>
                <div style={{fontSize:13,color:"var(--cream)",fontWeight:l.code===lang?700:400}}>{l.native}</div>
                <div style={{fontSize:10,color:"var(--cream-30)"}}>{l.label}</div>
              </div>
              {l.code===lang&&<span style={{marginLeft:"auto",color:"var(--gold)",fontSize:12}}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── OfflineBanner ─────────────────────────────────────────────────────────────
function OfflineBanner(){
  const [offline, setOffline] = useState(false);
  useEffect(()=>{
    const on  = ()=>setOffline(false);
    const off = ()=>setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return()=>{ window.removeEventListener("online",on); window.removeEventListener("offline",off); };
  },[]);
  if(!offline) return null;
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"#f87171",color:"#fff",textAlign:"center",padding:"8px 16px",fontSize:13,fontWeight:600}}>
      📡 No internet connection — some features may not work
    </div>
  );
}

// ── EmailReminderToggle ───────────────────────────────────────────────────────
function EmailReminderToggle({userId}){
  const [on, setOn] = useState(()=>{
    try{ return localStorage.getItem(`diq_email_reminder_${userId}`) === "1"; }
    catch{ return false; }
  });
  const [saving, setSaving] = useState(false);

  const toggle = async() => {
    const next = !on;
    setOn(next);
    setSaving(true);
    try{
      localStorage.setItem(`diq_email_reminder_${userId}`, next?"1":"0");
      // Save preference to Supabase so the email system can read it
      await supabase.from("user_profiles").upsert({
        user_id: userId,
        email_reminders: next,
        updated_at: new Date().toISOString(),
      },{onConflict:"user_id"});
    }catch(e){ console.warn("Email pref:", e); }
    setSaving(false);
  };

  return(
    <button onClick={toggle} disabled={saving}
      style={{
        width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",
        background:on?"var(--teal)":"rgba(255,255,255,0.1)",
        position:"relative",transition:"background .2s",flexShrink:0,
      }}>
      <div style={{
        width:18,height:18,borderRadius:"50%",background:"#fff",
        position:"absolute",top:3,
        left:on?23:3,
        transition:"left .2s",
        boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
      }}/>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PROFILE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function ProfilePage({user,formData,isPaid,isPremium,isProMax,streak,onBack,onSignOut,onManageSubscription,onPhotoUpdate,lang,onLangChange}){
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

  const planLabel = isProMax?"Pro Max":isPaid?"Pro":"Free";
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
        <SubscriptionCard isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} userId={user?.id} onManageSubscription={onManageSubscription}/>

        {/* Sign out & delete */}
        <div className="card">
          {isPaid&&<button onClick={async()=>{
            if(!confirm("Cancel your subscription? You keep access until end of billing period.")) return;
            await saveUserProfile(user.id,{is_paid:false,is_premium:false});
            alert("Subscription cancelled. Contact support for refunds.");
          }} style={{width:"100%",background:"none",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"12px",color:"#F87171",fontSize:13,cursor:"pointer",marginBottom:10}}>Cancel subscription</button>}
          <button onClick={()=>{window.dispatchEvent(new CustomEvent("showEditProfile"));}} style={{width:"100%",background:"none",border:"1px solid rgba(210,175,90,0.3)",borderRadius:10,padding:"12px",color:"var(--gold)",fontSize:13,cursor:"pointer",marginBottom:8,fontWeight:600}}>✏️ Edit my profile & goals</button>
          {/* Email reminders toggle */}
          <div style={{marginBottom:8,padding:"12px 14px",background:"var(--lift)",border:"1px solid var(--line)",borderRadius:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,color:"var(--cream)",marginBottom:2}}>🔔 Daily reminder email</div>
                <div style={{fontSize:11,color:"var(--cream-40)"}}>Nudge at 8am if you haven't checked in</div>
              </div>
              <EmailReminderToggle userId={user?.id}/>
            </div>
          </div>

          {/* Referral Widget */}
          <div style={{marginBottom:16}}>
            <ReferralWidget userId={user?.id} isPaid={isPaid}/>
          </div>

          {/* Language selector */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:"var(--cream-30)",fontFamily:"var(--f-mono)",letterSpacing:".08em",marginBottom:8}}>LANGUAGE</div>
            <LanguageSelector lang={lang||"en"} onChange={(code)=>{
              if(onLangChange) onLangChange(code);
              try{localStorage.setItem("diq_lang",code);}catch{}
              document.documentElement.dir = ["ar","ur","fa"].includes(code)?"rtl":"ltr";
            }}/>
          </div>

          <button onClick={()=>{window.dispatchEvent(new CustomEvent("showAbout"));}} style={{width:"100%",background:"none",border:"1px solid var(--cream-10)",borderRadius:10,padding:"12px",color:"var(--cream-40)",fontSize:13,cursor:"pointer",marginBottom:8}}>About DestinIQ</button>
          <button onClick={()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:"terms"}))} style={{width:"100%",background:"none",border:"1px solid var(--cream-10)",borderRadius:10,padding:"12px",color:"var(--cream-40)",fontSize:13,cursor:"pointer",marginBottom:8}}>Terms of Service</button>
          <button onClick={()=>window.dispatchEvent(new CustomEvent("showPolicy",{detail:"privacy"}))} style={{width:"100%",background:"none",border:"1px solid var(--cream-10)",borderRadius:10,padding:"12px",color:"var(--cream-40)",fontSize:13,cursor:"pointer",marginBottom:10}}>Privacy Policy</button>
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
// 4. REFERRAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// 5. ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
const ADMIN_EMAILS=["support@destiniq.app"]; // Add your email here

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
                  <div style={{fontSize:"clamp(18px,5vw,26px)",fontWeight:800,color:"var(--gold)"}}>{val}</div>
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
// FREE_REPORT_LIMIT and PRO_REPORT_LIMIT defined at module level above
// Pro Max: unlimited // free users get 3 reports total

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
function SubscriptionCard({isPaid,isPremium,isProMax,userId,onManageSubscription}){
  const [cancelling,setCancelling]=useState(false);
  const [cancelled,setCancelled]=useState(false);
  const [showConfirm,setShowConfirm]=useState(false);
  const planLabel=isProMax?"Pro Max":isPaid?"Pro":"Free";
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
  const [emailConfirmPending, setEmailConfirmPending] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  // Persist screen so refresh returns to correct place
  useEffect(()=>{
    if(screen!=="landing"&&screen!=="loading"){
      try{localStorage.setItem("diq_screen",screen);}catch{}
    }
  },[screen]);

  // ── ANDROID HARDWARE BACK BUTTON ──────────────────────────────────────────
  useEffect(()=>{
    if(typeof window==="undefined"||!window?.Capacitor?.isNativePlatform?.()) return;
    const handleBackBtn=(e)=>{
      e?.detail?.register?.(10, async(processNextHandler)=>{
        if(screen==="results"){
          // On dashboard — ask if they want to exit
          if(window.confirm("Exit DestinIQ?")) processNextHandler();
        } else if(screen==="auth"||screen==="intake"){
          // On auth/intake — go back to landing
          setScreen("landing");
        } else {
          processNextHandler();
        }
      });
    };
    document.addEventListener("ionBackButton", handleBackBtn);
    return()=>document.removeEventListener("ionBackButton", handleBackBtn);
  },[screen]);
  const [formData,  setFormData ]=useState(null);
  const [report,    setReport   ]=useState(null);
  const [isPaid,    setIsPaid   ]=useState(false);
  const [isPremium, setIsPremium]=useState(false);
  const [isProMax,  setIsProMax ]=useState(false);
  const [lang, setLang] = useState(()=>{ try{return localStorage.getItem("diq_lang")||"en";}catch{return "en";} });
  const tl = (key) => t(lang, key);
  useEffect(()=>{
    document.documentElement.dir  = lang==="ar"?"rtl":"ltr";
    document.documentElement.lang = lang;
  },[lang]);
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
  const [showAbout,      setShowAbout     ]=useState(false);
  const [showEditProfile,setShowEditProfile]=useState(false);
  const [showShare,   setShowShare  ]=useState(false);
  const [showReferral,setShowReferral]=useState(false);
  const [navPhotoURL, setNavPhotoURL]=useState(null);
  const [rateLimited, setRateLimited]=useState(false);
  const [isOffline,   setIsOffline  ]=useState(false);
  const [profileLoading,setProfileLoading]=useState(false); // true while loading saved profile after login
  const [showTracker,  setShowTracker  ]=useState(false);
  const [showTutorial, setShowTutorial]=useState(false);
  // Tracks whether sign-out was explicitly triggered by the user.
  // Supabase fires SIGNED_OUT on every token refresh — we ignore those.
  const explicitSignOut = useRef(false);

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
    setProfileLoading(true);

    // ── INSTANT RESTORE from localStorage ────────────────────────────────────
    // Restore paid/premium/streak BEFORE Supabase responds.
    // Eliminates the flash of "Free" or streak=0 on every page refresh.
    try {
      if (localStorage.getItem(`diq_paid_${u.id}`) === "1")   setIsPaid(true);
      if (localStorage.getItem(`diq_prem_${u.id}`) === "1")   setIsPremium(true);
      const lsStreak = parseInt(localStorage.getItem(`diq_streak_${u.id}`) || "0");
      if (lsStreak > 0) setStreak(lsStreak);
    } catch(_) {}

    hydrateUserData(u.id);

    // Load avatar for nav bar
    try{
      const{data:avatarData}=supabase.storage.from("avatars").getPublicUrl(`${u.id}/avatar`);
      if(avatarData?.publicUrl){
        const testImg=new Image();
        testImg.onload=()=>setNavPhotoURL(avatarData.publicUrl+"?t="+Date.now());
        testImg.onerror=()=>setNavPhotoURL(null);
        testImg.src=avatarData.publicUrl;
      }
    }catch(_){}

    // Load saved profile (onboarding answers + subscription)
    try{
      const profile = await loadUserProfile(u.id);
      if (profile) {
        // ── SUBSCRIPTION STATUS ─────────────────────────────────────────
        // Source 1: Supabase (authoritative)
        if (profile.is_paid) {
          setIsPaid(true);
          // Keep localStorage in sync with DB
          try { localStorage.setItem(`diq_paid_${u.id}`, "1"); } catch(_){}
        } else {
          // DB says not paid — clear localStorage backup so it doesn't contradict
          // (covers edge case: admin revokes access)
          try { localStorage.removeItem(`diq_paid_${u.id}`); } catch(_){}
        }
        if (profile.is_premium) {
          setIsPremium(true);
          try { localStorage.setItem(`diq_prem_${u.id}`, "1"); } catch(_){}
        } else {
          try { localStorage.removeItem(`diq_prem_${u.id}`); } catch(_){}
        }
        // Restore Pro Max tier — read paid_plan from DB
        if (profile.paid_plan==="promax" || profile.paid_plan==="promax_annual") {
          setIsProMax(true);
          try { localStorage.setItem(`diq_promax_${u.id}`, "1"); } catch(_){}
        } else {
          try { localStorage.removeItem(`diq_promax_${u.id}`); } catch(_){}
        }
        // ── STREAK RESTORATION ──────────────────────────────────────────────
        // Single source of truth: Supabase last_checkin_date + localStorage backup
        // A streak is valid if the user checked in today OR yesterday.
        // If the last check-in was 2+ days ago, the streak resets to 1.
        {
          // Use form_data._streak as reliable fallback (always saved)
          // form_data is TEXT in Supabase — parse it
          const _fd = typeof profile.form_data==="string"
            ? (()=>{try{return JSON.parse(profile.form_data);}catch{return{};}})()
            : (profile.form_data||{});
          const fdStreak  = _fd?._streak;
          const fdLast    = _fd?._last_checkin || "";
          const savedStreak = profile.streak || fdStreak || 1;
          const today     = new Date().toISOString().slice(0,10);
          const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
          // Check all sources — DB column, form_data fallback, localStorage
          const dbLast    = profile.last_checkin_date || fdLast;
          const localLast = (() => { try{ return localStorage.getItem(`destiniq_checkin_${u.id}`)||""; }catch{return "";} })();
          const localStreak = (() => { try{ const s=localStorage.getItem(`diq_streak_${u.id}`); return s?parseInt(s):0; }catch{return 0;} })();
          const lastSeen  = [dbLast, localLast, fdLast].filter(Boolean).sort().pop() || "";
          // Take highest streak from all sources (most reliable)
          const bestStreak = Math.max(savedStreak, localStreak, 1);

          if (!lastSeen) {
            // Never checked in before — keep whatever streak DB has (could be 1 from signup)
            setStreak(bestStreak);
          } else if (lastSeen === today) {
            // Already checked in today — show current streak as-is
            setStreak(bestStreak);
          } else if (lastSeen === yesterday) {
            // Checked in yesterday — streak is still alive, increment it for today
            const newStreak = bestStreak + 1;
            setStreak(newStreak);
            // Persist incremented streak immediately so refresh shows correct value
            supabase.from("user_profiles").upsert({
              user_id: u.id, streak: newStreak,
              updated_at: new Date().toISOString(),
            },{onConflict:"user_id"}).catch(()=>{});
            try{ localStorage.setItem(`diq_streak_${u.id}`, String(newStreak)); }catch{}
          } else {
            // Missed a day — streak broken, reset to 1
            setStreak(1);
            supabase.from("user_profiles").upsert({
              user_id: u.id, streak: 1,
              updated_at: new Date().toISOString(),
            }, {onConflict:"user_id"}).catch(()=>{});
            // Also update localStorage so next restore agrees
            try{ localStorage.removeItem(`destiniq_checkin_${u.id}`); }catch{}
          }
        }
        if (profile.form_data){
          // form_data is stored as TEXT in Supabase — must parse if it's a string
          const parsedFD = typeof profile.form_data === "string"
            ? (() => { try{ return JSON.parse(profile.form_data); } catch{ return {}; } })()
            : (profile.form_data || {});
          setFormData({
            ...parsedFD,
            last_checkin_date: profile.last_checkin_date || parsedFD._last_checkin || "",
          });
          // Restore wins from Supabase if localStorage was cleared
          const _winsFromDB = profile.wins?.length ? profile.wins
            : (parsedFD?._wins||[]);
          if(_winsFromDB?.length){
            const serverWins = _winsFromDB;
            const localWins  = (()=>{ try{ return JSON.parse(localStorage.getItem(`diq_wins_${u.id}`)||"[]"); }catch{ return []; } })();
            if(serverWins.length > localWins.length){
              try{ localStorage.setItem(`diq_wins_${u.id}`, JSON.stringify(serverWins)); }catch{}
            }
          }
        }
        if (profile.report)     setReport(profile.report);
        // ── CRITICAL: Always restore exactly where they left off ──
        // Signed-in users must NEVER see the marketing landing page — only
        // brand-new users (no saved onboarding data) see the welcome/intake form.
        // Save streak to localStorage as instant backup (so page refresh shows correct streak)
        try{ localStorage.setItem(`diq_streak_${u.id}`, String(profile.streak||1)); }catch(_){}

        // ── SCREEN ROUTING ────────────────────────────────────────────────────────
        if (profile.form_data && profile.report) {
          setScreen("results");
        } else if (profile.form_data) {
          setScreen("results"); // show dashboard even without report — report section handles missing state
        } else {
          setScreen("intake");
        }
      } else {
        // No profile found — new user, go to onboarding
        setScreen("intake");
      }
    } catch(e) {
      console.warn("restoreUserSession error:", e.message);
      const savedScreen = typeof window!=="undefined" ? localStorage.getItem("diq_screen") : null;
      if (savedScreen && savedScreen !== "intake" && savedScreen !== "loading") {
        setScreen(savedScreen);
      } else {
        setScreen("results");
      }
    } finally {
      setProfileLoading(false);
    }
  };

  // ── NATIVE APP SETUP ──────────────────────────────────────────────────────
  useEffect(()=>{
    if(typeof window==="undefined") return;
    const isNative = window?.Capacitor?.isNativePlatform?.();
    if(isNative){
      // Set status bar to dark/gold theme to match app
      if(window?.StatusBar){
        try{
          window.StatusBar.setBackgroundColor({color:"#0a0800"});
          window.StatusBar.setStyle({style:"DARK"});
        }catch{}
      }
      // Keep screen awake while on dashboard
      if(window?.KeepAwake){
        try{ window.KeepAwake.keepAwake(); }catch{}
      }
      // Hide splash screen after app loads
      if(window?.SplashScreen){
        try{ window.SplashScreen.hide(); }catch{}
      }
    }
  },[]);

  // ── PWA INSTALL PROMPT ────────────────────────────────────────────────────
  useEffect(()=>{
    const handler=(e)=>{ e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return()=>window.removeEventListener("beforeinstallprompt", handler);
  },[]);
  const handleInstallApp = async()=>{
    if(!installPrompt) return;
    await installPrompt.prompt();
    const{outcome}=await installPrompt.userChoice;
    if(outcome==="accepted"){ setInstallPrompt(null); setShowInstall(false); }
  };

  // ── OAUTH ERROR URL HANDLER ───────────────────────────────────────────────
  useEffect(()=>{
    if(typeof window==="undefined") return;
    const params=new URLSearchParams(window.location.search);
    const errCode=params.get("error_code")||params.get("error");
    if(errCode){
      // OAuth redirect error (e.g. bad_oauth_state) — clean URL and show auth
      try{ window.history.replaceState({},"",window.location.pathname); }catch{}
      setScreen("auth");
      return;
    }
    // Restore last screen for returning users (so refresh doesn't reset to landing)
    const savedScreen = localStorage.getItem("diq_screen");
    if(savedScreen&&savedScreen!=="loading"&&savedScreen!=="landing"){
      setScreen(savedScreen);
    }
  },[]);

  // ── HUBTEL RETURN URL HANDLER ─────────────────────────────────────────────
  useEffect(()=>{
    if(typeof window==="undefined") return;
    const params=new URLSearchParams(window.location.search);
    const payment=params.get("payment");
    const ref=params.get("ref");
    const planKey=params.get("plan");
    if(payment==="success"&&ref&&userId){
      // Retrieve pending payment info from localStorage
      try{
        const pending=JSON.parse(localStorage.getItem("diq_pending_payment_"+userId)||"null");
        if(pending&&pending.ref===ref){
          // Mark as paid immediately
          localStorage.setItem("diq_paid_"+userId,"1");
          if(pending.tier==="promax") localStorage.setItem("diq_prem_"+userId,"1");
          localStorage.removeItem("diq_pending_payment_"+userId);
          // Save to Supabase
          supabase.from("user_profiles").upsert({
            user_id:userId, is_paid:true,
            is_premium:pending.tier==="promax",
            paid_plan:pending.plan,
            hubtel_ref:ref,
            paid_at:new Date().toISOString(),
          },{onConflict:"user_id"}).catch(()=>{});
          // Update UI
          setIsPaid(true);
          if(pending.tier==="promax") setIsPremium(true);
          // Clean URL
          window.history.replaceState({},"",window.location.pathname);
          alert("✅ Payment successful! Your "+pending.plan+" plan is now active.");
        }
      }catch(e){}
    }
  },[userId]);

  // ── AUTO-SCHEDULE NOTIFICATIONS on every login ───────────────────
  // Users shouldn't have to configure anything — just works
  useEffect(()=>{
    const restoreUserSession = async () => {
      try{
        const savedNotif  = localStorage.getItem(NOTIF_SCHED_KEY);
        const notifData   = savedNotif ? JSON.parse(savedNotif) : null;
        const times       = notifData?.times||{morning:"07:00",afternoon:"13:00",evening:"20:00"};
        const uName       = profile.form_data?.name||u.email?.split("@")[0]||"there";
        const uGoal       = profile.form_data?.goals||profile.form_data?.bigGoal||"your goals";
        setTimeout(()=>{
          scheduleNotification(u.id, uName, uGoal, profile.streak||1, times, null);
        }, 3000);
      }catch(e){}

      if (profile.form_data && profile.report) {
        // ── CASE 1: Complete profile + report → straight to Dashboard
        setScreen("results");
      } else if (profile.form_data) {
        // ── CASE 2: Has profile data but missing report or incomplete fields
        // Show a short "complete your profile" flow, then regenerate report
        setScreen("complete-profile");
      } else {
        // ── CASE 3: Brand-new account — no profile data at all
        setScreen("intake");
      }
    };
    try{
      if (profile.form_data && profile.report) {
        // ── CASE 1: Complete profile + report → straight to Dashboard
        setScreen("results");
      } else if (profile.form_data) {
        // ── CASE 2: Has profile data but missing report or incomplete fields
        // Show a short "complete your profile" flow, then regenerate report
        setScreen("complete-profile");
      } else {
        // ── CASE 3: Brand-new account — no profile data at all
        setScreen("intake");
      }
    }catch(e){
      console.warn("restoreUserSession profile load error:",e.message);
      // Don't send returning users back to onboarding on network/load errors
      // If we have a userId, they're authenticated — send to results or landing
      if(userId||u?.id){
        const savedScreen = typeof window!=="undefined"?localStorage.getItem("diq_screen"):null;
        if(savedScreen&&savedScreen!=="intake"&&savedScreen!=="loading"){
          setScreen(savedScreen);
        } else {
          setScreen("results"); // They're logged in — show dashboard
        }
      } else {
        setScreen("landing");
      }
    }finally{
      setProfileLoading(false);
    }
  },[userId, profile]);

  // ── DEEP LINK HANDLER — catches OAuth callback on mobile ──────────────
  // Uses window.Capacitor.Plugins directly — avoids Next.js bundling native modules
  useEffect(()=>{
    if(typeof window==="undefined") return;
    const isNative = window?.Capacitor?.isNativePlatform?.();
    if(!isNative) return;
    // Access Capacitor plugins via global (no import needed — avoids build errors)
    const CapApp = window?.Capacitor?.Plugins?.App;
    if(!CapApp) return;
    let listener = null;
    CapApp.addListener("appUrlOpen",async({url})=>{
      if(!url) return;
      const hash = url.includes("#") ? url.split("#")[1] : url.split("?")[1]||"";
      const p = new URLSearchParams(hash);
      const access_token  = p.get("access_token");
      const refresh_token = p.get("refresh_token");
      if(access_token && refresh_token){
        const{error}=await supabase.auth.setSession({access_token,refresh_token});
        if(error) console.warn("Deep link auth:",error.message);
        // Close in-app browser via global plugin
        try{ window?.Capacitor?.Plugins?.Browser?.close?.(); }catch{}
      }
    }).then(l=>{listener=l;}).catch(()=>{});
    return()=>{ try{listener?.remove?.();}catch{} };
  },[]);

  useEffect(()=>{
    // mountRestored: ref (not state) so it never triggers a re-render.
    // Prevents the double-fire: getSession() + onAuthStateChange INITIAL_SESSION
    // both call restoreUserSession, and the second (unguarded) call races with
    // the first and can reset screen back to "intake" after it was set to "results".
    let mountRestored = false;

    supabase.auth.getSession().then(async({data:{session}})=>{
      if(session?.user){
        await restoreUserSession(session.user);
      }
      mountRestored = true;
      setAuthLoading(false);
    });

    // AUTH STATE CHANGES — only handle REAL changes after mount is done.
    // Skip INITIAL_SESSION: getSession() above already handled it with await.
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,session)=>{
      // Skip the automatic initial fire — we already handled it above
      // Skip INITIAL_SESSION — getSession() above already handles it with await
      if(!mountRestored && (_event==="INITIAL_SESSION")) return;
      if(session?.user){
        restoreUserSession(session.user);
        // Track referral if URL has ?ref=
        if(_event==="SIGNED_IN"&&typeof window!=="undefined"){
          const ref=new URLSearchParams(window.location.search).get("ref");
          // Basic UUID validation + don't let someone refer themselves
          const isValidUUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref||"");
          if(isValidUUID&&ref!==session.user.id){
            try{
              // insert will silently fail if it violates the unique(referred_id) constraint — that's fine,
              // it just means this user was already recorded as referred before
              const{error:refErr}=await supabase.from("referrals").insert({referrer_id:ref,referred_id:session.user.id});
              if(refErr) console.warn("Referral insert:",refErr.message);
            }catch(_){ /* referral already recorded or insert failed — ignore */ }
            window.history.replaceState({},"",window.location.pathname);
          }
        }
      } else {
        // SIGNED_OUT fires on every page reload during Supabase token refresh.
        // We ONLY reset state if the user explicitly clicked Sign Out.
        // Otherwise we ignore it — getSession() on the next refresh handles auth.
        if(explicitSignOut.current){
          explicitSignOut.current = false;
          setUser(null);
          setUserId(null);
          setFormData(null);
          setReport(null);
          setIsPaid(false);
          setIsPremium(false);
          setStreak(1);
          setScreen("landing");
          // Clear localStorage only on explicit sign-out
          try{
            Object.keys(localStorage).forEach(k=>{
              if(k.startsWith("diq_")||k.startsWith("destiniq_")) localStorage.removeItem(k);
            });
          }catch(_){}
        }
        // If NOT explicit sign-out: ignore SIGNED_OUT — it's just a token refresh.
        // State is already correct from restoreUserSession.
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

  // Register service worker for push notifications
  useEffect(()=>{
    if(typeof window==="undefined"||!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(e=>console.warn("SW:",e));
  },[]);

  // Subscribe to push after login (wait 30s so user is engaged first)
  useEffect(()=>{
    if(!userId||typeof window==="undefined"||!("PushManager" in window)) return;
    const timer=setTimeout(async()=>{
      try{
        const reg=await navigator.serviceWorker.ready;
        const existing=await reg.pushManager.getSubscription();
        if(existing) return;
        const perm=await Notification.requestPermission();
        if(perm!=="granted") return;
        const vapidKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"";
        if(!vapidKey) return;
        const sub=await reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:urlBase64ToUint8Array(vapidKey),
        });
        await supabase.from("user_profiles").upsert({
          user_id:userId,
          push_subscription:JSON.parse(JSON.stringify(sub)),
          updated_at:new Date().toISOString(),
        },{onConflict:"user_id"});
      }catch(e){ console.warn("Push sub failed:",e); }
    },30000);
    return()=>clearTimeout(timer);
  },[userId]);

  // Paid users are always Premium in this app — there is no separate paid-but-
  // not-premium tier in practice. Self-correct instantly if these ever drift
  // out of sync (e.g. stale localStorage), instead of requiring a manual toggle.
  useEffect(()=>{
    // isPremium = Pro Max ONLY — do not force it for all paid users
  },[isPaid,isPremium]);

  // Listen for policy events from auth screen footer links
  useEffect(()=>{
    const handler=(e)=>setShowPolicy(e.detail);
    const handleAbout=()=>setShowAbout(true);
    const handleEditProfile=()=>setShowEditProfile(true);
    window.addEventListener("showPolicy",handler);
    window.addEventListener("showAbout",handleAbout);
    window.addEventListener("showEditProfile",handleEditProfile);
    const handleSignOutEv=async()=>{
          try{explicitSignOut.current=true;}catch{}
          await supabase.auth.signOut();
          setUser(null);setUserId(null);setScreen("landing");setFormData(null);setReport(null);
          setIsPaid(false);setIsPremium(false);setNavPhotoURL(null);setStreak(1);
          try{Object.keys(localStorage).forEach(k=>{if(k.startsWith("diq_")||k.startsWith("destiniq_"))localStorage.removeItem(k);});}catch{}
        };
        window.addEventListener("signOut",handleSignOutEv);
        const handleShowNotif=()=>setShowNotif(true);
        window.addEventListener("showNotif",handleShowNotif);
        const handlePhotoUpdated=(e)=>{ if(e.detail?.url) setNavPhotoURL(e.detail.url); };
        window.addEventListener("photoUpdated",handlePhotoUpdated);
        const handleCI=(e)=>{
          // Bump the visible streak counter immediately after check-in
          setStreak(s=>{
            const next=s+1;
            if(e.detail?.userId) try{localStorage.setItem(`diq_streak_${e.detail.userId}`,String(next));}catch{}
            return next;
          });
        };
        window.addEventListener("checkinComplete",handleCI);
        return()=>{window.removeEventListener("showPolicy",handler);window.removeEventListener("showAbout",handleAbout);window.removeEventListener("showEditProfile",handleEditProfile);window.removeEventListener("signOut",handleSignOutEv);window.removeEventListener("showNotif",handleShowNotif);window.removeEventListener("photoUpdated",handlePhotoUpdated);window.removeEventListener("checkinComplete",handleCI);};
  },[]);

  // ── BROWSER BACK BUTTON ──────────────────────────────────────────────
  // Push a marker entry on mount so the first "back" press is caught by
  // our popstate listener below instead of immediately leaving/reloading
  // the app (which is what was wiping formData/report and sending people
  // back to the "what's your name" intake screen).
  useEffect(()=>{
    try{ window.history.replaceState({diqApp:true},"",window.location.href); }catch(_){}
  },[]);

  useEffect(()=>{
    const onPopState=()=>{
      // If a panel/overlay is open, close it and stay right where we are.
      if(showProfile||showAdmin||showShare||showNotif||showPolicy){
        setShowProfile(false);setShowAdmin(false);setShowShare(false);setShowNotif(false);setShowPolicy(null);
        try{ window.history.pushState({diqApp:true},"",window.location.href); }catch(_){}
        return;
      }
      // From the subscription/paywall page, go back to the dashboard —
      // never re-show the intake form for someone who already has a report.
      if(screen==="paywall"){
        setScreen(formData&&report?"results":"intake");
        try{ window.history.pushState({diqApp:true},"",window.location.href); }catch(_){}
        return;
      }
      // If a saved report exists, "back" should never land on the intake form.
      if(screen==="intake"&&formData&&report){
        setScreen("results");
        try{ window.history.pushState({diqApp:true},"",window.location.href); }catch(_){}
        return;
      }
      // Otherwise, let the back navigation proceed normally.
    };
    window.addEventListener("popstate",onPopState);
    return()=>window.removeEventListener("popstate",onPopState);
  },[showProfile,showAdmin,showShare,showNotif,showPolicy,screen,formData,report]);

  const handleSubmit=useCallback(async(f)=>{
    try{
    if(!userId) return;
    if(isRateLimited(isPaid)){
      setApiError("You've used your free reports. Upgrade to generate more.");
      setScreen("paywall");
      return;
    }
    incrementRateLimit();
    setFormData(f);setScreen("loading");setApiError("");
    pushToMemory(userId,"user",`Profile: ${f.name}, ${f.age}, ${f.country}, Situation: ${f.situation||f.career}, Goal: ${f.bigGoal||""}, Goals: ${f.goals}, Challenge: ${f.challenge}, Wants from app: ${f.wantFrom||""}`);

    // Fetch live local context for their area (parallel with report generation feel)
    const localCtx = await getLocalContext(ipLocation?.city||"", f.country).catch(()=>null);

    try{

      const prompt=buildAnalysisPrompt(f,isPremium,buildMemoryContext(userId),ipLocation,localCtx);
      const raw=await callAPI({
        messages:[{role:"user",content:prompt}],
        system:`⚠️ CURRENCY LAW — READ BEFORE ANYTHING ELSE:
RULE A: Every cost, price, startup budget, savings amount, rent, or fee = ${currCode} (${currSym}) ONLY.
RULE B: Earnings from online platforms (Upwork, Fiverr, YouTube, remote jobs) = USD + local equivalent in brackets.
VIOLATION EXAMPLE: Writing "$200 startup cost" for a user in ${country} = WRONG. GH₵3,000 startup cost = CORRECT.

You are a world-class personal strategy advisor, life coach, and financial mentor writing an intensely personal report for ONE person in ${country}. Tailor everything to their actual country.

CURRENCY RULE — ABSOLUTE AND NON-NEGOTIABLE:
TWO SEPARATE RULES:
  RULE A — COSTS, SAVINGS, BUDGETS, STARTUP MONEY = LOCAL CURRENCY ONLY.
    Any amount the user must SPEND, SAVE, or INVEST uses their country's currency:
    Ghana → GH₵   Nigeria → ₦   Kenya → KSh   South Africa → R
    Rwanda → RWF   Uganda → USh   Tanzania → TSh   Ethiopia → Birr
    UK → £   Europe → €   India → ₹   Philippines → ₱   USA → $
    NEVER write a cost in USD for someone who lives in Ghana, Nigeria, Kenya, etc.
    If cost of renting in Ghana is GH₵800/month, write GH₵800 — NOT $55.
  RULE B — EARNINGS, INCOME, REVENUE FROM ONLINE WORK = USD.
    Any income the user will EARN from online platforms, freelancing, or digital work = USD.
    This is because Upwork, Fiverr, YouTube etc. pay in USD regardless of country.
    You may add the local equivalent in brackets: e.g. "$500/month (GH₵7,800)".
  DO NOT MIX THESE TWO RULES. DO NOT use $ for a startup cost in Ghana.
  DO NOT use GH₵ for what they'll earn on Upwork.

Beyond the standard report sections, you MUST include these additional sections in your JSON response:
- life_hacks: 5 specific, practical life hacks tailored to their goal and country.
- money_protection: 3-4 specific rules for protecting income — budgeting method, savings target in LOCAL CURRENCY, what NOT to spend on, and one investment they can start with almost nothing.
- emotional_strength: 3 practices for not letting emotions derail progress.
- online_income: 3 ways to make money online accessible from their country. Give EXACT working URLs. Earnings in USD.
- zero_income_business: How to start a business with zero money. Costs in local currency.
- product_business: 3 physical product ideas with supplier links. Startup cost in LOCAL CURRENCY.
- real_estate_hack: Real estate income method for their country with local platforms. Amounts in local currency.

All other rules: personalized, use their name, no markdown asterisks, ONLY valid JSON, complete and parseable.`,
        userId,isPremium
      });
      const cleaned=raw.replace(/```json|```/g,"").trim();
      const jStart=cleaned.indexOf("{"); const jEnd=cleaned.lastIndexOf("}");
      const parsed=JSON.parse(jStart>=0?cleaned.slice(jStart,jEnd+1):cleaned);
      pushToMemory(userId,"assistant","Report generated: scores="+JSON.stringify(parsed.scores||{}));
      setReport(parsed);
      // Always compute overall from pillar scores so it stays consistent with what's shown
      if(parsed.scores){
        const {life=0,wealth=0,mindset=0,relations=0}=parsed.scores;
        const computed=Math.round(life*0.25+wealth*0.30+mindset*0.25+relations*0.20);
        parsed.overall=computed;
      }
      try{localStorage.setItem("diq_nav","report");}catch{} // New users land on My Report first
      setScreen("results");
      // Show tutorial to first-time users
      try{
        if(!localStorage.getItem(TUTORIAL_KEY)){
          setTimeout(()=>setShowTutorial(true), 1800);
        }
      }catch{}
      // Apply referral reward on first report generation
      try{
        const refCode = typeof window!=="undefined" ? localStorage.getItem("diq_ref")||"" : "";
        if(refCode && userId){
          const expiry = new Date(Date.now()+7*24*60*60*1000).toISOString();
          await supabase.from("user_profiles").upsert({
            user_id: userId, referral_pro_expiry: expiry
          },{onConflict:"user_id"});
          localStorage.removeItem("diq_ref");
        }
      }catch(e){}
      // Save profile + report to Supabase
      try{
        const reportToSave = {
          overall:       parsed.overall,
          scores:        parsed.scores,
          score_explanations: parsed.score_explanations,
          summary:       parsed.summary,
          headline:      parsed.headline,
          greeting:      parsed.greeting,
          teaser:        parsed.teaser,
          closing:       parsed.closing,
          strengths:     parsed.strengths||[],
          risks:         parsed.risks||[],
          score_history: [
            ...(Array.isArray(report?.score_history)?report.score_history:[]),
            {
              date: new Date().toISOString().slice(0,10),
              overall: parsed.overall||0,
              life:    parsed.scores?.life||0,
              wealth:  parsed.scores?.wealth||0,
              mindset: parsed.scores?.mindset||0,
              relations: parsed.scores?.relations||0,
            }
          ].slice(-12), // keep last 12 entries (1 year of monthly)
          daily_insight: parsed.daily_insight,
          life:          parsed.life,
          wealth:        parsed.wealth,
          mindset:       parsed.mindset,
          relationships: parsed.relationships,
          sections:      (parsed.sections||[]).map(s=>({title:s.title,content:(s.content||"").slice(0,800)})),
          roadmap:       parsed.roadmap,
          career:        parsed.career,
          relocation:    parsed.relocation,
          suggestedCountries: (parsed.suggestedCountries||[]).slice(0,3),
          // Module data — these MUST be saved or tabs show empty
          life_hacks:          parsed.life_hacks,
          emotional_strength:  parsed.emotional_strength,
          money_protection:    parsed.money_protection,
          online_income:       parsed.online_income,
          zero_income_business:parsed.zero_income_business,
          product_business:    parsed.product_business,
          real_estate_hack:    parsed.real_estate_hack,
        };
        // NOTE: is_paid and is_premium are intentionally NOT included here.
        // They are written ONLY by the payment flow (Paystack callback + handlePay).
        // Including them here would overwrite paid status back to false if the
        // user regenerates their report while the state hasn't fully loaded.
        const {error:saveError} = await supabase.from("user_profiles").upsert({
          user_id: userId,
          form_data: f,
          report: reportToSave,
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
        const fbToSave={
          overall:fb.overall, scores:fb.scores, score_explanations:fb.score_explanations,
          summary:fb.summary, headline:fb.headline, teaser:fb.teaser,
          life:fb.life, wealth:fb.wealth, mindset:fb.mindset, relationships:fb.relationships,
          sections:fb.sections?.map(s=>({title:s.title,content:s.content?.slice(0,800)})),
          roadmap:fb.roadmap, career:fb.career, relocation:fb.relocation,
          suggestedCountries:(fb.suggestedCountries||[]).slice(0,3),
          life_hacks:fb.life_hacks, emotional_strength:fb.emotional_strength,
          money_protection:fb.money_protection, online_income:fb.online_income,
          zero_income_business:fb.zero_income_business, product_business:fb.product_business,
          real_estate_hack:fb.real_estate_hack,
        };
        // NOTE: is_paid/is_premium NOT saved here — payment flow owns those fields
        await saveUserProfile(userId,{form_data:f,report:fbToSave,streak});
      }catch(_){}
      if(e.message==="API_KEY_MISSING") setApiError("Demo mode: API key not configured. Showing sample report.");
    }
    }catch(outerErr){
      console.error("Report generation crash:", outerErr?.message||outerErr);
      const fb=fallback(f||{},ipLocation);
      setReport(fb);
      setScreen("results");
    }
  },[userId,isPremium,ipLocation]);

  const restart=()=>{setScreen("intake");setFormData(null);setReport(null);setIsPaid(false);setIsPremium(false);setIsProMax(false);setStreak(1);setShowCI(false);setApiError("");setNudge(false);};
  const handleUnlock=()=>{setScreen("paywall");};
  // handlePay: called after Paystack confirms payment in the Paywall component.
  // We write is_paid:true to Supabase immediately so it survives any refresh.
  const handlePay=async(flwRef, planKey)=>{
    const isMax = planKey==="promax" || planKey==="promax_annual";
    setIsPaid(true);
    if(isMax){ setIsPremium(true); setIsProMax(true); }
    // Belt-and-suspenders: write to localStorage here too in case the
    // Paywall's callback missed it (e.g. userId was null at payment time)
    if(userId){
      try{
        localStorage.setItem(`diq_paid_${userId}`, "1");
        localStorage.setItem(`diq_prem_${userId}`, "1");
        if(isMax) localStorage.setItem(`diq_promax_${userId}`, "1");
        if(flwRef) localStorage.setItem(`diq_flw_ref_${userId}`, flwRef);
      }catch(_){}
    }
    setScreen("results");
    if(userId){
      try{
        await saveUserProfile(userId,{
          is_paid:true,
          is_premium:true,
          paid_plan:planKey||"pro",
          flw_ref:flwRef||null,
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

        {/* ── LOADING STATE — wait for Supabase session check ─────────────── */}
        {authLoading&&(
          <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",
            alignItems:"center",justifyContent:"center",background:"#0a0800",
            fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
            {/* Logo */}
            <div style={{fontSize:"clamp(20px,6vw,32px)",fontWeight:900,color:"#e8dcc8",marginBottom:32,
              letterSpacing:"-.5px"}}>
              Destin<span style={{color:"#f0b429"}}>IQ</span>
            </div>
            {/* Animated bar */}
            <div style={{width:160,height:3,background:"rgba(255,255,255,0.06)",
              borderRadius:2,overflow:"hidden"}}>
              <div style={{
                height:"100%",borderRadius:2,
                background:"linear-gradient(90deg,#f0b429,#1ab89a)",
                animation:"shimmer 1.4s ease-in-out infinite",
                width:"40%",
              }}/>
            </div>
            <div style={{marginTop:20,fontSize:12,color:"rgba(232,220,200,0.3)",
              letterSpacing:".1em",fontFamily:"monospace"}}>
              LOADING YOUR INTELLIGENCE
            </div>
            <style>{`
              @keyframes shimmer{
                0%{transform:translateX(-200%)}
                100%{transform:translateX(500%)}
              }
            `}</style>
          </div>
        )}

        {/* ── NOT LOGGED IN — show landing page first, not auth screen ──────
            Correct flow:
              New visitor      → Landing → clicks "Begin" → AuthScreen → Dashboard
              Returning logged-out → Landing → clicks "Sign in" → AuthScreen → Dashboard
            The auth screen should never appear before the landing page.
        ──────────────────────────────────────────────────────────────────── */}
        {!authLoading&&!user&&(
          <>
            {/* Show auth screen only when user explicitly clicked to begin/sign in */}
            {emailConfirmPending
              ? <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
                  justifyContent:"center",background:"#0a0800",padding:"0 24px",textAlign:"center",
                  fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
                  <div style={{fontSize:48,marginBottom:20}}>📬</div>
                  <h2 style={{fontSize:"clamp(16px,4.5vw,24px)",fontWeight:800,color:"#e8dcc8",margin:"0 0 12px"}}>Check your inbox</h2>
                  <p style={{fontSize:14,color:"rgba(232,220,200,0.5)",maxWidth:340,lineHeight:1.7,margin:"0 0 28px"}}>
                    We sent a confirmation link to your email. Click it to activate your account and start your journey.
                  </p>
                  <button onClick={()=>{setEmailConfirmPending(false);setScreen("auth");}}
                    style={{background:"none",border:"1px solid rgba(232,220,200,0.15)",borderRadius:10,
                      padding:"10px 24px",color:"rgba(232,220,200,0.5)",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>
                    ← Back to sign in
                  </button>
                </div>
              : screen==="auth"
              ? <AuthScreen onAuth={async(u)=>{
                    if(u.isNew) triggerWelcomeEmail(u);
                    await restoreUserSession({
                      id:u.id,email:u.email,phone:u.phone,
                      user_metadata:{name:u.name,full_name:u.name},
                      app_metadata:{provider:u.provider},
                    });
                  }}
                  onBack={()=>setScreen("landing")}
                />
              : <>
                  {/* Public nav for unauthenticated state */}
                  <nav className="nav" style={{display:["landing","results","intake","loading","complete-profile"].includes(screen)?"none":"flex"}}>
                    <div className="logo" onClick={()=>setScreen("landing")}>Destin<b>IQ</b></div>
                    <div className="nav-r">
                      <button className="btn btn-ghost" style={{fontSize:12,padding:"8px 18px"}} onClick={()=>setScreen("auth")}>Sign in</button>
                      <button className="btn btn-gold" style={{fontSize:12,padding:"8px 18px"}} onClick={()=>setScreen("auth")}>Get started free →</button>
                    </div>
                  </nav>
                  {showAbout &&<AboutUsPage onBack={()=>setShowAbout(false)}/>}
      {showTutorial&&<OnboardingTutorial onDone={()=>setShowTutorial(false)}/>}
      {showPolicy&&<PolicyPage type={showPolicy} onBack={()=>setShowPolicy(null)}/>}
                  {!showPolicy&&<Landing onStart={()=>setScreen("auth")} ipLocation={ipLocation}/>}
                </>
            }
          </>
        )}

        {/* ── LOGGED IN ─────────────────────────────────────────────────────── */}
        {!authLoading&&user&&(
          <>
        {/* Show skeleton while loading saved profile from DB */}
        {profileLoading&&<LoadingSkeleton/>}
        {!profileLoading&&<>

        <SupportWidget/>
        <nav className="nav" style={{display:["results","intake","loading","complete-profile"].includes(screen)?"none":"flex"}}>
          <div className="logo" onClick={()=>{
            if(report) setScreen("results");
            else setScreen("intake");
          }}>Destin<b>IQ</b></div>
          <div className="nav-r">
            <div className={`prem-toggle ${isPaid&&isPremium?"":"off"}`} onClick={()=>{if(!isPaid){setScreen("paywall");}}} title={isPaid?"Premium":"Upgrade to Premium"}>
              <div className="prem-toggle-dot"/>
              <span className="prem-toggle-label">{isPaid&&isPremium?"PREMIUM":"UPGRADE"}</span>
            </div>
            <button onClick={()=>setShowProfile(true)} style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),var(--teal))",border:"2px solid var(--line-gold)",padding:0,cursor:"pointer",fontSize:13,fontWeight:700,color:"#000",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}} title="Profile">
              {navPhotoURL
                ?<img src={navPhotoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                :(user.name||user.email||"U")[0].toUpperCase()
              }
            </button>
            {ADMIN_EMAILS.includes(user.email)&&<button className="btn btn-ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowAdmin(true)}>Admin</button>}
            {screen==="results"&&(
              <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setShowNotif(true)} title="Set daily notification">
                🔔
              </button>
            )}
            {/* Language selector — always visible */}
            <LanguageSelector lang={lang} onChange={(code)=>{
              setLang(code);
              try{localStorage.setItem("diq_lang",code);}catch{}
              document.documentElement.dir = ["ar","ur","fa"].includes(code)?"rtl":"ltr";
              document.documentElement.lang = code;
            }}/>

            {screen==="results"&&!isPaid&&<button className="btn btn-gold" style={{fontSize:12,padding:"8px 18px"}} onClick={handleUnlock}>Upgrade</button>}
            {screen==="results"&&isPaid&&<div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>}
            {screen==="results"&&report&&<button className="btn btn-ghost" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>setShowShare(true)}>Share 📤</button>}
            {screen!=="intake"&&screen!=="results"&&<button className="btn btn-ghost" style={{fontSize:12,padding:"8px 18px"}} onClick={()=>report?setScreen("results"):setScreen("intake")}>← Home</button>}
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
        {showProfile&&<ProfilePage user={user} formData={formData} isPaid={isPaid} isPremium={isPremium} isProMax={isProMax} streak={streak} lang={lang} onLangChange={(code)=>{setLang(code); try{localStorage.setItem("diq_lang",code);}catch{}}}
          onPhotoUpdate={(url)=>setNavPhotoURL(url)}
          onBack={()=>setShowProfile(false)}
          onSignOut={async()=>{
            // Set flag BEFORE signOut so onAuthStateChange knows this is explicit
            explicitSignOut.current = true;
            await supabase.auth.signOut();
            // Also clear state immediately in case onAuthStateChange fires slowly
            setUser(null);setUserId(null);setScreen("landing");setFormData(null);setReport(null);
            setIsPaid(false);setIsPremium(false);setNavPhotoURL(null);setStreak(1);
            setShowProfile(false);
            try{
              Object.keys(localStorage).forEach(k=>{
                if(k.startsWith("diq_")||k.startsWith("destiniq_")) localStorage.removeItem(k);
              });
            }catch{}
          }}
          onManageSubscription={()=>{setShowProfile(false);handleUnlock();}}/>}

        {/* Admin dashboard */}
        {showAdmin&&<AdminDashboard user={user} onBack={()=>setShowAdmin(false)}/>}

        {/* Share card modal */}

        {showShare&&report&&<ShareCard report={report} formData={formData} onClose={()=>setShowShare(false)}/>}

        {/* PWA Install Banner */}
        {showInstall&&screen==="results"&&!window?.Capacitor?.isNativePlatform?.()&&(
          <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",
            background:"#1a1400",border:"1px solid rgba(240,180,41,0.3)",borderRadius:16,
            padding:"14px 18px",display:"flex",alignItems:"center",gap:12,
            boxShadow:"0 8px 32px rgba(0,0,0,0.5)",zIndex:500,maxWidth:340,width:"calc(100% - 32px)"}}>
            <div style={{fontSize:28}}>📲</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"#e8dcc8",marginBottom:2}}>Install DestinIQ</div>
              <div style={{fontSize:11,color:"rgba(232,220,200,0.5)"}}>Add to home screen for quick access</div>
            </div>
            <button onClick={handleInstallApp}
              style={{background:"#f0b429",border:"none",borderRadius:8,padding:"7px 14px",
                fontSize:12,fontWeight:700,cursor:"pointer",color:"#000",fontFamily:"inherit",flexShrink:0}}>
              Install
            </button>
            <button onClick={()=>setShowInstall(false)}
              style={{background:"none",border:"none",color:"rgba(232,220,200,0.3)",cursor:"pointer",fontSize:18,padding:0,flexShrink:0}}>
              ×
            </button>
          </div>
        )}

        {showNotif&&(
          <NotificationPanel profile={formData||{name:""}} userId={userId} streak={streak||1} onClose={()=>setShowNotif(false)}/>
        )}
        {!showPolicy&&!showProfile&&!showAdmin&&<>

        {/* ── SCREEN ROUTER ─────────────────────────────────────────────────────
            RULE: setScreen is NEVER called here in render — only in effects and
            event handlers. Calling setState during render causes loops and flicker.
            restoreUserSession is the single source of routing truth on load/refresh.
            The useEffect below handles any edge-case redirects safely.
        ──────────────────────────────────────────────────────────────────────── */}
        {/* landing screen for logged-in users — shows only for the brief moment
            before restoreUserSession runs and sets the correct screen.
            Shows a spinner rather than a blank page. */}
        {screen==="landing"  &&(
          <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:36,height:36,border:"3px solid var(--cream-10)",borderTop:"3px solid var(--gold)",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
          </div>
        )}
        {screen==="intake"            &&<Intake onSubmit={handleSubmit} savedFormData={formData} ipLocation={ipLocation}/>}
        {screen==="complete-profile"&&<CompleteProfile savedFormData={formData} onSubmit={handleSubmit}/>}
        {screen==="loading"  &&<Loading/>}
        {screen==="paywall"  &&<Paywall onUnlock={handlePay} teaser={report?.teaser||""} userEmail={user?.email||""} userId={userId} ipLocation={ipLocation}/>}
        {screen==="results"  &&formData&&report&&(
          <Dashboard data={report} formData={formData} isPaid={isPaid} onUnlock={handleUnlock}
              streak={streak} showCheckin={showCI} setShowCheckin={setShowCI} userId={userId} isPremium={isPremium} isProMax={isProMax} ipLocation={ipLocation}
              lang={lang} showTracker={showTracker} setShowTracker={setShowTracker}
              navPhotoURL={navPhotoURL} userName={user?.name||formData?.name||"U"}/>
        )}
        {screen==="results"  &&formData&&!report&&(
          <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"var(--f-mono)",fontSize:12,color:"var(--cream-30)",letterSpacing:".1em",marginBottom:16}}>Loading your report…</div>
              <div style={{width:40,height:40,border:"3px solid var(--cream-10)",borderTop:"3px solid var(--gold)",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto"}}/>
            </div>
          </div>
        )}
        {screen==="results"  &&!formData&&(
          <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontFamily:"var(--f-mono)",fontSize:12,color:"var(--cream-30)"}}>Restoring your session…</div>
          </div>
        )}


        {showTracker&&(
          <HabitTrackerPanel userId={userId} onClose={()=>setShowTracker(false)}/>
        )}
        {showEditProfile&&<EditProfileModal
          formData={formData}
          userId={userId}
          onClose={()=>setShowEditProfile(false)}
          onSave={(updatedFormData, shouldRegen)=>{
            setFormData(updatedFormData);
            setShowEditProfile(false);
            if(shouldRegen){
              // Trigger report re-generation with updated profile
              setScreen("loading");
              setTimeout(()=>{
                // handleSubmit will re-generate report with new formData
                // We call it with the updated form data
                handleSubmit(updatedFormData);
              }, 100);
            }
          }}
        />}
        </>}

        </>}
          </>
        )}
      </div>
    </>
    </ErrorBoundary>
  );
}

