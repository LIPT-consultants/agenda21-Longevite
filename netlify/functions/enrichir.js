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

    // 1. API Geo
    try {
      const rGeo = await fetch("https://geo.api.gouv.fr/communes/" + citycode + "?fields=nom,population,codeDepartement,codeRegion,epci");
      if (rGeo.ok) {
        const dGeo = await rGeo.json();
        if (dGeo.population) results["_meta_population"] = { valeur: String(dGeo.population), source:"API Geo", niveau:"commune" };
        if (dGeo.epci) results["_meta_epci"] = { valeur: typeof dGeo.epci === "object" ? (dGeo.epci.nom || String(dGeo.epci)) : String(dGeo.epci), source:"API Geo", niveau:"epci" };
      }
    } catch(e) { console.log("Geo error:", e.message); }

    // 2. ADEME DPE
    try {
      const urlDpe = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?size=500&q=" + encodeURIComponent(city) + "&q_fields=nom_commune_ban&select=etiquette_dpe";
      const rDpe = await fetch(urlDpe);
      console.log("ADEME DPE status:", rDpe.status);
      if (rDpe.ok) {
        const dDpe = await rDpe.json();
        console.log("ADEME DPE count:", dDpe.results ? dDpe.results.length : 0);
        if (dDpe.results && dDpe.results.length > 0) {
          var total = dDpe.results.length, efg = 0, renove = 0;
          dDpe.results.forEach(function(r) {
            if (["E","F","G"].includes(r.etiquette_dpe)) efg++;
            if (["A","B","C"].includes(r.etiquette_dpe)) renove++;
          });
          set("te1", efg/total*100, "ADEME DPE 2025", "commune");
          set("te2", renove/total*100, "ADEME DPE 2025", "commune");
        }
      }
    } catch(e) { console.log("ADEME error:", e.message); }

    // 3. BPE INSEE
    try {
      const urlBpe = "https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-TYPEQU@BPE2021/COM-" + citycode + ".all";
      const rBpe = await fetch(urlBpe, { headers:{ Accept:"application/json" } });
      console.log("BPE status:", rBpe.status);
      if (rBpe.ok) {
        const dBpe = await rBpe.json();
        if (dBpe && dBpe.Cellule) {
          var medecins=0, ehpad=0, services=0, pharmacies=0;
          dBpe.Cellule.forEach(function(c) {
            var type = (c.Modalite||[]).find(function(m){return m["@variable"]==="TYPEQU";});
            var v = parseFloat(c.Valeur||0);
            if (!type) return;
            var code = type["@code"];
            if (code==="D201") medecins+=v;
            if (code==="D401") pharmacies+=v;
            if (["D109","D110"].includes(code)) ehpad+=v;
            if (code==="D107") services+=v;
          });
          var partenaires = (medecins>0?1:0)+(ehpad>0?2:0)+(services>0?2:0)+(pharmacies>0?1:0);
          set("pt1", partenaires, "INSEE BPE 2021", "commune");
          results["_meta_bpe"] = { valeur: Math.round(medecins)+" medecins, "+Math.round(pharmacies)+" pharmacies, "+Math.round(ehpad)+" EHPAD", source:"INSEE BPE 2021", niveau:"commune" };
        }
      }
    } catch(e) { console.log("BPE error:", e.message); }

    // 4. Georisques
    try {
      if (lat && lon) {
        var urlGR = "https://georisques.gouv.fr/api/v1/gaspar/risques?rayon=1000&latlon="+lon+","+lat+"&page=1&page_size=10";
        var rGR = await fetch(urlGR);
        console.log("Georisques status:", rGR.status);
        if (rGR.ok) {
          var dGR = await rGR.json();
          if (dGR && dGR.data && dGR.data.length > 0) {
            var risques = dGR.data.map(function(r){return r.libelle_risque_jo||r.code_risque;}).filter(Boolean);
            results["_meta_georisques"] = { valeur:"Risques : "+risques.slice(0,3).join(", "), source:"Georisques 2026", niveau:"commune" };
            var hasInondation = risques.some(function(r){return r.toLowerCase().includes("inond");});
            if (hasInondation) set("te5", 40, "Georisques - risque inondation", "commune");
          }
        }
      }
    } catch(e) { console.log("Georisques error:", e.message); }

    // 5. RPLS
    try {
      var urlRpls = "https://data.statistiques.developpement-durable.gouv.fr/ods/api/records/1.0/search/?dataset=rpls-2023&q=code_com:"+citycode+"&rows=0";
      var rRpls = await fetch(urlRpls);
      console.log("RPLS status:", rRpls.status);
      if (rRpls.ok) {
        var dRpls = await rRpls.json();
        if (dRpls.nhits > 0) {
          results["_meta_rpls"] = { valeur: dRpls.nhits+" logements sociaux dans la commune", source:"RPLS 2023", niveau:"commune" };
        }
      }
    } catch(e) { console.log("RPLS error:", e.message); }

    // 6. Filosofi
    try {
      var urlFilo = "https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-INDIC@FILOSOFI2020/COM-"+citycode+".all";
      var rFilo = await fetch(urlFilo, { headers:{ Accept:"application/json" } });
      console.log("Filosofi status:", rFilo.status);
      if (rFilo.ok) {
        var dFilo = await rFilo.json();
        if (dFilo && dFilo.Cellule) {
          dFilo.Cellule.forEach(function(c) {
            var indic = (c.Modalite||[]).find(function(m){return m["@variable"]==="INDIC";});
            if (!indic) return;
            var val = parseFloat(c.Valeur);
            if (indic["@code"]==="TP60" && !isNaN(val)) set("v14", val/100*0.35, "INSEE Filosofi 2020", "commune");
            if (indic["@code"]==="MED21" && !isNaN(val)) results["_meta_revenu"] = { valeur: Math.round(val)+" euros/an", source:"INSEE Filosofi 2020 - revenu median", niveau:"commune" };
          });
        }
      }
    } catch(e) { console.log("Filosofi error:", e.message); }

    // 7. INSEE Recensement
    try {
      var urlPop = "https://api.insee.fr/donnees-locales/V0.1/donnees/geo-SEXE-AGE15_15_90@GEO2023RP2020/COM-"+citycode+".all.all";
      var rPop = await fetch(urlPop, { headers:{ Accept:"application/json" } });
      console.log("INSEE RP status:", rPop.status);
      if (rPop.ok) {
        var dPop = await rPop.json();
        if (dPop && dPop.Cellule) {
          var popTotal=0, s60=0, s75=0, s85=0;
          dPop.Cellule.forEach(function(c) {
            var age = (c.Modalite||[]).find(function(m){return m["@variable"]==="AGE15_15_90";});
            var v = parseFloat(c.Valeur||0);
            if (!age) return;
            popTotal += v;
            if (["60-74","75-89","90+"].includes(age["@code"])) s60+=v;
            if (["75-89","90+"].includes(age["@code"])) s75+=v;
            if (age["@code"]==="90+") s85+=v;
          });
          if (popTotal>0) {
            set("v1", s60/popTotal*100, "INSEE RP 2020", "commune");
            set("v2", s75/popTotal*100, "INSEE RP 2020", "commune");
            set("v3", s85/popTotal*100, "INSEE RP 2020", "commune");
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