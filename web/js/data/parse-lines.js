const ASSIGNED_STRING_PATTERN = /^\w+\[\w+\+\+\]\s*=\s*"([^"]*)"/;

/**
 * Extracts every quoted string literal assigned via the SolarLog `arr[idx++]="..."` pattern.
 * @param {string} fileText - Raw file content.
 * @returns {string[]} One entry per matched line, in file order (source files are newest-first).
 */
export function extractAssignedStrings(fileText) {
  const result = [];
  for (const line of fileText.split('\n')) {
    const match = ASSIGNED_STRING_PATTERN.exec(line);
    if (match) result.push(match[1]);
  }
  return result;
}
