import React from 'react'

export default function StatusChip({ status }) {
  const cls = status === 'FREE'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'BUSY'
      ? 'bg-rose-100 text-rose-700'
      : 'bg-amber-100 text-amber-700'
      
  return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{status}</span>
}