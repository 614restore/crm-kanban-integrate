-- Add include_better flag to quotes for draft/preview options
alter table public.quotes
  add column if not exists include_better boolean default false;
