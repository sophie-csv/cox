export function runSimulation(building, periods, majorEvent) {
  const areaFactor = building.sqft / 10000
  const occupancyFactor = majorEvent ? 1.28 : 1

  const baseline = periods.map(({ temperature }, index) => {
    const heatLoad = Math.max(0, temperature - 69)
    const daytimeLoad = index >= 3 && index <= 9 ? 1 : 0.58
    return Number((areaFactor * (2.6 + heatLoad * 0.33) * daytimeLoad * occupancyFactor).toFixed(1))
  })

  const optimized = baseline.map((value, index) => {
    if (index < 3) return Number((value * (majorEvent ? 1.24 : 1.18)).toFixed(1))
    if (index <= 8) return Number((value * (majorEvent ? 0.69 : 0.73)).toFixed(1))
    return Number((value * 0.88).toFixed(1))
  })

  const baselineTotal = baseline.reduce((sum, value) => sum + value, 0)
  const optimizedTotal = optimized.reduce((sum, value) => sum + value, 0)
  const saved = Math.max(0, baselineTotal - optimizedTotal)
  const peakReduction = Math.max(...baseline) - Math.max(...optimized)
  const readiness = Math.min(
    99,
    Math.round(building.baseReadiness + (majorEvent ? 4 : 8) + peakReduction * 0.28),
  )

  return {
    baseline,
    optimized,
    baselineTotal,
    optimizedTotal,
    saved,
    costSaved: saved * 0.137,
    co2Avoided: saved * 0.82,
    peakReduction,
    readiness,
  }
}
