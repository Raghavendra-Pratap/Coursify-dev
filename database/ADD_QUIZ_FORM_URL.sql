-- Add optional form_url to quizzes and forms for Google Forms–based quiz/form embedding.
-- When set, the learner view embeds this URL in an iframe (like document URLs).

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS form_url TEXT;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS form_url TEXT;

COMMENT ON COLUMN quizzes.form_url IS 'Optional Google Form URL; when set, quiz is rendered as embedded form in TakeCourse';
COMMENT ON COLUMN forms.form_url IS 'Optional Google Form URL; when set, form is rendered as embedded form in TakeCourse';
