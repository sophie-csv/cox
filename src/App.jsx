import React, { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, ZoomControl } from 'react-leaflet'

const ATLANTA_CENTER = [33.755, -84.39]
const SAVINGS_KWH_PER_SQFT_DAY = 0.015
const GRID_EMISSIONS_LBS_PER_KWH = 0.855
const ELECTRICITY_RATE = 0.12

const TIME_SCALES = {
  day: { label: 'Day', multiplier: 1 },
  week: { label: 'Week', multiplier: 7 },
  month: { label: 'Month', multiplier: 30 },
  year: { label: 'Year', multiplier: 365 },
}

const SORT_OPTIONS = {
  sqft: 'Largest square footage',
  yearlyKwh: 'Highest yearly kWh savings',
  yearlyCo2: 'Highest yearly CO₂ savings',
  yearlyCost: 'Highest yearly cost savings',
}

const MAP_FILTERS = {
  all: 'Show all buildings',
  withSqft: 'Show only buildings with square footage',
  top10: 'Show top 10 by estimated yearly savings',
}

function normalizeBuilding(raw, index) {
  const parsedSqft = Number(raw.sqft)
  const sqft = Number.isFinite(parsedSqft) && parsedSqft > 0 ? parsedSqft : null
  const parsedLat = raw.lat === null || raw.lat === undefined || raw.lat === '' ? NaN : Number(raw.lat)
  const parsedLng = raw.lng === null || raw.lng === undefined || raw.lng === '' ? NaN : Number(raw.lng)
  const lat = Number.isFinite(parsedLat) ? parsedLat : null
  const lng = Number.isFinite(parsedLng) ? parsedLng : null

  return {
    id: raw.id || `building-${index + 1}`,
    name: raw.name || `Building ${index + 1}`,
    address: raw.address || 'Address not available',
    sqft,
    sqftDisplay: sqft ? `${sqft.toLocaleString()} ft²` : 'No sqft provided',
    sqftStatus: sqft ? (raw.sqftStatus || 'Provided') : 'No sqft provided',
    lat,
    lng,
    categoryKey: raw.categoryKey || 'all',
    categoryLabel: raw.categoryLabel || 'Uncategorized',
    ownershipCategory: raw.ownershipCategory || raw.categoryLabel || 'Not provided',
    propertyType: raw.propertyType || 'Not provided',
    coordinateStatus: raw.coordinateStatus || 'Coordinate status not provided',
    geocoderMatchAddress: raw.geocoderMatchAddress || '',
    geocoderScore: raw.geocoderScore ?? null,
    certificationStatus: raw.certificationStatus || 'Not found in LEED or ENERGY STAR certified lists',
    notes: raw.notes || 'No additional notes',
  }
}

function calculateBuildingSavings(building, timeScale = 'day') {
  if (!building.sqft) {
    return {
      kwh: null,
      co2: null,
      cost: null,
      dailyKwh: null,
      weeklyKwh: null,
      monthlyKwh: null,
      yearlyKwh: null,
      yearlyCo2: null,
      yearlyCost: null,
    }
  }

  const dailyKwh = building.sqft * SAVINGS_KWH_PER_SQFT_DAY
  const weeklyKwh = dailyKwh * 7
  const monthlyKwh = dailyKwh * 30
  const yearlyKwh = dailyKwh * 365
  const kwh = dailyKwh * TIME_SCALES[timeScale].multiplier

  return {
    kwh,
    co2: kwh * GRID_EMISSIONS_LBS_PER_KWH,
    cost: kwh * ELECTRICITY_RATE,
    dailyKwh,
    weeklyKwh,
    monthlyKwh,
    yearlyKwh,
    yearlyCo2: yearlyKwh * GRID_EMISSIONS_LBS_PER_KWH,
    yearlyCost: yearlyKWhCost(yearlyKwh),
  }
}

function yearlyKWhCost(yearlyKwh) {
  return yearlyKwh * ELECTRICITY_RATE
}

