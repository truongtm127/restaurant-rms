import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, CheckCircle, ArrowLeft, FilePenLine, X, CreditCard } from 'lucide-react'
import {
  collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc,
  getDocs, orderBy, limit, startAfter, serverTimestamp, query, getDoc,
  writeBatch, increment
} from 'firebase/firestore'
import { db } from '../../firebase'
import ItemCard from './ItemCard'
import MenuItemModal from './MenuItemModal'
import InvoiceModal from '../Order/InvoiceModal'
import ConfirmModal from '../../components/UI/ConfirmModal'
import RecipeModal from './RecipeModal'

const PAGE_SIZE = 100

// --- SUB-COMPONENTS ---
const Chip = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${
      active
        ? 'bg-emerald-600 text-white border-emerald-600'
        : 'bg-white hover:bg-slate-50 border-gray-200 text-gray-700'
    }`}
  >
    {children}
  </button>
)

const SkeletonCard = () => (
  <div className="rounded-xl bg-slate-100 animate-pulse aspect-[3/4]" />
)

export default function Menu({
  user,
  activeTable,
  activeOrderId,
  setActiveTable,
  setActiveOrderId,
  setRoute,
  showToast
}) {
  // --- STATE ---
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(null)
  
  // Inventory & Stock Check State
  const [inventory, setInventory] = useState({})
  const [committedItems, setCommittedItems] = useState([]) // Các món đã gửi bếp thành công (để tính delta)

  // Filter & Sort
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('Tất cả')
  const [sortBy, setSortBy] = useState('popular')

  // Order State
  const [orderItems, setOrderItems] = useState([])
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderNote, setOrderNote] = useState('')

  // Modals
  const [showInvoice, setShowInvoice] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [recipeEditing, setRecipeEditing] = useState(null)
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  const isManager = user?.role === 'MANAGER'

  // --- DATA LOADING ---
  // 1. Menu Items
  const loadPage = async (reset = false) => {
    setLoading(true)
    try {
      const baseConstraints = [orderBy('created_at', 'desc'), limit(PAGE_SIZE)]
      const qRef = reset || !cursor
        ? query(collection(db, 'menu_items'), ...baseConstraints)
        : query(collection(db, 'menu_items'), ...baseConstraints, startAfter(cursor))

      const snap = await getDocs(qRef)
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      
      setCursor(snap.docs[snap.docs.length - 1] || null)
      setItems((prev) => (reset ? data : [...prev, ...data]))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPage(true)
  }, [])

  // 2. Inventory (Realtime Listener for Stock Check)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventory'), (snap) => {
      const invMap = {}
      snap.forEach(d => {
        invMap[d.id] = d.data() // Lưu toàn bộ data để lấy cả quantity lẫn tên (nếu cần alert)
      })
      setInventory(invMap)
    })
    return () => unsub()
  }, [])

  // 3. Committed Items (Lắng nghe đơn gốc để biết cái nào đã trừ kho rồi)
  useEffect(() => {
    if (!activeOrderId) {
        setCommittedItems([])
        return
    }
    const unsub = onSnapshot(doc(db, 'orders', activeOrderId), (snap) => {
        if (snap.exists()) {
            setCommittedItems(snap.data().items || [])
        }
    })
    return () => unsub()
  }, [activeOrderId])

  // --- ORDER LISTENER (Current Cart) ---
  useEffect(() => {
    if (!activeOrderId) {
      setOrderItems([])
      setOrderNote('')
      return
    }
    
    setOrderLoading(true)
    // Listen to subcollection 'items' (Giỏ hàng tạm)
    const unsub = onSnapshot(collection(db, 'orders', activeOrderId, 'items'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setOrderItems(list)
      setOrderLoading(false)
    })

    // Get order note
    getDoc(doc(db, 'orders', activeOrderId)).then((snap) => {
      if (snap.exists()) setOrderNote(snap.data().note || '')
    })

    return () => unsub()
  }, [activeOrderId])

  // --- CALCULATIONS ---
  const cartTotal = orderItems.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 1), 0)
  const hasItems = orderItems.length > 0
  const categories = useMemo(() => ['Tất cả', ...new Set(items.map((x) => x.category || 'Khác'))], [items])

  const filteredItems = useMemo(() => {
    let list = items
    if (category !== 'Tất cả') list = list.filter((x) => (x.category || 'Khác') === category)
    if (q.trim()) list = list.filter((x) => x.name?.toLowerCase().includes(q.trim().toLowerCase()))
    
    // Sort logic
    return list.sort((a, b) => {
      if (a.is_available !== b.is_available) return b.is_available - a.is_available
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [items, q, category, sortBy])

  // --- STOCK CHECK HELPER ---
  const checkStock = (menuItem, qtyToAdd = 1) => {
    // Nếu món không có công thức, cho qua luôn
    if (!menuItem.recipe || menuItem.recipe.length === 0) return true

    // 1. Tìm số lượng món này đang có trong giỏ (tạm tính)
    const currentCartItem = orderItems.find(x => x.menuItemId === menuItem.id)
    const currentCartQty = currentCartItem ? (currentCartItem.qty || 0) : 0

    // 2. Tìm số lượng món này đã được "Cam kết" (đã gửi bếp và đã trừ kho trước đó)
    // Dùng activeOrderId để match item trong committedItems
    // Vì subcollection ID (currentCartItem.id) khớp với ID trong committedItems array
    let alreadyCommittedQty = 0
    if (currentCartItem) {
        const committed = committedItems.find(x => x.id === currentCartItem.id)
        alreadyCommittedQty = committed ? (committed.qty || 0) : 0
    }

    // 3. Tính số lượng cần thêm mới so với kho hiện tại
    // Delta là lượng hàng "Pending" chưa trừ kho
    const pendingDelta = Math.max(0, currentCartQty - alreadyCommittedQty)
    const totalNewNeeded = pendingDelta + qtyToAdd

    // 4. Kiểm tra từng nguyên liệu
    for (const ing of menuItem.recipe) {
        if (!ing.ingredientId) continue
        
        const inventoryItem = inventory[ing.ingredientId]
        const currentStock = inventoryItem ? Number(inventoryItem.quantity || 0) : 0
        const requiredAmount = Number(ing.quantity || 0) * totalNewNeeded

        if (currentStock < requiredAmount) {
             return false // Không đủ hàng
        }
    }
    return true // Đủ hàng
  }

  // --- ACTIONS ---

  const handleBackToOrder = async () => {
    if (!activeOrderId) return

    if (hasItems) {
      try {
        const batch = writeBatch(db)
        const orderRef = doc(db, 'orders', activeOrderId)

        // 1. Tính toán trừ kho (Inventory Deduction)
        const inventoryUpdates = {} // Map: ingredientId -> amount to deduct
        
        // Tạo danh sách items cuối cùng để lưu vào Order Doc
        const finalItems = orderItems.map(cartItem => {
             const existing = committedItems.find(x => x.id === cartItem.id)
             const previousQty = existing ? (existing.qty || 0) : 0
             const currentQty = cartItem.qty || 0
             const delta = currentQty - previousQty
             
             // Nếu số lượng tăng lên, cần trừ kho thêm
             if (delta > 0) {
                 // Lấy recipe từ cartItem (đã lưu lúc add) hoặc fallback về items list
                 let recipe = cartItem.recipe
                 if (!recipe) {
                    const originalItem = items.find(m => m.id === cartItem.menuItemId)
                    recipe = originalItem?.recipe || []
                 }

                 if (recipe && recipe.length > 0) {
                     recipe.forEach(ing => {
                         if (ing.ingredientId) {
                             const amount = (Number(ing.quantity) || 0) * delta
                             inventoryUpdates[ing.ingredientId] = (inventoryUpdates[ing.ingredientId] || 0) + amount
                         }
                     })
                 }
             }

             // Cấu trúc item lưu vào mảng items của Order
             // Giữ nguyên trạng thái nấu của bếp (qtyCompleted) nếu đã có
             return existing 
               ? { ...existing, qty: currentQty, note: cartItem.note || '' } 
               : { ...cartItem, qtyCompleted: 0, qtyAccepted: 0 } // Mới tinh thì chưa nấu, chưa nhận
        })

        // Add Inventory updates to Batch
        for (const [ingId, deductAmount] of Object.entries(inventoryUpdates)) {
            const invRef = doc(db, 'inventory', ingId)
            // Dùng increment số âm để trừ
            batch.update(invRef, { quantity: increment(-deductAmount) })
        }

        // 2. Cập nhật Order
        batch.update(orderRef, {
          status: 'pending', // Chuyển trạng thái để bếp thấy
          kitchenNote: null,
          items: finalItems,
          total: cartTotal,
          note: orderNote,
          updatedAt: serverTimestamp()
        })
        
        await batch.commit()
        
        showToast("✅ Đã gửi bếp & Trừ kho thành công!", "success")
      } catch (error) {
        console.error("Send to Kitchen Error:", error)
        showToast("Lỗi hệ thống: " + error.message, "error")
        return
      }
    } else {
      // Empty order -> Cancel/Cleanup
      try {
        await deleteDoc(doc(db, 'orders', activeOrderId))
        await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' })
      } catch (e) {
        console.error("Cleanup Error:", e)
      }
    }

    // Reset Navigation
    setActiveTable(null)
    setActiveOrderId(null)
    setRoute('order')
  }

  const handlePayNow = () => {
    if (hasItems) setShowInvoice(true)
  }

  const onPaidSuccess = async () => {
    try {
      await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' })
      if (activeOrderId) {
        await updateDoc(doc(db, 'orders', activeOrderId), {
          status: 'PAID',
          paidBy: user.name || user.email,
          paidAt: serverTimestamp()
        })
      }
      setShowInvoice(false)
      setActiveOrderId(null)
      setActiveTable(null)
      setRoute('order')
    } catch (e) {
      console.error(e)
    }
  }

  // --- MENU ITEM ACTIONS ---

  const addToOrder = async (m) => {
    if (!activeTable || !activeOrderId) {
      return showToast('⚠️ Vui lòng chọn bàn trước khi gọi món!', 'error')
    }
    
    // --- CHECK INVENTORY BEFORE ADDING ---
    if (!checkStock(m, 1)) {
        showToast(`⛔ Món "${m.name}" đã hết nguyên liệu!`, 'error')
        return // CHẶN LẠI
    }

    try {
      const existingItem = orderItems.find(it => it.menuItemId === m.id)
      
      if (existingItem) {
        const nextQty = Number(existingItem.qty || 1) + 1
        await updateDoc(doc(db, 'orders', activeOrderId, 'items', existingItem.id), { qty: nextQty })
      } else {
        // Lưu kèm recipe vào item trong subcollection để sau này trừ kho cho dễ
        await addDoc(collection(db, 'orders', activeOrderId, 'items'), {
          menuItemId: m.id, 
          name: m.name, 
          price: Number(m.price || 0), 
          qty: 1, 
          note: '',
          recipe: m.recipe || [] // Important: Cache recipe
        })
      }

      // Update Order Metadata & Table Status
      await updateDoc(doc(db, 'orders', activeOrderId), {
        updatedAt: serverTimestamp(),
        createdByName: user.name || user.email,
        createdBy: user.uid
      })

      if (activeTable.status === 'FREE') {
        await updateDoc(doc(db, 'tables', activeTable.id), { status: 'BUSY' })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const removeItem = (item) => {
    if (!activeOrderId) return
    
    const isLastItem = orderItems.length <= 1
    if (isLastItem) {
      setConfirmConfig({
        isOpen: true,
        title: "Hủy đơn",
        message: "Đây là món cuối cùng. Hủy đơn và trả bàn?",
        action: async () => {
          await deleteDoc(doc(db, 'orders', activeOrderId, 'items', item.id))
          await deleteDoc(doc(db, 'orders', activeOrderId))
          await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' })
          
          setActiveTable(null)
          setActiveOrderId(null)
          setRoute('order')
          showToast("Đã hủy đơn hàng!", "success")
        }
      })
    } else {
      setConfirmConfig({
        isOpen: true,
        title: "Xóa món",
        message: `Xóa "${item.name}" khỏi giỏ?`,
        action: async () => {
          await deleteDoc(doc(db, 'orders', activeOrderId, 'items', item.id))
        }
      })
    }
  }

  // CRUD Actions
  const handleCreate = async (d) => {
    await addDoc(collection(db, 'menu_items'), { ...d, is_available: true, created_at: serverTimestamp() })
    loadPage(true)
  }
  const handleUpdate = async (id, d) => {
    await updateDoc(doc(db, 'menu_items', id), d)
    loadPage(true)
  }
  const handleDelete = (m) => {
    setConfirmConfig({
      isOpen: true,
      title: "Xóa món",
      message: `Xóa "${m.name}"?`,
      action: async () => {
        await deleteDoc(doc(db, 'menu_items', m.id))
        loadPage(true)
      }
    })
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <ConfirmModal 
        isOpen={confirmConfig.isOpen} 
        onClose={() => setConfirmConfig((p) => ({ ...p, isOpen: false }))} 
        onConfirm={confirmConfig.action} 
        title={confirmConfig.title} 
        message={confirmConfig.message} 
      />

      {showInvoice && (
        <InvoiceModal 
          user={user} 
          activeOrderId={activeOrderId} 
          activeTable={activeTable} 
          onClose={() => setShowInvoice(false)} 
          onPaid={onPaidSuccess} 
        />
      )}

      {showModal && (
        <MenuItemModal 
          initial={editing} 
          onClose={() => { setShowModal(false); setEditing(null) }} 
          onCreate={handleCreate} 
          onUpdate={handleUpdate} 
        />
      )}

      {recipeEditing && (
        <RecipeModal 
          menuItem={recipeEditing} 
          onClose={() => setRecipeEditing(null)} 
          onSuccess={() => loadPage(true)} 
          showToast={showToast} 
        />
      )}

      {/* --- TOP BAR: TABLE INFO --- */}
      {activeTable && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <button 
              onClick={handleBackToOrder} 
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition" 
              title="Quay lại"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">🍽️</div>
            <div>
              <div className="text-xs text-slate-500 font-medium uppercase">Đang phục vụ</div>
              <div className="text-sm font-bold text-slate-800">Bàn {activeTable.name || activeTable.id}</div>
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button 
              onClick={handlePayNow} 
              disabled={!hasItems} 
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition flex items-center justify-center gap-2 ${
                hasItems 
                ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-100' 
                : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              }`}
            >
              <CreditCard size={18} /> Thanh toán ngay
            </button>
          </div>
        </div>
      )}

      {/* --- ORDER CART PREVIEW --- */}
      {activeOrderId && (
        <div className="bg-white rounded-xl shadow-sm border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">Đơn hàng ({orderItems.length} món)</div>
            <div className="font-bold text-emerald-700">{(cartTotal/1000).toFixed(0)}k</div>
          </div>
          
          {hasItems && (
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {orderItems.map(it => (
                <div key={it.id} className="flex-shrink-0 bg-slate-50 border rounded-lg p-2 text-xs w-32 relative group">
                  <div className="truncate font-medium" title={it.name}>{it.name}</div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-500 font-bold">x{it.qty}</span>
                    <button 
                      onClick={() => removeItem(it)} 
                      className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded hover:bg-rose-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-2 pt-2 border-t border-slate-100">
            <div className="relative">
              <input 
                value={orderNote} 
                onChange={(e) => setOrderNote(e.target.value)} 
                placeholder="Ghi chú cho bếp..." 
                className="w-full text-xs pl-7 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
              />
              <FilePenLine size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          
          <div className="flex justify-end pt-2 mt-2 border-t border-slate-50">
            <button 
              onClick={handleBackToOrder} 
              className="w-full px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} /> {hasItems ? "Gửi Bếp & Quay lại" : "Quay lại"}
            </button>
          </div>
        </div>
      )}

      {/* --- MENU CONTROLS --- */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex-1 relative">
          <input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="Tìm món..." 
            className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
          />
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="flex gap-2">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)} 
            className="border rounded-lg px-2 py-1.5 bg-white text-sm outline-none cursor-pointer"
          >
            <option value="popular">Phổ biến</option>
            <option value="newest">Mới nhất</option>
            <option value="priceAsc">Giá tăng</option>
            <option value="priceDesc">Giá giảm</option>
          </select>
          
          {isManager && (
            <button 
              onClick={() => { setEditing(null); setShowModal(true) }} 
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 flex items-center gap-1 font-medium whitespace-nowrap shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
        ))}
      </div>

      {/* --- MENU GRID --- */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 pb-4">
        {loading && items.length === 0 ? (
          Array.from({ length: 16 }).map((_, i) => <SkeletonCard key={i} />)
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full text-center text-sm text-slate-500 py-10">
            Không tìm thấy món nào.
          </div>
        ) : (
          filteredItems.map((m) => (
            <ItemCard
              key={m.id}
              m={m}
              onEdit={(item) => { setEditing(item); setShowModal(true) }}
              onDelete={handleDelete}
              onAdd={addToOrder}
              onRecipe={(item) => setRecipeEditing(item)}
              canAdd={!!activeOrderId}
              canManage={isManager}
            />
          ))
        )}
      </div>
    </div>
  )
}