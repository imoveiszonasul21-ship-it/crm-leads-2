import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Instagram as InstagramIcon } from "lucide-react";
import { supabase } from "./supabaseClient";
import { inputStyle, overlayStyle, modalStyle, Field } from "./shared";

const TIPOS = [
  { key: "feed", label: "Feed", color: "#4A6FA5" },
  { key: "story", label: "Story", color: "#D98B3B" },
  { key: "reels", label: "Reels", color: "#8B5FBF" },
  { key: "carrossel", label: "Carrossel", color: "#2F7A5C" },
];

const STATUSES = [
  { key: "ideia", label: "Ideia", color: "#9CA3AF" },
  { key: "roteirizado", label: "Roteirizado", color: "#4A6FA5" },
  { key: "gravado", label: "Gravado", color: "#D98B3B" },
  { key: "editado", label: "Editado", color: "#C99A3E" },
  { key: "postado", label: "Postado", color: "#2F7A5C" },
];

const tipoInfo = (k) => TIPOS.find((t) => t.key === k) || TIPOS[0];
const statusInfoOf = (k) => STATUSES.find((s) => s.key === k) || STATUSES[0];

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function AdminInstagram({ session }) {
  const [posts, setPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refDate, setRefDate] = useState(new Date());
  const [modalDate, setModalDate] = useState(null);
  const [form, setForm] = useState(null);

  const meuEmail = session.user.email;

  async function fetchPosts() {
    const { data } = await supabase.from("instagram_posts").select("*").eq("corretor_email", meuEmail).order("data", { ascending: true });
    setPosts(data || []);
    setLoaded(true);
  }

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel("instagram-admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "instagram_posts" }, fetchPosts)
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

  const postsPorDia = useMemo(() => {
    const map = {};
    posts.forEach((p) => (map[p.data] = p));
    return map;
  }, [posts]);

  function abrirDia(date) {
    const iso = toISODate(date);
    const existente = postsPorDia[iso];
    setForm(existente || { corretor_email: meuEmail, data: iso, tipo: "feed", tema: "", legenda: "", status: "ideia" });
    setModalDate(iso);
  }

  async function salvar() {
    const { id, created_at, ...rest } = form;
    if (form.id) {
      await supabase.from("instagram_posts").update(rest).eq("id", form.id);
    } else {
      await supabase.from("instagram_posts").insert(rest);
    }
    setModalDate(null);
    fetchPosts();
  }

  async function excluir() {
    if (form.id) await supabase.from("instagram_posts").delete().eq("id", form.id);
    setModalDate(null);
    fetchPosts();
  }

  if (!loaded) return <div style={{ padding: 40, color: "#6B7280" }}>Carregando planner…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <InstagramIcon size={18} color="#8B5FBF" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F2438" }}>Meu planner (imobiliária)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}><ChevronLeft size={16} /></button>
          <div style={{ fontWeight: 700, fontSize: 14, minWidth: 130, textAlign: "center" }}>{meses[refDate.getMonth()]} {refDate.getFullYear()}</div>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {diasDoMes.map((date) => {
          const iso = toISODate(date);
          const post = postsPorDia[iso];
          return (
            <div key={iso} onClick={() => abrirDia(date)} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
              <div style={{ minWidth: 46, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{diasSemana[date.getDay()]}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{date.getDate()}</div>
              </div>
              {post ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: tipoInfo(post.tipo).color, background: tipoInfo(post.tipo).color + "1A", padding: "2px 8px", borderRadius: 20 }}>{tipoInfo(post.tipo).label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statusInfoOf(post.status).color }}>{statusInfoOf(post.status).label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{post.tema || "(sem tema definido)"}</div>
                </div>
              ) : (
                <div style={{ flex: 1, fontSize: 13, color: "#C4C9D0" }}>+ planejar post</div>
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
                Post — {new Date(modalDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </div>
              <button onClick={() => setModalDate(null)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Tipo de post">
                <select style={inputStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  {TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Tema / ideia"><input style={inputStyle} value={form.tema || ""} onChange={(e) => setForm({ ...form, tema: e.target.value })} /></Field>
              <Field label="Legenda"><textarea style={{ ...inputStyle, minHeight: 70 }} value={form.legenda || ""} onChange={(e) => setForm({ ...form, legenda: e.target.value })} /></Field>
              <Field label="Status">
                <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
              {form.id ? (
                <button onClick={excluir} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#FBEAE9", color: "#C1443C", fontWeight: 600 }}>Excluir</button>
              ) : <span />}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setModalDate(null)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", fontWeight: 600 }}>Cancelar</button>
                <button onClick={salvar} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0F2438", color: "#fff", fontWeight: 600 }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
