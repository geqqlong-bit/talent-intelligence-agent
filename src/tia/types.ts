export interface Client {
  id: string;
  name: string;
  industry?: string;
  status: 'active' | 'inactive';
  contract_expires?: string;
  account_owner?: string;
  webhook_url?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientPreferences {
  client_id: string;
  hard_requirements: Record<string, any>;
  rejection_patterns: any[];
  off_limits: string[];
  preferred_sources: string[];
  salary_ceiling?: number;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  client_id: string;
  title: string;
  jd_raw?: string;
  jd_diagnosis?: Record<string, any>;
  rubric?: any[];
  status: 'active' | 'closed' | 'on_hold';
  target_fee?: number;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  position_id: string;
  name: string;
  mobile?: string | null;
  email?: string | null;
  current_company?: string;
  current_title?: string;
  years_experience?: number;
  resume_text?: string;
  resume_path?: string | null;
  notes?: string | null;
  stage: 'sourcing' | 'interview' | 'eval' | 'recommended' | 'client_interview' | 'offer' | 'placed';
  stage_updated_at: string;
  ai_assessment?: Record<string, any>;
  salary_current?: number;
  salary_expected?: number;
  offer_risk?: 'none' | 'competing_offer' | 'counter_offer' | string;
  onboard_date?: string | null;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface TouchRecord {
  id: string;
  candidate_id: string;
  position_id: string;
  touch_type: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  next_action?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbWriteResult {
  [key: string]: any;
}

export interface TiaDbExecutor {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

export interface TiaRepository {
  dbQuery(sql: string, params?: any[]): Promise<any[]>;
  dbWrite(table: string, operation: 'insert' | 'update' | 'delete', data: any): Promise<any>;
  getPositionContext(positionId: string): Promise<any>;
  stageUpdate(candidateId: string, newStage: string, options?: any): Promise<any>;
  listPositions(): Promise<any[]>;
  listClients(): Promise<any[]>;
  listCandidates(positionId?: string): Promise<any[]>;
  getFunnel(positionId?: string): Promise<any[]>;
  listTouchRecords(options?: { positionId?: string, candidateId?: string, limit?: number }): Promise<any[]>;
  getCandidateProfile(candidateId: string): Promise<any>;
  findSimilarSuccessfulCandidates(options?: { positionId?: string, candidateId?: string, vector?: number[], limit?: number }): Promise<any[]>;
}

export interface RepositoryOptions {
  db: TiaDbExecutor;
  defaultWebhookUrls?: string[];
  logger?: Console;
}
