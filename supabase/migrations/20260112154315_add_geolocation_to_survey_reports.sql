/*
  # Add Geolocation Fields to Survey Reports

  ## Overview
  Adds latitude and longitude fields to the survey_reports table to store geocoded location data from the property address.

  ## Changes Made
  
  ### Modified Tables
  - `survey_reports`
    - Added `latitude` (numeric) - Latitude coordinate of the property location
    - Added `longitude` (numeric) - Longitude coordinate of the property location

  ## Notes
  - Both fields are nullable as geocoding may not always be available
  - Latitude ranges from -90 to 90 degrees
  - Longitude ranges from -180 to 180 degrees
  - These fields can be used for mapping and geospatial queries in the future
  - Natural hazards data is stored in the existing `form_data` JSONB column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN latitude numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_reports' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE survey_reports ADD COLUMN longitude numeric;
  END IF;
END $$;

COMMENT ON COLUMN survey_reports.latitude IS 'Latitude coordinate of the property location (geocoded from address)';
COMMENT ON COLUMN survey_reports.longitude IS 'Longitude coordinate of the property location (geocoded from address)';