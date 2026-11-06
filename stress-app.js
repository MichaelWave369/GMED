import {parseHorizons} from './src/startrace-horizons.js';
import {stressTestGravity,r7Receipt} from './src/startrace-r7.js';
const $=x=>document.getElementById(x);
const fmt=(v,d=3)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const paths={earth:'earth-399-extract.txt',moon:'moon-301-extract.txt'};
let result=null,raw=null,mode='deviation';
const fields=['stepHours','rtol','maxAdaptiveStepMinutes','massMultiplier','leadDays'];
function paint(){
 const canvas=$('stressPlot'),w=Math.max(250,canvas.getBoundingClientRect().width);
 const h=Math.max(150,canvas.getBoundingClientRect().height),dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.fillStyle='#0c1c2a';ctx.fillRect(0,0,w,h);
 if(!result){
  ctx.fillStyle='#a3c0c8';ctx.font='13px ui-sans-serif,system-ui';ctx.textAlign='center';
  ctx.fillText('Run the solver test to show source-backed numerical comparisons.',w/2,h/2);return;
 }
 const series=mode==='deviation'?[
  {key:'refVsLegacyKm',name:'Legacy RK4',color:'#75b7ff',factor:1000},
  {key:'refVsRK4Km',name:'Independent RK4',color:'#9eeacc',factor:1000},
  {key:'rk4RefinementKm',name:'RK4 half-step',color:'#eab87c',factor:1000}
 ]:[
  {key:'earthDistanceKm',name:'Earth range',color:'#75b7ff',factor:1},
  {key:'moonDistanceKm',name:'Moon range',color:'#9eeacc',factor:1}
 ];
 const data=result.samples,left=62,right=20,top=30,bottom=45;
 const scale=Math.max(1e-7,...series.flatMap(s=>data.map(x=>x[s.key]*s.factor)))*1.16;
 const X=time=>left+(time-4)/14*(w-left-right);
 const Y=value=>h-bottom-value/scale*(h-top-bottom);
 ctx.font='10px ui-sans-serif,system-ui';
 for(let k=0;k<=4;k++){
  const value=k*scale/4,y=Y(value);
  ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);
  ctx.strokeStyle='#2c4c58';ctx.lineWidth=.9;ctx.stroke();
  ctx.fillStyle='#a2bec8';ctx.textAlign='right';ctx.fillText(fmt(value,value<1?3:1),left-7,y+3);
 }
 ctx.textAlign='center';
 for(let hour=4;hour<=18;hour+=2)ctx.fillText(hour+':00',X(hour),h-14);
 for(const s of series){
  ctx.strokeStyle=s.color;ctx.lineWidth=2.4;ctx.beginPath();
  data.forEach((x,i)=>{const px=X(x.hour),py=Y(x[s.key]*s.factor);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);});
  ctx.stroke();
 }
 ctx.textAlign='left';ctx.fillStyle='#aad3d6';
 ctx.fillText(mode==='deviation'?'3D position difference (meters)':'Candidate-to-body range (km)',left,16);
}
function switchMode(value){
 mode=value;$('modeDeviation').setAttribute('aria-pressed',String(mode==='deviation'));
 $('modeDistance').setAttribute('aria-pressed',String(mode==='distance'));paint();
}
$('modeDeviation').addEventListener('click',()=>switchMode('deviation'));
$('modeDistance').addEventListener('click',()=>switchMode('distance'));
function number(x,id){$(id).textContent=x;}
$('run').addEventListener('click',async()=>{
 result=null;raw=null;$('export').disabled=true;$('run').disabled=true;
 $('error').hidden=true;$('status').textContent='Loading source-derived vectors and checking integration…';
 paint();
 try{
  const res=await Promise.all([
   fetch('./data/horizons-5bce/manifest.json',{cache:'no-cache'}),
   fetch('./data/horizons-5bce/'+paths.earth,{cache:'no-cache'}),
   fetch('./data/horizons-5bce/'+paths.moon,{cache:'no-cache'})
  ]);
  if(!res.every(x=>x.ok))throw new Error('A required ephemeris source file is not available');
  const [manifest,eText,mText]=await Promise.all([res[0].json(),res[1].text(),res[2].text()]);
  if(manifest.status!=='SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY')
   throw new Error('Source provenance declaration changed');
  const earth=parseHorizons(eText,'earth'),moon=parseHorizons(mText,'moon');
  if(earth.sourceHeader.model!=='DE441'||moon.sourceHeader.model!=='DE441')
   throw new Error('Expected provider-declared DE441 sample');
  const options=Object.fromEntries(fields.map(id=>[id,Number($(id).value)]));
  result=stressTestGravity(earth,moon,options);raw={earth:eText,moon:mText};
  const c=result.consistency;
  number(fmt(c.maxLegacyVsAdaptiveKm*1000,2)+' m','legacy');
  number(fmt(c.maxRK4VsAdaptiveKm*1000,2)+' m','fixed');
  number(fmt(c.maxRK4RefinementKm*1000,2)+' m','refinement');
  number(fmt(c.minSampledEarthDistanceKm,0)+' km','earthRange');
  number(c.adaptiveSteps.accepted+' / '+c.adaptiveSteps.rejected,'steps');
  number(fmt(result.solarBenchmark.maxAnalyticPositionErrorKm*1000,2)+' m','sunReference');
  $('status').textContent='Completed same-model numerical cross-check; no historical orbit certified.';
  $('export').disabled=false;paint();
 }catch(error){
  $('status').textContent='Solver refused this scenario.';
  $('error').textContent='EXPERIMENT REFUSED: '+(error instanceof Error?error.message:String(error));
  $('error').hidden=false;result=null;raw=null;paint();
 }finally{$('run').disabled=false;}
});
async function sha(text){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
$('export').addEventListener('click',async()=>{
 if(!result||!raw)return;
 try{
  const [earthSha256,moonSha256]=await Promise.all([sha(raw.earth),sha(raw.moon)]);
  const r=r7Receipt(result,{earthSha256,moonSha256});
  const blob=new Blob([JSON.stringify(r,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='STARTRACE-5-R7-comet-solver-audit.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){$('error').textContent='EXPORT REFUSED: '+String(error);$('error').hidden=false;}
});
window.addEventListener('resize',paint);
paint();
