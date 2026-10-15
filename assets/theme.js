(function(){
  var root=document.documentElement, key='theme';
  try{var saved=localStorage.getItem(key); if(saved==='dark'||saved==='light') root.setAttribute('data-theme',saved);}catch(e){}
  var btn=document.getElementById('theme'); if(!btn) return;
  btn.addEventListener('click',function(){
    var sysDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
    var cur=root.getAttribute('data-theme')||(sysDark?'dark':'light');
    var next=cur==='dark'?'light':'dark';
    root.setAttribute('data-theme',next);
    try{localStorage.setItem(key,next);}catch(e){}
  });
})();
