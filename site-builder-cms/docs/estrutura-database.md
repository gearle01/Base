# Estrutura do Banco de Dados (Firestore)

Este documento descreve a estrutura de coleções e documentos proposta para o banco de dados Firestore.

## Coleção: `clientes`

Armazena a configuração de cada site de cliente.

- **Documento:** `{clienteId}` (ID único para cada cliente)
  - **Campo:** `config` (Objeto): Um objeto JSON contendo toda a configuração do site, similar ao arquivo `site-config.json` exportado.
  - **Campo:** `lastUpdate` (Timestamp): Data da última atualização.

### Exemplo de Documento:

`clientes/cliente-001`

```json
{
  "config": {
    "empresaNome": "Restaurante Sabor Divino",
    "bannerTitulo": "O Sabor que Conquista",
    // ... resto da configuração
  },
  "lastUpdate": "2025-10-10T10:00:00Z"
}
```

## Coleção: `templates`

Armazena os templates pré-definidos que podem ser carregados no painel.

- **Documento:** `{templateId}` (ex: `restaurante`, `loja`)
  - **Campo:** `data` (Objeto): Um objeto JSON com a configuração do template.

### Exemplo de Documento:

`templates/restaurante`

```json
{
  "data": {
    "empresaNome": "Restaurante Sabor Divino",
    // ... resto da configuração do template
  }
}
```
