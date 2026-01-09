import React, { useEffect, useState, useMemo } from 'react'
import { 
  collection, getDocs, query, where, orderBy, doc, getDoc 
} from 'firebase/firestore'
import { db } from '../../firebase'
import { 
  DollarSign, Calendar, Users, Clock, Search, 
  ArrowRight, Wallet 
} from 'lucide-react'

// --- HELPER ---
const fmtMoney = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num)

const getLocalDateStr = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function Payroll() {
  const [staffData, setStaffData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  // State thời gian (Mặc định: Đầu tháng -> Hôm nay)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1); 
  
  const [startDate, setStartDate] = useState(getLocalDateStr(firstDay));
  const [endDate, setEndDate] = useState(getLocalDateStr(today));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // 1. Lấy danh sách nhân viên
        const usersSnap = await getDocs(collection(db, 'users'))
        const usersMap = {}
        usersSnap.forEach(d => {
            const data = d.data()
            usersMap[d.id] = {
                id: d.id,
                name: data.name || 'Unknown',
                email: data.email,
                role: data.role,
                hourlyRate: Number(data.hourlyRate) || 25000, 
                totalHours: 0,
                shifts: 0
            }
        })

        // 2. Lấy dữ liệu chấm công
        const start = new Date(startDate)
        start.setHours(0,0,0,0)
        
        const end = new Date(endDate)
        end.setHours(23,59,59,999)

        const q = query(
            collection(db, 'attendance'),
            where('checkIn', '>=', start),
            where('checkIn', '<=', end),
            orderBy('checkIn', 'desc')
        )

        const attendanceSnap = await getDocs(q)

        // 3. Tính toán
        attendanceSnap.forEach(d => {
            const att = d.data()
            const uid = att.userId
            
            if (usersMap[uid] && att.checkIn && att.checkOut) {
                const s = att.checkIn.seconds * 1000
                const e = att.checkOut.seconds * 1000
                const durationHours = (e - s) / (1000 * 60 * 60)
                
                usersMap[uid].totalHours += durationHours
                usersMap[uid].shifts += 1
            }
        })

        setStaffData(Object.values(usersMap))

      } catch (error) {
        console.error("Lỗi tính lương:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate])

  // --- THỐNG KÊ ---
  const stats = useMemo(() => {
      const totalStaff = staffData.length
      const totalHours = staffData.reduce((sum, s) => sum + s.totalHours, 0)
      const totalCost = staffData.reduce((sum, s) => sum + (s.totalHours * s.hourlyRate), 0)
      return { totalStaff, totalHours, totalCost }
  }, [staffData])

  const displayList = staffData.filter(s => 
      s.name.toLowerCase().includes(filter.toLowerCase()) || 
      s.email?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fadeIn pb-10 h-full flex flex-col">
      
      {/* --- HEADER --- */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
         <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                 <Wallet size={28} />
             </div>
             <div>
                 <h1 className="text-xl font-bold text-slate-800">Bảng Lương </h1>
                 <p className="text-sm text-slate-500 font-medium">Tổng chi dự kiến: <span className="text-blue-700 font-bold">{fmtMoney(stats.totalCost)}</span></p>
             </div>
         </div>

         {/* Date Filter */}
         <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full md:w-auto">
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

      {/* --- DASHBOARD MINI --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Nhân sự</p>
                  <h3 className="text-2xl font-bold text-slate-700">{stats.totalStaff}</h3>
              </div>
              <div className="p-3 bg-slate-100 text-slate-500 rounded-full"><Users size={24}/></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Tổng giờ công</p>
                  <h3 className="text-2xl font-bold text-emerald-700">{stats.totalHours.toFixed(1)} <span className="text-sm font-normal text-slate-400">giờ</span></h3>
              </div>
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><Clock size={24}/></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Lương ước tính</p>
                  <h3 className="text-2xl font-bold text-blue-700">{fmtMoney(stats.totalCost)}</h3>
              </div>
              <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><DollarSign size={24}/></div>
          </div>
      </div>

      {/* --- TABLE --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-3 bg-slate-50/50 items-center">
              <Search className="text-slate-400 shrink-0"/>
              <input 
                placeholder="Tìm nhân viên..." 
                value={filter} 
                onChange={e=>setFilter(e.target.value)} 
                className="outline-none flex-1 bg-transparent font-medium text-base h-10"
              />
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left text-sm min-w-[800px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="p-4">Nhân viên</th>
                          <th className="p-4">Vai trò</th>
                          <th className="p-4 text-center">Số ca làm</th>
                          <th className="p-4 text-center">Tổng giờ</th>
                          <th className="p-4 text-right">Lương/Giờ</th>
                          <th className="p-4 text-right">Thành tiền</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {loading ? (
                          <tr><td colSpan="6" className="p-10 text-center text-slate-400">Đang tính toán dữ liệu...</td></tr>
                      ) : displayList.length === 0 ? (
                          <tr><td colSpan="6" className="p-10 text-center text-slate-400">Không tìm thấy nhân viên nào.</td></tr>
                      ) : (
                          displayList.map(s => {
                              const salary = s.totalHours * s.hourlyRate
                              return (
                                  <tr key={s.id} className="hover:bg-slate-50 transition">
                                      <td className="p-4">
                                          <div className="font-bold text-slate-800 text-base">{s.name}</div>
                                          <div className="text-xs text-slate-400">{s.email}</div>
                                      </td>
                                      <td className="p-4">
                                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                                              s.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' :
                                              s.role === 'KITCHEN' ? 'bg-orange-100 text-orange-700' :
                                              'bg-blue-100 text-blue-700'
                                          }`}>
                                              {s.role}
                                          </span>
                                      </td>
                                      <td className="p-4 text-center font-medium text-slate-600">
                                          {s.shifts} ca
                                      </td>
                                      <td className="p-4 text-center">
                                          <span className="font-bold text-emerald-700 text-lg">{s.totalHours.toFixed(1)}</span>
                                      </td>
                                      <td className="p-4 text-right font-mono text-slate-500">
                                          {fmtMoney(s.hourlyRate)}
                                      </td>
                                      <td className="p-4 text-right">
                                          <span className="font-bold text-blue-700 text-lg">{fmtMoney(salary)}</span>
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
  )
}