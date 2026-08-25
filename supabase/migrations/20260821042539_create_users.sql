create table public.users (
    id uuid primary key default gen_random_uuid(),

    first_name text not null,
    last_name text not null,

    profile_image text,

    email text not null unique,

    gender text,

    mobile text unique,

    bio text,

    zipcode text,

    dob date,

    password text not null,

    role text not null default 'USER'
        check (role in ('USER', 'ADMIN')),

    referral_code text not null unique,

    referred_by uuid
        references public.users(id)
        on delete set null,

    ref_approve text not null default 'Waiting'
        check (ref_approve in ('Approved', 'Waiting', 'Declined')),

    completed_ride_count integer not null default 0,

    image_public_id text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);

create index users_referred_by_idx
on public.users(referred_by);

create index users_created_at_idx
on public.users(created_at desc);