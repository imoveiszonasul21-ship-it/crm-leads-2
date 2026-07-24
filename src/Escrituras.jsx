import React, { useState, useEffect, useMemo } from "react";
import { Plus, X, Trash2, Edit2, FileText } from "lucide-react";
import { supabase } from "./supabaseClient";
import { selectStyle, inputStyle, iconBtnStyle, overlayStyle, modalStyle, Field } from "./shared";

const CHECKLIST_VENDEDOR_IMOVEL = [
  { key: "onus_reais", label: "Ônus Reais" },
  { key: "certidao_enfiteutica", label: "Certidão Enfitêutica" },
  { key: "distribuicao_fiscal_fazendaria", label: "2º Ofício do Registro de Distribuição - Fiscal e Fazendária" },
  { key: "certidao_funesbom", label: "Certidão Funesbom" },
  { key: "declaracao_quitacao_condominio", label: "Declaração de quitação de condomínio" },
];

const CHECKLIST_VENDEDOR_PESSOAL = [
  { key: "rg", label: "RG" },
  { key: "certidao_estado_civil", label: "Certidão de estado civil" },
  { key: "interdicoes_tutelas_1oficio", label: "1º Ofício de Interdições e Tutelas Rio de Janeiro" },
  { key: "interdicoes_tutelas_2oficio", label: "2º Ofício de Interdições e Tutelas Rio de Janeiro" },
  { key: "distribuidores_civeis_2oficio", label: "2º Ofício Distribuidores Cíveis" },
  { key: "distribuidores_fiscal_2oficio", label: "2º Ofício de Distribuidores Fiscal e Fazendária" },
  { key: "certidao_justica_federal", label: "Certidão da Justiça Federal" },
  { key: "certidao_receita_federal", label: "Certidão da Receita Federal" },
  { key: "cndt", label: "Certidão Nacional de Débitos Trabalhistas do TST (CNDT)" },
];

const CHECKLIST_COMPRADOR = [
  { key: "rg", label: "RG" },
  { key: "certidao_estado_civil", label: "Certidão de estado civil" },
  { key: "comprovante_residencia", label: "Comprovante de residência" },
];

function checklistVazioVendedor() {
  const obj = {};
  [...CHECKLIST_VENDEDOR_IMOVEL, ...CHECKLIST_VENDEDOR_PESSOAL].forEach((i) => (obj[i.key] = false));
  return obj;
}

function checklistVazioComprador() {
  const obj = {};
  CHECKLIST_COMPRADOR.forEach((i) => (obj[i.key] = false));
  return obj;
}

const STATUSES = [
  { key: "documentacao", label: "Reunindo documentação", color: "#4A6FA5" },
  { key: "itbi", label: "Aguardando ITBI", color: "#D98B3B" },
  { key: "agendado", label: "Escritura agendada", color: "#C99A3E" },
  { key: "concluido", label: "Concluído", color: "#2F7A5C" },
];

const statusInfo = (key) => STATUSES.find((s) => s.key === key) || STATUSES[0];

const emptyForm = {
  corretor: "",
  imovel: "",
  data_prevista: "",
  data_escritura: "",
  checklist_vendedor: checklistVazioVendedor(),
  checklist_comprador: checklistVazioComprador(),
  guia_itbi_emitida: false,
  data_pagamento_itbi: "",
  valor_imovel: "",
  valor_comissao: "",
  comprador_nome: "",
  comprador_contato: "",
  vendedor_nome: "",
  vendedor_contato: "",
  status: "documentacao",
  observacoes: "",
};

