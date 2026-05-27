"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM — Refined obsidian + warm gold + editorial serif
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Outfit:wght@200;300;400;500;600&family=JetBrains+Mono:wght@300;400&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

:root{
  --void:#05060f;
  --deep:#08091a;
  --base:#0d0f1e;
  --raised:#121526;
  --lift:#181b2e;
  --line:rgba(255,255,255,0.06);
  --line-gold:rgba(210,175,90,0.18);
  --gold:#d2af5a;
  --gold-bright:#e8cb7a;
  --gold-dim:rgba(210,175,90,0.12);
  --gold-glow:rgba(210,175,90,0.06);
  --teal:#1fa89a;
  --teal-dim:rgba(31,168,154,0.1);
  --rose:#c4645a;
  --rose-dim:rgba(196,100,90,0.1);
  --violet:#7c5cbf;
  --violet-dim:rgba(124,92,191,0.1);
  --cream:#ede8d8;
  --cream-60:rgba(237,232,216,0.6);
  --cream-30:rgba(237,232,216,0.3);
  --cream-10:rgba(237,232,216,0.08);
  --cream-05:rgba(237,232,216,0.04);
  --f-display:'Playfair Display',serif;
  --f-body:'Outfit',sans-serif;
  --f-mono:'JetBrains Mono',monospace;
}

html{scroll-behavior:smooth;}
body{
  background:var(--void);color:var(--cream);
  font-family:var(--f-body);font-size:15px;line-height:1.6;
  min-height:100vh;overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
}

/* ── BG ── */
.bg{position:fixed;inset:0;z-index:0;pointer-events:none;}
.bg-mesh{
  background:
    radial-gradient(ellipse 80% 60% at 20% 0%,rgba(31,168,154,0.07) 0%,transparent 55%),
    radial-gradient(ellipse 60% 50% at 80% 100%,rgba(210,175,90,0.08) 0%,transparent 55%),
    radial-gradient(ellipse 50% 40% at 80% 20%,rgba(124,92,191,0.05) 0%,transparent 50%),
    var(--void);
}
.bg-noise{
  opacity:.025;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat:repeat;background-size:128px;
}
.bg-grid{
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:60px 60px;
  mask-image:radial-gradient(ellipse 70% 70% at 50% 50%,black 20%,transparent 100%);
}

/* ── LAYOUT ── */
.root{position:relative;z-index:1;min-height:100vh;}
.cx{width:100%;max-width:1060px;margin:0 auto;padding:0 24px;}
.cx-sm{width:100%;max-width:640px;margin:0 auto;padding:0 24px;}
.cx-md{width:100%;max-width:820px;margin:0 auto;padding:0 24px;}

/* ── NAV ── */
.nav{
  position:fixed;top:0;left:0;right:0;z-index:200;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;height:60px;
  background:rgba(5,6,15,0.88);backdrop-filter:blur(24px);
  border-bottom:1px solid var(--line);
}
.logo{font-family:var(--f-display);font-size:22px;font-weight:600;letter-spacing:.02em;cursor:pointer;color:var(--cream);}
.logo b{color:var(--gold);font-weight:600;}
.nav-r{display:flex;align-items:center;gap:10px;}

/* ── BUTTONS ── */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:11px 24px;border-radius:8px;border:none;cursor:pointer;
  font-family:var(--f-body);font-size:13px;font-weight:500;
  letter-spacing:.02em;transition:all .25s;white-space:nowrap;
}
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

/* ── CARDS ── */
.card{background:var(--raised);border:1px solid var(--line);border-radius:16px;padding:24px;transition:border-color .3s;}
.card:hover{border-color:var(--line-gold);}
.card-sm{padding:16px;border-radius:12px;}
.card-lift{background:var(--lift);}

/* ── TYPE ── */
.d1{font-family:var(--f-display);font-size:clamp(42px,7vw,78px);font-weight:400;line-height:1.05;letter-spacing:-.015em;}
.d2{font-family:var(--f-display);font-size:clamp(28px,4.5vw,48px);font-weight:400;line-height:1.1;letter-spacing:-.01em;}
.d3{font-family:var(--f-display);font-size:clamp(20px,3vw,30px);font-weight:400;line-height:1.15;}
.em{font-style:italic;color:var(--gold);}
.mono{font-family:var(--f-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);}
.body-lg{font-size:17px;line-height:1.8;color:var(--cream-60);font-weight:300;}
.body{font-size:15px;line-height:1.75;color:var(--cream-60);font-weight:300;}
.small{font-size:13px;line-height:1.65;color:var(--cream-30);}

/* ── FORM ── */
.field{margin-bottom:16px;}
.fl{display:block;margin-bottom:6px;font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);}
.fi,.fs,.ft{
  width:100%;padding:12px 16px;
  background:var(--lift);border:1px solid var(--line);border-radius:8px;
  color:var(--cream);font-family:var(--f-body);font-size:14px;font-weight:300;
  outline:none;transition:all .25s;-webkit-appearance:none;
}
.fi:focus,.fs:focus,.ft:focus{border-color:var(--line-gold);background:var(--gold-glow);box-shadow:0 0 0 3px rgba(210,175,90,0.06);}
.fi::placeholder,.ft::placeholder{color:rgba(237,232,216,0.2);font-style:italic;}
.fs option{background:var(--base);color:var(--cream);}
.ft{resize:none;line-height:1.7;}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media(max-width:520px){.row2{grid-template-columns:1fr;}}

/* ── PROGRESS ── */
.pbar{height:2px;background:var(--line);border-radius:2px;overflow:hidden;}
.pfill{height:100%;background:linear-gradient(90deg,var(--teal),var(--gold));border-radius:2px;transition:width .5s cubic-bezier(.4,0,.2,1);}

/* ── STREAK BADGE ── */
.streak-badge{
  display:inline-flex;align-items:center;gap:8px;
  padding:6px 14px;background:var(--gold-dim);border:1px solid var(--line-gold);
  border-radius:40px;font-family:var(--f-mono);font-size:10px;color:var(--gold);
}
.streak-fire{font-size:16px;line-height:1;}

/* ── LOCK OVERLAY ── */
.lock-wrap{position:relative;overflow:hidden;border-radius:16px;}
.lock-blur{filter:blur(7px);pointer-events:none;user-select:none;}
.lock-gate{
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;
  background:linear-gradient(180deg,rgba(5,6,15,0) 0%,rgba(5,6,15,0.92) 35%);
  border-radius:16px;padding:24px;
}

/* ── CHECKIN PILLS ── */
.feeling-grid{display:flex;flex-wrap:wrap;gap:8px;}
.feeling-pill{
  padding:8px 16px;border-radius:40px;border:1px solid var(--line);
  background:transparent;color:var(--cream-60);font-family:var(--f-body);font-size:13px;
  cursor:pointer;transition:all .2s;
}
.feeling-pill:hover{border-color:var(--line-gold);color:var(--cream);}
.feeling-pill.sel{background:var(--gold-dim);border-color:var(--gold);color:var(--gold-bright);}

/* ── INSIGHT STRIP ── */
.insight{
  border-left:2px solid var(--gold);padding:14px 18px;
  background:var(--gold-glow);border-radius:0 10px 10px 0;margin:16px 0;
}
.insight.teal{border-color:var(--teal);background:var(--teal-dim);}
.insight.rose{border-color:var(--rose);background:var(--rose-dim);}
.insight.violet{border-color:var(--violet);background:var(--violet-dim);}

