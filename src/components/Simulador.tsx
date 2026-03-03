import { useState, useEffect } from 'react';
import logoRaw from '../assets/Logo_Blanco_crop.png';

// Convierte la URL del asset a base64 para incrustarlo en el PDF
async function getLogoBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
import Header from './Header';
import SeccionEspecieMercado from './sections/SeccionEspecieMercado';
import SeccionFuenteGrasa from './sections/SeccionFuenteGrasa';
import SeccionProgramaDosis from './sections/SeccionProgramaDosis';
import SeccionParametros from './sections/SeccionParametros';
import SeccionEscenarios from './sections/SeccionEscenarios';
import { ESPECIES, FUENTES_GRASA } from '../constants';
import { calcularEscenarios } from '../engine';
import { exportarPDF } from '../utils/exportPDF';
import { exportarCSV } from '../utils/exportCSV';
import type { EspecieKey, FuenteGrasaKey, User } from '../types';

interface DosisSet { inicio: number; crecimiento: number; finalizacion: number; }

const PRECIO_EP_MXN  = 111.61;
const PRECIO_LX_MXN  = 103.02;
const PRECIO_LXM_MXN = 120.19;

const COLORES_PROGRAMA: Record<string, string> = {
  estandar:   '#9E9E9E',
  lipotex250: '#0288D1',
  lipotex350: '#2E7D32',
  lipotexM:   '#7B1FA2',
};

export default function Simulador({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [especie, setEspecie] = useState<EspecieKey>('pollo');
  const [mercado, setMercado] = useState('Mexico');
  const [tieneCalentamiento, setTieneCalentamiento] = useState(false);
  const [fuenteGrasa, setFuenteGrasa] = useState<FuenteGrasaKey>('soya');
  const [grasa_pct, setGrasaPct] = useState(4.0);
  const [precioGrasa, setPrecioGrasa] = useState(32.0);
  const [objetivo, setObjetivo] = useState<'kcal' | 'digestibilidad'>('kcal');

  const [dosisLX250, setDosisLX250] = useState<DosisSet>({ inicio: 250, crecimiento: 250, finalizacion: 250 });
  const [dosisLX350, setDosisLX350] = useState<DosisSet>({ inicio: 350, crecimiento: 350, finalizacion: 350 });
  const [dosisLXM,   setDosisLXM]   = useState<DosisSet>({ inicio: 350, crecimiento: 350, finalizacion: 350 });

  const [precioEstandar,   setPrecioEstandar]   = useState(PRECIO_EP_MXN);
  const [precioLipotex250, setPrecioLipotex250] = useState(PRECIO_LX_MXN);
  const [precioLipotex350, setPrecioLipotex350] = useState(PRECIO_LX_MXN);
  const [precioLipotexM,   setPrecioLipotexM]   = useState(PRECIO_LXM_MXN);

  const [totalAves,      setTotalAves]      = useState(100000);
  const [pesoVivo,       setPesoVivo]       = useState(2.5);
  const [fcr,            setFcr]            = useState(1.30);
  const [precioAlimento, setPrecioAlimento] = useState(7500);
  const [emKcalLX250, setEmKcalLX250] = useState(35);
  const [emKcalLX350, setEmKcalLX350] = useState(35);

  useEffect(() => {
    const d = ESPECIES[especie];
    setPesoVivo(d.pesoDefault);
    setTotalAves(d.avesDefault);
    setFcr(d.fcrDefault);
  }, [especie]);

  useEffect(() => {
    setPrecioGrasa(FUENTES_GRASA[fuenteGrasa].precioDefault);
  }, [fuenteGrasa]);

  useEffect(() => {
    if (!ESPECIES[especie].puedeRecuperarEM) setObjetivo('digestibilidad');
  }, [especie]);

  const emKcalLXM = fuenteGrasa === 'acidulado' ? 50 : 35;
  const kcal250 = objetivo === 'kcal' ? emKcalLX250 : 0;
  const kcal350 = objetivo === 'kcal' ? emKcalLX350 : 0;
  const kcalM   = objetivo === 'kcal' ? emKcalLXM   : 0;

  const resultado = calcularEscenarios({
    especie, fuenteGrasa, grasa_pct,
    precioGrasa, totalAves, pesoVivo, fcr, precioAlimento,
    precioEstandar,
    precioLipotex250, dosisLX250, emKcalLX250: kcal250,
    precioLipotex350, dosisLX350, emKcalLX350: kcal350,
    precioLipotexM,   dosisLXM,   emKcalLXM:   kcalM,
  });

  const exportData = {
    especie: ESPECIES[especie].label,
    mercado,
    fuenteGrasa,
    grasa_pct,
    totalAves,
    pesoVivo,
    fcr,
    precioAlimento,
    precioGrasa,
    objetivo,
    base: resultado.base,
  };

  const handleExportPDF = async () => {
  const logoBase64 = await getLogoBase64(logoRaw);
  exportarPDF({
    ...exportData,
    escenarios: [
      { label: 'EP',             color: COLORES_PROGRAMA.estandar,   data: resultado.estandar   },
      { label: 'Lipotex Plus',   color: COLORES_PROGRAMA.lipotex250, data: resultado.lipotex250 },
      { label: 'Lipotex Plus M', color: COLORES_PROGRAMA.lipotexM,   data: resultado.lipotexM   },
    ],
    logoUrl: logoBase64,
  });
};

  const handleExportCSV = () => {
    exportarCSV({
      ...exportData,
      escenarios: [
        { label: 'EP',             data: resultado.estandar   },
        { label: 'Lipotex Plus',   data: resultado.lipotex250 },
        { label: 'Lipotex Plus M', data: resultado.lipotexM   },
      ],
    });
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
        />
        <SeccionEscenarios
          especie={especie} totalAves={totalAves}
          base={resultado.base}
          estandar={resultado.estandar}
          lipotex250={resultado.lipotex250}
          lipotex350={resultado.lipotex350}
          lipotexM={resultado.lipotexM}
        />
        <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 16 }}>
          Eubiotics Latinoamericana · Simulador de Escenarios · Resultados orientativos — validar con nutricionista
        </div>
      </div>
    </div>
  );
}