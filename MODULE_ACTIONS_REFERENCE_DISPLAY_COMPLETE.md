# Module Actions - Reference Number Display Complete

## Overview
Added reference number display to the "Actions from this Module" table shown in module views. Actions now display their assigned reference numbers in a new leftmost "REF" column.

## Changes Made

### File Modified
`src/components/modules/ModuleActions.tsx`

### 1. Action Interface - Added reference_number Field (line 18)
```typescript
interface Action {
  id: string;
  recommended_action: string;
  status: string;
  priority_band: string | null;
  target_date: string | null;
  updated_at: string;
  source: string | null;
  owner_user_id: string | null;
  reference_number?: string;  // ← Added
  document: { ... } | null;
  module_instance: { ... } | null;
  owner: { ... } | null;
  attachment_count: number;
}
```

### 2. Query Update - Include reference_number (lines 100-114)
```typescript
const { data, error } = await supabase
  .from('actions')
  .select(`
    id,
    recommended_action,
    status,
    priority_band,
    target_date,
    updated_at,
    source,
    owner_user_id,
    reference_number,  // ← Added explicitly
    created_at,
    document:documents!actions_document_id_fkey(id,title,document_type),
    module_instance:module_instances(id,module_key,outcome),
    owner:user_profiles(id,name)
  `)
  .eq('module_instance_id', moduleInstanceId)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

### 3. Table Header - Added REF Column (lines 362-364)
```typescript
<thead className="bg-neutral-50">
  <tr>
    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
      Ref
    </th>
    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
      Priority
    </th>
    {/* ... other columns ... */}
  </tr>
</thead>
```

### 4. Table Body - Display Reference Numbers (lines 385-389)
```typescript
<tbody className="bg-white divide-y divide-neutral-200">
  {actions.map((action) => (
    <tr key={action.id} className="hover:bg-neutral-50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm font-mono text-neutral-900">
          {action.reference_number ?? '—'}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {/* Priority column */}
      </td>
      {/* ... other columns ... */}
    </tr>
  ))}
</tbody>
```

## Table Layout

### Before
| Priority | Status | Action | Due Date | Actions |
|----------|--------|--------|----------|---------|
| P1 | Open | Install fire doors | 31 Jan 2026 | [...] |

### After
| Ref | Priority | Status | Action | Due Date | Actions |
|-----|----------|--------|--------|----------|---------|
| FRA-2026-001 | P1 | Open | Install fire doors | 31 Jan 2026 | [...] |
| — | P2 | Open | Review evacuation plan | 15 Feb 2026 | [...] |

## Display Behavior

### With Reference Number
- Shows assigned reference (e.g., `FRA-2026-001`)
- Displayed in monospace font for clarity
- Text color: `text-neutral-900`

### Without Reference Number
- Shows placeholder: `—`
- Consistent spacing maintained
- Actions without references still display properly

## Styling
```typescript
className="text-sm font-mono text-neutral-900"
```
- **Font size**: `text-sm` (14px)
- **Font family**: `font-mono` (matches other technical identifiers)
- **Color**: `text-neutral-900` (high contrast)

## Location
Displayed in the "Actions from this Module" section at the bottom of each module form:
1. Navigate to document workspace
2. Open any module (e.g., A2 Building Profile)
3. Scroll to bottom
4. See "Actions from this Module" table
5. REF column is leftmost, before Priority

## Applies To
- **FRA documents**: All modules
- **FSD documents**: All modules
- **DSEAR documents**: All modules
- **RE documents**: Only RE-9 Recommendations module (RE_13_RECOMMENDATIONS)

## Does Not Apply To
- RE modules other than RE-9 (they don't show actions footer)

## Build Status
✅ Build successful (18.26s)
✅ No TypeScript errors
✅ All changes applied
✅ Query explicitly includes reference_number
✅ UI displays references in monospace

## Testing Checklist
- [ ] Open draft FRA document
- [ ] Navigate to A2 Building Profile module
- [ ] Scroll to "Actions from this Module" section
- [ ] Verify REF column appears leftmost
- [ ] Verify actions with references show format `FRA-YYYY-NNN`
- [ ] Verify actions without references show `—`
- [ ] Verify table remains responsive and readable
