export default function validateRepoUrl(req, res, next) {
  const { repoUrl } = req.body;

  if (!repoUrl || !repoUrl.includes("github.com")) {
    return res.status(400).json({ error: "Invalid GitHub repo URL" });
  }

  next();
}
