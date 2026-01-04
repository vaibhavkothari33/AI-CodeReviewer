"use client";

import { useState } from "react";

interface Issue {
  severity: "HIGH" | "MEDIUM" | "LOW";
  file: string;
  line?: string;
  description: string;
  suggestion: string;
}

interface ReviewResponse {
  summary: string;
  issues: Issue[];
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setStatus("");

    try {
      // Step 1: Analyze and index the repository
      setStatus("Analyzing repository and indexing code...");
      const analyzeResponse = await fetch("http://localhost:5000/github/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoUrl: repoUrl,
        }),
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || "Failed to analyze repository");
      }

      const analyzeData = await analyzeResponse.json();
      const repoName = analyzeData.repo;

      // Step 2: Review the code with AI
      setStatus("Generating AI review with Gemini...");
      const reviewResponse = await fetch("http://localhost:5000/github/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: repoName,
          query: query,
        }),
      });

      if (!reviewResponse.ok) {
        const errorData = await reviewResponse.json();
        throw new Error(errorData.error || "Failed to review repository");
      }

      const reviewData = await reviewResponse.json();
      setResult(reviewData);
      setStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "LOW":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black py-12 px-4">
      <main className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
            AI Code Reviewer
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Powered by Gemini AI · Analyze your GitHub repositories
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 mb-8">
          <div className="space-y-6">
            <div>
              <label htmlFor="repoUrl" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                GitHub Repository URL
              </label>
              <input
                id="repoUrl"
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                required
              />
            </div>

            <div>
              <label htmlFor="query" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                What would you like to review?
              </label>
              <textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Check for security vulnerabilities, Review authentication logic, Analyze error handling..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{status || "Processing..."}</span>
                </>
              ) : (
                <span>Review Code</span>
              )}
            </button>
          </div>
        </form>

        {/* Status */}
        {status && !error && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
            <p className="text-blue-800 dark:text-blue-400 font-medium">{status}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <p className="text-red-800 dark:text-red-400 font-medium">Error: {error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Review Summary</h2>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{result.summary}</p>
            </div>

            {/* Issues */}
            {result.issues.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  Issues Found ({result.issues.length})
                </h2>
                {result.issues.map((issue, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-6 border-l-4"
                    style={{
                      borderLeftColor:
                        issue.severity === "HIGH"
                          ? "#ef4444"
                          : issue.severity === "MEDIUM"
                          ? "#f59e0b"
                          : "#3b82f6",
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(
                            issue.severity
                          )}`}
                        >
                          {issue.severity}
                        </span>
                        <code className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                          {issue.file}
                          {issue.line && `:${issue.line}`}
                        </code>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Description</h3>
                        <p className="text-zinc-800 dark:text-zinc-200">{issue.description}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Suggestion</h3>
                        <p className="text-zinc-800 dark:text-zinc-200">{issue.suggestion}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
                <p className="text-green-800 dark:text-green-400 font-medium text-lg">
                  ✓ No issues found! The code looks good.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
