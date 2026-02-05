// src/lib/re/buildingsRepo.ts
import { supabase } from '../supabase';
import type { BuildingInput } from './buildingsModel';

const TABLE = 're_buildings';

export async function listBuildings(documentId: string): Promise<BuildingInput[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as BuildingInput[];
}

export async function upsertBuilding(building: BuildingInput): Promise<BuildingInput> {
  const payload = { ...building };

  // Supabase insert/update: if id exists → update, else → insert
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as BuildingInput;
}

export async function deleteBuilding(buildingId: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', buildingId);
  if (error) throw error;
}
