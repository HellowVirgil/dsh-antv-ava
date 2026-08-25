import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { describe, expect, it } from 'vitest'
import * as Plugin from '../src/plugin/index.ts'

async function createContext(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Plugin)
  return ctx
}

describe('host plugin', () => {
  it('teaches the ava fence, field schema, and supported purposes', async () => {
    const ctx = await createContext()
    const prompt = await ctx.systemPrompt.assemble({})
    const section = prompt.sections.find(item => item.name === 'antv-ava:fence')
    expect(section).toBeDefined()
    const text = typeof section?.text === 'string' ? section.text : ''
    expect(text).toContain('```ava')
    for (const value of ['categorical', 'quantitative', 'dimension', 'measure', 'Comparison', 'Trend']) {
      expect(text).toContain(value)
    }
    expect(text).toContain('Do not invent numbers')
  })

  it('registers the lazy asset route even when webServer binds later', async () => {
    const ctx = await createContext()
    const routes: unknown[] = []
    ctx.provide('webServer', { register: (route: unknown) => routes.push(route) })
    expect(routes).toEqual([
      expect.objectContaining({
        kind: 'prefix',
        path: '/plugins/dsh-antv-ava/assets',
      }),
    ])
  })
})
