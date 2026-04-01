-- Create labor_entries table
create table labor_entries (
    id serial primary key,
    company_id integer not null,
    work_order_id integer not null,
    crew_member_id integer not null,
    clock_in_time timestamp not null,
    clock_out_time timestamp not null,
    hours_worked numeric not null,
    hourly_rate numeric not null,
    break_minutes integer not null,
    notes text,
    created_at timestamp default now(),
    updated_at timestamp default now()
);

-- Add indexes
create index idx_company_id on labor_entries(company_id);
create index idx_work_order_id on labor_entries(work_order_id);
create index idx_crew_member_id on labor_entries(crew_member_id);
create index idx_clock_in_time on labor_entries(clock_in_time);
create index idx_clock_out_time on labor_entries(clock_out_time);

-- Enable Row Level Security
alter table labor_entries enable row level security;

-- Create policies
create policy "labor_entries_select" on labor_entries
    for select
    using (exists (
        select 1 from profiles
        where profiles.id = auth.uid()
          and profiles.company_id = labor_entries.company_id
    ));

create policy "labor_entries_insert" on labor_entries
    for insert
    with check (exists (
        select 1 from profiles
        where profiles.id = auth.uid()
          and profiles.company_id = labor_entries.company_id
    ));

create policy "labor_entries_update" on labor_entries
    for update
    using (exists (
        select 1 from profiles
        where profiles.id = auth.uid()
          and profiles.company_id = labor_entries.company_id
    ));

create policy "labor_entries_delete" on labor_entries
    for delete
    using (exists (
        select 1 from profiles
        where profiles.id = auth.uid()
          and profiles.company_id = labor_entries.company_id
    ));