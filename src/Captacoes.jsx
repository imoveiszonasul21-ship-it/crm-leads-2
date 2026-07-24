import React, { useState, useEffect, useMemo } from "react";
import { Plus, X, Trash2, Edit2, Home } from "lucide-react";
import { supabase } from "./supabaseClient";
import { selectStyle, inputStyle, iconBtnStyle, overlayStyle, modalStyle, Field } from "./shared";

const STATUSES = [
  { key: "buscando", label: "Buscando", color: "#4A6FA5" },
  { key: "em_captacao", label: "Em captação", color: "#D98B3B" },
  { key: "captado", label: "Captado", color: "#2F7A5C" },
  { key: "exclusividade", label: "Exclusividade", color: "#8B5FBF" },
  { key: "perdida", label: "Perdida", color: "#9CA3AF" },
];

const statusInfo = (key) => STATUSES.find((s) => s.key === key) || STATUSES[0];

const emptyForm = { corretor: "", corretor_email: "", endereco: "", tipo_imovel: "", valor: "", status: "buscando", observacoes: "" };

export default function Captacoes({ session, isAdmin }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterCorretor, setFilterCorretor] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function fetchItems() {
    const { data } = await supabase.from("captacoes").select("*").order("created_at", { ascending: false });
    setItems(data || []);
    setLoaded(true);
  }

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel("captacoes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "captacoes" }, fetchItems)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const corretores = useMemo(() => {
    const s = new Set(items.map((i) => i.corretor).filter(Boolean));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterCorretor !== "todos" && i.corretor !== filterCorretor) return false;
      if (filterStatus !== "todos" && i.status !== filterStatus) return false;
      return true;
    });
  }, [items, filterCorretor, filterStatus]);

  const porCorretor = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      const key = i.corretor || "Sem corretor";
      if (!map[key]) map[key] = { total: 0, captados: 0, exclusividades: 0 };
      map[key].total += 1;
      if (i.status === "captado") map[key].captados += 1;
      if (i.status === "exclusividade") map[key].exclusividades += 1;
    });
    return Object.entries(map);
  }, [items]);

  function openNew() {
    setForm({ ...emptyForm, corretor_email: isAdmin ? "" : session.user.email });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    setForm(item);
    setEditingId(item.id);
    setModalOpen(true);
  }

  async function saveForm() {
    if (!form.endereco.trim()) return;
    const { id, created_at, ...rest } = form;
    if (editingId) {
      await supabase.from("captacoes").update(rest).eq("id", editingId);
    } else {
      await supabase.from("captacoes").insert(rest);
    }
    setModalOpen(false);
    fetchItems();
  }

  async function removeItem(id) {
    await supabase.from("captacoes").delete().eq("id", id);
    setConfirmDelete(null);
    fetchItems();
  }

  if (!loaded) return <div style={{ padding: 40, color: "#6B7280" }}>Carregando captações…</div>;

  return (
    <div>
      {isAdmin && porCorretor.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F2438", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Captações por corretor
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {porCorretor.map(([nome, d]) => (
              <div key={nome} onClick={() => setFilterCorretor(filterCorretor === nome ? "todos" : nome)}
                style={{ minWidth: 150, border: filterCorretor === nome ? "2px solid #0F2438" : "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", cursor: "pointer", flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{nome}</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{d.total} total · {d.captados} captados · {d.exclusividades} exclusivas</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        {isAdmin && (
          <select value={filterCorretor} onChange={(e) => setFilterCorretor(e.target.value)} style={selectStyle}>
            <option value="todos">Todos os corretores</option>
            {corretores.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="todos">Todos os status</option>
          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button onClick={openNew} style={{ background: "#0F2438", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <Plus size={16} /> Nova captação
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", background: "#fff", borderRadius: 12, border: "1px dashed #D1D5DB" }}>
          Nenhuma captação cadastrada ainda.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((item) => {
            const st = statusInfo(item.status);
            return (
              <div key={item.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                <Home size={18} color="#6B7280" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{item.endereco}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.color + "1A", padding: "2px 8px", borderRadius: 20 }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {item.tipo_imovel && <span>{item.tipo_imovel}</span>}
                    {item.valor && <span>R$ {item.valor}</span>}
                    {item.corretor && <span>Corretor: <b style={{ color: "#0F2438" }}>{item.corretor}</b></span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(item)} style={iconBtnStyle}><Edit2 size={14} /></button>
                  <button onClick={() => setConfirmDelete(item.id)} style={{ ...iconBtnStyle, color: "#C1443C" }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>{editingId ? "Editar captação" : "Nova captação"}</div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Endereço / Imóvel*"><input style={inputStyle} value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Ex: Rua das Flores, 123 - Apto 302" /></Field>
              </div>
              <Field label="Tipo de imóvel"><input style={inputStyle} value={form.tipo_imovel} onChange={(e) => setForm({ ...form, tipo_imovel: e.target.value })} placeholder="Ex: Apto 2 quartos" /></Field>
              <Field label="Valor (R$)"><input style={inputStyle} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
              <Field label="Corretor (nome)"><input style={inputStyle} value={form.corretor} onChange={(e) => setForm({ ...form, corretor: e.target.value })} /></Field>
              <Field label="E-mail do corretor">
                <input style={{ ...inputStyle, background: isAdmin ? "#fff" : "#F3F4F6" }} disabled={!isAdmin} value={form.corretor_email || ""} onChange={(e) => setForm({ ...form, corretor_email: e.target.value })} />
              </Field>
              <Field label="Status">
                <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Observações"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", fontWeight: 600 }}>Cancelar</button>
              <button onClick={saveForm} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0F2438", color: "#fff", fontWeight: 600 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Excluir captação?</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => removeItem(confirmDelete)} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#C1443C", color: "#fff", fontWeight: 600 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
