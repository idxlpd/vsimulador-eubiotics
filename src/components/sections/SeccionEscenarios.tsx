import { useState } from 'react';
import { fmtMXN, fmtInt } from '../../utils';
import type { EspecieKey } from '../../types';
import { ESPECIES } from '../../constants';

interface ProgramaRes {
  costoKgAlim: number;
  costoAve: number;
  costoKgProd: number;
  ahorro_ave: number;
  ahorro_total: number;
  costoProductoTon: number;
  ahorroFormTon: number;
}

interface Props {
  especie: EspecieKey;
  totalAves: number;
  base: { costoKgAlim: number; costoAve: number; costoKgProd: number };
  estandar: ProgramaRes;
  lipotex250: ProgramaRes;
  lipotex350: ProgramaRes;
  lipotexM: ProgramaRes;
}

const PROGRAMAS_DISPONIBLES = [
  { key: 'estandar',   label: 'EP',              color: '#9E9E9E', bgColor: '#f5f5f5' },
  { key: 'lipotex250', label: 'Lipotex Plus',     color: '#0288D1', bgColor: '#e1f5fe' },
  { key: 'lipotex350', label: 'Lipotex Plus 350', color: '#2E7D32', bgColor: '#e8f5e9' },
  { key: 'lipotexM',   label: 'Lipotex Plus M',   color: '#7B1FA2', bgColor: '#f3e5f5' },
];

interface Escenario {
  id: number;
  programaKey: string;
  label: string;
}

let nextId = 1;

