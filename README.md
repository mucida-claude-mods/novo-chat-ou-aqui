# novo-chat-ou-aqui

*"New chat or here?"* — a Claude Code mod that helps the agent decide **where an extra step should run** when one shows up in the middle of a task.

It registers a tool, `propor_desvio`. The agent calls it with the step, whether it depends on what was found in this conversation (`sim` / `parcial` / `nao`), how many requests it should take, the files it will touch and the handoff text it would give a new chat. The mod compares, in API-equivalent US$ (Opus 5.5, warm cache):

- **here**: re-reading the current context on every request;
- **new chat**: writing the startup context, the handoff and the files once, then re-reading that smaller context.

It answers with a recommendation and a toast. Quality comes first: a step that needs what only exists in this conversation always stays here. Above 400k tokens it also suggests a focused `/compact`. The agent shows the result to you and waits for your call; if you pick a new chat, it hands you the handoff text ready to paste. The tool and the answers are in Portuguese.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install novo-chat-ou-aqui --marketplace mucida-claude-mods/novo-chat-ou-aqui
```

Answer `y` to add the marketplace, then choose a scope (user scope shows it in every project).

## How it works

The current context size comes from `session.measure`; the startup size of a new chat is the first measurement of the session (or 45k by default). Prices and thresholds are constants at the top of `hooks/register.ts`. It assumes the cache is warm: after a pause longer than the cache TTL, staying here pays to rewrite the whole context.

## What it accesses

Hooks `session.start`, `session.measure` and `tool.call` (only its own tool). Calls `$.tool.register` and `$.ui.toast`. No files, processes or network.

## Development

```bash
claude plugin validate .
claude plugin test .
```

## Em português

Dá ao agente a ferramenta `propor_desvio`: quando aparece uma etapa extra no meio da tarefa, ele informa se ela depende do contexto da conversa, quantos requests deve levar e o texto de passagem. O mod compara o custo em token de fazê-la aqui ou num chat novo e recomenda. Se a etapa precisa do que só existe nesta conversa, a recomendação é ficar. Acima de 400k sugere `/compact` com foco. O agente mostra o resultado e espera você decidir.

## More mods by the same author / Mais mods do mesmo autor

All in one place: **[github.com/mucida-claude-mods](https://github.com/mucida-claude-mods)**

| Mod | What it does |
| --- | --- |
| [warm-me](https://github.com/mucida-claude-mods/warm-me) | Pixel-art fire showing whether the prompt cache is still warm |
| [critical-decisions](https://github.com/mucida-claude-mods/critical-decisions) | Shows the critical decisions the agent made without asking |
| [indicador-de-contexto](https://github.com/mucida-claude-mods/indicador-de-contexto) | Warns when to split or compact the chat (250k / 400k) |
| [novo-chat-ou-aqui](https://github.com/mucida-claude-mods/novo-chat-ou-aqui) | Should this extra step run here or in a new chat? |
| [pendencias](https://github.com/mucida-claude-mods/pendencias) | Chats that ended waiting on you |
| [telinha-mcp](https://github.com/mucida-claude-mods/telinha-mcp) | Which MCP the agent just called, in plain words |
| [faixa-de-terreno](https://github.com/mucida-claude-mods/faixa-de-terreno) | Branch, issue, dirty files and commits ahead of main |

## License

MIT
