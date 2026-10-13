import {githubStateData} from '../../lib/api-shared.js';
function send(res,status,data){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.end(JSON.stringify(data))}
export default async function handler(req,res){if(req.method!=='GET')return send(res,405,{error:'read-only endpoint'});try{return send(res,200,await githubStateData())}catch(error){return send(res,502,{error:error.message||String(error),owner:process.env.GITHUB_OWNER||'sonoxo'})}}
