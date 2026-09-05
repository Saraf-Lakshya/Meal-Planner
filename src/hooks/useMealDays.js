import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// One row per planned day. Drafts hold partial locks (resume); confirmed rows
// are the history the pattern hints learn from.
export function useMealDays(userId) {
  const [history, setHistory] = useState([])
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDays = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('meal_days')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
    if (!error) {
      const rows = data ?? []
      setHistory(rows.filter((r) => r.status === 'confirmed'))
      const drafts = rows.filter((r) => r.status === 'draft')
      setDraft(drafts.length ? drafts[drafts.length - 1] : null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchDays() }, [fetchDays])

  const saveDraft = useCallback(async (dateIso, weekday, picks) => {
    const row = {
      user_id: userId, date: dateIso, weekday, status: 'draft',
      breakfast: picks.breakfast.name, lunch: picks.lunch.name, dinner: picks.dinner.name,
      locks: {
        breakfast: !!picks.breakfast.locked,
        lunch: !!picks.lunch.locked,
        dinner: !!picks.dinner.locked,
      },
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('meal_days')
      .upsert(row, { onConflict: 'user_id,date' })
      .select()
      .single()
    if (!error && data) setDraft(data)
  }, [userId])

  const discardDraft = useCallback(async (dateIso) => {
    await supabase
      .from('meal_days')
      .delete()
      .eq('user_id', userId)
      .eq('date', dateIso)
      .eq('status', 'draft')
    setDraft((prev) => (prev && prev.date === dateIso ? null : prev))
  }, [userId])

  const confirmDay = useCallback(async (dateIso, weekday, picks) => {
    const row = {
      user_id: userId, date: dateIso, weekday, status: 'confirmed',
      breakfast: picks.breakfast.name, lunch: picks.lunch.name, dinner: picks.dinner.name,
      locks: { breakfast: true, lunch: true, dinner: true },
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('meal_days')
      .upsert(row, { onConflict: 'user_id,date' })
      .select()
      .single()
    if (error) throw error
    setHistory((prev) => [...prev.filter((r) => r.date !== dateIso), data]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)))
    setDraft((prev) => (prev && prev.date === dateIso ? null : prev))
    return data
  }, [userId])

  return { history, draft, loading, saveDraft, discardDraft, confirmDay, refetch: fetchDays }
}
