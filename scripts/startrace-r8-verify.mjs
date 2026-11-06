#!/usr/bin/env node
/**
 * Verify an external SciPy result before publishing. Writes vetted JSON to
 * stdout; no output is emitted on error.
 * Usage: node scripts/startrace-r8-verify.mjs CASE.json SCIPY.json
 */
import {readFileSync} from 'node:fs';
import {verifySciPyReport} from '../src/startrace-r8-verify.js';
try{
 const files=process.argv.slice(2);
 if(files.length!==2)throw new Error('Expected CASE.json SCIPY.json paths');
 const input=JSON.parse(readFileSync(files[0],'utf8'));
 const result=JSON.parse(readFileSync(files[1],'utf8'));
 const verdict=verifySciPyReport(input,result);
 process.stdout.write(JSON.stringify(verdict,null,2)+'\n');
}catch(e){
 console.error('STARTRACE_R8_CROSSCHECK_REFUSED:',e instanceof Error?e.message:String(e));
 process.exitCode=1;
}
