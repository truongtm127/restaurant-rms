import React, { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { DollarSign, Calendar, Users, Clock, Search, ArrowRight, Wallet } from 'lucide-react'
import { db } from '../../firebase'
import { fmtVND, formatDateInput, startOfMonth } from '../../utils/helpers'

// --- SUB-COMPONENT ---
const StatCard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
    <div>
      <p className="text-xs text-slate-500 font-bold uppercase">{label}</p>
      <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
      {sub && <p className="text-xs text-slate-400 font-normal">{sub}</p>}
    </div>
    <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('700', '100')} ${color.replace('text-', 'text-').replace('700', '600')}`}>
      <Icon size={24} />
    </div>
  </div>
)

// --- MAIN COMPONENT ---
export default function Payroll() {
  const [loading, setLoading] = useState(true)
  const [staffData, setStaffData] = useState([])
  const [filter, setFilter] = useState('')
  
  // Date Filter State
  const [dateRange, setDateRange] = useState({
    start: formatDateInput(startOfMonth(new Date())),
    end: formatDateInput(new Date())
  })

  // Fetch & Calculate Payroll Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // 1. Fetch Users
        const usersSnap = await getDocs(collection(db, 'users'))
        const usersMap = {}
        
        usersSnap.forEach(doc => {
          const data = doc.data()
          usersMap[doc.id] = {
            id: doc.id,
            name: data.name || 'Unknown',
            email: data.email,
            role: data.role,
            hourlyRate: Number(data.hourlyRate) || 25000, 
            totalHours: 0,
            shifts: 0
          }
        })

        // 2. Fetch Attendance within Date Range
        const start = new Date(dateRange.start)
        start.setHours(0, 0, 0, 0)
        
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)

        const q = query(
            collection(db, 'attendance'),
            where('checkIn', '>=', start),
            where('checkIn', '<=', end),
            orderBy('checkIn', 'desc')
        )

        const attendanceSnap = await getDocs(q)

        // 3. Aggregate Hours
        attendanceSnap.forEach(doc => {
            const att = doc.data()
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
        console.error("Payroll Error:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dateRange])

  // Calculations
  const { stats, displayList } = useMemo(() => {
      // Stats (based on all data)
      const totalStaff = staffData.length
      const totalHours = staffData.reduce((sum, s) => sum + s.totalHours, 0)
      const totalCost = staffData.reduce((sum, s) => sum + (s.totalHours * s.hourlyRate), 0)

      // Filtered List
      const list = staffData.filter(s => 
        s.name.toLowerCase().includes(filter.toLowerCase()) || 
        s.email?.toLowerCase().includes(filter.toLowerCase())
      )

      return { 
        stats: { totalStaff, totalHours, totalCost },
        displayList: list
      }
  }, [staffData, filter])

  return (
    <div className="space-y-6 animate-fadeIn pb-10 h-full flex flex-col">
      
      {/* HEADER */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
         <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                 <Wallet size={28} />
             </div>
             <div>
                 <h1 className="text-xl font-bold text-slate-800">Bảng Lương</h1>
                 <p className="text-sm text-slate-500 font-medium">
                    Tổng chi dự kiến: <span className="text-blue-700 font-bold">{fmtVND(stats.totalCost)}</span>
                 </p>
             </div>
         </div>

         {/* Date Filters */}
         <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 w-full md:w-auto">
             <Calendar size={20} className="text-slate-400 ml-2"/>
             <div className="flex flex-col">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">Từ ngày</label>
                 <input 
                    type="date" 
                    value={dateRange.start} 
                    onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} 
                    className="font-bold text-slate-700 bg-transparent outline-none cursor-pointer text-sm"
                 />
             </div>
             <ArrowRight size={16} className="text-slate-300"/>
             <div className="flex flex-col">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">Đến ngày</label>
                 <input 
                    type="date" 
                    value={dateRange.end} 
                    onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} 
                    className="font-bold text-slate-700 bg-transparent outline-none cursor-pointer text-sm"
                 />
             </div>
         </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <StatCard 
            label="Nhân sự" 
            value={stats.totalStaff} 
            icon={Users} 
            color="text-slate-700" 
          />
          <StatCard 
            label="Tổng giờ công" 
            value={stats.totalHours.toFixed(1)} 
            sub="giờ" 
            icon={Clock} 
            color="text-emerald-700" 
          />
          <StatCard 
            label="Lương ước tính" 
            value={fmtVND(stats.totalCost)} 
            icon={DollarSign} 
            color="text-blue-700" 
          />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-3 bg-slate-50/50 items-center">
              <Search className="text-slate-400 shrink-0"/>
              <input 
                placeholder="Tìm nhân viên..." 
                value={filter} 
                onChange={e => setFilter(e.target.value)} 
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
                                          {fmtVND(s.hourlyRate)}
                                      </td>
                                      <td className="p-4 text-right">
                                          <span className="font-bold text-blue-700 text-lg">{fmtVND(salary)}</span>
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