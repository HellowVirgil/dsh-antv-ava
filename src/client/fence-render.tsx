import {
  Component,
  useLayoutEffect,
  useRef,
  useState,
  type ErrorInfo,
  type Key,
  type ReactNode,
} from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { AvaBlock } from './AvaBlock.tsx'
import { parseAvaSource, type AvaParseResult } from './ava-source.ts'

export interface AvaFenceContext {
  readonly source?: {
    readonly id: string
    readonly order: readonly [number, number, number]
  }
}

class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[dsh-antv-ava] renderer failed:', error.message, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return <div className="dsh-antv-ava__error" role="alert">AVA 渲染器发生异常，请展开 DSL 检查内容或重新生成。</div>
    }
    return this.props.children
  }
}

function FenceFallback({ raw, reason }: { raw: string; reason?: string | undefined }): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null)
  const [settled, setSettled] = useState(false)
  useLayoutEffect(() => {
    const node = ref.current
    if (node !== null && node.closest('[data-streaming]') === null) setSettled(true)
  }, [raw])
  return (
    <div ref={ref}>
      {settled && reason !== undefined && (
        <div className="dsh-antv-ava__error" role="alert">AVA fence 无法渲染：{reason}</div>
      )}
      <CodeBlock code={`${raw}\n`} lang="ava" />
    </div>
  )
}

export function renderAvaFenceNode(raw: string, key: Key, settled: boolean, supplied?: AvaParseResult): ReactNode | null {
  const parsed = supplied ?? parseAvaSource(raw, settled)
  if (!parsed.ok) {
    if (!settled) return null
    return <FenceFallback key={key} raw={raw} reason={parsed.reason} />
  }
  return (
    <RenderBoundary key={key}>
      <AvaBlock source={raw} settled={settled} parsed={parsed} />
    </RenderBoundary>
  )
}

export function renderAvaFence(raw: string, key: Key, context?: AvaFenceContext): ReactNode {
  const settled = context?.source !== undefined
  const parsed = parseAvaSource(raw, settled)
  if (!parsed.ok) return <FenceFallback key={key} raw={raw} reason={parsed.reason} />
  return (
    <RenderBoundary key={context?.source?.id ?? key}>
      <AvaBlock source={raw} settled={settled ? true : undefined} parsed={parsed} parsedSettled={settled} />
    </RenderBoundary>
  )
}
