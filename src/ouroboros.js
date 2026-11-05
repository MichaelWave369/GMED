/**
 * GMED R2 / OUROBOROS
 * Independent re-observation and independent decision algorithm.
 * Deliberately DOES NOT import the primary GMED inspector or its classifier.
 *
 * "Independent" here means separate implementation and a fresh GitHub read,
 * not a separate authority, organization, credential, or cryptographic attestation.
 */
export const OUROBOROS_SCHEMA='gmed-ouroboros:v1';
export const DEFAULT_TRUST_GRAPH=[
  {id:'github-public-api',kind:'source',dependsOn:[]},
  {id:'gmed-primary',kind:'verifier',dependsOn:['github-public-api']},
  {id:'ouroboros-auditor',kind:'verifier',dependsOn:['github-public-api','gmed-primary']}
];
const SHA=/^[a-f0-9]{40}$/i;
const SAFE_OWNER=/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i;
const SAFE_REPO=/^[a-z0-9_.-]{1,100}$/i;
const ACCEPTED=new Set(['success','neutral','skipped']);
const NEGATIVE=new Set(['failure','timed_out','cancelled','action_required','startup_failure','stale']);
const WAITING=new Set(['queued','in_progress','pending','requested','waiting']);
const BASE='https://api.github.com';
const PAGE_LIMIT=5;

function insist(value,message){if(!value)throw new Error(message);}
function normalize(record){
  insist(record&&typeof record==='object','Invalid evidence item');
  const kind=record.kind;
  insist(kind==='check'||kind==='status','Unknown signal kind');
  const name=String(record.name||'');
  const status=String(record.status||'');
  const conclusion=kind==='check'?(record.conclusion==null?null:String(record.conclusion)):null;
  insist(name.length>0,'Signal has no name');
  return {kind,name,status,conclusion};
}
function classification(item){
  if(item.kind==='status'){
    if(item.status==='success')return 'good';
    if(item.status==='error'||item.status==='failure')return 'bad';
    if(item.status==='pending')return 'pending';
    return 'unknown';
  }
  if(item.status==='completed'){
    if(ACCEPTED.has(item.conclusion))return 'good';
    if(NEGATIVE.has(item.conclusion))return 'bad';
    return 'unknown';
  }
  return WAITING.has(item.status)?'pending':'unknown';
}
function fingerprint(item){
  return JSON.stringify([item.kind,item.name,item.status,item.conclusion]);
}
function sortedFingerprints(items){return items.map(x=>fingerprint(normalize(x))).sort();}

function independentlyGrade({merged,mergeSha,signals}){
  const groups={total:signals.length,passed:0,accepted:0,failed:0,pending:0,unknown:0};
  for(const raw of signals){
    const item=normalize(raw);
    const grade=classification(item);
    if(grade==='good'){
      groups.accepted++;
      if(item.kind==='status'||item.conclusion==='success')groups.passed++;
    }else if(grade==='bad')groups.failed++;
    else if(grade==='pending')groups.pending++;
    else groups.unknown++;
  }
  let state='UNVERIFIED';
  if(!merged)state='NOT_MERGED';
  else if(!SHA.test(mergeSha||''))state='UNVERIFIED';
  else if(groups.failed)state='FAILED';
  else if(groups.pending)state='PENDING';
  else if(groups.unknown)state='UNVERIFIED';
  else if(groups.passed)state='GMED';
  return {state,counts:groups};
}

