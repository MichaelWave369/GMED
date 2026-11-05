/**
 * GMED — Gerged & Mreened Evidence Department.
 * Verify what GitHub actually reports; never infer success from a slogan.
 * Pure logic, independent of browser, network, or GitHub credentials.
 */
export const SCHEMA = 'gmed-report:v1';
const goodConclusions=new Set(['success','neutral','skipped']);
const badConclusions=new Set(['failure','timed_out','cancelled','action_required','startup_failure','stale']);
const shaPattern=/^[a-f0-9]{40}$/i;
const ownerPattern=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const repoPattern=/^[A-Za-z0-9_.-]{1,100}$/;

export function parseTarget(input,number){
  if(typeof input!=='string')throw new Error('Enter a repository or GitHub pull request URL.');
  const raw=input.trim();
  let owner,repo,urlPr;
  const matched=raw.match(/^https:\/\/github\.com\/([^/]+)\/([^/?#]+)\/pull\/(\d+)\/?(?:\?.*)?$/i);
  if(matched){[,owner,repo,urlPr]=matched;}
  else {
    const parts=raw.split('/');
    if(parts.length!==2)throw new Error('Use owner/repo or a GitHub pull request URL.');
    [owner,repo]=parts;
  }
  if(!ownerPattern.test(owner)||!repoPattern.test(repo)||repo==='.'||repo==='..')
    throw new Error('Repository name is invalid.');
  const chosen=urlPr??String(number??'').trim();
  if(!/^\d+$/.test(chosen))throw new Error('Enter a positive pull request number.');
  const pr=Number(chosen);
  if(!Number.isSafeInteger(pr)||pr<1||pr>1_000_000_000)throw new Error('Pull request number is invalid.');
  return {owner,repo,fullName:owner+'/'+repo,number:pr,
    url:'https://github.com/'+owner+'/'+repo+'/pull/'+pr};
}

function checkRow(run){
  if(!run||typeof run!=='object')throw new Error('Invalid check run payload.');
  const name=String(run.name||'Unnamed check');
  const status=String(run.status||'unknown');
  const conclusion=run.conclusion==null?null:String(run.conclusion);
  let grade='pending';
  if(status==='completed'){
    grade=goodConclusions.has(conclusion)?'good':badConclusions.has(conclusion)?'bad':'unknown';
  }else if(!['queued','in_progress','pending','requested','waiting'].includes(status))grade='unknown';
  const html=typeof run.html_url==='string'&&/^https:\/\/github\.com\//.test(run.html_url)?run.html_url:null;
  return {name,kind:'check',status,conclusion,grade,url:html};
}
function statusRow(s){
  if(!s||typeof s!=='object')throw new Error('Invalid commit status payload.');
  const state=String(s.state||'unknown');
  const url=typeof s.target_url==='string'&&/^https:\/\//.test(s.target_url)?s.target_url:null;
  return {name:String(s.context||'Legacy status'),kind:'status',status:state,conclusion:null,
    grade:state==='success'?'good':state==='failure'||state==='error'?'bad':state==='pending'?'pending':'unknown',url};
}
export function assess({pull,checkRuns=[],commitStatuses=[],complete=true,observedAt=null}={}){
  if(!pull||typeof pull!=='object')throw new Error('Invalid pull request payload.');
  if(!Array.isArray(checkRuns)||!Array.isArray(commitStatuses))throw new Error('Invalid checks or statuses.');
  if(typeof complete!=='boolean')throw new Error('Invalid completeness flag.');
  const merged=pull.merged===true;
  const sha=typeof pull.merge_commit_sha==='string'&&shaPattern.test(pull.merge_commit_sha)
    ?pull.merge_commit_sha.toLowerCase():null;
  const rows=[...checkRuns.map(checkRow),...commitStatuses.map(statusRow)];
  const counts={total:rows.length,passed:rows.filter(r=>r.grade==='good'&&((r.kind==='check'&&r.conclusion==='success')||r.kind==='status')).length,accepted:rows.filter(r=>r.grade==='good').length,
    failed:rows.filter(r=>r.grade==='bad').length,pending:rows.filter(r=>r.grade==='pending').length,
    unknown:rows.filter(r=>r.grade==='unknown').length};
  let state,detail;
  if(!merged){
    state='NOT_MERGED';
    detail='GitHub has not confirmed this pull request as merged. Head-branch checks are not a merge.';
  }else if(!sha){
    state='UNVERIFIED';
    detail='Merged, but GitHub did not provide a usable merge commit SHA. Cannot check the merged result.';
  }else if(!complete){
    state='UNVERIFIED';
    detail='Check data is incomplete or was truncated; verification must fail closed.';
  }else if(counts.failed>0){
    state='FAILED';
    detail='Merged, but at least one observed check or status reports a failure for the merge commit.';
  }else if(counts.pending>0){
    state='PENDING';
    detail='Merged, but at least one observed check or status on the merge commit has not finished.';
  }else if(counts.unknown>0){
    state='UNVERIFIED';
    detail='Merged, but at least one check has an unrecognized outcome.';
  }else if(counts.total===0||!counts.passed>0){
    state='UNVERIFIED';
    detail='Merged, but no successful check could be established for the merge commit.';
  }else{
    state='GMED';
    detail='Merged, and every observed check/status on the merge commit completed without a reported failure, with at least one success.';
  }
  return {schema:SCHEMA,state,merged,sha,counts,checks:rows,
    pullUrl:typeof pull.html_url==='string'&&/^https:\/\/github\.com\//.test(pull.html_url)?pull.html_url:null,
    title:String(pull.title||'Untitled pull request'),number:Number(pull.number)||null,
    observedAt,
    detail,
    limits:'GMED reflects public GitHub API evidence at inspection time. This is not branch-protection verification, code review, independent execution, or proof that the software behaves correctly.'};
}
