import {palantirStatusData} from '../../lib/api-shared.js';
function send(res,status,data){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.end(JSON.stringify(data))}
export default function handler(req,res){if(req.method!=='GET')return send(res,405,{error:'read-only endpoint'});return send(res,200,palantirStatusData())}
