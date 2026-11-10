-- Applied to the existing production project before the UI release.
-- Nullable fields preserve existing returns and older clients.
alter table public.returns
  add column if not exists inspector text,
  add column if not exists confirmer text;
