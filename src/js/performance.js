/* CineHUB Performance Controller — progressive device-light rendering */
(function(){
  "use strict";
  var KEY="cinehub_mode";
  function normalize(v){return v==="performance"||v==="advanced"?v:"advanced";}
  function setClasses(mode){
    document.documentElement.classList.toggle("cinehub-performance",mode==="performance");
    document.documentElement.classList.toggle("cinehub-advanced",mode==="advanced");
    if(document.body){
      document.body.classList.toggle("cinehub-performance",mode==="performance");
      document.body.classList.toggle("cinehub-advanced",mode==="advanced");
    }
  }
  function apply(mode){
    mode=normalize(mode);
    setClasses(mode);
    try{localStorage.setItem(KEY,mode)}catch(_){}
    window.dispatchEvent(new CustomEvent("cinehub:modechange",{detail:{mode:mode}}));
    return mode;
  }
  function get(){try{return normalize(localStorage.getItem(KEY));}catch(_){return "advanced";}}
  window.CineHUBPerformance={
    getMode:get,
    setMode:apply,
    isPerformance:function(){return get()==="performance";},
    isAdvanced:function(){return get()==="advanced";}
  };
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){apply(get())},{once:true});
  }else{
    apply(get());
  }
})();