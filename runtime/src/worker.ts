/** Dedicated process: cancellation terminates computation without abandoning native work in DSH. */
import { createRequire } from 'node:module'
import type { AVA as AvaClass, AVAConfig, DataSourceConfig, ExecutionOptions, Semantic } from '@antv/ava'
const { AVA } = createRequire(import.meta.url)('@antv/ava') as { AVA: typeof AvaClass }
let ava: AvaClass | undefined
process.on('message', (raw: unknown) => {
  void (async () => {
    const message = raw as { id: number; method: string; args: Record<string, unknown> }
    try {
      const args = message.args
      let value: unknown
      if (message.method === 'source') {
        ava = new AVA({ llm: { model: 'dsh-agent-query-only' }, engine: { type: 'duckdb', memoryLimit: '256MB', threads: 1, maxTempDirectorySize: '128MB', queryTimeoutMs: 20_000 }, ...args.config as Partial<AVAConfig> })
        await ava.source(args.source as DataSourceConfig)
        value = await ava.schema()
      } else {
        if (!ava) throw new Error('Dataset is not open')
        if (message.method === 'inspect') value = { schema: await ava.schema(), ...(args.profile ? { profile: await ava.profile() } : {}), semantic: await ava.semantic() }
        else if (message.method === 'semantic') value = await ava.semantic(undefined, () => args.semantic as Semantic)
        else if (message.method === 'query') value = await ava.query(String(args.sql), args.options as ExecutionOptions)
        else if (message.method === 'dispose') { await ava.dispose(); value = null }
        else throw new Error('Unsupported worker operation')
      }
      process.send?.({ id: message.id, value: value ?? null })
    } catch (error) { process.send?.({ id: message.id, error: error instanceof Error ? error.message : 'Analysis failed' }) }
  })()
})
process.on('disconnect', () => { void ava?.dispose().finally(() => process.exit()) })
