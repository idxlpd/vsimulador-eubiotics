import { useState, useEffect } from 'react';
import Header from './Header';
import SeccionEspecieMercado from './sections/SeccionEspecieMercado';
import SeccionFuenteGrasa from './sections/SeccionFuenteGrasa';
import SeccionProgramaDosis from './sections/SeccionProgramaDosis';
import SeccionParametros from './sections/SeccionParametros';
import type { ObjetivoTipo } from './sections/SeccionParametros';
import SeccionEscenarios from './sections/SeccionEscenarios';
import { ESPECIES, FUENTES_GRASA } from '../constants';
import { calcularEscenarios } from '../engine';
import type { EspecieKey, FuenteGrasaKey, User } from '../types';

interface DosisSet { inicio: number; crecimiento: number; finalizacion: number; }

export default function Simulador({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [especie, setEspecie] = useState<EspecieKey>('pollo');
  const [mercado, setMercado] = useState('Mexico');
  const [tieneCalentamiento, setTieneCalentamiento] = useState(false);
  const [fuenteGrasa, setFuenteGrasa] = useState<FuenteGrasaKey>('soya');
  const [grasa_pct, setGrasaPct] = useState(4.0);
  const [precioGrasa, setPrecioGrasa] = useState(32.0);

  // Objetivo del emulsificante
  const [objetivo, setObjetivo] = useState<'kcal' | 'digestibilidad'>('kcal');

  // Dosis por programa y fase
  const [dosisLX250, setDosisLX250] = useState<DosisSet>({ inicio: 250, crecimiento: 250, finalizacion: 250 });
  const [dosisLX350, setDosisLX350] = useState<DosisSet>({ inicio: 350, crecimiento: 350, finalizacion: 350 });
  const [dosisLXM, setDosisLXM] = useState<DosisSet>({ inicio: 350, crecimiento: 350, finalizacion: 350 });

  // Precios
  const [precioEstandar, setPrecioEstandar] = useState(6.50);
  const [precioLipotex250, setPrecioLipotex250] = useState(6.50);
  const [precioLipotex350, setPrecioLipotex350] = useState(6.50);
  const [precioLipotexM, setPrecioLipotexM] = useState(7.00);

  // Parametros productivos
  const [totalAves, setTotalAves] = useState(100000);
  const [pesoVivo, setPesoVivo] = useState(2.5);
  const [fcr, setFcr] = useState(1.80);
  const [precioAlimento, setPrecioAlimento] = useState(7500);

  // Kcal liberadas (editables solo para LX250 y LX350)
  const [emKcalLX250, setEmKcalLX250] = useState(35);
  const [emKcalLX350, setEmKcalLX350] = useState(35);

  // Actualizar defaults al cambiar especie
  useEffect(() => {
    const d = ESPECIES[especie];
    setPesoVivo(d.pesoDefault);
    setTotalAves(d.avesDefault);
    setFcr(d.fcrDefault);
  }, [especie]);

  // Actualizar precio grasa al cambiar fuente
  useEffect(() => {
    setPrecioGrasa(FUENTES_GRASA[fuenteGrasa].precioDefault);
  }, [fuenteGrasa]);

  // Si cambia especie a una que no puede recuperar EM, forzar digestibilidad
  useEffect(() => {
    if (!ESPECIES[especie].puedeRecuperarEM) {
      setObjetivo('digestibilidad');
    }
  }, [especie]);

  // Kcal LipotexM: automatico segun fuente
  const emKcalLXM = fuenteGrasa === 'acidulado' ? 50 : 35;

  // Si objetivo es digestibilidad, las kcal para el motor son 0 (no recupera EM)
  const kcal250 = objetivo === 'kcal' ? emKcalLX250 : 0;
  const kcal350 = objetivo === 'kcal' ? emKcalLX350 : 0;
  const kcalM   = objetivo === 'kcal' ? emKcalLXM   : 0;

  const [objetivoTipo, setObjetivoTipo] = useState<ObjetivoTipo>('kgProd');
  const [objetivoValor, setObjetivoValor] = useState<number | null>(null);

  // Motor de calculo
  const resultado = calcularEscenarios({
    especie, fuenteGrasa, grasa_pct,
    precioGrasa, totalAves, pesoVivo, fcr, precioAlimento,
    precioEstandar,
    precioLipotex250, dosisLX250, emKcalLX250: kcal250,
    precioLipotex350, dosisLX350, emKcalLX350: kcal350,
    precioLipotexM,   dosisLXM,   emKcalLXM:   kcalM,
  });


  // Export CSV
  const handleExportCSV = () => {
    const r = resultado;
    const esp = ESPECIES[especie];
    const rows = [
      ['Parametro', 'Valor'],
      ['Especie', esp.label],
      ['Total Aves', totalAves],
      ['Peso Vivo (kg)', pesoVivo],
      ['CA', fcr],
      ['Precio Alimento (MXN/ton)', precioAlimento],
      [''],
      ['Programa', '$/kg Alim', '$/Ave', '$/kg Prod', 'Ahorro/Ave', 'Ahorro Total'],
      ['Base', r.base.costoKgAlim.toFixed(4), r.base.costoAve.toFixed(2), r.base.costoKgProd.toFixed(4), '-', '-'],
      ['EP', r.estandar.costoKgAlim.toFixed(4), r.estandar.costoAve.toFixed(2), r.estandar.costoKgProd.toFixed(4), r.estandar.ahorro_ave.toFixed(2), r.estandar.ahorro_total.toFixed(0)],
      ['Lipotex Plus', r.lipotex250.costoKgAlim.toFixed(4), r.lipotex250.costoAve.toFixed(2), r.lipotex250.costoKgProd.toFixed(4), r.lipotex250.ahorro_ave.toFixed(2), r.lipotex250.ahorro_total.toFixed(0)],
      ['Lipotex Plus 350', r.lipotex350.costoKgAlim.toFixed(4), r.lipotex350.costoAve.toFixed(2), r.lipotex350.costoKgProd.toFixed(4), r.lipotex350.ahorro_ave.toFixed(2), r.lipotex350.ahorro_total.toFixed(0)],
      ['Lipotex Plus M', r.lipotexM.costoKgAlim.toFixed(4), r.lipotexM.costoAve.toFixed(2), r.lipotexM.costoKgProd.toFixed(4), r.lipotexM.ahorro_ave.toFixed(2), r.lipotexM.ahorro_total.toFixed(0)],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'simulador-eubiotics.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF — reporte HTML con diseño
  const handleExportPDF = () => {
    const r = resultado;
    const esp = ESPECIES[especie];
    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

    const programas = [
      { label: 'Base (sin tratamiento)', color: 'rgba(255,255,255,0.3)', d: r.base, esBase: true },
      { label: 'EP',           color: '#9E9E9E', d: r.estandar },
      { label: 'Lipotex Plus', color: '#0288D1', d: r.lipotex250 },
      { label: 'Lipotex Plus 350', color: '#2E7D32', d: r.lipotex350 },
      { label: 'Lipotex Plus M',   color: '#7B1FA2', d: r.lipotexM },
    ];

    const maxKg = Math.max(...programas.map(p => p.esBase ? r.base.costoKgProd : p.d.costoKgProd));
    const minKg = Math.min(...programas.map(p => p.esBase ? r.base.costoKgProd : p.d.costoKgProd));
    const rango = maxKg - minKg || 0.01;
    const barPct = (v) => Math.round(55 + ((v - minKg) / rango) * 40);

    const mejor = programas.filter(p => !p.esBase).reduce((a, b) =>
      (a.d.ahorro_total > b.d.ahorro_total ? a : b));

    const fmtMXN = (n) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const fmtInt = (n) => Math.round(n).toLocaleString('es-MX');

    const barrasHTML = programas.map(p => {
      const kgProd = p.esBase ? r.base.costoKgProd : p.d.costoKgProd;
      const ahorro = p.esBase ? 0 : p.d.ahorro_total;
      const ahorroAve = p.esBase ? 0 : p.d.ahorro_ave;
      const pct = barPct(kgProd);
      const isPos = ahorro >= 0;
      return `
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <div style="display:flex;align-items:center;gap:6px">
              ${!p.esBase ? `<div style="width:8px;height:8px;border-radius:50%;background:${p.color}"></div>` : ''}
              <span style="color:${p.esBase ? 'rgba(255,255,255,0.4)' : '#fff'};font-weight:${p.esBase ? 400 : 600};font-size:13px;font-style:${p.esBase ? 'italic' : 'normal'}">${p.label}${p.esBase ? ' · sin tratamiento' : ''}</span>
            </div>
            <div style="display:flex;align-items:center;gap:16px">
              ${!p.esBase ? `<span style="font-size:12px;color:${isPos ? '#C5D92D' : '#ef5350'}">${isPos ? '+' : ''}${fmtInt(ahorro)} MXN</span>` : ''}
              <span style="font-size:15px;font-weight:700;color:${p.esBase ? 'rgba(255,255,255,0.4)' : '#C5D92D'};min-width:70px;text-align:right">${fmtMXN(kgProd)}</span>
            </div>
          </div>
          <div style="height:34px;background:rgba(255,255,255,0.07);border-radius:6px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${p.esBase ? 'rgba(255,255,255,0.12)' : p.color};border-radius:6px;display:flex;align-items:center;padding-left:12px">
              ${!p.esBase ? `<span style="font-size:11px;color:#fff;font-weight:600;white-space:nowrap;opacity:.9">${isPos ? '▼' : '▲'} ${fmtMXN(Math.abs(ahorroAve))}/animal</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    const filasTabla = programas.map(p => {
      const d = p.esBase ? r.base : p.d;
      return `<tr>
        <td>${p.label}</td>
        <td>${fmtMXN(d.costoKgAlim)}</td>
        <td>${fmtMXN(d.costoAve)}</td>
        <td style="font-weight:700;color:#1B2B6B">${fmtMXN(d.costoKgProd)}</td>
        <td>${p.esBase ? '—' : `<span style="color:${d.ahorro_ave>=0?'#2E7D32':'#c62828'}">${d.ahorro_ave>=0?'▼':'▲'} ${fmtMXN(Math.abs(d.ahorro_ave))}</span>`}</td>
        <td>${p.esBase ? '—' : `<span style="color:${d.ahorro_total>=0?'#2E7D32':'#c62828'};font-weight:700">${d.ahorro_total>=0?'+':''}${fmtInt(d.ahorro_total)} MXN</span>`}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Reporte Lipotex</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, Arial, sans-serif; color: #222; background: #f5f6fa; }
      .page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
      .header { background: #1B2B6B; color: #fff; border-radius: 10px; padding: 28px 32px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-start; }
      .header-left h1 { color: #C5D92D; font-size: 22px; margin-bottom: 4px; }
      .header-left p { font-size: 13px; opacity: .7; }
      .header-right { text-align: right; font-size: 13px; opacity: .8; }
      .section-title { font-size: 15px; font-weight: 700; color: #1B2B6B; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 2px solid #C5D92D; }
      .params-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
      .param-card { background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 14px 16px; }
      .param-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: .5px; font-weight: 600; margin-bottom: 4px; }
      .param-value { font-size: 18px; font-weight: 700; color: #1B2B6B; }
      .param-unit { font-size: 11px; color: #999; font-weight: 400; }
      .mejor { background: #f0f7e6; border: 1.5px solid #C5D92D; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; }
      .mejor-label { font-size: 10px; color: #7a9a00; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; margin-bottom: 4px; }
      .mejor-value { font-size: 15px; font-weight: 700; color: #1B2B6B; }
      .grafica { background: #1B2B6B; border-radius: 10px; padding: 24px 28px; margin-bottom: 28px; }
      .grafica-title { color: #fff; font-size: 15px; font-weight: 700; margin-bottom: 6px; }
      .grafica-sub { color: rgba(255,255,255,.4); font-size: 11px; text-align: right; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border-radius: 8px; overflow: hidden; }
      th { background: #1B2B6B; color: rgba(255,255,255,.7); padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; }
      td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
      tr:last-child td { border-bottom: none; }
      .footer { text-align: center; font-size: 11px; color: #aaa; margin-top: 28px; padding-top: 14px; border-top: 1px solid #eee; }
      @media print { body { background: #fff; } .page { padding: 16px; } }
    </style></head><body>
    <div class="page">
      <div class="header">
        <div class="header-left">
          <div style="font-size:26px;font-weight:800;letter-spacing:-1px;margin-bottom:6px">eubiotics</div>
          <h1>Simulador de Escenarios Lipotex</h1>
          <p>Evaluación técnico-económica comparativa · Resultados orientativos</p>
        </div>
        <div class="header-right">
          <div>${fecha}</div>
          <div style="font-weight:700;margin-top:4px">México</div>
        </div>
      </div>

      <div class="section-title">Parámetros del Simulador</div>
      <div class="params-grid">
        <div class="param-card"><div class="param-label">Especie</div><div class="param-value" style="font-size:15px">${esp.label}</div></div>
        <div class="param-card"><div class="param-label">Total Animales</div><div class="param-value">${fmtInt(totalAves)}</div></div>
        <div class="param-card"><div class="param-label">Peso Vivo</div><div class="param-value">${pesoVivo} <span class="param-unit">kg</span></div></div>
        <div class="param-card"><div class="param-label">CA</div><div class="param-value">${fcr}</div></div>
        <div class="param-card"><div class="param-label">Precio Alimento</div><div class="param-value">${fmtInt(precioAlimento)} <span class="param-unit">MXN/ton</span></div></div>
      </div>

      <div class="mejor">
        <div class="mejor-label">Mejor Escenario Estimado</div>
        <div class="mejor-value">${mejor.label} · Ahorro total: ${fmtInt(mejor.d.ahorro_total)} MXN · Costo: ${fmtMXN(mejor.d.costoKgProd)}/kg producido</div>
      </div>

      <div class="section-title">$/kg Producido por Programa</div>
      <div class="grafica">
        <div style="display:flex;justify-content:space-between;margin-bottom:18px">
          <span style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px">$/kg producido (MXN)</span>
          <span style="font-size:10px;color:#C5D92D">← barra más corta = menor costo = mejor</span>
        </div>
        ${barrasHTML}
      </div>

      <div class="section-title">Detalle de Escenarios</div>
      <table>
        <thead><tr><th>Programa</th><th>$/kg Alim.</th><th>$/Animal</th><th>$/kg Prod.</th><th>Ahorro/Animal</th><th>Ahorro Total</th></tr></thead>
        <tbody>${filasTabla}</tbody>
      </table>

      <div class="footer">Resultados orientativos · Validar internamente antes de implementación · Lipotex</div>
    </div>
    <script>window.onload = () => window.print();</script>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb', fontFamily: "'Segoe UI', sans-serif" }}>
      <Header user={user} onLogout={onLogout} onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 60px' }}>

        <SeccionEspecieMercado
          especie={especie} mercado={mercado} tieneCalentamiento={tieneCalentamiento}
          onEspecie={setEspecie} onMercado={setMercado} onCalentamiento={setTieneCalentamiento}
        />

        <SeccionFuenteGrasa
          especie={especie} fuenteGrasa={fuenteGrasa} grasa_pct={grasa_pct}
          precioGrasa={precioGrasa} tieneCalentamiento={tieneCalentamiento}
          objetivo={objetivo}
          onFuente={setFuenteGrasa} onGrasaPct={setGrasaPct} onPrecioGrasa={setPrecioGrasa}
          onObjetivo={setObjetivo}
        />

        <SeccionProgramaDosis
          fuenteGrasa={fuenteGrasa}
          dosisLX250={dosisLX250} dosisLX350={dosisLX350} dosisLXM={dosisLXM}
          onDosisLX250={setDosisLX250} onDosisLX350={setDosisLX350} onDosisLXM={setDosisLXM}
        />

        <SeccionParametros
          totalAves={totalAves} pesoVivo={pesoVivo} fcr={fcr} precioAlimento={precioAlimento}
          precioEstandar={precioEstandar} precioLipotex250={precioLipotex250}
          precioLipotex350={precioLipotex350} precioLipotexM={precioLipotexM}
          emKcalLX250={emKcalLX250} emKcalLX350={emKcalLX350} emKcalLXM={emKcalLXM}
          puedeMetodoA={resultado.puedeMetodoA}
          onTotalAves={setTotalAves} onPesoVivo={setPesoVivo} onFcr={setFcr}
          onPrecioAlimento={setPrecioAlimento} onPrecioEstandar={setPrecioEstandar}
          onPrecioLipotex250={setPrecioLipotex250} onPrecioLipotex350={setPrecioLipotex350}
          onPrecioLipotexM={setPrecioLipotexM}
          onEmKcalLX250={setEmKcalLX250} onEmKcalLX350={setEmKcalLX350}
          objetivoTipo={objetivoTipo} objetivoValor={objetivoValor}
          onObjetivoTipo={setObjetivoTipo} onObjetivoValor={setObjetivoValor}
        />

        <SeccionEscenarios
          global={{
            especie, totalAves, pesoVivo, fcr, precioAlimento,
            puedeMetodoA: resultado.puedeMetodoA,
          }}
          defaults={{
            fuenteGrasa, grasa_pct, precioGrasa,
            precioEstandar, precioLipotex250, precioLipotex350, precioLipotexM,
            dosisLX250, dosisLX350, dosisLXM,
          }}
          objetivoTipo={objetivoTipo}
          objetivoValor={objetivoValor}
        />

        <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 16 }}>
          Eubiotics Latinoamericana · Simulador de Escenarios · Resultados orientativos — validar con nutricionista
        </div>
      </div>
    </div>
  );
}
