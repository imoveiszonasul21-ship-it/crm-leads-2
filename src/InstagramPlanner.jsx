import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Instagram as InstagramIcon } from "lucide-react";
import { supabase } from "./supabaseClient";
import { selectStyle, inputStyle, overlayStyle, modalStyle, Field } from "./shared";

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

export default function InstagramPlanner({ session, isAdmin }) {
  const [posts, setPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refDate, setRefDate] = useState(new Date());
  const [selectedCorretor, setSelectedCorretor] = useState(isAdmin ? "" : session.user.email);
  const [modalDate, setModalDate] = useState(null);
  const [form, setForm] = useState(null);

  async function fetchPosts() {
    const { data } = await supabase.from("instagram_posts").select("*").order("data", { ascending: true });
    setPosts(data || []);
    setLoaded(true);
  }

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel("instagram-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "instagram_posts" }, fetchPosts)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const corretoresDisponiveis = useMemo(() => {
    const s = new Set(posts.map((p) => p.corretor_email).filter(Boolean));
    if (!isAdmin) s.add(session.user.email);
    return Array.from(s).sort();
  }, [posts, isAdmin, session.user.email]);

  const corretorAtivo = isAdmin ? selectedCorretor : session.user.email;

  const diasDoMes = useMemo(() => {
    const ano = refDate.getFullYear();
    const mes = refDate.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const dias = [];
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      dias.push(new Date(ano, mes, d));
    }
    return dias;
  }, [refDate]);

  const postsPorDia = useMemo(() => {
    const map = {};
    posts
      .filter((p) => p.corretor_email === corretorAtivo)
      .forEach((p) => {
        if (!map[p.data]) map[p.data] = [];
        map[p.data].push(p);
      });
    return map;
  }, [posts, corretorAtivo]);

  function abrirNovo(date) {
    if (!corretorAtivo) return;
    setForm({ corretor_email: corretorAtivo, data: toISODate(date), tipo: "feed", tema: "", legenda: "", status: "ideia" });
    setModalDate(toISODate(date));
  }

  function abrirPost(post) {
    setForm(post);
    setModalDate(post.data);
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
    if (form.id) {
      await supabase.from("instagram_posts").delete().eq("id", form.id);
    }
    setModalDate(null);
    fetchPosts();
  }

  if (!loaded) return <div style={{ padding: 40, color: "#6B7280" }}>Carregando planner…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <InstagramIcon size={18} color="#8B5FBF" />
        {isAdmin && (
          <select value={selectedCorretor} onChange={(e) => setSelectedCorretor(e.target.value)} style={selectStyle}>
            <option value="">Escolha um corretor</option>
            {corretoresDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ fontWeight: 700, fontSize: 14, minWidth: 130, textAlign: "center" }}>
            {meses[refDate.getMonth()]} {refDate.getFullYear()}
          </div>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: 6 }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {isAdmin && !selectedCorretor ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", background: "#fff", borderRadius: 12, border: "1px dashed #D1D5DB" }}>
          Escolha um corretor acima para ver o planner dele.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {diasDoMes.map((date) => {
            const iso = toISODate(date);
            const postsDoDia = postsPorDia[iso] || [];
            const diaSemana = diasSemana[date.getDay()];
            return (
              <div
                key={iso}
                style={{
                  background: "#fff",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  padding: "10px 14px",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 46, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{diaSemana}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{date.getDate()}</div>
                </div>
                <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {postsDoDia.map((post) => (
                    <span
                      key={post.id}
                      onClick={() => abrirPost(post)}
                      style={{
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        color: tipoInfo(post.tipo).color,
                        background: tipoInfo(post.tipo).color + "1A",
                        padding: "4px 10px",
                        borderRadius: 20,
                      }}
                    >
                      {tipoInfo(post.tipo).label}{post.tema ? ` · ${post.tema}` : ""}
                    </span>
                  ))}
                  <button
                    onClick={() => abrirNovo(date)}
                    style={{ fontSize: 12, fontWeight: 600, color: "#0F2438", background: "#F3F4F6", border: "none", borderRadius: 20, padding: "4px 10px" }}
                  >
                    + post
                  </button>
                </div>
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
              <Field label="Tema / ideia"><input style={inputStyle} value={form.tema || ""} onChange={(e) => setForm({ ...form, tema: e.target.value })} placeholder="Ex: Tour pelo apto do Jardim Europa" /></Field>
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
