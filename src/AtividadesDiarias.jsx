import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Activity, Plus, Trash2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { selectStyle, inputStyle, overlayStyle, modalStyle, Field } from "./shared";

// Contadores diários (cada um é um número)
const METRICAS = [
  { key: "visitas", label: "Visitas realizadas" },
  { key: "placas", label: "Placas colocadas" },
  { key: "exclusividades", label: "Exclusividades" },
  { key: "chaves", label: "Chaves" },
  { key: "apartamentos_captados", label: "Captações realizadas" },
  { key: "contatos_clientes_novos", label: "Contatos com clientes novos" },
  { key: "contatos_followup", label: "Contatos com follow-up" },
  { key: "ligacoes_proprietarios", label: "Contatos com proprietários" },
];

function toISODate(d) {
  return d.toLocaleDateString("en-CA");
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const emptyImovel = () => ({ endereco: "", valor_venda: "", valor_fechamento: "", documentacao: "", prazo_entrega: "" });

const emptyDia = () => {
  const obj = {};
  METRICAS.forEach((m) => (obj[m.key] = 0));
  obj.ruas_pente_fino = "";
  obj.imoveis_atualizados = [];
  obj.observacoes = "";
  return obj;
};

function imoveisDe(r) {
  return Array.isArray(r?.imoveis_atualizados) ? r.imoveis_atualizados : [];
}

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
        map[r.corretor_email] = { imoveis: 0 };
        METRICAS.forEach((m) => (map[r.corretor_email][m.key] = 0));
      }
      METRICAS.forEach((m) => (map[r.corretor_email][m.key] += r[m.key] || 0));
      map[r.corretor_email].imoveis += imoveisDe(r).length;
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
    if (existente) {
      setForm({ ...emptyDia(), ...existente, imoveis_atualizados: imoveisDe(existente).map((i) => ({ ...i })) });
    } else {
      setForm({ ...emptyDia(), corretor_email: corretorAtivo, data: iso });
    }
    setModalDate(iso);
  }

  function setImovel(i, campo, valor) {
    const lista = form.imoveis_atualizados.map((x, j) => (j === i ? { ...x, [campo]: valor } : x));
    setForm({ ...form, imoveis_atualizados: lista });
  }

  async function salvar() {
    const { id, created_at, ...rest } = form;
    METRICAS.forEach((m) => (rest[m.key] = Number(rest[m.key]) || 0));
    // guarda só os imóveis que tiveram algum campo preenchido
    rest.imoveis_atualizados = (form.imoveis_atualizados || []).filter((im) =>
      Object.values(im).some((v) => String(v || "").trim())
    );
    const { error } = form.id
      ? await supabase.from("atividades_diarias").update(rest).eq("id", form.id)
      : await supabase.from("atividades_diarias").upsert(rest, { onConflict: "corretor_email,data" });
    if (error) {
      alert("Não foi possível salvar: " + error.message);
      return;
    }
    setModalDate(null);
    fetchRegistros();
  }

  if (!loaded) return <div style={{ padding: 40, color: "#6B7280" }}>Carregando atividades…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <Activity size={18} color="#2F7A5C" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F2438" }}>Minhas atividades diárias</span>
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
                  <th style={thStyle}>Imóveis atualizados</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(resumoPorCorretor).map(([email, vals]) => (
                  <tr key={email} style={{ borderTop: "1px solid #E5E7EB", cursor: "pointer" }} onClick={() => setVisao(email)}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{email}</td>
                    {METRICAS.map((m) => <td key={m.key} style={tdStyle}>{vals[m.key]}</td>)}
                    <td style={tdStyle}>{vals.imoveis}</td>
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
            const nImoveis = r ? imoveisDe(r).length : 0;
            const temAlgo = r && (total > 0 || nImoveis > 0 || (r.ruas_pente_fino || "").trim());
            return (
              <div key={iso} onClick={() => abrirDia(date)} style={{ background: "#fff", borderRadius: 10, border: toISODate(new Date()) === iso ? "2px solid #0F2438" : "1px solid #E5E7EB", padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
                <div style={{ minWidth: 46, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{diasSemana[date.getDay()]}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{date.getDate()}</div>
                </div>
                {temAlgo ? (
                  <div style={{ flex: 1, fontSize: 13, color: "#374151" }}>
                    {r.visitas || 0} visitas · {r.apartamentos_captados || 0} captações · {(r.contatos_clientes_novos || 0) + (r.contatos_followup || 0) + (r.ligacoes_proprietarios || 0)} contatos
                    {nImoveis > 0 ? ` · ${nImoveis} imóvel(is) atualizado(s)` : ""}
                    {(r.ruas_pente_fino || "").trim() ? ` · Pente fino: ${r.ruas_pente_fino}` : ""}
                  </div>
                ) : (
                  <div style={{ flex: 1, fontSize: 13, color: "#C4C9D0" }}>+ registrar atividades do dia</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalDate && form && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>
                Atividades — {new Date(modalDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </div>
              <button onClick={() => setModalDate(null)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Ruas de pente fino (quais ruas você percorreu hoje)">
                  <input style={inputStyle} value={form.ruas_pente_fino || ""} onChange={(e) => setForm({ ...form, ruas_pente_fino: e.target.value })} placeholder="Ex: Rua Visconde de Pirajá, Rua Barão da Torre" />
                </Field>
              </div>

              {METRICAS.map((m) => (
                <Field key={m.key} label={m.label}>
                  <input type="number" min="0" style={inputStyle} value={form[m.key]} onChange={(e) => setForm({ ...form, [m.key]: e.target.value })} />
                </Field>
              ))}

              <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F2438", marginBottom: 6 }}>Imóveis atualizados</div>
                {form.imoveis_atualizados.map((im, i) => (
                  <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 10, marginBottom: 8, background: "#FAFAFB" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <Field label="Endereço do imóvel"><input style={inputStyle} value={im.endereco} onChange={(e) => setImovel(i, "endereco", e.target.value)} /></Field>
                      </div>
                      <Field label="Valor de venda (R$)"><input style={inputStyle} value={im.valor_venda} onChange={(e) => setImovel(i, "valor_venda", e.target.value)} placeholder="Ex: 2500000" /></Field>
                      <Field label="Valor de fechamento (R$)"><input style={inputStyle} value={im.valor_fechamento} onChange={(e) => setImovel(i, "valor_fechamento", e.target.value)} placeholder="Ex: 2400000" /></Field>
                      <Field label="Documentação"><input style={inputStyle} value={im.documentacao} onChange={(e) => setImovel(i, "documentacao", e.target.value)} placeholder="Ex: completa / pendente" /></Field>
                      <Field label="Prazo de entrega"><input style={inputStyle} value={im.prazo_entrega} onChange={(e) => setImovel(i, "prazo_entrega", e.target.value)} placeholder="Ex: imediata, 60 dias" /></Field>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imoveis_atualizados: form.imoveis_atualizados.filter((_, j) => j !== i) })}
                      style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#C1443C", background: "none", border: "none" }}
                    >
                      <Trash2 size={13} /> Remover este imóvel
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, imoveis_atualizados: [...form.imoveis_atualizados, emptyImovel()] })}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1px dashed #9CA3AF", background: "#fff", fontWeight: 600, fontSize: 13, color: "#0F2438" }}
                >
                  <Plus size={14} /> Adicionar imóvel atualizado
                </button>
              </div>

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
