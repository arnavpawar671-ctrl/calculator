// Calculator logic (beginner-friendly and well-commented)
(() => {
  // Elements
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const buttons = document.querySelectorAll('.pad .btn');
  const copyBtn = document.getElementById('copyResult');
  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const toggleHistory = document.getElementById('toggleHistory');
  const toggleTheme = document.getElementById('toggleTheme');
  const clearHistoryBtn = document.getElementById('clearHistory');

  // State
  let expr = '';
  const STORAGE_KEY = 'calc_history_v1';
  const THEME_KEY = 'calc_theme_v1';
  const MEMORY_KEY = 'calc_memory_v1';

  // Helpers
  function updateDisplay(){
    expressionEl.textContent = expr || '0';
  }

  function pushHistory(expression, result){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({ expression, result, ts: Date.now() });
      // keep last 50
      const clipped = arr.slice(0,50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clipped));
      renderHistory();
    }catch(e){
      console.error('History save failed', e);
    }
  }

  // Memory utilities (M+, M-, MR, MC)
  function getMemory(){
    const v = localStorage.getItem(MEMORY_KEY);
    return v ? Number(v) : 0;
  }
  function setMemory(n){
    localStorage.setItem(MEMORY_KEY, String(n));
    updateMemoryIndicator();
  }
  function clearMemory(){
    localStorage.removeItem(MEMORY_KEY);
    updateMemoryIndicator();
  }
  function updateMemoryIndicator(){
    const memBtns = document.querySelectorAll('.mem');
    const has = !!localStorage.getItem(MEMORY_KEY);
    memBtns.forEach(b=> b.style.opacity = has ? '1' : '0.7');
  }

  // Display history items
  function renderHistory(){
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    historyList.innerHTML = '';
    if(arr.length === 0){
      historyList.innerHTML = '<li class="small">No history yet</li>';
      return;
    }
    arr.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `<div><div>${escapeHtml(item.expression)}</div><small>${new Date(item.ts).toLocaleString()}</small></div><div><strong>${escapeHtml(item.result)}</strong></div>`;
      // clicking an item loads it back into expression
      li.addEventListener('click', () => {
        expr = String(item.result);
        updateDisplay();
      });
      historyList.appendChild(li);
    })
  }

  function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function clear(){ expr = ''; resultEl.textContent = ''; updateDisplay(); }
  function del(){ expr = expr.slice(0,-1); updateDisplay(); }

  // Sanitize expression: allow digits, operators, parentheses, decimal and spaces
  function sanitize(input){
    // replace fancy operators with JS equivalents
    input = input.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
    // transform percentages like 50% into (50/100)
    input = input.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
    // only allow characters we expect
    if(!/^[0-9+\-*/().%\s]+$/.test(input)) throw new Error('Invalid characters');
    return input;
  }

  // Evaluate expression safely with basic checks
  function evaluateExpression(){
    if(!expr) return;
    try{
      const value = computeValue(expr, {requireComplete:true});
      if(typeof value === 'number' && !Number.isFinite(value)) throw new Error('Math error');
      const display = (Math.round((value + Number.EPSILON) * 1e12) / 1e12).toString();
      resultEl.textContent = display;
      pushHistory(expr, display);
      expr = String(display);
      updateDisplay();
    }catch(err){
      resultEl.textContent = 'Error';
      console.warn('Eval error', err);
    }
  }

  // Compute value helper - can be used for live preview or final eval
  function computeValue(input, opts = { requireComplete:false }){
    const s = sanitize(input);
    // if requireComplete true then disallow trailing operator or dot
    if(opts.requireComplete){
      if(/[+\-*/.]$/.test(s)) throw new Error('Incomplete expression');
    }
    // eslint-disable-next-line no-new-func
    const value = Function('return ' + s)();
    return value;
  }

  // Button handling
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.value;
      if(v === 'C') return clear();
      if(v === 'DEL') return del();
      if(v === '=') return evaluateExpression();
      // memory buttons
      if(v === 'MC') return clearMemory();
      if(v === 'MR') { expr += String(getMemory()); updateDisplay(); showPreview(); return; }
      if(v === 'M+') { try{ const cur = computeValue(expr, {requireComplete:false}); setMemory(getMemory() + Number(cur || 0)); }catch(e){ /* ignore */ } return; }
      if(v === 'M-') { try{ const cur = computeValue(expr, {requireComplete:false}); setMemory(getMemory() - Number(cur || 0)); }catch(e){ /* ignore */ } return; }

      // append value (prevent multiple decimals in a single number)
      if(v === '.' && /\./.test(lastNumber())) return;
      expr += v;
      updateDisplay();
      showPreview();
    })
  });

  function lastNumber(){
    const m = expr.match(/(\d+\.?\d*)$/);
    return m ? m[0] : '';
  }

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') { evaluateExpression(); e.preventDefault(); return; }
    if(e.key === 'Backspace'){ del(); e.preventDefault(); return; }
    if(e.key === 'Escape'){ clear(); return; }
    // allow digits and operators
    if(/^[0-9+\-*/().%]$/.test(e.key)){
      expr += e.key;
      updateDisplay();
      showPreview();
      return;
    }
  });

  // live-preview: try to compute current expression without committing
  function showPreview(){
    try{
      const v = computeValue(expr, {requireComplete:false});
      if(typeof v === 'number' && Number.isFinite(v)){
        const display = (Math.round((v + Number.EPSILON) * 1e12) / 1e12).toString();
        resultEl.textContent = display;
        return;
      }
    }catch(e){ /* ignore preview errors */ }
    resultEl.textContent = '';
  }

  // copy result
  if(copyBtn){
    copyBtn.addEventListener('click', async () => {
      try{
        const text = resultEl.textContent.trim();
        if(!text) return;
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '✅';
        setTimeout(()=> copyBtn.textContent = '📋', 900);
      }catch(e){
        console.warn('Copy failed', e);
      }
    });
  }

  // History toggling
  toggleHistory.addEventListener('click', () => {
    historyPanel.classList.toggle('hidden');
    renderHistory();
  });
  clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
  });

  // Theme toggle
  function applyTheme(t){
    if(t === 'light') document.body.classList.add('light'); else document.body.classList.remove('light');
    localStorage.setItem(THEME_KEY, t);
  }
  toggleTheme.addEventListener('click', () => {
    const current = document.body.classList.contains('light') ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });

  // bootstrap
  (function init(){
    // load theme
    const t = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(t);
    // render history placeholder
    renderHistory();
    updateDisplay();
    updateMemoryIndicator();
  })();
})();