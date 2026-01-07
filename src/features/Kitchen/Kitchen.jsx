import React, { useEffect, useState } from 'react'
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  updateDoc, 
  doc, 
  getDoc, 
  writeBatch, 
  increment,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '../../firebase'
import { Clock, ChefHat, CheckCircle, Lock, BellRing, MessageSquare, Sparkles, PlusCircle } from 'lucide-react'
import ConfirmModal from '../../components/UI/ConfirmModal'

export default function Kitchen({ user }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  const openConfirm = (title, message, action) => {
    setConfirmConfig({ isOpen: true, title, message, action })
  }

  // --- LẮNG NGHE ĐƠN HÀNG ---
  useEffect(() => {
    const q = query(collection(db, 'orders'), where('status', 'in', ['pending', 'cooking']))

    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      
      list.sort((a, b) => {
         const hasNewA = (a.items||[]).some(i => (i.qty || 0) > (i.qtyAccepted || 0))
         const hasNewB = (b.items||[]).some(i => (i.qty || 0) > (i.qtyAccepted || 0))
         if (hasNewA && !hasNewB) return -1
         if (!hasNewA && hasNewB) return 1
         return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      })
      
      setOrders(list)
      setLoading(false)
    }, (error) => console.error("Lỗi tải đơn bếp:", error))

    return () => unsub()
  }, [])

  // --- 1. NHẬN NẤU ---
  const handleAcceptCooking = async (order) => {
    const acceptedItems = (order.items || []).map(item => ({
        ...item,
        qtyAccepted: item.qty 
    }))

    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cooking', items: acceptedItems, chefId: user.uid, chefName: user.name || 'Bếp' } : o))

    try {
      await updateDoc(doc(db, 'orders', order.id), { 
          status: 'cooking', 
          items: acceptedItems,
          chefId: user.uid, 
          chefName: user.name || user.email, 
          startedAt: order.startedAt || serverTimestamp() 
      })
    } catch (error) { 
        console.error(error)
        alert("Lỗi cập nhật trạng thái nhận nấu!") 
    }
  }

  // =========================================================================
  // LOGIC 2: HOÀN THÀNH & TRỪ KHO (CÓ CẢNH BÁO SẮP HẾT HÀNG)
  // =========================================================================
  const handleFinishCooking = (order) => {
    const tableName = order.tableName || order.tableId || '???'
    const locationLabel = order.zone ? `${order.zone} - ${tableName}` : `Bàn ${tableName}`
    
    openConfirm(
      "Xác nhận hoàn thành",
      `Đã nấu xong toàn bộ món cho ${locationLabel}? Kho sẽ được tự động trừ.`,
      async () => {
        try {
            const batch = writeBatch(db)

            // A. Đánh dấu items là đã xong
            const updatedItems = (order.items || []).map(item => ({ 
                ...item, 
                qtyCompleted: item.qty,
                qtyAccepted: item.qty 
            }))

            // B. Lấy công thức mới nhất & Fetch thông tin Kho hiện tại
            const itemPromises = order.items.map(async (item) => {
                const menuRef = doc(db, 'menu_items', item.menuItemId)
                const menuSnap = await getDoc(menuRef)
                
                if (menuSnap.exists()) {
                    const data = menuSnap.data()
                    return { ...item, recipe: data.recipe || [] }
                }
                return { ...item, recipe: [] }
            })

            const itemsWithRecipe = await Promise.all(itemPromises)

            // --- BƯỚC MỚI: TÍNH TOÁN & CẢNH BÁO ---
            const usageMap = {}; // { ingredientId: amountToDeduct }
            const uniqueIngIds = new Set();

            // 1. Tổng hợp số lượng cần trừ
            itemsWithRecipe.forEach(item => {
                const qtyDish = Number(item.qty || 0)
                if (item.recipe && item.recipe.length > 0) {
                    item.recipe.forEach(ing => {
                        if (ing.ingredientId) {
                            const totalDeduct = (Number(ing.quantity) || 0) * qtyDish;
                            usageMap[ing.ingredientId] = (usageMap[ing.ingredientId] || 0) + totalDeduct;
                            uniqueIngIds.add(ing.ingredientId);
                        }
                    })
                }
            });

            // 2. Fetch dữ liệu kho để check định mức
            if (uniqueIngIds.size > 0) {
                const invPromises = Array.from(uniqueIngIds).map(id => getDoc(doc(db, 'inventory', id)));
                const invSnaps = await Promise.all(invPromises);
                
                const alerts = [];

                invSnaps.forEach(snap => {
                    if (snap.exists()) {
                        const invData = snap.data();
                        const deductAmount = usageMap[snap.id] || 0;
                        const currentStock = Number(invData.quantity) || 0;
                        const minThreshold = Number(invData.minThreshold) || 0;
                        
                        // Dự tính tồn kho sau khi trừ
                        const stockAfter = currentStock - deductAmount;

                        // Nếu tụt xuống dưới hoặc bằng định mức -> Cảnh báo
                        if (stockAfter <= minThreshold) {
                            const status = stockAfter <= 0 ? 'ĐÃ HẾT' : 'SẮP HẾT';
                            alerts.push(`${invData.name} (Còn: ${stockAfter} ${invData.unit})`);
                        }
                    }
                });

                // 3. Gửi thông báo nếu có cảnh báo
                if (alerts.length > 0) {
                    await addDoc(collection(db, 'notifications'), {
                        type: 'low_stock',
                        title: '⚠️ CẢNH BÁO KHO (SAU KHI NẤU)',
                        message: `Sau khi hoàn thành đơn Bàn ${tableName}, các nguyên liệu sau cần nhập thêm:\n- ${alerts.join('\n- ')}`,
                        isRead: false,
                        createdAt: serverTimestamp(),
                        createdBy: 'System (Kitchen)'
                    });
                }
            }
            // ----------------------------------------

            // C. Thực hiện Trừ kho (Batch Update)
            itemsWithRecipe.forEach(item => {
                const qtyDish = Number(item.qty || 0)
                if (item.recipe) {
                    item.recipe.forEach(ing => {
                        if (ing.ingredientId) {
                            const invRef = doc(db, 'inventory', ing.ingredientId)
                            const totalDeduct = (Number(ing.quantity) || 0) * qtyDish
                            
                            if (totalDeduct > 0) {
                                batch.update(invRef, { 
                                    quantity: increment(-totalDeduct) 
                                })
                            }
                        }
                    })
                }
            })

            // D. Cập nhật trạng thái Order
            const orderRef = doc(db, 'orders', order.id)
            batch.update(orderRef, {
                items: updatedItems,
                status: 'served', 
                finishedAt: serverTimestamp(),
                servedBy: user.name || user.email 
            })

            await batch.commit()
            setOrders(prev => prev.filter(o => o.id !== order.id)) 

        } catch (error) {
            console.error("Lỗi hoàn thành đơn:", error)
            alert("Có lỗi xảy ra khi hoàn thành đơn: " + error.message)
        }
      }
    )
  }

  const getTimeElapsed = (timestamp) => {
    if (!timestamp) return 'Vừa xong'
    const millis = timestamp.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime()
    const minutes = Math.floor((Date.now() - millis) / 60000)
    return `${minutes} p`
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <ConfirmModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} onConfirm={confirmConfig.action} title={confirmConfig.title} message={confirmConfig.message} />

      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ChefHat className="text-orange-500" /> Màn hình Bếp</h2>
          <p className="text-sm text-slate-500">Quản lý nấu nướng & Tự động trừ kho</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-orange-600">{orders.length}</span>
          <span className="text-xs text-slate-500 block">Đơn đang xử lý</span>
        </div>
      </div>

      {/* LIST ORDERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? <div className="col-span-full text-center py-10 text-slate-500">Đang tải dữ liệu...</div> : 
         orders.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                <ChefHat size={48} className="mb-4 opacity-50"/>
                <p>Bếp đang rảnh rỗi.</p>
            </div>
         ) : 
         orders.map(order => {
            const items = order.items || []
            
            const newItems = items.filter(i => (i.qty || 0) > (i.qtyAccepted || 0)).map(i => ({
                ...i, qtyDisplay: (i.qty || 0) - (i.qtyAccepted || 0)
            }))
            const cookingItems = items.filter(i => (i.qtyAccepted || 0) > (i.qtyCompleted || 0)).map(i => ({
                ...i, qtyDisplay: (i.qtyAccepted || 0) - (i.qtyCompleted || 0)
            }))

            const hasNew = newItems.length > 0
            const hasCooking = cookingItems.length > 0
            const isAddOn = hasNew && items.some(i => (i.qtyAccepted || 0) > 0)
            const isFirstOrder = hasNew && !isAddOn

            if (!hasNew && !hasCooking) return null

            const isMyOrder = order.chefId === user.uid
            const tableName = order.tableName || order.tableId || '???'

            let borderClass = 'border-slate-200 bg-slate-50 opacity-75' 
            if (isMyOrder && hasCooking) borderClass = 'border-blue-500 ring-2 ring-blue-50'
            if (isFirstOrder) borderClass = 'border-red-500 ring-4 ring-red-100' 
            if (isAddOn) borderClass = 'border-orange-500 ring-4 ring-orange-100'

            return (
              <div key={order.id} className={`relative flex flex-col h-full bg-white rounded-xl shadow-sm border-2 transition-all overflow-hidden ${borderClass}`}>
                {isFirstOrder && <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10 animate-pulse flex items-center gap-1"><BellRing size={12}/> ĐƠN MỚI</div>}
                {isAddOn && <div className="absolute top-0 right-0 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10 animate-pulse flex items-center gap-1"><PlusCircle size={12}/> GỌI THÊM</div>}
                
                <div className={`p-3 border-b flex justify-between items-center ${isFirstOrder ? 'bg-red-50' : (isAddOn ? 'bg-orange-50' : (isMyOrder ? 'bg-blue-50' : 'bg-slate-100'))}`}>
                   <div>
                      <span className={`font-bold text-xl ${hasNew ? 'text-slate-800' : 'text-slate-600'}`}>
                        {order.zone ? `${order.zone} - ${tableName}` : tableName}
                      </span>
                   </div>
                   <div className="flex items-center gap-1 text-xs font-medium text-slate-500"><Clock size={14} />{getTimeElapsed(order.updatedAt || order.createdAt)}</div>
                </div>

                {order.note && <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-800 flex gap-2 items-start"><MessageSquare size={14} className="mt-0.5 shrink-0" /><span className="font-medium italic">"{order.note}"</span></div>}

                <div className="p-4 flex-1 space-y-4">
                  {/* Món Mới */}
                  {hasNew && (
                    <div className="animate-fadeIn">
                        {isAddOn && <div className="text-xs font-bold text-orange-600 uppercase mb-1 flex items-center gap-1"><Sparkles size={12}/> Mới gọi thêm</div>}
                        <ul className="space-y-2">
                            {newItems.map((item, idx) => (
                                <li key={`new-${idx}`} className={`flex justify-between items-start text-sm p-2 rounded-lg border ${isAddOn ? 'bg-orange-50 border-orange-100' : 'bg-white border-transparent p-0'}`}>
                                    <span className="font-bold text-slate-700 flex items-center">
                                        <span className={`${isAddOn ? 'bg-orange-600' : 'bg-red-600'} text-white px-2 py-0.5 rounded text-xs mr-2`}>+{item.qtyDisplay}</span> 
                                        {item.name}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                  )}

                  {/* Món Đang Nấu */}
                  {hasCooking && (
                    <div>
                        {hasNew && <div className="border-t border-dashed border-slate-200 my-3"></div>}
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Đang thực hiện</div>
                        <ul className="space-y-2">
                            {cookingItems.map((item, idx) => (
                                <li key={`cooking-${idx}`} className="flex justify-between items-start text-sm">
                                    <span className="font-medium text-slate-700 flex items-center">
                                        <span className="font-bold text-slate-500 mr-2 border border-slate-300 px-1.5 rounded text-xs">{item.qtyDisplay}</span> 
                                        {item.name}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="p-3 border-t bg-white mt-auto">
                  {hasNew ? (
                      <button onClick={() => handleAcceptCooking(order)} className={`w-full flex items-center justify-center gap-2 py-3 text-white font-bold rounded-lg shadow-md transition-all active:scale-95 animate-pulse ${isAddOn ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}>
                          <ChefHat size={18} /> {isAddOn ? 'Nhận món thêm' : 'Nhận nấu'}
                      </button>
                  ) : (
                      isMyOrder ? (
                        <button onClick={() => handleFinishCooking(order)} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-95">
                            <CheckCircle size={18} /> Hoàn thành
                        </button>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-3 bg-slate-200 text-slate-500 font-bold rounded-lg cursor-not-allowed"><Lock size={16} /> Bếp: {order.chefName}</div>
                      )
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