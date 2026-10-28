-- Apply before deploying the QR design studio. Existing codes retain square styling.
ALTER TABLE scans ADD COLUMN IF NOT EXISTS module_style text NOT NULL DEFAULT 'square';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS eye_style text NOT NULL DEFAULT 'square';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS eye_color text;
