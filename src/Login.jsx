import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro("E-mail ou senha incorretos.");
    setCarregando(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F6F8", fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={entrar} style={{ background: "#fff", padding: 32, borderRadius: 14, width: "100%", maxWidth: 360, border: "1px solid #E5E7EB" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, color: "#0F2438", marginBottom: 6 }}>
          Painel de Leads
        </div>
        <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Entre com seu e-mail e senha</div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Senha</label>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, marginTop: 4 }}
          />
        </div>

        {erro && <div style={{ color: "#C1443C", fontSize: 13, marginBottom: 12 }}>{erro}</div>}

        <button
          type="submit"
          disabled={carregando}
          style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "#0F2438", color: "#fff", fontWeight: 600, fontSize: 14 }}
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
