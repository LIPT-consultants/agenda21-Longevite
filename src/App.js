import { useState, useEffect, useCallback, useRef } from "react";

const C = {
  coral:"#D85A30", coralLight:"#FAECE7", coralDark:"#993C1D",
  purple:"#534AB7", purpleLight:"#EEEDFE", purpleDark:"#3C3489",
  teal:"#1D9E75", tealLight:"#E1F5EE", tealDark:"#0F6E56",
  amber:"#BA7517", amberLight:"#FAEEDA",
  gray:"#888780", red:"#E24B4A", blue:"#378ADD",
};

// ── Benchmarks nationaux (sourcés) ───────────────────────
const BENCHMARKS = {
  v2: { label:"Part 75+ parc social", national:8.5, alerte:12, favorable:6, unite:"%", source:"RPLS 2023 / USH HLM en chiffres 2025" },
  v3: { label:"Part 85+", national:2.1, alerte:4, favorable:1.5, unite:"%", source:"INSEE / DREES 2023" },
  v8: { label:"Seniors vivant seuls", national:42, alerte:55, favorable:35, unite:"%", source:"INSEE Recensement 2020" },
  v14:{ label:"Taux d'effort seniors", national:0.28, alerte:0.35, favorable:0.22, unite:"ratio", source:"Filosofi 2021" },
  v15:{ label:"Impayés seniors", national:0.03, alerte:0.06, favorable:0.01, unite:"ratio", source:"ANCOLS Panorama 2025" },
  a3: { label:"Seniors étage sans ascenseur", national:18, alerte:25, favorable:10, unite:"%", source:"RPLS 2023 / ANCOLS" },
  a6: { label:"Part logements adaptés", national:4.2, alerte:2, favorable:8, unite:"%", source:"ANCOLS Étude adaptation 2024", inversed:true },
  a11:{ label:"Baignoire 75+", national:38, alerte:50, favorable:25, unite:"%", source:"ANCOLS Étude adaptation 2024" },
  a14:{ label:"Taux pannes ascenseur", national:0.08, alerte:0.15, favorable:0.04, unite:"ratio", source:"USH / CEREMA 2023" },
  ad6:{ label:"Coût moyen adaptation", national:4800, alerte:8000, favorable:2500, unite:"€", source:"Anah / MaPrimeAdapt' 2024" },
  ad4:{ label:"Délai total adaptation", national:95, alerte:150, favorable:60, unite:"jours", source:"Anah bilan 2024" },
  te1:{ label:"Seniors DPE E/F/G", national:28, alerte:40, favorable:15, unite:"%", source:"ADEME Observatoire DPE 2025 / SDES" },
  te3:{ label:"Charges moyennes seniors", national:1450, alerte:2000, favorable:1000, unite:"€/an", source:"ONPE Tableau de bord 2025" },
  te4:{ label:"Impayés charges seniors", national:3.2, alerte:7, favorable:1.5, unite:"%", source:"ONPE / Filosofi 2023" },
  nd1:{ label:"Espace locataire activé", national:34, alerte:20, favorable:55, unite:"%", source:"Baromètre numérique ARCEP 2026", inversed:true },
  nd2:{ label:"Démarches hors numérique", national:52, alerte:70, favorable:35, unite:"%", source:"Baromètre numérique CRÉDOC 2025" },
  pt1:{ label:"Partenaires actifs", national:4.5, alerte:2, favorable:8, unite:"Nb", source:"CNSA Data Autonomie 2024", inversed:true },
  pt3:{ label:"Conventions actives", national:2.8, alerte:1, favorable:5, unite:"Nb", source:"CNSA / USH 2024", inversed:true },
  fi1:{ label:"Budget adaptation annuel", national:185000, alerte:50000, favorable:300000, unite:"€", source:"Anah / ANCOLS 2024", inversed:true },
  fi8:{ label:"Taux exécution budgétaire", national:74, alerte:50, favorable:85, unite:"%", source:"ANCOLS Panorama 2025", inversed:true },
  rh1:{ label:"Taux formation gardiens", national:38, alerte:20, favorable:65, unite:"%", source:"USH / ANCOLS RH 2024", inversed:true },
  rh4:{ label:"Référents seniors", national:1.8, alerte:1, favorable:3, unite:"Nb", source:"USH enquête gouvernance 2024", inversed:true },
};

// Position benchmark : -1 alerte, 0 moyen, 1 favorable
function benchmarkPosition(kpiId, value) {
  const b = BENCHMARKS[kpiId];
  if (!b || value === null || value === undefined || value === "") return null;
  const v = parseFloat(value);
  if (isNaN(v)) return null;
  if (b.inversed) {
    if (v >= b.favorable) return 1;
    if (v <= b.alerte) return -1;
    return 0;
  }
  if (v >= b.alerte) return -1;
  if (v <= b.favorable) return 1;
  return 0;
}

function BenchmarkBadge({ kpiId, value }) {
  const b = BENCHMARKS[kpiId];
  if (!b) return null;
  const pos = benchmarkPosition(kpiId, value);
  if (pos === null) return null;
  const cfg = pos === 1
    ? { label:"↑ Au-dessus", bg:"#EAF3DE", color:"#3B6D11" }
    : pos === -1
    ? { label:"↓ Sous la moy.", bg:"#FCEBEB", color:"#A32D2D" }
    : { label:"→ Dans la moy.", bg:"#FAEEDA", color:"#854F0B" };
  return (
    <span style={{ fontSize:9, padding:"1px 5px", borderRadius:3, background:cfg.bg, color:cfg.color, fontWeight:500, whiteSpace:"nowrap" }}>
      {cfg.label} (nat: {b.national}{b.unite})
    </span>
  );
}

// ── Base KPIs ─────────────────────────────────────────────
const BANQUE_KPIS = [
  { theme:"Vieillissement des locataires", kpis:[
    {id:"v1",nom:"Part des titulaires 60 ans et +",formule:"60+/total titulaires×100",unite:"%",lecture:"Mesure de l'exposition générale"},
    {id:"v2",nom:"Part des titulaires 75+",formule:"75+/total×100",unite:"%",lecture:"Exposition renforcée"},
    {id:"v3",nom:"Part des titulaires 85+",formule:"85+/total×100",unite:"%",lecture:"Risque élevé dépendance"},
    {id:"v5",nom:"Taux progression seniors 1 an",formule:"N/N-1×100",unite:"%",lecture:"Trajectoire démographique"},
    {id:"v6",nom:"Taux progression seniors 5 ans",formule:"N/N-5×100",unite:"%",lecture:"Tendance longue"},
    {id:"v7",nom:"Âge médian des locataires",formule:"Âge médian des titulaires",unite:"Nb",lecture:"Hiérarchisation des sites prioritaires"},
    {id:"v8",nom:"Part seniors vivant seuls",formule:"Seuls/seniors×100",unite:"%",lecture:"Isolement potentiel"},
    {id:"v9",nom:"Part des femmes seules âgées",formule:"Femmes seules 75+/total seniors×100",unite:"%",lecture:"Fragilité sociale accrue"},
    {id:"v10",nom:"Ancienneté moyenne occupation",formule:"Moy. années depuis entrée",unite:"Nb",lecture:"Risque d'inadaptation progressive"},
    {id:"v11",nom:"Part des seniors entrés avant 2010",formule:"Anciens entrants/total seniors×100",unite:"%",lecture:"Situations potentiellement peu réinterrogées"},
    {id:"v12",nom:"Part des seniors entrés avant 2000",formule:"Anciens entrants/total seniors×100",unite:"%",lecture:"Situations potentiellement peu réinterrogées"},
    {id:"v13",nom:"Part des seniors bénéficiant d'aides au logement",formule:"APL ou AL/seniors×100",unite:"%",lecture:"Fragilité économique"},
    {id:"v13b",nom:"Part des seniors bénéficiant du RSA",formule:"Seniors RSA/total seniors×100",unite:"%",lecture:"Fragilité économique"},
    {id:"v13c",nom:"Part des seniors bénéficiaires de l'APA",formule:"Seniors APA/total seniors×100",unite:"%",lecture:"Fragilités — perte d'autonomie avérée"},
    {id:"v14",nom:"Taux d'effort ménages seniors",formule:"(loyer+charges-aides)/ressources",unite:"Ratio",lecture:"Précarisation"},
    {id:"v15",nom:"Impayés seniors",formule:"Encours/loyers seniors",unite:"Ratio",lecture:"Risque économique"},
    {id:"v16",nom:"Seniors avec alertes répétées",formule:"Signalements consolidés",unite:"Nb",lecture:"Fragilités qualitatives"},
  ]},
  { theme:"Accessibilité du bâti", kpis:[
    {id:"a1",nom:"Part logements en RDC",formule:"RDC/parc×100",unite:"%",lecture:"Potentiel attribution senior"},
    {id:"a2",nom:"Part logements avec ascenseur",formule:"Desservis/collectif×100",unite:"%",lecture:"Accessibilité verticale"},
    {id:"a3",nom:"Seniors en étage sans ascenseur",formule:"Concernés/seniors×100",unite:"%",lecture:"Risque prioritaire"},
    {id:"a5",nom:"Part logements accessibles PMR",formule:"Accessibles/parc×100",unite:"%",lecture:"Stock mobilisable"},
    {id:"a6",nom:"Part logements adaptés",formule:"Adaptés/parc×100",unite:"%",lecture:"Stock qualifié"},
    {id:"a9",nom:"Seniors fragiles en logement non adapté",formule:"Concernés/seniors fragiles×100",unite:"%",lecture:"Risque social majeur"},
    {id:"a11",nom:"Baignoire occupée par 75+",formule:"75+ baignoire/75+×100",unite:"%",lecture:"Priorité adaptation"},
    {id:"a14",nom:"Taux pannes ascenseur",formule:"Pannes/ascenseurs",unite:"Ratio",lecture:"Risque maintien domicile"},
    {id:"a15",nom:"Durée moyenne d'indisponibilité ascenseur",formule:"Jours d'arrêt/nb ascenseurs",unite:"Nb",lecture:"Qualité de service senior"},
    {id:"a7",nom:"Taux de fiabilité de la donnée adaptation",formule:"Logements adaptés avec preuve/logements déclarés adaptés",unite:"Ratio",lecture:"Qualité de la donnée"},
    {id:"a8",nom:"Part logements adaptés occupés sans besoin identifié",formule:"Logements adaptés non fléchés/logements adaptés×100",unite:"%",lecture:"Risque de mauvaise allocation"},
    {id:"a16",nom:"Ancienneté moyenne des bâtiments",formule:"Année de construction moyenne",unite:"Année",lecture:"Vétusté du bâti"},
  ]},
  { theme:"Adaptation des logements", kpis:[
    {id:"ad1",nom:"Demandes adaptation reçues",formule:"Volume annuel",unite:"Nb",lecture:"Pression demande"},
    {id:"ad2",nom:"Taux de demandes instruites",formule:"Demandes instruites/demandes reçues",unite:"Ratio",lecture:"Capacité de traitement"},
    {id:"ad3",nom:"Délai moyen de premier contact",formule:"Date demande → premier contact",unite:"Jours",lecture:"Réactivité"},
    {id:"ad3b",nom:"Délai moyen de diagnostic",formule:"Date demande → diagnostic technique/social",unite:"Jours",lecture:"Capacité d'objectivation"},
    {id:"ad3c",nom:"Délai moyen de décision",formule:"Diagnostic → arbitrage",unite:"Jours",lecture:"Fluidité décisionnelle"},
    {id:"ad3d",nom:"Délai moyen de travaux",formule:"Validation → fin travaux",unite:"Jours",lecture:"Exécution"},
    {id:"ad4",nom:"Délai total d'adaptation",formule:"Demande → travaux terminés",unite:"Jours",lecture:"KPI usager clé"},
    {id:"ad5",nom:"Taux demandes refusées",formule:"Refus/instruites",unite:"Ratio",lecture:"Renoncements"},
    {id:"ad5b",nom:"Motifs de refus — défaut de financement",formule:"Refus financement/total refus×100",unite:"%",lecture:"Amélioration doctrine"},
    {id:"ad5c",nom:"Motifs de refus — impossibilité technique",formule:"Refus technique/total refus×100",unite:"%",lecture:"Amélioration doctrine"},
    {id:"ad5d",nom:"Motifs de refus — autre",formule:"Refus autre/total refus×100",unite:"%",lecture:"Amélioration doctrine"},
    {id:"ad5e",nom:"Taux de travaux réalisés dans les délais cible",formule:"Travaux dans délai/travaux totaux",unite:"Ratio",lecture:"Pilotage"},
    {id:"ad6",nom:"Coût moyen par adaptation",formule:"Coût total/nb adaptations",unite:"€",lecture:"Arbitrage budgétaire"},
    {id:"ad7",nom:"Part adaptations légères",formule:"Barres, douche, seuils…",unite:"%",lecture:"Quick wins"},
    {id:"ad8",nom:"Part adaptations lourdes",formule:"Restructuration SDB, élargissements, domotique…",unite:"%",lecture:"Programmation investissement"},
    {id:"ad9",nom:"Montant de financements externes mobilisés",formule:"Aides obtenues/coût total",unite:"€",lecture:"Effet levier"},
    {id:"ad10",nom:"Reste à charge bailleur",formule:"Coût total – aides",unite:"€",lecture:"Soutenabilité"},
    {id:"ad11",nom:"Taux satisfaction après travaux",formule:"Enquête post-travaux",unite:"%",lecture:"Impact locataire"},
    {id:"ad12",nom:"Taux de chutes signalés avant adaptation",formule:"Signalements avant adaptation",unite:"%",lecture:"Impact prévention"},
    {id:"ad13",nom:"Taux de chutes signalés après adaptation",formule:"Signalements après (logements adaptés)",unite:"%",lecture:"Impact adaptation"},
  ]},
  { theme:"Parcours résidentiel", kpis:[
    {id:"pr1",nom:"Nombre de demandes de mutation senior",formule:"Volume annuel",unite:"Nb",lecture:"Pression parcours résidentiel"},
    {id:"pr2",nom:"Part demandes motivées santé/autonomie",formule:"Demandes santé/autonomie/demandes seniors×100",unite:"%",lecture:"Besoin réel d'adaptation"},
    {id:"pr3",nom:"Délai moyen de mutation senior",formule:"Demande → relogement",unite:"Jours",lecture:"Performance parcours"},
    {id:"pr4",nom:"Taux mutations réalisées",formule:"Réalisées/recevables×100",unite:"%",lecture:"Capacité réponse"},
    {id:"pr5",nom:"Taux de refus de propositions par le senior",formule:"Refus/propositions×100",unite:"%",lecture:"Acceptabilité de l'offre"},
    {id:"pr5b",nom:"Motifs de refus — localisation",formule:"Refus localisation/total refus×100",unite:"%",lecture:"Ajustement doctrine"},
    {id:"pr5c",nom:"Motifs de refus — surface",formule:"Refus surface/total refus×100",unite:"%",lecture:"Ajustement doctrine"},
    {id:"pr5d",nom:"Motifs de refus — services",formule:"Refus services/total refus×100",unite:"%",lecture:"Ajustement doctrine"},
    {id:"pr5e",nom:"Autres motifs de refus",formule:"Autres refus/total refus×100",unite:"%",lecture:"Ajustement doctrine"},
    {id:"pr6",nom:"Seniors en sous-occupation",formule:"T4/T5 seuls/seniors×100",unite:"%",lecture:"Opportunité et sensibilité politique"},
    {id:"pr6b",nom:"Grands logements libérés par mutation senior",formule:"Volume annuel",unite:"Nb",lecture:"Impact sur fluidité du parc"},
    {id:"pr7",nom:"Logements adaptés bien alloués",formule:"Conformes/attribués×100",unite:"%",lecture:"Bonne allocation de la ressource"},
    {id:"pr8",nom:"Taux de vacance des logements adaptés",formule:"Vacants/logements adaptés",unite:"Ratio",lecture:"Gestion de stock"},
    {id:"pr8b",nom:"Délai de relocation d'un logement adapté",formule:"Vacance moyenne",unite:"Jours",lecture:"Fluidité"},
    {id:"pr9",nom:"Situations double peine",formule:"Senior inadapté+logement utile pour autre ménage",unite:"Nb",lecture:"Arbitrage stratégique"},
    {id:"pr10",nom:"Part des attributions 60+ dans offre adaptée",formule:"Attributions seniors/logements adaptés attribués×100",unite:"%",lecture:"Ciblage"},
  ]},
  { theme:"Repérage des fragilités", kpis:[
    {id:"rf1",nom:"Signalements de fragilité",formule:"Signalements internes/externes",unite:"Nb",lecture:"Détection"},
    {id:"rf1b",nom:"Origine signalements — interne (gardien, chargé clientèle)",formule:"Signalements internes/total×100",unite:"%",lecture:"Qualité du réseau d'alerte interne"},
    {id:"rf1c",nom:"Origine signalements — externe (voisin, famille, CCAS…)",formule:"Signalements externes/total×100",unite:"%",lecture:"Qualité du réseau d'alerte externe"},
    {id:"rf2",nom:"Taux signalements seniors",formule:"Signalements/seniors",unite:"Ratio",lecture:"Intensité besoin"},
    {id:"rf3",nom:"Délai de traitement d'un signalement",formule:"Signalement → première action",unite:"Jours",lecture:"Réactivité"},
    {id:"rf4",nom:"Taux situations contactées",formule:"Contactées/signalements×100",unite:"%",lecture:"Effectivité aller-vers"},
    {id:"rf4b",nom:"Taux de refus de contact",formule:"Refus/situations contactées×100",unite:"%",lecture:"Acceptabilité"},
    {id:"rf5",nom:"Taux visites à domicile",formule:"VAD/situations ciblées×100",unite:"%",lecture:"Proximité"},
    {id:"rf6",nom:"Orientations vers partenaire",formule:"Orientations/situations",unite:"Nb",lecture:"Articulation territoriale"},
    {id:"rf6b",nom:"Nombre de plans d'action individuels ouverts",formule:"Plans ouverts",unite:"Nb",lecture:"Intensité accompagnement"},
    {id:"rf7",nom:"Taux situations stabilisées",formule:"Clôturées pos./suivies×100",unite:"%",lecture:"Impact"},
    {id:"rf7b",nom:"Taux de décès isolés ou découverts tardivement",formule:"Cas recensés/seniors seuls×100",unite:"%",lecture:"Indicateur sensible — prévention isolement"},
    {id:"rf8",nom:"Actions collectives seniors",formule:"Ateliers, réunions…",unite:"Nb",lecture:"Prévention"},
    {id:"rf8b",nom:"Taux de participation aux actions collectives",formule:"Participants/seniors invités×100",unite:"%",lecture:"Mobilisation"},
    {id:"rf9",nom:"Taux de réorientation vers accès aux droits",formule:"Orientations droits/situations suivies×100",unite:"%",lecture:"Prévention sociale"},
  ]},
  { theme:"Qualité de service", kpis:[
    {id:"qs2",nom:"Taux réclamations seniors",formule:"Réclamations/ménages×100",unite:"%",lecture:"Comparaison parc"},
    {id:"qs3",nom:"Réclamations ascenseur",formule:"Volume sites seniors",unite:"Nb",lecture:"Risque autonomie"},
    {id:"qs4",nom:"Réclamations chauffage/humidité",formule:"Volume concerné",unite:"Nb",lecture:"Santé/confort"},
    {id:"qs6",nom:"Satisfaction après intervention",formule:"Enquête courte",unite:"%",lecture:"Résultat perçu"},
    {id:"qs7",nom:"Seniors utilisant canaux numériques",formule:"Actifs portail/seniors×100",unite:"%",lecture:"Fracture numérique"},
  ]},
  { theme:"Partenariats territoriaux", kpis:[
    {id:"pt1",nom:"Partenaires actifs",formule:"Action concrète/année",unite:"Nb",lecture:"Densité écosystème"},
    {id:"pt2",nom:"Résidences couvertes par partenaire",formule:"Couvertes/prioritaires×100",unite:"%",lecture:"Maillage territorial"},
    {id:"pt3",nom:"Conventions actives",formule:"Signées et suivies",unite:"Nb",lecture:"Formalisation"},
    {id:"pt6",nom:"Situations sans solution partenaire",formule:"Sans relais/orientations×100",unite:"%",lecture:"Angle mort"},
    {id:"pt9",nom:"Satisfaction partenaires",formule:"Enquête annuelle",unite:"%",lecture:"Qualité relationnelle"},
  ]},
  { theme:"Transition écologique", kpis:[
    {id:"te1",nom:"Seniors en logements DPE E/F/G",formule:"EFG/seniors×100",unite:"%",lecture:"Précarité énergétique"},
    {id:"te2",nom:"Seniors en logements rénovés",formule:"Rénovés/seniors×100",unite:"%",lecture:"Opportunité"},
    {id:"te3",nom:"Charges moyennes ménages seniors",formule:"Charges/ménage senior",unite:"€",lecture:"Soutenabilité"},
    {id:"te4",nom:"Impayés de charges seniors",formule:"Impayés/charges×100",unite:"%",lecture:"Risque économique"},
    {id:"te4b",nom:"Réclamations chauffage seniors",formule:"Volume annuel",unite:"Nb",lecture:"Confort / santé"},
    {id:"te4c",nom:"Réclamations humidité/moisissures seniors",formule:"Volume annuel",unite:"Nb",lecture:"Risque sanitaire"},
    {id:"te5",nom:"Seniors exposés confort d'été dégradé",formule:"Concernés/total×100",unite:"%",lecture:"Risque climatique"},
    {id:"te6",nom:"Logements seniors en zone îlot de chaleur",formule:"Croisement SIG",unite:"Nb",lecture:"Cartographie vulnérabilité"},
    {id:"te7",nom:"Opérations rénovation+adaptation",formule:"Double objectif/opérations×100",unite:"%",lecture:"Synergie climat-longévité"},
    {id:"te8",nom:"Gains énergétiques après travaux",formule:"kWh/m² avant-après",unite:"kWh",lecture:"Impact écologique"},
    {id:"te9",nom:"Baisse estimée des charges après rénovation",formule:"Charges avant-après",unite:"€",lecture:"Impact locataire"},
    {id:"te10",nom:"Actions de sensibilisation énergie seniors",formule:"Ateliers / supports",unite:"Nb",lecture:"Prévention"},
    {id:"te11",nom:"Taux de participation seniors aux actions énergie",formule:"Participants/invités×100",unite:"%",lecture:"Appropriation"},
  ]},
  { theme:"Numérique et accès aux droits", kpis:[
    {id:"nd1",nom:"Seniors avec espace locataire activé",formule:"Actifs/seniors×100",unite:"%",lecture:"Autonomie numérique"},
    {id:"nd2",nom:"Démarches seniors hors numérique",formule:"Hors num./démarches×100",unite:"%",lecture:"Canaux alternatifs"},
    {id:"nd3",nom:"Taux d'abandon démarche numérique",formule:"Non finalisées/initiées×100",unite:"%",lecture:"Fracture numérique"},
    {id:"nd4",nom:"Demandes aide administrative",formule:"Volume annuel",unite:"Nb",lecture:"Accès aux droits"},
    {id:"nd5",nom:"Seniors informés des aides adaptation",formule:"Informés/ciblés×100",unite:"%",lecture:"Prévention"},
    {id:"nd7",nom:"Ruptures de droits détectées",formule:"Situations détectées",unite:"Nb",lecture:"Prévention sociale"},
  ]},
  { theme:"Finances et soutenabilité", kpis:[
    {id:"fi1",nom:"Budget adaptation annuel",formule:"€/an",unite:"€",lecture:"Effort réel"},
    {id:"fi2",nom:"Budget moyen adaptation par logement senior",formule:"€ adaptation/nombre seniors",unite:"€",lecture:"Intensité"},
    {id:"fi3",nom:"Part financée bailleur",formule:"Autofinancement/coût×100",unite:"%",lecture:"Soutenabilité"},
    {id:"fi4",nom:"Part financée aides externes",formule:"Subventions/coût×100",unite:"%",lecture:"Effet levier"},
    {id:"fi5",nom:"Mobilisation des aides disponibles",formule:"Obtenues/éligibles×100",unite:"%",lecture:"Optimisation"},
    {id:"fi6",nom:"Travaux différés faute de budget",formule:"Volume différé",unite:"Nb",lecture:"Risque accumulé"},
    {id:"fi7",nom:"Stock besoins non financés",formule:"Somme travaux identifiés non budgétés",unite:"€",lecture:"Risque financier"},
    {id:"fi7b",nom:"Coût évité — mutation vs adaptation lourde",formule:"Coût adaptation lourde – coût mutation",unite:"€",lecture:"Arbitrage stratégique"},
    {id:"fi7c",nom:"Coût évité — adaptation préventive",formule:"Hypothèse à documenter",unite:"€",lecture:"Argumentaire stratégique"},
    {id:"fi8",nom:"Taux exécution budgétaire",formule:"Dépenses/budget×100",unite:"%",lecture:"Pilotage"},
    {id:"fi9",nom:"Coût de vacance des logements adaptés",formule:"Loyers perdus / an",unite:"€",lecture:"Efficience"},
    {id:"fi10",nom:"Coût des remises en état seniors complexes",formule:"Coûts remise en état/sorties seniors",unite:"€",lecture:"Anticipation patrimoniale"},
  ]},
  { theme:"RH et organisation interne", kpis:[
    {id:"rh1",nom:"Taux formation gardiens/proximité",formule:"Formés/total×100",unite:"%",lecture:"Repérage terrain"},
    {id:"rh2",nom:"Taux formation chargés clientèle",formule:"Chargés formés/total chargés×100",unite:"%",lecture:"Relation locataire"},
    {id:"rh3",nom:"Taux formation agents patrimoine/travaux",formule:"Agents techniques formés/total×100",unite:"%",lecture:"Qualité adaptation"},
    {id:"rh4",nom:"Référents seniors identifiés",formule:"Référents/directions",unite:"Nb",lecture:"Gouvernance"},
    {id:"rh5",nom:"Temps RH dédié stratégie seniors",formule:"ETP ou jours/an",unite:"ETP",lecture:"Capacité réelle"},
    {id:"rh6",nom:"Décisions arbitrées dans les délais",formule:"Dans délai/attendues×100",unite:"%",lecture:"Gouvernance"},
    {id:"rh7",nom:"Taux actions en retard",formule:"Retardées/prévues×100",unite:"%",lecture:"Pilotage"},
    {id:"rh7b",nom:"Nombre de réunions internes dédiées",formule:"Réunions / an",unite:"Nb",lecture:"Rituels de pilotage"},
    {id:"rh7c",nom:"Nombre d'escalades traitées",formule:"Situations remontées/résolues",unite:"Nb",lecture:"Process décisionnel"},
    {id:"rh8",nom:"Taux de complétude des données seniors",formule:"Ménages données complètes/total seniors×100",unite:"%",lecture:"Maturité data"},
    {id:"rh9",nom:"Taux de mise à jour annuelle des données",formule:"Données actualisées/total seniors×100",unite:"%",lecture:"Fiabilité"},
    {id:"rh10",nom:"Directions impliquées",formule:"Actives/concernées",unite:"Nb",lecture:"Transversalité"},
  ]},
];

