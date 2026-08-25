create table if not exists public.saved_posts (
    id uuid primary key default gen_random_uuid(),

    post_id uuid not null,
    user_id uuid not null,

    created_at timestamptz not null default now(),

    constraint saved_posts_post_id_fkey
        foreign key (post_id)
        references public.community_posts(id)
        on delete cascade,

    constraint saved_posts_user_id_fkey
        foreign key (user_id)
        references public.users(id)
        on delete cascade,

    constraint saved_posts_user_post_unique
        unique (post_id, user_id)
);

create index if not exists idx_saved_posts_user_id
    on public.saved_posts(user_id);

create index if not exists idx_saved_posts_post_id
    on public.saved_posts(post_id);