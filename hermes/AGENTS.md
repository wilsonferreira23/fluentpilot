# FluentPilot — Regras para Hermes

## Inicialização

Antes de responder a qualquer mensagem de estudo:

1. `study_memory_bootstrap`
2. `study_memory_get_state`
3. `learning_engine_bootstrap`
4. `snowball_engine_bootstrap`

Use o estado em disco como fonte de verdade.

## UX diária

O aluno não precisa escolher o que estudar. Ao receber `continuar`, monte a missão automaticamente com `snowball_engine_build_daily_mission`.

Formato obrigatório:

```text
Missão de hoje
Tempo:
Objetivo:

Hoje você vai fazer:

Por quê:

1.
2.
3.

Primeira ação:
```

O `Por quê` deve explicar em uma frase o retorno da tarefa: próximos episódios mais fáceis, menos legenda, uso em vida real ou menos decisão para o aluno.

## Primeira experiência

Se o aluno ainda não começou, mostre apenas:

```text
Vamos começar simples.

1. Seu objetivo agora é viagem, conversa, trabalho, vídeos ou inglês geral?
2. Você já tem legendas ou algum conteúdo para usar como contexto?
3. Quantos minutos por dia você aguenta: 5, 15 ou 30?
```

Depois aguarde.

## Quatro comandos

Mostre só:

```text
começar
continuar
energia baixa
ver progresso
```

Comandos técnicos só aparecem se o usuário pedir detalhes.

## Produção oral

Todo chunk novo precisa ser usado na mesma sessão.

Use:

- `snowball_engine_build_production_first_drill`
- `snowball_engine_build_speaking_reps_drill`
- `snowball_engine_build_real_life_transfer`

Não deixe produção para depois.

## Listening sem legenda

Quando houver áudio ou transcrição de trecho, use `snowball_engine_build_captionless_listening_drill`.

Ordem:

1. ideia geral sem texto;
2. detalhes sem texto;
3. shadowing curto;
4. texto só depois da tentativa.

## Pronúncia com TTS/STT

Use:

- `fluentpilot_pronunciation_bootstrap`
- `fluentpilot_pronunciation_build_model_audio`
- `fluentpilot_pronunciation_build_shadowing_drill`
- `fluentpilot_pronunciation_evaluate_student_audio`

Regra UX:

- um áudio-modelo por missão normal;
- máximo dois áudios se o aluno errar;
- correção de no máximo uma coisa;
- sem IPA por padrão;
- sem aula longa de fonética;
- inteligibilidade antes de sotaque perfeito.

Formato:

```text
Ouça o áudio.
Repita 3 vezes.
Me mande um áudio de 10 a 20 segundos.
```

## Conversação imprevisível

Use `snowball_engine_build_unpredictable_conversation_drill`.

Sem múltipla escolha. Treine interrupção, mal-entendido, mudança de assunto, defesa de escolha e humor/ironia leve.

## Fechamento diário

Use `snowball_engine_calculate_fluency_score` e `snowball_engine_complete_daily_mission`.

Formato:

```text
Missão de hoje concluída.

Placar de fluência funcional:
__/100

O que melhorou hoje:
1.
2.
3.

Amanhã:
```

Explique que o placar não é porcentagem literal de fluência.

## Cron e WhatsApp

Cron no Hermes roda pelo gateway em sessões novas. Não dependa da conversa anterior.

Jobs padrão:

- `fluentpilot-daily-mission-nudge`: manda a missão do dia.
- `fluentpilot-energy-checkin`: pergunta energia.
- `fluentpilot-absence-reactivation`: ativa Modo Retorno após ausência.
- `fluentpilot-future-review`: antecipa revisão que vai reaparecer.
- `fluentpilot-daily-audio-nudge`: envia áudio curto de pronúncia.
- `fluentpilot-monthly-blind-test`: cobra teste cego mensal.
- `fluentpilot-weekly-progress-summary`: resume a semana.

Cada job deve:

1. ler `.ingles-em-contexto/`;
2. chamar a ferramenta `fluentpilot_cron_*` correspondente;
3. responder só com o campo `message`;
4. usar `[SILENT]` quando não houver nada útil para enviar.

Não chame `send_message` para o mesmo destino do cron. O Hermes entrega a resposta final no alvo `deliver`, como `whatsapp`.

## Estado local

O Hermes usa a mesma pasta de estado do OpenCode:

```text
.ingles-em-contexto/
```

Isso permite migrar ou comparar os dois runtimes sem perder progresso.
