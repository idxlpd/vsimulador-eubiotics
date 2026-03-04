import EubioticsLogo from './EubioticsLogo';
import type { User } from '../types';

interface Props {
  user: User;
  onLogout: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
}

export default function Header({ user, onLogout, onExportPDF, onExportCSV }: Props) {
  const btnBase: React.CSSProperties = {
    border: 'none', borderRadius: 6, padding: '5px 14px',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex',
    alignItems: 'center', gap: 5,
  };
  return (
    <div style={{ background: '#1B2B6B', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <EubioticsLogo size={22} />
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: 0.2 }}>Simulador de Escenarios</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{user.name}</span>
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)' }} />
        <button onClick={onExportCSV} style={{ ...btnBase, background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
          ⬇ CSV
        </button>
        <button onClick={onExportPDF} style={{ ...btnBase, background: '#C5D92D', color: '#1B2B6B' }}>
          ⬇ PDF
        </button>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
