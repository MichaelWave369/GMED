#!/usr/bin/env node
import {DEFAULT_SCENARIO,researchReceipt} from '../src/startrace.js';
const [distance,speed,period]=process.argv.slice(2);
if(process.argv.length>5){
  console.error('Usage: npm run startrace -- [distance-au] [transverse-km-s] [period-years]');
  process.exit(1);
}
try{
  const inputs={
    ...DEFAULT_SCENARIO,
    ...(distance!==undefined?{distanceAu:Number(distance)}:{}),
    ...(speed!==undefined?{transverseSpeedKmS:Number(speed)}:{}),
    ...(period!==undefined?{periodYears:Number(period)}:{})
  };
  console.log(JSON.stringify(researchReceipt(inputs),null,2));
}catch(error){
  console.error(error instanceof Error?error.message:String(error));
  process.exitCode=1;
}