/* ── CHAT ── */
.chat-scroll{display:flex;flex-direction:column;gap:14px;max-height:380px;overflow-y:auto;padding:4px 4px 4px 0;}
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

/* ── SCORE RING ── */
.ring-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;}
.ring-inner{position:absolute;text-align:center;}
.ring-val{font-family:var(--f-display);font-size:24px;font-weight:500;line-height:1;display:block;}
.ring-lbl{font-family:var(--f-mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--cream-30);margin-top:3px;display:block;}

/* ── PILLAR BARS ── */
.pillar-bar-card{background:var(--raised);border:1px solid var(--line);border-radius:12px;padding:16px 18px;transition:all .3s;}
.pillar-bar-card:hover{border-color:var(--line-gold);}
.pb-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.pb-name{font-size:13px;font-weight:400;color:var(--cream-60);}
.pb-val{font-family:var(--f-display);font-size:18px;font-weight:500;}
.pb-track{height:3px;background:var(--line);border-radius:2px;overflow:hidden;}
.pb-fill{height:100%;border-radius:2px;transition:width 1.6s cubic-bezier(.4,0,.2,1);}

/* ── PAYWALL ── */
.plan-card{
  background:var(--raised);border:1px solid var(--line);
  border-radius:20px;padding:32px;text-align:center;
  transition:all .3s;cursor:pointer;position:relative;overflow:hidden;
}
.plan-card.featured{border-color:var(--gold);box-shadow:0 0 40px rgba(210,175,90,0.12);}
.plan-card.featured::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--teal),var(--gold));}
.plan-price{font-family:var(--f-display);font-size:48px;font-weight:400;color:var(--gold);line-height:1;}
.plan-period{font-size:13px;color:var(--cream-30);margin-top:4px;}
.plan-name{font-size:15px;font-weight:500;margin:16px 0 20px;}
.plan-feature{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;color:var(--cream-60);text-align:left;}
.plan-check{color:var(--teal);flex-shrink:0;margin-top:1px;}

/* ── TIMELINE ── */
.timeline-item{display:flex;gap:18px;margin-bottom:24px;position:relative;}
.timeline-item::before{content:'';position:absolute;left:17px;top:36px;bottom:-24px;width:1px;background:var(--line);}
.timeline-item:last-child::before{display:none;}
.t-dot{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:var(--f-mono);font-size:10px;color:var(--gold);border:1px solid var(--line-gold);background:var(--raised);}
.t-body{flex:1;padding-top:6px;}
.t-phase{font-family:var(--f-mono);font-size:9px;letter-spacing:.16em;color:var(--gold);margin-bottom:3px;}
.t-title{font-family:var(--f-display);font-size:18px;font-weight:500;margin-bottom:6px;}
.t-desc{font-size:13px;color:var(--cream-60);line-height:1.75;font-weight:300;}
.t-win{margin-top:10px;padding:10px 14px;background:var(--teal-dim);border-left:2px solid var(--teal);border-radius:0 8px 8px 0;font-size:12px;color:var(--teal);}

/* ── MODULE TABS ── */
.tabs{display:flex;background:var(--base);border-radius:10px;padding:4px;gap:2px;overflow-x:auto;}
.tabs::-webkit-scrollbar{display:none;}
.tab{flex:1;min-width:90px;padding:9px 12px;border-radius:7px;border:none;cursor:pointer;font-family:var(--f-body);font-size:12px;font-weight:500;background:transparent;color:var(--cream-30);transition:all .25s;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:5px;}
.tab:hover{color:var(--cream-60);}
.tab.on{background:var(--lift);color:var(--cream);border:1px solid var(--line-gold);}

/* ── ANIM ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
@keyframes sweep{to{left:100%;}}
@keyframes pulse{0%,100%{opacity:.4;}50%{opacity:1;}}
@keyframes ping{0%{transform:scale(1);opacity:1;}100%{transform:scale(2.2);opacity:0;}}
@keyframes msgIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}

.fu{animation:fadeUp .5s ease both;}
.fu1{opacity:0;animation:fadeUp .5s .08s ease both;}
.fu2{opacity:0;animation:fadeUp .5s .16s ease both;}
.fu3{opacity:0;animation:fadeUp .5s .24s ease both;}
.fu4{opacity:0;animation:fadeUp .5s .32s ease both;}
.fu5{opacity:0;animation:fadeUp .5s .40s ease both;}
.msg-in{animation:msgIn .3s ease both;}

.sweep-line{position:relative;overflow:hidden;}
.sweep-line::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,var(--gold),transparent);animation:sweep 2s ease-in-out infinite;}

/* ── MISC ── */
.divr{height:1px;background:var(--line);margin:24px 0;}
.or{display:flex;align-items:center;gap:12px;margin:20px 0;}
.or::before,.or::after{content:'';flex:1;height:1px;background:var(--line);}
.or span{font-family:var(--f-mono);font-size:9px;letter-spacing:.2em;color:var(--cream-30);}
.tag{display:inline-flex;align-items:center;padding:3px 9px;border-radius:5px;font-family:var(--f-mono);font-size:9px;letter-spacing:.08em;}
.tg{background:var(--gold-dim);color:var(--gold);border:1px solid rgba(210,175,90,0.2);}
.tt{background:var(--teal-dim);color:var(--teal);border:1px solid rgba(31,168,154,0.2);}
.tr{background:var(--rose-dim);color:var(--rose);border:1px solid rgba(196,100,90,0.2);}
.tv{background:var(--violet-dim);color:var(--violet);border:1px solid rgba(124,92,191,0.2);}
.disc{font-size:11px;color:var(--cream-30);font-style:italic;text-align:center;line-height:1.8;padding:32px 24px;}