export function analyzeTrustGraph(graph=DEFAULT_TRUST_GRAPH){
  const errors=[];
  if(!Array.isArray(graph)||graph.length<3||graph.length>12)
    return {valid:false,cycles:[],errors:['Trust graph requires 3–12 declared nodes.']};
  const nodes=new Map();
  for(const node of graph){
    if(!node||typeof node!=='object'||typeof node.id!=='string'||!/^[a-z0-9-]{1,48}$/.test(node.id)
       ||(node.kind!=='source'&&node.kind!=='verifier')||!Array.isArray(node.dependsOn)){
      errors.push('Malformed trust node.');
      continue;
    }
    if(nodes.has(node.id))errors.push('Duplicate trust node: '+node.id);
    nodes.set(node.id,node);
  }
  for(const [id,node] of nodes){
    if(node.kind==='source'&&node.dependsOn.length)errors.push('Source cannot depend on a verifier: '+id);
    for(const dep of node.dependsOn){
      if(typeof dep!=='string'||!nodes.has(dep))errors.push('Missing dependency for '+id);
      if(dep===id)errors.push('Direct self-certification: '+id);
    }
    if(new Set(node.dependsOn).size!==node.dependsOn.length)errors.push('Repeated dependency: '+id);
  }
  const cycles=[];
  const stack=[],marked=new Map();
  function visit(id){
    const state=marked.get(id)||0;
    if(state===2)return;
    if(state===1){cycles.push([...stack.slice(stack.indexOf(id)),id]);return;}
    marked.set(id,1);stack.push(id);
    for(const dep of nodes.get(id)?.dependsOn||[])if(nodes.has(dep))visit(dep);
    stack.pop();marked.set(id,2);
  }
  for(const id of nodes.keys())visit(id);
  const root=nodes.get('github-public-api');
  const primary=nodes.get('gmed-primary');
  const auditor=nodes.get('ouroboros-auditor');
  if(!root||root.kind!=='source'||root.dependsOn.length)
    errors.push('Missing independent declared GitHub source root.');
  if(!primary||primary.kind!=='verifier'||!primary.dependsOn.includes('github-public-api'))
    errors.push('GMED primary must directly observe GitHub.');
  if(!auditor||auditor.kind!=='verifier'||!auditor.dependsOn.includes('github-public-api')
    ||!auditor.dependsOn.includes('gmed-primary'))
    errors.push('Auditor must directly observe GitHub and inspect the primary report.');
  if(cycles.length)errors.push('Circular trust dependency detected.');
  return {valid:errors.length===0,cycles,errors,
    nodes:graph.map(n=>({id:n.id,kind:n.kind,dependsOn:[...n.dependsOn]}))};
}

function validateTarget(target){
  insist(target&&typeof target==='object','Missing target on primary evidence.');
  const owner=target.owner,repo=target.repo,number=target.number;
  insist(typeof owner==='string'&&SAFE_OWNER.test(owner),'Invalid evidence owner.');
  insist(typeof repo==='string'&&SAFE_REPO.test(repo)&&repo!=='.'&&repo!=='..','Invalid evidence repo.');
  insist(Number.isSafeInteger(number)&&number>0&&number<=1_000_000_000,'Invalid evidence PR number.');
  insist(target.fullName===owner+'/'+repo,'Target identity does not agree with repository.');
  return {owner,repo,number};
}

async function independentGet(path,fetcher){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  let response;
  try{
    response=await fetcher(BASE+path,{headers:{
      Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'
    },signal:controller.signal});
  }catch(error){
    throw new Error(error?.name==='AbortError'?'Independent GitHub request timed out.':
      'Independent GitHub request failed.');
  }finally{clearTimeout(timeout);}
  insist(response&&response.ok,'Independent GitHub API refused request (HTTP '+(response?.status||'unknown')+').');
  const data=await response.json();
  return {data,link:response.headers?.get?.('link')||''};
}
function nextPage(link){return /<[^>]+>;\s*rel="next"/.test(link);}
async function independentChecks(owner,repo,sha,fetcher){
  const items=[];
  let expected=null;
  for(let page=1;page<=PAGE_LIMIT;page++){
    const r=await independentGet('/repos/'+owner+'/'+repo+'/commits/'+sha+'/check-runs?filter=latest&per_page=100&page='+page,fetcher);
    insist(Array.isArray(r.data?.check_runs)&&Number.isSafeInteger(r.data.total_count)&&r.data.total_count>=0,
      'Independent check-run response is malformed.');
    if(expected!==null)insist(expected===r.data.total_count,'Independent check-run count changed between pages.');
    expected=r.data.total_count;
    items.push(...r.data.check_runs);
    insist(items.length<=500,'Independent check-run limit exceeded.');
    if(!nextPage(r.link)){
      insist(items.length===expected,'Independent check-run listing was truncated.');
      return items;
    }
  }
  throw new Error('Independent check-run page limit reached.');
}
async function independentStatuses(owner,repo,sha,fetcher){
  const items=[];
  for(let page=1;page<=PAGE_LIMIT;page++){
    const r=await independentGet('/repos/'+owner+'/'+repo+'/commits/'+sha+'/status?per_page=100&page='+page,fetcher);
    insist(Array.isArray(r.data?.statuses),'Independent commit-status response is malformed.');
    items.push(...r.data.statuses);
    insist(items.length<=500,'Independent commit-status limit exceeded.');
    if(!nextPage(r.link))return items;
  }
  throw new Error('Independent commit-status page limit reached.');
}
function fromRaw(checks,statuses){
  return [
    ...checks.map(r=>{
      insist(r&&typeof r==='object'&&typeof r.name==='string'&&typeof r.status==='string',
        'Malformed independent check.');
      return normalize({kind:'check',name:r.name,status:r.status,conclusion:r.conclusion});
    }),
    ...statuses.map(r=>{
      insist(r&&typeof r==='object'&&typeof r.context==='string'&&typeof r.state==='string',
        'Malformed independent status.');
      return normalize({kind:'status',name:r.context,status:r.state,conclusion:null});
    })
  ];
}