export default function SeccionEscenarios({ especie, totalAves, base, estandar, lipotex250, lipotex350, lipotexM }: Props) {
  const [escenarios, setEscenarios] = useState<Escenario[]>([
    { id: nextId++, programaKey: 'estandar',   label: 'EP' },
    { id: nextId++, programaKey: 'lipotex250', label: 'Lipotex Plus' },
  ]);
  const [vista, setVista] = useState<'tabla' | 'grafica'>('tabla');
  const [agregando, setAgregando] = useState(false);

  const datos: Record<string, ProgramaRes> = { estandar, lipotex250, lipotex350, lipotexM };
  const especieData = ESPECIES[especie];

  const agregarEscenario = (programaKey: string) => {
    if (escenarios.length >= 4) return;
    const prog = PROGRAMAS_DISPONIBLES.find(p => p.key === programaKey)!;
    setEscenarios(prev => [...prev, { id: nextId++, programaKey, label: prog.label }]);
    setAgregando(false);
  };

  const eliminarEscenario = (id: number) => {
    setEscenarios(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div style={{ background: '#1B2B6B', borderRadius: 10, padding: '22px 28px', marginBottom: 16, boxShadow: '0 4px 16px rgba(27,43,107,0.25)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Escenarios</div>
          <div style={{ color: '#C5D92D', fontSize: 12, marginTop: 2 }}>
            Costo por kg de {especieData.label} Producido · {fmtInt(totalAves)} aves
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setVista('tabla')}
            style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: vista === 'tabla' ? '#C5D92D' : 'rgba(255,255,255,0.1)', color: vista === 'tabla' ? '#1B2B6B' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Tabla
          </button>
          <button onClick={() => setVista('grafica')}
            style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: vista === 'grafica' ? '#C5D92D' : 'rgba(255,255,255,0.1)', color: vista === 'grafica' ? '#1B2B6B' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Grafica
          </button>
        </div>
      </div>

      {/* Chips escenarios */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {escenarios.map(e => {
          const prog = PROGRAMAS_DISPONIBLES.find(p => p.key === e.programaKey)!;
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, background: prog.bgColor, border: `2px solid ${prog.color}` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: prog.color }} />
              <span style={{ color: prog.color, fontSize: 12, fontWeight: 600 }}>{e.label}</span>
              <button onClick={() => eliminarEscenario(e.id)}
                style={{ marginLeft: 2, background: 'none', border: 'none', cursor: 'pointer', color: prog.color, fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
          );
        })}
        {escenarios.length < 4 && !agregando && (
          <button onClick={() => setAgregando(true)}
            style={{ padding: '5px 12px', borderRadius: 20, border: '2px dashed rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Agregar escenario
          </button>
        )}
        {agregando && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Elegir programa:</span>
            {PROGRAMAS_DISPONIBLES.map(p => (
              <button key={p.key} onClick={() => agregarEscenario(p.key)}
                style={{ padding: '4px 10px', borderRadius: 16, border: `2px solid ${p.color}`, background: p.bgColor, color: p.color, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {p.label}
              </button>
            ))}
            <button onClick={() => setAgregando(false)}
              style={{ padding: '4px 8px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* TABLA */}
      {vista === 'tabla' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Programa', '$/kg Alim c/trat.', '$/Ave', '$/kg Prod.', 'Ahorro/Ave', 'Ahorro Total'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>Base (sin emulsif.)</td>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>{fmtMXN(base.costoKgAlim)}</td>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>{fmtMXN(base.costoAve)}</td>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{fmtMXN(base.costoKgProd)}</td>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.3)' }}>—</td>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.3)' }}>—</td>
              </tr>
              {escenarios.map(e => {
                const prog = PROGRAMAS_DISPONIBLES.find(p => p.key === e.programaKey)!;
                const d = datos[e.programaKey];
                const isPositive = d.ahorro_ave >= 0;
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: prog.color, flexShrink: 0 }} />
                        <span style={{ color: '#fff', fontWeight: 600 }}>{e.label}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.8)' }}>{fmtMXN(d.costoKgAlim)}</td>
                    <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.8)' }}>{fmtMXN(d.costoAve)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 14, color: '#C5D92D' }}>{fmtMXN(d.costoKgProd)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ color: isPositive ? '#C5D92D' : '#ef5350', fontWeight: 600 }}>
                        {isPositive ? '▼ ' : '▲ '}{fmtMXN(Math.abs(d.ahorro_ave))}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ color: isPositive ? '#C5D92D' : '#ef5350', fontWeight: 700 }}>
                        {isPositive ? '+' : ''}{fmtInt(d.ahorro_total)} MXN
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* GRAFICA — barras horizontales de $/kg prod, más corta = mejor */}
      {vista === 'grafica' && (() => {
        const filas = [
          {
            key: 'base', label: 'Base', sublabel: 'sin emulsificante',
            color: 'rgba(255,255,255,0.15)', kgProd: base.costoKgProd,
            ahorro_ave: 0, ahorro_total: 0, esBase: true,
          },
          ...escenarios.map(e => {
            const prog = PROGRAMAS_DISPONIBLES.find(p => p.key === e.programaKey)!;
            const d = datos[e.programaKey];
            return {
              key: String(e.id), label: e.label, sublabel: '',
              color: prog.color, kgProd: d.costoKgProd,
              ahorro_ave: d.ahorro_ave, ahorro_total: d.ahorro_total, esBase: false,
            };
          }),
        ];

        const maxVal = Math.max(...filas.map(f => f.kgProd));
        const minVal = Math.min(...filas.map(f => f.kgProd));
        const rango = maxVal - minVal || 0.01;
        // Base siempre al 100%, los demás se escalan. Mínimo visual 55%.
        const barPct = (val: number) => 55 + ((val - minVal) / rango) * 45;

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                $/kg producido (MXN)
              </span>
              <span style={{ fontSize: 10, color: '#C5D92D' }}>
                ← barra más corta = menor costo = mejor
              </span>
            </div>

            {filas.map(f => {
              const pct = barPct(f.kgProd);
              const isPositive = f.ahorro_ave >= 0;
              return (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!f.esBase && <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.color }} />}
                      <span style={{ color: f.esBase ? 'rgba(255,255,255,0.35)' : '#fff', fontWeight: f.esBase ? 400 : 600, fontSize: 12, fontStyle: f.esBase ? 'italic' : 'normal' }}>
                        {f.label}
                      </span>
                      {f.sublabel && (
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}> · {f.sublabel}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {!f.esBase && (
                        <span style={{ fontSize: 11, color: isPositive ? '#C5D92D' : '#ef5350' }}>
                          {isPositive ? '+' : ''}{fmtInt(f.ahorro_total)} MXN
                        </span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 700, color: f.esBase ? 'rgba(255,255,255,0.35)' : '#C5D92D', minWidth: 64, textAlign: 'right' }}>
                        ${f.kgProd.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  <div style={{ height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: f.esBase ? 'rgba(255,255,255,0.12)' : f.color,
                      borderRadius: 6, transition: 'width 0.5s ease',
                      display: 'flex', alignItems: 'center', paddingLeft: 12,
                    }}>
                      {!f.esBase && (
                        <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', opacity: 0.9 }}>
                          {isPositive ? '▼' : '▲'} {fmtMXN(Math.abs(f.ahorro_ave))}/ave
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {escenarios.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '20px 0' }}>
          Agrega al menos un escenario para comparar
        </div>
      )}
    </div>
  );
}