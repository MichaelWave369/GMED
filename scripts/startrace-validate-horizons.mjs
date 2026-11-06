#!/usr/bin/env node
/**
 * Offline Rung 6 validation using source-derived, unauthenticated extracts
 * from two separately parameterized Horizons API requests.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseHorizons} from '../src/startrace-horizons.js';
import {compareWithheldVectors,withheldReceipt} from '../src/startrace-validation.js';
const read=x=>readFileSync(new URL('../data/horizons-5bce/'+x,import.meta.url),'utf8');
const hash=x=>createHash('sha256').update(x,'utf8').digest('hex');
try{
 const base=JSON.parse(read('manifest.json'));
 const held=JSON.parse(read('heldout-manifest.json'));
 if(base.status!=='SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY'||
    held.status!=='SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY'||
    held.schema!=='startrace-5:heldout-horizons-30min:v1')
   throw new Error('Provenance boundary missing or changed');
 const names={
  coarseEarth:'earth-399-extract.txt',coarseMoon:'moon-301-extract.txt',
  fineEarth:'earth-399-30min-extract.txt',fineMoon:'moon-301-30min-extract.txt'
 };
 const strings=Object.fromEntries(Object.entries(names).map(([key,value])=>[key,read(value)]));
 const parsed=Object.fromEntries(Object.entries(strings).map(([key,value])=>[
  key,parseHorizons(value,key.toLowerCase().includes('earth')?'earth':'moon')
 ]));
 const result=compareWithheldVectors(parsed);
 const receipt=withheldReceipt(result,Object.fromEntries(Object.entries(strings).map(([key,value])=>[key,hash(value)])));
 const summary={
  schema:receipt.schema,verdict:receipt.verdict,modelSourceDeclaration:receipt.modelSourceDeclaration,
  timeRangeJD:receipt.timeRangeJD,coarseSpacingMinutes:180,fineSpacingMinutes:30,
  sharedKnotsExcluded:receipt.sharedKnotsExcluded,heldoutEpochs:receipt.heldoutEpochs,
  statistics:receipt.statistics,normalizedSourceSha256:receipt.normalizedSourceSha256,
  originalProviderUrls:{
   baseline:base.targets.map(x=>x.sourceUrl),
   withheld:held.targets.map(x=>x.sourceUrl)
  },
  limitations:receipt.limitations,
  sourceAuthenticityVerified:false,independentAstronomicalVerification:false,
  historicalCometOrbitConfirmed:false
 };
 console.log(JSON.stringify(summary,null,2));
}catch(error){
 console.error('STARTRACE_R6_VALIDATION_REFUSED:',error instanceof Error?error.message:String(error));
 process.exitCode=1;
}
