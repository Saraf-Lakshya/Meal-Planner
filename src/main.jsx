import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { supabaseConfigured } from './lib/supabase'
import './index.css'

const root = document.getElementById('root')

if (!supabaseConfigured) {
  // Keys never reached the build — show a readable message, not a blank page.
  root.innerHTML =
    '<div class="screen center"><div style="max-width:340px;text-align:center">' +
    '<h1 class="brand big">Tomorrow</h1>' +
    '<p style="margin-top:16px;font-weight:600">Configuration missing</p>' +
    '<p style="color:#666;font-size:14px;line-height:1.5">The Supabase keys were not found in this build. ' +
    'Add <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> under the repository’s ' +
    '<b>Actions secrets</b> (not Environment secrets), then re-run the Deploy workflow.</p>' +
    '</div></div>'
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
