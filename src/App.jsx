import React, { useState, useEffect, useMemo } from "react";
import { Plus, Phone, Search, AlertTriangle, X, Trash2, Edit2, TrendingUp, Users, Clock, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import Captacoes from "./Captacoes";
import InstagramPlanner from "./InstagramPlanner";
import AtividadesDiarias from "./AtividadesDiarias";

const STATUSES = [
  { key: "novo", label: "Novo", color: "#4A6FA5" },
  { key: "contato", label: "Em contato", color: "#2F7A5C" },
  { key: "visita", label: "Visita agendada", color: "#C99A3E" },
  { key: "proposta", label: "Proposta enviada", color: "#D98B3B" },
  { key: "negociacao", label: "Negociação", color: "#8B5FBF" },
  { key: "fechado", label: "Fechado", color: "#1E7A4C" },
  { key: "perdido", label: "Perdido", color: "#9CA3AF" },
];

const ORIGENS = ["Site", "Portal (Zap/OLX/VivaReal)", "Indicação", "Redes sociais", "Placa/Ligação direta", "Outro"];

const statusInfo = (key) => STATUSES.find((s) => s.key === key) || STATUSES[0];

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}

function urgencyOf(lead) {
  if (lead.status === "fechado") return { level: "ok", label: "Fechado", color: "#1E7A4C" };
  if (lead.status === "perdido") return { level: "muted", label: "Perdido", color: "#9CA3AF" };
  const dias = daysBetween(lead.proximo_contato);
  if (dias === null) return { level: "sem-data", label: "Sem retorno agendado", color: "#C1443C" };
  if (dias < 0) return { level: "atrasado", label: `Atrasado há ${Math.abs(dias)}d`, color: "#C1443C" };
  if (dias === 0) return { level: "hoje", label: "Retornar hoje", color: "#D98B3B" };
  if (dias <= 2) return { level: "breve", label: `Em ${dias}d`, color: "#C99A3E" };
  return { level: "tranquilo", label: `Em ${dias}d`, color: "#2F7A5C" };
}

