// src/features/Menu/Menu.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, CheckCircle } from 'lucide-react'
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDocs, orderBy, limit, startAfter, serverTimestamp, query } from 'firebase/firestore'
import { db } from '../../firebase'
import ItemCard from './ItemCard'
import MenuItemModal from './MenuItemModal'
import InvoiceModal from '../Order/InvoiceModal'

export default function Menu({ user, activeTable, activeOrderId, setActiveTable, setActiveOrderId, setRoute }) {
  // --- Data (menu) ---
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(null)

  // --- Kiểm tra quyền Quản lý ---
  const isManager = user?.role === 'MANAGER'

  // --- UI filter/search/sort ---
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('Tất cả')
  const [sortBy, setSortBy] = useState('popular')

  // --- Order state (giỏ hàng) ---
  const [orderItems, setOrderItems] = useState([])
  const [orderLoading, setOrderLoading] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  // Tải 100 món một lúc để hiển thị đầy đủ
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
    } catch (err) {
      console.error("Load menu error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPage(true) }, [])

  // Order realtime
  useEffect(() => {
    if (!activeOrderId) { setOrderItems([]); return }
    setOrderLoading(true)
    const unsub = onSnapshot(collection(db, 'orders', activeOrderId, 'items'), snap => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      list.sort((a,b) => (a.name||'').localeCompare(b.name||''))
      setOrderItems(list); setOrderLoading(false)
    })
    return () => unsub()
  }, [activeOrderId])

  // --- Navigation Action ---
  const handleBackToOrder = () => {
    // Xóa state active để quay về màn hình chọn bàn
    setActiveTable(null)
    setActiveOrderId(null)
    setRoute('order')
  }

  // CRUD Actions
  const openAdd  = () => { setEditing(null); setShowModal(true) }
  const openEdit = (m) => { setEditing(m); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const handleCreate = async (payload) => {
    await addDoc(collection(db, 'menu_items'), {
      ...payload, is_available: true, created_at: serverTimestamp()
    })
    await loadPage(true)
  }

  const handleUpdate = async (id, payload) => {
    await updateDoc(doc(db, 'menu_items', id), payload)
    await loadPage(true)
  }

  const handleDelete = async (m) => {
    if (!confirm(`Xóa món "${m.name}"?`)) return
    try {
      await deleteDoc(doc(db, 'menu_items', m.id))
      await loadPage(true)
    } catch (e) {
      console.error("Delete error:", e)
      alert("Xóa thất bại! Vui lòng thử lại.")
    }
  }

  // Add to order
  const addToOrder = async (m) => {
    if (!activeTable || !activeOrderId) {
      alert('Hãy vào "Gọi món" và chọn bàn trước')
      return
    }
    await addDoc(collection(db, 'orders', activeOrderId, 'items'), {
      menuItemId: m.id,
      name: m.name,
      price: Number(m.price || 0),
      qty: 1,
      note: ''
    })
    try {
      if (activeTable.status === 'FREE') {
        await updateDoc(doc(db, 'tables', activeTable.id), { status: 'BUSY' })
      }
    } catch (e) { console.warn(e) }
  }

  // Cart actions
  const cartTotal = orderItems.reduce((s,i)=> s + Number(i.price||0) * Number(i.qty||1), 0)
  const changeQty = async (item, delta) => {
    if (!activeOrderId) return
    const next = Math.max(1, Number(item.qty || 1) + delta)
    await updateDoc(doc(db, 'orders', activeOrderId, 'items', item.id), { qty: next })
  }
  const removeItem = async (item) => {
    if (!activeOrderId) return
    if (!confirm(`Xoá ${item.name}?`)) return
    await deleteDoc(doc(db, 'orders', activeOrderId, 'items', item.id))
  }

  // Filter
  const categories = useMemo(() => {
    const set = new Set(items.map(x => x.category || 'Khác'))
    return ['Tất cả', ...Array.from(set)]
  }, [items])

  const filtered = useMemo(() => {
    let list = items
    if (category !== 'Tất cả') list = list.filter(x => (x.category || 'Khác') === category)
    if (q.trim()) {
      const k = q.trim().toLowerCase()
      list = list.filter(x =>
        (x.name || '').toLowerCase().includes(k) ||
        (x.category || '').toLowerCase().includes(k)
      )
    }
    list = [...list]
    if (sortBy === 'newest') list.sort((a,b) => (b.created_at?.seconds||0) - (a.created_at?.seconds||0))
    else if (sortBy === 'priceAsc') list.sort((a,b) => Number(a.price||0) - Number(b.price||0))
    else if (sortBy === 'priceDesc') list.sort((a,b) => Number(b.price||0) - Number(a.price||0))
    else list.sort((a,b) => (b.is_available?1:0)-(a.is_available?1:0) || (a.name||'').localeCompare(b.name||''))
    return list
  }, [items, q, category, sortBy])

  const Chip = ({ active, children, onClick }) => (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap
        ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-slate-50'}`}>
      {children}
    </button>
  )

  const SkeletonCard = () => (
    <div className="rounded-xl bg-slate-100 animate-pulse aspect-[3/4]"/>
  )

  return (
    <div className="space-y-4">
      {/* THANH ĐIỀU HƯỚNG BÀN & NÚT THOÁT */}
      {activeTable && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-3">
             <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">
               🍽️
             </div>
             <div>
               <div className="text-xs text-slate-500 font-medium uppercase">Đang phục vụ</div>
               <div className="text-sm font-bold text-slate-800">Bàn {activeTable.name || activeTable.id}</div>
             </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto justify-end">
             {/* Nút Kết thúc gọi món (Quay về màn hình chọn bàn) */}
             <button 
               onClick={handleBackToOrder}
               className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition flex items-center justify-center gap-2"
             >
               <CheckCircle className="w-3.5 h-3.5" />
               Kết thúc gọi món
             </button>
          </div>
        </div>
      )}

      {/* Modal Hóa đơn */}
      {showInvoice && (
        <InvoiceModal
          user={user} // Truyền user xuống để lưu tên người thanh toán (paidBy)
          activeOrderId={activeOrderId}
          activeTable={activeTable}
          onClose={() => setShowInvoice(false)}
          onPaid={async () => {
            await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' })
            setShowInvoice(false)
            setActiveOrderId(null)
            setActiveTable(null)
            setRoute('order')
          }}
        />
      )}

      {/* Khu vực Giỏ hàng */}
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

      {/* Thanh công cụ */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex-1 relative">
          <input 
            value={q} 
            onChange={e=>setQ(e.target.value)} 
            placeholder="Tìm nhanh..." 
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

          {/* CHỈ MANAGER MỚI THẤY NÚT THÊM */}
          {isManager && (
            <button onClick={openAdd} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 flex items-center gap-1 font-medium whitespace-nowrap shadow-sm">
              <Plus className="w-3.5 h-3.5"/> Thêm
            </button>
          )}
        </div>
      </div>

      {/* Danh mục */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map(c => (
          <Chip key={c} active={category===c} onClick={()=>setCategory(c)}>{c}</Chip>
        ))}
      </div>

      {/* LƯỚI SẢN PHẨM: 8 CỘT (PC) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {loading && items.length === 0 ? (
          Array.from({length:16}).map((_,i)=><SkeletonCard key={i}/>)
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center text-sm text-slate-500 py-10">Không tìm thấy món nào.</div>
        ) : (
          filtered.map(m => (
            <ItemCard 
              key={m.id} 
              m={m} 
              onEdit={openEdit} 
              onDelete={handleDelete} 
              onAdd={addToOrder} 
              canAdd={!!activeOrderId}
              canManage={isManager} // Truyền quyền quản lý xuống
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