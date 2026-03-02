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
  const h = size * 1.2;
  const w = size * 4.5;
  return (
    <img
      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAc4AAABvCAYAAABl0SBPAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAf+ElEQVR4nO3d938VVf4/8NeZcu/NTW9A6L2IgCArJSAgggVF176r64quq/4R33/jo64KrsIuWAFFhARICIFEeighlFCTmIQkhJRbZ97fHxCWknJn7syducn7+XjMD0rmnPfcKe+ZM2fOEUQExhhjjMVGcjoAxhhjLJlw4mSMMcYM4MTJGGOMGcCJkzHGGDOAEydjjDFmACdOxhhjzABOnIwxxpgBnDgZY4wxAzhxMsYYYwZw4mSMMcYM4MTJGGOMGcCJkzHGGDOAEydjjDFmACdOxhhjzABOnIwxxpgBnDgZY4wxAzhxMsYYYwZw4mSMMcYM4MTJGGOMGcCJkzHGGDOAEydjjDFmACdOxhhjzABOnIwxxpgBnDgZY4wxAzhxMsYYYwYoTgfAGOtbM5VQINSGiN4JXWjQKYRINIBoOAgRisJDGchMnYrh2SuF07EyNhhw4mTMhZpQRAGtGS03LiEQuY5AqBXBaAdIC0LTQwiHQ9DDEXjCEtKkkdDzdQzPXul02IwNCpw4GXOZ2uhXVFt3EHUtJ6ChBSQ6QKIbhDAE6RDQoQgFqiwjI3cIUvRUpKQGENEPkCot4KdOxmzGiZMxFzl98wu62FSBhvbj6AxdAnnaIKtRSDIgdEDSAEUCJNWPFFlGTq6AEozA541A5R4LjCUEJ07GXOJS12a6UHcE11qOI+prQFqehpAehZAAEIAoIMgLRcqAT8lBqtcDQSEQdUHXIiAA/LjJmP04cTLmAs3hUmrurEG3fhURTzMiaEUk3A0hA0IDZA1QSMAn+ZHpy0JO6hBk+xUokd8hJBUeORUC3EzLWCJw4mTMBaLSDdS1HkW7VoOItxGSD9B0QJEkSBEdchRIV/zI96cj25cKnxyCEuxGiqQgEFAglDSnN4GxQYMTJ2Mu0B1uRFf4GjS5BSQC0EiAdAFdE1BJRZrqQbbHj0zVCz80eLUQhK5DVgAZXqjC7/QmMDZocOJkzAU6wo3oCjUBaQHIAKJRggIP5AiQqnqQ409BjicV6bIHPpIgaQQQQBqgKB7IMrfSMpYonDgZc4EwOhHSuqEKgqwDFJHgU3xIUVRk+7zI8fqQ6VHhI0AO6xAaAAhEdQFZ8UJS+VRmLFH4bGPMBTQQAEDSZMhRAVlLRZqShbzUNGSoEjIVHT7SIUeikDRA1j2AUBHWBby+TMiKz+EtYGzw4MTJmAuQrkGGBEkDPFDgU9KRqaYhLyUTPhGBD51QtAiEpkHSFAidQJIKgVR4PPlQ1HSnN4GxQYMTJ2MO+x0VFA1HIBEgawSf6kOWPx2ZaipSBaAgAkkLQFAIQlIgFAFoQFRXIMlD4POMhKI+zS85GUsQTpyMOUyPBCFFI1B1ggcS0lQfclLSkKqkQNGCkLQoSGiAkCAkFYQU6OSHpqVDkQqgKiOc3gTGBhVOnIw5jMKd0AJdSFd98HvCKMjNg1/2IdLVDR1RSALwqKkQQiAclBEOeaGq2fCnT8CwIQsBvMxPm4wlECdOxpwWJXgoBZm+IUjxpUHV/BBaKjxIhVch6JEguruDIF2BrmVAyFlISR2N9Iyp4KTJWOJx4mTMYXLEC59UgJRMgs8fhSwBcjQFqkeBV5agy1EIIUOS0yEoF5KSB69/KFLVFZw0GXOAICKnY2Bs0Ktr/pYU3014vBpI1yFrPqiyChmABAmqJw2QsgAs5mTJmMM4cTIWh1OX/x91hGvRHYhClz1QfGmQPCkgWYaQPPCnpCPVl4ts7ygMA/d8ZWwg4KZaxuIg+9sR1a6gPXID3YEoKCSDVBnCI0FSPBBdHihIR4oYhhzfYRqSOh0TM1/kBJrEdp9poO5ACPl5OUCwC/MmFfD+HGQ4cTIWhxRfPlL1oeiIAKHgDXRqN9AVaoceDUL2Eog0IOoBwmmo1wuQ75uO9twaGj/0EWSrT/EFN8lsPV5Hq2fd/flPBraUHqEXlszhfTmIcOJkttteeYoarrcipAGqokCSZQghQ5aAYDAIv98P0gWi4SDystLw/MKHk+YiJOsSfIoHOWk+yF4FIkzQgiEEEYEuARECVH8ISkoIoe4u/N59A1Fqgqy0IJoboHyVnz6TBAHAvUnzlheWzLn977wvBwlOnMxWvxy/Rs/Om+50GLbxewidXa3waM0YmhaBNwwITUZbSEIoJOBJEQhGoojIgOQLAnI92iIBnG1qh0Yy8gtedHoTWP9i7QhC5RdbUTguhxPoACc5HQAb2J6dNdLwOrvOXk+aHmsiDPhIgl+S4IdAjurFkNQs5HjyoGppQMgPaAKSBEACNFlHUGrBzUg9WgKX0Y7ypNnWQcrQ/ikcl2NXHMxFOHEyW32195zhdXRdtyESeyiUCQ/lQopkQA6nIUVkIzelAHn+YchS8+CJ+KFG0yFFPRA6ICQBHR50RcJo7WxFa0eD05vAerHjxBVTNzXf7zvJN0MDHDfVMluFw2HD66iqakMk9vAqqejUfEBEAQmCIhFSFIEcXwqEpAI3dUiRKEKRMKIAoApIqgJNI4SoCzc6GwCe2MSV2traTa338qKHLY6EuQ0/cTJbSZLxQyyZvi1WFA8EERANQ6EIZL0TUqgNPnQgP5UwLN2DHL8Ev9BAEUBoOmSFILwaNDmArlA9blBF8mzwINJ244bTITCX4idOZiszSTCZmmoFZAghIEkSVEUCQIhGQ1BIgkf2IN/nhwQdEjREIi2IRAFIUeikQ5e7ENRbIES305vBevDR6sVOh8Bcip84ma2EMN7B0Mw6ThEeBYovBaonBRAeSLoKFT54NC9EUIZfT0OuOgQF/hHI8+TDDx+EThBaGETdiOo3oSPg9GYkrbW7TxBudeAhAPTp5hJ+eme24ydOZqtkSoKmSDmQPUNBwRaEIkEoQoGq6AAE9HAIQpeQ6vVC9aQhEM6A1h1Bp9YNTdegAND1MAjG3wMPZgcu36DW1lY0tXXi3Sdm3vNvH7y41Jmg2KDCT5yMxWW5SEmbAa9/CkgMRZi8CEY1hPUOyHIH/N5uUKQJFGzBsAw/RuXmIVNNh4980AMaouEwNESc3ghX21fbRgCw8UgdAaAFY7KwavZ4rLkvaVrt65IjptbbfOiyxZEwt+EnTsbi5FVXC4+3g8J6FyLhLuikQZI7IEsaND0IryxBkmVEBJCqpiA3FYDmQWeHjKgAiE/DXm07eolWzR4LAPTGnAdH7bHTpAljTa334twxA7yZhfETJ2MWyMl4U6SmTYXqG4eoyEdIy0Ag4kEgqEHTBaABFAa88CAvPQ/5GXlI9WRBD3hAYY/T4btWW3fQsbrnj8oRlU0hQ+us31NlUzTMTfhWlzGL5KauEYqikCJnIxKsB/QbgByERDooqoOiEcjkheL3IislBMpQ0BnJA/RUp0N3L9XraPXzhnjF+vKT9FZh/99m/nTkIt5aNpOfNgcBTpzMVgO+c9B9Mr1/E5leIBgqIT3aCYQ7oOtBRLUu+PUuhOVu6BQClCA8WSlIl4ZhqG/Z4PqRDAhGnO849VbhrUkHdp5tpJWThz7w71sP1WD13Cni+TnjEh4bcwYnTuY6AyHZ+rxLBbwA7n6Y1CpJQye6ozcRlYIQsh/RtCyHIkwOkiI7HcIdKycPFQfO1RMkBd2BMFpbmvHqktli9dwpTofGEowTJ2OJIs8TMoD0u3OB36lgkoPkspm6FkwafldAxicwYAMDdw5iNjM+CpCg5Bk5iNlL16NOh8DYAzhxMlvJJsZxkcj591rMHYTEN1HMfQZ1U+13+y9QKBxEfl4WVj48wl1tQgOEMJE4ZZN7oqjqEgUjYXhTfFj50GjenzHafT1CN1paoSoK8nNyMT/bPe2jYXLPO85kUXyyloLBMFRVxVOzJrhmX/al6OAVutHZjZT0LDw3d5j7YyaiAb38XNVE8fh0+1FKdMz7z3f0WGfZtQDtPd9oSzz7LzTbUu7Xu04b/9FjK9uQb/adoqIjF2zZxp6WikvXiYhw4Gpbj3XubWij0oamhMVDRPihvsvoz3aPsgjZEm9Fc/sD5e5rJfrxcthUnFtO93z+DLRl44Fzpn4fIqL/Hn7wN0/E8v3eU6bi3VByivad/d2RmHtaHA/AjmXL0cbY90iM/m9bFZVf6CKrY9157ILhWH6qrLY0jg17jhiqf2v5yZjrX7+72vD2lVf3nMS/KzthuKyefPXrYao4e6PHOqxYPv5ul9GQbDsXKrrCtPbMVaPx9OmnZqJ97dbE/cUhUzdWVoolzpht3Xck1jJNLUWnrb22rdtbS+WXu22NeV9tfDds91u/+xTtOFpva8z9LY5VbNfy7aEWY3vBoJILEbIy3k+2HzQbipW/m231m0mcRScffBJbd+vJ31I/nO+g/S36A3XFs+w+etlwHLvO1VkaAxFhZ1cHfVZv/Q1kD5w49qzU9/Xk1k2ipWWaXb4oPmYmlpgVnbtpeez7GuyL99dTzrUsDKTOQQSAXnk0x9ZKloxXAIC+++26JdMXSb4MK4oZUJTUe34TAkDvPP2I5fX8eUIaFuSI23VYghTjI91E5RSrqseBoEafXKyjFf40/KNgiGXl9oFKmroH7FRentQsR+s/cPbynSnT3l0+y9a6npyYjh+PN1myL/edayEAVDjMitJ69tRDadhe1eLIsTdQEmfCf7xXHsvDhsr4d1p0wOwC62gpt5LPusorCduvn+6psqYuVTW8iuSzJnFuudJOC3wyPhyX2MHQlw7x419VVwdk8nTy/Py+4gQtmDwmoXX+edYQAKDbM9KYtWhSrjUB9eOZmbkAQHtqbiT0+BsIV23HTtg35+Vi67H4njwldVB3bO5RexDYdDFCa+aNTlidHyybia/Kz8V9LGm68SJIxN9z9NdrGr0wOjPucsz658xRgIPnol10cqaD5xe7j9LL82c4UjcALBqfje8PXTK8Pw9cDd5+Qk6oZVOyUFGfuHqTNnFW1rY7soPut/qRPMQTB0U164JxITPD5700Bnh9nPEnt3i9XTgJH+88EtcxZWZ7Kc6L86Y6oqdHuuazDSo+3+H4eWkVYeZ7qvjRe0/MdqLee7w8dyxg8Nq2YJTPllhiMX944upK2sQ5b7xzd9e9MHWGCRMj6zD7fLRyDtbtPZ00F/51TaDXXfYJ8pMT050OwTKJPj8/21PtumPv84rLMcX06e4aN8SekBiSNXG6YQc94Ms9xpv6JHLlpgxqax5/CP8pP2vyRihx+/ObFp3WJKT/jykD4sCWErgZX+yqoveXTUtYfbH6x/wx2Hkl0u8P8cET7hjsfscJazo49SUZE6drT8h3lk3Ct5XGOknwE6c7/bVwMvacM9PhwMz+NH4a/nitk17Ldffp+3H5edeeq27zZdEhem/5TKfD6NXK0X2/Ovmy3Pj7ULs8NcP+u0l3n3kPcs3O6c2r80Y5HQKzyLJJWYbXEZSYU+rPI9MSUk88PiqciJ9qrPlsa6B7Z8Vcp0Po16ZDF3vdl+8Ujk1gJH3bX91gex1Jkzi3/mb9pwn/3lONTZVX8M2hBvy38ppl5X687ShfLAaITcdie78TF4Odg/ZH3H8DedvzU/KcDsH1tlQnx83F63Ptm6h7bekFfHvwCrYeuYZv9p83VcaXRWcAQCycVmD7S/+kSZyrH4v/04Sy2hAAiNvL35dNE6/PGy1em1sg/jJvpLj7374svWS6no9WzUbx8WsxnQwDawyKxNl89Cpw1/66f9lWdQWfFB2Nu57XHxmD4tOxN7+b6yBrbKWFFnY4/rE1gN1tnagI3QqkLAhsqg9aV8Etvf5+n+8/bXVdSWVbTSO9MM2am4t/lVSj+Fwbik/XAX+cB2U1Dfh8x0FLyreJACDeXTJBvPqn0WL1nJHitYUT7z6XYy7nnRVTE9dLzqkhi4wsv8Q5UPs3R8wNJbWjut10nV/vrompzn/tOWu2Cit/Y9vq37DH2rFIt1QZH55ufeV5K6qOqa7i6uuGC95RZ2jYv7h92abTTo1of5D6rbeciD6pC8RdZ0WbsaENK64T/XwtYqquzSevG6qrr+X7Y9fMhBBT2QfOXTFT9gN+qY593NadlzpM1fFVae8TJJgdP7fid4o17l4VnQnGWoalS1I87jwzI9/0uuWXQ3h1drqpO5GVUzOM3vXc8dayySiuvtnvk0qi3oklu/+UnQAAsXrGcMP7483HJojiM/XWB9Uj4xMvxzrn5K8N/fds7E9FUwf+niXECgligbf/Y3shID4Y7hO7bsY3R+q1DmOdpublQqwaoYiPD9cZruuF6bmWPXnoNraKX2rsjGv9j38oAQDxzNTYmyZXjEkzfE3bfaoOf3t8fK/rXLzaYqS4O+YNjTkOse6XM/f8j43lt1qcnpzideRbrAF91d57pgWFYyz5YU2V8eS0/seh5cTZv7KLLfjr4hlx7ccnpw4Xe843mV5/S52dH/XHllSaAhHTNXxypRkAxPwh5m4il2d4RHmn+R7gL48yN0CDSgO31/kbhXF9eiI+emlpPOeE2PTbuX7/BoB4YnrfHwoX5Jt7sCmuCcR8Tq15dqr4bGMR1v+0HwDEG4WjHP142fVX7coW07d84vGp1t15VtYN7BF+3Orn6iYsHmfNflw2cYhYV36m/z/swQsj7PuoP9b3om+P95uu48PR+XH/hoVpktjSan79n6sHzohCTtp6/Kol5bz+2KQej4niS92AgYeF52bnmXuwmJKCA5eDMR8T77+xQrz1/EJXjPbh+sRZddJ4U40d5o2QxQ/HzTVJ9G3g3lFb4blpQyw9UdYUThVrK8312itv7LLlwh9L4qy8ab7NcEuX2TUf9EIOxNpr5m4in5s2cEYUilfR6QZT+3PDkStYPcu6p61tNW33/HdFQwhPjvUnLDktGHNriL6SmrakuqlyfeJ8f4nxmR7Wll62IRIgEjb+nue7Qwn4nGGA+m9Fv01Jprw7b6KpC8PNYHzv+XqjxRDNyUvmP5d6IdXcq4bevDtSdsVdfzJraTf3fvPNOaMt/e1XTckW5bdeYQgAYn6BI+8MaemUbGzY555BFPrj6sRZciK2Tzru9+6SMbbs/Nf/ZPz7oFfmJnZaoIFifUUt/jK/56YkK+ypvWF4ndab8XXm6I0ew1a+N3OkqbK32fQteOlNe8odLN5YMMnpEO4onGhtq45Zby4aC/wx9+hXu0/QDxWnXJtIXZ04AyHT7xXJxsWw/VcSO1fcQDB2xFBby182Pst479wZ9owKFUviNGtVgbVPm7ctyYDY1GS8B/Gvp1sH/blQfu53U79ByeXBc7fy9hMz8NL86QBAX+w8TzurWqn8rHuac12dOG+0dzgdgjWUxE+Rlez0ULfTIfSo9Lz1M87blThL7GlZviPUbryXcnPbDesDSTKS7DG13tIxGa54MuyFbbG9t3IiVs7MQeHkbBSd7nRF8nR14oyamBTYjbQ++v+Ymb8xmRCZ24eRgP2Jc/2eY4bXIdH3KSNJxk8pu+ZK9pr/eiUmY0YYH0xbMzi/pa4723nOjvOzqcV41+Qvio9ZHofVNlX9bnsdKx5KA/5o/ftk2wnaVWWuk1W8XJ04/7bCuRnQrSTLvX/D5uod4KDlM+x5T303xUQfF92OPWbTt7wLLO4UdD+vajzudxZOsCGS5BKJGm/iHjMigbM0m/T6zGHi20MXElbfh6tmYPnMAuypTnwTLl+3E0ByZhb5pPXxzmMJqWegP+3bbb4q2f4Dmm2xcDNNM953w8xNnhNenTtB/PxbdULrXDYtGyW1sX8PagVOnAnQ3tr795/8FeeDPKovMRUJc6PZWI1HjxpczNwMNDWZH/Uq0Z57bJrYUpbY5Ll0vA/bT/c/xKlV+IxNgHR/itMhJBUtQYe/1s/7yp5ISXSrU2nnQKvMPBOJMxAI2BCIfV5YPE2UnopjmCkTnnkoA8VnE9N5yNWJc22xueHR3GbhWOuG/hsM/vnE1ITUE4ja3O00RpJdvYNsPrtL26KGL1Kf2TSoRXIxcfOVhK0SS6bnCACi/KLl09T16snJiZng3dV7Y6C8g6o4X+faO/99p5tcGdvuM/a/8H9vySy7q4iJXUf59bC9P2Fzg/HmQ4Kx93sD8R1nisdreJ2/r5xjQySJUTjOd89cuf8pr7G1vk9+OWL7QePqxKmFQ06HYIn5E/ueXcBJjTfd+a3s79ftGBfYCsnTVNvcae/588pDxnt6/nO+sdaEgdivzucd3N91/7VwiqisbcfG/VdsKf/DZ+dg80F7h+9T7Cw8XsMLzI0es/a3NohAAAqFIUWjkEDweBToehRRRKBLUWhaBEJRITQFAiogdEggCBAk0gGhg4jgVRVENB3hcBg6JCgeL3Rdh6brkD0eCJ0QDochyxI8qgxZAkLdASAaQW5WBp6eP63PpGmmh52Vwt5Um2swd2/210UTLY7jXp/uOkgfLP+T4fWWTui72d3Ma0WiKOw4Fd/J8WFfN2iR3/qH2u+uddErI40fOz+fbcNzk7Nj/nuv0/cpNnxL/tTsCQImRiHbWtVMq2fGP8uNG8wbnynmjc+8899bj9TT6jnWfXLz4p/GWlZWT1ydOJ99ZKipAywvVcHqx4xPeOwEQc4mzvagzV/Jx9GoceBaNy0Yac9MDWaS5jdn2/Ha5Mz+/9AGPzVfx/P5eYbXO11/HYsmGl+vP2aSJgA8Nznb0P6UHJ6PU7LpuWXj3uN443FjrwpWzzQ372UyWD3nf9frz3Ycp/efcsdrlN64uqkWAP5zoN7wOqunJ8/0RQX5uY7W/+ECe8ZftcKCkebnn+zL9yfqTV0OR+bbkzRjySTP55ub8/CfNiTN7Z2J663r+guUSSOGmWtN21B+1vLf/pOdJ+6MxV1W6/ycqe8/NUsAEPtMTl+XCK4/Lv1ecw/FP1Ulx2DSWRnmPlX55reLVmyf7b9RvJ079tY0Whrjd4cu08szzDUJLcy2px+PbP9DlWW/YXE76BmTHRc3HTE+3V9KivHzo/J3m3tFWWDx5GGmjqU3Cyfjv3utmzXks4pG+nDl/0ZoWzw+HV8duEyV9dYNKPDx90X0+dYSw+UtujV9nVi339yczJUXu207DlyfOF+cY27Km+dn5qDkfLvrTyA9aK5zzmuPjbM4End6fMpQlNVYMx5l0elGMjvN26bK2hj/0ngWjLU5cOOJq4bLvu2zk/H3Uv6lKUBPxvHQPSLHePNudmaG4XWu1dk/ZqqT/vL4dPxQVhv3/txYVkvvz3/wyfftBWMwb7gPX5aejKuODYcbCAB99PIK/GP1Unxvcm7iNQvNda6MROx7DeX6xAkAX++9aGq9pRMz8esp6z4F2VB07J4pxtYWn4677MUPGZ/j8y6m69+cRBNsL55SgL1nzDWv3ra9qo5WPGR+qrLX54237Z15rInzjRmjTMfw/sPZAEBFTeaexjbUNtKzQ8wP5LG56jwWjTXe3Oz3GZ9J5OVHRxtexwk/HjT/WcZLi8djY6n5nqP/LqqiNxaP7/Nv3lnyML47auz6uf9y953r45uPFtzzby8nfG5iG5tyiChZFtOKzt2keOrefynQZ/klp1vjKn97VUM8m2e47rWlF+KtL+Y6v951xoq6iIjo2/3VMdd79/Ljodq46v30199irndXjfF9WVQfirn8HWc649oWIqJNLUEq1fSY6/zX0Ytx1xlrXfcvB670fe715vvDV0zXeffyw5GrZqpPyHXtti1VdTHVuf18G319uM5UHVuP91/Hxn1nYy3O0D7YUFptKubysy2G64p1saVQO5aPd5wy9eP1wFC96/dfibng/bXdhssnIlScux7/VsVQz+YTbVbUE3N9RIR/F5s76Pvy6a+HaffZtj5j2Hepi3bXdlhS357qq33Wdfdid+L8Y7HM9isdPda961I3ff7bZUvq+HzvwR7rMLCYtvHAOdpxsoHKL96gfedaqOR0M5VWX6e9Z1qo/ExDv3HZnTjXlx6PZ/N6tPls050YNp9toh8utFlZ/APbsLHM1M2x7fv/j+tqPMddr4sgSo4Wu7ILnbR4gnXDKf33twuQoiGEA93Iz8nF07PHid01rfTElJy4yi09140lk0x9QmHZjvi88hJ8ioyuri588Lhtw9fFtI1f766hvz0xxa4Y7vh0RxU+eGqm5eV+c6QWr82JvZl2V00DLZ9S0P8f3r1OfRjLh3tirmPbqeu0arr1vWVtFG8zt50XqT5j++HIVXppjuGe50a3Nzkuwrfc2bafyqro+cXxnXObDregu70FsgSMKBiK5VMyxbbjjbRqlvnXKnex75NEuzKyHcuWo41mbz4S6vOfDxEl8K7aITFt11cWNtU6oaS2kcjAfiw+U2+4juI6w0+cSXO8rD94lijO8/7/tlfYGWKfdf/R5Gtpmfcvv1aei28LEuTboz2eC25mWy5Kis5Bt61+xFwP20R7b9Wj2HnYcK+3pNi2wWRt+UksGWf0mDPTIcH4OqX1bSbqSazPK8/jzbmT4j6uH5memEH/nfLUYxPFxr0nnA6jX68kyfUXAEqqG20tP6kS5x+SYuetfNS+XpjJhCiZWqH+57PyE3i38GHX7sMlw7PF3qZup8Po0z/mTbTk91swKtO1+8Eqbzw+Q3xVVuV0GGa4ct9QxN4ZWZIxceLAhS6nQ+jT9sPmBi/edszch77MWp/uOYT3C2ck7IJgdlaxx4f4RVFj4qZsMmLveXvv+BMlkTd+by+eKdaVHU1YfQb1dZS6LnkumznG1piSMnEumJB6e4oa1/npeDOeeXS0qdhWPTJCrCu7YHVIjtJduZf69sGyuaajNjObRzy/0YqhPlHWeNN8AfYQj08caume35cETdNWWLN4tli/77jTYdwv2c5i2+NNysR5F1ft0F9qAnh+VnyzF6xZPMFV2zSYfLH/DODAMRXvM83ioRniwOVWS2KJV/mlZlvKXTQ8W2yutadst3lr0Szx793HnA4DW47UArGfD+LbA6646U/I+fv/AYm3k8ZS0BKJAAAAAElFTkSuQmCC"
      alt="eubiotics"
      style={{ height: h, width: 'auto', filter: 'brightness(0) invert(1)' }}
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
