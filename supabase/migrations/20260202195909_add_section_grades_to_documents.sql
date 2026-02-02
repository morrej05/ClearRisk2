/*
  # Add Section Grades to Documents

  1. Changes
    - Add `section_grades` JSONB column to documents table
    - Used for Risk Engineering assessments to store section-level grades (1-5 scale)
    - Enables overall grade calculation across multiple RE modules

  2. Structure
    - fire_protection: number (1-5)
    - construction: number (1-5)
    - occupancy: number (1-5)
    - management: number (1-5)
    - natural_hazards: number (1-5)
    - utilities: number (1-5)
    - process_risk: number (1-5)
    - [other sections as needed]
*/

-- Add section_grades column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS section_grades JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN documents.section_grades IS 'Section-level quality grades (1-5 scale) for Risk Engineering assessments. Used to calculate overall property grade.';