@media(max-width:600px){
  .nav{padding:0 16px;}
  .card{padding:18px;}
  .d1{font-size:clamp(34px,10vw,54px);}
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const FEELINGS = ["Motivated","Anxious","Stuck","Focused","Overwhelmed","Hopeful","Drained","Confident","Uncertain","Restless"];
const PILLARS  = [
  {id:"life",      label:"Life Direction",  color:"#d2af5a", icon:"◎"},
  {id:"wealth",    label:"Financial Path",  color:"#1fa89a", icon:"◈"},
  {id:"mindset",   label:"Mindset",         color:"#9b72cf", icon:"◇"},
  {id:"relations", label:"Relationships",   color:"#c4645a", icon:"◉"},
];
const MODULES = [
  {id:"today",    icon:"◎", label:"Today"},
  {id:"roadmap",  icon:"↗", label:"Roadmap"},
  {id:"mindset",  icon:"◇", label:"Mindset"},
  {id:"career",   icon:"◈", label:"Career"},
  {id:"relocate", icon:"✦", label:"Relocate"},
  {id:"advisor",  icon:"⬡", label:"Advisor"},
];
const LOADING_PHRASES = [
  "Reading your profile…","Mapping your patterns…","Building your framework…",
  "Generating opportunities…","Compiling your roadmap…","Preparing your report…",
];

// ─────────────────────────────────────────────────────────────────────────────
// SCORE RING
// ─────────────────────────────────────────────────────────────────────────────
function Ring({score,color,size=96,label}){
  const r=(size-12)/2, c=2*Math.PI*r, f=(score/100)*c;
  return(
    <div className="ring-wrap" style={{width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${f} ${c}`} strokeLinecap="round"
          style={{transition:"stroke-dasharray 1.6s cubic-bezier(.4,0,.2,1)",filter:`drop-shadow(0 0 5px ${color}50)`}}/>
      </svg>
      <div className="ring-inner">
        <span className="ring-val" style={{color}}>{score}</span>
        <span className="ring-lbl">{label}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────
async function ask(messages, system){
  const res = await fetch("/api/analyze", {
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system,messages}),
  });
  if(!r.ok) throw new Error("api");
  const d=await r.json();
  return d.content?.find(b=>b.type==="text")?.text||"";
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────────────────────────────────────
function buildAnalysisPrompt(f){
  return `You are Destiniq's core engine — a world-class advisor. Analyse this person and return a detailed JSON life report. Every word must be specific to their inputs. Never use generic template language.

PROFILE: Name=${f.name}, Age=${f.age}, Gender=${f.gender||"N/A"}, Country=${f.country}, Relationship=${f.relationship||"N/A"}, Income=${f.income||"N/A"}, Education=${f.education||"N/A"}, Career/Situation=${f.career}, Skills=${f.skills||"N/A"}, Habits=${f.habits||"N/A"}, Goals=${f.goals}, Challenge=${f.challenge}

Return ONLY valid JSON:
{
  "greeting":"One sharp, specific, warm sentence for ${f.name} that shows you understand their exact situation",
  "teaser":"One deeply intriguing sentence that hints at a hidden pattern in their life — something specific enough to make them desperate to read more. This is the hook that makes them pay.",
  "scores":{"life":0-100,"wealth":0-100,"mindset":0-100,"relations":0-100},
  "overall":0-100,
  "headline":"2 sentences of sharp insight specific to their age, country, and goals",
  "daily_insight":"A personalised insight for today — referencing their challenge directly. 2-3 sentences that feel like a coach who knows them well wrote it this morning.",
  "roadmap":[
    {"phase":"0–90 Days","title":"Phase title","desc":"3-4 sentences specific to their country, income, skills","win":"One action this week"},
    {"phase":"3–12 Months","title":"","desc":"","win":""},
    {"phase":"1–3 Years","title":"","desc":"","win":""},
    {"phase":"3–5 Years","title":"","desc":"","win":""}
  ],
  "mindset":{
    "pattern":"The one mindset block holding ${f.name} back — be specific",
    "reframe":"A precise cognitive reframe for their situation",
    "practice":"One daily practice specific to their habits and life stage",
    "emotional":"2-3 sentences on the emotional dynamic in their current life chapter"
  },
  "career":[
    {"title":"Opportunity title","desc":"2-3 sentences specific to their skills and country","effort":"low|medium|high","timeline":"X months","income":"realistic range","type":"job|business|freelance"},
    {"title":"","desc":"","effort":"","timeline":"","income":"","type":""},
    {"title":"","desc":"","effort":"","timeline":"","income":"","type":""}
  ],
  "relocation":[
    {"country":"Name","fit":0-100,"why":"2 sentences specific to their profile","opportunity":0-100,"cost":"low|medium|high","visa":"easy|moderate|complex"},
    {"country":"","fit":0,"why":"","opportunity":0,"cost":"","visa":""},
    {"country":"","fit":0,"why":"","opportunity":0,"cost":"","visa":""}
  ],
  "risks":["Risk 1 specific to them","Risk 2","Risk 3"],
  "strengths":["Strength 1 from their profile","Strength 2","Strength 3"],
  "closing":"One line that only makes sense for ${f.name} — something they will screenshot"
}`;
}

function buildCheckinPrompt(profile, entry, reportData){
  return `You are Destiniq's daily advisor for ${profile.name}. They checked in today. Give a short, direct, personal response — like a coach who knows them deeply. 2-3 paragraphs max. Never generic. Reference their specific challenge: "${profile.challenge}" and goal: "${profile.goals}". Their score today: ${entry.score}/10. Feeling: ${entry.feeling}. What they did: "${entry.did}". What they avoided: "${entry.avoided}". Their life score: ${reportData?.overall||70}. Start directly with insight — no pleasantries. Do not mention being an advisor or system.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
function fallback(f){
  const age=parseInt(f.age)||26;
  const iScore={"Under $500":22,"$500–$1,500":38,"$1,500–$4,000":58,"$4,000–$10,000":74,"$10,000+":88}[f.income]||50;
  return{
    greeting:`${f.name}, your profile maps a person standing at a real threshold — the kind where clarity in the next 90 days changes the next 10 years.`,
    teaser:`There is a specific pattern in how you describe your challenge that almost always precedes a major breakthrough — but only when one precise thing changes first.`,
    scores:{life:Math.min(85,50+(age<30?8:4)),wealth:Math.min(85,iScore),mindset:64,relations:70},
    overall:Math.round((50+iScore+64+70)/4),
    headline:`At ${age} in ${f.country}, you are in a compounding window. The choices made in the next 12 months will determine your financial and personal trajectory for the decade that follows.`,
    daily_insight:`Today's most important move is not the biggest one — it is the one you have been postponing. Your challenge around "${f.challenge.split(" ").slice(0,6).join(" ")}…" is not a resources problem. It is a sequencing problem. Start with the smallest version of the thing you keep delaying.`,
    roadmap:[
      {phase:"0–90 Days",title:"Foundation & Momentum",desc:`The first priority is eliminating the friction points that are making everything else harder. In ${f.country}, the most direct path forward involves establishing one income-generating habit before adding complexity. Most people at your stage over-plan and under-execute.`,win:"Identify the one action you have been postponing and do the first 15 minutes of it today."},
      {phase:"3–12 Months",title:"Skill Into Income",desc:`Your skills — ${f.skills||"what you currently know"} — have market value that you are likely underpricing. This phase is about converting competence into consistent income, whether through employment leverage or your own offer.`,win:"Research what people with your skills earn in three different markets this week."},
      {phase:"1–3 Years",title:"Systems Over Hustle",desc:"The shift that separates people who stay stuck from those who break through is simple: they stop relying on motivation and build systems. This phase is about making your progress automatic rather than dependent on willpower.",win:"Document one repeatable process in your life every month."},
      {phase:"3–5 Years",title:"Optionality & Legacy",desc:"By this point the compound effect of earlier decisions becomes visible. The goal is not to work harder but to operate from a position of genuine choice — where your decisions come from strength, not pressure.",win:"Define financial freedom with a specific number and date."},
    ],
    mindset:{
      pattern:"A tendency to wait for external validation or ideal conditions before committing fully — which keeps you in a permanent holding pattern.",
      reframe:"The conditions you are waiting for do not arrive before the decision. They arrive because of it. Commitment creates clarity, not the other way around.",
      practice:"Write one honest sentence each morning: 'The thing I am actually avoiding today is ___.' Then address it first.",
      emotional:`At your stage, the dominant tension is between who you know you can become and the evidence of where you currently are. This gap is not a failure. It is the engine. The question is whether you let it drive you or paralyse you.`,
    },
    career:[
      {title:"Remote Consulting in Your Domain",desc:`Given your background, positioning your expertise as a service for international clients from ${f.country} is the highest-leverage near-term move. It requires no capital and can begin within weeks.`,effort:"medium",timeline:"1–3 months",income:"2–5× local average",type:"freelance"},
      {title:"Remote Professional Employment",desc:"The global shift toward distributed work has permanently changed what is accessible from your location. Targeting companies in higher-currency markets creates significant income arbitrage.",effort:"medium",timeline:"2–5 months",income:"3–8× local salary",type:"job"},
      {title:"Knowledge-Based Business",desc:"You have a perspective and experience that others earlier in their journey would pay to access. Packaging this modestly at first creates an asset that scales independently of your time.",effort:"high",timeline:"6–12 months",income:"Scalable, uncapped",type:"business"},
    ],
    relocation:[
      {country:"United Arab Emirates",fit:84,why:`Zero income tax and a genuine infrastructure for ambitious professionals from your region. The income-to-cost ratio for someone with your skills is among the highest globally.`,opportunity:90,cost:"high",visa:"moderate"},
      {country:"Portugal",fit:76,why:"Growing international professional community, accessible visa pathways, and a cost structure that rewards income earned in stronger currencies.",opportunity:72,cost:"medium",visa:"moderate"},
      {country:"Canada",fit:70,why:"Structured immigration pathways, long-term stability, and a track record of integrating ambitious professionals from your background.",opportunity:68,cost:"medium",visa:"complex"},
    ],
    risks:["Over-planning as a substitute for action — using preparation to avoid the discomfort of starting","Underpricing your skills and time, particularly in early-stage opportunities","Neglecting physical and mental recovery, which directly limits the quality of every decision you make"],
    strengths:["Willingness to seek external perspective — one of the rarest and most valuable traits in driven people","A clear goals orientation that, when paired with consistent action, becomes your strongest competitive advantage","Being at an age where every course correction still has decades of compounding ahead of it"],
    closing:`The version of your life you actually want is not behind a wall of circumstances — it is behind a wall of decisions you have not made yet.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYWALL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function Paywall({onUnlock, teaser}){
  const [sel, setSel]=useState("pro");
  const plans=[
    {id:"basic", price:"$9",  period:"/month", name:"Essential",  color:"var(--teal)",
     features:["Full life analysis report","Daily check-in & insight","Roadmap access","3 advisor conversations/month"]},
    {id:"pro",   price:"$15", period:"/month", name:"Premium",    color:"var(--gold)",   featured:true,
     features:["Everything in Essential","Unlimited advisor conversations","Career & business opportunities","Relocation intelligence","Streak tracking & progress history","Priority report updates"]},
    {id:"annual",price:"$99", period:"/year",  name:"Annual Pro", color:"var(--violet)",
     features:["Everything in Premium","Save $81 vs monthly","Downloadable PDF reports","Early access to new modules","Share card for social"]},
  ];
  return(
    <div style={{padding:"60px 0"}}>
      <div className="cx-sm" style={{textAlign:"center"}}>
        <div className="mono fu" style={{marginBottom:16}}>Your Report Is Ready</div>
        <h2 className="d2 fu1" style={{marginBottom:16}}>Unlock what's waiting for you</h2>

        {/* Teaser hook */}
        <div className="fu2" style={{margin:"0 auto 36px",maxWidth:480}}>
          <div className="insight violet" style={{textAlign:"left"}}>
            <div className="mono" style={{marginBottom:6,fontSize:"9px"}}>Detected in your profile</div>
            <p style={{fontSize:15,color:"var(--cream-60)",fontStyle:"italic",lineHeight:1.75}}>
              "{teaser}"
            </p>
            <p style={{fontSize:12,color:"var(--cream-30)",marginTop:8}}>Unlock your full report to understand what this means for your next move.</p>
          </div>
        </div>

        <div className="fu3" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:32}}>
          {plans.map(p=>(
            <div key={p.id} className={`plan-card ${p.featured?"featured":""} ${sel===p.id?"":"opacity-80"}`}
              onClick={()=>setSel(p.id)}
              style={{borderColor:sel===p.id?p.color:undefined,boxShadow:sel===p.id?`0 0 30px ${p.color}20`:undefined}}>
              {p.featured&&<div className="tag tg" style={{marginBottom:12,display:"inline-block"}}>MOST POPULAR</div>}
              <div className="plan-price" style={{color:p.color}}>{p.price}</div>
              <div className="plan-period">{p.period}</div>
              <div className="plan-name">{p.name}</div>
              {p.features.map(ft=>(
                <div className="plan-feature" key={ft}>
                  <span className="plan-check">✓</span>{ft}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="fu4">
          <button className="btn btn-gold btn-lg btn-full" style={{maxWidth:360,margin:"0 auto",display:"flex"}} onClick={onUnlock}>
            Unlock Full Report
          </button>
          <p style={{marginTop:12,fontSize:11,color:"var(--cream-30)",fontFamily:"var(--f-mono)",letterSpacing:".1em"}}>
            SECURED PAYMENT · CANCEL ANYTIME
          </p>
        </div>

        <div className="fu5" style={{marginTop:36,padding:"20px",background:"var(--raised)",border:"1px solid var(--line)",borderRadius:12}}>
          <div className="mono" style={{marginBottom:10,fontSize:"9px"}}>What happens after you unlock</div>
          {["Your complete life analysis — every section, fully readable","Daily check-ins that track your growth over time","Live advisor conversations whenever you need them","Career and relocation intelligence specific to you"].map((t,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8,fontSize:13,color:"var(--cream-60)"}}>
              <span style={{color:"var(--teal)",flexShrink:0,marginTop:1}}>→</span>{t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY CHECK-IN
// ─────────────────────────────────────────────────────────────────────────────
function CheckIn({profile, reportData, onComplete, streak}){
  const [feeling, setFeeling]=useState("");
  const [score, setScore]=useState(5);
  const [did, setDid]=useState("");
  const [avoided, setAvoided]=useState("");
  const [loading, setLoading]=useState(false);
  const [result, setResult]=useState(null);

  const submit=async()=>{
    if(!feeling||!did.trim()) return;
    setLoading(true);
    const entry={feeling,score,did,avoided};
    try{
      const reply=await ask(
        [{role:"user",content:buildCheckinPrompt(profile,entry,reportData)}],
        "You are Destiniq's personal advisor. Be direct, warm, and specific. Never generic. Never mention being an AI or system."
      );
      setResult(reply);
    }catch{
      setResult(`${profile.name}, you showed up today — and that matters more than most people realise. The fact that you are tracking "${avoided||"what you avoided"}" tells me you already know what needs to change. Today's score of ${score}/10 is data, not judgment. Use it. The next 24 hours are a fresh calculation.`);
    }
    setLoading(false);
  };

  if(result) return(
    <div className="fu">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>
        <div className="tag tt">Check-in complete</div>
      </div>
      <div className="d3" style={{marginBottom:20}}>Today's insight for you</div>
      <div style={{fontSize:15,lineHeight:1.85,color:"var(--cream-60)",fontWeight:300,whiteSpace:"pre-wrap"}}>
        {result}
      </div>
      <div style={{marginTop:24,display:"flex",gap:10}}>
        <button className="btn btn-ghost" onClick={onComplete}>Back to dashboard</button>
      </div>
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

      <div className="field">
        <label className="fl">How are you feeling right now?</label>
        <div className="feeling-grid">
          {FEELINGS.map(f=>(
            <button key={f} className={`feeling-pill ${feeling===f?"sel":""}`} onClick={()=>setFeeling(f)}>{f}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="fl">Rate your day so far — 1 to 10</label>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <input type="range" min={1} max={10} value={score} onChange={e=>setScore(+e.target.value)}
            style={{flex:1,accentColor:"var(--gold)"}}/>
          <span style={{fontFamily:"var(--f-display)",fontSize:24,color:"var(--gold)",minWidth:28}}>{score}</span>
        </div>
      </div>

      <div className="field">
        <label className="fl">What is the most important thing you did today?</label>
        <textarea className="ft" rows={2} placeholder="Even something small counts…" value={did} onChange={e=>setDid(e.target.value)}/>
      </div>

      <div className="field">
        <label className="fl">What did you avoid or keep postponing?</label>
        <textarea className="ft" rows={2} placeholder="Be honest — this is private…" value={avoided} onChange={e=>setAvoided(e.target.value)}/>
      </div>

      <button className="btn btn-gold btn-full" onClick={submit} disabled={!feeling||!did.trim()||loading} style={{marginTop:8}}>
        {loading?"Reading your day…":"Get Today's Insight →"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR CHAT
// ─────────────────────────────────────────────────────────────────────────────
function AdvisorChat({profile, reportData}){
  const [msgs, setMsgs]=useState([
    {role:"assistant",content:`${profile.name}, I have your full report in front of me. What would you like to go deeper on — your roadmap, career options, mindset, relocation, or something else entirely?`}
  ]);
  const [input, setInput]=useState("");
  const [loading, setLoading]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[msgs,loading]);

  const system=`You are Destiniq's personal advisor for ${profile.name}. You have their full life report. Be specific, direct, and human. Reference their exact situation: country=${profile.country}, age=${profile.age}, goals="${profile.goals}", challenge="${profile.challenge}". Their scores: life=${reportData?.scores?.life}, wealth=${reportData?.scores?.wealth}, mindset=${reportData?.scores?.mindset}. Never say "AI". You are their advisor. Keep responses concise — 2-3 paragraphs max. Always end with one sharp question or prompt that moves them forward.`;

  const send=async()=>{
    if(!input.trim()||loading) return;
    const msg=input.trim(); setInput("");
    const updated=[...msgs,{role:"user",content:msg}];
    setMsgs(updated); setLoading(true);
    try{
      const reply=await ask(updated.map(m=>({role:m.role,content:m.content})),system);
      setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch{
      setMsgs(p=>[...p,{role:"assistant",content:"I lost the connection for a moment. Try again — I'm still here."}]);
    }
    setLoading(false);
  };

  const QUICK=[`What should I do first?`,`How do I fix my mindset?`,`Is relocation right for me?`,`How do I make more money?`];

  return(
    <div className="fu">
      <div style={{marginBottom:20}}>
        <div className="mono" style={{marginBottom:6}}>Live Advisor</div>
        <p className="body">Ask anything. Go as deep as you need.</p>
      </div>
      <div className="card">
        <div className="chat-scroll" ref={ref}>
          {msgs.map((m,i)=>(
            <div key={i} className={`chat-msg msg-in ${m.role==="user"?"me":""}`}>
              <div className={`av ${m.role==="user"?"av-u":"av-d"}`}>{m.role==="user"?profile.name[0]?.toUpperCase():"DQ"}</div>
              <div className={`bubble ${m.role==="user"?"bubble-u":"bubble-d"}`}>{m.content}</div>
            </div>
          ))}
          {loading&&<div className="chat-msg msg-in"><div className="av av-d">DQ</div><div className="bubble bubble-d"><div className="typing-dot"><span/><span/><span/></div></div></div>}
        </div>
        <div className="chat-in-row">
          <input className="chat-in" placeholder="Ask your advisor…" value={input}
            onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
          <button className="chat-send" onClick={send} disabled={loading||!input.trim()}>→</button>
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>
        {QUICK.map(q=>(
          <button key={q} className="btn-text" style={{border:"1px solid var(--line)",borderRadius:6,padding:"5px 10px",fontSize:11}}
            onClick={()=>setInput(q)}>{q}</button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function Landing({onStart}){
  return(
    <div style={{paddingTop:60}}>
      {/* HERO */}
      <section style={{minHeight:"92vh",display:"flex",alignItems:"center",borderBottom:"1px solid var(--line)",padding:"80px 0"}}>
        <div className="cx" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}}>
          <div>
            <div className="mono fu" style={{marginBottom:20}}>Personal Intelligence · Global</div>
            <h1 className="d1 fu1" style={{marginBottom:28}}>
              The system<br/>that knows<br/><span className="em">your next move</span>
            </h1>
            <p className="body-lg fu2" style={{marginBottom:36,maxWidth:420}}>
              Destiniq analyses your complete life profile and delivers a daily intelligence layer — covering direction, finances, mindset, career, and your global options.
            </p>
            <div className="fu3" style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <button className="btn btn-gold btn-lg" onClick={onStart}>Begin Your Analysis</button>
              <span className="small">Free to start · Results in 60 seconds</span>
            </div>
            <div className="fu4" style={{marginTop:40,display:"flex",gap:28}}>
              {[["40+","Countries"],["Daily","Intelligence"],["6","Life Dimensions"]].map(([v,l])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontFamily:"var(--f-display)",fontSize:26,fontWeight:500,color:"var(--gold)"}}>{v}</div>
                  <div className="small">{l}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Live preview card */}
          <div className="fu2" style={{position:"relative"}}>
            <div style={{position:"absolute",inset:-1,borderRadius:20,background:"linear-gradient(135deg,rgba(31,168,154,.15),rgba(210,175,90,.1))",zIndex:-1,filter:"blur(20px)"}}/>
            <div className="card" style={{borderColor:"var(--line-gold)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                <div><div className="mono" style={{marginBottom:4}}>Life Score</div><div className="d3">Overview</div></div>
                <div className="streak-badge"><span className="streak-fire">🔥</span>12 day streak</div>
              </div>
              <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:20}}>
                {PILLARS.map(p=><Ring key={p.id} score={{life:74,wealth:61,mindset:68,relations:77}[p.id]} color={p.color} size={80} label={p.label.split(" ")[0]}/>)}
              </div>
              <div className="insight" style={{margin:0}}>
                <div className="mono" style={{marginBottom:6,fontSize:"9px"}}>Today's Insight</div>
                <p style={{fontSize:13,color:"var(--cream-60)",fontStyle:"italic",lineHeight:1.7}}>
                  "The pattern you keep calling a motivation problem is actually a clarity problem. Once you name the real next step, the energy returns on its own."
                </p>
              </div>
              <div style={{marginTop:16,display:"flex",gap:8}}>
                {["Roadmap","Career","Relocate","Mindset"].map(t=>(
                  <div key={t} className="tag tg" style={{fontSize:"9px"}}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CURIOSITY SECTION — what they won't see until they pay */}
      <section style={{padding:"80px 0",borderBottom:"1px solid var(--line)",background:"rgba(210,175,90,0.02)"}}>
        <div className="cx-md" style={{textAlign:"center"}}>
          <div className="mono fu" style={{marginBottom:16}}>What Destiniq Reveals</div>
          <h2 className="d2 fu1" style={{marginBottom:16}}>
            Most people are solving<br/><span className="em">the wrong problem</span>
          </h2>
          <p className="body-lg fu2" style={{maxWidth:520,margin:"0 auto 48px"}}>
            Your report identifies the specific pattern at the root of your challenge — not the surface symptoms you can already see.
          </p>
          <div className="fu3" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
            {[
              {icon:"◎",title:"The Root Pattern",desc:"Why your challenge keeps returning despite your efforts — and the one shift that changes it permanently."},
              {icon:"↗",title:"Your 90-Day Move",desc:"The specific sequence of actions that fits your country, income, and skill set — not a generic plan."},
              {icon:"◇",title:"The Hidden Block",desc:"The mindset pattern that is silently limiting every area of your life — identified from your own words."},
              {icon:"✦",title:"Your Global Options",desc:"Which countries match your exact profile for opportunity, lifestyle, and realistic visa access."},
              {icon:"◈",title:"Monetisable Skills",desc:"Three specific income opportunities that already exist in your skill set — most people miss them."},
              {icon:"⬡",title:"Live Conversations",desc:"Ask anything. Get answers that are specific to your situation, not scripted responses."},
            ].map((f,i)=>(
              <div key={f.title} className="card card-sm" style={{textAlign:"left",animationDelay:`${i*.06}s`}}>
                <div style={{color:"var(--gold)",fontFamily:"var(--f-mono)",fontSize:18,marginBottom:10}}>{f.icon}</div>
                <div style={{fontWeight:500,fontSize:14,marginBottom:6}}>{f.title}</div>
                <div className="small">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF STRIP */}
      <section style={{padding:"56px 0",borderBottom:"1px solid var(--line)"}}>
        <div className="cx">
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
            {[
              {quote:"I've tried journaling apps, coaching apps, everything. Destiniq is the first thing that felt like it actually understood my specific situation.",name:"Amara, 27 · Ghana"},
              {quote:"The career section alone was worth it. Found a remote role paying 4× what I earned locally within 3 months of following the roadmap.",name:"Rafael, 31 · Brazil"},
              {quote:"I was sceptical. But the daily check-in has genuinely changed how I think about progress. I haven't missed a day in 6 weeks.",name:"Priya, 24 · India"},
            ].map((t,i)=>(
              <div key={i} className="card">
                <p style={{fontSize:14,lineHeight:1.8,color:"var(--cream-60)",fontStyle:"italic",marginBottom:14}}>"{t.quote}"</p>
                <div className="mono" style={{fontSize:"9px"}}>{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{padding:"80px 0",textAlign:"center"}}>
        <div className="cx-sm">
          <div className="mono fu" style={{marginBottom:16}}>Start Free · No Card Required</div>
          <h2 className="d2 fu1" style={{marginBottom:20}}>Your report takes 60 seconds<br/>to generate</h2>
          <p className="body fu2" style={{marginBottom:32}}>Answer honestly. Everything else happens automatically.</p>
          <button className="btn btn-gold btn-lg fu3" onClick={onStart}>Begin Your Analysis</button>
        </div>
      </section>

      <div className="disc">Destiniq is a personal development intelligence platform. All insights are frameworks for reflection — not medical, financial, or legal advice.</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTAKE FORM
// ─────────────────────────────────────────────────────────────────────────────
function Intake({onSubmit}){
  const [step,setStep]=useState(1);
  const [f,setF]=useState({name:"",age:"",gender:"",country:"",relationship:"",income:"",education:"",career:"",skills:"",habits:"",goals:"",challenge:""});
  const [err,setErr]=useState("");
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const validate=()=>{
    if(step===1&&(!f.name.trim()||!f.age||!f.country.trim())) return"Please fill in your name, age, and country.";
    if(step===2&&!f.career.trim()) return"Please describe your current situation.";
    if(step===3&&(!f.goals.trim()||!f.challenge.trim())) return"Please describe your goals and your biggest challenge.";
    return"";
  };
  const next=()=>{const e=validate();if(e){setErr(e);return;}setErr("");step<3?setStep(s=>s+1):onSubmit(f);};
  const prog=(step/3)*100;

  return(
    <div style={{paddingTop:60,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"100px 24px 60px"}}>
      <div style={{width:"100%",maxWidth:600}}>
        <div style={{marginBottom:32,textAlign:"center"}}>
          <div className="mono fu" style={{marginBottom:8}}>Step {step} of 3</div>
          <h2 className="d3 fu1" style={{marginBottom:6}}>
            {step===1?"Your Profile":step===2?"Your Work & Skills":"Your Goals & Challenge"}
          </h2>
          <p className="small fu2" style={{marginBottom:20}}>
            {step===1?"The more precise you are, the more specific your report will be.":step===2?"Tell us where you are professionally right now.":"This section determines how personal your report becomes."}
          </p>
          <div className="pbar"><div className="pfill" style={{width:`${prog}%`}}/></div>
        </div>

        <div className="card fu2">
          {step===1&&<>
            <div className="row2">
              <div className="field"><label className="fl">Full Name</label><input className="fi" placeholder="Your name" value={f.name} onChange={e=>set("name",e.target.value)}/></div>
              <div className="field"><label className="fl">Age</label><input className="fi" type="number" placeholder="e.g. 26" value={f.age} onChange={e=>set("age",e.target.value)}/></div>
            </div>
            <div className="row2">
              <div className="field"><label className="fl">Gender</label>
                <select className="fs" value={f.gender} onChange={e=>set("gender",e.target.value)}>
                  <option value="">— Select —</option><option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
                </select>
              </div>
              <div className="field"><label className="fl">Country of Residence</label><input className="fi" placeholder="e.g. Ghana" value={f.country} onChange={e=>set("country",e.target.value)}/></div>
            </div>
            <div className="row2">
              <div className="field"><label className="fl">Relationship Status</label>
                <select className="fs" value={f.relationship} onChange={e=>set("relationship",e.target.value)}>
                  <option value="">— Select —</option><option>Single</option><option>In a relationship</option><option>Engaged</option><option>Married</option><option>Divorced</option>
                </select>
              </div>
              <div className="field"><label className="fl">Monthly Income Level</label>
                <select className="fs" value={f.income} onChange={e=>set("income",e.target.value)}>
                  <option value="">— Select —</option><option>Under $500</option><option>$500–$1,500</option><option>$1,500–$4,000</option><option>$4,000–$10,000</option><option>$10,000+</option>
                </select>
              </div>
            </div>
            <div className="field"><label className="fl">Highest Education</label>
              <select className="fs" value={f.education} onChange={e=>set("education",e.target.value)}>
                <option value="">— Select —</option><option>High School</option><option>Some College</option><option>Bachelor's Degree</option><option>Master's Degree</option><option>Doctorate</option><option>Self-taught / Vocational</option>
              </select>
            </div>
          </>}

          {step===2&&<>
            <div className="field"><label className="fl">Current Work or Career Situation</label><textarea className="ft" rows={3} placeholder="e.g. I work in sales, earning $700/month. Been there 2 years and feel stuck. Want to start something of my own." value={f.career} onChange={e=>set("career",e.target.value)}/></div>
            <div className="field"><label className="fl">Your Skills & Strengths</label><textarea className="ft" rows={2} placeholder="e.g. Social media, video editing, teaching, customer service, writing, coding basics…" value={f.skills} onChange={e=>set("skills",e.target.value)}/></div>
            <div className="field"><label className="fl">Daily Habits (Sleep, Exercise, Stress, Diet)</label><textarea className="ft" rows={2} placeholder="e.g. 6 hours sleep, no gym, high stress, skip breakfast most days" value={f.habits} onChange={e=>set("habits",e.target.value)}/></div>
          </>}

          {step===3&&<>
            <div className="field"><label className="fl">What Do You Want Most From Life?</label><textarea className="ft" rows={3} placeholder="e.g. Financial freedom, travel, start my own business, move abroad, find real purpose, build a family…" value={f.goals} onChange={e=>set("goals",e.target.value)}/></div>
            <div className="field"><label className="fl">Your Biggest Challenge Right Now</label><textarea className="ft" rows={3} placeholder="Be honest — the more specific you are here, the more useful your report will be." value={f.challenge} onChange={e=>set("challenge",e.target.value)}/></div>
            <div className="insight teal">
              <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75}}>
                <strong style={{color:"var(--teal)"}}>This matters:</strong> The challenge field is the most analysed input in your report. It is what separates a generic result from one that feels like it was written for you specifically.
              </p>
            </div>
          </>}

          {err&&<div style={{padding:"10px 14px",background:"var(--rose-dim)",border:"1px solid rgba(196,100,90,.25)",borderRadius:8,color:"var(--rose)",fontSize:13,marginBottom:12}}>{err}</div>}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
            {step>1?<button className="btn btn-ghost" onClick={()=>{setStep(s=>s-1);setErr("");}}>← Back</button>:<div/>}
            <button className="btn btn-gold" onClick={next}>{step<3?"Continue →":"Generate My Report"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function Loading(){
  const [s,setS]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setS(p=>Math.min(p+1,LOADING_PHRASES.length-1)),950);return()=>clearInterval(t);},[]);
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"40px 24px"}}>
      <div className="mono fu" style={{marginBottom:24}}>Destiniq Analysis Engine</div>
      <div className="d3 fu1" style={{marginBottom:12,fontWeight:300}}>Building your report</div>
      <p className="small fu2" style={{marginBottom:48}}>We reason carefully. This takes a few moments.</p>
      <div className="sweep-line" style={{width:260,height:1,background:"var(--line)",marginBottom:28}}/>
      <div style={{fontFamily:"var(--f-mono)",fontSize:11,letterSpacing:".12em",color:"var(--cream-30)",animation:"pulse 1.8s ease infinite"}}>{LOADING_PHRASES[s]}</div>
      <div style={{display:"flex",gap:6,marginTop:24}}>
        {LOADING_PHRASES.map((_,i)=><div key={i} style={{width:4,height:4,borderRadius:2,background:i<=s?"var(--gold)":"var(--line)",transition:"background .4s"}}/>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD (RESULTS)
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({data, formData, isPaid, onUnlock, streak, onCheckin, showCheckin, setShowCheckin}){
  const [mod, setMod]=useState("today");
  const [aScores, setAScores]=useState({life:0,wealth:0,mindset:0,relations:0});

  useEffect(()=>{setTimeout(()=>setAScores(data.scores),500);},[data]);

  const LockGate=({children})=>{
    if(isPaid) return children;
    return(
      <div className="lock-wrap">
        <div className="lock-blur">{children}</div>
        <div className="lock-gate">
          <div style={{fontSize:28,marginBottom:12}}>🔒</div>
          <div className="d3" style={{marginBottom:8,fontSize:20}}>Unlock this section</div>
          <p className="small" style={{marginBottom:20,maxWidth:280}}>This is part of your full report. Upgrade to access everything.</p>
          <button className="btn btn-gold" onClick={onUnlock}>Unlock Full Report</button>
        </div>
      </div>
    );
  };

  const effortColor=e=>e==="low"?"var(--teal)":e==="medium"?"var(--gold)":"var(--rose)";

  return(
    <div style={{paddingTop:60}}>
      {/* Header */}
      <div style={{padding:"48px 0 32px",borderBottom:"1px solid var(--line)",background:"rgba(210,175,90,0.02)"}}>
        <div className="cx-md">
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:28}}>
            <div>
              <div className="mono fu" style={{marginBottom:8}}>Your Destiniq Report</div>
              <h1 className="d2 fu1" style={{marginBottom:8}}>{formData.name}</h1>
              <p className="body fu2" style={{fontStyle:"italic",maxWidth:500}}>&ldquo;{data.greeting}&rdquo;</p>
            </div>
            <div className="fu2" style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>
              {!showCheckin&&<button className="btn btn-outline-gold" onClick={()=>setShowCheckin(true)}>Daily Check-In</button>}
            </div>
          </div>

          {/* Scores */}
          <div className="fu3" style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap",marginBottom:28}}>
            <Ring score={data.overall} color="var(--gold)" size={106} label="Overall"/>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,minWidth:260}}>
              {PILLARS.map(p=>(
                <div className="pillar-bar-card" key={p.id}>
                  <div className="pb-row">
                    <span className="pb-name">{p.label}</span>
                    <span className="pb-val" style={{color:p.color}}>{aScores[p.id]||0}</span>
                  </div>
                  <div className="pb-track"><div className="pb-fill" style={{width:`${aScores[p.id]||0}%`,background:p.color}}/></div>
                </div>
              ))}
            </div>
          </div>

          {/* Headline */}
          <div className="insight fu4"><p className="body">{data.headline}</p></div>
        </div>
      </div>

      {/* Daily check-in panel */}
      {showCheckin&&(
        <div style={{padding:"32px 0",borderBottom:"1px solid var(--line)",background:"rgba(31,168,154,0.03)"}}>
          <div className="cx-md">
            <CheckIn profile={formData} reportData={data} streak={streak}
              onComplete={()=>setShowCheckin(false)}/>
          </div>
        </div>
      )}

      {/* Modules */}
      <div style={{padding:"36px 0"}}>
        <div className="cx-md">
          <div className="tabs" style={{marginBottom:32}}>
            {MODULES.map(m=><button key={m.id} className={`tab ${mod===m.id?"on":""}`} onClick={()=>setMod(m.id)}><span>{m.icon}</span>{m.label}</button>)}
          </div>

          {/* TODAY */}
          {mod==="today"&&(
            <div className="fu">
              <div className="d3" style={{marginBottom:20}}>Today's Intelligence</div>
              <div className="insight" style={{marginBottom:24}}>
                <div className="mono" style={{marginBottom:8,fontSize:"9px"}}>Personal Insight · {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div>
                <p className="body">{data.daily_insight}</p>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
                <div className="card card-sm">
                  <div className="mono" style={{marginBottom:10,fontSize:"9px"}}>Your Strengths</div>
                  {data.strengths?.map((s,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:8,fontSize:13,color:"var(--cream-60)"}}><span style={{color:"var(--teal)",flexShrink:0}}>◎</span>{s}</div>)}
                </div>
                <div className="card card-sm">
                  <div className="mono" style={{marginBottom:10,fontSize:"9px"}}>Key Risks</div>
                  {data.risks?.map((r,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:8,fontSize:13,color:"var(--cream-60)"}}><span style={{color:"var(--rose)",flexShrink:0}}>◇</span>{r}</div>)}
                </div>
              </div>

              <div style={{padding:"24px",background:"var(--raised)",border:"1px solid var(--line-gold)",borderRadius:16,textAlign:"center"}}>
                <div className="mono" style={{marginBottom:10,fontSize:"9px"}}>A Truth Worth Holding</div>
                <p style={{fontFamily:"var(--f-display)",fontSize:20,fontStyle:"italic",color:"var(--gold)",fontWeight:400,lineHeight:1.5}}>
                  &ldquo;{data.closing}&rdquo;
                </p>
              </div>

              {!isPaid&&(
                <div style={{marginTop:24,padding:"20px 24px",background:"linear-gradient(135deg,rgba(210,175,90,0.08),rgba(31,168,154,0.05))",border:"1px solid var(--line-gold)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                  <div>
                    <div className="mono" style={{marginBottom:4,fontSize:"9px"}}>Detected in your profile</div>
                    <p style={{fontSize:14,fontStyle:"italic",color:"var(--cream-60)",lineHeight:1.7}}>"{data.teaser}"</p>
                  </div>
                  <button className="btn btn-gold" style={{flexShrink:0}} onClick={onUnlock}>Unlock Full Report</button>
                </div>
              )}
            </div>
          )}

          {/* ROADMAP */}
          {mod==="roadmap"&&(
            <LockGate>
              <div className="fu">
                <div className="d3" style={{marginBottom:6}}>Your Transformation Roadmap</div>
                <p className="body" style={{marginBottom:28}}>A structured sequence built for your specific situation — not a generic plan.</p>
                {data.roadmap?.map((r,i)=>(
                  <div className="timeline-item" key={i}>
                    <div className="t-dot">{String(i+1).padStart(2,"0")}</div>
                    <div className="t-body">
                      <div className="t-phase">{r.phase}</div>
                      <div className="t-title">{r.title}</div>
                      <p className="t-desc">{r.desc}</p>
                      {r.win&&<div className="t-win"><strong>This week:</strong> {r.win}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </LockGate>
          )}

          {/* MINDSET */}
          {mod==="mindset"&&(
            <LockGate>
              <div className="fu">
                <div className="d3" style={{marginBottom:20}}>Mindset & Emotional Intelligence</div>
                {[
                  {icon:"◇",title:"The Pattern",key:"pattern",accent:"rose"},
                  {icon:"↺",title:"The Reframe",key:"reframe",accent:"gold"},
                  {icon:"◎",title:"The Emotional Layer",key:"emotional",accent:"violet"},
                  {icon:"◈",title:"Your Daily Practice",key:"practice",accent:"teal"},
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

          {/* CAREER */}
          {mod==="career"&&(
            <LockGate>
              <div className="fu">
                <div className="d3" style={{marginBottom:6}}>Career & Business Opportunities</div>
                <p className="body" style={{marginBottom:24}}>Identified for your specific skills, location, and stage.</p>
                {data.career?.map((o,i)=>(
                  <div className="card" key={i} style={{marginBottom:14,display:"flex",gap:16}}>
                    <div style={{width:44,height:44,borderRadius:10,background:"var(--gold-dim)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                      {o.type==="job"?"💼":o.type==="business"?"⚡":"◈"}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"var(--f-display)",fontSize:18,fontWeight:500,marginBottom:6}}>{o.title}</div>
                      <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75,marginBottom:10}}>{o.desc}</p>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <span className="tag tg">{o.type}</span>
                        <span className="tag tt">{o.timeline}</span>
                        <span className="tag" style={{background:"transparent",border:"1px solid var(--line)",color:"var(--cream-30)",fontSize:"9px",padding:"3px 9px",borderRadius:5,fontFamily:"var(--f-mono)"}}>Effort: {o.effort}</span>
                        <span className="tag tv">{o.income}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </LockGate>
          )}

          {/* RELOCATE */}
          {mod==="relocate"&&(
            <LockGate>
              <div className="fu">
                <div className="d3" style={{marginBottom:6}}>Relocation Intelligence</div>
                <p className="body" style={{marginBottom:24}}>Countries ranked specifically for your profile — not a generic list.</p>
                {data.relocation?.map((r,i)=>(
                  <div className="card" key={i} style={{marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{fontFamily:"var(--f-display)",fontSize:22,fontWeight:500}}>{r.country}</div>
                      <div style={{padding:"4px 12px",borderRadius:20,background:r.fit>=75?"var(--teal-dim)":"var(--gold-dim)",color:r.fit>=75?"var(--teal)":"var(--gold)",border:`1px solid ${r.fit>=75?"rgba(31,168,154,0.2)":"rgba(210,175,90,0.2)"}`,fontFamily:"var(--f-mono)",fontSize:11}}>
                        {r.fit}% match
                      </div>
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
                <div className="insight teal" style={{marginTop:8}}>
                  <p style={{fontSize:13,color:"var(--cream-60)",lineHeight:1.75}}>Visa requirements change frequently. Always verify with official embassy sources before making relocation decisions.</p>
                </div>
              </div>
            </LockGate>
          )}

          {/* ADVISOR */}
          {mod==="advisor"&&(
            isPaid
              ? <AdvisorChat profile={formData} reportData={data}/>
              : <div className="fu" style={{textAlign:"center",padding:"40px 0"}}>
                  <div style={{fontSize:36,marginBottom:16}}>⬡</div>
                  <div className="d3" style={{marginBottom:12}}>Live Advisor Conversations</div>
                  <p className="body" style={{maxWidth:400,margin:"0 auto 24px"}}>Ask anything about your report, your situation, and what to do next. Get answers specific to you — not scripted responses.</p>
                  <button className="btn btn-gold" onClick={onUnlock}>Unlock Advisor Access</button>
                </div>
          )}

          {/* Bottom bar */}
          <div style={{marginTop:48,paddingTop:28,borderTop:"1px solid var(--line)",display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
            <div className="small">Last updated · {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
            <div style={{display:"flex",gap:8}}>
              {isPaid&&<button className="btn btn-ghost" style={{fontSize:12}}>Download PDF</button>}
              {isPaid&&<button className="btn btn-ghost" style={{fontSize:12}}>Share Score</button>}
              {!isPaid&&<button className="btn btn-gold" onClick={onUnlock}>Unlock Full Report</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="disc">Destiniq is a personal intelligence platform. All insights are frameworks for reflection, not professional advice.</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function DestiniqApp(){
  const [screen,  setScreen  ]=useState("landing");
  const [formData,setFormData]=useState(null);
  const [report,  setReport  ]=useState(null);
  const [isPaid,  setIsPaid  ]=useState(false);
  const [streak,  setStreak  ]=useState(1);
  const [showCI,  setShowCI  ]=useState(false);

  const handleSubmit=useCallback(async(f)=>{
    setFormData(f);setScreen("loading");
    try{
      const raw=await ask(
        [{role:"user",content:buildAnalysisPrompt(f)}],
        "You are Destiniq's analytical engine. Return ONLY valid JSON, no markdown, no code fences, no explanation."
      );
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setReport(parsed);
    }catch{setReport(fallback(f));}
    setScreen("results");
  },[]);

  const restart=()=>{setScreen("landing");setFormData(null);setReport(null);setIsPaid(false);setStreak(1);setShowCI(false);};
  const handleUnlock=()=>{setIsPaid(false);setScreen("paywall");};
  const handlePay=()=>{setIsPaid(true);setStreak(s=>s+1);setScreen("results");};

  return(
    <>
      <style>{CSS}</style>
      <div className="bg bg-mesh"/>
      <div className="bg bg-noise"/>
      <div className="bg bg-grid"/>
      <div className="root">
        {/* NAV */}
        <nav className="nav">
          <div className="logo" onClick={restart}>Destin<b>iq</b></div>
          <div className="nav-r">
            {screen==="results"&&!isPaid&&<button className="btn btn-gold" style={{fontSize:12,padding:"8px 18px"}} onClick={handleUnlock}>Upgrade</button>}
            {screen==="results"&&isPaid&&<div className="streak-badge"><span className="streak-fire">🔥</span>{streak} day streak</div>}
            {screen!=="landing"&&<button className="btn btn-ghost" style={{fontSize:12,padding:"8px 18px"}} onClick={restart}>← Home</button>}
            {screen==="landing"&&<button className="btn btn-gold" style={{fontSize:12,padding:"8px 18px"}} onClick={()=>setScreen("intake")}>Begin →</button>}
          </div>
        </nav>

        {screen==="landing" &&<Landing   onStart={()=>setScreen("intake")}/>}
        {screen==="intake"  &&<Intake    onSubmit={handleSubmit}/>}
        {screen==="loading" &&<Loading/>}
        {screen==="paywall" &&<Paywall   onUnlock={handlePay} teaser={report?.teaser||""}/>}
        {screen==="results" &&report&&(
          <Dashboard
            data={report} formData={formData}
            isPaid={isPaid} onUnlock={handleUnlock}
            streak={streak}
            showCheckin={showCI} setShowCheckin={setShowCI}
          />
        )}
      </div>
    </>
  );
}
