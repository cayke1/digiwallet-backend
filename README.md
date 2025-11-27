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

Para disponibilizar a aplicação em funcionamento, são necessários os seguintes passos:

1. Configuração das variáveis de ambiente
2. Aplicação das migrações do banco de dados
3. Inicialização da aplicação

A documentação da API está disponível através da interface Swagger, permitindo a exploração e teste de todos os endpoints disponíveis.

## Pontos de Atenção na Implementação

A solução prioriza a garantia de consistência nas operações financeiras através do uso de transações de banco de dados e implementa reversões através de movimentações compensatórias, mantendo a integridade do histórico de transações. Este modelo assegura que todas as operações sejam rastreáveis e que seja possível desfazer movimentações sem comprometer a consistência dos dados.
