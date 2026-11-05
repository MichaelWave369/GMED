#!/usr/bin/env node
/** R2 Ouroboros. Separate evidence re-observation, not an external trust anchor. */
import {inspect} from '../src/github.js';
import {independentAudit} from '../src/ouroboros.js';

const [repo,pr,...extra]=process.argv.slice(2);
if(!repo||!pr||extra.length){
  process.stderr.write('Usage: node scripts/ouroboros.mjs owner/repo PR_NUMBER\n');
  process.exitCode=1;
}else{
  try{
    const primary=await inspect(repo,pr);
    const secondary=await independentAudit(primary);
    const result={protocol:'OUROBOROS R2',primary,secondary,
      verdict:secondary.state==='DUAL_MATCH'?'DUAL_OBSERVATION_AGREEMENT':
        secondary.state==='AGREED_NOT_GREEN'?'AGREEMENT_WITHOUT_GREEN':'VERIFICATION_REFUSED'};
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    process.exitCode=secondary.state==='DUAL_MATCH'?0:2;
  }catch(error){
    process.stderr.write('OUROBOROS refused certification: '+(error?.message||String(error))+'\n');
    process.exitCode=1;
  }
}
