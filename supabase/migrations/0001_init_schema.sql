-- ==========================================
-- 1. PROFILES TABLE (Connected to auth.users)
-- ==========================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone." 
  on public.profiles for select 
  using (true);

create policy "Users can update their own profile." 
  on public.profiles for update 
  using (auth.uid() = id);


-- ==========================================
-- 2. LESSONS TABLE (Parent Metadata)
-- ==========================================
create table public.lessons (
  id text primary key, -- Supports custom strings like random lesson IDs
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  prompt text not null,
  status text not null default 'generating', -- generating, completed, failed
  progress int default 0,
  message text,
  video_url text, -- Supabase Storage Public URL
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Lessons
alter table public.lessons enable row level security;

create policy "Users can view their own lessons." 
  on public.lessons for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own lessons." 
  on public.lessons for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own lessons." 
  on public.lessons for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own lessons." 
  on public.lessons for delete 
  using (auth.uid() = user_id);


-- ==========================================
-- 3. SCENES TABLE (Normalized Child Table)
-- ==========================================
create table public.scenes (
  id uuid default gen_random_uuid() primary key,
  lesson_id text references public.lessons(id) on delete cascade not null,
  step int not null,
  narration text not null,
  manim_code text not null,
  duration float8 default 8.0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure step numbers are unique per lesson
  constraint unique_scene_step_per_lesson unique (lesson_id, step)
);

-- Enable RLS for Scenes
alter table public.scenes enable row level security;

create policy "Users can view scenes of their own lessons." 
  on public.scenes for select 
  using (
    exists (
      select 1 from public.lessons 
      where lessons.id = scenes.lesson_id 
      and lessons.user_id = auth.uid()
    )
  );

create policy "Users can insert scenes into their own lessons." 
  on public.scenes for insert 
  with check (
    exists (
      select 1 from public.lessons 
      where lessons.id = scenes.lesson_id 
      and lessons.user_id = auth.uid()
    )
  );


-- ==========================================
-- 4. AUTOMATIC PROFILE CREATION TRIGGER
-- ==========================================
-- Automatically creates a profile row when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, created_at, updated_at)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    now(),
    now()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();