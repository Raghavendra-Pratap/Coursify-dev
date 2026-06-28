-- In-app notifications bell / dropdown.

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  related_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(user_id, created_at DESC);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON user_notifications;
CREATE POLICY "Users can view own notifications"
  ON user_notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications (mark read)" ON user_notifications;
CREATE POLICY "Users can update own notifications (mark read)"
  ON user_notifications FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service can insert notifications" ON user_notifications;
CREATE POLICY "Service can insert notifications"
  ON user_notifications FOR INSERT WITH CHECK (true);
