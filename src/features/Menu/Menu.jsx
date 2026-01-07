import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, CheckCircle, ArrowLeft, FilePenLine, X, CreditCard, List } from 'lucide-react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  getDocs,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  query,
  getDoc,
  where
} from 'firebase/firestore';
import { db } from '../../firebase';
import ItemCard from './ItemCard';
import MenuItemModal from './MenuItemModal';
import InvoiceModal from '../Order/InvoiceModal';
import ConfirmModal from '../../components/UI/ConfirmModal';
import RecipeModal from './RecipeModal';

const PAGE_SIZE = 100;

export default function Menu({
  user,
  activeTable,
  activeOrderId,
  setActiveTable,
  setActiveOrderId,
  setRoute,
}) {
  // --- State dữ liệu ---
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);
  const isManager = user?.role === 'MANAGER';

  // --- UI Filter/Search ---
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [sortBy, setSortBy] = useState('popular');

  // --- Order State ---
  const [orderItems, setOrderItems] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderNote, setOrderNote] = useState('');

  const [showInvoice, setShowInvoice] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [recipeEditing, setRecipeEditing] = useState(null);

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });
  const openConfirm = (title, message, action) => setConfirmConfig({ isOpen: true, title, message, action });

  // --- 1. DATA FETCHING ---
  async function loadPage(reset = false) {
    setLoading(true);
    try {
      const base = [orderBy('created_at', 'desc'), limit(PAGE_SIZE)];
      const qRef = reset || !cursor
          ? query(collection(db, 'menu_items'), ...base)
          : query(collection(db, 'menu_items'), ...base, startAfter(cursor));

      const snap = await getDocs(qRef);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCursor(snap.docs[snap.docs.length - 1] || null);
      setItems((prev) => (reset ? arr : [...prev, ...arr]));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  useEffect(() => { loadPage(true); }, []);

  // --- 2. LẮNG NGHE KHO (INVENTORY) ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventory'), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setInventory(list);
    });
    return () => unsub();
  }, []);

  // --- 3. LẮNG NGHE GIỎ HÀNG ---
  useEffect(() => {
    if (!activeOrderId) { 
      setOrderItems([]); setOrderNote(''); return; 
    }
    setOrderLoading(true);
    const unsub = onSnapshot(collection(db, 'orders', activeOrderId, 'items'), (snap) => {
        const list = []; 
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setOrderItems(list);
        setOrderLoading(false);
    });
    getDoc(doc(db, 'orders', activeOrderId)).then((snap) => { 
        if (snap.exists()) setOrderNote(snap.data().note || ''); 
    });
    return () => unsub();
  }, [activeOrderId]);

  const cartTotal = orderItems.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);
  const hasItems = orderItems.length > 0;

  // --- LOGIC GỬI BẾP ---
  const handleBackToOrder = async () => {
    if (activeOrderId) {
      if (hasItems) {
        try {
          const orderRef = doc(db, 'orders', activeOrderId);
          const orderSnap = await getDoc(orderRef);
          let finalItems = [];

          if (orderSnap.exists()) {
             const currentServerItems = orderSnap.data().items || [];
             finalItems = orderItems.map(cartItem => {
               const existingItem = currentServerItems.find(x => x.id === cartItem.id);
               if (existingItem) {
                 return { ...existingItem, qty: cartItem.qty, note: cartItem.note || '', qtyCompleted: existingItem.qtyCompleted || 0 };
               } else {
                 return { ...cartItem, qtyCompleted: 0 };
               }
             });
          } else {
             finalItems = orderItems.map(i => ({ ...i, qtyCompleted: 0 }));
          }

          await updateDoc(orderRef, {
            status: 'pending', items: finalItems, total: cartTotal, note: orderNote, updatedAt: serverTimestamp()
          });
        } catch (error) { console.error("Lỗi gửi bếp:", error); return; }
      } else {
        try {
            await deleteDoc(doc(db, 'orders', activeOrderId));
            await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' });
        } catch (e) { console.error("Lỗi dọn dẹp", e); }
      }
    }
    setActiveTable(null); setActiveOrderId(null); setRoute('order');
  };

  const openAdd = () => { setEditing(null); setShowModal(true); };
  const openEdit = (m) => { setEditing(m); setShowModal(true); };
  const openRecipe = (m) => { setRecipeEditing(m); };
  const closeModal = () => { setShowModal(false); setEditing(null); };
  
  const handleCreate = async (d) => { await addDoc(collection(db, 'menu_items'), { ...d, is_available: true, created_at: serverTimestamp() }); await loadPage(true); };
  const handleUpdate = async (id, d) => { await updateDoc(doc(db, 'menu_items', id), d); await loadPage(true); };
  const handleDelete = (m) => { openConfirm('Xóa', `Xóa "${m.name}"?`, async () => { await deleteDoc(doc(db, 'menu_items', m.id)); await loadPage(true); }); };

  // =======================================================================
  // HÀM KIỂM TRA TỒN KHO (ĐÃ SỬA LỖI TRỪ LẶP)
  // =======================================================================
  const validateStock = async (menuItem, addQuantity = 1) => {
    if (!menuItem.recipe || menuItem.recipe.length === 0) return true; 
    if (inventory.length === 0) return true;

    // 1. Chỉ lấy các đơn ĐANG NẤU (pending/cooking). 
    // KHÔNG lấy đơn 'served' vì 'served' đã bị trừ kho thật rồi -> Tránh trừ 2 lần.
    const q = query(collection(db, 'orders'), where('status', 'in', ['pending', 'cooking']));
    const ordersSnap = await getDocs(q);
    
    // 2. Quét Sub-collection items
    const fetchPromises = ordersSnap.docs.map(doc => 
        getDocs(collection(db, 'orders', doc.id, 'items'))
    );
    const allItemsSnaps = await Promise.all(fetchPromises);

    // 3. Tổng hợp usage
    const usageMap = {}; 

    // A. Cộng dồn từ các đơn Bếp đang làm (Pending/Cooking)
    allItemsSnaps.forEach(snap => {
        snap.forEach(docItem => {
            const itemData = docItem.data();
            let itemRecipe = itemData.recipe;
            if (!itemRecipe && itemData.menuItemId === menuItem.id) {
                itemRecipe = menuItem.recipe;
            }

            if (itemRecipe && Array.isArray(itemRecipe)) {
                // Chỉ tính lượng chưa hoàn thành (đang nấu)
                // Tuy nhiên ở Menu, ta cứ tính full lượng pending/cooking cho an toàn
                const qtyOccupied = Number(itemData.qty || 0); 
                
                itemRecipe.forEach(ing => {
                    if (ing.ingredientId) {
                        const needed = (Number(ing.quantity) || 0) * qtyOccupied;
                        usageMap[ing.ingredientId] = (usageMap[ing.ingredientId] || 0) + needed;
                    }
                });
            }
        });
    });

    // B. Cộng dồn từ Giỏ hàng hiện tại (Order Items Local)
    // Những món này chưa gửi bếp nhưng đang nằm trong giỏ, cũng phải giữ hàng
    orderItems.forEach(cartItem => {
        let itemRecipe = cartItem.recipe;
        if (!itemRecipe && cartItem.menuItemId === menuItem.id) itemRecipe = menuItem.recipe;

        if (itemRecipe && Array.isArray(itemRecipe)) {
            const qtyInCart = Number(cartItem.qty || 0);
            itemRecipe.forEach(ing => {
                if (ing.ingredientId) {
                    const needed = (Number(ing.quantity) || 0) * qtyInCart;
                    usageMap[ing.ingredientId] = (usageMap[ing.ingredientId] || 0) + needed;
                }
            });
        }
    });

    // 4. So sánh và Tìm lỗi
    const errors = [];
    menuItem.recipe.forEach(ing => {
        const invItem = inventory.find(i => i.id === ing.ingredientId);
        if (invItem) {
            const stockReal = Number(invItem.quantity) || 0; // Tồn kho vật lý (đã trừ served)
            const stockReserved = usageMap[ing.ingredientId] || 0; // Đang nấu/chờ nấu
            const stockAvailable = stockReal - stockReserved; // Còn lại thực sự
            
            const needingNow = (Number(ing.quantity) || 0) * addQuantity;

            // Debug Log để kiểm tra
            console.log(`${invItem.name}: Real=${stockReal} - Reserved=${stockReserved} = Avail ${stockAvailable}. Need ${needingNow}`);

            if (stockAvailable < needingNow) {
                errors.push(`${invItem.name} (Khả dụng: ${stockAvailable.toFixed(1)}, Cần: ${needingNow.toFixed(1)})`);
            }
        }
    });

    // 5. CHẶN VÀ THÔNG BÁO
    if (errors.length > 0) {
        const msg = `Không thể gọi món "${menuItem.name}" tại Bàn ${activeTable?.name || '???'} do hết: ${errors.join(', ')}`;
        
        try {
            await addDoc(collection(db, 'notifications'), {
                type: 'out_of_stock',
                title: '🚨 HẾT HÀNG (MENU)',
                message: msg,
                isRead: false,
                createdAt: serverTimestamp(),
                createdBy: user.name || 'Staff'
            });
        } catch (e) {}

        alert(`⛔ HẾT NGUYÊN LIỆU!\n\n${msg}`);
        return false;
    }
    return true;
  }

  // =======================================================================
  // LOGIC THÊM MÓN
  // =======================================================================
  const addToOrder = async (m) => {
    if (!activeTable || !activeOrderId) { alert('Vui lòng chọn bàn trước!'); return; }
    
    // --- [CHECK KHO] ---
    const canAdd = await validateStock(m, 1);
    if (!canAdd) return; 
    // -------------------

    const existingItem = orderItems.find(it => it.menuItemId === m.id);
    
    if (existingItem) {
        const nextQty = Number(existingItem.qty || 1) + 1;
        await updateDoc(doc(db, 'orders', activeOrderId, 'items', existingItem.id), { qty: nextQty });
    } else {
        await addDoc(collection(db, 'orders', activeOrderId, 'items'), {
          menuItemId: m.id, 
          name: m.name, 
          price: Number(m.price || 0), 
          qty: 1, 
          note: '',
          recipe: m.recipe || [] 
        });
    }
    
    try { 
        if (activeTable.status === 'FREE') await updateDoc(doc(db, 'tables', activeTable.id), { status: 'BUSY' }); 
    } catch (e) {}
  };

  const removeItem = (item) => {
    if (!activeOrderId) return;
    const isLastItem = orderItems.length <= 1;
    if (isLastItem) {
        openConfirm("Hủy đơn", "Đây là món cuối cùng. Hủy đơn và trả bàn?", async () => {
            await deleteDoc(doc(db, 'orders', activeOrderId, 'items', item.id)); 
            await deleteDoc(doc(db, 'orders', activeOrderId));                
            await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' }); 
            setActiveTable(null); setActiveOrderId(null); setRoute('order');
        });
    } else {
        openConfirm("Xóa món", `Xóa "${item.name}" khỏi giỏ?`, async () => { 
            await deleteDoc(doc(db, 'orders', activeOrderId, 'items', item.id)); 
        });
    }
  };

  const categories = useMemo(() => ['Tất cả', ...new Set(items.map((x) => x.category || 'Khác'))], [items]);
  const filtered = useMemo(() => {
    let list = items;
    if (category !== 'Tất cả') list = list.filter((x) => (x.category || 'Khác') === category);
    if (q.trim()) list = list.filter((x) => x.name?.toLowerCase().includes(q.trim().toLowerCase()));
    return list.sort((a, b) => (b.is_available ? 1 : 0) - (a.is_available ? 1 : 0) || (a.name || '').localeCompare(b.name || ''));
  }, [items, q, category, sortBy]);

  const Chip = ({ active, children, onClick }) => ( <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-slate-50 border-gray-200 text-gray-700'}`}>{children}</button> );
  const SkeletonCard = () => ( <div className="rounded-xl bg-slate-100 animate-pulse aspect-[3/4]" /> );

  return (
    <div className="space-y-4 h-full flex flex-col">
      <ConfirmModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig((p) => ({ ...p, isOpen: false }))} onConfirm={confirmConfig.action} title={confirmConfig.title} message={confirmConfig.message} />

      {activeTable && ( 
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-3">
                <button onClick={handleBackToOrder} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition" title="Quay lại">
                    <ArrowLeft size={20} />
                </button>
                <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">🍽️</div>
                <div>
                    <div className="text-xs text-slate-500 font-medium uppercase">Đang phục vụ</div>
                    <div className="text-sm font-bold text-slate-800">Bàn {activeTable.name || activeTable.id}</div>
                </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button 
                  onClick={() => hasItems && setShowInvoice(true)} 
                  disabled={!hasItems} 
                  className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition flex items-center justify-center gap-2
                    ${hasItems ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-100' : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'}`}
                >
                   <CreditCard size={18} /> Thanh toán ngay
                </button>
            </div>
         </div>
      )}

      {showInvoice && <InvoiceModal user={user} activeOrderId={activeOrderId} activeTable={activeTable} onClose={() => setShowInvoice(false)} onPaid={async () => { await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' }); if (activeOrderId) { await updateDoc(doc(db, 'orders', activeOrderId), { status: 'PAID', paidBy: user.name || user.email, paidAt: serverTimestamp() }); } setShowInvoice(false); setActiveOrderId(null); setActiveTable(null); setRoute('order'); }} />}

      {activeOrderId && ( 
         <div className="bg-white rounded-xl shadow-sm border p-3">
            <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-sm">Đơn hàng ({orderItems.length} món)</div>
                <div className="font-bold text-emerald-700">{(cartTotal/1000).toFixed(0)}k</div>
            </div>
            {hasItems && (
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {orderItems.map(it => (
                        <div key={it.id} className="flex-shrink-0 bg-slate-50 border rounded-lg p-2 text-xs w-32 relative group">
                            <div className="truncate font-medium" title={it.name}>{it.name}</div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-slate-500 font-bold">x{it.qty}</span>
                                <button onClick={()=>removeItem(it)} className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded hover:bg-rose-100"><X size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="relative">
                    <input value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Ghi chú cho bếp..." className="w-full text-xs pl-7 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"/>
                    <FilePenLine size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
            </div>
            <div className="flex justify-end pt-2 mt-2 border-t border-slate-50">
                <button onClick={handleBackToOrder} className="w-full px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition flex items-center justify-center gap-2">
                    <CheckCircle size={16} /> {hasItems ? "Gửi Bếp & Quay lại" : "Quay lại"}
                </button>
            </div>
         </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex-1 relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm món..." className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm bg-white focus:ring-1 focus:ring-emerald-500 outline-none"/>
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="flex gap-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border rounded-lg px-2 py-1.5 bg-white text-sm outline-none cursor-pointer">
            <option value="popular">Phổ biến</option>
            <option value="newest">Mới nhất</option>
            <option value="priceAsc">Giá tăng</option>
            <option value="priceDesc">Giá giảm</option>
          </select>
          {isManager && (
            <button onClick={openAdd} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 flex items-center gap-1 font-medium whitespace-nowrap shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">{categories.map((c) => (<Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>))}</div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 pb-4">
        {loading && items.length === 0 ? ( Array.from({ length: 16 }).map((_, i) => <SkeletonCard key={i} />) ) : filtered.length === 0 ? ( <div className="col-span-full text-center text-sm text-slate-500 py-10">Không tìm thấy món nào.</div> ) : (
          filtered.map((m) => (
            <ItemCard
              key={m.id}
              m={m}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAdd={addToOrder}
              onRecipe={openRecipe} 
              canAdd={!!activeOrderId}
              canManage={isManager}
            />
          ))
        )}
      </div>

      {showModal && <MenuItemModal initial={editing} onClose={closeModal} onCreate={handleCreate} onUpdate={handleUpdate} />}

      {recipeEditing && (
        <RecipeModal 
            menuItem={recipeEditing} 
            onClose={() => setRecipeEditing(null)} 
            onSuccess={() => loadPage(true)} 
        />
      )}
    </div>
  );
}