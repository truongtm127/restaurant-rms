import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { X, Plus, Save, Trash2, ChefHat, AlertTriangle } from 'lucide-react'

export default function RecipeModal({ menuItem, onClose, onSuccess, showToast }) {
  const [inventory, setInventory] = useState([])
  const [rows, setRows] = useState(menuItem.recipe || [])
  const [loading, setLoading] = useState(true)

  // Load Inventory Data
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventory'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Sort theo tên để dễ tìm
      list.sort((a, b) => a.name.localeCompare(b.name))
      setInventory(list)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // --- HANDLERS ---

  const addRow = () => {
    setRows(prev => [...prev, { ingredientId: '', quantity: 1 }])
  }

  const removeRow = (index) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  const updateRow = (index, field, value) => {
    setRows(prev => prev.map((row, i) => 
      i === index ? { ...row, [field]: value } : row
    ))
  }

  const handleSave = async () => {
    // Validate: Phải chọn nguyên liệu và số lượng > 0
    const isValid = rows.every(r => r.ingredientId && Number(r.quantity) > 0)
    
    if (!isValid) {
        showToast("⚠️ Vui lòng chọn nguyên liệu và nhập số lượng hợp lệ", "error")
        return
    }

    try {
        await updateDoc(doc(db, 'menu_items', menuItem.id), {
            recipe: rows
        })
        showToast(`✅ Đã lưu công thức cho món: ${menuItem.name}`, "success")
        onSuccess && onSuccess()
        onClose()
    } catch (error) {
        console.error(error)
        showToast("Lỗi khi lưu công thức!", "error")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="p-4 border-b bg-emerald-50 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2">
                <ChefHat size={20}/> Công thức: {menuItem.name}
            </h3>
            <button onClick={onClose} className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition">
                <X size={20}/>
            </button>
        </div>

        {/* BODY */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
            {loading ? (
                <p className="text-center py-4 text-slate-500">Đang tải danh sách kho...</p>
            ) : (
                <div className="space-y-3">
                    {rows.length === 0 && (
                        <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                            <AlertTriangle className="mx-auto mb-2 opacity-50"/>
                            <p className="text-sm font-medium">Chưa có nguyên liệu nào.</p>
                            <p className="text-xs mt-1">Bấm "Thêm dòng" để bắt đầu định lượng.</p>
                        </div>
                    )}

                    {rows.map((row, idx) => {
                        const selectedInv = inventory.find(i => i.id === row.ingredientId)
                        const unit = selectedInv ? selectedInv.unit : ''

                        return (
                            <div key={idx} className="flex gap-2 items-center animate-fadeIn">
                                <span className="text-xs font-bold text-slate-400 w-5 text-right pt-2">{idx + 1}.</span>
                                
                                {/* Select Ingredient */}
                                <div className="flex-1">
                                    <select 
                                        className="w-full p-2 border rounded-lg text-sm bg-white focus:border-emerald-500 outline-none"
                                        value={row.ingredientId}
                                        onChange={e => updateRow(idx, 'ingredientId', e.target.value)}
                                    >
                                        <option value="">-- Chọn nguyên liệu --</option>
                                        {inventory.map(inv => (
                                            <option key={inv.id} value={inv.id}>
                                                {inv.name} (Tồn: {inv.quantity} {inv.unit})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Input Quantity */}
                                <div className="relative w-24">
                                    <input 
                                        type="number" 
                                        min="0" step="any"
                                        className="w-full p-2 border rounded-lg text-sm text-center font-bold outline-none focus:border-emerald-500"
                                        value={row.quantity}
                                        onChange={e => updateRow(idx, 'quantity', e.target.value)}
                                        placeholder="SL"
                                    />
                                    {unit && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-white pointer-events-none">
                                            {unit}
                                        </span>
                                    )}
                                </div>

                                {/* Delete Button */}
                                <button 
                                    onClick={() => removeRow(idx)} 
                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                    title="Xóa dòng"
                                >
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t bg-slate-50 flex justify-between gap-3 shrink-0">
            <button 
                onClick={addRow} 
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-100 flex items-center gap-2 shadow-sm transition"
            >
                <Plus size={16}/> Thêm dòng
            </button>
            
            <div className="flex gap-2">
                <button 
                    onClick={onClose} 
                    className="px-4 py-2 text-slate-500 font-bold text-sm hover:text-slate-700 hover:underline transition"
                >
                    Hủy
                </button>
                <button 
                    onClick={handleSave} 
                    className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2 shadow-md transition-transform active:scale-95"
                >
                    <Save size={16}/> Lưu công thức
                </button>
            </div>
        </div>

      </div>
    </div>
  )
}