import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// The meal pool ("lottery list"). One row per meal, per slot.
export function useMeals(userId) {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const fetchMeals = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    setLoadError(false)
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (!error) setMeals(data ?? [])
    else setLoadError(true)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchMeals() }, [fetchMeals])

  const addMeal = useCallback(async (slot, name, repeatable = false) => {
    name = name.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('meals')
      .insert({ user_id: userId, slot, name, repeatable })
      .select()
      .single()
    if (!error && data) setMeals((prev) => [...prev, data])
    else if (error && error.code !== '23505') throw error   // 23505 = duplicate, ignore
  }, [userId])

  // Add a meal to the pool only if it isn't already there (the "learn" step).
  const ensureMeal = useCallback(async (slot, name) => {
    name = name.trim()
    if (!name) return
    if (meals.some((m) => m.slot === slot && m.name === name)) return
    await addMeal(slot, name, false)
  }, [meals, addMeal])

  const toggleRepeat = useCallback(async (id) => {
    const m = meals.find((x) => x.id === id)
    if (!m) return
    const { data, error } = await supabase
      .from('meals')
      .update({ repeatable: !m.repeatable })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()
    if (!error && data) setMeals((prev) => prev.map((x) => (x.id === id ? data : x)))
  }, [meals, userId])

  const deleteMeal = useCallback(async (id) => {
    const { error } = await supabase.from('meals').delete().eq('id', id).eq('user_id', userId)
    if (!error) setMeals((prev) => prev.filter((x) => x.id !== id))
  }, [userId])

  return { meals, loading, loadError, addMeal, ensureMeal, toggleRepeat, deleteMeal, refetch: fetchMeals }
}
