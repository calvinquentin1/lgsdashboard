import { useState, useMemo } from 'react'
import { isWon, parseCash, getDateStr } from './utils'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const fmt$ = n =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtDate = str => {
  if (!str) return '—'
  const d = new Date(str + 'T00:00:00')
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export default function ClosesTab({ rawData }) {
  const now = new Date()

  const [selectedYear,   setSelectedYear]   = useState(now.getFullYear())
  const [selectedMonth,  setSelectedMonth]  = useState(now.getMonth())
  const [selectedCloser, setSelectedCloser] = useState('All')
  const [selectedCallType, setSelectedCallType] = useState('All')
  const [sortField, setSortField] = useState('date')
  const [sortDir,   setSortDir]   = useState('desc')

  const allRelevant = useMemo(() =>
    rawData.filter(r => r.closer || r.date),
  [rawData])

  const closers = useMemo(() => [
    'All',
    ...Array.from(new Set(allRelevant.map(r => r.closer).filter(Boolean))).sort(),
  ], [allRelevant])

  const callTypeOptions = useMemo(() => [
    'All',
    ...Array.from(new Set(allRelevant.map(r => r.callType).filter(Boolean))).sort(),
  ], [allRelevant])

  const years = useMemo(() => {
    const ys = new Set(allRelevant.map(r => {
      const ds = getDateStr(r.date)
      return ds ? parseInt(ds.slice(0, 4)) : null
    }).filter(Boolean))
    return Array.from(ys).sort((a, b) => b - a)
  }, [allRelevant])

  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`

  const inPeriod = r => {
    const ds = getDateStr(r.date)
    if (!ds) return false
    if (!ds.startsWith(monthStr)) return false
    if (selectedCloser !== 'All' && r.closer !== selectedCloser) return false
    if (selectedCallType !== 'All' && r.callType !== selectedCallType) return false
    return true
  }

  const filteredBooked = useMemo(() =>
    allRelevant.filter(inPeriod),
  [allRelevant, selectedYear, selectedMonth, selectedCloser, selectedCallType])

  const filteredWins = useMemo(() =>
    filteredBooked.filter(r => isWon(r.outcome)),
  [filteredBooked])

  const sortedWins = useMemo(() => {
    return [...filteredWins].sort((a, b) => {
      let va, vb
      if (sortField === 'date') {
        va = getDateStr(a.date) || ''
        vb = getDateStr(b.date) || ''
      } else if (sortField === 'cash') {
        va = parseCash(a.cash)
        vb = parseCash(b.cash)
      } else if (sortField === 'closer') {
        va = a.closer || ''
        vb = b.closer || ''
      } else if (sortField === 'callType') {
        va = a.callType || ''
        vb = b.callType || ''
      } else {
        va = ''
        vb = ''
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [filteredWins, sortField, sortDir])

  const closerSummary = useMemo(() => {
    const map = {}
    filteredBooked.forEach(r => {
      const n = r.closer || 'Unknown'
      if (!map[n]) map[n] = { booked: 0, wins: 0, cash: 0 }
      map[n].booked++
      if (isWon(r.outcome)) {
        map[n].wins++
        map[n].cash += parseCash(r.cash)
      }
    })
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, rate: v.booked > 0 ? v.wins / v.booked : 0 }))
      .sort((a, b) => b.cash - a.cash)
  }, [filteredBooked])

  const totalCash = useMemo(() =>
    filteredWins.reduce((s, r) => s + parseCash(r.cash), 0),
  [filteredWins])

  const handleSort = field => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="sort-icon">↕</span>
    return <span className="sort-icon sort-icon--active">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const periodLabel = `${MONTHS[selectedMonth]} ${selectedYear}${selectedCloser !== 'All' ? ` — ${selectedCloser}` : ''}`

  return (
    <div className="closes-tab">

      <div className="closes-controls">
        <div className="closes-month-picker">
          <label>Month</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.length > 0
              ? years.map(y => <option key={y} value={y}>{y}</option>)
              : <option value={now.getFullYear()}>{now.getFullYear()}</option>
            }
          </select>
        </div>
        <div className="filter-item">
          <label>Call Type</label>
          <select value={selectedCallType} onChange={e => setSelectedCallType(e.target.value)}>
            {callTypeOptions.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="filter-item">
          <label>Closer</label>
          <select value={selectedCloser} onChange={e => setSelectedCloser(e.target.value)}>
            {closers.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="closes-summary-row">
        <div className="closes-summary-card closes-summary-card--total">
          <div className="closes-summary-label">Booked</div>
          <div className="closes-summary-value">{filteredBooked.length}</div>
          <div className="closes-summary-sub">{filteredWins.length} closes</div>
        </div>
        <div className="closes-summary-card closes-summary-card--rate">
          <div className="closes-summary-label">Book-to-Close</div>
          <div className="closes-summary-value">
            {filteredBooked.length > 0
              ? `${((filteredWins.length / filteredBooked.length) * 100).toFixed(1)}%`
              : '—'}
          </div>
          <div className="closes-summary-sub">{periodLabel}</div>
        </div>
        <div className="closes-summary-card closes-summary-card--cash">
          <div className="closes-summary-label">Total Cash</div>
          <div className="closes-summary-value">{fmt$(totalCash)}</div>
          <div className="closes-summary-sub">
            {filteredWins.length > 0 ? `${fmt$(totalCash / filteredWins.length)} avg deal` : 'no closes'}
          </div>
        </div>
        {closerSummary.map(c => (
          <div key={c.name} className="closes-summary-card">
            <div className="closes-summary-label">{c.name}</div>
            <div className="closes-summary-value closes-summary-value--closer">
              {c.booked > 0 ? `${(c.rate * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="closes-summary-sub">{c.wins}/{c.booked} booked · {fmt$(c.cash)}</div>
          </div>
        ))}
      </div>

      {filteredWins.length === 0 ? (
        <div className="closes-empty">
          No closes found for {periodLabel}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table closes-table">
            <thead>
              <tr>
                <th className="th-sortable" onClick={() => handleSort('date')}>
                  Date <SortIcon field="date" />
                </th>
                <th className="th-sortable" onClick={() => handleSort('closer')}>
                  Closer <SortIcon field="closer" />
                </th>
                <th style={{ textAlign: 'left' }}>Lead</th>
                <th className="th-sortable" onClick={() => handleSort('callType')}>
                  Call Type <SortIcon field="callType" />
                </th>
                <th className="th-sortable" onClick={() => handleSort('cash')}>
                  Cash <SortIcon field="cash" />
                </th>
                <th style={{ textAlign: 'left' }}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {sortedWins.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--muted)' }}>
                    {fmtDate(getDateStr(r.date))}
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.closer || '—'}</td>
                  <td style={{ textAlign: 'left' }}>
                    {[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="call-type-badge">{r.callType || '—'}</span>
                  </td>
                  <td style={{ color: 'var(--green)', fontWeight: 700 }}>
                    {parseCash(r.cash) > 0 ? fmt$(parseCash(r.cash)) : '—'}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="outcome-badge outcome-badge--won">{r.outcome}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
