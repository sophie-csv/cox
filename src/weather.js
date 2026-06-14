const ATLANTA = { lat: 33.749, lon: -84.388 }

function fallbackForecast() {
  const now = new Date()
  const temperatures = [78, 79, 81, 84, 87, 90, 92, 93, 92, 89, 86, 83]

  return temperatures.map((temperature, index) => ({
    time: new Date(now.getTime() + index * 60 * 60 * 1000),
    temperature,
    shortForecast: index > 4 && index < 9 ? 'Hot and sunny' : 'Mostly clear',
  }))
}

export async function getHourlyForecast() {
  try {
    const pointResponse = await fetch(
      `https://api.weather.gov/points/${ATLANTA.lat},${ATLANTA.lon}`,
      { headers: { Accept: 'application/geo+json' } },
    )
    if (!pointResponse.ok) throw new Error('NWS location request failed')

    const pointData = await pointResponse.json()
    const forecastResponse = await fetch(pointData.properties.forecastHourly, {
      headers: { Accept: 'application/geo+json' },
    })
    if (!forecastResponse.ok) throw new Error('NWS forecast request failed')

    const forecastData = await forecastResponse.json()
    const periods = forecastData.properties.periods.slice(0, 12)
    if (!periods.length) throw new Error('NWS returned no hourly periods')

    return {
      source: 'National Weather Service',
      periods: periods.map((period) => ({
        time: new Date(period.startTime),
        temperature: period.temperature,
        shortForecast: period.shortForecast,
      })),
    }
  } catch (error) {
    console.warn('Using fallback Atlanta forecast:', error)
    return { source: 'Atlanta demo forecast', periods: fallbackForecast() }
  }
}
