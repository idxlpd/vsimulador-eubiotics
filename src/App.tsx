import { useState, useEffect, useCallback } from "react";

// ─── DATOS DE USUARIOS ────────────────────────────────────────────────────────
const USERS = [
  { id: "admin", password: "eubiotics2026", name: "Administrador", role: "admin" },
];

// ─── CONSTANTES DE NEGOCIO ────────────────────────────────────────────────────
const FUENTES_GRASA = {
  soya:      { label: "Aceite de Soya",   digestibilidad: 92, liquido: true,  calentamiento: false, precioDefault: 30.00 },
  acidulado: { label: "Aceite Acidulado", digestibilidad: 78, liquido: true,  calentamiento: false, precioDefault: 22.00 },
  palma:     { label: "Aceite de Palma",  digestibilidad: 75, liquido: false, calentamiento: true,  precioDefault: 18.00 },
  amarilla:  { label: "Grasa Amarilla",   digestibilidad: 70, liquido: false, calentamiento: true,  precioDefault: 14.00 },
};

const ESPECIES = {
  pollo:   { label: "Pollo de Engorda", grasamMin: 2.0,  puedeRecuperarEM: true,  pesoDefault: 2.5, consumoDefault: 4.5, fcrDefault: 1.80, avesDefault: 100000 },
  gallina: { label: "Gallina",          grasamMin: 1.0,  puedeRecuperarEM: false, pesoDefault: 1.8, consumoDefault: 45,  fcrDefault: 2.10, avesDefault: 50000  },
  cerdo:   { label: "Cerdo",            grasamMin: 0.5,  puedeRecuperarEM: false, pesoDefault: 110, consumoDefault: 280, fcrDefault: 2.50, avesDefault: 5000   },
};

const MERCADOS = ["México", "Guatemala", "República Dominicana", "Colombia", "Otro"];

