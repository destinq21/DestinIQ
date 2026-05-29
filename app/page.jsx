"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY & DAILY STORES
// ═══════════════════════════════════════════════════════════════════════════════
const _memoryStore   = new Map(); // userId -> Message[]
const _momentumLog   = new Map(); // userId -> [{date,energy,focus,momentum,feeling,note}]
const _weeklyReports = new Map(); // userId -> [{weekOf,text,ts}]
const _decisions     = new Map(); // userId -> [{id,question,framework,date}]
const _notifTimers   = new Map(); // userId -> timeoutId

function genUserId() { return "u_" + Date.now().toString(36) + Math.random().toString(36).substr(2,6); }
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
}
function getDecisions(uid) { return _decisions.get(uid)||[]; }
function addDecision(uid,decision) {
  const d=getDecisions(uid); d.unshift(decision);
  if(d.length>10) d.splice(10); _decisions.set(uid,d);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM
// Browser Notifications API. Works in deployed Next.js.
// For true background push (app closed): add service worker + Web Push + VAPID keys.
// ═══════════════════════════════════════════════════════════════════════════════
const NOTIF_MSGS = [
  (n)=>`${n}, your daily intelligence is ready. 30 seconds to stay on track.`,
  (n)=>`How's today shaping up, ${n}? Log your momentum now.`,
  (n)=>`Your streak is waiting. Check in before the day slips away.`,
  ()=>`DestinIQ: One question. One insight. Today's check-in is open.`,
  (n)=>`${n} — what did you move forward today? Log it now.`,
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
.fu{animation:fadeUp .5s ease both;}
.fu1{opacity:0;animation:fadeUp .5s .08s ease both;}
.fu2{opacity:0;animation:fadeUp .5s .16s ease both;}
.fu3{opacity:0;animation:fadeUp .5s .24s ease both;}
.fu4{opacity:0;animation:fadeUp .5s .32s ease both;}
.msg-in{animation:msgIn .3s ease both;}
@media(max-width:600px){.nav{padding:0 16px;}.card{padding:18px;}.cx,.cx-sm,.cx-md{padding:0 16px;}}
`;


// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const FEELINGS=["Motivated","Anxious","Stuck","Focused","Overwhelmed","Hopeful","Drained","Confident","Uncertain","Restless"];
const PILLARS=[
  {id:"life",      label:"Life Direction", color:"#d2af5a"},
  {id:"wealth",    label:"Financial Path", color:"#1fa89a"},
  {id:"mindset",   label:"Mindset",        color:"#9b72cf"},
  {id:"relations", label:"Relationships",  color:"#c4645a"},
];
const MODULES=[
  {id:"today",    icon:"◎", label:"Today"},
  {id:"momentum", icon:"⚡", label:"Momentum"},
  {id:"decisions",icon:"◈", label:"Decisions"},
  {id:"weekly",   icon:"↗", label:"Weekly"},
  {id:"roadmap",  icon:"⟶", label:"Roadmap"},
  {id:"mindset",  icon:"◇", label:"Mindset"},
  {id:"career",   icon:"◈", label:"Career"},
  {id:"relocate", icon:"✦", label:"Relocate"},
  {id:"advisor",  icon:"⬡", label:"Advisor"},
];
const LOADING_PHRASES=["Reading your profile…","Mapping your patterns…","Building your framework…","Generating opportunities…","Compiling your roadmap…","Preparing your report…"];

function sanitize(s){
  if(typeof s!=="string") return "";
  return s.replace(/<[^>]*>/g,"").replace(/[^\w\s.,!?'"()\-:;@#%+=/]/g,"").slice(0,2000).trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════
async function callAPI({messages,system,userId,isPremium}){
  if(!messages?.length||!system) throw new Error("Invalid payload");
 const res = await fetch("/api/analyze", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    messages,
    system,
    userId,
    isPremium
  }),
});
  if(res.status===401) throw new Error("API_KEY_MISSING");
  if(res.status===429) throw new Error("RATE_LIMITED");
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||`API ${res.status}`);}
  const d=await res.json();
  const text=d.content?.find(b=>b.type==="text")?.text||"";
  if(!text) throw new Error("Empty response");
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════
function buildAnalysisPrompt(f,isPremium,memCtx){
  const tier=isPremium?"PREMIUM: Deeply structured, strategically dense. Multiple concrete action steps. No simplification.":"FREE: Clear useful insights, concise. Tease depth without fully delivering.";
  return `You are DestinIQ's core intelligence engine. Analyse this person and return a detailed JSON life report. Every word must be specific to their inputs. Never use generic template language.\n\n${tier}${memCtx}\n\nPROFILE: Name=${sanitize(f.name)}, Age=${f.age}, Gender=${f.gender||"N/A"}, Country=${sanitize(f.country)}, Relationship=${f.relationship||"N/A"}, Income=${f.income||"N/A"}, Education=${f.education||"N/A"}, Career=${sanitize(f.career)}, Skills=${sanitize(f.skills)||"N/A"}, Habits=${sanitize(f.habits)||"N/A"}, Goals=${sanitize(f.goals)}, Challenge=${sanitize(f.challenge)}\n\nReturn ONLY valid JSON (no markdown, no code fences):\n{"greeting":"One sharp specific warm sentence for ${f.name}","teaser":"One intriguing sentence hinting at a hidden pattern","scores":{"life":0,"wealth":0,"mindset":0,"relations":0},"overall":0,"headline":"2 sharp sentences specific to their age country goals","daily_insight":"Personalised insight referencing their challenge. 2-3 sentences.","roadmap":[{"phase":"0–90 Days","title":"","desc":"3-4 sentences specific to country income skills","win":"One action this week"},{"phase":"3–12 Months","title":"","desc":"","win":""},{"phase":"1–3 Years","title":"","desc":"","win":""},{"phase":"3–5 Years","title":"","desc":"","win":""}],"mindset":{"pattern":"The one mindset block holding them back","reframe":"A precise cognitive reframe","practice":"One daily practice","emotional":"2-3 sentences on emotional dynamic"},"career":[{"title":"","desc":"","effort":"low|medium|high","timeline":"","income":"","type":"job|business|freelance"},{"title":"","desc":"","effort":"","timeline":"","income":"","type":""},{"title":"","desc":"","effort":"","timeline":"","income":"","type":""}],"relocation":[{"country":"","fit":0,"why":"2 sentences","opportunity":0,"cost":"low|medium|high","visa":"easy|moderate|complex"},{"country":"","fit":0,"why":"","opportunity":0,"cost":"","visa":""},{"country":"","fit":0,"why":"","opportunity":0,"cost":"","visa":""}],"risks":["","",""],"strengths":["","",""],"closing":"One line only ${f.name} would screenshot"}`;
}

function buildWeeklyPrompt(profile,log,isPremium,memCtx){
  const logSummary=log.slice(-7).map(e=>`${e.date}: energy=${e.energy}, focus=${e.focus}, momentum=${e.momentum}, feeling=${e.feeling}${e.note?`, note="${e.note}"`:""}`).join("\n");
  const tier=isPremium?"Rich multi-layered analysis with strategic recommendations. 4-5 paragraphs.":"Focused 2-3 paragraph summary with key takeaways.";
  return `You are DestinIQ's weekly pattern analyst for ${sanitize(profile.name)}.\n\n${tier}${memCtx}\n\nProfile: Country=${sanitize(profile.country)}, Goals="${sanitize(profile.goals)}", Challenge="${sanitize(profile.challenge)}"\n\nLast 7 days of momentum data:\n${logSummary}\n\nAnalyse the patterns. Identify: 1. The dominant energy/emotional pattern this week. 2. What the numbers reveal about progress vs goals. 3. One specific behavioural pattern detected. 4. The single most important shift for next week. 5. A motivating close referencing their specific situation. Never be generic. Start directly with insight.`;
}

function buildDecisionPrompt(profile,question,isPremium,memCtx){
  const tier=isPremium?"Deeply structured framework with multiple lenses, trade-offs, and concrete recommendation. Premium depth.":"Clear framework. 3 key considerations + recommendation.";
  return `You are DestinIQ's decision advisor for ${sanitize(profile.name)}.\n\n${tier}${memCtx}\n\nProfile: Country=${sanitize(profile.country)}, Age=${profile.age}, Goals="${sanitize(profile.goals)}", Challenge="${sanitize(profile.challenge)}"\n\nDecision: "${sanitize(question)}"\n\nGive a structured framework. Consider the real costs and benefits, what someone in their specific situation should weigh most, and give a clear recommendation with reasoning. Be direct. No fluff. Start with the most important consideration.`;
}

function buildCheckinPrompt(profile,entry,reportData,isPremium,memCtx){
  const tier=isPremium?"Rich 3-4 paragraph response. Connect today to their long-term arc.":"Sharp 2 paragraph response.";
  return `You are DestinIQ's daily advisor for ${sanitize(profile.name)}. They checked in today.\n${tier} Never generic. Reference challenge: "${sanitize(profile.challenge)}" and goal: "${sanitize(profile.goals)}".\nToday: Score=${entry.score}/10. Feeling=${entry.feeling}. Did="${sanitize(entry.did)}". Avoided="${sanitize(entry.avoided)}".${memCtx}\nStart directly with insight. No pleasantries. You are their advisor.`;
}

function buildAdvisorSystem(profile,reportData,isPremium,memCtx){
  const tier=isPremium?"PREMIUM: Deep structured multi-layered responses. Specific action steps and frameworks. 3-4 paragraphs.":"FREE: Useful concise 2-paragraph responses.";
  return `You are DestinIQ's personal advisor for ${sanitize(profile.name)}. You have their full life report.\n${tier}\nSituation: country=${sanitize(profile.country)}, age=${profile.age}, goals="${sanitize(profile.goals)}", challenge="${sanitize(profile.challenge)}". Scores: life=${reportData?.scores?.life||70}, wealth=${reportData?.scores?.wealth||60}, mindset=${reportData?.scores?.mindset||65}.${memCtx}\nNever say "AI" or "system". End every response with one sharp question or action prompt.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════
function fallback(f){
  const age=parseInt(f.age)||26;
  const iScore={"Under $500":22,"$500–$1,500":38,"$1,500–$4,000":58,"$4,000–$10,000":74,"$10,000+":88}[f.income]||50;
  return{
    greeting:`${f.name}, your profile maps a person standing at a real threshold — the kind where clarity in the next 90 days changes the next 10 years.`,
    teaser:`There is a specific pattern in how you describe your challenge that almost always precedes a major breakthrough — but only when one precise thing changes first.`,
    scores:{life:Math.min(85,50+(age<30?8:4)),wealth:Math.min(85,iScore),mindset:64,relations:70},
    overall:Math.round((50+iScore+64+70)/4),
    headline:`At ${age} in ${f.country}, you are in a compounding window. The choices made in the next 12 months will determine your trajectory for the decade that follows.`,
    daily_insight:`Today's most important move is not the biggest one. Your challenge around "${(f.challenge||"").split(" ").slice(0,6).join(" ")}…" is a sequencing problem, not a resources problem.`,
    roadmap:[
      {phase:"0–90 Days",title:"Foundation & Momentum",desc:`Eliminate the friction points making everything harder. In ${f.country}, establish one income-generating habit before adding complexity.`,win:"Identify the one action you've been postponing and do the first 15 minutes of it today."},
      {phase:"3–12 Months",title:"Skill Into Income",desc:`Your skills — ${f.skills||"what you currently know"} — have market value you're likely underpricing.`,win:"Research what people with your skills earn in three different markets."},
      {phase:"1–3 Years",title:"Systems Over Hustle",desc:"Build systems that make your progress automatic rather than dependent on willpower.",win:"Document one repeatable process in your life every month."},
      {phase:"3–5 Years",title:"Optionality & Legacy",desc:"Operate from genuine choice — where decisions come from strength, not pressure.",win:"Define financial freedom with a specific number and date."},
    ],
    mindset:{pattern:"Waiting for ideal conditions before committing fully — keeps you in a permanent holding pattern.",reframe:"The conditions you're waiting for don't arrive before the decision. They arrive because of it.",practice:"Write one honest sentence each morning: 'The thing I am actually avoiding today is ___.'",emotional:"The dominant tension is between who you know you can become and where you currently are. This gap is the engine."},
    career:[
      {title:"Remote Consulting in Your Domain",desc:`Positioning your expertise as a service for international clients from ${f.country} is the highest-leverage near-term move.`,effort:"medium",timeline:"1–3 months",income:"2–5× local average",type:"freelance"},
      {title:"Remote Professional Employment",desc:"Targeting companies in higher-currency markets creates significant income arbitrage.",effort:"medium",timeline:"2–5 months",income:"3–8× local salary",type:"job"},
      {title:"Knowledge-Based Business",desc:"Package your perspective modestly at first — creates an asset that scales independently of your time.",effort:"high",timeline:"6–12 months",income:"Scalable, uncapped",type:"business"},
    ],
    relocation:[
      {country:"United Arab Emirates",fit:84,why:"Zero income tax and genuine infrastructure for ambitious professionals.",opportunity:90,cost:"high",visa:"moderate"},
      {country:"Portugal",fit:76,why:"Growing international community and accessible visa pathways.",opportunity:72,cost:"medium",visa:"moderate"},
      {country:"Canada",fit:70,why:"Structured immigration pathways and long-term stability.",opportunity:68,cost:"medium",visa:"complex"},
    ],
    risks:["Over-planning as a substitute for action","Underpricing your skills in early-stage opportunities","Neglecting recovery, which limits decision quality"],
    strengths:["Willingness to seek external perspective","Clear goals orientation that compounds with consistent action","Being at an age where every correction has decades of compounding ahead"],
    closing:"The version of your life you actually want is not behind a wall of circumstances — it's behind a wall of decisions you haven't made yet.",
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
        <div className="d3" style={{marginBottom:8,fontSize:"1.1em"}}>Premium Content</div>
        <p className="body" style={{maxWidth:320,marginBottom:20}}>Unlock your complete intelligence report.</p>
        <button className="btn btn-gold" onClick={onUnlock}>Unlock Full Report</button>
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
  const [,rerender]=useState(0);
  const avgOf=e=>e?Math.round((e.energy+e.focus+e.momentum)/3):0;
  const col=v=>v>=8?"var(--teal)":v>=5?"var(--gold)":"var(--rose)";

  const save=()=>{
    if(!feeling) return;
    addMomentumEntry(userId,{date:today,energy,focus,momentum,feeling,note,ts:Date.now()});
    setSaved(true);rerender(n=>n+1);
  };

  const last14=[];
  for(let i=13;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=d.toDateString();
    last14.push({label:d.toLocaleDateString("en",{weekday:"short"}).slice(0,2),entry:log.find(x=>x.date===ds),isToday:i===0});
  }

  const allAvg=log.length?Math.round(log.reduce((s,e)=>s+avgOf(e),0)/log.length):0;
  const trend=log.length>=2?avgOf(log[log.length-1])-avgOf(log[log.length-2]):0;

  return(
    <div className="fu">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
        <div>
          <div className="d3" style={{marginBottom:4}}>Daily Momentum</div>
          <p className="small">30 seconds. Honest numbers. Patterns that reveal everything.</p>
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

      <div className="card">
        <div className="mono" style={{marginBottom:18,fontSize:"9px"}}>{saved?"Today's Log — Come back tomorrow":"Log Today · "+new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"short"})}</div>
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
          {saved?"✓ Logged — see you tomorrow":"Log My Momentum →"}
        </button>
        {saved&&(
          <div className="insight teal" style={{marginTop:16,marginBottom:0}}>
            <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75}}>
              {avgOf({energy,focus,momentum})>=7
                ?`Strong reading, ${profile.name}. Your numbers show momentum — don't waste the window.`
                :`The numbers don't lie, ${profile.name}. Something is draining your capacity. Your Weekly Pulse will show you the pattern.`}
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
      const txt=await callAPI({messages:[{role:"user",content:buildWeeklyPrompt(profile,log,isPremium,buildMemoryContext(userId))}],system:"You are DestinIQ's weekly pattern analyst. Be direct, specific, insightful. Never generic.",userId,isPremium});
      const r={weekOf:weekLabel(),text:txt,ts:Date.now()};
      const existing=_weeklyReports.get(userId)||[];
      existing.unshift(r);if(existing.length>4)existing.pop();
      _weeklyReports.set(userId,existing);setReport(r);
      pushToMemory(userId,"assistant","Weekly pulse: "+txt.slice(0,300));
    }catch(e){setError(e.message==="API_KEY_MISSING"?"API key not configured.":"Couldn't generate your pulse. Try again.");}
    setLoading(false);
  };

  return(
    <LockGate isPaid={isPaid} onUnlock={onUnlock}>
      <div className="fu">
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
          <div><div className="d3" style={{marginBottom:4}}>Weekly Pulse</div><p className="small">AI reads your 7-day momentum log and surfaces the real pattern.</p></div>
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
            <div className="d3" style={{marginBottom:8}}>Generate Your Weekly Pulse</div>
            <p className="body" style={{maxWidth:380,margin:"0 auto 24px"}}>{log.length<3?`Log ${3-log.length} more day${3-log.length!==1?"s":""} to unlock your weekly analysis.`:"Your data is ready. Get your personalised weekly pattern analysis."}</p>
            <button className="btn btn-gold btn-lg" onClick={generate} disabled={loading||log.length<3}>{loading?"Analysing your week…":"Generate Weekly Pulse"}</button>
          </div>
        ):(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div className="mono" style={{fontSize:"9px"}}>Week of {report.weekOf}</div>
              <button className="btn btn-ghost btn-sm" onClick={generate} disabled={loading}>{loading?"Refreshing…":"↺ Refresh"}</button>
            </div>
            <div className="card" style={{background:"var(--lift)"}}>
              <div style={{fontSize:15,lineHeight:1.85,color:"var(--cream-60)",fontWeight:300,whiteSpace:"pre-wrap"}}>{report.text}</div>
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
  const [decisions,setDecisions]=useState(()=>getDecisions(userId));

  const submit=async()=>{
    if(!question.trim()||loading) return;
    setLoading(true);setError("");
    const q=sanitize(question.trim());
    pushToMemory(userId,"user","Decision: "+q);
    try{
      const fw=await callAPI({messages:[{role:"user",content:buildDecisionPrompt(profile,q,isPremium,buildMemoryContext(userId))}],system:"You are DestinIQ's decision framework advisor. Be direct, structured, specific. Never generic. Use clear paragraphs, not bullet walls.",userId,isPremium});
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
          <div><div className="d3" style={{marginBottom:4}}>Decision Inbox</div><p className="small">Drop any decision you're wrestling with. Get a personalised framework in seconds.</p></div>
          {isPremium&&<div className="prem-badge">✦ PREMIUM</div>}
        </div>

        <div className="card" style={{marginBottom:24}}>
          <div className="mono" style={{marginBottom:12,fontSize:"9px"}}>What decision are you facing?</div>
          <textarea className="ft" rows={3} maxLength={500}
            placeholder="e.g. Should I quit my job to go freelance? / Should I move to Dubai? / Should I take this business partnership?"
            value={question} onChange={e=>setQuestion(e.target.value)}/>
          <div style={{marginTop:12,display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
            <span className="small">{question.length}/500 · Be specific for better frameworks</span>
            <button className="btn btn-gold" onClick={submit} disabled={!question.trim()||loading||question.length<10}>{loading?"Building framework…":"Get Framework →"}</button>
          </div>
          {error&&<div className="err-box" style={{marginTop:12}}>⚠ {error}</div>}
        </div>

        {!decisions.length&&(
          <div style={{marginBottom:24}}>
            <div className="mono" style={{marginBottom:10,fontSize:"9px"}}>Quick starters</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {["Should I quit my job?","Should I start a business?","Should I relocate?","Should I invest in this?","Should I take this opportunity?"].map(q=>(
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
    new Notification("DestinIQ",{body:`${profile.name}, your daily intelligence is ready. 30 seconds to stay on track.`,tag:"destiniq-test"});
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
function Paywall({onUnlock,teaser}){
  const [sel,setSel]=useState("pro");
  const plans=[
    {id:"basic",price:"$9",period:"/month",name:"Essential",color:"var(--teal)",
     features:["Full life analysis report","Daily momentum tracker","Check-in & daily insight","Roadmap access"]},
    {id:"pro",price:"$15",period:"/month",name:"Premium",color:"var(--gold)",featured:true,
     features:["Everything in Essential","Weekly Pulse AI report","Decision Inbox (unlimited)","Live advisor conversations","Career & relocation intel","Streak tracking & history"]},
    {id:"annual",price:"$99",period:"/year",name:"Annual Pro",color:"var(--violet)",
     features:["Everything in Premium","Save $81 vs monthly","Downloadable PDF reports","Early access to new modules"]},
  ];
  return(
    <div style={{padding:"60px 0"}}>
      <div className="cx-sm" style={{textAlign:"center"}}>
        <div className="mono fu" style={{marginBottom:16}}>Your Report Is Ready</div>
        <h2 className="d2 fu1" style={{marginBottom:16}}>Unlock what's waiting for you</h2>
        <div className="fu2" style={{margin:"0 auto 36px",maxWidth:480}}>
          <div className="insight violet" style={{textAlign:"left"}}>
            <div className="mono" style={{marginBottom:6,fontSize:"9px"}}>Detected in your profile</div>
            <p style={{fontSize:15,color:"var(--cream-60)",fontStyle:"italic",lineHeight:1.75}}>"{teaser}"</p>
            <p style={{fontSize:12,color:"var(--cream-30)",marginTop:8}}>Unlock your full report to understand what this means for your next move.</p>
          </div>
        </div>
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
        <div className="fu4">
          <button className="btn btn-gold btn-lg btn-full" style={{maxWidth:360,margin:"0 auto",display:"flex"}} onClick={onUnlock}>Unlock Full Report</button>
          <p style={{marginTop:12,fontSize:11,color:"var(--cream-30)",fontFamily:"var(--f-mono)",letterSpacing:".1em"}}>SECURED PAYMENT · CANCEL ANYTIME</p>
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
      const reply=await callAPI({messages:[{role:"user",content:buildCheckinPrompt(profile,entry,reportData,isPremium,memCtx)}],system:"You are DestinIQ's personal advisor. Be direct, warm, specific. Never mention being an AI.",userId,isPremium});
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
        <div className="tag tt">Check-in complete</div>
      </div>
      <div className="d3" style={{marginBottom:20}}>Today's insight</div>
      <div style={{fontSize:15,lineHeight:1.85,color:"var(--cream-60)",fontWeight:300,whiteSpace:"pre-wrap"}}>{result}</div>
      <div style={{marginTop:24}}><button className="btn btn-ghost" onClick={onComplete}>Back to dashboard</button></div>
    </div>
  );

  return(
    <div className="fu">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>
        <div className="mono" style={{fontSize:"9px"}}>Daily Check-In</div>
      </div>
      <h3 className="d3" style={{marginBottom:6}}>How is today going, {profile.name}?</h3>
      <p className="body" style={{marginBottom:24}}>Honest answers produce the most useful insights.</p>
      <div className="field"><label className="fl">How are you feeling right now?</label>
        <div className="feeling-grid">{FEELINGS.map(f=><button key={f} className={`feeling-pill ${feeling===f?"sel":""}`} onClick={()=>setFeeling(f)}>{f}</button>)}</div>
      </div>
      <div className="field"><label className="fl">Rate your day so far — 1 to 10</label>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <input type="range" min={1} max={10} value={score} onChange={e=>setScore(+e.target.value)} style={{flex:1,accentColor:"var(--gold)"}}/>
          <span style={{fontFamily:"var(--f-display)",fontSize:24,color:"var(--gold)",minWidth:28}}>{score}</span>
        </div>
      </div>
      <div className="field"><label className="fl">Most important thing you did today?</label><textarea className="ft" rows={2} placeholder="Even something small counts…" value={did} onChange={e=>setDid(e.target.value)}/></div>
      <div className="field"><label className="fl">What did you avoid or postpone?</label><textarea className="ft" rows={2} placeholder="Be honest — this is private…" value={avoided} onChange={e=>setAvoided(e.target.value)}/></div>
      {error&&<div className="err-box">⚠ {error}</div>}
      <button className="btn btn-gold btn-full" onClick={submit} disabled={!feeling||!did.trim()||loading} style={{marginTop:8}}>{loading?"Reading your day…":"Get Today's Insight →"}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVISOR CHAT
// ═══════════════════════════════════════════════════════════════════════════════
function AdvisorChat({profile,reportData,userId,isPremium}){
  const [msgs,setMsgs]=useState([{role:"assistant",content:`${profile.name}, I have your full report in front of me. What would you like to go deeper on — your roadmap, career, mindset, relocation, or something else entirely?`}]);
  const [input,setInput]=useState("");const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const scrollRef=useRef(null);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[msgs,loading]);

  const send=async()=>{
    if(!input.trim()||loading) return;
    const msg=sanitize(input.trim());setInput("");setError("");
    const updated=[...msgs,{role:"user",content:msg}];setMsgs(updated);setLoading(true);
    pushToMemory(userId,"user",msg);
    try{
      const reply=await callAPI({messages:updated.map(m=>({role:m.role,content:m.content})),system:buildAdvisorSystem(profile,reportData,isPremium,buildMemoryContext(userId)),userId,isPremium});
      pushToMemory(userId,"assistant",reply);setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch(e){
      if(e.message==="API_KEY_MISSING"){setError("API key not configured.");}
      else setMsgs(p=>[...p,{role:"assistant",content:"I lost the connection. Try again — I'm still here."}]);
    }
    setLoading(false);
  };

  const QUICK=["What should I do first?","How do I fix my mindset?","Is relocation right for me?","How do I make more money?"];
  return(
    <div className="fu">
      <div style={{marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div><div className="mono" style={{marginBottom:4}}>Live Advisor</div><p className="small">Memory-enabled. Responses evolve as the conversation grows.</p></div>
        {isPremium&&<div className="prem-badge">✦ PREMIUM — Unlimited</div>}
      </div>
      <div className="card">
        <div className="chat-scroll" ref={scrollRef}>
          {msgs.map((m,i)=>(
            <div key={i} className={`chat-msg msg-in ${m.role==="user"?"me":""}`}>
              <div className={`av ${m.role==="user"?"av-u":"av-d"}`}>{m.role==="user"?profile.name[0]?.toUpperCase():"IQ"}</div>
              <div className={`bubble ${m.role==="user"?"bubble-u":"bubble-d"}`} style={{whiteSpace:"pre-wrap"}}>{m.content}</div>
            </div>
          ))}
          {loading&&<div className="chat-msg msg-in"><div className="av av-d">IQ</div><div className="bubble bubble-d"><div className="typing-dot"><span/><span/><span/></div></div></div>}
        </div>
        {error&&<div className="err-box" style={{marginTop:10}}>⚠ {error}</div>}
        <div className="chat-in-row">
          <input className="chat-in" placeholder="Ask your advisor…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} maxLength={1000}/>
          <button className="chat-send" onClick={send} disabled={loading||!input.trim()}>→</button>
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>
        {QUICK.map(q=><button key={q} className="btn-text" style={{border:"1px solid var(--line)",borderRadius:6,padding:"5px 10px",fontSize:11}} onClick={()=>setInput(q)}>{q}</button>)}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// LANDING
// ═══════════════════════════════════════════════════════════════════════════════
function Landing({onStart}){
  return(
    <div style={{paddingTop:60}}>
      <section style={{minHeight:"92vh",display:"flex",alignItems:"center",borderBottom:"1px solid var(--line)",padding:"80px 0"}}>
        <div className="cx" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}}>
          <div>
            <div className="mono fu" style={{marginBottom:20}}>Personal Intelligence · Global</div>
            <h1 className="d1 fu1" style={{marginBottom:28}}>The system<br/>that knows<br/><span className="em">your next move</span></h1>
            <p className="body-lg fu2" style={{marginBottom:36,maxWidth:420}}>DestinIQ analyses your complete life profile and delivers a daily intelligence layer — covering direction, finances, mindset, career, and your global options.</p>
            <div className="fu3" style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <button className="btn btn-gold btn-lg" onClick={onStart}>Begin Your Analysis</button>
              <span className="small">Free to start · Results in 60 seconds</span>
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
          <div className="fu2" style={{position:"relative"}}>
            <div style={{position:"absolute",inset:-1,borderRadius:20,background:"linear-gradient(135deg,rgba(31,168,154,.15),rgba(210,175,90,.1))",zIndex:-1,filter:"blur(20px)"}}/>
            <div className="card" style={{borderColor:"var(--line-gold)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                <div><div className="mono" style={{marginBottom:4}}>Life Score</div><div className="d3">Overview</div></div>
                <div className="streak-badge"><span className="streak-fire">🔥</span>12 day streak</div>
              </div>
              <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:16}}>
                {PILLARS.map(p=><Ring key={p.id} score={{life:74,wealth:61,mindset:68,relations:77}[p.id]} color={p.color} size={80} label={p.label.split(" ")[0]}/>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
                {[{l:"Energy",v:8,c:"var(--teal)"},{l:"Focus",v:7,c:"var(--gold)"},{l:"Momentum",v:6,c:"var(--violet)"}].map(s=>(
                  <div key={s.l} style={{textAlign:"center",background:"var(--lift)",borderRadius:8,padding:"8px"}}>
                    <div style={{fontFamily:"var(--f-display)",fontSize:20,color:s.c}}>{s.v}</div>
                    <div className="mono" style={{fontSize:"8px"}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="insight" style={{margin:0}}>
                <div className="mono" style={{marginBottom:6,fontSize:"9px"}}>Today's Insight</div>
                <p style={{fontSize:13,color:"var(--cream-60)",fontStyle:"italic",lineHeight:1.7}}>"The pattern you keep calling a motivation problem is actually a clarity problem."</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{padding:"80px 0",borderBottom:"1px solid var(--line)",background:"rgba(210,175,90,0.02)"}}>
        <div className="cx-md" style={{textAlign:"center"}}>
          <div className="mono fu" style={{marginBottom:16}}>Why People Come Back Every Day</div>
          <h2 className="d2 fu1" style={{marginBottom:16}}>Built for<br/><span className="em">daily dependency</span></h2>
          <p className="body-lg fu2" style={{maxWidth:520,margin:"0 auto 48px"}}>Every feature keeps getting more useful the more you use it. That's the design.</p>
          <div className="fu3" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
            {[
              {icon:"⚡",title:"Daily Momentum Tracker",desc:"30 seconds to log your energy, focus, and momentum. Watch your patterns emerge over 14 days."},
              {icon:"↗",title:"Weekly Pulse Report",desc:"AI reads your 7-day data and surfaces the pattern you can't see yourself. Every week."},
              {icon:"◈",title:"Decision Inbox",desc:"Drop any decision you're wrestling with. Get a personalised framework in seconds."},
              {icon:"🔔",title:"Daily Notifications",desc:"A gentle nudge at your chosen time. Never miss a check-in. Never lose your streak."},
              {icon:"◎",title:"Life Intelligence Report",desc:"Your complete profile analysed across money, career, mindset, relationships, and global options."},
              {icon:"⬡",title:"Live Advisor",desc:"Memory-enabled conversations that get smarter every session. Your personal strategist."},
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

      <section style={{padding:"56px 0",borderBottom:"1px solid var(--line)"}}>
        <div className="cx">
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
            {[
              {quote:"I've tried journaling apps, coaching apps, everything. DestinIQ is the first thing that felt like it actually understood my specific situation.",name:"Amara, 27 · Ghana"},
              {quote:"The career section alone was worth it. Found a remote role paying 4× what I earned locally within 3 months.",name:"Rafael, 31 · Brazil"},
              {quote:"The daily check-in has genuinely changed how I think about progress. I haven't missed a day in 6 weeks.",name:"Priya, 24 · India"},
            ].map((t,i)=>(
              <div key={i} className="card">
                <p style={{fontSize:14,lineHeight:1.8,color:"var(--cream-60)",fontStyle:"italic",marginBottom:14}}>"{t.quote}"</p>
                <div className="mono" style={{fontSize:"9px"}}>{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{padding:"80px 0",textAlign:"center"}}>
        <div className="cx-sm">
          <div className="mono fu" style={{marginBottom:16}}>Start Free · No Card Required</div>
          <h2 className="d2 fu1" style={{marginBottom:20}}>Your report takes 60 seconds to generate</h2>
          <button className="btn btn-gold btn-lg fu2" onClick={onStart}>Begin Your Analysis</button>
        </div>
      </section>
      <div className="disc">DestinIQ is a personal development intelligence platform. All insights are frameworks for reflection — not medical, financial, or legal advice.</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTAKE
// ═══════════════════════════════════════════════════════════════════════════════
function Intake({onSubmit}){
  const [step,setStep]=useState(1);
  const [f,setF]=useState({name:"",age:"",gender:"",country:"",relationship:"",income:"",education:"",career:"",skills:"",habits:"",goals:"",challenge:""});
  const [err,setErr]=useState("");
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const validate=()=>{
    if(step===1&&(!f.name.trim()||!f.age||!f.country.trim())) return"Please fill in your name, age, and country.";
    if(step===1&&(parseInt(f.age)<13||parseInt(f.age)>99)) return"Please enter a valid age.";
    if(step===2&&!f.career.trim()) return"Please describe your current situation.";
    if(step===3&&(!f.goals.trim()||!f.challenge.trim())) return"Please describe your goals and your biggest challenge.";
    return"";
  };
  const next=()=>{const e=validate();if(e){setErr(e);return;}setErr("");step<3?setStep(s=>s+1):onSubmit(f);};
  return(
    <div style={{paddingTop:60,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"100px 24px 60px"}}>
      <div style={{width:"100%",maxWidth:600}}>
        <div style={{marginBottom:32,textAlign:"center"}}>
          <div className="mono fu" style={{marginBottom:8}}>Step {step} of 3</div>
          <h2 className="d3 fu1" style={{marginBottom:6}}>{step===1?"Your Profile":step===2?"Your Work & Skills":"Your Goals & Challenge"}</h2>
          <p className="small fu2" style={{marginBottom:20}}>{step===1?"The more precise you are, the more specific your report will be.":step===2?"Tell us where you are professionally right now.":"This section determines how personal your report becomes."}</p>
          <div className="pbar"><div className="pfill" style={{width:`${(step/3)*100}%`}}/></div>
        </div>
        <div className="card fu2">
          {step===1&&<>
            <div className="row2">
              <div className="field"><label className="fl">Full Name</label><input className="fi" placeholder="Your name" value={f.name} onChange={e=>set("name",e.target.value)} maxLength={60}/></div>
              <div className="field"><label className="fl">Age</label><input className="fi" type="number" min="13" max="99" placeholder="e.g. 26" value={f.age} onChange={e=>set("age",e.target.value)}/></div>
            </div>
            <div className="row2">
              <div className="field"><label className="fl">Gender</label><select className="fs" value={f.gender} onChange={e=>set("gender",e.target.value)}><option value="">— Select —</option><option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option></select></div>
              <div className="field"><label className="fl">Country</label><input className="fi" placeholder="e.g. Ghana" value={f.country} onChange={e=>set("country",e.target.value)} maxLength={60}/></div>
            </div>
            <div className="row2">
              <div className="field"><label className="fl">Relationship Status</label><select className="fs" value={f.relationship} onChange={e=>set("relationship",e.target.value)}><option value="">— Select —</option><option>Single</option><option>In a relationship</option><option>Engaged</option><option>Married</option><option>Divorced</option></select></div>
              <div className="field"><label className="fl">Monthly Income</label><select className="fs" value={f.income} onChange={e=>set("income",e.target.value)}><option value="">— Select —</option><option>Under $500</option><option>$500–$1,500</option><option>$1,500–$4,000</option><option>$4,000–$10,000</option><option>$10,000+</option></select></div>
            </div>
            <div className="field"><label className="fl">Highest Education</label><select className="fs" value={f.education} onChange={e=>set("education",e.target.value)}><option value="">— Select —</option><option>High School</option><option>Some College</option><option>Bachelor's Degree</option><option>Master's Degree</option><option>Doctorate</option><option>Self-taught / Vocational</option></select></div>
          </>}
          {step===2&&<>
            <div className="field"><label className="fl">Current Work or Career Situation</label><textarea className="ft" rows={3} maxLength={800} placeholder="e.g. I work in sales, earning $700/month. Been there 2 years and feel stuck." value={f.career} onChange={e=>set("career",e.target.value)}/></div>
            <div className="field"><label className="fl">Your Skills & Strengths</label><textarea className="ft" rows={2} maxLength={500} placeholder="e.g. Social media, video editing, writing, coding basics…" value={f.skills} onChange={e=>set("skills",e.target.value)}/></div>
            <div className="field"><label className="fl">Daily Habits (Sleep, Exercise, Stress, Diet)</label><textarea className="ft" rows={2} maxLength={500} placeholder="e.g. 6 hours sleep, no gym, high stress, skip breakfast" value={f.habits} onChange={e=>set("habits",e.target.value)}/></div>
          </>}
          {step===3&&<>
            <div className="field"><label className="fl">What Do You Want Most From Life?</label><textarea className="ft" rows={3} maxLength={600} placeholder="e.g. Financial freedom, travel, start a business, move abroad…" value={f.goals} onChange={e=>set("goals",e.target.value)}/></div>
            <div className="field"><label className="fl">Your Biggest Challenge Right Now</label><textarea className="ft" rows={3} maxLength={600} placeholder="Be honest — the more specific you are, the better your report." value={f.challenge} onChange={e=>set("challenge",e.target.value)}/></div>
            <div className="insight teal"><p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75}}><strong style={{color:"var(--teal)"}}>This matters:</strong> The challenge field is the most analysed input in your entire report.</p></div>
          </>}
          {err&&<div className="err-box">⚠ {err}</div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
            {step>1?<button className="btn btn-ghost" onClick={()=>{setStep(s=>s-1);setErr("");}}>← Back</button>:<div/>}
            <button className="btn btn-gold" onClick={next}>{step<3?"Continue →":"Generate My Report"}</button>
          </div>
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
      <div className="mono fu" style={{marginBottom:24}}>DestinIQ Analysis Engine</div>
      <div className="d3 fu1" style={{marginBottom:12,fontWeight:300}}>Building your report</div>
      <p className="small fu2" style={{marginBottom:48}}>We reason carefully. This takes a few moments.</p>
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
function Dashboard({data,formData,isPaid,onUnlock,streak,showCheckin,setShowCheckin,userId,isPremium}){
  const [mod,setMod]=useState("today");
  const [aScores,setAScores]=useState({life:0,wealth:0,mindset:0,relations:0});
  useEffect(()=>{const t=setTimeout(()=>setAScores(data.scores||{}),100);return()=>clearTimeout(t);},[data]);

  return(
    <div style={{paddingTop:60}}>
      <div style={{padding:"40px 0 28px",borderBottom:"1px solid var(--line)",background:"rgba(210,175,90,0.02)"}}>
        <div className="cx-md">
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:28}}>
            <div>
              <div className="mono fu" style={{marginBottom:8}}>Your DestinIQ Report</div>
              <h1 className="d2 fu1" style={{marginBottom:8}}>{formData.name}</h1>
              <p className="body fu2" style={{fontStyle:"italic",maxWidth:500}}>&ldquo;{data.greeting}&rdquo;</p>
            </div>
            <div className="fu2" style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>
              {isPremium&&<div className="prem-badge">✦ PREMIUM</div>}
              {!showCheckin&&<button className="btn btn-outline-gold" onClick={()=>setShowCheckin(true)}>Daily Check-In</button>}
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
              <div className="d3" style={{marginBottom:20}}>Today's Intelligence</div>
              <div className="insight" style={{marginBottom:24}}>
                <div className="mono" style={{marginBottom:8,fontSize:"9px"}}>Personal Insight · {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div>
                <p className="body">{data.daily_insight}</p>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
                <div className="card card-sm"><div className="mono" style={{marginBottom:10,fontSize:"9px"}}>Your Strengths</div>
                  {data.strengths?.map((s,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:8,fontSize:13,color:"var(--cream-60)"}}><span style={{color:"var(--teal)",flexShrink:0}}>◎</span>{s}</div>)}</div>
                <div className="card card-sm"><div className="mono" style={{marginBottom:10,fontSize:"9px"}}>Key Risks</div>
                  {data.risks?.map((r,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:8,fontSize:13,color:"var(--cream-60)"}}><span style={{color:"var(--rose)",flexShrink:0}}>◇</span>{r}</div>)}</div>
              </div>
              <div style={{padding:"24px",background:"var(--raised)",border:"1px solid var(--line-gold)",borderRadius:16,textAlign:"center"}}>
                <div className="mono" style={{marginBottom:10,fontSize:"9px"}}>A Truth Worth Holding</div>
                <p style={{fontFamily:"var(--f-display)",fontSize:20,fontStyle:"italic",color:"var(--gold)",fontWeight:400,lineHeight:1.5}}>&ldquo;{data.closing}&rdquo;</p>
              </div>
              {!isPaid&&(
                <div style={{marginTop:24,padding:"20px 24px",background:"linear-gradient(135deg,rgba(210,175,90,0.08),rgba(31,168,154,0.05))",border:"1px solid var(--line-gold)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                  <div><div className="mono" style={{marginBottom:4,fontSize:"9px"}}>Detected in your profile</div><p style={{fontSize:14,fontStyle:"italic",color:"var(--cream-60)",lineHeight:1.7}}>"{data.teaser}"</p></div>
                  <button className="btn btn-gold" style={{flexShrink:0}} onClick={onUnlock}>Unlock Full Report</button>
                </div>
              )}
            </div>
          )}

          {mod==="momentum"&&<MomentumModule profile={formData} userId={userId} isPremium={isPremium} streak={streak}/>}
          {mod==="decisions"&&<DecisionModule profile={formData} userId={userId} isPremium={isPremium} isPaid={isPaid} onUnlock={onUnlock}/>}
          {mod==="weekly"&&<WeeklyModule profile={formData} userId={userId} isPremium={isPremium} isPaid={isPaid} onUnlock={onUnlock}/>}

          {mod==="roadmap"&&(
            <LockGate isPaid={isPaid} onUnlock={onUnlock}>
              <div className="fu">
                <div className="d3" style={{marginBottom:6}}>Your Transformation Roadmap</div>
                <p className="body" style={{marginBottom:28}}>A structured sequence built for your specific situation.</p>
                {data.roadmap?.map((r,i)=>(
                  <div className="timeline-item" key={i}>
                    <div className="t-dot">{String(i+1).padStart(2,"0")}</div>
                    <div className="t-body">
                      <div className="t-phase">{r.phase}</div><div className="t-title">{r.title}</div>
                      <p className="t-desc">{r.desc}</p>
                      {r.win&&<div className="t-win"><strong>This week:</strong> {r.win}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </LockGate>
          )}

          {mod==="mindset"&&(
            <LockGate isPaid={isPaid} onUnlock={onUnlock}>
              <div className="fu">
                <div className="d3" style={{marginBottom:20}}>Mindset & Emotional Intelligence</div>
                {[{icon:"◇",title:"The Pattern",key:"pattern",accent:"rose"},{icon:"↺",title:"The Reframe",key:"reframe",accent:"gold"},{icon:"◎",title:"The Emotional Layer",key:"emotional",accent:"violet"},{icon:"◈",title:"Your Daily Practice",key:"practice",accent:"teal"}].map(s=>(
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
                <div className="d3" style={{marginBottom:6}}>Career & Business Opportunities</div>
                <p className="body" style={{marginBottom:24}}>Identified for your specific skills, location, and stage.</p>
                {data.career?.map((o,i)=>(
                  <div className="card" key={i} style={{marginBottom:14,display:"flex",gap:16}}>
                    <div style={{width:44,height:44,borderRadius:10,background:"var(--gold-dim)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{o.type==="job"?"💼":o.type==="business"?"⚡":"◈"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"var(--f-display)",fontSize:18,fontWeight:500,marginBottom:6}}>{o.title}</div>
                      <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75,marginBottom:10}}>{o.desc}</p>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <span className="tag tg">{o.type}</span><span className="tag tt">{o.timeline}</span>
                        <span className="tag" style={{background:"transparent",border:"1px solid var(--line)",color:"var(--cream-30)",fontSize:"9px",padding:"3px 9px",borderRadius:5,fontFamily:"var(--f-mono)"}}>Effort: {o.effort}</span>
                        <span className="tag tv">{o.income}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </LockGate>
          )}

          {mod==="relocate"&&(
            <LockGate isPaid={isPaid} onUnlock={onUnlock}>
              <div className="fu">
                <div className="d3" style={{marginBottom:6}}>Relocation Intelligence</div>
                <p className="body" style={{marginBottom:24}}>Countries ranked specifically for your profile.</p>
                {data.relocation?.map((r,i)=>(
                  <div className="card" key={i} style={{marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{fontFamily:"var(--f-display)",fontSize:22,fontWeight:500}}>{r.country}</div>
                      <div style={{padding:"4px 12px",borderRadius:20,background:r.fit>=75?"var(--teal-dim)":"var(--gold-dim)",color:r.fit>=75?"var(--teal)":"var(--gold)",border:`1px solid ${r.fit>=75?"rgba(31,168,154,0.2)":"rgba(210,175,90,0.2)"}`,fontFamily:"var(--f-mono)",fontSize:11}}>{r.fit}% match</div>
                    </div>
                    <p style={{fontSize:14,color:"var(--cream-60)",marginBottom:14,lineHeight:1.75}}>{r.why}</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                      {[["Opportunity",r.opportunity+"%"],["Cost of Living",r.cost],["Visa",r.visa]].map(([k,v])=>(
                        <div key={k} style={{textAlign:"center"}}>
                          <div style={{fontFamily:"var(--f-display)",fontSize:18,color:"var(--gold)",display:"block"}}>{v}</div>
                          <div style={{fontFamily:"var(--f-mono)",fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:"var(--cream-30)"}}>{k}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="insight teal" style={{marginTop:8}}><p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75}}>Visa requirements change frequently. Always verify with official embassy sources.</p></div>
              </div>
            </LockGate>
          )}

          {mod==="advisor"&&(
            isPaid
              ?<AdvisorChat profile={formData} reportData={data} userId={userId} isPremium={isPremium}/>
              :<div className="fu" style={{textAlign:"center",padding:"40px 0"}}>
                <div style={{fontSize:36,marginBottom:16}}>⬡</div>
                <div className="d3" style={{marginBottom:12}}>Live Advisor Conversations</div>
                <p className="body" style={{maxWidth:400,margin:"0 auto 24px"}}>Ask anything. Get answers specific to you — not scripted responses.</p>
                <button className="btn btn-gold" onClick={onUnlock}>Unlock Advisor Access</button>
              </div>
          )}

          <div style={{marginTop:48,paddingTop:28,borderTop:"1px solid var(--line)",display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
            <div className="small">Last updated · {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
            <div style={{display:"flex",gap:8}}>
              {isPaid&&<button className="btn btn-ghost" style={{fontSize:12}}>Download PDF</button>}
              {!isPaid&&<button className="btn btn-gold" onClick={onUnlock}>Unlock Full Report</button>}
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
export default function DestinIQ(){
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
  const [userId]=useState(()=>genUserId());

  const handleSubmit=useCallback(async(f)=>{
    setFormData(f);setScreen("loading");setApiError("");
    pushToMemory(userId,"user",`Profile: ${f.name}, ${f.age}, ${f.country}, Goals: ${f.goals}, Challenge: ${f.challenge}`);
    try{
      const raw=await callAPI({messages:[{role:"user",content:buildAnalysisPrompt(f,isPremium,buildMemoryContext(userId))}],system:"You are DestinIQ's analytical engine. Return ONLY valid JSON, no markdown, no code fences.",userId,isPremium});
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      pushToMemory(userId,"assistant","Report generated: overall="+parsed.overall);
      setReport(parsed);
    }catch(e){
      setReport(fallback(f));
      if(e.message==="API_KEY_MISSING") setApiError("Demo mode: API key not configured. Showing sample report.");
    }
    setScreen("results");
  },[userId,isPremium]);

  const restart=()=>{setScreen("landing");setFormData(null);setReport(null);setIsPaid(false);setStreak(1);setShowCI(false);setApiError("");setNudge(false);};
  const handleUnlock=()=>{setIsPaid(false);setScreen("paywall");};
  const handlePay=()=>{setIsPaid(true);setStreak(s=>s+1);setScreen("results");};

  return(
    <>
      <style>{CSS}</style>
      <div className="bg bg-mesh"/>
      <div className="bg bg-noise"/>
      <div className="bg bg-grid"/>
      <div className="root">

        <nav className="nav">
          <div className="logo" onClick={restart}>Destin<b>IQ</b></div>
          <div className="nav-r">
            {screen!=="landing"&&<PremiumToggle isPremium={isPremium} onToggle={()=>setIsPremium(p=>!p)}/>}
            {screen==="results"&&(
              <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setShowNotif(true)} title="Set daily notification">
                🔔
              </button>
            )}
            {screen==="results"&&!isPaid&&<button className="btn btn-gold" style={{fontSize:12,padding:"8px 18px"}} onClick={handleUnlock}>Upgrade</button>}
            {screen==="results"&&isPaid&&<div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>}
            {screen!=="landing"&&<button className="btn btn-ghost" style={{fontSize:12,padding:"8px 18px"}} onClick={restart}>← Home</button>}
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
                <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.6}}>{formData.name}, your daily intelligence is ready. 30 seconds to stay on track.</p>
              </div>
              <button className="btn-text" onClick={()=>setNudge(false)} style={{flexShrink:0,fontSize:14}}>✕</button>
            </div>
            <button className="btn btn-gold btn-full" style={{marginTop:10,fontSize:12,padding:"8px"}} onClick={()=>{setNudge(false);setShowCI(true);}}>Log Momentum →</button>
          </div>
        )}

        {screen==="landing"  &&<Landing onStart={()=>setScreen("intake")}/>}
        {screen==="intake"   &&<Intake onSubmit={handleSubmit}/>}
        {screen==="loading"  &&<Loading/>}
        {screen==="paywall"  &&<Paywall onUnlock={handlePay} teaser={report?.teaser||""}/>}
        {screen==="results"  &&report&&(
          <Dashboard data={report} formData={formData} isPaid={isPaid} onUnlock={handleUnlock}
            streak={streak} showCheckin={showCI} setShowCheckin={setShowCI} userId={userId} isPremium={isPremium}/>
        )}

        {showNotif&&formData&&(
          <NotificationPanel profile={formData} userId={userId} onClose={()=>setShowNotif(false)}/>
        )}

      </div>
    </>
  );
}
