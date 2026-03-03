import { fmtInt } from '../../utils';

export type ObjetivoTipo = 'kgProd' | 'ave' | 'tonAlim';

interface Props {
  totalAves: number;
  pesoVivo: number;
  fcr: number;
  precioAlimento: number;
  precioEstandar: number;
  precioLipotex250: number;
  precioLipotex350: number;
  precioLipotexM: number;
  emKcalLX250: number;
  emKcalLX350: number;
  emKcalLXM: number;
  puedeMetodoA: boolean;
  objetivoTipo: ObjetivoTipo;
  objetivoValor: number | null;
  onObjetivoTipo: (v: ObjetivoTipo) => void;
  onObjetivoValor: (v: number | null) => void;
  onTotalAves: (v: number) => void;
  onPesoVivo: (v: number) => void;
  onFcr: (v: number) => void;
  onPrecioAlimento: (v: number) => void;
  onPrecioEstandar: (v: number) => void;
  onPrecioLipotex250: (v: number) => void;
  onPrecioLipotex350: (v: number) => void;
  onPrecioLipotexM: (v: number) => void;
  onEmKcalLX250: (v: number) => void;
  onEmKcalLX350: (v: number) => void;
}

const OBJETIVO_OPCIONES: { key: ObjetivoTipo; label: string; hint: string; step: number }[] = [
  { key: 'kgProd',  label: '$/kg producido',       hint: 'ej. 11.00', step: 0.01 },
  { key: 'ave',     label: 'Ahorro $/ave',          hint: 'ej. 0.50',  step: 0.01 },
  { key: 'tonAlim', label: 'Ahorro $/ton alimento', hint: 'ej. 80',    step: 1    },
];

