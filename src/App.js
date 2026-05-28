
import { useState, useEffect, useCallback } from "react";

// ── Palette ──────────────────────────────────────────────
const C = {
  coral: "#D85A30", coralLight: "#FAECE7", coralDark: "#993C1D",
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleDark: "#3C3489",
  teal: "#1D9E75", tealLight: "#E1F5EE", tealDark: "#0F6E56",
  amber: "#BA7517", amberLight: "#FAEEDA",
  gray: "#888780", grayLight: "#F1EFE8",
  red: "#E24B4A", redLight: "#FCEBEB",
  blue: "#378ADD", blueLight: "#E6F1FB",
};

// ── Default config ────────────────────────────────────────
const DEFAULT_CONFIG = {
  nomBailleur: "",
  territoire: "",
  totalLogements: "",
  pctSeniors75: "",
  tauxRotation: "",
  nbLocataires75: "",
  responsablePilotage: "",
  dateDebut: "",
  chantiers: [
    { id:"c1", label:"Cartographie du parc vieillissant", module:"Comprendre", urgence:5, impact:5, faisabilite:4, decision:"prioritaire", horizon:"M1–M5" },
    { id:"c2", label:"Protocole de repérage des fragilités", module:"Agir", urgence:5, impact:5, faisabilite:3, decision:"prioritaire", horizon:"M10–M15" },
    { id:"c3", label:"Simplification des mutations internes", module:"Agir", urgence:4, impact:4, faisabilite:4, decision:"court", horizon:"M3–M8" },
    { id:"c4", label:"Plan d'adaptation des logements", module:"Agir", urgence:4, impact:5, faisabilite:3, decision:"court", horizon:"M11–M18" },
    { id:"c5", label:"Tableau de bord de pilotage", module:"Agir", urgence:3, impact:4, faisabilite:4, decision:"court", horizon:"M10–M13" },
    { id:"c6", label:"Partenariats médico-sociaux", module:"Arbitrer", urgence:3, impact:4, faisabilite:3, decision:"moyen", horizon:"M13–M20" },
    { id:"c7", label:"Stratégie de rénovation énergétique", module:"Arbitrer", urgence:3, impact:4, faisabilite:2, decision:"moyen", horizon:"M14–M24" },
    { id:"c8", label:"Médiation numérique pour seniors", module:"Agir", urgence:2, impact:3, faisabilite:3, decision:"moyen", horizon:"M12–M18" },
    { id:"c9", label:"Résidence senior à vocation sociale", module:"Arbitrer", urgence:2, impact:3, faisabilite:2, decision:"renonce", horizon:"M18–M24" },
    { id:"c10", label:"Téléassistance généralisée", module:"Agir", urgence:2, impact:3, faisabilite:2, decision:"renonce", horizon:"M15–M20" },
  ],
  kpis: { logAdaptes:0, mutations:0, fragilitesReperes:0, tauxRotationActuel:"" },
  actions: [
    { id:"a1", module:"Comprendre", action:"Auditions internes & externes", resp:"", horizon:"M1–M3", statut:"a-lancer", livrable:"Compte-rendus d'audition" },
    { id:"a2", module:"Comprendre", action:"Cartographie des expositions", resp:"", horizon:"M2–M5", statut:"a-lancer", livrable:"Cartographie interactive" },
    { id:"a3", module:"Comprendre", action:"Matrice risques / opportunités", resp:"", horizon:"M3–M5", statut:"a-lancer", livrable:"Matrice validée" },
    { id:"a4", module:"Comprendre", action:"Séminaire de direction", resp:"", horizon:"M6", statut:"a-lancer", livrable:"Support + décisions actées" },
    { id:"a5", module:"Arbitrer", action:"Grille d'arbitrage complète", resp:"", horizon:"M5–M7", statut:"a-lancer", livrable:"Grille priorisée" },
    { id:"a6", module:"Arbitrer", action:"Portefeuille priorisé (CT/MT/LT)", resp:"", horizon:"M6–M8", statut:"a-lancer", livrable:"Portefeuille + trajectoire" },
    { id:"a7", module:"Arbitrer", action:"Note de gouvernance", resp:"", horizon:"M7–M9", statut:"differe", livrable:"Note validée en CODIR" },
    { id:"a8", module:"Arbitrer", action:"Jeu d'indicateurs", resp:"", horizon:"M8–M10", statut:"differe", livrable:"Référentiel d'indicateurs" },
    { id:"a9", module:"Agir", action:"Feuille de route exécutable", resp:"", horizon:"M9–M12", statut:"differe", livrable:"Document de référence opérationnel" },
    { id:"a10", module:"Agir", action:"Protocole repérage fragilités", resp:"", horizon:"M10–M15", statut:"differe", livrable:"Protocole + formation équipes" },
    { id:"a11", module:"Agir", action:"Kit opérationnel adaptation logement", resp:"", horizon:"M11–M16", statut:"differe", livrable:"Kit clé en main" },
    { id:"a12", module:"Agir", action:"Tableau de bord de pilotage", resp:"", horizon:"M10–M13", statut:"differe", livrable:"Dashboard + guide utilisateur" },
    { id:"a13", module:"Agir", action:"Partenariats médico-sociaux", resp:"", horizon:"M13–M20", statut:"differe", livrable:"Conventions signées" },
    { id:"a14", module:"Agir", action:"Revues trimestrielles", resp:"", horizon:"M13,M16,M19,M22", statut:"differe", livrable:"Comptes-rendus de revue" },
  ],
};

