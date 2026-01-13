import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Tag, Percent, DollarSign, Power } from 'lucide-react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { fmtVND } from '../../utils/helpers'
import ConfirmModal from '../../components/UI/ConfirmModal'

const INITIAL_FORM = {
  code: '',
  type: 'percent',
  value: '',
  description: ''
}

export default function CouponManager({ showToast }) {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState(INITIAL_FORM)
  
  // State quản lý Modal xác nhận
  const [confirmConfig, setConfirmConfig] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    action: null 
  })

  const fetchCoupons = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'coupons'))
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error(error)
      showToast("Lỗi tải danh sách", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const { code, value, type, description } = formData

    if (!code || !value) {
      return showToast("⚠️ Vui lòng nhập đủ Mã và Giá trị", "error")
    }
    
    try {
      await addDoc(collection(db, 'coupons'), {
        code: code.toUpperCase(),
        type,
        value: Number(value),
        description,
        isActive: true,
        createdAt: serverTimestamp()
      })
      
      setFormData(INITIAL_FORM)
      fetchCoupons()
      showToast("✅ Đã tạo mã khuyến mãi mới!", "success")
    } catch (error) { 
      console.error(error)
      showToast("Lỗi khi tạo coupon", "error") 
    }
  }

  const toggleStatus = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'coupons', id), { isActive: !currentStatus })
      fetchCoupons()
      showToast(currentStatus ? "Đã tắt mã khuyến mãi" : "Đã kích hoạt mã", "success")
    } catch (error) { 
      console.error(error)
      showToast("Lỗi cập nhật trạng thái", "error")
    }
  }

  const handleDelete = (id) => {
    setConfirmConfig({
      isOpen: true,
      title: "Xóa Coupon",
      message: "Bạn có chắc muốn xóa mã giảm giá này vĩnh viễn?",
      action: async () => {
        try {
          await deleteDoc(doc(db, 'coupons', id))
          fetchCoupons()
          showToast("Đã xóa mã khuyến mãi", "success")
        } catch (error) { 
          console.error(error)
          showToast("Lỗi khi xóa", "error") 
        }
      }
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <ConfirmModal 
        isOpen={confirmConfig.isOpen} 
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} 
        onConfirm={confirmConfig.action} 
        title={confirmConfig.title} 
        message={confirmConfig.message} 
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Khuyến mãi</h1>
          <p className="text-slate-500">Tạo các mã giảm giá cho khách hàng</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Create */}
        <div className="md:col-span-1">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Plus size={18}/> Thêm mã mới
            </h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mã Coupon</label>
              <input 
                name="code"
                value={formData.code} 
                onChange={handleInputChange} 
                className="w-full p-2 border rounded-lg uppercase font-bold tracking-wider focus:border-emerald-500 outline-none" 
                placeholder="SALE50..." 
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Loại giảm</label>
                <select 
                  name="type"
                  value={formData.type} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded-lg bg-white outline-none"
                >
                  <option value="percent">% Phần trăm</option>
                  <option value="fixed">Số tiền (VNĐ)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Giá trị</label>
                <input 
                  name="value"
                  type="number" 
                  value={formData.value} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded-lg outline-none" 
                  placeholder="10..." 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mô tả ngắn</label>
              <input 
                name="description"
                value={formData.description} 
                onChange={handleInputChange} 
                className="w-full p-2 border rounded-lg outline-none" 
                placeholder="Giảm giá khai trương..." 
              />
            </div>

            <button 
              type="submit" 
              className="w-full py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition shadow-md active:scale-95"
            >
              Tạo Mã
            </button>
          </form>
        </div>

        {/* List Coupons */}
        <div className="md:col-span-2 space-y-3">
          {loading ? (
            <div className="text-center py-10 text-slate-500">Đang tải...</div>
          ) : coupons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              <Tag size={40} className="mb-2 opacity-50"/>
              <p>Chưa có mã giảm giá nào.</p>
            </div>
          ) : (
            coupons.map(c => (
              <div 
                key={c.id} 
                className={`flex items-center justify-between p-4 bg-white rounded-xl border transition-all ${c.isActive ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-60 bg-slate-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${c.type === 'percent' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                    {c.type === 'percent' ? <Percent size={20} /> : <DollarSign size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        {c.code}
                        {!c.isActive && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase">Đã tắt</span>}
                    </h4>
                    <p className="text-sm text-slate-500 font-medium">
                        <span className="text-emerald-600 font-bold">
                          Giảm {c.type === 'percent' ? `${c.value}%` : fmtVND(c.value)}
                        </span>
                        {c.description && <span className="mx-1">• {c.description}</span>}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleStatus(c.id, c.isActive)} 
                    className={`p-2.5 rounded-lg transition ${c.isActive ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'}`} 
                    title={c.isActive ? "Đang hoạt động (Nhấn để tắt)" : "Đã tắt (Nhấn để bật)"}
                  >
                    <Power size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(c.id)} 
                    className="p-2.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition" 
                    title="Xóa mã"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}