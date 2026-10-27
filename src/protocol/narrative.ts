/** Plugin-owned narrative vocabulary. Legacy AVA fences map to this stable subset. */
export type EntityType = 'metric_name' | 'metric_value' | 'other_metric_value' | 'contribute_ratio'
  | 'delta_value' | 'ratio_value' | 'trend_desc' | 'dim_value' | 'time_desc' | 'proportion'
export interface EntityMetaData {
  entityType: EntityType
  assessment?: 'positive' | 'negative' | 'equal'
  origin?: number
}
export interface EntityPhraseSpec { type: 'entity'; value?: string; metadata?: EntityMetaData }
export type PhraseSpec = EntityPhraseSpec
  | { type: 'text'; value: string; bold?: boolean; italic?: boolean; underline?: boolean }
  | { type: 'escape' | 'formula'; value: string }
  | { type: 'image'; value: string; alt?: string }
  | { type: 'custom'; value?: string }
export interface TextParagraphSpec { type: 'normal'; phrases: PhraseSpec[] }
export interface HeadingParagraphSpec { type: 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'heading5' | 'heading6'; phrases: PhraseSpec[] }
export interface BulletItemSpec { type: 'bullet-item'; phrases: PhraseSpec[] }
export interface BulletsParagraphSpec { type: 'bullets'; isOrder: boolean; bullets: BulletItemSpec[] }
export type ParagraphSpec = TextParagraphSpec | HeadingParagraphSpec | BulletsParagraphSpec | { type: 'divider' }
export interface StandardSectionSpec { paragraphs?: ParagraphSpec[] }
export type SectionSpec = StandardSectionSpec
export interface NarrativeTextSpec {
  headline?: { type: 'headline'; phrases: PhraseSpec[] }
  sections?: SectionSpec[]
}
