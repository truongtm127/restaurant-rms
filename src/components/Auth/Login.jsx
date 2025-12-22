import React, { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { UtensilsCrossed, LogIn as LogInIcon } from 'lucide-react'
import { auth } from '../../firebase' 
import { getAuthErrorMessage } from '../../utils/helpers'

export default function Login() {
  // onSuccess được xử lý bởi onAuthStateChanged trong App.jsx nên không cần prop này nữa, 
  // nhưng nếu bạn muốn giữ flow cũ thì có thể giữ prop.
  // Tuy nhiên ở App.jsx mới, logic tự động chuyển trang khi có user.
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // Không cần làm gì thêm, App.jsx sẽ lắng nghe state change
    } catch (err) {
      setError(getAuthErrorMessage(err?.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-emerald-50 to-emerald-100">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white"><UtensilsCrossed/></div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Restaurant Management</h1>
            <p className="text-sm text-slate-500">Đăng nhập để tiếp tục</p>
          </div>
        </div>
        <div className="space-y-3">
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="Email"
            className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
            required
          />
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="Mật khẩu"
            className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
            required
          />
          
          {error && (
            <div role="alert" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          
          <button 
            disabled={loading} 
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2 flex items-center justify-center gap-2"
          >
            <LogInIcon className="w-4 h-4"/>
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </div>
      </form>
    </div>
  )
}