import { useState, useEffect } from 'react'
import { SLOTS, LABELS, DAYS, tomorrow, iso, pretty, pick, pattern } from '../engine'
import ManageMeals from './ManageMeals'

const emptyPicks = () => ({
  breakfast: { name: null, locked: false },
  lunch: { name: null, locked: false },
  dinner: { name: null, locked: false },
})

export default function Planner({ signOut, mealsApi, daysApi }) {
  const t = tomorrow()
  const tIso = iso(t)
  const weekday = t.getDay()
  const { meals } = mealsApi
  const { history, draft } = daysApi

  const [picks, setPicks] = useState(emptyPicks)
  const [view, setView] = useState('plan')
  const [saved, setSaved] = useState(false)
  const [showResume, setShowResume] = useState(false)

  // On mount: offer to resume a draft for tomorrow, or clear a stale one.
  useEffect(() => {
    if (!draft) return
    if (draft.date === tIso) setShowResume(true)
    else daysApi.discardDraft(draft.date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const anyMeal = meals.length > 0
  const allLocked = SLOTS.every((s) => picks[s].locked)

  function persist(next) {
    const anyLock = SLOTS.some((s) => next[s].locked)
    if (anyLock) daysApi.saveDraft(tIso, weekday, next)
    else if (draft) daysApi.discardDraft(tIso)
  }

  function regenerate() {
    setSaved(false)
    setPicks((prev) => {
      const work = { ...prev }
      SLOTS.forEach((s) => {
        if (!prev[s].locked) work[s] = { ...prev[s], name: pick(s, { meals, history, picks: work, weekday }) }
      })
      persist(work)
      return work
    })
  }

  function toggleLock(slot) {
    setPicks((prev) => {
      if (!prev[slot].name) return prev
      const next = { ...prev, [slot]: { ...prev[slot], locked: !prev[slot].locked } }
      persist(next)
      return next
    })
  }

  function setName(slot, name) {
    setPicks((prev) => {
      const next = { ...prev, [slot]: { ...prev[slot], name } }
      persist(next)
      return next
    })
  }

  async function confirm() {
    // "Learn": add any typed meal to the pool — only now, at final confirmation.
    for (const s of SLOTS) if (picks[s].name) await mealsApi.ensureMeal(s, picks[s].name)
    await daysApi.confirmDay(tIso, weekday, picks)
    setPicks(emptyPicks())
    setSaved(true)
  }

  function doResume() {
    const d = draft
    setPicks({
      breakfast: { name: d.breakfast, locked: !!(d.locks && d.locks.breakfast) },
      lunch: { name: d.lunch, locked: !!(d.locks && d.locks.lunch) },
      dinner: { name: d.dinner, locked: !!(d.locks && d.locks.dinner) },
    })
    setShowResume(false)
  }

  function doDiscard() {
    daysApi.discardDraft(tIso)
    setShowResume(false)
  }

  if (view === 'manage') return <ManageMeals meals={meals} api={mealsApi} onBack={() => setView('plan')} />

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="brand">Tomorrow</h1>
        <div className="topActions">
          <button className="gear" onClick={() => setView('manage')}>Meals</button>
          <button className="gear" onClick={signOut}>Sign out</button>
        </div>
      </div>
      <div className="subhead">For {pretty(t)}</div>

      <div className="cards">
        {SLOTS.map((slot) => (
          <Card key={slot} slot={slot} p={picks[slot]} hasMeals={anyMeal}
            pat={pattern(history, slot, weekday)} weekday={weekday}
            onToggle={() => toggleLock(slot)} onSet={(n) => setName(slot, n)} />
        ))}
      </div>

      <button className={'action' + (allLocked ? ' confirm' : '')}
        disabled={!allLocked && !anyMeal}
        onClick={allLocked ? confirm : regenerate}>
        {allLocked ? 'Confirm Selections' : 'Regenerate'}
      </button>
      <div className="foot">{saved ? `Saved for ${pretty(t)}. Enjoy.` : ''}</div>

      {showResume && (
        <div className="modal show">
          <div className="modalcard">
            <h3>Resume?</h3>
            <p>You have unfinished picks for {pretty(t)}.</p>
            <div className="modalrow">
              <button className="btn-primary" onClick={doResume}>Resume</button>
              <button className="btn-ghost" onClick={doDiscard}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ slot, p, hasMeals, pat, weekday, onToggle, onSet }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  function open(e) {
    e.stopPropagation()
    setVal(p.name || '')
    setEditing(true)
  }
  function commit() {
    const v = val.trim()
    if (v) onSet(v)
    setEditing(false)
  }

  return (
    <div className={'card' + (p.locked ? ' locked' : '')} onClick={() => { if (!editing) onToggle() }}>
      <div className="slot">{LABELS[slot]}</div>
      <div className="row">
        <div className={'meal' + (p.name ? '' : ' empty')}>
          {p.name || (hasMeals ? 'Tap Regenerate, or type it in' : 'Type it in, or add meals')}
        </div>
        {p.locked && <div className="lockmark">Locked ✓</div>}
      </div>
      {pat && !p.locked && <div className="hint">You usually have {pat.name} on {DAYS[weekday]}s</div>}
      {!p.locked && !editing && (
        <button className="typepill" onClick={open}>✎ {p.name ? 'Type my own' : 'Type it in'}</button>
      )}
      {!p.locked && editing && (
        <div className="editwrap" onClick={(e) => e.stopPropagation()}>
          <input className="mealinput" autoFocus value={val} placeholder="Type any meal…"
            autoCapitalize="words" autoComplete="off"
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit() }
              else if (e.key === 'Escape') setEditing(false)
            }} />
          <button className="setbtn" onClick={(e) => { e.stopPropagation(); commit() }}>Set</button>
        </div>
      )}
    </div>
  )
}
