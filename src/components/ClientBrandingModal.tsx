import { useState, useEffect } from 'react';
import { X, Upload, Trash2, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ClientBrandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBrandingUpdated: () => void;
}

interface ClientBranding {
  id: string;
  company_name: string;
  logo_url: string | null;
}

export default function ClientBrandingModal({ isOpen, onClose, onBrandingUpdated }: ClientBrandingModalProps) {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState('EziRisk');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [brandingId, setBrandingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchBranding();
    }
  }, [isOpen, user]);

  const fetchBranding = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('client_branding')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBrandingId(data.id);
        setCompanyName(data.company_name);
        setLogoUrl(data.logo_url);
      }
    } catch (error) {
      console.error('Error fetching branding:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-logo.${fileExt}`;
      const filePath = fileName;

      if (logoUrl) {
        const oldFileName = logoUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage.from('client-logos').remove([oldFileName]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('client-logos')
        .getPublicUrl(filePath);

      setLogoUrl(urlData.publicUrl);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoUrl) return;

    setIsUploading(true);
    try {
      const fileName = logoUrl.split('/').pop();
      if (fileName) {
        const { error } = await supabase.storage
          .from('client-logos')
          .remove([fileName]);

        if (error) throw error;
      }

      setLogoUrl(null);
    } catch (error) {
      console.error('Error removing logo:', error);
      alert('Failed to remove logo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const brandingData = {
        user_id: user.id,
        company_name: companyName,
        logo_url: logoUrl,
      };

      if (brandingId) {
        const { error } = await supabase
          .from('client_branding')
          .update(brandingData)
          .eq('id', brandingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('client_branding')
          .insert([brandingData])
          .select()
          .single();

        if (error) throw error;
        setBrandingId(data.id);
      }

      onBrandingUpdated();
      onClose();
    } catch (error) {
      console.error('Error saving branding:', error);
      alert('Failed to save branding. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Client Branding</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter company name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Company Logo
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6">
              {logoUrl ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt="Company Logo"
                      className="max-h-32 max-w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      Replace Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </label>
                    <button
                      onClick={handleRemoveLogo}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-3">
                    <Building2 className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    Upload your company logo
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    Upload Logo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">
                    PNG, JPG, SVG up to 5MB
                  </p>
                </div>
              )}
              {isUploading && (
                <div className="flex items-center justify-center mt-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || isUploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
