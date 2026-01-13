import React, { useState, useEffect, useMemo } from 'react'
import { 
  LayoutDashboard, Menu as MenuIcon, Users, BarChart3, LogOut, 
  ChefHat, Ticket, Clock, Calculator, Layers, Package, Bell, 
  X, PanelLeftClose, PanelLeftOpen 
} from 'lucide-react'
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan',    icon: LayoutDashboard, roles: ['MANAGER', 'STAFF', 'KITCHEN'], group: 'Chung' },
  { id: 'order',     label: 'Sơ đồ bàn',    icon: Layers,          roles: ['MANAGER', 'STAFF'],           group: 'Vận hành' },
  { id: 'menu',      label: 'Thực đơn',     icon: MenuIcon,        roles: ['MANAGER', 'STAFF'],           group: 'Vận hành' },
  { id: 'kitchen',   label: 'Bếp & Bar',    icon: ChefHat,         roles: ['MANAGER', 'KITCHEN'],         group: 'Vận hành' },
  { id: 'inventory', label: 'Kho hàng',     icon: Package,         roles: ['MANAGER'],                    group: 'Vận hành' },
  { id: 'staff',     label: 'Nhân sự',      icon: Users,           roles: ['MANAGER'],                    group: 'Quản trị' },
  { id: 'attendance',label: 'Chấm công',    icon: Clock,           roles: ['MANAGER', 'STAFF', 'KITCHEN'], group: 'Quản trị' },
  { id: 'payroll',   label: 'Bảng lương',   icon: Calculator,      roles: ['MANAGER'],                    group: 'Quản trị' },
  { id: 'coupons',   label: 'Khuyến mãi',   icon: Ticket,          roles: ['MANAGER'],                    group: 'Quản trị' },
  { id: 'reports',   label: 'Báo cáo',      icon: BarChart3,       roles: ['MANAGER'],                    group: 'Quản trị' },
]

const GROUPS = ['Chung', 'Vận hành', 'Quản trị']

const ROLE_LABELS = {
  MANAGER: 'QUẢN LÝ',
  STAFF: 'PHỤC VỤ',
  KITCHEN: 'BẾP'
}

