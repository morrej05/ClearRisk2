export type Jurisdiction = 'UK' | 'IE';

export function fraRegulatoryFrameworkText(jurisdiction: Jurisdiction = 'UK'): string {
  if (jurisdiction === 'UK') {
    return `The Regulatory Reform (Fire Safety) Order 2005 (FSO) applies to virtually all premises and workplaces in England and Wales, other than domestic premises. In Scotland, the Fire (Scotland) Act 2005 and the Fire Safety (Scotland) Regulations 2006 impose similar requirements. These regulations place a legal duty on the 'responsible person' to carry out a suitable and sufficient fire risk assessment and to implement appropriate fire safety measures.

The responsible person must identify fire hazards and people at risk, evaluate the risks arising from those hazards, and determine whether existing fire safety measures are adequate or if additional precautions are required. The assessment must be kept under regular review and be revised where significant changes occur to the premises, work activities, or if the assessment is no longer valid.

The FSO adopts a risk-based, goal-setting approach to fire safety rather than prescriptive requirements. This means that the responsible person has flexibility in determining how to achieve adequate fire safety standards, provided that the level of risk to relevant persons is reduced to an acceptable level. Guidance documents such as those published by the government and professional bodies provide valuable assistance in interpreting the requirements and achieving compliance.

Key objectives under the FSO include ensuring that people can safely evacuate the premises in the event of fire, that fire safety systems and equipment are properly maintained and tested, that staff receive appropriate fire safety training, and that suitable management arrangements are in place to maintain and improve fire safety standards over time.`;
  }

  if (jurisdiction === 'IE') {
    return `Applicable Irish fire safety legislation places a legal duty on the responsible person to carry out a suitable and sufficient fire risk assessment and to implement appropriate fire safety measures. These requirements apply to virtually all premises and workplaces other than domestic premises.

The responsible person must identify fire hazards and people at risk, evaluate the risks arising from those hazards, and determine whether existing fire safety measures are adequate or if additional precautions are required. The assessment must be kept under regular review and be revised where significant changes occur to the premises, work activities, or if the assessment is no longer valid.

Irish fire safety legislation adopts a risk-based, goal-setting approach to fire safety rather than prescriptive requirements. This means that the responsible person has flexibility in determining how to achieve adequate fire safety standards, provided that the level of risk to relevant persons is reduced to an acceptable level. Guidance documents published by relevant authorities and professional bodies provide valuable assistance in interpreting the requirements and achieving compliance.

Key objectives include ensuring that people can safely evacuate the premises in the event of fire, that fire safety systems and equipment are properly maintained and tested, that staff receive appropriate fire safety training, and that suitable management arrangements are in place to maintain and improve fire safety standards over time.`;
  }

  return fraRegulatoryFrameworkText('UK');
}

export default fraRegulatoryFrameworkText;
