/* CineHUB lightweight motion controller */
(function(){
  "use strict";
  let raf=0, scrollHandler=null, resizeHandler=null, observer=null;

  function updateScroll(){
    raf=0;
    if(document.hidden || window.CineHUBPerformance?.isPerformance?.())return;
    const doc=document.documentElement;
    const max=Math.max(1,doc.scrollHeight-window.innerHeight);
    const p=Math.min(1,Math.max(0,window.scrollY/max));
    doc.style.setProperty("--scroll-progress",p.toFixed(4));
  }
  function stop(){
    if(raf){cancelAnimationFrame(raf);raf=0}
    if(scrollHandler)window.removeEventListener("scroll",scrollHandler);
    if(resizeHandler)window.removeEventListener("resize",resizeHandler);
    scrollHandler=resizeHandler=null;
    if(observer){try{observer.disconnect()}catch(_){}observer=null}
    document.querySelectorAll(".cinehub-scroll-progress").forEach(el=>el.remove());
  }
  function setupReveal(){
    const items=document.querySelectorAll(".section, .premium-card, .explore-card, .screen-head");
    if(!("IntersectionObserver" in window)){
      items.forEach(el=>el.classList.add("is-visible")); return;
    }
    observer=new IntersectionObserver((entries)=>{
        entries.forEach(entry=>{
        if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target)}
      });
    },{root:null,rootMargin:"0px 0px -8% 0px",threshold:.04});
    items.forEach(el=>{el.classList.add("cinehub-reveal");observer.observe(el)});
  }
  function start(){
    stop();
    const perf=window.CineHUBPerformance?.isPerformance?.();
    if(!perf){
      let bar=document.querySelector('.cinehub-scroll-progress');
      if(!bar){bar=document.createElement('div');bar.className='cinehub-scroll-progress';bar.setAttribute('aria-hidden','true');document.body.appendChild(bar)}
      updateScroll();
      scrollHandler=()=>{if(!raf)raf=requestAnimationFrame(updateScroll)};
      resizeHandler=()=>{if(!raf)raf=requestAnimationFrame(updateScroll)};
      window.addEventListener('scroll',scrollHandler,{passive:true});
      window.addEventListener('resize',resizeHandler,{passive:true});
    }
    setupReveal();
  }
  function init(){
    start();
    window.addEventListener("cinehub:modechange",start);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();