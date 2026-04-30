alter table public.site_github_connections
  add column if not exists repository_index_stage text,
  add column if not exists repository_index_processed_file_count integer not null default 0,
  add column if not exists repository_index_total_file_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_github_connections_repository_index_progress_check'
  ) then
    alter table public.site_github_connections
      add constraint site_github_connections_repository_index_progress_check
      check (
        repository_index_processed_file_count >= 0
        and repository_index_total_file_count >= 0
      );
  end if;
end $$;

create or replace function public.enqueue_repository_index_job(
  p_site_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_job_id uuid;
  v_now timestamptz := now();
begin
  update public.repository_index_jobs
  set
    status = 'cancelled',
    finished_at = v_now,
    error = 'Superseded by a newer repository index request',
    locked_by = null,
    locked_at = null,
    heartbeat_at = null,
    updated_at = v_now
  where site_id = p_site_id
    and user_id = p_user_id
    and status in ('queued', 'running');

  insert into public.repository_index_jobs (
    site_id,
    user_id,
    status,
    created_at,
    updated_at
  )
  values (
    p_site_id,
    p_user_id,
    'queued',
    v_now,
    v_now
  )
  returning id into v_job_id;

  update public.site_github_connections
  set
    repository_index_job_id = v_job_id,
    repository_index_status = 'indexing',
    repository_index_stage = 'queued',
    repository_index_started_at = v_now,
    repository_indexed_at = null,
    repository_index_error = null,
    repository_index_file_count = 0,
    repository_index_processed_file_count = 0,
    repository_index_total_file_count = 0,
    updated_at = v_now
  where site_id = p_site_id
    and user_id = p_user_id
    and use_repository_context = true
    and disconnected_at is null;

  if not found then
    raise exception 'GitHub connection not found for repository indexing';
  end if;

  return v_job_id;
end;
$$;
