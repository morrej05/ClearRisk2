import { useState, useEffect } from 'react';
import { Upload, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function OrganisationBranding() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [organisationId, setOrganisationId] = useState<string | null>(null);

  useEffect(() => {
    loadOrganisationBranding();
  }, [user]);

  async function loadOrganisationBranding() {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('organisation_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.organisation_id) {
        setError('No organisation found');
        return;
      }

      setOrganisationId(profile.organisation_id);

      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('branding_logo_path')
        .eq('id', profile.organisation_id)
        .maybeSingle();

      if (orgError) throw orgError;

      if (org?.branding_logo_path) {
        setLogoPath(org.branding_logo_path);
        const { data } = await supabase.storage
          .from('org-assets')
          .createSignedUrl(org.branding_logo_path, 3600);

        if (data?.signedUrl) {
          setLogoUrl(data.signedUrl);
        }
      }
    } catch (err: any) {
      console.error('Error loading branding:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !organisationId) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only PNG, JPG, and SVG are allowed.');
      return;
    }

    if (file.size > 1024 * 1024) {
      setError('File too large. Maximum size is 1MB.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('logo', file);
      formData.append('organisation_id', organisationId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-org-logo`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setSuccess('Logo uploaded successfully');
      await loadOrganisationBranding();
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!organisationId || !logoPath) return;

    if (!confirm('Are you sure you want to remove the organisation logo?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-org-logo`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ organisation_id: organisationId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Delete failed');
      }

      setSuccess('Logo removed successfully');
      setLogoUrl(null);
      setLogoPath(null);
    } catch (err: any) {
      console.error('Error deleting logo:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !logoUrl) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-600">Loading branding settings...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Organisation Branding</h2>
      <p className="text-sm text-slate-600 mb-6">
        Upload your organisation logo to appear on issued PDF reports.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Current Logo
          </label>
          {logoUrl ? (
            <div className="flex items-start gap-4">
              <div className="flex-1 p-6 bg-slate-50 border border-slate-200 rounded-lg">
                <img
                  src={logoUrl}
                  alt="Organisation logo"
                  className="max-w-full max-h-32 object-contain"
                />
              </div>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Remove logo"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm text-slate-500">
              No logo uploaded. PDFs will use the EziRisk default logo.
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {logoUrl ? 'Replace Logo' : 'Upload Logo'}
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50">
              <Upload className="w-4 h-4" />
              <span className="text-sm font-medium">
                {uploading ? 'Uploading...' : 'Choose File'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            PNG, JPG, or SVG. Maximum 1MB. Recommended: wide format with transparent background (~1000×300px).
          </p>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-medium text-slate-900 mb-2">Logo Requirements</h3>
          <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
            <li>File types: PNG, JPG, or SVG</li>
            <li>Maximum file size: 1MB</li>
            <li>Recommended dimensions: 1000×300px (wide format)</li>
            <li>Transparent background works best</li>
            <li>Logo will be scaled to fit 120mm × 30mm on PDF cover page</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
