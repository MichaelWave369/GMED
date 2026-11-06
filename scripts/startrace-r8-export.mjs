#!/usr/bin/env node
/**
 * STARTRACE-5 R8: export a cross-language numerical integration case.
 * Uses the existing Matney hypothetical parabolic seed and R5 normalized,
 * provider-declared DE441 Earth/Moon states. No historical orbit is verified.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AU_KM,CANDIDATES,jdFor,cometParabolic} from '../src/startrace-sky.js';
import {parseHorizons,pairHorizons} from '../src/startrace-horizons.js';
import {GM_SUN_KM3_S2,GM_EARTH_KM3_S2,GM_MOON_KM3_S2} from '../src/startrace-flyby.js';
import {adaptiveTimeline} from '../src/startrace-integrators.js';
import {restrictedCometDerivative} from '../src/startrace-r7.js';
const read=x=>readFileSync(new URL('../data/horizons-5bce/'+x,import.meta.url),'utf8');
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
try{
 const manifest=JSON.parse(read('manifest.json'));
 if(manifest.schema!=='startrace-5:derived-horizons-snapshot:v1'||
    manifest.status!=='SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY')
   throw new Error('SOURCE_MANIFEST_PROVENANCE_UNEXPECTED');
 const earthText=read('earth-399-extract.txt'),moonText=read('moon-301-extract.txt');
 const earth=parseHorizons(earthText,'earth'),moon=parseHorizons(moonText,'moon');
 if(earth.sourceHeader.model!=='DE441'||moon.sourceHeader.model!=='DE441')
   throw new Error('SOURCE_DECLARED_MODEL_UNEXPECTED');
 const day=8,leadDays=2,deltaTSeconds=10572,massMultiplier=1;
 const epochJD=jdFor(day,12)-leadDays+deltaTSeconds/86400;
 const hours=Array.from({length:29},(_,i)=>4+i/2);
 const targetJD=hours.map(hour=>jdFor(day,hour)+deltaTSeconds/86400);
 pairHorizons(earth,moon,{startJD:epochJD,endJD:targetJD.at(-1)});
 const candidate=CANDIDATES.find(x=>x.day===day),dt=.001;
 const initialPosition=cometParabolic(epochJD,candidate);
 const velocity=sub(cometParabolic(epochJD+dt,candidate),
   cometParabolic(epochJD-dt,candidate)).map(x=>x/(2*dt));
 const initialState=[...initialPosition,...velocity];
 const js=adaptiveTimeline(restrictedCometDerivative(earth,moon,{massMultiplier}),
   epochJD,initialState,targetJD,{
     rtol:1e-10,atol:[1e-12,1e-12,1e-12,3e-12,3e-12,3e-12],
     initialStepDays:1/96,maxStepDays:1/48,minStepDays:1e-7,maxAttempts:25000
   });
 if(!js.states.every(s=>s.length===6&&s.every(Number.isFinite)))
   throw new Error('JS_REFERENCE_CONTAINS_NONFINITE_VALUES');
 const result={
   schema:'gmed-startrace-5:r8-cross-language-input:v1',
   verdict:'CONDITIONAL_NUMERICAL_MODEL_INPUT',
   candidate:'Matney hypothetical June 8, 5 BCE, not an observed orbit',
   sourceProvenance:'Normalized NASA Horizons-derived Earth/Moon extracts; provider-declared DE441; not cryptographically authenticated',
   historicalCometOrbitConfirmed:false,
   sourceAuthenticityVerified:false,
   physicalModelIndependentlyValidated:false,
   epochJD,outputJD:targetJD,localSolarHours:hours,initialState,
   sourceBodyVectors:{
     earth:earth.points.map(x=>({jd:x.jd,p:x.p,v:x.v})),
     moon:moon.points.map(x=>({jd:x.jd,p:x.p,v:x.v}))
   },
   sourceNormalizedSha256:{earth:sha(earthText),moon:sha(moonText)},
   units:{position:'AU',velocity:'AU/day',time:'JD TDB approximate from TT',frame:'Sun-centered J2000 ecliptic'},
   gravitationalConstantsKm3S2:{
     sun:GM_SUN_KM3_S2,earth:GM_EARTH_KM3_S2,moon:GM_MOON_KM3_S2
   },
   auKm:AU_KM,earthCutoffKm:15000,moonCutoffKm:7000,
   jsReference:{method:'GMED independent JS Dormand-Prince 5(4)',
      states:js.states,steps:js.stats},
   limitations:[
     'A hypothetical comet starting state was generated from a published parabolic candidate, not fitted historical astrometry.',
     'Both cross-language programs use the same restricted Sun/Earth/Moon model; there is no independent physical validation.',
     'Source vectors are normalized extracted text, not cryptographically authenticated original JPL responses.',
     'Ancient TT-to-TDB simplification, approximate Delta T, omitted planets and non-gravitational forces remain.',
     'No historical identification, true closest approach or optical visibility is determined.'
   ]
 };
 process.stdout.write(JSON.stringify(result)+'\n');
}catch(e){
 console.error('R8_CASE_REFUSED:',e instanceof Error?e.message:String(e));
 process.exitCode=1;
}
