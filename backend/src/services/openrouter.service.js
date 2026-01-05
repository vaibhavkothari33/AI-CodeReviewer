import axios from "axios";

let apiKey = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Default model - using free tier models
// Options: "meta-llama/llama-3.2-3b-instruct:free", "google/gemini-flash-1.5", "anthropic/claude-3-haiku"
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.2-3b-instruct:free";

// Headers for OpenRouter API
const getHeaders = () => ({
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:5000', // Optional: your site URL
  'X-Title': 'AI Code Reviewer', // Optional: your app name
});

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.response?.status === 429 || 
                         error.message?.includes("429") || 
                         error.message?.toLowerCase().includes("quota") ||
                         error.message?.toLowerCase().includes("rate limit");
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        const retryAfter = error.response?.headers?.['retry-after'] || 
                          error.message?.match(/retry in (\d+\.?\d*)s/i);
        const waitTime = retryAfter ? (typeof retryAfter === 'string' ? parseFloat(retryAfter) * 1000 : retryAfter * 1000) : delay;
        
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
      console.log(`Sending prompt to OpenRouter (${prompt.length} chars) using model: ${DEFAULT_MODEL}...`);
      
      const response = await axios.post(OPENROUTER_API_URL, {
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a senior software engineer performing a professional code review. Always respond with valid JSON only, no markdown, no code blocks."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" }, // Force JSON response
      }, {
        headers: getHeaders(),
        timeout: 60000
      });

      if (!response.data || !response.data.choices || !response.data.choices[0]) {
        throw new Error("Invalid response from OpenRouter API");
      }

      const responseText = response.data.choices[0].message.content;
      
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
          throw new Error("Invalid response structure from AI model");
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
    console.error("OpenRouter API Error Details:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      code: error.code
    });
    
    if (error.response?.status === 401 || 
        errorString.includes("api key") || 
        errorString.includes("authentication") ||
        errorString.includes("unauthorized")) {
      console.error("OpenRouter API key error detected");
      throw new Error("Invalid or missing OpenRouter API key. Please check your OPENROUTER_API_KEY in the .env file. Get your API key from: https://openrouter.ai/keys");
    } else if (error.response?.status === 429 || 
               errorString.includes("quota") || 
               errorString.includes("rate limit")) {
      throw new Error("OpenRouter API rate limit exceeded. Please try again later or upgrade your plan.");
    } else if (error.response?.status === 400) {
      throw new Error(`OpenRouter API error: ${error.response?.data?.error?.message || error.message}`);
    } else {
      console.error("OpenRouter API error:", error);
      throw new Error(`Failed to generate review: ${error.message || 'Unknown error'}`);
    }
  }
}

