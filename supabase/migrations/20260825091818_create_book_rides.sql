create table public.book_rides (
    id uuid primary key default gen_random_uuid(),

    ride_id uuid not null,
    requested_by uuid not null,
    ride_owner uuid not null,

    phone text not null,

    seats_requested integer not null default 1,
    approved_seats integer not null default 0,
    pending_req_seats integer not null default 0,

    members_count integer not null,

    members jsonb not null default '[]'::jsonb,
    pending_members jsonb not null default '[]'::jsonb,

    message text,

    request_type text not null,
    status text not null default 'PENDING',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint book_rides_ride_id_fkey
        foreign key (ride_id)
        references public.rides(id)
        on delete cascade,

    constraint book_rides_requested_by_fkey
        foreign key (requested_by)
        references public.users(id)
        on delete cascade,

    constraint book_rides_ride_owner_fkey
        foreign key (ride_owner)
        references public.users(id)
        on delete cascade,

    constraint book_rides_seats_requested_check
        check (seats_requested >= 1),

    constraint book_rides_approved_seats_check
        check (approved_seats >= 0),

    constraint book_rides_pending_req_seats_check
        check (pending_req_seats >= 0),

    constraint book_rides_members_count_check
        check (members_count >= 1),

    constraint book_rides_request_type_check
        check (request_type in ('SEAT', 'COMPANION')),

    constraint book_rides_status_check
        check (
            status in (
                'PENDING',
                'ACCEPTED',
                'REJECTED',
                'CANCELLED',
                'AUTO_REJECTED'
            )
        )
);

create index idx_book_rides_ride_id
    on public.book_rides(ride_id);

create index idx_book_rides_requested_by
    on public.book_rides(requested_by);

create index idx_book_rides_ride_owner
    on public.book_rides(ride_owner);

create index idx_book_rides_status
    on public.book_rides(status);

create index idx_book_rides_created_at
    on public.book_rides(created_at desc);