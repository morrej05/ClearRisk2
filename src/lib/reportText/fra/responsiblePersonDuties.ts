export type Jurisdiction = 'UK' | 'IE';

export function fraResponsiblePersonDutiesText(jurisdiction: Jurisdiction = 'UK'): string {
  const intro = jurisdiction === 'UK'
    ? 'Under the Regulatory Reform (Fire Safety) Order 2005, the responsible person has a legal obligation to take reasonable steps to reduce the risk from fire and to ensure that people can safely escape if a fire occurs. The specific duties of the responsible person include:'
    : 'Under applicable fire safety legislation, the responsible person has a legal obligation to take reasonable steps to reduce the risk from fire and to ensure that people can safely escape if a fire occurs. The specific duties of the responsible person include:';

  const maintenanceStandards = jurisdiction === 'UK'
    ? 'British Standards'
    : 'applicable standards and guidance';

  const finalParagraph = jurisdiction === 'UK'
    ? 'The responsible person may appoint one or more competent persons to assist in undertaking the preventive and protective measures required by the Order. However, the responsible person retains overall accountability for fire safety compliance.'
    : 'The responsible person may appoint one or more competent persons to assist in undertaking the preventive and protective measures required by applicable legislation. However, the responsible person retains overall accountability for fire safety compliance.';

  return `${intro}

**Fire Risk Assessment:** Carry out and regularly review a comprehensive fire risk assessment that identifies fire hazards, evaluates risks to people, and determines appropriate control measures. The assessment must be recorded where five or more persons are employed or the premises are licensed.

**Fire Safety Measures:** Implement and maintain appropriate fire safety measures based on the findings of the fire risk assessment. This includes providing suitable means of escape, fire detection and warning systems, firefighting equipment, emergency lighting, and fire safety signs where necessary.

**Emergency Planning:** Establish and maintain an emergency plan that sets out the actions to be taken in the event of fire, including evacuation procedures, assembly points, and arrangements for assisting vulnerable persons. The plan must be tested through regular fire drills.

**Information and Training:** Provide relevant persons with appropriate information about fire risks, fire safety measures, and emergency procedures. Ensure that employees receive adequate fire safety training and instruction appropriate to their role and responsibilities.

**Maintenance and Testing:** Ensure that all fire safety equipment and systems are properly maintained in efficient working order and good repair. This includes regular inspection, testing, and servicing by competent persons in accordance with manufacturers' recommendations and ${maintenanceStandards}.

**Management Arrangements:** Establish effective fire safety management arrangements, including clear allocation of responsibilities, monitoring of compliance, and arrangements for liaison with the fire and rescue service where appropriate. Management systems should be proportionate to the risks and the size and nature of the organisation.

**Cooperation and Coordination:** Where premises are shared with other employers or occupiers, the responsible person must cooperate and coordinate with others to ensure that fire safety measures are effectively implemented across the premises.

${finalParagraph}`;
}

export default fraResponsiblePersonDutiesText;
