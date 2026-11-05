import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTarget,assess,SCHEMA} from '../src/verifier.js';

const sha='a'.repeat(40);
const pull=(overrides={})=>({merged:true,merge_commit_sha:sha,number:22,title:'Example',...overrides});
const run=(overrides={})=>({name:'test',status:'completed',conclusion:'success',...overrides});
const evaluate=(config={})=>assess({pull:pull(),checkRuns:[run()],commitStatuses:[],...config});

test('accepts an explicit repository and PR URL, rejecting unsafe input',()=>{
 assert.deepEqual(parseTarget('MichaelWave369/GMED','12'),{
   owner:'MichaelWave369',repo:'GMED',fullName:'MichaelWave369/GMED',number:12,
   url:'https://github.com/MichaelWave369/GMED/pull/12'
 });
 assert.equal(parseTarget('https://github.com/MichaelWave369/Altermath/pull/22','').number,22);
 for(const bad of ['x','https://evil.example/a/b/pull/2','../../etc','a/b/extra','a/.']){
  assert.throws(()=>parseTarget(bad,'2'));
 }
 for(const bad of ['0','-2','123abc','999999999999999999','']){
  assert.throws(()=>parseTarget('a/b',bad));
 }
});
test('GMED requires actual merge and observed success on the merged SHA',()=>{
 const r=evaluate({observedAt:'2026-11-05T00:00:00.000Z'});
 assert.equal(r.schema,SCHEMA);
 assert.equal(r.state,'GMED');
 assert.equal(r.sha,sha);
 assert.equal(r.counts.success,1);
 assert.equal(r.observedAt,'2026-11-05T00:00:00.000Z');
 assert.equal(evaluate({pull:pull({merged:false})}).state,'NOT_MERGED');
 assert.equal(evaluate({pull:pull({merge_commit_sha:null})}).state,'UNVERIFIED');
});
test('no signals or all skipped/neutral never become GMED',()=>{
 assert.equal(evaluate({checkRuns:[]}).state,'UNVERIFIED');
 assert.equal(evaluate({checkRuns:[run({conclusion:'skipped'}),run({conclusion:'neutral'})]}).state,'UNVERIFIED');
});
test('fails closed for unknown outcomes and incomplete pagination',()=>{
 assert.equal(evaluate({checkRuns:[run({conclusion:'mystery'})]}).state,'UNVERIFIED');
 assert.equal(evaluate({complete:false}).state,'UNVERIFIED');
});
test('failures outrank pending, and pending outranks green',()=>{
 assert.equal(evaluate({checkRuns:[run(),run({name:'build',status:'in_progress',conclusion:null})]}).state,'PENDING');
 assert.equal(evaluate({checkRuns:[run({conclusion:'failure'}),run({status:'in_progress',conclusion:null})]}).state,'FAILED');
 assert.equal(evaluate({checkRuns:[run({conclusion:'cancelled'})]}).state,'FAILED');
 assert.equal(evaluate({commitStatuses:[{context:'lint',state:'failure'}]}).state,'FAILED');
 assert.equal(evaluate({commitStatuses:[{context:'deploy',state:'pending'}]}).state,'PENDING');
});
test('legacy status success is valid independent evidence, but only on merge SHA',()=>{
 assert.equal(evaluate({checkRuns:[],commitStatuses:[{context:'ci',state:'success'}]}).state,'GMED');
 assert.equal(evaluate({checkRuns:[],commitStatuses:[{context:'ci',state:'success'}],pull:pull({merged:false})}).state,'NOT_MERGED');
});
test('invalid payloads do not turn into success',()=>{
 assert.throws(()=>assess({pull:null}),/Invalid pull/);
 assert.throws(()=>assess({pull:pull(),checkRuns:null}),/Invalid checks/);
 assert.throws(()=>assess({pull:pull(),checkRuns:[null]}),/Invalid check/);
});
