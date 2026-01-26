import { supabase } from '../lib/supabase';

export async function checkDocumentImmutable(documentId: string): Promise<{
  isImmutable: boolean;
  reason?: string;
}> {
  try {
    const { data: document, error } = await supabase
      .from('documents')
      .select('issue_status')
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      console.error('Error checking document immutability:', error);
      return { isImmutable: false };
    }

    if (!document) {
      return { isImmutable: false, reason: 'Document not found' };
    }

    if (document.issue_status === 'issued' || document.issue_status === 'superseded') {
      return {
        isImmutable: true,
        reason: `Document is ${document.issue_status} and cannot be modified`,
      };
    }

    return { isImmutable: false };
  } catch (error) {
    console.error('Error in checkDocumentImmutable:', error);
    return { isImmutable: false };
  }
}

export async function enforceDocumentMutability(documentId: string): Promise<void> {
  const { isImmutable, reason } = await checkDocumentImmutable(documentId);

  if (isImmutable) {
    throw new Error(reason || 'Document is immutable and cannot be modified');
  }
}
