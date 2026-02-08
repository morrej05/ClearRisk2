import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Flame, Zap, ClipboardList, Lock } from 'lucide-react';
import { canAccessExplosionSafety, shouldShowUpgradePrompts, getPlanTier, getSubscriptionStatusDisplayName } from '../utils/entitlements';
import { useState } from 'react';
import ClientBrandingModal from '../components/ClientBrandingModal';
import { useClientBranding } from '../contexts/ClientBrandingContext';

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
      className={`relative group bg-white rounded-lg border p-6 text-left transition-all ${
        disabled
          ? 'border-neutral-200 opacity-60 cursor-not-allowed'
          : 'border-neutral-200 hover:border-red-600 cursor-pointer'
      }`}
    >
      {badge && (
        <div className="absolute top-3 right-3 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded border border-amber-200">
          {badge}
        </div>
      )}

      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
            disabled ? 'bg-neutral-100' : 'bg-red-600 group-hover:bg-red-700'
          }`}
        >
          <div className={disabled ? 'text-neutral-400' : 'text-white'}>{icon}</div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-neutral-900 mb-1 flex items-center gap-2">
            {title}
            {disabled && <Lock className="w-4 h-4 text-neutral-400" />}
          </h3>
          <p className="text-sm text-neutral-600 mb-3">{description}</p>

          {stats && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-neutral-900">{stats.count || 0}</span>
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
  const { user, userRole, isPlatformAdmin, organisation } = useAuth();
  const { refreshBranding } = useClientBranding();
  const [showBrandingModal, setShowBrandingModal] = useState(false);

  // Keep entitlement logic (used for Explosion tile / upgrade prompt)
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

  const handleBrandingUpdated = () => {
    refreshBranding();
  };

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Dashboard</h1>
          <p className="text-neutral-600">Select a module to get started</p>
          {/* Optional: small status line (not a second nav) */}
          <div className="mt-2 text-xs text-neutral-500">
            Tier: {planTier} · Status: {subscriptionStatus}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DashboardTile
            title="Risk Engineering"
            description="Property risk surveys and assessments"
            icon={<TrendingUp className="w-6 h-6" />}
            onClick={() => navigate('/assessments')}
          />

          <DashboardTile
            title="Fire Safety"
            description="Fire Risk Assessments & Fire Strategy Documents"
            icon={<Flame className="w-6 h-6" />}
            onClick={() => navigate('/assessments')}
          />

          <DashboardTile
            title="Explosion Safety"
            description="Explosive Atmospheres assessments"
            icon={<Zap className="w-6 h-6" />}
            onClick={() => navigate('/assessments')}
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
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white border border-amber-200 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  Unlock Explosion Safety Assessments
                </h3>
                <p className="text-neutral-700 mb-4">
                  Upgrade to Pro to access Explosive Atmospheres assessment capabilities, along with advanced features and unlimited documents.
                </p>
                <button
                  onClick={() => setShowBrandingModal(true)}
                  className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Contact admin / upgrade
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
