import { createElement, useState, type CSSProperties, type ReactElement, type ReactNode, type Ref } from 'react'
import type {
  EntityMetaData,
  EntityPhraseSpec,
  BulletsParagraphSpec,
  HeadingParagraphSpec,
  NarrativeTextSpec,
  ParagraphSpec,
  PhraseSpec,
  SectionSpec,
  TextParagraphSpec,
} from '../protocol/narrative.ts'
import type { AvaLanguage, AvaNtvDocument } from './ava-source.ts'

export interface NtvBlockProps {
  document: AvaNtvDocument
  source: string
  settled: boolean
  rootRef?: Ref<HTMLDivElement> | undefined
  showSource?: boolean | undefined
}

function assessmentClass(phrase: EntityPhraseSpec): string {
  const assessment = phrase.metadata?.assessment
  return assessment === undefined ? '' : ` dsh-antv-ava-ntv__entity--${assessment}`
}

function signedValue(value: string, assessment: EntityMetaData['assessment']): string {
  if (assessment === 'positive' && !/^[+＋]/.test(value)) return `+${value}`
  if (assessment === 'negative' && !/^[-−]/.test(value)) return `−${value}`
  return value
}

function ratioValue(value: string, assessment: EntityMetaData['assessment']): ReactNode {
  const arrow = assessment === 'positive' ? '▲' : assessment === 'negative' ? '▼' : assessment === 'equal' ? '→' : ''
  return <>{arrow !== '' && <span className="dsh-antv-ava-ntv__arrow" aria-hidden="true">{arrow}</span>}{value}</>
}

function proportionValue(phrase: EntityPhraseSpec): ReactElement {
  const value = phrase.value ?? ''
  const percent = value.trim().endsWith('%') ? Number(value.replaceAll(',', '').replace(/%$/, '')) : undefined
  const origin = typeof phrase.metadata?.origin === 'number'
    ? phrase.metadata.origin
    : percent === undefined || !Number.isFinite(percent) ? 0 : percent / 100
  const ratio = Math.max(0, Math.min(1, origin))
  return (
    <span className="dsh-antv-ava-ntv__proportion-wrap">
      <span>{value}</span>
      <span
        className="dsh-antv-ava-ntv__proportion"
        style={{ '--daa-proportion': `${ratio * 360}deg` } as CSSProperties}
        role="img"
        aria-label={`${value} proportion`}
      />
    </span>
  )
}

function renderEntity(phrase: EntityPhraseSpec, key: string): ReactElement {
  const entityType = phrase.metadata?.entityType ?? 'other_metric_value'
  const value = phrase.value ?? ''
  let content: ReactNode = value
  if (entityType === 'delta_value') content = signedValue(value, phrase.metadata?.assessment)
  if (entityType === 'ratio_value') content = ratioValue(value, phrase.metadata?.assessment)
  if (entityType === 'proportion') content = proportionValue(phrase)
  return (
    <span
      key={key}
      className={`dsh-antv-ava-ntv__entity dsh-antv-ava-ntv__entity--${entityType}${assessmentClass(phrase)}`}
      data-entity-type={entityType}
    >
      {content}
    </span>
  )
}

function renderPhrase(phrase: PhraseSpec, key: string): ReactNode {
  if (phrase.type === 'entity') return renderEntity(phrase, key)
  if (phrase.type === 'text') {
    let content: ReactNode = phrase.value
    if (phrase.underline) content = <u>{content}</u>
    if (phrase.italic) content = <em>{content}</em>
    if (phrase.bold) content = <strong>{content}</strong>
    return <span key={key}>{content}</span>
  }
  if (phrase.type === 'escape') return <span key={key}>{phrase.value}</span>
  if (phrase.type === 'formula') return <code key={key}>{phrase.value}</code>
  if (phrase.type === 'image') return <span key={key}>{phrase.alt ?? phrase.value}</span>
  return <span key={key}>{phrase.value ?? ''}</span>
}

function renderPhrases(phrases: PhraseSpec[], prefix: string): ReactNode[] {
  return phrases.map((phrase, index) => renderPhrase(phrase, `${prefix}-${index}`))
}

function isTextParagraph(paragraph: ParagraphSpec): paragraph is TextParagraphSpec {
  return paragraph.type === 'normal'
}

function isBulletsParagraph(paragraph: ParagraphSpec): paragraph is BulletsParagraphSpec {
  return paragraph.type === 'bullets'
}

function isHeadingParagraph(paragraph: ParagraphSpec): paragraph is HeadingParagraphSpec {
  return typeof paragraph.type === 'string' && /^heading[1-6]$/.test(paragraph.type)
}

function renderParagraph(paragraph: ParagraphSpec, index: number): ReactNode {
  const key = `paragraph-${index}`
  if (isTextParagraph(paragraph)) {
    return <p key={key}>{renderPhrases(paragraph.phrases, key)}</p>
  }
  if (isBulletsParagraph(paragraph)) {
    const Tag = paragraph.isOrder ? 'ol' : 'ul'
    return (
      <Tag key={key}>
        {paragraph.bullets.map((bullet, bulletIndex) => (
          <li key={`${key}-${bulletIndex}`}>{renderPhrases(bullet.phrases, `${key}-${bulletIndex}`)}</li>
        ))}
      </Tag>
    )
  }
  if (paragraph.type === 'divider') return <hr key={key} />
  if (isHeadingParagraph(paragraph)) {
    const weight = Number(paragraph.type.slice(-1))
    const tag = `h${Math.max(1, Math.min(6, weight))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    return createElement(tag, { key }, renderPhrases(paragraph.phrases, key))
  }
  return null
}

function isStandardSection(section: SectionSpec): section is SectionSpec & { paragraphs?: ParagraphSpec[] } {
  return !('customType' in section)
}

function renderSpec(spec: NarrativeTextSpec): ReactNode {
  return (
    <>
      {spec.headline !== undefined && (
        <header className="dsh-antv-ava-ntv__headline">
          {renderPhrases(spec.headline.phrases, 'headline')}
        </header>
      )}
      {spec.sections?.map((section, sectionIndex) => isStandardSection(section) && (
        <section key={`section-${sectionIndex}`}>
          {section.paragraphs?.map((paragraph, paragraphIndex) => renderParagraph(paragraph, paragraphIndex))}
        </section>
      ))}
    </>
  )
}

function sourceLabel(language: AvaLanguage): string {
  return language === 'zh-CN' ? 'AVA NTV · 查看 DSL' : 'AVA NTV · View DSL'
}

export function NtvBlock({ document, source, settled, rootRef, showSource = true }: NtvBlockProps): ReactElement {
  const [copied, setCopied] = useState(false)
  const copySource = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div ref={rootRef} className="dsh-antv-ava-ntv-shell" data-ready="true" data-stream-state={settled ? 'settled' : 'streaming'}>
      <article className="dsh-antv-ava-ntv" lang={document.language}>{renderSpec(document.spec)}</article>
      {showSource && (
        <details className="dsh-antv-ava-ntv__source">
          <summary>{sourceLabel(document.language)}</summary>
          <div className="dsh-antv-ava-ntv__source-actions">
            <button type="button" onClick={() => void copySource()}>
              {copied ? (document.language === 'zh-CN' ? '已复制' : 'Copied') : (document.language === 'zh-CN' ? '复制 DSL' : 'Copy DSL')}
            </button>
          </div>
          <pre>{source}</pre>
        </details>
      )}
    </div>
  )
}
