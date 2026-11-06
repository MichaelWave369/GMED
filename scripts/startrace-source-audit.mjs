#!/usr/bin/env node
/**
 * Offline, reproducible numerical audit of the normalized NASA/JPL
 * Horizons-derived 5 BCE Earth and Moon vector snapshots.
 * This DOES NOT cryptographically authenticate the source origin.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseHorizons,pairHorizons} from '../src/startrace-horizons.js';
import {compareImportedEphemerides,r4Receipt} from '../src/startrace-precision.js';
import {AU_KM} from '../src/startrace-sky.js';
const file=(name)=>readFileSync(new URL('../data/horizons-5bce/'+name,import.meta.url),'utf8');
const digest=(body)=>createHash('sha256').update(body,'utf8').digest('hex');
function main(){
 const manifest=JSON.parse(file('manifest.json'));
 if(manifest.schema!=='startrace-5:derived-horizons-snapshot:v1'||
    manifest.status!=='SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY')
    throw new Error('Unknown or overly confident provenance manifest');
 const earthText=file('earth-399-extract.txt'),moonText=file('moon-301-extract.txt');
 const earth=parseHorizons(earthText,'earth'),moon=parseHorizons(moonText,'moon');
 if(earth.count!==26||moon.count!==26||earth.startJD!==moon.startJD||
    earth.endJD!==moon.endJD)throw new Error('Earth-Moon snapshot rows are not synchronized');
 const options={day:8,hour:10,leadDays:2,massMultiplier:1,stepHours:.5,deltaTSeconds:10572};
 const result=compareImportedEphemerides(earth,moon,options);
 const joined=pairHorizons(earth,moon,{startJD:result.samples[0].jdTT-1,
   endJD:result.samples.at(-1).jdTT});
 const separations=earth.points.map((row,k)=>Math.hypot(
   ...row.p.map((v,j)=>v-moon.points[k].p[j]))*AU_KM);
 if(!separations.every(x=>x>350000&&x<450000))
   throw new Error('Earth-Moon separation sanity gate failed');
 const receipt=r4Receipt(result,{earthDigest:digest(earthText),moonDigest:digest(moonText)});
 console.log(JSON.stringify({
   ...receipt,
   sourceSnapshot:{
     manifestSchema:manifest.schema,
     status:manifest.status,
     extractionNotRawOriginal:true,
     earthSamples:earth.count,
     moonSamples:moon.count,
     sourceUrls:manifest.targets.map(x=>x.sourceUrl),
     earthMoonSeparationKm:{
       min:Math.min(...separations),
       max:Math.max(...separations)
     },
     sourceVerification:'NASA Horizons response queried; normalized extracts preserved. Independent byte-level authentication is not established.'
   }
 },null,2));
}
try{main();}
catch(e){console.error('STARTRACE_R5_AUDIT_REFUSED:',e instanceof Error?e.message:String(e));process.exitCode=1;}
