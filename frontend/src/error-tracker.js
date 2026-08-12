window.__global_errors = [];

function showError(message) {
  window.__global_errors.push(message);
  let container = document.getElementById('debug-error-banner');
  if (!container) {
    container = document.createElement('div');
    container.id = 'debug-error-banner';
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      background: '#ef4444',
      color: '#ffffff',
      zIndex: '999999',
      padding: '15px',
      fontFamily: 'monospace',
      fontSize: '12px',
      maxHeight: '300px',
      overflowY: 'auto',
      borderBottom: '4px solid #991b1b',
      boxShadow: '0 4px 20px rgba(0,0,0,0.8)'
    });
    
    const title = document.createElement('strong');
    title.innerText = 'CRITICAL RUNTIME ERROR ENCOUNTERED:';
    container.appendChild(title);
    
    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'Dismiss';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      right: '15px',
      top: '10px',
      background: '#ffffff',
      color: '#ef4444',
      border: 'none',
      padding: '4px 10px',
      cursor: 'pointer',
      borderRadius: '4px',
      fontWeight: 'bold'
    });
    closeBtn.onclick = () => container.remove();
    container.appendChild(closeBtn);
    
    // Create a container for log list
    const list = document.createElement('div');
    list.id = 'debug-error-list';
    list.style.marginTop = '10px';
    container.appendChild(list);
    
    document.body.appendChild(container);
  }
  
  const list = document.getElementById('debug-error-list');
  if (list) {
    const item = document.createElement('div');
    item.style.marginTop = '6px';
    item.style.lineBreak = 'anywhere';
    item.innerText = '• ' + message;
    list.appendChild(item);
  }
}

window.addEventListener('error', (e) => {
  const msg = e.message + ' at ' + (e.filename ? e.filename.split('/').pop() : '') + ':' + (e.lineno || '');
  showError(msg);
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const msg = 'Unhandled Rejection: ' + (reason?.stack || reason?.message || String(reason));
  showError(msg);
});
console.log("Nexus global error tracker initialized.");
