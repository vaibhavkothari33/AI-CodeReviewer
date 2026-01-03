// export default function validateRepoUrl(req,res,next){
//     const {repoURL} = req.body;
//     if(!repoURL || !repoURL.includes("github.com")){
//         return res.status(400).json({error:"Invalid github repo URL"});
//     }
//     next();
// }
export default function validateRepoUrl(req, res, next) {
  const { repoUrl } = req.body;

  if (!repoUrl || !repoUrl.includes("github.com")) {
    return res.status(400).json({ error: "Invalid GitHub repo URL" });
  }

  next();
}
