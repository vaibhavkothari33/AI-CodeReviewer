export function buildReviewPrompt(chunks, repoName, userQuery) {
  const codeContext = chunks
    .map(
      (chunk, idx) =>
`--- FILE ${idx + 1}: ${chunk.path} ---
${chunk.content}`,
    )
    .join("\n\n");

  return `
You are a senior software engineer performing a professional code review.

Repository: ${repoName}

User request:
"${userQuery}"

Below are relevant code excerpts from the repository:

${codeContext}

Your task:
1. Analyze the code for issues, risks, and bad practices
2. Provide specific, actionable suggestions for improvement
3. Be concise and technical

IMPORTANT: You must respond with ONLY valid JSON in the following structure (no markdown, no code blocks, no extra text):

{
  "summary": "A brief 2-3 sentence overview of the code review findings",
  "issues": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "file": "exact file path from the code context",
      "line": "line number if identifiable (optional)",
      "description": "Clear description of the issue or concern",
      "suggestion": "Specific actionable recommendation to fix or improve"
    }
  ]
}

Rules:
- If no issues are found, return an empty issues array
- Severity levels: HIGH (security, critical bugs), MEDIUM (performance, maintainability), LOW (style, minor improvements)
- Always include file paths from the provided code context
- Keep descriptions concise but informative
- Provide concrete suggestions, not vague advice
`;
}
