/*! TK reveal: fail-open UI if styling/boot is late */
(function(){
  function reveal(){
    try {
      document.querySelectorAll('[hidden],.hidden,.sr-only').forEach(n=>{
        n.removeAttribute('hidden'); n.classList.remove('hidden','sr-only');
      });
      const start = document.querySelector('#start,#startSurvey');
      const any = !!document.querySelector('.category-panel input[type="checkbox"]');
      if (start && any) start.disabled = false;
    } catch {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(reveal, 50), {once:true});
  } else {
    setTimeout(reveal, 50);
  }
})();
