export type TranslationStatus = 'pending' | 'needs_update' | 'needs_review' | 'ready' | 'approved';
export type DownloadMode = 'empty' | 'fallback' | 'filled';
export type TabKey = 'entries' | 'import' | 'history';

export type ImportPreview = {
  kind: 'source' | 'target';
  shape: 'flat' | 'tree';
  incomingKeys: string[];
  incomingTotal: number;
  existingTotal: number;
  existingWithPlacements: number;
  summary: { added: number; updated: number; ignored: number };
  added: Array<{ key: string; text: string }>;
  updated: Array<{ key: string; before: string; after: string }>;
  ignored: Array<{ key: string }>;
};

export type ImportBindPlanDraft =
  | {
      mode: 'single';
      scope: 'new_only' | 'all';
      pageMode: 'existing' | 'create';
      pageId?: string;
      createPageRoute?: string;
      createPageTitle?: string;
      moduleMode: 'none' | 'existing' | 'create';
      moduleId?: string;
      createModuleName?: string;
    }
  | {
      mode: 'per_key';
      scope: 'new_only' | 'all';
      items: Array<{ key: string; pageId: string; moduleId?: string }>;
    };
