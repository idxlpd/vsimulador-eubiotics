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
      src="data:image/png;base64,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dClw1FFH0cCBA7Hbbrth5513xvbbb4/q6mq4rpuljKwFMk0Tzc3N+P777zFnzhx89NFHWLx48abdzkcddRTdf//9tGjRokBvis2Fc062bZNlWfTqq6/SmWeeKW+OlZQE/jFayje1n3feeTR58uRAyrcupkyZQueff76cn5s4/fv3p7PPPptef/11am1tJSIiy7LyHl/pdNr73v+8xsZGmj17Nl177bW07777bjLj75BDDsm7TXNpaWnx9nPTNIlI3tTeFRkzZgz985//pO+++44sy+qU+XnbbbfRXnvttcmNpxEjRtDtt99OS5YsoXg87rWLbduByQ1ERK2trfTSSy/RSSed1CltXHTt54wzzqDDDjsMo0aNQrdu3QAAtm2DMQZNK5wDh3MOzjkSiQRqa2sBAJ988gkeeeQRPPXUU0Vvl41hxIgRdPDBByMUCsE0TaiqCtu283qmrutwXRfhcBiWZWHatGl47733SrZ9RowYQYceeigikQgMw4Bpmnk9LxwOI5VKIRqNwjAMMMbw1ltvYdasWQVpA6LMZr36n454ADvyzKxnjRgxYqNCpU488UQ655xzcNhhhwEA4vF4lsWrEJimiXA4DACYOnUqHnvsMfznP/8p2fG3PoIen7Zto6KiAolEArqug4jw9ddf4/nnny/bNvJz7bXX0v7774+hQ4eiuroaRATLsqDrepb3Iwgcx4GiKN5zW1paUFNTAwD4+uuvMWnSJDzzzDP4/PPPS7Ztb7rpJgqHw3Bd1wtPWxdizOi6jlQqha222grjxo1DKpWCoiiIRCKBlk94rW6//XZomoZUKpXX88S6HIvFsGDBAvzrX//Ku2/Gjx9PqqqisrISTU1NeT1LWKZd14WqqlBVFalUCrfffnvJjqENYfz48XTAAQfggAMOQCQSAeccjuMgFAoF/q725ifnHN26dUMymcQrr7yCBx54oGB7c7HZe++96YwzzsDxxx+PrbbaCkCmDaqrq7293e8VFmMuH8jntXIcB5MnT8bjjz+O119/veu08X777UfPPPNMG23Mtm1yHCcw7Y6IyHXddjVGznmWF8avfVuWRU899RQdfvjhZaV533LLLZ5FIZVKZVkXNpZ0Ok2pVMr7/pZbbinpNrnqqqs8i0FjY2Pe9Sdqa4m98cYbC9YG4h2l5CG59tpracWKFd7fBz1H14fjOGQYhvdz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BcUwDBARtt12Wzz33HPYe++919m+eSkkH330EQ0fPhyNjY1wHMcTaFpbWwFgk9CwNU3zvnddF8899xzOPPNMuelISgLGGOLxOHr16gUgY7E499xzscUWWyCdTqOqqsrzhnDO4TgOVFWFoihltSG1p5QAQI8ePbwQtTPPPBNPP/20nJudwD777EP//e9/0a1bN+i6Dtd1oWkaevTo4Vn+ysULly+apsFxHMTjcTz77LP4wx/+IMegpKj079+fXnjhBWy33Xaorq5GOp0GkNkfXNf19oGuTm1tLYBMaHNlZSXOPPNMTJgwoaDzc+LEiSS8w7FYLOv/OOeIRqNQVRWO4xSyGJ2CGE9EhC233BKvv/46dt1117W270bvCIsXL6Z9993Xc/MpioLW1lZEo1FUV1cjHo9v7KPLClVVYZomDMPwJvATTzyBU089VW46kqLjOA6qqqq8xU2EVALwFA7DMJBOp+G6LhhjnnBfDufAGGPrdG0TEbp3745vv/0WAHD66aejXC5RLFf69+9P7733HjbbbDOkUimoqpol3LiuC9u2s4w5XZVkMgkgM+8457AsC08++SQKmRhDIlkXAwYMoBkzZqB3795oamqCoiiIRqMwTROu6yIcDkPTtLIySOWLpmlIp9OIxWL4/e9/j0Jl4LrgggvotNNOQygU8o41NDU1efuvn1AoVIgidDqu63p169OnD1588cW1fnajFJIlS5ZQnz59wBhDVVWVt9BWVVUByGh5XaUxO4KiKN4BpHg8jkQigfvvvx+DBw+Wm46kqIiFVtM07xBxLBbzQriAjBUjGo1C13WEQiFPQSkH/ApJe14SzjmSySR22GEHr07nnHOOVEoKyEcffYSKigrYto1oNOr1Tzqd9s4ndYX46I5QUVGBZDIJ27ZRU1ODUCiEpqYm3HzzzZ0asy6RCGbMmIHa2lovVAgALMtCOByGqqqwLGuTOUMijMm6rgNYs4dcc801uPzyywOfn3/6058AZIyA4XAYQMZLI7wiqqqCc46WlpagX10UOOeed1zUqX///njhhRfabdsNVkjmz59P2267Laqrq2GaJmzb9gRy27azzpBsCqTTaW8wt7a2IhaLobKyEhUVFZg8eXKRSyfZ1HEcB9FoFJZloUePHgAym0+vXr3gOE5WHL84/B6NRhGNRotS3o1lbUqJ67qoqKiAYRiIRqNe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4yOtPktFRFAUBT179sTVV19Nd9xxxwbVb/z48VnpPtdngRXWc+Fp2n333XHcccdBUZRAkr6I9KYipSiQOSR86623IplMZp1J3RhEDH1rayuam5vzLm9X4PLLLwcQnAXeNE3PkyHGRDKZRDQahWmaXti73yO6cOFCvPPOO7j44ovznp8vv/wye/nllwEAY8eOpauuugq77LILXNf1+l94QkX4l6Io7Z6dycUfdiz2FZGZqrKy0pNX3377bdx1111emFNHEW0j9i9gzRGFoDxURIR58+bhzDPPDHRvvvrqq9nChQvpH//4h1d2IvKimkR4WK9evQCsWZsbGxtx//33Y/z48cGUp76+3tNygsCyrCwLpF+7ElrVZZddVlTL+3nnneeVJwjLkL9uRJm2NAzDs3w7jhN4faWHRHpI8q2nZVlZ1q9Vq1bRmWee2al9fvzxx9OcOXM8S5KYL/71KAjviMBvqRLrU6H6uNw9JI899pj3vqCs3KLN/d6CXOuhqN/7779PBx98cMHH45AhQ+iFF14g0zRJRAs0NTW1afcg8I9l/xj/4YcfOn2tPfroo72ohqD2f8Mw2niCOrteG0I5e0h++9vfEhFlebvzLbvfgynwy0j+erW0tNDtt99e8P79wx/+QN999x0RZfYogZijG+K9NQyDWltb291T5s6dS8ccc8xG1+eRRx4hovb3mKBwXZd+//vfF6zNb7rpJu9d7fW7PwrqpptuCrYc11xzDREFt+GIZ1iW5XW467re4P7+++9pzJgxJbFADRw40CunCOXKF/8k9m9o8XicHnrooUDrLRUSqZBsDKlUynuXWMgNw6Dnn3++qH390EMPUSKR8BY+v8s+aKOB67reJs45p2+//VYqJO2QTCa9dwURsuV/huM4bcahv37XXXddp4/Hk08+mRobG73yNDY2euUNYn66rpslCOWGotx2222dWucDDjggqz+CqJ//OaJunVmnDaWcFZIPP/yQiIILB/LPz3g8nhW+JRAC6bvvvtvp/XrjjTd65XAcJ6u8HZFfc5UD8Tfz58+nq6++Ou/6vPrqq23eY1kW2bYd2PpBVPj59MILLxAR0S+//NLm3fF4nB599FHq379/8OX46aefvA06SEQnEBGtWLGCiDKC0AEHHFByi5MocxCxwn7Fzr/xtLS0kGEYUiEJGKmQbDi5872pqalk+vm4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e+21V1mUX3DFFVd0ennvuecedsQRR2Sluxdh0CKUK4iwaLHGRCIRbLHFFmv+4/LLL/e0FcMwAtN8/FYG13WJc04HHnhgWQ2IcuGkk04iooy11K/RBoFlWd64aGlpKbn+82vzopxBWNCJuraHRFi6yyl0y98nQSG8IsI6KsbQ0qVLA22XcvSQnHDCCVkeEdu2szxI+ZJOp7OeN2fOnJIfi7fddhvZtu3tablwzgNbf2zbpv/973+d0ia77LILEWXGU9Drp5/OqMvGUm4eEgBYtWpV1jv9Ht988M9L/3godW/D9OnT29TF7zF67LHHSrr8AHDiiSfSokWLiIjojjvuKEp5jz32WFqxYkVWOwYdhSKed8MNN2TX0f+SIDccEfol/v3oo49KfjCUI3vssQf5+zCovmtvYS6lCX3vvfdmlS1IhZqoaysk/rDMcrAc/fTTT9Tc3JzVH/mQK1CK74UAft99923yCgkA1NXVkeM4gSv7/nL7x+I//vGPkh2L11xzDRGtW+hzXTewNiIiOvLIIzutPUR/BIHrupROp7PaorW1tWT7FihPheSFF14gouAUkbXVIZVKEeecWlpayH/DdikxYcIEIsoYUYVhQBgPRF0SiQStWrWK/vSnP5VcHUaPHk3z5s3Lav/FixcXrZx333131jgI2tgt5sXNN9+cXcfPPvus3UEYxAsdx6FkMklEGYHx1ltvLbmBsC7OPPNM+tvf/lbyZfZ3cBBngIjaKqeGYdCKFStKoi323ntvbxEWFpCghfmurJCId4mNplD1CoIPPvjAK7NpmoEZTfwLbK5lO2glrVwVkgcffJCI1gg8QSn9juN465RYt8RZlVIyeghEJMG64vPFGApq/+xsj1EhvI9ijglPe2cqWBtKOSokhx9+ODmO463jue/Lh9z9VTx38eLFJaeU3HXXXVkGK//ankgkPBlUYFkWffnll3TooYcWvR6DBw+myZMne2UzDIOampoomUxSKpWiSy65pChlHDJkCKXT6TZnR4Ja31KpFDmOQzfddFN2/S655JJ2B2C++BckokxFUqkUXXzxxUUfBB3hpJNO8sq/atUqOuuss0q23K2trW3CToLoP3E4USx2LS0tJWHF/PDDD71ytra2ZpVbhmx1DLHBuK5Lra2ttPfeexe9X3P55JNPiCizeIl+CErh9q9N/lCVr776KvB2KFeFBFgzNoMO2XJd11urxL9i73n00UdLZizecMMN1Nzc7G3Ma7MUirkb1Pzt7HDKIAXy3Lkl1pq77767ZPo1l3JUSABg/vz5RBTcuugvc64nWbxj2bJldPjhh5dEXz788MOeDLAu2SeVSrVRTIiIinm++b777mvj3codf998803Rysc599o0yAgcokxfua7bNmQLyIREiIYJ0jUjGtcfj5ZKpUpS+PGz++67E1FGAPcP4nnz5nVK1pMNZebMmZ6wEGTIQG5WHaHVFjMrjsgq5q+vv85BCU1dWSERY7qlpcUTAn/44YeSOec1aNAgmjVrVlZfBJ3hyW8w8bd5ISxS5ayQvPrqq0QUrMAjyr1q1SqvD/yWWNd1aeLEiUUfi1dccYVXrnXVP+h529jYSLvsskun1l/s/0Gsn2sTDD///POi9+naKFeF5KKLLiKiYMPtRf+JMe8/qymEf845XXvttUXtz3/84x/kP0eTq3DYtt0m/NxxHEqn020+25nrzZ133klLly713p1OpymRSGR5FP1ZH59//vmitHPumAgyLF7U7brrrmtbt7feeivrQ/kiGla40YjWDBZhaStVj8NBBx1E6XSa6urqsurjX1geeOABGjx4cMmU/9lnn82K9c4X8Rz/RPb35bJly2j//ffv9PrfeOONRLRGeBGbaCqVale4zIeurJAQZXuWRLhMIpEougdz7733puXLl2eV1Z+aPAjBWKxzuc8qVOKGclZIDjnkkKzNMSiDld/jIJ4p9ggxB2bMmEF77rlnUcbjxx9/TETZRpn21tdCzNmXXnqp0+vs3++CwHGcLOuvWG+KFYKyPspVIQEAsX4HORb9kTJi3Iu54L8WoBjZt4YOHUrffPONVw7Lsqi+vt4rt3+euq6blYa6vT4S/PTTTzR+/PiC1efcc8+lr776yitze16HXAOrYRhkmiaNGzeuU9t56NCh3rkbQVBeEv9+0q5CAmSEIqFt+jvUMIysw0FBkEgkyLbtkjufcckll3RoQruuS83NzXTLLbeURPnPOeecNqFLhWb58uU0ZMiQTqv/vffeW5Ac62ujqysk6+L111+nffbZp9PH9h133BHoOrMucvuXc04PPvigVEjaYcmSJUSULaT4N6e1hUNsLP6MgfF4nG6//fZOG4vnnnuuJywUci7m3tMhhD3XdYuypwijZNCHV9vjjDPOKIl90085KyR///vf2yjz7X0fpBfFfz/RDz/8QBdddFHB+3TPPfekRx99NLA6rI2lS5fSscceG1h9RowYQe+9994GlcE/bjjntGrVqrbnLQrIiy++6MnpfoJaH4SOceONN7Zfp7/+9a9ElNl0LMsi0zTbCIDiAFVQBUokEvR///d/Rfc2DBgwgF577bUNKr9QAL7//nv67W9/W3SrsmjTzkAM0kWLFtFRRx1V8Lq/88473ruLJbBuSgoJUSZspLPSDp566qn03XffEVHn9K9Y18R8EQtvoUJJy10hOfPMM7MEdNM012p1DDK0zv/8xsbGgiZFOfPMM+nbb78lIgrcANeR+glLZLEO9f/vf//rtHpzzttm1yky5ayQAEAymaSmpiYiWpP8o726BKlw2radJSPOmjWrIGefBg0aRM8991xBLmZdFx999FHeCU5EJjTXdbOUuPXRXiTAokWLOiVMbsSIEfTll1967xXnTAvBNddcs/b6EGUfMMy9sdu27UAGtP9MiZi4//rXv4qyQP3tb3/zwrMsy+qQFcGfOUx8/84779CgQYOKtsgmEglqaGjIu286gvCkiQXinXfeKZggl06nvVhQItqgSZ0Pm7pCkkgkyHEcWr58+dqtGHly7rnneoqIaZq0atWqTqm/WMP8B24LGXpQ7goJALz77rtZ7/S3pV+IDcKtnyuoNzY2ej83NTXR448/TsOGDQukvn//+989QW5th3kFQd4z0l59f/zxR+rfv39R9pB77rmn09ZWQV1dHT3zzDMlcUC63BWSW265hYjaCrIiBXNuufLBH76dG3oUj8fJNE36v//7P/rDH/6w0XXu168fXXjhhfTOO+9keV+DPMu2NkQ4Keec6uvrN0o2veeee9oYvog61v653iy/zL1q1SoaP348DRgwoGDj6Z133mmzzos+DtLonUwm6eijj157Pf7+97+3KYBt2wVZqJqamrzJLzYcwzDoscceoz322KPgC9Tf/vY3WrlyJfkzCRB1fMD7J6VfoXniiSeKsrg+++yznW5BEJnTRBs8+OCDgWyoV155JX3zzTdElK2AFCrfents6gpJe/Ng/vz5dP755+fVDmeeeSa9//77WRaXeDzu1TvIsIJ1Ydu2t8ZZllXQOdsVFJKjjjoqa6MWiIslg7aut7a2tjvf/eOjpaWFpk+fTtddd12HUpEee+yxdP75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ob6+HgA8Jbqr47ouLMuCbduoqqoCEXlni4kI4XAYzz//vPf5Dp9oGjduHJs9ezaANVbWXOs1kK2UbCoCz7oQA5tzDl3X4TgOfv/733fKu9944w02Y8YMT5sVyhGwfu9CubAuK0mpHQgvFrZtQ9f1rA1IJBro6qiqCtu2EYvFwBjzPEaWZcF1Xdx888349NNPu35DFJihQ4d61jMp6KyhqqoKra2tnse8paUFvXr1ApCZl5xz3HPPPXj++edLbgz+61//8gwawLottJLSZocddmBCARYCojQaZMa0SJwhEg8IA25zczMA4OKLL8acOXM2aH4+8sgjWR4RQc+ePVFfXw9FUWDbdiB1KGU4520O8wu9wTAM/Pzzz7jmmmu8tt2gFAuDBw9mn376KUKhUBvvSC5SIckgwrSEe/niiy/G9OnTO23zufPOOwFkNkKhqQPwslhJuj6hUAiapkFRFE8g3xQWQ8GqVaugaRrq6+u9TTgUCuHpp5/GHXfcUXKCYDny8ccfs9/85jdZIbJBhoaWM8Irl0gkUFNTA0VRYBgGKisrMXHiRFx22WUlOQYffvhhBmTWityMV8LCKSkfjjnmmKwMopuChb4j2LYNVVXR2NiISCSCiooKrFy5ErW1tXjyySezwhc7yqxZs9i9994LICN7RaNRbz3s0aMHTNPsUMhWuSPC9HRd92RQAF621Icffjjr8xsskV5wwQVobGxEZWWlp0HmsilYXjuKWLQ1TcMDDzywUYM7H95++232+OOPo6qqyhsEIoygqwmlUglui18BBdYoyCLtdVcnHo9jiy22QDwe9842cc7xwQcf4KyzzpILVYC8+OKL7LTTTvMMHXIurmkDkQbZMAzYto1IJILnn3++5MfgxIkTEQqFPK9XMpn01g3pCSsv3n//fXbWWWd58pkMu8sQDofhui66d+/uGdp79OiB5557DuPGjdvo+XnttdeyN954AzU1NWhubvYMESKMq6vJX2tDyCA1NTUAMtc1hMNh1NfX4/bbb89q3w1WSD755BPWo0cPFo/HUVtb690ZkYtUSjJEIhG4rotHH30UF110UVEa5eyzz2Y//PCD53IX/dWVBAahjEilJBvR52KhFaEjInywqyMU8aqqKkSjUXDO8dVXX+Gggw6SC1QBeOaZZ9j555/foTskNgUYY1l3jEQiEei6jg8//BBjxowp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"
      alt="eubiotics"
      style={{ height: h, width: "auto", maxHeight: "58px" }}
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
      <div style={{ background: "#1B2B6B", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
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
