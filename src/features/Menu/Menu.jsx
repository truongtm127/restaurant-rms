// src/features/Menu/Menu.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, CheckCircle, ArrowLeft } from 'lucide-react'
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDocs, orderBy, limit, startAfter, serverTimestamp, query, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import ItemCard from './ItemCard'
import MenuItemModal from './MenuItemModal'
import InvoiceModal from '../Order/InvoiceModal'
import ConfirmModal from '../../components/UI/ConfirmModal' 

export default function Menu({ user, activeTable, activeOrderId, setActiveTable, setActiveOrderId, setRoute }) {
  // --- State dữ liệu ---
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(null)
  const isManager = user?.role === 'MANAGER'
  
  // --- UI Filter/Search ---
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('Tất cả')
  const [sortBy, setSortBy] = useState('popular')

  // --- Order State (Giỏ hàng) ---
  const [orderItems, setOrderItems] = useState([])
  const [orderLoading, setOrderLoading] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  // --- Modal Confirm ---
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false, title: '', message: '', action: null
  })
  const openConfirm = (title, message, action) => {
    setConfirmConfig({ isOpen: true, title, message, action })
  }

  // --- 1. TẢI MENU TỪ FIREBASE ---
  const pageSize = 100 
  async function loadPage(reset = false) {
    setLoading(true)
    try {
      const base = [orderBy('created_at', 'desc'), limit(pageSize)]
      const qRef = reset || !cursor
        ? query(collection(db, 'menu_items'), ...base)
        : query(collection(db, 'menu_items'), ...base, startAfter(cursor))

      const snap = await getDocs(qRef)
      const arr  = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setCursor(snap.docs[snap.docs.length - 1] || null)
      setItems(prev => reset ? arr : [...prev, ...arr])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  useEffect(() => { loadPage(true) }, [])

  // --- 2. LẮNG NGHE GIỎ HÀNG REALTIME ---
  useEffect(() => {
    if (!activeOrderId) { setOrderItems([]); return }
    setOrderLoading(true)
    
    // Lắng nghe sub-collection 'items' của đơn hàng hiện tại
    const unsub = onSnapshot(collection(db, 'orders', activeOrderId, 'items'), snap => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      // Sắp xếp tên món A-Z
      list.sort((a,b) => (a.name||'').localeCompare(b.name||''))
      setOrderItems(list); setOrderLoading(false)
    })
    return () => unsub()
  }, [activeOrderId])

  // Tính tổng tiền tạm tính
  const cartTotal = orderItems.reduce((s,i)=> s + Number(i.price||0) * Number(i.qty||1), 0)

  // --- 3. [QUAN TRỌNG] HÀM KẾT THÚC / QUAY LẠI ---
  const handleBackToOrder = async () => {
    if (activeOrderId) {
      
      // TRƯỜNG HỢP A: CÓ MÓN -> GỬI BẾP
      if (orderItems.length > 0) {
        try {
          // B1: Lấy dữ liệu đơn hiện tại trên server
          const orderRef = doc(db, 'orders', activeOrderId)
          const orderSnap = await getDoc(orderRef)
          
          let finalItems = []

          if (orderSnap.exists()) {
             // Lấy danh sách items đang lưu trong mảng (để biết món nào đã nấu xong)
             const currentServerItems = orderSnap.data().items || []
             
             // B2: So khớp giỏ hàng với server
             finalItems = orderItems.map(cartItem => {
               // Tìm xem món này đã từng gọi chưa
               const existingItem = currentServerItems.find(x => x.id === cartItem.id)
               
               if (existingItem) {
                 // Nếu đã có -> Giữ nguyên trạng thái cũ (isDone, chefId...)
                 // Chỉ cập nhật số lượng và ghi chú
                 return { 
                   ...existingItem, 
                   qty: cartItem.qty, 
                   note: cartItem.note || '' 
                 }
               } else {
                 // Món mới -> isDone: false
                 return { ...cartItem, isDone: false }
               }
             })
          } else {
             // Đơn mới hoàn toàn
             finalItems = orderItems.map(i => ({ ...i, isDone: false }))
          }

          // B3: Cập nhật đơn hàng: chuyển sang 'pending' để Bếp thấy
          await updateDoc(orderRef, {
            status: 'pending',
            items: finalItems,
            total: cartTotal,
            updatedAt: serverTimestamp()
          })
          
        } catch (error) {
          console.error("Lỗi gửi bếp:", error)
          alert("Có lỗi khi gửi bếp!")
          return
        }
      } 
      // TRƯỜNG HỢP B: KHÔNG CÓ MÓN -> HỦY ĐƠN & TRẢ BÀN
      else {
        try {
           // 1. Xóa đơn rác
           await deleteDoc(doc(db, 'orders', activeOrderId))
           // 2. Trả bàn về trạng thái FREE (Tránh lỗi bàn có khách nhưng ko có đơn)
           await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' })
        } catch (e) {
           console.error("Lỗi dọn dẹp đơn trống", e)
        }
      }
    }

    // Quay về màn hình chọn bàn
    setActiveTable(null)
    setActiveOrderId(null)
    setRoute('order')
  }

  // --- 4. CÁC HÀM QUẢN LÝ MENU (CRUD) ---
  const openAdd  = () => { setEditing(null); setShowModal(true) }
  const openEdit = (m) => { setEditing(m); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const handleCreate = async (payload) => {
    await addDoc(collection(db, 'menu_items'), { ...payload, is_available: true, created_at: serverTimestamp() })
    await loadPage(true)
  }
  const handleUpdate = async (id, payload) => {
    await updateDoc(doc(db, 'menu_items', id), payload)
    await loadPage(true)
  }
  const handleDelete = (m) => {
    openConfirm("Xóa thực đơn", `Xóa món "${m.name}"?`, async () => {
        await deleteDoc(doc(db, 'menu_items', m.id))
        await loadPage(true)
    })
  }

  // --- 5. THAO TÁC GIỎ HÀNG ---
  const addToOrder = async (m) => {
    if (!activeTable || !activeOrderId) { alert('Chọn bàn trước'); return }
    
    // Thêm vào sub-collection
    await addDoc(collection(db, 'orders', activeOrderId, 'items'), {
      menuItemId: m.id, name: m.name, price: Number(m.price || 0), qty: 1, note: ''
    })

    try {
      // Nếu bàn đang Trống -> Chuyển sang Có khách
      if (activeTable.status === 'FREE') {
        await updateDoc(doc(db, 'tables', activeTable.id), { status: 'BUSY' })
      }
    } catch (e) {}
  }

  const changeQty = async (item, delta) => {
    if (!activeOrderId) return
    const next = Math.max(1, Number(item.qty || 1) + delta)
    await updateDoc(doc(db, 'orders', activeOrderId, 'items', item.id), { qty: next })
  }

  const removeItem = (item) => {
    if (!activeOrderId) return
    const isLastItem = orderItems.length <= 1;
    
    if (isLastItem) {
        // Nếu xóa món cuối cùng -> Hỏi Hủy đơn & Trả bàn
        openConfirm("Hủy đơn & Trả bàn", "Đây là món cuối cùng. Bạn muốn hủy đơn và trả bàn?", async () => {
            await deleteDoc(doc(db, 'orders', activeOrderId, 'items', item.id)) // Xóa item
            await deleteDoc(doc(db, 'orders', activeOrderId));                // Xóa order
            await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' }); // Trả bàn
            
            setActiveTable(null); setActiveOrderId(null); setRoute('order');
        });
    } else {
        // Xóa món bình thường
        openConfirm("Xóa món", `Xóa món "${item.name}"?`, async () => {
            await deleteDoc(doc(db, 'orders', activeOrderId, 'items', item.id))
        });
    }
  }

  // --- 6. LOGIC LỌC & SẮP XẾP ---
  const categories = useMemo(() => {
    const set = new Set(items.map(x => x.category || 'Khác'))
    return ['Tất cả', ...Array.from(set)]
  }, [items])

  const filtered = useMemo(() => {
    let list = items
    if (category !== 'Tất cả') list = list.filter(x => (x.category || 'Khác') === category)
    if (q.trim()) {
      const k = q.trim().toLowerCase()
      list = list.filter(x => (x.name||'').toLowerCase().includes(k) || (x.category||'').toLowerCase().includes(k))
    }
    list = [...list]
    if (sortBy === 'newest') list.sort((a,b) => (b.created_at?.seconds||0) - (a.created_at?.seconds||0))
    else if (sortBy === 'priceAsc') list.sort((a,b) => Number(a.price||0) - Number(b.price||0))
    else if (sortBy === 'priceDesc') list.sort((a,b) => Number(b.price||0) - Number(a.price||0))
    else list.sort((a,b) => (b.is_available?1:0)-(a.is_available?1:0) || (a.name||'').localeCompare(b.name||''))
    return list
  }, [items, q, category, sortBy])

  // Components UI nhỏ
  const Chip = ({ active, children, onClick }) => (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-slate-50'}`}>{children}</button>
  )
  const SkeletonCard = () => <div className="rounded-xl bg-slate-100 animate-pulse aspect-[3/4]"/>

  return (
    <div className="space-y-4">
      {/* Modal Confirm */}
      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.action}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />

      {/* Header Bàn + Nút Quay lại */}
      {activeTable && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-3">
             <button onClick={handleBackToOrder} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition" title="Quay lại">
               <ArrowLeft size={20}/>
             </button>
             <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">🍽️</div>
             <div>
               <div className="text-xs text-slate-500 font-medium uppercase">Đang phục vụ</div>
               <div className="text-sm font-bold text-slate-800">Bàn {activeTable.name || activeTable.id}</div>
             </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto justify-end">
             {/* Nút này tự động đổi text dựa trên tình trạng giỏ hàng */}
             <button 
               onClick={handleBackToOrder}
               className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition flex items-center justify-center gap-2"
             >
               <CheckCircle className="w-3.5 h-3.5" />
               {orderItems.length > 0 ? "Gửi Bếp & Quay lại" : "Quay lại"}
             </button>
          </div>
        </div>
      )}

      {/* Modal Hóa đơn (Thanh toán) */}
      {showInvoice && (
        <InvoiceModal
          user={user} activeOrderId={activeOrderId} activeTable={activeTable}
          onClose={() => setShowInvoice(false)}
          onPaid={async () => {
            // 1. Trả bàn về trạng thái Trống
            await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' })
            
            // 2. Cập nhật đơn hàng thành PAID & Lưu người thu ngân
            if (activeOrderId) {
                await updateDoc(doc(db, 'orders', activeOrderId), { 
                  status: 'PAID', 
                  paidBy: user.name || user.email, 
                  paidAt: serverTimestamp() 
                })
            }

            // 3. Reset giao diện
            setShowInvoice(false)
            setActiveOrderId(null)
            setActiveTable(null)
            setRoute('order')
          }}
        />
      )}

      {/* Giỏ hàng (Cart) */}
      {activeOrderId && (
        <div className="bg-white rounded-xl shadow-sm border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">Đơn hàng ({orderItems.length} món)</div>
            <div className="font-bold text-emerald-700">{(cartTotal/1000).toFixed(0)}k</div>
          </div>

          {orderItems.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {orderItems.map(it => (
                <div key={it.id} className="flex-shrink-0 bg-slate-50 border rounded-lg p-2 text-xs w-32 relative group">
                  <div className="truncate font-medium" title={it.name}>{it.name}</div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-500">x{it.qty}</span>
                    <div className="flex gap-1">
                      <button onClick={()=>changeQty(it, +1)} className="px-1.5 bg-white border rounded hover:bg-slate-100">+</button>
                      <button onClick={()=>removeItem(it)} className="px-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded hover:bg-rose-100">×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
             <button onClick={()=>setShowInvoice(true)} className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-700">
               Thanh toán
             </button>
          </div>
        </div>
      )}

      {/* Bộ lọc & Tìm kiếm */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex-1 relative">
          <input 
            value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm nhanh..." 
            className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
          />
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="flex gap-2">
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="border rounded-lg px-2 py-1.5 bg-white text-sm outline-none cursor-pointer">
            <option value="popular">Phổ biến</option>
            <option value="newest">Mới nhất</option>
            <option value="priceAsc">Giá tăng</option>
            <option value="priceDesc">Giá giảm</option>
          </select>
          {isManager && (
            <button onClick={openAdd} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 flex items-center gap-1 font-medium whitespace-nowrap shadow-sm">
              <Plus className="w-3.5 h-3.5"/> Thêm
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map(c => <Chip key={c} active={category===c} onClick={()=>setCategory(c)}>{c}</Chip>)}
      </div>

      {/* Danh sách món ăn Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {loading && items.length === 0 ? (
          Array.from({length:16}).map((_,i)=><SkeletonCard key={i}/>)
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center text-sm text-slate-500 py-10">Không tìm thấy món nào.</div>
        ) : (
          filtered.map(m => (
            <ItemCard 
              key={m.id} m={m} onEdit={openEdit} onDelete={handleDelete} onAdd={addToOrder} 
              canAdd={!!activeOrderId} canManage={isManager} 
            />
          ))
        )}
      </div>

      {showModal && (
        <MenuItemModal initial={editing} onClose={closeModal} onCreate={handleCreate} onUpdate={handleUpdate}/>
      )}
    </div>
  )
}