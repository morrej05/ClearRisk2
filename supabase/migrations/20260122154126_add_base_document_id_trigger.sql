/*
  # Auto-set base_document_id trigger

  1. Changes
    - Creates trigger function `set_base_document_id()` to automatically set base_document_id to id when null
    - Adds BEFORE INSERT trigger on `documents` table to ensure every document has a base_document_id
    
  2. Purpose
    - Guarantees data integrity for document versioning chain
    - Eliminates need for frontend to manually set base_document_id
    - Works automatically for UI inserts, edge functions, imports, and any other insert method
    
  3. Notes
    - Uses BEFORE INSERT trigger so value is set before row is written
    - Only sets base_document_id if it's null, preserving explicit values
    - Drops existing trigger if present to ensure clean migration
*/

-- Create trigger function to auto-set base_document_id
create or replace function public.set_base_document_id()
returns trigger
language plpgsql
as $$
begin
  if new.base_document_id is null then
    new.base_document_id := new.id;
  end if;
  return new;
end;
$$;

-- Drop existing trigger if present
drop trigger if exists trg_set_base_document_id on public.documents;

-- Create trigger to run before insert
create trigger trg_set_base_document_id
before insert on public.documents
for each row
execute function public.set_base_document_id();