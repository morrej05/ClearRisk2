import { supabase } from '../lib/supabase';

/**
 * Updates a section grade in the canonical documents.section_grades column
 * This ensures the overall grade calculation has access to the latest grades
 *
 * @param documentId - The document ID to update
 * @param sectionKey - The section key (e.g., 'fire_protection', 'construction')
 * @param value - The grade value (1-5)
 * @returns Promise with error if any
 */
export async function updateSectionGrade(
  documentId: string,
  sectionKey: string,
  value: number
): Promise<{ error: Error | null }> {
  try {
    // Fetch current section_grades
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('section_grades')
      .eq('id', documentId)
      .maybeSingle();

    if (fetchError) {
      console.error('[updateSectionGrade] Error fetching document:', fetchError);
      return { error: fetchError };
    }

    if (!doc) {
      const error = new Error('Document not found');
      console.error('[updateSectionGrade] Document not found:', documentId);
      return { error };
    }

    // Merge the new grade
    const currentGrades = doc.section_grades || {};
    const updatedGrades = {
      ...currentGrades,
      [sectionKey]: value,
    };

    // Update the document
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        section_grades: updatedGrades,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('[updateSectionGrade] Error updating document:', updateError);
      return { error: updateError };
    }

    console.log(`[updateSectionGrade] Updated ${sectionKey} = ${value} for document ${documentId}`);
    return { error: null };
  } catch (error) {
    console.error('[updateSectionGrade] Exception:', error);
    return { error: error as Error };
  }
}

/**
 * Gets all section grades for a document
 * @param documentId - The document ID
 * @returns Promise with section grades or empty object
 */
export async function getSectionGrades(
  documentId: string
): Promise<Record<string, number>> {
  try {
    const { data: doc, error } = await supabase
      .from('documents')
      .select('section_grades')
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      console.error('[getSectionGrades] Error:', error);
      return {};
    }

    return doc?.section_grades || {};
  } catch (error) {
    console.error('[getSectionGrades] Exception:', error);
    return {};
  }
}

/**
 * Calculates overall grade from section grades
 * @param sectionGrades - Object with section keys and grade values (1-5)
 * @returns Average grade, or 3 if no grades exist
 */
export function calculateOverallGrade(sectionGrades: Record<string, number>): number {
  const grades = Object.values(sectionGrades).filter(g => g !== undefined && g > 0);
  if (grades.length === 0) return 3; // Default to "Adequate"

  const sum = grades.reduce((acc, grade) => acc + grade, 0);
  return sum / grades.length;
}

/**
 * Gets risk band label from overall grade
 */
export function getRiskBandFromGrade(overallGrade: number): string {
  if (overallGrade < 2.0) return 'Critical';
  if (overallGrade < 3.0) return 'High';
  if (overallGrade < 4.0) return 'Medium';
  return 'Low';
}
