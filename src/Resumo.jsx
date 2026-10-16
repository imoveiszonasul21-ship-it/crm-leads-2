import React, { useState, useEffect, useMemo } from "react";
import { BarChart3, Download, Users, Footprints, KeyRound, PhoneCall } from "lucide-react";
import { supabase } from "./supabaseClient";
import { selectStyle, inputStyle } from "./shared";

const STATUS_LABEL = {
  novo: "Novo", contato: "Em contato", visita: "Visita agendada", proposta: "Proposta enviada",
  negociacao: "Negociação", fechado: "Fechado", perdido: "Perdido",
};
const POT = [
  { key: "quente", label: "Quente", color: "#D32F2F" },
  { key: "morno", label: "Morno", color: "#E6A700" },
  { key: "frio", label: "Frio", color: "#2F7FD8" },
];
const CAPT_STATUS = [
  { key: "buscando", label: "Buscando", color: "#4A6FA5" },
  { key: "em_captacao", label: "Em captação", color: "#D98B3B" },
  { key: "captado", label: "Captado", color: "#2F7A5C" },
  { key: "exclusividade", label: "Exclusividade", color: "#8B5FBF" },
  { key: "perdida", label: "Perdida", color: "#9CA3AF" },
];
const METRICAS = [
  { key: "visitas", label: "Visitas" },
  { key: "placas", label: "Placas" },
  { key: "exclusividades", label: "Exclusividades" },
  { key: "chaves", label: "Chaves" },
  { key: "apartamentos_captados", label: "Captações" },
  { key: "contatos_clientes_novos", label: "Clientes novos" },
  { key: "contatos_followup", label: "Follow-up" },
  { key: "ligacoes_proprietarios", label: "Proprietários" },
];

const iso = (d) => d.toLocaleDateString("en-CA");
const fmt = (s) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "");

function periodo(tipo, ini, fim) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dow = (hoje.getDay() + 6) % 7; // segunda = 0
  const segunda = new Date(hoje); segunda.setDate(hoje.getDate() - dow);
  if (tipo === "semana") { const f = new Date(segunda); f.setDate(f.getDate() + 6); return [iso(segunda), iso(f)]; }
  if (tipo === "semana_passada") {
    const i = new Date(segunda); i.setDate(i.getDate() - 7);
    const f = new Date(segunda); f.setDate(f.getDate() - 1);
    return [iso(i), iso(f)];
  }
  if (tipo === "mes") return [iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))];
  if (tipo === "mes_passado") return [iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0))];
  return [ini, fim];
}

