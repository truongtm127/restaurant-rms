// src/features/Kitchen/Kitchen.jsx
import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { Clock, ChefHat, CheckCircle, Lock, BellRing } from 'lucide-react'
import ConfirmModal from '../../components/UI/ConfirmModal' // Import Modal xác nhận

export default function Kitchen({ user }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  // State quản lý Modal xác nhận
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false, title: '', message: '', action: null
  })

  // Hàm mở Modal tiện lợi
  const openConfirm = (title, message, action) => {
    setConfirmConfig({ isOpen: true, title, message, action })
  }

  // 1. LẮNG NGHE ĐƠN HÀNG (REALTIME)
  useEffect(() => {
    // Lấy tất cả đơn chưa xong (pending hoặc cooking)
    // KHÔNG dùng orderBy ở đây để tránh lỗi Index của Firebase
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'cooking'])
    )

    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      
      // Sắp xếp Client-side: Đơn cũ nhất (createdAt nhỏ nhất) lên đầu
      list.sort((a, b) => {
         const t1 = a.createdAt?.seconds || 0
         const t2 = b.createdAt?.seconds || 0
         return t1 - t2
      })

      setOrders(list)
      setLoading(false)
    }, (error) => {
      console.error("Lỗi Realtime Bếp:", error)
    })

    return () => unsub()
  }, [])

  // 2. HÀM NHẬN NẤU
  const handleStartCooking = async (order) => {
    // A. Optimistic Update (Cập nhật giao diện ngay lập tức)
    setOrders(prev => prev.map(o => {
      if (o.id === order.id) {
        return { 
          ...o, 
          status: 'cooking', 
          chefId: user.uid, 
          chefName: user.name || 'Bếp' 
        }
      }
      return o
    }))

    // B. Gửi lên Server
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'cooking',
        chefId: user.uid,        
        chefName: user.name || user.email,     
        startedAt: new Date()
      })
    } catch (error) {
      alert("Lỗi: Có thể đơn hàng này đã được người khác nhận trước!")
    }
  }

  // 3. HÀM HOÀN THÀNH (Sử dụng ConfirmModal thay vì window.confirm)
  const handleFinishCooking = (order) => {
    const displayName = order.tableName || order.tableId || '???'
    
    openConfirm(
      "Xác nhận hoàn thành",
      `Bạn xác nhận đã nấu xong các món cho Bàn ${displayName}?`,
      async () => {
        // --- Logic khi bấm Đồng ý ---

        // A. Optimistic Update (Ẩn món ngay lập tức)
        setOrders(prev => prev.map(o => {
            if (o.id === order.id) {
                const newItems = (o.items || []).map(i => ({ ...i, isDone: true }))
                return { ...o, items: newItems }
            }
            return o
        }))

        // B. Gửi lên Server
        const updatedItems = (order.items || []).map(item => ({ ...item, isDone: true }))
        
        await updateDoc(doc(db, 'orders', order.id), {
          items: updatedItems,
          status: 'served',            // Chuyển sang trạng thái đã phục vụ
          finishedAt: new Date(),      // Lưu thời gian hoàn thành
          servedBy: user.name || user.email // Lưu tên người nấu
        })
      }
    )
  }

  // Helper tính thời gian
  const getTimeElapsed = (timestamp) => {
    if (!timestamp) return 'Vừa xong'
    const millis = timestamp.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime()
    const diff = Date.now() - millis
    const minutes = Math.floor(diff / 60000)
    return `${minutes} phút trước`
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      
      {/* Component Modal Xác nhận */}
      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.action}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />

      {/* Header Thống kê */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ChefHat className="text-orange-500" /> Màn hình Bếp
          </h2>
          <p className="text-sm text-slate-500">Quản lý chế biến (Tự động ẩn món đã xong)</p>
        </div>
        <div className="text-right">
          {/* Đếm số đơn có món chưa làm */}
          <span className="text-2xl font-bold text-orange-600">
            {orders.filter(o => (o.items || []).some(i => !i.isDone)).length}
          </span>
          <span className="text-xs text-slate-500 block">Đơn cần xử lý</span>
        </div>
      </div>

      {/* Danh sách đơn hàng (Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
           <div className="col-span-full text-center py-10 text-slate-500">Đang tải dữ liệu bếp...</div>
        ) : orders.length === 0 ? (
           <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
             <ChefHat size={48} className="mb-4 opacity-50"/>
             <p>Hiện tại không có món nào cần làm.</p>
           </div>
        ) : (
          orders.map(order => {
            // Lọc món chưa xong
            const pendingItems = (order.items || []).filter(i => !i.isDone)
            
            // Nếu đơn này không còn món nào cần làm -> Ẩn luôn Card
            if (pendingItems.length === 0) return null

            const isCooking = order.status === 'cooking'
            const isNew = order.status === 'pending'
            const isMyOrder = order.chefId === user.uid
            const displayName = order.tableName || order.tableId || '???'

            return (
              <div 
                key={order.id} 
                className={`relative flex flex-col h-full bg-white rounded-xl shadow-sm border-2 transition-all overflow-hidden
                  ${isNew ? 'border-red-500 ring-4 ring-red-100' : ''} 
                  ${isCooking 
                    ? (isMyOrder ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 bg-slate-50 opacity-75') 
                    : 'border-orange-100 hover:border-orange-300'
                  }`}
              >
                {/* Badge "MỚI" */}
                {isNew && (
                  <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10 animate-pulse flex items-center gap-1">
                    <BellRing size={12} /> MỚI
                  </div>
                )}

                {/* Header Card */}
                <div className={`p-3 border-b flex justify-between items-center 
                  ${isNew ? 'bg-red-50' : (isCooking ? (isMyOrder ? 'bg-blue-50' : 'bg-slate-100') : 'bg-orange-50')}`}>
                  
                  <span className={`font-bold text-xl ${isNew ? 'text-red-700' : 'text-slate-800'}`}>
                    Bàn {displayName}
                  </span>
                  
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    <Clock size={14} />
                    {getTimeElapsed(order.createdAt)}
                  </div>
                </div>

                {/* Danh sách món */}
                <div className="p-4 flex-1 space-y-3">
                  <ul className="space-y-2">
                    {pendingItems.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-start text-sm animate-fadeIn">
                        <span className="font-medium text-slate-700">
                          <span className="font-bold text-orange-600 mr-2">{item.qty}x</span> 
                          {item.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                  
                  {order.note && (
                    <div className="mt-2 text-xs italic text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-100">
                      Ghi chú: {order.note}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-3 border-t bg-white mt-auto">
                  {isCooking ? (
                    // TRƯỜNG HỢP: ĐANG NẤU
                    isMyOrder ? (
                      <button 
                        onClick={() => handleFinishCooking(order)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-95"
                      >
                        <CheckCircle size={18} /> Hoàn thành
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-3 bg-slate-200 text-slate-500 font-bold rounded-lg cursor-not-allowed">
                        <Lock size={16} /> Bếp: {order.chefName}
                      </div>
                    )
                  ) : (
                    // TRƯỜNG HỢP: ĐƠN MỚI
                    <button 
                      onClick={() => handleStartCooking(order)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 shadow-orange-200 shadow-md transition-all active:scale-95 animate-pulse"
                    >
                      <ChefHat size={18} /> Nhận nấu ngay
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}