import { Component } from 'react'
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

function ErrorScreen({ title, note, onRetry, onSignOut }) {
  return (
    <div className="screen center">
      <div className="errbox">
        <h1 className="brand big">Kal Kya Banega</h1>
        <p className="errtitle">{title}</p>
        {note && <p className="errnote">{note}</p>}
        {onRetry && <button className="action" onClick={onRetry}>Try again</button>}
        {onSignOut && <button className="linkbtn" onClick={onSignOut}>Sign out</button>}
      </div>
    </div>
  )
}

// Catches any render-time crash so the app never blanks out silently.
class Boundary extends Component {
  constructor(props) { super(props); this.state = { crashed: false } }
  static getDerivedStateFromError() { return { crashed: true } }
  render() {
    if (this.state.crashed) {
      return (
        <ErrorScreen
          title="Something went wrong"
          note="Reload the page to continue."
          onRetry={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}

export default function App() {
  const { user, signOut } = useAuth()
  const mealsApi = useMeals(user?.id)
  const daysApi = useMealDays(user?.id)

  if (user === undefined) return <Loading />
  if (user === null) return <SignIn />
  if (mealsApi.loading || daysApi.loading) return <Loading />

  if (mealsApi.loadError || daysApi.loadError) {
    return (
      <ErrorScreen
        title="Couldn't load your meals"
        note="Check your connection and try again — your data is safe."
        onRetry={() => { mealsApi.refetch(); daysApi.refetch() }}
        onSignOut={signOut}
      />
    )
  }

  return (
    <Boundary>
      <Planner user={user} signOut={signOut} mealsApi={mealsApi} daysApi={daysApi} />
    </Boundary>
  )
}
