import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, LabelList,
} from 'recharts'
import {
  parseRows, computeMetrics,
  isWon, isNoShow, isCancel, isShow, isReschedule,
  parseCash, getDateStr,
} from './utils'
import UpcomingTab    from './UpcomingTab'
import TrajectoryTab  from './TrajectoryTab'
import ClosesTab      from './ClosesTab'
import './App.css'

const SHEET_ID   = import.meta.env.VITE_SHEET_ID
const API_KEY    = import.meta.env.VITE_API_KEY
const SHEET_NAME = 'BOOKED CALLS'

const OUTCOME_COLORS = {
  Won:               '#3fb950',
  Lost:              '#f85149',
  'No Show':         '#6e7681',
  Cancel:            '#d29922',
  'Follow Up (Hot)': '#58a6ff',
  'Follow Up':       '#79c0ff',
  'Hot Lead':        '#f0883e',
  Other:             '#484f58',
}

const fmt$ = n =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtPct = n => `${(n || 0).toFixed(1)}%`

function StatCard({ label, value, color, onClick }) {
  return (
    <div
      className={`stat-card${color ? ` stat-${color}` : ''}${onClick ? ' stat-card--clickable' : ''}`}
      onClick={onClick}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {onClick && <div className="stat-card-hint">click to view</div>}
    </div>
  )
}

