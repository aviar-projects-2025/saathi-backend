create table public.rides (
    id uuid primary key default gen_random_uuid(),

    created_by uuid not null,

    mode_of_travel text not null,

    from_location text not null,
    destination text not null,

    start_time timestamptz not null,
    end_time timestamptz,

    last_ride_started_notification_at timestamptz,

    -- Normal ride fields
    available_seats integer,
    total_seats integer,
    fuel_sharing numeric,
    duration integer,

    -- Flight fields
    from_country text,
    from_airport text,
    to_country text,
    to_airport text,
    flight_number text,
    airline_name text,

    traveller_type text,

    language text[],

    age_group_preference text not null default 'Any',

    medical_assistance boolean not null default false,
    language_support boolean not null default false,
    transit_help boolean not null default false,
    baggage_help boolean not null default false,

    description text,

    status text not null default 'OPEN',

    travel_status text not null default 'Waiting',

    gender_preference text not null default 'Any',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- User relationship
    constraint rides_created_by_fkey
        foreign key (created_by)
        references public.users(id)
        on delete cascade,

    -- Travel mode
    constraint rides_mode_of_travel_check
        check (
            mode_of_travel in (
                'Car',
                'Bus',
                'Bike',
                'Flight',
                'Ship',
                'Train'
            )
        ),

    -- Age preference
    constraint rides_age_group_preference_check
        check (
            age_group_preference in (
                '18-25',
                '26-40',
                '41-60',
                '60+',
                'Any'
            )
        ),

    -- Status
    constraint rides_status_check
        check (
            status in (
                'OPEN',
                'FULL',
                'CLOSED'
            )
        ),

    -- Travel status
    constraint rides_travel_status_check
        check (
            travel_status in (
                'Waiting',
                'Started',
                'Ongoing',
                'Completed',
                'Cancelled'
            )
        ),

    -- Gender preference
    constraint rides_gender_preference_check
        check (
            gender_preference in (
                'Male',
                'Female',
                'Any'
            )
        ),

    -- Traveller type
    constraint rides_traveller_type_check
        check (
            traveller_type is null
            or traveller_type in (
                'First-time traveller',
                'Senior citizen support',
                'Student travel companion',
                'Women-only companion',
                'Family companion',
                ''
            )
        )
);

-- Indexes
create index idx_rides_created_by
    on public.rides(created_by);

create index idx_rides_start_time
    on public.rides(start_time);

create index idx_rides_status
    on public.rides(status);

create index idx_rides_travel_status
    on public.rides(travel_status);

create index idx_rides_created_at
    on public.rides(created_at desc);