import {parseHorizons} from './src/startrace-horizons.js';
import {compareWithheldVectors,withheldReceipt} from './src/startrace-validation.js';
const $=id=>document.getElementById(id);
const paths={
 coarseEarth:'earth-399-extract.txt',coarseMoon:'moon-301-extract.txt',
 fineEarth:'earth-399-30min-extract.txt',fineMoon:'moon-301-30min-extract.txt'
};
let result=null,sourceText=null,mode='position';
const fmt=(v,d=2)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const label=(id,t)=>{$(id).textContent=t;};
function choose(next){
 mode=next;
 for(const [name,id] of [['position','modePosition'],['velocity','modeVelocity'],['range','modeRange']]){
  $(id).setAttribute('aria-pressed',String(name===mode));
 }
 plot();
}
$('modePosition').addEventListener('click',()=>choose('position'));
$('modeVelocity').addEventListener('click',()=>choose('velocity'));
$('modeRange').addEventListener('click',()=>choose('range'));
function plot(){
 const canvas=$('chart'),w=Math.max(220,canvas.getBoundingClientRect().width);
 const h=Math.max(150,canvas.getBoundingClientRect().height),dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.fillStyle='#0b1c2b';ctx.fillRect(0,0,w,h);
 if(!result){
  ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillStyle='#a6bcc7';
  ctx.fillText('Run the source-derived audit to display real numerical discrepancies.',w/2,h/2);
  return;
 }
 const series=mode==='position'?[
  {key:'earthPositionErrorKm',color:'#78bbff',scale:1000},
  {key:'moonPositionErrorKm',color:'#9ae6c5',scale:1000}
 ]:mode==='velocity'?[
  {key:'earthVelocityErrorKmS',color:'#78bbff',scale:1000},
  {key:'moonVelocityErrorKmS',color:'#9ae6c5',scale:1000}
 ]:[{key:'separationErrorKm',color:'#f1b77f',scale:1000}];
 const rows=result.rows;
 const all=series.flatMap(s=>rows.map(x=>x[s.key]*s.scale));
 const peak=Math.max(.000001,...all)*1.18;
 const left=62,right=23,top=30,bottom=47;
 const x=jd=>left+(jd-result.timeRangeJD.start)/(result.timeRangeJD.end-result.timeRangeJD.start)*(w-left-right);
 const y=num=>h-bottom-(num/peak)*(h-top-bottom);
 ctx.font='10px ui-sans-serif,system-ui';ctx.strokeStyle='#2a4655';ctx.lineWidth=1;
 for(let k=0;k<=4;k++){
  const num=k*peak/4,cy=y(num);
  ctx.beginPath();ctx.moveTo(left,cy);ctx.lineTo(w-right,cy);ctx.stroke();
  ctx.fillStyle='#a0bec7';ctx.textAlign='right';ctx.fillText(fmt(num,mode==='velocity'?5:3),left-8,cy+4);
 }
 ctx.textAlign='center';
 for(let k=0;k<=8;k++){
  const jd=result.timeRangeJD.start+(result.timeRangeJD.end-result.timeRangeJD.start)*k/8;
  ctx.fillText(k*3+'h',x(jd),h-17);
 }
 for(const set of series){
  ctx.beginPath();
  rows.forEach((p,i)=>{
   const px=x(p.jd),py=y(p[set.key]*set.scale);
   if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  });
  ctx.strokeStyle=set.color;ctx.lineWidth=2.5;ctx.stroke();
 }
 ctx.textAlign='left';ctx.fillStyle='#a4c3cd';
 ctx.fillText(mode==='velocity'?'Velocity residual (m/s)':'Position or range residual (m)',left,17);
}
async function readFile(path){
 const res=await fetch('./data/horizons-5bce/'+path,{cache:'no-cache'});
 if(!res.ok)throw new Error('Data file unavailable: '+path+' (HTTP '+res.status+')');
 return await res.text();
}
async function hash(text){
 const buffer=new TextEncoder().encode(text);
 const digest=await crypto.subtle.digest('SHA-256',buffer);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
$('run').addEventListener('click',async()=>{
 $('error').hidden=true;$('run').disabled=true;$('export').disabled=true;result=null;
 label('state','Loading and validating all four NASA-derived numeric extracts…');
 plot();
 try{
  const [rawBase,rawFine,entries]=await Promise.all([
   readFile('manifest.json').then(JSON.parse),
   readFile('heldout-manifest.json').then(JSON.parse),
   Promise.all(Object.entries(paths).map(async ([key,path])=>[key,await readFile(path)]))
  ]);
  if(rawBase.status!=='SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY'||
     rawFine.schema!=='startrace-5:heldout-horizons-30min:v1'||
     rawFine.status!=='SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY')
     throw new Error('Source provenance metadata does not match the supported contract');
  const strings=Object.fromEntries(entries);
  const parsed=Object.fromEntries(Object.entries(strings).map(([key,text])=>[
   key,parseHorizons(text,key.toLowerCase().includes('earth')?'earth':'moon')
  ]));
  result=compareWithheldVectors(parsed);
  sourceText=strings;
  label('earthMax',fmt(result.statistics.earthPositionKm.max*1000,3)+' m');
  label('moonMax',fmt(result.statistics.moonPositionKm.max*1000,3)+' m');
  label('earthRms',fmt(result.statistics.earthPositionKm.rms*1000,3)+' m');
  label('moonRms',fmt(result.statistics.moonPositionKm.rms*1000,3)+' m');
  label('rangeMax',fmt(result.statistics.earthMoonSeparationKm.max*1000,3)+' m');
  const urls=rawFine.targets||[];
  for(const [body,id] of [['earth','earthLink'],['moon','moonLink']]){
   const link=urls.find(x=>x.name===body)?.sourceUrl;
   const official=typeof link==='string'&&link.startsWith('https://ssd.jpl.nasa.gov/api/horizons.api?');
   if(official)$(id).href=link;
  }
  label('state',result.heldoutEpochs+' withheld timestamps evaluated; '+result.sharedKnotsExcluded+
     ' shared knots excluded. Same-model interpolation only.');
  $('export').disabled=false;
  plot();
 }catch(err){
  result=null;sourceText=null;
  $('error').hidden=false;
  $('error').textContent='AUDIT REFUSED: '+(err instanceof Error?err.message:String(err));
  label('state','No validated comparison available.');
  plot();
 }finally{$('run').disabled=false;}
});
$('export').addEventListener('click',async()=>{
 if(!result||!sourceText)return;
 try{
  const hashes=Object.fromEntries(await Promise.all(Object.entries(sourceText).map(async ([key,value])=>[key,await hash(value)])));
  const receipt=withheldReceipt(result,hashes);
  const blob=new Blob([JSON.stringify(receipt,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='STARTRACE-5-R6-withheld-ephemeris-audit.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){
  $('error').hidden=false;$('error').textContent='EXPORT REFUSED: '+String(error);
 }
});
window.addEventListener('resize',plot);
plot();
