import React from 'react'
import { LayoutDashboard, UtensilsCrossed, ClipboardList, Menu, Users, BarChart3, LogOut, ChefHat } from 'lucide-react'

export default function Shell({ user, route, setRoute, onLogout, children }) {
  
  const navItems = [
    // [FIX] Thêm 'KITCHEN' vào roles để nhân viên bếp thấy menu Tổng quan
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, roles: ['MANAGER', 'STAFF', 'KITCHEN'] },
    
    { id: 'order',     label: 'Gọi món',   icon: ClipboardList,   roles: ['MANAGER', 'STAFF'] },
    { id: 'menu',      label: 'Thực đơn',  icon: Menu,            roles: ['MANAGER', 'STAFF'] },
    { id: 'kitchen',   label: 'Bếp',       icon: ChefHat,         roles: ['MANAGER', 'KITCHEN'] },
    { id: 'staff',     label: 'Nhân viên', icon: Users,           roles: ['MANAGER'] },
    { id: 'reports',   label: 'Báo cáo',   icon: BarChart3,       roles: ['MANAGER'] },
  ]

  const visibleItems = navItems.filter(item => item.roles.includes(user.role))

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      <aside className="bg-white border-r border-slate-200 md:w-64 flex-shrink-0 flex flex-col sticky top-0 h-auto md:h-screen z-20">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold text-slate-800 truncate">{user.name}</h2>
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">{user.role === 'KITCHEN' ? 'BẾP' : (user.role === 'MANAGER' ? 'QUẢN LÝ' : 'PHỤC VỤ')}</p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {visibleItems.map(item => {
            const Icon = item.icon
            const isActive = route === item.id
            return (
              <button
                key={item.id}
                onClick={() => setRoute(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <Icon size={18} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto h-screen p-4 md:p-6 scroll-smooth">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  )
}