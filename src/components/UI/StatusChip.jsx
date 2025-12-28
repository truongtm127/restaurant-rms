import React from 'react'

export default function StatusChip({ status }) {
  if (status === 'BUSY') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700">Có khách</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">Trống</span>
}