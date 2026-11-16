'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Mail, Lock, Eye, EyeOff, X, Loader2 } from 'lucide-react'

type Props = { onClose?: () => void }

export function AuthModal({ onClose }: Props) {
  const supabase = createClient()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleGoogle = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } })
      if (error) setError(error.message)
      else setSuccess('Kiểm tra email để xác nhận tài khoản!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="auth-backdrop" role="presentation">
      <div className="auth-modal">
        <div className="auth-ambient-1"/><div className="auth-ambient-2"/>
        <div className="auth-header">
          <div className="auth-brand"><Sparkles size={22}/></div>
          <div>
            <p className="eyebrow">KHÔNG GIAN CỦA BẠN</p>
            <h2>{mode === 'signin' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h2>
            <p className="auth-subtitle">Đồng bộ lịch trình & thói quen trên mọi thiết bị.</p>
          </div>
          {onClose && <button className="icon-button auth-close" onClick={onClose} aria-label="Đóng"><X/></button>}
        </div>

        <button className="google-button" onClick={handleGoogle} disabled={loading}>
          {loading ? (
            <Loader2 size={17} className="spin"/>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
          )}
          Tiếp tục với Google
        </button>

        <div className="auth-divider"><span>hoặc</span></div>

        <form onSubmit={handleEmail} className="auth-form">
          <label>
            <Mail size={14}/>
            <input type="email" required placeholder="Email của bạn" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/>
          </label>
          <label className="pass-label">
            <Lock size={14}/>
            <input type={showPass ? 'text' : 'password'} required placeholder="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6}/>
            <button type="button" className="show-pass" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
              {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
            </button>
          </label>
          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <Loader2 size={15} className="spin"/> : null}
            {mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>

        <p className="auth-toggle">
          {mode === 'signin' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          {' '}<button onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess('') }}>
            {mode === 'signin' ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  )
}
