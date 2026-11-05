import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect} from '../src/github.js';

const SHA='a'.repeat(40);
function mockFetch({merged=true,checks=[{name:'CI',status:'completed',conclusion:'success'}],statuses=[],checkTotal=null,error=false}={}){
 const paths=[];
 const fetcher=async(url)=>{
  const path=new URL(url).pathname;
  paths.push(path);
  if(error&&path.includes('/check-runs'))return {ok:false,status:403,headers:{get:()=>''}};
  let data;
  if(path.endsWith('/pulls/22')) data={number:22,merged,merge_commit_sha:merged?SHA:null,title:'Tested PR'};
  else if(path.endsWith('/check-runs'))data={total_count:checkTotal??checks.length,check_runs:checks};
  else if(path.endsWith('/status'))data={statuses};
  else return {ok:false,status:404,headers:{get:()=>''}};
  return {ok:true,status:200,json:async()=>data,headers:{get:()=>''}};
 };
 return {fetcher,paths};
}
test('merged commit is the only SHA checked',async()=>{
 const m=mockFetch();
 const report=await inspect('MichaelWave369/Altermath',22,{fetcher:m.fetcher,clock:()=>new Date('2026-11-05T00:00:00Z')});
 assert.equal(report.state,'GMED');
 assert.equal(report.target.number,22);
 assert.equal(report.observedAt,'2026-11-05T00:00:00.000Z');
 assert.equal(m.paths.filter(path=>path.includes('/commits/')).length,2);
 assert.ok(m.paths.every(path=>!path.includes('/commits/')||path.includes(SHA)));
});
test('not merged never inspects misleading head checks',async()=>{
 const m=mockFetch({merged:false});
 const result=await inspect('MichaelWave369/Altermath',22,{fetcher:m.fetcher});
 assert.equal(result.state,'NOT_MERGED');
 assert.equal(m.paths.length,1);
});
test('API denial fails closed, rather than forging a green stamp',async()=>{
 const m=mockFetch({error:true});
 await assert.rejects(()=>inspect('a/b',22,{fetcher:m.fetcher}),/HTTP 403/);
});
test('incomplete check-run count fails closed',async()=>{
 const m=mockFetch({checkTotal:99});
 await assert.rejects(()=>inspect('a/b',22,{fetcher:m.fetcher}),/Incomplete check-run/);
});
test('failed statuses override successful check runs',async()=>{
 const m=mockFetch({statuses:[{context:'lint',state:'failure'}]});
 const r=await inspect('a/b',22,{fetcher:m.fetcher});
 assert.equal(r.state,'FAILED');
});
