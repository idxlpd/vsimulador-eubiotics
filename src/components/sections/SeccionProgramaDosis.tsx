import DosisSlider from '../DosisSlider';
import type { FuenteGrasaKey } from '../../types';

interface DosisSet { inicio: number; crecimiento: number; finalizacion: number; }

interface Props {
  fuenteGrasa: FuenteGrasaKey;
  dosisLX250: DosisSet;
  dosisLX350: DosisSet;
  dosisLXM: DosisSet;
  onDosisLX250: (d: DosisSet) => void;
  onDosisLX350: (d: DosisSet) => void;
  onDosisLXM: (d: DosisSet) => void;
}

const FASES = ['inicio', 'crecimiento', 'finalizacion'] as const;
const FASE_LABELS = { inicio: 'Inicio (0–14d)', crecimiento: 'Crecimiento (15–28d)', finalizacion: 'Finalización (29–42d)' };

function ProgramaSliders({ label, dosis, onChange, color }: { label: string; dosis: DosisSet; onChange: (d: DosisSet) => void; color: string }) {
  return (
    <div style={{ padding: 16, background: '#fafcff', borderRadius: 8, border: `1px solid ${color}22`, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{label}</div>
      {FASES.map(f => (
        <DosisSlider key={f} label={FASE_LABELS[f]} value={dosis[f]} onChange={v => onChange({ ...dosis, [f]: v })} />
      ))}
    </div>
  );
}

export default function SeccionProgramaDosis({ fuenteGrasa, dosisLX250, dosisLX350, dosisLXM, onDosisLX250, onDosisLX350, onDosisLXM }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '24px 28px', marginBottom: 16, border: '1px solid #eee', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1B2B6B', marginBottom: 4 }}>Programa y dosis por fase</div>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 20 }}>Ajusta las dosis por fase para cada programa</div>

      {/* EP: fijo, no editable */}
      <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, border: '1px solid #e0e0e0', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>EP</div>
        <div style={{ fontSize: 12, color: '#aaa' }}>350 g/ton · Todas las fases · Fijo (no editable)</div>
      </div>

      <ProgramaSliders label="Lipotex Plus" dosis={dosisLX250} onChange={onDosisLX250} color="#1B2B6B" />
      <ProgramaSliders label="Lipotex Plus 350" dosis={dosisLX350} onChange={onDosisLX350} color="#1B2B6B" />
      <ProgramaSliders label="Lipotex Plus M" dosis={dosisLXM} onChange={onDosisLXM} color="#7B1FA2" />

      {fuenteGrasa === 'acidulado' && (
        <div style={{ marginTop: 8, padding: '8px 14px', background: '#f3e5f5', borderLeft: '3px solid #7B1FA2', borderRadius: '0 6px 6px 0', fontSize: 12, color: '#4A148C' }}>
          Lipotex Plus M con Aceite Acidulado: libera automáticamente 50 Kcal/kg.
        </div>
      )}
    </div>
  );
}
