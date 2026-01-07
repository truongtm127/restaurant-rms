import React, { useEffect, useState } from 'react'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { X, Plus, Trash2, Save } from 'lucide-react'

// Thêm prop onSuccess
export default function RecipeModal({ menuItem, onClose, onSuccess }) {
  const [inventory, setInventory] = useState([])
  
  // KHỞI TẠO QUAN TRỌNG: Kiểm tra kỹ recipe có tồn tại không
  const [recipe, setRecipe] = useState(menuItem.recipe || []) 
  
  const [selectedIng, setSelectedIng] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    const fetchInv = async () => {
        const snap = await getDocs(collection(db, 'inventory'))
        setInventory(snap.docs.map(d => ({id: d.id, ...d.data()})))
    }
    fetchInv()
  }, [])

  const handleAddIngredient = () => {
    if(!selectedIng || !amount) return
    const ingData = inventory.find(i => i.id === selectedIng)
    
    const newItem = {
        ingredientId: ingData.id,
        name: ingData.name,
        unit: ingData.unit,
        quantity: Number(amount)
    }
    setRecipe([...recipe, newItem])
    setSelectedIng(''); setAmount('')
  }

  const handleRemove = (index) => {
    const newR = [...recipe]
    newR.splice(index, 1)
    setRecipe(newR)
  }

  const handleSaveRecipe = async () => {
    try {
        // --- SỬA LỖI Ở ĐÂY ---
        // 1. Đảm bảo dùng đúng collection 'menu_items'
        // 2. Kiểm tra ID có tồn tại không
        if (!menuItem.id) {
            alert("Lỗi: Không tìm thấy ID món ăn")
            return
        }

        await updateDoc(doc(db, 'menu_items', menuItem.id), {
            recipe: recipe
        })

        alert("Đã lưu công thức thành công!")
        
        // 3. Gọi hàm refresh dữ liệu bên ngoài trước khi đóng
        if (onSuccess) onSuccess()
        
        onClose()
    } catch (e) { 
        console.error("Lỗi lưu:", e)
        alert("Lỗi lưu công thức: " + e.message) 
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
         <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
            <h3 className="font-bold text-lg">Công thức: {menuItem.name}</h3>
            <button onClick={onClose}><X size={20}/></button>
         </div>
         
         <div className="p-6 space-y-4 overflow-y-auto">
            {/* Form thêm */}
            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500">Nguyên liệu kho</label>
                    <select value={selectedIng} onChange={e=>setSelectedIng(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                        <option value="">-- Chọn --</option>
                        {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                    </select>
                </div>
                <div className="w-24">
                    <label className="text-xs font-bold text-slate-500">Định lượng</label>
                    <input type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full p-2 border rounded-lg"/>
                </div>
                <button onClick={handleAddIngredient} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"><Plus size={20}/></button>
            </div>

            {/* Danh sách định lượng */}
            <div className="bg-slate-50 rounded-lg p-3 min-h-[100px]">
                {recipe.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Chưa có thành phần nào.</p>}
                {recipe.map((r, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-200 last:border-0">
                        <span className="font-bold text-slate-700">{r.name}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-emerald-600 font-mono font-bold">{r.quantity} {r.unit}</span>
                            <button onClick={()=>handleRemove(idx)} className="text-rose-500 hover:text-rose-700"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
         </div>

         <div className="p-4 border-t shrink-0">
            <button onClick={handleSaveRecipe} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2">
                <Save size={18}/> Lưu Công Thức
            </button>
         </div>
      </div>
    </div>
  )
}