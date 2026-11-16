'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlarmClock, ArrowLeft, ArrowRight, Bell, Bold, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, FileText, Flame, Folder, Italic, List, LogOut, Menu, Moon, MoreHorizontal, Pause, Play, Plus, Search, Settings, Sparkles, Sun, Trash2, TrendingUp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthModal } from './auth-modal'
import { useAuth } from '@/hooks/use-auth'
import type { User } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────
type EventItem = { id: string; title: string; start: string; end: string; color: string; date: string }
type Task = { id: string; title: string; done: boolean }
type Habit = { id: string; title: string; kind: 'must' | 'avoid'; done: boolean; days: boolean[] }
type MobileTab = 'cal' | 'work' | 'focus'

// ── Helpers ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10)
const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// ── Seed data (shown before sign-in / as defaults) ─────────────────────────
const seedEvents = (date: string): EventItem[] => [
  { id: 'e1', title: 'Lên kế hoạch tuần', start: '08:00', end: '09:00', color: 'violet', date },
  { id: 'e2', title: 'Thời gian tập trung', start: '09:30', end: '11:00', color: 'mint', date },
  { id: 'e3', title: 'Đánh giá thiết kế', start: '13:00', end: '14:30', color: 'rose', date },
  { id: 'e4', title: 'Deep Work – dự án', start: '15:00', end: '16:30', color: 'blue', date },
]
const seedTasks: Task[] = [
  { id: 't1', title: 'Hoàn thiện bản thiết kế', done: true },
  { id: 't2', title: 'Gửi cập nhật cho nhóm', done: true },
  { id: 't3', title: 'Đọc 15 phút', done: false },
]
const seedHabits: Habit[] = [
  { id: 'h1', title: 'Đọc sách 15 phút', kind: 'must', done: true, days: [true, true, true, true, false, false, false] },
  { id: 'h2', title: 'Uống đủ nước', kind: 'must', done: false, days: [true, true, false, true, true, false, false] },
  { id: 'h3', title: 'Lướt mạng vô thức', kind: 'avoid', done: false, days: [true, true, true, false, true, true, false] },
]
const DEFAULT_NOTES = 'Hôm nay, mình sẽ tập trung vào điều quan trọng nhất.\n\nMột bước nhỏ cũng tạo nên khác biệt.'