function MissingModal({ rows, onClose }) {
  if (!rows) return null

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const fmtDate = str => {
    if (!str) return '—'
    const d = new Date(str + 'T00:00:00')
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Missing Outcomes</h2>
            <p className="modal-sub">{rows.length} call{rows.length !== 1 ? 's' : ''} need an outcome filled in</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
              All outcomes filled in 🎉
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Closer</th>
                  <th style={{ textAlign: 'left' }}>Lead</th>
                  <th style={{ textAlign: 'left' }}>Date</th>
                  <th style={{ textAlign: 'left' }}>Call Type</th>
                  <th style={{ textAlign: 'left' }}>Email</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'left', fontWeight: 600 }}>{r.closer || '—'}</td>
                    <td style={{ textAlign: 'left' }}>
                      {[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--yellow)' }}>
                      {fmtDate(getDateStr(r.date))}
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <span className="call-type-badge">{r.callType || '—'}</span>
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>
                      {r.email || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title }) {
  return <div className="section-header">{title}</div>
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('performance')
  const [showMissing, setShowMissing] = useState(false)
  const [rawData, setRawData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [closer,    setCloser]    = useState('All')
  const [callType,  setCallType]  = useState('All')

  const [targetBookToClose, setTargetBookToClose] = useState(
    () => Number(localStorage.getItem('lgs_bookToClose') || 20)
  )
  const [targetAvgDeal, setTargetAvgDeal] = useState(
    () => Number(localStorage.getItem('lgs_avgDeal') || 600)
  )

  useEffect(() => {
    localStorage.setItem('lgs_bookToClose', targetBookToClose)
    localStorage.setItem('lgs_avgDeal', targetAvgDeal)
  }, [targetBookToClose, targetAvgDeal])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const range = encodeURIComponent(`${SHEET_NAME}!A:O`)
      const url   = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`
      const res   = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setRawData(parseRows(json.values))
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const closers = useMemo(() => [
    'All',
    ...Array.from(new Set(rawData.map(r => r.closer).filter(Boolean))).sort(),
  ], [rawData])

  const callTypes = useMemo(() => [
    'All',
    ...Array.from(new Set(rawData.map(r => r.callType).filter(Boolean))).sort(),
  ], [rawData])

  const filteredData = useMemo(() => rawData.filter(r => {
    if (closer   !== 'All' && r.closer   !== closer)   return false
    if (callType !== 'All' && r.callType !== callType)  return false
    if (startDate || endDate) {
      const ds = getDateStr(r.date)
      if (!ds) return false
      if (startDate && ds < startDate) return false
      if (endDate   && ds > endDate)   return false
    }
    return true
  }), [rawData, closer, callType, startDate, endDate])

  const todayStr = useMemo(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  }, [])

  const pastData = useMemo(() => filteredData.filter(r => {
    const ds = getDateStr(r.date)
    if (!ds) return true
    if (ds < todayStr) return true
    if (ds === todayStr) return !!(r.outcome && r.outcome.trim())
    return false
  }), [filteredData, todayStr])

  const m = useMemo(() => {
    const base        = computeMetrics(pastData)
    const totalBooked = filteredData.length
    return {
      ...base,
      totalBooked,
      totalCallsHad:   pastData.length - base.totalReschedules,
      bookToCloseRate: totalBooked > 0 ? (base.totalWins / totalBooked) * 100 : 0,
    }
  }, [pastData, filteredData])

  // Discovery / ad booking stats — scoped to Meta-sourced calls only, regardless of the Call Type filter above
  const isMetaSourced = r => (r.callType || '').trim().toLowerCase().startsWith('meta')

  const discoveryData = useMemo(() => rawData.filter(r => {
    if (closer !== 'All' && r.closer !== closer) return false
    if (!isMetaSourced(r)) return false
    if (startDate || endDate) {
      const ds = getDateStr(r.date)
      if (!ds) return false
      if (startDate && ds < startDate) return false
      if (endDate   && ds > endDate)   return false
    }
    return true
  }), [rawData, closer, startDate, endDate])

  const discoveryPastData = useMemo(() => discoveryData.filter(r => {
    const ds = getDateStr(r.date)
    if (!ds) return true
    if (ds < todayStr) return true
    if (ds === todayStr) return !!(r.outcome && r.outcome.trim())
    return false
  }), [discoveryData, todayStr])

  const dm = useMemo(() => {
    const base        = computeMetrics(discoveryPastData)
    const totalBooked = discoveryData.length
    return {
      ...base,
      totalBooked,
      totalCallsHad: discoveryPastData.length - base.totalReschedules,
    }
  }, [discoveryPastData, discoveryData])

  const outcomeData = useMemo(() => {
    const g = {}
    pastData.forEach(r => {
      const o = r.outcome
      let group
      if (!o || !o.trim()) return
      else if (isWon(o))            group = 'Won'
      else if (o === 'Lost')        group = 'Lost'
      else if (isNoShow(o))         group = 'No Show'
      else if (isCancel(o))         group = 'Cancel'
      else if (o === 'Follow Up (Hot)') group = 'Follow Up (Hot)'
      else if (o.startsWith('Follow Up')) group = 'Follow Up'
      else if (o === 'Hot Lead')    group = 'Hot Lead'
      else                          group = o
      g[group] = (g[group] || 0) + 1
    })
    return Object.entries(g)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [pastData])

  const timelineData = useMemo(() => {
    const wm = {}
    pastData.forEach(r => {
      const ds = getDateStr(r.date)
      if (!ds) return
      const d  = new Date(ds + 'T00:00:00')
      const ws = new Date(d)
      ws.setDate(d.getDate() - d.getDay())
      const key = getDateStr(ws) || ''
      if (!key) return
      if (!wm[key]) {
        wm[key] = { key, label: `${ws.getMonth() + 1}/${ws.getDate()}`, Booked: 0, Shows: 0, Wins: 0 }
      }
      wm[key].Booked++
      if (isShow(r.outcome)) wm[key].Shows++
      if (isWon(r.outcome))  wm[key].Wins++
    })
    return Object.values(wm).sort((a, b) => a.key.localeCompare(b.key))
  }, [pastData])

  const closerData = useMemo(() => {
    const map = {}
    filteredData.forEach(r => {
      const n = r.closer || 'Unknown'
      if (!map[n]) map[n] = { all: [], past: [] }
      map[n].all.push(r)
    })
    pastData.forEach(r => {
      const n = r.closer || 'Unknown'
      if (!map[n]) map[n] = { all: [], past: [] }
      map[n].past.push(r)
    })
    return Object.entries(map)
      .map(([name, { all, past }]) => {
        const metrics     = computeMetrics(past)
        const totalBooked = all.length
        return {
          name,
          ...metrics,
          totalBooked,
          bookToCloseRate: totalBooked > 0 ? (metrics.totalWins / totalBooked) * 100 : 0,
        }
      })
      .sort((a, b) => b.totalCash - a.totalCash)
  }, [filteredData, pastData])

  const missingRows = useMemo(() =>
    pastData
      .filter(r => !r.outcome || !r.outcome.trim())
      .sort((a, b) => (getDateStr(b.date) || '').localeCompare(getDateStr(a.date) || '')),
  [pastData])

  const proj = useMemo(() => {
    const wins = Math.round(m.totalBooked * (targetBookToClose / 100))
    return { wins, cash: wins * targetAvgDeal }
  }, [m.totalBooked, targetBookToClose, targetAvgDeal])

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setCloser('All')
    setCallType('All')
  }

  const hasFilters = startDate || endDate || closer !== 'All' || callType !== 'All'

  const upcomingCount = rawData.filter(r => {
    const ds = r.date ? new Date(r.date) : null
    return ds && ds >= new Date(new Date().toDateString())
  }).length

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>LGS Dashboard</h1>
          {lastUpdated && (
            <span className="header-sub">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
        <button className="btn-refresh" onClick={fetchData} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {/* Tab Nav — desktop */}
      <div className="tab-nav">
        <button className={`tab-btn${tab === 'performance' ? ' tab-btn-active' : ''}`} onClick={() => setTab('performance')}>Performance</button>
        <button className={`tab-btn${tab === 'upcoming'    ? ' tab-btn-active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming
          {upcomingCount > 0 && <span className="tab-badge">{upcomingCount}</span>}
        </button>
        <button className={`tab-btn${tab === 'trajectory'  ? ' tab-btn-active' : ''}`} onClick={() => setTab('trajectory')}>Trajectory</button>
        <button className={`tab-btn${tab === 'closes'      ? ' tab-btn-active' : ''}`} onClick={() => setTab('closes')}>Closes</button>
      </div>

      {/* Tab Nav — mobile dropdown */}
      {(() => {
        const tabs = [
          { id: 'performance', label: 'Performance' },
          { id: 'upcoming',    label: 'Upcoming' },
          { id: 'trajectory',  label: 'Trajectory' },
          { id: 'closes',      label: 'Closes' },
        ]
        return (
          <div className="tab-nav-mobile">
            <select className="tab-nav-select" value={tab} onChange={e => setTab(e.target.value)}>
              {tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <span className="tab-nav-select-arrow">▾</span>
          </div>
        )
      })()}

      {tab === 'upcoming'   && <UpcomingTab   rawData={rawData} />}
      {tab === 'trajectory' && <TrajectoryTab rawData={rawData} />}
      {tab === 'closes'     && <ClosesTab     rawData={rawData} />}

      {tab === 'performance' && <>

        {error && (
          <div className="error-banner">
            <span>Error: {error}</span>
            <button onClick={fetchData}>Retry</button>
          </div>
        )}

        {/* Filters */}
        <div className="filters">
          <div className="filter-item">
            <label>From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="filter-item">
            <label>To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="filter-item">
            <label>Closer</label>
            <select value={closer} onChange={e => setCloser(e.target.value)}>
              {closers.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Call Type</label>
            <select value={callType} onChange={e => setCallType(e.target.value)}>
              {callTypes.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-actions">
            {hasFilters && (
              <button className="btn-clear" onClick={clearFilters}>Clear Filters</button>
            )}
            <span className="filter-count">
              {filteredData.length}
              {rawData.length !== filteredData.length && ` / ${rawData.length}`} rows
            </span>
          </div>
        </div>

        {/* VOLUME */}
        <SectionHeader title="Volume" />
        <div className="cards-grid cards-grid--6">
          <StatCard label="Total Calls Booked"  value={m.totalBooked} />
          <StatCard label="Total Calls Had"      value={m.totalCallsHad}  color="blue" />
          <StatCard label="Total Shows"          value={m.totalShows}     color="green" />
          <StatCard label="Total No Shows"       value={m.totalNoShows}   color="red" />
          <StatCard label="Total Cancels"        value={m.totalCancels}   color="yellow" />
          <StatCard
            label="Missing Outcomes"
            value={m.missingOutcomes}
            color={m.missingOutcomes > 0 ? 'muted' : null}
            onClick={m.missingOutcomes > 0 ? () => setShowMissing(true) : null}
          />
        </div>

        {showMissing && (
          <MissingModal rows={missingRows} onClose={() => setShowMissing(false)} />
        )}

        {/* CONVERSION */}
        <SectionHeader title="Conversion" />
        <div className="cards-grid">
          <StatCard
            label="Book-to-Close Rate"
            value={fmtPct(m.bookToCloseRate)}
            color={m.bookToCloseRate >= 20 ? 'green' : m.bookToCloseRate >= 10 ? 'yellow' : 'red'}
          />
          <StatCard
            label="Show Rate"
            value={fmtPct(m.showRate)}
            color={m.showRate >= 70 ? 'green' : m.showRate >= 50 ? 'yellow' : 'red'}
          />
          <StatCard label="Total Wins"        value={m.totalWins}     color="green" />
          <StatCard label="Follow Up (Hot)"   value={m.hotFollowUps}  color="blue" />
        </div>

        {/* REVENUE */}
        <SectionHeader title="Revenue" />
        <div className="cards-grid">
          <StatCard label="Total Cash Collected"   value={fmt$(m.totalCash)}       color="green" />
          <StatCard label="Avg Deal Size"           value={fmt$(m.avgDealSize)} />
          <StatCard label="Cash / Booked Call"      value={fmt$(m.cashPerBooked)} />
          <StatCard label="Cash / Shown Call"       value={fmt$(m.cashPerShown)} />
        </div>

        {/* DISCOVERY / AD BOOKING STATS */}
        <SectionHeader title="Discovery / Ad Booking Stats (Meta only)" />
        <div className="cards-grid">
          <StatCard label="Discoveries Booked"     value={dm.totalBooked} />
          <StatCard label="First Calls Had"        value={dm.totalCallsHad} color="blue" />
          <StatCard
            label="Show Rate (First Call)"
            value={fmtPct(dm.showRate)}
            color={dm.showRate >= 70 ? 'green' : dm.showRate >= 50 ? 'yellow' : 'red'}
          />
          <StatCard
            label="Show-to-Close Rate"
            value={fmtPct(dm.closeRate)}
            color={dm.closeRate >= 25 ? 'green' : dm.closeRate >= 15 ? 'yellow' : 'red'}
          />
        </div>

        {/* CHARTS */}
        <div className="charts-row">
          <div className="chart-box">
            <h3>Outcome Breakdown</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={outcomeData} margin={{ top: 16, right: 8, bottom: 52, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d333b" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                  {outcomeData.map(entry => (
                    <Cell key={entry.name} fill={OUTCOME_COLORS[entry.name] || '#484f58'} />
                  ))}
                  <LabelList dataKey="value" position="top" style={{ fill: '#8b949e', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-box">
            <h3>Weekly Volume</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timelineData} margin={{ top: 16, right: 8, bottom: 52, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d333b" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 52, fontSize: 12, color: '#8b949e' }} />
                <Line type="monotone" dataKey="Booked" stroke="#58a6ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Shows"  stroke="#3fb950" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Wins"   stroke="#d29922" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CLOSER BREAKDOWN */}
        {closerData.length > 1 && (
          <>
            <SectionHeader title="Closer Breakdown" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Closer', 'Booked', 'Wins', 'Book-to-Close', 'Show Rate', 'Close Rate', 'Cash', 'Avg Deal'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closerData.map(c => (
                    <tr key={c.name}>
                      <td className="td-name">{c.name}</td>
                      <td>{c.totalBooked}</td>
                      <td>{c.totalWins}</td>
                      <td className={c.bookToCloseRate >= 20 ? 'td-good' : c.bookToCloseRate >= 10 ? 'td-warn' : 'td-bad'}>
                        {fmtPct(c.bookToCloseRate)}
                      </td>
                      <td className={c.showRate >= 70 ? 'td-good' : c.showRate >= 50 ? 'td-warn' : 'td-bad'}>
                        {fmtPct(c.showRate)}
                      </td>
                      <td className={c.closeRate >= 25 ? 'td-good' : c.closeRate >= 15 ? 'td-warn' : 'td-bad'}>
                        {fmtPct(c.closeRate)}
                      </td>
                      <td className="td-good">{fmt$(c.totalCash)}</td>
                      <td>{fmt$(c.avgDealSize)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PROJECTION CALCULATOR */}
        <SectionHeader title="Projection Calculator" />
        <div className="proj-card">
          <p className="proj-note">Edit yellow cells to model scenarios</p>
          <div className="table-wrap">
            <table className="proj-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Calls Booked</th>
                  <th>Book-to-Close</th>
                  <th>Total Wins</th>
                  <th>Avg Deal Size</th>
                  <th>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="proj-row-label">Actuals</td>
                  <td>{m.totalBooked}</td>
                  <td className={m.bookToCloseRate >= targetBookToClose ? 'td-good' : 'td-warn'}>
                    {fmtPct(m.bookToCloseRate)}
                  </td>
                  <td>{m.totalWins}</td>
                  <td>{fmt$(m.avgDealSize)}</td>
                  <td className="td-good">{fmt$(m.totalCash)}</td>
                </tr>
                <tr className="proj-targets-row">
                  <td className="proj-row-label">Targets</td>
                  <td>{m.totalBooked}</td>
                  <td>
                    <div className="proj-input-wrap">
                      <input
                        type="number"
                        className="proj-input"
                        value={targetBookToClose}
                        onChange={e => setTargetBookToClose(Number(e.target.value))}
                        min="0" max="100"
                      />
                      <span>%</span>
                    </div>
                  </td>
                  <td className="td-proj">{proj.wins}</td>
                  <td>
                    <div className="proj-input-wrap">
                      <span>$</span>
                      <input
                        type="number"
                        className="proj-input proj-input-wide"
                        value={targetAvgDeal}
                        onChange={e => setTargetAvgDeal(Number(e.target.value))}
                        min="0"
                      />
                    </div>
                  </td>
                  <td className="td-proj">{fmt$(proj.cash)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </>}
    </div>
  )
}
