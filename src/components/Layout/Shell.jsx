// src/components/Layout/Shell.jsx
import React from 'react'
import { LayoutDashboard, UtensilsCrossed, Coffee, Users, BarChart3, LogOut, UserCircle,ChefHat } from 'lucide-react'
export default function Shell({ user, route, setRoute, onLogout, children }) {

  // Cấu hình Menu phân quyền (Đã bỏ CASHIER)
  const MENU_ITEMS = [
    // 1. Tổng quan: Ai cũng được xem để nắm tình hình
    { 
      id: 'dashboard', 
      label: 'Tổng quan', 
      icon: LayoutDashboard, 
      roles: ['MANAGER', 'STAFF', 'KITCHEN'] 
    },
    
    // 2. Màn hình Bếp: Bếp nấu, Phục vụ xem tiến độ, Quản lý giám sát
    { 
      id: 'kitchen',   
      label: 'Bếp & Chế biến', 
      icon: ChefHat,    
      roles: ['MANAGER', 'STAFF', 'KITCHEN'] 
    }, 
    
    // 3. Sơ đồ bàn: Chỉ Phục vụ & Quản lý (Bếp không cần xem)
    { 
      id: 'order',     
      label: 'Sơ đồ bàn', 
      icon: UtensilsCrossed, 
      roles: ['MANAGER', 'STAFF'] 
    },

    // 4. Thực đơn: Chỉ Phục vụ & Quản lý
    { 
      id: 'menu',      
      label: 'Thực đơn',  
      icon: Coffee,          
      roles: ['MANAGER', 'STAFF'] 
    },
    
    // 5. Quản trị: Chỉ dành riêng cho Manager
    { id: 'staff',     label: 'Nhân viên', icon: Users,           roles: ['MANAGER'] },
    { id: 'reports',   label: 'Báo cáo',   icon: BarChart3,       roles: ['MANAGER'] },
  ]

  // Lọc menu theo quyền hiện tại của User
  // Mặc định là STAFF nếu không tìm thấy role
  const userRole = user?.role || 'STAFF'; 
  const allowedMenu = MENU_ITEMS.filter(item => item.roles.includes(userRole))

  // Helper hiển thị tên vai trò tiếng Việt
  const getRoleName = (role) => {
    if (role === 'MANAGER') return 'Quản lý';
    if (role === 'KITCHEN') return 'Bếp';
    return 'Phục vụ';
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* SIDEBAR (THANH BÊN TRÁI) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20 h-full">
        
        {/* LOGO */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 shadow-sm shadow-emerald-200">
            R
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">RMS <span className="text-emerald-600">POS</span></span>
        </div>

        {/* MENU LIST */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {allowedMenu.map(item => {
            const Icon = item.icon
            const isActive = route === item.id
            return (
              <button
                key={item.id}
                onClick={() => setRoute(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm
                  ${isActive 
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* USER INFO & LOGOUT */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
              <UserCircle className="w-6 h-6"/>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-800 truncate">
                {user?.name || user?.email?.split('@')[0] || 'User'}
              </div>
              <div className="text-xs font-medium text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded inline-block">
                {getRoleName(user?.role)}
              </div>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-rose-600 text-sm font-bold hover:bg-rose-50 hover:border-rose-100 transition shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative h-full">
        <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-full">
          {children}
        </div>
      </main>

    </div>
  )
}