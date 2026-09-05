import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to GitHub Pages from the Meal-Planner repo → served at /Meal-Planner/.
export default defineConfig({
  plugins: [react()],
  base: '/Meal-Planner/',
})
