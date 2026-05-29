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
      const rGeo = await fetch("https://geo.api.gouv.fr/communes/"+citycode+"?fields=nom,population,codeDepartement,codeRegion,epci");
      if (rGeo.ok) {
        const d = await rGeo.json();
        if (d.population) results["_meta_population"] = { valeur:String(d.population), source:"API Geo gouv.fr", niveau:"commune" };
        if (d.epci) results["_meta_epci"] = { valeur:typeof d.epci==="object"?(d.epci.nom||d.epci.code||"EPCI"):String(d.epci), source:"API Geo gouv.fr", niveau:"epci" };
        if (d.codeDepartement) results["_meta_dept"] = { valeur:"Dép. "+d.codeDepartement, source:"API Geo gouv.fr", niveau:"departement" };
        if (d.population) results["_meta_seniors"] = { valeur:"Pop. totale "+d.population+" hab. (75+ estimés ~"+Math.round(d.population*0.085)+")", source:"API Geo + benchmark INSEE 2023", niveau:"commune" };
      }
    } catch(e) { console.log("Geo error:", e.message); }

    // 2. Georisques
    try {
      if (lat && lon) {
        const rGR = await fetch("https://georisques.gouv.fr/api/v1/gaspar/risques?rayon=1000&latlon="+lon+","+lat+"&page=1&page_size=20");
        console.log("Georisques:", rGR.status);
        if (rGR.ok) {
          const d = await rGR.json();
          if (d && d.data && d.data.length > 0) {
            const risques = d.data.map(function(r){return r.libelle_risque_jo||r.code_risque;}).filter(Boolean);
            results["_meta_georisques"] = { valeur:"Risques : "+risques.slice(0,5).join(", "), source:"Georisques 2026", niveau:"adresse" };
            if (risques.some(function(r){return r.toLowerCase().includes("inond");})) set("te5", 45, "Georisques 2026 — inondation", "adresse");
          } else {
            results["_meta_georisques"] = { valeur:"Aucun risque majeur identifié (rayon 1km)", source:"Georisques 2026", niveau:"adresse" };
          }
        }
      }
    } catch(e) { console.log("Georisques error:", e.message); }

    // 3. ADEME DPE — filtre par code commune
    try {
      const urlDpe = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?size=1000&qs=code_insee_commune_actualise:"+citycode+"&select=etiquette_dpe";
      const rDpe = await fetch(urlDpe);
      console.log("ADEME DPE (code insee):", rDpe.status);
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
          results["_meta_dpe"] = { valeur:total+" DPE : "+Math.round(efg/total*100)+"% EFG, "+Math.round(renove/total*100)+"% ABC", source:"ADEME Observatoire DPE 2025", niveau:"commune" };
        } else {
          // Fallback : filtre par nom commune
          const urlDpe2 = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?size=1000&q="+encodeURIComponent(city)+"&q_fields=nom_commune_ban&select=etiquette_dpe";
          const rDpe2 = await fetch(urlDpe2);
          console.log("ADEME DPE (nom commune):", rDpe2.status);
          if (rDpe2.ok) {
            const d2 = await rDpe2.json();
            if (d2.results && d2.results.length > 0) {
              let total=d2.results.length, efg=0, renove=0;
              d2.results.forEach(function(r){
                if(["E","F","G"].includes(r.etiquette_dpe)) efg++;
                if(["A","B","C"].includes(r.etiquette_dpe)) renove++;
              });
              set("te1", efg/total*100, "ADEME DPE 2025 — commune", "commune");
              set("te2", renove/total*100, "ADEME DPE 2025 — commune", "commune");
              results["_meta_dpe"] = { valeur:total+" DPE analysés : "+Math.round(efg/total*100)+"% EFG", source:"ADEME Observatoire DPE 2025", niveau:"commune" };
            }
          }
        }
      }
    } catch(e) { console.log("ADEME error:", e.message); }

    // 4. RPLS via data.gouv.fr dataset connu
    try {
      const urlRpls = "https://tabular-api.data.gouv.fr/api/resources/62bde1db-44f1-4e96-bab5-0484e7efcf74/data/?code_commune="+citycode+"&page_size=1";
      const rRpls = await fetch(urlRpls);
      console.log("RPLS:", rRpls.status);
      if (rRpls.ok) {
        const d = await rRpls.json();
        if (d && d.meta && d.meta.total > 0) {
          results["_meta_rpls"] = { valeur:d.meta.total+" logements sociaux recensés", source:"RPLS 2023 — data.gouv.fr", niveau:"commune" };
        }
      }
    } catch(e) { console.log("RPLS error:", e.message); }

    // 5. BPE via data.gouv.fr
    try {
      const urlBpe = "https://tabular-api.data.gouv.fr/api/resources/7d4b2614-61ba-4e32-82e5-e5a8d4af6b5f/data/?depcom="+citycode+"&page_size=200";
      const rBpe = await fetch(urlBpe);
      console.log("BPE:", rBpe.status);
      if (rBpe.ok) {
        const d = await rBpe.json();
        if (d && d.data && d.data.length > 0) {
          let medecins=0, pharmacies=0, ehpad=0, services=0;
          d.data.forEach(function(r){
            const t = r.typequ||r.TYPEQU||"";
            if(t==="D201") medecins++;
            if(t==="D401") pharmacies++;
            if(["D109","D110"].includes(t)) ehpad++;
            if(t==="D107") services++;
          });
          const partenaires = (medecins>0?1:0)+(ehpad>0?2:0)+(services>0?2:0)+(pharmacies>0?1:0);
          if(partenaires>0) set("pt1", partenaires, "INSEE BPE 2023", "commune");
          results["_meta_bpe"] = { valeur:medecins+" médecins, "+pharmacies+" pharmacies, "+ehpad+" EHPAD", source:"INSEE BPE 2023", niveau:"commune" };
        }
      }
    } catch(e) { console.log("BPE error:", e.message); }

    // 6. Filosofi via API open.urec
    try {
      const urlFilo = "https://tabular-api.data.gouv.fr/api/resources/e6a9c76f-2038-45e5-8b37-84f40d1e2ce3/data/?codgeo="+citycode+"&page_size=1";
      const rFilo = await fetch(urlFilo);
      console.log("Filosofi:", rFilo.status);
      if (rFilo.ok) {
        const d = await rFilo.json();
        if (d && d.data && d.data.length > 0) {
          const row = d.data[0];
          const keys = Object.keys(row);
          // Taux pauvreté
          const tp60key = keys.find(function(k){return k.toLowerCase().includes("tp60");});
          const medkey = keys.find(function(k){return k.toLowerCase().includes("med");});
          if (tp60key) {
            const tp = parseFloat(row[tp60key]);
            if (!isNaN(tp) && tp>0) {
              set("v14", tp/100*0.35, "INSEE Filosofi 2020 — proxy taux effort", "commune");
              results["_meta_pauvrete"] = { valeur:"Taux pauvreté : "+tp+"%", source:"INSEE Filosofi 2020", niveau:"commune" };
            }
          }
          if (medkey) {
            const med = parseFloat(row[medkey]);
            if (!isNaN(med) && med>0) results["_meta_revenu"] = { valeur:Math.round(med)+" €/an (revenu médian)", source:"INSEE Filosofi 2020", niveau:"commune" };
          }
        }
      }
    } catch(e) { console.log("Filosofi error:", e.message); }

    console.log("Resultats:", Object.keys(results));
    return { statusCode:200, headers, body:JSON.stringify(results) };

  } catch(err) {
    console.log("Erreur globale:", err.message);
    return { statusCode:500, headers, body:JSON.stringify({ error:err.message }) };
  }
};