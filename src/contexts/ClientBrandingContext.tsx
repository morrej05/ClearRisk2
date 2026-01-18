import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface ClientBranding {
  companyName: string;
  logoUrl: string | null;
}

interface ClientBrandingContextType {
  branding: ClientBranding;
  refreshBranding: () => Promise<void>;
  isLoading: boolean;
}

const ClientBrandingContext = createContext<ClientBrandingContextType | undefined>(undefined);

export function ClientBrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<ClientBranding>({
    companyName: 'EziRisk',
    logoUrl: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = async () => {
    if (!user) {
      setBranding({ companyName: 'EziRisk', logoUrl: null });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('client_branding')
        .select('company_name, logo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBranding({
          companyName: data.company_name,
          logoUrl: data.logo_url,
        });
      } else {
        setBranding({ companyName: 'EziRisk', logoUrl: null });
      }
    } catch (error) {
      console.error('Error fetching client branding:', error);
      setBranding({ companyName: 'EziRisk', logoUrl: null });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, [user]);

  const refreshBranding = async () => {
    setIsLoading(true);
    await fetchBranding();
  };

  return (
    <ClientBrandingContext.Provider value={{ branding, refreshBranding, isLoading }}>
      {children}
    </ClientBrandingContext.Provider>
  );
}

export function useClientBranding() {
  const context = useContext(ClientBrandingContext);
  if (context === undefined) {
    throw new Error('useClientBranding must be used within a ClientBrandingProvider');
  }
  return context;
}
