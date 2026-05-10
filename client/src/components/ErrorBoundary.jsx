import { Component } from 'react'
import PropTypes from 'prop-types'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('=== ERROR BOUNDARY CAUGHT ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    console.error('Component stack:', info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{ padding: 32, fontFamily: 'monospace', background: '#fee2e2', color: '#991b1b' }}
        >
          <h2>App crashed — check console for details</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 8 }}>
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ErrorBoundary.propTypes = { children: PropTypes.node.isRequired }
