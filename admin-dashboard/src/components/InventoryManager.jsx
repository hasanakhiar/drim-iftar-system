import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function InventoryManager() {
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState({ itemId: '', name: '', stock: 0 })
  const [loading, setLoading] = useState(false)

  const fetchStock = async () => {
    try {
      const resp = await axios.get('http://localhost:3003/stock')
      setItems(resp.data)
    } catch (e) {
      console.error('Failed to fetch stock')
    }
  }

  useEffect(() => {
    fetchStock()
    const interval = setInterval(fetchStock, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.post('http://localhost:3003/stock', newItem)
      setNewItem({ itemId: '', name: '', stock: 0 })
      fetchStock()
    } catch (e) {
      alert('Failed to update stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Add / Update Food Item</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group">
            <label>Item ID (e.g. ITEM004)</label>
            <input 
              className="form-input" 
              required 
              value={newItem.itemId} 
              onChange={e => setNewItem({...newItem, itemId: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Food Name</label>
            <input 
              className="form-input" 
              required 
              value={newItem.name} 
              onChange={e => setNewItem({...newItem, name: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Initial Stock</label>
            <input 
              type="number" 
              className="form-input" 
              required 
              value={newItem.stock} 
              onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value)})}
            />
          </div>
          <button className="btn btn-primary" style={{ height: '42px', marginBottom: '1rem' }} disabled={loading}>
            {loading ? 'Processing...' : 'Save Item'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Current Inventory</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Stock Available</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.itemId}>
                <td>{item.itemId}</td>
                <td style={{ fontWeight: '600' }}>{item.name}</td>
                <td>{item.stock} units</td>
                <td>
                  <span className={`status-pill ${item.stock > 20 ? 'success' : item.stock > 0 ? 'warning' : 'danger'}`}>
                    {item.stock > 20 ? 'In Stock' : item.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
