import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI("AIzaSyCxGwQpnD7LVqwpU2RBQPRhsREIXmXskMs");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function reviewWithGemini(prompt) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Failed to parse JSON response:", responseText);
    // Return a fallback structure if JSON parsing fails
    return {
      summary: "Error parsing review response",
      issues: [{
        severity: "MEDIUM",
        file: "unknown",
        description: "Failed to parse structured review",
        suggestion: responseText.substring(0, 200)
      }]
    };
  }
}
