import type { Register } from 'claude-code'

const TOOL = 'mcp__novo-chat-ou-aqui__propor_desvio'
const ARRANQUE_PADRAO = 45_000 // system prompt + CLAUDE.md + ferramentas de um chat novo (medido nos transcripts do imaginario em 2026-10-14; usa o 1º request, se houver)
const LIMITE_ARRANQUE = 60_000
const TOKENS_POR_ARQUIVO = 3_000
const TOKENS_POR_CARACTERE = 1 / 3.5
const CONTEXTO_GRANDE = 400_000 // acima disso, propor /compact com foco (mesmo nível do mod indicador-de-contexto)
// Opus 5.5, US$ por token, cache de 1h quente. Dados: ~/.claude/docs/custo-de-contexto.md
const LEITURA = 0.2 / 1e6 // reler o que já está no cache
const ESCRITA = 8 / 1e6 // pôr no cache o que entra pela primeira vez

type Pedido = {
  etapa: string
  depende: string
  requests: number
  arquivos: number
  resumoChars: number
  contexto: number
  arranque: number
}

type Parecer = { recomendacao: 'ficar' | 'novo chat'; aqui: number; novo: number; economia: number; motivo: string } // aqui e novo em US$

function mil(n: number): string {
  return `${Math.round(n / 1000)}k`
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`
}

// Com cache quente, ficar custa só a releitura do contexto atual a cada request.
// O chat novo paga uma vez a escrita do arranque, da passagem e dos arquivos relidos, e depois relê esse contexto menor.
// O que a própria etapa produz entra nos dois casos e fica fora da conta.
function decidir(p: Pedido): Parecer {
  const aqui = p.requests * p.contexto * LEITURA
  const briefing = Math.ceil(p.resumoChars * TOKENS_POR_CARACTERE) + 2_000
  const inicial = p.arranque + briefing + TOKENS_POR_ARQUIVO * p.arquivos
  const novo = inicial * ESCRITA + p.requests * inicial * LEITURA
  const economia = aqui > 0 ? Math.round((1 - novo / aqui) * 100) : 0
  const compactar = p.contexto >= CONTEXTO_GRANDE ? '; o contexto está grande: proponha /compact com foco antes da etapa' : ''
  if (p.depende === 'sim')
    return { recomendacao: 'ficar', aqui, novo, economia, motivo: `a etapa precisa do que só existe nesta conversa; um chat novo faria errado${compactar}` }
  if (p.depende === 'parcial' && economia >= 50)
    return { recomendacao: 'novo chat', aqui, novo, economia, motivo: 'a etapa depende em parte do contexto, mas a economia é grande: vale chat novo se o resumo de passagem cobrir decisões, arquivo:linha e armadilhas — se não cobrir, fique' }
  if (p.depende === 'parcial')
    return { recomendacao: 'ficar', aqui, novo, economia, motivo: `a etapa depende em parte do contexto e a economia de um chat novo não paga o risco de perder o que ela precisa${compactar}` }
  if (economia >= 40)
    return { recomendacao: 'novo chat', aqui, novo, economia, motivo: 'a etapa é independente e longa: reler o contexto atual em todos os requests custa mais que o arranque e a passagem de um chat novo' }
  return { recomendacao: 'ficar', aqui, novo, economia, motivo: 'a etapa é independente, mas com o cache quente reler este contexto sai mais barato (ou quase igual) que arrancar um chat novo' }
}

export const register: Register = on => {
  const contexto = { atual: 0, inicial: 0 }

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'propor_desvio',
      isDeferred: false,
      description:
        'Chame quando, no meio da tarefa, você perceber que falta uma etapa extra antes de seguir. Informe se ela depende do contexto desta conversa e quantos requests deve levar; o mod calcula o custo em token de fazê-la aqui ou em outro chat e devolve uma recomendação. \"Depende\" = ela precisa de algo que não está no código nem cabe numa passagem curta (decisão e o porquê, regra descoberta, diagnóstico). Apresente o resultado ao usuário e espere ele decidir.',
      inputSchema: {
        type: 'object',
        properties: {
          etapa: { type: 'string', description: 'A etapa extra, em uma frase.' },
          depende_do_contexto: { type: 'string', enum: ['sim', 'parcial', 'nao'], description: 'Ela precisa do que já descobrimos neste chat?' },
          requests_estimados: { type: 'integer', description: 'Quantos requests (idas ao modelo) a etapa deve levar.' },
          arquivos: { type: 'array', items: { type: 'string' }, description: 'Arquivos que ela vai ler ou editar.' },
          resumo_para_passagem: { type: 'string', description: 'O texto de passagem de bastão que você entregaria a um chat novo.' },
        },
        required: ['etapa', 'depende_do_contexto', 'requests_estimados', 'resumo_para_passagem'],
      },
    })
    return next(e)
  })

  on('session.measure', (_$, e, next) => {
    if (e.changed.includes('context') && e.context.tokens !== undefined) {
      contexto.atual = e.context.tokens
      // 1º request visto = arranque real, mas só se vier de uma sessão nova (mod carregado no meio dela vê um contexto já grande)
      if (!contexto.inicial && e.context.tokens < LIMITE_ARRANQUE) contexto.inicial = e.context.tokens
    }
    return next(e)
  })

  on('tool.call', { tool: TOOL }, ($, e) => {
    const i = e as unknown as { etapa?: string; depende_do_contexto?: string; requests_estimados?: number; arquivos?: string[]; resumo_para_passagem?: string }
    if (!contexto.atual)
      return { result: 'Sem medição do contexto ainda; não dá para comparar custos. Fique neste chat e pergunte ao usuário.' }
    const p: Pedido = {
      etapa: String(i.etapa ?? ''),
      depende: String(i.depende_do_contexto ?? 'sim'),
      requests: Math.max(1, Number(i.requests_estimados ?? 1)),
      arquivos: (i.arquivos ?? []).length,
      resumoChars: String(i.resumo_para_passagem ?? '').length,
      contexto: contexto.atual,
      arranque: contexto.inicial || ARRANQUE_PADRAO,
    }
    const v = decidir(p)
    $.ui.toast(`Etapa extra "${p.etapa.slice(0, 50)}": recomendo ${v.recomendacao.toUpperCase()} (aqui ~${usd(v.aqui)} vs novo ~${usd(v.novo)})`, { timeoutMs: 20000 })
    return {
      result: [
        `Etapa: ${p.etapa}`,
        `Contexto atual: ${mil(p.contexto)} tokens · arranque de chat novo: ~${mil(p.arranque)} · requests: ${p.requests}`,
        `Neste chat: ~${usd(v.aqui)} de releitura. Em chat novo (arranque, passagem e arquivos): ~${usd(v.novo)} (${v.economia}% a menos; negativo = chat novo sai mais caro). Valores em US$ equivalentes de API, Opus 5.5.`,
        `Recomendação: ${v.recomendacao.toUpperCase()} — ${v.motivo}.`,
        'Supõe o cache quente; depois de uma pausa de mais de 1h, ficar aqui paga a reescrita do contexto inteiro. Apresente isso ao usuário e espere a decisão dele; se ele escolher chat novo, entregue o resumo de passagem pronto para colar.',
      ].join('\n'),
    }
  })
}
