import type { EspecieData, FuenteGrasaData, ProgramaData, User } from './types';

export const USERS: User[] = [
  { id: 'admin', password: 'eubiotics2026', name: 'Administrador', role: 'admin' },
  { id: 'jonathan', password: 'jonathan2026', name: 'Jonathan', role: 'user' },
  { id: 'ronald', password: 'ronald2026', name: 'Ronald', role: 'user' },
];

export const FUENTES_GRASA: Record<string, FuenteGrasaData> = {
  soya:      { label: 'Aceite de Soya',   digestibilidad: 92, liquido: true,  calentamiento: false, precioDefault: 32.00 },
  acidulado: { label: 'Aceite Acidulado', digestibilidad: 78, liquido: true,  calentamiento: false, precioDefault: 19.00 },
  palma:     { label: 'Aceite de Palma',  digestibilidad: 75, liquido: false, calentamiento: true,  precioDefault: 22.00 },
  amarilla:  { label: 'Grasa Amarilla',   digestibilidad: 70, liquido: false, calentamiento: true,  precioDefault: 22.00 },
};

export const ESPECIES: Record<string, EspecieData> = {
  pollo: { label: 'Pollo de Engorda', grasamMin: 2.0, puedeRecuperarEM: true, pesoDefault: 3.1, consumoDefault: 4.5, fcrDefault: 1.50, avesDefault: 100000 },
  gallina: { label: 'Gallina',          grasamMin: 1.0,  puedeRecuperarEM: false, pesoDefault: 1.8,  consumoDefault: 45,   fcrDefault: 2.10, avesDefault: 50000  },
  cerdo:   { label: 'Cerdo',            grasamMin: 0.5,  puedeRecuperarEM: false, pesoDefault: 110,  consumoDefault: 280,  fcrDefault: 2.50, avesDefault: 5000   },
};

export const MERCADOS = ['México', 'Guatemala', 'República Dominicana', 'Colombia', 'Otro'];

export const PROGRAMAS: Record<string, ProgramaData> = {
  ep:         { label: 'EP',             dosisDefault: 350, dosisEditable: false, precioDefault: 6.50, kcalFijas: 35,  incluyeLipasa: false, esCompetidor: true  },
  lipotex250: { label: 'Lipotex Plus',   dosisDefault: 250, dosisEditable: true,  precioDefault: 6.00, kcalFijas: null, incluyeLipasa: false, esCompetidor: false },
  lipotex350: { label: 'Lipotex Plus',   dosisDefault: 350, dosisEditable: true,  precioDefault: 6.00, kcalFijas: null, incluyeLipasa: false, esCompetidor: false },
  lipotexM:   { label: 'Lipotex Plus M', dosisDefault: 350, dosisEditable: true,  precioDefault: 7.00, kcalFijas: null, incluyeLipasa: true,  esCompetidor: false },
};

export const COLORES = {
  azul:     '#1B2B6B',
  verde:    '#C5D92D',
  naranja:  '#FF9800',
  rojo:     '#e53935',
  gris:     '#9E9E9E',
};