/**
 * Re-fetch public GitHub evidence via a distinct client and independently classify it.
 * No output claims cryptographic authentication or external organizational independence.
 */
export async function independentAudit(primary,{fetcher=fetch,clock=()=>new Date(),graph=DEFAULT_TRUST_GRAPH}={}){
  insist(primary&&primary.schema==='gmed-report:v1','Unrecognized primary receipt schema.');
  insist(typeof primary.observedAt==='string'&&!Number.isNaN(Date.parse(primary.observedAt)),
    'Primary receipt has no valid observation time.');
  insist(Array.isArray(primary.checks),'Primary receipt has no evidence array.');
  const identity=validateTarget(primary.target);
  const trust=analyzeTrustGraph(graph);
  const base={schema:OUROBOROS_SCHEMA,target:identity,primaryState:primary.state,
    primarySha:primary.sha||null,trust,observedAt:clock().toISOString(),
    limits:'Separate source code and second public GitHub read, but same API/provider and software repository. Not an external audit, proof of correctness, signed attestation, or independent trust anchor.'};
  if(!trust.valid){
    return {...base,state:'CYCLIC_TRUST',independentState:null,
      discrepancies:trust.errors,counts:null,signals:[]};
  }
  const {owner,repo,number}=identity;
  const pr=await independentGet('/repos/'+owner+'/'+repo+'/pulls/'+number,fetcher);
  insist(pr.data&&pr.data.number===number&&typeof pr.data.merged==='boolean',
    'Independent pull response failed validation.');
  const merged=pr.data.merged;
  const mergeSha=typeof pr.data.merge_commit_sha==='string'&&SHA.test(pr.data.merge_commit_sha)
    ?pr.data.merge_commit_sha.toLowerCase():null;
  let rows=[];
  if(merged&&mergeSha){
    const [checks,statuses]=await Promise.all([
      independentChecks(owner,repo,mergeSha,fetcher),
      independentStatuses(owner,repo,mergeSha,fetcher)
    ]);
    rows=fromRaw(checks,statuses);
  }
  const verdict=independentlyGrade({merged,mergeSha,signals:rows});
  const problems=[];
  if(primary.state!==verdict.state)problems.push('Primary decision disagrees with independent computation.');
  if(primary.merged!==merged)problems.push('Merged flag changed or was altered.');
  if((primary.sha||null)!==mergeSha)problems.push('Merge SHA differs from independent observation.');
  if(primary.number!==number)problems.push('Receipt PR number differs from target.');
  if(primary.target.url!=='https://github.com/'+owner+'/'+repo+'/pull/'+number)
    problems.push('Target PR URL does not match requested identity.');
  const primaryRows=sortedFingerprints(primary.checks);
  const freshRows=sortedFingerprints(rows);
  if(JSON.stringify(primaryRows)!==JSON.stringify(freshRows))
    problems.push('Evidence signals differ between inspections or were modified.');
  const counts=primary.counts;
  if(!counts||typeof counts!=='object'||Object.keys(verdict.counts).some(k=>counts[k]!==verdict.counts[k]))
    problems.push('Primary counts do not match independently reconstructed counts.');
  const state=problems.length?'MISMATCH':verdict.state==='GMED'?'DUAL_MATCH':'AGREED_NOT_GREEN';
  return {...base,state,independentState:verdict.state,
    independentSha:mergeSha,independentMerged:merged,counts:verdict.counts,signals:rows,
    discrepancies:problems};
}
