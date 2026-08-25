/**
 * DSH host half: teach the model the `ava` fence and expose the lazy AVA/G2
 * browser bundle through the host web server when that optional service
 * becomes available.
 */
import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'

export const AVA_SECTION_ORDER = 107

export const AVA_SECTION_TEXT = `You can turn quantitative facts in text into an inline AntV AVA visual analysis by emitting one fenced block tagged \`ava\`. AVA recommends the chart and extracts data insights; the body uses this line-based DSL:

\`\`\`ava
ava
title AI 产品各阶段投入产出
description 从需求文本中提取的阶段性数据
purpose Comparison
language zh-CN
fields
  - id stage
    label 阶段
    type categorical
    role dimension
  - id input
    label 投入
    type quantitative
    role measure
  - id output
    label 产出
    type quantitative
    role measure
data
  - stage 调研
    input 20
    output 5
  - stage 原型
    input 45
    output 32
  - stage 上线
    input 80
    output 120
\`\`\`

Use it when the source text contains real comparable quantities, a time series, rankings, proportions, distributions, or correlations. First interpret the text, then encode only facts supported by it. Do not invent numbers merely to make a chart. Use ordinary prose or \`infographic\` for qualitative-only structure.

Rules:
- The first body line is exactly \`ava\`; use exactly two spaces per nesting level.
- Optional metadata: \`title\`, \`description\`, \`purpose\`, and \`language\`.
- \`purpose\` is one of Comparison, Trend, Distribution, Rank, Proportion, or Composition.
- Field ids use ASCII identifiers. Field types are categorical, quantitative, or temporal; roles are dimension or measure.
- Use 2–12 fields and normally 3–50 rows. Quantitative values must be numbers without units; put units in field labels.
- Preserve the user's language. Keep any explanation outside the fence short because the plugin displays AVA's chart recommendation and detected insights.
- Never include secrets, executable markup, javascript/file URLs, localhost/private-network URLs, or facts not supported by the source text.`

const ASSET_ROUTE_PATH = '/plugins/dsh-antv-ava/assets'

async function serveAvaAsset(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    res.end()
    return
  }
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://dsh.local').pathname)
  } catch {
    res.writeHead(400)
    res.end()
    return
  }
  if (pathname !== `${ASSET_ROUTE_PATH}/ava.js`) {
    res.writeHead(404)
    res.end()
    return
  }
  try {
    const path = fileURLToPath(new URL('./assets/ava.js', import.meta.url))
    const body = await readFile(path)
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    })
    if (req.method === 'HEAD') res.end()
    else res.end(body)
  } catch {
    res.writeHead(404)
    res.end()
  }
}

export const inject = ['systemPrompt']

export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'antv-ava:fence',
    order: AVA_SECTION_ORDER,
    text: AVA_SECTION_TEXT,
  })

  let registered = false
  const registerAssetRoute = (provided?: { register(route: unknown): unknown }): void => {
    if (registered) return
    const webServer = provided ?? ctx.reflect.get('webServer', false) as { register(route: unknown): unknown } | undefined
    if (webServer === undefined) return
    webServer.register({
      kind: 'prefix',
      path: ASSET_ROUTE_PATH,
      handler: serveAvaAsset,
    })
    registered = true
  }
  registerAssetRoute()
  ctx.on('internal/service', (name: string, value: unknown) => {
    if (name === 'webServer') registerAssetRoute(value as { register(route: unknown): unknown })
  })
}