export default function Shell({ user, route, setRoute, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(false) 
  const [notifs, setNotifs] = useState([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  const visibleItems = useMemo(() => 
    NAV_ITEMS.filter(item => item.roles.includes(user.role)), 
  [user.role])

  const canViewNotifs = ['MANAGER', 'STAFF'].includes(user?.role)

  useEffect(() => {
    if (!canViewNotifs) return

    const q = query(
        collection(db, 'notifications'), 
        where('isRead', '==', false),
        orderBy('createdAt', 'desc')
    )
    
    const unsub = onSnapshot(q, (snap) => {
       const list = []
       snap.forEach(d => list.push({ id: d.id, ...d.data() }))
       setNotifs(list)
    }, (err) => console.error("Notification Error:", err))

    return () => unsub()
  }, [canViewNotifs])

  const markAsRead = async (id) => {
      try {
        await updateDoc(doc(db, 'notifications', id), { isRead: true })
      } catch (e) {
        console.error(e)
      }
  }

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return 'Vừa xong'
    return timestamp.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  const getNotifBadgeStyle = (type) => {
    switch (type) {
      case 'kitchen_issue': return 'bg-orange-100 text-orange-700'
      case 'low_stock': return 'bg-red-100 text-red-600'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  const getNotifLabel = (type) => {
    switch (type) {
      case 'kitchen_issue': return 'BẾP BÁO'
      case 'low_stock': return 'KHO HÀNG'
      default: return 'HỆ THỐNG'
    }
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out z-50 ${collapsed ? 'w-20' : 'w-64'}`}>
        <div className={`h-16 flex items-center border-b border-slate-100 px-4 transition-all ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="font-bold text-xl text-emerald-700 tracking-tight flex items-center gap-2 truncate">
               RMS Manager
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            {collapsed ? <PanelLeftOpen size={20}/> : <PanelLeftClose size={20}/>}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
            {GROUPS.map(groupName => {
                const itemsInGroup = visibleItems.filter(i => i.group === groupName)
                if (itemsInGroup.length === 0) return null

                return (
                    <div key={groupName} className="mb-6">
                        {!collapsed && groupName !== 'Chung' && (
                            <div className="px-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {groupName}
                            </div>
                        )}
                        <div className="space-y-1 px-3">
                            {itemsInGroup.map(item => {
                                const Icon = item.icon
                                const isActive = route === item.id
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setRoute(item.id)}
                                        title={collapsed ? item.label : ''}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full group relative ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                                    >
                                        <Icon size={20} className={`shrink-0 transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                        
                                        {!collapsed && (
                                            <span className="text-sm font-medium whitespace-nowrap origin-left animate-fadeIn">
                                                {item.label}
                                            </span>
                                        )}
                                        
                                        {isActive && !collapsed && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-emerald-500 rounded-r-full" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
           <div className={`flex items-center gap-3 ${collapsed ? 'flex-col justify-center' : ''}`}>
             <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0 border-2 border-white shadow-sm">
                 {user.name?.[0]?.toUpperCase() || 'U'}
             </div>

             {!collapsed && (
                 <div className="flex-1 min-w-0 overflow-hidden">
                    <h2 className="font-bold text-sm text-slate-700 truncate" title={user.name}>{user.name}</h2>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider truncate">
                       {ROLE_LABELS[user.role] || user.role}
                    </p>
                 </div>
             )}

             <button 
                 onClick={onLogout} 
                 title="Đăng xuất"
                 className={`text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg p-2 transition-colors ${collapsed ? 'mt-2' : ''}`}
             >
                 <LogOut size={18} />
             </button>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-slate-50">
        
        {/* NOTIFICATIONS */}
        {canViewNotifs && (
            <div className="absolute top-5 right-6 z-[60]">
                <button 
                    onClick={() => setShowNotifPanel(!showNotifPanel)}
                    className="relative p-2.5 bg-white rounded-full shadow-md hover:bg-slate-50 text-slate-600 transition border border-slate-100"
                >
                    <Bell size={20} />
                    {notifs.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce shadow-sm border border-white">
                            {notifs.length}
                        </span>
                    )}
                </button>

                {showNotifPanel && (
                    <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn origin-top-right">
                        <div className="p-3 border-b bg-slate-50 font-bold flex justify-between items-center text-sm text-slate-700">
                            <span className="flex items-center gap-2">🔔 Thông báo ({notifs.length})</span>
                            <button onClick={()=>setShowNotifPanel(false)} className="hover:bg-slate-200 rounded p-1"><X size={16}/></button>
                        </div>
                        
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {notifs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                                    <Bell size={32} className="opacity-20"/>
                                    <span>Hệ thống bình thường.<br/>Không có tin nhắn mới.</span>
                                </div>
                            ) : (
                                notifs.map(n => (
                                    <div 
                                        key={n.id} 
                                        onClick={() => markAsRead(n.id)}
                                        className="p-4 border-b last:border-0 hover:bg-red-50 cursor-pointer transition-colors group relative"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getNotifBadgeStyle(n.type)}`}>
                                                {getNotifLabel(n.type)}
                                            </span>
                                            <span className="text-[10px] text-slate-400">{formatTime(n.createdAt)}</span>
                                        </div>
                                        <div className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-red-700 transition-colors">
                                            {n.title}
                                        </div>
                                        <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                            {n.message}
                                        </div>
                                        {!n.isRead && <div className="absolute top-4 right-2 w-2 h-2 bg-red-500 rounded-full shadow-sm"></div>}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* CHILDREN */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth custom-scrollbar">
           <div className="max-w-7xl mx-auto h-full flex flex-col">
             {children}
           </div>
        </div>

      </main>
    </div>
  )
}