export type Jurisdiction = 'UK' | 'IE';

export function fsdPurposeAndScopeText(jurisdiction: Jurisdiction = 'UK'): string {
  const complianceRef = jurisdiction === 'UK'
    ? 'the Building Regulations Approved Document B (Fire Safety) and associated guidance'
    : 'applicable building regulations and fire safety standards';

  return `This Fire Strategy document has been prepared to demonstrate compliance with ${complianceRef}, or equivalent approved standards and regulations applicable to the building type and jurisdiction. The document provides a comprehensive overview of the fire safety design principles, life safety provisions, and protective measures incorporated into the building design to ensure the safety of occupants and facilitate effective firefighting operations.

The fire strategy establishes the fundamental approach to fire safety design including the basis of design, relevant standards and guidance applied, and any departures from standard provisions where alternative solutions have been developed. It describes the means of escape strategy, travel distances, stair provisions, and evacuation assumptions appropriate to the building occupancy and user characteristics.

Key aspects covered include compartmentation and fire resistance requirements, fire stopping and cavity barriers, provisions for external fire spread, requirements for fire doors and other fire-resisting elements, and integration of passive fire protection with structural design. The strategy also addresses active fire protection systems including fire detection and alarm, emergency lighting, fire suppression systems where provided, smoke control systems, and firefighting facilities including fire service access, firefighting shafts, and dry or wet rising mains as applicable.

The document is intended for use by the design team, Building Control authority, fire and rescue service during consultation, the contractor during construction, and building management for ongoing maintenance and compliance. It forms a critical part of the Building Control submission and provides the basis for detailed design development, specification, and construction phase fire safety management. The fire strategy should be maintained as a live document throughout the design and construction process, with updates issued when significant design changes occur that affect fire safety provisions.`;
}

export default fsdPurposeAndScopeText;
