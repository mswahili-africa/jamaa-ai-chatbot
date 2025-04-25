/**
 * Extracts the most relevant section from prospectus text
 */
export function findBestMatch(
    fullText: string,
    query: string,
    sectionKeywords: Record<string, string>
  ): string {
    // 1. Identify likely section
    const queryLower = query.toLowerCase();
    let sectionHeader = "";
    
    // Match against predefined keywords
    for (const [keyword, header] of Object.entries(sectionKeywords)) {
      if (queryLower.includes(keyword)) {
        sectionHeader = header;
        break;
      }
    }
  
    // 2. Extract section content
    if (sectionHeader) {
      const startIdx = fullText.indexOf(sectionHeader);
      if (startIdx >= 0) {
        const endIdx = fullText.indexOf("\n\n", startIdx + sectionHeader.length);
        return fullText.substring(startIdx, endIdx > 0 ? endIdx : undefined);
      }
    }
  
    // 3. Fallback: Find sentences containing query words
    const queryWords = queryLower.split(/\s+/);
    return fullText
      .split('\n')
      .filter(line => queryWords.some(word => line.toLowerCase().includes(word)))
      .join('\n')
      .substring(0, 1000); // Limit length
  }
  
  /**
   * Formats UCC-official responses
   */
  export function formatUCCResponse(prospectusText: string, query: string): string {
    const section = findBestMatch(prospectusText, query, {
      'diploma': 'DIPLOMA PROGRAMS',
      'degree': 'DEGREE PROGRAMS',
      'computing': 'COMPUTING DEPARTMENT',
      'business': 'BUSINESS SCHOOL',
      'fee': 'TUITION FEES'
    });
  
    // Standard UCC response template
    return `
  UCC Helpdesk Official Response:
  
  ${extractKeyDetails(section, query)}
  
  For complete details, please consult:
  https://ucc.co.tz/programs
  `.trim();
  }
  
  // Helper to extract structured details
  function extractKeyDetails(text: string, query: string): string {
    const details = [];
    
    // Duration
    const durationMatch = text.match(/duration:?\s*(\d+\s*(years|semesters))/i);
    if (durationMatch) details.push(`• Duration: ${durationMatch[1]}`);
  
    // Requirements
    const reqMatch = text.match(/requirements:?([^.]+)/i);
    if (reqMatch) details.push(`• Requirements: ${reqMatch[1].trim()}`);
  
    // Modules (extract 3-5 items)
    const modules = text.match(/- ([^\n]+)/g)?.slice(0, 5);
    if (modules) details.push(`• Key Modules:\n  ${modules.join('\n  ')}`);
  
    return details.length > 0 
      ? details.join('\n')
      : `Regarding "${query}", our records indicate:\n${text.substring(0, 500)}`;
  }