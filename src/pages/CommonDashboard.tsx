import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, TrendingUp, Flame, Zap, ClipboardList, Shield, Palette, Building2, Lock } from 'lucide-react';
import { useClientBranding } from '../contexts/ClientBrandingContext';
import { getRolePermissions } from '../utils/permissions';
import { canAccessExplosionSafety, shouldShowUpgradePrompts, getPlanTier, getSubscriptionStatusDisplayName } from '../utils/entitlements';
import { useState } from 'react';
import ClientBrandingModal from '../components/ClientBrandingModal';

interface DashboardTileProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
  stats?: {
    count?: number;
    label?: string;
  };
}

function DashboardTile({ title, description, icon, onClick, disabled, badge, stats }: DashboardTileProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative group bg-white rounded-xl border-2 p-6 text-left transition-all ${
        disabled
          ? 'border-neutral-200 opacity-60 cursor-not-allowed'
          : 'border-neutral-200 hover:border-neutral-900 hover:shadow-lg cursor-pointer'
      }`}
    >
      {badge && (
        <div className="absolute top-3 right-3 px-2 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded">
          {badge}
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
          disabled ? 'bg-neutral-100' : 'bg-neutral-900 group-hover:bg-neutral-800'
        }`}>
          <div className={disabled ? 'text-neutral-400' : 'text-white'}>
            {icon}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-neutral-900 mb-1 flex items-center gap-2">
            {title}
            {disabled && <Lock className="w-4 h-4 text-neutral-400" />}
          </h3>
          <p className="text-sm text-neutral-600 mb-3">
            {description}
          </p>

          {stats && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-neutral-900">{stats.count || 0}</span>
              <span className="text-xs text-neutral-500">{stats.label}</span>
            </div>
          )}
        </div>
      </div>

      {disabled && (
        <div className="mt-3 pt-3 border-t border-neutral-200">
          <span className="text-xs font-medium text-amber-700">Upgrade to Pro</span>
        </div>
      )}
    </button>
  );
}

export default function CommonDashboard() {
  const navigate = useNavigate();
  const { signOut, user, userRole, userPlan, isPlatformAdmin, organisation } = useAuth();
  const { branding: clientBranding, refreshBranding } = useClientBranding();
  const permissions = getRolePermissions(userRole);
  const [showBrandingModal, setShowBrandingModal] = useState(false);

  const userObj = user && organisation ? {
    id: user.id,
    role: userRole,
    is_platform_admin: isPlatformAdmin,
    can_edit: true
  } : null;

  const canAccessExplosion = userObj && organisation ? canAccessExplosionSafety(userObj, organisation) : false;
  const showUpgradePrompts = userObj && organisation ? shouldShowUpgradePrompts(userObj, organisation) : false;
  const planTier = organisation ? getPlanTier(organisation) : 'free';
  const subscriptionStatus = organisation ? getSubscriptionStatusDisplayName(organisation.subscription_status) : 'Unknown';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getCompanyLogo = () => {
    return clientBranding.logoUrl;
  };

  const getCompanyName = () => {
    return clientBranding.companyName;
  };

  const handleBrandingUpdated = () => {
    refreshBranding();
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {getCompanyLogo() ? (
                <img src={getCompanyLogo()!} alt={getCompanyName()} className="h-8" />
              ) : (
                <Building2 className="w-8 h-8 text-neutral-900" />
              )}
              <div className="flex flex-col">
                <div className="text-xl font-bold text-neutral-900">{getCompanyName()}</div>
                <div className="text-xs text-neutral-500">Risk Assessment Platform</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-sm text-neutral-600">{user?.email}</span>
                <div className="flex items-center gap-2">
                  {isPlatformAdmin ? (
                    <span className="text-xs text-neutral-500">
                      Admin Override Enabled
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-neutral-500">
                        Tier: {planTier}
                      </span>
                      <span className="text-xs text-neutral-400">|</span>
                      <span className="text-xs text-neutral-500">
                        Status: {subscriptionStatus}
                      </span>
                    </>
                  )}
                  {isPlatformAdmin && (
                    <span className="text-xs font-medium text-blue-700 px-2 py-0.5 bg-blue-50 rounded border border-blue-200">
                      Platform Admin
                    </span>
                  )}
                </div>
              </div>
              {isPlatformAdmin && (
                <button
                  onClick={() => navigate('/super-admin')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors"
                  title="Platform Admin Settings"
                >
                  <Shield className="w-4 h-4" />
                  Platform Settings
                </button>
              )}
              {permissions.canAccessAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                  title="Admin Dashboard"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </button>
              )}
              {permissions.canManageBranding && (
                <button
                  onClick={() => setShowBrandingModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                  title="Client Branding"
                >
                  <Palette className="w-4 h-4" />
                  Branding
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-neutral-600 mt-1">Select a module to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DashboardTile
            title="Risk Engineering"
            description="Property risk surveys and assessments"
            icon={<TrendingUp className="w-6 h-6" />}
            onClick={() => navigate('/legacy-dashboard')}
          />

          <DashboardTile
            title="Fire Safety"
            description="Fire Risk Assessments & Fire Strategy Documents"
            icon={<Flame className="w-6 h-6" />}
            onClick={() => navigate('/dashboard/fire')}
          />

          <DashboardTile
            title="Explosion Safety"
            description="DSEAR & ATEX assessments"
            icon={<Zap className="w-6 h-6" />}
            onClick={() => canAccessExplosion ? navigate('/dashboard/explosion') : navigate('/upgrade')}
            disabled={!canAccessExplosion}
            badge={!canAccessExplosion && showUpgradePrompts ? 'PRO' : undefined}
          />

          <DashboardTile
            title="Actions Register"
            description="Cross-document action tracking and management"
            icon={<ClipboardList className="w-6 h-6" />}
            onClick={() => navigate('/dashboard/actions')}
          />
        </div>

        {showUpgradePrompts && !canAccessExplosion && (
          <div className="mt-8 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-neutral-900 mb-2">
                  Unlock Explosion Safety Assessments
                </h3>
                <p className="text-neutral-700 mb-4">
                  Upgrade to Pro to access DSEAR and ATEX assessment capabilities, along with advanced features and unlimited documents.
                </p>
                <button
                  onClick={() => navigate('/upgrade')}
                  className="px-6 py-2.5 bg-neutral-900 text-white font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  Upgrade to Pro
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ClientBrandingModal
        isOpen={showBrandingModal}
        onClose={() => setShowBrandingModal(false)}
        onBrandingUpdated={handleBrandingUpdated}
      />
    </div>
  );
}
