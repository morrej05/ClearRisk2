export type Jurisdiction = 'UK' | 'IE';

export function fsdLimitationsText(jurisdiction: Jurisdiction = 'UK'): string {
  const standards = jurisdiction === 'UK'
    ? 'relevant British Standards'
    : 'relevant standards and guidance';

  const legislationRef = jurisdiction === 'UK'
    ? 'the Regulatory Reform (Fire Safety) Order 2005 or equivalent legislation'
    : 'applicable fire safety legislation';

  return `This fire strategy is based upon the design information available at the time of preparation. As the design develops, further detail will emerge that may necessitate updates to the fire strategy. Any significant changes to the building layout, structural design, proposed occupancy, or fire safety systems should be reviewed to ensure continued compliance with the fire strategy principles and applicable regulations.

The fire strategy assumes that all building work will be carried out in accordance with good building practice, ${standards}, and manufacturers' installation instructions. Fire-resisting construction, fire stopping, and cavity barriers must be installed by competent contractors with appropriate third-party certification or inspection to verify compliance with the specified fire resistance performance. Any variations from the specified fire safety provisions must be agreed with the Building Control authority and fire and rescue service where applicable.

The effectiveness of the fire safety measures described in this strategy is dependent upon appropriate ongoing management, maintenance, and testing of fire safety systems in accordance with relevant standards and manufacturers' recommendations. The building owner and management must establish suitable arrangements for routine inspection and testing of fire alarms, emergency lighting, firefighting equipment, and smoke control systems as specified in this document.

This fire strategy does not address detailed specifications for building services installations, except where they impact upon fire safety provisions. Coordination between fire safety design and mechanical, electrical, and public health services design is essential to ensure that service penetrations through fire-resisting elements are adequately fire stopped, that ductwork and pipework installations do not compromise compartmentation, and that building services do not introduce uncontrolled ignition sources or combustible materials that could undermine the fire strategy.

The strategy is intended to inform Building Control approval and does not constitute a detailed fire risk assessment under ${legislationRef}. Upon completion and occupation of the building, the responsible person must undertake a suitable and sufficient fire risk assessment considering the actual use, management arrangements, and occupant characteristics, and implement appropriate fire safety management measures to maintain safety and regulatory compliance.`;
}

export default fsdLimitationsText;
