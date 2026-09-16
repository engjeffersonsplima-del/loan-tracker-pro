# Backup completo do CobraCerto (somente leitura)

Objetivo: gerar um pacote de backup dos dados atuais, sem alterar código, banco, migrações ou configurações.

## O que já foi confirmado (leitura)

Contagens reais no banco agora:

- customers: 56
- loans: 28
- payments: 10
- scheduled_messages: 11
- tabelas de auditoria antigas (cópias): audit_pre_phase1_customers 56, audit_pre_phase1_loans 28, audit_pre_phase1_payments 10, audit_pre_phase1_scheduled_messages 11
- fotos no armazenamento privado customer-photos: 4 arquivos

## O que será gerado

Pasta de backup nos seus Arquivos, com data no nome:

1. CSV por tabela (8 arquivos: as 4 principais + as 4 cópias de auditoria)
2. JSON completo com todas as tabelas em um único arquivo
3. SQL de restauração (INSERTs com os UUIDs originais, datas e valores exatos)
4. Documento de estrutura: colunas, tipos, chaves, relacionamentos e regras de acesso (RLS) existentes
5. As 4 fotos baixadas, com nome ligado ao cliente correspondente, mais uma planilha de associação foto ↔ cliente
6. Leia-me com instruções de restauração e a ordem correta de importação
7. Um arquivo ZIP com tudo, para download único

Tudo será feito apenas com consultas de leitura e download de arquivos.

## Contas de usuário

Logins, senhas e segredos não podem ser exportados — ficam na área protegida de autenticação. Serão preservados os identificadores de usuário presentes nos dados, então, após uma futura migração, cada pessoa recria a conta com o mesmo e-mail e os registros são religados por esse identificador. Nenhuma senha será acessada.

## Verificação antes de entregar

- Conferir que cada arquivo tem exatamente a quantidade de linhas esperada
- Conferir que os UUIDs originais aparecem nos CSV, JSON e SQL
- Conferir que as 4 fotos foram baixadas com tamanho maior que zero
- Listar o conteúdo do ZIP antes da entrega

## Relatório final

Ao terminar, informo: arquivos gerados, contagem por tabela, quantidade de fotos, confirmação de IDs preservados, o que não pôde ser exportado e onde baixar.

## Detalhes técnicos

- Exportação via `COPY (SELECT ...) TO STDOUT WITH CSV HEADER` por tabela; nenhuma escrita.
- Estrutura extraída de `information_schema` e `pg_policies`; migrações existentes em `supabase/migrations/` copiadas como referência.
- Fotos: listagem em `storage.objects` (bucket privado) e download por URL assinada temporária.
- Staging em `/tmp`, entrega final em Arquivos.
