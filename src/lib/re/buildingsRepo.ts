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

const EXTRA_TABLE = 're_building_extra';

export async function getBuildingExtra(buildingId: string): Promise<any> {
  const { data, error } = await supabase
    .from(EXTRA_TABLE)
    .select('data')
    .eq('building_id', buildingId)
    .maybeSingle();

  if (error) throw error;
  return data?.data ?? {};
}

export async function upsertBuildingExtra(buildingId: string, extra: any): Promise<void> {
  const { error } = await supabase
    .from(EXTRA_TABLE)
    .upsert({ building_id: buildingId, data: extra })
    .eq('building_id', buildingId);

  if (error) throw error;
}
