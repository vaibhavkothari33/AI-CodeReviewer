export default function parseURL(url) {
    if (!url || typeof url !== 'string') {
        throw new Error("URL must be a valid string");
    }
    const cleaned = url
    .replace("https://github.com/", "")
    .replace(/\/$/, "");
    const [owner, repo] = cleaned.split("/");

    if (!owner || !repo) {
        throw new Error("Invalid Github Repo url format");
    }
    return { owner, repo };
}