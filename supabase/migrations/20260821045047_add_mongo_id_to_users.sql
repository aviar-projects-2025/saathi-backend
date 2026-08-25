alter table public.users
add column mongo_id text unique;

create index users_mongo_id_idx
on public.users(mongo_id);