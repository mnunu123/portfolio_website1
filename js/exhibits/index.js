// 전시 목록 — 필요할 때만 불러옴
export const EXHIBITS = [
  { id: 'drainx', no: '01', tab: 'DRAIN-X', load: () => import('./drainx.js') },
  { id: 'threebot', no: '02', tab: '쓰리봇', load: () => import('./threebot.js') },
  { id: 'face', no: '03', tab: '면접 로봇', load: () => import('./face.js') },
  { id: 'aqua', no: '04', tab: 'AQUA-SWAP', load: () => import('./aqua.js') },
];
