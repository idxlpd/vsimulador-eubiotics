import { FUENTES_GRASA, ESPECIES } from '../../constants';
import type { EspecieKey, FuenteGrasaKey } from '../../types';

interface Props {
  especie: EspecieKey;
  fuenteGrasa: FuenteGrasaKey;
  grasa_pct: number;
  precioGrasa: number;
  tieneCalentamiento: boolean;
  objetivo: 'kcal' | 'digestibilidad';
  onFuente: (v: FuenteGrasaKey) => void;
  onGrasaPct: (v: number) => void;
  onPrecioGrasa: (v: number) => void;
  onObjetivo: (v: 'kcal' | 'digestibilidad') => void;
}

export default function SeccionFuenteGrasa({
  especie, fuenteGrasa, grasa_pct, precioGrasa, tieneCalentamiento,
  objetivo, onFuente, onGrasaPct, onPrecioGrasa, onObjetivo
}: Props) {
  const especieData = ESPECIES[especie];
  const sustratoOk = grasa_pct >= especieData.grasamMin;
  const puedeKcal = especieData.puedeRecuperarEM && sustratoOk;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e0e0e0',
    borderRadius: 7, fontSize: 14, color: '#1B2B6B', fontWeight: 600,
    outline: 'none', boxSizing: 'border-box', background: '#fafafa'
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: '#888', textTransform: 'uppercase',
    letterSpacing: 0.5, fontWeight: 600, display: 'block', marginBottom: 5
  };

  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '24px 28px', marginBottom: 16, border: '1px solid #eee', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1B2B6B' }}>Fuente de grasa</div>
        <span style={{ fontSize: 11, color: '#aaa' }}>
          {FUENTES_GRASA[fuenteGrasa].label} · {FUENTES_GRASA[fuenteGrasa].digestibilidad}% dig
        </span>
      </div>

      {/* Botones fuente de grasa */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(FUENTES_GRASA).map(([k, v]) => {
          const disponible = tieneCalentamiento || v.liquido;
          return (
            <button key={k} onClick={() => disponible && onFuente(k as FuenteGrasaKey)}
              style={{
                flex: '1 1 80px', padding: '10px',
                border: `2px solid ${fuenteGrasa === k ? '#1B2B6B' : '#e0e0e0'}`,
                borderRadius: 7,
                background: !disponible ? '#f5f5f5' : fuenteGrasa === k ? '#1B2B6B' : '#fff',
                color: !disponible ? '#bbb' : fuenteGrasa === k ? '#fff' : '#555',
                fontWeight: 600, fontSize: 12,
                cursor: disponible ? 'pointer' : 'not-allowed',
                opacity: disponible ? 1 : 0.6
              }}>
              {v.label.replace('Aceite de ', '').replace('Aceite ', '')}
            </button>
          );
        })}
      </div>

      {/* Precio e inclusion */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Precio grasa ($/kg MXN)</label>
          <input type="number" value={precioGrasa}
            onChange={e => onPrecioGrasa(parseFloat(e.target.value))}
            style={inputStyle} step="0.5" />
        </div>
        <div>
          <label style={labelStyle}>Inclusion min. grasa (%)</label>
          <input type="number" value={grasa_pct}
            onChange={e => onGrasaPct(parseFloat(e.target.value))}
            style={inputStyle} step="0.5" min="0" max="15" />
        </div>
      </div>

      {/* Selector de objetivo */}
      <div>
        <label style={labelStyle}>Objetivo del emulsificante</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

          {/* Opcion: Recuperar Kcal EM */}
          <button
            onClick={() => puedeKcal && onObjetivo('kcal')}
            style={{
              flex: '1 1 180px', padding: '12px 16px', borderRadius: 8,
              border: `2px solid ${objetivo === 'kcal' ? '#1B2B6B' : '#e0e0e0'}`,
              background: objetivo === 'kcal' ? '#1B2B6B' : (!puedeKcal ? '#f9f9f9' : '#fff'),
              color: objetivo === 'kcal' ? '#fff' : (!puedeKcal ? '#bbb' : '#333'),
              cursor: puedeKcal ? 'pointer' : 'not-allowed',
              opacity: puedeKcal ? 1 : 0.5,
              textAlign: 'left'
            }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
              Recuperar Kcal EM
            </div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              Reduce costo de formulacion · sustrato {'>='} {especieData.grasamMin}%
            </div>
            {!puedeKcal && (
              <div style={{ fontSize: 10, color: objetivo === 'kcal' ? '#ffcdd2' : '#e57373', marginTop: 4 }}>
                {!especieData.puedeRecuperarEM
                  ? 'No disponible para esta especie'
                  : `Sustrato insuficiente (${grasa_pct}% < ${especieData.grasamMin}% min)`}
              </div>
            )}
          </button>

          {/* Opcion: Mejorar digestibilidad */}
          <button
            onClick={() => onObjetivo('digestibilidad')}
            style={{
              flex: '1 1 180px', padding: '12px 16px', borderRadius: 8,
              border: `2px solid ${objetivo === 'digestibilidad' ? '#C5D92D' : '#e0e0e0'}`,
              background: objetivo === 'digestibilidad' ? '#f9fce6' : '#fff',
              color: objetivo === 'digestibilidad' ? '#3a4a00' : '#333',
              cursor: 'pointer',
              textAlign: 'left'
            }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
              Mejorar digestibilidad de grasa
            </div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              Mejora aprovechamiento · {FUENTES_GRASA[fuenteGrasa].digestibilidad}% dig actual
            </div>
          </button>

        </div>

        {/* Mensaje de estado */}
        <div style={{
          marginTop: 12, padding: '8px 14px',
          background: objetivo === 'kcal' ? '#e8f5e9' : '#f5f5f5',
          borderLeft: `3px solid ${objetivo === 'kcal' ? '#C5D92D' : '#ccc'}`,
          borderRadius: '0 6px 6px 0', fontSize: 12,
          color: objetivo === 'kcal' ? '#1B5E20' : '#888'
        }}>
          {objetivo === 'kcal'
            ? `Modo EM activo: recupera kcal metabolizables y reduce costo de formulacion. Sustrato >= ${especieData.grasamMin}% de grasa requerido.`
            : `Modo digestibilidad: el emulsificante mejora el aprovechamiento de la grasa (${FUENTES_GRASA[fuenteGrasa].digestibilidad}% dig). Aplica a todos los programas Lipotex.`}
        </div>
      </div>

    </div>
  );
}
