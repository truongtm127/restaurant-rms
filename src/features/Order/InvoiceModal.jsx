import React, { useEffect, useState } from 'react'
import { X, Printer, CheckCircle, AlertCircle } from 'lucide-react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { fmtVND } from '../../utils/helpers'
import ConfirmModal from '../../components/UI/ConfirmModal'

export default function InvoiceModal({ user, activeOrderId, activeTable, onClose, onPaid }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  
  // State điều khiển Confirm Popup
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!activeOrderId) return
      setLoading(true)
      try {
        const itemsRef = collection(db, 'orders', activeOrderId, 'items')
        const itemsSnap = await getDocs(itemsRef)
        const list = itemsSnap.docs.map(d => d.data())
        setItems(list)
        const calculatedTotal = list.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0)
        setTotal(calculatedTotal)
      } catch (error) { console.error(error) } finally { setLoading(false) }
    }
    fetchOrderDetails()
  }, [activeOrderId])

  const canPay = !loading && items.length > 0 && total > 0

  const handlePrint = () => window.print()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}/>

      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-slate-800">Xác nhận thanh toán</h2><p className="text-sm text-slate-500">Bàn {activeTable?.name || activeTable?.id}</p></div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {loading ? <div className="flex justify-center py-10 text-slate-400">Đang tính tiền...</div> : (
            <div className="space-y-4">
              <div className="space-y-2">
                {items.length === 0 ? <div className="text-center py-8 text-slate-400 flex flex-col items-center"><AlertCircle size={32} className="mb-2 opacity-50"/><p>Chưa có món ăn nào</p></div> : 
                  items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm border-b border-dashed border-slate-100 pb-2 last:border-0">
                      <div className="flex-1"><span className="font-medium text-slate-700">{item.name}</span><div className="text-xs text-slate-400">x{item.qty}</div></div>
                      <div className="font-medium text-slate-800">{fmtVND(Number(item.price) * Number(item.qty))}</div>
                    </div>
                  ))
                }
              </div>
              <div className="mt-4 pt-4 border-t-2 border-slate-100 flex justify-between items-center">
                <span className="text-base font-bold text-slate-600">TỔNG CỘNG</span><span className="text-2xl font-bold text-emerald-600">{fmtVND(total)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button onClick={handlePrint} disabled={!canPay} className="flex-1 px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2 disabled:opacity-50"><Printer size={18} /> In phiếu</button>
          
          <button 
            onClick={() => setShowConfirm(true)}
            disabled={!canPay}
            className={`flex-[2] px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 ${canPay ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 active:scale-95' : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'}`}
          >
            <CheckCircle size={20} /> {loading ? '...' : `Thu tiền: ${fmtVND(total)}`}
          </button>
        </div>
      </div>

      {/* Popup Xác nhận cuối cùng */}
      <ConfirmModal 
        isOpen={showConfirm}
        title="Xác nhận thu tiền"
        message={`Bạn có chắc chắn đã thu đủ ${fmtVND(total)} từ khách hàng?`}
        onConfirm={() => { onPaid(); setShowConfirm(false) }}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  )
}