/*
  # Add Executive Summary Fields to Documents

  1. New Columns
    - `executive_summary_ai` (text, nullable)
      - AI-generated executive summary content
      - Generated on demand via Edge Function
      - Never auto-generates, manual trigger only
      - 300-500 words, professional, non-technical tone
    
    - `executive_summary_author` (text, nullable)
      - Optional author-written summary/commentary
      - Fully editable by document editors
      - Can supplement or replace AI summary
      - Never overwritten by AI generation
    
    - `executive_summary_mode` (text, not null, default 'ai')
      - Controls which summary appears in reports
      - Options: 'ai', 'author', 'both', 'none'
      - 'ai': Show only AI summary
      - 'author': Show only author summary
      - 'both': Show AI first, then author commentary
      - 'none': Omit executive summary section entirely

  2. Versioning Behavior
    - On create new version: All summary fields clear
    - Mode resets to 'ai' (default)
    - Previous versions retain summaries as locked

  3. Report Integration
    - Appears immediately after title page
    - Locked on issue (immutable with rest of document)
    - Included in all report types: FRA, DSEAR/Explosion, FSD

  4. Permissions
    - Only editors can generate AI summary
    - Only editors can edit author summary
    - Viewers see read-only content
    - Follows existing document RLS policies

  5. Business Rules
    - AI summary never overwrites author text
    - Manual generation only (no auto-generation)
    - Both summaries locked on document issue
    - No per-paragraph toggles or complexity
    - No jurisdiction-specific prompts (future enhancement)
*/

-- Add executive summary columns to documents table
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS executive_summary_ai text,
  ADD COLUMN IF NOT EXISTS executive_summary_author text,
  ADD COLUMN IF NOT EXISTS executive_summary_mode text 
    DEFAULT 'ai' 
    CHECK (executive_summary_mode IN ('ai', 'author', 'both', 'none'));

-- Add index for queries filtering by mode
CREATE INDEX IF NOT EXISTS idx_documents_executive_summary_mode 
  ON documents(executive_summary_mode) 
  WHERE executive_summary_mode IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN documents.executive_summary_ai IS 'AI-generated executive summary (manual trigger only, 300-500 words)';
COMMENT ON COLUMN documents.executive_summary_author IS 'Optional author-written summary/commentary (supplements or replaces AI)';
COMMENT ON COLUMN documents.executive_summary_mode IS 'Controls report output: ai, author, both, or none';
