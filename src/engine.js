// Pure suggestion logic — no React, no Supabase. Easy to reason about and test.

export const SLOTS = ['breakfast', 'lunch', 'dinner']
export const LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d
}

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function pretty(d) {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// The single most recent confirmed day = "the previous day" for no-repeat.
function previousDayMeals(history) {
  if (!history.length) return {}
  const last = history[history.length - 1]
  return { breakfast: last.breakfast, lunch: last.lunch, dinner: last.dinner }
}

// Most common meal for this slot on the target weekday, if seen >= 2 times.
// Recommendations only start once at least 3 days have been logged.
export function pattern(history, slot, weekday) {
  if (history.length < 3) return null
  const counts = {}
  history.forEach((e) => {
    if (e.weekday === weekday && e[slot]) counts[e[slot]] = (counts[e[slot]] || 0) + 1
  })
  let best = null, bestN = 0
  for (const k in counts) if (counts[k] > bestN) { best = k; bestN = counts[k] }
  return bestN >= 2 ? { name: best, count: bestN } : null
}

// Pick one meal name for a slot. `picks` is the in-progress selection (to avoid
// duplicating a meal across two slots on the same day).
export function pick(slot, { meals, history, picks, weekday }) {
  const list = meals.filter((m) => m.slot === slot)
  if (!list.length) return null

  const prev = previousDayMeals(history)[slot]
  const taken = {}
  SLOTS.forEach((s) => { if (s !== slot && picks[s] && picks[s].name) taken[picks[s].name] = true })

  let pool = list.filter((m) => {
    if (prev && m.name === prev && !m.repeatable) return false      // no repeat from yesterday
    if (taken[m.name] && !m.repeatable) return false                // not already chosen today
    return true
  })
  if (!pool.length) pool = list.slice()                             // never get stuck

  // Prefer to actually change the current suggestion when regenerating.
  if (pool.length > 1 && picks[slot] && picks[slot].name) {
    const alt = pool.filter((m) => m.name !== picks[slot].name)
    if (alt.length) pool = alt
  }

  // Weight the weekday-pattern meal 3x if it's available.
  const pat = pattern(history, slot, weekday)
  const weighted = []
  pool.forEach((m) => {
    weighted.push(m)
    if (pat && m.name === pat.name) { weighted.push(m); weighted.push(m) }
  })
  return weighted[Math.floor(Math.random() * weighted.length)].name
}
