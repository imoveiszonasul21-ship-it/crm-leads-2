import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { supabase } from "./supabaseClient";
import { inputStyle, overlayStyle, modalStyle } from "./shared";

const ITENS = [
  { key: "reuniao_alinhamento", label: "Reunião de alinhamento com corretores" },
  { key: "feedback_visitas", label: "Feedback das visitas" },
  { key: "contato_compradores", label: "Contato com compradores" },
  { key: "contato_proprietarios", label: "Contato com proprietários" },
  { key: "contato_captacao_nova", label: "Contato com captação que acabou de entrar" },
  { key: "balanco_leads", label: "Verificar balanço diário de leads" },
  { key: "balanco_visitas", label: "Verificar balanço diário de visitas" },
  { key: "balanco_captacoes", label: "Verificar balanço diário de captações" },
  { key: "post_instagram", label: "Post no Instagram" },
  { key: "treinamento", label: "Treinamento com a equipe" },
  { key: "pos_venda", label: "Verificar pós-venda" },
  { key: "agendar_escritura", label: "Agendar escritura" },
  { key: "conferir_documentos_escritura", label: "Conferir documentos da escritura" },
  { key: "negociacoes", label: "Acompanhar negociações em andamento" },
  { key: "revisao_metas", label: "Revisão das metas do mês" },
  { key: "anuncios_portais", label: "Conferir anúncios nos portais" },
];

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function GerenciaDiaria() {
  const [registros, setRegistros] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refDate, setRefDate] = useState(new Date());
  const [modalDate, setModalDate] = useState(null);
  const [form, setForm] = useState(null);

  async function fetchRegistros() {
    const { data } = await supabase.from("gerencia_diaria").select("*").order("data", { ascending: true });
    setRegistros(data || []);
    setLoaded(true);
  }

  useEffect(() => {
    fetchRegistros();
    const channel = supabase
      .channel("gerencia-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "gerencia_diaria" }, fetchRegistros)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const diasDoMes = useMemo(() => {
    const ano = refDate.getFullYear();
    const mes = refDate.getMonth();
    const ultimoDia = new Date(ano, mes + 1, 0);
    const dias = [];
    for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(ano, mes, d));
    return dias;
  }, [refDate]);

  const registroPorDia = useMemo(() => {
    const map = {};
    registros.forEach((r) => (map[r.data] = r));
    return map;
  }, [registros]);

  function abrirDia(date) {
    const iso = toISODate(date);
    const existente = registroPorDia[iso];
    setForm(existente || { data: iso, checklist: {}, observacoes: "" });
    setModalDate(iso);
  }

  function toggleItem(key) {
    setForm({ ...form, checklist: { ...form.checklist, [key]: !form.checklist[key] } });
  }

  async function salvar() {
    const { id, created_at, ...rest } = form;
    if (form.id) {
      await supabase.from("gerencia_diaria").update(rest).eq("id", form.id);
    } else {
      await supabase.from("gerencia_diaria").upsert(rest, { onConflict: "data" });
    }
    setModalDate(null);
    fetchRegistros();
  }

  if (!loaded) return <div style={{ padding: 40, color: "#6B7280" }}>Carregando…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <ClipboardCheck size={18} color="#0F2438" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F2438" }}>Rotina diária de gestão</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}><ChevronLeft size={16} /></button>
          <div style={{ fontWeight: 700, fontSize: 14, minWidth: 130, textAlign: "center" }}>{meses[refDate.getMonth()]} {refDate.getFullYear()}</div>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {diasDoMes.map((date) => {
          const iso = toISODate(date);
          const r = registroPorDia[iso];
          const feitos = r ? Object.values(r.checklist || {}).filter(Boolean).length : 0;
          return (
            <div key={iso} onClick={() => abrirDia(date)} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
              <div style={{ minWidth: 46, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{diasSemana[date.getDay()]}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{date.getDate()}</div>
              </div>
              {r ? (
                <div style={{ flex: 1, fontSize: 13, color: "#374151" }}>
                  {feitos} de {ITENS.length} itens concluídos
                  <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, marginTop: 4, maxWidth: 200 }}>
                    <div style={{ height: 6, borderRadius: 3, background: feitos === ITENS.length ? "#2F7A5C" : "#C99A3E", width: `${(feitos / ITENS.length) * 100}%` }} />
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, fontSize: 13, color: "#C4C9D0" }}>+ preencher checklist do dia</div>
              )}
            </div>
          );
        })}
      </div>

      {modalDate && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>
                Checklist — {new Date(modalDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </div>
              <button onClick={() => setModalDate(null)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ITENS.map((item) => (
                <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, padding: "6px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!form.checklist[item.key]} onChange={() => toggleItem(item.key)} style={{ width: 16, height: 16 }} />
                  <span style={{ textDecoration: form.checklist[item.key] ? "line-through" : "none", color: form.checklist[item.key] ? "#9CA3AF" : "#0F2438" }}>{item.label}</span>
                </label>
              ))}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>Observações do dia</div>
                <textarea style={{ ...inputStyle, minHeight: 70 }} value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
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
