// src/features/Reports/Reports.jsx
import React from 'react'
import { BarChart3 } from 'lucide-react'
import RevenueReport from './RevenueReport'

export default function Reports() {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-emerald-600" /> Báo cáo tổng hợp
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi doanh thu, tài chính và hiệu quả món ăn trong cùng một giao diện
          </p>
        </div>
      </div>

      {/* Nội dung báo cáo chính */}
      <div className="min-h-[600px]">
        <RevenueReport />
      </div>
    </div>
  )
}