# LLM Behavior Guide

Este agente assume modelos atuais e capazes, como DeepSeek, Kimi e GPT.

Ele nao precisa reduzir o prompt ao extremo. O objetivo e manter o agente organizado, previsivel e facil de manter no OpenCode.

## Principio

```text
Assumir modelos capazes,
mas dar contratos claros.
```

## O que manter claro

- comandos humanos principais;
- quando usar cada tool;
- templates obrigatorios;
- proibicoes de UX;
- fallback quando faltar dado essencial.

## O que evitar

- explicar toda a arquitetura no fluxo diario;
- pedir ao aluno para escolher o conteudo do dia;
- inventar estado sem tool;
- mostrar metricas internas sem pedido;
- responder de forma longa quando existe template curto.

## Regra para modelos bons

Modelos bons podem raciocinar, mas ainda se beneficiam de fronteiras claras:

```text
runtime curto
docs completas
tools deterministicas
testes de consistencia
```

Nao otimize para uma LLM fraca. Otimize para nao criar ambiguidade desnecessaria.
