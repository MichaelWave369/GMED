import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHorizons} from '../src/startrace-horizons.js';
import {compareWithheldVectors,withheldReceipt,R6_SCHEMA} from '../src/startrace-validation.js';
const txt=x=>readFileSync(new URL('../data/horizons-5bce/'+x,import.meta.url),'utf8');
const load=(name,body)=>parseHorizons(txt(name),body);
const data=()=>({
 coarseEarth:load('earth-399-extract.txt','earth'),
 coarseMoon:load('moon-301-extract.txt','moon'),
 fineEarth:load('earth-399-30min-extract.txt','earth'),
 fineMoon:load('moon-301-30min-extract.txt','moon')
});
test('manifest and two separate Horizons requests preserve 49 matched 30-minute samples',()=>{
 const m=JSON.parse(txt('heldout-manifest.json')),d=data();
 assert.equal(m.status,'SOURCE_DERIVED_NUMERIC_TABLE_UNVERIFIED_INDEPENDENTLY');
 assert.equal(m.window.spacingMinutes,30);
 assert.equal(d.fineEarth.count,49);assert.equal(d.fineMoon.count,49);
 assert.deepEqual(d.fineEarth.points.map(x=>x.jd),d.fineMoon.points.map(x=>x.jd));
 assert.equal(d.fineEarth.startJD,1719755.52);
 assert.equal(d.fineEarth.endJD,1719756.52);
});
test('withheld epochs only, no artificial zero-error knot inclusion',()=>{
 const r=compareWithheldVectors(data());
 assert.equal(r.schema,R6_SCHEMA);
 assert.equal(r.sharedKnotsExcluded,9);
 assert.equal(r.heldoutEpochs,40);
 assert.ok(r.rows.every(x=>Number.isFinite(x.earthPositionErrorKm)&&Number.isFinite(x.moonPositionErrorKm)));
 assert.equal(r.sourceAuthenticityVerified,false);
 assert.equal(r.historicalCometOrbitConfirmed,false);
});
test('position and velocity residuals do not show a scale/unit/frame mistake',()=>{
 const r=compareWithheldVectors(data());
 assert.ok(r.statistics.earthPositionKm.max<10);
 assert.ok(r.statistics.moonPositionKm.max<10);
 assert.ok(r.statistics.earthMoonSeparationKm.max<20);
 assert.ok(r.statistics.earthVelocityKmS.max<.01);
 assert.ok(r.statistics.moonVelocityKmS.max<.01);
});
test('fail closed for different declared model, wrong body and altered knot position',()=>{
 const d=data(),other=structuredClone(d);
 other.fineMoon.sourceHeader.model='DE440';
 assert.throws(()=>compareWithheldVectors(other),/DE441/);
 assert.throws(()=>compareWithheldVectors({...d,coarseEarth:d.coarseMoon}),/earth/);
 const modified=structuredClone(d);
 modified.fineEarth.points[0].p[0]+=.0001;
 assert.throws(()=>compareWithheldVectors(modified),/Shared epochs/);
});
test('fail closed if 30-minute cadence or Earth-Moon epoch pairing changes',()=>{
 const d=data(),other=structuredClone(d);
 other.fineMoon.points[12].jd+=.001;
 assert.throws(()=>compareWithheldVectors(other));
 assert.throws(()=>compareWithheldVectors({...d,fineEarth:d.coarseEarth}));
});
test('receipt declares limits, preserves selected hashes and never certifies ancient orbit',()=>{
 const r=compareWithheldVectors(data());
 const receipt=withheldReceipt(r,{fineEarth:'a'.repeat(64),fineMoon:'b'.repeat(64)});
 assert.equal(receipt.normalizedSourceSha256.fineEarth,'a'.repeat(64));
 assert.equal(receipt.normalizedSourceSha256.coarseEarth,null);
 assert.equal(receipt.historicalCometOrbitConfirmed,false);
 assert.equal(receipt.independentAstronomicalVerification,false);
 assert.equal(receipt.rows.length,40);
});
