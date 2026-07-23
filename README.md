# Painel de Leads — coloque no ar em ~15 min

## Passo 1 — Banco de dados (Supabase, grátis)
1. Crie conta em https://supabase.com e crie um novo projeto.
2. No menu lateral, vá em **SQL Editor** → **New query**.
3. Cole o conteúdo do arquivo `schema.sql` (está nesta pasta) e clique em **Run**.
4. Vá em **Project Settings > API**. Copie a **Project URL** e a chave **anon public**.

## Passo 2 — Configurar o projeto
1. Renomeie o arquivo `.env.example` para `.env`.
2. Cole a URL e a chave que você copiou no passo anterior.

## Passo 3 — Testar localmente (opcional)
```
npm install
npm run dev
```
Abre em http://localhost:5173

## Passo 4 — Colocar no ar (Vercel, grátis)
Opção mais simples, sem usar linha de comando:
1. Crie uma conta em https://github.com e crie um repositório novo.
2. Suba todos os arquivos desta pasta para o repositório (pelo site do GitHub: "Add file" > "Upload files").
3. Crie conta em https://vercel.com com o mesmo login do GitHub.
4. Clique em **Add New > Project**, escolha o repositório.
5. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os mesmos valores do seu `.env`.
6. Clique em **Deploy**.

Em 1-2 minutos você recebe uma URL tipo `seu-crm.vercel.app` — esse é o endereço que você manda para seus corretores.

## Segurança — leia antes de compartilhar o link
Esse projeto está configurado para qualquer pessoa com o link e a chave "anon" ler/escrever os leads — ideal para uso interno rápido de uma equipe pequena. Isso significa:
- Não divulgue a URL publicamente (redes sociais, site).
- Se quiser login por corretor (cada um só vê os próprios leads, senha individual), me avise — dá para adicionar autenticação do Supabase por cima disso sem redesenhar o painel.

## O que já vem pronto
- Cadastro, edição e exclusão de leads
- Urgência automática (atrasado / hoje / tranquilo) baseada em "próximo contato"
- Painel de desempenho por corretor
- Atualização em tempo real: quando um corretor mexe em um lead, você vê na hora, sem recarregar a página
