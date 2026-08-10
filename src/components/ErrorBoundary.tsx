import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Empêche un écran blanc total si un composant plante. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ClimaZEN ErrorBoundary', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-mist px-4">
          <div className="max-w-md rounded-2xl border border-line bg-white p-6 text-sm text-slate">
            <h1 className="font-display text-xl font-bold text-ink">Erreur d’affichage</h1>
            <p className="mt-2 text-muted">
              L’écran a planté. Rechargez la page. Si ça continue, déconnectez-vous puis
              reconnectez-vous.
            </p>
            <p className="mt-2 break-all text-xs text-danger">{this.state.error.message}</p>
            <button
              type="button"
              className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink"
              onClick={() => window.location.assign('/login')}
            >
              Recharger / login
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
