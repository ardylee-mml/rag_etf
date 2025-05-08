import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'
import './styles/QueryInterface.css'

// Import components
import DataExplorer from './components/DataExplorer'
import RelationshipExplorer from './components/RelationshipExplorer'
import RelationshipMapper from './components/RelationshipMapper'
import QueryInterface from './components/QueryInterface'
import InsightsPanel from './components/InsightsPanel'
import SelfLearningDashboard from './components/SelfLearningDashboard.jsx'

function App() {
  const [token, setToken] = useState('')
  const [activeTab, setActiveTab] = useState('query')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Always use real data mode
  const [collections, setCollections] = useState([
    { id: 'players', name: 'Players', count: 304814 },
    { id: 'events', name: 'Events', count: 10929576 },
    { id: 'zones', name: 'Zones', count: 65 },
    { id: 'items', name: 'Items', count: 100 },
    { id: 'questions', name: 'Questions', count: 56 },
    { id: 'leaderboards', name: 'Leaderboards', count: 141349 },
    { id: 'campaigns', name: 'Campaigns', count: 3 },
    { id: 'checkpoints', name: 'Checkpoints', count: 0 }
  ])

  // Login on component mount
  useEffect(() => {
    login()
  }, [])

  const login = async () => {
    try {
      setLoading(true)
      console.log('Starting login process...')

      // Always try to login to real API
      try {
        console.log('Attempting to login to real API')
        const response = await axios.post('/api/auth/login', {
          username: 'test',
          password: 'test'
        })
        console.log('Login successful:', response.data)
        setToken(response.data.token)
        setError('')
      } catch (err) {
        console.error('Login error:', err)
        console.error('Error details:', {
          message: err.message,
          response: err.response,
          request: err.request
        })
        setError('API login failed. Check if the server is running.')
      }
    } catch (err) {
      console.error('Outer login error:', err)
      setError('Login failed: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
      console.log('Login process completed')
    }
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-content">
          <div className="logo-container">
            <img src="/images/metaminding-logo.svg" alt="MetaMinding Logo" className="logo" />
          </div>
          <div className="title-container">
            <h1 className="title">Escape To Freedom - Game Analytics</h1>
            <p className="subtitle warning-text">This RAG application is strictly for internal evaluation and development purpose</p>
          </div>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          Insights
        </button>
        <button
          className={`tab ${activeTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveTab('explorer')}
        >
          Data Explorer
        </button>
        <button
          className={`tab ${activeTab === 'relationships' ? 'active' : ''}`}
          onClick={() => setActiveTab('relationships')}
        >
          Relationships
        </button>
        <button
          className={`tab ${activeTab === 'mapper' ? 'active' : ''}`}
          onClick={() => setActiveTab('mapper')}
        >
          Relationship Mapper
        </button>
        <button
          className={`tab ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
        >
          Query Interface
        </button>
        <button
          className={`tab ${activeTab === 'self-learning' ? 'active' : ''}`}
          onClick={() => setActiveTab('self-learning')}
        >
          Self-Learning Dashboard
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'insights' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Insights Dashboard</h2>
            </div>
            <InsightsPanel token={token} />
          </div>
        )}

        {activeTab === 'explorer' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Data Explorer</h2>
            </div>
            <DataExplorer token={token} collections={collections} />
          </div>
        )}

        {activeTab === 'relationships' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Relationship Explorer</h2>
            </div>
            <RelationshipExplorer token={token} collections={collections} />
          </div>
        )}

        {activeTab === 'mapper' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Relationship Mapper</h2>
            </div>
            <RelationshipMapper token={token} collections={collections} />
          </div>
        )}

        {activeTab === 'query' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Natural Language Query Interface</h2>
            </div>
            <QueryInterface token={token} collections={collections} />
          </div>
        )}

        {activeTab === 'self-learning' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Self-Learning Dashboard</h2>
            </div>
            <SelfLearningDashboard token={token} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
