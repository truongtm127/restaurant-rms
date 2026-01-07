// src/features/Coupons/CouponManager.jsx
import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Tag, Percent, DollarSign, Power } from 'lucide-react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { fmtVND } from '../../utils/helpers'

export default function CouponManager() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Form state
  const [code, setCode] = useState('')
  const [type, setType] = useState('percent') // 'percent' | 'fixed'
  const [value, setValue] = useState('')
  const [desc, setDesc] = useState('')

  const fetchCoupons = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'coupons'))
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) { console.error(error) }
    setLoading(false)
  }

  useEffect(() => { fetchCoupons() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!code || !value) return alert("Vui lòng nhập đủ thông tin")
    
    try {
      await addDoc(collection(db, 'coupons'), {
        code: code.toUpperCase(),
        type,
        value: Number(value),
        description: desc,
        isActive: true,
        createdAt: serverTimestamp()
      })
      setCode(''); setValue(''); setDesc('')
      fetchCoupons()
    } catch (error) { alert("Lỗi khi tạo coupon") }
  }

  const toggleStatus = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'coupons', id), { isActive: !currentStatus })
      fetchCoupons()
    } catch (error) { console.error(error) }
  }

  const handleDelete = async (id) => {
    if(!window.confirm("Xóa mã này?")) return
    try {
      await deleteDoc(doc(db, 'coupons', id))
      fetchCoupons()
    } catch (error) { console.error(error) }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Khuyến mãi</h1>
          <p className="text-slate-500">Tạo các mã giảm giá cho khách hàng</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form tạo mới */}
        <div className="md:col-span-1">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Plus size={18}/> Thêm mã mới</h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mã Coupon</label>
              <input value={code} onChange={e => setCode(e.target.value)} className="w-full p-2 border rounded-lg uppercase font-bold tracking-wider" placeholder="SALE50..." />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Loại giảm</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border rounded-lg">
                  <option value="percent">% Phần trăm</option>
                  <option value="fixed">Số tiền (VNĐ)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Giá trị</label>
                <input type="number" value={value} onChange={e => setValue(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="10..." />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mô tả ngắn</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="Giảm giá khai trương..." />
            </div>

            <button type="submit" className="w-full py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition">Tạo Mã</button>
          </form>
        </div>

        {/* Danh sách Coupon */}
        <div className="md:col-span-2 space-y-3">
          {loading ? <div>Đang tải...</div> : coupons.map(c => (
            <div key={c.id} className={`flex items-center justify-between p-4 bg-white rounded-xl border ${c.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.type === 'percent' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                  {c.type === 'percent' ? <Percent size={18} /> : <DollarSign size={18} />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{c.code}</h4>
                  <p className="text-sm text-slate-500">{c.description} • Giảm: {c.type === 'percent' ? `${c.value}%` : fmtVND(c.value)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={() => toggleStatus(c.id, c.isActive)} className={`p-2 rounded-lg transition ${c.isActive ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`} title={c.isActive ? "Đang hoạt động" : "Đã tắt"}>
                  <Power size={18} />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {coupons.length === 0 && <p className="text-slate-400 text-center py-10">Chưa có mã giảm giá nào.</p>}
        </div>
      </div>
    </div>
  )
}