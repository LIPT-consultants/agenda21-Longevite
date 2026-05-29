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

    // 1. API Geo gouv.fr (fiable, sans auth)
    try {
      const rGeo = await fetch("https://geo.api.gouv.fr/communes/"+citycode+"?fields=nom,population,codeDepartement,codeRegion,epci,superficie");
      if (rGeo.ok) {
        const dGeo = await rGeo.json();
        if (dGeo.population) {
          results["_meta_population"] = { valeur: String(dGeo.population), source:"API Geo gouv.fr", niveau:"commune" };
        }
        if (dGeo.epci) {
          const epciNom = typeof dGeo.epci === "object" ? (dGeo.epci.nom || dGeo.epci.code || "EPCI") : String(dGeo.epci);
          results["_meta_epci"] = { valeur: epciNom, source:"API Geo gouv.fr", niveau:"epci" };
        }
        if (dGeo.codeDepartement) {
          results["_meta_departement"] = { valeur:"Département "+dGeo.codeDepartement, source:"API Geo gouv.fr", niveau:"departement" };
        }
        // Densité seniors approx depuis population (benchmark national 8.5% de 75+)
        if (dGeo.population) {
          results["_meta_pop_seniors_estime"] = { valeur:"Population totale "+dGeo.population+" hab. (seniors 75+ estimés : "+Math.round(dGeo.population*0.085)+")", source:"API Geo + benchmark national INSEE 2023", niveau:"commune" };
        }
      }
    } catch(e) { console.log("Geo error:", e.message); }

    // 2. Georisques (fiable, sans auth)
    try {
      if (lat && lon) {
        const rGR = await fetch("https://georisques.gouv.fr/api/v1/gaspar/risques?rayon=1000&latlon="+lon+","+lat+"&page=1&page_size=20");
        console.log("Georisques status:", rGR.status);
        if (rGR.ok) {
          const dGR = await rGR.json();
          if (dGR && dGR.data && dGR.data.length > 0) {
            const risques = dGR.data.map(function(r){return r.libelle_risque_jo||r.code_risque;}).filter(Boolean);
            results["_meta_georisques"] = { valeur:"Risques identifiés : "+risques.slice(0,5).join(", "), source:"Georisques 2026", niveau:"adresse" };
            const hasInondation = risques.some(function(r){return r.toLowerCase().includes("inond");});
            const hasChaleur = risques.some(function(r){return r.toLowerCase().includes("chaleur")||r.toLowerCase().includes("canicule");});
            if (hasInondation) set("te5", 45, "Georisques 2026 — zone inondable", "adresse");
            if (hasChaleur) set("te5", 60, "Georisques 2026 — risque chaleur", "adresse");
          } else {
            results["_meta_georisques"] = { valeur:"Aucun risque majeur identifié dans un rayon de 1km", source:"Georisques 2026", niveau:"adresse" };
          }
        }
      }
    } catch(e) { console.log("Georisques error:", e.message); }

    // 3. API Decoupage administratif — departement
    try {
      const rDept = await fetch("https://geo.api.gouv.fr/communes/"+citycode+"/departement");
      if (rDept.ok) {
        const dDept = await rDept.json();
        if (dDept && dDept.nom) {
          results["_meta_dept_nom"] = { valeur:dDept.nom+" ("+dDept.code+")", source:"API Geo gouv.fr", niveau:"departement" };
        }
      }
    } catch(e) {}

    // 4. ADEME DPE — endpoint stable
    try {
      const urlDpe = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?size=1000&q="+encodeURIComponent(city)+"&select=etiquette_dpe&q_fields=nom_commune_ban";
      const rDpe = await fetch(urlDpe);
      console.log("ADEME DPE status:", rDpe.status, urlDpe);
      if (rDpe.ok) {
        const dDpe = await rDpe.json();
        if (dDpe.results && dDpe.results.length > 0) {
          let total = dDpe.results.length, efg = 0, renove = 0;
          dDpe.results.forEach(function(r) {
            if (["E","F","G"].includes(r.etiquette_dpe)) efg++;
            if (["A","B","C"].includes(r.etiquette_dpe)) renove++;
          });
          set("te1", efg/total*100, "ADEME DPE 2025 — commune", "commune");
          set("te2", renove/total*100, "ADEME DPE 2025 — commune", "commune");
          results["_meta_dpe"] = { valeur:total+" DPE : "+Math.round(efg/total*100)+"% énergivores (EFG), "+Math.round(renove/total*100)+"% performants (ABC)", source:"ADEME Observatoire DPE 2025", niveau:"commune" };
        }
      } else {
        // Essai avec l'autre dataset DPE
        const urlDpe2 = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-neufs/lines?size=500&q="+encodeURIComponent(city)+"&select=etiquette_dpe&q_fields=nom_commune_ban";
        const rDpe2 = await fetch(urlDpe2);
        console.log("ADEME DPE2 status:", rDpe2.status);
        if (rDpe2.ok) {
          const dDpe2 = await rDpe2.json();
          if (dDpe2.results && dDpe2.results.length > 0) {
            let total=dDpe2.results.length, efg=0, renove=0;
            dDpe2.results.forEach(function(r){
              if(["E","F","G"].includes(r.etiquette_dpe)) efg++;
              if(["A","B","C"].includes(r.etiquette_dpe)) renove++;
            });
            set("te1", efg/total*100, "ADEME DPE logements neufs 2025", "commune");
            set("te2", renove/total*100, "ADEME DPE logements neufs 2025", "commune");
          }
        }
      }
    } catch(e) { console.log("ADEME error:", e.message); }

    // 5. RPLS via data.gouv.fr API tabular
    try {
      const urlRpls = "https://tabular-api.data.gouv.fr/api/resources/dc80e171-5a8b-4bca-9a5e-a77be600545e/data/?code_commune="+citycode+"&page_size=1";
      const rRpls = await fetch(urlRpls);
      console.log("RPLS tabular status:", rRpls.status);
      if (rRpls.ok) {
        const dRpls = await rRpls.json();
        if (dRpls && dRpls.meta && dRpls.meta.total > 0) {
          results["_meta_rpls"] = { valeur:dRpls.meta.total+" logements sociaux recensés", source:"RPLS 2023 — data.gouv.fr", niveau:"commune" };
        }
      }
    } catch(e) { console.log("RPLS error:", e.message); }

    // 6. BPE via data.gouv.fr
    try {
      const urlBpe = "https://tabular-api.data.gouv.fr/api/resources/c78a5025-e9d1-4e97-820d-a3e3deef5016/data/?depcom="+citycode+"&page_size=100";
      const rBpe = await fetch(urlBpe);
      console.log("BPE tabular status:", rBpe.status);
      if (rBpe.ok) {
        const dBpe = await rBpe.json();
        if (dBpe && dBpe.data && dBpe.data.length > 0) {
          let medecins=0, pharmacies=0, ehpad=0, services=0;
          dBpe.data.forEach(function(r) {
            const typequ = r.typequ || r.TYPEQU || "";
            if (typequ==="D201") medecins++;
            if (typequ==="D401") pharmacies++;
            if (["D109","D110"].includes(typequ)) ehpad++;
            if (typequ==="D107") services++;
          });
          const partenaires = (medecins>0?1:0)+(ehpad>0?2:0)+(services>0?2:0)+(pharmacies>0?1:0);
          if (partenaires > 0) set("pt1", partenaires, "INSEE BPE 2023 — data.gouv.fr", "commune");
          results["_meta_bpe"] = { valeur:medecins+" médecins, "+pharmacies+" pharmacies, "+ehpad+" EHPAD/résidences autonomie", source:"INSEE BPE 2023", niveau:"commune" };
        }
      }
    } catch(e) { console.log("BPE error:", e.message); }

    // 7. Filosofi via data.gouv.fr
    try {
      const urlFilo = "https://tabular-api.data.gouv.fr/api/resources/b78253ce-4f39-4a23-bcfd-a5b5e48dd5e3/data/?codgeo="+citycode+"&page_size=1";
      const rFilo = await fetch(urlFilo);
      console.log("Filosofi tabular status:", rFilo.status);
      if (rFilo.ok) {
        const dFilo = await rFilo.json();
        if (dFilo && dFilo.data && dFilo.data.length > 0) {
          const row = dFilo.data[0];
          const tp60 = parseFloat(row.tp60 || row.TP60 || 0);
          const med = parseFloat(row.med21 || row.MED21 || 0);
          if (!isNaN(tp60) && tp60 > 0) {
            set("v14", tp60/100*0.35, "INSEE Filosofi 2020 — taux pauvreté commune (proxy)", "commune");
            results["_meta_pauvrete"] = { valeur:"Taux de pauvreté : "+tp60+"%", source:"INSEE Filosofi 2020", niveau:"commune" };
          }
          if (!isNaN(med) && med > 0) {
            results["_meta_revenu"] = { valeur:Math.round(med)+" €/an (revenu médian)", source:"INSEE Filosofi 2020", niveau:"commune" };
          }
        }
      }
    } catch(e) { console.log("Filosofi error:", e.message); }

    console.log("Resultats finaux:", Object.keys(results));
    return { statusCode:200, headers, body:JSON.stringify(results) };

  } catch(err) {
    console.log("Erreur globale:", err.message);
    return { statusCode:500, headers, body:JSON.stringify({ error:"Erreur serveur : "+err.message }) };
  }
};