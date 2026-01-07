import React, { useEffect, useState } from 'react'
import { 
  collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, 
  serverTimestamp, query, orderBy, limit, getDocs 
} from 'firebase/firestore'
import { db } from '../../firebase'
import { 
  Package, Plus, AlertTriangle, History, 
  ArrowDownCircle, Search, X, FileWarning, Trash2, Ban 
} from 'lucide-react'

// --- COMPONENT CON: LỊCH SỬ GIAO DỊCH ---
const HistoryModal = ({ item, onClose }) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const q = query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc'), limit(100));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => d.data()).filter(d => d.inventoryId === item.id);
        setHistory(list);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    fetchHistory()
  }, [item])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-fadeIn">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg flex items-center gap-2"><History size={20}/> Lịch sử: {item.name}</h3>
          <button onClick={onClose} className="hover:bg-slate-200 p-1 rounded"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <p className="text-center py-4">Đang tải...</p> : 
           history.length === 0 ? <p className="text-center text-slate-400 py-4">Chưa có giao dịch nào.</p> : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2 text-right">SL Đổi</th>
                  <th className="px-3 py-2 text-right">Tồn cuối</th>
                  <th className="px-3 py-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-slate-500">{h.createdAt?.toDate ? h.createdAt.toDate().toLocaleString('vi-VN') : 'Vừa xong'}</td>
                    <td className="px-3 py-2 font-bold">
                      {h.type === 'IMPORT' && <span className="text-emerald-600">Nhập hàng</span>}
                      {h.type === 'SALE' && <span className="text-blue-600">Bán hàng</span>}
                      {h.type === 'DAMAGE' && <span className="text-rose-600">Hủy/Hỏng</span>}
                      {h.type === 'AUDIT' && <span className="text-orange-600">Kiểm kê</span>}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${h.change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {h.change > 0 ? '+' : ''}{h.change}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{h.stockAfter}</td>
                    <td className="px-3 py-2 text-slate-500 truncate max-w-[150px]">
                        {h.type === 'IMPORT' && h.price ? `Giá: ${h.price.toLocaleString()}đ` : h.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// --- COMPONENT CHÍNH ---
export default function Inventory({ user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  
  // State thêm mới (BỎ TRƯỜNG QUANTITY)
  const [newItem, setNewItem] = useState({ name: '', unit: 'g', minThreshold: 100 })

  const [showImportModal, setShowImportModal] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [historyItem, setHistoryItem] = useState(null)

  const [inputQty, setInputQty] = useState('')
  const [inputPrice, setInputPrice] = useState('')
  const [inputReason, setInputReason] = useState('')

  // 1. Lắng nghe dữ liệu
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventory'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Sắp xếp: Hết hàng -> Sắp hết -> Tên
      list.sort((a, b) => {
         const aQty = Number(a.quantity) || 0;
         const bQty = Number(b.quantity) || 0;
         if (aQty === 0 && bQty !== 0) return -1;
         if (bQty === 0 && aQty !== 0) return 1;
         
         const aLow = aQty <= (Number(a.minThreshold) || 0);
         const bLow = bQty <= (Number(b.minThreshold) || 0);
         return bLow - aLow || a.name.localeCompare(b.name);
      })
      setItems(list)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // 2. Thêm mới nguyên liệu (MẶC ĐỊNH TỒN KHO = 0)
  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!newItem.name) return
    try {
      await addDoc(collection(db, 'inventory'), {
        ...newItem,
        quantity: 0, // Mặc định là 0
        costPrice: 0, 
        minThreshold: Number(newItem.minThreshold),
        updatedAt: serverTimestamp()
      })
      setNewItem({ name: '', unit: 'g', minThreshold: 100 })
      alert("Đã thêm nguyên liệu mới (Tồn kho: 0). Hãy nhập hàng để bắt đầu sử dụng.")
    } catch (error) { console.error(error) }
  }

  const handleDelete = async (id) => {
    if (window.confirm("Xóa nguyên liệu này?")) await deleteDoc(doc(db, 'inventory', id))
  }

  // 4. Nhập hàng
  const handleImport = async () => {
    if (!inputQty || isNaN(inputQty)) return alert("Vui lòng nhập số lượng!")
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

      await updateDoc(itemRef, {
        quantity: newStock,
        costPrice: newAvgCost,
        updatedAt: serverTimestamp()
      })

      await addDoc(collection(db, 'inventory_transactions'), {
        inventoryId: selectedItem.id,
        itemName: selectedItem.name,
        type: 'IMPORT',
        change: qty,
        stockAfter: newStock,
        price: price,
        reason: inputReason || 'Nhập hàng',
        performer: user?.name || 'Admin',
        createdAt: serverTimestamp()
      })

      closeModals()
    } catch (e) { console.error(e); alert("Lỗi nhập hàng!") }
  }

  // 5. Kiểm kê / Hủy (CÓ GỬI THÔNG BÁO NẾU TỤT DƯỚI ĐỊNH MỨC)
  const handleAudit = async (type) => {
    if (!inputQty) return
    const val = Number(inputQty)
    
    try {
      const itemRef = doc(db, 'inventory', selectedItem.id)
      const currentStock = Number(selectedItem.quantity) || 0
      const threshold = Number(selectedItem.minThreshold) || 0
      let newStock = 0
      let change = 0

      if (type === 'AUDIT') {
          newStock = val 
          change = newStock - currentStock
      } else {
          change = -val 
          newStock = currentStock - val
      }

      await updateDoc(itemRef, { quantity: newStock, updatedAt: serverTimestamp() })

      // Ghi log giao dịch
      await addDoc(collection(db, 'inventory_transactions'), {
        inventoryId: selectedItem.id,
        itemName: selectedItem.name,
        type: type,
        change: change,
        stockAfter: newStock,
        reason: inputReason || (type === 'AUDIT' ? 'Kiểm kê' : 'Hủy hàng'),
        performer: user?.name || 'Admin',
        createdAt: serverTimestamp()
      })

      // --- [MỚI] TỰ ĐỘNG GỬI THÔNG BÁO NẾU SẮP HẾT ---
      if (newStock <= threshold) {
          const msg = newStock === 0 
            ? `🚨 HẾT HÀNG: Nguyên liệu "${selectedItem.name}" đã về 0 sau khi ${type === 'AUDIT' ? 'kiểm kê' : 'hủy hàng'}.`
            : `⚠️ SẮP HẾT: Nguyên liệu "${selectedItem.name}" còn ${newStock} ${selectedItem.unit} (Dưới định mức ${threshold}). Cần nhập thêm.`;

          await addDoc(collection(db, 'notifications'), {
              type: 'low_stock',
              title: newStock === 0 ? 'HẾT NGUYÊN LIỆU' : 'CẢNH BÁO KHO',
              message: msg,
              isRead: false,
              createdAt: serverTimestamp(),
              createdBy: 'System (Inventory)'
          });
          
          alert(`Đã cập nhật kho & Gửi cảnh báo cho quản lý vì số lượng thấp!`);
      } else {
          // alert("Đã cập nhật kho thành công.");
      }

      closeModals()
    } catch (e) { console.error(e); alert("Lỗi xử lý!") }
  }

  const closeModals = () => {
    setShowImportModal(false); setShowAuditModal(false); setSelectedItem(null);
    setInputQty(''); setInputPrice(''); setInputReason('')
  }

  const displayItems = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      
      {/* HEADER & FORM THÊM (Đã bỏ nhập Tồn đầu) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4"><Package className="text-emerald-600"/> Quản lý Kho & Nguyên liệu</h1>
        
        <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
             <div className="md:col-span-5">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên nguyên liệu mới</label>
                <input required type="text" placeholder="VD: Thịt bò, Bún..." value={newItem.name} onChange={e=>setNewItem({...newItem, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm"/>
             </div>
             <div className="md:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase">Đơn vị</label>
                <select value={newItem.unit} onChange={e=>setNewItem({...newItem, unit: e.target.value})} className="w-full p-2 border rounded-lg bg-white text-sm">
                    <option value="g">Gam (g)</option>
                    <option value="kg">Kg</option>
                    <option value="ml">Milit (ml)</option>
                    <option value="l">Lít (l)</option>
                    <option value="cai">Cái/Quả</option>
                    <option value="goi">Gói/Lon</option>
                </select>
             </div>
             <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Định mức báo động</label>
                <input type="number" min="0" value={newItem.minThreshold} onChange={e=>setNewItem({...newItem, minThreshold: e.target.value})} className="w-full p-2 border rounded-lg text-sm" placeholder="VD: 100"/>
             </div>
             <div className="md:col-span-2 flex items-end">
                <button type="submit" className="w-full py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 text-sm flex items-center justify-center gap-1"><Plus size={16}/> Thêm (SL: 0)</button>
             </div>
        </form>
      </div>

      {/* DANH SÁCH */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-2">
            <Search className="text-slate-400"/>
            <input placeholder="Tìm kiếm nguyên liệu..." value={filter} onChange={e=>setFilter(e.target.value)} className="outline-none flex-1 font-medium text-sm"/>
        </div>
        
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                    <th className="p-4">Tên</th>
                    <th className="p-4 text-center">Tồn kho</th>
                    <th className="p-4 text-center">Định mức</th>
                    <th className="p-4 text-center">Giá vốn</th>
                    <th className="p-4 text-center">Trạng thái</th>
                    <th className="p-4 text-right">Thao tác</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {displayItems.map(item => {
                    const stock = Number(item.quantity) || 0
                    const threshold = Number(item.minThreshold) || 0
                    
                    const isOutOfStock = stock === 0
                    const isLow = stock > 0 && stock <= threshold

                    return (
                        <tr key={item.id} className={`hover:bg-slate-50 ${isOutOfStock ? 'bg-gray-100 opacity-75' : (isLow ? 'bg-red-50/40' : '')}`}>
                            <td className="p-4">
                                <div className="font-bold text-slate-700">{item.name}</div>
                                <div className="text-xs text-slate-400">Đơn vị: {item.unit}</div>
                            </td>
                            <td className="p-4 text-center">
                                <div className={`font-bold text-base ${isOutOfStock ? 'text-slate-400' : (isLow ? 'text-rose-600' : 'text-emerald-700')}`}>
                                    {stock.toLocaleString()}
                                </div>
                            </td>
                            <td className="p-4 text-center text-slate-500">
                                {threshold.toLocaleString()}
                            </td>
                            <td className="p-4 text-center font-mono text-slate-600">
                                {Number(item.costPrice || 0).toLocaleString()}đ
                            </td>
                            <td className="p-4 text-center">
                                {isOutOfStock ? (
                                    <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                        <Ban size={10}/> Hết hàng
                                    </span>
                                ) : isLow ? (
                                    <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold inline-flex items-center gap-1 animate-pulse">
                                        <AlertTriangle size={10}/> Sắp hết
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                                        Ổn định
                                    </span>
                                )}
                            </td>
                            <td className="p-4 text-right space-x-1">
                                <button onClick={()=>{setSelectedItem(item); setShowImportModal(true)}} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Nhập hàng">
                                    <ArrowDownCircle size={18}/>
                                </button>
                                <button onClick={()=>{setSelectedItem(item); setShowAuditModal(true)}} className="p-2 bg-orange-50 text-orange-600 rounded hover:bg-orange-100" title="Kiểm kê/Hủy">
                                    <FileWarning size={18}/>
                                </button>
                                <button onClick={()=>setHistoryItem(item)} className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200" title="Lịch sử">
                                    <History size={18}/>
                                </button>
                                <button onClick={()=>handleDelete(item.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition" title="Xóa">
                                    <Trash2 size={18}/>
                                </button>
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
      </div>

      {/* --- MODAL NHẬP HÀNG --- */}
      {showImportModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fadeIn">
              <h3 className="text-lg font-bold mb-4 text-emerald-700 flex items-center gap-2"><ArrowDownCircle/> Nhập hàng: {selectedItem.name}</h3>
              <div className="space-y-3">
                 <div>
                    <label className="text-xs font-bold text-slate-500">Số lượng nhập thêm ({selectedItem.unit})</label>
                    <input type="number" autoFocus value={inputQty} onChange={e=>setInputQty(e.target.value)} className="w-full p-2 border rounded font-bold text-lg"/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500">Giá nhập (VNĐ / {selectedItem.unit})</label>
                    <input type="number" value={inputPrice} onChange={e=>setInputPrice(e.target.value)} className="w-full p-2 border rounded" placeholder="Để tính giá vốn..."/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500">Nguồn nhập/Ghi chú</label>
                    <input type="text" value={inputReason} onChange={e=>setInputReason(e.target.value)} className="w-full p-2 border rounded" placeholder="Vd: Chợ đầu mối"/>
                 </div>
                 <div className="flex gap-2 pt-2">
                    <button onClick={closeModals} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded font-bold">Hủy</button>
                    <button onClick={handleImport} className="flex-1 py-2 bg-emerald-600 text-white rounded font-bold">Xác nhận</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL KIỂM KÊ/HỦY --- */}
      {showAuditModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fadeIn">
              <h3 className="text-lg font-bold mb-4 text-orange-700 flex items-center gap-2"><FileWarning/> Điều chỉnh: {selectedItem.name}</h3>
              <p className="text-sm bg-slate-50 p-2 rounded mb-3">Tồn hiện tại: <b>{selectedItem.quantity}</b> {selectedItem.unit}</p>
              <div className="space-y-3">
                 <div>
                    <label className="text-xs font-bold text-slate-500">Số lượng</label>
                    <input type="number" autoFocus value={inputQty} onChange={e=>setInputQty(e.target.value)} className="w-full p-2 border rounded font-bold text-lg"/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500">Lý do</label>
                    <input type="text" value={inputReason} onChange={e=>setInputReason(e.target.value)} className="w-full p-2 border rounded" placeholder="Vd: Đổ vỡ, Đếm sai..."/>
                 </div>
                 <div className="grid grid-cols-2 gap-2 pt-2">
                    <button onClick={()=>handleAudit('AUDIT')} className="py-2 bg-blue-600 text-white rounded text-sm font-bold">Đây là số thực tế</button>
                    <button onClick={()=>handleAudit('DAMAGE')} className="py-2 bg-rose-600 text-white rounded text-sm font-bold">Trừ số này đi (Hỏng)</button>
                 </div>
                 <button onClick={closeModals} className="w-full py-2 text-slate-400 text-sm">Hủy bỏ</button>
              </div>
           </div>
        </div>
      )}

      {historyItem && <HistoryModal item={historyItem} onClose={()=>setHistoryItem(null)} />}
    </div>
  )
}