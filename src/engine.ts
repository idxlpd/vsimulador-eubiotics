import { ESPECIES } from './constants';
import type { EspecieKey, FuenteGrasaKey } from './types';

// EM target promedio por especie (kcal/kg dieta)
const EM_TARGET: Record<string, number> = {
  pollo:   3150,  // promedio inicio 3100 / crecimiento 3160 / finalizacion 3200
  gallina: 2700,
  cerdo:   3500,
};

export interface EscenarioInput {
  programaKey: 'estandar' | 'lipotex250' | 'lipotex350' | 'lipotexM';
  fuenteGrasa: FuenteGrasaKey;
  grasa_pct: number;
  precioGrasa: number;        // MXN/kg
  precioProducto: number;     // MXN/kg
  dosis: { inicio: number; crecimiento: number; finalizacion: number };
  emKcal: number;             // kcal liberadas por kg de dieta
}

export interface EscenarioResult {
  costoKgAlim: number;
  costoAve: number;
  costoKgProd: number;
  ahorro_ave: number;
  ahorro_total: number;
  costoProductoTon: number;
  ahorroFormTon: number;
  // campos internos utiles para debug
  precioAlimEfectivo: number;
}

export interface CalcGlobalInput {
  especie: EspecieKey;
  totalAves: number;
  pesoVivo: number;
  fcr: number;
  precioAlimento: number;     // MXN/ton
}

export interface CalcOutput {
  puedeMetodoA: boolean;
  sustratoOk: boolean;
  consumoTotalAve: number;
  base: { costoKgAlim: number; costoAve: number; costoKgProd: number };
  estandar:   EscenarioResult;
  lipotex250: EscenarioResult;
  lipotex350: EscenarioResult;
  lipotexM:   EscenarioResult;
}

// ---------- calculo por escenario ----------
export function calcEscenario(
  global: CalcGlobalInput,
  esc: EscenarioInput,
  puedeMetodoA: boolean,
): EscenarioResult {
  const emTarget = EM_TARGET[global.especie] ?? 3150;
  const consumoTotalAve = global.pesoVivo * global.fcr;

  // Dosis promedio g/ton → kg/ton
  const dosisPromedio = (esc.dosis.inicio + esc.dosis.crecimiento + esc.dosis.finalizacion) / 3;
  const dosisKgTon = dosisPromedio / 1000;

  // Costo del producto ($/ton alimento)
  const costoProductoTon = dosisKgTon * esc.precioProducto;

  // Ahorro de formulacion:
  // Cada kcal liberada por kg de dieta representa una fraccion del costo de formulacion
  // ahorroFormTon = (emKcal / emTarget) * precioAlimento
  let ahorroFormTon = 0;
  if (puedeMetodoA && esc.emKcal > 0) {
    ahorroFormTon = (esc.emKcal / emTarget) * global.precioAlimento;
  }

  // Costo neto alimento ($/ton)
  const costoNetoTon = global.precioAlimento + costoProductoTon - ahorroFormTon;
  const costoKgAlim = costoNetoTon / 1000;

  const costoAve = consumoTotalAve * costoKgAlim;
  const costoKgProd = costoAve / global.pesoVivo;

  // Ahorro vs base (sin emulsificante)
  const costoBaseAve = consumoTotalAve * (global.precioAlimento / 1000);
  const ahorro_ave = costoBaseAve - costoAve;
  const ahorro_total = ahorro_ave * global.totalAves;

  return {
    costoKgAlim,
    costoAve,
    costoKgProd,
    ahorro_ave,
    ahorro_total,
    costoProductoTon,
    ahorroFormTon,
    precioAlimEfectivo: costoNetoTon,
  };
}

// ---------- funcion principal (mantiene compatibilidad con Simulador.tsx) ----------
interface LegacyInput {
  especie: EspecieKey;
  fuenteGrasa: FuenteGrasaKey;
  grasa_pct: number;
  precioGrasa: number;
  totalAves: number;
  pesoVivo: number;
  fcr: number;
  precioAlimento: number;
  precioEstandar: number;
  precioLipotex250: number;
  dosisLX250: { inicio: number; crecimiento: number; finalizacion: number };
  emKcalLX250: number;
  precioLipotex350: number;
  dosisLX350: { inicio: number; crecimiento: number; finalizacion: number };
  emKcalLX350: number;
  precioLipotexM: number;
  dosisLXM: { inicio: number; crecimiento: number; finalizacion: number };
  emKcalLXM: number;
}

export function calcularEscenarios(input: LegacyInput): CalcOutput {
  const especieData = ESPECIES[input.especie];
  const sustratoOk = input.grasa_pct >= especieData.grasamMin;
  const puedeMetodoA = especieData.puedeRecuperarEM && sustratoOk;
  const consumoTotalAve = input.pesoVivo * input.fcr;

  const global: CalcGlobalInput = {
    especie: input.especie,
    totalAves: input.totalAves,
    pesoVivo: input.pesoVivo,
    fcr: input.fcr,
    precioAlimento: input.precioAlimento,
  };

  const base = {
    costoKgAlim: input.precioAlimento / 1000,
    costoAve: consumoTotalAve * (input.precioAlimento / 1000),
    costoKgProd: (consumoTotalAve * (input.precioAlimento / 1000)) / input.pesoVivo,
  };

  const dosisEstandar = { inicio: 350, crecimiento: 350, finalizacion: 350 };

  return {
    puedeMetodoA,
    sustratoOk,
    consumoTotalAve,
    base,
    estandar: calcEscenario(global, {
      programaKey: 'estandar',
      fuenteGrasa: input.fuenteGrasa,
      grasa_pct: input.grasa_pct,
      precioGrasa: input.precioGrasa,
      precioProducto: input.precioEstandar,
      dosis: dosisEstandar,
      emKcal: 35,
    }, puedeMetodoA),
    lipotex250: calcEscenario(global, {
      programaKey: 'lipotex250',
      fuenteGrasa: input.fuenteGrasa,
      grasa_pct: input.grasa_pct,
      precioGrasa: input.precioGrasa,
      precioProducto: input.precioLipotex250,
      dosis: input.dosisLX250,
      emKcal: input.emKcalLX250,
    }, puedeMetodoA),
    lipotex350: calcEscenario(global, {
      programaKey: 'lipotex350',
      fuenteGrasa: input.fuenteGrasa,
      grasa_pct: input.grasa_pct,
      precioGrasa: input.precioGrasa,
      precioProducto: input.precioLipotex350,
      dosis: input.dosisLX350,
      emKcal: input.emKcalLX350,
    }, puedeMetodoA),
    lipotexM: calcEscenario(global, {
      programaKey: 'lipotexM',
      fuenteGrasa: input.fuenteGrasa,
      grasa_pct: input.grasa_pct,
      precioGrasa: input.precioGrasa,
      precioProducto: input.precioLipotexM,
      dosis: input.dosisLXM,
      emKcal: input.emKcalLXM,
    }, puedeMetodoA),
  };
}
