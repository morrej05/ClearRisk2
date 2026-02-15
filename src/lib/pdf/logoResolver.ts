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

  console.log('[Logo Resolver] Starting logo resolution:', {
    organisationId,
    brandingLogoPath,
    hasBrandingPath: !!brandingLogoPath
  });

  if (!brandingLogoPath) {
    console.log('[Logo Resolver] No branding path provided, returning null');
    return nullResult;
  }

  try {
    // Create signed URL
    console.log('[Logo Resolver] Creating signed URL for path:', brandingLogoPath);
    const { data, error } = await supabase.storage
      .from('org-assets')
      .createSignedUrl(brandingLogoPath, 3600);

    if (error || !data?.signedUrl) {
      console.warn('[Logo Resolver] Failed to create signed URL:', {
        error: error?.message || 'No error message',
        errorDetails: error,
        hasData: !!data,
        hasSignedUrl: !!data?.signedUrl
      });
      return nullResult;
    }

    const signedUrl = data.signedUrl;
    console.log('[Logo Resolver] Signed URL created successfully');

    // Fetch logo bytes with timeout
    console.log('[Logo Resolver] Fetching logo bytes from signed URL');
    const response = await Promise.race([
      fetch(signedUrl),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Logo fetch timed out')), 3000)
      )
    ]);

    if (!response.ok) {
      console.warn('[Logo Resolver] Failed to fetch logo:', {
        status: response.status,
        statusText: response.statusText
      });
      return { bytes: null, mime: null, signedUrl };
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    console.log('[Logo Resolver] Logo bytes fetched successfully:', {
      byteLength: bytes.length,
      hasBytes: bytes.length > 0
    });

    // Detect mime type from file extension
    let mime: 'image/png' | 'image/jpeg' | null = null;
    const lowerPath = brandingLogoPath.toLowerCase();
    if (lowerPath.endsWith('.png')) {
      mime = 'image/png';
    } else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
      mime = 'image/jpeg';
    }

    console.log('[Logo Resolver] Logo resolved successfully:', {
      mime,
      byteLength: bytes.length
    });

    return { bytes, mime, signedUrl };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[Logo Resolver] Exception resolving logo:', {
      error: errorMsg,
      errorStack: error instanceof Error ? error.stack : undefined
    });
    return nullResult;
  }
}
