import {horizonsQueryUrl,parseHorizons} from './src/startrace-horizons.js';
import {compareImportedEphemerides,r4Receipt} from './src/startrace-precision.js';
const $=id=>document.getElementById(id);
const config={day:8,leadDays:2,deltaTSeconds:10572,stepHours:.5,hour:10};
const raw={earth:null,moon:null};
const source={earth:null,moon:null};
let result=null;
const fmt=(n,d=2)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
function renderLinks(){
 $('leadLabel').textContent=fmt(config.leadDays,1)+' days';
 $('deltaLabel').textContent=fmt(config.deltaTSeconds,0)+' seconds';
 for(const body of ['earth','moon'])$(body+'Url').href=horizonsQueryUrl(body,config);
}
function invalidate(){
 result=null;$('export').disabled=true;
 for(const k of ['earthDifference','cometDifference','stepDifference','moonSeparation'])$(k).textContent='—';
 paint([]);
}
function ready(){
 const okay=Boolean(source.earth&&source.moon);
 $('run').disabled=!okay;
 $('stateLabel').textContent=okay?'Two source headers accepted; simulation still requires coverage checks':'Awaiting both accepted sources';
}
for(const id of ['day','leadDays','deltaTSeconds','stepHours']){
 $(id).addEventListener(['day','stepHours'].includes(id)?'change':'input',()=>{
  config[id]=Number($(id).value);renderLinks();invalidate();ready();
 });
}
for(const body of ['earth','moon']){
 $(body+'File').addEventListener('change',async()=>{
  source[body]=null;raw[body]=null;invalidate();
  const file=$(body+'File').files?.[0],status=$(body+'Status');
  status.className='source-status';status.textContent='VALIDATING...';
  try{
   if(!file)throw new Error('No file selected');
   if(file.size>1_000_000)throw new Error('Source file exceeds 1 MiB');
   const data=await file.text();
   const parsed=parseHorizons(data,body);
   raw[body]=data;source[body]=parsed;
   status.className='source-status ready';
   status.textContent=parsed.count+' vector samples accepted; JDs '+fmt(parsed.startJD,4)+' to '+fmt(parsed.endJD,4)+'; declared model '+parsed.sourceHeader.model+'. Source authenticity NOT established.';
  }catch(e){
   status.className='source-status failed';
   status.textContent='REFUSED: '+(e instanceof Error?e.message:String(e));
  }
  ready();
 });
}
$('run').addEventListener('click',()=>{
 const error=$('error');error.hidden=true;
 try{
  result=compareImportedEphemerides(source.earth,source.moon,config);
  const m=result.metrics;
  $('earthDifference').textContent=fmt(m.maxEarthProxyDifferenceKm,0)+' km';
  $('cometDifference').textContent=fmt(m.maxImportedVsApproxKm,0)+' km';
  $('stepDifference').textContent=fmt(m.maxStepDifferenceKm,3)+' km';
  $('moonSeparation').textContent=fmt(m.maxMoonSeparationKm,0)+' km';
  $('stateLabel').textContent='CONDITIONAL COMPUTATION ONLY / NOT A VERIFIED HISTORICAL RESULT';
  $('export').disabled=false;
  paint(result.samples);
 }catch(e){
  result=null;$('export').disabled=true;error.hidden=false;
  error.textContent='COMPARISON REFUSED: '+(e instanceof Error?e.message:String(e));
 }
});
async function sha256(text){
 const bytes=new TextEncoder().encode(text);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
$('export').addEventListener('click',async()=>{
 if(!result||!raw.earth||!raw.moon)return;
 try{
  const [earthDigest,moonDigest]=await Promise.all([sha256(raw.earth),sha256(raw.moon)]);
  const receipt=r4Receipt(result,{earthDigest,moonDigest});
  const url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='STARTRACE-5-R4-imported-ephemeris.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){
  $('error').hidden=false;$('error').textContent='EXPORT REFUSED: '+String(e);
 }
});
function paint(samples){
 const el=$('differencePlot'),width=Math.max(200,el.getBoundingClientRect().width);
 const height=Math.max(120,el.getBoundingClientRect().height);
 const ratio=Math.min(devicePixelRatio||1,2);
 el.width=Math.round(width*ratio);el.height=Math.round(height*ratio);
 const ctx=el.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
 ctx.fillStyle='#0b1d2a';ctx.fillRect(0,0,width,height);
 const left=60,right=20,top=25,bottom=36;
 if(samples.length===0){
  ctx.textAlign='center';ctx.fillStyle='#96b5c0';ctx.font='13px system-ui';
  ctx.fillText('No authentic source data provided yet.',width/2,height/2);
  return;
 }
 const max=Math.max(1,...samples.map(x=>x.shiftKm))*1.13;
 const x=t=>left+(t-4)/14*(width-left-right);
 const y=s=>height-bottom-s/max*(height-top-bottom);
 ctx.textAlign='right';ctx.font='10px system-ui';
 for(let i=0;i<=4;i++){
  const km=max*i/4;
  ctx.beginPath();ctx.moveTo(left,y(km));ctx.lineTo(width-right,y(km));
  ctx.strokeStyle='#2a4a59';ctx.stroke();ctx.fillStyle='#a1bec7';ctx.fillText(fmt(km,0),left-8,y(km)+3);
 }
 ctx.textAlign='center';
 for(let h=4;h<=18;h+=2){ctx.fillStyle='#a1bec7';ctx.fillText(h+':00',x(h),height-12);}
 ctx.beginPath();samples.forEach((s,i)=>i===0?ctx.moveTo(x(s.hour),y(s.shiftKm)):ctx.lineTo(x(s.hour),y(s.shiftKm)));
 ctx.strokeStyle='#96e8cb';ctx.lineWidth=2.7;ctx.stroke();
 ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillStyle='#8fc9c5';ctx.fillText('Difference (km)',left,14);
}
window.addEventListener('resize',()=>paint(result?.samples||[]));
renderLinks();ready();paint([]);
