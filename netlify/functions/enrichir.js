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

    // 1. API Geo (fonctionne)
    try {
      const rGeo = await fetch("https://geo.api.gouv.fr/communes/" + citycode + "?fields=nom,population,codeDepartement,codeRegion,epci");
      if (rGeo.ok) {
        const dGeo = await rGeo.json();
        if (dGeo.population) results["_meta_population"] = { valeur: String(dGeo.population), source:"API Geo gouv.fr", niveau:"commune" };
        if (dGeo.epci) results["_meta_epci"] = { valeur: typeof dGeo.epci === "object" ? (dGeo.epci.nom || JSON.stringify(dGeo.epci)) : String(dGeo.epci), source:"API Geo gouv.fr", niveau:"epci" };
      }
    } catch(e) { console.log("Geo error:", e.message); }

    // 2. Georisques (fonctionne)
    try {
      if (lat && lon) {
        const rGR = await fetch("https://georisques.gouv.fr/api/v1/gaspar/risques?rayon=1000&latlon="+lon+","+lat+"&page=1&page_size=10");
        console.log("Georisques status:", rGR.status);
        if (rGR.ok) {
          const dGR = await rGR.json();
          if (dGR && dGR.data && dGR.data.length > 0) {
            const risques = dGR.data.map(function(r){return r.libelle_risque_jo||r.code_risque;}).filter(Boolean);
            results["_meta_georisques"] = { valeur:"Risques : "+risques.slice(0,4).join(", "), source:"Georisques 2026", niveau:"commune" };
            const hasInondation = risques.some(function(r){return r.toLowerCase().includes("inond");});
            if (hasInondation) set("te5", 40, "Georisques - risque inondation", "commune");
          }
        }
      }
    } catch(e) { console.log("Georisques error:", e.message); }

    // 3. ADEME DPE — URL corrigée
    try {
      const urlDpe = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?size=500&qs=nom_commune_ban:\""+encodeURIComponent(city)+"\"&select=etiquette_dpe,classe_altitude";
      const rDpe = await fetch(urlDpe, { headers:{ "x-apikey":"" } });
      console.log("ADEME DPE status:", rDpe.status);
      if (rDpe.ok) {
        const dDpe = await rDpe.json();
        if (dDpe.results && dDpe.results.length > 0) {
          let total = dDpe.results.length, efg = 0, renove = 0;
          dDpe.results.forEach(function(r) {
            if (["E","F","G"].includes(r.etiquette_dpe)) efg++;
            if (["A","B","C"].includes(r.etiquette_dpe)) renove++;
          });
          set("te1", efg/total*100, "ADEME DPE 2025", "commune");
          set("te2", renove/total*100, "ADEME DPE 2025", "commune");
          results["_meta_dpe"] = { valeur: total+" DPE analysés : "+Math.round(efg/total*100)+"% EFG, "+Math.round(renove/total*100)+"% ABC", source:"ADEME Observatoire DPE 2025", niveau:"commune" };
        }
      }
    } catch(e) { console.log("ADEME error:", e.message); }

    // 4. INSEE - données communales via API Decoupage
    try {
      const rPop = await fetch("https://geo.api.gouv.fr/communes/"+citycode+"/departement");
      if (rPop.ok) {
        const dPop = await rPop.json();
        if (dPop && dPop.code) {
          results["_meta_departement"] = { valeur:"Département "+dPop.code+" — "+dPop.nom, source:"API Geo gouv.fr", niveau:"departement" };
        }
      }
    } catch(e) {}

    // 5. BPE via API Carto INSEE
    try {
      const urlBpe = "https://apicarto.ign.fr/api/codes-postaux/communes/"+citycode;
      const rBpe = await fetch(urlBpe);
      console.log("BPE/Carto status:", rBpe.status);
    } catch(e) { console.log("BPE error:", e.message); }

    // 6. RPLS via data.gouv.fr — URL corrigée
    try {
      const urlRpls = "https://tabular-api.data.gouv.fr/api/resources/dc80e171-5a8b-4bca-9a5e-a77be600545e/data/?commune_code="+citycode+"&page_size=1";
      const rRpls = await fetch(urlRpls);
      console.log("RPLS status:", rRpls.status);
      if (rRpls.ok) {
        const dRpls = await rRpls.json();
        if (dRpls.meta && dRpls.meta.total > 0) {
          results["_meta_rpls"] = { valeur: dRpls.meta.total+" logements sociaux recensés dans la commune", source:"RPLS 2023 — data.gouv.fr", niveau:"commune" };
        }
      }
    } catch(e) { console.log("RPLS error:", e.message); }

    // 7. Filosofi via API INSEE Open Data
    try {
      const urlFilo = "https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-INDIC@FILOSOFI2020/COM-"+citycode+".all";
      const rFilo = await fetch(urlFilo, {
        headers:{ Accept:"application/json", "User-Agent":"Agenda21Longevite/1.0" }
      });
      console.log("Filosofi status:", rFilo.status);
      if (rFilo.ok) {
        const dFilo = await rFilo.json();
        if (dFilo && dFilo.Cellule) {
          dFilo.Cellule.forEach(function(c) {
            const indic = (c.Modalite||[]).find(function(m){return m["@variable"]==="INDIC";});
            if (!indic) return;
            const val = parseFloat(c.Valeur);
            if (indic["@code"]==="TP60" && !isNaN(val)) set("v14", val/100*0.35, "INSEE Filosofi 2020 — proxy taux effort", "commune");
            if (indic["@code"]==="MED21" && !isNaN(val)) results["_meta_revenu"] = { valeur: Math.round(val)+" euros/an", source:"INSEE Filosofi 2020 — revenu median", niveau:"commune" };
          });
        }
      }
    } catch(e) { console.log("Filosofi error:", e.message); }

    // 8. INSEE Recensement via API Donnees Locales
    try {
      const urlRp = "https://api.insee.fr/donnees-locales/V0.1/donnees/geo-SEXE-AGE15_15_90@GEO2023RP2020/COM-"+citycode+".all.all";
      const rRp = await fetch(urlRp, {
        headers:{ Accept:"application/json", "Authorization":"Bearer anonymous" }
      });
      console.log("INSEE RP status:", rRp.status);
      if (rRp.ok) {
        const dPop = await rRp.json();
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
            set("v1", s60/total*100, "INSEE RP 2020", "commune");
            set("v2", s75/total*100, "INSEE RP 2020", "commune");
            set("v3", s85/total*100, "INSEE RP 2020", "commune");
          }
        }
      }
    } catch(e) { console.log("INSEE RP error:", e.message); }

    console.log("Resultats finaux:", Object.keys(results));
    return { statusCode:200, headers, body:JSON.stringify(results) };

  } catch(err) {
    console.log("Erreur globale:", err.message);
    return { statusCode:500, headers, body:JSON.stringify({ error:"Erreur serveur : "+err.message }) };
  }
};