export default function SeccionParametros(p: Props) {
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid #e0e0e0', borderRadius: 7, fontSize: 14, color: '#1B2B6B', fontWeight: 600, outline: 'none', boxSizing: 'border-box', background: '#fafafa' };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, display: 'block', marginBottom: 5 };
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 };
  const hintStyle: React.CSSProperties = { fontSize: 10, color: '#aaa', marginTop: 4 };
  const objOpc = OBJETIVO_OPCIONES.find(o => o.key === p.objetivoTipo)!;

  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '24px 28px', marginBottom: 16, border: '1px solid #eee', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1B2B6B', marginBottom: 4 }}>Parámetros productivos</div>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 20 }}>Aves, peso, CA, precios</div>

      <div style={gridStyle}>
        <div>
          <label style={labelStyle}>Total aves</label>
          <input type="number" value={p.totalAves} onChange={e => p.onTotalAves(parseInt(e.target.value))} style={inputStyle} step="1000" />
          <div style={hintStyle}>{fmtInt(p.totalAves)} aves</div>
        </div>
        <div>
          <label style={labelStyle}>Peso vivo (kg)</label>
          <input type="number" value={p.pesoVivo} onChange={e => p.onPesoVivo(parseFloat(e.target.value))} style={inputStyle} step="0.1" />
        </div>
        <div>
          <label style={labelStyle}>CA (Conversión Alimenticia)</label>
          <input type="number" value={p.fcr} onChange={e => p.onFcr(parseFloat(e.target.value))} style={inputStyle} step="0.01" />
        </div>
        <div>
          <label style={labelStyle}>Precio alimento ($/ton)</label>
          <input type="number" value={p.precioAlimento} onChange={e => p.onPrecioAlimento(parseFloat(e.target.value))} style={inputStyle} step="100" />
          <div style={hintStyle}>{fmtInt(p.precioAlimento)} MXN/ton = ${(p.precioAlimento / 1000).toFixed(3)}/kg</div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#1B2B6B', marginBottom: 12, marginTop: 8 }}>Precios por programa ($/kg MXN)</div>
      <div style={gridStyle}>
        <div>
          <label style={{ ...labelStyle, color: '#888' }}>EP ($/kg)</label>
          <input type="number" value={p.precioEstandar} onChange={e => p.onPrecioEstandar(parseFloat(e.target.value))} style={inputStyle} step="1" />
          <div style={hintStyle}>350 g/ton · 35 Kcal fijas</div>
        </div>
        <div>
          <label style={labelStyle}>Lipotex Plus ($/kg)</label>
          <input type="number" value={p.precioLipotex250} onChange={e => p.onPrecioLipotex250(parseFloat(e.target.value))} style={inputStyle} step="1" />
        </div>
        <div>
          <label style={labelStyle}>Lipotex Plus 350 ($/kg)</label>
          <input type="number" value={p.precioLipotex350} onChange={e => p.onPrecioLipotex350(parseFloat(e.target.value))} style={inputStyle} step="1" />
        </div>
        <div>
          <label style={{ ...labelStyle, color: '#7B1FA2' }}>Lipotex Plus M ($/kg)</label>
          <input type="number" value={p.precioLipotexM} onChange={e => p.onPrecioLipotexM(parseFloat(e.target.value))} style={{ ...inputStyle, borderColor: '#CE93D8' }} step="1" />
          <div style={{ fontSize: 10, color: '#7B1FA2', marginTop: 4 }}>Precio sugerido: $120.19 MXN/kg</div>
        </div>
      </div>

      {p.puedeMetodoA && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1B2B6B', marginBottom: 12, marginTop: 8 }}>Kcal liberadas (Modo EM)</div>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Kcal — Lipotex Plus</label>
              <input type="number" value={p.emKcalLX250} onChange={e => p.onEmKcalLX250(parseFloat(e.target.value))} style={inputStyle} step="5" />
            </div>
            <div>
              <label style={labelStyle}>Kcal — Lipotex Plus 350</label>
              <input type="number" value={p.emKcalLX350} onChange={e => p.onEmKcalLX350(parseFloat(e.target.value))} style={inputStyle} step="5" />
            </div>
            <div>
              <label style={{ ...labelStyle, color: '#7B1FA2' }}>Kcal — Lipotex Plus M</label>
              <input type="number" value={p.emKcalLXM} style={{ ...inputStyle, opacity: 0.6 }} disabled />
              <div style={{ fontSize: 10, color: '#7B1FA2', marginTop: 4 }}>Automático: {p.emKcalLXM} Kcal</div>
            </div>
            <div>
              <label style={{ ...labelStyle, color: '#888' }}>Kcal — EP</label>
              <input type="number" value={35} style={{ ...inputStyle, opacity: 0.6 }} disabled />
              <div style={hintStyle}>Fijas: 35 Kcal</div>
            </div>
          </div>
        </>
      )}

      {/* ── Objetivo de beneficio ── */}
      <div style={{ borderTop: '1px solid #eee', marginTop: 8, paddingTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1B2B6B', marginBottom: 4 }}>Objetivo de beneficio</div>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>
          Define una meta — los escenarios mostrarán ✓ o ✗ según si la alcanzan
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start', maxWidth: 480 }}>
          <div>
            <label style={labelStyle}>Tipo de objetivo</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {OBJETIVO_OPCIONES.map(o => (
                <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="objetivoTipo"
                    checked={p.objetivoTipo === o.key}
                    onChange={() => p.onObjetivoTipo(o.key)}
                    style={{ accentColor: '#1B2B6B', width: 14, height: 14 }}
                  />
                  <span style={{ fontSize: 12, color: '#444', fontWeight: p.objetivoTipo === o.key ? 700 : 400 }}>
                    {o.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Meta ({objOpc.label})</label>
            <input
              type="number"
              placeholder={objOpc.hint}
              value={p.objetivoValor ?? ''}
              step={objOpc.step}
              onChange={e => p.onObjetivoValor(e.target.value === '' ? null : parseFloat(e.target.value))}
              style={{ ...inputStyle, borderColor: '#1B2B6B40' }}
            />
            <div style={hintStyle}>
              {p.objetivoTipo === 'kgProd'  && '✓ si $/kg producido es menor a este valor'}
              {p.objetivoTipo === 'ave'      && '✓ si el ahorro por ave supera este valor'}
              {p.objetivoTipo === 'tonAlim'  && '✓ si el ahorro por ton de alimento supera este valor'}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
