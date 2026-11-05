import {parseTarget,assess} from './verifier.js';

const ROOT='https://api.github.com';
const MAX_PAGES=5;
function apiError(message,status){
  const error=new Error(message);
  error.status=status;
  return error;
}
async function get(path,fetcher=fetch){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  let response;
  try {
    response=await fetcher(ROOT+path,{headers:{
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'
    },signal:controller.signal});
  }catch(error){
    if(error?.name==='AbortError')throw apiError('GitHub request timed out. No evidence was certified.',0);
    throw apiError('Network request failed: '+(error?.message||'offline'),0);
  }finally{clearTimeout(timeout);}
  if(!response?.ok){
    const hint=response.status===403||response.status===429
      ?' GitHub may be rate-limiting anonymous requests.'
      :response.status===404?' Confirm the repository and PR are public and exist.':'';
    throw apiError('GitHub API returned HTTP '+response.status+'.'+hint,response.status);
  }
  try{
    const data=await response.json();
    return {data,link:response.headers?.get?.('link')||''};
  }catch{throw apiError('GitHub returned data that could not be decoded.',0);}
}
function hasNext(link){return /<[^>]+>;\s*rel="next"/.test(link);}
async function checksFor(owner,repo,sha,fetcher){
  let all=[],expected=null;
  for(let page=1;page<=MAX_PAGES;page++){
    const result=await get('/repos/'+owner+'/'+repo+'/commits/'+sha+'/check-runs?filter=latest&per_page=100&page='+page,fetcher);
    if(!Array.isArray(result.data?.check_runs)||!Number.isSafeInteger(result.data.total_count))
      throw apiError('Check-run response was malformed. Cannot certify.',0);
    all.push(...result.data.check_runs);
    expected=result.data.total_count;
    if(all.length>500)throw apiError('More than 500 check runs; verification limit reached.',0);
    if(!hasNext(result.link)){
      if(all.length!==expected)throw apiError('Incomplete check-run listing. Verification withheld.',0);
      return all;
    }
  }
  throw apiError('Check-run pagination limit reached; verification withheld.',0);
}
async function statusesFor(owner,repo,sha,fetcher){
  let all=[];
  for(let page=1;page<=MAX_PAGES;page++){
    const result=await get('/repos/'+owner+'/'+repo+'/commits/'+sha+'/status?per_page=100&page='+page,fetcher);
    if(!Array.isArray(result.data?.statuses))throw apiError('Commit-status response was malformed.',0);
    all.push(...result.data.statuses);
    if(!hasNext(result.link))return all;
  }
  throw apiError('Commit-status pagination limit reached; verification withheld.',0);
}
export async function inspect(input,number,{fetcher=fetch,clock=()=>new Date()}={}){
  const target=parseTarget(input,number);
  const result=await get('/repos/'+target.owner+'/'+target.repo+'/pulls/'+target.number,fetcher);
  const pull=result.data;
  if(!pull||pull.number!==target.number||typeof pull.merged!=='boolean')
    throw apiError('GitHub returned an unexpected pull request response.',0);
  let checks=[],statuses=[];
  if(pull.merged===true){
    if(typeof pull.merge_commit_sha==='string'&&/^[a-f0-9]{40}$/i.test(pull.merge_commit_sha)){
      [checks,statuses]=await Promise.all([
        checksFor(target.owner,target.repo,pull.merge_commit_sha,fetcher),
        statusesFor(target.owner,target.repo,pull.merge_commit_sha,fetcher)
      ]);
    }
  }
  const report=assess({pull,checkRuns:checks,commitStatuses:statuses,
    observedAt:clock().toISOString()});
  return {...report,target};
}
