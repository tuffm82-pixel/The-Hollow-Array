import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'./',build:{outDir:'dist',emptyOutDir:true,rollupOptions:{input:{game:fileURLToPath(new URL('./index.html',import.meta.url)),observatory:fileURLToPath(new URL('./observatory.html',import.meta.url)),animationLab:fileURLToPath(new URL('./animation-lab.html',import.meta.url))}}},server:{host:'127.0.0.1',port:5179}});
