interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export default function DosisSlider({ label, value, onChange, disabled = false }: Props) {
  const opciones = [250, 300, 350];
  const pct = ((value - 250) / 100) * 100;

  return (
    <div style={{ marginBottom: 20, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#444', fontWeight: 500 }}>{label}</span>
        <span style={{ background: '#1B2B6B', color: '#fff', borderRadius: 6, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ position: 'relative', height: 6, background: '#e0e0e0', borderRadius: 3 }}>
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: '100%', background: '#C5D92D', borderRadius: 3, transition: 'width 0.2s' }} />
        <input type="range" min={250} max={350} step={50} value={value}
          onChange={e => !disabled && onChange(Number(e.target.value))}
          disabled={disabled}
          style={{ position: 'absolute', top: -6, left: 0, width: '100%', opacity: 0, cursor: disabled ? 'not-allowed' : 'pointer', height: 18 }} />
        {opciones.map(op => (
          <div key={op} onClick={() => !disabled && onChange(op)}
            style={{ position: 'absolute', top: '50%', left: `${((op - 250) / 100) * 100}%`, transform: 'translate(-50%, -50%)', width: 12, height: 12, borderRadius: '50%', background: value >= op ? '#C5D92D' : '#ccc', border: '2px solid #fff', cursor: disabled ? 'not-allowed' : 'pointer', zIndex: 2 }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {opciones.map(op => <span key={op} style={{ fontSize: 10, color: '#aaa' }}>{op}</span>)}
      </div>
    </div>
  );
}