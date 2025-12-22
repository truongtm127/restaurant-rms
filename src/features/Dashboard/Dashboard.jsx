// src/features/Dashboard/Dashboard.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { Users, DollarSign, Clock, Calendar, FilePlus, CheckCircle2 } from 'lucide-react'
import { db } from '../../firebase'
import { fmtVND, startOfDay, endOfDay } from '../../utils/helpers'

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [createdOrders, setCreatedOrders] = useState([]) 
  const [paidOrders, setPaidOrders] = useState([])     
  const [tables, setTables] = useState([])             

  const [stats, setStats] = useState({
    revenue: 0, countPaid: 0, countNew: 0, servingTables: 0, totalTables: 0
  })

  // 1. LẮNG NGHE DỮ LIỆU
  useEffect(() => {
    const start = startOfDay(selectedDate)
    const end = endOfDay(selectedDate)

    const qCreated = query(collection(db, 'orders'), where('createdAt', '>=', start), where('createdAt', '<=', end))
    const qPaid = query(collection(db, 'orders'), where('status', '==', 'PAID'), where('closedAt', '>=', start), where('closedAt', '<=', end))
    const qTables = collection(db, 'tables')

    const unsubCreated = onSnapshot(qCreated, (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      setCreatedOrders(list)
    })

    const unsubPaid = onSnapshot(qPaid, (snap) => {
      const list = []
      let rev = 0
      snap.forEach(d => {
        const data = d.data()
        list.push({ id: d.id, ...data })
        rev += (data.total || 0)
      })
      setPaidOrders(list)
      setStats(prev => ({ ...prev, revenue: rev, countPaid: list.length }))
    })

    const unsubTables = onSnapshot(qTables, (snap) => {
      let busy = 0
      const list = []
      snap.forEach(d => {
        const data = d.data()
        if (data.status === 'BUSY') busy++
        list.push({ id: d.id, ...data })
      })
      setTables(list)
      setStats(prev => ({ ...prev, totalTables: snap.size, servingTables: busy }))
    })

    return () => { unsubCreated(); unsubPaid(); unsubTables() }
  }, [selectedDate])

  // 2. XỬ LÝ TIMELINE
  const timeline = useMemo(() => {
    const events = []

    createdOrders.forEach(o => {
      events.push({
        type: 'OPEN',
        timestamp: o.createdAt,
        data: o,
        id: o.id + '_open'
      })
    })

    paidOrders.forEach(o => {
      events.push({
        type: 'PAID',
        timestamp: o.closedAt,
        data: o,
        id: o.id + '_paid'
      })
    })

    events.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
    return events
  }, [createdOrders, paidOrders])

  const StatCard = ({ label, value, sub, icon: Icon, color }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <div className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-2">{label}</div>
        <div className="text-2xl font-bold text-slate-800 mb-1">{value}</div>
        {sub && <div className="text-xs text-slate-400 font-medium">{sub}</div>}
      </div>
      <div className={`p-3 rounded-xl ${color} shadow-sm text-white`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hoạt động kinh doanh</h1>
          <p className="text-sm text-slate-500 mt-1">Theo dõi dòng tiền và đơn hàng chi tiết</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-300 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-500" />
          <input type="date" className="text-sm font-medium text-slate-700 outline-none bg-transparent" value={selectedDate.toISOString().slice(0,10)} onChange={(e) => { if (e.target.value) setSelectedDate(new Date(e.target.value)) }} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Doanh thu" value={fmtVND(stats.revenue)} sub={`${stats.countPaid} đơn đã thanh toán`} icon={DollarSign} color="bg-emerald-500" />
        <StatCard label="Đơn hàng mới" value={createdOrders.length} sub="Tổng số đơn tạo trong ngày" icon={FilePlus} color="bg-blue-500" />
        <StatCard label="Tình trạng bàn" value={`${stats.servingTables} / ${stats.totalTables}`} sub="Bàn đang phục vụ khách" icon={Users} color={stats.servingTables / stats.totalTables > 0.8 ? "bg-rose-500" : "bg-purple-500"} />
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500"/>
            Nhật ký ({selectedDate.toLocaleDateString('vi-VN')})
          </h2>
          <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{timeline.length} sự kiện</span>
        </div>
        
        <div className="divide-y divide-slate-100">
          {timeline.map(event => {
            const isPaid = event.type === 'PAID'
            const timeStr = event.timestamp?.seconds ? new Date(event.timestamp.seconds * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '--:--'
            
            // LOGIC HIỂN THỊ TÊN:
            // Nếu là PAID -> Lấy paidBy, nếu k có thì fallback về createdBy (cho đơn cũ)
            // Nếu là OPEN -> Lấy createdBy
            const staffName = isPaid 
              ? (event.data.paidBy || event.data.createdBy || 'Unknown') 
              : (event.data.createdBy || 'Unknown')

            return (
              <div key={event.id} className={`flex gap-4 p-4 hover:bg-slate-50 transition group ${isPaid ? 'bg-emerald-50/30' : ''}`}>
                <div className="flex flex-col items-center min-w-[60px] pt-1">
                  <span className="text-sm font-bold text-slate-700">{timeStr}</span>
                </div>
                <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${isPaid ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-blue-100 border-blue-200 text-blue-600'}`}>
                  {isPaid ? <CheckCircle2 className="w-5 h-5"/> : <FilePlus className="w-5 h-5"/>}
                  <div className="absolute top-10 bottom-[-50px] w-0.5 bg-slate-100 -z-10 group-last:hidden"/>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-bold ${isPaid ? 'text-emerald-800' : 'text-blue-800'}`}>
                      {isPaid ? 'THANH TOÁN THÀNH CÔNG' : 'MỞ ĐƠN HÀNG MỚI'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                        🍽️ Bàn: <b>{event.data.tableId}</b>
                      </span>
                      <span className="flex items-center gap-1">
                        {/* Hiển thị đúng tên người thực hiện hành động */}
                        👤 {isPaid ? 'Thu ngân:' : 'Phục vụ:'} <b>{staffName}</b>
                      </span>
                    </div>
                    <div className="text-slate-400 font-mono text-[10px]">ID: #{event.data.id.slice(0,8).toUpperCase()}</div>
                  </div>
                </div>
                <div className="text-right min-w-[100px] flex flex-col justify-center">
                  {isPaid ? (
                    <>
                      <div className="text-sm font-bold text-emerald-600">+{fmtVND(event.data.total || 0)}</div>
                      <div className="text-[10px] text-emerald-500 font-medium">Doanh thu</div>
                    </>
                  ) : (
                    <div className="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-1 rounded-lg inline-block text-center">Đang phục vụ</div>
                  )}
                </div>
              </div>
            )
          })}
          {timeline.length === 0 && (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-3xl opacity-50">📅</div>
              <p>Không có hoạt động nào trong ngày này.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}