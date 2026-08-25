create table public.community_posts (
    id uuid primary key default gen_random_uuid(),

    mongo_id text unique,

    post_image text,

    description text,

    author_id uuid not null,

    likes integer not null default 0,

    community_img_public_id text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint community_posts_author_id_fkey
        foreign key (author_id)
        references public.users(id)
        on delete cascade
);

create index idx_community_posts_author_id
    on public.community_posts(author_id);

create index idx_community_posts_created_at
    on public.community_posts(created_at desc);