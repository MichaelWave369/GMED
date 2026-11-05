import test from 'node:test';
import assert from 'node:assert/strict';
import {assess,parseTarget} from '../src/verifier.js';
import {independentAudit,analyzeTrustGraph,DEFAULT_TRUST_GRAPH,OUROBOROS_SCHEMA}
  from '../src/ouroboros.js';

const SHA='a'.repeat(40);
const success={name:'CI',status:'completed',conclusion:'success'};
const skipped={name:'docs',status:'completed',conclusion:'skipped'};
const FAILURE={name:'CI',status:'completed',conclusion:'failure'};
function primary({merged=true,sha=SHA,checks=[success],statuses=[],target='MichaelWave369/GMED',number=1}={}){
 const parsed=parseTarget(target,number);
 return {
   ...assess({pull:{merged,merge_commit_sha:sha,number,title:'Release test',
     html_url:parsed.url},checkRuns:checks,commitStatuses:statuses,
     observedAt:'2026-11-05T00:00:00.000Z'}),
   target:parsed
 };
}
function makeNetwork({merged=true,sha=SHA,checks=[success],statuses=[],prNumber=1,
  count=null,error=false}={}){
 const requests=[];
 const fetcher=async url=>{
   const parsed=new URL(url);
   const path=parsed.pathname;
   requests.push(path);
   if(error&&path.includes('/check-runs'))return {ok:false,status:403};
   let data;
   if(path.endsWith('/pulls/'+prNumber))data={number:prNumber,merged,merge_commit_sha:sha};
   else if(path.endsWith('/check-runs'))
     data={total_count:count??checks.length,check_runs:checks};
   else if(path.endsWith('/status'))data={statuses};
   else return {ok:false,status:404};
   return {ok:true,status:200,json:async()=>data,headers:{get:()=>''}};
 };
 return {requests,fetcher};
}
const CLOCK=()=>new Date('2026-11-05T01:00:00Z');

test('independent GitHub re-observation confirms a completed merged result',async()=>{
 const p=primary();
 const net=makeNetwork();
 const a=await independentAudit(p,{fetcher:net.fetcher,clock:CLOCK});
 assert.equal(a.schema,OUROBOROS_SCHEMA);
 assert.equal(a.state,'DUAL_MATCH');
 assert.equal(a.independentState,'GMED');
 assert.equal(a.primaryState,'GMED');
 assert.equal(a.trust.valid,true);
 assert.equal(a.observedAt,'2026-11-05T01:00:00.000Z');
 assert.equal(net.requests.filter(x=>x.includes('/commits/')).length,2);
 assert.ok(net.requests.every(x=>!x.includes('/commits/')||x.includes(SHA)));
 assert.deepEqual(a.discrepancies,[]);
});

test('matches failures and unmerged results without falsely promoting them',async()=>{
 const failed=await independentAudit(primary({checks:[FAILURE]}),{
   fetcher:makeNetwork({checks:[FAILURE]}).fetcher,clock:CLOCK});
 assert.equal(failed.state,'AGREED_NOT_GREEN');
 assert.equal(failed.independentState,'FAILED');
 const notMerged=await independentAudit(primary({merged:false,sha:null,checks:[]}),{
   fetcher:makeNetwork({merged:false,sha:null,checks:[]}).fetcher,clock:CLOCK});
 assert.equal(notMerged.state,'AGREED_NOT_GREEN');
 assert.equal(notMerged.independentState,'NOT_MERGED');
});

test('unknown, skipped-only and pending signals fail closed',async()=>{
 const onlySkipped=await independentAudit(primary({checks:[skipped]}),{
   fetcher:makeNetwork({checks:[skipped]}).fetcher});
 assert.equal(onlySkipped.state,'AGREED_NOT_GREEN');
 assert.equal(onlySkipped.independentState,'UNVERIFIED');
 const pending={name:'CI',status:'in_progress',conclusion:null};
 const wait=await independentAudit(primary({checks:[pending]}),{
   fetcher:makeNetwork({checks:[pending]}).fetcher});
 assert.equal(wait.independentState,'PENDING');
});

test('modified verdict, SHA, or count cannot get an independent stamp',async()=>{
 const cases=[
   {...primary(),state:'FAILED'},
   {...primary(),sha:'b'.repeat(40)},
   {...primary(),counts:{...primary().counts,passed:9000}},
 ];
 for(const changed of cases){
   const result=await independentAudit(changed,{fetcher:makeNetwork().fetcher});
   assert.equal(result.state,'MISMATCH');
   assert.ok(result.discrepancies.length>0);
 }
});

test('new GitHub evidence between reads yields MISMATCH, never fabricated green',async()=>{
 const a=await independentAudit(primary(),{
   fetcher:makeNetwork({checks:[FAILURE]}).fetcher});
 assert.equal(a.state,'MISMATCH');
 assert.equal(a.independentState,'FAILED');
 assert.ok(a.discrepancies.some(x=>x.includes('Evidence signals')));
});

test('independently fetched statuses must match receipt rows and counts',async()=>{
 const statuses=[{context:'legacy',state:'success'}];
 const p=primary({statuses});
 const pass=await independentAudit(p,{fetcher:makeNetwork({statuses}).fetcher});
 assert.equal(pass.state,'DUAL_MATCH');
 const fail=await independentAudit(p,{
   fetcher:makeNetwork({statuses:[{context:'legacy',state:'failure'}]}).fetcher
 });
 assert.equal(fail.state,'MISMATCH');
});

test('trust graph rejects self-attestation, transitive cycles and dangling dependencies',()=>{
 assert.equal(analyzeTrustGraph(DEFAULT_TRUST_GRAPH).valid,true);
 const direct=structuredClone(DEFAULT_TRUST_GRAPH);
 direct[1].dependsOn.push('gmed-primary');
 assert.equal(analyzeTrustGraph(direct).valid,false);
 const indirect=structuredClone(DEFAULT_TRUST_GRAPH);
 indirect[1].dependsOn.push('ouroboros-auditor');
 const result=analyzeTrustGraph(indirect);
 assert.equal(result.valid,false);
 assert.ok(result.cycles.length>0);
 const dangling=structuredClone(DEFAULT_TRUST_GRAPH);
 dangling[2].dependsOn.push('nonexistent');
 assert.equal(analyzeTrustGraph(dangling).valid,false);
});

test('a circular trust graph blocks network inspection entirely',async()=>{
 const cycle=structuredClone(DEFAULT_TRUST_GRAPH);
 cycle[1].dependsOn.push('ouroboros-auditor');
 const network=makeNetwork();
 const result=await independentAudit(primary(),{graph:cycle,fetcher:network.fetcher});
 assert.equal(result.state,'CYCLIC_TRUST');
 assert.equal(network.requests.length,0);
});

test('API refusal and truncated second read cannot issue an audit stamp',async()=>{
 await assert.rejects(
   independentAudit(primary(),{fetcher:makeNetwork({error:true}).fetcher}),/refused request/
 );
 await assert.rejects(
   independentAudit(primary(),{fetcher:makeNetwork({count:100}).fetcher}),/truncated/
 );
});

test('malformed receipt, unbound target, or invalid observation time is refused',async()=>{
 await assert.rejects(independentAudit({...primary(),schema:'rogue'}),/schema/);
 await assert.rejects(independentAudit({...primary(),observedAt:'invalid'}),/observation time/);
 await assert.rejects(independentAudit({...primary(),target:{...primary().target,fullName:'attacker/GMED'}}),/Target identity/);
});
