/*
  # Add automatic updated_at trigger

  ## Overview
  Adds a trigger to automatically update the updated_at timestamp whenever a survey_reports record is modified.

  ## Changes
  1. Creates a reusable function to update the updated_at column
  2. Adds a trigger to the survey_reports table that calls this function before each update

  ## Notes
  - This ensures the updated_at field is always accurate without manual intervention
  - The function is reusable for other tables if needed in the future
*/

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_survey_reports_updated_at ON survey_reports;

CREATE TRIGGER update_survey_reports_updated_at
  BEFORE UPDATE ON survey_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();