import { supabase } from '../supabase';

export interface LogoResult {
  bytes: Uint8Array | null;
  mime: 'image/png' | 'image/jpeg' | null;
  signedUrl: string | null;
}

/**
 * Resolves organisation logo from storage.
 * Returns logo bytes, mime type, and signed URL.
 * Never throws - returns nulls on failure.
 */
export async function resolveOrganisationLogo(
  organisationId: string,
  brandingLogoPath: string | null | undefined
): Promise<LogoResult> {
  const nullResult: LogoResult = { bytes: null, mime: null, signedUrl: null };

  if (!brandingLogoPath) {
    return nullResult;
  }

  try {
    // Create signed URL
    const { data, error } = await supabase.storage
      .from('org-assets')
      .createSignedUrl(brandingLogoPath, 3600);

    if (error || !data?.signedUrl) {
      console.warn('[Logo Resolver] Failed to create signed URL:', error);
      return nullResult;
    }

    const signedUrl = data.signedUrl;

    // Fetch logo bytes with timeout
    const response = await Promise.race([
      fetch(signedUrl),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Logo fetch timed out')), 3000)
      )
    ]);

    if (!response.ok) {
      console.warn('[Logo Resolver] Failed to fetch logo:', response.statusText);
      return { bytes: null, mime: null, signedUrl };
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Detect mime type from file extension
    let mime: 'image/png' | 'image/jpeg' | null = null;
    const lowerPath = brandingLogoPath.toLowerCase();
    if (lowerPath.endsWith('.png')) {
      mime = 'image/png';
    } else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
      mime = 'image/jpeg';
    }

    return { bytes, mime, signedUrl };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[Logo Resolver] Exception resolving logo:', errorMsg);
    return nullResult;
  }
}
