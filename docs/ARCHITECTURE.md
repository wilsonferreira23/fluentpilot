# Arquitetura V1 Snowball

## Visão

```text
8-12 legendas futuras ─────────────┐
                                   v
                         Snowball Season Analyzer
                                   |
                                   v
                 Series Corpus + Future Value Scoring
                                   |
           ┌───────────────────────┴───────────────────────┐
           v                                               v
 Language Capital                                  Automaticity Debt
           |                                               |
           v                                               v
 Future-triggered Review                    New-item Throttle / Consolidation
           └───────────────────────┬───────────────────────┘
                                   v
                          Episode Support Ladder
                                   |
        ┌───────────────┬──────────┴──────────┬───────────────┐
        v               v                     v               v
     Deep          Semideep              Extensive        Autonomous
        |               |                     |               |
        └───────────────┴──────────┬──────────┴───────────────┘
                                   v
                    Transfer + Incidental Promotion
                                   |
                                   v
                          Flywheel Dashboard
```

## Camadas

### Tutor LLM

Responsável por:

- julgamento semântico;
- feedback;
- perguntas;
- explicações;
- adaptação humana.

### Ferramentas determinísticas

Responsáveis por:

- parsing;
- contagem;
- cobertura;
- análise de temporada;
- pontuação de valor composto;
- capital linguístico;
- dívida de automaticidade;
- revisão acionada por episódio futuro;
- agenda;
- gravação;
- métricas;
- clips.

### Estado

- memória pedagógica;
- motor de aprendizagem;
- capital linguístico;
- corpus da série;
- candidatos incidentais;
- grafo de transferência;
- dívida de automaticidade;
- histórico imutável.

## Algoritmo de seleção

Pontuação combina:

- frequência;
- dispersão;
- recorrência;
- tipo chunk;
- domínio;
- importância semântica avaliada pelo agente.

O TypeScript gera candidatos. O agente faz a seleção final.

## Algoritmo Snowball

O valor composto de um chunk combina:

- importância no episódio atual;
- recorrência em episódios futuros;
- utilidade comunicativa;
- dificuldade auditiva;
- lacuna individual.

O motor seleciona itens que aumentam compreensão agora e reduzem preparação futura.

## Escada de autonomia

- profundo: 45-70 minutos;
- semiprofundo: 20-35 minutos;
- extensivo: 5-12 minutos de preparação;
- autônomo: assistir primeiro, intervir apenas nos gargalos.

O sistema acelera quando menos conteúdo precisa ser ensinado explicitamente.

## Métricas do Flywheel

- `autonomy_ratio`;
- `compounding_rate`;
- `assistance_decay_minutes`;
- chunks automáticos;
- itens incidentais promovidos;
- dívida entre reconhecimento e produção.

## Gate de 50%

A arquitetura só pode sugerir que a meta está próxima quando:

- 25+ episódios;
- transferência ≥ 75%;
- eficiência ≥ 1,8x baseline;
- retenção de 30 dias;
- produção e compreensão sem divergência crítica.
