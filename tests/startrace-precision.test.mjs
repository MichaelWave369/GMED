import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHorizons} from '../src/startrace-horizons.js';
import {compareImportedEphemerides,r4Receipt,MU_EARTH,MU_MOON} from '../src/startrace-precision.js';
import {MU_EMB} from '../src/startrace-flyby.js';
// Synthetic, deliberately NOT JPL data; checks fail-closed boundaries and dynamics.
const make=(id,name,offset=0)=>{
 const lines=[
  'Target body name: '+name+' ('+id+') {source: DE441}',
  'Center body name: Sun (10)','Center-site name: BODY CENTER',
  'Start time : B.C. 0005-Jun-01 00:00:00 TDB',
  'Reference frame : Ecliptic of J2000.0','Output units : AU-D',
  'Output type : GEOMETRIC cartesian states','$$SOE'
 ];
 for(let i=0;i<=112;i++){
  const t=i*.125;
  const p=[1-.001*t,.003*t+offset,0];
  const v=[-.001,.003,0];
  lines.push([1719745+i*.125,'B.C. 0005-Jun-01 00:00:00',...p,...v,''].join(','));
 }
 return lines.join('\n')+'\n$$EOE';
};
const e=()=>parseHorizons(make(399,'Earth'),'earth');
const m=()=>parseHorizons(make(301,'Moon',.00257),'moon');
test('split Earth and Moon masses sum to legacy combined mass',()=>{
 assert.ok(Math.abs((MU_EARTH+MU_MOON-MU_EMB)/MU_EMB)<1e-12);
});
test('R4 refuses missing Moon or Earth source',()=>{
 assert.throws(()=>compareImportedEphemerides(e(),null,{day:8}));
 assert.throws(()=>compareImportedEphemerides(null,m(),{day:8}));
});
test('R4 refuses imported data with insufficient anchor coverage',()=>{
 const bad=make(399,'Earth').replaceAll('1719745','1709745');
 assert.throws(()=>parseHorizons(bad,'earth'));
});
test('R4 runs two-source example and flags it as unauthenticated synthetic input',()=>{
 const out=compareImportedEphemerides(e(),m(),{day:8,hour:10,leadDays:2,massMultiplier:0,stepHours:1});
 assert.equal(out.verdict,'CONDITIONAL_IMPORTED_VECTOR_EXPERIMENT');
 assert.equal(out.samples.length,29);
 assert.ok(out.samples.every(x=>Number.isFinite(x.shiftKm)));
 assert.ok(out.metrics.maxEarthProxyDifferenceKm>0);
 assert.equal(out.precisionReconstructionValidated,false);
 assert.equal(out.historicalCometOrbitConfirmed,false);
 assert.equal(out.jplSourceCryptographicallyVerified,false);
});
test('R4 receipt carries exact limitations but not source body text',()=>{
 const out=compareImportedEphemerides(e(),m(),{day:8,hour:10,leadDays:1,massMultiplier:0,stepHours:1});
 const receipt=r4Receipt(out,{earthDigest:'a'.repeat(64),moonDigest:'b'.repeat(64)});
 assert.equal(receipt.schema,'gmed-startrace-5:ephemeris-comparison:v4');
 assert.equal(receipt.inputTextSha256.earth,'a'.repeat(64));
 assert.equal(receipt.inputTextSha256.moon,'b'.repeat(64));
 assert.equal(receipt.samples.length,out.samples.length);
 assert.equal('importedPos' in receipt.samples[0],false);
 assert.equal(receipt.independentVerification,false);
});
