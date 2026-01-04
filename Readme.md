# AI Code Reviewer

An intelligent code review system that analyzes GitHub repositories using AI. The system breaks down codebases into chunks, generates embeddings, and uses vector search with Gemini AI to provide comprehensive code reviews.

## 🚀 Features

- **Intelligent Code Analysis**: Automatically fetches and analyzes GitHub repositories
- **Smart Chunking**: Breaks code into contextually meaningful chunks with overlap
- **Vector Search**: Uses embeddings to find relevant code sections
- **AI-Powered Reviews**: Leverages Google Gemini AI for intelligent code review
- **Modern UI**: Beautiful, responsive frontend with real-time progress tracking
- **Error Handling**: Comprehensive error handling and validation throughout

## 📋 Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Google Gemini API Key
- DataStax Astra DB account (for vector storage)
- GitHub Personal Access Token (optional, for higher rate limits)

## 🛠️ Setup

### 1. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```env
PORT=5000
NODE_ENV=development
EMBEDDING_SERVICE_URL=http://localhost:8001
GITHUB_TOKEN=your_github_token_here
GEMINI_API_KEY=your_gemini_api_key_here
ASTRA_DB_TOKEN=your_astra_db_token_here
ASTRA_DB_ENDPOINT=your_astra_db_endpoint_here
FRONTEND_URL=http://localhost:3000
```

### 2. Embedding Service Setup

```bash
cd embedding-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file (optional):

```env
PORT=8001
```

Start the service:

```bash
uvicorn main:app --port 8001
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Start the development server:

```bash
npm run dev
```

## 🎯 Usage

1. Start all services:
   - Embedding service: `uvicorn main:app --port 8001` (in embedding-service directory)
   - Backend: `npm run start` (in backend directory)
   - Frontend: `npm run dev` (in frontend directory)

2. Open http://localhost:3000 in your browser

3. Enter a GitHub repository URL and a review query

4. The system will:
   - Fetch and analyze the repository
   - Chunk the code intelligently
   - Generate embeddings
   - Store vectors in Astra DB
   - Search for relevant code
   - Generate AI-powered review

## 📡 API Endpoints

### POST `/github/analyze`
Analyze and index a GitHub repository.

**Request:**
```json
{
  "repoUrl": "https://github.com/username/repository"
}
```

**Response:**
```json
{
  "message": "Repo indexed successfully",
  "repo": "repository",
  "totalFiles": 10,
  "totalChunks": 45,
  "vectorsStored": 45,
  "vectorsFailed": 0
}
```

### POST `/github/review`
Review code based on a query.

**Request:**
```json
{
  "repo": "repository",
  "query": "Check for security vulnerabilities",
  "topK": 5
}
```

**Response:**
```json
{
  "summary": "Review summary...",
  "issues": [
    {
      "severity": "HIGH",
      "file": "src/auth.js",
      "line": "42",
      "description": "Issue description",
      "suggestion": "Fix suggestion"
    }
  ],
  "chunksAnalyzed": 5
}
```

### POST `/github/search`
Search for code in indexed repositories.

**Request:**
```json
{
  "query": "authentication logic",
  "repo": "repository",
  "topK": 5
}
```

## 🔧 Improvements Made

### Backend
- ✅ Environment variable configuration for all services
- ✅ Comprehensive error handling and validation
- ✅ Improved code chunking with overlap for context
- ✅ Better GitHub API error handling
- ✅ Duplicate prevention in vector storage
- ✅ Request logging and health checks
- ✅ Input validation throughout
- ✅ Better error messages with status codes

### Embedding Service
- ✅ Added requirements.txt with all dependencies
- ✅ CORS configuration
- ✅ Error handling and validation
- ✅ Health check endpoint
- ✅ Better response handling
- ✅ Fixed port configuration

### Frontend
- ✅ Environment variable support
- ✅ Real-time progress tracking
- ✅ Step-by-step progress indicators
- ✅ Better error messages
- ✅ Improved UI/UX with modern design
- ✅ Analysis summary display
- ✅ Issue severity badges and filtering
- ✅ Better loading states

## 📝 Notes

- The embedding service uses the `all-MiniLM-L6-v2` model (384 dimensions)
- Maximum file size is 1MB per file
- Maximum 500 files per repository
- Supported file extensions: `.ts`, `.py`, `.jsx`, `.js`, `.md`, `.tsx`, `.json`, `.yaml`, `.yml`
- Chunks are created with 30 lines and 5-line overlap for context preservation
- The system skips common directories like `node_modules`, `.git`, `dist`, `build`, etc.

## 🐛 Troubleshooting

- **Embedding service unreachable**: Make sure the embedding service is running on port 8001
- **GitHub API rate limits**: Add a `GITHUB_TOKEN` to your backend `.env` file
- **Astra DB connection errors**: Verify your `ASTRA_DB_TOKEN` and `ASTRA_DB_ENDPOINT` are correct
- **Gemini API errors**: Check that your `GEMINI_API_KEY` is valid and has quota available
