-- Rode isso no SQL Editor do Supabase (Menu lateral > SQL Editor > New query)

create table leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  corretor text,
  origem text,
  imovel text,
  valor text,
  status text default 'novo',
  data_criacao date default current_date,
  proximo_contato date,
  observacoes text,
  created_at timestamptz default now()
);

-- Habilita Row Level Security
alter table leads enable row level security;

-- Política simples: qualquer pessoa com a chave anônima (seu time) pode ler e escrever.
-- Isso é adequado para uso interno de equipe pequena. NÃO deixe o link público sem senha.
create policy "Permitir tudo para o time"
on leads for all
using (true)
with check (true);

-- Habilita realtime (leads aparecem atualizados na hora para todos os corretores)
alter publication supabase_realtime add table leads;
