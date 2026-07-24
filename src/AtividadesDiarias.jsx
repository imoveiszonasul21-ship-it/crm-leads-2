import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { supabase } from "./supabaseClient";
import { selectStyle, inputStyle, overlayStyle, modalStyle, Field } from "./shared";

const METRICAS = [
  { key: "visitas", label: "Visitas" },
  { key: "apartamentos_conhecidos", label: "Apês conhecidos" },
  { key: "propostas", label: "Propostas" },
  { key: "placas", label: "Placas colocadas" },
  { key: "ligacoes_clientes", label: "Ligações p/ clientes" },
  { key: "ligacoes_proprietarios", label: "Ligações p/ proprietários" },
  { key: "exclusividades", label: "Exclusividades" },
  { key: "chaves", label: "Chaves" },
  { key: "apartamentos_captados", label: "Apês captados" },
  { key: "vendas", label: "Vendas" },
];

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const emptyDia = () => {
  const obj = {};
  METRICAS.forEach((m) => (obj[m.key] = 0));
  obj.outro_nome = "";
  obj.outro_valor = 0;
  obj.observacoes = "";
  return obj;
};

export default function AtividadesDiarias({ session, isAdmin }) {
  const [registros, setRegistros] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refDate, setRefDate] = useState(new Date());
  const [visao, setVisao] = useState(isAdmin ? "resumo" : "propria"); // 'resumo' | e-mail do corretor
  const [modalDate, setModalDate] = useState(null);
  const [form, setForm] = useState(null);

  async function fetchRegistros() {
    const { data } = await supabase.from("atividades_diarias").select("*").order("data", { ascending: true });
    setRegistros(data || []);
    setLoaded(true);
  }

  useEffect(() => {
    fetchRegistros();
    const channel = supabase
      .channel("atividades-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "atividades_diarias" }, fetchRegistros)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const inicioMes = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const fimMes = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);

  const registrosDoMes = useMemo(() => {
    return registros.filter((r) => r.data >= toISODate(inicioMes) && r.data <= toISODate(fimMes));
  }, [registros, refDate]);

  const corretoresDisponiveis = useMemo(() => {
    const s = new Set(registros.map((r) => r.corretor_email).filter(Boolean));
    return Array.from(s).sort();
  }, [registros]);

  const resumoPorCorretor = useMemo(() => {
    const map = {};
    registrosDoMes.forEach((r) => {
      if (!map[r.corretor_email]) {
        map[r.corretor_email] = {};
        METRICAS.forEach((m) => (map[r.corretor_email][m.key] = 0));
      }
      METRICAS.forEach((m) => (map[r.corretor_email][m.key] += r[m.key] || 0));
    });
    return map;
  }, [registrosDoMes]);

  const corretorAtivo = isAdmin ? (visao !== "resumo" ? visao : null) : session.user.email;

  const diasDoMes = useMemo(() => {
    const dias = [];
    for (let d = 1; d <= fimMes.getDate(); d++) dias.push(new Date(refDate.getFullYear(), refDate.getMonth(), d));
    return dias;
  }, [refDate]);

  const registroPorDia = useMemo(() => {
    const map = {};
    registrosDoMes.filter((r) => r.corretor_email === corretorAtivo).forEach((r) => (map[r.data] = r));
    return map;
  }, [registrosDoMes, corretorAtivo]);

  function abrirDia(date) {
    const iso = toISODate(date);
    const existente = registroPorDia[iso];
    setForm(existente || { ...emptyDia(), corretor_email: corretorAtivo, data: iso });
    setModalDate(iso);
  }

  async function salvar() {
    const { id, created_at, ...rest } = form;
    METRICAS.forEach((m) => (rest[m.key] = Number(rest[m.key]) || 0));
    rest.outro_valor = Number(rest.outro_valor) || 0;
    if (form.id) {
      await supabase.from("atividades_diarias").update(rest).eq("id", form.id);
    } else {
      await supabase.from("atividades_diarias").upsert(rest, { onConflict: "corretor_email,data" });
    }
    setModalDate(null);
    fetchRegistros();
  }

  if (!loaded) return <div style={{ padding: 40, color: "#6B7280" }}>Carregando atividades…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <Activity size={18} color="#2F7A5C" />
        {isAdmin && (
          <select value={visao} onChange={(e) => setVisao(e.target.value)} style={selectStyle}>
            <option value="resumo">Resumo do time</option>
            {corretoresDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}><ChevronLeft size={16} /></button>
          <div style={{ fontWeight: 700, fontSize: 14, minWidth: 130, textAlign: "center" }}>{meses[refDate.getMonth()]} {refDate.getFullYear()}</div>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {isAdmin && visao === "resumo" ? (
        Object.keys(resumoPorCorretor).length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", background: "#fff", borderRadius: 12, border: "1px dashed #D1D5DB" }}>
            Nenhuma atividade registrada nesse mês ainda.
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F5F6F8" }}>
                  <th style={thStyle}>Corretor</th>
                  {METRICAS.map((m) => <th key={m.key} style={thStyle}>{m.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(resumoPorCorretor).map(([email, vals]) => (
                  <tr key={email} style={{ borderTop: "1px solid #E5E7EB", cursor: "pointer" }} onClick={() => setVisao(email)}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{email}</td>
                    {METRICAS.map((m) => <td key={m.key} style={tdStyle}>{vals[m.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {diasDoMes.map((date) => {
            const iso = toISODate(date);
            const r = registroPorDia[iso];
            const total = r ? METRICAS.reduce((acc, m) => acc + (r[m.key] || 0), 0) : 0;
            return (
              <div key={iso} onClick={() => abrirDia(date)} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
                <div style={{ minWidth: 46, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{diasSemana[date.getDay()]}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{date.getDate()}</div>
                </div>
                {r ? (
                  <div style={{ flex: 1, fontSize: 13, color: "#374151" }}>
                    {total} atividades registradas — {r.visitas} visitas, {r.propostas} propostas, {r.vendas} vendas
                  </div>
                ) : (
                  <div style={{ flex: 1, fontSize: 13, color: "#C4C9D0" }}>+ registrar atividades do dia</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalDate && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>
                Atividades — {new Date(modalDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </div>
              <button onClick={() => setModalDate(null)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {METRICAS.map((m) => (
                <Field key={m.key} label={m.label}>
                  <input type="number" min="0" style={inputStyle} value={form[m.key]} onChange={(e) => setForm({ ...form, [m.key]: e.target.value })} />
                </Field>
              ))}
              <Field label="Outro (nome)"><input style={inputStyle} value={form.outro_nome || ""} onChange={(e) => setForm({ ...form, outro_nome: e.target.value })} placeholder="Ex: Indicações recebidas" /></Field>
              <Field label="Outro (valor)"><input type="number" min="0" style={inputStyle} value={form.outro_valor} onChange={(e) => setForm({ ...form, outro_valor: e.target.value })} /></Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Observações"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={() => setModalDate(null)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0F2438", color: "#fff", fontWeight: 600 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#0F2438", whiteSpace: "nowrap" };
const tdStyle = { padding: "10px 12px", whiteSpace: "nowrap" };
