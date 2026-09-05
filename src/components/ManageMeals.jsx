import { useState } from 'react'
import { SLOTS, LABELS } from '../engine'

export default function ManageMeals({ meals, api, onBack }) {
  return (
    <div className="wrap">
      <button className="backbtn" onClick={onBack}>← Done</button>
      <h2 className="brand">Your Meals</h2>
      <p className="subhead">Tap “Repeat” to allow a meal on back-to-back days.</p>
      {SLOTS.map((slot) => (
        <SlotBlock key={slot} slot={slot} meals={meals.filter((m) => m.slot === slot)} api={api} />
      ))}
    </div>
  )
}

function SlotBlock({ slot, meals, api }) {
  const [val, setVal] = useState('')
  function add() {
    const v = val.trim()
    if (!v) return
    api.addMeal(slot, v)
    setVal('')
  }
  return (
    <div className="catblock">
      <div className="catlabel">{LABELS[slot]}</div>
      {meals.length === 0 && <div className="emptynote">No {slot} meals yet.</div>}
      {meals.map((m) => (
        <div className="mealitem" key={m.id}>
          <div className="name">{m.name}</div>
          <button className={'rep' + (m.repeatable ? ' on' : '')} onClick={() => api.toggleRepeat(m.id)}>
            {m.repeatable ? 'Repeat ✓' : 'Repeat'}
          </button>
          <button className="del" onClick={() => api.deleteMeal(m.id)} aria-label="Delete">×</button>
        </div>
      ))}
      <div className="addrow">
        <input value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder={'Add ' + slot + ' meal'} autoCapitalize="words" autoComplete="off" />
        <button onClick={add}>Add</button>
      </div>
    </div>
  )
}
