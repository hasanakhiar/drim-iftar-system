import React, { useState } from 'react'
import Login from './components/Login.jsx'
import OrderPlacer from './components/OrderPlacer.jsx'
import OrderTracker from './components/OrderTracker.jsx'

export default function App() {
  const [token, setToken] = useState(null)
  const [orderId, setOrderId] = useState(null)

  return (
    <div className="container">
      <h1>🍽️ IUT Cafeteria</h1>
      {!token && <Login setToken={setToken} />}
      {token && !orderId && (
        <OrderPlacer token={token} setOrderId={setOrderId} />
      )}
      {token && orderId && (
        <OrderTracker orderId={orderId} token={token} />
      )}
    </div>
  )
}
