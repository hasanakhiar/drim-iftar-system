import React, { useState } from 'react'
import axios from 'axios'

export default function Login({ setToken }) {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post('http://localhost:3001/auth/login', {
        studentId,
        password,
      })
      setToken(data.token)
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>Student Login</h2>
      <form onSubmit={handleSubmit}>
        <label>Student ID</label>
        <input
          type="text"
          placeholder="Enter your student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        />
        <label>Password</label>
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  )
}
