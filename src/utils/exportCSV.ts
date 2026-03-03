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
  escenarios: Array<{ label: string; data: ProgramaResult }>;
}

function fmt3(n: number) { return n.toFixed(3); }
function fmt0(n: number) { return n.toFixed(0); }

export function exportarCSV(d: ExportData) {
  const rows: string[][] = [];

  rows.push(['SIMULADOR EUBIOTICS — Reporte de Escenarios']);
  rows.push([`Fecha: ${new Date().toLocaleDateString('es-MX')}`]);
  rows.push([]);
  rows.push(['PARÁMETROS']);
  rows.push(['Especie', d.especie]);
  rows.push(['Mercado', d.mercado]);
  rows.push(['Fuente de grasa', d.fuenteGrasa]);
  rows.push(['Inclusión grasa (%)', String(d.grasa_pct)]);
  rows.push(['Precio grasa (MXN/kg)', String(d.precioGrasa)]);
  rows.push(['Total aves', String(d.totalAves)]);
  rows.push(['Peso vivo (kg)', String(d.pesoVivo)]);
  rows.push(['CA', String(d.fcr)]);
  rows.push(['Precio alimento (MXN/ton)', String(d.precioAlimento)]);
  rows.push(['Objetivo emulsificante', d.objetivo]);
  rows.push([]);
  rows.push(['RESULTADOS']);
  rows.push(['Programa', '$/kg Alim c/trat.', '$/Ave', '$/kg Prod.', 'Ahorro/Ave (MXN)', 'Ahorro Total (MXN)', 'Costo Producto ($/ton)', 'Ahorro Form. ($/ton)']);
  rows.push([
    'Base (sin emulsif.)',
    fmt3(d.base.costoKgAlim),
    fmt3(d.base.costoAve),
    fmt3(d.base.costoKgProd),
    '0', '0', '0', '0',
  ]);
  for (const e of d.escenarios) {
    const r = e.data;
    rows.push([
      e.label,
      fmt3(r.costoKgAlim),
      fmt3(r.costoAve),
      fmt3(r.costoKgProd),
      fmt3(r.ahorro_ave),
      fmt0(r.ahorro_total),
      r.costoProductoTon.toFixed(2),
      r.ahorroFormTon.toFixed(2),
    ]);
  }

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eubiotics-escenarios-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}