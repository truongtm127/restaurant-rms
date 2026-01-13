import React, { useEffect, useState, useMemo } from 'react'
import { X, Printer, CheckCircle, AlertCircle, TicketPercent } from 'lucide-react'
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { fmtVND } from '../../utils/helpers'
import ConfirmModal from '../../components/UI/ConfirmModal'

export default function InvoiceModal({ user, activeOrderId, activeTable, onClose, onPaid }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [coupons, setCoupons] = useState([])
  const [selectedCoupon, setSelectedCoupon] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // Fetch Data (Order Items & Active Coupons)
  useEffect(() => {
    const fetchData = async () => {
      if (!activeOrderId) return
      setLoading(true)
      try {
        // Fetch Order Items
        const itemsSnap = await getDocs(collection(db, 'orders', activeOrderId, 'items'))
        setItems(itemsSnap.docs.map(d => d.data()))
        
        // Fetch Active Coupons
        const couponSnap = await getDocs(query(collection(db, 'coupons'), where('isActive', '==', true)))
        setCoupons(couponSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (error) {
        console.error("Invoice Error:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [activeOrderId])

  // Calculations
  const { subTotal, discountAmount, finalTotal } = useMemo(() => {
    const total = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0)
    
    let discount = 0
    if (selectedCoupon) {
      if (selectedCoupon.type === 'percent') {
        discount = total * (selectedCoupon.value / 100)
      } else {
        discount = Math.min(selectedCoupon.value, total)
      }
    }

    return {
      subTotal: total,
      discountAmount: discount,
      finalTotal: Math.max(0, total - discount)
    }
  }, [items, selectedCoupon])

  const canPay = !loading && items.length > 0 && finalTotal >= 0

  // Handlers
  const handlePrint = () => window.print()

  const handleConfirmPay = async () => {
    try {
      const updateData = {
        total: subTotal,
        finalTotal: finalTotal,
        discountValue: discountAmount,
        discountCode: selectedCoupon ? selectedCoupon.code : null
      }
      
      await updateDoc(doc(db, 'orders', activeOrderId), updateData)
      
      onPaid()
      setShowConfirm(false)
    } catch (e) {
      console.error("Payment Error:", e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}/>

      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Thanh toán</h2>
            <p className="text-sm text-slate-500">Bàn {activeTable?.name || activeTable?.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {loading ? (
            <div className="flex justify-center py-10 text-slate-400">Đang tính tiền...</div>
          ) : (
            <div className="space-y-4">
              {/* Item List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 flex flex-col items-center">
                    <AlertCircle size={32} className="mb-2 opacity-50"/>
                    <p>Chưa có món ăn nào</p>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm border-b border-dashed border-slate-100 pb-2 last:border-0">
                      <div className="flex-1">
                        <span className="font-medium text-slate-700">{item.name}</span>
                        <div className="text-xs text-slate-400">x{item.qty}</div>
                      </div>
                      <div className="font-medium text-slate-800">
                        {fmtVND(Number(item.price) * Number(item.qty))}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Coupon Selection */}
              {items.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                   <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-1">
                     <TicketPercent size={14}/> KHUYẾN MÃI
                   </label>
                   <select 
                     className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-emerald-500"
                     onChange={(e) => setSelectedCoupon(coupons.find(x => x.id === e.target.value) || null)}
                     defaultValue=""
                   >
                     <option value="">-- Không áp dụng --</option>
                     {coupons.map(c => (
                       <option key={c.id} value={c.id}>
                         {c.code} - {c.description} ({c.type === 'percent' ? `-${c.value}%` : `-${fmtVND(c.value)}`})
                       </option>
                     ))}
                   </select>
                </div>
              )}

              {/* Summary */}
              <div className="mt-4 pt-4 border-t-2 border-slate-100 space-y-2 bg-slate-50 p-3 rounded-xl">
                <div className="flex justify-between text-slate-500 text-sm">
                  <span>Tạm tính:</span>
                  <span>{fmtVND(subTotal)}</span>
                </div>
                
                {selectedCoupon && (
                  <div className="flex justify-between text-emerald-600 text-sm font-medium animate-fadeIn">
                    <span>Giảm giá ({selectedCoupon.code}):</span>
                    <span>- {fmtVND(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                  <span className="text-base font-bold text-slate-700">KHÁCH CẦN TRẢ</span>
                  <span className="text-2xl font-bold text-emerald-600">{fmtVND(finalTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button 
            onClick={handlePrint} 
            disabled={!canPay} 
            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Printer size={18} /> In phiếu
          </button>
          
          <button 
            onClick={() => setShowConfirm(true)}
            disabled={!canPay}
            className={`flex-[2] px-4 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 ${canPay ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 active:scale-95' : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'}`}
          >
            <CheckCircle size={20} /> {loading ? '...' : `Thu: ${fmtVND(finalTotal)}`}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal 
        isOpen={showConfirm}
        title="Xác nhận thu tiền"
        message={
          <div className="text-center">
             <div className="text-slate-500 mb-2">Xác nhận thanh toán cho bàn <b>{activeTable?.name}</b></div>
             <div className="text-3xl font-bold text-emerald-600 mb-2">{fmtVND(finalTotal)}</div>
             {selectedCoupon && (
               <div className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded inline-block">
                 Đã áp dụng mã: {selectedCoupon.code} (-{fmtVND(discountAmount)})
               </div>
             )}
          </div>
        }
        onConfirm={handleConfirmPay}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  )
}