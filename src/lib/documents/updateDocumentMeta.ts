import { supabase } from "../supabase";

function deepMerge(target: any, patch: any): any {
  if (patch === null || patch === undefined) return target;
  if (Array.isArray(patch)) return patch;
  if (typeof patch !== "object") return patch;

  const out = { ...(target ?? {}) };
  for (const k of Object.keys(patch)) {
    out[k] = deepMerge(out[k], patch[k]);
  }
  return out;
}

export async function updateDocumentMeta(documentId: string, patchMeta: any) {
  const { data: doc, error: readErr } = await supabase
    .from("documents")
    .select("id, meta")
    .eq("id", documentId)
    .maybeSingle();

  if (readErr) throw readErr;
  if (!doc) throw new Error('Document not found');

  const merged = deepMerge(doc?.meta ?? {}, patchMeta ?? {});
  const { error: writeErr } = await supabase
    .from("documents")
    .update({ meta: merged })
    .eq("id", documentId);

  if (writeErr) throw writeErr;
  return merged;
}

export interface ClientMeta {
  name: string;
}

export interface SiteAddressMeta {
  line1?: string;
  line2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  country?: string;
}

export interface SiteContactMeta {
  name?: string;
  email?: string;
  phone?: string;
}

export interface SiteMeta {
  name: string;
  address?: SiteAddressMeta;
  contact?: SiteContactMeta;
}

export interface DocumentMetaIdentity {
  client?: ClientMeta;
  site?: SiteMeta;
}
