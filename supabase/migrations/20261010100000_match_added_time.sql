-- Added (injury) time announced by the scorer for each half, shown next to the live clock.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS first_half_added_minutes smallint NOT NULL DEFAULT 0 CHECK (first_half_added_minutes BETWEEN 0 AND 30),
  ADD COLUMN IF NOT EXISTS second_half_added_minutes smallint NOT NULL DEFAULT 0 CHECK (second_half_added_minutes BETWEEN 0 AND 30);
