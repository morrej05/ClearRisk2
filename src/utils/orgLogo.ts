import { supabase } from '../lib/supabase';
import { getEziRiskLogoBytes } from '../lib/pdf/eziRiskLogo';

/**
 * Fetch organisation logo bytes for PDF embedding
 *
 * @param organisationId - The organisation ID
 * @returns Logo bytes or null if not found (never throws)
 */
export async function getOrgLogoBytes(organisationId: string): Promise<Uint8Array | null> {
  try {
    // Query organisation for logo path
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('branding_logo_path')
      .eq('id', organisationId)
      .single();

    if (orgError || !org?.branding_logo_path) {
      return null;
    }

    // Create signed URL for the logo (valid for 60 seconds)
    const { data: signedData, error: signError } = await supabase
      .storage
      .from('org-assets')
      .createSignedUrl(org.branding_logo_path, 60);

    if (signError || !signedData?.signedUrl) {
      console.warn('Failed to create signed URL for org logo:', signError);
      return null;
    }

    // Fetch logo bytes
    const response = await fetch(signedData.signedUrl);
    if (!response.ok) {
      console.warn('Failed to fetch org logo:', response.statusText);
      return null;
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.warn('Error fetching org logo (will use fallback):', error);
    return null;
  }
}

/**
 * Get logo bytes with automatic fallback
 *
 * @param organisationId - The organisation ID (optional)
 * @returns Always returns valid logo bytes (org logo or fallback)
 */
export async function getLogoWithFallback(organisationId?: string): Promise<Uint8Array> {
  if (organisationId) {
    const orgLogo = await getOrgLogoBytes(organisationId);
    if (orgLogo) {
      return orgLogo;
    }
  }

  // Always return fallback if org logo not available
  return getEziRiskLogoBytes();
}