// ── Storage helpers ───────────────────────────────────────
async function loadData(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function saveData(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ── Mini components ───────────────────────────────────────
const Bar = ({ val, max=5, color }) => (
  <div style={{ flex:1, height:6, borderRadius:3, background:"rgba(128,128,128,0.15)", overflow:"hidden" }}>
    <div style={{ width:`${(val/max)*100}%`, height:"100%", borderRadius:3, background:color, transition:"width 0.3s" }}/>
  </div>
);

const Badge = ({ label, bg, color }) => (
  <span style={{ display:"inline-block", fontSize:10, padding:"2px 7px", borderRadius:4, fontWeight:500, background:bg, color, whiteSpace:"nowrap" }}>{label}</span>
);

const statutCfg = {
  "realise":  { label:"✓ Réalisé",   bg:"#EAF3DE", color:"#3B6D11" },
  "en-cours": { label:"⟳ En cours",  bg:"#E6F1FB", color:"#185FA5" },
  "a-lancer": { label:"⚑ À lancer",  bg:"#FAEEDA", color:"#854F0B" },
  "differe":  { label:"○ Différé",   bg:"#F1EFE8", color:"#5F5E5A" },
};

const decisionCfg = {
  "prioritaire": { label:"Prioritaire", bg:"#FCEBEB", color:"#A32D2D" },
  "court":       { label:"Court terme", bg:"#FAEEDA", color:"#854F0B" },
  "moyen":       { label:"Moyen terme", bg:"#E6F1FB", color:"#185FA5" },
  "renonce":     { label:"Renoncement", bg:"#F1EFE8", color:"#5F5E5A" },
};

// ══════════════════════════════════════════════════════════
// VIEWS
// ══════════════════════════════════════════════════════════

// ── Configuration ─────────────────────────────────────────
function ViewConfig({ config, setConfig, onSave }) {
  const [form, setForm] = useState(config);
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));
  const valid = form.nomBailleur && form.totalLogements;

  return (
    <div>
      <h2 style={{ fontSize:16, fontWeight:500, marginBottom:4 }}>Configuration de l'accompagnement</h2>
      <p style={{ fontSize:12, color:"#888", marginBottom:20 }}>Renseignez les informations du bailleur pour personnaliser l'ensemble des 6 outils.</p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
        {[
          ["nomBailleur","Nom du bailleur *","texte","Ex : OPH de Lyon"],
          ["territoire","Territoire","texte","Ex : Métropole de Lyon"],
          ["totalLogements","Nombre total de logements *","number","Ex : 8 500"],
          ["nbLocataires75","Nb locataires 75+ connus","number","Ex : 750"],
          ["pctSeniors75","% logements occupés par 75+","number","Ex : 9.5"],
          ["tauxRotation","Taux de rotation actuel (%)","number","Ex : 6.2"],
          ["responsablePilotage","Responsable pilotage","texte","Nom + fonction"],
          ["dateDebut","Date de début","date",""],
        ].map(([k, lbl, type, ph]) => (
          <div key={k}>
            <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em" }}>{lbl}</label>
            <input
              type={type === "texte" ? "text" : type}
              value={form[k] || ""}
              onChange={e => set(k, e.target.value)}
              placeholder={ph}
              style={{ width:"100%", fontSize:13, padding:"8px 10px", border:"0.5px solid rgba(128,128,128,0.3)", borderRadius:8, background:"transparent", color:"inherit", boxSizing:"border-box" }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.04em" }}>Chantiers retenus</label>
        {form.chantiers.map((c,i) => (
          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", borderRadius:8, background:"rgba(128,128,128,0.05)", marginBottom:4 }}>
            <input type="checkbox" checked={c.decision !== "renonce"} onChange={e => {
              const next = [...form.chantiers]; next[i] = { ...c, decision: e.target.checked ? "court" : "renonce" };
              set("chantiers", next);
            }} style={{ accentColor: C.coral }} />
            <span style={{ fontSize:12, flex:1 }}>{c.label}</span>
            <span style={{ fontSize:10, color:"#888" }}>{c.module}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => { if(valid){ setConfig(form); onSave(form); } }}
        disabled={!valid}
        style={{ padding:"10px 24px", borderRadius:20, border:"none", background: valid ? C.coral : "#ccc", color:"#fff", fontSize:13, fontWeight:500, cursor: valid ? "pointer" : "default" }}
      >
        Enregistrer et accéder aux outils →
      </button>
      {!valid && <span style={{ fontSize:11, color:"#e24b4a", marginLeft:12 }}>Nom du bailleur et nombre de logements requis</span>}
    </div>
  );
}

// ── Cartographie ──────────────────────────────────────────
function ViewCarto({ config }) {
  const nb = parseInt(config.nbLocataires75)||0;
  const pct = parseFloat(config.pctSeniors75)||0;
  const total = parseInt(config.totalLogements)||0;
  const nom = config.nomBailleur || "Bailleur";

  const stats = [
    { label:"Logements total", val: total.toLocaleString("fr"), color: C.gray },
    { label:"Locataires 75+ identifiés", val: nb.toLocaleString("fr"), color: C.coral },
    { label:"Part du parc concernée", val: pct ? pct+"%" : total ? Math.round(nb/total*100)+"%" : "—", color: C.amber },
    { label:"Locataires 85+ estimés", val: nb ? Math.round(nb*0.3).toLocaleString("fr") : "—", color: C.red },
  ];

  const transitions = [
    { label:"Transition démographique", color:C.coral, bg:C.coralLight, impacts:["Vieillissement accéléré du parc","Rotation bloquée","Fragilités non repérées","Isolement des locataires seniors"] },
    { label:"Transition numérique", color:C.purple, bg:C.purpleLight, impacts:["Fracture numérique des seniors","Outils de pilotage à moderniser","Services dématérialisés inaccessibles"] },
    { label:"Transition écologique", color:C.teal, bg:C.tealLight, impacts:["Passoires thermiques prioritaires","Confort été/hiver des seniors","Coûts énergétiques des locataires"] },
  ];

  return (
    <div>
      <h2 style={{ fontSize:16, fontWeight:500, marginBottom:4 }}>Cartographie des expositions</h2>
      <p style={{ fontSize:12, color:"#888", marginBottom:16 }}>{nom} · Analyse croisée des trois transitions</p>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:"rgba(128,128,128,0.05)", borderRadius:12, padding:"14px 16px", border:"0.5px solid rgba(128,128,128,0.15)" }}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:24, fontWeight:500, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
        {transitions.map(t => (
          <div key={t.label} style={{ background:t.bg, borderRadius:12, padding:16, border:`0.5px solid ${t.color}40` }}>
            <div style={{ fontSize:13, fontWeight:500, color:t.color, marginBottom:12 }}>{t.label}</div>
            {t.impacts.map(imp => (
              <div key={imp} style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:8 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:t.color, marginTop:5, flexShrink:0 }}/>
                <span style={{ fontSize:12 }}>{imp}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop:20, padding:14, borderRadius:12, background:"rgba(128,128,128,0.05)", border:"0.5px solid rgba(128,128,128,0.15)" }}>
        <div style={{ fontSize:12, fontWeight:500, marginBottom:8 }}>Dépendances croisées identifiées pour {nom}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            ["Démographique × Numérique","Les seniors en perte d'autonomie sont aussi les plus exposés à la fracture numérique."],
            ["Démographique × Écologique","Les logements les plus énergivores sont souvent occupés par les locataires les plus âgés."],
            ["Numérique × Pilotage","L'absence d'outils numériques limite la capacité du bailleur à repérer les fragilités à grande échelle."],
            ["Écologique × Financier","La rénovation énergétique mobilise des budgets qui pourraient financer l'adaptation des logements."],
          ].map(([titre, desc]) => (
            <div key={titre} style={{ padding:"10px 12px", borderRadius:8, background:"rgba(128,128,128,0.08)" }}>
              <div style={{ fontSize:11, fontWeight:500, marginBottom:3 }}>{titre}</div>
              <div style={{ fontSize:11, color:"#888" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Matrice ───────────────────────────────────────────────
function ViewMatrice({ config }) {
  const points = [
    { id:"r1", label:"Vieillissement accéléré", desc:"Explosion du nombre de 85+ dans le parc.", type:"Risque critique", px:82, py:15, color:C.coral },
    { id:"r2", label:"Rotation bloquée", desc:"Les seniors quittent moins leur logement, réduisant la fluidité du parc.", type:"Risque critique", px:74, py:24, color:C.coral },
    { id:"r3", label:"Fragilités non repérées", desc:"Isolement et perte d'autonomie silencieux.", type:"Risque critique", px:66, py:20, color:C.coral },
    { id:"r4", label:"Contrainte budgétaire", desc:"Réduction des financements publics et marges réduites.", type:"Risque critique", px:77, py:33, color:C.amber },
    { id:"r5", label:"Rénovation obligatoire", desc:"Passoires thermiques à traiter en priorité.", type:"Risque à anticiper", px:28, py:18, color:C.amber },
    { id:"r6", label:"Fracture numérique", desc:"Accès aux services dématérialisés difficile pour les seniors.", type:"Risque modéré", px:70, py:62, color:C.purple },
    { id:"r7", label:"Empilement d'actions", desc:"Sans stratégie claire, risque d'inefficacité.", type:"Risque à anticiper", px:24, py:38, color:C.gray },
    { id:"o1", label:"Acteur du bien vieillir", desc:"Positionnement comme tiers de confiance territorial.", type:"Opportunité forte", px:80, py:62, color:C.teal },
    { id:"o2", label:"Partenariats médico-sociaux", desc:"Conventions CCAS, SSIAD, mutuelles.", type:"Opportunité forte", px:72, py:70, color:C.teal },
    { id:"o3", label:"Outils de pilotage", desc:"Tableaux de bord et indicateurs partagés.", type:"Opportunité", px:62, py:76, color:C.purple },
    { id:"o4", label:"MaPrimeAdapt'", desc:"Dispositif de financement mobilisable.", type:"Opportunité forte", px:54, py:60, color:C.teal },
  ];
  const [hovered, setHovered] = useState(null);

  return (
    <div>
      <h2 style={{ fontSize:16, fontWeight:500, marginBottom:4 }}>Matrice risques / opportunités</h2>
      <p style={{ fontSize:12, color:"#888", marginBottom:16 }}>Positionnement des enjeux selon leur probabilité et leur impact sur {config.nomBailleur||"le bailleur"}</p>

      <div style={{ position:"relative", width:"100%", paddingBottom:"60%", background:"rgba(128,128,128,0.04)", borderRadius:12, border:"0.5px solid rgba(128,128,128,0.15)" }}>
        {/* Zones */}
        <div style={{ position:"absolute", inset:0, display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"1fr 1fr" }}>
          {[
            { label:"Risques à anticiper", bg:"rgba(250,238,218,0.5)" },
            { label:"Zone critique", bg:"rgba(252,235,235,0.6)" },
            { label:"Surveillance", bg:"rgba(241,239,232,0.4)" },
            { label:"Opportunités", bg:"rgba(225,245,238,0.5)" },
          ].map(z => (
            <div key={z.label} style={{ background:z.bg, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"6px 0" }}>
              <span style={{ fontSize:10, fontWeight:500, opacity:0.5 }}>{z.label}</span>
            </div>
          ))}
        </div>
        {/* Axes labels */}
        <div style={{ position:"absolute", bottom:6, left:"50%", transform:"translateX(-50%)", fontSize:10, color:"#888" }}>Probabilité d'occurrence →</div>
        <div style={{ position:"absolute", left:4, top:"50%", transform:"translateY(-50%) rotate(-90deg)", fontSize:10, color:"#888", whiteSpace:"nowrap" }}>↑ Impact</div>
        {/* Points */}
        {points.map(p => (
          <div key={p.id}
            onMouseEnter={() => setHovered(p)}
            onMouseLeave={() => setHovered(null)}
            style={{ position:"absolute", left:`${p.px}%`, top:`${p.py}%`, transform:"translate(-50%,-50%)",
              width:14, height:14, borderRadius:"50%", background:p.color, cursor:"pointer",
              boxShadow: hovered?.id === p.id ? `0 0 0 4px ${p.color}40` : "none",
              transition:"box-shadow 0.15s", zIndex:2 }}
          />
        ))}
        {/* Tooltip */}
        {hovered && (
          <div style={{ position:"absolute", left:`${Math.min(hovered.px+3,70)}%`, top:`${Math.min(hovered.py,70)}%`,
            background:"white", border:"0.5px solid rgba(128,128,128,0.3)", borderRadius:8,
            padding:"8px 12px", fontSize:11, maxWidth:180, zIndex:10, pointerEvents:"none",
            boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
            <div style={{ fontWeight:500, marginBottom:2 }}>{hovered.label}</div>
            <div style={{ color:"#888", marginBottom:2 }}>{hovered.type}</div>
            <div>{hovered.desc}</div>
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:12, marginTop:12, flexWrap:"wrap" }}>
        {[["Risque démographique",C.coral],["Risque financier/écologique",C.amber],["Risque numérique",C.purple],["Opportunité",C.teal],["Gouvernance",C.gray]].map(([l,c]) => (
          <span key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#888" }}>
            <span style={{ width:10, height:10, borderRadius:"50%", background:c, display:"inline-block" }}/>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Grille arbitrage ──────────────────────────────────────
function ViewArbitrage({ config, setConfig, onSave }) {
  const [filter, setFilter] = useState("all");
  const chantiers = config.chantiers;

  const update = (id, key, val) => {
    const next = chantiers.map(c => c.id === id ? { ...c, [key]: val } : c);
    const nc = { ...config, chantiers: next };
    setConfig(nc); onSave(nc);
  };

  const filtered = filter === "all" ? chantiers : chantiers.filter(c => c.decision === filter);
  const counts = ["prioritaire","court","moyen","renonce"].reduce((a,k) => ({ ...a, [k]: chantiers.filter(c=>c.decision===k).length }), {});

  return (
    <div>
      <h2 style={{ fontSize:16, fontWeight:500, marginBottom:4 }}>Grille d'arbitrage</h2>
      <p style={{ fontSize:12, color:"#888", marginBottom:16 }}>Priorisez les chantiers de {config.nomBailleur||"votre bailleur"} — modifiez les décisions selon votre contexte.</p>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
        {[["all","Tous"],["prioritaire","Prioritaire"],["court","Court terme"],["moyen","Moyen terme"],["renonce","Renoncement"]].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ fontSize:12, padding:"4px 12px", borderRadius:20, border:"0.5px solid rgba(128,128,128,0.3)",
              background: filter===k ? "rgba(128,128,128,0.12)" : "transparent",
              color: filter===k ? "inherit" : "#888", cursor:"pointer" }}>{l}</button>
        ))}
      </div>

      <div style={{ fontSize:11, color:"#888", display:"grid", gridTemplateColumns:"2fr 70px 70px 80px 110px", gap:8, padding:"0 12px", marginBottom:6 }}>
        <span>Chantier</span><span>Urgence</span><span>Impact</span><span>Faisabilité</span><span>Décision</span>
      </div>

      {filtered.map(c => (
        <div key={c.id} style={{ display:"grid", gridTemplateColumns:"2fr 70px 70px 80px 110px", gap:8,
          padding:"10px 12px", borderRadius:10, border:"0.5px solid rgba(128,128,128,0.15)",
          marginBottom:6, alignItems:"center", background:"rgba(128,128,128,0.02)" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:500 }}>{c.label}</div>
            <div style={{ fontSize:11, color:"#888" }}>{c.module}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <Bar val={c.urgence} color={C.red}/><span style={{ fontSize:10, color:"#888" }}>{c.urgence}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <Bar val={c.impact} color={C.teal}/><span style={{ fontSize:10, color:"#888" }}>{c.impact}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <Bar val={c.faisabilite} color={C.purple}/><span style={{ fontSize:10, color:"#888" }}>{c.faisabilite}</span>
          </div>
          <select value={c.decision} onChange={e => update(c.id,"decision",e.target.value)}
            style={{ fontSize:11, padding:"3px 4px", border:"0.5px solid rgba(128,128,128,0.3)", borderRadius:6,
              background:"transparent", color:"inherit", width:"100%" }}>
            <option value="prioritaire">Prioritaire</option>
            <option value="court">Court terme</option>
            <option value="moyen">Moyen terme</option>
            <option value="renonce">Renoncement</option>
          </select>
        </div>
      ))}

      <div style={{ marginTop:14, padding:"12px 16px", borderRadius:12, background:"rgba(128,128,128,0.06)", display:"flex", gap:20, flexWrap:"wrap" }}>
        {[["prioritaire","#E24B4A"],["court","#BA7517"],["moyen","#378ADD"],["renonce","#888780"]].map(([k,col]) => (
          <span key={k} style={{ fontSize:12, color:col }}>● {counts[k]} {k}</span>
        ))}
        <span style={{ marginLeft:"auto", fontSize:12, fontWeight:500 }}>
          Couverture : {Math.round(((counts.prioritaire||0)+(counts.court||0)+(counts.moyen||0))/chantiers.length*100)}%
        </span>
      </div>
    </div>
  );
}

// ── Trajectoire ───────────────────────────────────────────
function ViewTrajectoire({ config }) {
  const TOTAL = 24;
  const phases = [
    { label:"① Comprendre", color:C.coral, chantiers:[
      { label:"Auditions internes & externes", start:1, end:3, color:C.gray },
      { label:"Cartographie des expositions", start:2, end:5, color:C.coral },
      { label:"Matrice risques / opportunités", start:3, end:5, color:C.coral },
      { label:"Séminaire de direction", start:5, end:6, color:C.gray },
    ]},
    { label:"② Arbitrer", color:C.purple, chantiers:[
      { label:"Grille d'arbitrage", start:5, end:7, color:C.gray },
      { label:"Portefeuille priorisé", start:6, end:8, color:C.coral },
      { label:"Note de gouvernance", start:7, end:9, color:C.gray },
      { label:"Jeu d'indicateurs", start:8, end:10, color:C.purple },
    ]},
    { label:"③ Agir", color:C.teal, chantiers:[
      { label:"Feuille de route exécutable", start:9, end:12, color:C.gray },
      { label:"Protocole repérage fragilités", start:10, end:15, color:C.coral },
      { label:"Tableau de bord de pilotage", start:10, end:13, color:C.purple },
      { label:"Plan adaptation logements", start:11, end:18, color:C.coral },
      { label:"Partenariats médico-sociaux", start:13, end:20, color:C.coral },
      { label:"Rénovation énergétique", start:14, end:24, color:C.teal },
      { label:"Revues trimestrielles", start:13, end:24, color:C.purple },
    ]},
  ];
  const milestones = [
    { month:6, label:"Diagnostic validé", color:C.gray },
    { month:10, label:"Arbitrages actés", color:C.amber },
    { month:13, label:"Lancement opérationnel", color:C.coral },
    { month:18, label:"1ers résultats", color:C.teal },
    { month:24, label:"Bilan 24 mois", color:C.purple },
  ];
  const [hovered, setHovered] = useState(null);

  return (
    <div>
      <h2 style={{ fontSize:16, fontWeight:500, marginBottom:4 }}>Trajectoire 12–24 mois</h2>
      <p style={{ fontSize:12, color:"#888", marginBottom:16 }}>Portefeuille priorisé pour {config.nomBailleur||"le bailleur"}</p>

      {/* Mois header */}
      <div style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:8, marginBottom:4 }}>
        <div/>
        <div style={{ position:"relative", height:18 }}>
          {Array.from({length:9},(_,i)=>i*3+1).map(m => (
            <span key={m} style={{ position:"absolute", left:`${((m-1)/TOTAL)*100}%`, fontSize:9, color:"#aaa", transform:"translateX(-50%)" }}>M{m}</span>
          ))}
        </div>
      </div>

      {phases.map(ph => (
        <div key={ph.label} style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:500, color:ph.color, textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:6, paddingLeft:168 }}>{ph.label}</div>
          {ph.chantiers.map(c => (
            <div key={c.label} style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:8, marginBottom:4, alignItems:"center" }}>
              <div style={{ fontSize:11, textAlign:"right", color:"#888", paddingRight:6, lineHeight:1.3 }}>{c.label}</div>
              <div style={{ position:"relative", height:22, borderRadius:4, background:"rgba(128,128,128,0.08)" }}>
                <div
                  onMouseEnter={e => setHovered({ label:c.label, period:`M${c.start}–M${c.end}`, x:e.clientX, y:e.clientY })}
                  onMouseLeave={() => setHovered(null)}
                  style={{ position:"absolute", left:`${((c.start-1)/TOTAL)*100}%`, width:`${((c.end-c.start+1)/TOTAL)*100}%`,
                    height:22, borderRadius:4, background:c.color, opacity:0.85, cursor:"pointer",
                    display:"flex", alignItems:"center", paddingLeft:6 }}>
                  <span style={{ fontSize:9, color:"#fff", whiteSpace:"nowrap", overflow:"hidden" }}>M{c.start}–M{c.end}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Jalons */}
      <div style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:8, marginTop:8 }}>
        <div style={{ fontSize:11, fontWeight:500, textAlign:"right", paddingRight:6, color:"#888" }}>Jalons clés</div>
        <div style={{ position:"relative", height:40, background:"rgba(128,128,128,0.06)", borderRadius:4 }}>
          {milestones.map(ms => (
            <div key={ms.label}
              onMouseEnter={e => setHovered({ label:ms.label, period:`Mois ${ms.month}`, x:e.clientX, y:e.clientY })}
              onMouseLeave={() => setHovered(null)}
              style={{ position:"absolute", left:`${((ms.month-1)/TOTAL)*100}%`, top:"50%", transform:"translate(-50%,-50%)",
                width:12, height:12, borderRadius:2, rotate:"45deg", background:ms.color, cursor:"pointer" }}/>
          ))}
          {milestones.map(ms => (
            <span key={"l"+ms.month} style={{ position:"absolute", left:`${((ms.month-1)/TOTAL)*100}%`, bottom:-18,
              fontSize:9, color:"#aaa", transform:"translateX(-50%)", whiteSpace:"nowrap" }}>{ms.label}</span>
          ))}
        </div>
      </div>
      <div style={{ height:20 }}/>

      {hovered && (
        <div style={{ position:"fixed", left:hovered.x+12, top:hovered.y-10, background:"white",
          border:"0.5px solid rgba(128,128,128,0.3)", borderRadius:8, padding:"8px 12px",
          fontSize:11, zIndex:1000, pointerEvents:"none", boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
          <div style={{ fontWeight:500 }}>{hovered.label}</div>
          <div style={{ color:"#888" }}>{hovered.period}</div>
        </div>
      )}
    </div>
  );
}

// ── Tableau de bord ───────────────────────────────────────
function ViewDashboard({ config, setConfig, onSave }) {
  const kpis = config.kpis;
  const setKpi = (k,v) => { const nc = { ...config, kpis:{ ...kpis, [k]:v } }; setConfig(nc); onSave(nc); };

  const actionsParStatut = (s) => config.actions.filter(a => a.statut === s).length;
  const pctAvancement = Math.round((actionsParStatut("realise") + actionsParStatut("en-cours")*0.5) / config.actions.length * 100);

  const alertes = [
    config.actions.filter(a=>a.statut==="a-lancer").length > 3 && { level:"warn", label:"À lancer", text:`${config.actions.filter(a=>a.statut==="a-lancer").length} actions en attente de démarrage` },
    parseInt(config.pctSeniors75||0) > 12 && { level:"danger", label:"Seniors", text:`Part des 75+ élevée (${config.pctSeniors75}%) : adaptation prioritaire` },
    parseFloat(config.tauxRotation||0) < 5 && { level:"warn", label:"Rotation", text:`Taux de rotation faible (${config.tauxRotation}%) : risque de blocage du parc` },
  ].filter(Boolean);

  return (
    <div>
      <h2 style={{ fontSize:16, fontWeight:500, marginBottom:4 }}>Tableau de bord de pilotage</h2>
      <p style={{ fontSize:12, color:"#888", marginBottom:16 }}>{config.nomBailleur||"Bailleur"} · Suivi en temps réel</p>

      {/* KPIs éditables */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        {[
          { key:"logAdaptes", label:"Logements adaptés", suffix:"" },
          { key:"mutations", label:"Mutations facilitées", suffix:"" },
          { key:"fragilitesReperes", label:"Fragilités suivies", suffix:"" },
          { key:"tauxRotationActuel", label:"Taux de rotation", suffix:"%" },
        ].map(({ key, label, suffix }) => (
          <div key={key} style={{ background:"rgba(128,128,128,0.05)", borderRadius:12, padding:"14px 16px", border:"0.5px solid rgba(128,128,128,0.15)" }}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:6 }}>{label}</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
              <input type="number" value={kpis[key]||""} onChange={e => setKpi(key, e.target.value)}
                placeholder="0"
                style={{ fontSize:24, fontWeight:500, width:"100%", border:"none", background:"transparent",
                  color:C.coral, outline:"none", padding:0 }}/>
              {suffix && <span style={{ fontSize:14, color:"#888" }}>{suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* Avancement global */}
        <div>
          <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Avancement des actions</div>
          {["Comprendre","Arbitrer","Agir"].map(mod => {
            const acts = config.actions.filter(a => a.module === mod);
            const done = acts.filter(a=>a.statut==="realise").length + acts.filter(a=>a.statut==="en-cours").length*0.5;
            const pct = Math.round(done/acts.length*100);
            const colors = { Comprendre:C.coral, Arbitrer:C.purple, Agir:C.teal };
            return (
              <div key={mod} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <span style={{ fontSize:12, minWidth:90, color:"#888" }}>{mod}</span>
                <div style={{ flex:1, height:8, borderRadius:4, background:"rgba(128,128,128,0.1)", overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", borderRadius:4, background:colors[mod], transition:"width 0.3s" }}/>
                </div>
                <span style={{ fontSize:11, color:"#888", minWidth:32, textAlign:"right" }}>{pct}%</span>
              </div>
            );
          })}
          <div style={{ marginTop:12, padding:"10px 14px", borderRadius:8, background:"rgba(128,128,128,0.06)" }}>
            <span style={{ fontSize:12, color:"#888" }}>Avancement global</span>
            <span style={{ fontSize:20, fontWeight:500, float:"right" }}>{pctAvancement}%</span>
          </div>
        </div>

        {/* Alertes & jalons */}
        <div>
          <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Signaux & alertes</div>
          {alertes.length === 0 && <div style={{ fontSize:12, color:"#888", padding:"8px 0" }}>Aucune alerte active.</div>}
          {alertes.map((a,i) => {
            const styles = { warn:{ bg:"#FAEEDA", col:"#854F0B" }, danger:{ bg:"#FCEBEB", col:"#A32D2D" }, ok:{ bg:"#EAF3DE", col:"#3B6D11" } };
            const s = styles[a.level] || styles.ok;
            return (
              <div key={i} style={{ display:"flex", gap:8, padding:"8px 12px", borderRadius:8, background:s.bg, marginBottom:6, alignItems:"flex-start" }}>
                <Badge label={a.label} bg={s.bg} color={s.col}/>
                <span style={{ fontSize:12 }}>{a.text}</span>
              </div>
            );
          })}

          <div style={{ fontSize:13, fontWeight:500, marginBottom:8, marginTop:16 }}>Jalons à venir</div>
          {[
            { date:"M6", label:"Diagnostic validé", done: actionsParStatut("realise") >= 3 },
            { date:"M10", label:"Arbitrages actés", done: actionsParStatut("realise") >= 6 },
            { date:"M13", label:"Lancement opérationnel", done: false },
          ].map((j,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, fontSize:12 }}>
              <span style={{ fontSize:16, color: j.done ? C.teal : "#ccc" }}>{j.done ? "✓" : "○"}</span>
              <span style={{ color:"#888", minWidth:32 }}>{j.date}</span>
              <span style={{ color: j.done ? "#888" : "inherit", textDecoration: j.done ? "line-through" : "none" }}>{j.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Feuille de route ──────────────────────────────────────
function ViewFeuilleDeRoute({ config, setConfig, onSave }) {
  const [open, setOpen] = useState({ Comprendre:true, Arbitrer:true, Agir:true });

  const updateAction = (id, key, val) => {
    const next = config.actions.map(a => a.id === id ? { ...a, [key]:val } : a);
    const nc = { ...config, actions:next }; setConfig(nc); onSave(nc);
  };

  const modules = ["Comprendre","Arbitrer","Agir"];
  const modColors = { Comprendre:{ color:C.coral, bg:C.coralLight, text:C.coralDark }, Arbitrer:{ color:C.purple, bg:C.purpleLight, text:C.purpleDark }, Agir:{ color:C.teal, bg:C.tealLight, text:C.tealDark } };

  const total = config.actions.length;
  const done = config.actions.filter(a=>a.statut==="realise").length + config.actions.filter(a=>a.statut==="en-cours").length*0.5;
  const pct = Math.round(done/total*100);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:16, fontWeight:500, marginBottom:2 }}>Feuille de route exécutable</h2>
          <p style={{ fontSize:12, color:"#888" }}>{config.nomBailleur||"Bailleur"} · 24 mois</p>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:11, color:"#888" }}>Avancement global</div>
          <div style={{ fontSize:22, fontWeight:500 }}>{pct}%</div>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {Object.entries(statutCfg).map(([k,v]) => (
          <span key={k} style={{ fontSize:11, padding:"2px 8px", borderRadius:4, background:v.bg, color:v.color }}>{v.label}</span>
        ))}
      </div>

      {modules.map(mod => {
        const acts = config.actions.filter(a => a.module === mod);
        const mc = modColors[mod];
        return (
          <div key={mod} style={{ marginBottom:16 }}>
            <div onClick={() => setOpen(o => ({ ...o, [mod]:!o[mod] }))}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10,
                background:mc.bg, cursor:"pointer", marginBottom: open[mod] ? 8 : 0 }}>
              <span style={{ fontSize:13 }}>{open[mod] ? "▾" : "▸"}</span>
              <span style={{ fontSize:13, fontWeight:500, color:mc.text }}>Module — {mod}</span>
              <span style={{ fontSize:11, color:mc.color, marginLeft:"auto" }}>{acts.length} actions</span>
            </div>
            {open[mod] && (
              <div style={{ border:"0.5px solid rgba(128,128,128,0.15)", borderRadius:10, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"2.5fr 1fr 0.8fr 1.5fr 0.9fr", gap:0,
                  padding:"6px 12px", borderBottom:"0.5px solid rgba(128,128,128,0.1)",
                  fontSize:10, color:"#888", textTransform:"uppercase", letterSpacing:"0.04em" }}>
                  <span>Action</span><span>Responsable</span><span>Horizon</span><span>Livrable</span><span>Statut</span>
                </div>
                {acts.map((a,i) => (
                  <div key={a.id} style={{ display:"grid", gridTemplateColumns:"2.5fr 1fr 0.8fr 1.5fr 0.9fr", gap:0,
                    padding:"9px 12px", borderBottom: i<acts.length-1 ? "0.5px solid rgba(128,128,128,0.08)" : "none",
                    alignItems:"start", background: i%2===0 ? "transparent" : "rgba(128,128,128,0.02)" }}>
                    <span style={{ fontSize:12, fontWeight:500 }}>{a.action}</span>
                    <input value={a.resp} onChange={e => updateAction(a.id,"resp",e.target.value)}
                      placeholder="Responsable…"
                      style={{ fontSize:11, border:"none", background:"transparent", color:"#888",
                        outline:"none", width:"100%", padding:0 }}/>
                    <span style={{ fontSize:11, padding:"2px 6px", borderRadius:4, background:"rgba(128,128,128,0.08)", color:"#888", alignSelf:"start", display:"inline-block", whiteSpace:"nowrap" }}>{a.horizon}</span>
                    <span style={{ fontSize:11, color:"#888", paddingRight:8 }}>{a.livrable}</span>
                    <select value={a.statut} onChange={e => updateAction(a.id,"statut",e.target.value)}
                      style={{ fontSize:11, padding:"2px 4px", border:"0.5px solid rgba(128,128,128,0.2)",
                        borderRadius:6, background:"transparent", color:"inherit", width:"100%" }}>
                      {Object.entries(statutCfg).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Synthèse */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginTop:4 }}>
        {modules.map(mod => {
          const acts = config.actions.filter(a => a.module === mod);
          const d = acts.filter(a=>a.statut==="realise").length + acts.filter(a=>a.statut==="en-cours").length*0.5;
          const mc = modColors[mod];
          return (
            <div key={mod} style={{ padding:"12px 14px", borderRadius:10, border:"0.5px solid rgba(128,128,128,0.15)", background:"rgba(128,128,128,0.02)" }}>
              <div style={{ fontSize:11, fontWeight:500, color:mc.color, marginBottom:4 }}>{mod}</div>
              <div style={{ fontSize:22, fontWeight:500, marginBottom:4 }}>{Math.round(d/acts.length*100)}%</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {Object.entries(statutCfg).map(([k,v]) => {
                  const n = acts.filter(a=>a.statut===k).length;
                  return n > 0 ? <span key={k} style={{ fontSize:10, color:v.color }}>{v.label.split(" ")[1]||v.label} ×{n}</span> : null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════
const VIEWS = [
  { id:"config", label:"Configuration", icon:"⚙" },
  { id:"carto", label:"Cartographie", icon:"🗺" },
  { id:"matrice", label:"Matrice risques", icon:"◎" },
  { id:"arbitrage", label:"Grille d'arbitrage", icon:"⚖" },
  { id:"trajectoire", label:"Trajectoire 24 mois", icon:"📅" },
  { id:"dashboard", label:"Tableau de bord", icon:"📊" },
  { id:"fdr", label:"Feuille de route", icon:"📋" },
];

export default function App() {
  const [config, setConfig] = useState(null);
  const [view, setView] = useState("config");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadData("agenda21_config").then(d => {
      if (d) { setConfig(d); setView("dashboard"); }
      else setConfig({ ...DEFAULT_CONFIG });
      setLoaded(true);
    });
  }, []);

  const handleSave = useCallback(async (cfg) => {
    await saveData("agenda21_config", cfg);
  }, []);

  const handleConfigSave = (cfg) => {
    setConfig(cfg);
    handleSave(cfg);
    setView("carto");
  };

  if (!loaded) return <div style={{ padding:40, color:"#888", fontSize:13 }}>Chargement…</div>;

  const configured = config?.nomBailleur;

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"inherit" }}>
      {/* Sidebar */}
      <div style={{ width:220, flexShrink:0, borderRight:"0.5px solid rgba(128,128,128,0.15)",
        padding:"20px 0", background:"rgba(128,128,128,0.03)" }}>
        <div style={{ padding:"0 16px 20px", borderBottom:"0.5px solid rgba(128,128,128,0.1)" }}>
          <div style={{ fontSize:13, fontWeight:500, color:C.coral, lineHeight:1.2 }}>Agenda 21</div>
          <div style={{ fontSize:11, color:"#888" }}>de la longévité</div>
          {configured && <div style={{ fontSize:11, marginTop:6, color:"#888", background:"rgba(128,128,128,0.08)", padding:"4px 8px", borderRadius:6 }}>{config.nomBailleur}</div>}
        </div>
        <div style={{ padding:"12px 8px" }}>
          {VIEWS.map(v => {
            const disabled = !configured && v.id !== "config";
            return (
              <button key={v.id} onClick={() => !disabled && setView(v.id)}
                disabled={disabled}
                style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"8px 12px",
                  borderRadius:8, border:"none", textAlign:"left", cursor: disabled ? "default" : "pointer",
                  fontSize:12, fontWeight: view===v.id ? 500 : 400,
                  background: view===v.id ? `${C.coral}18` : "transparent",
                  color: view===v.id ? C.coral : disabled ? "#ccc" : "inherit" }}>
                <span style={{ fontSize:14 }}>{v.icon}</span>
                {v.label}
              </button>
            );
          })}
        </div>
        {configured && (
          <div style={{ padding:"12px 16px", borderTop:"0.5px solid rgba(128,128,128,0.1)", marginTop:"auto" }}>
            <button onClick={() => { setConfig({ ...DEFAULT_CONFIG }); setView("config"); }}
              style={{ fontSize:11, color:"#888", background:"transparent", border:"none", cursor:"pointer", padding:0 }}>
              + Nouvel accompagnement
            </button>
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex:1, padding:28, overflowY:"auto", maxWidth:860 }}>
        {view === "config" && <ViewConfig config={config} setConfig={setConfig} onSave={handleConfigSave}/>}
        {view === "carto" && <ViewCarto config={config}/>}
        {view === "matrice" && <ViewMatrice config={config}/>}
        {view === "arbitrage" && <ViewArbitrage config={config} setConfig={setConfig} onSave={handleSave}/>}
        {view === "trajectoire" && <ViewTrajectoire config={config}/>}
        {view === "dashboard" && <ViewDashboard config={config} setConfig={setConfig} onSave={handleSave}/>}
        {view === "fdr" && <ViewFeuilleDeRoute config={config} setConfig={setConfig} onSave={handleSave}/>}
      </div>
    </div>
  );
}