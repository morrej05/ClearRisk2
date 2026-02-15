# Logo Wiring Documentation

## Current Logo Infrastructure

### Database
- **Column**: `organisations.branding_logo_path` (text, nullable)
- **Updated**: `organisations.branding_updated_at` (timestamptz, nullable)

### Storage
- **Bucket**: `org-assets` (private)
- **Path Pattern**: `org-logos/<org_id>/logo.{png|jpg|svg}`
- **RLS**: Org members can read their org's logo, org admins can upload/update

### Fallback Logo
- **Location**: `/public/ezirisk-logo-primary.png` and `/public/ezirisk-logo-primary.svg`
- **Embedded**: `src/lib/pdf/eziRiskLogo.ts` contains base64-encoded PNG (400x100px)

### Access Pattern
1. Query `organisations` table for `branding_logo_path`
2. If path exists: create signed URL for `org-assets` bucket
3. Fetch bytes from signed URL
4. If fetch fails or path is null: use embedded fallback logo
5. Never throw - always return valid logo bytes

### PDF Generation
- All PDF builders should accept optional `logoBytes?: Uint8Array | null`
- If `logoBytes` provided: embed it in PDF header
- If null: embed fallback logo from `getEziRiskLogoBytes()`
- PDF generation must never fail due to logo issues

### Related Functions
- Edge Functions: `upload-org-logo`, `delete-org-logo`
- UI Components: `OrganisationBranding.tsx`
- PDF Utils: `eziRiskLogo.ts` (fallback logo provider)
