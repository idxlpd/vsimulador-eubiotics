// Formatea número con coma para miles y decimales configurables
export const fmt = (n: number | string, dec = 2): string => {
  const num = parseFloat(String(n));
  if (isNaN(num)) return '—';
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

// Formatea como moneda con 3 decimales siempre
export const fmtMXN = (n: number | string): string => fmt(n, 3);

// Formatea entero con comas para miles
export const fmtInt = (n: number | string): string => fmt(n, 0);