interface HtmlReportViewerProps {
  reportHtml: string;
}

export default function HtmlReportViewer({ reportHtml }: HtmlReportViewerProps) {
  const hasContent = (html: string): boolean => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.trim().length > 0;
  };

  if (!hasContent(reportHtml)) {
    return (
      <div className="bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 p-12 text-center">
        <p className="text-slate-500 text-lg mb-2">No data added for this section</p>
        <p className="text-slate-400 text-sm">Complete the survey form to populate this report</p>
      </div>
    );
  }

  return (
    <div
      className="prose prose-slate max-w-none bg-white rounded-lg border border-slate-200 p-8"
      dangerouslySetInnerHTML={{ __html: reportHtml }}
    />
  );
}
