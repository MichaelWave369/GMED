/**
 * STARTRACE-5 R6: compare 3-hour Hermite ephemeris interpolation against
 * newly queried 30-minute DE441-source-derived epochs not used as knots.
 * BOTH ARE THE SAME MODEL, not independent observations or authentication.
 */
import {AU_KM} from './startrace-sky.js';
import {R4_SCHEMA,interpolateVectors} from './startrace-horizons.js';
export const R6_SCHEMA='gmed-startrace-5:withheld-interpolation-audit:v6';
const SEC_DAY=86400;
const insist=(x,message)=>{if(!x)throw new Error(message);};
const separation=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
function stats(rows,key){
 const v=rows.map(x=>x[key]),sorted=[...v].sort((a,b)=>a-b);
 const q=p=>{const t=(sorted.length-1)*p,i=Math.floor(t);return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*(t-i);};
 return {max:Math.max(...v),rms:Math.sqrt(v.reduce((s,x)=>s+x*x,0)/v.length),
   mean:v.reduce((s,x)=>s+x,0)/v.length,p95:q(.95)};
}
function validate(d,body,stepDays){
 insist(d&&d.schema===R4_SCHEMA&&d.body===body,'Expected '+body+' Horizons dataset');
 insist(d.frame==='J2000 heliocentric ecliptic'&&d.units==='AU-D'&&d.timescale==='TDB',
   'Frame, time or units mismatch for '+body);
 insist(d.sourceHeader?.model==='DE441','DE441 must be explicitly declared for '+body);
 insist(d.points.length>2,'Insufficient '+body+' samples');
 insist(d.points.slice(1).every((x,i)=>Math.abs(x.jd-d.points[i].jd-stepDays)<1e-6),
   'Unexpected sample spacing for '+body);
}
function split(coarse,fine){
 insist(fine.startJD>=coarse.startJD&&fine.endJD<=coarse.endJD,
   'Fine samples are not contained in coarse ephemeris');
 const knots=coarse.points.map(x=>x.jd);
 const shared=fine.points.filter(x=>knots.some(t=>Math.abs(t-x.jd)<1e-8));
 const held=fine.points.filter(x=>!knots.some(t=>Math.abs(t-x.jd)<1e-8));
 insist(shared.length>=3&&held.length>=12,'Insufficient shared anchors or withheld epochs');
 for(const r of shared){
   const p=interpolateVectors(coarse,r.jd);
   insist(separation(p.p,r.p)*AU_KM<.01&&separation(p.v,r.v)*AU_KM/SEC_DAY<1e-7,
     'Shared epochs disagree: possible source-model mismatch');
 }
 return {shared,held};
}
export function compareWithheldVectors({coarseEarth,coarseMoon,fineEarth,fineMoon}={}){
 validate(coarseEarth,'earth',.125);validate(coarseMoon,'moon',.125);
 validate(fineEarth,'earth',1/48);validate(fineMoon,'moon',1/48);
 insist(coarseEarth.startJD===coarseMoon.startJD&&coarseEarth.endJD===coarseMoon.endJD,
   'Coarse epochs not paired');
 insist(fineEarth.startJD===fineMoon.startJD&&fineEarth.endJD===fineMoon.endJD,
   'Fine epochs not paired');
 const e=split(coarseEarth,fineEarth),m=split(coarseMoon,fineMoon);
 insist(e.held.length===m.held.length&&e.shared.length===m.shared.length,'Epoch pairing counts disagree');
 for(let i=0;i<e.held.length;i++)insist(Math.abs(e.held[i].jd-m.held[i].jd)<1e-8,'Heldout epochs differ');
 const rows=e.held.map((ep,i)=>{
   const mp=m.held[i],eh=interpolateVectors(coarseEarth,ep.jd),mh=interpolateVectors(coarseMoon,mp.jd);
   const earthPositionErrorKm=separation(eh.p,ep.p)*AU_KM;
   const moonPositionErrorKm=separation(mh.p,mp.p)*AU_KM;
   const earthVelocityErrorKmS=separation(eh.v,ep.v)*AU_KM/SEC_DAY;
   const moonVelocityErrorKmS=separation(mh.v,mp.v)*AU_KM/SEC_DAY;
   const separationErrorKm=Math.abs(separation(eh.p,mh.p)-separation(ep.p,mp.p))*AU_KM;
   return {jd:ep.jd,earthPositionErrorKm,moonPositionErrorKm,
     earthVelocityErrorKmS,moonVelocityErrorKmS,separationErrorKm};
 });
 const statistics={
   earthPositionKm:stats(rows,'earthPositionErrorKm'),
   moonPositionKm:stats(rows,'moonPositionErrorKm'),
   earthVelocityKmS:stats(rows,'earthVelocityErrorKmS'),
   moonVelocityKmS:stats(rows,'moonVelocityErrorKmS'),
   earthMoonSeparationKm:stats(rows,'separationErrorKm')
 };
 insist(Object.values(statistics).flatMap(Object.values).every(Number.isFinite),'Non-finite interpolation error');
 return {
   schema:R6_SCHEMA,verdict:'WITHHELD_SAME_MODEL_INTERPOLATION_AUDIT',
   modelSourceDeclaration:'DE441',
   sourceStatus:'UNAUTHENTICATED_SOURCE_DERIVED_EXTRACTS',
   coarseSpacingMinutes:180,fineSpacingMinutes:30,
   sharedKnotsExcluded:e.shared.length,heldoutEpochs:rows.length,
   timeRangeJD:{start:fineEarth.startJD,end:fineEarth.endJD},
   statistics,rows,
   limitations:[
    'Higher cadence vectors came from another query to the SAME provider-declared DE441 dynamical model, not independent measurements.',
    'Both saved tables are normalized output through third-party text extraction; original NASA source bytes are not digitally authenticated.',
    'Numerical discrepancies quantify Hermite interpolation only on this one-day interval, not deep-time ephemeris error.',
    'Knot epochs are excluded from error statistics, but must match within numeric tolerances.',
    'Small interpolation errors cannot establish the proposed 5 BCE comet orbit, daytime visibility or the biblical narrative.'
   ],
   sourceAuthenticityVerified:false,independentAstronomicalVerification:false,
   historicalCometOrbitConfirmed:false
 };
}
export function withheldReceipt(result,hashes={}){
 insist(result?.schema===R6_SCHEMA,'R6 result required');
 const valid=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x)?x:null;
 return {...result,generatedAt:new Date().toISOString(),normalizedSourceSha256:{
   coarseEarth:valid(hashes.coarseEarth),coarseMoon:valid(hashes.coarseMoon),
   fineEarth:valid(hashes.fineEarth),fineMoon:valid(hashes.fineMoon)
 }};
}
