import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { Clock, ChefHat, CheckCircle, Lock, BellRing, MessageSquare } from 'lucide-react'
import ConfirmModal from '../../components/UI/ConfirmModal'

export default function Kitchen({ user }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  const openConfirm = (title, message, action) => {
    setConfirmConfig({ isOpen: true, title, message, action })
  }

  useEffect(() => {
    // Chỉ lấy đơn đang xử lý ('pending' hoặc 'cooking')
    const q = query(collection(db, 'orders'), where('status', 'in', ['pending', 'cooking']))

    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      // Sắp xếp đơn cũ lên đầu
      list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
      setOrders(list)
      setLoading(false)
    }, (error) => console.error(error))

    return () => unsub()
  }, [])

  const handleStartCooking = async (order) => {
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cooking', chefId: user.uid, chefName: user.name || 'Bếp' } : o))
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'cooking', chefId: user.uid, chefName: user.name || user.email, startedAt: new Date() })
    } catch (error) { alert("Đơn này đã được nhận!") }
  }

  const handleFinishCooking = (order) => {
    const displayName = order.tableName || order.tableId || '???'
    
    openConfirm(
      "Xác nhận hoàn thành",
      `Đã nấu xong toàn bộ món mới cho Bàn ${displayName}?`,
      async () => {
        // [QUAN TRỌNG] Cập nhật qtyCompleted = qty (Đánh dấu đã làm xong hết số lượng hiện tại)
        const updatedItems = (order.items || []).map(item => ({ 
            ...item, 
            qtyCompleted: item.qty // Cập nhật số lượng đã làm bằng tổng số lượng
        }))
        
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, items: updatedItems } : o))

        await updateDoc(doc(db, 'orders', order.id), {
          items: updatedItems,
          status: 'served', // Hoặc giữ 'pending' nếu muốn quy trình phức tạp hơn, ở đây ta cho xong luôn
          finishedAt: new Date(),
          servedBy: user.name || user.email 
        })
      }
    )
  }

  const getTimeElapsed = (timestamp) => {
    if (!timestamp) return 'Vừa xong'
    const millis = timestamp.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime()
    const minutes = Math.floor((Date.now() - millis) / 60000)
    return `${minutes} phút trước`
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <ConfirmModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} onConfirm={confirmConfig.action} title={confirmConfig.title} message={confirmConfig.message} />

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ChefHat className="text-orange-500" /> Màn hình Bếp</h2>
          <p className="text-sm text-slate-500">Chỉ hiển thị món mới gọi thêm (Chưa làm)</p>
        </div>
        <div className="text-right">
          {/* Đếm số đơn có món CẦN LÀM (qty > qtyCompleted) */}
          <span className="text-2xl font-bold text-orange-600">
            {orders.filter(o => (o.items || []).some(i => (i.qty || 0) > (i.qtyCompleted || 0))).length}
          </span>
          <span className="text-xs text-slate-500 block">Đơn cần xử lý</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? <div className="col-span-full text-center py-10 text-slate-500">Đang tải...</div> : 
         orders.length === 0 ? <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300"><ChefHat size={48} className="mb-4 opacity-50"/><p>Bếp đang rảnh.</p></div> : 
         orders.map(order => {
            // [QUAN TRỌNG] Chỉ lọc ra những món có số lượng cần làm > 0
            const pendingItems = (order.items || []).filter(i => (i.qty || 0) > (i.qtyCompleted || 0))
            
            // Nếu đơn này không còn món nào mới -> Ẩn
            if (pendingItems.length === 0) return null

            const isCooking = order.status === 'cooking'
            const isNew = order.status === 'pending'
            const isMyOrder = order.chefId === user.uid
            const displayName = order.tableName || order.tableId || '???'

            return (
              <div key={order.id} className={`relative flex flex-col h-full bg-white rounded-xl shadow-sm border-2 transition-all overflow-hidden ${isNew ? 'border-red-500 ring-4 ring-red-100' : ''} ${isCooking ? (isMyOrder ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 bg-slate-50 opacity-75') : 'border-orange-100 hover:border-orange-300'}`}>
                {isNew && <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10 animate-pulse flex items-center gap-1"><BellRing size={12} /> MỚI</div>}
                
                <div className={`p-3 border-b flex justify-between items-center ${isNew ? 'bg-red-50' : (isCooking ? (isMyOrder ? 'bg-blue-50' : 'bg-slate-100') : 'bg-orange-50')}`}>
                  <span className={`font-bold text-xl ${isNew ? 'text-red-700' : 'text-slate-800'}`}>Bàn {displayName}</span>
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-500"><Clock size={14} />{getTimeElapsed(order.updatedAt || order.createdAt)}</div>
                </div>

                {order.note && <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-800 flex gap-2 items-start"><MessageSquare size={14} className="mt-0.5 shrink-0" /><span className="font-medium italic">"{order.note}"</span></div>}

                <div className="p-4 flex-1 space-y-3">
                  <ul className="space-y-2">
                    {pendingItems.map((item, idx) => {
                      // Tính số lượng cần làm thêm: Tổng (qty) - Đã làm (qtyCompleted)
                      const quantitytodo = (item.qty || 0) - (item.qtyCompleted || 0)
                      return (
                        <li key={idx} className="flex justify-between items-start text-sm animate-fadeIn">
                          <span className="font-medium text-slate-700">
                            {/* Hiển thị số lượng MỚI gọi thêm */}
                            <span className="font-bold text-orange-600 mr-2">+{quantitytodo}</span> 
                            {item.name}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div className="p-3 border-t bg-white mt-auto">
                  {isCooking ? (
                    isMyOrder ? (
                      <button onClick={() => handleFinishCooking(order)} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-95"><CheckCircle size={18} /> Hoàn thành</button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-3 bg-slate-200 text-slate-500 font-bold rounded-lg cursor-not-allowed"><Lock size={16} /> Bếp: {order.chefName}</div>
                    )
                  ) : (
                    <button onClick={() => handleStartCooking(order)} className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 shadow-orange-200 shadow-md transition-all active:scale-95 animate-pulse"><ChefHat size={18} /> Nhận nấu ngay</button>
                  )}
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}