#!/usr/bin/env node
import {inspect} from '../src/github.js';

const [input,number,...rest]=process.argv.slice(2);
if(!input||!number||rest.length){
 process.stderr.write('Usage: node scripts/gmed.mjs owner/repo PR_NUMBER\n');
 process.stderr.write('Or:    node scripts/gmed.mjs https://github.com/owner/repo/pull/123 PR_NUMBER\n');
 process.exitCode=1;
}else{
 try{
  const report=await inspect(input,number);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  process.exitCode=report.state==='GMED'?0:2;
 }catch(error){
  process.stderr.write('GMED refused verification: '+(error?.message||String(error))+'\n');
  process.exitCode=1;
 }
}
