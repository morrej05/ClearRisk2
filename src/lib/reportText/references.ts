export type Jurisdiction = 'UK' | 'IE';

export interface ReferenceItem {
  label: string;
  detail?: string;
}

export function getExplosiveAtmospheresReferences(jurisdiction: Jurisdiction): ReferenceItem[] {
  if (jurisdiction === 'UK') {
    return [
      {
        label: 'Dangerous Substances and Explosive Atmospheres Regulations 2002 (DSEAR)',
        detail: 'Primary UK legislation governing the control of risks from fire, explosion and similar events arising from dangerous substances used or present in the workplace.'
      },
      {
        label: 'Health and Safety at Work etc. Act 1974',
        detail: 'Primary duty of care for employers to ensure, so far as is reasonably practicable, the health, safety and welfare of employees and others who may be affected by work activities.'
      },
      {
        label: 'Equipment and Protective Systems Intended for Use in Potentially Explosive Atmospheres Regulations 2016',
        detail: 'UK implementation of ATEX equipment requirements (Directive 2014/34/EU).'
      },
      {
        label: 'BS EN 60079-10-1:2015',
        detail: 'Classification of areas - Explosive gas atmospheres.'
      },
      {
        label: 'BS EN 60079-10-2:2015',
        detail: 'Classification of areas - Explosive dust atmospheres.'
      }
    ];
  }

  if (jurisdiction === 'IE') {
    return [
      {
        label: 'Safety, Health and Welfare at Work Act 2005',
        detail: 'Primary Irish legislation establishing duties for employers to ensure the safety, health and welfare of employees.'
      },
      {
        label: 'Chemicals Act (Control of Major Accident Hazards involving Dangerous Substances) Regulations 2015 (COMAH)',
        detail: 'Irish regulations controlling major accident hazards involving dangerous substances.'
      },
      {
        label: 'European Communities (Equipment and Protective Systems Intended for Use in Potentially Explosive Atmospheres) Regulations 2016',
        detail: 'Irish implementation of ATEX equipment requirements (Directive 2014/34/EU).'
      },
      {
        label: 'IS EN 60079-10-1:2015',
        detail: 'Classification of areas - Explosive gas atmospheres.'
      },
      {
        label: 'IS EN 60079-10-2:2015',
        detail: 'Classification of areas - Explosive dust atmospheres.'
      }
    ];
  }

  return [];
}
