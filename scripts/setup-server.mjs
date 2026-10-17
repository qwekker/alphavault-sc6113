import express from 'express';
import {compile,root} from './compile.mjs';
const artifacts=compile(),app=express();app.disable('x-powered-by');
app.use((req,res,next)=>{res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");next();});
app.get('/api/setup/artifacts',(req,res)=>res.json(artifacts));
app.get('/vendor/ethers.js',(req,res)=>res.sendFile(root+'node_modules/ethers/dist/ethers.min.js'));
app.get('/',(req,res)=>res.redirect('/setup.html'));app.use(express.static(root+'public'));
const port=Number(process.env.SETUP_PORT||3101);const server=app.listen(port,'127.0.0.1',()=>console.log(`Sepolia deployment wizard: http://127.0.0.1:${port}/setup.html\nOpen in Chrome/Edge with MetaMask. No server-side signing. Existing demo is unchanged.`));
const stop=()=>server.close(()=>process.exit(0));process.on('SIGINT',stop);process.on('SIGTERM',stop);
