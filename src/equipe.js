// Equipe: cada pessoa com o nome completo e o(s) e-mail(s) de login.
// É daqui que sai o nome que aparece sozinho nos leads.
export const EQUIPE = [
  { nome: "Gabrielle Silva", emails: ["imoveiszonasul21@gmail.com"], admin: true },
  { nome: "Ana Paula Mendes", emails: ["imoveiscomanasouza@gmail.com"] },
  { nome: "Henrique Tavares", emails: ["tavares_r3@icloud.com"] },
  { nome: "Paula Cardoso", emails: ["paulacardosogml76@gmail.com", "paulagml76@gmail.com"] },
  { nome: "Diego Rocco", emails: ["diegoroccco@hotmail.com"] },
  { nome: "Cristina Maranhão", emails: ["araujocristina.rj@gmail.com"] },
  { nome: "Daniela Cazimi", emails: ["daniela.l.machado@gmail.com"] },
];

const norm = (s) =>
  (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Descobre quem é o corretor de um registro (pelo e-mail; se não der, pelo nome)
export function membroDe({ corretor, corretor_email } = {}) {
  const e = norm(corretor_email);
  if (e) {
    const porEmail = EQUIPE.find((m) => m.emails.some((x) => norm(x) === e));
    if (porEmail) return porEmail;
  }
  const n = norm(corretor);
  if (!n) return null;
  const primeiro = n.split(/\s+/)[0];
  return (
    EQUIPE.find((m) => norm(m.nome) === n) ||
    EQUIPE.find((m) => norm(m.nome).startsWith(n) || n.startsWith(norm(m.nome))) ||
    EQUIPE.find((m) => norm(m.nome).split(/\s+/)[0] === primeiro) ||
    null
  );
}

// Nome padronizado para mostrar (ou o que estiver escrito, se não for da equipe)
export function nomeCanonico(registro) {
  const m = membroDe(registro);
  return m ? m.nome : registro?.corretor || registro?.corretor_email || "Sem corretor";
}

export function nomePorEmail(email) {
  return membroDe({ corretor_email: email })?.nome || email;
}
