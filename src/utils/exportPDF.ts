import type { ProgramaResult } from '../engine';

interface ExportData {
  especie: string;
  mercado: string;
  fuenteGrasa: string;
  grasa_pct: number;
  totalAves: number;
  pesoVivo: number;
  fcr: number;
  precioAlimento: number;
  precioGrasa: number;
  objetivo: string;
  base: { costoKgAlim: number; costoAve: number; costoKgProd: number };
  escenarios: Array<{ label: string; color: string; data: ProgramaResult }>;
  logoUrl: string;
}

function fmt3(n: number) { return n.toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
function fmt0(n: number) { return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmt2(n: number) { return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function exportarPDF(d: ExportData) {
  const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

  const allVals = [d.base.costoKgProd, ...d.escenarios.map(e => e.data.costoKgProd)];
  const maxVal = Math.max(...allVals);
  const minVal = Math.min(...allVals);
  const rango = maxVal - minVal || 0.01;
  const barPct = (v: number) => 55 + ((v - minVal) / rango) * 45;

  const graficaBarras = `
    <div class="grafica">
      <div class="grafica-hint">← barra más corta = menor costo = mejor</div>
      <div class="bar-row">
        <div class="bar-label-wrap">
          <span class="bar-name base-name">Base · sin emulsificante</span>
          <span class="bar-val base-val">$${fmt3(d.base.costoKgProd)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:100%; background:#8090b0;"></div>
        </div>
      </div>
      ${d.escenarios.map(e => `
        <div class="bar-row">
          <div class="bar-label-wrap">
            <span class="bar-dot" style="background:${e.color};"></span>
            <span class="bar-name">${e.label}</span>
            <span class="bar-savings">+${fmt0(e.data.ahorro_total)} MXN</span>
            <span class="bar-val">$${fmt3(e.data.costoKgProd)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${barPct(e.data.costoKgProd)}%; background:${e.color};">
              <span class="bar-inner">▼ $${fmt3(Math.abs(e.data.ahorro_ave))}/ave</span>
            </div>
          </div>
        </div>`).join('')}
    </div>`;

  const tablaFilas = d.escenarios.map(e => {
    const r = e.data;
    const isPos = r.ahorro_ave >= 0;
    return `
      <tr>
        <td><span class="dot" style="background:${e.color};"></span>${e.label}</td>
        <td>$${fmt3(r.costoKgAlim)}</td>
        <td>$${fmt3(r.costoAve)}</td>
        <td class="highlight">$${fmt3(r.costoKgProd)}</td>
        <td class="${isPos ? 'pos' : 'neg'}">${isPos ? '▼' : '▲'} $${fmt3(Math.abs(r.ahorro_ave))}</td>
        <td class="${isPos ? 'pos' : 'neg'} bold">${isPos ? '+' : ''}${fmt0(r.ahorro_total)} MXN</td>
        <td>$${fmt2(r.costoProductoTon)}</td>
        <td>$${fmt2(r.ahorroFormTon)}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Eubiotics</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#222; font-size:12px; }
  .page { max-width:900px; margin:0 auto; padding:32px 40px; }
  .header { background:#1B2B6B; color:#fff; padding:24px 32px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
  .header-title { font-size:18px; font-weight:700; color:#C5D92D; margin-top:8px; }
  .header-sub { font-size:11px; color:rgba(255,255,255,0.6); margin-top:4px; }
  .header-right { text-align:right; }
  .header-date { font-size:11px; color:rgba(255,255,255,0.5); }
  .header-mercado { font-size:13px; color:#fff; font-weight:600; margin-top:4px; }
  .section-title { font-size:13px; font-weight:700; color:#1B2B6B; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #C5D92D; }
  .params-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
  .param-card { background:#f8f9ff; border:1px solid #e8eaf6; border-radius:8px; padding:10px 14px; }
  .param-label { font-size:9px; color:#888; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; margin-bottom:3px; }
  .param-value { font-size:15px; font-weight:700; color:#1B2B6B; }
  .param-unit { font-size:10px; color:#aaa; }
  .grafica { background:#1B2B6B; border-radius:10px; padding:20px 24px; margin-bottom:24px; }
  .grafica-hint { font-size:9px; color:#C5D92D; text-align:right; margin-bottom:12px; }
  .bar-row { margin-bottom:12px; }
  .bar-label-wrap { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
  .bar-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .bar-name { font-size:11px; font-weight:600; color:#fff; flex:1; }
  .base-name { color:rgba(255,255,255,0.4); font-style:italic; font-weight:400; }
  .bar-savings { font-size:10px; color:#C5D92D; }
  .bar-val { font-size:13px; font-weight:700; color:#C5D92D; min-width:64px; text-align:right; }
  .base-val { color:rgba(255,255,255,0.35); }
  .bar-track { height:26px; background:rgba(255,255,255,0.06); border-radius:5px; overflow:hidden; }
  .bar-fill { height:100%; border-radius:5px; display:flex; align-items:center; padding-left:10px; }
  .bar-inner { font-size:9px; color:#fff; font-weight:600; white-space:nowrap; opacity:0.9; }
  table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:24px; }
  th { background:#1B2B6B; color:rgba(255,255,255,0.8); padding:8px 10px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:0.4px; }
  td { padding:9px 10px; border-bottom:1px solid #f0f0f0; }
  .base-row td { color:#aaa; font-style:italic; }
  .dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:5px; vertical-align:middle; }
  .highlight { font-weight:700; font-size:13px; color:#1B2B6B; }
  .pos { color:#2e7d32; font-weight:600; }
  .neg { color:#c62828; font-weight:600; }
  .bold { font-weight:700; }
  .footer { margin-top:20px; padding-top:12px; border-top:1px solid #eee; display:flex; justify-content:space-between; }
  .footer-note { font-size:9px; color:#bbb; }
  .footer-brand { font-size:10px; color:#1B2B6B; font-weight:600; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { padding:16px 24px; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <img src="${d.logoUrl}" alt="Eubiotics" style="height:32px;" />
      <div class="header-title">Simulador de Escenarios EME</div>
      <div class="header-sub">Programa de Emulsificación Eficiente · Resultados orientativos</div>
    </div>
    <div class="header-right">
      <div class="header-date">${fecha}</div>
      <div class="header-mercado">${d.mercado}</div>
    </div>
  </div>

  <div class="section-title">Parámetros del Simulador</div>
  <div class="params-grid">
    <div class="param-card"><div class="param-label">Especie</div><div class="param-value" style="font-size:12px;">${d.especie}</div></div>
    <div class="param-card"><div class="param-label">Total Aves</div><div class="param-value">${fmt0(d.totalAves)}</div></div>
    <div class="param-card"><div class="param-label">Peso Vivo</div><div class="param-value">${d.pesoVivo} <span class="param-unit">kg</span></div></div>
    <div class="param-card"><div class="param-label">CA</div><div class="param-value">${d.fcr}</div></div>
    <div class="param-card"><div class="param-label">Precio Alimento</div><div class="param-value">${fmt0(d.precioAlimento)}</div><div class="param-unit">MXN/ton</div></div>
    <div class="param-card"><div class="param-label">Fuente de Grasa</div><div class="param-value" style="font-size:12px;">${d.fuenteGrasa}</div></div>
    <div class="param-card"><div class="param-label">Inclusión Grasa</div><div class="param-value">${d.grasa_pct} <span class="param-unit">%</span></div></div>
    <div class="param-card"><div class="param-label">Objetivo</div><div class="param-value" style="font-size:11px;">${d.objetivo}</div></div>
  </div>

  <div class="section-title">$/kg Producido por Programa</div>
  ${graficaBarras}

  <div class="section-title">Detalle de Escenarios</div>
  <table>
    <thead>
      <tr>
        <th>Programa</th><th>$/kg Alim.</th><th>$/Ave</th><th>$/kg Prod.</th>
        <th>Ahorro/Ave</th><th>Ahorro Total</th><th>Costo Prod./ton</th><th>Ahorro Form./ton</th>
      </tr>
    </thead>
    <tbody>
      <tr class="base-row">
        <td>Base (sin emulsif.)</td>
        <td>$${fmt3(d.base.costoKgAlim)}</td>
        <td>$${fmt3(d.base.costoAve)}</td>
        <td class="highlight">$${fmt3(d.base.costoKgProd)}</td>
        <td>—</td><td>—</td><td>—</td><td>—</td>
      </tr>
      ${tablaFilas}
    </tbody>
  </table>

  <div class="footer">
    <div class="footer-note">Resultados orientativos · Validar con nutricionista certificado · Eubiotics Latinoamericana</div>
    <div class="footer-brand">eubiotics.lat</div>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) alert('Permite las ventanas emergentes para generar el PDF');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}