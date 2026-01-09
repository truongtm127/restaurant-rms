import React, { useEffect, useState, useMemo } from 'react'
import { 
  collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, 
  serverTimestamp, query, orderBy, limit, getDocs, where 
} from 'firebase/firestore'
import { db } from '../../firebase'
import { 
  Package, Plus, History, ArrowDownCircle, Search, X, 
  FileWarning, Trash2, TrendingUp, Calendar, 
  DollarSign, ArrowRight
} from 'lucide-react'
import ConfirmModal from '../../components/UI/ConfirmModal'

// --- HELPER: FORMAT TIỀN TỆ ---
const fmtMoney = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num)

// --- HELPER: LẤY NGÀY ĐỊA PHƯƠNG (FIX LỖI 31/12) ---
const getLocalDateStr = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- COMPONENT CON: THẺ KHO ---
const StockCardModal = ({ item, onClose }) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const q = query(collection(db, 'inventory_transactions'), 
            where('inventoryId', '==', item.id), 
            orderBy('createdAt', 'desc'), 
            limit(50)
        );
        const snap = await getDocs(q);
        setHistory(snap.docs.map(d => d.data()));
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    fetchHistory()
  }, [item])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-fadeIn">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <div>
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><History size={20}/> Thẻ kho: {item.name}</h3>
              <p className="text-xs text-slate-500">50 giao dịch gần nhất</p>
          </div>
          <button onClick={onClose} className="hover:bg-slate-200 p-1 rounded"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Diễn giải</th>
                  <th className="px-4 py-3 text-right">Biến động</th>
                  <th className="px-4 py-3 text-right">Tồn cuối</th>
                  <th className="px-4 py-3 text-right">Giá vốn</th>
                  <th className="px-4 py-3">Người GD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan="6" className="p-4 text-center">Đang tải...</td></tr> : 
                 history.length === 0 ? <tr><td colSpan="6" className="p-4 text-center text-slate-400">Chưa có giao dịch.</td></tr> :
                 history.map((h, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs">
                        {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleString('vi-VN') : '--'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${h.type === 'IMPORT' ? 'bg-emerald-500' : (h.change < 0 ? 'bg-orange-500' : 'bg-blue-500')}`}></span>
                          {h.reason || (h.type === 'IMPORT' ? 'Nhập hàng' : 'Xuất hàng')}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${h.change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {h.change > 0 ? '+' : ''}{h.change.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{h.stockAfter.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">{h.price ? fmtMoney(h.price) : '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{h.performer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  )
}

// --- COMPONENT CHÍNH ---
export default function Inventory({ user, showToast }) {
  const [activeTab, setActiveTab] = useState('overview') 
  
  // Data State
  const [items, setItems] = useState([])
  const [transactions, setTransactions] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [cardItem, setCardItem] = useState(null) 
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  // Input State
  const [newItem, setNewItem] = useState({ name: '', unit: 'kg', minThreshold: 10 })
  const [inputQty, setInputQty] = useState('')
  const [inputPrice, setInputPrice] = useState('')
  const [inputReason, setInputReason] = useState('')

  // Report Filter State (FIX LỖI NGÀY)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1); 
  
  const [startDate, setStartDate] = useState(getLocalDateStr(firstDay));
  const [endDate, setEndDate] = useState(getLocalDateStr(today));

  const openConfirm = (title, message, action) => {
    setConfirmConfig({ isOpen: true, title, message, action })
  }

  // --- 1. LẤY DỮ LIỆU TỒN KHO ---
  useEffect(() => {
    const unsubItems = onSnapshot(collection(db, 'inventory'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
         const aQty = Number(a.quantity) || 0; const bQty = Number(b.quantity) || 0;
         if (aQty === 0 && bQty !== 0) return -1;
         if (bQty === 0 && aQty !== 0) return 1;
         return a.name.localeCompare(b.name);
      })
      setItems(list)
      setLoading(false)
    })
    return () => unsubItems()
  }, [])

  // --- 2. LẤY DỮ LIỆU BÁO CÁO ---
  useEffect(() => {
    if (activeTab === 'history') {
        const fetchReport = async () => {
            setLoading(true)
            try {
                const start = new Date(startDate)
                start.setHours(0,0,0,0)
                
                const end = new Date(endDate)
                end.setHours(23,59,59,999)
                
                const q = query(
                    collection(db, 'inventory_transactions'),
                    where('createdAt', '>=', start),
                    where('createdAt', '<=', end),
                    orderBy('createdAt', 'desc'),
                    limit(500)
                )
                
                const snap = await getDocs(q)
                setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            } catch (error) {
                console.error("Lỗi báo cáo:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchReport()
    }
  }, [activeTab, startDate, endDate])

  // --- THỐNG KÊ ---
  const stats = useMemo(() => {
      const totalValue = items.reduce((sum, i) => sum + ((Number(i.quantity)||0) * (Number(i.costPrice)||0)), 0)
      return { totalValue }
  }, [items])

  const totalImportCost = useMemo(() => {
      return transactions
        .filter(t => t.type === 'IMPORT')
        .reduce((sum, t) => sum + (Number(t.price || 0) * Number(t.change || 0)), 0)
  }, [transactions])

  // --- ACTIONS ---
  const handleAddItem = async () => {
    if (!newItem.name) return showToast("Vui lòng nhập tên", "error")
    try {
      await addDoc(collection(db, 'inventory'), {
        ...newItem,
        quantity: 0, costPrice: 0, minThreshold: Number(newItem.minThreshold), updatedAt: serverTimestamp()
      })
      setNewItem({ name: '', unit: 'kg', minThreshold: 10 })
      setShowAddModal(false)
      showToast("✅ Đã thêm nguyên liệu mới", "success")
    } catch (e) { showToast("Lỗi thêm mới", "error") }
  }

  const handleImport = async () => {
    if (!inputQty || isNaN(inputQty)) return showToast("⚠️ Số lượng lỗi", "error")
    const qty = Number(inputQty)
    const price = Number(inputPrice) || 0

    try {
        const itemRef = doc(db, 'inventory', selectedItem.id)
        const oldStock = Number(selectedItem.quantity) || 0
        const oldCost = Number(selectedItem.costPrice) || 0
        const newStock = oldStock + qty
        
        let newAvgCost = oldCost
        if (newStock > 0 && price > 0) {
            newAvgCost = ((oldStock * oldCost) + (qty * price)) / newStock
        }

        await updateDoc(itemRef, { quantity: newStock, costPrice: newAvgCost, updatedAt: serverTimestamp() })

        await addDoc(collection(db, 'inventory_transactions'), {
            inventoryId: selectedItem.id, itemName: selectedItem.name, type: 'IMPORT',
            change: qty, stockAfter: newStock, price: price, total: price * qty,
            reason: inputReason || 'Nhập hàng', performer: user?.name || 'Admin', createdAt: serverTimestamp()
        })

        closeModals()
        showToast(`✅ Đã nhập kho: ${selectedItem.name}`, "success")
    } catch (e) { console.error(e); showToast("Lỗi nhập hàng", "error") }
  }

  const handleAudit = async (type) => {
      if (!inputQty) return showToast("⚠️ Nhập số lượng", "error")
      const val = Number(inputQty)
      
      try {
          const itemRef = doc(db, 'inventory', selectedItem.id)
          const currentStock = Number(selectedItem.quantity) || 0
          let newStock = type === 'AUDIT' ? val : currentStock - val
          let change = type === 'AUDIT' ? (newStock - currentStock) : -val

          await updateDoc(itemRef, { quantity: newStock, updatedAt: serverTimestamp() })
          await addDoc(collection(db, 'inventory_transactions'), {
              inventoryId: selectedItem.id, itemName: selectedItem.name, 
              type: type, change: change, stockAfter: newStock,
              reason: inputReason || (type === 'AUDIT' ? 'Kiểm kê kho' : 'Hủy/Hỏng'),
              performer: user?.name || 'Admin', createdAt: serverTimestamp()
          })

          showToast("✅ Cập nhật kho thành công", "success")
          closeModals()
      } catch (e) { console.error(e); showToast("Lỗi cập nhật", "error") }
  }

  const handleDelete = (item) => {
      openConfirm("Xóa Nguyên Liệu", `Xóa "${item.name}"? Dữ liệu lịch sử sẽ được lưu nhưng không thể chọn món này nữa.`, async () => {
          try { await deleteDoc(doc(db, 'inventory', item.id)); showToast("Đã xóa!", "success") } 
          catch(e) { showToast("Lỗi xóa", "error") }
      })
  }

  const closeModals = () => {
      setShowImportModal(false); setShowAuditModal(false); setSelectedItem(null);
      setInputQty(''); setInputPrice(''); setInputReason('')
  }

  const displayItems = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="space-y-6 animate-fadeIn pb-10 h-full flex flex-col">
      <ConfirmModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig(p => ({ ...p, isOpen: false }))} onConfirm={confirmConfig.action} title={confirmConfig.title} message={confirmConfig.message} />

      {/* --- HEADER CHUYÊN NGHIỆP --- */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
         <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                 <Package size={28} />
             </div>
             <div>
                 <h1 className="text-xl font-bold text-slate-800">Quản lý Kho</h1>
                 <p className="text-sm text-slate-500 font-medium">Tổng giá trị: <span className="text-emerald-700 font-bold">{fmtMoney(stats.totalValue)}</span></p>
             </div>
         </div>

         {/* Nút Thêm Mới */}
         <button 
            onClick={()=>setShowAddModal(true)} 
            className="w-full md:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
         >
             <Plus size={20} /> Thêm Nguyên Liệu
         </button>
      </div>

      {/* --- TAB NAVIGATION --- */}
      <div className="flex border-b border-slate-200 shrink-0">
          <button onClick={()=>setActiveTab('overview')} className={`flex-1 md:flex-none px-8 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'overview' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              📦 Danh sách tồn kho
          </button>
          <button onClick={()=>setActiveTab('history')} className={`flex-1 md:flex-none px-8 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'history' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              📝 Lịch sử nhập/xuất
          </button>
      </div>

      {/* === TAB 1: DANH SÁCH TỒN KHO === */}
      {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
              {/* Search Bar */}
              <div className="p-4 border-b border-slate-100 flex gap-3 bg-slate-50/50 items-center">
                  <Search className="text-slate-400 shrink-0"/>
                  <input 
                    placeholder="Tìm kiếm (Ví dụ: Gạo, Bò, Bia...)" 
                    value={filter} 
                    onChange={e=>setFilter(e.target.value)} 
                    className="outline-none flex-1 bg-transparent font-medium text-base h-10"
                  />
              </div>
              
              {/* Table Container */}
              <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left text-sm min-w-[800px]">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold sticky top-0 z-10 shadow-sm">
                          <tr>
                              <th className="p-4 w-1/4">Tên hàng</th>
                              <th className="p-4 text-center w-1/6">Tồn kho</th>
                              <th className="p-4 text-center w-1/6">Giá vốn BQ</th>
                              <th className="p-4 text-center w-1/6">Trạng thái</th>
                              <th className="p-4 text-right w-1/4">Hành động</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {displayItems.map(item => {
                              const stock = Number(item.quantity) || 0
                              return (
                                  <tr key={item.id} className={`hover:bg-slate-50 transition ${stock===0 ? 'opacity-70 bg-slate-50' : ''}`}>
                                      <td className="p-4 align-middle">
                                          <div className="font-bold text-slate-800 text-base">{item.name}</div>
                                          <div className="text-xs text-slate-400 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded mt-1">
                                              Đơn vị: {item.unit}
                                          </div>
                                      </td>
                                      <td className="p-4 text-center align-middle">
                                          <span className="text-lg font-bold text-slate-700">{stock.toLocaleString()}</span>
                                      </td>
                                      <td className="p-4 text-center align-middle font-mono text-slate-600">
                                          {fmtMoney(item.costPrice || 0)}
                                      </td>
                                      <td className="p-4 text-center align-middle">
                                          {stock === 0 ? (
                                              <span className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-bold">Hết hàng</span>
                                          ) : stock <= (Number(item.minThreshold) || 0) ? (
                                              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold animate-pulse">Sắp hết</span>
                                          ) : (
                                              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Sẵn sàng</span>
                                          )}
                                      </td>
                                      <td className="p-4 text-right align-middle">
                                          {/* [TABLET] Nút to, dễ bấm, luôn hiện */}
                                          <div className="flex justify-end gap-2">
                                              <button onClick={()=>{setSelectedItem(item); setShowImportModal(true)}} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 border border-blue-100 shadow-sm" title="Nhập hàng"><ArrowDownCircle size={20}/></button>
                                              <button onClick={()=>{setSelectedItem(item); setShowAuditModal(true)}} className="p-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 border border-orange-100 shadow-sm" title="Kiểm kê"><FileWarning size={20}/></button>
                                              <button onClick={()=>setCardItem(item)} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 border border-slate-200 shadow-sm" title="Thẻ kho"><History size={20}/></button>
                                              <button onClick={()=>handleDelete(item)} className="p-2.5 bg-white text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-100" title="Xóa"><Trash2 size={20}/></button>
                                          </div>
                                      </td>
                                  </tr>
                              )
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* === TAB 2: LỊCH SỬ & DÒNG TIỀN === */}
      {activeTab === 'history' && (
          <div className="flex-1 flex flex-col space-y-4 animate-fadeIn overflow-hidden">
              {/* Filter Section */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center justify-between shrink-0">
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      <div className="flex items-center gap-3 w-full sm:w-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <Calendar size={20} className="text-slate-400 ml-2"/>
                          <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Từ ngày</label>
                              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="font-bold text-slate-700 bg-transparent outline-none cursor-pointer text-sm"/>
                          </div>
                          <ArrowRight size={16} className="text-slate-300"/>
                          <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Đến ngày</label>
                              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="font-bold text-slate-700 bg-transparent outline-none cursor-pointer text-sm"/>
                          </div>
                      </div>
                  </div>
                  
                  <div className="bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100 flex items-center gap-4 w-full md:w-auto justify-between">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-200 text-emerald-800 rounded-full"><DollarSign size={20}/></div>
                          <span className="text-sm text-emerald-800 font-bold uppercase">Tổng tiền nhập hàng</span>
                      </div>
                      <span className="text-2xl font-bold text-emerald-800">{fmtMoney(totalImportCost)}</span>
                  </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-auto custom-scrollbar">
                      <table className="w-full text-left text-sm min-w-[900px]">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase text-xs font-bold sticky top-0 z-10 shadow-sm">
                              <tr>
                                  <th className="p-4 w-1/6">Thời gian</th>
                                  <th className="p-4 w-1/6">Tên hàng</th>
                                  <th className="p-4 w-1/12">Loại</th>
                                  <th className="p-4 text-right w-1/12">SL Đổi</th>
                                  <th className="p-4 text-right w-1/6">Đơn giá nhập</th>
                                  <th className="p-4 text-right w-1/6">Thành tiền</th>
                                  <th className="p-4 w-1/6">Người thực hiện</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {transactions.length === 0 ? (
                                  <tr><td colSpan="7" className="p-12 text-center text-slate-400 italic">Không có giao dịch nào trong khoảng thời gian này.</td></tr>
                              ) : (
                                  transactions.map(t => {
                                      const isImport = t.type === 'IMPORT'
                                      const amount = isImport ? (t.price * t.change) : 0
                                      return (
                                          <tr key={t.id} className="hover:bg-slate-50 transition">
                                              <td className="p-4 text-slate-500 text-xs">
                                                  {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('vi-VN') : '--'}
                                              </td>
                                              <td className="p-4 font-bold text-slate-700">{t.itemName}</td>
                                              <td className="p-4">
                                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                      isImport ? 'bg-emerald-100 text-emerald-700' : 
                                                      t.type === 'AUDIT' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                                                  }`}>
                                                      {isImport ? 'Nhập hàng' : (t.type === 'AUDIT' ? 'Kiểm kê' : 'Xuất/Hủy')}
                                                  </span>
                                              </td>
                                              <td className={`p-4 text-right font-bold ${t.change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                  {t.change > 0 ? '+' : ''}{t.change.toLocaleString()}
                                              </td>
                                              <td className="p-4 text-right text-slate-500 font-mono text-xs">
                                                  {isImport && t.price ? fmtMoney(t.price) : '-'}
                                              </td>
                                              <td className="p-4 text-right font-bold text-slate-800 font-mono">
                                                  {amount > 0 ? fmtMoney(amount) : '-'}
                                              </td>
                                              <td className="p-4 text-slate-600 text-xs">
                                                  <div className="font-bold">{t.performer || 'Unknown'}</div>
                                                  <div className="text-[10px] text-slate-400 italic truncate max-w-[150px]">{t.reason}</div>
                                              </td>
                                          </tr>
                                      )
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL ADD NEW --- */}
      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">
                  <h3 className="text-xl font-bold mb-6 text-emerald-700 flex items-center gap-2"><Plus className="bg-emerald-100 p-1 rounded-full" size={28}/> Thêm Nguyên Liệu</h3>
                  <div className="space-y-4">
                      <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tên hàng</label><input autoFocus value={newItem.name} onChange={e=>setNewItem({...newItem, name:e.target.value})} className="w-full p-3 border rounded-xl text-base outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition" placeholder="Vd: Gạo ST25"/></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Đơn vị</label><select value={newItem.unit} onChange={e=>setNewItem({...newItem, unit:e.target.value})} className="w-full p-3 border rounded-xl bg-slate-50 outline-none"><option value="kg">Kg</option><option value="g">Gam</option><option value="l">Lít</option><option value="ml">Ml</option><option value="cai">Cái</option></select></div>
                          <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Định mức</label><input type="number" value={newItem.minThreshold} onChange={e=>setNewItem({...newItem, minThreshold:e.target.value})} className="w-full p-3 border rounded-xl bg-slate-50 outline-none"/></div>
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button onClick={()=>setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition">Hủy</button>
                          <button onClick={handleAddItem} className="flex-1 py-3 bg-emerald-600 rounded-xl text-white font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200">Lưu ngay</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL IMPORT --- */}
      {showImportModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fadeIn border-t-8 border-emerald-500">
              <h3 className="text-xl font-bold mb-1 text-slate-800">Nhập hàng</h3>
              <p className="text-sm text-emerald-600 font-bold mb-6 bg-emerald-50 inline-block px-3 py-1 rounded-full">{selectedItem.name} ({selectedItem.unit})</p>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Số lượng nhập</label>
                    <input type="number" autoFocus value={inputQty} onChange={e=>setInputQty(e.target.value)} className="w-full p-3 border border-emerald-200 rounded-xl font-bold text-2xl text-center focus:ring-4 ring-emerald-100 outline-none text-emerald-700"/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Đơn giá nhập (VNĐ)</label>
                    <input type="number" value={inputPrice} onChange={e=>setInputPrice(e.target.value)} className="w-full p-3 border rounded-xl bg-slate-50 outline-none" placeholder="Nhập giá..."/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Ghi chú</label>
                    <input type="text" value={inputReason} onChange={e=>setInputReason(e.target.value)} className="w-full p-3 border rounded-xl bg-slate-50 outline-none" placeholder="Vd: Chợ đầu mối"/>
                 </div>
                 
                 <div className="bg-slate-50 p-3 rounded-xl text-sm text-slate-500 flex justify-between items-center border border-slate-100">
                     <span>Thành tiền:</span>
                     <span className="font-bold text-lg text-emerald-700">{fmtMoney((Number(inputQty)||0)*(Number(inputPrice)||0))}</span>
                 </div>

                 <div className="flex gap-3 pt-2">
                    <button onClick={closeModals} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">Hủy</button>
                    <button onClick={handleImport} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200">Xác nhận</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL AUDIT --- */}
      {showAuditModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fadeIn border-t-8 border-orange-500">
              <h3 className="text-xl font-bold mb-1 text-slate-800">Kiểm kê / Điều chỉnh</h3>
              <p className="text-sm text-slate-500 mb-6 bg-slate-50 inline-block px-3 py-1 rounded-full">Tồn hiện tại: <b>{selectedItem.quantity}</b> {selectedItem.unit}</p>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Số lượng</label>
                    <input type="number" autoFocus value={inputQty} onChange={e=>setInputQty(e.target.value)} className="w-full p-3 border rounded-xl font-bold text-2xl text-center outline-none focus:border-orange-500"/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Lý do</label>
                    <input type="text" value={inputReason} onChange={e=>setInputReason(e.target.value)} className="w-full p-3 border rounded-xl bg-slate-50 outline-none" placeholder="Vd: Hỏng, Đếm sai..."/>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={()=>handleAudit('AUDIT')} className="py-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-sm font-bold hover:bg-blue-100">Đây là số thực</button>
                    <button onClick={()=>handleAudit('DAMAGE')} className="py-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-sm font-bold hover:bg-rose-100">Trừ bớt đi</button>
                 </div>
                 <button onClick={closeModals} className="w-full py-2 text-slate-400 text-sm hover:underline mt-2">Hủy bỏ</button>
              </div>
           </div>
        </div>
      )}

      {cardItem && <StockCardModal item={cardItem} onClose={()=>setCardItem(null)} />}
    </div>
  )
}