/**
 * Survey History Panel
 *
 * Displays a complete audit trail of all events for a survey including:
 * - Survey issuance
 * - Revision creation
 * - Action closure/reopening
 *
 * Events are displayed as a timeline with most recent first.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, FileText, GitBranch, CheckCircle, RotateCcw, AlertCircle } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  created_at: string;
  survey_id: string;
  revision_number: number | null;
  actor_id: string | null;
  event_type: 'issued' | 'revision_created' | 'action_closed' | 'action_reopened';
  details: {
    change_log?: string;
    survey_type?: string;
    scope_type?: string;
    note?: string;
    from_revision?: number;
    action_id?: string;
    title?: string;
  };
}

interface UserProfile {
  id: string;
  name: string;
}

interface SurveyHistoryPanelProps {
  surveyId: string;
}

export default function SurveyHistoryPanel({ surveyId }: SurveyHistoryPanelProps) {
  const [events, setEvents] = useState<AuditLogEntry[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditLog();
  }, [surveyId]);

  const fetchAuditLog = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch audit log entries
      const { data: auditData, error: auditError } = await supabase
        .from('audit_log')
        .select('*')
        .eq('survey_id', surveyId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (auditError) throw auditError;

      setEvents(auditData || []);

      // Fetch user profiles for actor names
      if (auditData && auditData.length > 0) {
        const actorIds = [...new Set(auditData.map(e => e.actor_id).filter(Boolean))];

        if (actorIds.length > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('id, name')
            .in('id', actorIds);

          if (!profileError && profileData) {
            const profileMap = new Map(profileData.map((p: UserProfile) => [p.id, p.name]));
            setUserProfiles(profileMap);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching audit log:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getActorName = (actorId: string | null): string => {
    if (!actorId) return 'System';
    return userProfiles.get(actorId) || 'Unknown user';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'issued':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'revision_created':
        return <GitBranch className="w-5 h-5 text-purple-600" />;
      case 'action_closed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'action_reopened':
        return <RotateCcw className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'issued':
        return 'border-blue-200 bg-blue-50';
      case 'revision_created':
        return 'border-purple-200 bg-purple-50';
      case 'action_closed':
        return 'border-green-200 bg-green-50';
      case 'action_reopened':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const renderEventTitle = (event: AuditLogEntry) => {
    switch (event.event_type) {
      case 'issued':
        return (
          <div>
            <span className="font-semibold text-blue-900">
              Issued revision {event.revision_number || 1}
            </span>
          </div>
        );
      case 'revision_created':
        return (
          <div>
            <span className="font-semibold text-purple-900">
              Created revision {event.revision_number}
            </span>
            {event.details.from_revision && (
              <span className="text-sm text-purple-700 ml-2">
                from v{event.details.from_revision}
              </span>
            )}
          </div>
        );
      case 'action_closed':
        return (
          <div>
            <span className="font-semibold text-green-900">Closed action:</span>
            <span className="text-green-800 ml-2">{event.details.title || 'Untitled'}</span>
          </div>
        );
      case 'action_reopened':
        return (
          <div>
            <span className="font-semibold text-orange-900">Reopened action:</span>
            <span className="text-orange-800 ml-2">{event.details.title || 'Untitled'}</span>
          </div>
        );
      default:
        return <span className="font-semibold">Unknown event</span>;
    }
  };

  const renderEventDetails = (event: AuditLogEntry) => {
    const details: JSX.Element[] = [];

    if (event.details.change_log) {
      details.push(
        <div key="change_log" className="text-sm text-gray-700 mt-1">
          <span className="font-medium">Change log:</span> {event.details.change_log}
        </div>
      );
    }

    if (event.details.note && event.details.note.trim()) {
      details.push(
        <div key="note" className="text-sm text-gray-700 mt-1 italic">
          "{event.details.note}"
        </div>
      );
    }

    if (event.details.survey_type || event.details.scope_type) {
      details.push(
        <div key="meta" className="text-xs text-gray-600 mt-1">
          {event.details.survey_type && <span>Type: {event.details.survey_type}</span>}
          {event.details.survey_type && event.details.scope_type && <span className="mx-2">•</span>}
          {event.details.scope_type && <span>Scope: {event.details.scope_type}</span>}
        </div>
      );
    }

    return details.length > 0 ? <div className="mt-2">{details}</div> : null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-gray-600">Loading history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Failed to load history</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No history yet</p>
        <p className="text-sm text-gray-500 mt-1">
          Events will appear here as actions are taken
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">History</h3>
        <p className="text-sm text-gray-600">{events.length} event{events.length === 1 ? '' : 's'}</p>
      </div>

      <div className="space-y-3">
        {events.map((event, index) => (
          <div
            key={event.id}
            className={`relative border rounded-lg p-4 ${getEventColor(event.event_type)}`}
          >
            {/* Timeline connector */}
            {index < events.length - 1 && (
              <div className="absolute left-6 top-14 w-0.5 h-6 bg-gray-300" />
            )}

            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getEventIcon(event.event_type)}
              </div>

              <div className="flex-1 min-w-0">
                {renderEventTitle(event)}

                <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                  <span className="font-medium">{getActorName(event.actor_id)}</span>
                  <span>•</span>
                  <span>{formatTimestamp(event.created_at)}</span>
                </div>

                {renderEventDetails(event)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
