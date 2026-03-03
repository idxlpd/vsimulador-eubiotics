import { useState } from 'react';
import EubioticsLogo from './EubioticsLogo';
import { USERS } from '../constants';
import type { User } from '../types';

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const user = USERS.find(u => u.id === id.trim() && u.password === pw);
      if (user) {
        onLogin(user);
      } else {
        setError('Usuario o contraseña incorrectos.');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f1e4a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', sans-serif", padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
        <div style={{ background: '#1B2B6B', padding: '36px 40px 28px', textAlign: 'center' }}>
          <EubioticsLogo size={36} />
          <p style={{ color: '#C5D92D', margin: '12px 0 0', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Simulador de Escenarios</p>
        </div>
        <div style={{ padding: '36px 40px 40px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Usuario</label>
              <input value={id} onChange={e => { setId(e.target.value); setError(''); }}
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #ddd', borderRadius: 7, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#1B2B6B'}
                onBlur={e => e.target.style.borderColor = '#ddd'}
                placeholder="Ingresa tu usuario" autoComplete="username" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contraseña</label>
              <input type="password" value={pw} onChange={e => { setPw(e.target.value); setError(''); }}
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #ddd', borderRadius: 7, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#1B2B6B'}
                onBlur={e => e.target.style.borderColor = '#ddd'}
                placeholder="Contraseña" autoComplete="current-password" />
            </div>
            {error && <div style={{ background: '#fff3f3', border: '1px solid #fcc', borderRadius: 6, padding: '10px 14px', color: '#c0392b', fontSize: 13, marginBottom: 18 }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 13, background: loading ? '#ccc' : '#1B2B6B', color: '#fff', border: 'none', borderRadius: 7, fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#aaa' }}>Eubiotics Latinoamericana © 2026</p>
        </div>
      </div>
    </div>
  );
}