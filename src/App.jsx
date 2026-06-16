import React, { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, ZoomControl } from 'react-leaflet'

const ATLANTA_CENTER = [33.755, -84.39]
const ATLANTA_WEATHER_POINT = { lat: 33.749, lng: -84.388 }

const BASELINE_SETPOINT_F = 74
const PRECOOL_SETPOINT_F = 70
const COOLING_LOAD_FACTOR = 0.0008
const SAVINGS_EFFICIENCY_FACTOR = 0.12
const ELECTRICITY_RATE_PER_KWH = 0.13
const EMISSIONS_FACTOR_LBS_PER_KWH = 0.85
const DEFAULT_FIXED_TEMP_F = 92
const WEATHER_PROVIDER = 'NOAA/NWS keyless weather API'

const CATEGORY_OPTIONS = [
  { key: 'all', label: 'All Buildings', matcher: () => true, description: 'All GeoJSON buildings currently loaded' },
  {
    key: 'general_commercial',
    label: 'General Commercial',
    matcher: (building) => building.ownershipCategory === 'General commercial / private',
    description: 'General commercial / private buildings',
  },
  {
    key: 'city_of_atlanta',
    label: 'Atlanta Government Buildings',
    matcher: (building) => building.ownershipCategory === 'City of Atlanta owned',
    description: 'Atlanta government buildings in the dataset',
  },
  {
    key: 'public_spaces',
    label: 'Public Spaces',
    matcher: (building) => building.ownershipCategory === 'Publicly owned / public-serving',
    description: 'Publicly owned / public-serving buildings',
  },
]

const SORT_OPTIONS = {
  sqft: 'Largest square footage',
  kwh: 'Highest estimated kWh saved',
  co2: 'Highest estimated CO₂ avoided',
  cost: 'Highest estimated cost saved',
}

const TIME_SCALE_OPTIONS = [
  { key: 'day', label: 'Daily', multiplier: 1 },
  { key: 'month', label: 'Monthly', multiplier: 30 },
  { key: 'year', label: 'Yearly', multiplier: 365 },
]

const WEATHER_ASSET_BASE = `${import.meta.env.BASE_URL}assets/weather`

const WEATHER_VIDEO_BY_CONDITION = {
  sunny: `${WEATHER_ASSET_BASE}/sunny.mp4`,
  cloudy: `${WEATHER_ASSET_BASE}/cloudy.mp4`,
  rain: `${WEATHER_ASSET_BASE}/rain.mp4`,
  storm: `${WEATHER_ASSET_BASE}/storm.mp4`,
  fog: `${WEATHER_ASSET_BASE}/fog.mp4`,
  hot: `${WEATHER_ASSET_BASE}/hot.mp4`,
}

function extractCoordinates(feature) {
  const geometry = feature?.geometry
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates.map(Number)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }

  const props = feature?.properties || {}
  const lat = Number(props.lat ?? props.latitude ?? props.Latitude ?? props.LAT)
  const lng = Number(props.lng ?? props.lon ?? props.longitude ?? props.Longitude ?? props.LON)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }

  return { lat: null, lng: null }
}

function normalizeOwnership(ownership, type) {
  if (ownership) return ownership
  if (type === 'Municipal') return 'City of Atlanta owned'
  if (type === 'Institutional') return 'Publicly owned / public-serving'
  return 'General commercial / private'
}

function normalizeBuilding(feature, index) {
  const props = feature.properties || {}
  const { lat, lng } = extractCoordinates(feature)
  const sqft = Number(props.sqft ?? props.SqFt ?? props['Sq Ft'])
  const normalizedSqft = Number.isFinite(sqft) && sqft > 0 ? sqft : null
  const ownershipCategory = normalizeOwnership(props.ownership, props.type)
  const category = CATEGORY_OPTIONS.find((option) => option.key !== 'all' && option.matcher({ ownershipCategory }))

  return {
    id: String(props.id || props.ABID || `building-${index + 1}`),
    name: props.name || props['Building Name'] || `Building ${index + 1}`,
    address: props.address || props.Address || 'Address not available',
    propertyType: props.type || props['Original Property Type'] || 'Not provided',
    ownershipCategory,
    categoryKey: category?.key || 'general_commercial',
    categoryLabel: category?.label || 'General Commercial',
    sqft: normalizedSqft,
    sqftDisplay: normalizedSqft ? `${Math.round(normalizedSqft).toLocaleString()} ft²` : 'No sqft provided',
    lat,
    lng,
    coordinateStatus: props.coordSource ? `Coordinates: ${props.coordSource}` : 'Coordinates provided by GeoJSON',
    priorityScore: props.priorityScore ?? props.preCoolingScore ?? props.score ?? null,
    rawProperties: props,
  }
}

