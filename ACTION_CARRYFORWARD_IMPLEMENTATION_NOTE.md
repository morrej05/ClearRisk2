# Action Carry-Forward Implementation Note

## Status
Database fields are ready. UI for document versioning does not yet exist.

## Database Schema (COMPLETE ✅)
The following columns have been added to the `actions` table:
- `origin_action_id` (uuid) - Links to the original action when carried forward
- `carried_from_document_id` (uuid) - Source document ID when action was carried forward
- Foreign keys and indexes are in place

## When to Implement (FUTURE)
When adding document versioning/revision functionality (e.g., "Create v2" button in DocumentOverview), implement the following logic:

### Carry-Forward Logic

```typescript
async function carryForwardActions(
  oldDocumentId: string,
  newDocumentId: string,
  organisationId: string
) {
  // 1. Query open/in_progress/deferred actions from v1
  const { data: openActions, error } = await supabase
    .from('actions')
    .select('*')
    .eq('document_id', oldDocumentId)
    .in('status', ['open', 'in_progress', 'deferred']);

  if (error) throw error;

  // 2. For each action, create a copy in the new document
  for (const action of openActions || []) {
    const newAction = {
      organisation_id: organisationId,
      document_id: newDocumentId,
      module_instance_id: action.module_instance_id, // Link to corresponding module in new doc
      recommended_action: action.recommended_action,
      priority_band: action.priority_band,
      timescale: action.timescale,
      status: action.status, // Keep same status (open/in_progress/deferred)
      target_date: action.target_date,
      owner_user_id: action.owner_user_id,
      source: action.source,
      // Carry-forward fields:
      origin_action_id: action.origin_action_id || action.id, // Root action ID
      carried_from_document_id: oldDocumentId,
      // Don't copy: closed_at, closed_by, closure_notes (action is not closed)
    };

    await supabase.from('actions').insert(newAction);
  }

  // Note: Closed actions are NOT carried forward
}
```

### Integration Point
In `CreateDocumentModal.tsx` or wherever the "Create New Version" flow is added:

```typescript
// After creating the new document and module instances:
await carryForwardActions(sourceDocumentId, newDocumentId, organisationId);
```

## Related Features Implemented ✅
- Action close-out with closure notes
- Linked action closure (close all related actions across versions)
- Deduplication on action creation
- Status expanded: open, in_progress, closed, not_applicable, deferred

## Testing Checklist (When Implemented)
- [ ] Create document v1 with actions in various statuses
- [ ] Close some actions (verify closed_at, closure_notes populated)
- [ ] Create document v2 from v1
- [ ] Verify open/in_progress/deferred actions are copied to v2
- [ ] Verify closed/not_applicable actions are NOT copied
- [ ] Verify origin_action_id points to root action
- [ ] Verify carried_from_document_id equals v1 document ID
- [ ] Close an action in v2, verify it closes the linked action in v1
