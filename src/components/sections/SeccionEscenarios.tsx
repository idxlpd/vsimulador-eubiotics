import { useState } from 'react';
import { fmtMXN, fmtInt } from '../../utils';
import type { EspecieKey, FuenteGrasaKey } from '../../types';
import { ESPECIES, FUENTES_GRASA } from '../../constants';
import { calcEscenario } from '../../engine';
import type { CalcGlobalInput } from '../../engine';
import type { ObjetivoTipo } from './SeccionParametros';

// -----------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------
interface GlobalParams {
  especie: EspecieKey;
  totalAves: number;
  pesoVivo: number;
  fcr: number;
  precioAlimento: number;
  puedeMetodoA: boolean;
}

interface EscenarioConfig {
  id: number;
  programaKey: 'estandar' | 'lipotex250' | 'lipotex350' | 'lipotexM';
  fuenteGrasa: FuenteGrasaKey;
  grasa_pct: number;
  precioGrasa: number;
  precioProducto: number;
  dosis: { inicio: number; crecimiento: number; finalizacion: number };
  emKcal: number;
  etiqueta: string;           // nombre libre que puede editar el usuario
}

interface Props {
  global: GlobalParams;
  defaults: {
    fuenteGrasa: FuenteGrasaKey;
    grasa_pct: number;
    precioGrasa: number;
    precioEstandar: number;
    precioLipotex250: number;
    precioLipotex350: number;
    precioLipotexM: number;
    dosisLX250: { inicio: number; crecimiento: number; finalizacion: number };
    dosisLX350: { inicio: number; crecimiento: number; finalizacion: number };
    dosisLXM:  { inicio: number; crecimiento: number; finalizacion: number };
  };
  objetivoTipo: ObjetivoTipo;
  objetivoValor: number | null;
}

// -----------------------------------------------------------------------
// Configuracion de programas
// -----------------------------------------------------------------------
const PROGRAMAS = [
  { key: 'estandar'   as const, label: 'EP',              color: '#9E9E9E', bgColor: '#f5f5f5', dosisDefault: 350, kcalDefault: 35  },
  { key: 'lipotex250' as const, label: 'Lipotex Plus',    color: '#0288D1', bgColor: '#e1f5fe', dosisDefault: 250, kcalDefault: 35  },
  { key: 'lipotex350' as const, label: 'Lipotex Plus 350',color: '#2E7D32', bgColor: '#e8f5e9', dosisDefault: 350, kcalDefault: 35  },
  { key: 'lipotexM'   as const, label: 'Lipotex Plus M',  color: '#7B1FA2', bgColor: '#f3e5f5', dosisDefault: 350, kcalDefault: 50  },
];

const getProg = (key: string) => PROGRAMAS.find(p => p.key === key)!;

let nextId = 1;

