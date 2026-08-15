import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, CalendarDays, Trash2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { inputStyle, overlayStyle, modalStyle, Field } from "./shared";

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const emptyForm = (iso) => ({ data: iso, horario: "", titulo: "", local: "", descricao: "", concluido: false });

export default function Agenda() {
  const [compromissos, setCompromissos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refDate, setRefDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(null);

  async function fetchCompromissos() {
    const { data } = await supabase.from("compromissos").select("*").order("data", { ascending: true }).order("horario", { ascending: true });
    setCompromissos(data || []);
    setLoaded(true);
  }

  useEffect(() => {
    fetchCompromissos();
    const channel = supabase
      .channel("compromissos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "compromissos" }, fetchCompromissos)
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

  const porDia = useMemo(() => {
    const map = {};
    compromissos.forEach((c) => {
      if (!map[c.data]) map[c.data] = [];
      map[c.data].push(c);
    });
    return map;
  }, [compromissos]);

  function abrirNovo(date) {
    setForm(emptyForm(toISODate(date)));
    setModalOpen(true);
  }

  function abrirEdit(item) {
    setForm(item);
    setModalOpen(true);
  }

  async function salvar() {
    if (!form.titulo.trim()) {
      alert("Preencha o título do compromisso.");
      return;
    }
    const { id, created_at, ...rest } = form;
    if (rest.horario === "") rest.horario = null;
    if (form.id) {
      await supabase.from("compromissos").update(rest).eq("id", form.id);
    } else {
      await supabase.from("compromissos").insert(rest);
    }
    setModalOpen(false);
    fetchCompromissos();
  }

  async function excluir() {
    if (form.id) await supabase.from("compromissos").delete().eq("id", form.id);
    setModalOpen(false);
    fetchCompromissos();
  }

  if (!loaded) return <div style={{ padding: 40, color: "#6B7280" }}>Carregando agenda…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <CalendarDays size={18} color="#0F2438" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F2438" }}>Agenda de compromissos</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}><ChevronLeft size={16} /></button>
          <div style={{ fontWeight: 700, fontSize: 14, minWidth: 130, textAlign: "center" }}>{meses[refDate.getMonth()]} {refDate.getFullYear()}</div>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {diasDoMes.map((date) => {
          const iso = toISODate(date);
          const itens = (porDia[iso] || []).slice().sort((a, b) => (a.horario || "99:99").localeCompare(b.horario || "99:99"));
          const hoje = toISODate(new Date()) === iso;
          return (
            <div key={iso} style={{ background: "#fff", borderRadius: 10, border: hoje ? "2px solid #0F2438" : "1px solid #E5E7EB", padding: "10px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ minWidth: 46, textAlign: "center", paddingTop: 2 }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{diasSemana[date.getDay()]}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{date.getDate()}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                {itens.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => abrirEdit(item)}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: item.concluido ? "#F3F4F6" : "#EFF3F8",
                    }}
                  >
                    {item.horario && <span style={{ fontWeight: 700, color: "#0F2438" }}>{item.horario.slice(0, 5)}</span>}
                    <span style={{ textDecoration: item.concluido ? "line-through" : "none", color: item.concluido ? "#9CA3AF" : "#0F2438" }}>{item.titulo}</span>
                    {item.local && <span style={{ color: "#6B7280" }}>· {item.local}</span>}
                  </div>
                ))}
                <button onClick={() => abrirNovo(date)} style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 600, color: "#0F2438", background: "#F3F4F6", border: "none", borderRadius: 20, padding: "4px 10px" }}>
                  + compromisso
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>
                Compromisso — {new Date(form.data + "T00:00:00").toLocaleDateString("pt-BR")}
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Título*"><input style={inputStyle} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Visita com cliente João" /></Field>
              </div>
              <Field label="Horário"><input type="time" style={inputStyle} value={form.horario || ""} onChange={(e) => setForm({ ...form, horario: e.target.value })} /></Field>
              <Field label="Local"><input style={inputStyle} value={form.local || ""} onChange={(e) => setForm({ ...form, local: e.target.value })} /></Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Descrição"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={form.concluido} onChange={(e) => setForm({ ...form, concluido: e.target.checked })} />
                Concluído
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
              {form.id ? (
                <button onClick={excluir} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#FBEAE9", color: "#C1443C", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={14} /> Excluir</button>
              ) : <span />}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setModalOpen(false)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", fontWeight: 600 }}>Cancelar</button>
                <button onClick={salvar} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0F2438", color: "#fff", fontWeight: 600 }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
