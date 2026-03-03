import { ESPECIES } from './constants';
import type { EspecieKey, FuenteGrasaKey } from './types';

interface CalcInput {
  especie: EspecieKey;
  fuenteGrasa: FuenteGrasaKey;
  grasa_pct: number;
  precioGrasa: number;          // MXN/kg
  totalAves: number;
  pesoVivo: number;
  fcr: number;
  precioAlimento: number;       // MXN/ton
  precioEstandar: number;       // MXN/kg producto
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

interface CalcOutput {
  puedeMetodoA: boolean;
  sustratoOk: boolean;
  consumoTotalAve: number;
  base: { costoKgAlim: number; costoAve: number; costoKgProd: number };
  estandar:   ProgramaResult;
  lipotex250: ProgramaResult;
  lipotex350: ProgramaResult;
  lipotexM:   ProgramaResult;
}

interface ProgramaResult {
  costoKgAlim: number;
  costoAve: number;
  costoKgProd: number;
  ahorro_ave: number;
  ahorro_total: number;
  costoProductoTon: number;
  ahorroFormTon: number;
}

// Energía metabolizable de aceites/grasas (Kcal/kg)
const KCAL_ME_GRASA = 8500;

function calcPrograma(
  consumoTotalAve: number,
  pesoVivo: number,
  totalAves: number,
  precioAlimTon: number,        // $/ton alimento
  puedeMetodoA: boolean,
  precioGrasaKg: number,        // $/kg grasa
  dosis: { inicio: number; crecimiento: number; finalizacion: number },
  precioProductoKg: number,     // $/kg producto
  emKcal: number,
): ProgramaResult {
  const dosisPromedio = (dosis.inicio + dosis.crecimiento + dosis.finalizacion) / 3;

  // Costo del producto en $/ton alimento
  const costoProductoTon = (dosisPromedio / 1000) * precioProductoKg;

  // Ahorro de formulación: las Kcal recuperadas permiten retirar grasa equivalente
  // ahorro ($/ton alim) = (emKcal / Kcal_ME_grasa) × precio_grasa ($/ton)
  let ahorroFormTon = 0;
  if (puedeMetodoA && emKcal > 0 && precioGrasaKg > 0) {
    const precioGrasaTon = precioGrasaKg * 1000;
    ahorroFormTon = (emKcal / KCAL_ME_GRASA) * precioGrasaTon;
  }

  // Costo neto alimento ($/ton) → ($/kg)
  const costoNetoTon = precioAlimTon + costoProductoTon - ahorroFormTon;
  const costoKgAlim = costoNetoTon / 1000;

  const costoAve = consumoTotalAve * costoKgAlim;
  const costoKgProd = costoAve / pesoVivo;

  const costoBaseAve = consumoTotalAve * (precioAlimTon / 1000);
  const ahorro_ave = costoBaseAve - costoAve;
  const ahorro_total = ahorro_ave * totalAves;

  return {
    costoKgAlim,
    costoAve,
    costoKgProd,
    ahorro_ave,
    ahorro_total,
    costoProductoTon,
    ahorroFormTon,
  };
}

export function calcularEscenarios(input: CalcInput): CalcOutput {
  const especieData = ESPECIES[input.especie];
  const sustratoOk = input.grasa_pct >= especieData.grasamMin;
  const puedeMetodoA = especieData.puedeRecuperarEM && sustratoOk;
  const consumoTotalAve = input.pesoVivo * input.fcr;
  const costoKgAlimBase = input.precioAlimento / 1000;

  const base = {
    costoKgAlim: costoKgAlimBase,
    costoAve: consumoTotalAve * costoKgAlimBase,
    costoKgProd: (consumoTotalAve * costoKgAlimBase) / input.pesoVivo,
  };

  const estandarDosis = { inicio: 350, crecimiento: 350, finalizacion: 350 };

  return {
    puedeMetodoA,
    sustratoOk,
    consumoTotalAve,
    base,
    estandar: calcPrograma(
      consumoTotalAve, input.pesoVivo, input.totalAves, input.precioAlimento,
      puedeMetodoA, input.precioGrasa, estandarDosis, input.precioEstandar, 35,
    ),
    lipotex250: calcPrograma(
      consumoTotalAve, input.pesoVivo, input.totalAves, input.precioAlimento,
      puedeMetodoA, input.precioGrasa, input.dosisLX250, input.precioLipotex250, input.emKcalLX250,
    ),
    lipotex350: calcPrograma(
      consumoTotalAve, input.pesoVivo, input.totalAves, input.precioAlimento,
      puedeMetodoA, input.precioGrasa, input.dosisLX350, input.precioLipotex350, input.emKcalLX350,
    ),
    lipotexM: calcPrograma(
      consumoTotalAve, input.pesoVivo, input.totalAves, input.precioAlimento,
      puedeMetodoA, input.precioGrasa, input.dosisLXM, input.precioLipotexM, input.emKcalLXM,
    ),
  };
}
