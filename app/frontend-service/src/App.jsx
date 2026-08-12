import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [data, setData] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/efficiency')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then(json => {
        setData(json)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  return (
    <div className="dashboard">
      <header>
        <h1>Kube-Optima</h1>
        <p>Kubernetes Resource & Cost Optimization Dashboard</p>
      </header>
      
      <main>
        {loading && <p className="loading">Loading efficiency data...</p>}
        {error && <div className="error">Error: {error}</div>}
        
        {!loading && !error && (
          <div className="card-grid">
            {data.map(ns => (
              <div key={ns.namespace} className="card">
                <h2>{ns.namespace}</h2>
                <div className="metrics">
                  <div className="metric">
                    <span className="label">Wasted CPU</span>
                    <span className="value">{ns.cpuWasteCores} cores</span>
                  </div>
                  <div className="metric">
                    <span className="label">Wasted Memory</span>
                    <span className="value">{ns.memWasteMb} MB</span>
                  </div>
                  <div className="metric highlight">
                    <span className="label">Potential Savings</span>
                    <span className="value">${ns.savingsUsd}/mo</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
