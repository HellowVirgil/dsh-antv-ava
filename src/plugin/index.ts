/**
 * DSH host half: teach the model the `ava` fence and expose the lazy AVA/GPT-Vis
 * browser bundle through the host web server when that optional service
 * becomes available.
 */
import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'

export const AVA_SECTION_ORDER = 107

export const AVA_SECTION_TEXT = `When quantitative content benefits from visual interpretation, emit one fenced block tagged \`ava\` and decide the useful presentation automatically. Do not ask the user to choose a mode and do not require an explicit mode keyword.

Choose the contents by communication value:
- Use \`narrative\` for KPI summaries, period-over-period changes, shares, ranked category breakdowns, or compact analytical reports where readable conclusions matter most.
- Use both \`narrative\` and \`chart\` when a trend, distribution, comparison, ranking, correlation, or composition becomes materially clearer with visual shape. Put \`narrative\` first so completed phrase lines stream immediately; GPT-Vis then grows the chart as complete data lines arrive.
- Use only \`chart\` when the user explicitly asks for a conventional chart or the chart itself is the answer and additional narrative would be redundant.

The unified safe line-based DSL is:

\`\`\`ava
ava
language zh-CN
narrative
  headline 本月订单保持增长
  paragraph
    metric-name 订单总量
    metric-value 1.98亿
    text ，同比上月同期增加
    delta positive 1,302.76万
    text ，增长
    ratio positive 7.05%
  heading 2 品类结构
  bullet
    dimension 办公用品：
    metric-value 1.59亿
    text ，占比
    proportion 80.47%
chart
  vis column
  data
    - category 办公用品
      value 15900
    - category 家具
      value 3507.16
  title "各品类订单规模"
  axisXTitle 品类
  axisYTitle "订单量（万）"
\`\`\`

The plugin infers the result from section presence: \`narrative\` only renders NTV, \`narrative\` plus \`chart\` renders both in one conversation-native flow, and \`chart\` only renders a chart. Narrative maps to AVA's NarrativeTextSpec and completed phrase lines render progressively. Chart content is official GPT-Vis syntax; complete data lines are rendered incrementally without waiting for the fence to finish. Use concise ordinary prose outside the fence only when context does not belong in the visual answer.

Narrative rules:
- The first body line is \`ava\`. Top-level \`language\` is optional. Add a \`narrative\` section and indent its contents by two spaces.
- Inside \`narrative\`, use optional \`headline\`, \`heading 1..6 <text>\`, \`paragraph\`, \`bullet\`, \`section\`, or \`divider\`.
- Under a narrative \`paragraph\` or \`bullet\`, indent four spaces from the fence root and use one phrase per line: \`text\`, \`strong\`, \`metric-name\`, \`metric-value\`, \`other-value\`, \`dimension\`, \`time\`, \`contribution\`, \`proportion\`, \`trend\`, \`delta <positive|negative|equal>\`, or \`ratio <positive|negative|equal>\`.
- Use \`metric-name\` for labels, \`metric-value\` for primary values, \`delta\` for absolute changes, \`ratio\` for change rates, and \`proportion\` for a displayed percentage with an inline share micro-visualization.
- Assessment describes semantic direction, not desirability: growth/up is \`positive\`, decline/down is \`negative\`, unchanged is \`equal\`.
- Preserve natural punctuation and spaces inside \`text\` phrases. Encode only facts supported by the source; never invent missing values.

Chart rules:
- Add a \`chart\` section, indent the complete GPT-Vis syntax by two spaces, and start it with \`vis <chart-type>\`.
- Prefer \`line\` or \`area\` for trends, \`column\` or \`bar\` for comparisons and rankings, \`pie\` for a small part-to-whole composition, \`scatter\` for correlation, \`histogram\`/\`boxplot\`/\`violin\` for distributions, and \`table\` when exact lookup matters more than shape. Other supported types include \`radar\`, \`funnel\`, \`waterfall\`, \`dual-axes\`, \`treemap\`, \`sankey\`, \`venn\`, \`liquid\`, and \`word-cloud\`.
- Put \`data\` before display properties so the first complete item can render early. Use \`-\` for array items, two additional spaces for item properties, and quote values containing spaces.
- Follow GPT-Vis field schemas exactly: \`line/area\` use \`time,value[,group]\`; \`column/bar/pie/funnel/boxplot/violin\` use \`category,value[,group]\`; \`scatter\` uses \`x,y[,group]\`; \`radar\` uses \`name,value[,group]\`; \`sankey\` uses \`source,target,value\`; \`treemap\` uses \`name,value[,children]\`; \`word-cloud\` uses \`text,value\`; \`histogram\` uses a simple numeric array; and \`table\` may use descriptive column keys.
- Use ASCII field ids and numeric quantitative values without units. Put units in \`title\`, \`axisXTitle\`, or \`axisYTitle\`. Include a concise \`title\`, but do not emit \`theme\`, \`width\`, \`height\`, HTML, SVG, or scripts; the plugin owns layout and live theme adaptation.
- Do not repeat the same conclusion in both narrative and chart text.
- Preserve the user's language. Never include secrets, executable markup, javascript/file URLs, localhost/private-network URLs, or unsupported facts.
`

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
  if (![`${ASSET_ROUTE_PATH}/ava.js`, `${ASSET_ROUTE_PATH}/insights.js`].includes(pathname)) {
    res.writeHead(404)
    res.end()
    return
  }
  try {
    const path = fileURLToPath(new URL(`./assets/${pathname.endsWith('/insights.js') ? 'insights' : 'ava'}.js`, import.meta.url))
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
