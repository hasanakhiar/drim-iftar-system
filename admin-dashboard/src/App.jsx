import React from 'react'
import HealthGrid from './components/HealthGrid.jsx'
import LiveMetrics from './components/LiveMetrics.jsx'
import ChaosToggle from './components/ChaosToggle.jsx'

export default function App() {
  return (
    <div className="dashboard">
      <h1>⚙️ IUT Cafeteria — Admin Dashboard</h1>
      <HealthGrid />
      <LiveMetrics />
      <ChaosToggle />
    </div>
  )
}
