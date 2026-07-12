// ── Core domain types mirroring backend schemas ───────────────────────────────

export type BlockType = 'plain' | 'experience' | 'feedback'
export type DataType = 'qualitative' | 'quantitative'
export type DataNature = 'subjective' | 'objective'
export type Mode = 'findings' | 'suggestions' | 'baseline'
export type TensionType = 'contradiction' | 'convergence' | 'anomaly'
export type AnalysisStatus = 'queued' | 'analyzing' | 'complete' | 'error'

export interface Annotation {
  id: string
  slot_id: string
  content: string
  updated_at: string
}

export interface DataSlot {
  id: string
  block_id: string
  name: string
  data_type: DataType
  data_nature: DataNature
  // slot_kind removed — template presence is indicated by template_file_name
  template_file_name: string | null
  annotation: Annotation | null
}

export interface Block {
  id: string
  study_id: string
  type: BlockType
  label: string
  position: number
  slots: DataSlot[]
}

export interface Study {
  id: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
  blocks: Block[]
}

export interface StudySummary {
  id: string
  title: string
  description: string | null
  created_at: string
}

export interface ParticipantDataFile {
  id: string
  participant_id: string
  slot_id: string | null
  file_name: string
  custom_prompt: string | null
  included_in_analysis: boolean
  uploaded_at: string
}

export interface StudyParticipant {
  id: string
  study_id: string
  label: string
  protocol_content: string | null
  protocol_updated_at: string | null
  created_at: string
  data_files: ParticipantDataFile[]
}

export interface FileLine {
  n: number
  text: string
}

export interface FileContent {
  file_id: string
  file_name: string
  lines: FileLine[]
}

export interface Location {
  type: 'line' | 'key' | 'paragraph'
  value: number | string
}

export interface Citation {
  id: string
  finding_id: string
  file_id: string | null
  display_ref: string
  location: Location
}

export interface Finding {
  id: string
  analysis_request_id: string
  position: number
  title: string
  explanation: string
  tension_type: TensionType | null
  citations: Citation[]
}

export interface Suggestion {
  id: string
  analysis_request_id: string
  finding_id: string | null
  position: number
  description: string
  protocol_ref: string | null
}

export interface AnalysisRequest {
  id: string
  participant_id: string
  label: string
  mode: 'findings' | 'suggestions'
  status: AnalysisStatus
  custom_prompt: string | null
  position: number
  created_at: string
  completed_at: string | null
  findings: Finding[]
  suggestions: Suggestion[]
}

// ── File viewer state ─────────────────────────────────────────────────────────

export interface ViewerTarget {
  fileId: string
  fileName: string
  highlightLine?: number
  context: 'direct' | 'citation'
  citationFindingId?: string
  citationRef?: string
}
