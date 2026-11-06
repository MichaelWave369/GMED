/**
 * STARTRACE-5 R7: generic independent ODE solvers.
 *
 * Classical fixed RK4 and adaptive embedded Dormand–Prince 5(4).
 * They solve the SAME supplied equations, so agreement checks numerical
 * integration only; it cannot validate the physical model or source data.
 *
 * Dormand–Prince 1980 coefficients; SciPy RK45 documents the algorithm:
 * https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.RK45.html
 */
const valid=(v,label,lo,hi)=>{
 if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)
  throw new RangeError(label+' must be in ['+lo+', '+hi+']');
 return v;
};
const stateOK=(v)=>Array.isArray(v)&&v.length>=1&&v.length<=24&&v.every(x=>typeof x==='number'&&Number.isFinite(x));
const combine=(base,ks,coeff,h)=>base.map((y,i)=>y+h*coeff.reduce((acc,c,j)=>acc+c*ks[j][i],0));
const checkedDerivative=(f,t,y)=>{
 const k=f(t,y);
 if(!stateOK(k)||k.length!==y.length)throw new Error('Derivative must return finite matching state');
 return k;
};
export function rk4FixedStep(f,t,y,h){
 if(!stateOK(y))throw new TypeError('RK4 state must be finite');
 valid(t,'time',-1e9,1e9);valid(h,'step',1e-12,1);
 const a=checkedDerivative(f,t,y);
 const b=checkedDerivative(f,t+h/2,combine(y,[a],[.5],h));
 const c=checkedDerivative(f,t+h/2,combine(y,[b],[.5],h));
 const d=checkedDerivative(f,t+h,combine(y,[c],[1],h));
 const next=combine(y,[a,b,c,d],[1/6,1/3,1/3,1/6],h);
 if(!stateOK(next))throw new Error('RK4 state became non-finite');
 return next;
}
const A=[
 [],
 [1/5],
 [3/40,9/40],
 [44/45,-56/15,32/9],
 [19372/6561,-25360/2187,64448/6561,-212/729],
 [9017/3168,-355/33,46732/5247,49/176,-5103/18656],
 [35/384,0,500/1113,125/192,-2187/6784,11/84]
];
const C=[0,1/5,3/10,4/5,8/9,1,1];
const B5=[35/384,0,500/1113,125/192,-2187/6784,11/84,0];
const B4=[5179/57600,0,7571/16695,393/640,-92097/339200,187/2100,1/40];
export function dopri54Step(f,t,y,h,{rtol=1e-10,atol=1e-12}={}){
 if(!stateOK(y))throw new TypeError('DOPRI state must be finite');
 valid(t,'time',-1e9,1e9);valid(h,'step',1e-12,1);
 valid(rtol,'rtol',1e-14,1e-2);
 if(!Array.isArray(atol))valid(atol,'atol',1e-16,1e-3);
 else {
  if(atol.length!==y.length)throw new RangeError('Per-component atol must match state length');
  atol.forEach((x,i)=>valid(x,'atol['+i+']',1e-16,1e-3));
 }
 const ks=[];
 for(let i=0;i<7;i++){
  const yi=i===0?y:combine(y,ks,A[i],h);
  ks.push(checkedDerivative(f,t+C[i]*h,yi));
 }
 const high=combine(y,ks,B5,h),low=combine(y,ks,B4,h);
 if(!stateOK(high)||!stateOK(low))throw new Error('Non-finite adaptive solver state');
 let sum=0;
 for(let i=0;i<y.length;i++){
  const a=Array.isArray(atol)?atol[i]:atol;
  const diff=(high[i]-low[i])/(a+rtol*Math.max(Math.abs(y[i]),Math.abs(high[i])));
  sum+=diff*diff;
 }
 const errorNorm=Math.sqrt(sum/y.length);
 if(!Number.isFinite(errorNorm))throw new Error('Non-finite embedded error estimate');
 return {high,low,errorNorm};
}
/**
 * Integrate to given strictly ascending epochs, returning one state per epoch.
 * A small minimum step fails closed instead of silently returning a low-quality
 * trajectory. Interpolation between accepted steps is deliberately not used:
 * each requested output is reached by an accepted terminal sub-step.
 */