const THEME_COLORS = {
  "Vieillissement des locataires":C.coral,"Accessibilité du bâti":C.amber,
  "Adaptation des logements":C.red,"Parcours résidentiel":C.purple,
  "Repérage des fragilités":C.coral,"Qualité de service":C.blue,
  "Partenariats et ancrages territoriaux":C.teal,"Transition écologique":C.teal,
  "Numérique et accès aux droits":C.purple,"Finances et soutenabilité":C.amber,
  "RH et organisation interne":C.gray,
};

const statutCfg = {
  "realise":  {label:"✓ Réalisé",  bg:"#EAF3DE",color:"#3B6D11"},
  "en-cours": {label:"⟳ En cours",bg:"#E6F1FB",color:"#185FA5"},
  "a-lancer": {label:"⚑ À lancer",bg:"#FAEEDA",color:"#854F0B"},
  "differe":  {label:"○ Différé", bg:"#F1EFE8",color:"#5F5E5A"},
};

// ── Storage ───────────────────────────────────────────────
async function loadData(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch(e) { return null; }
}
async function saveData(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch(e) {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// ══════════════════════════════════════════════════════════
// MOTEUR D'ENRICHISSEMENT TERRITORIAL
// ══════════════════════════════════════════════════════════

// Résultats enrichissement : { kpiId: { valeur, source, niveau } }
async function enrichirDepuisAPIs(adresse) {
  if (!adresse || !adresse.citycode) return {};
  const results = {};
  const codeInsee = adresse.citycode;
  const lat = adresse.lat;
  const lon = adresse.lon;

  function set(id, val, source, niveau) {
    if (val !== null && val !== undefined && !isNaN(parseFloat(val))) {
      results[id] = { valeur: String(Math.round(parseFloat(val) * 10) / 10), source, niveau };
    }
  }

  // ── 1. INSEE Recensement (commune) ──────────────────────
  try {
    const urlPop = `https://api.insee.fr/donnees-locales/V0.1/donnees/geo-SEXE-AGE15_15_90@GEO2023RP2020/COM-${codeInsee}.all.all`;
    const rPop = await fetch(urlPop, { headers: { Accept: "application/json" } });
    if (rPop.ok) {
      const dPop = await rPop.json();
      // Extraction part 60+, 75+, 85+, personnes seules
      if (dPop && dPop.Cellule) {
        let total = 0, s60 = 0, s75 = 0, s85 = 0;
        dPop.Cellule.forEach(function(c) {
          const age = c.Modalite?.find(function(m) { return m["@variable"] === "AGE15_15_90"; });
          const v = parseFloat(c.Valeur || 0);
          if (age) {
            total += v;
            if (["60-74", "75-89", "90+"].includes(age["@code"])) s60 += v;
            if (["75-89", "90+"].includes(age["@code"])) s75 += v;
            if (age["@code"] === "90+") s85 += v;
          }
        });
        if (total > 0) {
          set("v1", (s60 / total * 100), "INSEE RP 2020 — commune", "commune");
          set("v2", (s75 / total * 100), "INSEE RP 2020 — commune", "commune");
          set("v3", (s85 / total * 100), "INSEE RP 2020 — commune", "commune");
        }
      }
    }
  } catch(e) { console.log("INSEE pop:", e.message); }

  // ── 2. API Géo — informations territoire ────────────────
  try {
    const urlGeo = `https://geo.api.gouv.fr/communes/${codeInsee}?fields=nom,population,codesPostaux,codeDepartement,codeRegion,epci`;
    const rGeo = await fetch(urlGeo);
    if (rGeo.ok) {
      const dGeo = await rGeo.json();
      if (dGeo.population) {
        results["_meta_population"] = { valeur: String(dGeo.population), source: "API Géo — commune", niveau: "commune" };
      }
      if (dGeo.epci) {
        results["_meta_epci"] = { valeur: dGeo.epci, source: "API Géo", niveau: "epci" };
      }
    }
  } catch(e) { console.log("API Géo:", e.message); }

  // ── 3. ADEME DPE — classes énergétiques ─────────────────
  try {
    const urlDpe = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?size=1000&q=${encodeURIComponent(adresse.city)}&q_fields=nom_commune_ban&select=etiquette_dpe,periode_construction`;
    const rDpe = await fetch(urlDpe);
    if (rDpe.ok) {
      const dDpe = await rDpe.json();
      if (dDpe.results && dDpe.results.length > 0) {
        let total = dDpe.results.length, efg = 0, renove = 0;
        dDpe.results.forEach(function(r) {
          const etiq = r.etiquette_dpe;
          if (["E","F","G"].includes(etiq)) efg++;
          if (["A","B","C"].includes(etiq)) renove++;
        });
        set("te1", (efg / total * 100), "ADEME Observatoire DPE 2025 — commune", "commune");
        set("te2", (renove / total * 100), "ADEME Observatoire DPE 2025 — commune", "commune");
      }
    }
  } catch(e) { console.log("ADEME DPE:", e.message); }

  // ── 4. BPE — équipements médico-sociaux ─────────────────
  try {
    const urlBpe = `https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-TYPEQU@BPE2021/COM-${codeInsee}.all`;
    const rBpe = await fetch(urlBpe, { headers: { Accept: "application/json" } });
    if (rBpe.ok) {
      const dBpe = await rBpe.json();
      if (dBpe && dBpe.Cellule) {
        let medecins = 0, infirmiers = 0, pharmacies = 0, ehpad = 0, services = 0;
        dBpe.Cellule.forEach(function(c) {
          const type = c.Modalite?.find(function(m) { return m["@variable"] === "TYPEQU"; });
          const v = parseFloat(c.Valeur || 0);
          if (!type) return;
          const code = type["@code"];
          if (code === "D201") medecins += v;
          if (code === "D301") infirmiers += v;
          if (code === "D401") pharmacies += v;
          if (["D109","D110"].includes(code)) ehpad += v;
          if (code === "D107") services += v;
        });
        const partenaires = Math.round((medecins > 0 ? 1 : 0) + (ehpad > 0 ? 1 : 0) + (services > 0 ? 2 : 0) + (pharmacies > 0 ? 1 : 0));
        set("pt1", partenaires, "INSEE BPE 2021 — équipements médico-sociaux commune", "commune");
        results["_meta_bpe"] = {
          valeur: `${medecins} médecins, ${infirmiers} infirmiers, ${pharmacies} pharmacies, ${ehpad} EHPAD/résidences autonomie`,
          source: "INSEE BPE 2021", niveau: "commune"
        };
      }
    }
  } catch(e) { console.log("BPE:", e.message); }

  // ── 5. Géorisques ────────────────────────────────────────
  try {
    if (lat && lon) {
      const urlGR = `https://georisques.gouv.fr/api/v1/exposition?latlon=${lon},${lat}`;
      const rGR = await fetch(urlGR);
      if (rGR.ok) {
        const dGR = await rGR.json();
        if (dGR) {
          // Inondation
          if (dGR.inondation) {
            const niv = dGR.inondation.niveauAlea;
            const score = niv === "Fort" ? 80 : niv === "Moyen" ? 50 : niv === "Faible" ? 25 : 0;
            if (score > 0) set("te5", score, "Géorisques — exposition inondation", "adresse");
          }
          // Retrait-gonflement argiles
          if (dGR.retraitGonflementArgiles) {
            const exp = dGR.retraitGonflementArgiles.niveauAlea;
            results["_meta_rga"] = { valeur: `Exposition argiles : ${exp || "Faible"}`, source: "Géorisques 2026", niveau: "adresse" };
          }
        }
      }
    }
  } catch(e) { console.log("Géorisques:", e.message); }

  // ── 6. RPLS — parc social ───────────────────────────────
  try {
    const urlRpls = `https://data.statistiques.developpement-durable.gouv.fr/ods/api/records/1.0/search/?dataset=rpls_routier&q=code_commune_proprietaire:${codeInsee}&rows=0&facet=categorie_proprietaire`;
    const rRpls = await fetch(urlRpls);
    if (rRpls.ok) {
      const dRpls = await rRpls.json();
      if (dRpls.nhits) {
        results["_meta_rpls"] = { valeur: `${dRpls.nhits} logements sociaux recensés dans la commune`, source: "RPLS 2023 — data.gouv.fr", niveau: "commune" };
      }
    }
  } catch(e) { console.log("RPLS:", e.message); }

  // ── 7. Filosofi — revenus et pauvreté ───────────────────
  try {
    const urlFilo = `https://data.insee.fr/api/donnees-locales/V0.1/donnees/geo-INDIC@FILOSOFI2020/COM-${codeInsee}.all`;
    const rFilo = await fetch(urlFilo, { headers: { Accept: "application/json" } });
    if (rFilo.ok) {
      const dFilo = await rFilo.json();
      if (dFilo && dFilo.Cellule) {
        dFilo.Cellule.forEach(function(c) {
          const indic = c.Modalite?.find(function(m) { return m["@variable"] === "INDIC"; });
          if (!indic) return;
          const val = parseFloat(c.Valeur);
          if (indic["@code"] === "TP60" && !isNaN(val)) {
            set("v14", val / 100 * 0.35, "INSEE Filosofi 2020 — taux pauvreté commune (proxy taux d'effort)", "commune");
          }
          if (indic["@code"] === "MED21" && !isNaN(val)) {
            results["_meta_revenu_median"] = { valeur: `${Math.round(val)} €/an`, source: "INSEE Filosofi 2020 — revenu médian", niveau: "commune" };
          }
        });
      }
    }
  } catch(e) { console.log("Filosofi:", e.message); }

  return results;
}

// ── Géolocalisation API Adresse gouv.fr ───────────────────
async function searchAddress(query) {
  if (!query || query.length < 3) return [];
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`);
    const d = await r.json();
    return (d.features || []).map(function(f) {
      return {
        label: f.properties.label,
        city: f.properties.city,
        postcode: f.properties.postcode,
        citycode: f.properties.citycode,
        departement: f.properties.context ? f.properties.context.split(",")[0].trim() : "",
        region: f.properties.context ? f.properties.context.split(",").slice(-1)[0].trim() : "",
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      };
    });
  } catch(e) { return []; }
}

function AddressField({ value, onSelect, placeholder }) {
  const [query, setQuery] = useState(value ? value.label || "" : "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async function() {
      const res = await searchAddress(q);
      setSuggestions(res);
      setOpen(res.length > 0);
    }, 300);
  }

  function handleSelect(s) {
    setQuery(s.label);
    setOpen(false);
    onSelect(s);
  }

  return (
    <div style={{ position:"relative" }}>
      <input value={query} onChange={handleChange} onFocus={function(){if(suggestions.length>0)setOpen(true);}} onBlur={function(){setTimeout(function(){setOpen(false);},200);}}
        placeholder={placeholder||"Rechercher une adresse…"}
        style={{ width:"100%", fontSize:13, padding:"7px 10px", border:"0.5px solid rgba(128,128,128,0.3)", borderRadius:8, background:"transparent", color:"inherit", boxSizing:"border-box" }}/>
      {value && value.city && (
        <div style={{ fontSize:10, color:C.teal, marginTop:3 }}>
          📍 {value.city} ({value.postcode}) · {value.departement} · {value.region}
        </div>
      )}
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"var(--color-background-primary,white)", border:"0.5px solid rgba(128,128,128,0.2)", borderRadius:8, zIndex:100, boxShadow:"0 4px 12px rgba(0,0,0,0.08)", marginTop:2 }}>
          {suggestions.map(function(s, i) {
            return (
              <div key={i} onMouseDown={function(){handleSelect(s);}}
                style={{ padding:"8px 12px", fontSize:12, cursor:"pointer", borderBottom:i<suggestions.length-1?"0.5px solid rgba(128,128,128,0.08)":"none" }}
                onMouseEnter={function(e){e.currentTarget.style.background="rgba(128,128,128,0.06)";}}
                onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>
                📍 {s.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function newDossier(nom, type, parentId) {
  return {
    id:uid(), nom:nom, type:type, parentId:parentId||null,
    totalLogements:"", nbLocataires75:"", pctSeniors75:"",
    tauxRotation:"", responsablePilotage:"", territoire:"", dateDebut:"",
    adresse: null,
    kpiValues:{},
    chantiers:[
      {id:"c1",label:"Cartographie du parc vieillissant",module:"Comprendre",decision:"prioritaire",horizon:"M1-M5",options:["Réaliser en interne","Externaliser","Approche mixte"],criteresDecision:"Disponibilité data, compétences SIG, budget",conditionsReussite:"Accès aux données locataires, référent dédié, outil cartographique"},
      {id:"c2",label:"Protocole repérage des fragilités",module:"Agir",decision:"prioritaire",horizon:"M10-M15",options:["Protocole interne","Partenariat CCAS","Dispositif mutualisé territoire"],criteresDecision:"Réseau partenarial, formation équipes, RGPD",conditionsReussite:"Formation gardiens, convention CCAS, fiche de signalement validée"},
      {id:"c3",label:"Simplification mutations internes",module:"Agir",decision:"court",horizon:"M3-M8",options:["Procédure simplifiée","Commission dédiée","Guichet unique senior"],criteresDecision:"Flux de demandes, délais actuels, ressources RH",conditionsReussite:"Engagement direction, critères clairs, suivi trimestriel"},
      {id:"c4",label:"Plan adaptation des logements",module:"Agir",decision:"court",horizon:"M11-M18",options:["Programme pluriannuel","Actions ciblées urgentes","Délégation prestataire"],criteresDecision:"Budget disponible, priorisation par résidence, financements MaPrimeAdapt'",conditionsReussite:"Budget voté, partenaire technique, processus de demande simplifié"},
      {id:"c5",label:"Tableau de bord de pilotage",module:"Agir",decision:"court",horizon:"M10-M13",options:["Outil existant adapté","Outil dédié","Solution mutualisée"],criteresDecision:"Compétences DSI, budget, interopérabilité",conditionsReussite:"Référentiel d'indicateurs validé, alimentation automatisée, revue trimestrielle"},
      {id:"c6",label:"Partenariats médico-sociaux",module:"Arbitrer",decision:"moyen",horizon:"M13-M20",options:["Conventions bilatérales","Réseau territorial","Portage par tiers"],criteresDecision:"Cartographie acteurs, capacité d'engagement, maturité partenariale",conditionsReussite:"Référent partenarial identifié, convention cadre, co-financement"},
      {id:"c7",label:"Stratégie rénovation énergétique",module:"Arbitrer",decision:"moyen",horizon:"M14-M24",options:["PSP intégrant vieillissement","Programme dédié seniors","Synergie avec réhabilitation existante"],criteresDecision:"État du parc, DPE, articulation avec plan seniors",conditionsReussite:"Double objectif acté, financement CEE/ANAH, maîtrise d'œuvre compétente"},
    ],
    actions:[
      {id:"a1",module:"Comprendre",action:"Auditions internes & externes",resp:"",horizon:"M1-M3",statut:"a-lancer",livrable:"Compte-rendus d'audition"},
      {id:"a2",module:"Comprendre",action:"Cartographie des expositions",resp:"",horizon:"M2-M5",statut:"a-lancer",livrable:"Cartographie interactive"},
      {id:"a3",module:"Comprendre",action:"Séminaire de direction",resp:"",horizon:"M6",statut:"a-lancer",livrable:"Support + décisions actées"},
      {id:"a4",module:"Arbitrer",action:"Grille d'arbitrage complète",resp:"",horizon:"M5-M7",statut:"a-lancer",livrable:"Grille priorisée"},
      {id:"a5",module:"Arbitrer",action:"Note de gouvernance",resp:"",horizon:"M7-M9",statut:"differe",livrable:"Note validée en CODIR"},
      {id:"a6",module:"Agir",action:"Protocole repérage fragilités",resp:"",horizon:"M10-M15",statut:"differe",livrable:"Protocole + formation"},
      {id:"a7",module:"Agir",action:"Plan adaptation logements",resp:"",horizon:"M11-M16",statut:"differe",livrable:"Kit clé en main"},
      {id:"a8",module:"Agir",action:"Revues trimestrielles",resp:"",horizon:"M13,M16,M19,M22",statut:"differe",livrable:"Comptes-rendus"},
    ],
  };
}

// ── Moteur de scores ──────────────────────────────────────
function gv(kpiValues, id) {
  const v = (kpiValues||{})[id];
  if (v===undefined||v===""||v===null) return null;
  const n = parseFloat(v); return isNaN(n)?null:n;
}

function computeScores(kpiValues, actions) {
  const v = function(id){return gv(kpiValues,id);};
  function calc(criteres) {
    let total=0,count=0;
    const details=criteres.map(function(c){const pts=c.compute();if(pts!==null){total+=pts;count++;}return{label:c.label,kpis:c.kpis,pts:pts};});
    return{score:count>0?Math.round(total/count*10):null,coverage:Math.round(count/criteres.length*100),details:details};
  }
  const totalKpis=BANQUE_KPIS.reduce(function(a,t){return a+t.kpis.length;},0);
  const filledKpis=BANQUE_KPIS.reduce(function(a,t){return a+t.kpis.filter(function(k){return gv(kpiValues,k.id)!==null;}).length;},0);
  const actR=(actions||[]).filter(function(a){return a.statut==="realise";}).length;
  const actT=(actions||[]).length;
  const actPct=actT?actR/actT*100:0;
  const filledPct=filledKpis/totalKpis*100;

  const s1=calc([
    {label:"Âge 75+/85+",kpis:["v2","v3"],compute:function(){const a=v("v2"),b=v("v3");if(a===null&&b===null)return null;const x=(a||0)+(b||0)/2;return x>15?10:x>8?7:x>4?4:2;}},
    {label:"Personne seule",kpis:["v8"],compute:function(){const a=v("v8");if(a===null)return null;return a>50?10:a>35?7:a>20?4:2;}},
    {label:"Étage sans ascenseur",kpis:["a3"],compute:function(){const a=v("a3");if(a===null)return null;return a>20?10:a>10?6:a>5?3:1;}},
    {label:"Logement non adapté",kpis:["a9"],compute:function(){const a=v("a9");if(a===null)return null;return a>40?10:a>20?6:a>10?3:1;}},
    {label:"Baignoire 75+",kpis:["a11"],compute:function(){const a=v("a11");if(a===null)return null;return a>50?10:a>30?6:a>15?3:1;}},
    {label:"DPE dégradé",kpis:["te1"],compute:function(){const a=v("te1");if(a===null)return null;return a>30?10:a>15?6:a>8?3:1;}},
    {label:"Réclamations répétées",kpis:["qs2","qs3"],compute:function(){const a=v("qs2"),b=v("qs3");if(a===null&&b===null)return null;return(a||0)>15||(b||0)>20?10:(a||0)>8?6:3;}},
    {label:"Fragilité économique",kpis:["v14","v15"],compute:function(){const a=v("v14"),b=v("v15");if(a===null&&b===null)return null;return(a||0)>0.35||(b||0)>0.05?10:(a||0)>0.25?6:3;}},
    {label:"Absence contact",kpis:["rf4"],compute:function(){const a=v("rf4");if(a===null)return null;return a<40?10:a<60?6:a<80?3:1;}},
    {label:"Signalement partenaire",kpis:["rf1","rf2"],compute:function(){const a=v("rf1"),b=v("rf2");if(a===null&&b===null)return null;return(b||0)>0.1||(a||0)>50?10:(a||0)>20?5:2;}},
  ]);
  const s2=calc([
    {label:"Logement accessible",kpis:["a5","a6"],compute:function(){const a=v("a5"),b=v("a6");if(a===null&&b===null)return null;return((a||0)+(b||0))/2>20?10:((a||0)+(b||0))/2>10?7:4;}},
    {label:"Adaptation légère",kpis:["ad7"],compute:function(){const a=v("ad7");if(a===null)return null;return a>60?10:a>40?7:a>20?4:1;}},
    {label:"Coût faible",kpis:["ad6"],compute:function(){const a=v("ad6");if(a===null)return null;return a<2000?10:a<5000?7:a<10000?4:1;}},
    {label:"Travaux programmés",kpis:["te7"],compute:function(){const a=v("te7");if(a===null)return null;return a>50?10:a>25?6:a>10?3:1;}},
    {label:"Concentration seniors",kpis:["v2"],compute:function(){const a=v("v2");if(a===null)return null;return a>15?10:a>8?6:a>4?3:1;}},
    {label:"Partenaires locaux",kpis:["pt1","pt2"],compute:function(){const a=v("pt1"),b=v("pt2");if(a===null&&b===null)return null;return(a||0)>10&&(b||0)>70?10:(a||0)>5?6:2;}},
    {label:"Transférabilité",kpis:["pr4","pr6"],compute:function(){const a=v("pr4"),b=v("pr6");if(a===null&&b===null)return null;return(a||0)>60?10:(b||0)>30?7:4;}},
  ]);
  const s3=calc([
    {label:"Part 75+/85+",kpis:["v2","v3"],compute:function(){const a=v("v2"),b=v("v3");if(a===null&&b===null)return null;return((a||0)+(b||0))>18?10:((a||0)+(b||0))>10?6:3;}},
    {label:"Seniors seuls",kpis:["v8"],compute:function(){const a=v("v8");if(a===null)return null;return a>50?10:a>30?6:2;}},
    {label:"DPE E/F/G",kpis:["te1"],compute:function(){const a=v("te1");if(a===null)return null;return a>30?10:a>15?6:a>8?3:1;}},
    {label:"Charges élevées",kpis:["te3"],compute:function(){const a=v("te3");if(a===null)return null;return a>2000?10:a>1400?6:a>900?3:1;}},
    {label:"Impayés charges",kpis:["te4"],compute:function(){const a=v("te4");if(a===null)return null;return a>8?10:a>4?6:a>2?3:1;}},
    {label:"Réclamations chauffage",kpis:["qs4"],compute:function(){const a=v("qs4");if(a===null)return null;return a>30?10:a>15?6:a>5?3:1;}},
    {label:"Confort été dégradé",kpis:["te5"],compute:function(){const a=v("te5");if(a===null)return null;return a>20?10:a>10?6:a>5?3:1;}},
    {label:"Absence ascenseur",kpis:["a3","a14"],compute:function(){const a=v("a3"),b=v("a14");if(a===null&&b===null)return null;return(a||0)>20||(b||0)>0.15?10:(a||0)>10?6:3;}},
  ]);
  const s4=calc([
    {label:"DPE E/F/G",kpis:["te1"],compute:function(){const a=v("te1");if(a===null)return null;return a>30?10:a>15?6:3;}},
    {label:"Rénovation+adaptation",kpis:["te7"],compute:function(){const a=v("te7");if(a===null)return null;return a>50?10:a>25?7:a>10?4:1;}},
    {label:"Baignoire 75+",kpis:["a11"],compute:function(){const a=v("a11");if(a===null)return null;return a>50?10:a>30?6:3;}},
    {label:"RDC ou ascenseur",kpis:["a1","a2"],compute:function(){const a=v("a1"),b=v("a2");if(a===null&&b===null)return null;const x=((a||0)+(b||0))/2;return x>50?1:x>30?4:x>15?7:10;}},
    {label:"Coût adaptation",kpis:["ad6"],compute:function(){const a=v("ad6");if(a===null)return null;return a<2000?10:a<5000?7:a<10000?4:1;}},
    {label:"Financements externes",kpis:["fi4"],compute:function(){const a=v("fi4");if(a===null)return null;return a>40?10:a>20?6:a>10?3:1;}},
    {label:"Concentration seniors",kpis:["v2"],compute:function(){const a=v("v2");if(a===null)return null;return a>15?10:a>8?6:3;}},
  ]);
  const s5=calc([
    {label:"Espace locataire activé",kpis:["nd1"],compute:function(){const a=v("nd1");if(a===null)return null;return a<20?10:a<40?7:a<60?4:1;}},
    {label:"Démarches hors numérique",kpis:["nd2"],compute:function(){const a=v("nd2");if(a===null)return null;return a>60?10:a>40?6:a>20?3:1;}},
    {label:"Abandon numérique",kpis:["nd3"],compute:function(){const a=v("nd3");if(a===null)return null;return a>30?10:a>15?6:a>5?3:1;}},
    {label:"Demandes aide admin",kpis:["nd4"],compute:function(){const a=v("nd4");if(a===null)return null;return a>100?10:a>50?6:a>20?3:1;}},
    {label:"Seniors seuls",kpis:["v8"],compute:function(){const a=v("v8");if(a===null)return null;return a>50?10:a>30?6:2;}},
    {label:"Seniors informés aides",kpis:["nd5"],compute:function(){const a=v("nd5");if(a===null)return null;return a<20?10:a<40?7:a<60?4:1;}},
  ]);
  const s6=calc([
    {label:"Complétude données",kpis:["rh8"],compute:function(){return filledPct>70?10:filledPct>40?7:filledPct>20?4:1;}},
    {label:"Doctrine adaptation",kpis:["ad5","pr7"],compute:function(){const a=v("ad5"),b=v("pr7");if(a===null&&b===null)return null;return(b||0)>70&&(a||0)<0.3?10:(b||0)>50?6:3;}},
    {label:"Gouvernance active",kpis:["rh4","rh6"],compute:function(){const a=v("rh4"),b=v("rh6");if(a===null&&b===null)return null;return(a||0)>=3&&(b||0)>80?10:(a||0)>=2?6:2;}},
    {label:"Budget identifié",kpis:["fi1","fi8"],compute:function(){const a=v("fi1"),b=v("fi8");if(a===null&&b===null)return null;return(a||0)>50000&&(b||0)>80?10:(a||0)>20000?6:2;}},
    {label:"Partenariats formalisés",kpis:["pt3","pt2"],compute:function(){const a=v("pt3"),b=v("pt2");if(a===null&&b===null)return null;return(a||0)>5&&(b||0)>60?10:(a||0)>2?6:2;}},
    {label:"Pilotage trimestriel",kpis:["rh7"],compute:function(){const a=v("rh7");if(a===null){return actPct>50?8:actPct>25?4:1;}return a<10&&actPct>25?10:a<20?6:2;}},
    {label:"Actions prévention",kpis:["rf8","nd5"],compute:function(){const a=v("rf8"),b=v("nd5");if(a===null&&b===null)return null;return((a||0)>10&&(b||0)>60)?10:((a||0)>5||(b||0)>30)?6:2;}},
    {label:"Mesure d'impact",kpis:["ad11","rf7"],compute:function(){const a=v("ad11"),b=v("rf7");if(a===null&&b===null)return null;return((a||0)>70&&(b||0)>60)?10:((a||0)>50||(b||0)>40)?6:2;}},
  ]);
  return {
    s1:Object.assign({label:"Vulnérabilité résidentielle",color:C.red,icon:"🏠"},s1),
    s2:Object.assign({label:"Opportunité adaptation",color:C.teal,icon:"🔧"},s2),
    s3:Object.assign({label:"Vulnérabilité écologique",color:C.amber,icon:"🌡"},s3),
    s4:Object.assign({label:"Adaptation × Rénovation",color:C.purple,icon:"⚡"},s4),
    s5:Object.assign({label:"Exclusion numérique",color:C.blue,icon:"💻"},s5),
    s6:Object.assign({label:"Maturité Agenda 21",color:C.coral,icon:"🎯"},s6),
  };
}

function computeChantierScores(scores) {
  function norm(s){return s===null?null:Math.round(s/20);}
  const u=scores.s1.score!==null&&scores.s3.score!==null?Math.round((scores.s1.score+scores.s3.score)/40):norm(scores.s1.score);
  const im=scores.s2.score!==null&&scores.s4.score!==null?Math.round((scores.s2.score+scores.s4.score)/40):norm(scores.s2.score);
  const f=scores.s6.score!==null?Math.round(scores.s6.score/20):3;
  return{urgence:u===null?3:Math.min(5,Math.max(1,u)),impact:im===null?3:Math.min(5,Math.max(1,im)),faisabilite:f===null?3:Math.min(5,Math.max(1,f))};
}

// ── UI helpers ────────────────────────────────────────────
function levelColor(s){return s===null?"#ccc":s>=70?C.teal:s>=40?C.amber:C.red;}
function levelLabel(s){return s===null?"Non évalué":s>=70?"Favorable":s>=40?"Modéré":"Risque élevé";}

function CircularGauge({score,size}){
  const sz=size||80,r=sz*0.38,cx=sz/2,cy=sz/2;
  const circ=2*Math.PI*r,pct=score===null?0:score/100,lc=levelColor(score);
  return(
    <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(128,128,128,0.12)" strokeWidth={sz*0.09}/>
      {score!==null&&<circle cx={cx} cy={cy} r={r} fill="none" stroke={lc} strokeWidth={sz*0.09} strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}/>}
      <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fontSize={sz*0.2} fontWeight="500" fill={score===null?"#ccc":lc}>{score===null?"—":score}</text>
      <text x={cx} y={cy+sz*0.18} textAnchor="middle" fontSize={sz*0.1} fill="#aaa">/100</text>
    </svg>
  );
}

function RadarChart({scores}){
  const size=260,keys=Object.keys(scores),n=keys.length,cx=size/2,cy=size/2,r=size*0.33;
  const angle=function(i){return(2*Math.PI*i/n)-Math.PI/2;};
  const pt=function(i,lv){return[cx+Math.cos(angle(i))*r*lv,cy+Math.sin(angle(i))*r*lv];};
  const gridPts=function(lv){return keys.map(function(_,i){return pt(i,lv).join(",");}).join(" ");};
  const dataPath=keys.map(function(k,i){const s=scores[k].score,lv=s===null?0:s/100,p=pt(i,lv);return(i===0?"M":"L")+p[0].toFixed(1)+","+p[1].toFixed(1);}).join(" ")+"Z";
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25,0.5,0.75,1].map(function(l){return<polygon key={l} points={gridPts(l)} fill="none" stroke="rgba(128,128,128,0.12)" strokeWidth="0.8"/>;}) }
      {keys.map(function(_,i){const p=pt(i,1);return<line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="rgba(128,128,128,0.1)" strokeWidth="0.8"/>;}) }
      <path d={dataPath} fill={`${C.coral}28`} stroke={C.coral} strokeWidth="2"/>
      {keys.map(function(k,i){const s=scores[k].score,lv=s===null?0:s/100,p=pt(i,lv);return<circle key={i} cx={p[0]} cy={p[1]} r="4" fill={scores[k].color} stroke="white" strokeWidth="1.5"/>;}) }
      {keys.map(function(k,i){const lp=pt(i,1.3),s=scores[k];return<text key={i} x={lp[0]} y={lp[1]} textAnchor="middle" fontSize="9" fill="#888" dominantBaseline="middle">{s.icon} {s.label.split(" ").slice(0,2).join(" ")}</text>;}) }
    </svg>
  );
}

function ScoreCard({s,selected,onClick}){
  const lc=levelColor(s.score);
  return(
    <div onClick={onClick} style={{padding:12,borderRadius:12,border:`0.5px solid ${selected?s.color:"rgba(128,128,128,0.15)"}`,background:selected?`${s.color}0D`:"rgba(128,128,128,0.02)",cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:14}}>{s.icon}</span><div style={{fontSize:11,fontWeight:500,lineHeight:1.3}}>{s.label}</div></div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <CircularGauge score={s.score} size={64}/>
        <div><div style={{fontSize:11,fontWeight:500,color:lc,marginBottom:2}}>{levelLabel(s.score)}</div><div style={{fontSize:10,color:"#aaa"}}>{s.coverage}% évalués</div></div>
      </div>
    </div>
  );
}

function ScoreDetail({s}){
  return(
    <div style={{border:`0.5px solid ${s.color}40`,borderRadius:12,overflow:"hidden",marginTop:14}}>
      <div style={{padding:"10px 16px",background:`${s.color}0D`,borderBottom:`0.5px solid ${s.color}20`}}>
        <span style={{fontSize:13,fontWeight:500,color:s.color}}>{s.icon} {s.label}</span>
      </div>
      {s.details.map(function(d,i){
        const lc=d.pts===null?"#ccc":d.pts>=7?C.teal:d.pts>=4?C.amber:C.red;
        return(
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 60px",gap:8,alignItems:"center",padding:"9px 16px",borderBottom:i<s.details.length-1?"0.5px solid rgba(128,128,128,0.06)":"none",background:i%2===0?"transparent":"rgba(128,128,128,0.02)"}}>
            <div><div style={{fontSize:12,fontWeight:500}}>{d.label}</div><div style={{fontSize:10,color:"#aaa"}}>KPIs: {d.kpis.join(", ")}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{flex:1,height:5,borderRadius:3,background:"rgba(128,128,128,0.12)",overflow:"hidden"}}><div style={{width:d.pts!==null?`${d.pts/10*100}%`:"0%",height:"100%",background:lc}}/></div></div>
            <div style={{textAlign:"right",fontSize:13,fontWeight:500,color:lc}}>{d.pts===null?"—":`${d.pts}/10`}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Bouton Analyser avec IA ───────────────────────────────
function AnalyseButton({ dossier, context, label }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    setOpen(true);
    setResult(null);

    const scores = computeScores(dossier.kpiValues, dossier.actions);
    const kpiSummary = Object.entries(dossier.kpiValues||{}).map(function(e) {
      const b = BENCHMARKS[e[0]];
      const pos = benchmarkPosition(e[0], e[1]);
      const posLabel = pos===1?"au-dessus de la moyenne nationale":pos===-1?"sous la moyenne nationale":"dans la moyenne nationale";
      return `${e[0]}: ${e[1]}${b?` (${posLabel}, nat: ${b.national}${b.unite}, source: ${b.source})`:""}`;
    }).join("\n");

    const adresseInfo = dossier.adresse
      ? `Localisation : ${dossier.adresse.label}, ${dossier.adresse.city} (${dossier.adresse.postcode}), département ${dossier.adresse.departement}, région ${dossier.adresse.region}`
      : "Localisation non renseignée";

    const prompt = `Tu es un expert en stratégie de logement social, spécialisé dans le vieillissement des locataires, l'adaptation des logements, la rénovation énergétique et la cohésion sociale.

Tu analyses le dossier suivant dans le cadre de la démarche Agenda 21 de la longévité :

**Bailleur / Résidence :** ${dossier.nom} (${dossier.type === "bailleur" ? "vision globale bailleur" : "résidence locale"})
**${adresseInfo}**
**Parc :** ${dossier.totalLogements || "NC"} logements, ${dossier.nbLocataires75 || "NC"} locataires 75+

**Scores calculés (sur 100) :**
- Vulnérabilité résidentielle : ${scores.s1.score ?? "non évalué"}
- Opportunité d'adaptation : ${scores.s2.score ?? "non évalué"}
- Vulnérabilité écologique : ${scores.s3.score ?? "non évalué"}
- Adaptation × Rénovation : ${scores.s4.score ?? "non évalué"}
- Exclusion numérique : ${scores.s5.score ?? "non évalué"}
- Maturité Agenda 21 : ${scores.s6.score ?? "non évalué"}

**KPIs renseignés avec positionnement benchmark national :**
${kpiSummary || "Aucun KPI renseigné"}

**Contexte de l'analyse demandée :** ${context}

**Sources de référence à mobiliser :** RPLS 2023, USH HLM en chiffres 2025, ANCOLS Panorama 2025, INSEE/DREES projections autonomie, ADEME Observatoire DPE 2025, ONPE Tableau de bord 2025, Baromètre numérique ARCEP 2026, CNSA Data Autonomie 2024, Anah/MaPrimeAdapt' 2024, Filosofi 2021, BPE INSEE.

Produis une analyse structurée en 4 parties :
1. **Diagnostic** : points forts, points de vigilance et angles morts identifiés (comparaison benchmark)
2. **Recommandations prioritaires** : 3 à 5 actions concrètes, priorisées, avec les dispositifs mobilisables (MaPrimeAdapt', CEE, ANAH, partenariats CNSA…)
3. **Leviers territoriaux** : actions spécifiques au territoire si la localisation est renseignée
4. **Alertes** : signaux faibles à surveiller

Sois précis, actionnable et ancré dans les meilleures pratiques du secteur HLM. Utilise des données chiffrées issues des sources listées.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:prompt}],
        }),
      });
      const data = await response.json();
      const text = (data.content||[]).map(function(b){return b.text||"";}).join("\n");
      setResult(text);
    } catch(e) {
      setResult("Erreur lors de l'analyse. Vérifiez votre connexion.");
    }
    setLoading(false);
  }

  return (
    <div>
      <button onClick={open?function(){setOpen(false);}:runAnalysis}
        style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", borderRadius:20, border:`0.5px solid ${C.purple}`, background:open?`${C.purple}12`:"transparent", color:C.purple, fontSize:12, fontWeight:500, cursor:"pointer" }}>
        <span>✨</span>{loading?"Analyse en cours…":open?"Fermer l'analyse":label||"Analyser avec l'IA"}
      </button>
      {open && (
        <div style={{ marginTop:12, padding:16, borderRadius:12, border:`0.5px solid ${C.purple}40`, background:`${C.purple}05` }}>
          {loading ? (
            <div style={{ display:"flex", alignItems:"center", gap:10, color:"#888", fontSize:12 }}>
              <div style={{ width:16, height:16, border:`2px solid ${C.purple}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
              Analyse des KPIs et des benchmarks nationaux en cours…
            </div>
          ) : (
            <div style={{ fontSize:12, lineHeight:1.7, color:"var(--color-text-primary,#1a1a1a)", whiteSpace:"pre-wrap" }}>
              {(result||"").split("\n").map(function(line, i) {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <div key={i} style={{ fontWeight:600, color:C.purple, marginTop:i>0?12:0, marginBottom:4 }}>{line.replace(/\*\*/g,"")}</div>;
                }
                if (line.startsWith("- ") || line.startsWith("• ")) {
                  return <div key={i} style={{ paddingLeft:12, marginBottom:3 }}>• {line.slice(2)}</div>;
                }
                return <div key={i} style={{ marginBottom:line?2:6 }}>{line}</div>;
              })}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// VIEW: CONFIGURATION
// ══════════════════════════════════════════════════════════
function ViewConfig({ dossier, onSave }) {
  const [form, setForm] = useState(dossier);
  const [activeTheme, setActiveTheme] = useState(0);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState(null);
  const setF = function(k,val){setForm(function(f){return Object.assign({},f,{[k]:val});});};
  const setKpi = function(id,val){setForm(function(f){return Object.assign({},f,{kpiValues:Object.assign({},f.kpiValues,{[id]:val})});});};
  const totalKpis = BANQUE_KPIS.reduce(function(a,t){return a+t.kpis.length;},0);
  const saisieCount = BANQUE_KPIS.reduce(function(acc,t){return acc+t.kpis.filter(function(k){return form.kpiValues&&form.kpiValues[k.id]!==undefined&&form.kpiValues[k.id]!=="";}).length;},0);
  const t = BANQUE_KPIS[activeTheme];
  const tcol = THEME_COLORS[t.theme]||C.gray;
  const isRes = dossier.type==="residence";

  async function handleEnrichir() {
    if (!form.adresse) return;
    setEnrichLoading(true);
    setEnrichResult(null);
    try {
      const res = await enrichirDepuisAPIs(form.adresse);
      const kpiKeys = Object.keys(res).filter(function(k){return !k.startsWith("_meta");});
      const metaKeys = Object.keys(res).filter(function(k){return k.startsWith("_meta");});
      let newKpiValues = Object.assign({}, form.kpiValues);
      kpiKeys.forEach(function(id){newKpiValues[id] = res[id].valeur;});
      setForm(function(f){return Object.assign({},f,{kpiValues:newKpiValues,enrichissementPublic:res});});
      setEnrichResult({ kpiCount:kpiKeys.length, metaCount:metaKeys.length, meta:metaKeys.map(function(k){return res[k];}) });
    } catch(e) {
      setEnrichResult({ error:"Erreur lors de l'enrichissement : "+e.message });
    }
    setEnrichLoading(false);
  }

  return (
    <div>
      <h2 style={{fontSize:16,fontWeight:500,marginBottom:4}}>Configuration — {dossier.nom}</h2>
      <p style={{fontSize:12,color:"#888",marginBottom:20}}>{isRes?"Vue locale résidence":"Vue globale bailleur"}</p>

      <div style={{padding:16,borderRadius:12,border:"0.5px solid rgba(128,128,128,0.2)",marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:500,marginBottom:12,color:C.coral}}>Informations générales</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[["totalLogements",isRes?"Nb logements résidence":"Nb total logements","number","Ex: 120"],["nbLocataires75","Nb locataires 75+","number","Ex: 18"],["pctSeniors75","% occupés 75+","number","Ex: 15"],["tauxRotation","Taux rotation (%)","number","Ex: 5.2"],["responsablePilotage","Responsable pilotage","text","Nom + fonction"],["dateDebut","Date de début","date",""]].map(function(f){return(
            <div key={f[0]}>
              <label style={{fontSize:11,color:"#888",display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:"0.04em"}}>{f[1]}</label>
              <input type={f[2]} value={form[f[0]]||""} onChange={function(e){setF(f[0],e.target.value);}} placeholder={f[3]} style={{width:"100%",fontSize:13,padding:"7px 10px",border:"0.5px solid rgba(128,128,128,0.3)",borderRadius:8,background:"transparent",color:"inherit",boxSizing:"border-box"}}/>
            </div>
          );})}
        </div>

        <div style={{marginTop:14}}>
          <label style={{fontSize:11,color:"#888",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em"}}>
            📍 {isRes?"Adresse de la résidence":"Adresse du siège"}
          </label>
          <AddressField value={form.adresse} onSelect={function(addr){setF("adresse",addr);}} placeholder={isRes?"12 rue des Lilas, Lyon…":"15 avenue de la République, Paris…"}/>
          {form.adresse && (
            <div style={{marginTop:8}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                {[{label:"Commune",val:form.adresse.city},{label:"Code INSEE",val:form.adresse.citycode},{label:"Département",val:form.adresse.departement},{label:"Région",val:form.adresse.region}].map(function(item){return(
                  <div key={item.label} style={{padding:"4px 10px",borderRadius:6,background:`${C.teal}12`,border:`0.5px solid ${C.teal}30`}}>
                    <span style={{fontSize:10,color:"#888"}}>{item.label}: </span>
                    <span style={{fontSize:11,fontWeight:500,color:C.teal}}>{item.val}</span>
                  </div>
                );})}
              </div>
              <div style={{padding:14,borderRadius:10,border:`0.5px solid ${C.purple}40`,background:`${C.purple}05`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:500,color:C.purple,marginBottom:2}}>🌐 Enrichissement depuis les données publiques</div>
                    <div style={{fontSize:11,color:"#888"}}>INSEE · ADEME DPE · BPE · Géorisques · RPLS · Filosofi</div>
                  </div>
                  <button onClick={handleEnrichir} disabled={enrichLoading}
                    style={{padding:"8px 16px",borderRadius:20,border:"none",background:enrichLoading?"#ccc":C.purple,color:"#fff",fontSize:12,fontWeight:500,cursor:enrichLoading?"default":"pointer",whiteSpace:"nowrap"}}>
                    {enrichLoading?"⟳ Chargement…":"🌐 Enrichir automatiquement"}
                  </button>
                </div>
                {enrichResult&&!enrichResult.error&&(
                  <div style={{marginTop:8}}>
                    <div style={{fontSize:11,color:C.teal,fontWeight:500,marginBottom:6}}>✓ {enrichResult.kpiCount} KPI(s) pré-rempli(s) depuis les données publiques</div>
                    {enrichResult.meta&&enrichResult.meta.length>0&&(
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {enrichResult.meta.map(function(m,i){return(
                          <div key={i} style={{fontSize:10,padding:"4px 8px",borderRadius:6,background:"rgba(128,128,128,0.06)",color:"#888"}}>
                            📊 {m.valeur} <span style={{color:"#aaa"}}>— {m.source}</span>
                          </div>
                        );})}
                      </div>
                    )}
                  </div>
                )}
                {enrichResult&&enrichResult.error&&(
                  <div style={{fontSize:11,color:C.red,marginTop:6}}>⚠ {enrichResult.error}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{padding:16,borderRadius:12,border:"0.5px solid rgba(128,128,128,0.2)",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:500,color:C.teal}}>Banque d'indicateurs</div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {form.enrichissementPublic&&<span style={{fontSize:11,color:C.purple}}>🌐 {Object.keys(form.enrichissementPublic).filter(function(k){return !k.startsWith("_meta");}).length} depuis données publiques</span>}
            <span style={{fontSize:11,color:"#888"}}>{saisieCount}/{totalKpis} renseignés</span>
          </div>
        </div>
        <div style={{height:4,borderRadius:2,background:"rgba(128,128,128,0.15)",marginBottom:12,overflow:"hidden"}}>
          <div style={{width:`${(saisieCount/totalKpis)*100}%`,height:"100%",background:C.teal}}/>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {BANQUE_KPIS.map(function(th,i){
            const filled=th.kpis.filter(function(k){return form.kpiValues&&form.kpiValues[k.id]!==undefined&&form.kpiValues[k.id]!=="";}).length;
            const col=THEME_COLORS[th.theme]||C.gray;
            return<button key={i} onClick={function(){setActiveTheme(i);}} style={{fontSize:11,padding:"3px 9px",borderRadius:20,border:`0.5px solid ${activeTheme===i?col:"rgba(128,128,128,0.25)"}`,background:activeTheme===i?`${col}18`:"transparent",color:activeTheme===i?col:"#888",cursor:"pointer"}}>{th.theme} ({filled}/{th.kpis.length})</button>;
          })}
        </div>
        <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:"0.04em",display:"grid",gridTemplateColumns:"2fr 0.8fr 0.4fr 0.6fr 1.2fr",gap:6,padding:"0 10px 6px",borderBottom:"0.5px solid rgba(128,128,128,0.1)"}}>
          <span>Indicateur</span><span>Formule</span><span>Unité</span><span>Valeur</span><span>Benchmark / Source</span>
        </div>
        {t.kpis.map(function(kpi){
          const val=form.kpiValues&&form.kpiValues[kpi.id]||"";
          const hasVal=val!=="";
          const b=BENCHMARKS[kpi.id];
          const isPublic=form.enrichissementPublic&&form.enrichissementPublic[kpi.id];
          return(
            <div key={kpi.id} style={{display:"grid",gridTemplateColumns:"2fr 0.8fr 0.4fr 0.6fr 1.2fr",gap:6,padding:"8px 10px",borderBottom:"0.5px solid rgba(128,128,128,0.06)",alignItems:"center",background:isPublic?"rgba(83,74,183,0.03)":"transparent"}}>
              <div><div style={{fontSize:12,fontWeight:500}}>{kpi.nom}</div><div style={{fontSize:10,color:"#aaa"}}>{kpi.lecture}</div></div>
              <div style={{fontSize:10,color:"#888",lineHeight:1.3}}>{kpi.formule}</div>
              <div style={{fontSize:11,color:tcol,fontWeight:500}}>{kpi.unite}</div>
              <div style={{position:"relative"}}>
                <input type="text" value={val} onChange={function(e){setKpi(kpi.id,e.target.value);}} placeholder="—"
                  style={{fontSize:12,padding:"4px 8px",border:`0.5px solid ${hasVal?tcol:"rgba(128,128,128,0.25)"}`,borderRadius:6,background:hasVal?`${tcol}0D`:"transparent",color:"inherit",width:"100%",boxSizing:"border-box",textAlign:"right"}}/>
                {isPublic&&<span style={{position:"absolute",top:-8,right:-4,fontSize:8,background:C.purple,color:"#fff",borderRadius:3,padding:"1px 3px"}}>🌐</span>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {b&&<div style={{fontSize:10,color:"#888"}}>Nat: <strong>{b.national}{b.unite}</strong></div>}
                {isPublic&&<div style={{fontSize:9,color:C.purple}}>🌐 {form.enrichissementPublic[kpi.id].source}</div>}
                {!isPublic&&b&&<div style={{fontSize:9,color:"#aaa"}}>{b.source}</div>}
                {hasVal&&<BenchmarkBadge kpiId={kpi.id} value={val}/>}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={function(){onSave(form);}} style={{padding:"10px 24px",borderRadius:20,border:"none",background:C.coral,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}}>Enregistrer ✓</button>
    </div>
  );
}
// ══════════════════════════════════════════════════════════
// VIEW: ANALYSE & RECOMMANDATIONS IA
// ══════════════════════════════════════════════════════════
function ViewAnalyse({ dossier }) {
  const scores = computeScores(dossier.kpiValues, dossier.actions);
  const kpiValues = dossier.kpiValues||{};

  // Calcul positions benchmark
  const benchmarkAlerts = Object.entries(kpiValues).filter(function(e){
    return benchmarkPosition(e[0], e[1]) === -1;
  });
  const benchmarkGood = Object.entries(kpiValues).filter(function(e){
    return benchmarkPosition(e[0], e[1]) === 1;
  });

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <h2 style={{fontSize:16,fontWeight:500,marginBottom:2}}>Analyse & Recommandations IA</h2>
          <p style={{fontSize:12,color:"#888"}}>{dossier.nom} · Benchmark national + Intelligence artificielle</p>
        </div>
        {dossier.adresse && (
          <div style={{padding:"6px 12px",borderRadius:8,background:`${C.teal}12`,border:`0.5px solid ${C.teal}30`,fontSize:11,color:C.teal}}>
            📍 {dossier.adresse.city} · {dossier.adresse.departement}
          </div>
        )}
      </div>

      {/* Synthèse benchmark */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <div style={{padding:14,borderRadius:12,border:`0.5px solid ${C.red}40`,background:`${C.red}06`}}>
          <div style={{fontSize:12,fontWeight:500,color:C.red,marginBottom:10}}>⚠ Points sous la moyenne nationale ({benchmarkAlerts.length})</div>
          {benchmarkAlerts.length===0
            ? <div style={{fontSize:11,color:"#888"}}>Aucun point d'alerte — renseignez vos KPIs pour l'évaluation.</div>
            : benchmarkAlerts.map(function(e,i){
                const b=BENCHMARKS[e[0]];
                return b?(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,padding:"4px 8px",borderRadius:6,background:`${C.red}0A`}}>
                    <span style={{fontSize:11}}>{b.label}</span>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontSize:12,fontWeight:500,color:C.red}}>{e[1]}{b.unite}</span>
                      <span style={{fontSize:10,color:"#aaa",marginLeft:6}}>nat: {b.national}{b.unite}</span>
                    </div>
                  </div>
                ):null;
              })
          }
        </div>
        <div style={{padding:14,borderRadius:12,border:`0.5px solid ${C.teal}40`,background:`${C.teal}06`}}>
          <div style={{fontSize:12,fontWeight:500,color:C.teal,marginBottom:10}}>✓ Points au-dessus de la moyenne nationale ({benchmarkGood.length})</div>
          {benchmarkGood.length===0
            ? <div style={{fontSize:11,color:"#888"}}>Aucun point favorable identifié pour l'instant.</div>
            : benchmarkGood.map(function(e,i){
                const b=BENCHMARKS[e[0]];
                return b?(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,padding:"4px 8px",borderRadius:6,background:`${C.teal}0A`}}>
                    <span style={{fontSize:11}}>{b.label}</span>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontSize:12,fontWeight:500,color:C.teal}}>{e[1]}{b.unite}</span>
                      <span style={{fontSize:10,color:"#aaa",marginLeft:6}}>nat: {b.national}{b.unite}</span>
                    </div>
                  </div>
                ):null;
              })
          }
        </div>
      </div>

      {/* Tableau benchmark complet */}
      <div style={{border:"0.5px solid rgba(128,128,128,0.15)",borderRadius:12,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"10px 16px",borderBottom:"0.5px solid rgba(128,128,128,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,fontWeight:500}}>Positionnement benchmark national</span>
          <span style={{fontSize:11,color:"#888"}}>Sources : RPLS, INSEE, ADEME, CNSA, USH, Anah</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 0.8fr 0.8fr 0.8fr 1.2fr",gap:0,padding:"6px 16px",fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:"0.04em",borderBottom:"0.5px solid rgba(128,128,128,0.08)"}}>
          <span>Indicateur</span><span>Votre valeur</span><span>Moyenne nat.</span><span>Position</span><span>Source</span>
        </div>
        {Object.keys(BENCHMARKS).map(function(kid,i){
          const b=BENCHMARKS[kid];
          const val=kpiValues[kid];
          const hasVal=val!==undefined&&val!=="";
          const pos=benchmarkPosition(kid,val);
          const posStyle=pos===1?{bg:"#EAF3DE",color:"#3B6D11",label:"↑ Au-dessus"}:pos===-1?{bg:"#FCEBEB",color:"#A32D2D",label:"↓ Sous la moy."}:{bg:"#FAEEDA",color:"#854F0B",label:"→ Dans la moy."};
          return(
            <div key={kid} style={{display:"grid",gridTemplateColumns:"2fr 0.8fr 0.8fr 0.8fr 1.2fr",gap:0,padding:"8px 16px",borderBottom:i<Object.keys(BENCHMARKS).length-1?"0.5px solid rgba(128,128,128,0.06)":"none",background:i%2===0?"transparent":"rgba(128,128,128,0.02)",alignItems:"center"}}>
              <div style={{fontSize:11,fontWeight:500}}>{b.label}</div>
              <div style={{fontSize:12,fontWeight:hasVal?500:400,color:hasVal?(pos===1?C.teal:pos===-1?C.red:C.amber):"#ccc"}}>{hasVal?`${val}${b.unite}`:"—"}</div>
              <div style={{fontSize:11,color:"#888"}}>{b.national}{b.unite}</div>
              <div>{hasVal?<span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:posStyle.bg,color:posStyle.color,fontWeight:500}}>{posStyle.label}</span>:<span style={{fontSize:10,color:"#ccc"}}>—</span>}</div>
              <div style={{fontSize:9,color:"#aaa",lineHeight:1.3}}>{b.source}</div>
            </div>
          );
        })}
      </div>

      {/* Analyse IA globale */}
      <div style={{padding:16,borderRadius:12,border:`0.5px solid ${C.purple}40`,background:`${C.purple}05`,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:500,color:C.purple,marginBottom:12}}>✨ Analyse IA complète du dossier</div>
        <AnalyseButton
          dossier={dossier}
          context="Analyse complète du dossier : diagnostic global, recommandations prioritaires, leviers territoriaux et alertes. Comparer systématiquement chaque KPI renseigné au benchmark national et proposer des actions concrètes mobilisant les dispositifs nationaux disponibles (MaPrimeAdapt', CEE, ANAH, partenariats CNSA, BPE…)."
          label="Lancer l'analyse complète"
        />
      </div>

      {/* Analyses thématiques */}
      <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Analyses thématiques</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {label:"Vieillissement & Fragilités",icon:"👴",ctx:"Analyser les indicateurs de vieillissement et de fragilité du parc locatif. Focus sur la part de 75+, les seniors seuls, les alertes répétées et les signalements."},
          {label:"Adaptation & Accessibilité",icon:"🔧",ctx:"Analyser la situation de l'adaptation des logements et de l'accessibilité du bâti. Comparer les coûts, délais et taux de refus au benchmark Anah/MaPrimeAdapt'."},
          {label:"Transition écologique",icon:"🌡",ctx:"Analyser la vulnérabilité écologique des seniors : DPE, précarité énergétique, confort d'été. Comparer aux données ADEME/ONPE/ONRE et proposer une stratégie de rénovation croisée."},
          {label:"Numérique & Accès aux droits",icon:"💻",ctx:"Analyser le risque d'exclusion numérique. Comparer au Baromètre numérique ARCEP 2026 et proposer des solutions de médiation et d'accès aux droits."},
          {label:"Partenariats & Territoire",icon:"🤝",ctx:"Analyser le tissu partenarial : acteurs médico-sociaux, CCAS, CLIC, prestataires. Proposer des conventions prioritaires et des synergies territoriales selon la localisation."},
          {label:"Finances & Gouvernance",icon:"💰",ctx:"Analyser la soutenabilité financière et la maturité organisationnelle. Comparer au Panorama ANCOLS 2025 et Banque des Territoires Perspectives 2025."},
        ].map(function(item){return(
          <div key={item.label} style={{padding:14,borderRadius:10,border:"0.5px solid rgba(128,128,128,0.15)"}}>
            <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>{item.icon} {item.label}</div>
            <AnalyseButton dossier={dossier} context={item.ctx} label={`Analyser — ${item.label}`}/>
          </div>
        );}) }
      </div>
    </div>
  );
}




// ══════════════════════════════════════════════════════════
// VIEW: TABLEAU DE BORD
// ══════════════════════════════════════════════════════════
function ViewDashboard({ dossier }) {
  const scores=computeScores(dossier.kpiValues,dossier.actions);
  const [selected,setSelected]=useState("s6");
  const keys=Object.keys(scores);
  const s6=scores.s6;
  const totalKpis=BANQUE_KPIS.reduce(function(a,t){return a+t.kpis.length;},0);
  const filledKpis=BANQUE_KPIS.reduce(function(a,t){return a+t.kpis.filter(function(k){return gv(dossier.kpiValues,k.id)!==null;}).length;},0);
  const actR=(dossier.actions||[]).filter(function(a){return a.statut==="realise";}).length;
  const actT=(dossier.actions||[]).length;
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <h2 style={{fontSize:16,fontWeight:500,marginBottom:2}}>Tableau de bord — {dossier.nom}</h2>
          <p style={{fontSize:12,color:"#888"}}>{dossier.type==="bailleur"?"Vue globale":"Vue locale résidence"}{dossier.adresse?` · 📍 ${dossier.adresse.city}`:""}</p>
        </div>
        <div style={{textAlign:"center",padding:"8px 16px",borderRadius:10,background:`${C.coral}12`,border:`0.5px solid ${C.coral}40`}}>
          <div style={{fontSize:10,color:"#888",marginBottom:2}}>Maturité</div>
          <div style={{fontSize:26,fontWeight:500,color:levelColor(s6.score)}}>{s6.score===null?"—":s6.score}<span style={{fontSize:14,color:"#aaa"}}>/100</span></div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:20,marginBottom:20,alignItems:"start"}}>
        <div style={{padding:12,borderRadius:12,border:"0.5px solid rgba(128,128,128,0.15)"}}>
          <div style={{fontSize:11,color:"#888",marginBottom:6,textAlign:"center"}}>Radar des 6 scores</div>
          <RadarChart scores={scores}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {keys.map(function(k){return<ScoreCard key={k} s={scores[k]} selected={selected===k} onClick={function(){setSelected(selected===k?null:k);}}/>;}) }
        </div>
      </div>
      {selected&&<ScoreDetail s={scores[selected]}/>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:16,marginBottom:16}}>
        {[{label:"Complétude KPIs",val:`${filledKpis}/${totalKpis}`,pct:Math.round(filledKpis/totalKpis*100),color:C.teal},{label:"Actions réalisées",val:`${actR}/${actT}`,pct:actT?Math.round(actR/actT*100):0,color:C.coral},{label:"Critères Maturité",val:`${s6.details.filter(function(d){return d.pts!==null;}).length}/${s6.details.length}`,pct:s6.coverage,color:C.purple}].map(function(m){return(
          <div key={m.label} style={{padding:"12px 14px",borderRadius:10,border:"0.5px solid rgba(128,128,128,0.15)"}}>
            <div style={{fontSize:11,color:"#888",marginBottom:6}}>{m.label}</div>
            <div style={{fontSize:18,fontWeight:500,marginBottom:6}}>{m.val}</div>
            <div style={{height:4,borderRadius:2,background:"rgba(128,128,128,0.12)",overflow:"hidden"}}><div style={{width:`${m.pct}%`,height:"100%",background:m.color}}/></div>
            <div style={{fontSize:10,color:"#aaa",marginTop:4}}>{m.pct}%</div>
          </div>
        );}) }
      </div>
      <AnalyseButton dossier={dossier} context="Synthèse rapide du tableau de bord : identifier les 3 priorités d'action immédiates et les 2 signaux faibles à surveiller." label="Synthèse IA rapide"/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// VIEW: FEUILLE DE ROUTE
// ══════════════════════════════════════════════════════════
function ViewFeuilleDeRoute({ dossier, onSave }) {
  const scores=computeScores(dossier.kpiValues,dossier.actions);
  const s6=scores.s6;
  const [open,setOpen]=useState({Comprendre:true,Arbitrer:true,Agir:true});
  const updateAction=function(id,key,val){const next=dossier.actions.map(function(a){return a.id===id?Object.assign({},a,{[key]:val}):a;});onSave(Object.assign({},dossier,{actions:next}));};
  const modules=["Comprendre","Arbitrer","Agir"];
  const modColors={Comprendre:{color:C.coral,bg:C.coralLight,text:C.coralDark},Arbitrer:{color:C.purple,bg:C.purpleLight,text:C.purpleDark},Agir:{color:C.teal,bg:C.tealLight,text:C.tealDark}};
  const total=dossier.actions.length;
  const done=dossier.actions.filter(function(a){return a.statut==="realise";}).length+dossier.actions.filter(function(a){return a.statut==="en-cours";}).length*0.5;
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div><h2 style={{fontSize:16,fontWeight:500,marginBottom:2}}>Feuille de route — {dossier.nom}</h2></div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {s6.score!==null&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:10,background:`${C.coral}0D`,border:`0.5px solid ${C.coral}40`}}><CircularGauge score={s6.score} size={44}/><div style={{fontSize:11,color:C.coral,fontWeight:500}}>Maturité {s6.score}/100</div></div>}
          <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#888"}}>Avancement</div><div style={{fontSize:22,fontWeight:500}}>{Math.round(done/total*100)}%</div></div>
        </div>
      </div>
      <div style={{marginBottom:14}}><AnalyseButton dossier={dossier} context="Analyser l'avancement de la feuille de route et proposer des actions correctives pour les éléments en retard ou à risque." label="Analyser la feuille de route"/></div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>{Object.entries(statutCfg).map(function(e){return<span key={e[0]} style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:e[1].bg,color:e[1].color}}>{e[1].label}</span>;})}</div>

      {/* Tableau vision 24 mois */}
      <div style={{marginBottom:20,border:"0.5px solid rgba(128,128,128,0.15)",borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"10px 16px",borderBottom:"0.5px solid rgba(128,128,128,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,fontWeight:500}}>Vision d'ensemble — 24 mois</span>
          <span style={{fontSize:11,color:"#888"}}>Séquençage par module et horizon</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr style={{background:"rgba(128,128,128,0.04)"}}>
                <th style={{padding:"8px 12px",textAlign:"left",borderBottom:"0.5px solid rgba(128,128,128,0.1)",color:"#888",fontWeight:500,fontSize:10,textTransform:"uppercase",letterSpacing:"0.04em",minWidth:180}}>Action</th>
                <th style={{padding:"8px 8px",textAlign:"center",borderBottom:"0.5px solid rgba(128,128,128,0.1)",color:"#888",fontWeight:500,fontSize:10,minWidth:60}}>Module</th>
                {Array.from({length:24},function(_,i){return i+1;}).map(function(m){
                  return<th key={m} style={{padding:"6px 2px",textAlign:"center",borderBottom:"0.5px solid rgba(128,128,128,0.1)",color:"#aaa",fontWeight:400,fontSize:9,minWidth:24}}>M{m}</th>;
                })}
                <th style={{padding:"8px 8px",textAlign:"center",borderBottom:"0.5px solid rgba(128,128,128,0.1)",color:"#888",fontWeight:500,fontSize:10}}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {dossier.actions.map(function(a,i){
                const mc = {Comprendre:{color:C.coral,bg:C.coralLight},Arbitrer:{color:C.purple,bg:C.purpleLight},Agir:{color:C.teal,bg:C.tealLight}}[a.module]||{color:C.gray,bg:C.grayLight};
                const sc = statutCfg[a.statut]||statutCfg["a-lancer"];
                // Parse horizon to get start/end months
                const horizonStr = a.horizon||"";
                const nums = horizonStr.match(/\d+/g)||[];
                const mStart = nums[0]?parseInt(nums[0]):null;
                const mEnd = nums[1]?parseInt(nums[1]):mStart;
                return(
                  <tr key={a.id} style={{borderBottom:i<dossier.actions.length-1?"0.5px solid rgba(128,128,128,0.06)":"none",background:i%2===0?"transparent":"rgba(128,128,128,0.02)"}}>
                    <td style={{padding:"7px 12px",fontSize:11,fontWeight:500}}>{a.action}</td>
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:mc.bg,color:mc.color,fontWeight:500,whiteSpace:"nowrap"}}>{a.module}</span>
                    </td>
                    {Array.from({length:24},function(_,mi){
                      const m=mi+1;
                      const inRange=mStart!==null&&m>=mStart&&m<=(mEnd||mStart);
                      return(
                        <td key={m} style={{padding:"7px 2px",textAlign:"center"}}>
                          {inRange&&<div style={{height:10,borderRadius:2,background:a.statut==="realise"?C.teal:a.statut==="en-cours"?C.blue:a.statut==="a-lancer"?C.amber:C.gray,opacity:0.8,margin:"0 1px"}}/>}
                        </td>
                      );
                    })}
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:sc.bg,color:sc.color,whiteSpace:"nowrap"}}>{sc.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:"8px 16px",display:"flex",gap:16,flexWrap:"wrap",borderTop:"0.5px solid rgba(128,128,128,0.08)"}}>
          {[["Réalisé",C.teal],["En cours",C.blue],["À lancer",C.amber],["Différé",C.gray]].map(function(item){return(
            <span key={item[0]} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#888"}}>
              <span style={{width:16,height:8,borderRadius:2,background:item[1],display:"inline-block",opacity:0.8}}/>
              {item[0]}
            </span>
          );}) }
        </div>
      </div>
      {modules.map(function(mod){const acts=dossier.actions.filter(function(a){return a.module===mod;});const mc=modColors[mod];return(
        <div key={mod} style={{marginBottom:14}}>
          <div onClick={function(){setOpen(function(o){return Object.assign({},o,{[mod]:!o[mod]});});}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:mc.bg,cursor:"pointer",marginBottom:open[mod]?8:0}}>
            <span>{open[mod]?"▾":"▸"}</span><span style={{fontSize:13,fontWeight:500,color:mc.text}}>Module — {mod}</span><span style={{fontSize:11,color:mc.color,marginLeft:"auto"}}>{acts.length} actions</span>
          </div>
          {open[mod]&&(<div style={{border:"0.5px solid rgba(128,128,128,0.15)",borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 1.5fr 0.9fr",gap:0,padding:"6px 12px",borderBottom:"0.5px solid rgba(128,128,128,0.1)",fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:"0.04em"}}>
              <span>Action</span><span>Responsable</span><span>Horizon</span><span>Livrable</span><span>Statut</span>
            </div>
            {acts.map(function(a,i){return(
              <div key={a.id} style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 1.5fr 0.9fr",gap:0,padding:"9px 12px",borderBottom:i<acts.length-1?"0.5px solid rgba(128,128,128,0.08)":"none",alignItems:"start",background:i%2===0?"transparent":"rgba(128,128,128,0.02)"}}>
                <span style={{fontSize:12,fontWeight:500}}>{a.action}</span>
                <input value={a.resp} onChange={function(e){updateAction(a.id,"resp",e.target.value);}} placeholder="Responsable…" style={{fontSize:11,border:"none",background:"transparent",color:"#888",outline:"none",width:"100%",padding:0}}/>
                <span style={{fontSize:11,padding:"2px 6px",borderRadius:4,background:"rgba(128,128,128,0.08)",color:"#888",display:"inline-block",whiteSpace:"nowrap"}}>{a.horizon}</span>
                <span style={{fontSize:11,color:"#888",paddingRight:8}}>{a.livrable}</span>
                <select value={a.statut} onChange={function(e){updateAction(a.id,"statut",e.target.value);}} style={{fontSize:11,padding:"2px 4px",border:"0.5px solid rgba(128,128,128,0.2)",borderRadius:6,background:"transparent",color:"inherit",width:"100%"}}>
                  {Object.entries(statutCfg).map(function(e){return<option key={e[0]} value={e[0]}>{e[1].label}</option>;})}
                </select>
              </div>
            );})}
          </div>)}
        </div>
      );})}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PAGE ACCUEIL
// ══════════════════════════════════════════════════════════
function PageAccueil({ dossiers, onSelect, onCreate, onDelete, onRename }) {
  const bailleurs=dossiers.filter(function(d){return d.type==="bailleur";});
  const [renaming,setRenaming]=useState(null);
  const [renameVal,setRenameVal]=useState("");
  return(
    <div style={{padding:32,maxWidth:900}}>
      <div style={{marginBottom:28}}><div style={{fontSize:20,fontWeight:500,color:C.coral,marginBottom:4}}>Agenda 21 de la longévité</div><div style={{fontSize:13,color:"#888"}}>Sélectionnez un dossier ou créez un nouvel accompagnement.</div></div>
      {bailleurs.length===0&&(<div style={{padding:40,borderRadius:16,border:"0.5px dashed rgba(128,128,128,0.3)",textAlign:"center",color:"#888",marginBottom:24}}><div style={{fontSize:32,marginBottom:12}}>📁</div><div style={{fontSize:13,marginBottom:16}}>Aucun dossier pour l'instant.</div><button onClick={function(){onCreate("bailleur",null);}} style={{padding:"10px 22px",borderRadius:20,border:"none",background:C.coral,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}}>+ Créer un premier bailleur</button></div>)}
      {bailleurs.map(function(b){
        const residences=dossiers.filter(function(d){return d.parentId===b.id;});
        const bScores=computeScores(b.kpiValues,b.actions);
        return(
          <div key={b.id} style={{marginBottom:24,border:"0.5px solid rgba(128,128,128,0.15)",borderRadius:16,overflow:"hidden"}}>
            <div style={{background:`${C.coral}0C`,padding:"16px 20px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:20}}>🏢</div>
              <div style={{flex:1}}>
                {renaming===b.id?(<div style={{display:"flex",gap:8,alignItems:"center"}}><input value={renameVal} onChange={function(e){setRenameVal(e.target.value);}} autoFocus style={{fontSize:14,fontWeight:500,border:"0.5px solid rgba(128,128,128,0.3)",borderRadius:6,padding:"4px 8px",background:"transparent",color:"inherit",width:240}}/><button onClick={function(){onRename(b.id,renameVal);setRenaming(null);}} style={{padding:"4px 12px",borderRadius:8,border:"none",background:C.coral,color:"#fff",fontSize:12,cursor:"pointer"}}>OK</button><button onClick={function(){setRenaming(null);}} style={{padding:"4px 10px",borderRadius:8,border:"0.5px solid rgba(128,128,128,0.3)",background:"transparent",color:"#888",fontSize:12,cursor:"pointer"}}>Annuler</button></div>)
                :(<div style={{display:"flex",alignItems:"center",gap:10}}><div style={{fontSize:15,fontWeight:500}}>{b.nom}</div><button onClick={function(){setRenaming(b.id);setRenameVal(b.nom);}} style={{fontSize:10,color:"#aaa",background:"transparent",border:"none",cursor:"pointer"}}>✏️</button></div>)}
                <div style={{fontSize:11,color:"#888",marginTop:2}}>{b.adresse?`📍 ${b.adresse.city} · ${b.adresse.departement}`:b.territoire||"Bailleur social"} · {b.totalLogements?b.totalLogements+" logements":""}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{textAlign:"center"}}><CircularGauge score={bScores.s6.score} size={52}/><div style={{fontSize:9,color:"#aaa",marginTop:2}}>Maturité</div></div>
                <button onClick={function(){onSelect(b.id);}} style={{padding:"8px 18px",borderRadius:20,border:"none",background:C.coral,color:"#fff",fontSize:12,fontWeight:500,cursor:"pointer"}}>Ouvrir</button>
                <button onClick={function(){if(window.confirm("Supprimer ce bailleur ?")) onDelete(b.id);}} style={{padding:"6px 10px",borderRadius:8,border:`0.5px solid ${C.coral}40`,background:"transparent",color:C.coral,fontSize:11,cursor:"pointer"}}>🗑</button>
              </div>
            </div>
            <div style={{padding:"12px 20px 16px"}}>
              <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:10}}>Résidences ({residences.length})</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
                {residences.map(function(res){
                  const rScores=computeScores(res.kpiValues,res.actions);
                  return(
                    <div key={res.id} style={{border:"0.5px solid rgba(128,128,128,0.15)",borderRadius:12,padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8}}>
                        <span style={{fontSize:16}}>🏠</span>
                        <div style={{flex:1}}>
                          {renaming===res.id?(<div style={{display:"flex",gap:6}}><input value={renameVal} onChange={function(e){setRenameVal(e.target.value);}} autoFocus style={{fontSize:12,border:"0.5px solid rgba(128,128,128,0.3)",borderRadius:4,padding:"3px 6px",background:"transparent",color:"inherit",width:"100%"}}/><button onClick={function(){onRename(res.id,renameVal);setRenaming(null);}} style={{padding:"2px 8px",borderRadius:6,border:"none",background:C.teal,color:"#fff",fontSize:11,cursor:"pointer"}}>OK</button></div>)
                          :(<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{fontSize:12,fontWeight:500}}>{res.nom}</div><button onClick={function(){setRenaming(res.id);setRenameVal(res.nom);}} style={{fontSize:9,color:"#ccc",background:"transparent",border:"none",cursor:"pointer"}}>✏️</button></div>)}
                          <div style={{fontSize:10,color:"#aaa"}}>{res.adresse?`📍 ${res.adresse.city}`:""} {res.totalLogements?res.totalLogements+"  lgts":""}</div>
                        </div>
                        <CircularGauge score={rScores.s1.score} size={40}/>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                        {["s1","s3","s5"].map(function(k){const s=rScores[k];return<span key={k} style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:`${s.color}15`,color:s.color}}>{s.icon} {s.score===null?"—":s.score}</span>;})}
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={function(){onSelect(res.id);}} style={{flex:1,padding:"6px 0",borderRadius:8,border:"none",background:C.teal,color:"#fff",fontSize:11,fontWeight:500,cursor:"pointer"}}>Ouvrir</button>
                        <button onClick={function(){if(window.confirm("Supprimer ?")) onDelete(res.id);}} style={{padding:"6px 10px",borderRadius:8,border:"0.5px solid rgba(128,128,128,0.2)",background:"transparent",color:"#888",fontSize:11,cursor:"pointer"}}>🗑</button>
                      </div>
                    </div>
                  );
                })}
                <div onClick={function(){onCreate("residence",b.id);}} style={{border:"0.5px dashed rgba(128,128,128,0.25)",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#aaa",fontSize:12,gap:8}}
                  onMouseEnter={function(e){e.currentTarget.style.borderColor=C.teal;e.currentTarget.style.color=C.teal;}}
                  onMouseLeave={function(e){e.currentTarget.style.borderColor="rgba(128,128,128,0.25)";e.currentTarget.style.color="#aaa";}}>
                  <span style={{fontSize:18}}>+</span> Ajouter une résidence
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {bailleurs.length>0&&<button onClick={function(){onCreate("bailleur",null);}} style={{marginTop:8,padding:"9px 20px",borderRadius:20,border:`0.5px solid ${C.coral}`,background:"transparent",color:C.coral,fontSize:12,fontWeight:500,cursor:"pointer"}}>+ Ajouter un bailleur</button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// VIEW: GRILLE ARBITRAGE
// ══════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// VIEW: CARTOGRAPHIE DES EXPOSITIONS
// ══════════════════════════════════════════════════════════
function ViewCartographie({ dossier }) {
  const scores = computeScores(dossier.kpiValues, dossier.actions);
  const vals = dossier.kpiValues || {};
  const [selected, setSelected] = useState(null);

  const dimensions = [
    { id:"data", label:"Données & Agrégation", icon:"🗄", color:C.purple,
      score:scores.s1.score, desc:"Disponibilité, qualité et exploitation des données locataires et patrimoniales",
      indicateurs:[{nom:"Complétude données seniors",val:vals["rh8"],bon:"≥70%"},{nom:"Part 75+ identifiés",val:vals["v2"],bon:"Connu"},{nom:"Seniors en étage sans ascenseur",val:vals["a3"],bon:"Connu"}],
      dependances:["Support RH","Contraintes techniques"], risques:"Données manquantes → mauvaise priorisation", leviers:"Mise à jour annuelle des fichiers locataires, croisement données patrimoine" },
    { id:"rh", label:"Support RH & Compétences", icon:"👥", color:C.coral,
      score:scores.s6.score, desc:"Capacité des équipes à porter et exécuter la stratégie seniors",
      indicateurs:[{nom:"Taux formation gardiens",val:vals["rh1"],bon:"≥70%"},{nom:"Référents seniors",val:vals["rh4"],bon:"≥3"},{nom:"Directions impliquées",val:vals["rh10"],bon:"≥4"}],
      dependances:["Données & Agrégation","Partenariats stratégiques"], risques:"Portage insuffisant → empilement d'actions sans cohérence", leviers:"Plan de formation, désignation de référents, CODIR dédié" },
    { id:"fournisseurs", label:"Liens Fournisseurs", icon:"🔨", color:C.amber,
      score:scores.s4.score, desc:"Qualité et réactivité des prestataires d'adaptation et de rénovation",
      indicateurs:[{nom:"Coût moyen adaptation",val:vals["ad6"],bon:"<5 000€"},{nom:"Délai total adaptation",val:vals["ad4"],bon:"<90j"},{nom:"Financements mobilisés",val:vals["ad9"],bon:">30%"}],
      dependances:["Contraintes techniques","Finances & Budget"], risques:"Marché tendu, délais longs → frustration locataires", leviers:"Marchés cadres, groupements de commandes, panel prestataires qualifiés" },
    { id:"partenariats", label:"Partenariats Stratégiques", icon:"🤝", color:C.teal,
      score:scores.s2.score, desc:"Écosystème partenarial médico-social, territorial et institutionnel",
      indicateurs:[{nom:"Partenaires actifs",val:vals["pt1"],bon:"≥5"},{nom:"Résidences couvertes",val:vals["pt2"],bon:"≥60%"},{nom:"Conventions actives",val:vals["pt3"],bon:"≥3"}],
      dependances:["Support RH","Capacité de mise en œuvre"], risques:"Absence de relais → situations non détectées, actions en silo", leviers:"Conventionnement CCAS/CLIC, réseau de proximité, co-portage actions" },
    { id:"technique", label:"Contraintes Techniques", icon:"⚙", color:C.gray,
      score:scores.s3.score, desc:"État du parc bâti, accessibilité et contraintes de rénovation",
      indicateurs:[{nom:"Seniors DPE E/F/G",val:vals["te1"],bon:"<20%"},{nom:"Pannes ascenseur",val:vals["a14"],bon:"<5%"},{nom:"Ancienneté bâtiments",val:vals["a16"],bon:"Connu"}],
      dependances:["Données & Agrégation","Liens Fournisseurs"], risques:"Parc inadapté → inadéquation offre/besoin, coûts élevés", leviers:"PSP avec double objectif, diagnostic accessibilité systématique" },
    { id:"execution", label:"Capacité de Mise en Œuvre", icon:"🚀", color:C.blue,
      score:scores.s6.score, desc:"Capacité organisationnelle et budgétaire à exécuter la feuille de route",
      indicateurs:[{nom:"Décisions dans les délais",val:vals["rh6"],bon:"≥80%"},{nom:"Actions en retard",val:vals["rh7"],bon:"<20%"},{nom:"Exécution budgétaire",val:vals["fi8"],bon:"≥80%"}],
      dependances:["Support RH","Partenariats Stratégiques","Liens Fournisseurs"], risques:"Gouvernance insuffisante → retards en cascade", leviers:"Tableau de bord trimestriel, responsable projet dédié, rituels d'exécution" },
  ];

  const size=280, n=dimensions.length, cx=size/2, cy=size/2, r=size*0.34;
  const angle=function(i){return(2*Math.PI*i/n)-Math.PI/2;};
  const pt=function(i,lv){return[cx+Math.cos(angle(i))*r*lv,cy+Math.sin(angle(i))*r*lv];};
  const dataPath=dimensions.map(function(d,i){const lv=d.score===null?0:d.score/100;const p=pt(i,lv);return(i===0?"M":"L")+p[0].toFixed(1)+","+p[1].toFixed(1);}).join(" ")+"Z";
  const gridPts=function(lv){return dimensions.map(function(_,i){return pt(i,lv).join(",");}).join(" ");};

  return (
    <div>
      <h2 style={{fontSize:16,fontWeight:500,marginBottom:4}}>Cartographie des expositions et dépendances</h2>
      <p style={{fontSize:12,color:"#888",marginBottom:16}}>{dossier.nom} · 6 dimensions analysées depuis les KPIs</p>
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:20,marginBottom:20,alignItems:"start"}}>
        <div style={{padding:12,borderRadius:12,border:"0.5px solid rgba(128,128,128,0.15)"}}>
          <div style={{fontSize:11,color:"#888",marginBottom:6,textAlign:"center"}}>Vue globale des 6 dimensions</div>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {[0.25,0.5,0.75,1].map(function(l){return<polygon key={l} points={gridPts(l)} fill="none" stroke="rgba(128,128,128,0.12)" strokeWidth="0.8"/>;}) }
            {dimensions.map(function(_,i){const p=pt(i,1);return<line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="rgba(128,128,128,0.1)" strokeWidth="0.8"/>;}) }
            <path d={dataPath} fill={`${C.teal}22`} stroke={C.teal} strokeWidth="2"/>
            {dimensions.map(function(d,i){const lv=d.score===null?0:d.score/100;const p=pt(i,lv);return<circle key={i} cx={p[0]} cy={p[1]} r="5" fill={d.color} stroke="white" strokeWidth="1.5" style={{cursor:"pointer"}} onClick={function(){setSelected(selected===d.id?null:d.id);}}/>;}) }
            {dimensions.map(function(d,i){const lp=pt(i,1.28);return<text key={i} x={lp[0]} y={lp[1]} textAnchor="middle" fontSize="9" fill="#888" dominantBaseline="middle">{d.icon} {d.label.split(" ")[0]}</text>;}) }
          </svg>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {dimensions.map(function(d){const lc=levelColor(d.score);const isSel=selected===d.id;return(
            <div key={d.id} onClick={function(){setSelected(isSel?null:d.id);}} style={{padding:12,borderRadius:10,border:`0.5px solid ${isSel?d.color:"rgba(128,128,128,0.15)"}`,background:isSel?`${d.color}0D`:"rgba(128,128,128,0.02)",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:16}}>{d.icon}</span>
                <div style={{fontSize:11,fontWeight:500,color:d.color,lineHeight:1.3}}>{d.label}</div>
                <div style={{marginLeft:"auto",fontSize:13,fontWeight:500,color:lc}}>{d.score===null?"—":d.score}</div>
              </div>
              <div style={{height:4,borderRadius:2,background:"rgba(128,128,128,0.12)",overflow:"hidden",marginBottom:4}}>
                <div style={{width:d.score===null?"0%":`${d.score}%`,height:"100%",background:lc}}/>
              </div>
              <div style={{fontSize:10,color:"#aaa"}}>{d.desc.slice(0,60)}…</div>
            </div>
          );}) }
        </div>
      </div>
      {selected && (function(){
        const d = dimensions.find(function(x){return x.id===selected;});
        if (!d) return null;
        return (
          <div style={{border:`0.5px solid ${d.color}40`,borderRadius:12,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"12px 16px",background:`${d.color}0D`,borderBottom:`0.5px solid ${d.color}20`,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>{d.icon}</span>
              <div><div style={{fontSize:13,fontWeight:500,color:d.color}}>{d.label}</div><div style={{fontSize:11,color:"#888"}}>{d.desc}</div></div>
              <CircularGauge score={d.score} size={52}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:0}}>
              {[
                {title:"Indicateurs clés",color:d.color,content:<div>{d.indicateurs.map(function(ind,i){const hasVal=ind.val!==null&&ind.val!==undefined&&ind.val!=="";return(<div key={i} style={{marginBottom:8}}><div style={{fontSize:11,fontWeight:500,marginBottom:2}}>{ind.nom}</div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:14,fontWeight:500,color:hasVal?d.color:"#ccc"}}>{hasVal?ind.val:"—"}</div>{ind.bon&&<div style={{fontSize:10,color:"#aaa"}}>Cible: {ind.bon}</div>}</div></div>);})}</div>},
                {title:"Dépendances",color:C.amber,content:<div>{d.dependances.map(function(dep,i){return<div key={i} style={{fontSize:11,padding:"4px 8px",borderRadius:6,background:"rgba(186,117,23,0.1)",color:C.amber,marginBottom:4}}>↔ {dep}</div>;})}</div>},
                {title:"Risques",color:C.red,content:<div style={{fontSize:11,color:"#888",lineHeight:1.6}}>{d.risques}</div>},
                {title:"Leviers d'action",color:C.teal,content:<div style={{fontSize:11,color:"#888",lineHeight:1.6}}>{d.leviers}</div>},
              ].map(function(section,i){return(
                <div key={i} style={{padding:"12px 14px",borderRight:i<3?"0.5px solid rgba(128,128,128,0.08)":"none"}}>
                  <div style={{fontSize:11,fontWeight:500,color:section.color,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>{section.title}</div>
                  {section.content}
                </div>
              );}) }
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// VIEW: MATRICE RISQUES / OPPORTUNITÉS
// ══════════════════════════════════════════════════════════
function ViewMatrice({ dossier }) {
  const scores = computeScores(dossier.kpiValues, dossier.actions);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);

  const enjeux = [
    {id:"e1",label:"Vieillissement accéléré",nature:"risque",probabilite:scores.s1.score!==null?Math.min(100,scores.s1.score+10):50,impact:scores.s1.score||60,color:C.red,icon:"👴",kpis:["v2","v3","v5"],desc:"Explosion du nombre de 75+ et 85+, rotation bloquée",action:"Cartographie prioritaire, protocole mutations, détection fragilités"},
    {id:"e2",label:"Inadaptation du bâti",nature:"risque",probabilite:scores.s3.score!==null?Math.min(100,scores.s3.score+5):55,impact:scores.s4.score||65,color:C.amber,icon:"🏚",kpis:["a3","a9","a11","a14"],desc:"Logements non adaptés aux besoins des seniors en perte d'autonomie",action:"Plan pluriannuel adaptation, priorisation par résidence"},
    {id:"e3",label:"Opportunité adaptation",nature:"opportunite",probabilite:scores.s2.score||45,impact:scores.s2.score||55,color:C.teal,icon:"🔧",kpis:["ad7","ad9","fi4"],desc:"Potentiel de gains rapides via adaptations légères et financements",action:"Mobiliser MaPrimeAdapt', programme quick wins"},
    {id:"e4",label:"Rotation bloquée",nature:"risque",probabilite:scores.s1.score!==null?Math.min(100,Math.round(scores.s1.score*0.8)):50,impact:75,color:C.red,icon:"🔒",kpis:["pr4","pr6","pr9"],desc:"Les seniors ne quittent plus leur logement, réduisant la fluidité du parc",action:"Simplification mutations, offre logements adaptés"},
    {id:"e5",label:"Vulnérabilité écologique",nature:"risque",probabilite:scores.s3.score||45,impact:scores.s3.score!==null?Math.round(scores.s3.score*0.9):50,color:C.amber,icon:"🌡",kpis:["te1","te3","te4","te5"],desc:"Seniors exposés à la précarité énergétique et au changement climatique",action:"Prioriser rénovation thermique, plans canicule"},
    {id:"e6",label:"Synergie rénovation-adaptation",nature:"opportunite",probabilite:scores.s4.score||40,impact:scores.s4.score!==null?Math.round(scores.s4.score*1.1):55,color:C.teal,icon:"⚡",kpis:["te7","te8","ad6"],desc:"Intégration des adaptations dans les programmes de rénovation",action:"Double objectif dans PSP, marchés combinés"},
    {id:"e7",label:"Fracture numérique",nature:"risque",probabilite:scores.s5.score||55,impact:scores.s5.score!==null?Math.round(scores.s5.score*0.85):45,color:C.blue,icon:"💻",kpis:["nd1","nd2","nd3"],desc:"Non-recours aux services numériques, exclusion des démarches",action:"Médiation numérique, canaux alternatifs"},
    {id:"e8",label:"Fragilités non repérées",nature:"risque",probabilite:scores.s1.score!==null?Math.round(scores.s1.score*0.7):45,impact:70,color:C.coral,icon:"🔍",kpis:["rf1","rf4","rf5"],desc:"Situations de fragilité non détectées, isolement non repéré",action:"Protocole aller-vers, formation gardiens, réseau de signalement"},
    {id:"e9",label:"Partenariats territoriaux",nature:"opportunite",probabilite:scores.s2.score!==null?Math.round(scores.s2.score*0.9):40,impact:scores.s2.score!==null?Math.round(scores.s2.score*0.8):50,color:C.teal,icon:"🤝",kpis:["pt1","pt2","pt3"],desc:"Potentiel de co-construction avec acteurs médico-sociaux",action:"Conventionnement CCAS/CLIC, réseau partenarial structuré"},
    {id:"e10",label:"Contrainte budgétaire",nature:"risque",probabilite:70,impact:scores.s6.score!==null?Math.round((100-scores.s6.score)*0.8):55,color:C.amber,icon:"💰",kpis:["fi1","fi6","fi8"],desc:"Ressources insuffisantes pour financer l'ensemble des besoins",action:"Priorisation, mobilisation financements externes"},
    {id:"e11",label:"Maturité organisationnelle",nature:"opportunite",probabilite:scores.s6.score||35,impact:scores.s6.score!==null?Math.round(scores.s6.score*0.9):45,color:C.purple,icon:"🎯",kpis:["rh1","rh4","rh6"],desc:"Capacité croissante à piloter et exécuter la stratégie seniors",action:"Plan formation, gouvernance dédiée, tableau de bord trimestriel"},
  ];

  const W=520, H=380, PAD=48;
  const toX=function(p){return PAD+(p/100)*(W-PAD*2);};
  const toY=function(p){return H-PAD-(p/100)*(H-PAD*2);};

  return (
    <div>
      <h2 style={{fontSize:16,fontWeight:500,marginBottom:4}}>Matrice risques / opportunités</h2>
      <p style={{fontSize:12,color:"#888",marginBottom:16}}>{dossier.nom} · 11 enjeux alignés sur les KPIs</p>
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:20,marginBottom:20,alignItems:"start"}}>
        <div style={{position:"relative"}}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{border:"0.5px solid rgba(128,128,128,0.15)",borderRadius:12,background:"rgba(128,128,128,0.02)"}}>
            <rect x={PAD} y={PAD} width={(W-PAD*2)/2} height={(H-PAD*2)/2} fill="rgba(250,238,218,0.4)" rx="2"/>
            <rect x={PAD+(W-PAD*2)/2} y={PAD} width={(W-PAD*2)/2} height={(H-PAD*2)/2} fill="rgba(252,235,235,0.5)" rx="2"/>
            <rect x={PAD} y={PAD+(H-PAD*2)/2} width={(W-PAD*2)/2} height={(H-PAD*2)/2} fill="rgba(241,239,232,0.4)" rx="2"/>
            <rect x={PAD+(W-PAD*2)/2} y={PAD+(H-PAD*2)/2} width={(W-PAD*2)/2} height={(H-PAD*2)/2} fill="rgba(225,245,238,0.5)" rx="2"/>
            <text x={PAD+10} y={PAD+14} fontSize="9" fill="rgba(186,117,23,0.5)" fontWeight="500">Risques à anticiper</text>
            <text x={PAD+(W-PAD*2)/2+8} y={PAD+14} fontSize="9" fill="rgba(226,75,74,0.5)" fontWeight="500">Zone critique</text>
            <text x={PAD+10} y={H-PAD-6} fontSize="9" fill="rgba(136,135,128,0.5)" fontWeight="500">Surveillance</text>
            <text x={PAD+(W-PAD*2)/2+8} y={H-PAD-6} fontSize="9" fill="rgba(29,158,117,0.5)" fontWeight="500">Opportunités</text>
            <line x1={PAD} y1={H-PAD} x2={W-PAD+8} y2={H-PAD} stroke="rgba(128,128,128,0.3)" strokeWidth="1"/>
            <line x1={PAD} y1={H-PAD} x2={PAD} y2={PAD-8} stroke="rgba(128,128,128,0.3)" strokeWidth="1"/>
            <text x={W/2} y={H-6} textAnchor="middle" fontSize="9" fill="#888">Probabilité →</text>
            <text x={10} y={H/2} textAnchor="middle" fontSize="9" fill="#888" transform={`rotate(-90,10,${H/2})`}>Impact →</text>
            {enjeux.map(function(e){
              const x=toX(e.probabilite),y=toY(e.impact);
              const isSel=selected===e.id;
              return(
                <g key={e.id} onClick={function(){setSelected(isSel?null:e.id);}} style={{cursor:"pointer"}}
                  onMouseEnter={function(ev){setHovered({e:e,x:ev.clientX,y:ev.clientY});}}
                  onMouseLeave={function(){setHovered(null);}}>
                  {e.nature==="risque"
                    ?<polygon points={`${x},${y-8} ${x+8},${y+6} ${x-8},${y+6}`} fill={e.color} opacity={isSel?1:0.82} stroke={isSel?"white":"none"} strokeWidth="2"/>
                    :<circle cx={x} cy={y} r="8" fill={e.color} opacity={isSel?1:0.82} stroke={isSel?"white":"none"} strokeWidth="2"/>
                  }
                  <text x={x} y={y+20} textAnchor="middle" fontSize="8" fill="#888">{e.icon}</text>
                </g>
              );
            })}
          </svg>
          {hovered&&<div style={{position:"fixed",left:hovered.x+12,top:hovered.y-10,background:"white",border:"0.5px solid rgba(128,128,128,0.3)",borderRadius:8,padding:"8px 12px",fontSize:11,zIndex:1000,pointerEvents:"none",maxWidth:180,boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}><div style={{fontWeight:500,color:hovered.e.color}}>{hovered.e.icon} {hovered.e.label}</div><div style={{color:"#888",fontSize:10,marginTop:2}}>{hovered.e.nature==="risque"?"▲ Risque":"● Opportunité"}</div></div>}
          <div style={{display:"flex",gap:14,marginTop:8,fontSize:11,color:"#888"}}><span>▲ Risque</span><span>● Opportunité</span></div>
        </div>
        <div style={{maxHeight:400,overflowY:"auto"}}>
          {enjeux.map(function(e){const isSel=selected===e.id;return(
            <div key={e.id} onClick={function(){setSelected(isSel?null:e.id);}} style={{padding:"10px 12px",borderRadius:10,border:`0.5px solid ${isSel?e.color:"rgba(128,128,128,0.12)"}`,marginBottom:6,cursor:"pointer",background:isSel?`${e.color}08`:"transparent"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:isSel?8:0}}>
                <span style={{fontSize:14}}>{e.icon}</span>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:500}}>{e.label}</div><div style={{fontSize:10,color:"#aaa"}}>{e.nature==="risque"?"▲ Risque":"● Opportunité"}</div></div>
                <div style={{fontSize:10,color:"#aaa"}}>P:{Math.round(e.probabilite)} I:{Math.round(e.impact)}</div>
              </div>
              {isSel&&<div style={{borderTop:"0.5px solid rgba(128,128,128,0.1)",paddingTop:8}}>
                <div style={{fontSize:11,color:"#888",marginBottom:6}}>{e.desc}</div>
                <div style={{fontSize:11,padding:"6px 10px",borderRadius:6,background:`${e.color}12`,color:e.color}}><span style={{fontWeight:500}}>Action : </span>{e.action}</div>
                <div style={{fontSize:10,color:"#aaa",marginTop:4}}>KPIs : {e.kpis.join(", ")}</div>
              </div>}
            </div>
          );}) }
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════
const VIEWS = [
  {id:"accueil",       label:"Accueil",             icon:"🏡"},
  {id:"config",        label:"Configuration",       icon:"⚙"},
  {id:"dashboard",     label:"Tableau de bord",     icon:"🎯"},
  {id:"analyse",       label:"Analyse & Reco. IA",  icon:"✨"},
  {id:"cartographie",  label:"Cartographie",        icon:"🗺"},
  {id:"matrice",       label:"Matrice risques",     icon:"◎"},
  {id:"arbitrage",     label:"Grille d'arbitrage",  icon:"⚖"},
  {id:"fdr",           label:"Feuille de route",    icon:"📋"},
];

export default function App() {
  const [dossiers,setDossiers]=useState([]);
  const [activeDossierId,setActiveDossierId]=useState(null);
  const [view,setView]=useState("accueil");
  const [loaded,setLoaded]=useState(false);

  useEffect(function(){
    loadData("agenda21_v6").then(function(d){
      if(d&&Array.isArray(d))setDossiers(d);
      setLoaded(true);
    });
  },[]);

  const persist=useCallback(async function(list){await saveData("agenda21_v6",list);},[]);
  const activeDossier=dossiers.find(function(d){return d.id===activeDossierId;})||null;
  const parentBailleur=activeDossier&&activeDossier.type==="residence"?dossiers.find(function(d){return d.id===activeDossier.parentId;})||null:null;

  function updateDossier(updated){const next=dossiers.map(function(d){return d.id===updated.id?updated:d;});setDossiers(next);persist(next);}
  function createDossier(type,parentId){const d=newDossier(type==="bailleur"?"Nouveau bailleur":"Nouvelle résidence",type,parentId);const next=[...dossiers,d];setDossiers(next);persist(next);setActiveDossierId(d.id);setView("config");}
  function deleteDossier(id){const next=dossiers.filter(function(d){return d.id!==id&&d.parentId!==id;});setDossiers(next);persist(next);if(activeDossierId===id){setActiveDossierId(null);setView("accueil");}}
  function renameDossier(id,nom){const next=dossiers.map(function(d){return d.id===id?Object.assign({},d,{nom:nom}):d;});setDossiers(next);persist(next);}
  function selectDossier(id){setActiveDossierId(id);setView("dashboard");}

  if(!loaded)return<div style={{padding:40,color:"#888",fontSize:13}}>Chargement…</div>;

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"inherit"}}>
      <div style={{width:220,flexShrink:0,borderRight:"0.5px solid rgba(128,128,128,0.15)",padding:"20px 0",background:"rgba(128,128,128,0.03)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"0 16px 16px",borderBottom:"0.5px solid rgba(128,128,128,0.1)"}}>
          <div style={{fontSize:13,fontWeight:500,color:C.coral,lineHeight:1.2}}>Agenda 21</div>
          <div style={{fontSize:11,color:"#888",marginBottom:10}}>de la longévité</div>
          {dossiers.length>0&&(<select value={activeDossierId||""} onChange={function(e){const id=e.target.value;if(id==="__accueil"){setActiveDossierId(null);setView("accueil");}else{setActiveDossierId(id);setView("dashboard");}}} style={{width:"100%",fontSize:11,padding:"5px 8px",border:"0.5px solid rgba(128,128,128,0.3)",borderRadius:8,background:"transparent",color:"inherit",cursor:"pointer"}}>
            <option value="__accueil">— Accueil —</option>
            {dossiers.filter(function(d){return d.type==="bailleur";}).map(function(b){const res=dossiers.filter(function(d){return d.parentId===b.id;});return[<option key={b.id} value={b.id}>🏢 {b.nom}</option>,...res.map(function(r){return<option key={r.id} value={r.id}>&nbsp;&nbsp;🏠 {r.nom}</option>;})];})}
          </select>)}
        </div>
        <div style={{padding:"12px 8px",flex:1}}>
          {VIEWS.map(function(v){const disabled=v.id!=="accueil"&&!activeDossier;return(
            <button key={v.id} onClick={function(){if(!disabled)setView(v.id);}} disabled={disabled} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 12px",borderRadius:8,border:"none",textAlign:"left",cursor:disabled?"default":"pointer",fontSize:12,fontWeight:view===v.id?500:400,background:view===v.id?`${C.coral}18`:"transparent",color:view===v.id?C.coral:disabled?"#ccc":"inherit"}}>
              <span style={{fontSize:14}}>{v.icon}</span>{v.label}
            </button>
          );})}
        </div>
        {activeDossier&&(<div style={{padding:"12px 16px",borderTop:"0.5px solid rgba(128,128,128,0.1)"}}>
          <div style={{fontSize:10,color:"#aaa",marginBottom:4}}>{activeDossier.type==="bailleur"?"BAILLEUR":"RÉSIDENCE"}</div>
          <div style={{fontSize:12,fontWeight:500,color:C.coral,marginBottom:2}}>{activeDossier.nom}</div>
          {parentBailleur&&<div style={{fontSize:10,color:"#888"}}>↳ {parentBailleur.nom}</div>}
          {activeDossier.adresse&&<div style={{fontSize:10,color:C.teal,marginTop:2}}>📍 {activeDossier.adresse.city}</div>}
          <button onClick={function(){setActiveDossierId(null);setView("accueil");}} style={{marginTop:8,fontSize:11,color:"#aaa",background:"transparent",border:"none",cursor:"pointer",padding:0}}>← Retour accueil</button>
        </div>)}
      </div>
      <div style={{flex:1,padding:28,overflowY:"auto",maxWidth:980}}>
        {view==="accueil"&&<PageAccueil dossiers={dossiers} onSelect={selectDossier} onCreate={createDossier} onDelete={deleteDossier} onRename={renameDossier}/>}
        {view==="config"&&activeDossier&&<ViewConfig dossier={activeDossier} onSave={function(u){updateDossier(u);setView("dashboard");}}/>}
        {view==="dashboard"&&activeDossier&&<ViewDashboard dossier={activeDossier}/>}
        {view==="analyse"&&activeDossier&&<ViewAnalyse dossier={activeDossier}/>}
        {view==="cartographie"&&activeDossier&&<ViewCartographie dossier={activeDossier}/>}
        {view==="matrice"&&activeDossier&&<ViewMatrice dossier={activeDossier}/>}
        {view==="arbitrage"&&activeDossier&&<ViewArbitrage dossier={activeDossier} onSave={updateDossier}/>}
        {view==="fdr"&&activeDossier&&<ViewFeuilleDeRoute dossier={activeDossier} onSave={updateDossier}/>}
      </div>
    </div>
  );
}

function ViewArbitrage({ dossier, onSave }) {
  const scores=computeScores(dossier.kpiValues,dossier.actions);
  const kpiScores=computeChantierScores(scores);
  const [filter,setFilter]=useState("all");
  const [expanded,setExpanded]=useState(null);
  const chantiers=dossier.chantiers;
  const update=function(id,key,val){const next=chantiers.map(function(c){return c.id===id?Object.assign({},c,{[key]:val}):c;});onSave(Object.assign({},dossier,{chantiers:next}));};
  const filtered=filter==="all"?chantiers:chantiers.filter(function(c){return c.decision===filter;});
  const counts=["prioritaire","court","moyen","renonce"].reduce(function(a,k){return Object.assign(a,{[k]:chantiers.filter(function(c){return c.decision===k;}).length});},{});
  const hasKpis=scores.s1.score!==null||scores.s2.score!==null;
  return(
    <div>
      <h2 style={{fontSize:16,fontWeight:500,marginBottom:4}}>Grille d'arbitrage — {dossier.nom}</h2>
      <p style={{fontSize:12,color:"#888",marginBottom:12}}>Jauges calculées depuis vos KPIs · Benchmark national intégré</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        {[{label:"Urgence",desc:"S1 Vulnérabilité + S3 Écologique",val:kpiScores.urgence,color:C.red},{label:"Impact",desc:"S2 Opportunité + S4 Rénovation",val:kpiScores.impact,color:C.teal},{label:"Faisabilité",desc:"S6 Maturité Agenda 21",val:kpiScores.faisabilite,color:C.purple}].map(function(m){return(
          <div key={m.label} style={{padding:"10px 14px",borderRadius:10,border:`0.5px solid ${m.color}40`,background:`${m.color}08`}}>
            <div style={{fontSize:12,fontWeight:500,color:m.color,marginBottom:4}}>{m.label} <span style={{fontSize:10,fontWeight:400,color:"#aaa"}}>↑ KPIs</span></div>
            <div style={{fontSize:10,color:"#888",marginBottom:6}}>{m.desc}</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{flex:1,height:7,borderRadius:4,background:"rgba(128,128,128,0.12)",overflow:"hidden"}}><div style={{width:`${(m.val/5)*100}%`,height:"100%",background:m.val>=4?C.teal:m.val>=3?C.amber:C.red}}/></div>
              <span style={{fontSize:12,fontWeight:500,color:m.val>=4?C.teal:m.val>=3?C.amber:C.red}}>{m.val}/5</span>
            </div>
            {hasKpis&&<div style={{fontSize:9,color:"#aaa",marginTop:2}}>calculé depuis KPIs</div>}
          </div>
        );}) }
      </div>
      <div style={{marginBottom:14}}><AnalyseButton dossier={dossier} context="Analyser la grille d'arbitrage : pour chaque chantier, évaluer la pertinence de la décision au regard des KPIs et du benchmark national, et proposer des ajustements de priorisation." label="Analyser les arbitrages"/></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {[["all","Tous"],["prioritaire","Prioritaire"],["court","Court terme"],["moyen","Moyen terme"],["renonce","Renoncement"]].map(function(item){return<button key={item[0]} onClick={function(){setFilter(item[0]);}} style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:"0.5px solid rgba(128,128,128,0.3)",background:filter===item[0]?"rgba(128,128,128,0.12)":"transparent",color:filter===item[0]?"inherit":"#888",cursor:"pointer"}}>{item[1]}</button>;})}
      </div>
      <div style={{fontSize:11,color:"#888",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 110px 28px",gap:8,padding:"0 12px",marginBottom:6}}>
        <span>Chantier</span><span>Urgence</span><span>Impact</span><span>Faisabilité</span><span>Décision</span><span></span>
      </div>
      {filtered.map(function(c){const isExp=expanded===c.id;return(
        <div key={c.id} style={{borderRadius:10,border:`0.5px solid ${isExp?"rgba(83,74,183,0.4)":"rgba(128,128,128,0.15)"}`,marginBottom:8,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 110px 28px",gap:8,padding:"10px 12px",alignItems:"center",background:isExp?"rgba(83,74,183,0.04)":"transparent"}}>
            <div><div style={{fontSize:12,fontWeight:500}}>{c.label}</div><div style={{fontSize:11,color:"#888"}}>{c.module}</div></div>
            {[{val:kpiScores.urgence,color:C.red},{val:kpiScores.impact,color:C.teal},{val:kpiScores.faisabilite,color:C.purple}].map(function(m,mi){const lc=m.val>=4?C.teal:m.val>=3?C.amber:C.red;return(<div key={mi} style={{display:"flex",alignItems:"center",gap:4}}><div style={{flex:1,height:6,borderRadius:3,background:"rgba(128,128,128,0.12)",overflow:"hidden"}}><div style={{width:`${(m.val/5)*100}%`,height:"100%",background:lc}}/></div><span style={{fontSize:10,color:lc,fontWeight:500}}>{m.val}</span></div>);})}
            <select value={c.decision} onChange={function(e){update(c.id,"decision",e.target.value);}} style={{fontSize:11,padding:"3px 4px",border:"0.5px solid rgba(128,128,128,0.3)",borderRadius:6,background:"transparent",color:"inherit",width:"100%"}}>
              <option value="prioritaire">Prioritaire</option><option value="court">Court terme</option><option value="moyen">Moyen terme</option><option value="renonce">Renoncement</option>
            </select>
            <button onClick={function(){setExpanded(isExp?null:c.id);}} style={{fontSize:14,border:"none",background:"transparent",cursor:"pointer",color:isExp?C.purple:"#aaa",padding:0}}>{isExp?"▲":"▼"}</button>
          </div>
          {isExp&&(<div style={{padding:"12px 16px",borderTop:"0.5px solid rgba(128,128,128,0.1)",background:"rgba(128,128,128,0.02)"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:10}}>
              <div><div style={{fontSize:11,fontWeight:500,color:C.purple,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em"}}>Options</div>{(c.options||[]).map(function(o,i){return<div key={i} style={{fontSize:11,padding:"4px 8px",borderRadius:6,background:"rgba(83,74,183,0.08)",marginBottom:4}}>• {o}</div>;})}</div>
              <div><div style={{fontSize:11,fontWeight:500,color:C.amber,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em"}}>Critères de décision</div><div style={{fontSize:11,color:"#888",lineHeight:1.6}}>{c.criteresDecision}</div></div>
              <div><div style={{fontSize:11,fontWeight:500,color:C.teal,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em"}}>Conditions de réussite</div><div style={{fontSize:11,color:"#888",lineHeight:1.6}}>{c.conditionsReussite}</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><div style={{fontSize:11,fontWeight:500,color:C.gray,marginBottom:4}}>Modifier les options</div><input value={(c.options||[]).join(" | ")} onChange={function(e){update(c.id,"options",e.target.value.split(" | "));}} placeholder="Option 1 | Option 2" style={{width:"100%",fontSize:11,padding:"6px 8px",border:"0.5px solid rgba(128,128,128,0.25)",borderRadius:6,background:"transparent",color:"inherit",boxSizing:"border-box"}}/></div>
              <div><div style={{fontSize:11,fontWeight:500,color:C.gray,marginBottom:4}}>Conditions de réussite</div><input value={c.conditionsReussite||""} onChange={function(e){update(c.id,"conditionsReussite",e.target.value);}} style={{width:"100%",fontSize:11,padding:"6px 8px",border:"0.5px solid rgba(128,128,128,0.25)",borderRadius:6,background:"transparent",color:"inherit",boxSizing:"border-box"}}/></div>
            </div>
          </div>)}
        </div>
      );})}
      <div style={{marginTop:14,padding:"12px 16px",borderRadius:12,background:"rgba(128,128,128,0.06)",display:"flex",gap:20,flexWrap:"wrap"}}>
        {[["prioritaire",C.red],["court",C.amber],["moyen",C.blue],["renonce",C.gray]].map(function(item){return<span key={item[0]} style={{fontSize:12,color:item[1]}}>● {counts[item[0]]} {item[0]}</span>;})}
        <span style={{marginLeft:"auto",fontSize:12,fontWeight:500}}>Couverture : {Math.round(((counts.prioritaire||0)+(counts.court||0)+(counts.moyen||0))/chantiers.length*100)}%</span>
      </div>
    </div>
  );
}