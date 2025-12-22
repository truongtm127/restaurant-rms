import React, { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts'
import { db } from '../../firebase'
import { 
  fmtVND, addDays, startOfDay, endOfDay, 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfQuarter, endOfQuarter, startOfYear, endOfYear 
} from '../../utils/helpers'

async function fetchPaidOrders(from, to) {
  const qRef = query(
    collection(db, 'orders'),
    where('status','==','PAID'),
    where('closedAt','>=', Timestamp.fromDate(from)),
    where('closedAt','<=', Timestamp.fromDate(to)),
    orderBy('closedAt', 'asc')
  )
  const snap = await getDocs(qRef)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export default function RevenueReport() {
  const [rangeType, setRangeType] = useState('day') 
  const [from, setFrom] = useState(startOfDay(new Date()))
  const [to, setTo]     = useState(endOfDay(new Date()))
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [compare, setCompare] = useState({ revenue: 0, orders: 0 })

  const pickPreset = (t) => {
    const now = new Date()
    setRangeType(t)
    if (t==='day')   { setFrom(startOfDay(now)); setTo(endOfDay(now)) }
    if (t==='week')  { setFrom(startOfWeek(now)); setTo(endOfWeek(now)) }
    if (t==='month') { setFrom(startOfMonth(now)); setTo(endOfMonth(now)) }
    if (t==='quarter'){ setFrom(startOfQuarter(now)); setTo(endOfQuarter(now)) }
    if (t==='year')  { setFrom(startOfYear(now)); setTo(endOfYear(now)) }
  }

  const reload = async () => {
    setLoading(true)
    const data = await fetchPaidOrders(from, to)
    setOrders(data)

    const lenDays = Math.max(1, Math.round((to - from)/86400000)+1)
    const prevFrom = addDays(from, -lenDays)
    const prevTo   = addDays(to,   -lenDays)
    const prev = await fetchPaidOrders(prevFrom, prevTo)
    const rev = prev.reduce((s,o)=> s + Number(o.total||0), 0)
    setCompare({ revenue: rev, orders: prev.length })

    setLoading(false)
  }

  useEffect(()=>{ reload() },[]) 
  useEffect(()=>{ reload() },[from.getTime(), to.getTime()])

  const revenue = orders.reduce((s,o)=> s + Number(o.total||0), 0)
  const count   = orders.length

  const byHour = Array(24).fill(0)
  orders.forEach(o=>{
    const dt = o.closedAt?.toDate?.() || new Date()
    const h = dt.getHours()
    byHour[h] += Number(o.total||0)
  })
  const hourSeries = byHour.map((v,i)=>({ h: i, k: Math.round(v/1000) }))

  const timeSeries = (() => {
    const map = new Map()
    orders.forEach(o => {
      const dt = o.closedAt?.toDate?.() || new Date()
      let key = ''
      if (rangeType==='day' || rangeType==='custom') {
        key = dt.toLocaleDateString('vi-VN') 
      } else if (rangeType==='week') {
        key = `T${(dt.getDay()+6)%7 + 2}`.replace('T8','CN')
      } else if (rangeType==='month') {
        key = String(dt.getDate()).padStart(2,'0')
      } else if (rangeType==='quarter' || rangeType==='year') {
        key = String(dt.getMonth()+1).padStart(2,'0') 
      }
      map.set(key, (map.get(key)||0) + Number(o.total||0))
    })
    return Array.from(map.entries())
      .sort((a,b)=> a[0].localeCompare(b[0], 'vi', {numeric:true}))
      .map(([k,v])=>({ x:k, k: Math.round(v/1000) }))
  })()

  return (
    <div className="space-y-4">
      {/* Bộ lọc thời gian */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Khoảng thời gian</div>
          <div className="flex flex-wrap gap-2">
            {['day','week','month','quarter','year','custom'].map(t=>(
              <button key={t} onClick={()=>pickPreset(t)}
                className={`px-3 py-1.5 rounded-lg border ${rangeType===t?'bg-emerald-600 text-white border-emerald-600':'bg-white'}`}>
                {t==='day'?'Ngày':t==='week'?'Tuần':t==='month'?'Tháng':t==='quarter'?'Quý':t==='year'?'Năm':'Tùy chọn'}
              </button>
            ))}
          </div>
        </div>
        {rangeType==='custom' && (
          <>
            <div>
              <div className="text-xs text-slate-500">Từ ngày</div>
              <input type="date" className="border rounded-lg px-3 py-1.5"
                value={from.toISOString().slice(0,10)}
                onChange={e => setFrom(startOfDay(new Date(e.target.value)))} />
            </div>
            <div>
              <div className="text-xs text-slate-500">Đến ngày</div>
              <input type="date" className="border rounded-lg px-3 py-1.5"
                value={to.toISOString().slice(0,10)}
                onChange={e => setTo(endOfDay(new Date(e.target.value)))} />
            </div>
            <button onClick={reload} className="px-3 py-1.5 rounded-lg border">Áp dụng</button>
          </>
        )}
        <div className="ml-auto text-sm text-slate-500">{loading?'Đang tải…':''}</div>
      </div>

      {/* KPI tổng + So sánh kỳ */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-slate-500">Doanh thu</div>
          <div className="text-xl font-bold mt-1">{fmtVND(revenue)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-slate-500">Số đơn</div>
          <div className="text-xl font-bold mt-1">{count}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-slate-500">So sánh kỳ trước</div>
          <div className="text-sm mt-1">
            {fmtVND(compare.revenue)} / {compare.orders} đơn
          </div>
        </div>
      </div>

      {/* Biểu đồ theo thời gian */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="font-semibold mb-2">Biểu đồ doanh thu theo thời gian</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeries}>
              <XAxis dataKey="x"/>
              <YAxis/>
              <Tooltip/>
              <Line type="monotone" dataKey="k" name="(nghìn VND)" dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap theo giờ */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="font-semibold mb-2">Doanh thu theo giờ trong ngày</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourSeries}>
              <XAxis dataKey="h"/>
              <YAxis/>
              <Tooltip/>
              <Legend/>
              <Bar dataKey="k" name="(nghìn VND)" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}