function normalizeWeatherCondition(conditionText, outdoorTemp) {
  const text = String(conditionText || '').toLowerCase()
  if (outdoorTemp >= 95) return 'hot'
  if (text.includes('thunder') || text.includes('storm')) return 'storm'
  if (text.includes('rain') || text.includes('shower') || text.includes('drizzle')) return 'rain'
  if (text.includes('fog') || text.includes('mist') || text.includes('haze')) return 'fog'
  if (text.includes('cloud') || text.includes('overcast')) return 'cloudy'
  if (text.includes('clear') || text.includes('sun')) return 'sunny'
  return outdoorTemp >= 90 ? 'hot' : 'sunny'
}

async function fetchAtlantaWeather() {
  const pointUrl = `https://api.weather.gov/points/${ATLANTA_WEATHER_POINT.lat},${ATLANTA_WEATHER_POINT.lng}`
  const pointResponse = await fetch(pointUrl, { headers: { Accept: 'application/geo+json' } })
  if (!pointResponse.ok) throw new Error('Could not load NOAA/NWS Atlanta grid point')
  const pointData = await pointResponse.json()
  const hourlyUrl = pointData?.properties?.forecastHourly
  if (!hourlyUrl) throw new Error('NOAA/NWS did not return an hourly forecast URL')

  const hourlyResponse = await fetch(hourlyUrl, { headers: { Accept: 'application/geo+json' } })
  if (!hourlyResponse.ok) throw new Error('Could not load NOAA/NWS hourly forecast')
  const hourlyData = await hourlyResponse.json()
  const currentPeriod = hourlyData?.properties?.periods?.[0]
  if (!currentPeriod) throw new Error('NOAA/NWS hourly forecast did not include current period data')

  const temperature = Number(currentPeriod.temperature)
  const conditionLabel = currentPeriod.shortForecast || 'Live Atlanta weather'
  return {
    temperature,
    conditionLabel,
    conditionKey: normalizeWeatherCondition(conditionLabel, temperature),
    provider: WEATHER_PROVIDER,
    updatedAt: new Date().toISOString(),
  }
}

function getTimeScale(scaleKey) {
  return TIME_SCALE_OPTIONS.find((scale) => scale.key === scaleKey) || TIME_SCALE_OPTIONS[0]
}

function calculateBuildingImpact(building, outdoorTemp, scaleKey = 'day') {
  const timeScale = getTimeScale(scaleKey)
  if (!building.sqft) {
    return {
      tempDelta: Math.max(0, outdoorTemp - BASELINE_SETPOINT_F),
      coolingLoadEstimate: 0,
      kwhSaved: 0,
      costSaved: 0,
      carbonSavedLbs: 0,
      priorityScore: building.priorityScore ?? 0,
      estimated: true,
    }
  }

  const tempDelta = Math.max(0, outdoorTemp - BASELINE_SETPOINT_F)
  const coolingLoadEstimate = building.sqft * tempDelta * COOLING_LOAD_FACTOR
  const dailyKwhSaved = coolingLoadEstimate * SAVINGS_EFFICIENCY_FACTOR
  const kwhSaved = dailyKwhSaved * timeScale.multiplier
  const costSaved = kwhSaved * ELECTRICITY_RATE_PER_KWH
  const carbonSavedLbs = kwhSaved * EMISSIONS_FACTOR_LBS_PER_KWH
  const priorityScore = building.priorityScore ?? Math.min(100, Math.round(20 + tempDelta * 3 + Math.sqrt(building.sqft) / 22))

  return {
    tempDelta,
    coolingLoadEstimate,
    dailyKwhSaved,
    kwhSaved,
    costSaved,
    carbonSavedLbs,
    priorityScore,
    estimated: true,
  }
}

