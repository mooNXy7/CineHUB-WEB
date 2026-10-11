/* CineHUB Stable 9 — splash ambience bridge */
(function(){
  "use strict";
  window.cinehubSplashPending=true;
  document.addEventListener("DOMContentLoaded",function(){
    /* Autoplay may be blocked. The main audio manager retries on first touch. */
    try{
      if(typeof window.cinehubPlaySplashAmbient==="function"){
        window.cinehubPlaySplashAmbient();
      }
    }catch(_){}
  },{once:true});
  window.cinehubPlaySplashAmbient=function(){
    try{
      if(window.cinehubSplashPending && typeof window.sound==="function"){
        /* Kept intentionally empty: cinehub.js owns the shared audio context. */
      }
    }catch(_){}
  };
})();
