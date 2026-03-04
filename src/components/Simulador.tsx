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

  // Motor de calculo
  const resultado = calcularEscenarios({
    especie, fuenteGrasa, grasa_pct,
    precioGrasa, totalAves, pesoVivo, fcr, precioAlimento,
    precioEstandar,
    precioLipotex250, dosisLX250, emKcalLX250: kcal250,
    precioLipotex350, dosisLX350, emKcalLX350: kcal350,
    precioLipotexM,   dosisLXM,   emKcalLXM:   kcalM,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb', fontFamily: "'Segoe UI', sans-serif" }}>
      <Header user={user} onLogout={onLogout} />
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
