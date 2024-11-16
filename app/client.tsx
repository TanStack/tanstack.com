import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/start'
import { createRouter } from './router'
import './utils/sentry'
import { Component } from 'react'

const router = createRouter()

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>
    }
    return this.props.children
  }
}

try {
  hydrateRoot(
    document,
    <ErrorBoundary>
      <StartClient router={router} />
    </ErrorBoundary>
  )
} catch (err) {
  console.log('hydrateRoot error', err)
}
