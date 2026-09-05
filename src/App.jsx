import { useAuth } from './hooks/useAuth'
import { useMeals } from './hooks/useMeals'
import { useMealDays } from './hooks/useMealDays'
import SignIn from './components/SignIn'
import Planner from './components/Planner'

function Loading() {
  return (
    <div className="screen center">
      <div className="spinner" />
    </div>
  )
}

export default function App() {
  const { user, signOut } = useAuth()
  const mealsApi = useMeals(user?.id)
  const daysApi = useMealDays(user?.id)

  if (user === undefined) return <Loading />
  if (user === null) return <SignIn />
  if (mealsApi.loading || daysApi.loading) return <Loading />

  return <Planner user={user} signOut={signOut} mealsApi={mealsApi} daysApi={daysApi} />
}
