export function runSimulation(building, periods) {
  const areaFactor = building.sqft / 10000
  const coolingCapacityFactor = Math.max(0.75, Math.min(1.35, building.coolingTons / (building.sqft / 500)))

  const baseline = periods.map(({ temperature }, index) => {
    const heatLoad = Math.max(0, temperature - 69)
    const daytimeLoad = index >= 3 && index <= 9 ? 1 : 0.58
    return Number((areaFactor * (2.6 + heatLoad * 0.33) * daytimeLoad * coolingCapacityFactor).toFixed(1))
  })

  const optimized = baseline.map((value, index) => {
    if (index < 3) return Number((value * 1.18).toFixed(1))
    if (index <= 8) return Number((value * 0.73).toFixed(1))
    return Number((value * 0.88).toFixed(1))
  })

  const baselineTotal = baseline.reduce((sum, value) => sum + value, 0)
  const optimizedTotal = optimized.reduce((sum, value) => sum + value, 0)
  const saved = Math.max(0, baselineTotal - optimizedTotal)
  const peakReduction = Math.max(...baseline) - Math.max(...optimized)
  const readiness = Math.min(
    99,
    Math.round(building.baseReadiness + 8 + peakReduction * 0.28),
  )

  return {
    baseline,
    optimized,
    baselineTotal,
    optimizedTotal,
    saved,
    costSaved: saved * building.electricityPriceKwh,
    co2Avoided: saved * 0.82,
    peakReduction,
    readiness,
  }
}