export default function Escrituras() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function fetchItems() {
    const { data } = await supabase.from("escrituras").select("*").order("data_prevista", { ascending: true });
    setItems(data || []);
    setLoaded(true);
  }

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel("escrituras-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "escrituras" }, fetchItems)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => (filterStatus === "todos" ? true : i.status === filterStatus));
  }, [items, filterStatus]);

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    setForm({
      ...item,
      checklist_vendedor: { ...checklistVazioVendedor(), ...(item.checklist_vendedor || {}) },
      checklist_comprador: { ...checklistVazioComprador(), ...(item.checklist_comprador || {}) },
    });
    setEditingId(item.id);
    setModalOpen(true);
  }

  async function saveForm() {
    if (!form.imovel.trim()) return;
    const { id, created_at, ...rest } = form;
    ["data_prevista", "data_escritura", "data_pagamento_itbi"].forEach((k) => {
      if (rest[k] === "") rest[k] = null;
    });
    if (editingId) {
      await supabase.from("escrituras").update(rest).eq("id", editingId);
    } else {
      await supabase.from("escrituras").insert(rest);
    }
    setModalOpen(false);
    fetchItems();
  }

  async function removeItem(id) {
    await supabase.from("escrituras").delete().eq("id", id);
    setConfirmDelete(null);
    fetchItems();
  }

  if (!loaded) return <div style={{ padding: 40, color: "#6B7280" }}>Carregando escrituras…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="todos">Todos os status</option>
          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button onClick={openNew} style={{ background: "#0F2438", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <Plus size={16} /> Nova escritura
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", background: "#fff", borderRadius: 12, border: "1px dashed #D1D5DB" }}>
          Nenhuma escritura em andamento.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((item) => {
            const st = statusInfo(item.status);
            const totalVendedor = CHECKLIST_VENDEDOR_IMOVEL.length + CHECKLIST_VENDEDOR_PESSOAL.length;
            const feitosVendedor = Object.values(item.checklist_vendedor || {}).filter(Boolean).length;
            const totalComprador = CHECKLIST_COMPRADOR.length;
            const feitosComprador = Object.values(item.checklist_comprador || {}).filter(Boolean).length;
            return (
              <div key={item.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                <FileText size={18} color="#6B7280" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{item.imovel}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.color + "1A", padding: "2px 8px", borderRadius: 20 }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {item.data_prevista && <span>Prevista: {new Date(item.data_prevista + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                    {item.vendedor_nome && <span>Vendedor: <b style={{ color: "#0F2438" }}>{item.vendedor_nome}</b></span>}
                    {item.comprador_nome && <span>Comprador: <b style={{ color: "#0F2438" }}>{item.comprador_nome}</b></span>}
                    {item.valor_comissao && <span>Comissão: R$ {item.valor_comissao}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                    Docs vendedor: {feitosVendedor}/{totalVendedor} · Docs comprador: {feitosComprador}/{totalComprador}
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
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>{editingId ? "Editar escritura" : "Nova escritura"}</div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Imóvel*"><input style={inputStyle} value={form.imovel} onChange={(e) => setForm({ ...form, imovel: e.target.value })} placeholder="Endereço do imóvel" /></Field>
              </div>
              <Field label="Corretor responsável"><input style={inputStyle} value={form.corretor} onChange={(e) => setForm({ ...form, corretor: e.target.value })} /></Field>
              <Field label="Status">
                <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>

              <Field label="Vendedor (nome)"><input style={inputStyle} value={form.vendedor_nome} onChange={(e) => setForm({ ...form, vendedor_nome: e.target.value })} /></Field>
              <Field label="Vendedor (contato)"><input style={inputStyle} value={form.vendedor_contato} onChange={(e) => setForm({ ...form, vendedor_contato: e.target.value })} /></Field>
              <Field label="Comprador (nome)"><input style={inputStyle} value={form.comprador_nome} onChange={(e) => setForm({ ...form, comprador_nome: e.target.value })} /></Field>
              <Field label="Comprador (contato)"><input style={inputStyle} value={form.comprador_contato} onChange={(e) => setForm({ ...form, comprador_contato: e.target.value })} /></Field>

              <Field label="Valor do imóvel (R$)"><input style={inputStyle} value={form.valor_imovel} onChange={(e) => setForm({ ...form, valor_imovel: e.target.value })} /></Field>
              <Field label="Valor da comissão (R$)"><input style={inputStyle} value={form.valor_comissao} onChange={(e) => setForm({ ...form, valor_comissao: e.target.value })} /></Field>

              <Field label="Data prevista da escritura"><input type="date" style={inputStyle} value={form.data_prevista || ""} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} /></Field>
              <Field label="Data em que a escritura foi realizada"><input type="date" style={inputStyle} value={form.data_escritura || ""} onChange={(e) => setForm({ ...form, data_escritura: e.target.value })} /></Field>

              <Field label="Data de pagamento do ITBI"><input type="date" style={inputStyle} value={form.data_pagamento_itbi || ""} onChange={(e) => setForm({ ...form, data_pagamento_itbi: e.target.value })} /></Field>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, fontSize: 14 }}>
                <input type="checkbox" checked={form.guia_itbi_emitida} onChange={(e) => setForm({ ...form, guia_itbi_emitida: e.target.checked })} />
                Guia de ITBI emitida
              </label>

              <div style={{ gridColumn: "1 / -1", background: "#F9FAFB", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Checklist — vendedor: documentos do imóvel</div>
                {CHECKLIST_VENDEDOR_IMOVEL.map((item) => (
                  <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!form.checklist_vendedor[item.key]}
                      onChange={(e) => setForm({ ...form, checklist_vendedor: { ...form.checklist_vendedor, [item.key]: e.target.checked } })}
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              <div style={{ gridColumn: "1 / -1", background: "#F9FAFB", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Checklist — vendedor: documentos pessoais</div>
                {CHECKLIST_VENDEDOR_PESSOAL.map((item) => (
                  <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!form.checklist_vendedor[item.key]}
                      onChange={(e) => setForm({ ...form, checklist_vendedor: { ...form.checklist_vendedor, [item.key]: e.target.checked } })}
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              <div style={{ gridColumn: "1 / -1", background: "#F9FAFB", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Checklist — comprador</div>
                {CHECKLIST_COMPRADOR.map((item) => (
                  <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!form.checklist_comprador[item.key]}
                      onChange={(e) => setForm({ ...form, checklist_comprador: { ...form.checklist_comprador, [item.key]: e.target.checked } })}
                    />
                    {item.label}
                  </label>
                ))}
              </div>

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
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Excluir escritura?</div>
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
