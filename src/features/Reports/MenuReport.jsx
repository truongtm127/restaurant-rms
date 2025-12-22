// src/features/Reports/MenuReport.jsx
import React, { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { db } from '../../firebase'
import { fmtVND, startOfMonth, endOfMonth, startOfDay, endOfDay } from '../../utils/helpers'

// Hàm lấy dữ liệu order đã thanh toán
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

// Custom Tooltip cho biểu đồ đẹp hơn
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl text-sm">
        <div className="font-bold text-slate-800 mb-1">{data.name}</div>
        <div className="text-emerald-600 font-semibold">
          Đã bán: {data.qty} suất
        </div>
        <div className="text-slate-500 text-xs mt-1">
          Doanh thu: {fmtVND(data.revenue)}
        </div>
      </div>
    )
  }
  return null
}

export default function MenuReport() {
  const [from, setFrom] = useState(startOfMonth(new Date()))
  const [to, setTo]     = useState(endOfMonth(new Date()))
  const [topItems, setTopItems] = useState([]) 
  const [lowItems, setLowItems] = useState([]) 
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    setLoading(true)
    try {
      const orders = await fetchPaidOrders(from, to)
      const itemAgg = new Map() 

      // Tổng hợp số liệu
      for (const o of orders) {
        const snap = await getDocs(collection(db, 'orders', o.id, 'items'))
        snap.forEach(d => {
          const it = d.data()
          const key = it.name || it.menuItemId || 'Unknown'
          const cur = itemAgg.get(key) || { qty:0, revenue:0 }
          
          const qty = Number(it.qty||1)
          const price = Number(it.price||0)
          
          cur.qty += qty
          cur.revenue += qty*price
          itemAgg.set(key, cur)
        })
      }

      const arr = Array.from(itemAgg.entries()).map(([name, v]) => ({ name, ...v }))

      // 1. SẮP XẾP THEO SỐ LƯỢNG (QTY) GIẢM DẦN
      arr.sort((a,b)=> b.qty - a.qty)
      setTopItems(arr.slice(0,10)) // Lấy top 10

      // 2. Tìm các món bán ít nhất (nhưng > 0)
      const tail = [...arr].sort((a,b)=> a.qty - b.qty).filter(x=>x.qty>0).slice(0,10)
      setLowItems(tail)

    } catch (error) {
      console.error("Report error:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ reload() },[])
  useEffect(()=>{ reload() },[from.getTime(), to.getTime()])

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Bộ lọc thời gian */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs text-slate-500 font-medium mb-1">Từ ngày</div>
          <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"
            value={from.toISOString().slice(0,10)}
            onChange={e=>setFrom(startOfDay(new Date(e.target.value)))}/>
        </div>
        <div>
          <div className="text-xs text-slate-500 font-medium mb-1">Đến ngày</div>
          <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"
            value={to.toISOString().slice(0,10)}
            onChange={e=>setTo(endOfDay(new Date(e.target.value)))}/>
        </div>
        <button onClick={reload} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition">
          Xem báo cáo
        </button>
        <div className="ml-auto text-sm text-slate-500 italic">{loading?'Đang tính toán...':''}</div>
      </div>

      {/* BIỂU ĐỒ TOP MÓN BÁN CHẠY (THEO SỐ LƯỢNG) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-6">
           <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">🏆</div>
           <div>
             <div className="font-bold text-lg text-slate-800">Top 10 Món Bán Chạy Nhất</div>
             <div className="text-xs text-slate-500">Xếp hạng theo số lượng đã bán</div>
           </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topItems} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                tick={{fontSize:11, fill:'#64748b'}} 
                interval={0} 
                angle={-15} 
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{fontSize:11, fill:'#64748b'}} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
              <Bar 
                dataKey="qty" 
                name="Số lượng" 
                fill="#10b981" 
                radius={[6, 6, 0, 0]} 
                barSize={40}
                activeBar={{ fill: '#059669' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BẢNG CHI TIẾT */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Bảng Top 10 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
            Chi tiết Top 10
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-slate-500 border-b">
                <tr>
                  <th className="p-3 font-medium">Món ăn</th>
                  <th className="p-3 text-right">SL Bán</th>
                  <th className="p-3 text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topItems.map((it, idx)=>(
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-700">
                      <span className="inline-block w-5 text-emerald-600 font-bold mr-1">#{idx+1}</span>
                      {it.name}
                    </td>
                    <td className="p-3 text-right font-bold">{it.qty}</td>
                    <td className="p-3 text-right text-slate-500">{fmtVND(it.revenue)}</td>
                  </tr>
                ))}
                {topItems.length===0 && (
                  <tr><td className="p-4 text-center text-slate-500" colSpan={3}>Chưa có dữ liệu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bảng Bottom 10 (Ít bán) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 flex items-center gap-2">
            ⚠️ Món ít bán nhất <span className="text-xs font-normal text-slate-500">(SL &gt; 0)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-slate-500 border-b">
                <tr>
                  <th className="p-3 font-medium">Món ăn</th>
                  <th className="p-3 text-right">SL Bán</th>
                  <th className="p-3 text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowItems.map((it, idx)=>(
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-700">{it.name}</td>
                    <td className="p-3 text-right font-bold text-amber-600">{it.qty}</td>
                    <td className="p-3 text-right text-slate-500">{fmtVND(it.revenue)}</td>
                  </tr>
                ))}
                {lowItems.length===0 && (
                  <tr><td className="p-4 text-center text-slate-500" colSpan={3}>Chưa có dữ liệu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}