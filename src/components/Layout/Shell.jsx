import React, { useEffect, useState } from 'react'
import { 
  LayoutDashboard, 
  Menu, 
  Users, 
  BarChart3, 
  LogOut, 
  ChefHat, 
  Ticket, 
  Clock, 
  Calculator, 
  Layers,
  Package,
  Bell, // <--- [MỚI] Icon Chuông
  X     // <--- [MỚI] Icon Đóng
} from 'lucide-react'
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'

export default function Shell({ user, route, setRoute, onLogout, children }) {
  
  // --- STATE MENU ---
  const navItems = [
    { id: 'dashboard', label: 'Tổng quan',    icon: LayoutDashboard, roles: ['MANAGER', 'STAFF', 'KITCHEN'] },
    { id: 'attendance',label: 'Chấm công',    icon: Clock,           roles: ['MANAGER', 'STAFF', 'KITCHEN'] },
    { id: 'order',     label: 'Sơ đồ bàn',    icon: Layers,          roles: ['MANAGER', 'STAFF'] },
    { id: 'menu',      label: 'Thực đơn',     icon: Menu,            roles: ['MANAGER', 'STAFF'] },
    { id: 'kitchen',   label: 'Bếp & Bar',    icon: ChefHat,         roles: ['MANAGER', 'KITCHEN'] },
    { id: 'inventory', label: 'Kho hàng',     icon: Package,         roles: ['MANAGER', 'KITCHEN'] },
    { id: 'staff',     label: 'Nhân viên',    icon: Users,           roles: ['MANAGER'] },
    { id: 'payroll',   label: 'Bảng lương',   icon: Calculator,      roles: ['MANAGER'] },
    { id: 'coupons',   label: 'Khuyến mãi',   icon: Ticket,          roles: ['MANAGER'] },
    { id: 'reports',   label: 'Báo cáo',      icon: BarChart3,       roles: ['MANAGER'] },
  ]

  const visibleItems = navItems.filter(item => item.roles.includes(user.role))

  // --- [MỚI] LOGIC THÔNG BÁO ---
  const [notifs, setNotifs] = useState([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  
  // Chỉ Manager mới cần nhận thông báo kho
  const isManager = user?.role === 'MANAGER'

  useEffect(() => {
    if (!isManager) return

    // Lắng nghe thông báo chưa đọc (isRead == false)
    const q = query(
        collection(db, 'notifications'), 
        where('isRead', '==', false),
        orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
       const list = []
       snap.forEach(d => list.push({ id: d.id, ...d.data() }))
       setNotifs(list)
    }, (err) => console.log("Lỗi tải thông báo:", err))

    return () => unsub()
  }, [isManager])

  // Hàm đánh dấu đã đọc
  const markAsRead = async (id) => {
      try {
          await updateDoc(doc(db, 'notifications', id), { isRead: true })
      } catch (e) { console.error(e) }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* SIDEBAR */}
      <aside className="bg-white border-r border-slate-200 md:w-64 flex-shrink-0 flex flex-col sticky top-0 h-auto md:h-screen z-50">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold text-slate-800 truncate">{user.name}</h2>
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
              {user.role === 'KITCHEN' ? 'BẾP' : (user.role === 'MANAGER' ? 'QUẢN LÝ' : 'PHỤC VỤ')}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
          {visibleItems.map(item => {
            const Icon = item.icon
            const isActive = route === item.id
            return (
              <button
                key={item.id}
                onClick={() => setRoute(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm border-l-4 border-emerald-500' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent'
                  }`}
              >
                <Icon size={18} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors">
            <LogOut size={18} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto h-screen p-4 md:p-6 scroll-smooth bg-slate-50 relative">
        
        {/* --- [MỚI] KHU VỰC CHUÔNG THÔNG BÁO (GÓC PHẢI TRÊN) --- */}
        {isManager && (
            <div className="absolute top-5 right-6 z-[60]">
                {/* Nút Chuông */}
                <button 
                    onClick={() => setShowNotifPanel(!showNotifPanel)}
                    className="relative p-2.5 bg-white rounded-full shadow-md hover:bg-slate-50 text-slate-600 transition border border-slate-100"
                >
                    <Bell size={22} />
                    {notifs.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce shadow-sm border border-white">
                            {notifs.length}
                        </span>
                    )}
                </button>

                {/* Dropdown Panel */}
                {showNotifPanel && (
                    <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn origin-top-right">
                        <div className="p-3 border-b bg-slate-50 font-bold flex justify-between items-center text-sm text-slate-700">
                            <span className="flex items-center gap-2">🔔 Thông báo mới ({notifs.length})</span>
                            <button onClick={()=>setShowNotifPanel(false)} className="hover:bg-slate-200 rounded p-1"><X size={16}/></button>
                        </div>
                        
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {notifs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                                    <Bell size={32} className="opacity-20"/>
                                    <span>Hệ thống bình thường.<br/>Không có cảnh báo mới.</span>
                                </div>
                            ) : (
                                notifs.map(n => (
                                    <div 
                                        key={n.id} 
                                        onClick={() => markAsRead(n.id)}
                                        className="p-4 border-b last:border-0 hover:bg-red-50 cursor-pointer transition-colors group relative"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full uppercase tracking-wider">{n.type === 'low_stock' ? 'Kho hàng' : 'Hệ thống'}</span>
                                            <span className="text-[10px] text-slate-400">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : 'Vừa xong'}</span>
                                        </div>
                                        <div className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-red-700 transition-colors">{n.title}</div>
                                        <div className="text-xs text-slate-600 leading-relaxed">{n.message}</div>
                                        
                                        {/* Dot chưa đọc */}
                                        <div className="absolute top-4 right-2 w-2 h-2 bg-red-500 rounded-full shadow-sm"></div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Content Children */}
        <div className="max-w-7xl mx-auto h-full flex flex-col pt-4 md:pt-0">
          {children}
        </div>
      </main>
    </div>
  )
}