// -----------------------------------------------------------------------
// Componente
// -----------------------------------------------------------------------
export default function SeccionEscenarios({ global, defaults, objetivoTipo, objetivoValor }: Props) {
  const especieData = ESPECIES[global.especie];

  // Escenarios iniciales
  const makeEscenario = (
    programaKey: 'estandar' | 'lipotex250' | 'lipotex350' | 'lipotexM',
    fuenteGrasa?: FuenteGrasaKey,
  ): EscenarioConfig => {
    const prog = getProg(programaKey);
    const fg = fuenteGrasa ?? defaults.fuenteGrasa;
    const precioMap = {
      estandar:    defaults.precioEstandar,
      lipotex250:  defaults.precioLipotex250,
      lipotex350:  defaults.precioLipotex350,
      lipotexM:    defaults.precioLipotexM,
    };
    const dosisMap = {
      estandar:   { inicio: 350, crecimiento: 350, finalizacion: 350 },
      lipotex250: defaults.dosisLX250,
      lipotex350: defaults.dosisLX350,
      lipotexM:   defaults.dosisLXM,
    };
    const kcal = programaKey === 'lipotexM' ? (fg === 'acidulado' ? 50 : 35) : prog.kcalDefault;
    return {
      id: nextId++,
      programaKey,
      fuenteGrasa: fg,
      grasa_pct: defaults.grasa_pct,
      precioGrasa: defaults.precioGrasa,
      precioProducto: precioMap[programaKey],
      dosis: dosisMap[programaKey],
      emKcal: kcal,
      etiqueta: prog.label,
    };
  };

  const [escenarios, setEscenarios] = useState<EscenarioConfig[]>([
    makeEscenario('estandar'),
    makeEscenario('lipotex250'),
  ]);
  const [vista, setVista] = useState<'tabla' | 'grafica'>('tabla');
  const [agregando, setAgregando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  // Base (sin emulsificante)
  const globalCalc: CalcGlobalInput = {
    especie: global.especie,
    totalAves: global.totalAves,
    pesoVivo: global.pesoVivo,
    fcr: global.fcr,
    precioAlimento: global.precioAlimento,
  };
  const consumoAve = global.pesoVivo * global.fcr;
  const base = {
    costoKgAlim: global.precioAlimento / 1000,
    costoAve: consumoAve * (global.precioAlimento / 1000),
    costoKgProd: (consumoAve * (global.precioAlimento / 1000)) / global.pesoVivo,
  };

  // Calcular resultado de cada escenario
  const resultados = escenarios.map(e => calcEscenario(globalCalc, {
    programaKey: e.programaKey,
    fuenteGrasa: e.fuenteGrasa,
    grasa_pct: e.grasa_pct,
    precioGrasa: e.precioGrasa,
    precioProducto: e.precioProducto,
    dosis: e.dosis,
    emKcal: e.emKcal,
  }, global.puedeMetodoA));

  // Evalua si un escenario cumple el objetivo
  const cumpleObjetivo = (idx: number): boolean | null => {
    if (objetivoValor === null) return null;
    const r = resultados[idx];
    if (objetivoTipo === 'kgProd')  return r.costoKgProd  <= objetivoValor;
    if (objetivoTipo === 'ave')     return r.ahorro_ave   >= objetivoValor;
    if (objetivoTipo === 'tonAlim') return r.ahorroFormTon >= objetivoValor;
    return null;
  };

  const agregarEscenario = (programaKey: 'estandar' | 'lipotex250' | 'lipotex350' | 'lipotexM') => {
    if (escenarios.length >= 4) return;
    setEscenarios(prev => [...prev, makeEscenario(programaKey)]);
    setAgregando(false);
  };

  const eliminarEscenario = (id: number) => {
    setEscenarios(prev => prev.filter(e => e.id !== id));
    if (editandoId === id) setEditandoId(null);
  };

  const actualizarEscenario = (id: number, cambios: Partial<EscenarioConfig>) => {
    setEscenarios(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, ...cambios };
      // Auto-ajustar kcal de LipotexM segun fuente
      if (updated.programaKey === 'lipotexM') {
        updated.emKcal = updated.fuenteGrasa === 'acidulado' ? 50 : 35;
      }
      return updated;
    }));
  };

  const editando = escenarios.find(e => e.id === editandoId);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 5, fontSize: 12, color: '#fff', background: 'rgba(255,255,255,0.08)',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
    letterSpacing: 0.4, display: 'block', marginBottom: 3,
  };

  return (
    <div style={{ background: '#1B2B6B', borderRadius: 10, padding: '22px 28px', marginBottom: 16, boxShadow: '0 4px 16px rgba(27,43,107,0.25)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Escenarios</div>
          <div style={{ color: '#C5D92D', fontSize: 12, marginTop: 2 }}>
            Costo por kg de {especieData.label} Producido · {fmtInt(global.totalAves)} aves
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

      {/* Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {escenarios.map((e, i) => {
          const prog = getProg(e.programaKey);
          const isEditing = editandoId === e.id;
          const cumple = cumpleObjetivo(i);
          return (
            <div key={e.id}
              onClick={() => setEditandoId(isEditing ? null : e.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, background: isEditing ? prog.color : prog.bgColor, border: `2px solid ${prog.color}`, cursor: 'pointer', position: 'relative' }}>
              {cumple !== null && (
                <span style={{
                  position: 'absolute', top: -8, right: -6,
                  background: cumple ? '#2e7d32' : '#c62828',
                  color: '#fff', borderRadius: '50%', width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}>
                  {cumple ? '✓' : '✗'}
                </span>
              )}
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: isEditing ? '#fff' : prog.color }} />
              <span style={{ color: isEditing ? '#fff' : prog.color, fontSize: 12, fontWeight: 600 }}>{e.etiqueta}</span>
              <span style={{ color: isEditing ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)', fontSize: 10, marginLeft: 2 }}>
                {FUENTES_GRASA[e.fuenteGrasa].label.replace('Aceite de ', '').replace('Aceite ', '')}
              </span>
              <button onClick={ev => { ev.stopPropagation(); eliminarEscenario(e.id); }}
                style={{ marginLeft: 2, background: 'none', border: 'none', cursor: 'pointer', color: isEditing ? '#fff' : prog.color, fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
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
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Programa:</span>
            {PROGRAMAS.map(p => (
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

      {/* Panel de edicion del escenario seleccionado */}
      {editando && (() => {
        const prog = getProg(editando.programaKey);
        return (
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px 16px', marginBottom: 16, border: `1px solid ${prog.color}40` }}>
            <div style={{ fontSize: 12, color: prog.color, fontWeight: 700, marginBottom: 12 }}>
              Editando: {editando.etiqueta}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              {/* Etiqueta */}
              <div>
                <label style={labelStyle}>Etiqueta</label>
                <input style={inputStyle} value={editando.etiqueta}
                  onChange={e => actualizarEscenario(editando.id, { etiqueta: e.target.value })} />
              </div>
              {/* Fuente de grasa */}
              <div>
                <label style={labelStyle}>Fuente de grasa</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }}
                  value={editando.fuenteGrasa}
                  onChange={e => actualizarEscenario(editando.id, { fuenteGrasa: e.target.value as FuenteGrasaKey })}>
                  {Object.entries(FUENTES_GRASA).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              {/* Precio grasa */}
              <div>
                <label style={labelStyle}>Precio grasa ($/kg)</label>
                <input type="number" style={inputStyle} value={editando.precioGrasa} step="0.5"
                  onChange={e => actualizarEscenario(editando.id, { precioGrasa: parseFloat(e.target.value) })} />
              </div>
              {/* Precio producto */}
              <div>
                <label style={labelStyle}>Precio producto ($/kg)</label>
                <input type="number" style={inputStyle} value={editando.precioProducto} step="1"
                  onChange={e => actualizarEscenario(editando.id, { precioProducto: parseFloat(e.target.value) })} />
              </div>
              {/* Dosis promedio */}
              <div>
                <label style={labelStyle}>Dosis inicio (g/ton)</label>
                <input type="number" style={inputStyle} value={editando.dosis.inicio} step="25"
                  onChange={e => actualizarEscenario(editando.id, { dosis: { ...editando.dosis, inicio: parseFloat(e.target.value) } })} />
              </div>
              <div>
                <label style={labelStyle}>Dosis crecimiento (g/ton)</label>
                <input type="number" style={inputStyle} value={editando.dosis.crecimiento} step="25"
                  onChange={e => actualizarEscenario(editando.id, { dosis: { ...editando.dosis, crecimiento: parseFloat(e.target.value) } })} />
              </div>
              <div>
                <label style={labelStyle}>Dosis finalizacion (g/ton)</label>
                <input type="number" style={inputStyle} value={editando.dosis.finalizacion} step="25"
                  onChange={e => actualizarEscenario(editando.id, { dosis: { ...editando.dosis, finalizacion: parseFloat(e.target.value) } })} />
              </div>
              {/* Kcal */}
              <div>
                <label style={labelStyle}>Kcal liberadas</label>
                <input type="number" style={inputStyle} value={editando.emKcal} step="5"
                  disabled={editando.programaKey === 'estandar' || editando.programaKey === 'lipotexM'}
                  onChange={e => actualizarEscenario(editando.id, { emKcal: parseFloat(e.target.value) })} />
                {editando.programaKey === 'lipotexM' && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Auto: {editando.emKcal} Kcal</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
              {escenarios.map((e, i) => {
                const prog = getProg(e.programaKey);
                const d = resultados[i];
                const isPositive = d.ahorro_ave >= 0;
                const fgLabel = FUENTES_GRASA[e.fuenteGrasa].label.replace('Aceite de ', '').replace('Aceite ', '');
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                    onClick={() => setEditandoId(editandoId === e.id ? null : e.id)}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: prog.color, flexShrink: 0 }} />
                        <div>
                          <span style={{ color: '#fff', fontWeight: 600 }}>{e.etiqueta}</span>
                          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginLeft: 6 }}>{fgLabel}</span>
                        </div>
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

      {/* GRAFICA */}
      {vista === 'grafica' && (() => {
        const filas = [
          { key: 'base', label: 'Base', sublabel: 'sin emulsificante', color: 'rgba(255,255,255,0.15)', kgProd: base.costoKgProd, ahorro_ave: 0, ahorro_total: 0, esBase: true },
          ...escenarios.map((e, i) => ({
            key: String(e.id), label: e.etiqueta,
            sublabel: FUENTES_GRASA[e.fuenteGrasa].label.replace('Aceite de ', '').replace('Aceite ', ''),
            color: getProg(e.programaKey).color,
            kgProd: resultados[i].costoKgProd,
            ahorro_ave: resultados[i].ahorro_ave,
            ahorro_total: resultados[i].ahorro_total,
            esBase: false,
          })),
        ];
        const maxVal = Math.max(...filas.map(f => f.kgProd));
        const minVal = Math.min(...filas.map(f => f.kgProd));
        const rango = maxVal - minVal || 0.01;
        const barPct = (val: number) => 55 + ((val - minVal) / rango) * 45;

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>$/kg producido</span>
              <span style={{ fontSize: 10, color: '#C5D92D' }}>barra mas corta = menor costo</span>
            </div>
            {filas.map(f => {
              const pct = barPct(f.kgProd);
              const isPositive = f.ahorro_ave >= 0;
              return (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!f.esBase && <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.color }} />}
                      <span style={{ color: f.esBase ? 'rgba(255,255,255,0.35)' : '#fff', fontWeight: f.esBase ? 400 : 600, fontSize: 12, fontStyle: f.esBase ? 'italic' : 'normal' }}>{f.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{f.sublabel}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {!f.esBase && <span style={{ fontSize: 11, color: isPositive ? '#C5D92D' : '#ef5350' }}>{isPositive ? '+' : ''}{fmtInt(f.ahorro_total)} MXN</span>}
                      <span style={{ fontSize: 14, fontWeight: 700, color: f.esBase ? 'rgba(255,255,255,0.35)' : '#C5D92D', minWidth: 64, textAlign: 'right' }}>${f.kgProd.toFixed(3)}</span>
                    </div>
                  </div>
                  <div style={{ height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: f.esBase ? 'rgba(255,255,255,0.12)' : f.color, borderRadius: 6, transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
                      {!f.esBase && <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', opacity: 0.9 }}>{isPositive ? '▼' : '▲'} {fmtMXN(Math.abs(f.ahorro_ave))}/ave</span>}
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
