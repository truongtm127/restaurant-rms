import React, { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { fmtVND } from '../../utils/helpers'
import { Calendar, DollarSign, Calculator } from 'lucide-react'

export default function Payroll() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [payrollData, setPayrollData] = useState([])
  const [loading, setLoading] = useState(false)

  // Hàm tính giờ làm giữa 2 mốc thời gian
  const getHours = (start, end) => {
    if (!start || !end) return 0
    const s = start.seconds ? start.seconds * 1000 : start
    const e = end.seconds ? end.seconds * 1000 : end
    return (e - s) / (1000 * 60 * 60)
  }

  const fetchPayroll = async () => {
    setLoading(true)
    try {
      // 1. Lấy danh sách nhân viên (để lấy hourlyRate)
      const usersSnap = await getDocs(collection(db, 'users'))
      const users = {}
      usersSnap.forEach(doc => {
          const d = doc.data()
          users[doc.id] = { name: d.name, role: d.role, rate: d.hourlyRate || 0 }
      })

      // 2. Lấy dữ liệu chấm công trong tháng đã chọn
      // Lưu ý: date trong attendance lưu dạng YYYY-MM-DD
      const startStr = `${month}-01`
      const endStr = `${month}-31`
      
      const q = query(
          collection(db, 'attendance'),
          where('date', '>=', startStr),
          where('date', '<=', endStr),
          where('status', '==', 'COMPLETED') // Chỉ tính các ca đã Check-out
      )
      
      const attendSnap = await getDocs(q)
      
      // 3. Tổng hợp dữ liệu
      const report = {} // userId -> { totalHours, shifts }

      attendSnap.forEach(doc => {
          const d = doc.data()
          if (!report[d.userId]) report[d.userId] = { totalHours: 0, shifts: 0 }
          
          const hours = getHours(d.checkIn, d.checkOut)
          report[d.userId].totalHours += hours
          report[d.userId].shifts += 1
      })

      // 4. Map ra mảng kết quả cuối cùng
      const result = Object.keys(report).map(uid => {
          const uInfo = users[uid] || { name: 'Unknown', role: '?', rate: 0 }
          const hours = report[uid].totalHours
          return {
              uid,
              name: uInfo.name,
              role: uInfo.role,
              rate: uInfo.rate,
              shifts: report[uid].shifts,
              hours: hours,
              salary: Math.round(hours * uInfo.rate)
          }
      })

      setPayrollData(result)

    } catch (error) { console.error(error) }
    setLoading(false)
  }

  useEffect(() => { fetchPayroll() }, [month])

  const totalPayout = payrollData.reduce((acc, curr) => acc + curr.salary, 0)

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Calculator className="text-emerald-600"/> Bảng tính lương</h1>
           <p className="text-slate-500">Tổng hợp giờ làm và thu nhập nhân viên</p>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-500">Tháng:</span>
            <input 
                type="month" 
                value={month} 
                onChange={e => setMonth(e.target.value)} 
                className="p-2 border border-slate-300 rounded-lg font-bold text-slate-700"
            />
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-emerald-600 text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
          <div>
              <p className="text-emerald-100 font-medium mb-1">Tổng quỹ lương ước tính ({month})</p>
              <h2 className="text-4xl font-bold">{fmtVND(totalPayout)}</h2>
          </div>
          <div className="p-4 bg-white/20 rounded-xl">
              <DollarSign size={32} />
          </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                        <th className="p-4 font-bold">Nhân viên</th>
                        <th className="p-4 font-bold text-center">Số ca</th>
                        <th className="p-4 font-bold text-center">Tổng giờ</th>
                        <th className="p-4 font-bold text-right">Lương/Giờ</th>
                        <th className="p-4 font-bold text-right text-emerald-600">Tổng Lương</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {loading ? (
                        <tr><td colSpan="5" className="p-8 text-center text-slate-400">Đang tính toán...</td></tr>
                    ) : payrollData.length === 0 ? (
                        <tr><td colSpan="5" className="p-8 text-center text-slate-400">Không có dữ liệu chấm công tháng này.</td></tr>
                    ) : (
                        payrollData.map(item => (
                            <tr key={item.uid} className="hover:bg-slate-50 transition">
                                <td className="p-4">
                                    <div className="font-bold text-slate-700">{item.name}</div>
                                    <div className="text-xs text-slate-400 uppercase">{item.role}</div>
                                </td>
                                <td className="p-4 text-center font-medium">{item.shifts}</td>
                                <td className="p-4 text-center font-bold text-slate-700">{item.hours.toFixed(1)}h</td>
                                <td className="p-4 text-right text-slate-500">{fmtVND(item.rate)}</td>
                                <td className="p-4 text-right font-bold text-emerald-600 text-lg">{fmtVND(item.salary)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  )
}