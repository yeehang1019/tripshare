"use client";
import {useEffect} from 'react';
import {resolveLighting,type Lighting} from '@/lib/appearance';
export default function DeviceLighting(){useEffect(()=>{const device=window.matchMedia('(prefers-color-scheme: dark)');const update=()=>{let mode:Lighting='system';try{const saved=localStorage.getItem('tripshare-theme');if(saved==='light'||saved==='night')mode=saved}catch{}document.documentElement.dataset.theme=resolveLighting(mode,device.matches)};update();device.addEventListener('change',update);window.addEventListener('storage',update);return()=>{device.removeEventListener('change',update);window.removeEventListener('storage',update)}},[]);return null}
