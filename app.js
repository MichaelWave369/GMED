import {inspect} from './src/github.js';
import {assess,parseTarget} from './src/verifier.js';
import {independentAudit,analyzeTrustGraph,DEFAULT_TRUST_GRAPH} from './src/ouroboros.js';

const $=id=>document.getElementById(id);
const form=$('verify-form'),repo=$('repo'),number=$('pr'),scan=$('scan'),demo=$('demo'),error=$('error'),result=$('result');
const query=new URLSearchParams(location.search);
if(query.has('repo'))repo.value=query.get('repo');
if(query.has('pr'))number.value=query.get('pr');
let busy=false;
function el(tag,cls,text){
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!=null)n.textContent=String(text);
 return n;
}
function clear(parent){while(parent.firstChild)parent.removeChild(parent.firstChild);}
function flash(message,kind='error'){
 error.hidden=false;
 error.textContent=message;
 error.className=kind==='success'?'error success-note':'error';
}
function hideError(){error.hidden=true;error.textContent='';}
function timeLabel(iso){
 try{return new Date(iso).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'medium'});}
 catch{return 'Unknown';}
}
function stateLabel(code){
 return {GMED:'GMED CONFIRMED',NOT_MERGED:'NOT GERGED',FAILED:'MERGED / CHECKS FAILED',
  PENDING:'MERGED / CHECKS RUNNING',UNVERIFIED:'EVIDENCE INCOMPLETE'}[code]||'UNVERIFIED';
}
function checkText(row){
 if(row.kind==='status')return row.status.toUpperCase();
 if(row.status!=='completed')return row.status.toUpperCase();
 return String(row.conclusion||'UNKNOWN').toUpperCase();
}
function addCheck(parent,row){
 const li=el('li','check-row '+row.grade);
 const mark=el('span','check-icon',row.grade==='good'?'✓':row.grade==='bad'?'×':row.grade==='pending'?'…':'?');
 const detail=el('div','check-detail');
 detail.append(el('strong','',row.name),el('span','',row.kind==='status'?'LEGACY STATUS':'CHECK RUN'));
 const verdict=el('span','check-result',checkText(row));
 li.append(mark,detail,verdict);
 if(row.url){
  const link=el('a','check-source','↗');
  link.href=row.url;link.target='_blank';link.rel='noreferrer';
  link.setAttribute('aria-label','Open '+row.name+' evidence on GitHub');
  li.append(link);
 }
 parent.append(li);
}
async function copyText(value){
 if(!navigator.clipboard?.writeText)throw new Error('Clipboard access is unavailable. Download JSON instead.');
 await navigator.clipboard.writeText(value);
}
function saveJson(report){
 const blob=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const a=el('a');
 a.href=url;
 a.download='GMED-'+(report.target?.repo||'demo')+'-PR'+(report.number||'demo')+'.json';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function render(report,{synthetic=false}={}){
 clear(result);
 result.className='result result-'+report.state.toLowerCase();
 const header=el('div','result-head');
 const stamp=el('div','stamp',stateLabel(report.state));
 const copy=el('div','result-headcopy');
 copy.append(el('span','receipt-kicker',synthetic?'DEMONSTRATION ONLY / NO LIVE EVIDENCE':'GITHUB EVIDENCE / MERGE COMMIT'),
             el('h3','',report.title),el('p','',report.detail));
 header.append(stamp,copy);
 result.append(header);
 const stats=el('div','stats');
 for(const [label,val] of [['OBSERVED SIGNALS',report.counts.total],['PASSED',report.counts.passed],['FAILED',report.counts.failed],['RUNNING',report.counts.pending]]){
  const box=el('div','stat');
  box.append(el('span','',label),el('strong','',val));stats.append(box);
 }
 result.append(stats);
 const detail=el('div','receipt-meta');
 const sha=report.sha||'Not established';
 detail.append(el('span','','MERGE SHA: '+(sha.length===40?sha.slice(0,12):sha)),
  el('span','','OBSERVED: '+timeLabel(report.observedAt)));
 result.append(detail);
 if(report.checks.length){
  const checks=el('div','checks');
  checks.append(el('h4','','INSPECTED CHECKS & STATUSES'));
  const list=el('ul','');report.checks.forEach(item=>addCheck(list,item));checks.append(list);result.append(checks);
 }else{
  result.append(el('p','no-checks','No completed check evidence is available for this inspection.'));
 }
 const actions=el('div','receipt-actions');
 const download=el('button','','↓ DOWNLOAD JSON RECEIPT');
 download.type='button';download.addEventListener('click',()=>saveJson(report));actions.append(download);
 if(!synthetic&&report.target){
  const share=el('button','','⧉ COPY SHARE LINK');share.type='button';
  share.addEventListener('click',async()=>{
   try{await copyText(location.href);flash('Share link copied. The next viewer will run their own fresh check.','success');}
   catch(e){flash(e.message);}
  });
  actions.append(share);
  const link=el('a','','VIEW PULL REQUEST ↗');link.href=report.target.url;link.target='_blank';link.rel='noreferrer';actions.append(link);
 }
 const ouroPanel=(!synthetic&&report.target)?bindOuroboros(report,actions):null;
 result.append(actions);
 if(ouroPanel)result.append(ouroPanel);
 result.append(el('p','receipt-caveat',synthetic
  ?'SYNTHETIC DEMO. These signals are invented solely to demonstrate the interface. This is not verification of any actual pull request.'
  :report.limits));
}
function displayOuroboros(panel,audit,primary){
 clear(panel);
 panel.className='ouro-panel '+(audit.state==='DUAL_MATCH'?'ouro-pass':'ouro-refused');
 const top=el('div','ouro-header');
 const token=audit.state==='DUAL_MATCH'?'DOUBLE-CHECK COMPLETE':
  audit.state==='AGREED_NOT_GREEN'?'AGREED: NOT GREEN':
  audit.state==='CYCLIC_TRUST'?'CIRCULAR TRUST BLOCKED':'INDEPENDENT MISMATCH';
 top.append(el('span','ouro-kicker','RUNG 2 / OUROBOROS / FRESH PUBLIC GITHUB READ'),
  el('h4','',token));
 panel.append(top);
 const stages=el('div','ouro-stages');
 const source=el('div','ouro-stage');
 source.append(el('span','','01 · EVIDENCE ROOT'),el('strong','','GitHub API'));
 const first=el('div','ouro-stage');
 first.append(el('span','','02 · PRIMARY CLASSIFIER'),el('strong','',primary.state));
 const second=el('div','ouro-stage');
 second.append(el('span','','03 · INDEPENDENT RE-OBSERVATION'),el('strong','',audit.independentState||'BLOCKED'));
 stages.append(source,first,second);
 panel.append(stages);
 const summary=audit.state==='DUAL_MATCH'
  ?'Both separately implemented classifiers reached GMED from two public GitHub reads. This does not constitute independent organizational verification or signed attestation.'
  :audit.state==='AGREED_NOT_GREEN'
  ?'The second auditor agrees with the first: no GMED green stamp is earned.'
  :audit.state==='CYCLIC_TRUST'
  ?'The trust dependency graph contains a self-reference or a dependency cycle. Verification is refused before fetching evidence.'
  :'The two inspections disagree or a required evidence field changed. No recursive green stamp is awarded.';
 panel.append(el('p','ouro-description',summary));
 if(audit.discrepancies.length){
  const list=el('ul','ouro-discrepancies');
  audit.discrepancies.forEach(problem=>list.append(el('li','',problem)));
  panel.append(list);
 }
 const info=el('div','ouro-foot');
 info.append(el('span','','Re-observed: '+timeLabel(audit.observedAt)),
   el('span','','Trust graph: '+(audit.trust.valid?'ACYCLIC':'REFUSED')));
 panel.append(info);
 const download=el('button','ouro-download','↓ EXPORT DUAL RECEIPT');
 download.type='button';
 download.addEventListener('click',()=>saveJson({
  schema:'gmed-ouroboros-bundle:v1',primary,independentAudit:audit
 }));
 panel.append(download);
 panel.append(el('p','ouro-caution',audit.limits));
}
function bindOuroboros(report,actions){
 const button=el('button','ouro-trigger','↻ RUN OUROBOROS / SECOND OPINION');
 button.type='button';
 button.setAttribute('aria-label','Recheck this pull request using the independent Ouroboros verifier');
 actions.append(button);
 const panel=el('section','ouro-panel-host');
 panel.setAttribute('aria-live','polite');
 panel.setAttribute('aria-label','Ouroboros independent verification');
 button.addEventListener('click',async()=>{
  if(button.disabled)return;
  button.disabled=true;
  button.textContent='RE-READING GITHUB EVIDENCE…';
  clear(panel);
  panel.append(el('p','ouro-wait','Independent audit in progress. No green stamp issued yet.'));
  try{
   const audit=await independentAudit(report);
   displayOuroboros(panel,audit,report);
  }catch(e){
   clear(panel);
   panel.className='ouro-panel ouro-refused';
   panel.append(el('h4','','INDEPENDENT VERIFICATION WITHHELD'),
      el('p','',e instanceof Error?e.message:'Independent audit unavailable.'));
  }finally{
   button.disabled=false;
   button.textContent='↻ RE-RUN OUROBOROS';
  }
 });
 return panel;
}

function setBusy(value){
 busy=value;scan.disabled=value;demo.disabled=value;
 scan.querySelector('.run-label').textContent=value?'CHECKING EVIDENCE…':'VERIFY WITH GITHUB';
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(busy)return;
 hideError();
 setBusy(true);
 try{
  const target=parseTarget(repo.value,number.value);
  const report=await inspect(repo.value,number.value);
  repo.value=target.fullName;number.value=target.number;
  const url=new URL(location.href);url.searchParams.set('repo',target.fullName);url.searchParams.set('pr',target.number);
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  render(report);
 }catch(e){
  clear(result);
  result.className='result';
  result.append(el('div','result-placeholder','NO VERIFICATION ISSUED'));
  flash(e instanceof Error?e.message:'GitHub verification unavailable.');
 }finally{setBusy(false);}
});
demo.addEventListener('click',()=>{
 if(busy)return;
 hideError();
 const syntheticPull={merged:true,merge_commit_sha:'3693693693693693693693693693693693693693',
  number:369,title:'Synthetic GMED demonstration'};
 const checks=[
  {name:'Tests',status:'completed',conclusion:'success'},
  {name:'Build',status:'completed',conclusion:'success'},
  {name:'Quality Gate',status:'completed',conclusion:'neutral'}
 ];
 const report=assess({pull:syntheticPull,checkRuns:checks,commitStatuses:[],
  observedAt:new Date().toISOString()});
 render({...report,target:{owner:'demo',repo:'synthetic',number:369}},{synthetic:true});
});


const loopButton=$('loop-demo');
const loopResult=$('loop-result');
if(loopButton&&loopResult){
 loopButton.addEventListener('click',()=>{
  const loop=structuredClone(DEFAULT_TRUST_GRAPH);
  loop.find(node=>node.id==='gmed-primary').dependsOn.push('ouroboros-auditor');
  const evaluation=analyzeTrustGraph(loop);
  clear(loopResult);
  loopResult.hidden=false;
  loopResult.append(el('strong','','SIMULATED LOOP: '+(evaluation.valid?'NOT DETECTED':'BLOCKED')),
    el('p','','GMED primary → Ouroboros auditor → GMED primary. This graph is intentionally circular and is not derived from a real GitHub inspection.'));
  for(const cycle of evaluation.cycles){
    loopResult.append(el('code','',cycle.join(' → ')));
  }
 });
}
