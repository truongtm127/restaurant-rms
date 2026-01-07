import React, { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { UtensilsCrossed, LogIn as LogInIcon } from 'lucide-react'
import { auth } from '../../firebase'
import { getAuthErrorMessage } from '../../utils/helpers'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Class chung cho các ô input để tránh lặp code
  const inputClass = "w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(getAuthErrorMessage(err?.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
            <UtensilsCrossed size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Restaurant Management</h1>
            <p className="text-sm text-slate-500">Đăng nhập để tiếp tục</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputClass}
            disabled={loading}
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            className={inputClass}
            disabled={loading}
            required
          />

          {/* Error Message */}
          {error && (
            <div role="alert" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 font-medium">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 flex items-center justify-center gap-2 font-medium transition-all shadow-sm hover:shadow"
          >
            <LogInIcon className="w-4 h-4" />
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </div>
      </form>
    </div>
  )
}