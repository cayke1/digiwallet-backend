# DigiWallet - API Nest

Esta aplicação implementa uma API para gerenciamento de uma carteira digital, permitindo que usuários realizem operações de depósito, transferência de saldo entre contas e reversão de transações.

## Funcionalidades Implementadas

A aplicação contempla os seguintes requisitos funcionais:

| Funcionalidade                          | Descrição
| --------------------------------| -----|
| Cadastro de usuários        | Registro de novos usuários com validação de dados
| Autenticação                | Controle de acesso baseado em tokens JWT
| Depósito                    | Adição de saldo à conta do usuário
| Transferência              | Transferência de valores entre contas distintas
| Reversão de transações  | Capacidade de desfazer operações de depósito ou transferência
| Validação de saldo      | Verificação de saldo suficiente antes de realizar transferências

## Tecnologias Utilizadas

| Tecnologia                          | Finalidade
| --------------------------------| ------|
| NestJS                        | Framework para construção da aplicação
| TypeScript                   | Tipagem estática
| Prisma ORM                  | Gerenciamento de acesso ao banco de dados
| PostgreSQL                  | Banco de dados relacional
| JWT                        | Mecanismo de autenticação
| Bcrypt                     | Criptografia de senhas

## Abordagem de Implementação

A solução foi estruturada seguindo os princípios de arquitetura modular, com separação clara de responsabilidades entre camadas de apresentação, lógica de negócio e persistência.

As principais decisões de implementação incluem:

- **Controle de Transações**: Todas as operações financeiras são executadas dentro de transações de banco de dados para garantir atomicidade e consistência.

- **Mecanismo de Reversão**: As reversões são implementadas através da criação de transações compensatórias, preservando o histórico completo de todas as movimentações.

- **Validações**: Verificação obrigatória de saldo disponível antes da execução de transferências, permitindo depósitos independentemente do saldo atual da conta.

## Estrutura da Solução

A aplicação é organizada em módulos funcionais que agrupam as responsabilidades relacionadas a cada domínio:

| Módulo                | Responsabilidades
| ------------------| --------------|
| Autenticação  | Cadastro, login e controle de acesso
| Carteira   | Operações de depósito, transferência e reversão
| Usuários  | Gerenciamento de informações do usuário

## Considerações de Projeto

| Aspecto de Implementação        | Abordagem Adotada
| ----------------------------| --------------|
| Segurança                | Senhas criptografadas, tokens com expiração, validação de autorização em operações financeiras
| Consistência         | Execução de operações financeiras dentro de transações de banco
| Tratamento de erros | Sistema centralizado de exceções com respostas padronizadas
| Modelagem de dados  | Estrutura que mantém histórico completo e permite rastreabilidade de todas as movimentações

## Preparação para Execução

### Pré-requisitos

- Node.js (versão 18 ou superior)
- pnpm (gerenciador de pacotes)
- PostgreSQL (versão 14 ou superior)

### 1. Instalação de Dependências

```bash
pnpm install
```

### 2. Configuração das Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Servidor
PORT=3333
NODE_ENV=development

# Banco de Dados PostgreSQL
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=sua_senha
DATABASE_NAME=digiwallet
DATABASE_URL=postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}

# JWT
JWT_SECRET=sua_chave_secreta_com_minimo_32_caracteres_aqui
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Frontend (para CORS)
FRONTEND_URL=http://localhost:3000
```

**Observações importantes:**
- `JWT_SECRET` deve ter no mínimo 32 caracteres
- `NODE_ENV` aceita os valores: `development`, `production` ou `test`
- `JWT_ACCESS_EXPIRATION` define o tempo de validade do access token (padrão: 15 minutos)
- `JWT_REFRESH_EXPIRATION` define o tempo de validade do refresh token (padrão: 7 dias)

### 3. Configuração do Banco de Dados

Execute as migrações do Prisma para criar as tabelas no banco:

```bash
# Gerar o client do Prisma
pnpm prisma generate

# Executar as migrações
pnpm prisma migrate dev
```

Para visualizar os dados no Prisma Studio (opcional):

```bash
pnpm prisma studio
```

### 4. Executando a Aplicação

#### Modo de Desenvolvimento

```bash
pnpm start:dev
```

A aplicação estará disponível em `http://localhost:3333` (ou na porta configurada em `PORT`).

#### Modo de Produção

```bash
# Build da aplicação
pnpm build

# Executar em produção
pnpm start:prod
```

### 5. Testes

```bash
# Executar todos os testes
pnpm test

# Testes com watch mode
pnpm test:watch

# Testes com coverage
pnpm test:cov

# Testes E2E
pnpm test:e2e
```

### 6. Documentação da API (Swagger)

Após iniciar a aplicação, a documentação interativa da API estará disponível em:

**Local:** `http://localhost:3333/api/docs`

**Produção:** [digiwalletapi.caykedev.com/api/docs](https://digiwalletapi.caykedev.com/api/docs)

A interface Swagger permite:
- Explorar todos os endpoints disponíveis
- Testar as requisições diretamente no navegador
- Visualizar os schemas de request/response
- Entender os códigos de status e possíveis erros

## Principais Endpoints da API

### Autenticação

| Endpoint | Método | Descrição | Autenticação |
|----------|--------|-----------|--------------|
| `/auth/register` | POST | Criar nova conta | Não |
| `/auth/login` | POST | Fazer login | Não |
| `/auth/refresh` | POST | Renovar token de acesso | Cookie |
| `/auth/logout` | POST | Encerrar sessão | JWT |

### Usuários

| Endpoint | Método | Descrição | Autenticação |
|----------|--------|-----------|--------------|
| `/users/me` | GET | Obter dados do usuário autenticado | JWT |
| `/users/email?email=exemplo@email.com` | GET | Buscar usuário por email | Não |

### Transações

| Endpoint | Método | Descrição | Autenticação |
|----------|--------|-----------|--------------|
| `/transactions/deposit` | POST | Realizar depósito | JWT + Idempotency-Key |
| `/transactions/transfer` | POST | Transferir para outro usuário | JWT + Idempotency-Key |
| `/transactions/reversal` | POST | Reverter transação | JWT + Idempotency-Key |
| `/transactions/history` | GET | Obter histórico de transações | JWT |
| `/transactions/:id` | GET | Obter transação por ID | JWT |

**Importante:** Todas as operações de transação requerem o header `idempotency-key` com no mínimo 16 caracteres para garantir idempotência.

### Exemplo de Requisição - Depósito

```bash
curl -X POST http://localhost:3333/transactions/deposit \
  -H "Content-Type: application/json" \
  -H "idempotency-key: deposit-123456789012345" \
  -H "Cookie: accessToken=seu_token_aqui" \
  -d '{
    "amount": "100.00",
    "description": "Depósito inicial"
  }'
```

### Exemplo de Requisição - Transferência

```bash
curl -X POST http://localhost:3333/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "idempotency-key: transfer-123456789012345" \
  -H "Cookie: accessToken=seu_token_aqui" \
  -d '{
    "toUserId": "uuid-destinatario",
    "amount": "50.00",
    "description": "Pagamento"
  }'
```

## Pontos de Atenção na Implementação

A solução prioriza a garantia de consistência nas operações financeiras através do uso de transações de banco de dados e implementa reversões através de movimentações compensatórias, mantendo a integridade do histórico de transações. Este modelo assegura que todas as operações sejam rastreáveis e que seja possível desfazer movimentações sem comprometer a consistência dos dados.
