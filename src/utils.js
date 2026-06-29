export function parseCash(value) {
  if (!value) return 0
  const n = parseFloat(String(value).replace(/[$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseSheetDate(value) {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function getDateStr(value) {
  const d = parseSheetDate(value)
  return d ? toDateStr(d) : null
}

export function isWon(outcome) {
  return String(outcome || '').toLowerCase().startsWith('won')
}

export function isNoShow(outcome) {
  return String(outcome || '').toLowerCase().includes('no show')
}

export function isCancel(outcome) {
  return String(outcome || '').toLowerCase().trim() === 'cancel'
}

export function isReschedule(outcome) {
  return String(outcome || '').toLowerCase().trim() === 'reschedule'
}

export function isShow(outcome) {
  if (!outcome || !String(outcome).trim()) return false
  return !isNoShow(outcome) && !isCancel(outcome) && !isReschedule(outcome)
}

export function parseRows(values) {
  if (!values || values.length < 2) return []

  const headers = values[0].map(h => String(h || '').trim())
  const idx = name =>
    headers.findIndex(h => h.toLowerCase() === name.toLowerCase())

  const cols = {
    submissionDate: idx('Date'),
    firstName:      idx('First Name'),
    lastName:       idx('Last Name'),
    email:          idx('Email'),
    date:           idx('Appointment Date'),
    time:           idx('Appointment Time'),
    timezone:       idx('Timezone'),
    confirmed:      idx('Appointment Confirmed'),
    closer:         idx('Closer'),
    outcome:        idx('Call Outcome'),
    cash:           idx('Cash Collected'),
    totalValue:     idx('Total Value'),
    recording:      idx('Recording Link'),
    callType:       idx('Data'),
  }

  return values
    .slice(1)
    .filter(r => r && r.some(c => c))
    .map(r => {
      const get = i => (i >= 0 ? String(r[i] || '') : '')
      return {
        submissionDate: get(cols.submissionDate),
        firstName:      get(cols.firstName),
        lastName:       get(cols.lastName),
        email:          get(cols.email),
        date:           get(cols.date),
        time:           get(cols.time),
        timezone:       get(cols.timezone),
        confirmed:      get(cols.confirmed),
        closer:         get(cols.closer),
        outcome:        get(cols.outcome),
        cash:           get(cols.cash),
        totalValue:     get(cols.totalValue),
        recording:      get(cols.recording),
        callType:       get(cols.callType),
      }
    })
}

export function computeMetrics(rows) {
  const totalBooked      = rows.length
  const totalNoShows     = rows.filter(r => isNoShow(r.outcome)).length
  const totalCancels     = rows.filter(r => isCancel(r.outcome)).length
  const totalReschedules = rows.filter(r => isReschedule(r.outcome)).length
  const totalShows       = rows.filter(r => isShow(r.outcome)).length
  const totalWins        = rows.filter(r => isWon(r.outcome)).length
  const totalCash        = rows.reduce((s, r) => s + parseCash(r.cash), 0)
  const totalValue       = rows.reduce((s, r) => s + parseCash(r.totalValue || r.cash), 0)
  const hotFollowUps     = rows.filter(r => r.outcome === 'Follow Up (Hot)').length

  const callsHad = totalBooked - totalReschedules

  const todayStr = (() => {
    const n = new Date()
    const y = n.getFullYear()
    const mo = String(n.getMonth() + 1).padStart(2, '0')
    const d = String(n.getDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  })()

  const missingOutcomes = rows.filter(r => {
    if (r.outcome && r.outcome.trim()) return false
    const ds = getDateStr(r.date)
    if (!ds) return true
    return ds < todayStr
  }).length

  return {
    totalBooked,
    totalReschedules,
    totalShows,
    totalNoShows,
    totalCancels,
    totalWins,
    missingOutcomes,
    showRate:      callsHad > 0    ? (totalShows / callsHad)   * 100 : 0,
    closeRate:     totalShows > 0  ? (totalWins  / totalShows) * 100 : 0,
    hotFollowUps,
    totalCash,
    totalValue,
    avgDealSize:   totalWins > 0   ? totalCash / totalWins   : 0,
    cashPerBooked: totalBooked > 0 ? totalCash / totalBooked : 0,
    cashPerShown:  totalShows > 0  ? totalCash / totalShows  : 0,
  }
}
