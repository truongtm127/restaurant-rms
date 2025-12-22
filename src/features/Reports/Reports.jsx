import React, { useState } from 'react'
import RevenueReport from './RevenueReport'
import MenuReport from './MenuReport'

export default function Reports() {
  const [tab, setTab] = useState('revenue') 
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={()=>setTab('revenue')}
          className={`px-3 py-1.5 rounded-lg border ${tab==='revenue'?'bg-emerald-600 text-white border-emerald-600':'bg-white'}`}>
          Báo cáo doanh thu
        </button>
        <button onClick={()=>setTab('menu')}
          className={`px-3 py-1.5 rounded-lg border ${tab==='menu'?'bg-emerald-600 text-white border-emerald-600':'bg-white'}`}>
          Báo cáo món ăn
        </button>
      </div>
      {tab==='revenue' ? <RevenueReport/> : <MenuReport/>}
    </div>
  )
}