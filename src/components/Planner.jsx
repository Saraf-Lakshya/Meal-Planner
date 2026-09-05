import { useState, useEffect } from 'react'
import { SLOTS, LABELS, DAYS, tomorrow, iso, pretty, pick, pattern } from '../engine'
import ManageMeals from './ManageMeals'

// A slot: name (string|null), locked (decided), skipped (locked as blank).
const emptyPicks = () => ({
  breakfast: { name: null, locked: false, skipped: false },
  lunch: { name: null, locked: false, skipped: false },
  dinner: { name: null, locked: false, skipped: false },
})

export default function Planner({ signOut, mealsApi, daysApi }) {
  const t = tomorrow()
  const tIso = iso(t)
  const weekday = t.getDay()
  const { meals } = mealsApi
  const { history, draft } = daysApi

  const [picks, setPicks] = useState(emptyPicks)
  const [view, setView] = useState('plan')
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
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

  // Any change to the plan means it's no longer in the confirmed/copy state.
  function touch() {
    setConfirmed(false)
    setCopied(false)
  }

  function regenerate() {
    touch()
    setPicks((prev) => {
      const work = { ...prev }
      SLOTS.forEach((s) => {
        // Skipped slots are locked, so they're left untouched here.
        if (!prev[s].locked) work[s] = { name: pick(s, { meals, history, picks: work, weekday }), locked: false, skipped: false }
      })
      persist(work)
      return work
    })
  }

  function toggleLock(slot) {
    touch()
    setPicks((prev) => {
      const cur = prev[slot]
      let next
      if (cur.locked) {
        // Unlock. A skipped (blank) slot becomes an empty, editable slot again.
        next = { ...prev, [slot]: { name: cur.skipped ? null : cur.name, locked: false, skipped: false } }
      } else {
        if (!cur.name) return prev // nothing to lock — use the pencil or skip
        next = { ...prev, [slot]: { ...cur, locked: true, skipped: false } }
      }
      persist(next)
      return next
    })
  }

  function skip(slot) {
    touch()
    setPicks((prev) => {
      const next = { ...prev, [slot]: { name: null, locked: true, skipped: true } }
      persist(next)
      return next
    })
  }

  function setName(slot, name) {
    touch()
    setPicks((prev) => {
      const next = { ...prev, [slot]: { name, locked: false, skipped: false } }
      persist(next)
      return next
    })
  }

  async function confirm() {
    // "Learn": add any typed meal to the pool — only now, at final confirmation.
    for (const s of SLOTS) if (picks[s].name) await mealsApi.ensureMeal(s, picks[s].name)
    await daysApi.confirmDay(tIso, weekday, picks)
    setConfirmed(true)
  }

  function copyPlan() {
    const text = SLOTS
      .filter((s) => picks[s].name) // skipped/blank slots are omitted
      .map((s) => `${LABELS[s]} - ${picks[s].name}`)
      .join('\n')
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600) }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done))
    } else {
      fallbackCopy(text, done)
    }
  }

  function planAgain() {
    setConfirmed(false)
    setCopied(false)
    setPicks(emptyPicks())
  }

  function doResume() {
    const d = draft
    const slot = (name, locked) => ({ name, locked, skipped: locked && !name })
    setPicks({
      breakfast: slot(d.breakfast, !!(d.locks && d.locks.breakfast)),
      lunch: slot(d.lunch, !!(d.locks && d.locks.lunch)),
      dinner: slot(d.dinner, !!(d.locks && d.locks.dinner)),
    })
    setShowResume(false)
  }

  function doDiscard() {
    daysApi.discardDraft(tIso)
    setShowResume(false)
  }

  if (view === 'manage') return <ManageMeals meals={meals} api={mealsApi} onBack={() => setView('plan')} />

  let actionLabel, actionClass, actionFn, actionDisabled = false
  if (confirmed) {
    actionLabel = copied ? 'Copied ✓' : 'Copy'
    actionClass = 'action'
    actionFn = copyPlan
  } else if (allLocked) {
    actionLabel = 'Confirm Selections'
    actionClass = 'action confirm'
    actionFn = confirm
  } else {
    actionLabel = 'Regenerate'
    actionClass = 'action'
    actionFn = regenerate
    actionDisabled = !anyMeal
  }

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
            options={meals.filter((m) => m.slot === slot).map((m) => m.name)}
            onToggle={() => toggleLock(slot)} onSet={(n) => setName(slot, n)} onSkip={() => skip(slot)} />
        ))}
      </div>

      <button className={actionClass} disabled={actionDisabled} onClick={actionFn}>{actionLabel}</button>
      <div className="foot">
        {confirmed && (
          <>Saved for {pretty(t)} ✓ &nbsp;·&nbsp; <button className="linkbtn" onClick={planAgain}>Plan again</button></>
        )}
      </div>

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

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    done()
  } catch (e) {
    /* clipboard unavailable */
  }
}

function Card({ slot, p, hasMeals, pat, weekday, options, onToggle, onSet, onSkip }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  const q = val.trim().toLowerCase()
  const matches = editing && q
    ? options.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 6)
    : []

  function open(e) {
    e.stopPropagation()
    setVal(p.name || '')
    setEditing(true)
  }
  function commit(v) {
    const name = (v !== undefined ? v : val).trim()
    if (name) onSet(name)
    setEditing(false)
    setVal('')
  }

  const displayText = p.skipped
    ? 'Skipped'
    : p.name || (hasMeals ? 'Regenerate, or type / skip below' : 'Type or skip below')

  return (
    <div className={'card' + (p.locked ? ' locked' : '') + (p.skipped ? ' skipped' : '')}
      onClick={() => { if (!editing) onToggle() }}>
      <div className="slot">{LABELS[slot]}</div>
      <div className="row">
        <div className={'meal' + (p.name && !p.skipped ? '' : ' empty')}>{displayText}</div>
        {p.locked && <div className="lockmark">{p.skipped ? 'Skipped ✓' : 'Locked ✓'}</div>}
      </div>
      {pat && !p.locked && <div className="hint">You usually have {pat.name} on {DAYS[weekday]}s</div>}

      {!p.locked && !editing && (
        <div className="cardicons">
          <button className="iconbtn" aria-label="Type a meal" title="Type a meal" onClick={open}>✎</button>
          <button className="iconbtn" aria-label="Skip this meal" title="Skip this meal"
            onClick={(e) => { e.stopPropagation(); onSkip() }}>⌀</button>
        </div>
      )}

      {!p.locked && editing && (
        <div className="editwrap" onClick={(e) => e.stopPropagation()}>
          <div className="editrow">
            <input className="mealinput" autoFocus value={val} placeholder="Type any meal…"
              autoCapitalize="words" autoComplete="off"
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit() }
                else if (e.key === 'Escape') { setEditing(false); setVal('') }
              }} />
            <button className="setbtn" onClick={() => commit()}>Set</button>
          </div>
          {matches.length > 0 && (
            <div className="dropdown">
              {matches.map((n) => (
                <button key={n} className="dditem" onClick={() => commit(n)}>{n}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
