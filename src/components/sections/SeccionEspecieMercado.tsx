import { ESPECIES, MERCADOS } from '../../constants';
import type { EspecieKey } from '../../types';

interface Props {
  especie: EspecieKey;
  mercado: string;
  tieneCalentamiento: boolean;
  onEspecie: (v: EspecieKey) => void;
  onMercado: (v: string) => void;
  onCalentamiento: (v: boolean) => void;
}

export default function SeccionEspecieMercado({ especie, mercado, tieneCalentamiento, onEspecie, onMercado, onCalentamiento }: Props) {
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, display: 'block', marginBottom: 5 };

  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '24px 28px', marginBottom: 16, border: '1px solid #eee', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1B2B6B', marginBottom: 4 }}>Especie y mercado</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            {especie === 'pollo' ? 'Pollo de Engorda MX 3,100–3,200 kcal/kg' : especie === 'gallina' ? 'Gallina de postura' : 'Cerdo'}
          </div>
        </div>
        <select value={mercado} onChange={e => onMercado(e.target.value)}
          style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#555', background: '#fafafa' }}>
          {MERCADOS.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(ESPECIES).map(([k, v]) => (
          <button key={k} onClick={() => onEspecie(k as EspecieKey)}
            style={{ flex: '1 1 100px', padding: '10px', border: `2px solid ${especie === k ? '#1B2B6B' : '#e0e0e0'}`, borderRadius: 7, background: especie === k ? '#1B2B6B' : '#fff', color: especie === k ? '#fff' : '#555', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {v.label}
          </button>
        ))}
      </div>

      <div>
        <span style={labelStyle}>Capacidad de planta</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onCalentamiento(false)}
            style={{ flex: '1 1 140px', padding: '9px', border: `2px solid ${!tieneCalentamiento ? '#C5D92D' : '#e0e0e0'}`, borderRadius: 7, background: !tieneCalentamiento ? '#C5D92D' : '#fff', color: !tieneCalentamiento ? '#1B2B6B' : '#555', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            Solo grasas líquidas
          </button>
          <button onClick={() => onCalentamiento(true)}
            style={{ flex: '1 1 140px', padding: '9px', border: `2px solid ${tieneCalentamiento ? '#C5D92D' : '#e0e0e0'}`, borderRadius: 7, background: tieneCalentamiento ? '#C5D92D' : '#fff', color: tieneCalentamiento ? '#1B2B6B' : '#555', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            Tiene calentamiento
          </button>
        </div>
        {!tieneCalentamiento && (
          <div style={{ marginTop: 12, background: '#e8f4f8', borderLeft: '3px solid #2196F3', borderRadius: '0 6px 6px 0', padding: '8px 14px', fontSize: 12, color: '#1565C0' }}>
            Sin calentamiento: solo aceite de soya y acidulado disponibles.
          </div>
        )}
      </div>
    </div>
  );
}