const emptyForm = {
  nome: "",
  telefone: "",
  corretor: "",
  origem: ORIGENS[0],
  imovel: "",
  valor: "",
  status: "novo",
  proximo_contato: "",
  observacoes: "",
};

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterCorretor, setFilterCorretor] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterUrgente, setFilterUrgente] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("leads");

  async function fetchLeads() {
    const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (error) {
      setErrorMsg(error.message);
    } else {
      setLeads(data || []);
      setErrorMsg("");
    }
    setLoaded(true);
  }

  // Verifica se já existe login ativo, e escuta mudanças (login/logout)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Depois de logar, busca o perfil (papel: admin ou corretor) e os leads
  useEffect(() => {
    if (session === undefined) return; // ainda não sabemos
    if (session === null) {
      setLoaded(true);
      return;
    }
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(prof || null);
      await fetchLeads();
    })();

    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        fetchLeads();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const corretores = useMemo(() => {
    const s = new Set(leads.map((l) => l.corretor).filter(Boolean));
    return Array.from(s).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    let list = leads.filter((l) => {
      if (filterCorretor !== "todos" && l.corretor !== filterCorretor) return false;
      if (filterStatus !== "todos" && l.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !l.nome.toLowerCase().includes(q) &&
          !l.telefone.toLowerCase().includes(q) &&
          !(l.imovel || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filterUrgente) {
        const u = urgencyOf(l);
        if (!["atrasado", "hoje", "sem-data"].includes(u.level)) return false;
      }
      return true;
    });
    const rank = { atrasado: 0, "sem-data": 1, hoje: 2, breve: 3, tranquilo: 4, ok: 5, muted: 6 };
    list.sort((a, b) => rank[urgencyOf(a).level] - rank[urgencyOf(b).level]);
    return list;
  }, [leads, filterCorretor, filterStatus, search, filterUrgente]);

  const stats = useMemo(() => {
    const ativos = leads.filter((l) => l.status !== "fechado" && l.status !== "perdido");
    const atrasados = ativos.filter((l) => ["atrasado", "sem-data"].includes(urgencyOf(l).level));
    const fechados = leads.filter((l) => l.status === "fechado");
    return {
      total: leads.length,
      ativos: ativos.length,
      atrasados: atrasados.length,
      fechados: fechados.length,
      taxaFechamento: leads.length ? Math.round((fechados.length / leads.length) * 100) : 0,
    };
  }, [leads]);

  const porCorretor = useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      const key = l.corretor || "Sem corretor";
      if (!map[key]) map[key] = { total: 0, atrasados: 0, fechados: 0 };
      map[key].total += 1;
      if (l.status === "fechado") map[key].fechados += 1;
      if (["atrasado", "sem-data"].includes(urgencyOf(l).level) && l.status !== "fechado" && l.status !== "perdido")
        map[key].atrasados += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].atrasados - a[1].atrasados);
  }, [leads]);

  function openNew() {
    setForm({ ...emptyForm, corretor_email: isAdmin ? "" : session.user.email });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(lead) {
    setForm(lead);
    setEditingId(lead.id);
    setModalOpen(true);
  }

  async function saveForm() {
    if (!form.nome.trim() || !form.telefone.trim()) return;
    if (editingId) {
      const { id, created_at, ...rest } = form;
      const { error } = await supabase.from("leads").update(rest).eq("id", editingId);
      if (error) setErrorMsg(error.message);
    } else {
      const { id, created_at, ...rest } = form;
      const { error } = await supabase.from("leads").insert(rest);
      if (error) setErrorMsg(error.message);
    }
    setModalOpen(false);
    fetchLeads();
  }

  async function removeLead(id) {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) setErrorMsg(error.message);
    setConfirmDelete(null);
    fetchLeads();
  }

  if (session === undefined || !loaded) {
    return <div style={{ fontFamily: "Inter, sans-serif", padding: 40, color: "#6B7280" }}>Carregando…</div>;
  }

  if (session === null) {
    return <Login />;
  }

  const isAdmin = profile?.role === "admin";

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6F8", fontFamily: "'Inter', sans-serif", color: "#0F2438" }}>
      <style>{`
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input, select, textarea { font-family: inherit; }
        ::placeholder { color: #9CA3AF; }
      `}</style>

      <div style={{ background: "#0F2438", color: "#fff", padding: "28px 20px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
            Painel de Leads
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ color: "#9FB4C7", fontSize: 14, marginTop: 4 }}>
              Sinal vital do seu funil — nenhum lead esfria sem você ver.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#9FB4C7" }}>
              <span>{session.user.email} · {isAdmin ? "Admin" : "Corretor"}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 10px", borderRadius: 6, fontSize: 13 }}
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>

          {errorMsg && (
            <div style={{ background: "#FBEAE9", color: "#8C2F28", padding: "8px 12px", borderRadius: 8, marginTop: 12, fontSize: 13 }}>
              Erro de conexão com o banco: {errorMsg}. Confira as chaves do Supabase no arquivo .env.
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <StatCard icon={<Users size={16} />} label="Leads ativos" value={stats.ativos} />
            <StatCard
              icon={<AlertTriangle size={16} />}
              label="Precisam de atenção"
              value={stats.atrasados}
              accent={stats.atrasados > 0 ? "#C1443C" : undefined}
            />
            <StatCard icon={<TrendingUp size={16} />} label="Taxa de fechamento" value={`${stats.taxaFechamento}%`} />
            <StatCard icon={<Clock size={16} />} label="Total histórico" value={stats.total} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid #E5E7EB", flexWrap: "wrap" }}>
          {[
            { key: "leads", label: "Leads" },
            { key: "captacoes", label: "Captações" },
            { key: "instagram", label: "Instagram" },
            { key: "atividades", label: "Atividades" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #0F2438" : "2px solid transparent",
                padding: "10px 14px",
                fontWeight: 700,
                fontSize: 14,
                color: activeTab === tab.key ? "#0F2438" : "#9CA3AF",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "captacoes" && <Captacoes session={session} isAdmin={isAdmin} />}
        {activeTab === "instagram" && <InstagramPlanner session={session} isAdmin={isAdmin} />}
        {activeTab === "atividades" && <AtividadesDiarias session={session} isAdmin={isAdmin} />}

        {activeTab === "leads" && (
        <>
        {stats.atrasados > 0 && (
          <div
            style={{
              background: "#FBEAE9",
              border: "1px solid #E8B4B0",
              color: "#8C2F28",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
            }}
          >
            <AlertTriangle size={18} />
            <span>
              <b>{stats.atrasados}</b> lead{stats.atrasados > 1 ? "s estão" : " está"} sem retorno agendado ou
              atrasado{stats.atrasados > 1 ? "s" : ""}. Filtre abaixo e cobre seus corretores hoje.
            </span>
            <button
              onClick={() => setFilterUrgente((v) => !v)}
              style={{
                marginLeft: "auto",
                background: filterUrgente ? "#8C2F28" : "#fff",
                color: filterUrgente ? "#fff" : "#8C2F28",
                border: "1px solid #8C2F28",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {filterUrgente ? "Ver todos" : "Ver urgentes"}
            </button>
          </div>
        )}

        {porCorretor.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F2438", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Desempenho por corretor
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {porCorretor.map(([nome, d]) => (
                <div
                  key={nome}
                  onClick={() => setFilterCorretor(filterCorretor === nome ? "todos" : nome)}
                  style={{
                    minWidth: 150,
                    border: filterCorretor === nome ? "2px solid #0F2438" : "1px solid #E5E7EB",
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{nome}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{d.total} leads · {d.fechados} fechados</div>
                  {d.atrasados > 0 && (
                    <div style={{ fontSize: 12, color: "#C1443C", fontWeight: 600, marginTop: 2 }}>
                      ⚠ {d.atrasados} sem retorno
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "#9CA3AF" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, telefone, imóvel…"
              style={{ width: "100%", padding: "9px 10px 9px 32px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14 }}
            />
          </div>
          <select value={filterCorretor} onChange={(e) => setFilterCorretor(e.target.value)} style={selectStyle}>
            <option value="todos">Todos os corretores</option>
            {corretores.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="todos">Todos os status</option>
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button
            onClick={openNew}
            style={{ background: "#0F2438", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={16} /> Novo lead
          </button>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", background: "#fff", borderRadius: 12, border: "1px dashed #D1D5DB" }}>
            {leads.length === 0
              ? "Nenhum lead cadastrado ainda. Clique em “Novo lead” para começar a controlar seu funil."
              : "Nenhum lead corresponde a esse filtro."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((lead) => {
              const u = urgencyOf(lead);
              const st = statusInfo(lead.status);
              return (
                <div key={lead.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: u.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{lead.nome}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.color + "1A", padding: "2px 8px", borderRadius: 20 }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {lead.telefone}</span>
                      {lead.corretor && <span>Corretor: <b style={{ color: "#0F2438" }}>{lead.corretor}</b></span>}
                      {lead.imovel && <span>{lead.imovel}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: u.color }}>{u.label}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button onClick={() => openEdit(lead)} style={iconBtnStyle}><Edit2 size={14} /></button>
                      <button onClick={() => setConfirmDelete(lead.id)} style={{ ...iconBtnStyle, color: "#C1443C" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>

      {modalOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>
                {editingId ? "Editar lead" : "Novo lead"}
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Nome*"><input style={inputStyle} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
              <Field label="Telefone*"><input style={inputStyle} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
              <Field label="Corretor responsável (nome)"><input style={inputStyle} value={form.corretor} onChange={(e) => setForm({ ...form, corretor: e.target.value })} placeholder="Nome do corretor" /></Field>
              <Field label="E-mail do corretor (login)">
                <input
                  style={{ ...inputStyle, background: isAdmin ? "#fff" : "#F3F4F6" }}
                  value={form.corretor_email || ""}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, corretor_email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </Field>
              <Field label="Origem">
                <select style={inputStyle} value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })}>
                  {ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Imóvel de interesse"><input style={inputStyle} value={form.imovel} onChange={(e) => setForm({ ...form, imovel: e.target.value })} placeholder="Ex: Apto 2q Jardim Europa" /></Field>
              <Field label="Valor (R$)"><input style={inputStyle} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Ex: 450000" /></Field>
              <Field label="Status">
                <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Próximo contato agendado"><input type="date" style={inputStyle} value={form.proximo_contato || ""} onChange={(e) => setForm({ ...form, proximo_contato: e.target.value })} /></Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Observações"><textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", fontWeight: 600 }}>Cancelar</button>
              <button onClick={saveForm} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0F2438", color: "#fff", fontWeight: 600 }}>Salvar lead</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Excluir lead?</div>
            <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 18 }}>Essa ação não pode ser desfeita.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => removeLead(confirmDelete)} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#C1443C", color: "#fff", fontWeight: 600 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 16px", minWidth: 130 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9FB4C7", fontSize: 12, fontWeight: 600 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: accent || "#fff" }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const selectStyle = { padding: "9px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, background: "#fff" };
const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14 };
const iconBtnStyle = { background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6, display: "flex", color: "#374151" };
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(15,36,56,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 };
const modalStyle = { background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" };
