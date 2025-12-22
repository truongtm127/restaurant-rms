// src/features/Order/InvoiceModal.jsx
import React, { useEffect, useState } from 'react'
import { collection, doc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { fmtVND } from '../../utils/helpers'

// Nhận thêm prop 'user'
export default function InvoiceModal({ user, activeOrderId, activeTable, onClose, onPaid }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchItems() {
      const snap = await getDocs(collection(db, 'orders', activeOrderId, 'items'))
      const list = snap.docs.map(d => d.data())
      setItems(list)
      setLoading(false)
    }
    fetchItems()
  }, [activeOrderId])

  const total = items.reduce((s, i) => s + (Number(i.price) * Number(i.qty)), 0)

  const handlePay = async () => {
    if (!confirm('Xác nhận thanh toán đơn hàng này?')) return

    // Cập nhật trạng thái đơn hàng
    await updateDoc(doc(db, 'orders', activeOrderId), {
      status: 'PAID',
      total: total,
      closedAt: serverTimestamp(),
      // LƯU TÊN NGƯỜI THANH TOÁN (Lấy từ user đang đăng nhập)
      paidBy: user?.name || user?.email || 'Unknown' 
    })

    onPaid()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
        
        <div className="bg-emerald-600 p-4 text-white text-center">
          <div className="font-bold text-lg">Xác nhận thanh toán</div>
          <div className="text-emerald-100 text-sm">Bàn {activeTable?.name}</div>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center text-slate-500">Đang tải chi tiết...</div>
          ) : (
            <div className="space-y-3">
              <div className="divide-y divide-dashed divide-slate-200">
                {items.map((item, idx) => (
                  <div key={idx} className="py-2 flex justify-between text-sm">
                    <div>
                      <span className="font-bold text-slate-700">{item.qty}x</span> {item.name}
                    </div>
                    <div className="text-slate-600">{fmtVND(item.price * item.qty)}</div>
                  </div>
                ))}
              </div>
              
              <div className="border-t-2 border-slate-800 pt-3 flex justify-between items-end">
                <div className="text-slate-500 text-sm font-medium">Tổng cộng</div>
                <div className="text-2xl font-bold text-slate-800">{fmtVND(total)}</div>
              </div>

              {/* Hiển thị người đang thực hiện thanh toán */}
              <div className="text-center pt-2 text-xs text-slate-400 italic">
                Thu ngân: {user?.name || user?.email || '...'}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-white transition">
            Quay lại
          </button>
          <button onClick={handlePay} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition">
            Đã thu tiền
          </button>
        </div>
      </div>
    </div>
  )
}