function baixarCSV(nome, cabecalho, linhas) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const texto = [cabecalho, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Resumo() {
  const [leads, setLeads] = useState([]);
  const [ativ, setAtiv] = useState([]);
  const [capt, setCapt] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tipo, setTipo] = useState("semana");
  const [ini, setIni] = useState(iso(new Date()));
  const [fim, setFim] = useState(iso(new Date()));
  const [metrica, setMetrica] = useState("visitas");

  async function carregar() {
    const [l, a, c] = await Promise.all([
      supabase.from("leads").select("*"),
      supabase.from("atividades_diarias").select("*"),
      supabase.from("captacoes").select("*"),
    ]);
    setLeads(l.data || []); setAtiv(a.data || []); setCapt(c.data || []);
    setLoaded(true);
  }
  useEffect(() => { carregar(); }, []);

  const [de, ate] = periodo(tipo, ini, fim);
  const chaveDe = (x) => (x.corretor_email || x.corretor || "sem corretor").toLowerCase();

  const nomes = useMemo(() => {
    const cont = {};
    leads.forEach((l) => {
      const k = chaveDe(l);
      if (l.corretor) { cont[k] = cont[k] || {}; cont[k][l.corretor] = (cont[k][l.corretor] || 0) + 1; }
    });
    const m = {};
    Object.entries(cont).forEach(([k, nomesK]) => (m[k] = Object.entries(nomesK).sort((a, b) => b[1] - a[1])[0][0]));
    return m;
  }, [leads]);
  const nomeDe = (k) => nomes[k] || k;

  const dados = useMemo(() => {
    const hoje = iso(new Date());
    const por = {};
    const get = (k) => (por[k] = por[k] || {
      carteira: 0, novos: 0, quente: 0, morno: 0, frio: 0, semPot: 0, atrasados: 0, fechados: 0,
      captacoes: 0, capTotal: 0, atividadesTotal: 0,
      ...Object.fromEntries(CAPT_STATUS.map((x) => ["cap_" + x.key, 0])), ...Object.fromEntries(METRICAS.map((m) => [m.key, 0])),
    });
    leads.forEach((l) => {
      const p = get(chaveDe(l));
      const ativo = l.status !== "fechado" && l.status !== "perdido";
      if (ativo) {
        p.carteira++;
        if (POT.some((x) => x.key === l.potencia)) p[l.potencia]++; else p.semPot++;
        if (!l.proximo_contato || l.proximo_contato < hoje) p.atrasados++;
      }
      if (l.status === "fechado" && l.data_criacao >= de && l.data_criacao <= ate) p.fechados++;
      if (l.data_criacao && l.data_criacao >= de && l.data_criacao <= ate) p.novos++;
    });
    capt.forEach((c) => {
      const pc = get(chaveDe(c));
      pc.capTotal++;
      pc["cap_" + (c.status || "buscando")] = (pc["cap_" + (c.status || "buscando")] || 0) + 1;
      if (c.data_criacao && c.data_criacao >= de && c.data_criacao <= ate) get(chaveDe(c)).captacoes++;
    });
    ativ.forEach((r) => {
      if (r.data >= de && r.data <= ate) {
        const p = get(chaveDe(r));
        METRICAS.forEach((m) => { p[m.key] += r[m.key] || 0; p.atividadesTotal += r[m.key] || 0; });
      }
    });
    return por;
  }, [leads, ativ, capt, de, ate]);

  const corretores = Object.keys(dados).sort((a, b) => dados[b].carteira - dados[a].carteira);
  const soma = (f) => corretores.reduce((acc, k) => acc + f(dados[k]), 0);
  const maxCarteira = Math.max(1, ...corretores.map((k) => dados[k].carteira));
  const maxCapt = Math.max(1, ...corretores.map((k) => dados[k].capTotal));
  const maxMetrica = Math.max(1, ...corretores.map((k) => dados[k][metrica]));

  const origens = useMemo(() => {
    const o = {};
    leads.filter((l) => l.data_criacao >= de && l.data_criacao <= ate).forEach((l) => { const k = l.origem || "Não informada"; o[k] = (o[k] || 0) + 1; });
    return Object.entries(o).sort((a, b) => b[1] - a[1]);
  }, [leads, de, ate]);
  const maxOrigem = Math.max(1, ...origens.map((x) => x[1]));

  function exportarLeads(todos) {
    const lista = leads
      .filter((l) => todos || (l.data_criacao >= de && l.data_criacao <= ate))
      .sort((a, b) => (nomeDe(chaveDe(a)) + a.data_criacao).localeCompare(nomeDe(chaveDe(b)) + b.data_criacao));
    const cab = ["Data", "Corretor", "Cliente", "Contato", "Endereço do imóvel", "Origem", "Tipo de negócio", "Valor", "Potência", "Situação", "Último contato", "Próximo contato", "Visitas", "Observações"];
    const linhas = lista.map((l) => {
      const vs = Array.isArray(l.visitas) && l.visitas.length ? l.visitas : (l.data_visita || l.imovel_visitado ? [{ data: l.data_visita, imovel: l.imovel_visitado }] : []);
      return [
        fmt(l.data_criacao), l.corretor, l.nome, l.telefone, l.imovel, l.origem, l.tipo_negocio, l.valor,
        POT.find((p) => p.key === l.potencia)?.label || "", STATUS_LABEL[l.status] || l.status,
        fmt(l.ultimo_contato), fmt(l.proximo_contato),
        vs.map((v) => `${fmt(v.data)} ${v.imovel || ""}`.trim()).join(" | "), l.observacoes,
      ];
    });
    baixarCSV(todos ? "leads-todos.csv" : `leads-${de}-a-${ate}.csv`, cab, linhas);
  }

  function exportarCaptacoes(todas) {
    const lista = capt
      .filter((c) => todas || (c.data_criacao >= de && c.data_criacao <= ate))
      .sort((a, b) => (nomeDe(chaveDe(a)) + a.data_criacao).localeCompare(nomeDe(chaveDe(b)) + b.data_criacao));
    const cab = ["Data", "Corretor", "Endereço", "Tipo de imóvel", "Valor", "Situação", "Proprietário", "Contato do proprietário", "Observações"];
    const linhas = lista.map((c) => [
      fmt(c.data_criacao), c.corretor || nomeDe(chaveDe(c)), c.endereco, c.tipo_imovel, c.valor,
      CAPT_STATUS.find((x) => x.key === c.status)?.label || c.status, c.proprietario_nome, c.proprietario_contato, c.observacoes,
    ]);
    baixarCSV(todas ? "captacoes-todas.csv" : `captacoes-${de}-a-${ate}.csv`, cab, linhas);
  }

  function exportarAtividades() {
    const lista = ativ.filter((r) => r.data >= de && r.data <= ate)
      .sort((a, b) => (nomeDe(chaveDe(a)) + a.data).localeCompare(nomeDe(chaveDe(b)) + b.data));
    const cab = ["Data", "Corretor", "Ruas de pente fino", ...METRICAS.map((m) => m.label), "Imóveis atualizados", "Observações"];
    const linhas = lista.map((r) => [
      fmt(r.data), nomeDe(chaveDe(r)), r.ruas_pente_fino, ...METRICAS.map((m) => r[m.key] || 0),
      (Array.isArray(r.imoveis_atualizados) ? r.imoveis_atualizados : [])
        .map((i) => `${i.endereco || ""} (venda ${i.valor_venda || "-"}; fechamento ${i.valor_fechamento || "-"}; doc ${i.documentacao || "-"}; entrega ${i.prazo_entrega || "-"})`).join(" | "),
      r.observacoes,
    ]);
    baixarCSV(`atividades-${de}-a-${ate}.csv`, cab, linhas);
  }

  if (!loaded) return <div style={{ padding: 40, color: "#6B7280" }}>Carregando resumo…</div>;

  const card = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16 };
  const btn = { display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 8, border: "1px solid #0F2438", background: "#fff", color: "#0F2438", fontWeight: 600, fontSize: 13 };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <BarChart3 size={18} color="#0F2438" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F2438" }}>Performance da equipe</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={selectStyle}>
          <option value="semana">Esta semana</option>
          <option value="semana_passada">Semana passada</option>
          <option value="mes">Este mês</option>
          <option value="mes_passado">Mês passado</option>
          <option value="custom">Escolher datas…</option>
        </select>
        {tipo === "custom" && (
          <>
            <input type="date" value={ini} onChange={(e) => setIni(e.target.value)} style={{ ...inputStyle, width: 150 }} />
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          </>
        )}
        <span style={{ fontSize: 13, color: "#6B7280" }}>{fmt(de)} a {fmt(ate)}</span>
        <button onClick={carregar} style={{ ...btn, marginLeft: "auto" }}>Atualizar</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => exportarLeads(false)} style={btn}><Download size={14} /> Leads do período (planilha)</button>
        <button onClick={() => exportarLeads(true)} style={btn}><Download size={14} /> Todos os leads (planilha)</button>
        <button onClick={() => exportarCaptacoes(false)} style={btn}><Download size={14} /> Captações do período (planilha)</button>
        <button onClick={() => exportarCaptacoes(true)} style={btn}><Download size={14} /> Todas as captações (planilha)</button>
        <button onClick={exportarAtividades} style={btn}><Download size={14} /> Atividades do período (planilha)</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { icon: Users, label: "Leads ativos (carteira)", v: soma((p) => p.carteira) },
          { icon: Users, label: "Leads novos no período", v: soma((p) => p.novos) },
          { icon: Footprints, label: "Visitas no período", v: soma((p) => p.visitas) },
          { icon: KeyRound, label: "Captações novas (aba Captações)", v: soma((p) => p.captacoes) },
          { icon: KeyRound, label: "Exclusividades na carteira", v: soma((p) => p.cap_exclusividade) },
          { icon: PhoneCall, label: "Contatos no período", v: soma((p) => p.contatos_clientes_novos + p.contatos_followup + p.ligacoes_proprietarios) },
        ].map((c) => (
          <div key={c.label} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}><c.icon size={14} /> {c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#0F2438", marginTop: 4 }}>{c.v}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: "#0F2438", marginBottom: 4 }}>Leads ativos por corretor</div>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6B7280", marginBottom: 10, flexWrap: "wrap" }}>
          {POT.map((p) => <span key={p.key} style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: "inline-block" }} />{p.label}</span>)}
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "#D1D5DB", display: "inline-block" }} />Sem potência</span>
        </div>
        {corretores.map((k) => {
          const p = dados[k];
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 140, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={nomeDe(k)}>{nomeDe(k)}</div>
              <div style={{ flex: 1, display: "flex", height: 22, background: "#F3F4F6", borderRadius: 6, overflow: "hidden" }}>
                {[...POT.map((x) => [x.color, p[x.key]]), ["#D1D5DB", p.semPot]].map(([cor, n], i) =>
                  n > 0 ? <div key={i} style={{ width: `${(n / maxCarteira) * 100}%`, background: cor }} title={`${n}`} /> : null)}
              </div>
              <div style={{ width: 130, fontSize: 12, color: "#374151", textAlign: "right" }}>
                <b>{p.carteira}</b> ativos · {p.novos} novos{p.atrasados > 0 && <span style={{ color: "#C1443C" }}> · {p.atrasados} atrasados</span>}
              </div>
            </div>
          );
        })}
        {corretores.length === 0 && <div style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhum lead cadastrado ainda.</div>}
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: "#0F2438", marginBottom: 4 }}>Captações por corretor</div>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6B7280", marginBottom: 10, flexWrap: "wrap" }}>
          {CAPT_STATUS.map((x) => <span key={x.key} style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: x.color, display: "inline-block" }} />{x.label}</span>)}
        </div>
        {corretores.map((k) => {
          const p = dados[k];
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 140, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeDe(k)}</div>
              <div style={{ flex: 1, display: "flex", height: 22, background: "#F3F4F6", borderRadius: 6, overflow: "hidden" }}>
                {CAPT_STATUS.map((x) => p["cap_" + x.key] > 0 ? <div key={x.key} style={{ width: `${(p["cap_" + x.key] / maxCapt) * 100}%`, background: x.color }} title={`${x.label}: ${p["cap_" + x.key]}`} /> : null)}
              </div>
              <div style={{ width: 170, fontSize: 12, color: "#374151", textAlign: "right" }}>
                <b>{p.capTotal}</b> no total · {p.captacoes} novas · {p.cap_exclusividade} excl.
              </div>
            </div>
          );
        })}
        {soma((p) => p.capTotal) === 0 && <div style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhuma captação cadastrada ainda.</div>}
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: "#0F2438", marginBottom: 8 }}>Atividades no período</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {METRICAS.map((m) => (
            <button key={m.key} onClick={() => setMetrica(m.key)}
              style={{ padding: "5px 11px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600,
                background: metrica === m.key ? "#0F2438" : "#F3F4F6", color: metrica === m.key ? "#fff" : "#374151" }}>
              {m.label}
            </button>
          ))}
        </div>
        {corretores.map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 140, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeDe(k)}</div>
            <div style={{ flex: 1, background: "#F3F4F6", borderRadius: 6, height: 18 }}>
              <div style={{ width: `${(dados[k][metrica] / maxMetrica) * 100}%`, background: "#2F7A5C", height: 18, borderRadius: 6 }} />
            </div>
            <div style={{ width: 40, textAlign: "right", fontWeight: 700, fontSize: 13 }}>{dados[k][metrica]}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 16, overflowX: "auto" }}>
        <div style={{ fontWeight: 700, color: "#0F2438", marginBottom: 8 }}>Tabela do período</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F5F6F8" }}>
              {["Corretor", "Leads ativos", "Novos", "Atrasados", ...METRICAS.map((m) => m.label), "Captações novas", "Captações total", "Exclusividades (captação)"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {corretores.map((k) => (
              <tr key={k} style={{ borderTop: "1px solid #E5E7EB" }}>
                <td style={{ padding: "8px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>{nomeDe(k)}</td>
                <td style={{ padding: "8px 10px" }}>{dados[k].carteira}</td>
                <td style={{ padding: "8px 10px" }}>{dados[k].novos}</td>
                <td style={{ padding: "8px 10px", color: dados[k].atrasados ? "#C1443C" : undefined }}>{dados[k].atrasados}</td>
                {METRICAS.map((m) => <td key={m.key} style={{ padding: "8px 10px" }}>{dados[k][m.key]}</td>)}
                <td style={{ padding: "8px 10px" }}>{dados[k].captacoes}</td>
                <td style={{ padding: "8px 10px" }}>{dados[k].capTotal}</td>
                <td style={{ padding: "8px 10px" }}>{dados[k].cap_exclusividade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, color: "#0F2438", marginBottom: 8 }}>De onde vieram os leads novos</div>
        {origens.length === 0 && <div style={{ color: "#9CA3AF", fontSize: 13 }}>Nenhum lead novo no período.</div>}
        {origens.map(([nome, n]) => (
          <div key={nome} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 140, fontSize: 13 }}>{nome}</div>
            <div style={{ flex: 1, background: "#F3F4F6", borderRadius: 6, height: 16 }}>
              <div style={{ width: `${(n / maxOrigem) * 100}%`, background: "#4A6FA5", height: 16, borderRadius: 6 }} />
            </div>
            <div style={{ width: 40, textAlign: "right", fontWeight: 700, fontSize: 13 }}>{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
