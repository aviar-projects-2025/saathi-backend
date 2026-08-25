create table public.notifications (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null,
    actor_id uuid,

    type text not null,
    title text,
    message text,

    data jsonb default '{}'::jsonb,

    is_read boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint notifications_user_id_fkey
        foreign key (user_id)
        references public.users(id)
        on delete cascade,

    constraint notifications_actor_id_fkey
        foreign key (actor_id)
        references public.users(id)
        on delete set null
);

create index idx_notifications_user_id
    on public.notifications(user_id);

create index idx_notifications_actor_id
    on public.notifications(actor_id);

create index idx_notifications_created_at
    on public.notifications(created_at desc);