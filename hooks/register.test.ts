import { test, expect } from 'claude-code/testing'

const TOOL = 'mcp__novo-chat-ou-aqui__propor_desvio'
const toasts: string[] = []

const base = async ($: any, on: any, contexto?: number) => {
  toasts.length = 0
  on('session.start', () => ({ cwd: '/r' }))
  on('tool.register', () => ({ value: { tool: TOOL } }))
  on('ui.toast', (_$: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.measure', (_$: any, e: any) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/r' } as any)
  if (contexto !== undefined) await $.session.measure({ context: { tokens: contexto, window: 1_000_000, percent: 10 }, rateLimits: [], changed: ['context'] } as any)
}
const propor = ($: any, depende: string, extra: object = {}) =>
  $.tool.call({
    tool: TOOL,
    etapa: 'corrigir bug paralelo',
    depende_do_contexto: depende,
    requests_estimados: 12,
    arquivos: ['a.py', 'b.py'],
    resumo_para_passagem: 'x'.repeat(1500),
    ...extra,
  } as any)

test('independente, contexto grande e etapa longa: recomenda chat novo', async ($, on) => {
  await base($, on, 500_000)
  const r = await propor($, 'nao', { requests_estimados: 40 })
  expect(String(r.result).includes('NOVO CHAT'), String(r.result)).toBe(true)
  expect(toasts.length).toBe(1)
})

test('depende do contexto: fica, mesmo com contexto enorme, e propõe /compact', async ($, on) => {
  await base($, on, 400_000)
  const r = String((await propor($, 'sim')).result)
  expect(r.includes('FICAR') && r.includes('/compact'), r).toBe(true)
})

test('depende em parte, contexto grande e economia grande: chat novo com passagem completa', async ($, on) => {
  await base($, on, 400_000)
  const r = String((await propor($, 'parcial', { requests_estimados: 40 })).result)
  expect(r.includes('NOVO CHAT') && r.includes('passagem'), r).toBe(true)
})

test('depende em parte com contexto pequeno: fica', async ($, on) => {
  await base($, on, 60_000)
  expect(String((await propor($, 'parcial')).result).includes('FICAR')).toBe(true)
})

test('depende, contexto pequeno: fica sem propor /compact', async ($, on) => {
  await base($, on, 60_000)
  expect(String((await propor($, 'sim')).result).includes('/compact')).toBe(false)
})

test('independente mas contexto pequeno: fica', async ($, on) => {
  await base($, on, 40_000)
  expect(String((await propor($, 'nao')).result).includes('FICAR')).toBe(true)
})

test('sem medição de contexto não inventa número', async ($, on) => {
  await base($, on)
  expect(String((await propor($, 'nao')).result).includes('Sem medição')).toBe(true)
})

test('arranque medido numa sessão nova entra na conta', async ($, on) => {
  await base($, on, 30_000) // 1º request: 30k de arranque
  await $.session.measure({ context: { tokens: 200_000, window: 1_000_000, percent: 20 }, rateLimits: [], changed: ['context'] } as any)
  const r = await propor($, 'nao')
  expect(String(r.result).includes('arranque de chat novo: ~30k'), String(r.result)).toBe(true)
})

test('independente mas com economia pequena: fica', async ($, on) => {
  await base($, on, 100_000)
  // resumo de passagem enorme: o que se economiza no arranque se perde na passagem
  const r = await propor($, 'nao', { resumo_para_passagem: 'x'.repeat(200_000) })
  expect(String(r.result).includes('FICAR'), String(r.result)).toBe(true)
})

test('cache quente: independente a 180k numa etapa de 12 requests fica (reler sai mais barato que arrancar)', async ($, on) => {
  await base($, on, 180_000)
  const r = String((await propor($, 'nao')).result)
  expect(r.includes('FICAR') && r.includes('negativo'), r).toBe(true)
})

test('contexto abaixo de 400k não propõe /compact', async ($, on) => {
  await base($, on, 300_000)
  expect(String((await propor($, 'sim')).result).includes('/compact')).toBe(false)
})
