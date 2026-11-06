import {AU_KM,DEFAULT_SCENARIO,EVIDENCE_LEDGER,evaluateScenario,researchReceipt,requiredTransverseSpeed} from './src/startrace.js';
const $=id=>document.getElementById(id);
const controlIds=['distanceAu','speedKmS','periodYears','baselineKm','magnitudeDecrease'];
const inputMap={speedKmS:'transverseSpeedKmS'};
const fmt=(x,d=2)=>Number(x).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
function params(){
  const value={};
  for(const id of controlIds)value[inputMap[id]||id]=Number($(id).value);
  return {...DEFAULT_SCENARIO,...value};
}
function svg(tag,attrs={},label){
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [name,value] of Object.entries(attrs))el.setAttribute(name,String(value));
  if(label!==undefined)el.textContent=String(label);
  return el;
}
function renderChart(distanceAu,selectedSpeed){
  const element=$('speedChart');
  element.replaceChildren();
  const width=650,height=258,left=58,right=22,top=22,bottom=45;
  const xMax=Math.max(0.012, distanceAu*1.12);
  const maxSpeed=Math.max(100,requiredTransverseSpeed(xMax*AU_KM,13)*1.1,selectedSpeed*1.1);
  const x=distance=>left+(distance/xMax)*(width-left-right);
  const y=speed=>height-bottom-(speed/maxSpeed)*(height-top-bottom);
  for(let i=0;i<=4;i++){
    const speed=i*maxSpeed/4;
    element.append(svg('line',{x1:left,y1:y(speed),x2:width-right,y2:y(speed),stroke:'#2c4354','stroke-width':1}),
      svg('text',{x:8,y:y(speed)+4,fill:'#90aeba','font-size':11},fmt(speed,0)));
  }
  element.append(svg('line',{x1:left,y1:top,x2:left,y2:height-bottom,stroke:'#809baa'}),
    svg('line',{x1:left,y1:height-bottom,x2:width-right,y2:height-bottom,stroke:'#809baa'}));
  for(let i=0;i<=4;i++){
    const distance=i*xMax/4;
    element.append(svg('text',{x:x(distance),y:height-14,'text-anchor':'middle',fill:'#91aebc','font-size':10},distance.toFixed(4)));
  }
  const points=Array.from({length:75},(_,i)=>{
    const d=xMax*i/74;
    return x(d)+','+y(requiredTransverseSpeed(d*AU_KM||0.00001,13));
  }).join(' ');
  element.append(svg('polyline',{points,fill:'none',stroke:'#87e5d2','stroke-width':3,'stroke-linecap':'round'}));
  element.append(svg('line',{x1:left,y1:y(selectedSpeed),x2:width-right,y2:y(selectedSpeed),stroke:'#e0b472','stroke-dasharray':'4 6','stroke-opacity':'.5'}));
  element.append(svg('circle',{cx:x(distanceAu),cy:y(selectedSpeed),r:6,fill:'#efbb72',stroke:'#102435','stroke-width':2}));
  element.append(svg('text',{x:width-right,y:15,'text-anchor':'end',fill:'#96acb7','font-size':11},'AU →'));
}
function update(){
  const current=params();
  const calculated=evaluateScenario(current).calculated;
  const labels={
    distanceAu:fmt(current.distanceAu,4)+' AU',
    speedKmS:fmt(current.transverseSpeedKmS,1)+' km/s',
    periodYears:fmt(current.periodYears,0)+' yr',
    baselineKm:fmt(current.baselineKm,1)+' km',
    magnitudeDecrease:fmt(current.magnitudeDecrease,1)+' mag'
  };
  for(const [id,label] of Object.entries(labels))$(id+'Value').textContent=label;
  $('requiredSpeed').textContent=fmt(calculated.requiredSpeedKmS,2);
  $('actualRate').textContent=fmt(calculated.actualRateDegHour,2)+' °/h';
  $('residualRate').textContent=(calculated.residualRateDegHour>=0?'+':'')+fmt(calculated.residualRateDegHour,2)+' °/h';
  $('parallax').textContent=fmt(calculated.parallaxArcseconds,2)+'″';
  $('aphelion').textContent=fmt(calculated.aphelionAu,1)+' AU';
  $('eccentricity').textContent=fmt(calculated.eccentricity,6);
  $('brightness').textContent='×'+fmt(calculated.brightnessFactor,0);
  renderChart(current.distanceAu,current.transverseSpeedKmS);
}
function addLedger(){
  const cards=$('ledgerCards');
  for(const entry of EVIDENCE_LEDGER){
    const article=document.createElement('article');article.className='evidence-card';
    const kind=document.createElement('span');kind.className='kind';kind.textContent=entry.category+' / '+entry.status;
    const title=document.createElement('h3');title.textContent=entry.id.toUpperCase().replaceAll('-',' ');
    const body=document.createElement('p');body.textContent=entry.statement;
    const limits=document.createElement('p');limits.className='limits';limits.textContent=entry.limitation;
    const anchor=document.createElement('a');anchor.href=entry.url;anchor.target='_blank';anchor.rel='noreferrer';anchor.textContent='READ ATTRIBUTED SOURCE ↗';
    article.append(kind,title,body,limits,anchor);cards.append(article);
  }
}
function download(){
  const json=JSON.stringify(researchReceipt(params()),null,2)+'\n';
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  const a=document.createElement('a');
  a.href=url;a.download='STARTRACE-5-research-receipt.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
for(const id of controlIds)$(id).addEventListener('input',update);
$('reset').addEventListener('click',()=>{
  for(const id of controlIds)$(id).value=DEFAULT_SCENARIO[inputMap[id]||id];
  update();
});
$('export').addEventListener('click',download);
addLedger();update();
