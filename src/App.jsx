import React, { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, Tooltip as LeafletTooltip, ZoomControl } from 'react-leaflet'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { getHourlyForecast } from './weather.js'
import { runSimulation } from './simulation.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const ATLANTA_CENTER = [33.755, -84.39]

const priorityColors = {
  0: '#f7d26a',
  1: '#d7ff92',
  2: '#75cda0',
  3: '#67aebd',
}

function Icon({ name }) {
  const paths = {
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
    leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 18 2 18 2c1 6.5-1 14-7 15"/><path d="M2 21c0-3 1.85-5.36 5.08-6.94C9.66 12.8 12 12 16 12"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/></>,
    building: <><path d="M3 21h18M6 21V4h12v17M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    cloud: <><path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function InfoTip({ label, children, sourceName, sourceUrl }) {
  return (
    <details className="info-tip">
      <summary aria-label={`How ${label} is calculated`}>?</summary>
      <div className="info-popover">
        <strong>{label}</strong>
        <p>{children}</p>
        {sourceName && <small>Source: {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceName}</a> : sourceName}</small>}
      </div>
    </details>
  )
}

function CategoryLabel({ children, help, sourceName, sourceUrl }) {
  return <span className="category-label">{children}<InfoTip label={children} sourceName={sourceName} sourceUrl={sourceUrl}>{help}</InfoTip></span>
}

function MetricCard({ icon, value, label, detail, accent, help }) {
  return (
    <article className={`metric-card ${accent}`}>
      <span className="metric-icon"><Icon name={icon} /></span>
      <div><strong>{value}</strong><span className="metric-label">{label}<InfoTip label={label}>{help}</InfoTip></span><small>{detail}</small></div>
    </article>
  )
}

