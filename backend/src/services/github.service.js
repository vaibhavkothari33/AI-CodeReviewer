import axios from "axios";

const ALLOWED_EXT = [".ts",".py",".jsx",".js",".md"];
const GITHUB_API = "https://api.github.com";

export async function getRepoFiles(owner,repo,path=""){
    const files = [];

    const res = await axios.get(
        `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
        {
            headers:{
                Authorization:`token ${process.env.GITHUB_TOKEN}`
            }
        }
    );

    for (const item of res.data){
        if(item.type === "file"){
            if(ALLOWED_EXT.some(ext=> item.name.endsWith(ext))){
                const content = await axios.get(item.download_url);
                files.push({
                    path:item.path,
                    content:content.data,
                });
            }
        }
        if(item.type === "dir"){
            const nestedFiles = await getRepoFiles(owner,repo,item.path);
            files.push(...nestedFiles);
        }
    }
    return files;
}