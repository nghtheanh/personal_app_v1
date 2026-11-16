-- ============================================================
-- Ritmo — Supabase PostgreSQL Schema
-- Vietnamese productivity app
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- calendar_events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  date        date        NOT NULL,
  start_time  time        NOT NULL,
  end_time    time        NOT NULL,
  color       text        DEFAULT 'violet',
  created_at  timestamptz DEFAULT now()
);

-- notes (one row per user)
CREATE TABLE IF NOT EXISTS public.notes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text        DEFAULT '',
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text        NOT NULL,
  is_completed   boolean     DEFAULT false,
  scheduled_date date,
  created_at     timestamptz DEFAULT now()
);

-- habits
CREATE TABLE IF NOT EXISTS public.habits (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  type       text        NOT NULL CHECK (type IN ('must_do', 'avoid')),
  created_at timestamptz DEFAULT now()
);

-- habit_logs
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   uuid        NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  log_date   date        NOT NULL,
  status     text        NOT NULL CHECK (status IN ('completed', 'slipped', 'clean')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(habit_id, log_date)
);

-- pomodoro_sessions
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_minutes integer     NOT NULL DEFAULT 25,
  completed_at     timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.calendar_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_sessions  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES — calendar_events
-- ============================================================

CREATE POLICY "calendar_events select own"
  ON public.calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "calendar_events insert own"
  ON public.calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_events update own"
  ON public.calendar_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_events delete own"
  ON public.calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- POLICIES — notes
-- ============================================================

CREATE POLICY "notes select own"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notes insert own"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes update own"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes delete own"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- POLICIES — tasks
-- ============================================================

CREATE POLICY "tasks select own"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tasks insert own"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks update own"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks delete own"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- POLICIES — habits
-- ============================================================

CREATE POLICY "habits select own"
  ON public.habits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "habits insert own"
  ON public.habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habits update own"
  ON public.habits FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habits delete own"
  ON public.habits FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- POLICIES — habit_logs
-- ============================================================

CREATE POLICY "habit_logs select own"
  ON public.habit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "habit_logs insert own"
  ON public.habit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habit_logs update own"
  ON public.habit_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habit_logs delete own"
  ON public.habit_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- POLICIES — pomodoro_sessions
-- ============================================================

CREATE POLICY "pomodoro_sessions select own"
  ON public.pomodoro_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "pomodoro_sessions insert own"
  ON public.pomodoro_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pomodoro_sessions update own"
  ON public.pomodoro_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pomodoro_sessions delete own"
  ON public.pomodoro_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTION + TRIGGER — auto-create notes row for new users
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notes (user_id, content) VALUES (NEW.id, '');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