// ── Main Component ─────────────────────────────────────────────────────────
export function ProductivityDashboard() {
  const supabase = createClient()
  const { user, loading: authLoading, signOut } = useAuth()

  // UI state
  const [dark, setDark] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('cal')

  // Data state
  const [date, setDate] = useState(new Date())
  const [events, setEvents] = useState<EventItem[]>([])
  const [tasks, setTasks] = useState<Task[]>(seedTasks)
  const [habits, setHabits] = useState<Habit[]>(seedHabits)
  const [notes, setNotes] = useState(DEFAULT_NOTES)
  const [sessions, setSessions] = useState<number[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Form state
  const [taskInput, setTaskInput] = useState('')
  const [habitInput, setHabitInput] = useState('')
  const [habitKind, setHabitKind] = useState<'must' | 'avoid'>('must')
  const [modal, setModal] = useState<{ title: string; start: string; end: string; id?: string } | null>(null)
  const [query, setQuery] = useState('')

  // Timer state
  const [duration, setDuration] = useState(25 * 60)
  const [remaining, setRemaining] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [zen, setZen] = useState(false)

  // Notes debounce ref
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dateId = todayKey(date)

  // ── Load data from Supabase when user signs in ─────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // Not signed in — load from localStorage as fallback
      try {
        const saved = localStorage.getItem('ritmo-productivity-v1')
        if (saved) {
          const data = JSON.parse(saved)
          setDark(data.dark ?? true)
          setEvents(data.events?.length ? data.events : seedEvents(todayKey()))
          setTasks(data.tasks ?? seedTasks)
          setHabits(data.habits ?? seedHabits)
          setNotes(data.notes ?? DEFAULT_NOTES)
          setSessions(data.sessions ?? [])
        } else {
          setEvents(seedEvents(todayKey()))
        }
      } catch { setEvents(seedEvents(todayKey())) }
      setHydrated(true)
      return
    }

    // Signed in — load from Supabase
    const loadAll = async () => {
      const today = todayKey()
      const [eventsRes, tasksRes, habitsRes, notesRes, logsRes, sessionsRes] = await Promise.all([
        supabase.from('calendar_events').select('*').eq('user_id', user.id),
        supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('notes').select('*').eq('user_id', user.id).single(),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('log_date', today),
        supabase.from('pomodoro_sessions').select('completed_at').eq('user_id', user.id)
          .gte('completed_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
      ])

      if (eventsRes.data?.length) {
        setEvents(eventsRes.data.map(e => ({
          id: e.id, title: e.title, date: e.date,
          start: e.start_time?.slice(0, 5) ?? '09:00',
          end: e.end_time?.slice(0, 5) ?? '10:00',
          color: e.color ?? 'violet',
        })))
      } else {
        setEvents(seedEvents(today))
      }

      if (tasksRes.data?.length) {
        setTasks(tasksRes.data.map(t => ({ id: t.id, title: t.title, done: t.is_completed })))
      }

      if (habitsRes.data?.length) {
        const logs = logsRes.data ?? []
        setHabits(habitsRes.data.map(h => ({
          id: h.id,
          title: h.title,
          kind: h.type === 'must_do' ? 'must' : 'avoid',
          done: logs.some(l => l.habit_id === h.id && l.status === 'completed'),
          days: [false, false, false, false, false, false, false],
        })))
      }

      if (notesRes.data) setNotes(notesRes.data.content ?? DEFAULT_NOTES)

      if (sessionsRes.data?.length) setSessions(sessionsRes.data.map(s => new Date(s.completed_at).getTime()))

      setHydrated(true)
    }
    loadAll()
  }, [user, authLoading])

  // ── Save dark preference to localStorage (lightweight) ─────────────────
  useEffect(() => {
    if (hydrated && !user) {
      localStorage.setItem('ritmo-productivity-v1', JSON.stringify({ dark, events, tasks, habits, notes, sessions }))
    }
  }, [dark, events, tasks, habits, notes, sessions, hydrated, user])

  // ── Timer countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setRemaining(v => {
      if (v <= 1) {
        setRunning(false)
        const now = Date.now()
        setSessions(c => [now, ...c])
        // Save pomodoro session to Supabase
        if (user) {
          supabase.from('pomodoro_sessions').insert({
            user_id: user.id,
            duration_minutes: Math.round(duration / 60),
          }).then(() => {})
        }
        return 0
      }
      return v - 1
    }), 1000)
    return () => window.clearInterval(timer)
  }, [running])

  // ── Computed ───────────────────────────────────────────────────────────
  const displayedEvents = events.filter(e => e.date === dateId).sort((a, b) => a.start.localeCompare(b.start))
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(date); d.setDate(date.getDate() - 3 + i); return d }), [date])
  const dayLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const filteredTasks = tasks.filter(t => t.title.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))

  // ── Supabase mutations ─────────────────────────────────────────────────
  const setPreset = (minutes: number) => { setRunning(false); setDuration(minutes * 60); setRemaining(minutes * 60) }

  const addEvent = async () => {
    if (!modal?.title.trim()) return
    const color = ['violet', 'mint', 'rose', 'blue'][displayedEvents.length % 4]
    if (modal.id) {
      // Update optimistically
      setEvents(prev => prev.map(e => e.id === modal.id ? { ...e, title: modal.title, start: modal.start, end: modal.end } : e))
      if (user) {
        await supabase.from('calendar_events').update({
          title: modal.title, start_time: modal.start, end_time: modal.end,
        }).eq('id', modal.id).eq('user_id', user.id)
      }
    } else {
      const newEvent: EventItem = { ...modal, id: uid(), color, date: dateId }
      setEvents(prev => [...prev, newEvent])
      if (user) {
        const { data } = await supabase.from('calendar_events').insert({
          user_id: user.id, title: modal.title, date: dateId,
          start_time: modal.start, end_time: modal.end, color,
        }).select('id').single()
        // Update with real DB id
        if (data) setEvents(prev => prev.map(e => e.id === newEvent.id ? { ...e, id: data.id } : e))
      }
    }
    setModal(null)
  }

  const deleteEvent = async (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
    if (user) await supabase.from('calendar_events').delete().eq('id', id).eq('user_id', user.id)
  }

  const addTask = async (title: string) => {
    const newTask: Task = { id: uid(), title, done: false }
    setTasks(prev => [...prev, newTask])
    if (user) {
      const { data } = await supabase.from('tasks').insert({ user_id: user.id, title }).select('id').single()
      if (data) setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, id: data.id } : t))
    }
  }

  const toggleTask = async (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
    if (user) await supabase.from('tasks').update({ is_completed: !task.done }).eq('id', task.id).eq('user_id', user.id)
  }

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    if (user) await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id)
  }

  const addHabit = async (title: string, kind: 'must' | 'avoid') => {
    const newHabit: Habit = { id: uid(), title, kind, done: false, days: [false, false, false, false, false, false, false] }
    setHabits(prev => [...prev, newHabit])
    if (user) {
      const { data } = await supabase.from('habits').insert({
        user_id: user.id, title, type: kind === 'must' ? 'must_do' : 'avoid',
      }).select('id').single()
      if (data) setHabits(prev => prev.map(h => h.id === newHabit.id ? { ...h, id: data.id } : h))
    }
  }

  const toggleHabit = async (habit: Habit) => {
    const newDone = !habit.done
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, done: newDone } : h))
    if (user) {
      const today = todayKey()
      await supabase.from('habit_logs').upsert({
        user_id: user.id, habit_id: habit.id, log_date: today,
        status: newDone ? 'completed' : 'clean',
      }, { onConflict: 'habit_id,log_date' })
    }
  }

  const deleteHabit = async (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id))
    if (user) await supabase.from('habits').delete().eq('id', id).eq('user_id', user.id)
  }

  const saveNotes = useCallback((content: string) => {
    setNotes(content)
    if (!user) return
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      await supabase.from('notes').upsert({ user_id: user.id, content, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    }, 800)
  }, [user])

  const scheduleTask = (task: Task) => setModal({ title: task.title, start: '10:00', end: '11:00' })

  // ── Mobile tab CSS class ──────────────────────────────────────────────
  const tabClass = `tab-${mobileTab}`

  // ── User display info ─────────────────────────────────────────────────
  const userInitial = user?.email?.[0]?.toUpperCase() ?? 'A'
  const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Anh Nguyễn'

  if (!hydrated) return null

  return (
    <main className={`app-shell ${dark ? 'theme-dark' : 'theme-light'} ${zen && running ? 'zen-mode' : ''}`}>
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)}/>}

      <div className="workspace">
        <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
          <div className="window-dots"><i/><i/><i/></div>
          <button className="brand-mark" aria-label="Trang chủ"><Sparkles size={21}/></button>
          <button className="collapse-button icon-button" aria-label="Thu gọn thanh bên" onClick={() => setSidebarOpen(!sidebarOpen)}><ChevronDown size={16}/></button>
          <nav className="side-nav" aria-label="Điều hướng chính">
            <button className="nav-item"><Folder/><span>Không gian</span></button>
            <button className="nav-item active"><CalendarDays/><span>Lịch trình ngày</span></button>
            <button className="nav-item"><TrendingUp/><span>Phân tích</span></button>
            <button className="nav-item"><Settings/><span>Cài đặt</span></button>
          </nav>
          <div className="sidebar-bottom">
            <button className="nav-item"><CircleHelp/><span>Trợ giúp</span></button>
            {user ? (
              <div className="profile">
                <div className="avatar">{userInitial}</div>
                <span>{userName}</span>
                <button className="icon-button" aria-label="Đăng xuất" onClick={signOut} style={{marginLeft:'auto'}}><LogOut size={15}/></button>
              </div>
            ) : (
              <div className="profile">
                <div className="avatar">?</div>
                <button className="text-button" onClick={() => setShowAuth(true)}>Đăng nhập</button>
              </div>
            )}
          </div>
        </aside>

        <section className="main-area">
          <header className="topbar">
            <div className="date-controls">
              <button className="icon-button" aria-label="Ngày trước" onClick={() => setDate(d => new Date(d.getTime() - 86400000))}><ArrowLeft/></button>
              <button className="icon-button" aria-label="Ngày sau" onClick={() => setDate(d => new Date(d.getTime() + 86400000))}><ArrowRight/></button>
              <span className="top-date">{dayLabel}</span>
            </div>
            <div className="top-actions">
              <label className="search-box">
                <Search size={17}/>
                <input aria-label="Tìm kiếm việc cần làm" placeholder="Tìm kiếm..." value={query} onChange={e => setQuery(e.target.value)}/>
                {query && <button aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={14}/></button>}
              </label>
              <button className="icon-button notification-button" aria-label="Thông báo"><Bell/><i/></button>
              <button className="icon-button theme-toggle" aria-label={dark ? 'Chuyển sáng' : 'Chuyển tối'} onClick={() => setDark(!dark)}>{dark ? <Sun/> : <Moon/>}</button>
              {!user && <button className="icon-button" aria-label="Đăng nhập" onClick={() => setShowAuth(true)} title="Đăng nhập / Đăng ký"><Sparkles size={17}/></button>}
              <button className="mobile-menu icon-button" aria-label="Mở thanh bên" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu/></button>
            </div>
          </header>

          <div className={`dashboard-grid ${tabClass}`}>
            {/* ── Column 1: Schedule ── */}
            <section className="glass-card schedule-card">
              <div className="card-heading"><div><p className="eyebrow">KẾ HOẠCH CỦA BẠN</p><h1>Lịch trình ngày</h1></div><button className="icon-button small-icon" aria-label="Thêm lịch trình" onClick={() => setModal({ title: '', start: '09:00', end: '10:00' })}><Plus/></button></div>
              <div className="week-strip">{week.map(day => <button key={day.toISOString()} className={`day-cell ${todayKey(day) === dateId ? 'selected' : ''}`} onClick={() => setDate(day)}><span>{['CN','T2','T3','T4','T5','T6','T7'][day.getDay()]}</span><b>{day.getDate()}</b></button>)}</div>
              <div className="timeline-scroll"><div className="timeline">
                {Array.from({ length: 17 }, (_, i) => i + 7).map(hour => <div key={hour} className="time-row"><span className="time-label">{String(hour).padStart(2,'0')}:00</span><button className="time-slot" aria-label={`Thêm việc lúc ${String(hour).padStart(2,'0')}:00`} onClick={() => setModal({ title:'', start:`${String(hour).padStart(2,'0')}:00`, end:`${String(Math.min(hour+1,23)).padStart(2,'0')}:00` })}/></div>)}
                {displayedEvents.map(event => {
                  const start = Number(event.start.slice(0,2)) + Number(event.start.slice(3))/60
                  const end = Number(event.end.slice(0,2)) + Number(event.end.slice(3))/60
                  const top = Math.max(0,(start-7)*58); const height = Math.max(43,(end-start)*58)
                  return <button key={event.id} className={`event-block event-${event.color}`} style={{top:`${top}px`,height:`${height}px`}} onClick={() => setModal({...event})}><b>{event.title}</b><span>{event.start} – {event.end}</span><button className="event-delete" aria-label={`Xóa ${event.title}`} onClick={e => { e.stopPropagation(); deleteEvent(event.id) }}><X size={13}/></button></button>
                })}
              </div></div>
              <div className="schedule-foot"><span><span className="live-dot"/> Hôm nay</span><button className="text-button" onClick={() => setDate(new Date())}>Về hôm nay</button></div>
            </section>

            {/* ── Column 2: Notes + Tasks + Habits ── */}
            <div className="middle-column">
              <section className="glass-card notes-tasks-card">
                <div className="notes-panel">
                  <div className="section-title"><div><p className="eyebrow">GHI LẠI Ý TƯỞNG</p><h2>Ghi chú nhanh</h2></div><FileText size={17}/></div>
                  <div className="format-toolbar"><button aria-label="In đậm" onClick={() => document.execCommand('bold')}><Bold/></button><button aria-label="In nghiêng" onClick={() => document.execCommand('italic')}><Italic/></button><button aria-label="Danh sách" onClick={() => document.execCommand('insertUnorderedList')}><List/></button><span className="save-indicator"><Check size={12}/> Tự lưu</span></div>
                  <textarea aria-label="Nội dung ghi chú" value={notes} onChange={e => saveNotes(e.target.value)} placeholder="Viết xuống những điều đang nghĩ..."/>
                </div>
                <div className="tasks-panel">
                  <div className="section-title"><div><p className="eyebrow">TẬP TRUNG VÀO ĐIỀU QUAN TRỌNG</p><h2>Danh sách việc</h2></div><span className="task-count">{tasks.filter(t=>t.done).length}/{tasks.length}</span></div>
                  <form className="add-task-form" onSubmit={e => { e.preventDefault(); if (taskInput.trim()) { addTask(taskInput.trim()); setTaskInput('') } }}><input aria-label="Tên việc mới" value={taskInput} onChange={e => setTaskInput(e.target.value)} placeholder="Thêm việc mới..."/><button aria-label="Thêm việc" type="submit"><Plus size={16}/></button></form>
                  <div className="task-list">{filteredTasks.map(task => <div className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}><button className="check-control" aria-label={task.done ? `Đánh dấu chưa xong: ${task.title}` : `Hoàn thành: ${task.title}`} onClick={() => toggleTask(task)}>{task.done && <Check size={12}/>}</button><span>{task.title}</span><button className="schedule-task" aria-label={`Lên lịch ${task.title}`} onClick={() => scheduleTask(task)}><CalendarDays size={14}/></button><button className="delete-task" aria-label={`Xóa ${task.title}`} onClick={() => deleteTask(task.id)}><Trash2 size={14}/></button></div>)}</div>
                  <div className="task-footer"><span><Flame size={13}/> Đang vào guồng</span><span>{Math.max(0,tasks.length-tasks.filter(t=>t.done).length)} việc còn lại</span></div>
                </div>
              </section>

              <section className="glass-card habit-card">
                <div className="card-heading habit-heading"><div><p className="eyebrow">NHỮNG ĐIỀU NHỎ MỖI NGÀY</p><h2>Theo dõi thói quen</h2></div></div>
                <div className="habit-columns">{(['must','avoid'] as const).map(kind => <div className={`habit-tile ${kind}`} key={kind}><div className="habit-tile-header"><div><span className="habit-symbol">{kind==='must'?<Check size={14}/>:<X size={14}/>}</span><h3>{kind==='must'?'Bắt buộc làm':'Cần tránh'}</h3></div><button className="icon-button tiny-icon" aria-label={`Thêm thói quen ${kind==='must'?'bắt buộc':'cần tránh'}`} onClick={() => { const title=prompt(kind==='must'?'Thói quen cần duy trì?':'Thói quen cần tránh?'); if(title?.trim()) addHabit(title.trim(), kind) }}><Plus size={14}/></button></div><div className="habit-items">{habits.filter(h=>h.kind===kind).map(habit=><div className="habit-item" key={habit.id}><button className={`habit-check ${habit.done?'checked':''}`} aria-label={`${habit.done?'Bỏ đánh dấu':'Đánh dấu'} ${habit.title}`} onClick={()=>toggleHabit(habit)}>{habit.done&&<Check size={12}/>}</button><span className={habit.done?'habit-complete':''}>{habit.title}</span><button className="habit-delete" aria-label={`Xóa ${habit.title}`} onClick={()=>deleteHabit(habit.id)}><X size={13}/></button></div>)}</div><div className="habit-dots" aria-label="Tiến độ 7 ngày">{(habits.find(h=>h.kind===kind)?.days??[false,false,false,false,false,false,false]).map((c,i)=><i key={i} className={c?'filled':''}/>)}</div><div className="habit-streak"><span>{kind==='must'?'Chuỗi ngày tích cực':'Chuỗi ngày kỷ luật'}</span><b><Flame size={13}/> {habits.filter(h=>h.kind===kind&&h.done).length+3} ngày</b></div></div>)}</div>
                <form className="habit-add" onSubmit={e => { e.preventDefault(); if(habitInput.trim()) { addHabit(habitInput.trim(), habitKind); setHabitInput('') } }}><select aria-label="Loại thói quen" value={habitKind} onChange={e=>setHabitKind(e.target.value as 'must'|'avoid')}><option value="must">Bắt buộc</option><option value="avoid">Cần tránh</option></select><input aria-label="Tên thói quen" value={habitInput} onChange={e=>setHabitInput(e.target.value)} placeholder="Thêm thói quen..."/><button type="submit"><Plus size={15}/> Thêm</button></form>
              </section>
            </div>

            {/* ── Column 3: Deep Work / Pomodoro ── */}
            <section className="glass-card focus-card">
              <div className="focus-top"><div><p className="eyebrow">KHOẢNG LẶNG CỦA BẠN</p><h2>Deep Work</h2><p className="focus-subtitle">Từng phút tập trung tạo nên khác biệt.</p></div><button className="icon-button small-icon" aria-label="Tùy chọn Deep Work" onClick={()=>setZen(!zen)}><MoreHorizontal/></button></div>
              <div className="timer-area">
                <div className={`timer-ring ${running?'timer-running':''}`}><svg viewBox="0 0 220 220" aria-hidden="true"><circle className="ring-track" cx="110" cy="110" r="96"/><circle className="ring-progress" cx="110" cy="110" r="96" style={{strokeDashoffset:`${603*(1-remaining/duration)}`}}/></svg><div className="timer-center"><span className="timer-digits">{formatTime(remaining)}</span><span className="timer-caption">{running?'ĐANG TẬP TRUNG':remaining===0?'HOÀN THÀNH':'SẴN SÀNG'}</span></div></div>
                <div className="timer-presets"><button className={duration===1500?'preset-active':''} onClick={()=>setPreset(25)}>25 phút <span>Tập trung</span></button><button className={duration===3000?'preset-active':''} onClick={()=>setPreset(50)}>50 phút <span>Chuyên sâu</span></button><button className={duration===300?'preset-active':''} onClick={()=>setPreset(5)}>5 phút <span>Nghỉ ngắn</span></button></div>
                <div className="timer-actions"><button className="start-button" onClick={()=>{ if(remaining===0) setRemaining(duration); setRunning(!running) }}>{running?<><Pause size={17}/> Tạm dừng</>:<><Play size={17} fill="currentColor"/> Bắt đầu</>}</button><button className="reset-button" aria-label="Đặt lại đồng hồ" onClick={()=>{ setRunning(false); setRemaining(duration) }}><AlarmClock size={17}/></button></div>
                <label className="zen-toggle"><span>Chế độ Zen</span><input type="checkbox" checked={zen} onChange={e=>setZen(e.target.checked)}/><i/></label>
              </div>
              <div className="session-card">
                <div className="session-header"><div><span className="session-dot"/><b>Phiên hôm nay</b></div><span>{sessions.length} hoàn thành</span></div>
                <div className="session-track">{Array.from({length:6},(_,i)=><div className={`session-cell ${i<sessions.length?'session-complete':''}`} key={i}>{i<sessions.length?<Check size={15}/>:<span>{String(i+1).padStart(2,'0')}</span>}</div>)}</div>
                <p className="session-caption">{sessions.length?`${sessions.length*25} phút tập trung hôm nay`:'Bắt đầu phiên đầu tiên của bạn'}</p>
              </div>
            </section>
          </div>
          <footer className="footer-note"><span>Thở sâu. Làm từng việc một.</span><span>Được tạo cho một ngày thật tốt <Sparkles size={13}/></span></footer>
        </section>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="mobile-bottom-nav" aria-label="Điều hướng mobile">
        <button className={mobileTab==='cal'?'active':''} onClick={()=>setMobileTab('cal')}>
          <CalendarDays/> Lịch <div className="nav-dot"/>
        </button>
        <button className={mobileTab==='work'?'active':''} onClick={()=>setMobileTab('work')}>
          <FileText/> Việc &amp; Thói quen <div className="nav-dot"/>
        </button>
        <button className={mobileTab==='focus'?'active':''} onClick={()=>setMobileTab('focus')}>
          <Clock3/> Deep Work <div className="nav-dot"/>
        </button>
      </nav>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{ if(e.target===e.currentTarget) setModal(null) }}><form className="event-modal" onSubmit={e=>{ e.preventDefault(); addEvent() }}><div className="modal-heading"><div><p className="eyebrow">LỊCH TRÌNH CỦA BẠN</p><h2>{modal.id?'Chỉnh sửa lịch':'Tạo lịch mới'}</h2></div><button type="button" className="icon-button" aria-label="Đóng" onClick={()=>setModal(null)}><X/></button></div><label>Tên hoạt động<input autoFocus required value={modal.title} onChange={e=>setModal({...modal,title:e.target.value})} placeholder="Ví dụ: Tập trung làm việc"/></label><div className="modal-time-row"><label>Bắt đầu<input type="time" value={modal.start} onChange={e=>setModal({...modal,start:e.target.value})}/></label><label>Kết thúc<input type="time" value={modal.end} onChange={e=>setModal({...modal,end:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={()=>setModal(null)}>Hủy</button>{modal.id&&<button type="button" className="modal-delete" onClick={()=>{ deleteEvent(modal.id!); setModal(null) }}>Xóa lịch</button>}<button type="submit" className="save-button">Lưu lịch trình</button></div></form></div>}
    </main>
  )
}
