import { GoogleGenerativeAI } from "@google/generative-ai";

let apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey);

// Export apiKey for use in error handling
const GEMINI_API_KEY_VALUE = apiKey;

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.message?.includes("429") || 
                         error.message?.toLowerCase().includes("quota") ||
                         error.message?.toLowerCase().includes("rate limit") ||
                         error.status === 429;
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        const retryAfter = error.message?.match(/retry in (\d+\.?\d*)s/i);
        const waitTime = retryAfter ? parseFloat(retryAfter[1]) * 1000 : delay;
        
        console.warn(`Rate limit hit, retrying in ${waitTime/1000}s (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}

export async function reviewWithGemini(prompt) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error("Prompt must be a non-empty string");
  }

  // Limit prompt size to reduce token usage (approximately 8000 tokens max)
  const MAX_PROMPT_LENGTH = 30000; // ~8000 tokens (rough estimate)
  if (prompt.length > MAX_PROMPT_LENGTH) {
    console.warn(`Prompt is too long (${prompt.length} chars), truncating to ${MAX_PROMPT_LENGTH} chars`);
    prompt = prompt.substring(0, MAX_PROMPT_LENGTH) + "\n\n[Content truncated due to length...]";
  }

  try {
    return await retryWithBackoff(async () => {
      // Use gemini-1.5-flash as it has better free tier support
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash", // Free tier friendly model
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3, // Lower temperature for more consistent reviews
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048, // Limit output to reduce costs
        }
      });

      console.log(`Sending prompt to Gemini (${prompt.length} chars)...`);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
    
      // Clean up response text (remove markdown code blocks if present)
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
    
      try {
        const parsed = JSON.parse(cleanedText);
        
        // Validate response structure
        if (!parsed.summary || !Array.isArray(parsed.issues)) {
          throw new Error("Invalid response structure from Gemini");
        }
        
        return parsed;
      } catch (parseError) {
        console.error("Failed to parse JSON response:", parseError);
        console.error("Response text:", responseText.substring(0, 500));
        
        // Return a fallback structure if JSON parsing fails
        return {
          summary: "Error parsing review response. The AI review completed but the response format was invalid.",
          issues: [{
            severity: "MEDIUM",
            file: "unknown",
            description: "Failed to parse structured review response",
            suggestion: "Please try again or check the AI service configuration"
          }],
          rawResponse: responseText.substring(0, 500) // Include first 500 chars for debugging
        };
      }
    });
  } catch (error) {
    // Check for various API key related errors
    const errorMessage = error.message || String(error);
    const errorString = errorMessage.toLowerCase();
    
    // Log full error for debugging
    console.error("Gemini API Error Details:", {
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data
    });
    
    if (errorString.includes("api_key") || 
        errorString.includes("api key") || 
        errorString.includes("invalid api key") ||
        errorString.includes("authentication") ||
        errorString.includes("unauthorized") ||
        errorString.includes("permission denied") ||
        error.code === 401 ||
        error.response?.status === 401) {
      console.error("Gemini API key error detected");
      console.error("API Key (first 10 chars):", GEMINI_API_KEY_VALUE.substring(0, 10));
      throw new Error("Invalid or missing Gemini API key. Please check your GEMINI_API_KEY in the .env file. Make sure there are no quotes around the key. Get your API key from: https://makersuite.google.com/app/apikey");
    } else if (errorString.includes("quota") || 
               errorString.includes("rate limit") ||
               errorString.includes("resource exhausted") ||
               error.code === 429) {
      throw new Error("Gemini API rate limit exceeded. Please try again later or upgrade your API quota.");
    } else if (errorString.includes("model") || errorString.includes("not found")) {
      console.error("Gemini model error:", error);
      throw new Error(`Gemini model error: ${error.message}. The model 'gemini-2.0-flash' may not be available. Try 'gemini-1.5-flash' or 'gemini-1.5-pro'.`);
    } else {
      console.error("Gemini API error:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        status: error.status,
        stack: error.stack
      });
      throw new Error(`Failed to generate review: ${error.message || 'Unknown error'}`);
    }
  }
}
