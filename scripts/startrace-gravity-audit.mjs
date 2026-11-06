#!/usr/bin/env node
// R7 reproducible numerical cross-check. NO historical identification claim.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseHorizons} from '../src/startrace-horizons.js';
import {stressTestGravity,r7Receipt} from '../src/startrace-r7.js';
const read=name=>readFileSync(new URL('../data/horizons-5bce/'+name,import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
try{
 const manifest=JSON.parse(read('manifest.json'));
 if(manifest.status!=='SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY')
  throw new Error('UNEXPECTED_SOURCE_PROVENANCE');
 const e=read('earth-399-extract.txt'),m=read('moon-301-extract.txt');
 const earth=parseHorizons(e,'earth'),moon=parseHorizons(m,'moon');
 if(earth.sourceHeader.model!=='DE441'||moon.sourceHeader.model!=='DE441')
  throw new Error('DE441_SOURCE_DECLARATION_MISSING');
 const args=process.argv.slice(2);
 if(args.some(x=>!['--full','--zero-gravity'].includes(x)))
  throw new Error('Allowed flags: --full, --zero-gravity');
 const source=stressTestGravity(earth,moon,{
   massMultiplier:args.includes('--zero-gravity')?0:1
 });
 const receipt=r7Receipt(source,{earthSha256:sha(e),moonSha256:sha(m)});
 const payload=args.includes('--full')?receipt:{
   schema:receipt.schema,verdict:receipt.verdict,
   comparisonMethods:receipt.comparisonMethods,
   scenario:receipt.scenario,consistency:receipt.consistency,
   solarBenchmark:receipt.solarBenchmark,
   limits:receipt.scientificLimitations,
   sourceHashes:receipt.normalizedSourceSha256,
   sourceStatus:'NASA Horizons-derived normalized extracts; not cryptographically authenticated originals',
   historicalCometOrbitConfirmed:false,independentPhysicalValidation:false,
   sourceCryptographicAuthenticity:false,exactClosestApproachDetermined:false
 };
 console.log(JSON.stringify(payload,null,2));
}catch(error){
 console.error('STARTRACE_R7_REFUSED:',error instanceof Error?error.message:String(error));
 process.exitCode=1;
}
