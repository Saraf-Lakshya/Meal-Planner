import { useState, useEffect } from 'react'
import { SLOTS, LABELS, DAYS, tomorrow, iso, pretty, pick, pattern } from '../engine'
import ManageMeals from './ManageMeals'

// A slot: name (string|null), locked (decided), skipped (locked as blank).
const emptyPicks = () => ({
  breakfast: { name: null, locked: false, skipped: false },
  lunch: { name: null, locked: false, skipped: false },
  dinner: { name: null, locked: false, skipped: false },
})

const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

export default function Planner({ signOut, mealsApi, daysApi }) {
  const { meals } = mealsApi
  const { history, draft } = daysApi

  const [target, setTarget] = useState(() => tomorrow())
  const [picks, setPicks] = useState(emptyPicks)
  const [view, setView] = useState('plan')
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showResume, setShowResume] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [manualText, setManualText] = useState('')

  const todayIso = iso(midnight(new Date()))
  const tomorrowIso = iso(tomorrow())
  const tIso = iso(target)
  const weekday = target.getDay()
  const isPast = tIso < todayIso
  const isToday = tIso === todayIso
  const isTomorrow = tIso === tomorrowIso

  // Load whatever is stored for a date into the cards.
  function applyLoadFor(dateIso) {
    const conf = history.find((r) => r.date === dateIso)
    const src = conf || (draft && draft.date === dateIso ? draft : null)
    if (!src) { setPicks(emptyPicks()); setConfirmed(false); return }
    const slot = (name, locked) => ({ name, locked, skipped: locked && !name })
    setPicks({
      breakfast: slot(src.breakfast, !!(src.locks && src.locks.breakfast)),
      lunch: slot(src.lunch, !!(src.locks && src.locks.lunch)),
      dinner: slot(src.dinner, !!(src.locks && src.locks.dinner)),
    })
    setConfirmed(!!conf)
  }

  // On mount: resume a draft for tomorrow, else load whatever's there.
  useEffect(() => {
    if (draft && draft.date === tIso) setShowResume(true)
    else applyLoadFor(tIso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const anyMeal = meals.length > 0
  const allLocked = SLOTS.every((s) => picks[s].locked)
  const plannedSet = new Set(history.map((r) => r.date))

  function persist(next) {
    if (isPast) return
    if (history.some((r) => r.date === tIso)) return // never auto-overwrite a confirmed day
    const anyLock = SLOTS.some((s) => next[s].locked)
    if (anyLock) daysApi.saveDraft(tIso, weekday, next)
    else if (draft && draft.date === tIso) daysApi.discardDraft(tIso)
  }

  function touch() { setConfirmed(false); setCopied(false); setErr(''); setManualText('') }

  function selectDate(d) {
    setTarget(midnight(d))
    applyLoadFor(iso(d))
    setPickerOpen(false)
    setCopied(false); setErr(''); setManualText(''); setSaving(false)
  }

  // Handlers compute the next picks, then set state and persist separately
  // (never side-effect inside a setState updater).
  function regenerate() {
    if (isPast) return
    touch()
    const work = { ...picks }
    SLOTS.forEach((s) => {
      if (!picks[s].locked) work[s] = { name: pick(s, { meals, history, picks: work, weekday, targetIso: tIso }), locked: false, skipped: false }
    })
    setPicks(work)
    persist(work)
  }

  function toggleLock(slot) {
    if (isPast) return
    touch()
    const cur = picks[slot]
    let next
    if (cur.locked) {
      next = { ...picks, [slot]: { name: cur.skipped ? null : cur.name, locked: false, skipped: false } }
    } else {
      if (!cur.name) return
      next = { ...picks, [slot]: { ...cur, locked: true, skipped: false } }
    }
    setPicks(next)
    persist(next)
  }

  function skip(slot) {
    if (isPast) return
    touch()
    const next = { ...picks, [slot]: { name: null, locked: true, skipped: true } }
    setPicks(next)
    persist(next)
  }

  function setName(slot, name) {
    if (isPast) return
    touch()
    const next = { ...picks, [slot]: { name, locked: false, skipped: false } }
    setPicks(next)
    persist(next)
  }

  async function confirm() {
    if (isPast || saving) return
    setSaving(true); setErr('')
    try {
      for (const s of SLOTS) if (picks[s].name) await mealsApi.ensureMeal(s, picks[s].name)
      await daysApi.confirmDay(tIso, weekday, picks)
      setConfirmed(true)
    } catch (e) {
      setErr('Could not save — check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  function copyPlan() {
    const text = SLOTS
      .filter((s) => picks[s].name)
      .map((s) => `${LABELS[s]} - ${picks[s].name}`)
      .join('\n')
    const ok = () => { setManualText(''); setCopied(true); setTimeout(() => setCopied(false), 1600) }
    const fail = () => setManualText(text)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(() => fallbackCopy(text, ok, fail))
    } else {
      fallbackCopy(text, ok, fail)
    }
  }

  function planAgain() { setConfirmed(false); setCopied(false); setPicks(emptyPicks()) }

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

  function doDiscard() { daysApi.discardDraft(tIso); setShowResume(false) }

  if (view === 'manage') return <ManageMeals meals={meals} api={mealsApi} onBack={() => setView('plan')} />

  let actionLabel, actionClass = 'action', actionFn = null, actionDisabled = false
  if (confirmed) {
    actionLabel = copied ? 'Copied ✓' : 'Copy'
    actionFn = copyPlan
  } else if (isPast) {
    actionLabel = 'View only'
    actionDisabled = true
  } else if (allLocked) {
    actionLabel = saving ? 'Saving…' : 'Confirm Selections'
    actionClass = 'action confirm'
    actionFn = confirm
    actionDisabled = saving
  } else {
    actionLabel = 'Regenerate'
    actionFn = regenerate
    actionDisabled = !anyMeal
  }

  const rel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : null

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="brand">Kal Kya Banega</h1>
        <div className="topActions">
          <button className="gear" onClick={() => setView('manage')}>Meals</button>
          <button className="gear" onClick={signOut}>Sign out</button>
        </div>
      </div>
      <div className="subhead">
        <button className="datebtn" onClick={() => setPickerOpen(true)}>
          For {rel ? rel + ' — ' : ''}{pretty(target)} <span className="caret">▾</span>
        </button>
      </div>

      <div className="cards">
        {SLOTS.map((slot) => (
          <Card key={slot + tIso} slot={slot} p={picks[slot]} hasMeals={anyMeal} readOnly={isPast}
            pat={pattern(history, slot, weekday)} weekday={weekday}
            options={meals.filter((m) => m.slot === slot).map((m) => m.name)}
            onToggle={() => toggleLock(slot)} onSet={(n) => setName(slot, n)} onSkip={() => skip(slot)} />
        ))}
      </div>

      <button className={actionClass} disabled={actionDisabled} onClick={actionFn}>{actionLabel}</button>
      <div className="foot">
        {err && <span className="errmsg">{err}</span>}
        {!err && confirmed && !isPast && (
          <>Saved for {pretty(target)} ✓ &nbsp;·&nbsp; <button className="linkbtn" onClick={planAgain}>Plan again</button></>
        )}
        {!err && confirmed && isPast && <>Confirmed plan · view only</>}
        {!err && isPast && !confirmed && <>No plan was logged for this day</>}
      </div>
      {manualText && (
        <div className="manualcopy">
          <p>Couldn’t copy automatically — long-press to select, then copy:</p>
          <textarea readOnly rows={3} value={manualText} onFocus={(e) => e.target.select()} />
        </div>
      )}

      {pickerOpen && (
        <DatePicker target={target} todayIso={todayIso} plannedSet={plannedSet}
          onPick={selectDate} onClose={() => setPickerOpen(false)} />
      )}

      {showResume && (
        <div className="modal show">
          <div className="modalcard">
            <h3>Resume?</h3>
            <p>You have unfinished picks for {pretty(target)}.</p>
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

function DatePicker({ target, todayIso, plannedSet, onPick, onClose }) {
  const selIso = iso(target)
  const base = midnight(new Date())
  const days = []
  for (let i = -7; i <= 7; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    days.push(d)
  }
  return (
    <div className="modal show" onClick={onClose}>
      <div className="modalcard" onClick={(e) => e.stopPropagation()}>
        <h3>Pick a day</h3>
        <p>Up to a week back or ahead. Past days are view-only.</p>
        <div className="dpgrid">
          {days.map((d) => {
            const di = iso(d)
            const cls = 'dpcell' + (di === selIso ? ' sel' : '') + (di === todayIso ? ' today' : '') + (di < todayIso ? ' past' : '')
            return (
              <button key={di} className={cls} onClick={() => onPick(d)}>
                <span className="wd">{DAYS[d.getDay()].slice(0, 3)}</span>
                <span className="dn">{d.getDate()}</span>
                <span className="dot" style={{ visibility: plannedSet.has(di) ? 'visible' : 'hidden' }} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function fallbackCopy(text, done, fail) {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.contentEditable = 'true'
    ta.readOnly = false
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    const range = document.createRange()
    range.selectNodeContents(ta)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    ta.setSelectionRange(0, text.length)
    const okCmd = document.execCommand('copy')
    document.body.removeChild(ta)
    if (okCmd) done()
    else fail()
  } catch (e) {
    fail()
  }
}

function Card({ slot, p, hasMeals, pat, weekday, options, readOnly, onToggle, onSet, onSkip }) {
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
    : p.name || (readOnly ? '—' : hasMeals ? 'Regenerate, or type / skip below' : 'Type or skip below')

  return (
    <div className={'card' + (p.locked ? ' locked' : '') + (p.skipped ? ' skipped' : '') + (readOnly ? ' readonly' : '')}
      onClick={() => { if (!editing && !readOnly) onToggle() }}>
      <div className="slot">{LABELS[slot]}</div>
      <div className="row">
        <div className={'meal' + (p.name && !p.skipped ? '' : ' empty') + (!p.locked && !readOnly ? ' tappable' : '')}
          onClick={!p.locked && !readOnly ? open : undefined}>{displayText}</div>
        {p.locked && <div className="lockmark">{p.skipped ? 'Skipped ✓' : 'Locked ✓'}</div>}
      </div>
      {pat && !p.locked && !readOnly && <div className="hint">You usually have {pat.name} on {DAYS[weekday]}s</div>}

      {!p.locked && !editing && !readOnly && (
        <div className="cardicons">
          <button className="iconbtn" aria-label="Skip this meal" title="Skip this meal"
            onClick={(e) => { e.stopPropagation(); onSkip() }}>⊘</button>
        </div>
      )}

      {!p.locked && editing && !readOnly && (
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
