import React, { useEffect, useState, useMemo } from 'react'
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { db } from '../../firebase'
import { fmtVND, startOfDay, endOfDay, startOfMonth, endOfMonth, formatDateInput } from '../../utils/helpers'
import { TrendingUp, ShoppingBag, CreditCard, Calendar, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react'

// --- CONSTANTS ---
const CHART_COLORS = {
  top: '#10b981',   // Emerald-500
  bottom: '#f59e0b' // Amber-500
}

// --- SUB COMPONENTS ---
const StatCard = ({ title, value, sub, icon: Icon, color }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex justify-between items-start hover:shadow-md transition-shadow">
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 my-1">{value}</h3>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
    <div className={`p-3 rounded-lg ${color} text-white shadow-sm`}>
      <Icon size={20} />
    </div>
  </div>
)

// --- MAIN COMPONENT ---
export default function RevenueReport() {
  // State
  const [dateRange, setDateRange] = useState({ 
    from: startOfMonth(new Date()), 
    to: endOfMonth(new Date()) 
  })
  
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState([])     
  const [menuAnalysis, setMenuAnalysis] = useState({ top: [], bottom: [] }) 
  const [itemViewMode, setItemViewMode] = useState('top') 

  // Fetch Data
  const loadReportData = async () => {
    setLoading(true)  
    try {
      // 1. Fetch Orders
      const qRef = query(
        collection(db, 'orders'),
        where('status', '==', 'PAID'),
        where('createdAt', '>=', Timestamp.fromDate(dateRange.from)),
        where('createdAt', '<=', Timestamp.fromDate(dateRange.to)),
        orderBy('createdAt', 'asc')
      )
      const snap = await getDocs(qRef)
      const fetchedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setOrders(fetchedOrders)

      // 2. Analyze Menu Items
      const itemMap = new Map()
      
      // Fetch items for all orders (parallel)
      await Promise.all(fetchedOrders.map(async (order) => {
        const itemsSnap = await getDocs(collection(db, 'orders', order.id, 'items'))
        itemsSnap.forEach(doc => {
          const item = doc.data()
          const key = item.name || 'Unknown'
          const current = itemMap.get(key) || { qty: 0, revenue: 0 }
          
          itemMap.set(key, { 
            qty: current.qty + Number(item.qty || 0), 
            revenue: current.revenue + (Number(item.qty || 0) * Number(item.price || 0)) 
          })
        })
      }))

      const allItems = Array.from(itemMap.entries()).map(([name, val]) => ({ name, ...val }))
      // Sort by quantity descending
      allItems.sort((a, b) => b.qty - a.qty)

      setMenuAnalysis({
        top: allItems.slice(0, 10), 
        bottom: [...allItems].sort((a, b) => a.qty - b.qty).filter(x => x.qty > 0).slice(0, 10)
      })

    } catch (e) {
      console.error("Report Error:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    loadReportData() 
  }, [dateRange.from.getTime(), dateRange.to.getTime()])

  // Calculations & Memoization
  const { kpi, revenueChartData, hourChartData } = useMemo(() => {
    // KPI
    const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    const count = orders.length
    const aov = count > 0 ? Math.round(revenue / count) : 0

    // Revenue Chart Data (Daily)
    const revMap = new Map()
    orders.forEach(o => {
      const timeRef = o.closedAt || o.paidAt || o.createdAt
      const d = timeRef?.toDate?.() || new Date()
      const key = `${d.getDate()}/${d.getMonth() + 1}`
      revMap.set(key, (revMap.get(key) || 0) + Number(o.total || 0))
    })
    const revData = Array.from(revMap.entries()).map(([name, value]) => ({ name, value: Math.round(value / 1000) }))

    // Hour Chart Data
    const hourData = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, value: 0 }))
    orders.forEach(o => {
      const timeRef = o.closedAt || o.paidAt || o.createdAt
      if (timeRef?.toDate) {
        const h = timeRef.toDate().getHours()
        hourData[h].value += Number(o.total || 0)
      }
    })
    const finalHourData = hourData.map(d => ({ ...d, value: Math.round(d.value / 1000) }))

    return {
      kpi: { revenue, count, aov },
      revenueChartData: revData,
      hourChartData: finalHourData
    }
  }, [orders])

  return (
    <div className="space-y-6">
      
      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Từ ngày</label>
          <input 
            type="date" 
            className="block border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            value={formatDateInput(dateRange.from)} 
            onChange={e => setDateRange(p => ({ ...p, from: startOfDay(new Date(e.target.value)) }))} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Đến ngày</label>
          <input 
            type="date" 
            className="block border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            value={formatDateInput(dateRange.to)} 
            onChange={e => setDateRange(p => ({ ...p, to: endOfDay(new Date(e.target.value)) }))} 
          />
        </div>
        <button 
          onClick={loadReportData} 
          disabled={loading} 
          className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Đang xử lý...' : 'Cập nhật'}
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Tổng doanh thu" 
          value={fmtVND(kpi.revenue)} 
          sub="Thực thu (Đã thanh toán)" 
          icon={TrendingUp} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Số đơn hàng" 
          value={kpi.count} 
          sub="Tổng bill hoàn thành" 
          icon={ShoppingBag} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Giá trị TB / Đơn" 
          value={fmtVND(kpi.aov)} 
          sub="Trung bình mỗi bàn" 
          icon={CreditCard} 
          color="bg-purple-500" 
        />
      </div>

      {/* CHARTS AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* REVENUE CHART */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 text-sm flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600"/> Xu hướng doanh thu (nghìn đ)
          </h3>
          
          <div style={{ width: '100%', height: 300 }}>
            {loading ? <div className="h-full flex items-center justify-center text-slate-400">Đang tải...</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis dataKey="name" tick={{fontSize:11}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                    formatter={(value) => [`${value}k`, 'Doanh thu']} 
                  />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#colorRev)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* PEAK HOURS CHART */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 text-sm flex items-center gap-2">
            <Calendar size={16} className="text-blue-500"/> Khung giờ cao điểm
          </h3>
          <div style={{ width: '100%', height: 300 }}>
            {loading ? <div className="h-full flex items-center justify-center text-slate-400">Đang tải...</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                  <XAxis type="number" hide />
                  <YAxis dataKey="hour" type="category" tick={{fontSize:11}} width={30} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* MENU ANALYSIS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Filter size={20} className="text-slate-500" /> Phân tích hiệu quả món ăn
            </h3>
            <p className="text-sm text-slate-500">Xếp hạng món ăn dựa trên số lượng bán ra</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setItemViewMode('top')} 
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${itemViewMode === 'top' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ArrowUpRight size={16} /> Top Bán Chạy
            </button>
            <button 
              onClick={() => setItemViewMode('bottom')} 
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${itemViewMode === 'bottom' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ArrowDownRight size={16} /> Top Bán Chậm
            </button>
          </div>
        </div>

        <div style={{ width: '100%', height: 350 }}>
          {loading ? <div className="h-full flex items-center justify-center text-slate-400">Đang tải...</div> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={itemViewMode === 'top' ? menuAnalysis.top : menuAnalysis.bottom} 
                layout="vertical" 
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload
                      return (
                        <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg text-sm">
                          <div className="font-bold text-slate-800 mb-1">{d.name}</div>
                          <div className="text-slate-600">Số lượng: <b className="text-emerald-600">{d.qty}</b></div>
                          <div className="text-slate-500 text-xs">Doanh thu: {fmtVND(d.revenue)}</div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar 
                  dataKey="qty" 
                  fill={itemViewMode === 'top' ? CHART_COLORS.top : CHART_COLORS.bottom} 
                  radius={[0, 4, 4, 0]} 
                  barSize={24} 
                  background={{ fill: '#f8fafc' }} 
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}