function calculatePortfolioTotals(buildings, timeScale = 'day') {
  return buildings.reduce((totals, building) => {
    const savings = calculateBuildingSavings(building, timeScale)
    const yearly = calculateBuildingSavings(building, 'year')

    return {
      buildings: totals.buildings + 1,
      withSqft: totals.withSqft + (building.sqft ? 1 : 0),
      missingSqft: totals.missingSqft + (building.sqft ? 0 : 1),
      totalSqft: totals.totalSqft + (building.sqft || 0),
      kwh: totals.kwh + (savings.kwh || 0),
      co2: totals.co2 + (savings.co2 || 0),
      cost: totals.cost + (savings.cost || 0),
      yearlyKwh: totals.yearlyKwh + (yearly.kwh || 0),
      yearlyCo2: totals.yearlyCo2 + (yearly.co2 || 0),
      yearlyCost: totals.yearlyCost + (yearly.cost || 0),
    }
  }, {
    buildings: 0,
    withSqft: 0,
    missingSqft: 0,
    totalSqft: 0,
    kwh: 0,
    co2: 0,
    cost: 0,
    yearlyKwh: 0,
    yearlyCo2: 0,
    yearlyCost: 0,
  })
}

function formatKWh(value) {
  if (value === null || value === undefined) return 'No sqft provided'
  if (Math.abs(value) >= 1000000000) return `${(value / 1000000000).toFixed(2)}B kWh`
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2)}M kWh`
  if (Math.abs(value) >= 1000) return `${Math.round(value).toLocaleString()} kWh`
  return `${value.toFixed(1)} kWh`
}

function formatCO2(value) {
  if (value === null || value === undefined) return 'No sqft provided'
  if (Math.abs(value) >= 1000000000) return `${(value / 1000000000).toFixed(2)}B lbs CO₂`
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2)}M lbs CO₂`
  return `${Math.round(value).toLocaleString()} lbs CO₂`
}

