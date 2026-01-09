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
import { Clock, ChefHat, CheckCircle, Lock, BellRing, MessageSquare, Sparkles, PlusCircle, AlertTriangle } from 'lucide-react'
import ConfirmModal from '../../components/UI/ConfirmModal'

export default function Kitchen({ user, showToast }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  const openConfirm = (title, message, action) => {
    setConfirmConfig({ isOpen: true, title, message, action })
  }

  // --- LẮNG NGHE ĐƠN HÀNG ---
  useEffect(() => {
    const q = query(collection(db, 'orders'), where('status', 'in', ['pending', 'cooking', 'issue']))

    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      
      list.sort((a, b) => {
         const isIssueA = a.status === 'issue'
         const isIssueB = b.status === 'issue'
         if (isIssueA && !isIssueB) return -1
         if (!isIssueA && isIssueB) return 1

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
    const tableName = order.tableName || order.tableId || '???'
    const newItemsToCook = (order.items || []).filter(item => (item.qty || 0) > (item.qtyAccepted || 0));

    if (newItemsToCook.length === 0) return;

    try {
        const itemPromises = newItemsToCook.map(async (item) => {
            const menuRef = doc(db, 'menu_items', item.menuItemId);
            const menuSnap = await getDoc(menuRef);
            return { 
                ...item, 
                qtyNeeded: (item.qty || 0) - (item.qtyAccepted || 0), 
                recipe: menuSnap.exists() ? (menuSnap.data().recipe || []) : [] 
            };
        });
        
        const itemsWithRecipe = await Promise.all(itemPromises);
        const ingredientsNeedCheck = {}; 
        const dishUsageMap = {};

        itemsWithRecipe.forEach(item => {
            if (item.recipe && item.recipe.length > 0) {
                item.recipe.forEach(ing => {
                    if (ing.ingredientId) {
                        const amount = (Number(ing.quantity) || 0) * item.qtyNeeded;
                        ingredientsNeedCheck[ing.ingredientId] = (ingredientsNeedCheck[ing.ingredientId] || 0) + amount;
                        if (!dishUsageMap[ing.ingredientId]) dishUsageMap[ing.ingredientId] = new Set();
                        dishUsageMap[ing.ingredientId].add(item.name);
                    }
                });
            }
        });

        const missingDetails = []; 
        for (const [ingId, amountNeeded] of Object.entries(ingredientsNeedCheck)) {
            const invRef = doc(db, 'inventory', ingId);
            const invSnap = await getDoc(invRef);
            
            if (invSnap.exists()) {
                const invData = invSnap.data();
                const currentStock = Number(invData.quantity) || 0; 
                
                if (currentStock < amountNeeded) {
                    const missingQty = amountNeeded - currentStock;
                    const affectedDishes = Array.from(dishUsageMap[ingId] || []).join(', ');
                    missingDetails.push(
                        `🔴 ${invData.name}: Thiếu ${missingQty.toLocaleString('vi-VN')} ${invData.unit}\n` +
                        `   (Kho: ${currentStock} | Cần: ${amountNeeded})\n` +
                        `   👉 Món: ${affectedDishes}`
                    );
                }
            } else {
                missingDetails.push(`🔴 Lỗi dữ liệu: Không tìm thấy NL ID ${ingId}`);
            }
        }

        if (missingDetails.length > 0) {
            const warningMsg = `Bàn ${tableName} không đủ nguyên liệu:\n\n${missingDetails.join('\n\n')}\n\n👉 Vui lòng hỏi khách đổi món.`;
            
            await addDoc(collection(db, 'notifications'), {
                type: 'kitchen_issue',
                title: `🚨 THIẾU NGUYÊN LIỆU (BÀN ${tableName})`,
                message: warningMsg,
                isRead: false,
                createdAt: serverTimestamp(),
                createdBy: user.name || 'Kitchen'
            });

            await updateDoc(doc(db, 'orders', order.id), {
                status: 'issue',
                kitchenNote: warningMsg 
            });

            showToast(
                <div className="text-left">
                    <div className="font-bold text-sm">⛔ Đã báo thiếu nguyên liệu!</div>
                    <div className="text-xs mt-1 text-slate-200">Đơn hàng đã chuyển sang trạng thái "Chờ xử lý".</div>
                </div>
            , 'warning');
            
            return;
        }

    } catch (err) {
        console.error("Lỗi check kho:", err);
        showToast("Lỗi hệ thống khi kiểm tra kho.", "error");
        return;
    }
    
    const acceptedItems = (order.items || []).map(item => ({ ...item, qtyAccepted: item.qty }))
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cooking', items: acceptedItems, chefId: user.uid, chefName: user.name } : o))

    try {
      await updateDoc(doc(db, 'orders', order.id), { 
          status: 'cooking', 
          items: acceptedItems,
          chefId: user.uid, 
          chefName: user.name || user.email, 
          startedAt: order.startedAt || serverTimestamp(),
          kitchenNote: null
      })
      showToast("👨‍🍳 Đã nhận nấu thành công!", "success");
    } catch (error) { 
        console.error(error)
        showToast("Lỗi cập nhật trạng thái!", "error");
    }
  }

  // --- 2. HOÀN THÀNH & TRỪ KHO ---
  const handleFinishCooking = (order) => {
    const tableName = order.tableName || order.tableId || '???'
    const locationLabel = order.zone ? `${order.zone} - ${tableName}` : `Bàn ${tableName}`
    const waiterName = order.createdByName || 'Phục vụ'; 

    openConfirm(
      "Xác nhận hoàn thành",
      `Đã nấu xong toàn bộ món cho ${locationLabel}?`,
      async () => {
        try {
            const batch = writeBatch(db)
            const updatedItems = (order.items || []).map(item => ({ ...item, qtyCompleted: item.qty, qtyAccepted: item.qty }))

            // 1. Lấy công thức
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

            // 2. Fetch data kho để check tồn tại
            const allIngredientIds = new Set();
            itemsWithRecipe.forEach(item => {
                if(item.recipe) item.recipe.forEach(ing => {
                    if(ing.ingredientId) allIngredientIds.add(ing.ingredientId)
                })
            })

            const inventoryDocs = {}; 
            const validIds = new Set(); 

            if (allIngredientIds.size > 0) {
                const invPromises = Array.from(allIngredientIds).map(async (id) => {
                    const snap = await getDoc(doc(db, 'inventory', id));
                    if (snap.exists()) {
                        inventoryDocs[id] = snap.data();
                        validIds.add(id);
                    }
                });
                await Promise.all(invPromises);
            }

            // 3. Tính toán trừ kho & Cảnh báo sắp hết
            const alerts = [];
            const usageMap = {};

            itemsWithRecipe.forEach(item => {
                const qtyDish = Number(item.qty || 0)
                if (item.recipe) {
                    item.recipe.forEach(ing => {
                        if (ing.ingredientId && validIds.has(ing.ingredientId)) {
                            const totalDeduct = (Number(ing.quantity) || 0) * qtyDish
                            usageMap[ing.ingredientId] = (usageMap[ing.ingredientId] || 0) + totalDeduct;

                            if (totalDeduct > 0) {
                                const invRef = doc(db, 'inventory', ing.ingredientId)
                                batch.update(invRef, { quantity: increment(-totalDeduct) })
                            }
                        }
                    })
                }
            })

            for (const [ingId, deductAmount] of Object.entries(usageMap)) {
                const invData = inventoryDocs[ingId];
                if (invData) {
                    const currentStock = Number(invData.quantity) || 0;
                    const minThreshold = Number(invData.minThreshold) || 0;
                    const stockAfter = currentStock - deductAmount;

                    if (stockAfter <= minThreshold) {
                        alerts.push(`${invData.name} (Còn: ${stockAfter} ${invData.unit})`);
                    }
                }
            }

            if (alerts.length > 0) {
                await addDoc(collection(db, 'notifications'), {
                    type: 'low_stock',
                    title: '⚠️ CẢNH BÁO KHO (SAU KHI NẤU)',
                    message: `Sau khi nấu xong cho Bàn ${tableName}, các món sau cần nhập:\n- ${alerts.join('\n- ')}`,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    createdBy: 'System (Kitchen)'
                });
            }

            // 4. Update Order & Gửi thông báo gọi phục vụ
            const orderRef = doc(db, 'orders', order.id)
            batch.update(orderRef, {
                items: updatedItems,
                status: 'served', 
                finishedAt: serverTimestamp(),
                servedBy: user.name || user.email 
            })

            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
                type: 'order_ready',
                title: `✅ MÓN ĐÃ XONG (BÀN ${tableName})`,
                message: `Bếp đã hoàn thành đơn. Mời bạn ${waiterName} mang món ra cho khách.`,
                isRead: false,
                createdAt: serverTimestamp(),
                createdBy: user.name || 'Kitchen',
                targetUid: order.createdBy || null 
            });

            await batch.commit()
            setOrders(prev => prev.filter(o => o.id !== order.id)) 
            showToast(`✅ Đã gọi ${waiterName} lấy món!`, "success");

        } catch (error) {
            console.error("Lỗi hoàn thành đơn:", error)
            showToast("Lỗi khi trừ kho: " + error.message, "error");
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

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ChefHat className="text-orange-500" /> Màn hình Bếp</h2>
          <p className="text-sm text-slate-500">Quản lý nấu nướng & Check kho tự động</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-orange-600">{orders.length}</span>
          <span className="text-xs text-slate-500 block">Đơn đang xử lý</span>
        </div>
      </div>

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
            const newItems = items.filter(i => (i.qty || 0) > (i.qtyAccepted || 0)).map(i => ({ ...i, qtyDisplay: (i.qty || 0) - (i.qtyAccepted || 0) }))
            const cookingItems = items.filter(i => (i.qtyAccepted || 0) > (i.qtyCompleted || 0)).map(i => ({ ...i, qtyDisplay: (i.qtyAccepted || 0) - (i.qtyCompleted || 0) }))
            const hasNew = newItems.length > 0
            const hasCooking = cookingItems.length > 0
            const isAddOn = hasNew && items.some(i => (i.qtyAccepted || 0) > 0)
            const isFirstOrder = hasNew && !isAddOn
            
            const isIssue = order.status === 'issue'

            if (!hasNew && !hasCooking && !isIssue) return null

            const isMyOrder = order.chefId === user.uid
            const tableName = order.tableName || order.tableId || '???'

            let borderClass = 'border-slate-200 bg-slate-50 opacity-75' 
            if (isIssue) borderClass = 'border-amber-400 ring-4 ring-amber-100 bg-amber-50'
            else if (isMyOrder && hasCooking) borderClass = 'border-blue-500 ring-2 ring-blue-50'
            else if (isFirstOrder) borderClass = 'border-red-500 ring-4 ring-red-100' 
            else if (isAddOn) borderClass = 'border-orange-500 ring-4 ring-orange-100'

            return (
              <div key={order.id} className={`relative flex flex-col h-full bg-white rounded-xl shadow-sm border-2 transition-all overflow-hidden ${borderClass}`}>
                {isFirstOrder && !isIssue && <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10 animate-pulse flex items-center gap-1"><BellRing size={12}/> ĐƠN MỚI</div>}
                {isAddOn && !isIssue && <div className="absolute top-0 right-0 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10 animate-pulse flex items-center gap-1"><PlusCircle size={12}/> GỌI THÊM</div>}
                {isIssue && <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10 flex items-center gap-1"><AlertTriangle size={12}/> CHỜ XỬ LÝ</div>}
                
                <div className={`p-3 border-b flex justify-between items-center ${isIssue ? 'bg-amber-100' : (isFirstOrder ? 'bg-red-50' : (isAddOn ? 'bg-orange-50' : (isMyOrder ? 'bg-blue-50' : 'bg-slate-100')))}`}>
                   <div>
                      <span className={`font-bold text-xl ${hasNew ? 'text-slate-800' : 'text-slate-600'}`}>
                        {order.zone ? `${order.zone} - ${tableName}` : tableName}
                      </span>
                   </div>
                   <div className="flex items-center gap-1 text-xs font-medium text-slate-500"><Clock size={14} />{getTimeElapsed(order.updatedAt || order.createdAt)}</div>
                </div>

                {/* Ghi chú lỗi */}
                {isIssue && order.kitchenNote && (
                    <div className="px-3 py-2 bg-white border-b border-amber-200 text-xs text-red-600 font-medium whitespace-pre-line border-l-4 border-l-red-500 shadow-inner">
                        {order.kitchenNote}
                    </div>
                )}

                {order.note && !isIssue && <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-800 flex gap-2 items-start"><MessageSquare size={14} className="mt-0.5 shrink-0" /><span className="font-medium italic">"{order.note}"</span></div>}

                <div className="p-4 flex-1 space-y-4">
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

                <div className="p-3 border-t bg-white mt-auto">
                  {isIssue ? (
                      <button disabled className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-400 font-bold rounded-lg cursor-not-allowed">
                          <AlertTriangle size={18} /> Đang chờ phục vụ...
                      </button>
                  ) : hasNew ? (
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