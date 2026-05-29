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

    // 1. API Geo (fiable)
    try {
      const rGeo = await fetch("https://geo.api.gouv.fr/communes/"+citycode+"?fields=nom,population,codeDepartement,codeRegion,epci");
      if (rGeo.ok) {
        const d = await rGeo.json();
        if (d.population) {
          results["_meta_population"] = { valeur:String(d.population), source:"API Geo gouv.fr", niveau:"commune" };
          results["_meta_seniors"] = { valeur:"Pop. "+d.population+" hab. (75+ estimés ~"+Math.round(d.population*0.085)+")", source:"API Geo + benchmark INSEE 2023", niveau:"commune" };
        }
        if (d.epci) results["_meta_epci"] = { valeur:typeof d.epci==="object"?(d.epci.nom||d.epci.code):String(d.epci), source:"API Geo gouv.fr", niveau:"epci" };
        if (d.codeDepartement) results["_meta_dept"] = { valeur:"Dép. "+d.codeDepartement, source:"API Geo gouv.fr", niveau:"departement" };
      }
    } catch(e) { console.log("Geo error:", e.message); }

    // 2. Georisques (fiable)
    try {
      if (lat && lon) {
        const rGR = await fetch("https://georisques.gouv.fr/api/v1/gaspar/risques?rayon=1000&latlon="+lon+","+lat+"&page=1&page_size=20");
        console.log("Georisques:", rGR.status);
        if (rGR.ok) {
          const d = await rGR.json();
          if (d && d.data && d.data.length > 0) {
            const risques = d.data.map(function(r){return r.libelle_risque_jo||r.code_risque;}).filter(Boolean);
            results["_meta_georisques"] = { valeur:"Risques : "+risques.slice(0,5).join(", "), source:"Georisques 2026", niveau:"adresse" };
            if (risques.some(function(r){return r.toLowerCase().includes("inond");})) set("te5", 45, "Georisques 2026", "adresse");
          } else {
            results["_meta_georisques"] = { valeur:"Aucun risque majeur identifié (rayon 1km)", source:"Georisques 2026", niveau:"adresse" };
          }
        }
      }
    } catch(e) { console.log("Georisques error:", e.message); }

    // 3. ADEME DPE — filtre code_postal_ban ou nom_commune
    try {
      const urlDpe = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?size=1000&qs=code_commune_insee:"+citycode+"&select=etiquette_dpe";
      const rDpe = await fetch(urlDpe);
      console.log("ADEME DPE:", rDpe.status);
      if (rDpe.ok) {
        const d = await rDpe.json();
        if (d.results && d.results.length > 0) {
          let total=d.results.length, efg=0, renove=0;
          d.results.forEach(function(r){
            if(["E","F","G"].includes(r.etiquette_dpe)) efg++;
            if(["A","B","C"].includes(r.etiquette_dpe)) renove++;
          });
          set("te1", efg/total*100, "ADEME DPE 2025", "commune");
          set("te2", renove/total*100, "ADEME DPE 2025", "commune");
          results["_meta_dpe"] = { valeur:total+" DPE : "+Math.round(efg/total*100)+"% EFG, "+Math.round(renove/total*100)+"% ABC", source:"ADEME DPE 2025", niveau:"commune" };
        }
      }
    } catch(e) { console.log("ADEME error:", e.message); }

    // 4. RPLS — tabular API avec bon resource ID et filtre commune
    try {
      const urlRpls = "https://tabular-api.data.gouv.fr/api/resources/7649e51e-9418-4173-9dc6-cefb94bbd7c0/data/?commune_code="+citycode+"&page_size=1";
      const rRpls = await fetch(urlRpls);
      console.log("RPLS:", rRpls.status);
      if (rRpls.ok) {
        const d = await rRpls.json();
        console.log("RPLS data:", JSON.stringify(d).slice(0,200));
        if (d && d.meta && d.meta.total > 0) {
          results["_meta_rpls"] = { valeur:d.meta.total+" logements sociaux", source:"RPLS 2023 — data.gouv.fr", niveau:"commune" };
        }
      }
    } catch(e) { console.log("RPLS error:", e.message); }

    // 5. BPE — utiliser l'API données locales INSEE directement
    try {
      const urlBpe = "https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-TYPEQU@BPE2021/COM-"+citycode+".all";
      const rBpe = await fetch(urlBpe, { headers:{ Accept:"application/json", "User-Agent":"Mozilla/5.0" } });
      console.log("BPE INSEE:", rBpe.status);
      if (rBpe.ok) {
        const d = await rBpe.json();
        if (d && d.Cellule) {
          let medecins=0, pharmacies=0, ehpad=0, services=0;
          d.Cellule.forEach(function(c){
            const type = (c.Modalite||[]).find(function(m){return m["@variable"]==="TYPEQU";});
            const v = parseFloat(c.Valeur||0);
            if (!type) return;
            const code = type["@code"];
            if(code==="D201") medecins+=v;
            if(code==="D401") pharmacies+=v;
            if(["D109","D110"].includes(code)) ehpad+=v;
            if(code==="D107") services+=v;
          });
          const partenaires = (medecins>0?1:0)+(ehpad>0?2:0)+(services>0?2:0)+(pharmacies>0?1:0);
          if(partenaires>0) set("pt1", partenaires, "INSEE BPE 2021", "commune");
          results["_meta_bpe"] = { valeur:Math.round(medecins)+" médecins, "+Math.round(pharmacies)+" pharmacies, "+Math.round(ehpad)+" EHPAD", source:"INSEE BPE 2021", niveau:"commune" };
        }
      }
    } catch(e) { console.log("BPE error:", e.message); }

    // 6. Filosofi — API données locales INSEE
    try {
      const urlFilo = "https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-INDIC@FILOSOFI2020/COM-"+citycode+".all";
      const rFilo = await fetch(urlFilo, { headers:{ Accept:"application/json", "User-Agent":"Mozilla/5.0" } });
      console.log("Filosofi:", rFilo.status);
      if (rFilo.ok) {
        const d = await rFilo.json();
        if (d && d.Cellule) {
          d.Cellule.forEach(function(c){
            const indic = (c.Modalite||[]).find(function(m){return m["@variable"]==="INDIC";});
            if (!indic) return;
            const val = parseFloat(c.Valeur);
            if (indic["@code"]==="TP60" && !isNaN(val) && val>0) {
              set("v14", val/100*0.35, "INSEE Filosofi 2020", "commune");
              results["_meta_pauvrete"] = { valeur:"Taux pauvreté : "+val+"%", source:"INSEE Filosofi 2020", niveau:"commune" };
            }
            if (indic["@code"]==="MED21" && !isNaN(val) && val>0) {
              results["_meta_revenu"] = { valeur:Math.round(val)+" €/an (revenu médian)", source:"INSEE Filosofi 2020", niveau:"commune" };
            }
          });
        }
      }
    } catch(e) { console.log("Filosofi error:", e.message); }

    // 7. INSEE Recensement population par âge
    try {
      const urlRp = "https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-SEXE-AGE15_15_90@GEO2023RP2020/COM-"+citycode+".all.all";
      const rRp = await fetch(urlRp, { headers:{ Accept:"application/json", "User-Agent":"Mozilla/5.0" } });
      console.log("INSEE RP:", rRp.status);
      if (rRp.ok) {
        const d = await rRp.json();
        if (d && d.Cellule) {
          let total=0, s60=0, s75=0, s85=0;
          d.Cellule.forEach(function(c){
            const age = (c.Modalite||[]).find(function(m){return m["@variable"]==="AGE15_15_90";});
            const v = parseFloat(c.Valeur||0);
            if (!age) return;
            total += v;
            if(["60-74","75-89","90+"].includes(age["@code"])) s60+=v;
            if(["75-89","90+"].includes(age["@code"])) s75+=v;
            if(age["@code"]==="90+") s85+=v;
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
    return { statusCode:500, headers, body:JSON.stringify({ error:err.message }) };
  }
};