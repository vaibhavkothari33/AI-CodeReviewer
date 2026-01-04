"use client";

import { useState, useEffect } from "react";

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
  chunksAnalyzed?: number;
  repo?: string;
  query?: string;
}

interface AnalyzeResponse {
  message: string;
  repo: string;
  owner?: string;
  totalFiles: number;
  totalChunks: number;
  vectorsStored: number;
  vectorsFailed: number;
  metadata?: RepoMetadata;
}

interface RepoMetadata {
  name: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  language: string | null;
  languages: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  defaultBranch: string;
  size: number;
  license: string | null;
  topics: string[];
  homepage: string | null;
  htmlUrl: string;
  owner: {
    login: string;
    avatarUrl: string;
    type: string;
  };
  hasIssues: boolean;
  hasProjects: boolean;
  hasWiki: boolean;
  archived: boolean;
  disabled: boolean;
}

type Step = "idle" | "analyzing" | "indexing" | "reviewing" | "complete";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [currentStep, setCurrentStep] = useState<Step>("idle");
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [repoMetadata, setRepoMetadata] = useState<RepoMetadata | null>(null);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  // Fetch repo metadata when URL changes
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!repoUrl || !repoUrl.includes("github.com")) {
        setRepoMetadata(null);
        return;
      }

      setFetchingMetadata(true);
      try {
        const response = await fetch(`${API_URL}/github/info`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ repoUrl: repoUrl.trim() }),
        });

        if (response.ok) {
          const data = await response.json();
          setRepoMetadata(data);
        } else {
          setRepoMetadata(null);
        }
      } catch (err) {
        setRepoMetadata(null);
      } finally {
        setFetchingMetadata(false);
      }
    };

    const timeoutId = setTimeout(fetchMetadata, 500);
    return () => clearTimeout(timeoutId);
  }, [repoUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setStatus("");
    setCurrentStep("analyzing");
    setProgress(0);
    setAnalyzeData(null);

    try {
      // Step 1: Analyze and index the repository
      setStatus("Fetching repository files...");
      setProgress(10);
      
      const analyzeResponse = await fetch(`${API_URL}/github/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
        }),
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || "Failed to analyze repository");
      }

      setProgress(40);
      setStatus("Chunking and generating embeddings...");
      setCurrentStep("indexing");

      const analyzeDataResponse: AnalyzeResponse = await analyzeResponse.json();
      setAnalyzeData(analyzeDataResponse);
      if (analyzeDataResponse.metadata) {
        setRepoMetadata(analyzeDataResponse.metadata);
      }
      setProgress(60);

      // Step 2: Review the code with AI
      setStatus("Generating AI review with Gemini...");
      setCurrentStep("reviewing");
      setProgress(70);

      const reviewResponse = await fetch(`${API_URL}/github/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: analyzeDataResponse.repo,
          query: query.trim(),
        }),
      });

      if (!reviewResponse.ok) {
        const errorData = await reviewResponse.json();
        throw new Error(errorData.error || "Failed to review repository");
      }

      setProgress(90);
      const reviewData: ReviewResponse = await reviewResponse.json();
      setResult(reviewData);
      setCurrentStep("complete");
      setProgress(100);
      setStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("");
      setCurrentStep("idle");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-300 dark:border-red-800";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800";
      case "LOW":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 border-gray-300 dark:border-gray-800";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 border-gray-300 dark:border-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black py-12 px-4">
      <main className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black text-black dark:text-white mb-3 tracking-tight">
            AI Code Reviewer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Powered by Gemini AI · Analyze your GitHub repositories with intelligent code review
          </p>
        </div>

        {/* Repository Metadata Card */}
        {repoMetadata && (
          <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg p-6 mb-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <div className="flex items-start gap-4 mb-4">
              <img 
                src={repoMetadata.owner.avatarUrl} 
                alt={repoMetadata.owner.login}
                className="w-16 h-16 rounded-full border-2 border-black dark:border-white"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-black dark:text-white">
                    {repoMetadata.fullName}
                  </h2>
                  {repoMetadata.archived && (
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded border border-black dark:border-white">
                      Archived
                    </span>
                  )}
                </div>
                {repoMetadata.description && (
                  <p className="text-gray-700 dark:text-gray-300 mb-3">{repoMetadata.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-black dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="font-semibold text-black dark:text-white">{formatNumber(repoMetadata.stars)}</span>
                    <span className="text-gray-600 dark:text-gray-400">stars</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-black dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v.5a1 1 0 11-2 0V14A5 5 0 0011 9H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold text-black dark:text-white">{formatNumber(repoMetadata.forks)}</span>
                    <span className="text-gray-600 dark:text-gray-400">forks</span>
                  </div>
                  {repoMetadata.language && (
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-black dark:bg-white"></div>
                      <span className="font-semibold text-black dark:text-white">{repoMetadata.language}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-black dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold text-black dark:text-white">{repoMetadata.openIssues}</span>
                    <span className="text-gray-600 dark:text-gray-400">open issues</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-black dark:text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">Updated {formatDate(repoMetadata.updatedAt)}</span>
                  </div>
                </div>
                {repoMetadata.topics.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {repoMetadata.topics.slice(0, 5).map((topic) => (
                      <span 
                        key={topic}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium rounded border border-black dark:border-white"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Creative Loader */}
        {loading && (
          <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg p-8 mb-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-black dark:text-white">Processing</h3>
                <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{progress}%</span>
              </div>
              {/* Animated progress bar */}
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 border-2 border-black dark:border-white rounded-full overflow-hidden">
                  <div 
                  className="h-full bg-black dark:bg-white transition-all duration-300 relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] dark:bg-[linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.3)_50%,transparent_100%)] animate-shimmer"></div>
                </div>
              </div>
            </div>
            
            {/* Animated step indicators */}
            <div className="flex items-center justify-between mb-4">
              {["Analyzing", "Indexing", "Reviewing"].map((step, index) => {
                const stepNum = index + 1;
                const isActive = 
                  (step === "Analyzing" && currentStep === "analyzing") ||
                  (step === "Indexing" && currentStep === "indexing") ||
                  (step === "Reviewing" && currentStep === "reviewing");
                const isComplete = 
                  (step === "Analyzing" && ["indexing", "reviewing", "complete"].includes(currentStep)) ||
                  (step === "Indexing" && ["reviewing", "complete"].includes(currentStep)) ||
                  (step === "Reviewing" && currentStep === "complete");

                return (
                  <div key={step} className="flex-1 flex flex-col items-center">
                    <div className="relative mb-2">
                      {isComplete ? (
                        <div className="w-12 h-12 rounded-full bg-black dark:bg-white flex items-center justify-center border-2 border-black dark:border-white">
                          <svg className="w-6 h-6 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : isActive ? (
                        <div className="w-12 h-12 rounded-full border-4 border-black dark:border-white border-t-transparent dark:border-t-transparent animate-spin"></div>
                      ) : (
                        <div className="w-12 h-12 rounded-full border-2 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <span className="text-gray-400 dark:text-gray-600 font-bold">{stepNum}</span>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs font-semibold ${isActive || isComplete ? "text-black dark:text-white" : "text-gray-400 dark:text-gray-600"}`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {status && (
              <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 border border-black dark:border-white rounded">
                <p className="text-sm font-mono text-black dark:text-white">{status}</p>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg p-8 mb-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          <div className="space-y-6">
            <div>
              <label htmlFor="repoUrl" className="block text-sm font-bold text-black dark:text-white mb-2">
                GitHub Repository URL
              </label>
              <div className="relative">
                <input
                  id="repoUrl"
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className="w-full px-4 py-3 rounded-lg border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:outline-none transition font-mono"
                  required
                  disabled={loading}
                />
                {fetchingMetadata && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Enter a public GitHub repository URL
              </p>
            </div>

            <div>
              <label htmlFor="query" className="block text-sm font-bold text-black dark:text-white mb-2">
                What would you like to review?
              </label>
              <textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Check for security vulnerabilities, Review authentication logic, Analyze error handling..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:outline-none transition resize-none"
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Describe what aspects of the code you want reviewed
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 border-2 border-black dark:border-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] active:shadow-none"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
                  <span>{status || "Processing..."}</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Start Code Review</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Analysis Summary */}
        {analyzeData && (
          <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg p-6 mb-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <h3 className="text-lg font-bold text-black dark:text-white mb-4">Repository Analysis Complete</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 border-2 border-black dark:border-white rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Files</p>
                <p className="text-2xl font-black text-black dark:text-white">{analyzeData.totalFiles}</p>
              </div>
              <div className="p-3 border-2 border-black dark:border-white rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Chunks</p>
                <p className="text-2xl font-black text-black dark:text-white">{analyzeData.totalChunks}</p>
              </div>
              <div className="p-3 border-2 border-black dark:border-white rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Vectors Stored</p>
                <p className="text-2xl font-black text-black dark:text-white">{analyzeData.vectorsStored}</p>
              </div>
              {analyzeData.vectorsFailed > 0 && (
                <div className="p-3 border-2 border-red-500 dark:border-red-400 rounded">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Failed</p>
                  <p className="text-2xl font-black text-red-600 dark:text-red-400">{analyzeData.vectorsFailed}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400 rounded-lg p-4 mb-8">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-red-800 dark:text-red-400 font-semibold mb-1">Error</h3>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-black dark:text-white">Review Summary</h2>
                {result.chunksAnalyzed && (
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {result.chunksAnalyzed} chunks
                  </span>
                )}
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{result.summary}</p>
            </div>

            {/* Issues */}
            {result.issues.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-black dark:text-white">
                    Issues Found
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 rounded-full text-xs font-bold border border-black dark:border-white">
                      {result.issues.filter(i => i.severity === "HIGH").length} High
                    </span>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-full text-xs font-bold border border-black dark:border-white">
                      {result.issues.filter(i => i.severity === "MEDIUM").length} Medium
                    </span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 rounded-full text-xs font-bold border border-black dark:border-white">
                      {result.issues.filter(i => i.severity === "LOW").length} Low
                    </span>
                  </div>
                </div>
                {result.issues.map((issue, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg p-6 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-shadow"
                    style={{
                      borderLeftWidth: "8px",
                      borderLeftColor:
                        issue.severity === "HIGH"
                          ? "#ef4444"
                          : issue.severity === "MEDIUM"
                          ? "#f59e0b"
                          : "#6b7280",
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getSeverityColor(
                            issue.severity
                          )}`}
                        >
                          {issue.severity}
                        </span>
                        <code className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded border border-black dark:border-white font-mono">
                          {issue.file}
                          {issue.line && `:${issue.line}`}
                        </code>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Description</h3>
                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{issue.description}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Suggestion</h3>
                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{issue.suggestion}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-16 w-16 rounded-full bg-black dark:bg-white flex items-center justify-center border-2 border-black dark:border-white">
                    <svg className="h-8 w-8 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-black dark:text-white font-bold text-lg">
                    No issues found!
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    The code looks good based on your review criteria.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