function calculatePortfolioTotals(buildings, outdoorTemp, scaleKey = 'day') {
  return buildings.reduce((totals, building) => {
    const impact = calculateBuildingImpact(building, outdoorTemp, scaleKey)
    return {
      buildings: totals.buildings + 1,
      mappedBuildings: totals.mappedBuildings + (building.lat !== null && building.lng !== null ? 1 : 0),
      sqft: totals.sqft + (building.sqft || 0),
      kwhSaved: totals.kwhSaved + impact.kwhSaved,
      costSaved: totals.costSaved + impact.costSaved,
      carbonSavedLbs: totals.carbonSavedLbs + impact.carbonSavedLbs,
    }
  }, {
    buildings: 0,
    mappedBuildings: 0,
    sqft: 0,
    kwhSaved: 0,
    costSaved: 0,
    carbonSavedLbs: 0,
  })
}

function formatKWh(value) {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2)}M kWh`
  if (Math.abs(value) >= 1000) return `${Math.round(value).toLocaleString()} kWh`
  return `${value.toFixed(1)} kWh`
}

function formatCO2(value) {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2)}M lbs CO₂`
  if (Math.abs(value) >= 1000) return `${Math.round(value).toLocaleString()} lbs CO₂`
  return `${value.toFixed(1)} lbs CO₂`
}

function formatCurrency(value) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatNumber(value) {
  return Math.round(value || 0).toLocaleString()
}

function formatSquareFeet(value) {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2)}M ft²`
  return `${formatNumber(value)} ft²`
}

function KpiCard({ label, value, detail, tone = 'green' }) {
  return (
    <article className={`kpi-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}

function WeatherBackdrop({ conditionKey }) {
  const src = WEATHER_VIDEO_BY_CONDITION[conditionKey] || WEATHER_VIDEO_BY_CONDITION.sunny
  return (
    <div className={`weather-backdrop ${conditionKey}`}>
      <video key={src} autoPlay muted loop playsInline aria-hidden="true">
        <source src={src} type="video/mp4" />
      </video>
      <div className="weather-scrim" />
    </div>
  )
}

function WeatherControls({
  useLiveWeather,
  fixedTemp,
  activeTemp,
  weather,
  weatherError,
  onToggleLive,
  onFixedTempChange,
}) {
  return (
    <section className="weather-panel">
      <div>
        <span className="eyebrow">Temperature source</span>
        <h2>{useLiveWeather ? 'Real-Time Atlanta Weather' : 'Fixed Temperature Mode'}</h2>
        <p>
          Calculations use <b>{Math.round(activeTemp)}°F</b> outdoor temperature from{' '}
          {useLiveWeather ? weather.provider : 'manual fixed-temperature control'}.
        </p>
      </div>

      <label className="weather-toggle">
        <input type="checkbox" checked={useLiveWeather} onChange={(event) => onToggleLive(event.target.checked)} />
        <span className="switch" />
        <strong>Use Real-Time Atlanta Weather</strong>
      </label>

      <div className="fixed-temp-control">
        <label htmlFor="fixed-temp">Fixed outdoor temperature</label>
        <div>
          <input
            id="fixed-temp"
            type="range"
            min="70"
            max="105"
            value={fixedTemp}
            disabled={useLiveWeather}
            onChange={(event) => onFixedTempChange(Number(event.target.value))}
          />
          <output>{fixedTemp}°F</output>
        </div>
      </div>

      <div className="weather-status-card">
        <span>{weather.conditionLabel}</span>
        <strong>{Math.round(activeTemp)}°F</strong>
        <small>{useLiveWeather ? `Provider: ${weather.provider}` : 'Manual mode, live weather off'}</small>
      </div>

      {weatherError && (
        <div className="weather-warning">
          Live weather failed, so the dashboard fell back to fixed temperature mode. {weatherError}
        </div>
      )}
    </section>
  )
}

