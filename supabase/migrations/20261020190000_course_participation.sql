-- The syllabus's class participation weight, for the one quiet line in the skip
-- preview ("Every skip also costs participation (10%)."). Additive only; courses
-- keeps its RLS policies and grants.
alter table public.courses
  add column participation_weight numeric(5, 2)
  check (participation_weight between 0 and 100);
