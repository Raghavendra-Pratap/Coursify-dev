-- Optional: hidden field entry ID in Google Form for webhook token (pre-fill).
-- When set, TakeCourse appends the one-time token to the form URL so Apps Script can send it back.

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS form_entry_id_webhook TEXT;

COMMENT ON COLUMN quizzes.form_entry_id_webhook IS 'Google Form entry ID of the hidden field used for webhook token; optional.';
