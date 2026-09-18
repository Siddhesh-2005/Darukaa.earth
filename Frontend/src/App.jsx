import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './App.css'
import { createQuadrangle, deleteQuadrangle, getQuadrangles } from './services/quadrangleService'

const DISTRICTS = ['Mumbai Suburban', 'Mumbai City', 'Thane', 'Pune']
const DISTRICT_LOCATIONS = {
  'Mumbai Suburban': { center: [72.8777, 19.076], zoom: 12.3 },
  'Mumbai City': { center: [72.8347, 18.96], zoom: 12.3 },
  Thane: { center: [72.9781, 19.2183], zoom: 12.3 },
  Pune: { center: [73.8567, 18.5204], zoom: 11.8 },
}

function toFeature(quadrangle) {
  const coordinates = quadrangle.coordinates || []
  return { type: 'Feature', properties: { ...quadrangle }, geometry: { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] } }
}
function toFeatureCollection(quadrangles) { return { type: 'FeatureCollection', features: quadrangles.map(toFeature) } }
function formatCoordinate(value) { return Number(value).toFixed(5) }

function App() {
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const [district, setDistrict] = useState(DISTRICTS[0])
  const [quadrangles, setQuadrangles] = useState([])
  const [selected, setSelected] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('Loading quadrangles from the API...')
  const [saveState, setSaveState] = useState('idle')
  const mapToken = import.meta.env.VITE_MAPBOX_TOKEN

  useEffect(() => {
    if (!mapToken || !mapContainer.current) return undefined
    mapboxgl.accessToken = mapToken
    const map = new mapboxgl.Map({ container: mapContainer.current, style: 'mapbox://styles/mapbox/light-v11', center: [72.883, 19.082], zoom: 13.2, attributionControl: false })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
    map.on('load', () => {
      map.addSource('quadrangles', { type: 'geojson', data: toFeatureCollection([]) })
      map.addSource('draft', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'quadrangle-fill', type: 'fill', source: 'quadrangles', paint: { 'fill-color': '#4b8f73', 'fill-opacity': 0.15 } })
      map.addLayer({ id: 'quadrangle-line', type: 'line', source: 'quadrangles', paint: { 'line-color': '#26735b', 'line-width': 2 } })
      map.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft', paint: { 'fill-color': '#d27d42', 'fill-opacity': 0.18 } })
      map.addLayer({ id: 'draft-line', type: 'line', source: 'draft', paint: { 'line-color': '#d27d42', 'line-width': 2, 'line-dasharray': [2, 2] } })
      map.on('click', 'quadrangle-fill', (event) => { const feature = event.features?.[0]; if (feature) setSelected({ ...feature.properties, coordinates: typeof feature.properties.coordinates === 'string' ? JSON.parse(feature.properties.coordinates) : feature.properties.coordinates }) })
      map.on('mouseenter', 'quadrangle-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'quadrangle-fill', () => { map.getCanvas().style.cursor = '' })
    })
    return () => map.remove()
  }, [mapToken])

  useEffect(() => {
    const map = mapRef.current
    const location = DISTRICT_LOCATIONS[district]
    if (map && location) map.flyTo({ center: location.center, zoom: location.zoom, essential: true })
  }, [district])

  useEffect(() => { const source = mapRef.current?.getSource('quadrangles'); if (source) source.setData(toFeatureCollection(quadrangles)) }, [quadrangles])
  useEffect(() => {
    const source = mapRef.current?.getSource('draft')
    if (source) source.setData(points.length > 1 ? toFeatureCollection([{ coordinates: points }]) : { type: 'FeatureCollection', features: [] })
  }, [points])

  useEffect(() => {
    if (!mapToken) return undefined
    const map = mapRef.current
    const handleClick = (event) => {
      if (!drawing) return
      setPoints((current) => current.length >= 4 ? current : [...current, [event.lngLat.lng, event.lngLat.lat]])
    }
    map?.on('click', handleClick)
    return () => map?.off('click', handleClick)
  }, [drawing, mapToken])

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => { if (!cancelled) setLoading(true); return getQuadrangles(district) }).then((data) => {
      if (!cancelled) {
        setQuadrangles(data)
        setSelected(data[0] || null)
        setNotice(data.length ? 'Live quadrangles loaded from the API.' : 'No marked areas found for this district.')
      }
    }).catch(() => {
      if (!cancelled) {
        setQuadrangles([])
        setSelected(null)
        setNotice('Unable to load quadrangles from the API.')
      }
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [district])

  const startDrawing = () => { setSelected(null); setPoints([]); setDrawing(true); setSaveState('idle'); setNotice('Click four corners on the map to define a new quadrangle.') }
  const clearSelection = () => { setSelected(null); setPoints([]); setDrawing(false); setSaveState('idle'); setNotice('Selection cleared.') }
  const removeQuadrangle = async (quadrangle) => {
    setQuadrangles((current) => current.filter((item) => item.id !== quadrangle.id))
    if (selected?.id === quadrangle.id) setSelected(null)
    try {
      await deleteQuadrangle(quadrangle.id)
      setNotice(`${quadrangle.id} deleted.`)
    } catch {
      setNotice(`${quadrangle.id} removed for this session. Connect the API to persist deletion.`)
    }
  }
  const saveQuadrangle = async () => {
    if (points.length !== 4) return
    setSaveState('saving')
    const payload = { district, coordinates: points }
    try {
      const saved = await createQuadrangle(payload)
      const next = saved?.coordinates ? saved : { ...payload, id: `Q-${1044 + quadrangles.length}`, status: 'Draft' }
      setQuadrangles((current) => [...current, next]); setSelected(next); setPoints([]); setDrawing(false); setSaveState('saved'); setNotice('Quadrangle saved successfully.')
    } catch {
      const local = { ...payload, id: `Q-${1044 + quadrangles.length}`, status: 'Draft' }
      setQuadrangles((current) => [...current, local]); setSelected(local); setPoints([]); setDrawing(false); setSaveState('saved'); setNotice('Saved locally for this session. Connect the API to persist it.')
    }
  }

  const activePoints = points.length ? points : selected?.coordinates || []
  const fallbackPoint = ([longitude, latitude]) => `${50 + (longitude - 72.87) * 500},${58 + (19.09 - latitude) * 560}`
  const fallbackPolygon = points.length > 1 ? `${points.map(([lng, lat]) => `${50 + (lng - 72.87) * 500},${58 + (19.09 - lat) * 560}`).join(' ')}${points.length === 4 ? ` ${50 + (points[0][0] - 72.87) * 500},${58 + (19.09 - points[0][1]) * 560}` : ''}` : ''
  const handleFallbackClick = (event) => {
    if (!drawing || mapToken) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const longitude = 72.87 + ((event.clientX - bounds.left) / bounds.width) * 0.2
    const latitude = 19.09 - ((event.clientY - bounds.top) / bounds.height) * 0.2
    setPoints((current) => current.length >= 4 ? current : [...current, [longitude, latitude]])
  }

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">D</span><div><strong>DARUKAA.EARTH</strong><span>Urban Analytics</span></div></div><div className="topbar-meta"><span className="status-dot" /> Mapping workspace <span className="divider" /> <span>UTC +05:30</span></div></header>
      <section className="workspace">
        <aside className="sidebar">
          <div className="eyebrow">GEOSPATIAL WORKSPACE</div>
          <div className="sidebar-heading"><div><h1>Quadrangles</h1><p>Define and review urban green areas.</p></div><span className="live-pill"><i /> Live</span></div>
          <label className="field-label" htmlFor="district">District</label><select id="district" value={district} onChange={(event) => setDistrict(event.target.value)}>{DISTRICTS.map((item) => <option key={item}>{item}</option>)}</select>
          <div className="section-rule" /><div className="section-title"><span>Map controls</span><span className="shortcut">⌘ K</span></div>
          <button className={`primary-action ${drawing ? 'active' : ''}`} type="button" onClick={startDrawing}><span className="crosshair">⌖</span>{drawing ? 'Drawing quadrangle' : 'Draw quadrangle'}<span className="action-arrow">→</span></button>
          <button className="secondary-action" type="button" onClick={clearSelection}>Clear selection <span>×</span></button>
          <div className="areas-section"><div className="section-title"><span>Marked areas</span><span>{quadrangles.length}</span></div><div className="areas-list">{quadrangles.length ? quadrangles.map((quadrangle) => <div className={`area-row ${selected?.id === quadrangle.id ? 'active' : ''}`} key={quadrangle.id}><button className="area-name" type="button" onClick={() => { setSelected(quadrangle); setDrawing(false) }}><b>{quadrangle.id}</b><span>{quadrangle.status || 'Marked'}</span></button><button className="delete-area" type="button" title={`Delete ${quadrangle.id}`} aria-label={`Delete ${quadrangle.id}`} onClick={() => removeQuadrangle(quadrangle)}>×</button></div>) : <p className="areas-empty">No areas marked here.</p>}</div></div>
          <div className="sidebar-spacer" /><div className="legend"><div className="legend-row"><span className="legend-swatch selected-swatch" /> Selected area</div><div className="legend-row"><span className="legend-swatch available-swatch" /> Available quadrangle</div><div className="legend-row"><span className="legend-swatch drawing-swatch" /> New boundary</div></div>
          <div className="sidebar-footer"><span className="footer-icon">◒</span><span>Data updates automatically<br /><b>Last synced just now</b></span></div>
        </aside>
        <section className="map-section">
          <div className="map-toolbar"><div className="breadcrumb">Workspace <span>/</span> {district}</div><div className="map-tools"><button type="button" title="Locate me">◎</button><button type="button" title="Map layers">▱</button></div></div>
          <div className={`map-frame ${mapToken ? 'has-mapbox' : 'fallback-map'}`} ref={mapContainer} onClick={handleFallbackClick}>
            {!mapToken && <div className="fallback-grid"><div className="map-label label-one">BANDRA WEST</div><div className="map-label label-two">SANTACRUZ</div><div className="map-label label-three">KHAR</div><svg className="fallback-boundaries" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 23 C25 20 35 39 56 31 S85 22 100 28 M0 60 C28 48 42 73 67 56 S85 60 100 47 M27 0 C23 26 33 48 28 100 M69 0 C62 27 74 48 66 100" /><path className="road" d="M5 83 C22 58 35 59 47 67 S75 78 97 18 M8 10 C37 23 42 39 54 48 S73 52 98 88" />{quadrangles.map((quadrangle) => <polygon key={quadrangle.id} points={quadrangle.coordinates.map(fallbackPoint).join(' ')} className={selected?.id === quadrangle.id ? 'selected-quadrangle' : 'available-quadrangle'} onClick={(event) => { event.stopPropagation(); setSelected(quadrangle) }} />)}</svg>{fallbackPolygon && <svg className="draw-overlay" viewBox="0 0 500 500" preserveAspectRatio="none"><polyline points={fallbackPolygon} /></svg>}</div>}
            {drawing && <div className="drawing-hint"><span className="hint-dot" /> {points.length < 4 ? `Click point ${points.length + 1} of 4` : 'Quadrangle ready'}<small>{points.length === 4 ? 'Review coordinates in the panel' : 'Click directly on the map'}</small></div>}{loading && <div className="map-loading">Updating quadrangles...</div>}<div className="map-attribution">© Mapbox · © OpenStreetMap contributors</div>
          </div><div className="map-footer"><span><b>{quadrangles.length}</b> quadrangles in view</span><span>{district} · Zoom {DISTRICT_LOCATIONS[district].zoom}</span></div>
        </section>
        <aside className="details-panel">
          <div className="panel-top"><div><div className="eyebrow">{drawing ? 'NEW BOUNDARY' : 'DETAILS'}</div><h2>{drawing ? 'Quadrangle draft' : selected ? selected.id : 'No selection'}</h2></div><button className="close-button" type="button" onClick={clearSelection} aria-label="Clear details">×</button></div>
          {activePoints.length ? <><div className="detail-status"><span className={drawing ? 'draft-badge' : 'verified-badge'}>{drawing ? (points.length === 4 ? 'Ready to save' : `${points.length}/4 points`) : selected?.status || 'Verified'}</span><span>{district}</span></div><div className="coordinates-heading"><span>Corner coordinates</span><span>WGS 84</span></div><div className="coordinate-list">{[0, 1, 2, 3].map((index) => { const point = activePoints[index]; return <div className={`coordinate-row ${point ? '' : 'empty'}`} key={index}><span className="point-index">P{index + 1}</span>{point ? <><span>Lat <b>{formatCoordinate(point[1])}</b></span><span>Lng <b>{formatCoordinate(point[0])}</b></span></> : <span className="awaiting">Awaiting point</span>}</div> })}</div><div className="area-summary"><span>Boundary points</span><b>{activePoints.length}/4</b></div>{drawing && <button className="save-button" type="button" disabled={points.length !== 4 || saveState === 'saving'} onClick={saveQuadrangle}>{saveState === 'saving' ? 'Saving...' : 'Save quadrangle'} <span>↗</span></button>}{!drawing && <button className="outline-button" type="button" onClick={startDrawing}>Create adjacent quadrangle <span>+</span></button>}</> : <div className="empty-details"><div className="empty-icon">⌖</div><h3>Nothing selected</h3><p>Select a quadrangle on the map or begin a new boundary.</p><button className="outline-button" type="button" onClick={startDrawing}>Start drawing <span>→</span></button></div>}
          {notice && <div className={`notice ${saveState === 'saved' ? 'success' : ''}`}><span>{saveState === 'saved' ? '✓' : 'i'}</span>{notice}</div>}<div className="panel-note">Coordinates are stored as longitude, latitude pairs for GeoJSON compatibility.</div>
        </aside>
      </section>
    </main>
  )
}

export default App
