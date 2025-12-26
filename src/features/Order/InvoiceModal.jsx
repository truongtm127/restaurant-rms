// src/features/Order/InvoiceModal.jsx
import React, { useEffect, useState } from 'react'
import { collection, doc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { fmtVND } from '../../utils/helpers'
// 1. IMPORT CONFIRM MODAL
import ConfirmModal from '../../components/UI/ConfirmModal'

// Nhận thêm prop 'user'
export default function InvoiceModal({ user, activeOrderId, activeTable, onClose, onPaid }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  
  // 2. STATE ĐỂ BẬT/TẮT MODAL XÁC NHẬN
  const [showConfirm, setShowConfirm] = useState(false)

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

  // 3. HÀM MỞ MODAL XÁC NHẬN (Thay thế window.confirm)
  const handlePayClick = () => {
    setShowConfirm(true)
  }

  // 4. HÀM THỰC HIỆN THANH TOÁN (Chạy khi bấm "Đồng ý")
  const executePayment = async () => {
    try {
        // Cập nhật trạng thái đơn hàng
        await updateDoc(doc(db, 'orders', activeOrderId), {
          status: 'PAID',
          total: total,
          closedAt: serverTimestamp(),
          // LƯU TÊN NGƯỜI THANH TOÁN
          paidBy: user?.name || user?.email || 'Unknown' 
        })
    
        // Gọi hàm onPaid (để cập nhật bàn về FREE ở component cha)
        onPaid()
        
        // Đóng modal
        setShowConfirm(false)
    } catch (error) {
        console.error("Lỗi thanh toán:", error)
        alert("Có lỗi xảy ra khi thanh toán")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 5. HIỂN THỊ CONFIRM MODAL */}
      <ConfirmModal 
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executePayment}
        title="Xác nhận thanh toán"
        message={`Bạn có chắc chắn muốn xác nhận đã thu ${fmtVND(total)} cho Bàn ${activeTable?.name}? Hành động này sẽ đóng đơn hàng và trả bàn về trạng thái Trống.`}
      />

      {/* Lớp nền mờ của InvoiceModal */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Nội dung hóa đơn */}
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
          
          {/* Nút này giờ gọi handlePayClick thay vì chạy logic trực tiếp */}
          <button 
            onClick={handlePayClick} 
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition"
          >
            Đã thu tiền
          </button>
        </div>
      </div>
    </div>
  )
}