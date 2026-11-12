import { SwarmRebuild } from './index';
const pal = [['#1d4e6b', '#8fd0e8'], ['#2b3a67', '#7fa6ff'], ['#1f5a4c', '#9be3c4'], ['#5a3b2b', '#f0b98c']];
const art = (i: number) => {
  const [a, b] = pal[i], ph = i * 1.3; let d = 'M0 120';
  for (let x = 0; x <= 800; x += 20) d += ` L${x} ${(120 + Math.sin(x / 90 + ph) * 38 + Math.sin(x / 33 + ph) * 8).toFixed(1)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#0b1016"/></linearGradient></defs><rect width="800" height="240" fill="url(#g)"/><path d="${d} L800 240 L0 240Z" fill="${b}" fill-opacity=".28"/><path d="${d}" fill="none" stroke="${b}" stroke-width="3"/></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};
const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[data-art]'));
imgs.forEach(im => (im.src = art(+im.dataset.art!)));
Promise.all(imgs.map(i => i.decode().catch(() => {}))).then(() => {
  (window as unknown as { swarm: SwarmRebuild }).swarm = new SwarmRebuild({ selector: 'body' });
});
