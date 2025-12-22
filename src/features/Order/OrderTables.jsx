// src/features/Order/OrderTables.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, addDoc, doc, setDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { Search, User } from 'lucide-react'
import { db } from '../../firebase'
import StatusChip from '../../components/UI/StatusChip'

// Nhận thêm prop 'user'
export default function OrderTables({ user, setRoute, setActiveTable, setActiveOrderId }) {
  const [q, setQ] = useState('')
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tables'), (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      // Sắp xếp bàn theo tên (số)
      list.sort((a,b)=> (a.name||a.id).localeCompare(b.name||b.id, 'vi', { numeric:true }))
      setTables(list); setLoading(false)
    })
    return () => unsub()
  }, [])

  // Hàm tạo nhanh 16 bàn nếu chưa có dữ liệu
  const seedTables = async () => {
    const snap = await getDocs(collection(db, 'tables'))
    if (!snap.empty) { alert('Đã có dữ liệu tables'); return }
    for (let i=1;i<=16;i++){
      const id = `T${i}`
      await setDoc(doc(db, 'tables', id), {
        name: id, capacity: 2 + ((i-1)%4)*2, status: 'FREE'
      })
    }
    alert('Đã tạo T1..T16')
  }

  const filtered = useMemo(
    () => tables.filter(t => (t.name||t.id).toLowerCase().includes(q.toLowerCase())),
    [q, tables]
  )

  const chooseTable = async (t) => {
    // 1. Tìm xem bàn này có đơn nào đang mở (OPEN) không
    const qOpen = query(
      collection(db, 'orders'),
      where('tableId','==', t.id),
      where('status','==','OPEN')
    )
    const snap = await getDocs(qOpen)
    
    let orderId
    if (!snap.empty) {
      // Nếu có đơn cũ -> Mở lại
      orderId = snap.docs[0].id
    } else {
      // Nếu chưa có -> Tạo đơn mới & LƯU TÊN NGƯỜI TẠO
      const ref = await addDoc(collection(db, 'orders'), {
        tableId: t.id, 
        status: 'OPEN', 
        createdAt: serverTimestamp(),
        createdBy: user?.name || user?.email || 'Unknown', // <--- MỚI: Lưu tên người order
        creatorId: user?.uid || '' // Lưu thêm ID để chắc chắn
      })
      orderId = ref.id
    }
    
    // Chuyển sang màn hình Menu
    setActiveTable(t)
    setActiveOrderId(orderId)
    setRoute('menu')
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Sơ đồ bàn</h2>
          <p className="text-sm text-slate-500">Chọn bàn để bắt đầu gọi món</p>
        </div>
        {/* Nút tạo bàn nhanh (chỉ hiện khi chưa có bàn nào) */}
        {tables.length === 0 && !loading && (
          <button onClick={seedTables} className="text-xs text-blue-600 underline">
            + Tạo dữ liệu mẫu
          </button>
        )}
      </div>

      <div className="relative">
        <input 
          value={q} 
          onChange={e=>setQ(e.target.value)} 
          placeholder="Tìm kiếm bàn..." 
          className="w-full md:w-80 border rounded-xl pl-10 pr-3 py-2.5 bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
        />
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500 py-10 text-center">Đang tải dữ liệu bàn...</div>
      ) : (
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {filtered.map(t=>(
            <button key={t.id}
              onClick={()=>chooseTable(t)}
              className={`relative aspect-square rounded-2xl p-3 text-left transition-all duration-200 flex flex-col justify-between group ${
                t.status==='FREE'
                  ? 'bg-white border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md'
                  : t.status==='BUSY'
                    ? 'bg-rose-50 border border-rose-200 shadow-inner'
                    : 'bg-amber-50 border border-amber-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`font-bold text-lg ${t.status==='FREE'?'text-slate-700':'text-rose-700'}`}>
                  {t.name || t.id}
                </span>
                <StatusChip status={t.status}/>
              </div>
              
              <div className="flex items-end justify-between">
                 <div className="text-xs text-slate-400 flex items-center gap-1">
                   <User className="w-3 h-3"/> {t.capacity}
                 </div>
                 {t.status === 'FREE' && (
                   <div className="opacity-0 group-hover:opacity-100 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md transition-opacity">
                     Chọn
                   </div>
                 )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}