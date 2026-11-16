/**
 * Calcule l'index de probabilité (1-4) à partir d'une valeur d'indicateur
 * et des seuils S1/S2/S3.
 *
 * Convention (S1 < S2 < S3) :
 * - Sens défavorable (plus la valeur augmente, plus le risque augmente)
 *   1 si v <= S1, 2 si v <= S2, 3 si v <= S3, 4 sinon
 * - Sens favorable (plus la valeur augmente, plus le risque diminue)
 *   1 si v >= S3, 2 si v >= S2, 3 si v >= S1, 4 sinon
 *
 * Si valeur ou seuils non numériques, renvoie null.
 */

function toNumber(x) {
  if (x === null || x === undefined) return null
  // accepte "10,5" ou "10.5"
  const n = Number(String(x).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function normalizeSens(sens) {
  const s = String(sens || '').toLowerCase().trim()
  // on traite plusieurs libellés possibles
  if (['positif', 'favorable', 'croissant', 'plus', 'hausse', 'ascending', '+'].includes(s)) {
    return 'positif'
  }
  if (['negatif', 'défavorable', 'defavorable', 'decroissant', 'décroissant', 'minus', 'baisse', 'descending', '-'].includes(s)) {
    return 'negatif'
  }
  // valeur par défaut : défavorable (le plus prudent)
  return 'negatif'
}

export function calculateProbabiliteIndex({ valeur, s1, s2, s3, sens }) {
  const v = toNumber(valeur)
  const t1 = toNumber(s1)
  const t2 = toNumber(s2)
  const t3 = toNumber(s3)

  if (v === null || t1 === null || t2 === null || t3 === null) return null

  const dir = normalizeSens(sens)

  // On suppose S1 < S2 < S3. Si l'ordre est inversé en base, on essaie de corriger en triant.
  // Ça évite des incohérences si les seuils ont été saisis dans le désordre.
  const thresholds = [t1, t2, t3].slice().sort((a, b) => a - b)
  const [a, b, c] = thresholds

  if (dir === 'positif') {
    if (v >= c) return 1
    if (v >= b) return 2
    if (v >= a) return 3
    return 4
  }

  // dir === 'negatif'
  if (v <= a) return 1
  if (v <= b) return 2
  if (v <= c) return 3
  return 4
}
