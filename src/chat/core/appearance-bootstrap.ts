// Apply the saved palette before CSS loads. The full parser runs after hydration.
export type ChatDocumentAppearance = {
  previous: { name: string; value: string; priority: string }[]
  appearance: string | null
  choice: string | null
  metas: { meta: HTMLMetaElement; content: string; media: string | null }[]
}

export const captureDocumentAppearanceScript = `(function(){var root=document.documentElement;window.__TANCHAT_PRE_CHAT_APPEARANCE__={previous:['--background','--surface','--sidebar','--soft','--text','--muted','--line','--accent','--on-accent','--accent-hover','color-scheme','color','background'].map(function(name){return{name:name,value:root.style.getPropertyValue(name),priority:root.style.getPropertyPriority(name)}}),appearance:root.getAttribute('data-appearance'),choice:root.getAttribute('data-appearance-choice'),metas:Array.from(document.querySelectorAll('meta[name="theme-color"]'),function(meta){return{meta:meta,content:meta.content,media:meta.getAttribute('media')}})}})();`

export const appearanceScript =
  captureDocumentAppearanceScript +
  `(function(){try{var server=JSON.parse(document.documentElement.getAttribute('data-gum-ssr-appearance')||'null');window.__GUM_SSR_APPEARANCE__=server;useServer=server&&localStorage.getItem('gum.appearance.local-only.'+server.userId)!=='true',raw=localStorage.getItem('gum.appearance.settings'),s=useServer?server.settings:raw&&JSON.parse(raw),m=s&&s.mode||localStorage.getItem('gum.appearance')||'system',d=m==='system'?matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light':m;if(d!=='dark'&&d!=='light')d='light';document.documentElement.dataset.appearance=d;document.documentElement.style.colorScheme=d;var paint=useServer?server.paint:JSON.parse(localStorage.getItem('gum.appearance.paint')||'null'),p=paint&&paint[d]||s&&(d==='dark'?s.darkCustom:s.lightCustom);if(p){var names={background:'--background',surface:'--surface',sidebar:'--sidebar',soft:'--soft',text:'--text',muted:'--muted',line:'--line',accent:'--accent',onAccent:'--on-accent'};for(var k in names)if(/^#[0-9a-f]{6}$/i.test(p[k]))document.documentElement.style.setProperty(names[k],p[k])}}catch(e){}})()`