export function adaptiveTimeline(f,t0,y0,targets,{
 rtol=1e-10,
 atol=1e-12,
 initialStepDays=1/48,
 maxStepDays=1/24,
 minStepDays=1e-7,
 maxAttempts=50000
}={}){
 if(!stateOK(y0))throw new TypeError('Initial state must be finite');
 valid(t0,'initial time',-1e9,1e9);
 valid(initialStepDays,'initial step',1e-8,1);
 valid(maxStepDays,'max step',1e-8,1);
 valid(minStepDays,'min step',1e-10,.1);
 if(minStepDays>maxStepDays||initialStepDays<minStepDays)
  throw new RangeError('Inconsistent integrator step bounds');
 if(!Array.isArray(targets)||targets.length<1||targets.length>2000)
  throw new RangeError('Need 1–2000 output epochs');
 targets.forEach((t,i)=>{
  valid(t,'output epoch',-1e9,1e9);
  if(t<t0-1e-9||(i>0&&t<=targets[i-1]+1e-10))
   throw new RangeError('Output epochs must increase and follow the initial time');
 });
 valid(maxAttempts,'attempt budget',1,200000);
 const states=[];let state=y0.slice(),t=t0;
 let h=Math.min(initialStepDays,maxStepDays),accepted=0,rejected=0;
 let smallestAcceptedDays=Infinity,largestAcceptedDays=0,maxEmbeddedError=0;
 for(const target of targets){
  while(target-t>1e-9){
   if(accepted+rejected>=maxAttempts)throw new Error('ADAPTIVE_STEP_BUDGET_EXCEEDED');
   const dt=Math.min(h,maxStepDays,target-t);
   if(dt<minStepDays)throw new Error('ADAPTIVE_MINIMUM_STEP_EXCEEDED');
   const step=dopri54Step(f,t,state,dt,{rtol,atol});
   maxEmbeddedError=Math.max(maxEmbeddedError,step.errorNorm);
   const acceptedStep=step.errorNorm<=1;
   const factor=Math.max(.2,Math.min(5,
     step.errorNorm===0?5:.9*Math.pow(step.errorNorm,-.2)));
   if(acceptedStep){
    state=step.high;t+=dt;accepted++;
    smallestAcceptedDays=Math.min(smallestAcceptedDays,dt);
    largestAcceptedDays=Math.max(largestAcceptedDays,dt);
   }else rejected++;
   h=Math.max(minStepDays,Math.min(maxStepDays,dt*factor));
   if(!acceptedStep&&dt<=minStepDays*(1+1e-9))
    throw new Error('ADAPTIVE_CANNOT_MEET_TOLERANCE');
  }
  t=target;
  states.push(state.slice());
 }
 return {states,stats:{accepted,rejected,smallestAcceptedDays,largestAcceptedDays,
  maxEmbeddedError,rtol,atol,method:'Dormand–Prince RK45(5/4)'}};
}
export function fixedTimeline(f,t0,y0,targets,stepDays,{maxSteps=100000}={}){
 if(!stateOK(y0))throw new TypeError('Initial state must be finite');
 valid(t0,'initial time',-1e9,1e9);valid(stepDays,'RK4 step',1e-8,1);
 if(!Array.isArray(targets)||targets.length<1||targets.length>2000)
  throw new RangeError('Invalid RK4 output epochs');
 const states=[];let t=t0,y=y0.slice(),steps=0;
 for(const target of targets){
  if(!Number.isFinite(target)||target<t-1e-9)throw new RangeError('Unordered RK4 epochs');
  while(target-t>1e-9){
   if(++steps>maxSteps)throw new Error('RK4_STEP_BUDGET_EXCEEDED');
   const dt=Math.min(stepDays,target-t);
   y=rk4FixedStep(f,t,y,dt);
   t+=dt;
  }
  t=target;
  states.push(y.slice());
 }
 return {states,stats:{steps,method:'Classical fixed-step RK4',stepDays}};
}
