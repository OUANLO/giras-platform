// Fonctions de calcul centralisées pour les scores/criticités.
// Objectif: avoir une seule source de vérité entre "Analyse", "Fermeture" et "Suivi".

export function calculateImpactNet(impactBrut, efficaciteContr) {
  if (impactBrut === null || impactBrut === undefined || `${impactBrut}` === '') return null
  const impact = Number(impactBrut)
  if (Number.isNaN(impact)) return null

  let eff = 0
  if (!(efficaciteContr === null || efficaciteContr === undefined || `${efficaciteContr}` === '')) {
    const e = Number(efficaciteContr)
    eff = Number.isNaN(e) ? 0 : e
  }

  // impact net = impact brut * (1 - efficacite/100)
  const net = impact * (1 - (eff / 100))
  return Math.round(net * 100) / 100
}

export function calculateCriticite(impact, probabilite) {
  if (impact === null || impact === undefined || `${impact}` === '') return null
  if (probabilite === null || probabilite === undefined || `${probabilite}` === '') return null
  const i = Number(impact)
  const p = Number(probabilite)
  if (Number.isNaN(i) || Number.isNaN(p)) return null
  const c = i * p
  return Math.round(c * 100) / 100
}

// Échelle utilisée dans le projet (alignée avec la légende UI P×I):
// - 1–3   : Faible
// - 4–6   : Modéré
// - 8–9   : Significatif
// - 12–16 : Critique
// NB: Les produits possibles avec I∈{1..4} et P∈{1..4} sont:
//     1,2,3,4,6,8,9,12,16 (pas de 5,7,10,11,13,14,15),
//     ce qui explique les “trous” dans la légende.
export function getNiveauCriticite(criticite) {
  if (criticite === null || criticite === undefined || `${criticite}` === '') return null
  const c = Number(criticite)
  if (Number.isNaN(c)) return null

  if (c <= 3) return { label: 'Faible', level: 1 }
  if (c <= 6) return { label: 'Modéré', level: 2 }
  if (c <= 9) return { label: 'Significatif', level: 3 }
  return { label: 'Critique', level: 4 }
}
