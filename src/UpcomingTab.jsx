import { useMemo } from 'react'
import { getDateStr } from './utils'

function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export default function UpcomingTab({ rawData }) {
  const today = toLocalDateStr(new Date())

  const upcoming = useMemo(() =>
    rawData
      .filter(r => {
        const ds = getDateStr(r.date)
        return ds && ds >= today
      })
      .sort((a, b) => {
        const da = getDateStr(a.date) || ''
        const db = getDateStr(b.date) || ''
        if (da !== db) return da.localeCompare(db)
        return (a.time || '').localeCompare(b.time || '')
      }),
  [rawData, today])

  const byCloser = useMemo(() => {
    const map = {}
    upcoming.forEach(r => {
      const name = r.closer || 'Unknown'
      if (!map[name]) map[name] = []
      map[name].push(r)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  }, [upcoming])

  const byDate = useMemo(() => {
    const map = {}
    upcoming.forEach(r => {
      const ds = getDateStr(r.date) || ''
      if (!map[ds]) map[ds] = []
      map[ds].push(r)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  }, [upcoming])

  if (upcoming.length === 0) {
    return (
      <div className="cpa-tab">
        <div className="cpa-empty">No upcoming appointments found.</div>
      </div>
    )
  }

  return (
    <div className="upcoming-tab">
      <div className="upcoming-summary">
        {byCloser.map(([name, rows]) => {
          const todayCount = rows.filter(r => getDateStr(r.date) === today).length
          return (
            <div className="upcoming-closer-card" key={name}>
              <div className="upcoming-closer-name">{name}</div>
              <div className="upcoming-closer-total">{rows.length}</div>
              <div className="upcoming-closer-sub">upcoming</div>
              {todayCount > 0 && (
                <div className="upcoming-today-badge">{todayCount} today</div>
              )}
            </div>
          )
        })}
      </div>

      {byDate.map(([dateStr, rows]) => {
        const isToday = dateStr === today
        return (
          <div key={dateStr}>
            <div className={`upcoming-date-header${isToday ? ' upcoming-date-header--today' : ''}`}>
              {isToday ? 'TODAY — ' : ''}{formatDate(dateStr)}
              <span className="upcoming-date-count">{rows.length} call{rows.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="table-wrap" style={{ marginBottom: 0, borderBottom: 'none', borderRadius: '0 0 10px 10px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Lead</th>
                    <th style={{ textAlign: 'left' }}>Closer</th>
                    <th>Time</th>
                    <th>Confirmed</th>
                    <th style={{ textAlign: 'left' }}>Call Type</th>
                    <th style={{ textAlign: 'left' }}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const name      = [r.firstName, r.lastName].filter(Boolean).join(' ') || '—'
                    const confirmed = r.confirmed?.toLowerCase()
                    const timeStr   = r.time ? `${r.time}${r.timezone ? ` ${r.timezone}` : ''}` : '—'
                    return (
                      <tr key={i} className={isToday ? 'row-today' : ''}>
                        <td style={{ textAlign: 'left', fontWeight: 600 }}>{name}</td>
                        <td style={{ textAlign: 'left' }}>{r.closer || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{timeStr}</td>
                        <td>
                          {confirmed === 'yes' || confirmed === 'true' ? (
                            <span className="confirmed-yes">Yes</span>
                          ) : confirmed ? (
                            <span className="confirmed-no">{r.confirmed}</span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          <span className="call-type-badge">{r.callType || '—'}</span>
                        </td>
                        <td style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>
                          {r.email || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