// ─── MOTOR DE CÁLCULO ─────────────────────────────────────────────────────────
function calcularEscenario({ especie, fuenteGrasa, grasa_pct, programa, dosis, tieneCalentamiento,
  precioGrasa, precioLipotex, precioEnergyPlus, precioLipasa,
  totalAves, pesoVivo, fcr, precioAlimento, emRecuperadaEME, emRecuperadaEP,
  usaLipasa, dosisInicio, dosisCrecimiento, dosisFinalizacion }) {

  const especieData = ESPECIES[especie];
  const fuenteData = FUENTES_GRASA[fuenteGrasa];

  // Validar sustrato mínimo
  const sustratoOk = grasa_pct >= especieData.grasamMin;
  const puedeMetodoA = especieData.puedeRecuperarEM && sustratoOk;

  // Consumo total por ave (kg)
  const consumoTotalAve = pesoVivo * fcr;

  // Fases: distribución estándar 15% inicio, 35% crecimiento, 50% finalización
  const consumoInicio       = consumoTotalAve * 0.15;
  const consumoCrecimiento  = consumoTotalAve * 0.35;
  const consumoFinalizacion = consumoTotalAve * 0.50;

  // Costo base de alimento por kg (sin tratamiento)
  const costoAlimBase = precioAlimento / 1000; // $/kg alimento

  // ─ BASE (sin emulsificante) ─
  const costoBase_ave    = consumoTotalAve * costoAlimBase;
  const costoBase_kgProd = costoBase_ave / pesoVivo;

  // ─ LIPOTEX PLUS ─
  // Costo del producto por tonelada de alimento
  const dosisPromLX = (dosisInicio + dosisCrecimiento + dosisFinalizacion) / 3;
  const costoLXporTon = (dosisPromLX / 1000) * precioLipotex; // $/ton alimento

  // Ahorro en formulación por kcal recuperadas (Método A o B)
  let ahorroFormulacion_kgAlim = 0;
  if (puedeMetodoA && emRecuperadaEME > 0) {
    // Ahorro en $/kg alimento = (EM recuperada / EM total) * precio grasa * inclusión grasa
    const factorEnergetico = emRecuperadaEME / 3150; // fracción de EM recuperada
    ahorroFormulacion_kgAlim = factorEnergetico * (precioGrasa / 1000) * (grasa_pct / 100) * 1000;
    ahorroFormulacion_kgAlim = Math.min(ahorroFormulacion_kgAlim, (emRecuperadaEME / 3150) * costoAlimBase * 0.8);
  }

  const costoLXporKgAlim   = costoLXporTon / 1000;
  let costoLipasa_kgAlim   = 0;
  if (usaLipasa) {
    costoLipasa_kgAlim = (350 / 1000000) * precioLipasa; // lipasa ~350g/ton
  }

  const costoNetoLX_kgAlim  = costoAlimBase + costoLXporKgAlim + costoLipasa_kgAlim - ahorroFormulacion_kgAlim;
  const costoLX_ave          = consumoTotalAve * costoNetoLX_kgAlim;
  const costoLX_kgProd       = costoLX_ave / pesoVivo;

  // Ahorro total vs base
  const ahorroLX_ave         = costoBase_ave - costoLX_ave;
  const ahorroLX_totalAves   = ahorroLX_ave * totalAves;

  // ─ ENERGY PLUS (competidor) ─
  const costoEPporTon        = (350 / 1000) * precioEnergyPlus;
  let ahorroFormEP_kgAlim    = 0;
  if (puedeMetodoA && emRecuperadaEP > 0) {
    const factorEP = emRecuperadaEP / 3150;
    ahorroFormEP_kgAlim = factorEP * (precioGrasa / 1000) * (grasa_pct / 100) * 1000;
    ahorroFormEP_kgAlim = Math.min(ahorroFormEP_kgAlim, (emRecuperadaEP / 3150) * costoAlimBase * 0.8);
  }

  const costoEPporKgAlim     = costoEPporTon / 1000;
  const costoNetoEP_kgAlim   = costoAlimBase + costoEPporKgAlim - ahorroFormEP_kgAlim;
  const costoEP_ave          = consumoTotalAve * costoNetoEP_kgAlim;
  const costoEP_kgProd       = costoEP_ave / pesoVivo;
  const ahorroEP_ave         = costoBase_ave - costoEP_ave;
  const ahorroEP_totalAves   = ahorroEP_ave * totalAves;

  // ─ Por fase ─
  const calcFase = (consumo, dosis_gt, costoAlimKg, precioTrat, ahorroKg) => {
    const costoTrat = (dosis_gt / 1000000) * precioTrat * consumo * 1000;
    return {
      costo: consumo * costoAlimKg + costoTrat - ahorroKg * consumo,
      consumo
    };
  };

  return {
    puedeMetodoA,
    sustratoOk,
    // Base
    costoBase_ave:  costoBase_ave.toFixed(3),
    costoBase_kgProd: costoBase_kgProd.toFixed(3),
    // Lipotex Plus
    costoLX_ave:    costoLX_ave.toFixed(3),
    costoLX_kgProd: costoLX_kgProd.toFixed(3),
    ahorroLX_ave:   ahorroLX_ave.toFixed(3),
    ahorroLX_total: ahorroLX_totalAves.toFixed(0),
    costoLXporTon:  costoLXporTon.toFixed(2),
    ahorroFormLX:   (ahorroFormulacion_kgAlim * 1000).toFixed(2),
    // Energy Plus
    costoEP_ave:    costoEP_ave.toFixed(3),
    costoEP_kgProd: costoEP_kgProd.toFixed(3),
    ahorroEP_ave:   ahorroEP_ave.toFixed(3),
    ahorroEP_total: ahorroEP_totalAves.toFixed(0),
    costoEPporTon:  costoEPporTon.toFixed(2),
    ahorroFormEP:   (ahorroFormEP_kgAlim * 1000).toFixed(2),
    // General
    consumoTotalAve: consumoTotalAve.toFixed(3),
  };
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
const fmt = (n, dec = 2) => {
  const num = parseFloat(n);
  if (isNaN(num)) return "—";
  return num.toLocaleString("es-MX", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

// ─── COMPONENTE LOGIN ─────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const user = USERS.find(u => u.id === id.trim() && u.password === pw);
      if (user) {
        onLogin(user);
      } else {
        setError("Usuario o contraseña incorrectos.");
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1e4a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ width: 420, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
        {/* Header */}
        <div style={{ background: "#1B2B6B", padding: "36px 40px 28px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <EubioticsLogo size={36} />
          </div>
          <p style={{ color: "#C5D92D", margin: "8px 0 0", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Simulador de Escenarios</p>
        </div>
        {/* Form */}
        <div style={{ padding: "36px 40px 40px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Usuario</label>
              <input value={id} onChange={e => { setId(e.target.value); setError(""); }}
                style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #ddd", borderRadius: 7, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }}
                onFocus={e => e.target.style.borderColor = "#1B2B6B"}
                onBlur={e => e.target.style.borderColor = "#ddd"}
                placeholder="Ingresa tu usuario" autoComplete="username" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Contraseña</label>
              <input type="password" value={pw} onChange={e => { setPw(e.target.value); setError(""); }}
                style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #ddd", borderRadius: 7, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#1B2B6B"}
                onBlur={e => e.target.style.borderColor = "#ddd"}
                placeholder="Contraseña" autoComplete="current-password" />
            </div>
            {error && <div style={{ background: "#fff3f3", border: "1px solid #fcc", borderRadius: 6, padding: "10px 14px", color: "#c0392b", fontSize: 13, marginBottom: 18 }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "13px", background: loading ? "#ccc" : "#1B2B6B", color: "#fff", border: "none", borderRadius: 7, fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", letterSpacing: 0.3 }}>
              {loading ? "Verificando..." : "Ingresar"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#aaa" }}>Eubiotics Latinoamericana © 2026</p>
        </div>
      </div>
    </div>
  );
}

// ─── LOGO SVG ─────────────────────────────────────────────────────────────────
function EubioticsLogo({ size = 28 }) {
  const h = size * 0.85;
  const w = size * 4.5;
  return (
    <img
      src="data:image/png;base64,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7bbbDsOHD0cikfA/wzmH53nQdR1A5/NcMplEIpGglpYWLFq0CB9//DHef/99fPjhh3j//ffl/Axw0EEH0Q477IBtttkGo0aNwhZbbIG6ujp4npcnjKwJy7Kora0NixcvxuzZs/H2229j/vz5G28/DxkyhA466CC69dZb6fPPPw/1pthCOOfkOA7Ztk3PPfccnXrqqfLmWElVEByj1XxT+9lnn01Tp04NpX5rY9q0afTLX/6SRowYIefoRsyYMWPojDPOoBdeeIE6OjqIiMi27aLHVzab9b8PltfS0kIffPABXXrppbTLLrtsNGNv3333LbpPC2lvb/f3c8uyiEje1N7bGDVqFB133HH0j3/8g7766iuybbss8/O6666jHXfccaMbTxMnTqTrr7+eFixYQMlk0u8Xx3FCOzcQEXV0dNCTTz5JRx99dFn6uOLSz0knnUT77bcfDjzwQDQ2NgIAHMcBYwyaVjoDDuccnHOkUik0NDQAAN577z3cddddeOCBByreLxvCxIkTae+994ZhGLAsC6qqwnGcosrUdR2e5yESicC2bcyYMQOvvfZa1fbPxIkT6Uc/+hGi0ShM04RlWUWVF4lEkMlkEIvFYJomGGN46aWXMGvWrJL0AVFus171T3csgN0pM6+siRMnbpAr41FHHUVnnnkm9ttvPwC+Bqvo+q0Ny7IQiUQAANOnT8c999yDxx57rGrH37oIe3w6joOamhqkUinoug4iwhdffIFHH320x/ZRkEsvvZR22203TJgwAXV1dSAi2LYNXdfzrB9h4LouFEXxy21vb0d9fT0A4IsvvsCzzz6Lhx9+GB9//HHV9u1VV11FkUgEnuf57mlrQ4wZXdeRyWTwgx/8AKeddhoymQwURUE0Gg21fsJqdf3110PTNGQymaLKE+tyPB7H3Llz8dBDDxX9biZPnkyqqqK2thatra1FlSU006sswVBVFZlMBtdff33VjqHuMnz4cDrxxBOx++67Y/fdd0c0GgXnHK7rwjCM0J/X1fzknKOxsRHpdBrPPPMMbrvttpLtzZVmp512opNOOgmHH344fvCDHwDI9UFdXZ2/twetwmLMFQMFrFau62Lq1Km499578cILL/SePt51113p4Ycf7iSNOY5DruuGJt0REXme16XEyDnPs8IEpW/btumBBx6g/fffv0dJ3tdcc42vUchkMnna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HNTU1IAxts5g4PVBjBVxCCtHutmNja233pr22msv/+dUKhXaPR7BA3Q6nfbH6Jdffoldd90Vd999d8Xn6Ny5c9kWW2zBZs+eDWD99oZFixbh5z//OX784x+z+fPnh9oWznmecBgUTsLCdV1MmjSp5PvUlVdeyRYuXIjzzz8fI0aMYG+88UZp33upXEREyl9hCp0zZ06P2OS//vrrotseNM8F+1e4nti2HVpfSJct6bK1vggzbDabpYsuuqiq3+0Pf/hD+v7774lotdtnsQRjZoT5O2i+P/PMM0Ptk57qsjV//vy8vhHvoVgK4xTEz++++27VjsVbb701lLYH2yvmIVHuHQofc+F+svPOO5elP370ox/5+1VYcQhdpVAuR1s2lJ7osnXbbbflxWAFnxtWG4IB7k1NTfSzn/2sKt+jiHPojkvl7373O9piiy1K1o7XX389rx7BZANhxGiJ+VTN6+X64FtITjrpJAqal1zXhWmaoTwkmFYTAH7+85+HUm6pOeKII0BEvrRNq1LCAd03Owe1C0GNonA90XUdpcyQINm4EdY48a8Yt+Jfoa185JFHcMMNN1Rc07U23n//fXbppZcCyHenFHMySEdHR7fKFO2PRCK++buhocH//9/97ncbWt1eww477EDigjKR1jPYR8Ug0s6K96WqKpYvX45ddtmlasfiueeeyx577DEAQGtra96/gu5a14UWO5hmX1gTRKr8tra2sllJHMeBpmngnIeW1lnsdSKFsiR8fvaznwFYfcZIJpOhurQKF1mxj5x22mn497//XZVzdN9994VlWXkuleJCSMGTTz6J7bbbDjfddBP76quvStaOd999N+8cHaxDGNAq2XaHHXZApTPVhoE/Yg8++GAAqwe08MUrFsuyYBgGOOdQVRX33Xcf5s2bV5UDuZAPP/yQPffcc36+bcaYf4AJa7EGgB//+MehlSWRdIXYSIRwLBQP0WgUc+bMwS9+8YseMSfvv/9+9sc//hF1dXX+7yjgwiUErbB8a/v164dSp7Csdo466igA8NdwCviTF0skEkFrayvq6uqQzWbR0dGB0047LZSyS8mxxx7LFixYgMbGRrS2tqKxsRFAfjxSGLESRISGhgaMHz++6LIkvZMxY8aQuMdHEFaMQiqVgq7rvnuiYRi455578Mwzz1TtfvHZZ5+xa6+9FkDOxaytrc1X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"
      alt="eubiotics"
      style={{ height: h, width: "auto", maxHeight: "32px", objectFit: "contain" }}
    />
  );
}

// ─── SLIDER COMPONENT ─────────────────────────────────────────────────────────
function DosisSlider({ label, value, onChange }) {
  const opciones = [250, 300, 350];
  const pct = ((value - 250) / 100) * 100;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{label}</span>
        <span style={{ background: "#1B2B6B", color: "#fff", borderRadius: 6, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ position: "relative", height: 6, background: "#e0e0e0", borderRadius: 3 }}>
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: "100%", background: "#C5D92D", borderRadius: 3, transition: "width 0.2s" }} />
        <input type="range" min={250} max={350} step={50} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: "absolute", top: -6, left: 0, width: "100%", opacity: 0, cursor: "pointer", height: 18 }} />
        {opciones.map(op => (
          <div key={op} onClick={() => onChange(op)}
            style={{ position: "absolute", top: "50%", left: `${((op - 250) / 100) * 100}%`, transform: "translate(-50%, -50%)", width: 12, height: 12, borderRadius: "50%", background: value >= op ? "#C5D92D" : "#ccc", border: "2px solid #fff", cursor: "pointer", zIndex: 2 }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {opciones.map(op => <span key={op} style={{ fontSize: 10, color: "#aaa" }}>{op}</span>)}
      </div>
    </div>
  );
}

// ─── TARJETA RESULTADO ────────────────────────────────────────────────────────
function ResultCard({ label, subtag, costokgProd, costoAve, ahorro_ave, color, isBase }) {
  const isPositive = parseFloat(ahorro_ave) > 0;
  const tagBg = color === "green" ? "#e8f5e9" : color === "orange" ? "#fff3e0" : "#f5f5f5";
  const tagColor = color === "green" ? "#2e7d32" : color === "orange" ? "#e65100" : "#666";

  return (
    <div style={{ flex: 1, border: `2px solid ${color === "green" ? "#C5D92D" : color === "orange" ? "#FF9800" : "#e0e0e0"}`, borderRadius: 10, padding: "18px 20px", background: "#fff", minWidth: 140 }}>
      {subtag && (
        <div style={{ display: "inline-block", background: tagBg, color: tagColor, fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 8px", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{subtag}</div>
      )}
      {isBase && <div style={{ display: "inline-block", background: "#f0f0f0", color: "#999", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 8px", marginBottom: 8, textTransform: "uppercase" }}>REF.</div>}
      <div style={{ fontWeight: 700, fontSize: 14, color: "#1B2B6B", marginBottom: 4 }}>{label}</div>
      {!isBase && <div style={{ width: 24, height: 3, background: color === "green" ? "#C5D92D" : "#FF9800", borderRadius: 2, marginBottom: 12 }} />}
      {isBase && <div style={{ width: 24, height: 3, background: "#ddd", borderRadius: 2, marginBottom: 12 }} />}
      <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>$/kg producido</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1B2B6B", marginBottom: 8 }}>{fmt(costokgProd, 3)}</div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>$/ave</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#333" }}>{fmt(costoAve, 3)}</div>
      {!isBase && (
        <div style={{ marginTop: 12, padding: "6px 10px", background: isPositive ? "#f0fdf0" : "#fff3f3", borderRadius: 6 }}>
          <span style={{ fontSize: 11, color: isPositive ? "#2e7d32" : "#c0392b", fontWeight: 600 }}>
            {isPositive ? "▼ " : "▲ "} Ahorro vs base: {fmt(Math.abs(ahorro_ave), 3)} $/ave
          </span>
        </div>
      )}
    </div>
  );
}

// ─── SIMULADOR PRINCIPAL ──────────────────────────────────────────────────────
function Simulador({ user, onLogout }) {
  // Estado del formulario
  const [especie, setEspecie] = useState("pollo");
  const [mercado, setMercado] = useState("México");
  const [tieneCalentamiento, setTieneCalentamiento] = useState(false);
  const [fuenteGrasa, setFuenteGrasa] = useState("soya");
  const [grasa_pct, setGrasaPct] = useState(4.0);
  const [metodo, setMetodo] = useState("A");
  const [programa, setPrograma] = useState("lipotex");
  const [dosisInicio, setDosisInicio] = useState(350);
  const [dosisCrecimiento, setDosisCrecimiento] = useState(250);
  const [dosisFinalizacion, setDosisFinalizacion] = useState(250);
  const [dosisCompetidor, setDosisCompetidor] = useState(350);
  const [precioGrasa, setPrecioGrasa] = useState(30.00);
  const [precioLipotex, setPrecioLipotex] = useState(6.50);
  const [precioEME, setPrecioEME] = useState(8.00);
  const [precioEnergyPlus, setPrecioEnergyPlus] = useState(6.50);
  const [usaLipasa, setUsaLipasa] = useState(false);
  const [precioLipasa, setPrecioLipasa] = useState(12.00);
  const [totalAves, setTotalAves] = useState(100000);
  const [pesoVivo, setPesoVivo] = useState(2.5);
  const [fcr, setFcr] = useState(1.80);
  const [precioAlimento, setPrecioAlimento] = useState(7500);
  const [emRecuperadaEME, setEmRecuperadaEME] = useState(35);
  const [emRecuperadaEP, setEmRecuperadaEP] = useState(35);
  const [activeTab, setActiveTab] = useState("tabla");

  // Actualizar defaults cuando cambia especie
  useEffect(() => {
    const d = ESPECIES[especie];
    setPesoVivo(d.pesoDefault);
    setTotalAves(d.avesDefault);
    setFcr(d.fcrDefault);
  }, [especie]);

  // Actualizar precio grasa cuando cambia fuente
  useEffect(() => {
    setPrecioGrasa(FUENTES_GRASA[fuenteGrasa].precioDefault);
  }, [fuenteGrasa]);

  // Validaciones
  const especieData = ESPECIES[especie];
  const fuenteData = FUENTES_GRASA[fuenteGrasa];
  const sustratoOk = grasa_pct >= especieData.grasamMin;
  const puedeMetodoA = especieData.puedeRecuperarEM && sustratoOk;
  const fuenteDisponible = tieneCalentamiento || fuenteData.liquido;

  // Motor de cálculo
  const resultado = calcularEscenario({
    especie, fuenteGrasa, grasa_pct, programa, tieneCalentamiento,
    precioGrasa, precioLipotex, precioEnergyPlus, precioLipasa,
    totalAves, pesoVivo, fcr, precioAlimento, emRecuperadaEME, emRecuperadaEP,
    usaLipasa, dosisInicio, dosisCrecimiento, dosisFinalizacion,
  });

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1.5px solid #e0e0e0", borderRadius: 7, fontSize: 14, color: "#1B2B6B", fontWeight: 600, outline: "none", boxSizing: "border-box", background: "#fafafa" };
  const labelStyle = { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, display: "block", marginBottom: 5 };
  const sectionStyle = { background: "#fff", borderRadius: 10, padding: "24px 28px", marginBottom: 16, border: "1px solid #eee", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
  const sectionTitle = { fontSize: 15, fontWeight: 700, color: "#1B2B6B", marginBottom: 4 };
  const sectionSub = { fontSize: 11, color: "#aaa", marginBottom: 20 };

  const tablaData = [
    { label: "Base (sin emulsif.)", programa: "—", tratTon: "—", ahorroForm: "—", kgAlim: fmt(precioAlimento / 1000, 3), alimAve: fmt(parseFloat(resultado.costoBase_ave), 3), kgProd: fmt(parseFloat(resultado.costoBase_kgProd), 3), ahorroBase: "—", isRef: true },
    { label: "Lipotex Plus", programa: `${dosisInicio}/${dosisCrecimiento}/${dosisFinalizacion} g/t`, tratTon: fmt(resultado.costoLXporTon), ahorroForm: fmt(resultado.ahorroFormLX) + " $/ton", kgAlim: "—", alimAve: fmt(parseFloat(resultado.costoLX_ave), 3), kgProd: fmt(parseFloat(resultado.costoLX_kgProd), 3), ahorroBase: fmt(parseFloat(resultado.ahorroLX_ave), 3), color: "#C5D92D" },
    { label: "Energy Plus", programa: `${dosisCompetidor} g/t`, tratTon: fmt(resultado.costoEPporTon), ahorroForm: fmt(resultado.ahorroFormEP) + " $/ton", kgAlim: "—", alimAve: fmt(parseFloat(resultado.costoEP_ave), 3), kgProd: fmt(parseFloat(resultado.costoEP_kgProd), 3), ahorroBase: fmt(parseFloat(resultado.ahorroEP_ave), 3), color: "#FF9800" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fb", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* HEADER */}
      <div style={{ background: "#1B2B6B", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <EubioticsLogo size={22} />
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)" }} />
          <span style={{ color: "#fff", fontSize: 15, fontWeight: 600, letterSpacing: 0.2 }}>Simulador de Escenarios</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{user.name}</span>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}>Cerrar sesión</button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* ── ESPECIE Y MERCADO ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={sectionTitle}>Especie y mercado</div>
              <div style={sectionSub}>
                {especie === "pollo" ? `Pollo de Engorda MX 3,100–3,200 kcal/kg` : especie === "gallina" ? "Gallina de postura — mejorador de digestibilidad" : "Cerdo — mejorador de digestibilidad"}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#aaa" }}>
              <select value={mercado} onChange={e => setMercado(e.target.value)}
                style={{ border: "1px solid #e0e0e0", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#555", background: "#fafafa" }}>
                {MERCADOS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {/* Especie buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {Object.entries(ESPECIES).map(([k, v]) => (
              <button key={k} onClick={() => setEspecie(k)}
                style={{ flex: 1, padding: "10px", border: `2px solid ${especie === k ? "#1B2B6B" : "#e0e0e0"}`, borderRadius: 7, background: especie === k ? "#1B2B6B" : "#fff", color: especie === k ? "#fff" : "#555", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                {v.label}
              </button>
            ))}
          </div>
          {/* Capacidad planta */}
          <div style={{ marginBottom: 4 }}>
            <span style={labelStyle}>Capacidad de planta</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setTieneCalentamiento(false)}
                style={{ flex: 1, padding: "9px", border: `2px solid ${!tieneCalentamiento ? "#C5D92D" : "#e0e0e0"}`, borderRadius: 7, background: !tieneCalentamiento ? "#C5D92D" : "#fff", color: !tieneCalentamiento ? "#1B2B6B" : "#555", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Solo grasas líquidas
              </button>
              <button onClick={() => setTieneCalentamiento(true)}
                style={{ flex: 1, padding: "9px", border: `2px solid ${tieneCalentamiento ? "#C5D92D" : "#e0e0e0"}`, borderRadius: 7, background: tieneCalentamiento ? "#C5D92D" : "#fff", color: tieneCalentamiento ? "#1B2B6B" : "#555", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Tiene calentamiento
              </button>
            </div>
          </div>
          {!tieneCalentamiento && (
            <div style={{ marginTop: 12, background: "#e8f4f8", borderLeft: "3px solid #2196F3", borderRadius: "0 6px 6px 0", padding: "8px 14px", fontSize: 12, color: "#1565C0" }}>
              Sin calentamiento disponible: solo aceite de soya y acidulado. Aceite de palma y grasa amarilla requieren calentamiento.
            </div>
          )}
        </div>

        {/* ── FUENTE DE GRASA ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={sectionTitle}>Fuente de grasa</div>
            </div>
            <span style={{ fontSize: 11, color: "#aaa" }}>{FUENTES_GRASA[fuenteGrasa].label} {FUENTES_GRASA[fuenteGrasa].digestibilidad}% dig · {puedeMetodoA ? "Recuperar EM" : "Mejorar digestibilidad"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {Object.entries(FUENTES_GRASA).map(([k, v]) => {
              const disponible = tieneCalentamiento || v.liquido;
              return (
                <button key={k} onClick={() => disponible && setFuenteGrasa(k)}
                  style={{ flex: 1, padding: "10px", border: `2px solid ${fuenteGrasa === k ? "#1B2B6B" : "#e0e0e0"}`, borderRadius: 7, background: !disponible ? "#f5f5f5" : fuenteGrasa === k ? "#1B2B6B" : "#fff", color: !disponible ? "#bbb" : fuenteGrasa === k ? "#fff" : "#555", fontWeight: 600, fontSize: 12, cursor: disponible ? "pointer" : "not-allowed", opacity: disponible ? 1 : 0.6 }}>
                  {v.label.replace("Aceite de ", "").replace("Aceite ", "")}
                </button>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Precio grasa ($/kg MXN)</label>
              <input type="number" value={precioGrasa} onChange={e => setPrecioGrasa(parseFloat(e.target.value))} style={inputStyle} step="0.5" />
            </div>
            <div>
              <label style={labelStyle}>Inclusión mín. grasa (%)</label>
              <input type="number" value={grasa_pct} onChange={e => setGrasaPct(parseFloat(e.target.value))} style={inputStyle} step="0.5" min="0" max="15" />
            </div>
          </div>
          {/* Objetivo */}
          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>Objetivo del escenario</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => puedeMetodoA && setMetodo("A")}
                style={{ flex: 1, padding: "9px", border: `2px solid ${metodo === "A" && puedeMetodoA ? "#1B2B6B" : "#e0e0e0"}`, borderRadius: 7, background: metodo === "A" && puedeMetodoA ? "#1B2B6B" : "#fff", color: metodo === "A" && puedeMetodoA ? "#fff" : "#555", fontWeight: 600, fontSize: 12, cursor: puedeMetodoA ? "pointer" : "not-allowed", opacity: puedeMetodoA ? 1 : 0.5 }}>
                Recuperar EM (kcal)
              </button>
              <button onClick={() => setMetodo("B")}
                style={{ flex: 1, padding: "9px", border: `2px solid ${metodo === "B" || !puedeMetodoA ? "#1B2B6B" : "#e0e0e0"}`, borderRadius: 7, background: metodo === "B" || !puedeMetodoA ? "#1B2B6B" : "#fff", color: metodo === "B" || !puedeMetodoA ? "#fff" : "#555", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Mejora de digestibilidad
              </button>
            </div>
          </div>
          {!sustratoOk && (
            <div style={{ marginTop: 12, background: "#fff8e1", borderLeft: "3px solid #FFC107", borderRadius: "0 6px 6px 0", padding: "8px 14px", fontSize: 12, color: "#856404" }}>
              Sustrato de grasa insuficiente ({grasa_pct}% &lt; {especieData.grasamMin}% mínimo). Método A deshabilitado. Se aplica solo mejora de digestibilidad.
            </div>
          )}
          {puedeMetodoA && metodo === "A" && (
            <div style={{ marginTop: 12, background: "#e8f5e9", borderLeft: "3px solid #C5D92D", borderRadius: "0 6px 6px 0", padding: "8px 14px", fontSize: 12, color: "#1B5E20" }}>
              Modo EM: el emulsificante libera +kcal metabolizables → reduce costo de formulación. Requiere ≥{especieData.grasamMin}% grasa añadida.
            </div>
          )}
        </div>

        {/* ── PROGRAMA Y DOSIS POR FASE ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={sectionTitle}>Programa y dosis por fase</div>
            <span style={{ fontSize: 11, color: "#aaa" }}>Lipotex Plus {dosisInicio}/{dosisCrecimiento}/{dosisFinalizacion} g/ton</span>
          </div>
          <label style={labelStyle}>Programa Eubiotics</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <button onClick={() => { setPrograma("lipotex"); setUsaLipasa(false); }}
              style={{ flex: 1, padding: "9px", border: `2px solid ${programa === "lipotex" ? "#1B2B6B" : "#e0e0e0"}`, borderRadius: 7, background: programa === "lipotex" ? "#1B2B6B" : "#fff", color: programa === "lipotex" ? "#fff" : "#555", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              1. Lipotex Plus
            </button>
            <button onClick={() => { setPrograma("eme"); setUsaLipasa(true); }}
              style={{ flex: 1, padding: "9px", border: `2px solid ${programa === "eme" ? "#1B2B6B" : "#e0e0e0"}`, borderRadius: 7, background: programa === "eme" ? "#1B2B6B" : "#fff", color: programa === "eme" ? "#fff" : "#555", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              2. Programa EME (Lipotex + Lipasa)
            </button>
          </div>
          <label style={labelStyle}>Lipotex Plus (g/ton)</label>
          <DosisSlider label="Inicio (0–14d)" value={dosisInicio} onChange={setDosisInicio} />
          <DosisSlider label="Crecimiento (15–28d)" value={dosisCrecimiento} onChange={setDosisCrecimiento} />
          <DosisSlider label="Finalización (29–42d)" value={dosisFinalizacion} onChange={setDosisFinalizacion} />

          {/* Competidor */}
          <div style={{ marginTop: 8, padding: "16px", background: "#fff9f0", borderRadius: 8, border: "1px solid #ffe0b2" }}>
            <div style={{ fontSize: 11, color: "#e65100", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Energy Plus — Competidor (g/ton)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[["Inicio", dosisCompetidor], ["Crec.", dosisCompetidor], ["Final", dosisCompetidor]].map(([label, val], i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
                  <input type="number" value={dosisCompetidor} onChange={e => setDosisCompetidor(Number(e.target.value))}
                    style={{ ...inputStyle, textAlign: "center", fontSize: 16 }} step="50" min="100" max="500" />
                  <div style={{ fontSize: 10, color: "#bbb", marginTop: 3 }}>g/ton</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PRECIOS ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={sectionTitle}>Programa Eubiotics y precios ($/kg MXN)</div>
            <span style={{ fontSize: 11, color: "#aaa" }}>Lipotex Plus activo</span>
          </div>
          <label style={labelStyle}>Programa Eubiotics a cotizar</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button onClick={() => { setPrograma("lipotex"); setUsaLipasa(false); }}
              style={{ flex: 1, padding: "9px", border: `2px solid ${programa === "lipotex" ? "#1B2B6B" : "#e0e0e0"}`, borderRadius: 7, background: programa === "lipotex" ? "#1B2B6B" : "#fff", color: programa === "lipotex" ? "#fff" : "#555", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              1. Lipotex Plus
            </button>
            <button onClick={() => { setPrograma("eme"); setUsaLipasa(true); }}
              style={{ flex: 1, padding: "9px", border: `2px solid ${programa === "eme" ? "#1B2B6B" : "#e0e0e0"}`, borderRadius: 7, background: programa === "eme" ? "#1B2B6B" : "#fff", color: programa === "eme" ? "#fff" : "#555", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              2. Programa EME (Lipotex + Lipasa)
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>1. Lipotex Plus ($/kg)</label>
              <input type="number" value={precioLipotex} onChange={e => setPrecioLipotex(parseFloat(e.target.value))} style={inputStyle} step="0.5" />
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>MXN / kg</div>
            </div>
            <div>
              <label style={labelStyle}>2. Programa EME ($/kg)</label>
              <input type="number" value={precioEME} onChange={e => setPrecioEME(parseFloat(e.target.value))} style={inputStyle} step="0.5" />
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>MXN / kg · Lipotex + Lipase</div>
            </div>
            <div>
              <label style={{ ...labelStyle, color: "#e65100" }}>Energy Plus ($/kg)</label>
              <input type="number" value={precioEnergyPlus} onChange={e => setPrecioEnergyPlus(parseFloat(e.target.value))} style={{ ...inputStyle, borderColor: "#ffe0b2" }} step="0.5" />
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>MXN / kg · Competidor</div>
            </div>
          </div>
          <div style={{ background: "#e8f5e9", borderLeft: "3px solid #C5D92D", borderRadius: "0 6px 6px 0", padding: "8px 14px", fontSize: 12, color: "#1B5E20" }}>
            Lipotex Plus: emulsificante de alta eficiencia. El precio del Programa EME aplica cuando se cotiza Lipotex Plus + Lipase juntos como paquete.
          </div>
        </div>

        {/* ── PARÁMETROS PRODUCTIVOS ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={sectionTitle}>Parámetros productivos</div>
            <span style={{ fontSize: 11, color: "#aaa" }}>Aves, consumo, FCR, precio alimento</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Total aves</label>
              <input type="number" value={totalAves} onChange={e => setTotalAves(parseInt(e.target.value))} style={inputStyle} step="1000" />
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>aves</div>
            </div>
            <div>
              <label style={labelStyle}>Peso vivo (kg)</label>
              <input type="number" value={pesoVivo} onChange={e => setPesoVivo(parseFloat(e.target.value))} style={inputStyle} step="0.1" />
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>kg / ave</div>
            </div>
            <div>
              <label style={labelStyle}>FCR</label>
              <input type="number" value={fcr} onChange={e => setFcr(parseFloat(e.target.value))} style={inputStyle} step="0.01" />
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>kg alim/kg producido</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Precio alimento ($/ton)</label>
              <input type="number" value={precioAlimento} onChange={e => setPrecioAlimento(parseFloat(e.target.value))} style={inputStyle} step="100" />
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>MXN / tonelada</div>
            </div>
            <div>
              <label style={labelStyle}>EM recuperada EME</label>
              <input type="number" value={emRecuperadaEME} onChange={e => setEmRecuperadaEME(parseFloat(e.target.value))} style={{ ...inputStyle, opacity: puedeMetodoA ? 1 : 0.5 }} step="5" disabled={!puedeMetodoA} />
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>kcal/kg alimento</div>
            </div>
            <div>
              <label style={labelStyle}>EM recuperada EP</label>
              <input type="number" value={emRecuperadaEP} onChange={e => setEmRecuperadaEP(parseFloat(e.target.value))} style={{ ...inputStyle, opacity: puedeMetodoA ? 1 : 0.5 }} step="5" disabled={!puedeMetodoA} />
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>kcal/kg alimento</div>
            </div>
          </div>
        </div>

        {/* ── RESULTADOS EN TIEMPO REAL ── */}
        <div style={{ background: "#1B2B6B", borderRadius: 10, padding: "22px 28px", marginBottom: 16, boxShadow: "0 4px 16px rgba(27,43,107,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Resultados en tiempo real</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Actualizado automáticamente</div>
          </div>
          <div style={{ color: "#C5D92D", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Costo por kg de {especieData.label} Producido</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
            {especie === "pollo" ? "Pollo de Engorda MX" : especieData.label} · {FUENTES_GRASA[fuenteGrasa].label} · {puedeMetodoA ? `Modo EM ${emRecuperadaEME} kcal/kg` : "Mejora digestibilidad"}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <ResultCard label="Base (sin emulsif.)" isBase costokgProd={resultado.costoBase_kgProd} costoAve={resultado.costoBase_ave} color="gray" />
            <ResultCard label="Lipotex Plus" subtag="+ EME" color="green" costokgProd={resultado.costoLX_kgProd} costoAve={resultado.costoLX_ave} ahorro_ave={resultado.ahorroLX_ave} />
            <ResultCard label="Energy Plus" subtag="Competidor" color="orange" costokgProd={resultado.costoEP_kgProd} costoAve={resultado.costoEP_ave} ahorro_ave={resultado.ahorroEP_ave} />
          </div>

          {/* Ahorro total */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Ahorro vs Base (total para todas las aves)</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
                <span>Base (sin emulsificante)</span><span style={{ color: "rgba(255,255,255,0.4)" }}>$0</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2 }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#C5D92D", fontWeight: 600 }}>Lipotex Plus</span>
                <span style={{ color: "#C5D92D", fontWeight: 700 }}>
                  {parseFloat(resultado.ahorroLX_total) >= 0 ? "+" : ""}${fmt(resultado.ahorroLX_total, 0)} MXN ({fmt(totalAves, 0)} aves)
                </span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
                <div style={{ width: `${Math.min(100, Math.abs(parseFloat(resultado.ahorroLX_total)) / (Math.abs(parseFloat(resultado.ahorroLX_total)) + 1000) * 100)}%`, height: "100%", background: "#C5D92D", borderRadius: 2 }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#FF9800", fontWeight: 600 }}>Energy Plus</span>
                <span style={{ color: "#FF9800", fontWeight: 700 }}>
                  {parseFloat(resultado.ahorroEP_total) >= 0 ? "+" : ""}${fmt(resultado.ahorroEP_total, 0)} MXN
                </span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
                <div style={{ width: `${Math.min(100, Math.abs(parseFloat(resultado.ahorroEP_total)) / (Math.abs(parseFloat(resultado.ahorroLX_total)) + 1000) * 100)}%`, height: "100%", background: "#FF9800", borderRadius: 2 }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── TABLA INFERIOR ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #eee", marginBottom: 20 }}>
            {["tabla", "por_fase", "decision"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: "10px 20px", border: "none", background: "none", fontWeight: activeTab === tab ? 700 : 400, color: activeTab === tab ? "#1B2B6B" : "#888", fontSize: 13, cursor: "pointer", borderBottom: activeTab === tab ? "2px solid #1B2B6B" : "2px solid transparent", marginBottom: -2 }}>
                {tab === "tabla" ? "Tabla" : tab === "por_fase" ? "Por Fase" : "Decisión"}
              </button>
            ))}
          </div>

          {activeTab === "tabla" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f4f6fb" }}>
                    {["Programa", "$/Trat/T", "Ahorro Fórmula ($/ton)", "$/kg Alim.", "$/Alim/Ave", "$/kg Prod.", "Ahorro vs Base"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap", borderBottom: "1px solid #eee" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tablaData.map((row, i) => (
                    <tr key={i} style={{ background: row.isRef ? "#fafafa" : "#fff", borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#1B2B6B", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {row.color && <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color }} />}
                          {row.label}
                        </div>
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{row.programa}</div>
                      </td>
                      <td style={{ padding: "12px 14px", color: "#333" }}>{row.tratTon}</td>
                      <td style={{ padding: "12px 14px", color: "#333" }}>{row.ahorroForm}</td>
                      <td style={{ padding: "12px 14px", color: "#333" }}>{row.kgAlim}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "#1B2B6B" }}>{row.alimAve}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#1B2B6B", fontSize: 14 }}>{row.kgProd}</td>
                      <td style={{ padding: "12px 14px" }}>
                        {row.ahorroBase !== "—" ? (
                          <span style={{ color: parseFloat(row.ahorroBase) >= 0 ? "#2e7d32" : "#c0392b", fontWeight: 700 }}>
                            {parseFloat(row.ahorroBase) >= 0 ? "▼ " : "▲ "}{fmt(Math.abs(parseFloat(row.ahorroBase)), 3)}
                          </span>
                        ) : <span style={{ color: "#bbb" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#f8f9ff", borderRadius: 7, fontSize: 11, color: "#888" }}>
                Resultados orientativos — validar con nutricionista. Consumo total por ave: {fmt(resultado.consumoTotalAve, 3)} kg · Total aves: {fmt(totalAves, 0)}
              </div>
            </div>
          )}

          {activeTab === "por_fase" && (
            <div style={{ fontSize: 13, color: "#666" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f4f6fb" }}>
                    {["Fase", "Días", "Dosis Lipotex (g/t)", "Consumo est. (kg/ave)", "Costo Lipotex ($/ave)"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, textAlign: "left", borderBottom: "1px solid #eee" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { fase: "Iniciación", dias: "0–14", dosis: dosisInicio, fraccion: 0.15 },
                    { fase: "Crecimiento", dias: "15–28", dosis: dosisCrecimiento, fraccion: 0.35 },
                    { fase: "Finalización", dias: "29–42", dosis: dosisFinalizacion, fraccion: 0.50 },
                  ].map((f, i) => {
                    const consumoFase = pesoVivo * fcr * f.fraccion;
                    const costoFase = (f.dosis / 1000000) * precioLipotex * consumoFase * 1000;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 600, color: "#1B2B6B" }}>{f.fase}</td>
                        <td style={{ padding: "12px 14px" }}>{f.dias}d</td>
                        <td style={{ padding: "12px 14px", fontWeight: 700 }}>{f.dosis} g/t</td>
                        <td style={{ padding: "12px 14px" }}>{fmt(consumoFase, 3)} kg</td>
                        <td style={{ padding: "12px 14px", fontWeight: 600, color: "#2e7d32" }}>${fmt(costoFase, 4)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "decision" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ padding: 16, background: "#f0fdf0", borderRadius: 8, border: "1px solid #c8e6c9" }}>
                  <div style={{ fontWeight: 700, color: "#1B5E20", marginBottom: 8 }}>Recomendación Lipotex Plus</div>
                  <div style={{ fontSize: 13, color: "#2e7d32", lineHeight: 1.6 }}>
                    {puedeMetodoA
                      ? `Con ${dosisFinalizacion} g/ton recupera ${emRecuperadaEME} kcal/kg → ahorro de $${fmt(resultado.ahorroLX_ave, 3)}/ave vs base.`
                      : `Como mejorador de digestibilidad (${FUENTES_GRASA[fuenteGrasa].digestibilidad}%) para ${especieData.label}.`}
                    <br />Ahorro total (${fmt(totalAves, 0)} aves): <strong>${fmt(resultado.ahorroLX_total, 0)} MXN</strong>
                  </div>
                </div>
                <div style={{ padding: 16, background: "#fff8f0", borderRadius: 8, border: "1px solid #ffe0b2" }}>
                  <div style={{ fontWeight: 700, color: "#bf360c", marginBottom: 8 }}>Comparativo vs Energy Plus</div>
                  <div style={{ fontSize: 13, color: "#e65100", lineHeight: 1.6 }}>
                    Energy Plus @ {dosisCompetidor} g/ton → ${fmt(resultado.costoEP_kgProd, 3)}/kg prod.<br />
                    Lipotex Plus → ${fmt(resultado.costoLX_kgProd, 3)}/kg prod.<br />
                    Diferencia: <strong>${fmt(Math.abs(parseFloat(resultado.costoEP_kgProd) - parseFloat(resultado.costoLX_kgProd)), 4)}/kg</strong> a favor de {parseFloat(resultado.costoLX_kgProd) < parseFloat(resultado.costoEP_kgProd) ? "Lipotex Plus" : "Energy Plus"}
                  </div>
                </div>
              </div>
              {!sustratoOk && (
                <div style={{ marginTop: 16, padding: "12px 16px", background: "#fff8e1", border: "1px solid #FFC107", borderRadius: 8, fontSize: 13, color: "#856404" }}>
                  Nota técnica: Con {grasa_pct}% de grasa ({especie}), el emulsificante actúa como mejorador de digestibilidad, no como recuperador de EM. Incrementar inclusión de grasa a ≥{especieData.grasamMin}% para activar el Método A.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#bbb", marginTop: 8 }}>
          Eubiotics Latinoamericana · Simulador de Escenarios · Resultados orientativos — validar con nutricionista
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  return user ? <Simulador user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />;
}
