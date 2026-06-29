import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { computeMetrics, getDateStr, parseCash, isWon } from './utils'

const fmt$0 = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
const fmtPct = n => `${(n || 0).toFixed(1)}%`

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function todayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}

function daysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function TrendBadge({ current, previous }) {
  if (!previous) return <span className="trend-neutral">—</span>
  const pct = ((current - previous) / previous) * 100
  const up  = pct >= 0
  return (
    <span className={`trend-badge ${up ? 'trend-up' : 'trend-down'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
      <span className="trend-vs">vs prev week</span>
    </span>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.dataKey === 'cash' ? fmt$0(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function TrajectoryTab({ rawData }) {
  const today = todayStr()

  const pastCalls = useMemo(() => rawData.filter(r => {
    const ds = getDateStr(r.date)
    if (!ds) return true
    if (ds < today) return true
    if (ds === today) return !!(r.outcome && r.outcome.trim())
    return false
  }), [rawData, today])

  const last7Start   = daysAgo(7)
  const prev7Start   = daysAgo(14)
  const last30Start  = daysAgo(30)

  const thisMonthStart = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`
  })()

  const lastMonthStart = (() => {
    const n = new Date(); n.setMonth(n.getMonth() - 1)
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`
  })()

  const lastMonthEnd = (() => {
    const n = new Date(); n.setDate(0)
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
  })()

  const inRange = (r, from, to) => {
    const ds = getDateStr(r.date)
    return ds && ds >= from && (!to || ds <= to)
  }

  const last7Data     = useMemo(() => pastCalls.filter(r => inRange(r, last7Start)),               [pastCalls, last7Start])
  const prev7Data     = useMemo(() => pastCalls.filter(r => inRange(r, prev7Start, last7Start)),   [pastCalls, prev7Start, last7Start])
  const last30Data    = useMemo(() => pastCalls.filter(r => inRange(r, last30Start)),              [pastCalls, last30Start])
  const thisMonthData = useMemo(() => pastCalls.filter(r => inRange(r, thisMonthStart)),           [pastCalls, thisMonthStart])
  const lastMonthData = useMemo(() => pastCalls.filter(r => inRange(r, lastMonthStart, lastMonthEnd)), [pastCalls, lastMonthStart, lastMonthEnd])

  const m7     = useMemo(() => computeMetrics(last7Data),    [last7Data])
  const mPrev7 = useMemo(() => computeMetrics(prev7Data),    [prev7Data])
  const m30    = useMemo(() => computeMetrics(last30Data),   [last30Data])
  const mThis  = useMemo(() => computeMetrics(thisMonthData),[thisMonthData])
  const mLast  = useMemo(() => computeMetrics(lastMonthData),[lastMonthData])
  const mAll   = useMemo(() => computeMetrics(pastCalls),    [pastCalls])

  const today_d       = new Date()
  const daysInMonth   = new Date(today_d.getFullYear(), today_d.getMonth() + 1, 0).getDate()
  const dayOfMonth    = today_d.getDate()
  const daysRemaining = daysInMonth - dayOfMonth
  const monthRunRate  = dayOfMonth > 0 ? (mThis.totalCash / dayOfMonth) * daysInMonth : 0

  const proj = [
    { label: 'Last 7 days pace',  weekly: m7.totalCash,          monthly: m7.totalCash * 4.33,             yearly: m7.totalCash * 52,                closeRate: m7.closeRate },
    { label: 'Last 30 days pace', weekly: m30.totalCash / 4.33,  monthly: m30.totalCash,                   yearly: m30.totalCash * 12,               closeRate: m30.closeRate },
    { label: 'Last month pace',   weekly: mLast.totalCash / 4.33,monthly: mLast.totalCash,                 yearly: mLast.totalCash * 12,             closeRate: mLast.closeRate },
    { label: 'All-time average',  weekly: mAll.totalCash / Math.max(1, pastCalls.length / 4.33), monthly: mAll.totalCash / Math.max(1, pastCalls.length / 30) * 30, yearly: mAll.totalCash / Math.max(1, pastCalls.length / 365) * 365, closeRate: mAll.closeRate },
  ]

  const monthlyChart = useMemo(() => {
    const map = {}
    pastCalls.forEach(r => {
      const ds = getDateStr(r.date)
      if (!ds) return
      const d     = new Date(ds + 'T00:00:00')
      const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const label = `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
      if (!map[key]) map[key] = { key, label, cash: 0, wins: 0 }
      if (isWon(r.outcome)) {
        map[key].cash += parseCash(r.cash)
        map[key].wins++
      }
    })
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
  }, [pastCalls])

  const bestMonth = monthlyChart.reduce((best, m) => m.cash > (best?.cash || 0) ? m : best, null)
  const currentMonthKey = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
  })()

  return (
    <div className="trajectory-tab">

      <div className="section-header">Period Stats — All Calls</div>

      <div className="traj-period-grid">
        <div className="traj-period-card">
          <div className="traj-period-title">Last 7 Days</div>
          <div className="traj-metric"><span>Calls Had</span><strong>{m7.totalBooked}</strong></div>
          <div className="traj-metric"><span>Show Rate</span><strong>{fmtPct(m7.showRate)}</strong></div>
          <div className="traj-metric"><span>Close Rate</span><strong>{fmtPct(m7.closeRate)}</strong></div>
          <div className="traj-metric"><span>Wins</span><strong>{m7.totalWins}</strong></div>
          <div className="traj-metric traj-metric--cash"><span>Cash Collected</span><strong>{fmt$0(m7.totalCash)}</strong></div>
          <div className="traj-trends">
            <TrendBadge current={m7.totalCash} previous={mPrev7.totalCash} />
          </div>
        </div>

        <div className="traj-period-card">
          <div className="traj-period-title">Last 30 Days</div>
          <div className="traj-metric"><span>Calls Had</span><strong>{m30.totalBooked}</strong></div>
          <div className="traj-metric"><span>Show Rate</span><strong>{fmtPct(m30.showRate)}</strong></div>
          <div className="traj-metric"><span>Close Rate</span><strong>{fmtPct(m30.closeRate)}</strong></div>
          <div className="traj-metric"><span>Wins</span><strong>{m30.totalWins}</strong></div>
          <div className="traj-metric traj-metric--cash"><span>Cash Collected</span><strong>{fmt$0(m30.totalCash)}</strong></div>
        </div>

        <div className="traj-period-card">
          <div className="traj-period-title">Last Month</div>
          <div className="traj-metric"><span>Calls Had</span><strong>{mLast.totalBooked}</strong></div>
          <div className="traj-metric"><span>Show Rate</span><strong>{fmtPct(mLast.showRate)}</strong></div>
          <div className="traj-metric"><span>Close Rate</span><strong>{fmtPct(mLast.closeRate)}</strong></div>
          <div className="traj-metric"><span>Wins</span><strong>{mLast.totalWins}</strong></div>
          <div className="traj-metric traj-metric--cash"><span>Cash Collected</span><strong>{fmt$0(mLast.totalCash)}</strong></div>
        </div>

        <div className="traj-period-card">
          <div className="traj-period-title">All Time</div>
          <div className="traj-metric"><span>Calls Had</span><strong>{mAll.totalBooked}</strong></div>
          <div className="traj-metric"><span>Show Rate</span><strong>{fmtPct(mAll.showRate)}</strong></div>
          <div className="traj-metric"><span>Close Rate</span><strong>{fmtPct(mAll.closeRate)}</strong></div>
          <div className="traj-metric"><span>Wins</span><strong>{mAll.totalWins}</strong></div>
          <div className="traj-metric traj-metric--cash"><span>Cash Collected</span><strong>{fmt$0(mAll.totalCash)}</strong></div>
        </div>
      </div>

      <div className="section-header" style={{ marginTop: 28 }}>This Month</div>
      <div className="traj-runrate-row">
        <div className="traj-runrate-card">
          <div className="traj-runrate-label">Collected So Far</div>
          <div className="traj-runrate-value" style={{ color: 'var(--green)' }}>{fmt$0(mThis.totalCash)}</div>
          <div className="traj-runrate-sub">Day {dayOfMonth} of {daysInMonth}</div>
        </div>
        <div className="traj-runrate-arrow">→</div>
        <div className="traj-runrate-card traj-runrate-card--proj">
          <div className="traj-runrate-label">Projected End of Month</div>
          <div className="traj-runrate-value" style={{ color: 'var(--blue)' }}>{fmt$0(monthRunRate)}</div>
          <div className="traj-runrate-sub">{daysRemaining} days remaining</div>
        </div>
        <div className="traj-runrate-arrow">vs</div>
        <div className="traj-runrate-card">
          <div className="traj-runrate-label">Last Month Final</div>
          <div className="traj-runrate-value">{fmt$0(mLast.totalCash)}</div>
          <div className="traj-runrate-sub">
            {monthRunRate > mLast.totalCash
              ? <span style={{ color: 'var(--green)' }}>+{fmt$0(monthRunRate - mLast.totalCash)} ahead</span>
              : <span style={{ color: 'var(--red)' }}>{fmt$0(mLast.totalCash - monthRunRate)} behind</span>}
          </div>
        </div>
        {bestMonth && (
          <>
            <div className="traj-runrate-arrow">🏆</div>
            <div className="traj-runrate-card">
              <div className="traj-runrate-label">Best Month Ever</div>
              <div className="traj-runrate-value" style={{ color: 'var(--yellow)' }}>{fmt$0(bestMonth.cash)}</div>
              <div className="traj-runrate-sub">{bestMonth.label} · {bestMonth.wins} wins</div>
            </div>
          </>
        )}
      </div>

      <div className="section-header" style={{ marginTop: 28 }}>Revenue Projections</div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Based On</th>
              <th>Close Rate</th>
              <th>Weekly Cash</th>
              <th>Monthly Cash</th>
              <th>Yearly Cash</th>
            </tr>
          </thead>
          <tbody>
            {proj.map(p => (
              <tr key={p.label}>
                <td style={{ textAlign: 'left', fontWeight: 600 }}>{p.label}</td>
                <td className={p.closeRate >= 25 ? 'td-good' : p.closeRate >= 15 ? 'td-warn' : 'td-bad'}>
                  {fmtPct(p.closeRate)}
                </td>
                <td>{fmt$0(p.weekly)}</td>
                <td style={{ color: 'var(--blue)', fontWeight: 700 }}>{fmt$0(p.monthly)}</td>
                <td style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt$0(p.yearly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-header" style={{ marginTop: 28 }}>Monthly Cash Collected</div>
      <div className="chart-box" style={{ marginBottom: 32 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyChart} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d333b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#8b949e', fontSize: 11 }}
              tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="cash" name="Cash" radius={[4,4,0,0]}>
              {monthlyChart.map(m => (
                <Cell
                  key={m.key}
                  fill={
                    m.key === bestMonth?.key     ? '#d29922' :
                    m.key === currentMonthKey    ? '#58a6ff' : '#3fb950'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="traj-chart-legend">
          <span><span className="legend-dot" style={{ background: '#3fb950' }} /> Past months</span>
          <span><span className="legend-dot" style={{ background: '#58a6ff' }} /> This month</span>
          <span><span className="legend-dot" style={{ background: '#d29922' }} /> Best month</span>
        </div>
      </div>

    </div>
  )
}