function formatCurrency(value) {
  if (value === null || value === undefined) return 'No sqft provided'
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatNumber(value) {
  return Math.round(value || 0).toLocaleString()
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

function CategorySelector({ categories, selectedCategory, onChange }) {
  return (
    <section className="category-panel">
      <div>
        <span className="eyebrow">Dataset-provided subgroup</span>
        <h2>Choose a building category</h2>
        <p>Calculations, map markers, and table rows update based on the selected workbook category. Buildings are featured directly on the map when coordinates are available.</p>
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
              <small>{formatNumber(category.withCoords || 0)} mapped</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function AssumptionsPanel() {
  return (
    <aside className="assumptions-panel">
      <h3>Assumptions</h3>
      <ul>
        <li>Estimated HVAC scheduling savings: <b>0.015 kWh per square foot per day</b></li>
        <li>Grid emissions factor: <b>0.855 lbs CO₂ per kWh</b></li>
        <li>Electricity rate: <b>$0.12 per kWh</b></li>
        <li>Values are simulated estimates for hackathon demonstration</li>
      </ul>
    </aside>
  )
}

function SavingsTab({ buildings, category }) {
  const [timeScale, setTimeScale] = useState('year')
  const totals = useMemo(() => calculatePortfolioTotals(buildings, timeScale), [buildings, timeScale])
  const dailyTotals = useMemo(() => calculatePortfolioTotals(buildings, 'day'), [buildings])
  const yearlyTotals = useMemo(() => calculatePortfolioTotals(buildings, 'year'), [buildings])

  return (
    <section className="tab-panel savings-layout no-chart">
      <div className="scale-card">
        <span className="eyebrow">{category?.label || 'Selected category'}</span>
        <h2>Savings by Category</h2>
        <p>These simulated savings are calculated only for buildings in the selected dataset category.</p>
        <div className="scale-selector" role="tablist" aria-label="Savings time scale">
          {Object.entries(TIME_SCALES).map(([key, scale]) => (
            <button key={key} className={timeScale === key ? 'active' : ''} onClick={() => setTimeScale(key)}>
              {scale.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-grid category-kpis">
        <KpiCard label="Total square footage" value={`${formatNumber(totals.totalSqft)} ft²`} detail={category?.description} />
        <KpiCard label={`Estimated kWh saved per ${TIME_SCALES[timeScale].label.toLowerCase()}`} value={formatKWh(totals.kwh)} />
        <KpiCard label="Estimated CO₂ avoided" value={formatCO2(totals.co2)} tone="blue" />
        <KpiCard label="Estimated cost saved" value={formatCurrency(totals.cost)} tone="gold" />
        <KpiCard label="Estimated yearly kWh saved" value={formatKWh(yearlyTotals.kwh)} tone="blue" />
        <KpiCard label="Estimated daily kWh saved" value={formatKWh(dailyTotals.kwh)} />
      </div>

      <AssumptionsPanel />
      <div className="wide-note">
        <b>Simulated savings for demo purposes.</b> Actual savings depend on HVAC system type, controls compatibility, building envelope, occupancy, utility tariffs, and weather.
      </div>
    </section>
  )
}

function filterMapBuildings(buildings, filter) {
  let filtered = buildings
  if (filter === 'withSqft') filtered = buildings.filter((building) => building.sqft)
  if (filter === 'top10') {
    filtered = [...buildings]
      .filter((building) => building.sqft)
      .sort((a, b) => calculateBuildingSavings(b, 'year').kwh - calculateBuildingSavings(a, 'year').kwh)
      .slice(0, 10)
  }
  return filtered
}

function MapTab({ buildings, category }) {
  const [mapFilter, setMapFilter] = useState('all')
  const filtered = useMemo(() => filterMapBuildings(buildings, mapFilter), [buildings, mapFilter])
  const withCoords = filtered.filter((building) => building.lat !== null && building.lng !== null)
  const missingCoords = filtered.length - withCoords.length

  return (
    <section className="tab-panel map-layout">
      <div className="map-controls">
        <div>
          <h2>Clickable Map</h2>
          <p>Showing {category?.label || 'selected'} buildings only. Buildings without coordinates stay in the table and calculations.</p>
        </div>
        <select value={mapFilter} onChange={(event) => setMapFilter(event.target.value)} aria-label="Map filter">
          {Object.entries(MAP_FILTERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="map-shell">
        <MapContainer center={ATLANTA_CENTER} zoom={11} zoomControl={false} scrollWheelZoom>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ZoomControl position="bottomright" />
          {withCoords.map((building) => {
            const savings = calculateBuildingSavings(building, 'year')
            const daily = calculateBuildingSavings(building, 'day')
            return (
              <Marker key={building.id} position={[building.lat, building.lng]}>
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  <div className="map-tooltip">
                    <b>{building.name}</b>
                    <span>{building.address}</span>
                    <small>{building.categoryLabel} | {formatKWh(savings.yearlyKwh)} estimated yearly savings</small>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="map-popup">
                    <b>{building.name}</b>
                    <span>{building.address}</span>
                    <span>{building.categoryLabel}</span>
                    <span>{building.sqftDisplay}</span>
                    <span>Daily: {formatKWh(daily.kwh)}</span>
                    <span>Yearly: {formatKWh(savings.kwh)}</span>
                    <span>CO₂: {formatCO2(savings.co2)}</span>
                    <span>Cost: {formatCurrency(savings.cost)}</span>
                    <span>{building.coordinateStatus}</span>
                    <span>{building.certificationStatus}</span>
                    <small>{building.notes}</small>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
        {!withCoords.length && (
          <div className="map-empty">
            <h3>No mappable coordinates in this dataset yet</h3>
            <p>The attached workbook includes latitude/longitude columns, but none of the selected records have coordinate values populated yet. Once coordinates are populated, buildings will appear here as hoverable/clickable map markers.</p>
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

function sortBuildings(buildings, sortKey) {
  return [...buildings].sort((a, b) => {
    const aYear = calculateBuildingSavings(a, 'year')
    const bYear = calculateBuildingSavings(b, 'year')
    if (sortKey === 'sqft') return (b.sqft || 0) - (a.sqft || 0)
    if (sortKey === 'yearlyKwh') return (bYear.kwh || 0) - (aYear.kwh || 0)
    if (sortKey === 'yearlyCo2') return (bYear.co2 || 0) - (aYear.co2 || 0)
    if (sortKey === 'yearlyCost') return (bYear.cost || 0) - (aYear.cost || 0)
    return 0
  })
}

function BuildingTableTab({ buildings, category }) {
  const [sortKey, setSortKey] = useState('yearlyKwh')
  const sortedBuildings = useMemo(() => sortBuildings(buildings, sortKey), [buildings, sortKey])

  return (
    <section className="tab-panel table-panel">
      <div className="table-toolbar">
        <div>
          <h2>Building Table</h2>
          <p>{category?.label || 'Selected category'} records from the non-certified subgroup. Categories come from the attached dataset.</p>
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
              <th>Sqft status</th>
              <th>Daily kWh saved</th>
              <th>Weekly kWh saved</th>
              <th>Monthly kWh saved</th>
              <th>Yearly kWh saved</th>
              <th>Yearly CO₂ avoided, lbs</th>
              <th>Yearly cost savings</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Coordinate status</th>
              <th>Data notes/confidence</th>
            </tr>
          </thead>
          <tbody>
            {sortedBuildings.map((building) => {
              const daily = calculateBuildingSavings(building, 'day')
              const weekly = calculateBuildingSavings(building, 'week')
              const monthly = calculateBuildingSavings(building, 'month')
              const yearly = calculateBuildingSavings(building, 'year')
              const coordNote = building.lat === null || building.lng === null ? ' Missing coordinates.' : ''
              return (
                <tr key={`${building.categoryKey}-${building.id}`}>
                  <td><b>{building.name}</b></td>
                  <td>{building.address}</td>
                  <td>{building.categoryLabel}</td>
                  <td>{building.sqft ? building.sqft.toLocaleString() : 'No sqft provided'}</td>
                  <td>{building.sqftStatus}</td>
                  <td>{formatKWh(daily.kwh)}</td>
                  <td>{formatKWh(weekly.kwh)}</td>
                  <td>{formatKWh(monthly.kwh)}</td>
                  <td>{formatKWh(yearly.kwh)}</td>
                  <td>{formatCO2(yearly.co2)}</td>
                  <td>{formatCurrency(yearly.cost)}</td>
                  <td>{building.lat ?? 'Missing coordinates'}</td>
                  <td>{building.lng ?? 'Missing coordinates'}</td>
                  <td>{building.coordinateStatus}</td>
                  <td>{building.notes}{coordNote}</td>
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
  const [categories, setCategories] = useState([])
  const [metadata, setMetadata] = useState(null)
  const [activeTab, setActiveTab] = useState('savings')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/cool_corridors_buildings.json`)
      .then((response) => response.json())
      .then((payload) => {
        const normalized = (payload.buildings || []).map(normalizeBuilding)
        setBuildings(normalized)
        setCategories(payload.categories || [])
        setMetadata(payload.metadata)
      })
  }, [])

  const selectedCategoryInfo = useMemo(
    () => categories.find((category) => category.key === selectedCategory) || categories[0],
    [categories, selectedCategory],
  )

  const selectedBuildings = useMemo(() => {
    if (selectedCategory === 'all') return buildings
    return buildings.filter((building) => building.categoryKey === selectedCategory)
  }, [buildings, selectedCategory])

  const tabs = [
    ['savings', 'Savings'],
    ['map', 'Clickable Map'],
  ]

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <span className="header-kicker">Portfolio-scale dashboard</span>
          <h1>Cool Corridors</h1>
          <p>Cool Corridors turns Atlanta's uncertified building stock into a retrofit priority map, showing where predictive HVAC scheduling could save the most energy, carbon, and money first.</p>
        </div>
        <div className="header-badge">
          <strong>{selectedBuildings.length ? selectedBuildings.length.toLocaleString() : '...'}</strong>
          <span>{selectedCategoryInfo?.label || 'selected'} buildings</span>
        </div>
      </header>

      {categories.length > 0 && (
        <CategorySelector
          categories={categories}
          selectedCategory={selectedCategory}
          onChange={setSelectedCategory}
        />
      )}

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
        <main className="loading-panel">Loading Cool Corridors portfolio data...</main>
      ) : (
        <main>
          {activeTab === 'savings' && <SavingsTab buildings={selectedBuildings} category={selectedCategoryInfo} />}
          {activeTab === 'map' && <MapTab buildings={selectedBuildings} category={selectedCategoryInfo} />}
          {activeTab === 'table' && <BuildingTableTab buildings={selectedBuildings} category={selectedCategoryInfo} />}
        </main>
      )}

      <div className="bottom-data-action">
        <button className={`table-action ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>
          Building Table Data
        </button>
      </div>

      <footer className="dashboard-footer">
        <span>{metadata?.subgroup || 'Non-certified Atlanta buildings'}</span>
        <span>Simulated savings for demo purposes. Actual savings depend on HVAC system type, controls compatibility, building envelope, occupancy, utility tariffs, and weather.</span>
      </footer>
    </div>
  )
}

export default function App() {
  return <CoolCorridorsDashboard />
}