export default function App() {
  const [buildings, setBuildings] = useState(null)
  const [selected, setSelected] = useState(null)
  const [running, setRunning] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetch('/data/buildings.geojson')
      .then((response) => response.json())
      .then((data) => {
        setBuildings(data)
        setSelected(data.features[0].properties)
      })
  }, [])

  const runWeatherSimulation = async () => {
    if (!selected) return
    setRunning(true)
    const weather = await getHourlyForecast()
    await new Promise((resolve) => setTimeout(resolve, 650))
    setForecast(weather)
    setResult(runSimulation(selected, weather.periods))
    setRunning(false)
  }

  useEffect(() => {
    setResult(null)
    setForecast(null)
  }, [selected?.id])

  const chartData = useMemo(() => {
    if (!result || !forecast) return null
    return {
      labels: forecast.periods.map(({ time }) => time.toLocaleTimeString([], { hour: 'numeric' })),
      datasets: [
        {
          label: 'Baseline HVAC',
          data: result.baseline,
          borderColor: '#ef735a',
          backgroundColor: 'rgba(239, 115, 90, .09)',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.38,
          fill: true,
        },
        {
          label: 'Cool Corridors optimized',
          data: result.optimized,
          borderColor: '#b8df76',
          backgroundColor: 'rgba(184, 223, 118, .11)',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.38,
          fill: true,
        },
      ],
    }
  }, [result, forecast])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { color: '#9eaca4', usePointStyle: true, boxWidth: 8, padding: 18, font: { family: 'Inter', size: 11 } } },
      tooltip: { backgroundColor: '#122119', padding: 12, titleColor: '#fff', bodyColor: '#c8d2cc', borderColor: '#2b3d32', borderWidth: 1 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#718078', maxRotation: 0 } },
      y: { grid: { color: 'rgba(255,255,255,.055)' }, ticks: { color: '#718078' }, title: { display: true, text: 'kWh', color: '#718078' }, beginAtZero: true },
    },
  }

  const maxTemp = forecast ? Math.max(...forecast.periods.map((period) => period.temperature)) : 92
  const displayReadiness = result?.readiness ?? selected?.baseReadiness ?? 0

  return (
    <div className="app-shell">
      <header>
        <a className="brand" href="#top" aria-label="Cool Corridors home">
          <span className="brand-mark"><i></i><i></i><i></i></span>
          <span>COOL <b>CORRIDORS</b></span>
        </a>
        <div className="header-center"><span className="live-dot"></span> ATLANTA HEAT RESILIENCE NETWORK</div>
        <div className="network-status"><span>{buildings?.features.length || '—'}</span><small>CONNECTED BUILDINGS</small></div>
      </header>

      <main id="top">
        <section className="intro">
          <div>
            <span className="eyebrow">ATLANTA, GEORGIA <i></i> LIVE DEMONSTRATION</span>
            <h1>Smarter cooling.<br /><em>Stronger communities.</em></h1>
          </div>
          <p>Turn public buildings into climate-ready cooling refuges using weather-aware, grid-smart HVAC pre-cooling.</p>
        </section>

        <section className="workspace">
          <div className="map-panel">
            <div className="panel-heading map-heading">
              <div><span className="section-num">01</span><div><h2>Atlanta Cooling Network</h2><p>Select a public building to model</p></div></div>
              <div className="map-legend"><span><i className="tier-one"></i>Priority 1</span><span><i className="tier-two"></i>Priority 2</span><span><i className="tier-three"></i>Priority 3</span></div>
            </div>
            <div className="map-wrap">
              <MapContainer center={ATLANTA_CENTER} zoom={12} zoomControl={false} scrollWheelZoom={true}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ZoomControl position="bottomright" />
                {buildings?.features.map((feature) => {
                  const building = feature.properties
                  const [longitude, latitude] = feature.geometry.coordinates
                  const isSelected = building.id === selected?.id
                  return (
                    <Marker
                      key={building.id}
                      position={[latitude, longitude]}
                      icon={L.divIcon({
                        className: `building-pin tier-${building.priorityTier}${isSelected ? ' selected-pin' : ''}`,
                        html: `<span style="background:${priorityColors[building.priorityTier] || '#b8df76'}"></span>`,
                        iconSize: isSelected ? [26, 26] : building.priorityTier === 1 ? [20, 20] : [17, 17],
                        iconAnchor: isSelected ? [13, 13] : building.priorityTier === 1 ? [10, 10] : [8.5, 8.5],
                      })}
                      eventHandlers={{ click: () => setSelected(building) }}
                    >
                      <LeafletTooltip direction="top" offset={[0, -8]}>
                        <strong>{building.name}</strong><span>{building.type}</span>
                      </LeafletTooltip>
                    </Marker>
                  )
                })}
              </MapContainer>
              <div className="map-badge"><Icon name="building" /><span><b>{buildings?.features.length || 0} BUILDINGS</b><small>CONNECTED</small></span></div>
            </div>
          </div>

          <aside className="details-panel">
            <div className="panel-heading"><div><span className="section-num">02</span><div><h2>Building Intelligence</h2><p>Asset profile & controls</p></div></div></div>
            {selected ? (
              <div className="details-content">
                <div className="building-title">
                  <span className="building-icon"><Icon name="building" /></span>
                  <div><span>{selected.type}</span><h3>{selected.name}</h3><p><Icon name="pin" /> {selected.address}</p></div>
                </div>
                <div className="spec-grid">
                  <div><CategoryLabel help={`${selected.sqftStatus}. ${selected.sqftDisplay || 'Gross building floor area used to scale the HVAC load model.'}`} sourceName={selected.sqftSourceName} sourceUrl={selected.sqftSourceUrl}>FLOOR AREA</CategoryLabel><b>{selected.sqft.toLocaleString()} <small>ft²</small></b></div>
                  <div><CategoryLabel help={`${selected.capacityStatus}. Estimated number of people the building can accommodate as a cooling refuge.`} sourceName={selected.capacitySourceName} sourceUrl={selected.capacitySourceUrl}>REFUGE CAPACITY</CategoryLabel><b>{selected.capacity.toLocaleString()} <small>people</small></b></div>
                  <div><CategoryLabel help="Type of mechanical cooling system recorded or estimated for this facility.">HVAC SYSTEM</CategoryLabel><b className="zone">{selected.hvacType}</b></div>
                  <div><CategoryLabel help={`${selected.hvacEfficiencyStatus}. Efficiency is expressed using the source system's rating, such as SEER or a descriptive plant rating.`}>EFFICIENCY</CategoryLabel><b className="zone">{selected.hvacEfficiency}</b></div>
                  <div><CategoryLabel help={`${selected.coolingTonsStatus}. One cooling ton represents roughly 12,000 BTU of heat removal per hour.`} sourceName={selected.coolingTonsSourceName} sourceUrl={selected.coolingTonsSourceUrl}>COOLING CAPACITY</CategoryLabel><b>{selected.coolingTons.toLocaleString()} <small>tons</small></b></div>
                  <div><CategoryLabel help={`${selected.thermalLagMinutesStatus}. Estimated time the building's thermal mass continues providing cooling after HVAC output changes.`} sourceName={selected.thermalLagMinutesSourceName} sourceUrl={selected.thermalLagMinutesSourceUrl}>THERMAL LAG</CategoryLabel><b>{selected.thermalLagMinutes} <small>min</small></b></div>
                  <div><CategoryLabel help={`${selected.operatingHoursStatus}. Normal daily hours used to understand when the facility can serve occupants.`} sourceName={selected.operatingHoursSourceName} sourceUrl={selected.operatingHoursSourceUrl}>OPERATING HOURS</CategoryLabel><b className="zone">{selected.operatingHours}</b></div>
                  <div><CategoryLabel help={`${selected.heatVulnerabilityScoreStatus}. A 0–100 model score combining neighborhood heat exposure and community vulnerability; higher means greater need.`}>HEAT VULNERABILITY</CategoryLabel><b>{selected.heatVulnerabilityScore} <small>/ 100</small></b></div>
                </div>
                <div className="asset-meta"><span>Built {selected.year}</span><i></i><span>{selected.zone}</span><i></i><span>Priority tier {selected.priorityTier}</span></div>
                <div className="readiness-block">
                  <div><CategoryLabel help={`${selected.baseReadinessStatus}. The starting score represents facility readiness; after simulation it also includes modeled peak-load reduction and pre-cooling benefit.`}>COOLING REFUGE READINESS</CategoryLabel><b>{displayReadiness}%</b></div>
                  <div className="progress"><i style={{ width: `${displayReadiness}%` }} /></div>
                  <p><Icon name="check" /> HVAC and backup power systems online</p>
                </div>
                <div className="weather-card">
                  <div><span className="weather-icon"><Icon name="cloud" /></span><span><small className="category-label">FORECAST PEAK<InfoTip label="Forecast peak">Highest temperature in the 12 hourly forecast periods used by the simulation.</InfoTip></small><b>{maxTemp}°F</b></span></div>
                  <span><small className="category-label">DATA SOURCE<InfoTip label="Weather data source">Live hourly forecast from the U.S. National Weather Service. The app uses its local Atlanta demo forecast if the API is unavailable.</InfoTip></small><b>{forecast?.source || 'NWS / Atlanta'}</b></span>
                </div>
                <button className="simulate-button" onClick={runWeatherSimulation} disabled={running}>
                  <span>{running ? 'ANALYZING WEATHER...' : 'RUN WEATHER SIMULATION'}</span>
                  {running ? <i className="spinner" /> : <Icon name="arrow" />}
                </button>
                <p className="button-note">12-hour forecast <i></i> Thermal load model <i></i> Grid-aware dispatch</p>
              </div>
            ) : <div className="loading">Loading building network...</div>}
          </aside>
        </section>

        <section className={`results ${result ? 'has-results' : ''}`}>
          <div className="results-heading">
            <div><span className="section-num">03</span><div><h2>Simulation Impact</h2><p>{result ? `Optimized strategy for ${selected.name}` : 'Run a simulation to calculate the impact'}</p></div></div>
            {result && <span className="complete"><Icon name="check" /> ANALYSIS COMPLETE</span>}
          </div>

          {!result ? (
            <div className="empty-results"><span><Icon name="chart" /></span><p>Select a building and run the weather simulation to reveal a 12-hour energy strategy.</p></div>
          ) : (
            <div className="results-body">
              <div className="metrics-grid">
                <MetricCard icon="bolt" value={`${result.saved.toFixed(0)} kWh`} label="ENERGY SAVED" detail={`${((result.saved / result.baselineTotal) * 100).toFixed(0)}% reduction`} accent="lime" help="Baseline 12-hour HVAC energy minus optimized pre-cooling energy." />
                <MetricCard icon="chart" value={`$${result.costSaved.toFixed(0)}`} label="COST SAVED" detail={`$${selected.electricityPriceKwh.toFixed(2)}/kWh`} accent="gold" help={`Energy saved multiplied by this building's dataset electricity rate of $${selected.electricityPriceKwh.toFixed(2)} per kWh.`} />
                <MetricCard icon="leaf" value={`${result.co2Avoided.toFixed(0)} lbs`} label="CO₂ AVOIDED" detail="Grid emissions" accent="green" help="Energy saved multiplied by the demo grid-emissions factor of 0.82 pounds of CO₂ per kWh." />
                <MetricCard icon="users" value={`${result.readiness}%`} label="REFUGE READY" detail={`${selected.capacity.toLocaleString()} people`} accent="blue" help="Dataset base-readiness score plus modeled pre-cooling and peak-reduction benefit, capped at 99%." />
              </div>
              <div className="chart-card">
                <div className="chart-title"><div><span className="category-label">HVAC ENERGY PROFILE<InfoTip label="HVAC energy profile">Baseline load is estimated from floor area, forecast temperature, time of day, and cooling capacity. Optimized load increases early cooling, then reduces HVAC use through the hottest hours.</InfoTip></span><h3>Pre-cool early. Coast through the peak.</h3></div><div className="peak-pill"><span className="category-label">PEAK REDUCTION<InfoTip label="Peak reduction">Difference between the highest baseline hourly energy value and the highest optimized hourly value.</InfoTip></span><b>{result.peakReduction.toFixed(1)} kWh</b></div></div>
                <div className="chart-container"><Line data={chartData} options={chartOptions} /></div>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer><span>COOL CORRIDORS / ATLANTA</span><p>Built for resilient cities and the people who power them.</p><span>PROTOTYPE 2026</span></footer>
    </div>
  )
}
