import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SignIn() {
  const [mode, setMode] = useState('in') // 'in' | 'up'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg('')
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Account created. If email confirmation is on, check your inbox, then sign in.')
      }
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    if (!email) { setMsg('Enter your email above first.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href })
    setMsg(error ? error.message : 'Password reset email sent.')
  }

  return (
    <div className="screen center">
      <form className="auth" onSubmit={submit}>
        <h1 className="brand big">Tomorrow</h1>
        <p className="authsub">{mode === 'in' ? 'Sign in to your meals' : 'Create your account'}</p>
        <input className="field" type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="field" type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        <button className="action" type="submit" disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'Sign in' : 'Sign up'}
        </button>
        {msg && <p className="authmsg">{msg}</p>}
        <div className="authlinks">
          <button type="button" className="linkbtn" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg('') }}>
            {mode === 'in' ? 'Create account' : 'Have an account? Sign in'}
          </button>
          {mode === 'in' && (
            <button type="button" className="linkbtn" onClick={forgot}>Forgot password?</button>
          )}
        </div>
      </form>
    </div>
  )
}
