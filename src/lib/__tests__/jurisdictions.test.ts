/**
 * Unit tests for jurisdiction normalization and configuration
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeJurisdiction,
  getJurisdictionLabel,
  getJurisdictionConfig,
  getAvailableJurisdictions,
  type Jurisdiction,
} from '../jurisdictions';

describe('normalizeJurisdiction', () => {
  describe('direct canonical values', () => {
    it('should return england_wales as-is', () => {
      expect(normalizeJurisdiction('england_wales')).toBe('england_wales');
    });

    it('should return scotland as-is', () => {
      expect(normalizeJurisdiction('scotland')).toBe('scotland');
    });

    it('should return northern_ireland as-is', () => {
      expect(normalizeJurisdiction('northern_ireland')).toBe('northern_ireland');
    });

    it('should return ireland as-is', () => {
      expect(normalizeJurisdiction('ireland')).toBe('ireland');
    });
  });

  describe('legacy mappings', () => {
    it('should map UK to england_wales', () => {
      expect(normalizeJurisdiction('UK')).toBe('england_wales');
    });

    it('should map uk (lowercase) to england_wales', () => {
      expect(normalizeJurisdiction('uk')).toBe('england_wales');
    });

    it('should map UK-EN to england_wales', () => {
      expect(normalizeJurisdiction('UK-EN')).toBe('england_wales');
    });

    it('should map "United Kingdom" to england_wales', () => {
      expect(normalizeJurisdiction('United Kingdom')).toBe('england_wales');
    });

    it('should map "England" to england_wales', () => {
      expect(normalizeJurisdiction('England')).toBe('england_wales');
    });

    it('should map IE to ireland', () => {
      expect(normalizeJurisdiction('IE')).toBe('ireland');
    });

    it('should map ie (lowercase) to ireland', () => {
      expect(normalizeJurisdiction('ie')).toBe('ireland');
    });

    it('should map IRELAND to ireland', () => {
      expect(normalizeJurisdiction('IRELAND')).toBe('ireland');
    });

    it('should map Republic to ireland', () => {
      expect(normalizeJurisdiction('Republic')).toBe('ireland');
    });

    it('should map Scotland to scotland', () => {
      expect(normalizeJurisdiction('Scotland')).toBe('scotland');
    });

    it('should map SCOT to scotland', () => {
      expect(normalizeJurisdiction('SCOT')).toBe('scotland');
    });

    it('should map Northern to northern_ireland', () => {
      expect(normalizeJurisdiction('Northern')).toBe('northern_ireland');
    });

    it('should map NI to northern_ireland', () => {
      expect(normalizeJurisdiction('NI')).toBe('northern_ireland');
    });

    it('should map NORTHERN IRELAND to northern_ireland', () => {
      expect(normalizeJurisdiction('NORTHERN IRELAND')).toBe('northern_ireland');
    });
  });

  describe('null/undefined/empty values', () => {
    it('should default null to england_wales', () => {
      expect(normalizeJurisdiction(null)).toBe('england_wales');
    });

    it('should default undefined to england_wales', () => {
      expect(normalizeJurisdiction(undefined)).toBe('england_wales');
    });

    it('should default empty string to england_wales', () => {
      expect(normalizeJurisdiction('')).toBe('england_wales');
    });
  });

  describe('unrecognized values', () => {
    it('should default unrecognized value to england_wales', () => {
      expect(normalizeJurisdiction('invalid')).toBe('england_wales');
    });

    it('should default random string to england_wales', () => {
      expect(normalizeJurisdiction('xyz123')).toBe('england_wales');
    });
  });
});

describe('getJurisdictionLabel', () => {
  it('should return correct label for england_wales', () => {
    expect(getJurisdictionLabel('england_wales')).toBe('England & Wales');
  });

  it('should return correct label for scotland', () => {
    expect(getJurisdictionLabel('scotland')).toBe('Scotland');
  });

  it('should return correct label for northern_ireland', () => {
    expect(getJurisdictionLabel('northern_ireland')).toBe('Northern Ireland');
  });

  it('should return correct label for ireland', () => {
    expect(getJurisdictionLabel('ireland')).toBe('Republic of Ireland');
  });

  it('should normalize and return label for UK', () => {
    expect(getJurisdictionLabel('UK')).toBe('England & Wales');
  });

  it('should normalize and return label for IE', () => {
    expect(getJurisdictionLabel('IE')).toBe('Republic of Ireland');
  });

  it('should normalize and return label for null', () => {
    expect(getJurisdictionLabel(null)).toBe('England & Wales');
  });
});

describe('getJurisdictionConfig', () => {
  describe('england_wales', () => {
    const config = getJurisdictionConfig('england_wales');

    it('should have correct code', () => {
      expect(config.code).toBe('england_wales');
    });

    it('should have correct label', () => {
      expect(config.label).toBe('England & Wales');
    });

    it('should have primary legislation including FSO and ADB', () => {
      expect(config.primaryLegislation).toContain('Regulatory Reform (Fire Safety) Order 2005 (FSO)');
      expect(config.primaryLegislation).toContain('Building Regulations 2010 (Approved Document B)');
    });

    it('should have dutyholder heading referring to responsible person', () => {
      expect(config.dutyholderHeading).toContain('RESPONSIBLE PERSON');
    });

    it('should have dutyholder term as responsible person', () => {
      expect(config.dutyholderTerm).toBe('responsible person');
    });

    it('should have regulatory framework text', () => {
      expect(config.regulatoryFrameworkText).toContain('Regulatory Reform (Fire Safety) Order 2005');
      expect(config.regulatoryFrameworkText).toContain('responsible person');
    });

    it('should have responsible person duties', () => {
      expect(config.responsiblePersonDuties).toBeInstanceOf(Array);
      expect(config.responsiblePersonDuties.length).toBeGreaterThan(0);
    });

    it('should reference BS 9999 and PAS 79', () => {
      expect(config.references).toContain('BS 9999:2017 - Fire safety in the design, management and use of buildings');
      expect(config.references.some(ref => ref.includes('PAS 79'))).toBe(true);
    });
  });

  describe('scotland', () => {
    const config = getJurisdictionConfig('scotland');

    it('should have correct code', () => {
      expect(config.code).toBe('scotland');
    });

    it('should have correct label', () => {
      expect(config.label).toBe('Scotland');
    });

    it('should have primary legislation including Fire (Scotland) Act', () => {
      expect(config.primaryLegislation).toContain('Fire (Scotland) Act 2005');
      expect(config.primaryLegislation).toContain('Fire Safety (Scotland) Regulations 2006');
    });

    it('should NOT reference Approved Document B', () => {
      const allText = config.primaryLegislation.join(' ') + config.references.join(' ');
      expect(allText).not.toContain('Approved Document B');
    });

    it('should have dutyholder heading referring to duty holder', () => {
      expect(config.dutyholderHeading).toContain('DUTY HOLDER');
    });

    it('should have dutyholder term as duty holder', () => {
      expect(config.dutyholderTerm).toBe('duty holder');
    });

    it('should have regulatory framework text using duty holder terminology', () => {
      expect(config.regulatoryFrameworkText).toContain('duty holder');
    });

    it('should have duties referring to duty holder', () => {
      expect(config.responsiblePersonDuties.some(duty => duty.includes('duty holder'))).toBe(true);
    });
  });

  describe('northern_ireland', () => {
    const config = getJurisdictionConfig('northern_ireland');

    it('should have correct code', () => {
      expect(config.code).toBe('northern_ireland');
    });

    it('should have correct label', () => {
      expect(config.label).toBe('Northern Ireland');
    });

    it('should have primary legislation specific to NI', () => {
      expect(config.primaryLegislation).toContain('Fire and Rescue Services (Northern Ireland) Order 2006');
      expect(config.primaryLegislation).toContain('Fire Safety Regulations (Northern Ireland) 2010');
    });

    it('should NOT reference Approved Document B', () => {
      const allText = config.primaryLegislation.join(' ') + config.references.join(' ');
      expect(allText).not.toContain('Approved Document B');
    });

    it('should have dutyholder heading referring to responsible person', () => {
      expect(config.dutyholderHeading).toContain('RESPONSIBLE PERSON');
    });

    it('should have regulatory framework text', () => {
      expect(config.regulatoryFrameworkText).toContain('Northern Ireland');
      expect(config.regulatoryFrameworkText).toContain('responsible person');
    });
  });

  describe('ireland', () => {
    const config = getJurisdictionConfig('ireland');

    it('should have correct code', () => {
      expect(config.code).toBe('ireland');
    });

    it('should have correct label', () => {
      expect(config.label).toBe('Republic of Ireland');
    });

    it('should have primary legislation specific to Ireland', () => {
      expect(config.primaryLegislation).toContain('Fire Services Acts 1981 & 2003');
      expect(config.primaryLegislation).toContain('Safety, Health and Welfare at Work Act 2005');
    });

    it('should NOT reference Approved Document B', () => {
      const allText = config.primaryLegislation.join(' ') + config.references.join(' ');
      expect(allText).not.toContain('Approved Document B');
    });

    it('should reference TGD-B instead', () => {
      expect(config.references.some(ref => ref.includes('TGD-B'))).toBe(true);
    });

    it('should have dutyholder heading referring to employers and persons in control', () => {
      expect(config.dutyholderHeading).toContain('EMPLOYERS');
      expect(config.dutyholderHeading).toContain('PERSONS IN CONTROL');
    });

    it('should have dutyholder term for employer/person in control', () => {
      expect(config.dutyholderTerm).toBe('employer/person in control');
    });

    it('should have regulatory framework text using appropriate terminology', () => {
      expect(config.regulatoryFrameworkText).toContain('employers');
      expect(config.regulatoryFrameworkText).toContain('persons in control');
    });
  });

  describe('all jurisdictions', () => {
    const jurisdictions: Jurisdiction[] = ['england_wales', 'scotland', 'northern_ireland', 'ireland'];

    it('should have all required fields for each jurisdiction', () => {
      jurisdictions.forEach(jurisdiction => {
        const config = getJurisdictionConfig(jurisdiction);

        expect(config.code).toBeTruthy();
        expect(config.label).toBeTruthy();
        expect(config.fullName).toBeTruthy();
        expect(config.primaryLegislation).toBeInstanceOf(Array);
        expect(config.primaryLegislation.length).toBeGreaterThan(0);
        expect(config.enforcingAuthority).toBeTruthy();
        expect(config.regulatoryFrameworkText).toBeTruthy();
        expect(config.responsiblePersonDuties).toBeInstanceOf(Array);
        expect(config.responsiblePersonDuties.length).toBeGreaterThan(0);
        expect(config.dutyholderHeading).toBeTruthy();
        expect(config.dutyholderTerm).toBeTruthy();
        expect(config.references).toBeInstanceOf(Array);
        expect(config.references.length).toBeGreaterThan(0);
      });
    });

    it('should have all reference BS 9999', () => {
      jurisdictions.forEach(jurisdiction => {
        const config = getJurisdictionConfig(jurisdiction);
        expect(config.references.some(ref => ref.includes('BS 9999'))).toBe(true);
      });
    });
  });
});

describe('getAvailableJurisdictions', () => {
  const jurisdictions = getAvailableJurisdictions();

  it('should return an array of 4 jurisdictions', () => {
    expect(jurisdictions).toBeInstanceOf(Array);
    expect(jurisdictions.length).toBe(4);
  });

  it('should include england_wales', () => {
    const ewJurisdiction = jurisdictions.find(j => j.value === 'england_wales');
    expect(ewJurisdiction).toBeDefined();
    expect(ewJurisdiction?.label).toBe('England & Wales');
  });

  it('should include scotland', () => {
    const scotJurisdiction = jurisdictions.find(j => j.value === 'scotland');
    expect(scotJurisdiction).toBeDefined();
    expect(scotJurisdiction?.label).toBe('Scotland');
  });

  it('should include northern_ireland', () => {
    const niJurisdiction = jurisdictions.find(j => j.value === 'northern_ireland');
    expect(niJurisdiction).toBeDefined();
    expect(niJurisdiction?.label).toBe('Northern Ireland');
  });

  it('should include ireland', () => {
    const ieJurisdiction = jurisdictions.find(j => j.value === 'ireland');
    expect(ieJurisdiction).toBeDefined();
    expect(ieJurisdiction?.label).toBe('Republic of Ireland');
  });
});

describe('Regression tests for jurisdiction content', () => {
  it('england_wales should start with FSO introduction', () => {
    const config = getJurisdictionConfig('england_wales');
    expect(config.regulatoryFrameworkText).toMatch(/^The Regulatory Reform \(Fire Safety\) Order 2005/);
  });

  it('scotland should start with Fire (Scotland) Act introduction', () => {
    const config = getJurisdictionConfig('scotland');
    expect(config.regulatoryFrameworkText).toMatch(/^The Fire \(Scotland\) Act 2005/);
  });

  it('northern_ireland should start with Fire Safety Regulations introduction', () => {
    const config = getJurisdictionConfig('northern_ireland');
    expect(config.regulatoryFrameworkText).toMatch(/^The Fire Safety Regulations \(Northern Ireland\) 2010/);
  });

  it('ireland should start with multi-act introduction', () => {
    const config = getJurisdictionConfig('ireland');
    expect(config.regulatoryFrameworkText).toMatch(/^The Safety, Health and Welfare at Work Act 2005/);
  });

  it('scotland duties should NOT mention "Responsible Person" in heading', () => {
    const config = getJurisdictionConfig('scotland');
    expect(config.dutyholderHeading).not.toContain('RESPONSIBLE PERSON');
  });

  it('ireland regulatory text should use neutral dutyholder terminology', () => {
    const config = getJurisdictionConfig('ireland');
    expect(config.regulatoryFrameworkText).toContain('dutyholders');
  });

  it('only england_wales should reference Approved Document B in primary legislation', () => {
    const ewConfig = getJurisdictionConfig('england_wales');
    const scotConfig = getJurisdictionConfig('scotland');
    const niConfig = getJurisdictionConfig('northern_ireland');
    const ieConfig = getJurisdictionConfig('ireland');

    const ewHasADB = ewConfig.primaryLegislation.some(leg => leg.includes('Approved Document B'));
    const scotHasADB = scotConfig.primaryLegislation.some(leg => leg.includes('Approved Document B'));
    const niHasADB = niConfig.primaryLegislation.some(leg => leg.includes('Approved Document B'));
    const ieHasADB = ieConfig.primaryLegislation.some(leg => leg.includes('Approved Document B'));

    expect(ewHasADB).toBe(true);
    expect(scotHasADB).toBe(false);
    expect(niHasADB).toBe(false);
    expect(ieHasADB).toBe(false);
  });
});
