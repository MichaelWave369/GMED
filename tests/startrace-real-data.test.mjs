import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHorizons,interpolateVectors,pairHorizons} from '../src/startrace-horizons.js';
import {compareImportedEphemerides,r4Receipt} from '../src/startrace-precision.js';
import {AU_KM} from '../src/startrace-sky.js';

const root=new URL('../data/horizons-5bce/',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const earth=()=>parseHorizons(read('earth-399-extract.txt'),'earth');
const moon=()=>parseHorizons(read('moon-301-extract.txt'),'moon');

test('committed snapshot clearly discloses transformation and cannot be called authenticated original',()=>{
 const manifest=JSON.parse(read('manifest.json'));
 assert.equal(manifest.schema,'startrace-5:derived-horizons-snapshot:v1');
 assert.equal(manifest.status,'SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY');
 assert.equal(manifest.targets.length,2);
 assert.ok(manifest.caveats.some(x=>x.includes('not a NASA digital signature')));
 for(const target of manifest.targets){
  assert.equal(target.rowCount,26);
  assert.ok(target.sourceUrl.startsWith('https://ssd.jpl.nasa.gov/api/horizons.api?'));
 }
});
test('actual source-derived numeric rows pass the R4 frame, time and dimension gate',()=>{
 const e=earth(),m=moon();
 assert.equal(e.sourceHeader.model,'DE441');
 assert.equal(m.sourceHeader.model,'DE441');
 assert.equal(e.sourceStatus,'UNAUTHENTICATED_SOURCE_DECLARATION');
 assert.equal(e.count,26);
 assert.equal(m.count,26);
 assert.equal(e.startJD,1719753.52);
 assert.equal(e.endJD,1719756.645);
 assert.equal(m.startJD,e.startJD);
 assert.equal(m.endJD,e.endJD);
 assert.ok(e.points.every((p,i)=>p.jd===m.points[i].jd));
 assert.ok(e.points.every((p,i)=>i===0||p.jd>e.points[i-1].jd));
});
test('Horizons-derived Earth and Moon remain separated by roughly 405000 km at these sample epochs',()=>{
 const e=earth(),m=moon();
 const separation=e.points.map((p,i)=>Math.hypot(...p.p.map((x,k)=>x-m.points[i].p[k]))*AU_KM);
 assert.ok(Math.min(...separation)>400000);
 assert.ok(Math.max(...separation)<410000);
 const p=pairHorizons(e,m,{startJD:1719754.1,endJD:1719756.25});
 assert.equal(p.earth.body,'earth');
 assert.equal(p.moon.body,'moon');
});
test('real-source-derived Earth state at first JD matches retained numeric source row',()=>{
 const e=earth();
 const state=interpolateVectors(e,1719753.52);
 assert.ok(Math.abs(state.p[0]-0.1765098959003989)<1e-14);
 assert.ok(Math.abs(state.p[1]+1.002065161513025)<1e-14);
 assert.ok(Math.abs(state.v[0]-0.01665124397401893)<1e-14);
});
test('R4 conditional comparison completes using separate source-derived Earth/Moon trajectories',()=>{
 const result=compareImportedEphemerides(earth(),moon(),{day:8,hour:10,leadDays:2,stepHours:.5,massMultiplier:1,deltaTSeconds:10572});
 assert.equal(result.samples.length,29);
 assert.ok(result.metrics.maxImportedVsApproxKm>=0);
 assert.ok(Number.isFinite(result.metrics.maxStepDifferenceKm));
 assert.equal(result.jplSourceCryptographicallyVerified,false);
 assert.equal(result.precisionReconstructionValidated,false);
 assert.equal(result.historicalCometOrbitConfirmed,false);
 const receipt=r4Receipt(result);
 assert.equal(receipt.verdict,'CONDITIONAL_IMPORTED_VECTOR_EXPERIMENT');
 assert.equal(receipt.inputTextSha256.earth,null);
});
