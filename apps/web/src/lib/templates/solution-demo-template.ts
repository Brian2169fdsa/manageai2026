// ── Solution Demo Template (Sunstate Solution Demo format) ───────────────────
// This is the static HTML shell. Claude generates only the data JSON.
// Assembly replaces these placeholders with generated JSON data:
//   __MANAGEAI_DATA__              → main editor fields (clientName, etc.)
//   __MANAGEAI_TRIP_DATA__         → trip/record data array
//   __MANAGEAI_TRANSCRIPT_LINES__  → transcript conversation lines
//   __MANAGEAI_TECH_STACK__        → technology stack cards
//   __MANAGEAI_SCENARIOS__         → scenario specifications

export function getSolutionDemoTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sunstate Medical Transport — Call-Ahead System | ManageAI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 4px; height: 8px; }
  ::-webkit-scrollbar-track { background: #F8F9FB; }
  ::-webkit-scrollbar-thumb { background: #C8CDD5; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #A0A8B4; }
  body { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; background: #FFFFFF; color: #1A1A2E; }
  @keyframes floatUp { 0%{opacity:0;transform:translateY(0) scale(1)}10%{opacity:.2}90%{opacity:0}100%{opacity:0;transform:translateY(-800px) scale(0)} }
  @keyframes pulseGlow { 0%,100%{box-shadow:0 0 15px rgba(74,143,214,.06)}50%{box-shadow:0 0 30px rgba(74,143,214,.18)} }
  @keyframes slideIn { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
  @keyframes dataFlow { 0%{background-position:0% 50%}100%{background-position:200% 50%} }
  @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.4);opacity:1} }
  @keyframes fadeIn { from{opacity:0}to{opacity:1} }
  @keyframes typing { from{width:0}to{width:100%} }
  @keyframes blink { 50%{border-color:transparent} }
  @keyframes ringPulse { 0%{box-shadow:0 0 0 0 rgba(34,168,96,0.4)}70%{box-shadow:0 0 0 12px rgba(34,168,96,0)}100%{box-shadow:0 0 0 0 rgba(34,168,96,0)} }
  @keyframes waveform { 0%,100%{height:4px}50%{height:18px} }
  textarea:focus, input:focus { outline: none; border-color: #4A8FD6 !important; }
</style>
</head>
<body>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script>
const e = React.createElement;
const { useState, useEffect, useRef } = React;

const C = {
  accent:"#4A8FD6",accentDim:"rgba(74,143,214,0.07)",bg:"#FFFFFF",
  surface:"#F8F9FB",surface2:"#F0F2F5",border:"#E2E5EA",
  text:"#1A1A2E",textDim:"#8890A0",textMid:"#5A6070",
  success:"#22A860",warning:"#E5A200",danger:"#E04848",
  logo:"#2A2A3E",purple:"#7C5CFC",orange:"#E8723A",teal:"#1AA8A8",
};
const mono = "'JetBrains Mono', monospace";

// ===== MOCK DATA =====
const tripData = __MANAGEAI_TRIP_DATA__;

const transcriptLines = __MANAGEAI_TRANSCRIPT_LINES__;

function getDefaultData() {
  return __MANAGEAI_DATA__;
}

function EditorField({label, value, onChange, multi, mono: isMono}) {
  const base = {width:"100%",padding:"7px 10px",borderRadius:6,border:"1px solid "+C.border,background:C.bg,color:C.text,fontSize:12,fontFamily:"'DM Sans', sans-serif"};
  const style = {...base, ...(isMono ? {fontFamily:mono,fontSize:11} : {}), ...(multi ? {resize:"vertical",minHeight:54} : {})};
  return e("div",{style:{marginBottom:8}},
    e("label",{style:{fontSize:9,fontWeight:600,color:C.textDim,letterSpacing:"0.05em",display:"block",marginBottom:3,textTransform:"uppercase"}},label),
    multi ? e("textarea",{value:value||"",onChange:ev=>onChange(ev.target.value),style}) : e("input",{type:"text",value:value||"",onChange:ev=>onChange(ev.target.value),style})
  );
}

function App() {
  const [activeView, setActiveView] = useState("overview");
  const [activeProto, setActiveProto] = useState("manifest");
  const [expandedScenario, setExpandedScenario] = useState(null);
  const [animPhase, setAnimPhase] = useState(0);
  const [callStep, setCallStep] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [data, setData] = useState(getDefaultData());
  const [panelOpen, setPanelOpen] = useState(false);
  const [editSection, setEditSection] = useState("overview");
  const [saveStatus, setSaveStatus] = useState(null);
  const [loadStatus, setLoadStatus] = useState(null);
  const [manualId, setManualId] = useState(null);

  // ---- SUPABASE CONFIG ----
  const sbUrl = "https://abqwambiblgjztzkrbzg.supabase.co";
  const sbKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFicXdhbWJpYmxnanp0emtyYnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNTA0NzIsImV4cCI6MjA4NzYyNjQ3Mn0.e10i_DqoLwS0UQhEoJGOGRtBlm4dsYxEbPQ3XFkpwQc";
  function sbHeaders() { return {"Content-Type":"application/json","apikey":sbKey,"Authorization":"Bearer "+sbKey,"Prefer":"return=representation"}; }
  async function sbPost(table, rows) {
    const res = await fetch(sbUrl+"/rest/v1/"+table, {method:"POST",headers:{...sbHeaders(),"Prefer":"return=representation,resolution=merge-duplicates"},body:JSON.stringify(rows)});
    if (!res.ok) throw new Error("POST "+table+" failed: "+await res.text()); return res.json();
  }
  async function sbDelete(table, col, val) {
    const res = await fetch(sbUrl+"/rest/v1/"+table+"?"+col+"=eq."+val, {method:"DELETE",headers:sbHeaders()});
    if (!res.ok) throw new Error("DELETE "+table+" failed");
  }
  async function sbGet(table, col, val) {
    const order = table === "ca_demos" ? "" : "&order=sort_order.asc";
    const res = await fetch(sbUrl+"/rest/v1/"+table+"?"+col+"=eq."+val+order, {method:"GET",headers:{...sbHeaders(),"Accept":"application/json"}});
    if (!res.ok) throw new Error("GET "+table+" failed"); return res.json();
  }

  /*
  ╔═══════════════════════════════════════════════════════════════╗
  ║  SUPABASE SCHEMA — Run in SQL Editor                         ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║  CREATE TABLE ca_demos (                                      ║
  ║    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,             ║
  ║    client_name TEXT, solution_name TEXT, version TEXT,         ║
  ║    stack TEXT, confidential_line TEXT,                         ║
  ║    overview_title TEXT, overview_desc TEXT,                    ║
  ║    callout_title TEXT, callout_body TEXT,                      ║
  ║    retell_agent_id TEXT, retell_from_number TEXT,              ║
  ║    retell_voice_engine TEXT, retell_dash_url TEXT,             ║
  ║    sheet_id TEXT, sheet_range TEXT,                            ║
  ║    manifest_title TEXT, manifest_date TEXT,                    ║
  ║    stats_scenarios TEXT, stats_tools TEXT,                     ║
  ║    stats_gpt_stages TEXT,                                     ║
  ║    created_at TIMESTAMPTZ DEFAULT now(),                      ║
  ║    updated_at TIMESTAMPTZ DEFAULT now()                       ║
  ║  );                                                           ║
  ║  -- Enable RLS + anon policies                                ║
  ║  ALTER TABLE ca_demos ENABLE ROW LEVEL SECURITY;              ║
  ║  CREATE POLICY "anon_all" ON ca_demos FOR ALL                 ║
  ║    USING (true) WITH CHECK (true);                            ║
  ╚═══════════════════════════════════════════════════════════════╝
  */

  async function saveToCloud() {
    setSaveStatus('saving');
    try {
      const row = {client_name:data.clientName,solution_name:data.solutionName,version:data.version,stack:data.stack,confidential_line:data.confidentialLine,overview_title:data.overviewTitle,overview_desc:data.overviewDesc,callout_title:data.calloutTitle,callout_body:data.calloutBody,retell_agent_id:data.retellAgentId,retell_from_number:data.retellFromNumber,retell_voice_engine:data.retellVoiceEngine,retell_dash_url:data.retellDashUrl,sheet_id:data.sheetId,sheet_range:data.sheetRange,manifest_title:data.manifestTitle,manifest_date:data.manifestDate,stats_scenarios:data.statsScenarios,stats_tools:data.statsTools,stats_gpt_stages:data.statsGptStages,updated_at:new Date().toISOString()};
      if (manualId) row.id = manualId;
      const [saved] = await sbPost("ca_demos",[row]);
      if (!manualId) setManualId(saved.id);
      setSaveStatus('saved');
    } catch(err){console.error("Save error:",err);setSaveStatus('error');}
    setTimeout(()=>setSaveStatus(null),3000);
  }

  async function loadFromCloud(overrideId) {
    setLoadStatus('loading');
    try {
      let mid = overrideId || manualId;
      if (!mid) {
        const res = await fetch(sbUrl+"/rest/v1/ca_demos?order=updated_at.desc&limit=1",{headers:{...sbHeaders(),"Accept":"application/json"}});
        const rows = await res.json();
        if (!rows.length){setLoadStatus(null);return;}
        mid = rows[0].id;
      }
      setManualId(mid);
      const [master] = await sbGet("ca_demos","id",mid);
      if (!master) throw new Error("Not found");
      setData({clientName:master.client_name,solutionName:master.solution_name,version:master.version,stack:master.stack,confidentialLine:master.confidential_line,overviewTitle:master.overview_title,overviewDesc:master.overview_desc,calloutTitle:master.callout_title,calloutBody:master.callout_body,retellAgentId:master.retell_agent_id||getDefaultData().retellAgentId,retellFromNumber:master.retell_from_number||getDefaultData().retellFromNumber,retellVoiceEngine:master.retell_voice_engine||getDefaultData().retellVoiceEngine,retellDashUrl:master.retell_dash_url||getDefaultData().retellDashUrl,sheetId:master.sheet_id||getDefaultData().sheetId,sheetRange:master.sheet_range||getDefaultData().sheetRange,manifestTitle:master.manifest_title||getDefaultData().manifestTitle,manifestDate:master.manifest_date||getDefaultData().manifestDate,statsScenarios:master.stats_scenarios||getDefaultData().statsScenarios,statsTools:master.stats_tools||getDefaultData().statsTools,statsGptStages:master.stats_gpt_stages||getDefaultData().statsGptStages});
      setLoadStatus('loaded');
    } catch(err){console.error("Load error:",err);setLoadStatus(null);}
    setTimeout(()=>setLoadStatus(null),3000);
  }

  useEffect(()=>{loadFromCloud();},[]);

  useEffect(() => {
    const i = setInterval(() => setAnimPhase(p => (p+1) % 6), 2800);
    return () => clearInterval(i);
  }, []);

  // Call simulation auto-advance
  useEffect(() => {
    if (!isCallActive) return;
    if (visibleLines >= transcriptLines.length) {
      setTimeout(() => setCallStep(3), 1500); // move to analysis
      return;
    }
    const t = setTimeout(() => setVisibleLines(v => v + 1), 2200);
    return () => clearTimeout(t);
  }, [isCallActive, visibleLines]);

  const views = [
    {id:"overview",label:"Overview"},
    {id:"prototype",label:"Prototype"},
    {id:"howitworks",label:"How it Works"},
    {id:"buildspec",label:"Build Spec"},
  ];

  function navBtn(v) {
    const isA = activeView===v.id;
    return e("button",{key:v.id,onClick:()=>setActiveView(v.id),style:{padding:"8px 13px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:500,fontFamily:"'DM Sans', sans-serif",letterSpacing:"0.02em",transition:"all 0.3s ease",background:isA?C.accent:"transparent",color:isA?"#FFF":C.textDim}},v.label);
  }

  function statusBadge(status) {
    const map = {confirmed:{bg:C.success,label:"Confirmed"},rescheduled:{bg:C.warning,label:"Rescheduled"},cancelled:{bg:C.danger,label:"Cancelled"},pending:{bg:C.border,label:"Pending"},voicemail:{bg:C.orange,label:"Voicemail"},retry:{bg:C.purple,label:"Auto-Retry"}};
    const s = map[status] || map.pending;
    return e("span",{style:{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,background:s.bg+"18",color:s.bg,border:"1px solid "+s.bg+"30",whiteSpace:"nowrap"}},s.label);
  }

  // ============ OVERVIEW ============
  function overviewView() {
    const stats = [
      {label:"Make.com Scenarios",value:data.statsScenarios,sub:"CA-01 through CA-06",color:C.accent},
      {label:"Voice Agent Tools",value:data.statsTools,sub:"Cancel · Reschedule · Notes · Check",color:C.purple},
      {label:"GPT Analysis Stages",value:data.statsGptStages,sub:"Contact Classification → Data Extraction",color:C.teal},
    ];
    const flow = [
      {icon:"📋",label:"Trip Manifest",sub:"Google Sheets",clr:C.accent},
      {icon:"📞",label:"Retell AI",sub:"Voice Agent Call",clr:C.purple},
      {icon:"🤖",label:"GPT-4.1",sub:"2-Stage Classify",clr:C.teal},
      {icon:"📊",label:"Sheet Update",sub:"Results Written",clr:C.success},
      {icon:"📧",label:"Dispatch Alert",sub:"HTML Email",clr:C.orange},
    ];
    const scopeIn = [
      "Batch outbound dialing: read trip manifest, iterate unprocessed rows, initiate Retell AI calls",
      "AI voice agent conversations with natural language facility verification",
      "Mid-call tool actions: cancel trips, reschedule pickups, update clinical notes in real time",
      "Post-call transcript analysis: GPT-4.1 two-stage classification and structured extraction",
      "Dispatch notification: formatted HTML email alerts with call results and action items",
      "Google Sheets dashboard: trip manifest serves as live status board with call outcomes",
      "External API trigger: webhook endpoint for chatbot/GPT integration",
    ];
    const scopeOut = [
      "Automated retry logic with exponential backoff (voicemail → wait → retry)",
      "Real-time WebSocket dashboard for live call monitoring",
      "Database migration from Google Sheets to Postgres/Supabase",
      "Multi-tenant support for selling to other transport companies",
      "HIPAA-compliant audit logging beyond what Make.com provides",
      "Priority queuing (urgent transports first)",
    ];

    return e("div",{style:{animation:"slideIn 0.5s ease"}},
      e("div",{style:{marginBottom:28}},
        e("h2",{style:{fontSize:22,fontWeight:600,margin:"0 0 6px"}},data.overviewTitle),
        e("p",{style:{fontSize:13,color:C.textDim,margin:0,maxWidth:720,lineHeight:1.6}},data.overviewDesc)
      ),
      // Flow
      e("div",{style:{padding:24,borderRadius:12,background:C.surface,border:"1px solid "+C.border,marginBottom:20}},
        e("div",{style:{fontSize:12,fontWeight:600,color:C.accent,letterSpacing:"0.04em",marginBottom:18}},"CALL-AHEAD PIPELINE"),
        e("div",{style:{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",alignItems:"center"}},
          flow.map((item,i) => [
            e("div",{key:"n"+i,style:{padding:"10px 14px",borderRadius:10,background:C.bg,border:"2px solid "+item.clr,textAlign:"center",minWidth:100}},
              e("div",{style:{fontSize:18,marginBottom:3}},item.icon),
              e("div",{style:{fontSize:10,fontWeight:600,fontFamily:mono,color:item.clr}},item.label),
              e("div",{style:{fontSize:8,color:C.textDim,marginTop:1}},item.sub)
            ),
            i < flow.length-1 ? e("span",{key:"a"+i,style:{color:C.textDim,fontSize:14,flexShrink:0}},"→") : null
          ]).flat().filter(Boolean)
        )
      ),
      // Stats
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:14,marginBottom:20}},
        stats.map((s,i) => e("div",{key:i,style:{padding:20,borderRadius:12,background:C.surface,border:"1px solid "+C.border,borderTop:"3px solid "+s.color}},
          e("div",{style:{fontSize:10,fontWeight:600,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}},s.label),
          e("div",{style:{fontSize:28,fontWeight:700,fontFamily:mono,color:C.text}},s.value),
          e("div",{style:{fontSize:11,color:C.textDim,marginTop:4}},s.sub)
        ))
      ),
      // Scope
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:16,marginBottom:20}},
        e("div",{style:{padding:20,borderRadius:12,background:C.success+"06",border:"1px solid "+C.success+"20"}},
          e("div",{style:{fontSize:11,fontWeight:600,color:C.success,letterSpacing:"0.06em",marginBottom:12,textTransform:"uppercase"}},"In Scope — Phase 1"),
          e("div",{style:{display:"flex",flexDirection:"column",gap:8}},scopeIn.map((item,i)=>e("div",{key:i,style:{display:"flex",alignItems:"flex-start",gap:8,fontSize:11,color:C.textMid,lineHeight:1.5}},e("span",{style:{color:C.success,flexShrink:0,fontWeight:700,marginTop:1}},"✓"),item)))
        ),
        e("div",{style:{padding:20,borderRadius:12,background:C.danger+"06",border:"1px solid "+C.danger+"20"}},
          e("div",{style:{fontSize:11,fontWeight:600,color:C.danger,letterSpacing:"0.06em",marginBottom:12,textTransform:"uppercase"}},"Out of Scope — Phase 1"),
          e("div",{style:{display:"flex",flexDirection:"column",gap:8}},scopeOut.map((item,i)=>e("div",{key:i,style:{display:"flex",alignItems:"flex-start",gap:8,fontSize:11,color:C.textMid,lineHeight:1.5}},e("span",{style:{color:C.danger,flexShrink:0,fontWeight:700,marginTop:1}},"×"),item)))
        )
      ),
      // Mid-call callout
      e("div",{style:{padding:"16px 20px",borderRadius:10,background:C.purple+"08",border:"1px solid "+C.purple+"22",display:"flex",alignItems:"flex-start",gap:12}},
        e("span",{style:{fontSize:18,flexShrink:0}},"🔧"),
        e("div",null,
          e("div",{style:{fontSize:12,fontWeight:600,color:C.purple,marginBottom:3}},data.calloutTitle),
          e("div",{style:{fontSize:11,color:C.textMid,lineHeight:1.6}},data.calloutBody)
        )
      )
    );
  }

  // ============ PROTOTYPE ============
  function prototypeView() {
    const tabs = [
      {id:"manifest",label:"Trip Manifest",color:C.accent},
      {id:"retell",label:"Retell Set Up",color:C.success},
      {id:"sheet",label:"Call Results Sheet",color:C.orange},
      {id:"flow",label:"System Flow",color:C.purple},
    ];
    const active = tabs.find(t=>t.id===activeProto) || tabs[0];

    function manifestTab() {
      var typeBadge = function(t){var c=t==="Stretcher"?C.danger:t==="Wheelchair"?C.warning:C.teal;return e("span",{style:{fontSize:10,padding:"2px 8px",borderRadius:4,background:c+"10",color:c,fontWeight:600}},t);};
      var headers = ["Date","Pickup Time","Patient Name","Patient Phone","Patient Email","Facility Name","Facility Phone","Pickup Address","Destination","Trip Type"];
      var colKeys = ["date","time","patient","patPhone","patEmail","facility","facPhone","pickup","dest","type"];

      return e("div",{style:{animation:"fadeIn 0.3s ease"}},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}},
          e("div",null,
            e("div",{style:{fontSize:14,fontWeight:600}},data.manifestTitle),
            e("div",{style:{fontSize:11,color:C.textDim}},data.manifestDate+" · "+tripData.length+" transports · "+tripData.filter(function(r){return r.caStatus==="confirmed";}).length+" confirmed · "+tripData.filter(function(r){return r.caStatus==="rescheduled";}).length+" rescheduled · "+tripData.filter(function(r){return r.caStatus==="cancelled";}).length+" cancelled · "+tripData.filter(function(r){return r.caStatus==="pending";}).length+" pending")
          ),
          e("div",{style:{display:"flex",gap:6}},
            [{label:"Confirmed",color:C.success},{label:"Rescheduled",color:C.warning},{label:"Cancelled",color:C.danger},{label:"Pending",color:C.border}].map(function(b){return e("div",{key:b.label,style:{fontSize:10,fontWeight:600,padding:"4px 10px",borderRadius:12,background:b.color+"15",color:b.color===C.border?C.textDim:b.color,border:"1px solid "+(b.color===C.border?C.border:b.color+"30")}},b.label);})
          )
        ),
        e("div",{style:{borderRadius:10,border:"1px solid "+C.border,overflow:"hidden"}},
          e("div",{style:{overflowX:"auto"}},
            e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:1100}},
              e("thead",null,e("tr",{style:{background:C.surface}},
                headers.map(function(h,i){return e("th",{key:i,style:{padding:"10px 10px",textAlign:"left",fontSize:10,fontWeight:600,color:C.textDim,letterSpacing:"0.04em",borderBottom:"2px solid "+C.border,whiteSpace:"nowrap"}},h);})
              )),
              e("tbody",null,tripData.map(function(row,ri){
                return e("tr",{key:ri,style:{borderBottom:"1px solid "+C.surface2,background:ri%2===0?C.bg:C.surface+"80",transition:"background 0.15s"},onMouseEnter:function(ev){ev.currentTarget.style.background=C.accentDim;},onMouseLeave:function(ev){ev.currentTarget.style.background=ri%2===0?C.bg:C.surface+"80";}},
                  colKeys.map(function(k,ci){
                    var val=row[k]||"";
                    if(k==="type") return e("td",{key:ci,style:{padding:"8px 10px"}},typeBadge(val));
                    return e("td",{key:ci,style:{padding:"8px 10px",fontSize:ci===4||ci===7||ci===8?10:11,fontFamily:ci===3||ci===6?mono:"inherit",color:ci===2?C.text:C.textMid,fontWeight:ci===2?600:400,maxWidth:ci===7||ci===8?150:undefined,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},val||"—");
                  })
                );
              }))
            )
          )
        ),
        e("div",{style:{marginTop:12,padding:"10px 14px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,fontSize:11,color:C.textDim,display:"flex",justifyContent:"space-between"}},
          e("span",null,"Source: Google Sheets · Spreadsheet ID: "+data.sheetId),
          e("span",{style:{fontFamily:mono}},"10 Columns · Read/Write")
        )
      );
    }

    function retellTab() {
      return e("div",{style:{animation:"fadeIn 0.3s ease"}},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}},
          e("div",null,
            e("div",{style:{fontSize:14,fontWeight:600}},"Retell AI Dashboard"),
            e("div",{style:{fontSize:11,color:C.textDim}},"Voice agent configuration, call history, and analytics")
          ),
          e("a",{href:data.retellDashUrl,target:"_blank",rel:"noopener noreferrer",style:{fontSize:11,fontWeight:600,padding:"8px 16px",borderRadius:6,background:C.success,color:"#fff",textDecoration:"none",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}},"↗ Open Retell Dashboard")
        ),
        // Agent config summary
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:10,marginBottom:16}},
          [{l:"Agent ID",v:data.retellAgentId,color:C.purple},{l:"From Number",v:data.retellFromNumber,color:C.accent},{l:"Voice Engine",v:data.retellVoiceEngine,color:C.teal}].map(function(c){return e("div",{key:c.l,style:{padding:"14px 16px",borderRadius:8,background:C.surface,border:"1px solid "+C.border}},
            e("div",{style:{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:"0.04em",marginBottom:4}},c.l),
            e("div",{style:{fontSize:13,fontWeight:700,fontFamily:mono,color:c.color}},c.v)
          );})
        ),
        // Embedded dashboard
        e("div",{style:{borderRadius:12,border:"1px solid "+C.border,overflow:"hidden",background:C.surface}},
          e("div",{style:{padding:"10px 16px",background:C.bg,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"space-between"}},
            e("div",{style:{display:"flex",alignItems:"center",gap:8}},
              e("div",{style:{width:8,height:8,borderRadius:"50%",background:C.success,animation:"pulseDot 2s infinite"}}),
              e("span",{style:{fontSize:11,fontWeight:600,color:C.success}},"Live Dashboard")
            ),
            e("span",{style:{fontSize:10,color:C.textDim,fontFamily:mono}},"dashboard.retellai.com")
          ),
          e("iframe",{src:"retell-dashboard-mock.html",style:{width:"100%",height:900,border:"none",background:C.bg},title:"Retell AI Dashboard",allow:"clipboard-read; clipboard-write"}),
          e("div",{style:{padding:"12px 16px",background:C.surface,borderTop:"1px solid "+C.border,fontSize:11,color:C.textDim,display:"flex",alignItems:"center",justifyContent:"space-between"}},
            e("span",null,"If the dashboard doesn't load, click \\"Open Retell Dashboard\\" above to access it directly."),
            e("span",{style:{fontFamily:mono,fontSize:10}},"Powered by Retell AI")
          )
        ),
      );
    }

    function sheetTab() {
      var sheetRows = tripData; // Use same data as manifest
      var headers = ["A: date","B: pickup_time","C: patient_name","D: patient_phone","E: patient_email","F: facility_name","G: facility_phone","H: pickup_address","I: destination","J: trip_type","K: callahead_status","L: notes","M: call_result","N: call_notes","O: call_timestamp"];
      var colKeys = ["date","time","patient","patPhone","patEmail","facility","facPhone","pickup","dest","type","caStatus","notes","callResult","callNotes","callTs"];
      var statusColor = function(s){if(!s||s==="pending")return{bg:C.surface,fg:C.textDim};if(s==="confirmed"||s==="Confirmed")return{bg:C.success+"12",fg:C.success};if(s==="rescheduled"||s==="Rescheduled")return{bg:C.warning+"12",fg:C.warning};if(s==="cancelled"||s==="Cancelled")return{bg:C.danger+"12",fg:C.danger};if(s==="voicemail"||s==="Voicemail"||s==="retry"||s==="Wrong Party")return{bg:C.orange+"12",fg:C.orange};return{bg:C.surface,fg:C.textDim};};

      return e("div",{style:{animation:"fadeIn 0.3s ease"}},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
          e("div",null,
            e("div",{style:{fontSize:14,fontWeight:600}},"Google Sheets — Call Results Dashboard"),
            e("div",{style:{fontSize:11,color:C.textDim}},"Spreadsheet ID: "+data.sheetId+" · Range: "+data.sheetRange+" · Read/Write by all 6 scenarios")
          ),
          e("div",{style:{display:"flex",gap:6}},
            [{label:"Cols A–J",desc:"Trip Data (Input)",color:C.accent},{label:"Col K",desc:"Call-Ahead Status",color:C.warning},{label:"Cols L–O",desc:"AI Results (Output)",color:C.success}].map(function(b){return e("div",{key:b.label,style:{fontSize:10,padding:"4px 10px",borderRadius:6,background:b.color+"10",border:"1px solid "+b.color+"25",textAlign:"center"}},e("div",{style:{fontWeight:700,color:b.color}},b.label),e("div",{style:{color:C.textDim,fontSize:9,marginTop:1}},b.desc));})
          )
        ),
        e("div",{style:{borderRadius:"10px 10px 0 0",border:"1px solid "+C.border,overflow:"hidden"}},
          e("div",{style:{overflowX:"scroll",overflowY:"auto",maxHeight:480}},
            e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:1800,tableLayout:"fixed"}},
              e("colgroup",null,
                colKeys.map(function(_,ci){var w=ci===2||ci===5?"130px":ci===7||ci===8?"150px":ci===11||ci===13?"140px":ci===14?"130px":"95px";return e("col",{key:ci,style:{width:w}});})
              ),
              e("thead",null,
                e("tr",{style:{background:C.logo}},
                  headers.map(function(h,hi){var isOutput=hi>=10;return e("th",{key:hi,style:{padding:"6px 8px",textAlign:"left",fontSize:9,fontWeight:600,color:isOutput?C.success:"#fff",letterSpacing:"0.03em",borderRight:"1px solid rgba(255,255,255,0.1)",whiteSpace:"nowrap",background:isOutput?"rgba(34,168,96,0.15)":"transparent",overflow:"hidden",textOverflow:"ellipsis"}},h);})
                )
              ),
              e("tbody",null,
                sheetRows.map(function(row,ri){return e("tr",{key:ri,style:{borderBottom:"1px solid "+C.surface2,background:ri%2===0?C.bg:C.surface+"60"}},
                  colKeys.map(function(k,ci){var val=k?row[k]:"";var isOutput=ci>=10;var sc=ci===10?statusColor(val):ci===12?statusColor(val):{bg:"transparent",fg:C.text};
                    return e("td",{key:ci,style:{padding:"7px 8px",fontSize:10,fontFamily:ci===3||ci===6||ci===14?mono:"inherit",color:isOutput?sc.fg:C.textMid,fontWeight:ci===2||ci===10||ci===12?700:400,background:isOutput?sc.bg:"transparent",borderRight:"1px solid "+C.surface2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},val||"\\u2014");
                  })
                );})
              )
            )
          )
        ),
        e("div",{style:{marginTop:12,padding:"10px 14px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}},
          e("div",{style:{display:"flex",gap:10,alignItems:"center"}},
            [{label:"Confirmed",color:C.success},{label:"Rescheduled",color:C.warning},{label:"Cancelled",color:C.danger},{label:"Voicemail / Retrying",color:C.orange},{label:"Pending",color:C.textDim}].map(function(s){return e("div",{key:s.label,style:{display:"flex",alignItems:"center",gap:4,fontSize:10}},e("div",{style:{width:8,height:8,borderRadius:2,background:s.color}}),e("span",{style:{color:C.textMid}},s.label));})
          ),
          e("div",{style:{fontSize:10,color:C.textDim,fontFamily:mono}},""+sheetRows.length+" rows \\u00b7 15 columns \\u00b7 Last write: 2026-03-02 07:17")
        ),
        e("div",{style:{marginTop:12,padding:14,borderRadius:10,background:C.purple+"06",border:"1px solid "+C.purple+"20"}},
          e("div",{style:{fontSize:11,fontWeight:700,color:C.purple,marginBottom:8}},"Which Scenarios Write Where"),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:8}},
            [{sc:"CA-01",name:"Batch Dialer",writes:"Col K (status lock)",color:C.accent},{sc:"CA-02",name:"Result Router",writes:"Cols K, L, M, N, O",color:C.purple},{sc:"CA-03",name:"Direct Trigger",writes:"Cols A\\u2013K (new row + lock)",color:C.teal},{sc:"CA-04",name:"Cancel Trip",writes:"Cols K\\u2013O (Cancelled)",color:C.danger},{sc:"CA-05",name:"Reschedule",writes:"Cols B, K\\u2013O (new time)",color:C.warning},{sc:"CA-06",name:"Update Notes",writes:"Col L (append notes)",color:C.textDim}].map(function(s){return e("div",{key:s.sc,style:{padding:"8px 10px",borderRadius:6,background:C.bg,border:"1px solid "+C.border}},
              e("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:3}},e("span",{style:{fontSize:9,fontWeight:700,fontFamily:mono,padding:"1px 6px",borderRadius:3,background:s.color+"12",color:s.color}},s.sc),e("span",{style:{fontSize:10,fontWeight:600}},s.name)),
              e("div",{style:{fontSize:9,color:C.textDim,fontFamily:mono}},s.writes)
            );})
          )
        )
      );
    }

    function flowTab() {
      return e("div",{style:{animation:"fadeIn 0.3s ease"}},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}},
          e("div",null,
            e("div",{style:{fontSize:14,fontWeight:600}},"System Architecture — Make.com Scenario Flows"),
            e("div",{style:{fontSize:11,color:C.textDim}},"Live blueprint data from Make.com folder 212901 (Sunstate Call-Ahead Prototype)")
          )
        ),
        e("div",{style:{borderRadius:12,border:"1px solid "+C.border,overflow:"hidden",background:C.surface}},
          e("div",{style:{padding:"10px 16px",background:C.bg,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"space-between"}},
            e("div",{style:{display:"flex",alignItems:"center",gap:8}},
              e("div",{style:{width:8,height:8,borderRadius:"50%",background:C.purple,animation:"pulseDot 2s infinite"}}),
              e("span",{style:{fontSize:11,fontWeight:600,color:C.purple}},"System Flow")
            ),
            e("span",{style:{fontSize:10,color:C.textDim,fontFamily:mono}},"embed ready")
          ),
          e("iframe",{src:"sunstate-2002-flow.html",style:{width:"100%",height:1050,border:"none",background:"#f0f2f5"},title:"System Flow"}),
          e("div",{style:{padding:"12px 16px",background:C.surface,borderTop:"1px solid "+C.border,fontSize:11,color:C.textDim,display:"flex",alignItems:"center",justifyContent:"space-between"}},
            e("span",null,"6 Make.com Scenarios · Folder 212901"),
            e("span",{style:{fontFamily:mono,fontSize:10}},"Powered by Make.com")
          )
        )
      );
    }

    const tabMap = {manifest:manifestTab,retell:retellTab,sheet:sheetTab,flow:flowTab};

    return e("div",{style:{animation:"slideIn 0.5s ease"}},
      e("div",{style:{marginBottom:28}},
        e("h2",{style:{fontSize:22,fontWeight:600,margin:"0 0 6px"}},"System Prototype"),
        e("p",{style:{fontSize:13,color:C.textDim,margin:0,maxWidth:720,lineHeight:1.6}},"Interactive demonstration of the Call-Ahead system. Explore the trip manifest, configure the Retell AI voice agent, review the call results spreadsheet, and see the full Make.com system architecture.")
      ),
      e("div",{style:{display:"flex",gap:0,border:"1px solid "+C.border,borderRadius:8,overflow:"hidden",marginBottom:16}},
        tabs.map(t => {
          const isA = activeProto===t.id;
          return e("div",{key:t.id,onClick:()=>setActiveProto(t.id),style:{flex:1,padding:"12px 16px",fontSize:12,fontWeight:600,color:isA?t.color:C.textDim,cursor:"pointer",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8,borderRight:"1px solid "+C.border,background:isA?C.bg:C.surface,transition:"all 0.2s"}},
            e("div",{style:{width:6,height:6,borderRadius:"50%",background:isA?t.color:C.textDim,opacity:isA?1:0.3,animation:isA?"pulseDot 2s ease infinite":"none"}}),
            t.label
          );
        })
      ),
      (tabMap[activeProto]||manifestTab)()
    );
  }

  // ============ HOW IT WORKS ============
  function howItWorksView() {
    const steps = [
      {num:1,title:"Batch Trigger — CA-01 Reads Trip Manifest",color:C.accent,desc:"CA-01 runs on a configurable schedule (every 15 min during dispatch hours) or via manual trigger. It reads the Google Sheets trip manifest, filters to rows where Column O (call_status) is blank, and iterates each unprocessed trip.",detail:"Spreadsheet: 1IphCOuBfgP7bIDHEt1r7dBvqJxGvGUeXfp5I2vzLhbE\\nRange: A2:S100 · Filter: Column O is empty\\nColumns: trip_id, pickup_date, pickup_time, patient_name,\\ntransport_type, facility_name, facility_unit, facility_phone..."},
      {num:2,title:"Retell AI Voice Call — Live Facility Verification",color:C.purple,desc:"For each unprocessed trip, CA-01 fires an HTTP POST to Retell's create-phone-call endpoint with 13 dynamic variables. The AI agent calls the facility, verifies readiness, confirms stretcher requirements, and can take real-time actions via mid-call tool webhooks.",detail:"Endpoint: api.retellai.com/v2/create-phone-call\\nAgent ID: agent_06cc496494748e2573445a5398\\nMid-call tools: Cancel (CA-04), Reschedule (CA-05),\\nUpdate Notes (CA-06), Check Requirements"},
      {num:3,title:"Timestamp Lock — Prevent Duplicate Calls",color:C.warning,desc:"Immediately after initiating each call (not after completion), CA-01 writes a timestamp to Column O. This prevents duplicate calls if the scenario re-runs while calls are still in progress. The lock is written before the call connects."},
      {num:4,title:"Post-Call Analysis — GPT-4.1 Two-Stage Classification",color:C.teal,desc:"When the call ends, Retell fires a webhook to CA-02 with the full transcript. Stage 1 classifies who answered (facility, patient, voicemail, no answer, call failed). If FACILITY_REACHED, Stage 2 extracts five structured fields via ||| delimited parsing.",detail:"Model: GPT-4.1 · Temperature: 0\\nStage 1: Contact classification (5 categories)\\nStage 2: Status ||| Transport_Confirmed ||| Clinical_Notes\\n         ||| Result_Summary ||| Action_Required"},
      {num:5,title:"Smart Routing — 3-Branch Decision Logic",color:C.orange,desc:"CA-02's router sends results down three branches: Branch A (PATIENT_REACHED) auto-retries the call to the correct facility number — a key differentiator. Branch B (FACILITY_REACHED) writes extracted data to Sheets and sends dispatch email. Branch C (VOICEMAIL/NO_ANSWER) flags for manual follow-up."},
      {num:6,title:"Dispatch Notification — Color-Coded HTML Alerts",color:C.success,desc:"Branch B sends a formatted HTML email to dispatch via Outlook. Green header for confirmed transports, yellow for rescheduled, red for cancelled. Includes patient details, facility info, clinical notes extracted from the call, and the specific action required."},
    ];

    return e("div",{style:{animation:"slideIn 0.5s ease"}},
      e("div",{style:{marginBottom:28}},
        e("h2",{style:{fontSize:22,fontWeight:600,margin:"0 0 6px"}},"How the Call-Ahead System Works"),
        e("p",{style:{fontSize:13,color:C.textDim,margin:0,maxWidth:720,lineHeight:1.6}},"Six Make.com scenarios work together: a batch dialer, a post-call router with two-stage AI analysis, an external API trigger, and three mid-call tool webhooks for real-time actions during live conversations.")
      ),
      e("div",{style:{display:"flex",flexDirection:"column",gap:0,marginBottom:32}},
        steps.map((step,i) =>
          e("div",{key:i,style:{display:"flex",gap:20,marginBottom:8}},
            e("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,width:36}},
              e("div",{style:{width:32,height:32,borderRadius:"50%",background:step.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}},step.num),
              i<steps.length-1?e("div",{style:{flex:1,width:2,background:C.border,margin:"6px 0"}}):null
            ),
            e("div",{style:{flex:1,paddingBottom:24}},
              e("div",{style:{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}},step.title),
              e("div",{style:{fontSize:13,color:C.textMid,lineHeight:1.7}},step.desc),
              step.detail?e("div",{style:{marginTop:12,fontFamily:mono,fontSize:11,color:C.textDim,background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:"12px 16px",lineHeight:1.8,whiteSpace:"pre-line"}},step.detail):null
            )
          )
        )
      ),
      // Mid-call tools section
      e("div",{style:{padding:20,borderRadius:12,background:C.purple+"06",border:"1px solid "+C.purple+"22",marginBottom:20}},
        e("div",{style:{fontSize:13,fontWeight:700,color:C.purple,marginBottom:14}},"Mid-Call Tool Webhooks — Real-Time Actions During Live Calls"),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}},
          [{id:"CA-04",name:"Cancel Trip",webhook:"1949715",desc:"Writes cancellation to Sheet, sends red alert email, returns confirmation to voice agent. Must respond within 5 seconds.",trust:"9/10",build:"1/5",color:C.danger},
           {id:"CA-05",name:"Reschedule Trip",webhook:"1949723",desc:"Overwrites pickup date/time columns, sends yellow alert email, returns confirmation to voice agent.",trust:"9/10",build:"1/5",color:C.warning},
           {id:"CA-06",name:"Update Notes",webhook:"1949728",desc:"Appends clinical notes to Column S during active call without interrupting conversation flow.",trust:"10/10",build:"1/5",color:C.teal}].map(t=>
            e("div",{key:t.id,style:{padding:16,borderRadius:10,background:C.bg,border:"1px solid "+C.border}},
              e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
                e("span",{style:{fontFamily:mono,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:t.color+"12",color:t.color}},t.id),
                e("span",{style:{fontSize:13,fontWeight:600}},t.name)
              ),
              e("div",{style:{fontSize:11,color:C.textMid,lineHeight:1.6,marginBottom:10}},t.desc),
              e("div",{style:{display:"flex",gap:8}},
                e("span",{style:{fontSize:10,fontFamily:mono,color:C.textDim}},"Trust: "+t.trust),
                e("span",{style:{fontSize:10,fontFamily:mono,color:C.textDim}},"Build: "+t.build),
                e("span",{style:{fontSize:10,fontFamily:mono,color:t.color}},"Webhook: "+t.webhook)
              )
            )
          )
        )
      )
    );
  }

  // ============ BUILD SPEC ============
  function buildSpecView() {
    const techStack = __MANAGEAI_TECH_STACK__;
    const scenarios = __MANAGEAI_SCENARIOS__;

    return e("div",{style:{animation:"slideIn 0.5s ease"}},
      e("div",{style:{marginBottom:28}},
        e("h2",{style:{fontSize:22,fontWeight:600,margin:"0 0 6px"}},"Build Specification"),
        e("p",{style:{fontSize:13,color:C.textDim,margin:0,maxWidth:720,lineHeight:1.6}},"Complete technical breakdown — tech stack, scenario specifications with module sequences, trustability and build complexity scores, and Make.com variables.")
      ),
      // Tech stack
      e("div",{style:{fontSize:12,fontWeight:600,color:C.accent,letterSpacing:"0.04em",marginBottom:12,textTransform:"uppercase"}},"System Tech Stack"),
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:10,marginBottom:24}},
        techStack.map((t,i)=>e("div",{key:i,style:{display:"flex",alignItems:"center",gap:12,padding:16,borderRadius:8,background:C.surface,border:"1px solid "+C.border}},
          e("div",{style:{width:40,height:40,borderRadius:8,background:t.color+"12",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}},t.icon),
          e("div",null,e("div",{style:{fontSize:13,fontWeight:600}},t.name),e("div",{style:{fontSize:11,color:C.textDim,marginTop:2}},t.role))
        ))
      ),
      // Scenarios
      e("div",{style:{fontSize:12,fontWeight:600,color:C.accent,letterSpacing:"0.04em",marginBottom:12,textTransform:"uppercase"}},"Scenario Specifications"),
      e("div",{style:{display:"flex",flexDirection:"column",gap:10,marginBottom:24}},
        scenarios.map((sc,si)=>{
          const isExp=expandedScenario===sc.id;
          return e("div",{key:si,style:{borderRadius:12,border:"1px solid "+(isExp?sc.color+"44":C.border),overflow:"hidden"}},
            e("div",{onClick:()=>setExpandedScenario(isExp?null:sc.id),style:{padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,background:isExp?sc.color+"06":C.surface,transition:"all 0.2s"}},
              e("span",{style:{fontFamily:mono,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,background:sc.color+"12",color:sc.color}},sc.id),
              e("span",{style:{fontSize:14,fontWeight:600,flex:1}},sc.name),
              e("div",{style:{display:"flex",gap:8,alignItems:"center",flexShrink:0}},
                e("span",{style:{fontSize:10,fontFamily:mono,padding:"2px 8px",borderRadius:4,background:C.success+"10",color:C.success}},"Trust: "+sc.trust),
                e("span",{style:{fontSize:10,fontFamily:mono,padding:"2px 8px",borderRadius:4,background:C.warning+"10",color:C.warning}},"Build: "+sc.build)
              ),
              e("div",{style:{textAlign:"right",flexShrink:0,marginLeft:8}},e("div",{style:{fontFamily:mono,fontSize:16,fontWeight:600,color:sc.color}},sc.modules.length),e("div",{style:{fontSize:9,color:C.textDim,letterSpacing:"0.04em"}},"MODULES")),
              e("div",{style:{fontSize:14,color:isExp?sc.color:C.textDim,marginLeft:8,transition:"transform 0.2s",transform:isExp?"rotate(180deg)":"rotate(0deg)"}},"▼")
            ),
            isExp?e("div",{style:{padding:"0 20px 20px",background:C.bg,borderTop:"1px solid "+C.border,animation:"slideIn 0.25s ease"}},
              e("div",{style:{fontSize:12,color:C.textMid,lineHeight:1.6,margin:"14px 0"}},sc.desc),
              e("div",{style:{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}},
                e("div",{style:{padding:"6px 10px",borderRadius:6,background:C.warning+"08",border:"1px solid "+C.warning+"20",fontSize:10,fontFamily:mono,color:C.textMid}},e("span",{style:{fontWeight:600,color:C.warning}},"Trigger: "),sc.trigger),
                e("div",{style:{padding:"6px 10px",borderRadius:6,background:C.surface,border:"1px solid "+C.border,fontSize:10,fontFamily:mono,color:C.textMid}},e("span",{style:{fontWeight:600,color:C.accent}},"Scenario ID: "),sc.scId)
              ),
              e("div",{style:{fontSize:10,fontWeight:600,color:C.textDim,letterSpacing:"0.04em",marginBottom:8}},"MODULE SEQUENCE"),
              e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
                sc.modules.map((m,j)=>e("div",{key:j,style:{display:"flex",alignItems:"flex-start",gap:10}},
                  e("div",{style:{width:24,height:24,borderRadius:"50%",background:C.surface,border:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,fontSize:11,fontWeight:700,color:C.textDim,flexShrink:0,marginTop:2}},j+1),
                  e("div",{style:{fontSize:12,color:C.textMid,lineHeight:1.6,padding:"4px 0"}},m)
                ))
              )
            ):null
          );
        })
      ),
      // Make.com Variables
      e("div",{style:{padding:20,borderRadius:12,background:C.surface,border:"1px solid "+C.border}},
        e("div",{style:{fontSize:13,fontWeight:600,color:C.purple,marginBottom:12}},"📊 Make.com Variables"),
        [{n:"CA_RETELL_API_KEY",p:"Retell AI API key"},{n:"CA_RETELL_AGENT_ID",p:"Voice agent identifier"},{n:"CA_OPENAI_KEY",p:"OpenAI API key for GPT-4.1"},{n:"CA_OPENAI_MODEL",p:"GPT model: gpt-4.1"},{n:"CA_SPREADSHEET_ID",p:"Trip manifest sheet ID"},{n:"CA_DISPATCH_EMAIL",p:"Notification recipient"},{n:"CA_SHEET_RANGE",p:"Data range: A2:S100"}].map(v=>
          e("div",{key:v.n,style:{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+C.surface2}},
            e("span",{style:{fontFamily:mono,fontSize:10,color:C.purple,fontWeight:600}},v.n),
            e("span",{style:{fontSize:10,color:C.textDim}},v.p)
          )
        )
      )
    );
  }

  const viewMap = {overview:overviewView,prototype:prototypeView,howitworks:howItWorksView,buildspec:buildSpecView};
  const content = (viewMap[activeView]||overviewView)();

  // ============ EDITOR PANEL ============
  const editorTabs = [{id:"overview",label:"Overview",icon:"🏠"},{id:"callout",label:"Callout",icon:"🔧"},{id:"retell",label:"Retell",icon:"📞"},{id:"manifest",label:"Manifest",icon:"📋"},{id:"sheet",label:"Sheet",icon:"📊"},{id:"stats",label:"Stats",icon:"📈"}];

  function editorPanel() {
    return e("div",{style:{position:"fixed",top:0,left:0,bottom:0,zIndex:100,width:panelOpen?380:0,background:C.surface,borderRight:panelOpen?"1px solid "+C.border:"none",overflow:"hidden",transition:"width 0.3s ease",display:"flex",flexDirection:"column",boxShadow:panelOpen?"4px 0 24px rgba(0,0,0,0.08)":"none"}},
      e("div",{style:{padding:"16px",borderBottom:"1px solid "+C.border,background:C.bg,flexShrink:0}},
        e("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}},
          e("div",{style:{display:"flex",alignItems:"baseline",gap:3}},e("span",{style:{fontSize:15,fontWeight:700,color:C.logo}},"MANAGE"),e("span",{style:{fontSize:15,fontWeight:700,color:C.accent}},"AI"),e("span",{style:{fontSize:10,color:C.textDim,marginLeft:8,fontFamily:mono}},"Editor")),
          e("button",{onClick:()=>setPanelOpen(false),style:{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:16,lineHeight:1,padding:"2px 6px"}},"✕")
        ),
        e("div",{style:{display:"flex",gap:3,flexWrap:"wrap"}},
          editorTabs.map(function(t){var isA=editSection===t.id;return e("button",{key:t.id,onClick:function(){setEditSection(t.id);},style:{padding:"5px 8px",borderRadius:5,border:"1px solid "+(isA?C.accent:C.border),background:isA?C.accentDim:C.bg,color:isA?C.accent:C.textDim,fontSize:10,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans', sans-serif",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s"}},e("span",{style:{fontSize:11}},t.icon),t.label);})
        )
      ),
      e("div",{style:{flex:1,padding:"14px 16px",overflowY:"auto"}},
        editSection==="overview"?e("div",null,
          e(EditorField,{label:"Client Name",value:data.clientName,onChange:function(v){setData(function(p){return Object.assign({},p,{clientName:v});});}}),
          e(EditorField,{label:"Solution Name",value:data.solutionName,onChange:function(v){setData(function(p){return Object.assign({},p,{solutionName:v});});}}),
          e(EditorField,{label:"Version",value:data.version,onChange:function(v){setData(function(p){return Object.assign({},p,{version:v});});}}),
          e(EditorField,{label:"Stack",value:data.stack,onChange:function(v){setData(function(p){return Object.assign({},p,{stack:v});});}}),
          e(EditorField,{label:"Confidential Line",value:data.confidentialLine,onChange:function(v){setData(function(p){return Object.assign({},p,{confidentialLine:v});});}}),
          e(EditorField,{label:"Overview Title",value:data.overviewTitle,onChange:function(v){setData(function(p){return Object.assign({},p,{overviewTitle:v});});}}),
          e(EditorField,{label:"Overview Description",value:data.overviewDesc,onChange:function(v){setData(function(p){return Object.assign({},p,{overviewDesc:v});});},multi:true})
        ):editSection==="callout"?e("div",null,
          e(EditorField,{label:"Callout Title",value:data.calloutTitle,onChange:function(v){setData(function(p){return Object.assign({},p,{calloutTitle:v});});}}),
          e(EditorField,{label:"Callout Body",value:data.calloutBody,onChange:function(v){setData(function(p){return Object.assign({},p,{calloutBody:v});});},multi:true})
        ):editSection==="retell"?e("div",null,
          e(EditorField,{label:"Agent ID",value:data.retellAgentId,onChange:function(v){setData(function(p){return Object.assign({},p,{retellAgentId:v});});}}),
          e(EditorField,{label:"From Number",value:data.retellFromNumber,onChange:function(v){setData(function(p){return Object.assign({},p,{retellFromNumber:v});});}}),
          e(EditorField,{label:"Voice Engine",value:data.retellVoiceEngine,onChange:function(v){setData(function(p){return Object.assign({},p,{retellVoiceEngine:v});});}}),
          e(EditorField,{label:"Dashboard URL",value:data.retellDashUrl,onChange:function(v){setData(function(p){return Object.assign({},p,{retellDashUrl:v});});}})
        ):editSection==="manifest"?e("div",null,
          e(EditorField,{label:"Manifest Title",value:data.manifestTitle,onChange:function(v){setData(function(p){return Object.assign({},p,{manifestTitle:v});});}}),
          e(EditorField,{label:"Manifest Date",value:data.manifestDate,onChange:function(v){setData(function(p){return Object.assign({},p,{manifestDate:v});});}})
        ):editSection==="sheet"?e("div",null,
          e(EditorField,{label:"Spreadsheet ID",value:data.sheetId,onChange:function(v){setData(function(p){return Object.assign({},p,{sheetId:v});});}}),
          e(EditorField,{label:"Sheet Range",value:data.sheetRange,onChange:function(v){setData(function(p){return Object.assign({},p,{sheetRange:v});});}})
        ):editSection==="stats"?e("div",null,
          e(EditorField,{label:"Make.com Scenarios",value:data.statsScenarios,onChange:function(v){setData(function(p){return Object.assign({},p,{statsScenarios:v});});}}),
          e(EditorField,{label:"Voice Agent Tools",value:data.statsTools,onChange:function(v){setData(function(p){return Object.assign({},p,{statsTools:v});});}}),
          e(EditorField,{label:"GPT Analysis Stages",value:data.statsGptStages,onChange:function(v){setData(function(p){return Object.assign({},p,{statsGptStages:v});});}})
        ):null
      ),
      e("div",{style:{padding:"12px 16px",borderTop:"1px solid "+C.border,background:C.bg,flexShrink:0,display:"flex",flexDirection:"column",gap:6}},
        e("div",{style:{width:"100%",padding:"6px",borderRadius:6,border:"1px solid "+C.success+"40",background:C.success+"08",color:C.success,fontSize:10,fontWeight:500,fontFamily:"'DM Sans', sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6}},"⚡ Supabase Connected"),
        e("button",{onClick:saveToCloud,style:{width:"100%",padding:"9px",borderRadius:6,border:"none",cursor:"pointer",background:saveStatus==="saved"?C.success:saveStatus==="error"?C.danger:C.accent,color:"#FFF",fontSize:11,fontWeight:600,fontFamily:"'DM Sans', sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"background 0.3s"}},saveStatus==="saving"?"Saving…":saveStatus==="saved"?"✓ Saved to Cloud":saveStatus==="error"?"✗ Save Failed":"☁ Save to Cloud"),
        e("button",{onClick:function(){loadFromCloud();},style:{width:"100%",padding:"8px",borderRadius:6,border:"1px solid "+C.accent+"40",cursor:"pointer",background:loadStatus==="loaded"?C.success+"12":loadStatus==="error"?C.danger+"12":C.accent+"08",color:loadStatus==="loaded"?C.success:loadStatus==="error"?C.danger:C.accent,fontSize:10,fontWeight:600,fontFamily:"'DM Sans', sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.3s"}},loadStatus==="loading"?"Loading…":loadStatus==="loaded"?"✓ Loaded from Cloud":loadStatus==="error"?"✗ Load Failed":"☁ Load from Cloud"),
        e("button",{onClick:function(){var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="sunstate-callahead-data.json";a.click();},style:{width:"100%",padding:"7px",borderRadius:6,border:"1px solid "+C.border,cursor:"pointer",background:"transparent",color:C.textMid,fontSize:10,fontWeight:500,fontFamily:"'DM Sans', sans-serif"}},"↓ Export JSON"),
        e("button",{onClick:function(){setData(getDefaultData());},style:{width:"100%",padding:"6px",borderRadius:6,border:"1px solid "+C.border,cursor:"pointer",background:"transparent",color:C.textDim,fontSize:10,fontFamily:"'DM Sans', sans-serif"}},"Reset to Default")
      )
    );
  }

  return e("div",{style:{display:"flex",minHeight:"100vh"}},
    editorPanel(),
    e("div",{style:{flex:1,minHeight:"100vh",background:C.bg,position:"relative",transition:"margin-left 0.3s ease",marginLeft:panelOpen?380:0}},
    e("div",{style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:"linear-gradient("+C.border+"33 1px, transparent 1px), linear-gradient(90deg, "+C.border+"33 1px, transparent 1px)",backgroundSize:"60px 60px"}}),
    e("div",{style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}},
      Array.from({length:12},function(_,i){return e("div",{key:i,style:{position:"absolute",width:2,height:2,borderRadius:"50%",background:C.accent,opacity:0,left:(Math.random()*100)+"%",top:"100%",animation:"floatUp 10s "+(i*0.9)+"s infinite ease-out"}});})
    ),
    e("header",{style:{position:"relative",zIndex:10,padding:"20px 28px 16px",borderBottom:"1px solid "+C.border,background:"linear-gradient(180deg,"+C.surface+" 0%,"+C.bg+" 100%)"}},
      e("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}},
        e("div",{style:{display:"flex",alignItems:"center",gap:12}},
          !panelOpen?e("button",{onClick:function(){setPanelOpen(true);},title:"Open Editor",style:{width:32,height:32,borderRadius:6,border:"1px solid "+C.border,background:C.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:C.accent,flexShrink:0,transition:"all 0.2s"}},"✏️"):null,
          e("div",{style:{display:"flex",alignItems:"baseline",gap:4}},e("span",{style:{fontSize:20,fontWeight:700,color:C.logo,letterSpacing:"-0.02em"}},"MANAGE"),e("span",{style:{fontSize:20,fontWeight:700,color:C.accent,letterSpacing:"-0.02em"}},"AI")),
          e("div",{style:{width:1,height:20,background:C.border}}),
          e("div",null,
            e("div",{style:{fontSize:12,fontWeight:600}},data.clientName+" — "+data.solutionName),
            e("div",{style:{fontSize:9,color:C.textDim,marginTop:1,fontFamily:mono}},"Solution Demo v"+data.version+" · "+data.stack)
          )
        ),
        e("div",{style:{display:"flex",gap:2,background:C.surface2,borderRadius:8,padding:3,border:"1px solid "+C.border,flexWrap:"wrap"}},views.map(function(v){return navBtn(v);}))
      )
    ),
    e("main",{style:{position:"relative",zIndex:5,padding:"30px 28px",maxWidth:1400,margin:"0 auto"}},content),
    e("footer",{style:{position:"relative",zIndex:5,padding:"16px 28px",borderTop:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}},
      e("div",{style:{fontSize:11,color:C.textDim}},e("span",{style:{color:C.logo}},"MANAGE"),e("span",{style:{color:C.accent}},"AI")," · "+data.solutionName+" Demo v"+data.version+" · March 2026"),
      e("div",{style:{fontSize:10,color:C.textDim,fontFamily:mono}},"CONFIDENTIAL — "+data.confidentialLine)
    )
  ));
}

ReactDOM.createRoot(document.getElementById("root")).render(e(App));
</script>
</body>
</html>`;
}
