exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode:200, headers, body:"" };
  if (event.httpMethod !== "POST") return { statusCode:405, headers, body:JSON.stringify({error:"Method not allowed"}) };

  try {
    const { citycode, city, lat, lon } = JSON.parse(event.body);
    const results = {};

    function set(id, val, source, niveau) {
      if (val !== null && val !== undefined && !isNaN(parseFloat(val))) {
        results[id] = { valeur: String(Math.round(parseFloat(val) * 10) / 10), source, niveau };
      }
    }

    // ── 1. API Géo ──────────────────────────────────────────
    try {
      const rGeo = await fetch(`https://geo.api.gouv.fr/communes/${citycode}?fields=nom,population,codeDepartement,codeRegion,epci`);
      if (rGeo.ok) {
        const dGeo = await rGeo.json();
        if (dGeo.population) results["_meta_population"] = { valeur: String(dGeo.population), source:"API Géo", niveau:"commune" };
        if (dGeo.epci) results["_meta_epci"] = { valeur: typeof dGeo.epci === "object" ? (dGeo.epci.nom || JSON.stringify(dGeo.epci)) : String(dGeo.epci), source:"API Géo", niveau:"epci" };
      }
    } catch(e) {}

    // ── 2. ADEME DPE ────────────────────────────────────────
    try {
      const urlDpe = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?size=500&q=${encodeURIComponent(city)}&q_fields=nom_commune_ban&select=etiquette_dpe`;
      const rDpe = await fetch(urlDpe);
      if (rDpe.ok) {
        const dDpe = await rDpe.json();
        if (dDpe.results && dDpe.results.length > 0) {
          let total = dDpe.results.length, efg = 0, renove = 0;
          dDpe.results.forEach(function(r) {
            if (["E","F","G"].includes(r.etiquette_dpe)) efg++;
            if (["A","B","C"].includes(r.etiquette_dpe)) renove++;
          });
          set("te1", efg/total*100, "ADEME Observatoire DPE 2025", "commune");
          set("te2", renove/total*100, "ADEME Observatoire DPE 2025", "commune");
        }
      }
    } catch(e) {}

    // ── 3. BPE INSEE ────────────────────────────────────────
    try {
      const urlBpe = `https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-TYPEQU@BPE2021/COM-${citycode}.all`;
      const rBpe = await fetch(urlBpe, { headers:{ Accept:"application/json" } });
      if (rBpe.ok) {
        const dBpe = await rBpe.json();
        if (dBpe && dBpe.Cellule) {
          let medecins=0, ehpad=0, services=0, pharmacies=0, infirmiers=0;
          dBpe.Cellule.forEach(function(c) {
            const type = (c.Modalite||[]).find(function(m){return m["@variable"]==="TYPEQU";});
            const v = parseFloat(c.Valeur||0);
            if (!type) return;
            const code = type["@code"];
            if (code==="D201") medecins+=v;
            if (code==="D301") infirmiers+=v;
            if (code==="D401") pharmacies+=v;
            if (["D109","D110"].includes(code)) ehpad+=v;
            if (code==="D107") services+=v;
          });
          const partenaires = (medecins>0?1:0)+(ehpad>0?2:0)+(services>0?2:0)+(pharmacies>0?1:0);
          set("pt1", partenaires, "INSEE BPE 2021", "commune");
          results["_meta_bpe"] = { valeur:`${Math.round(medecins)} médecins, ${Math.round(pharmacies)} pharmacies, ${Math.round(ehpad)} EHPAD/résidences`, source:"INSEE BPE 2021", niveau:"commune" };
        }
      }
    } catch(e) {}

    // ── 4. Géorisques ───────────────────────────────────────
    try {
      if (lat && lon) {
        const rGR = await fetch(`https://georisques.gouv.fr/api/v1/gaspar/risques?rayon=1000&latlon=${lon},${lat}&page=1&page_size=10`);
        if (rGR.ok) {
          const dGR = await rGR.json();
          if (dGR && dGR.data) {
            const risques = dGR.data.map(function(r){return r.libelle_risque_jo||r.code_risque;}).filter(Boolean);
            if (risques.length > 0) {
              results["_meta_georisques"] = { valeur:`Risques identifiés : ${risques.slice(0,3).join(", ")}`, source:"Géorisques 2026", niveau:"commune" };
              const hasInondation = risques.some(function(r){return r.toLowerCase().includes("inond");});
              if (hasInondation) set("te5", 40, "Géorisques — risque inondation", "commune");
            }
          }
        }
      }
    } catch(e) {}

    // ── 5. RPLS ─────────────────────────────────────────────
    try {
      const urlRpls = `https://data.statistiques.developpement-durable.gouv.fr/ods/api/records/1.0/search/?dataset=rpls-2023&q=code_com:${citycode}&rows=0`;
      const rRpls = await fetch(urlRpls);
      if (rRpls.ok) {
        const dRpls = await rRpls.json();
        if (dRpls.nhits > 0) {
          results["_meta_rpls"] = { valeur:`${dRpls.nhits} logements sociaux recensés dans la commune`, source:"RPLS 2023", niveau:"commune" };
        }
      }
    } catch(e) {}

    // ── 6. Filosofi (via API Open Data INSEE) ───────────────
    try {
      const urlFilo = `https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-INDIC@FILOSOFI2020/COM-${citycode}.all`;
      const rFilo = await fetch(urlFilo, { headers:{ Accept:"application/json" } });
      if (rFilo.ok) {
        const dFilo = await rFilo.json();
        if (dFilo && dFilo.Cellule) {
          dFilo.Cellule.forEach(function(c) {
            const indic = (c.Modalite||[]).find(function(m){return m["@variable"]==="INDIC";});
            if (!indic) return;
            const val = parseFloat(c.Valeur);
            if (indic["@code"]==="TP60" && !isNaN(val)) set("v14", val/100*0.35, "INSEE Filosofi 2020 — taux pauvreté (proxy)", "commune");
            if (indic["@code"]==="MED21" && !isNaN(val)) results["_meta_revenu"] = { valeur:`${Math.round(val)} €/an`, source:"INSEE Filosofi 2020 — revenu médian", niveau:"commune" };
          });
        }
      }
    } catch(e) {}

    // ── 7. INSEE Recensement ────────────────────────────────
    try {
      const urlPop = `https://api.insee.fr/donnees-locales/V0.1/donnees/geo-SEXE-AGE15_15_90@GEO2023RP2020/COM-${citycode}.all.all`;
      const rPop = await fetch(urlPop, { headers:{ Accept:"application/json" } });
      if (rPop.ok) {
        const dPop = await rPop.json();
        if (dPop && dPop.Cellule) {
          let total=0, s60=0, s75=0, s85=0;
          dPop.Cellule.forEach(function(c) {
            const age = (c.Modalite||[]).find(function(m){return m["@variable"]==="AGE15_15_90";});
            const v = parseFloat(c.Valeur||0);
            if (!age) return;
            total += v;
            if (["60-74","75-89","90+"].includes(age["@code"])) s60+=v;
            if (["75-89","90+"].includes(age["@code"])) s75+=v;
            if (age["@code"]==="90+") s85+=v;
          });
          if (total>0) {
            set("v1", s60/total*100, "INSEE RP 2020 — commune", "commune");
            set("v2", s75/total*100, "INSEE RP 2020 — commune", "commune");
            set("v3", s85/total*100, "INSEE RP 2020 — commune", "commune");
          }
        }
      }
    } catch(e) {}

    return { statusCode:200, headers, body:JSON.stringify(results) };

  } catch(err) {
    return { statusCode:500, headers, body:JSON.stringify({ error:"Erreur serveur : "+err.message }) };
  }
};