function CategorySelector({ categories, selectedCategory, onChange }) {
  return (
    <section className="category-panel">
      <div>
        <span className="eyebrow">Visible building subgroup</span>
        <h2>Choose a building category</h2>
        <p>Summary cards and map markers update to match the selected subgroup.</p>
        <p className="certification-note">All buildings considered in this demo are not found as ENERGY STAR-certified or LEED-certified buildings.</p>
      </div>
      <div className="category-actions">
        <div className="category-tabs" aria-label="Building category toggles">
          {categories.map((category) => (
            <button
              key={category.key}
              className={selectedCategory === category.key ? 'active' : ''}
              onClick={() => onChange(category.key)}
            >
              <strong>{category.label}</strong>
              <span>{formatNumber(category.records)} buildings</span>
              <small>{formatNumber(category.mappedRecords)} mapped</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function TimeScaleSelector({ selectedScale, onChange }) {
  return (
    <section className="time-scale-panel">
      <div>
        <span className="eyebrow">Savings time scale</span>
        <h2>Show savings by day, month, or year</h2>
      </div>
      <div className="time-scale-tabs" aria-label="Savings time scale">
        {TIME_SCALE_OPTIONS.map((scale) => (
          <button
            key={scale.key}
            className={selectedScale === scale.key ? 'active' : ''}
            onClick={() => onChange(scale.key)}
          >
            {scale.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function SummaryCards({ totals, activeTemp, selectedScale }) {
  const timeScale = getTimeScale(selectedScale)
  const periodLabel = timeScale.label.toLowerCase()
  return (
    <section className="summary-grid">
      <KpiCard label={`Estimated ${periodLabel} kWh saved`} value={formatKWh(totals.kwhSaved)} detail={`Across visible buildings at ${Math.round(activeTemp)}°F`} />
      <KpiCard label={`Estimated ${periodLabel} cost saved`} value={formatCurrency(totals.costSaved)} detail={`At $${ELECTRICITY_RATE_PER_KWH}/kWh`} tone="gold" />
      <KpiCard label={`${timeScale.label} carbon avoided`} value={formatCO2(totals.carbonSavedLbs)} detail={`${EMISSIONS_FACTOR_LBS_PER_KWH} lbs CO₂/kWh`} tone="blue" />
      <KpiCard label="Total square footage" value={formatSquareFeet(totals.sqft)} detail="Across selected buildings" tone="blue" />
    </section>
  )
}

function AssumptionsPanel() {
  return (
    <aside className="assumptions-panel">
      <h3>Calculation Assumptions</h3>
      <ul>
        <li>Baseline indoor setpoint: <b>{BASELINE_SETPOINT_F}°F</b></li>
        <li>Pre-cool indoor setpoint: <b>{PRECOOL_SETPOINT_F}°F</b></li>
        <li>Cooling load factor: <b>{COOLING_LOAD_FACTOR}</b></li>
        <li>Pre-cooling savings factor: <b>{SAVINGS_EFFICIENCY_FACTOR}</b></li>
        <li>Electricity rate: <b>${ELECTRICITY_RATE_PER_KWH}/kWh</b></li>
        <li>Grid emissions factor: <b>{EMISSIONS_FACTOR_LBS_PER_KWH} lbs CO₂/kWh</b></li>
      </ul>
    </aside>
  )
}

function SavingsTab({ category, activeTemp, selectedScale }) {
  const timeScale = getTimeScale(selectedScale)
  return (
    <section className="tab-panel savings-layout no-chart">
      <div className="scale-card">
        <span className="eyebrow">{category?.label || 'Selected category'}</span>
        <h2>Temperature-driven pre-cooling estimate</h2>
        <p>
          For each visible building: tempDelta = max(0, outdoor temperature - baseline setpoint), then the
          model estimates cooling load from square footage and applies a pre-cooling savings factor.
        </p>
        <div className="formula-card">
          <b>Active formula</b>
          <span>
            {timeScale.label} kWh saved = sqft × max(0, {Math.round(activeTemp)}°F - {BASELINE_SETPOINT_F}°F)
            × {COOLING_LOAD_FACTOR} × {SAVINGS_EFFICIENCY_FACTOR} × {timeScale.multiplier}
          </span>
        </div>
      </div>

      <AssumptionsPanel />
      <div className="wide-note">
        <b>Simulated savings for demo purposes.</b> Actual savings depend on HVAC system type, controls compatibility, building envelope, occupancy, utility tariffs, and weather.
      </div>
    </section>
  )
}

function markerStyle(impact) {
  const radius = Math.max(6, Math.min(18, 6 + Math.sqrt(impact.kwhSaved || 0) / 2.5))
  const color = impact.priorityScore >= 80 ? '#ffd36b' : impact.priorityScore >= 60 ? '#7cf2a2' : '#6bc8ff'
  return { radius, color }
}

function MapTab({
  buildings,
  category,
  categories,
  selectedCategory,
  onCategoryChange,
  activeTemp,
  modeLabel,
  selectedScale,
}) {
  const timeScale = getTimeScale(selectedScale)
  const withCoords = buildings.filter((building) => building.lat !== null && building.lng !== null)
  const missingCoords = buildings.length - withCoords.length

  return (
    <section className="tab-panel map-layout">
      <div className="map-controls">
        <div>
          <h2>Clickable Atlanta Map</h2>
          <p>Showing {category?.label || 'selected'} buildings. Hover for quick details; click for individual building savings.</p>
        </div>
        <select value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)} aria-label="Map building category">
          {categories.map((mapCategory) => (
            <option key={mapCategory.key} value={mapCategory.key}>
              {mapCategory.label}
            </option>
          ))}
        </select>
      </div>
      <div className="map-shell">
        <MapContainer center={ATLANTA_CENTER} zoom={11} zoomControl={false} scrollWheelZoom>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ZoomControl position="bottomright" />
          {withCoords.map((building) => {
            const impact = calculateBuildingImpact(building, activeTemp, selectedScale)
            const style = markerStyle(impact)
            return (
              <CircleMarker
                key={building.id}
                center={[building.lat, building.lng]}
                radius={style.radius}
                pathOptions={{
                  color: style.color,
                  fillColor: style.color,
                  fillOpacity: 0.72,
                  opacity: 0.95,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  <div className="map-tooltip">
                    <b>{building.name}</b>
                    <span>{building.address}</span>
                    <small>{formatKWh(impact.kwhSaved)} estimated {timeScale.label.toLowerCase()} saved at {Math.round(activeTemp)}°F</small>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="map-popup">
                    <b>{building.name}</b>
                    <span>{building.address}</span>
                    <span>Category: {building.categoryLabel}</span>
                    <span>Type: {building.propertyType}</span>
                    <span>Square footage: {building.sqftDisplay}</span>
                    <span>Latitude: {building.lat?.toFixed(5)}</span>
                    <span>Longitude: {building.lng?.toFixed(5)}</span>
                    <span>Temperature used: {Math.round(activeTemp)}°F</span>
                    <span>Mode: {modeLabel}</span>
                    <span>Estimated {timeScale.label.toLowerCase()} kWh saved: {formatKWh(impact.kwhSaved)}</span>
                    <span>Estimated {timeScale.label.toLowerCase()} cost saved: {formatCurrency(impact.costSaved)}</span>
                    <span>Estimated {timeScale.label.toLowerCase()} CO₂ avoided: {formatCO2(impact.carbonSavedLbs)}</span>
                    <span>Pre-cooling priority score: {impact.priorityScore}/100</span>
                    <small>
                      Assumes baseline {BASELINE_SETPOINT_F}°F, pre-cool {PRECOOL_SETPOINT_F}°F,
                      load factor {COOLING_LOAD_FACTOR}, savings factor {SAVINGS_EFFICIENCY_FACTOR}.
                    </small>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
        {!withCoords.length && (
          <div className="map-empty">
            <h3>No mappable coordinates in this filtered view</h3>
            <p>{missingCoords.toLocaleString()} selected records are missing usable latitude/longitude and were skipped on the map.</p>
          </div>
        )}
      </div>
      <div className="map-footnote">
        <span>{withCoords.length.toLocaleString()} buildings mapped</span>
        <span>{missingCoords.toLocaleString()} buildings missing coordinates</span>
      </div>
    </section>
  )
}

function sortBuildings(buildings, sortKey, activeTemp, scaleKey) {
  return [...buildings].sort((a, b) => {
    const aImpact = calculateBuildingImpact(a, activeTemp, scaleKey)
    const bImpact = calculateBuildingImpact(b, activeTemp, scaleKey)
    if (sortKey === 'sqft') return (b.sqft || 0) - (a.sqft || 0)
    if (sortKey === 'kwh') return bImpact.kwhSaved - aImpact.kwhSaved
    if (sortKey === 'co2') return bImpact.carbonSavedLbs - aImpact.carbonSavedLbs
    if (sortKey === 'cost') return bImpact.costSaved - aImpact.costSaved
    return 0
  })
}

function BuildingTableTab({ buildings, category, activeTemp, modeLabel, selectedScale }) {
  const [sortKey, setSortKey] = useState('kwh')
  const timeScale = getTimeScale(selectedScale)
  const sortedBuildings = useMemo(() => sortBuildings(buildings, sortKey, activeTemp, selectedScale), [buildings, sortKey, activeTemp, selectedScale])

  return (
    <section className="tab-panel table-panel">
      <div className="table-toolbar">
        <div>
          <h2>Building Table Data</h2>
          <p>{category?.label || 'Selected category'} records with per-building estimates at {Math.round(activeTemp)}°F.</p>
        </div>
        <select value={sortKey} onChange={(event) => setSortKey(event.target.value)} aria-label="Sort buildings">
          {Object.entries(SORT_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Building name</th>
              <th>Address</th>
              <th>Category</th>
              <th>Square footage</th>
              <th>Temperature source</th>
              <th>Outdoor temp</th>
              <th>Estimated {timeScale.label.toLowerCase()} kWh saved</th>
              <th>Estimated {timeScale.label.toLowerCase()} CO₂ avoided</th>
              <th>Estimated {timeScale.label.toLowerCase()} cost saved</th>
              <th>Priority score</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Coordinate source</th>
            </tr>
          </thead>
          <tbody>
            {sortedBuildings.map((building) => {
              const impact = calculateBuildingImpact(building, activeTemp, selectedScale)
              return (
                <tr key={`${building.categoryKey}-${building.id}`}>
                  <td><b>{building.name}</b></td>
                  <td>{building.address}</td>
                  <td>{building.categoryLabel}</td>
                  <td>{building.sqftDisplay}</td>
                  <td>{modeLabel}</td>
                  <td>{Math.round(activeTemp)}°F</td>
                  <td>{formatKWh(impact.kwhSaved)}</td>
                  <td>{formatCO2(impact.carbonSavedLbs)}</td>
                  <td>{formatCurrency(impact.costSaved)}</td>
                  <td>{impact.priorityScore}/100</td>
                  <td>{building.lat?.toFixed(5) ?? 'Missing'}</td>
                  <td>{building.lng?.toFixed(5) ?? 'Missing'}</td>
                  <td>{building.coordinateStatus}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CoolCorridorsDashboard() {
  const [buildings, setBuildings] = useState([])
  const [metadata, setMetadata] = useState(null)
  const [activeTab, setActiveTab] = useState('map')
  const [selectedCategory, setSelectedCategory] = useState('city_of_atlanta')
  const [selectedScale, setSelectedScale] = useState('day')
  const [fixedTemp, setFixedTemp] = useState(DEFAULT_FIXED_TEMP_F)
  const [useLiveWeather, setUseLiveWeather] = useState(false)
  const [weather, setWeather] = useState({
    temperature: DEFAULT_FIXED_TEMP_F,
    conditionLabel: 'Manual hot Atlanta day',
    conditionKey: 'hot',
    provider: 'Manual fixed temperature',
    updatedAt: null,
  })
  const [weatherError, setWeatherError] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/atlanta_buildings.geojson`)
      .then((response) => response.json())
      .then((payload) => {
        const normalized = (payload.features || []).map(normalizeBuilding)
        const skipped = normalized.filter((building) => building.lat === null || building.lng === null)
        if (skipped.length) console.warn(`${skipped.length} buildings skipped on map because they are missing coordinates.`)
        setBuildings(normalized)
        setMetadata(payload.metadata || null)
      })
      .catch((error) => {
        console.error('Could not load Atlanta GeoJSON dataset', error)
      })
  }, [])

  useEffect(() => {
    if (!useLiveWeather) {
      setWeather((current) => ({
        ...current,
        temperature: fixedTemp,
        conditionLabel: fixedTemp >= 95 ? 'Manual extreme heat scenario' : 'Manual fixed-temperature scenario',
        conditionKey: normalizeWeatherCondition('sunny', fixedTemp),
        provider: 'Manual fixed temperature',
      }))
      return
    }

    let ignore = false
    setWeatherError('')
    fetchAtlantaWeather()
      .then((liveWeather) => {
        if (!ignore) setWeather(liveWeather)
      })
      .catch((error) => {
        if (!ignore) {
          setWeatherError(error.message)
          setUseLiveWeather(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [fixedTemp, useLiveWeather])

  const selectedCategoryInfo = useMemo(
    () => CATEGORY_OPTIONS.find((category) => category.key === selectedCategory) || CATEGORY_OPTIONS[0],
    [selectedCategory],
  )

  const selectedBuildings = useMemo(() => {
    return buildings.filter((building) => selectedCategoryInfo.matcher(building))
  }, [buildings, selectedCategoryInfo])

  const categories = useMemo(() => {
    return CATEGORY_OPTIONS.map((category) => {
      const records = buildings.filter((building) => category.matcher(building))
      return {
        ...category,
        records: records.length,
        mappedRecords: records.filter((building) => building.lat !== null && building.lng !== null).length,
      }
    })
  }, [buildings])

  const activeTemp = useLiveWeather ? weather.temperature : fixedTemp
  const modeLabel = useLiveWeather ? 'Real-Time Weather Mode' : 'Fixed Temperature Mode'
  const totals = useMemo(() => calculatePortfolioTotals(selectedBuildings, activeTemp, selectedScale), [selectedBuildings, activeTemp, selectedScale])
  const tabs = [
    ['map', 'Clickable Map'],
    ['savings', 'Savings Model'],
  ]

  return (
    <>
      <WeatherBackdrop conditionKey={weather.conditionKey} />
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <span className="header-kicker">Predictive HVAC savings demo</span>
            <h1>Cool Cast</h1>
            <p>Atlanta building pre-cooling dashboard with fixed-temperature scenarios, live weather mode, and clickable building-level savings estimates.</p>
          </div>
          <div className="header-badge">
            <strong>{selectedBuildings.length ? selectedBuildings.length.toLocaleString() : '...'}</strong>
            <span>{selectedCategoryInfo?.label || 'selected'} buildings</span>
          </div>
        </header>

        <WeatherControls
          useLiveWeather={useLiveWeather}
          fixedTemp={fixedTemp}
          activeTemp={activeTemp}
          weather={weather}
          weatherError={weatherError}
          onToggleLive={setUseLiveWeather}
          onFixedTempChange={setFixedTemp}
        />

        <CategorySelector
          categories={categories}
          selectedCategory={selectedCategory}
          onChange={setSelectedCategory}
        />

        <TimeScaleSelector selectedScale={selectedScale} onChange={setSelectedScale} />

        <SummaryCards
          totals={totals}
          activeTemp={activeTemp}
          selectedScale={selectedScale}
        />

        <div className="view-switcher">
          <nav className="tabs" aria-label="Dashboard tabs">
            {tabs.map(([key, label]) => (
              <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
                {label}
              </button>
            ))}
          </nav>
        </div>

        {!buildings.length ? (
          <main className="loading-panel">Loading Atlanta GeoJSON buildings...</main>
        ) : (
          <main>
            {activeTab === 'map' && (
              <MapTab
                buildings={selectedBuildings}
                category={selectedCategoryInfo}
                categories={categories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                activeTemp={activeTemp}
                modeLabel={modeLabel}
                selectedScale={selectedScale}
              />
            )}
            {activeTab === 'savings' && <SavingsTab category={selectedCategoryInfo} activeTemp={activeTemp} selectedScale={selectedScale} />}
            {activeTab === 'table' && <BuildingTableTab buildings={selectedBuildings} category={selectedCategoryInfo} activeTemp={activeTemp} modeLabel={modeLabel} selectedScale={selectedScale} />}
          </main>
        )}

        <div className="bottom-data-action">
          <button className={`table-action ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>
            Building Table Data
          </button>
        </div>

        <footer className="dashboard-footer">
          <span>{metadata?.source || 'Atlanta GeoJSON building dataset'}</span>
          <span>Weather provider is currently {WEATHER_PROVIDER}; swap fetchAtlantaWeather later for weather.com or another keyed API.</span>
        </footer>
      </div>
    </>
  )
}

export default function App() {
  return <CoolCorridorsDashboard />
}
