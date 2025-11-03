// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Table2, Salad, Users, ChartBar, LogIn, LogOut, UtensilsCrossed, Plus, Search, CheckCircle } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts'
import { db, storage, auth } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  collection, onSnapshot, addDoc, updateDoc, setDoc, doc, query, where,
  getDocs, serverTimestamp, deleteDoc, getDoc, orderBy, Timestamp, collectionGroup, limit, startAfter
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

/* ----------------------------- Helpers/UI ------------------------------ */
const MANAGER_EMAILS = ['admin@rms.vn']
const routes = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: 'order',     label: 'Gọi món',   icon: <Table2 className="w-4 h-4" /> },
  { key: 'menu',      label: 'Thực đơn',  icon: <Salad className="w-4 h-4" /> },
  { key: 'staff',     label: 'Nhân viên', icon: <Users className="w-4 h-4" /> },
  { key: 'reports',   label: 'Báo cáo',   icon: <ChartBar className="w-4 h-4" /> },
]

function StatusChip({ status }) {
  const cls = status === 'FREE'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'BUSY'
      ? 'bg-rose-100 text-rose-700'
      : 'bg-amber-100 text-amber-700'
  return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{status}</span>
}

function Shell({ user, route, setRoute, onLogout, children }) {
  const isManager = String(user?.role || '').toUpperCase() === 'MANAGER'
  const nav = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'order',     label: 'Gọi món',   icon: <Table2 className="w-4 h-4" /> },
    { key: 'menu',      label: 'Thực đơn',  icon: <Salad className="w-4 h-4" /> },
    ...(isManager ? [{ key: 'staff', label: 'Nhân viên', icon: <Users className="w-4 h-4" /> }] : []),
    { key: 'reports',   label: 'Báo cáo',   icon: <ChartBar className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr] bg-slate-50">
      <aside className="bg-emerald-900 text-emerald-50 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-emerald-700 rounded-lg"><UtensilsCrossed className="w-5 h-5" /></div>
          <div>
            <div className="font-semibold leading-tight">RMS</div>
            <div className="text-emerald-200 text-xs">{user?.role || 'GUEST'}</div>
          </div>
        </div>

        {nav.map(r => (
          <button
            key={r.key}
            onClick={() => setRoute(r.key)}
            className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 ${
              route === r.key ? 'bg-white text-emerald-900' : 'hover:bg-emerald-800/40'
            }`}
          >
            {r.icon}<span>{r.label}</span>
          </button>
        ))}

        <div className="mt-auto pt-4 border-t border-emerald-800/40">
          <div className="text-xs text-emerald-200 mb-2 break-words">{user?.email}</div>
          <button onClick={onLogout} className="w-full px-3 py-2 text-left rounded-lg hover:bg-emerald-800/40 flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="p-6">{children}</main>
    </div>
  )
}

/* ----------------------------- Auth (Login) ---------------------------- */

function Login({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toMessage = (code) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Thông tin đăng nhập chưa chính xác'
      case 'auth/invalid-email':
        return 'Email không hợp lệ'
      case 'auth/too-many-requests':
        return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau'
      case 'auth/network-request-failed':
        return 'Không thể kết nối mạng. Kiểm tra internet của bạn'
      default:
        return 'Đăng nhập thất bại. Vui lòng thử lại'
    }
  }

const submit = async (e) => {
  e.preventDefault()
  setError(''); setLoading(true)
  try {
    await signInWithEmailAndPassword(auth, email, password)
    // KHÔNG set user/role ở đây. onAuthStateChanged sẽ chạy ngay sau khi login thành công.
  } catch (err) {
    setError(toMessage(err?.code))
  } finally {
    setLoading(false)
  }
}


  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-emerald-50 to-emerald-100">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white"><UtensilsCrossed/></div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Restaurant Management</h1>
            <p className="text-sm text-slate-500">Đăng nhập để tiếp tục</p>
          </div>
        </div>
        <div className="space-y-3">
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"
                 className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" required/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mật khẩu"
                 className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" required/>
          {error && <div role="alert" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
          <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2 flex items-center justify-center gap-2">
            <LogIn className="w-4 h-4"/>{loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ----------------------------- Dashboard/Staff/Reports ----------------- */

// ===== Dashboard realtime (không cần index closedAt) =====
function Dashboard() {
  const [ordersPaid, setOrdersPaid] = useState([]) // tất cả order PAID (realtime)
  const [loading, setLoading] = useState(true)

  // lắng nghe order PAID theo realtime
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'orders'), where('status', '==', 'PAID')),
      (snap) => {
        const list = []
        snap.forEach(d => list.push({ id: d.id, ...d.data() }))
        setOrdersPaid(list)
        setLoading(false)
      },
      (err) => {
        console.error('Dashboard listen error:', err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  // helpers
  const startOfDay   = (d=new Date()) => { const x=new Date(d); x.setHours(0,0,0,0); return x }
  const startOfWeek  = (d=new Date()) => { const x=new Date(d); const dw=(x.getDay()+6)%7; x.setDate(x.getDate()-dw); x.setHours(0,0,0,0); return x }
  const startOfMonth = (d=new Date()) => new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0)
  const endOfDay     = (d=new Date()) => { const x=new Date(d); x.setHours(23,59,59,999); return x }
  const dayLabel     = (i) => ['CN','T2','T3','T4','T5','T6','T7'][i]

  // lấy thời điểm closed (ưu tiên closedAt, fallback createdAt)
  const getClosedDate = (o) => {
    const ts = o.closedAt?.toDate?.() || o.createdAt?.toDate?.()
    return ts ? new Date(ts) : null
    // nếu vẫn null => đơn không tính được thời gian -> bỏ qua
  }

  // tổng hợp số liệu
  const { todayStat, weekStat, monthStat, weekSeries, monthSeries } = useMemo(() => {
    const now = new Date()
    const sDay   = startOfDay(now)
    const eDay   = endOfDay(now)
    const sWeek  = startOfWeek(now)
    const sMonth = startOfMonth(now)

    let todayRevenue=0, todayOrders=0
    let weekRevenue=0,  weekOrders=0
    let monthRevenue=0, monthOrders=0

    const weekBuckets = Array(7).fill(0)   // theo thứ (Mon..Sun) tính bằng nghìn VND
    const monthBuckets = {}                // key = ngày (1..31), value = VND

    ordersPaid.forEach(o => {
      const dt = getClosedDate(o)
      if (!dt) return

      const total = Number(o.total || 0)

      // ngày
      if (dt >= sDay && dt <= eDay) {
        todayRevenue += total; todayOrders += 1
      }
      // tuần
      if (dt >= sWeek) {
        weekRevenue  += total; weekOrders  += 1
        const idx = (dt.getDay()+6)%7
        weekBuckets[idx] += total
      }
      // tháng
      if (dt >= sMonth) {
        monthRevenue += total; monthOrders += 1
        const key = dt.getDate()
        monthBuckets[key] = (monthBuckets[key] || 0) + total
      }
    })

    const weekSeries = weekBuckets.map((v, i) => ({
      day: dayLabel((i+1)%7),
      this: Math.round(v/1000) // hiển thị nghìn VND
    }))

    // chuyển monthBuckets sang mảng theo ngày tăng dần
    const monthDays = Object.keys(monthBuckets).map(n => parseInt(n,10)).sort((a,b)=>a-b)
    const monthSeries = monthDays.map(d => ({ d, v: Math.round(monthBuckets[d]/1000) }))

    return {
      todayStat: { revenue: todayRevenue, orders: todayOrders },
      weekStat:  { revenue: weekRevenue,  orders: weekOrders  },
      monthStat: { revenue: monthRevenue, orders: monthOrders },
      weekSeries,
      monthSeries
    }
  }, [ordersPaid])

  const fmtVND = (v) => (Number(v)||0).toLocaleString('vi-VN') + 'đ'

  const Card = ({title, value, sub}) => (
    <div className="bg-white rounded-xl p-4 shadow">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Hôm nay"  value={`${fmtVND(todayStat.revenue)} / ${todayStat.orders} đơn`} />
        <Card title="Tuần này" value={`${fmtVND(weekStat.revenue)} / ${weekStat.orders} đơn`} />
        <Card title="Tháng này"value={`${fmtVND(monthStat.revenue)} / ${monthStat.orders} đơn`} />
      </div>

      {/* Biểu đồ tuần (doanh thu theo thứ) */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="font-semibold mb-2">Doanh thu theo ngày trong tuần</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekSeries}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="this" name="(nghìn VND)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Biểu đồ tháng (doanh thu theo ngày trong tháng) */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="font-semibold mb-2">Doanh thu theo ngày (Tháng hiện tại)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthSeries}>
              <XAxis dataKey="d" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="v" name="(nghìn VND)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-500">Đang tải thống kê…</div>}
    </div>
  )
}

/* ----------------------------- Order: chọn bàn ------------------------- */

function OrderTables({ setRoute, setActiveTable, setActiveOrderId }) {
  const [q, setQ] = useState('')
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tables'), (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      list.sort((a,b)=> (a.name||a.id).localeCompare(b.name||b.id, 'vi', { numeric:true }))
      setTables(list); setLoading(false)
    })
    return () => unsub()
  }, [])

  // nếu trống → seed nhanh 16 bàn
  const seedTables = async () => {
    const snap = await getDocs(collection(db, 'tables'))
    if (!snap.empty) { alert('Đã có dữ liệu tables'); return }
    for (let i=1;i<=16;i++){
      const id = `T${i}`
      await setDoc(doc(db, 'tables', id), {
        name: id, capacity: 2 + ((i-1)%4)*2, status: 'FREE'
      })
    }
    alert('Đã tạo T1..T16')
  }

  const filtered = useMemo(
    () => tables.filter(t => (t.name||t.id).toLowerCase().includes(q.toLowerCase())),
    [q, tables]
  )

  // Phương án B: dùng lại order OPEN nếu có
  const chooseTable = async (t) => {
    const qOpen = query(
      collection(db, 'orders'),
      where('tableId','==', t.id),
      where('status','==','OPEN')
    )
    const snap = await getDocs(qOpen)
    let orderId
    if (!snap.empty) {
      orderId = snap.docs[0].id
    } else {
      const ref = await addDoc(collection(db, 'orders'), {
        tableId: t.id, status: 'OPEN', createdAt: serverTimestamp()
      })
      orderId = ref.id
    }
    setActiveTable(t)
    setActiveOrderId(orderId)
    setRoute('menu')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gọi món • Chọn bàn</h2>
        <div className="flex items-center gap-2 text-xs">
        </div>
      </div>

      <div className="relative">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm bàn…" className="w-full md:w-80 border rounded-xl pl-9 pr-3 py-2 bg-white"/>
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Đang tải bàn…</div>
      ) : (
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {filtered.map(t=>(
            <button key={t.id}
              onClick={()=>chooseTable(t)}
              className={`aspect-square rounded-2xl shadow bg-white border p-3 text-left hover:shadow-md transition flex flex-col justify-between ${
                t.status==='FREE'?'':'ring-2 ' + (t.status==='BUSY'?'ring-rose-400':'ring-amber-400')
              }`}
            >
              <div>
                <div className="text-sm font-medium">{t.name || t.id}</div>
                <div className="text-xs text-slate-500">{t.capacity} chỗ</div>
              </div>
              <StatusChip status={t.status}/>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ===================== REPORTS (Revenue & Menu) =====================
function Reports() {
  const [tab, setTab] = useState('revenue') // 'revenue' | 'menu'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={()=>setTab('revenue')}
          className={`px-3 py-1.5 rounded-lg border ${tab==='revenue'?'bg-emerald-600 text-white border-emerald-600':'bg-white'}`}>
          Báo cáo doanh thu
        </button>
        <button onClick={()=>setTab('menu')}
          className={`px-3 py-1.5 rounded-lg border ${tab==='menu'?'bg-emerald-600 text-white border-emerald-600':'bg-white'}`}>
          Báo cáo món ăn
        </button>
      </div>
      {tab==='revenue' ? <RevenueReport/> : <MenuReport/>}
    </div>
  )
}

// ---------- helper thời gian ----------
const addDays = (d, n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x }
const startOfDay = (d=new Date()) => { const x=new Date(d); x.setHours(0,0,0,0); return x }
const endOfDay   = (d=new Date()) => { const x=new Date(d); x.setHours(23,59,59,999); return x }
const startOfWeek= (d=new Date()) => { const x=new Date(d); const dw=(x.getDay()+6)%7; x.setDate(x.getDate()-dw); x.setHours(0,0,0,0); return x }
const endOfWeek  = (d=new Date()) => { const x=startOfWeek(d); x.setDate(x.getDate()+6); x.setHours(23,59,59,999); return x }
const startOfMonth=(d=new Date()) => new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0)
const endOfMonth  =(d=new Date()) => new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999)
const startOfQuarter=(d=new Date()) => new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3, 1,0,0,0,0)
const endOfQuarter  =(d=new Date()) => new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3+3, 0,23,59,59,999)
const startOfYear   =(d=new Date()) => new Date(d.getFullYear(), 0, 1, 0,0,0,0)
const endOfYear     =(d=new Date()) => new Date(d.getFullYear(), 11, 31, 23,59,59,999)

const dayLabel = (i)=>['CN','T2','T3','T4','T5','T6','T7'][i]

// ---------- truy vấn orders theo khoảng ----------
async function fetchPaidOrders(from, to) {
  const qRef = query(
    collection(db, 'orders'),
    where('status','==','PAID'),
    where('closedAt','>=', Timestamp.fromDate(from)),
    where('closedAt','<=', Timestamp.fromDate(to)),
    orderBy('closedAt', 'asc')
  )
  const snap = await getDocs(qRef)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ===================== 1) Báo cáo doanh thu =====================
function RevenueReport() {
  const [rangeType, setRangeType] = useState('day') // day | week | month | quarter | year | custom
  const [from, setFrom] = useState(startOfDay(new Date()))
  const [to, setTo]     = useState(endOfDay(new Date()))
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  // so sánh kỳ trước
  const [compare, setCompare] = useState({ revenue: 0, orders: 0 })

  const fmtVND = (v) => (Number(v)||0).toLocaleString('vi-VN') + 'đ'

  const pickPreset = (t) => {
    const now = new Date()
    setRangeType(t)
    if (t==='day')   { setFrom(startOfDay(now)); setTo(endOfDay(now)) }
    if (t==='week')  { setFrom(startOfWeek(now)); setTo(endOfWeek(now)) }
    if (t==='month') { setFrom(startOfMonth(now)); setTo(endOfMonth(now)) }
    if (t==='quarter'){ setFrom(startOfQuarter(now)); setTo(endOfQuarter(now)) }
    if (t==='year')  { setFrom(startOfYear(now)); setTo(endOfYear(now)) }
  }

  // tải orders theo khoảng
  const reload = async () => {
    setLoading(true)
    const data = await fetchPaidOrders(from, to)
    setOrders(data)

    // so sánh kỳ trước (same length trước đó)
    const lenDays = Math.max(1, Math.round((to - from)/86400000)+1)
    const prevFrom = addDays(from, -lenDays)
    const prevTo   = addDays(to,   -lenDays)
    const prev = await fetchPaidOrders(prevFrom, prevTo)
    const rev = prev.reduce((s,o)=> s + Number(o.total||0), 0)
    setCompare({ revenue: rev, orders: prev.length })

    setLoading(false)
  }

  useEffect(()=>{ reload() },[]) // load lần đầu
  useEffect(()=>{ /* mỗi khi đổi khoảng thì load lại */
    reload()
  }, [from.getTime(), to.getTime()])

  // --------- tổng hợp chỉ số ----------
  const revenue = orders.reduce((s,o)=> s + Number(o.total||0), 0)
  const count   = orders.length

  // theo giờ trong ngày (heatmap đơn giản)
  const byHour = Array(24).fill(0)
  orders.forEach(o=>{
    const dt = o.closedAt?.toDate?.() || new Date()
    const h = dt.getHours()
    byHour[h] += Number(o.total||0)
  })
  const hourSeries = byHour.map((v,i)=>({ h: i, k: Math.round(v/1000) }))

  // series theo mốc thời gian (day/week/month/quarter/year)
  const timeSeries = (() => {
    const map = new Map()
    orders.forEach(o => {
      const dt = o.closedAt?.toDate?.() || new Date()
      let key = ''
      if (rangeType==='day' || rangeType==='custom') {
        key = dt.toLocaleDateString('vi-VN') // gộp theo ngày
      } else if (rangeType==='week') {
        key = `T${(dt.getDay()+6)%7 + 2}`.replace('T8','CN') // T2..CN
      } else if (rangeType==='month') {
        key = String(dt.getDate()).padStart(2,'0') // 01..31
      } else if (rangeType==='quarter' || rangeType==='year') {
        key = String(dt.getMonth()+1).padStart(2,'0') // 01..12
      }
      map.set(key, (map.get(key)||0) + Number(o.total||0))
    })
    return Array.from(map.entries())
      .sort((a,b)=> a[0].localeCompare(b[0], 'vi', {numeric:true}))
      .map(([k,v])=>({ x:k, k: Math.round(v/1000) }))
  })()

  return (
    <div className="space-y-4">
      {/* Bộ lọc thời gian */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Khoảng thời gian</div>
          <div className="flex flex-wrap gap-2">
            {['day','week','month','quarter','year','custom'].map(t=>(
              <button key={t} onClick={()=>pickPreset(t)}
                className={`px-3 py-1.5 rounded-lg border ${rangeType===t?'bg-emerald-600 text-white border-emerald-600':'bg-white'}`}>
                {t==='day'?'Ngày':t==='week'?'Tuần':t==='month'?'Tháng':t==='quarter'?'Quý':t==='year'?'Năm':'Tùy chọn'}
              </button>
            ))}
          </div>
        </div>
        {rangeType==='custom' && (
          <>
            <div>
              <div className="text-xs text-slate-500">Từ ngày</div>
              <input type="date" className="border rounded-lg px-3 py-1.5"
                value={from.toISOString().slice(0,10)}
                onChange={e => setFrom(startOfDay(new Date(e.target.value)))} />
            </div>
            <div>
              <div className="text-xs text-slate-500">Đến ngày</div>
              <input type="date" className="border rounded-lg px-3 py-1.5"
                value={to.toISOString().slice(0,10)}
                onChange={e => setTo(endOfDay(new Date(e.target.value)))} />
            </div>
            <button onClick={reload} className="px-3 py-1.5 rounded-lg border">Áp dụng</button>
          </>
        )}
        <div className="ml-auto text-sm text-slate-500">{loading?'Đang tải…':''}</div>
      </div>

      {/* KPI tổng + So sánh kỳ */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-slate-500">Doanh thu</div>
          <div className="text-xl font-bold mt-1">{fmtVND(revenue)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-slate-500">Số đơn</div>
          <div className="text-xl font-bold mt-1">{count}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-slate-500">So sánh kỳ trước</div>
          <div className="text-sm mt-1">
            {fmtVND(compare.revenue)} / {compare.orders} đơn
          </div>
        </div>
      </div>

      {/* Biểu đồ theo thời gian */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="font-semibold mb-2">Biểu đồ doanh thu theo thời gian</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeries}>
              <XAxis dataKey="x"/>
              <YAxis/>
              <Tooltip/>
              <Line type="monotone" dataKey="k" name="(nghìn VND)" dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap theo giờ (dạng bar đơn giản) */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="font-semibold mb-2">Doanh thu theo giờ trong ngày</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourSeries}>
              <XAxis dataKey="h"/>
              <YAxis/>
              <Tooltip/>
              <Legend/>
              <Bar dataKey="k" name="(nghìn VND)" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chi tiết hóa đơn */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="font-semibold mb-2">Chi tiết hóa đơn</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="p-2">Thời gian</th>
                <th className="p-2">Bàn</th>
                <th className="p-2">Nhân viên</th>
                <th className="p-2 text-right">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o=>(
                <tr key={o.id} className="border-t">
                  <td className="p-2">{o.closedAt?.toDate?.()?.toLocaleString?.('vi-VN') || '-'}</td>
                  <td className="p-2">{o.tableId || '-'}</td>
                  <td className="p-2">{o.staffId || '-'}</td>
                  <td className="p-2 text-right">{fmtVND(o.total||0)}</td>
                </tr>
              ))}
              {orders.length===0 && (
                <tr><td className="p-2 text-slate-500" colSpan={4}>Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===================== 2) Báo cáo món ăn =====================
function MenuReport() {
  const [from, setFrom] = useState(startOfMonth(new Date()))
  const [to, setTo]     = useState(endOfMonth(new Date()))
  const [topItems, setTopItems] = useState([]) // [{name, qty, revenue}]
  const [lowItems, setLowItems] = useState([]) // món ít bán (top cuối)
  const [loading, setLoading] = useState(false)

  const fmtVND = (v) => (Number(v)||0).toLocaleString('vi-VN') + 'đ'

  const reload = async () => {
    setLoading(true)
    // 1) Lấy danh sách orders trong khoảng
    const orders = await fetchPaidOrders(from, to)
    const itemAgg = new Map() // name -> { qty, revenue }

    // 2) Gộp items từ từng order (N+1 query — đủ dùng cho demo & cỡ nhỏ)
    for (const o of orders) {
      const snap = await getDocs(collection(db, 'orders', o.id, 'items'))
      snap.forEach(d => {
        const it = d.data()
        const key = it.name || it.menuItemId || 'Unknown'
        const cur = itemAgg.get(key) || { qty:0, revenue:0 }
        const qty = Number(it.qty||1)
        const price = Number(it.price||0)
        cur.qty += qty
        cur.revenue += qty*price
        itemAgg.set(key, cur)
      })
    }

    const arr = Array.from(itemAgg.entries()).map(([name, v]) => ({ name, ...v }))
    arr.sort((a,b)=> b.revenue - a.revenue)
    setTopItems(arr.slice(0,10)) // Top 10 món bán chạy

    // món ít bán: lấy 10 cuối theo qty (bỏ các món 0)
    const tail = [...arr].sort((a,b)=> a.qty - b.qty).filter(x=>x.qty>0).slice(0,10)
    setLowItems(tail)

    setLoading(false)
  }

  useEffect(()=>{ reload() },[])
  useEffect(()=>{ reload() },[from.getTime(), to.getTime()])

  return (
    <div className="space-y-4">
      {/* Bộ lọc thời gian */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs text-slate-500">Từ ngày</div>
          <input type="date" className="border rounded-lg px-3 py-1.5"
            value={from.toISOString().slice(0,10)}
            onChange={e=>setFrom(startOfDay(new Date(e.target.value)))}/>
        </div>
        <div>
          <div className="text-xs text-slate-500">Đến ngày</div>
          <input type="date" className="border rounded-lg px-3 py-1.5"
            value={to.toISOString().slice(0,10)}
            onChange={e=>setTo(endOfDay(new Date(e.target.value)))}/>
        </div>
        <button onClick={reload} className="px-3 py-1.5 rounded-lg border">Áp dụng</button>
        <div className="ml-auto text-sm text-slate-500">{loading?'Đang tải…':''}</div>
      </div>

      {/* Top món bán chạy */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="font-semibold mb-2">🥇 Top món bán chạy (Top 10)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topItems.map(x=>({ name:x.name, v: Math.round(x.revenue/1000) }))}>
              <XAxis dataKey="name" tick={{fontSize:12}} interval={0} angle={-20} textAnchor="end"/>
              <YAxis/>
              <Tooltip/>
              <Bar dataKey="v" name="Doanh thu (nghìn VND)" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-auto mt-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="p-2">Món</th>
                <th className="p-2 text-right">Số lượng</th>
                <th className="p-2 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {topItems.map(it=>(
                <tr key={it.name} className="border-t">
                  <td className="p-2">{it.name}</td>
                  <td className="p-2 text-right">{it.qty}</td>
                  <td className="p-2 text-right">{fmtVND(it.revenue)}</td>
                </tr>
              ))}
              {topItems.length===0 && (
                <tr><td className="p-2 text-slate-500" colSpan={3}>Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Món ít bán / món lỗ (ở đây: ít bán) */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="font-semibold mb-2">⚠️ Món ít bán (Bottom 10)</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="p-2">Món</th>
                <th className="p-2 text-right">Số lượng</th>
                <th className="p-2 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {lowItems.map(it=>(
                <tr key={it.name} className="border-t">
                  <td className="p-2">{it.name}</td>
                  <td className="p-2 text-right">{it.qty}</td>
                  <td className="p-2 text-right">{fmtVND(it.revenue)}</td>
                </tr>
              ))}
              {lowItems.length===0 && (
                <tr><td className="p-2 text-slate-500" colSpan={3}>Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- Menu + Modal CRUD ----------------------- */

// ===== MENU — Tải theo trang (không realtime), thumbnail + lazy image =====
function Menu({ activeTable, activeOrderId, setActiveTable, setActiveOrderId, setRoute }) {
  // --- Data (menu) — pagination ---
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)

  // --- UI filter/search/sort ---
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('Tất cả')
  const [onlyAvail, setOnlyAvail] = useState(false)
  const [sortBy, setSortBy] = useState('popular') // popular | newest | priceAsc | priceDesc

  // --- Order state (giỏ hàng) ---
  const [orderItems, setOrderItems] = useState([])
  const [orderLoading, setOrderLoading] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const pageSize = 24

  // ----------- Load menu theo trang (getDocs) -----------
  async function loadPage(reset = false) {
    setLoading(true)
    try {
      const base = [orderBy('created_at', 'desc'), limit(pageSize)]
      const qRef = reset || !cursor
        ? query(collection(db, 'menu_items'), ...base)
        : query(collection(db, 'menu_items'), ...base, startAfter(cursor))

      const snap = await getDocs(qRef)
      const arr  = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      setCursor(snap.docs[snap.docs.length - 1] || null)
      setHasMore(snap.size === pageSize)
      setItems(prev => reset ? arr : [...prev, ...arr])
    } finally {
      setLoading(false)
    }
  }

  // lần đầu tải một trang
  useEffect(() => { loadPage(true) }, [])

  // ----------- Order items (giỏ) realtime — giữ nguyên cho giỏ mượt -----------
  useEffect(() => {
    if (!activeOrderId) { setOrderItems([]); return }
    setOrderLoading(true)
    const unsub = onSnapshot(collection(db, 'orders', activeOrderId, 'items'), snap => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      list.sort((a,b) => (a.name||'').localeCompare(b.name||'')) // đơn giản
      setOrderItems(list); setOrderLoading(false)
    })
    return () => unsub()
  }, [activeOrderId])

  // ----------- CRUD modal menu item -----------
  const openAdd  = () => { setEditing(null); setShowModal(true) }
  const openEdit = (m) => { setEditing(m); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const handleCreate = async (payload) => {
    await addDoc(collection(db, 'menu_items'), {
      ...payload,
      is_available: true,
      created_at: serverTimestamp()
    })
    // không realtime => tự refresh
    await loadPage(true)
  }

  const handleUpdate = async (id, payload) => {
    await updateDoc(doc(db, 'menu_items', id), payload)
    await loadPage(true)
  }

  // ----------- Add to order -----------
  const addToOrder = async (m) => {
    if (!activeTable || !activeOrderId) {
      alert('Hãy vào "Gọi món" và chọn bàn trước')
      return
    }
    await addDoc(collection(db, 'orders', activeOrderId, 'items'), {
      menuItemId: m.id,
      name: m.name,
      price: Number(m.price || 0),
      qty: 1,
      note: ''
    })
    // Nếu bàn FREE -> BUSY
    try {
      if (activeTable.status === 'FREE') {
        await updateDoc(doc(db, 'tables', activeTable.id), { status: 'BUSY' })
      }
    } catch (e) {
      console.warn('Không cập nhật được trạng thái bàn:', e)
    }
  }

  // ----------- Cart actions -----------
  const cartTotal = orderItems.reduce((s,i)=> s + Number(i.price||0) * Number(i.qty||1), 0)
  const changeQty = async (item, delta) => {
    if (!activeOrderId) return
    const next = Math.max(1, Number(item.qty || 1) + delta)
    await updateDoc(doc(db, 'orders', activeOrderId, 'items', item.id), { qty: next })
  }
  const removeItem = async (item) => {
    if (!activeOrderId) return
    if (!confirm(`Xoá ${item.name}?`)) return
    await deleteDoc(doc(db, 'orders', activeOrderId, 'items', item.id))
  }

  // ----------- Close order (mở invoice modal) -----------
  const closeOrder = async () => setShowInvoice(true)

  // ----------- Filter/Search/Sort client -----------
  const categories = useMemo(() => {
    const set = new Set(items.map(x => x.category || 'Khác'))
    return ['Tất cả', ...Array.from(set)]
  }, [items])

  const filtered = useMemo(() => {
    let list = items
    if (category !== 'Tất cả') list = list.filter(x => (x.category || 'Khác') === category)
    if (onlyAvail) list = list.filter(x => !!x.is_available)
    if (q.trim()) {
      const k = q.trim().toLowerCase()
      list = list.filter(x =>
        (x.name || '').toLowerCase().includes(k) ||
        (x.category || '').toLowerCase().includes(k)
      )
    }
    list = [...list]
    if (sortBy === 'newest') {
      list.sort((a,b) => (b.created_at?.seconds||0) - (a.created_at?.seconds||0))
    } else if (sortBy === 'priceAsc') {
      list.sort((a,b) => Number(a.price||0) - Number(b.price||0))
    } else if (sortBy === 'priceDesc') {
      list.sort((a,b) => Number(b.price||0) - Number(a.price||0))
    } else {
      // popular: tạm ưu tiên đang bán + tên
      list.sort((a,b) => (b.is_available?1:0)-(a.is_available?1:0) || (a.name||'').localeCompare(b.name||''))
    }
    return list
  }, [items, q, category, onlyAvail, sortBy])

  const fmt = v => (Number(v)||0).toLocaleString('vi-VN') + 'đ'

  const Chip = ({ active, children, onClick }) => (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition
        ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-slate-50'}`}>
      {children}
    </button>
  )

  const SkeletonCard = () => (
    <div className="rounded-2xl overflow-hidden bg-white shadow animate-pulse">
      <div className="h-36 bg-slate-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-2/3 bg-slate-200 rounded" />
        <div className="h-3 w-1/3 bg-slate-200 rounded" />
        <div className="h-8 w-full bg-slate-200 rounded" />
      </div>
    </div>
  )

  // Card có thumbnail + lazy image
  const ItemCard = ({ m }) => (
    <motion.div whileHover={{ y: -4 }} className="rounded-2xl overflow-hidden bg-white shadow">
      <div className="relative h-36 w-full">
        <img
          src={m.thumbURL || m.imageURL}
          srcSet={m.thumbURL ? `${m.thumbURL} 1x, ${m.imageURL || m.thumbURL} 2x` : undefined}
          loading="lazy" decoding="async" alt={m.name}
          width={600} height={360}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs bg-white/90 backdrop-blur font-semibold">
          {fmt(m.price || 0)}
        </div>
        <div className="absolute top-2 left-2 flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-black/40 text-white">
          <span className={`inline-block w-2 h-2 rounded-full ${m.is_available ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          {m.is_available ? 'Đang bán' : 'Tạm hết'}
        </div>
      </div>

      <div className="p-4 space-y-1">
        <div className="font-semibold">{m.name}</div>
        <div className="text-xs text-slate-500">{m.category || 'Khác'}</div>
        <div className="pt-2 flex gap-2">
          <button
            onClick={() => openEdit(m)}
            className="px-3 py-2 rounded-xl text-sm border bg-white">
            Sửa
          </button>
          <button
            onClick={() => addToOrder(m)}
            disabled={!activeOrderId}
            className="flex-1 px-3 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            Thêm vào order
          </button>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="space-y-5">
      {/* context bàn */}
      {activeTable && (
        <div className="text-sm text-slate-600">
          Đang gọi món cho bàn <b>{activeTable.name || activeTable.id}</b>
        </div>
      )}

      {/* modal invoice */}
      {showInvoice && (
        <InvoiceModal
          activeOrderId={activeOrderId}
          activeTable={activeTable}
          onClose={() => setShowInvoice(false)}
          onPaid={async () => {
            await updateDoc(doc(db, 'tables', activeTable.id), { status: 'FREE' })
            setShowInvoice(false)
            setActiveOrderId(null)
            setActiveTable(null)
            setRoute('order')
          }}
        />
      )}

      {/* Giỏ hàng */}
      {activeOrderId && (
        <div className="mt-2 bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Đơn hiện tại</div>
            <div className="text-xs text-slate-500">Order ID: <span className="font-mono">{activeOrderId}</span></div>
          </div>

          {orderLoading ? (
            <div className="text-sm text-slate-500">Đang tải giỏ hàng…</div>
          ) : orderItems.length === 0 ? (
            <div className="text-sm text-slate-500">Chưa có món nào trong đơn.</div>
          ) : (
            <ul className="divide-y">
              {orderItems.map(it => (
                <li key={it.id} className="py-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.name}</div>
                    <div className="text-xs text-slate-500">{(Number(it.price)/1000).toFixed(0)}k / món</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>changeQty(it, -1)} className="px-2 py-1 rounded-lg border">-</button>
                    <span className="w-8 text-center">{Number(it.qty||1)}</span>
                    <button onClick={()=>changeQty(it, +1)} className="px-2 py-1 rounded-lg border">+</button>
                    <div className="w-16 text-right font-medium">
                      {((Number(it.price||0)*Number(it.qty||1))/1000).toFixed(0)}k
                    </div>
                    <button onClick={()=>removeItem(it)} className="ml-2 px-2 py-1 rounded-lg border text-rose-600">Xoá</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-3 mt-3 border-t flex items-center justify-between">
            <div className="text-sm text-slate-500">Bàn: <b>{activeTable ? (activeTable.name || activeTable.id) : '-'}</b></div>
            <div className="text-base font-semibold">Tổng: {(cartTotal/1000).toFixed(0)}k</div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button onClick={closeOrder} className="px-3 py-2 rounded-lg border">Đóng order</button>
          </div>
        </div>
      )}

      {/* Header menu + điều khiển */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-lg font-semibold">Thực đơn</div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Tìm món theo tên, danh mục…"
              className="w-full border rounded-xl pl-9 pr-3 py-2 bg-white"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            className="border rounded-xl px-3 py-2 bg-white text-sm">
            <option value="popular">Phổ biến</option>
            <option value="newest">Mới nhất</option>
            <option value="priceAsc">Giá ↑</option>
            <option value="priceDesc">Giá ↓</option>
          </select>

          <label className="flex items-center gap-2 text-sm px-3 py-2 border rounded-xl bg-white">
            <input type="checkbox" checked={onlyAvail} onChange={e=>setOnlyAvail(e.target.checked)} />
            Chỉ món đang bán
          </label>

          <button onClick={()=>loadPage(true)} className="px-3 py-2 rounded-xl border bg-white text-sm">Làm mới</button>
          <button disabled={!hasMore || loading} onClick={()=>loadPage(false)}
            className="px-3 py-2 rounded-xl border bg-white text-sm disabled:opacity-50">
            {hasMore ? 'Tải thêm' : 'Hết dữ liệu'}
          </button>

          <button onClick={openAdd} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700">
            <Plus className="w-4 h-4 inline-block mr-1"/> Thêm món
          </button>
        </div>
      </div>

      {/* Chips danh mục */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['Tất cả', ...categories.filter((c,i,self)=>self.indexOf(c)===i)]).map(c => (
          <Chip key={c} active={category===c} onClick={()=>setCategory(c)}>{c}</Chip>
        ))}
      </div>

      {/* Grid */}
      {loading && items.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({length:8}).map((_,i)=><SkeletonCard key={i}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-slate-500">Không có món nào phù hợp bộ lọc.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(m => <ItemCard key={m.id} m={m} />)}
        </div>
      )}

      {showModal && (
        <MenuItemModal initial={editing} onClose={closeModal} onCreate={handleCreate} onUpdate={handleUpdate}/>
      )}
    </div>
  )
}

function InvoiceModal({ activeOrderId, activeTable, onClose, onPaid }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [paidPopup, setPaidPopup] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orders', activeOrderId, 'items'), snap => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      setItems(list)
      setLoading(false)
    })
    return () => unsub()
  }, [activeOrderId])

  const subTotal = items.reduce((s,i)=> s + Number(i.price||0) * Number(i.qty||1), 0)
  const tax = 0 // nếu cần VAT, đặt % và tính ở đây
  const grand = subTotal + tax
  const fmt = v => v.toLocaleString('vi-VN') + 'đ'

const confirmPay = async () => {
  try {
    await updateDoc(doc(db, 'orders', activeOrderId), {
      status: "PAID",
      total: grand,
      closedAt: serverTimestamp()
    })

    setPaidPopup(true) // ✅ bật popup
  } catch (e) {
    console.error(e)
  }
}


  const printBill = () => {
    // bản đơn giản: in toàn trang; nếu muốn in riêng khối bill => mở window + inject HTML
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-semibold">Hóa đơn</div>
              <div className="text-xs text-slate-500">
                Bàn: <b>{activeTable?.name || activeTable?.id}</b> — Order: <span className="font-mono">{activeOrderId}</span>
              </div>
            </div>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border">Đóng</button>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Đang tải hóa đơn…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Order hiện chưa có món.</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="p-2 text-left">Món</th>
                    <th className="p-2 text-right">Đơn giá</th>
                    <th className="p-2 text-center">SL</th>
                    <th className="p-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className="border-b">
                      <td className="p-2">{it.name}</td>
                      <td className="p-2 text-right">{fmt(Number(it.price||0))}</td>
                      <td className="p-2 text-center">{Number(it.qty||1)}</td>
                      <td className="p-2 text-right">{fmt(Number(it.price||0)*Number(it.qty||1))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex flex-col items-end gap-1 text-sm">
                <div>Tạm tính: <b>{fmt(subTotal)}</b></div>
                {/* <div>Thuế/VAT: <b>{fmt(tax)}</b></div> */}
                <div className="text-base">Tổng thanh toán: <b>{fmt(grand)}</b></div>
              </div>
            </>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button onClick={printBill} className="px-3 py-2 rounded-lg border">In hoá đơn</button>
            <button onClick={confirmPay} className="px-3 py-2 rounded-lg bg-emerald-600 text-white">Xác nhận thanh toán</button>
          </div>
        </div>
      </div>
      {paidPopup && (
  <SuccessPopup
    message={`Đã thanh toán & đóng order. Tổng: ${grand.toLocaleString()}đ`}
    onClose={() => {
      setPaidPopup(false)
      onPaid(grand)       // ✅ gọi callback bàn FREE + quay về Gọi món
    }}
  />
)}

    </div>
  )
}
function SuccessPopup({ message, onClose }) {
  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center animate-fadeIn">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <div className="text-lg font-semibold text-emerald-700 mb-1">
            Thành công
          </div>
          <div className="text-slate-600 text-sm mb-4">
            {message}
          </div>
          <button
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white w-full"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

function Staff({ user }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null) // null = thêm mới

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'staff'), (snap) => {
      const arr = []
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }))
      arr.sort((a,b)=> (a.name||'').localeCompare(b.name||''))
      setList(arr); setLoading(false)
    })
    return () => unsub()
  }, [])

  if (user?.role !== 'MANAGER') {
    return (
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="text-lg font-semibold">Nhân viên</div>
        <p className="text-sm text-slate-500 mt-2">Bạn không có quyền truy cập. Chỉ tài khoản Quản lý (MANAGER) mới xem/chỉnh được mục này.</p>
      </div>
    )
  }

  const openAdd = () => { setEditing(null); setShowModal(true) }
  const openEdit = (s) => { setEditing(s); setShowModal(true) }
  const closeModal = () => { setEditing(null); setShowModal(false) }

  const handleCreate = async (payload) => {
    await addDoc(collection(db, 'staff'), payload)
  }
  const handleUpdate = async (id, payload) => {
    await updateDoc(doc(db, 'staff', id), payload)
  }
  const handleDelete = async (id, name) => {
    if (!confirm(`Xóa nhân viên "${name}"?`)) return
    await deleteDoc(doc(db, 'staff', id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Nhân viên & Ca làm</h2>
        <button onClick={openAdd} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700">
          + Thêm nhân viên
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="p-3">Tên</th>
              <th className="p-3">Email</th>
              <th className="p-3">Vai trò</th>
              <th className="p-3">Ca</th>
              <th className="p-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3 text-slate-500" colSpan={5}>Đang tải…</td></tr>
            ) : list.length === 0 ? (
              <tr><td className="p-3 text-slate-500" colSpan={5}>Chưa có nhân viên</td></tr>
            ) : list.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{s.name}</td>
                <td className="p-3">{s.email}</td>
                <td className="p-3">{s.role}</td>
                <td className="p-3">{s.shift}</td>
                <td className="p-3 text-right">
                  <button onClick={()=>openEdit(s)} className="px-3 py-1.5 rounded-lg border mr-2">Sửa</button>
                  <button onClick={()=>handleDelete(s.id, s.name)} className="px-3 py-1.5 rounded-lg border text-rose-600">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <StaffModal initial={editing} onClose={closeModal} onCreate={handleCreate} onUpdate={handleUpdate}/>
      )}
    </div>
  )
}
function StaffModal({ initial, onClose, onCreate, onUpdate }) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [role, setRole] = useState(initial?.role || 'STAFF')  // MANAGER | STAFF | CASHIER
  const [shift, setShift] = useState(initial?.shift || 'Sáng') // Sáng | Chiều | Full
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    if (!name.trim()) return 'Vui lòng nhập tên'
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return 'Email không hợp lệ'
    if (!['MANAGER','STAFF','CASHIER'].includes(role)) return 'Vai trò không hợp lệ'
    return ''
  }

  const submit = async () => {
    const msg = validate()
    if (msg) { setError(msg); return }
    setError(''); setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        role,
        shift
      }
      if (isEdit) await onUpdate(initial.id, payload)
      else await onCreate(payload)
      onClose()
    } catch (e) {
      setError(e?.message || 'Lưu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{isEdit ? 'Sửa nhân viên' : 'Thêm nhân viên'}</div>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border">Đóng</button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-600">Tên</label>
              <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded-lg px-3 py-2"/>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-600">Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="vd: nhanvien@rms.vn"/>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Vai trò</label>
              <select value={role} onChange={e=>setRole(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                <option value="MANAGER">MANAGER</option>
                <option value="STAFF">STAFF</option>
                <option value="CASHIER">CASHIER</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Ca làm</label>
              <select value={shift} onChange={e=>setShift(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                <option value="Sáng">Sáng</option>
                <option value="Chiều">Chiều</option>
                <option value="Full">Full</option>
              </select>
            </div>
          </div>

          {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg border">Hủy</button>
            <button onClick={submit} disabled={submitting} className="px-3 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">
              {submitting ? 'Đang lưu…' : (isEdit ? 'Cập nhật' : 'Thêm mới')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MenuItemModal({ initial, onClose, onCreate, onUpdate }) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name || '')
  const [price, setPrice] = useState(initial?.price ?? '')
  const [category, setCategory] = useState(initial?.category || 'Khác')
  const [isAvailable, setIsAvailable] = useState(initial?.is_available ?? true)
  const [imageURL, setImageURL] = useState(initial?.imageURL || '')
  const [file, setFile] = useState(null)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null
    setFile(f)
  }

  const validate = () => {
    if (!name.trim()) return 'Vui lòng nhập tên món'
    const p = Number(price)
    if (price === '' || Number.isNaN(p) || p < 0) return 'Giá không hợp lệ'
    return ''
  }

  const uploadIfNeeded = async () => {
    if (!file) return imageURL
    const path = `menu_items/${Date.now()}_${file.name}`
    const r = ref(storage, path)
    await uploadBytes(r, file)
    return await getDownloadURL(r)
  }

  const submit = async () => {
    const msg = validate()
    if (msg) { setError(msg); return }
    setError(''); setSubmitting(true)
    try {
      const url = await uploadIfNeeded()
      const payload = {
        name: name.trim(),
        price: Number(price),
        category: category.trim() || 'Khác',
        is_available: !!isAvailable,
        imageURL: url || '',
      }
      if (isEdit) await onUpdate(initial.id, payload)
      else await onCreate(payload)
      onClose()
    } catch (e) {
      setError(e?.message || 'Lưu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{isEdit ? 'Sửa món' : 'Thêm món'}</div>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border">Đóng</button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-600">Tên món</label>
              <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded-lg px-3 py-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Giá (VND)</label>
              <input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)} className="w-full border rounded-lg px-3 py-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Danh mục</label>
              <input value={category} onChange={e=>setCategory(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Món chính / Khai vị / Đồ uống"/>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Trạng thái bán</label>
              <select value={isAvailable ? '1':'0'} onChange={e=>setIsAvailable(e.target.value==='1')} className="w-full border rounded-lg px-3 py-2">
                <option value="1">Đang bán</option>
                <option value="0">Tạm ngừng</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-600">Ảnh món (tùy chọn)</label>
              <input type="file" accept="image/*" onChange={handleFile} className="w-full"/>
              {(imageURL || file) && (
                <div className="mt-2 text-xs text-slate-500">
                  {file ? `Sẽ tải lên: ${file.name}` : 'Giữ ảnh hiện tại'}
                </div>
              )}
            </div>
          </div>

          {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg border">Hủy</button>
            <button onClick={submit} disabled={submitting} className="px-3 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">
              {submitting ? 'Đang lưu…' : (isEdit ? 'Cập nhật' : 'Thêm mới')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- App root -------------------------------- */

export default function App() {
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState('dashboard')
  const [booting, setBooting] = useState(true)

useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (u) => {
    try {
      if (!u) {
        setUser(null)
        setBooting(false)
        return
      }

      // Lấy role từ Firestore: users/{uid}
      const userRef = doc(db, 'users', u.uid)
      const snap = await getDoc(userRef)

      let role = 'STAFF'
      if (snap.exists() && snap.data()?.role) {
        role = String(snap.data().role).toUpperCase()
      } else {
        // fallback: nếu email thuộc danh sách admin => MANAGER
        const isEmailManager = MANAGER_EMAILS
          .map(e => e.toLowerCase())
          .includes(String(u.email || '').toLowerCase())
        role = isEmailManager ? 'MANAGER' : 'STAFF'
        await setDoc(userRef, { email: u.email || '', role }, { merge: true })
      }

      setUser({ uid: u.uid, email: u.email || 'user', role })
    } catch (e) {
      console.warn('Load role failed:', e)
      setUser({ uid: u?.uid, email: u?.email || 'user', role: 'STAFF' })
    } finally {
      setBooting(false)
    }
  })
  return () => unsub()
}, [])
  // ngữ cảnh gọi món
  const [activeTable, setActiveTable] = useState(null)
  const [activeOrderId, setActiveOrderId] = useState(null)

  if (booting) return <div className="min-h-screen grid place-items-center">Đang khởi tạo…</div>
  if (!user) return <Login onSuccess={setUser}/>

  return (
    <Shell user={user} route={route} setRoute={setRoute} onLogout={() => signOut(auth)}>
      <AnimatePresence mode="wait">
        {route==='dashboard' && (
          <motion.div key="dash" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}>
            <Dashboard/>
          </motion.div>
        )}

        {route==='order' && (
          <motion.div key="order" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}>
            <OrderTables
              setRoute={setRoute}
              setActiveTable={setActiveTable}
              setActiveOrderId={setActiveOrderId}
            />
          </motion.div>
        )}

        {route==='menu' && (
  <motion.div key="menu" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}>
    <Menu
      activeTable={activeTable}
      activeOrderId={activeOrderId}
      setActiveTable={setActiveTable}         // <-- thêm
      setActiveOrderId={setActiveOrderId}     // <-- thêm
      setRoute={setRoute}                     // <-- thêm
    />
  </motion.div>
)}

{route === 'staff' && String(user?.role || '').toUpperCase() === 'MANAGER' && (
  <motion.div key="staff" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}>
    <Staff user={user} />
  </motion.div>
)}


        {route==='reports' && (
          <motion.div key="reports" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}>
            <Reports/>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-8 text-xs text-slate-500">
        UI skeleton — Firebase Auth/Firestore/Storage đã gắn theo ERD cơ bản.
      </footer>
    </Shell>
  )
}
