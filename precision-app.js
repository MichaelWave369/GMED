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
// R5: offline-friendly, same-origin, source-derived numerical snapshot.
// This is not a NASA-signed raw response. Both source tables are staged
// together and applied atomically to prevent an Earth-only half-load.
$('loadSnapshot').addEventListener('click',async()=>{
 const button=$('loadSnapshot'),status=$('snapshotStatus');
 button.disabled=true;status.textContent='Loading the two normalized vector extracts…';
 invalidate();
 try{
  const prefix='./data/horizons-5bce/';
  const [manifestResponse,earthResponse,moonResponse]=await Promise.all([
    fetch(prefix+'manifest.json'),
    fetch(prefix+'earth-399-extract.txt'),
    fetch(prefix+'moon-301-extract.txt')
  ]);
  if(!manifestResponse.ok||!earthResponse.ok||!moonResponse.ok)
    throw new Error('A bundled dataset file was unavailable; static Pages staging may be incomplete');
  const manifest=await manifestResponse.json();
  if(manifest.schema!=='startrace-5:derived-horizons-snapshot:v1'||
     manifest.status!=='SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY')
    throw new Error('Unexpected or unsupported source provenance manifest');
  const [earthText,moonText]=await Promise.all([earthResponse.text(),moonResponse.text()]);
  const e=parseHorizons(earthText,'earth'),m=parseHorizons(moonText,'moon');
  if(e.count!==26||m.count!==26||e.startJD!==m.startJD||e.endJD!==m.endJD)
    throw new Error('Source-derived snapshot did not match its expected 26-row pairing');
  config.day=8;config.leadDays=2;config.deltaTSeconds=10572;config.stepHours=.5;
  for(const key of ['day','leadDays','deltaTSeconds','stepHours'])$(key).value=String(config[key]);
  renderLinks();
  raw.earth=earthText;raw.moon=moonText;
  source.earth=e;source.moon=m;
  for(const [body,parsed] of [['earth',e],['moon',m]]){
    $(body+'Status').className='source-status ready';
    $(body+'Status').textContent='SOURCE-DERIVED SNAPSHOT: '+parsed.count+
      ' samples, '+fmt(parsed.startJD,3)+'–'+fmt(parsed.endJD,3)+
      ' JD (TDB). NASA API-derived numeric rows, authenticity not independently verified.';
  }
  ready();
  status.textContent='Source-derived Earth/Moon samples loaded. Model remains conditional and unverified historically.';
  $('run').click();
 }catch(err){
  source.earth=null;source.moon=null;raw.earth=null;raw.moon=null;ready();
  status.textContent='SNAPSHOT REFUSED: '+(err instanceof Error?err.message:String(err));
 }finally{button.disabled=false;}
});
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
  ctx.fillText('Load NASA-derived June 8 sample or provide your own Horizons tables.',width/2,height/2);
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
