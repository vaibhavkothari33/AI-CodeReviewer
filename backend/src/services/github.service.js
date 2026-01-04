import axios from "axios";

const ALLOWED_EXT = [".ts", ".py", ".jsx", ".js", ".md", ".tsx", ".json", ".yaml", ".yml"];
const GITHUB_API = "https://api.github.com";
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB max file size
const MAX_FILES = 500; // Limit total files to prevent timeout

// Create axios instance with timeout
const githubClient = axios.create({
    baseURL: GITHUB_API,
    timeout: 30000, // 30 seconds
    headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Reviewer'
    }
});

export async function getRepoFiles(owner, repo, path = "", fileCount = { current: 0 }) {
    if (!owner || !repo) {
        throw new Error("Owner and repo are required");
    }

    if (fileCount.current >= MAX_FILES) {
        console.warn(`Reached maximum file limit of ${MAX_FILES}`);
        return [];
    }

    const files = [];

    try {
        const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
        const headers = {};
        
        // Add token if available (optional for public repos)
        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
        }

        const res = await githubClient.get(url, { headers });

        // Handle single file response
        if (res.data.type === "file") {
            if (ALLOWED_EXT.some(ext => res.data.name.endsWith(ext))) {
                if (res.data.size > MAX_FILE_SIZE) {
                    console.warn(`Skipping large file: ${res.data.path} (${res.data.size} bytes)`);
                    return files;
                }
                
                try {
                    const content = await axios.get(res.data.download_url, { 
                        timeout: 10000,
                        maxContentLength: MAX_FILE_SIZE,
                        responseType: 'text', // Ensure we get text, not binary
                    });
                    
                    // Ensure content is a string
                    let contentData = content.data;
                    if (Buffer.isBuffer(contentData)) {
                        contentData = contentData.toString('utf8');
                    } else if (typeof contentData !== 'string') {
                        contentData = String(contentData);
                    }
                    
                    files.push({
                        path: res.data.path,
                        content: contentData,
                    });
                    fileCount.current++;
                } catch (err) {
                    console.warn(`Failed to fetch content for ${res.data.path}:`, err.message);
                }
            }
            return files;
        }

        // Handle directory response
        for (const item of res.data) {
            if (fileCount.current >= MAX_FILES) {
                break;
            }

            if (item.type === "file") {
                if (ALLOWED_EXT.some(ext => item.name.endsWith(ext))) {
                    // Skip large files
                    if (item.size > MAX_FILE_SIZE) {
                        console.warn(`Skipping large file: ${item.path} (${item.size} bytes)`);
                        continue;
                    }

                    try {
                        const content = await axios.get(item.download_url, { 
                            timeout: 10000,
                            maxContentLength: MAX_FILE_SIZE,
                            responseType: 'text', // Ensure we get text, not binary
                        });
                        
                        // Ensure content is a string
                        let contentData = content.data;
                        if (Buffer.isBuffer(contentData)) {
                            contentData = contentData.toString('utf8');
                        } else if (typeof contentData !== 'string') {
                            contentData = String(contentData);
                        }
                        
                        files.push({
                            path: item.path,
                            content: contentData,
                        });
                        fileCount.current++;
                    } catch (err) {
                        console.warn(`Failed to fetch content for ${item.path}:`, err.message);
                    }
                }
            } else if (item.type === "dir") {
                // Skip common directories that usually don't contain source code
                const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'venv', '__pycache__', '.venv'];
                if (!skipDirs.includes(item.name)) {
                    try {
                        const nestedFiles = await getRepoFiles(owner, repo, item.path, fileCount);
                        files.push(...nestedFiles);
                    } catch (err) {
                        console.warn(`Failed to fetch directory ${item.path}:`, err.message);
                    }
                }
            }
        }
    } catch (err) {
        if (err.response) {
            if (err.response.status === 404) {
                throw new Error(`Repository ${owner}/${repo} not found or is private`);
            } else if (err.response.status === 403) {
                throw new Error("GitHub API rate limit exceeded. Please add GITHUB_TOKEN to increase limits.");
            } else {
                throw new Error(`GitHub API error: ${err.response.status} - ${err.response.data?.message || 'Unknown error'}`);
            }
        } else if (err.request) {
            throw new Error("Failed to connect to GitHub API. Please check your internet connection.");
        } else {
            throw new Error(`Error fetching repository files: ${err.message}`);
        }
    }

    return files;
}

export async function getRepoMetadata(owner, repo) {
    if (!owner || !repo) {
        throw new Error("Owner and repo are required");
    }

    try {
        const headers = {};
        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
        }

        // Fetch repository metadata and languages
        const [repoData, languagesData] = await Promise.all([
            githubClient.get(`/repos/${owner}/${repo}`, { headers }),
            githubClient.get(`/repos/${owner}/${repo}/languages`, { headers }).catch(() => ({ data: {} }))
        ]);

        const repoInfo = repoData.data;
        const languages = languagesData.data || {};

        return {
            name: repoInfo.name,
            fullName: repoInfo.full_name,
            description: repoInfo.description,
            stars: repoInfo.stargazers_count,
            forks: repoInfo.forks_count,
            watchers: repoInfo.watchers_count,
            openIssues: repoInfo.open_issues_count,
            language: repoInfo.language,
            languages: repoInfo.languages_url ? await githubClient.get(repoInfo.languages_url, { headers }).then(r => r.data).catch(() => ({})) : {},
            createdAt: repoInfo.created_at,
            updatedAt: repoInfo.updated_at,
            pushedAt: repoInfo.pushed_at,
            defaultBranch: repoInfo.default_branch,
            size: repoInfo.size,
            license: repoInfo.license?.name || null,
            topics: repoInfo.topics || [],
            homepage: repoInfo.homepage,
            htmlUrl: repoInfo.html_url,
            owner: {
                login: repoInfo.owner.login,
                avatarUrl: repoInfo.owner.avatar_url,
                type: repoInfo.owner.type,
            },
            hasIssues: repoInfo.has_issues,
            hasProjects: repoInfo.has_projects,
            hasWiki: repoInfo.has_wiki,
            archived: repoInfo.archived,
            disabled: repoInfo.disabled,
            languages: languages,
        };
    } catch (err) {
        if (err.response) {
            if (err.response.status === 404) {
                throw new Error(`Repository ${owner}/${repo} not found or is private`);
            } else if (err.response.status === 403) {
                throw new Error("GitHub API rate limit exceeded. Please add GITHUB_TOKEN to increase limits.");
            } else {
                throw new Error(`GitHub API error: ${err.response.status} - ${err.response.data?.message || 'Unknown error'}`);
            }
        } else if (err.request) {
            throw new Error("Failed to connect to GitHub API. Please check your internet connection.");
        } else {
            throw new Error(`Error fetching repository metadata: ${err.message}`);
        }
    }
}