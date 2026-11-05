import {inspect} from './src/github.js';
import {assess,parseTarget} from './src/verifier.js';

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
 result.append(actions);
 result.append(el('p','receipt-caveat',synthetic
  ?'SYNTHETIC DEMO. These signals are invented solely to demonstrate the interface. This is not verification of any actual pull request.'
  :report.limits));
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
