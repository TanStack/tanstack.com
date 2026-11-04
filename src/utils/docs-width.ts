// Apply the saved width before the document can paint. Keep the storage shape
// and expiry behavior in sync with useLocalStorage.
export const DOCS_WIDTH_BOOTSTRAP = `(function(){try{var p=JSON.parse(localStorage.getItem('docsFullWidth'));if(p&&p.value===true&&(!p.ttl||Date.now()<=p.ttl)){document.documentElement.style.setProperty('--docs-content-width','100%')}}catch(e){}})()`
