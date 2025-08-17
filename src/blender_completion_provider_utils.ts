// longest prefix-suffix match problem
export function removeCommonPrefixSuffix(completionItem: string, line: string): string {
  let prefixLenToRemove = 0;

  for (let i = 0; i < line.length; i++) {
    const suffix = line.slice(i);
    if (completionItem.startsWith(suffix)) {
      prefixLenToRemove = suffix.length;
      break; // earliest (longest suffix) match found
    }
  }
  return completionItem.slice(prefixLenToRemove);
}

export function guesFuncSignature(text: string) {
    const lines = text.split("\n");

    if (lines.length < 2) return lines[0] || "";

    const secondLine = lines[1];
    if (secondLine.includes("(") || secondLine.includes(")")) {
        if (secondLine.startsWith(".. method:: ")) {
            return secondLine.substring(".. method:: ".length);
        }
        return secondLine;
    }

    return lines[0];
}