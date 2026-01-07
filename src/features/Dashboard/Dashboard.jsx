import React, { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, limit } from 'firebase/firestore'
import { Users, DollarSign, Clock, Calendar, FilePlus, CheckCircle2, ChefHat } from 'lucide-react'
import { db } from '../../firebase'
import { fmtVND } from '../../utils/helpers'

// ... (Giữ nguyên các hàm helper isSameDay, getLocalDateString)
const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false
  const date1 = new Date(d1.seconds ? d1.seconds * 1000 : d1)
  const date2 = new Date(d2.seconds ? d2.seconds * 1000 : d2)
  return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear()
}
const getLocalDateString = (date) => {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [ordersSnapshot, setOrdersSnapshot] = useState([])
  const [stats, setStats] = useState({ revenue: 0, countPaid: 0, countNew: 0, servingTables: 0, totalTables: 0 })

  // ... (Giữ nguyên useEffect fetch data)
  useEffect(() => {
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), limit(200)), (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      setOrdersSnapshot(list)
    })
    const unsubTables = onSnapshot(collection(db, 'tables'), (snap) => {
      let busy = 0
      snap.forEach(d => { if (d.data().status === 'BUSY') busy++ })
      setStats(prev => ({ ...prev, servingTables: busy, totalTables: snap.size }))
    })
    return () => { unsubOrders(); unsubTables() }
  }, [])

  const { timeline, dailyStats } = useMemo(() => {
    const events = []
    let rev = 0, paidCount = 0, newCount = 0
    
    ordersSnapshot.forEach(o => {
      // 1. OPEN
      if (isSameDay(o.createdAt, selectedDate)) {
        events.push({ 
          uniqueId: o.id + '_open', type: 'OPEN', timestamp: o.createdAt, 
          tableName: o.tableName||o.tableId, staffName: o.createdBy||'Unknown', data: o 
        })
        newCount++
      }
      // 2. SERVED
      if (o.finishedAt && isSameDay(o.finishedAt, selectedDate)) {
        events.push({ 
          uniqueId: o.id + '_served', type: 'SERVED', timestamp: o.finishedAt, 
          tableName: o.tableName||o.tableId, staffName: o.servedBy||o.chefName||'Bếp', data: o 
        })
      }
      // 3. PAID
      if (o.status === 'PAID' && isSameDay(o.paidAt || o.updatedAt, selectedDate)) {
        const realTotal = o.finalTotal !== undefined ? o.finalTotal : o.total
        events.push({ 
          uniqueId: o.id + '_paid', type: 'PAID', timestamp: o.paidAt || o.updatedAt, 
          tableName: o.tableName||o.tableId, 
          // [SỬA] Đảm bảo luôn lấy được tên thu ngân, nếu không có thì fallback 'Admin'
          staffName: o.paidBy || 'Admin', 
          total: realTotal, data: o 
        })
        rev += (Number(realTotal) || 0)
        paidCount++
      }
    })
    
    events.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
    return { timeline: events, dailyStats: { revenue: rev, countPaid: paidCount, countNew: newCount } }
  }, [ordersSnapshot, selectedDate])

  // ... (Giữ nguyên phần render)
  useEffect(() => { setStats(prev => ({ ...prev, ...dailyStats })) }, [dailyStats])

  const StatCard = ({ label, value, sub, icon: Icon, color }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow animate-fadeIn">
      <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">{label}</div><div className="text-2xl font-bold text-slate-800 mb-1">{value}</div>{sub && <div className="text-xs text-slate-400 font-medium">{sub}</div>}</div>
      <div className={`p-3 rounded-xl ${color} shadow-sm text-white`}><Icon className="w-6 h-6" /></div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div><h1 className="text-2xl font-bold text-slate-800">Nhật ký hoạt động</h1><p className="text-sm text-slate-500 mt-1">Theo dõi chi tiết Phục vụ - Bếp - Thu ngân</p></div>
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-300 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input type="date" className="text-sm font-medium text-slate-700 outline-none bg-transparent cursor-pointer" value={getLocalDateString(selectedDate)} onChange={(e) => { if (e.target.value) { const [y, m, d] = e.target.value.split('-').map(Number); setSelectedDate(new Date(y, m - 1, d)) } }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Doanh thu" value={fmtVND(stats.revenue)} sub={`${stats.countPaid} đơn đã thanh toán`} icon={DollarSign} color="bg-emerald-500" />
        <StatCard label="Đơn hàng mới" value={stats.countNew} sub="Tổng số đơn tạo trong ngày" icon={FilePlus} color="bg-blue-500" />
        <StatCard label="Bàn đang khách" value={`${stats.servingTables} / ${stats.totalTables}`} sub="Công suất phục vụ" icon={Users} color={stats.servingTables > 0 ? "bg-rose-500" : "bg-purple-500"} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-slate-500"/>Nhật ký ({selectedDate.toLocaleDateString('vi-VN')})</h2>
          <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{timeline.length} sự kiện</span>
        </div>
       
        <div className="divide-y divide-slate-100">
          {timeline.length === 0 ? <div className="py-12 text-center text-slate-400">Chưa có hoạt động nào trong ngày.</div> : timeline.map(event => {
              const timeStr = event.timestamp?.seconds ? new Date(event.timestamp.seconds * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '--:--'
              let icon, colorClass, title, staffLabel
              if (event.type === 'PAID') {
                icon = <CheckCircle2 className="w-5 h-5"/>; colorClass = 'bg-emerald-100 border-emerald-200 text-emerald-600'; title = 'THANH TOÁN'; staffLabel = 'Thu ngân'
              } else if (event.type === 'SERVED') {
                icon = <ChefHat className="w-5 h-5"/>; colorClass = 'bg-orange-100 border-orange-200 text-orange-600'; title = 'BẾP TRẢ MÓN'; staffLabel = 'Bếp'
              } else {
                icon = <FilePlus className="w-5 h-5"/>; colorClass = 'bg-blue-100 border-blue-200 text-blue-600'; title = 'MỞ ĐƠN'; staffLabel = 'Phục vụ'
              }
              const zoneName = event.data.zone ? `${event.data.zone} - ` : ''

              return (
                <div key={event.uniqueId} className="flex gap-4 p-4 hover:bg-slate-50 transition group animate-fadeIn">
                  <div className="flex flex-col items-center min-w-[60px] pt-1"><span className="text-sm font-bold text-slate-700">{timeStr}</span></div>
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${colorClass}`}>{icon}<div className="absolute top-10 bottom-[-50px] w-0.5 bg-slate-100 -z-10 group-last:hidden"/></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1"><span className={`text-sm font-bold ${event.type==='PAID'?'text-emerald-800':(event.type==='SERVED'?'text-orange-800':'text-blue-800')}`}>{title}</span></div>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                        <span className="bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                           🍽️ <b>{zoneName}{event.tableName}</b>
                        </span>
                        <span className="opacity-80">👤 {staffLabel}: <b>{event.staffName}</b></span>
                    </div>
                  </div>
                  <div className="text-right min-w-[100px] flex flex-col justify-center">
                    {event.type === 'PAID' && <div className="text-sm font-bold text-emerald-600">+{fmtVND(event.total)}</div>}
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>
    </div>
  )
}