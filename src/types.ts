export type EspecieKey = 'pollo' | 'gallina' | 'cerdo';
export type FuenteGrasaKey = 'soya' | 'acidulado' | 'palma' | 'amarilla';
export type ProgramaKey = 'estandar' | 'lipotex250' | 'lipotex350' | 'lipotexM';

export interface User {
  id: string;
  password: string;
  name: string;
  role: string;
}

export interface EspecieData {
  label: string;
  grasamMin: number;
  puedeRecuperarEM: boolean;
  pesoDefault: number;
  consumoDefault: number;
  fcrDefault: number;
  avesDefault: number;
}

export interface FuenteGrasaData {
  label: string;
  digestibilidad: number;
  liquido: boolean;
  calentamiento: boolean;
  precioDefault: number;
}

export interface ProgramaData {
  label: string;
  dosisDefault: number;
  dosisEditable: boolean;
  precioDefault: number;
  kcalFijas: number | null;
  incluyeLipasa: boolean;
  esCompetidor: boolean;
}

export interface ResultadoEscenario {
  puedeMetodoA: boolean;
  sustratoOk: boolean;
  costoBase_ave: string;
  costoBase_kgProd: string;
  costoBase_kgAlim: string;
  costoLX_ave: string;
  costoLX_kgProd: string;
  costoLX_kgAlim: string;
  ahorroLX_ave: string;
  ahorroLX_total: string;
  costoLXporTon: string;
  ahorroFormLX: string;
  costoEstandar_ave: string;
  costoEstandar_kgProd: string;
  costoEstandar_kgAlim: string;
  ahorroEstandar_ave: string;
  ahorroEstandar_total: string;
  costoEstandarporTon: string;
  consumoTotalAve: string;
}

export interface DosisPrograma {
  inicio: number;
  crecimiento: number;
  finalizacion: number;
}