// src/lib/re/fireProtectionRepo.ts
import { supabase } from '../supabase';
import type { SiteWaterRecord, BuildingSprinklerRecord } from './fireProtectionModel';
import { createDefaultSiteWater, createDefaultBuildingSprinkler } from './fireProtectionModel';

// Site Water CRUD
export async function getSiteWater(documentId: string): Promise<SiteWaterRecord | null> {
  const { data, error } = await supabase
    .from('re06_site_water')
    .select('*')
    .eq('document_id', documentId)
    .maybeSingle();

  if (error) throw error;
  return data as SiteWaterRecord | null;
}

export async function upsertSiteWater(record: Partial<SiteWaterRecord>): Promise<SiteWaterRecord> {
  const { data, error } = await supabase
    .from('re06_site_water')
    .upsert(record)
    .select('*')
    .single();

  if (error) throw error;
  return data as SiteWaterRecord;
}

export async function getOrCreateSiteWater(documentId: string): Promise<SiteWaterRecord> {
  let record = await getSiteWater(documentId);

  if (!record) {
    const defaultRecord = createDefaultSiteWater(documentId);
    record = await upsertSiteWater(defaultRecord);
  }

  return record;
}

// Building Sprinkler CRUD
export async function getBuildingSprinklers(documentId: string): Promise<BuildingSprinklerRecord[]> {
  const { data, error } = await supabase
    .from('re06_building_sprinklers')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as BuildingSprinklerRecord[];
}

export async function getBuildingSprinkler(
  documentId: string,
  buildingId: string
): Promise<BuildingSprinklerRecord | null> {
  const { data, error } = await supabase
    .from('re06_building_sprinklers')
    .select('*')
    .eq('document_id', documentId)
    .eq('building_id', buildingId)
    .maybeSingle();

  if (error) throw error;
  return data as BuildingSprinklerRecord | null;
}

export async function upsertBuildingSprinkler(
  record: Partial<BuildingSprinklerRecord>
): Promise<BuildingSprinklerRecord> {
  const { data, error } = await supabase
    .from('re06_building_sprinklers')
    .upsert(record)
    .select('*')
    .single();

  if (error) throw error;
  return data as BuildingSprinklerRecord;
}

export async function getOrCreateBuildingSprinkler(
  documentId: string,
  buildingId: string
): Promise<BuildingSprinklerRecord> {
  let record = await getBuildingSprinkler(documentId, buildingId);

  if (!record) {
    const defaultRecord = createDefaultBuildingSprinkler(documentId, buildingId);
    record = await upsertBuildingSprinkler(defaultRecord);
  }

  return record;
}

/**
 * Ensure sprinkler records exist for all buildings in a document
 */
export async function ensureBuildingSprinklersForAllBuildings(
  documentId: string,
  buildingIds: string[]
): Promise<BuildingSprinklerRecord[]> {
  const existingRecords = await getBuildingSprinklers(documentId);
  const existingBuildingIds = new Set(existingRecords.map(r => r.building_id));

  // Create records for any missing buildings
  const missingBuildingIds = buildingIds.filter(id => !existingBuildingIds.has(id));

  for (const buildingId of missingBuildingIds) {
    await getOrCreateBuildingSprinkler(documentId, buildingId);
  }

  // Fetch all records (including newly created ones)
  return await getBuildingSprinklers(documentId);
}
