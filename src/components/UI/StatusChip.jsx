import React from 'react'

const STATUS_CONFIG = {
  BUSY: {
    label: 'Có khách',
    className: 'bg-rose-100 text-rose-700'
  },
  // Mặc định cho các trường hợp còn lại
  DEFAULT: {
    label: 'Trống',
    className: 'bg-slate-100 text-slate-600'
  }
}

export default function StatusChip({ status }) {
  // Lấy config dựa trên status, nếu không có thì dùng DEFAULT
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DEFAULT

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${config.className}`}>
      {config.label}
    </span>
  )
}