export default function validateRepoUrl(req, res, next) {
  const { repoUrl } = req.body;

  if (!repoUrl || typeof repoUrl !== 'string') {
    return res.status(400).json({ error: "repoUrl is required and must be a string" });
  }

  // More comprehensive URL validation
  const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w\-\.]+\/[\w\-\.]+(\/)?$/;
  
  if (!githubUrlPattern.test(repoUrl.trim())) {
    return res.status(400).json({ 
      error: "Invalid GitHub repository URL format",
      expected: "https://github.com/owner/repository"
    });
  }

  next();
}
