# Conexão Circular — Site de Validação Integrado

Pesquisa territorial integrada do Conexão Circular, publicada na Vercel e conectada ao Supabase.

## Objetivo

Validar problemas reais de conexão entre oferta e demanda no território e construir uma linha de base sobre práticas circulares, impacto, compras locais/inclusivas e interesse em um piloto do Conexão Circular.

## Perfis pesquisados

A pesquisa possui 8 perfis:

1. Hotel, restaurante ou empresa (B2B)
2. Poder público / gestão territorial (B2G)
3. Negócio sustentável / produtor / fornecedor
4. Artista / artesão(ã)
5. Prestador(a) de serviços
6. Cooperativa / operador(a) circular
7. Agente Multiplicador Circular\n8. Consumidor(a) / turista (B2C)

As perguntas variam conforme o perfil para manter a pesquisa enxuta.

## Metodologia

A pesquisa registra uma linha de base antes da intervenção do Conexão Circular. Os dados coletados nesta etapa representam informações declaradas pelos participantes e não devem ser tratados como impacto comprovado sem acompanhamento posterior.

Dimensões observadas:
- problema/dor atual;
- frequência;
- solução utilizada hoje;
- consequência econômica ou operacional;
- práticas circulares e fluxos de materiais;
- volumes, destino, capacidade e necessidades reais de conexão;\n- orientação para impacto;
- acompanhamento de indicadores/evidências;
- interesse em testar a solução;\n- interesse comercial em vitrine, Revista, eventos, B2B/B2G e Agentes Multiplicadores.

## Backend

Supabase Edge Function:

https://cvgttvczfhoktnoineie.supabase.co/functions/v1/validation-survey

Tabelas principais:
- `validation_sessions`
- `validation_answers`
- `validation_contacts`
- `validation_events`

## Fluxo de dados

O site:
- registra consentimento;
- cria uma sessão de pesquisa;
- salva respostas progressivamente;
- permite contato opcional ao final;
- registra interesse no piloto;
- captura UTM source/campaign;
- registra eventos básicos de funil;
- envia os dados para o Supabase.

Eventos registrados:
- `profile_selected`
- `survey_started`
- `survey_completed`

## Privacidade e segurança

O navegador não possui credencial administrativa do Supabase. A gravação é realizada pela Edge Function. Dados pessoais de contato são opcionais e exigem autorização específica.

## Publicação

O repositório é conectado à Vercel. Alterações em branches geram pré-visualizações; alterações aprovadas na branch principal são publicadas em produção.
