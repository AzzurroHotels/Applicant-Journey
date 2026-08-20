-- AZZURRO RECRUITMENT — SUPABASE SETUP
-- Run in Supabase SQL Editor.
-- Safe to re-run for this project.

create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submission_token uuid not null default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  mobile text not null,
  whatsapp text not null,
  suburb text,
  start_date date,
  experience text,
  weekends boolean default false,
  public_holidays boolean default false,
  most_days boolean default false,
  australian_work_rights boolean not null default false,
  tfn_eligible boolean not null default false,
  resume_path text,
  interview_complete boolean not null default false,
  status text not null default 'New',
  admin_notes text
);

alter table public.applications add column if not exists submission_token uuid default gen_random_uuid();
alter table public.applications alter column submission_token set not null;
alter table public.applications add column if not exists whatsapp text;
alter table public.applications add column if not exists resume_path text;
alter table public.applications add column if not exists interview_complete boolean not null default false;
alter table public.applications add column if not exists admin_notes text;

create table if not exists public.interview_responses (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  question_number int not null check (question_number between 1 and 5),
  category text not null,
  question text not null,
  video_path text not null,
  created_at timestamptz not null default now(),
  unique(application_id, question_number)
);

alter table public.applications enable row level security;
alter table public.interview_responses enable row level security;

drop policy if exists "public can submit applications" on public.applications;
create policy "public can submit applications"
on public.applications for insert
to anon, authenticated
with check (
  australian_work_rights = true
  and tfn_eligible = true
  and interview_complete = false
  and status = 'New'
);

drop policy if exists "admins can read applications" on public.applications;
create policy "admins can read applications"
on public.applications for select
to authenticated
using ((auth.jwt() ->> 'email') = 'admin001@azzurro.local');

drop policy if exists "admins can update applications" on public.applications;
create policy "admins can update applications"
on public.applications for update
to authenticated
using ((auth.jwt() ->> 'email') = 'admin001@azzurro.local')
with check ((auth.jwt() ->> 'email') = 'admin001@azzurro.local');

drop policy if exists "public can submit interview responses" on public.interview_responses;
drop policy if exists "admins can read interview responses" on public.interview_responses;
create policy "admins can read interview responses"
on public.interview_responses for select
to authenticated
using ((auth.jwt() ->> 'email') = 'admin001@azzurro.local');

-- Candidate-facing RPC. The unguessable token ties interview answers to the application
-- without granting anonymous users SELECT/UPDATE access to applicant records.
create or replace function public.submit_interview_response(
  p_application_id uuid,
  p_submission_token uuid,
  p_question_number int,
  p_category text,
  p_question text,
  p_video_path text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.applications
    where id = p_application_id
      and submission_token = p_submission_token
      and interview_complete = false
  ) then
    raise exception 'Invalid application session';
  end if;

  if p_question_number < 1 or p_question_number > 5 then
    raise exception 'Invalid question number';
  end if;

  -- If the first answer was already saved but the browser lost the success
  -- response, treat a retry as success without replacing the original answer.
  if exists (
    select 1 from public.interview_responses
    where application_id = p_application_id
      and question_number = p_question_number
  ) then
    return;
  end if;

  insert into public.interview_responses
    (application_id, question_number, category, question, video_path)
  values
    (p_application_id, p_question_number, p_category, p_question, p_video_path);
end;
$$;

revoke all on function public.submit_interview_response(uuid,uuid,int,text,text,text) from public;
grant execute on function public.submit_interview_response(uuid,uuid,int,text,text,text) to anon, authenticated;

create or replace function public.complete_application(
  p_application_id uuid,
  p_submission_token uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  answer_count int;
begin
  select count(*) into answer_count
  from public.interview_responses
  where application_id = p_application_id;

  if answer_count <> 5 then
    raise exception 'All five interview answers are required';
  end if;

  update public.applications
  set interview_complete = true,
      status = case when status = 'New' then 'For Review' else status end
  where id = p_application_id
    and submission_token = p_submission_token;

  if not found then
    raise exception 'Invalid application session';
  end if;
end;
$$;

revoke all on function public.complete_application(uuid,uuid) from public;
grant execute on function public.complete_application(uuid,uuid) to anon, authenticated;

insert into storage.buckets (id,name,public)
values ('resumes','resumes',false)
on conflict (id) do update set public=false;

insert into storage.buckets (id,name,public)
values ('interview-videos','interview-videos',false)
on conflict (id) do update set public=false;

drop policy if exists "candidate resume upload" on storage.objects;
create policy "candidate resume upload"
on storage.objects for insert
to anon, authenticated
with check (bucket_id='resumes');

drop policy if exists "candidate video upload" on storage.objects;
create policy "candidate video upload"
on storage.objects for insert
to anon, authenticated
with check (bucket_id='interview-videos');

drop policy if exists "admin read recruitment files" on storage.objects;
create policy "admin read recruitment files"
on storage.objects for select
to authenticated
using (
  bucket_id in ('resumes','interview-videos')
  and (auth.jwt() ->> 'email')='admin001@azzurro.local'
);
