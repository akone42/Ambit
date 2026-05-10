import { Component } from 'react'
import PropTypes from 'prop-types'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, componentStack: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info.componentStack })
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{ padding: 32, fontFamily: 'monospace', background: '#fee2e2', color: '#991b1b' }}
        >
          <h2>Crash: {this.state.error.message}</h2>
          <h3 style={{ marginTop: 16 }}>Component tree (crash location):</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#fecaca', padding: 12 }}>
            {this.state.componentStack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ErrorBoundary.propTypes = { children: PropTypes.node.isRequired }
