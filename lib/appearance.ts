export type Lighting = 'system'|'light'|'night';
export function resolveLighting(mode:Lighting,dark:boolean):'light'|'night'{return mode==='system'?(dark?'night':'light'):mode}
export function watchLighting(mode:Lighting,device:Pick<MediaQueryList,'matches'|'addEventListener'|'removeEventListener'>,apply:(mode:'light'|'night')=>void){const update=()=>apply(resolveLighting(mode,device.matches));update();if(mode==='system')device.addEventListener('change',update);return()=>{if(mode==='system')device.removeEventListener('change',update)}}
