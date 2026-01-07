import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore'
import { Search, Users, X, Layers, MapPin, Settings, AlertTriangle } from 'lucide-react'
import { db } from '../../firebase'
import InvoiceModal from './InvoiceModal'
import ConfirmModal from '../../components/UI/ConfirmModal'

export default function OrderTables({ user, setRoute, setActiveTable, setActiveOrderId }) {
  // ... (giữ nguyên các state khác)
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [activeZone, setActiveZone] = useState(null)
  
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [setupData, setSetupData] = useState({ floors: 1 })
  const [floorConfigs, setFloorConfigs] = useState({ 1: 10 })
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  const [payingTable, setPayingTable] = useState(null)
  const [payingOrderId, setPayingOrderId] = useState(null)

  // ... (giữ nguyên useEffect fetch data)
  useEffect(() => {
    const q = query(collection(db, 'tables'), orderBy('name'))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
         const zoneCompare = (a.zone || '').localeCompare(b.zone || '')
         if (zoneCompare !== 0) return zoneCompare
         const numA = parseInt(a.name.replace(/\D/g, '')) || 0
         const numB = parseInt(b.name.replace(/\D/g, '')) || 0
         return numA - numB
      })
      setTables(list)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // ... (giữ nguyên logic Tabs và Filter)
  const uniqueZones = [...new Set(tables.map(t => t.zone))].filter(Boolean).sort()
  useEffect(() => {
    if (uniqueZones.length > 0 && (!activeZone || !uniqueZones.includes(activeZone))) {
        setActiveZone(uniqueZones[0])
    }
  }, [uniqueZones, activeZone])

  const displayTables = tables.filter(t => {
    const matchZone = t.zone === activeZone
    const matchSearch = t.name.toLowerCase().includes(filter.toLowerCase())
    return matchZone && matchSearch
  })

  // ... (giữ nguyên handleTableClick)
  const handleTableClick = async (table) => {
    if (table.status === 'BUSY' && table.currentOrderId) {
      setActiveTable(table)
      setActiveOrderId(table.currentOrderId)
      setRoute('menu')
    } else if (table.status === 'FREE') {
      try {
        const staffName = user?.name || user?.email || 'Nhân viên'
        const newOrderRef = await addDoc(collection(db, 'orders'), {
            tableId: table.id, 
            tableName: table.name, 
            zone: table.zone || 'Khu vực chung',
            status: 'SERVING',
            createdAt: serverTimestamp(), 
            createdBy: staffName, 
            creatorId: user?.uid || '',
            items: [], 
            total: 0
        })
        await updateDoc(doc(db, 'tables', table.id), { status: 'BUSY', currentOrderId: newOrderRef.id })
        setActiveTable(table); setActiveOrderId(newOrderRef.id); setRoute('menu')
      } catch (e) { 
          console.error("Lỗi mở bàn:", e)
          alert("Không thể mở bàn. Vui lòng thử lại.")
      }
    }
  }

  // ... (giữ nguyên logic Setup)
  const handleFloorsChange = (num) => {
      const count = Math.max(1, Math.min(20, Number(num)))
      setSetupData({ ...setupData, floors: count })
      const newConfigs = { ...floorConfigs }
      for(let i=1; i<=count; i++) if (!newConfigs[i]) newConfigs[i] = 10 
      setFloorConfigs(newConfigs)
  }

  const triggerBulkSetup = (e) => {
    e.preventDefault(); setSetupError('')
    setConfirmConfig({
        isOpen: true, title: "CẢNH BÁO QUAN TRỌNG",
        message: "Hành động này sẽ XÓA TOÀN BỘ dữ liệu bàn hiện tại và tạo lại mới. Bạn có chắc chắn không?",
        action: processBulkSetup
    })
  }

  const processBulkSetup = async () => {
    setIsSettingUp(true)
    try {
        const batch = writeBatch(db)
        const allTablesSnap = await getDocs(collection(db, 'tables'))
        allTablesSnap.forEach((doc) => batch.delete(doc.ref))
        for (let f = 1; f <= setupData.floors; f++) {
            const zoneName = `Tầng ${f}`
            const tableCount = floorConfigs[f] || 0
            for (let t = 1; t <= tableCount; t++) {
                const newRef = doc(collection(db, 'tables'))
                batch.set(newRef, { name: `Bàn ${t}`, zone: zoneName, status: 'FREE', createdAt: serverTimestamp() })
            }
        }
        await batch.commit(); setShowSetupModal(false); setActiveZone("Tầng 1")
    } catch (error) { console.error(error); setSetupError("Lỗi khi lưu dữ liệu.") } 
    finally { setIsSettingUp(false); setConfirmConfig({ isOpen: false, title: '', message: '', action: null }) }
  }

  const handleQuickPay = (e, table) => { e.stopPropagation(); setPayingTable(table); setPayingOrderId(table.currentOrderId) }
  
  // [QUAN TRỌNG] Sửa hàm này để lưu tên thu ngân chính xác
  const onPaidSuccess = async () => {
    try {
        // Ưu tiên lấy Tên -> Email -> Mặc định 'Admin'
        const cashierName = user?.name || user?.email || 'Admin'

        await updateDoc(doc(db, 'tables', payingTable.id), { status: 'FREE', currentOrderId: null })
        await updateDoc(doc(db, 'orders', payingOrderId), { 
            status: 'PAID', 
            paidAt: serverTimestamp(), 
            paidBy: cashierName // Cập nhật tại đây
        })
        setPayingTable(null); setPayingOrderId(null)
    } catch (e) { console.error(e) }
  }

  return (
    <div className="h-full flex flex-col animate-fadeIn bg-slate-50">
      {/* ... Phần Header giữ nguyên ... */}
      <div className="bg-white border-b border-slate-200 px-4 pt-4 sticky top-0 z-10 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
            <div><h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Layers className="text-emerald-600"/> Sơ đồ bàn</h1></div>
            <div className="flex w-full md:w-auto gap-2">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Tìm bàn..." className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"/>
                </div>
                {user.role === 'MANAGER' && (
                    <button onClick={() => { setShowSetupModal(true); setSetupError(''); }} className="bg-slate-800 text-white px-3 py-2 rounded-xl hover:bg-slate-900 transition shadow-lg flex items-center gap-2 font-bold text-sm whitespace-nowrap">
                        <Settings size={18}/> <span className="hidden sm:inline">Thiết lập quán</span>
                    </button>
                )}
            </div>
        </div>
        <div className="flex gap-6 overflow-x-auto scrollbar-hide -mb-px">
            {uniqueZones.map(z => {
                const isActive = activeZone === z
                return (
                    <button key={z} onClick={() => setActiveZone(z)} className={`pb-3 px-1 border-b-2 transition-all whitespace-nowrap text-sm font-bold flex items-center gap-2 ${isActive ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                        {z} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-emerald-100' : 'bg-slate-100'}`}>{tables.filter(t => t.zone === z).length}</span>
                    </button>
                )
            })}
            {uniqueZones.length === 0 && <div className="pb-3 text-sm text-slate-400 italic">Chưa có dữ liệu bàn...</div>}
        </div>
      </div>

      {/* ... Phần Grid giữ nguyên ... */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? <div className="text-center py-10 text-slate-400">Đang tải dữ liệu...</div> : (
           <>
             {displayTables.length === 0 ? (
                 <div className="text-center py-20 text-slate-400 flex flex-col items-center"><MapPin size={48} className="mb-4 opacity-20"/><p>{uniqueZones.length === 0 ? "Vui lòng bấm 'Thiết lập quán' để tạo bàn." : `Không tìm thấy bàn ở ${activeZone}`}</p></div>
             ) : (
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {displayTables.map(table => {
                        const isBusy = table.status === 'BUSY'
                        return (
                            <div key={table.id} onClick={() => handleTableClick(table)} className={`relative h-40 rounded-2xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 group shadow-sm ${isBusy ? 'bg-white border-rose-200 shadow-rose-100' : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md'}`}>
                                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${isBusy ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                    {isBusy ? 'Có khách' : 'Trống'}
                                </div>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors mt-2 ${isBusy ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}><Users size={24}/></div>
                                <div className="text-center pb-2">
                                    <h3 className={`font-bold text-lg ${isBusy ? 'text-rose-700' : 'text-slate-700'}`}>{table.name}</h3>
                                </div>
                                {isBusy && <button onClick={(e) => handleQuickPay(e, table)} className="absolute bottom-0 left-0 w-full py-2 bg-rose-600 text-white text-sm font-bold rounded-b-xl shadow-sm hover:bg-rose-700 z-10 flex items-center justify-center gap-1">Thanh toán ngay</button>}
                            </div>
                        )
                    })}
                 </div>
             )}
           </>
        )}
      </div>

      {/* ... Phần Modal giữ nguyên ... */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSettingUp && setShowSetupModal(false)}/>
            <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col max-h-[90vh] relative z-10 animate-fadeIn shadow-2xl overflow-hidden">
                <div className="p-6 pb-0">
                    {!isSettingUp && <button onClick={() => setShowSetupModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>}
                    <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><Settings className="text-slate-800"/> Thiết lập quán</h2>
                    <div className="bg-orange-50 text-orange-700 p-3 rounded-lg text-xs border border-orange-200 flex gap-2 mb-4"><AlertTriangle size={16} className="shrink-0"/><span>Lưu ý: Tính năng này sẽ <b>XÓA HẾT</b> các bàn cũ và tạo lại mới.</span></div>
                    {setupError && <div className="bg-rose-50 text-rose-600 p-2 mb-4 rounded-lg text-xs font-bold border border-rose-200 text-center">{setupError}</div>}
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
                    <form id="setup-form" onSubmit={triggerBulkSetup} className="space-y-6">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Tổng số tầng</label><input type="number" min="1" max="20" required value={setupData.floors} onChange={e => handleFloorsChange(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-lg focus:outline-emerald-500" /></div>
                        <div className="space-y-3"><label className="block text-xs font-bold text-slate-500 border-b border-slate-100 pb-2">Chi tiết số bàn từng tầng:</label>{Array.from({ length: setupData.floors }).map((_, idx) => { const floorNum = idx + 1; return (<div key={floorNum} className="flex items-center justify-between gap-4 animate-fadeIn"><span className="font-bold text-slate-700 text-sm w-20">Tầng {floorNum}</span><div className="flex items-center gap-2 flex-1"><input type="number" min="0" max="100" value={floorConfigs[floorNum] || 0} onChange={(e) => setFloorConfigs({...floorConfigs, [floorNum]: Number(e.target.value)})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"/><span className="text-xs text-slate-400 whitespace-nowrap">bàn</span></div></div>)})}</div>
                    </form>
                </div>
                <div className="p-6 pt-4 border-t border-slate-100 bg-slate-50"><button form="setup-form" type="submit" disabled={isSettingUp} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50 transition active:scale-95">{isSettingUp ? 'Đang khởi tạo...' : 'Xác nhận & Tạo mới'}</button></div>
            </div>
        </div>
      )}
      
      <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} onConfirm={confirmConfig.action}/>
      {payingTable && <InvoiceModal user={user} activeTable={payingTable} activeOrderId={payingOrderId} onClose={() => { setPayingTable(null); setPayingOrderId(null) }} onPaid={onPaidSuccess} />}
    </div>
  )
}