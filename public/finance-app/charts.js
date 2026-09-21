/* Small dependency-free SVG charts. One y-axis per chart, thin marks, hover on everything. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const tip = () => document.getElementById('tip');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function niceTicks(min, max, n = 4) {
    if (min === max) { max = min + 1; }
    const span = max - min, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, t = [];
    for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10));
    return t;
  }

  function showTip(evt, head, rows) {
    const el = tip();
    el.innerHTML = `<div class="th">${esc(head)}</div>` + rows.map((r) =>
      `<div class="tr"><span>${r.color ? `<i style="background:${r.color}"></i>` : ''}${esc(r.name)}</span><b>${esc(r.value)}</b></div>`).join('');
    el.classList.add('on');
    const pad = 14, w = el.offsetWidth, h = el.offsetHeight;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + w > innerWidth - 8) x = evt.clientX - w - pad;
    if (y + h > innerHeight - 8) y = evt.clientY - h - pad;
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  const hideTip = () => tip().classList.remove('on');

  function frame(el, height, m) {
    const W = Math.max(200, el.clientWidth || 640), H = height;
    el.innerHTML = '';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'chart'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
    el.appendChild(svg);
    return { svg, W, H, x0: m.l, x1: W - m.r, y0: m.t, y1: H - m.b };
  }
  const add = (svg, html) => svg.insertAdjacentHTML('beforeend', html);

  function axes(f, ticks, y, fmt, labels, xOf, every) {
    let s = '';
    ticks.forEach((t) => {
      s += `<line x1="${f.x0}" x2="${f.x1}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? '#bdbab0' : '#ebe9e2'}" stroke-width="1"/>`;
      s += `<text x="${f.x0 - 8}" y="${y(t) + 4}" text-anchor="end">${esc(fmt(t))}</text>`;
    });
    labels.forEach((l, i) => { if (i % every === 0) s += `<text x="${xOf(i)}" y="${f.y1 + 18}" text-anchor="middle">${esc(l)}</text>`; });
    add(f.svg, s);
  }

  function line(el, o) {
    const f = frame(el, o.height || 250, { l: 56, r: o.endLabel === false ? 16 : 70, t: 12, b: 28 });
    const all = o.series.flatMap((s) => s.values).filter((v) => v != null);
    const ticks = niceTicks(o.yMin0 === false ? Math.min(...all) : Math.min(0, ...all), Math.max(...all));
    const lo = ticks[0], hi = ticks[ticks.length - 1], n = o.labels.length;
    const x = (i) => f.x0 + (n === 1 ? 0.5 : i / (n - 1)) * (f.x1 - f.x0);
    const y = (v) => f.y1 - ((v - lo) / (hi - lo)) * (f.y1 - f.y0);
    axes(f, ticks, y, o.fmt, o.labels, x, Math.ceil(n / Math.max(2, Math.floor((f.x1 - f.x0) / 80))));
    o.series.forEach((s) => {
      const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      if (o.area) add(f.svg, `<path d="${d} L${pts[pts.length - 1][0]} ${y(lo)} L${pts[0][0]} ${y(lo)} Z" fill="${s.color}" opacity=".10"/>`);
      add(f.svg, `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
      const last = pts[pts.length - 1];
      add(f.svg, `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${s.color}" stroke="#fcfcfb" stroke-width="2"/>`);
      if (o.endLabel !== false) add(f.svg, `<text class="val" x="${last[0] + 9}" y="${last[1] + 4}">${esc(o.fmt(s.values[s.values.length - 1]))}</text>`);
    });
    (o.marks || []).forEach((mk) => {
      const i = o.labels.indexOf(mk.at); if (i < 0) return;
      add(f.svg, `<line x1="${x(i)}" x2="${x(i)}" y1="${f.y0}" y2="${f.y1}" stroke="#8a8883" stroke-width="1"/><text class="lbl" x="${x(i) + 5}" y="${f.y0 + 10}">${esc(mk.text)}</text>`);
    });
    const cross = document.createElementNS(NS, 'line');
    cross.setAttribute('y1', f.y0); cross.setAttribute('y2', f.y1); cross.setAttribute('stroke', '#52514e'); cross.setAttribute('stroke-width', '1'); cross.style.opacity = 0;
    f.svg.appendChild(cross);
    const hit = document.createElementNS(NS, 'rect');
    hit.setAttribute('x', f.x0); hit.setAttribute('y', f.y0); hit.setAttribute('width', f.x1 - f.x0); hit.setAttribute('height', f.y1 - f.y0); hit.setAttribute('fill', 'transparent');
    f.svg.appendChild(hit);
    hit.addEventListener('mousemove', (e) => {
      const r = f.svg.getBoundingClientRect(), px = (e.clientX - r.left) * (f.W / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - f.x0) / (f.x1 - f.x0)) * (n - 1))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.opacity = 1;
      showTip(e, o.labels[i], o.series.map((s) => ({ name: s.name, color: s.color, value: s.values[i] == null ? '-' : o.fmt(s.values[i]) })));
    });
    hit.addEventListener('mouseleave', () => { cross.style.opacity = 0; hideTip(); });
  }

  /* Stacked columns: `pos` series stack up from zero, `neg` series stack down. 2px surface gap between segments. */
  function stack(el, o) {
    const f = frame(el, o.height || 270, { l: 56, r: 12, t: 12, b: 28 });
    const n = o.labels.length, pos = o.pos || [], neg = o.neg || [];
    const up = o.labels.map((_, i) => pos.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0));
    const dn = o.labels.map((_, i) => neg.reduce((a, s) => a + Math.min(0, s.values[i] || 0), 0));
    const ticks = niceTicks(Math.min(0, ...dn), Math.max(...up));
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const band = (f.x1 - f.x0) / n, bw = Math.min(24, band * 0.62);
    const xc = (i) => f.x0 + band * (i + 0.5);
    const y = (v) => f.y1 - ((v - lo) / (hi - lo)) * (f.y1 - f.y0);
    axes(f, ticks, y, o.fmt, o.labels, xc, Math.ceil(n / Math.max(2, Math.floor((f.x1 - f.x0) / 70))));
    let s = '';
    o.labels.forEach((_, i) => {
      let acc = 0;
      pos.forEach((se, k) => {
        const v = Math.max(0, se.values[i] || 0); if (!v) return;
        const yt = y(acc + v), yb = y(acc), top = k === pos.length - 1 || pos.slice(k + 1).every((p) => !(p.values[i] > 0));
        const h = Math.max(1, yb - yt - (acc ? 2 : 0));
        s += top ? `<path d="M${xc(i) - bw / 2} ${yt + h} v${-(h - 4)} q0 -4 4 -4 h${bw - 8} q4 0 4 4 v${h - 4} z" fill="${se.color}"/>`
                 : `<rect x="${xc(i) - bw / 2}" y="${yt}" width="${bw}" height="${h}" fill="${se.color}"/>`;
        acc += v;
      });
      acc = 0;
      neg.forEach((se, k) => {
        const v = Math.min(0, se.values[i] || 0); if (!v) return;
        const yt = y(acc), yb = y(acc + v), last = k === neg.length - 1 || neg.slice(k + 1).every((p) => !(p.values[i] < 0));
        const h = Math.max(1, yb - yt - 2), ys = yt + 2;
        s += last ? `<path d="M${xc(i) - bw / 2} ${ys} v${h - 4} q0 4 4 4 h${bw - 8} q4 0 4 -4 v${-(h - 4)} z" fill="${se.color}"/>`
                  : `<rect x="${xc(i) - bw / 2}" y="${ys}" width="${bw}" height="${h}" fill="${se.color}"/>`;
        acc += v;
      });
    });
    add(f.svg, s);
    if (o.valueLabels) o.labels.forEach((_, i) => add(f.svg, `<text class="val" x="${xc(i)}" y="${y(up[i]) - 6}" text-anchor="middle">${esc(o.fmt(up[i]))}</text>`));
    o.labels.forEach((l, i) => {
      const hit = document.createElementNS(NS, 'rect');
      hit.setAttribute('x', f.x0 + band * i); hit.setAttribute('y', f.y0); hit.setAttribute('width', band); hit.setAttribute('height', f.y1 - f.y0); hit.setAttribute('fill', 'transparent');
      hit.addEventListener('mousemove', (e) => {
        const rows = [...pos, ...neg].map((se) => ({ name: se.name, color: se.color, value: o.fmt(se.values[i] || 0) }));
        if (o.totalLabel) rows.push({ name: o.totalLabel, value: o.fmt(up[i] + dn[i]) });
        showTip(e, l, rows); hit.setAttribute('fill', '#0b0b0b0a');
      });
      hit.addEventListener('mouseleave', () => { hideTip(); hit.setAttribute('fill', 'transparent'); });
      f.svg.appendChild(hit);
    });
  }

  function hbar(el, o) {
    const rowH = 30, f = frame(el, o.rows.length * rowH + 8, { l: 120, r: 150, t: 4, b: 4 });
    const max = Math.max(...o.rows.map((r) => r.value));
    o.rows.forEach((r, i) => {
      const yy = f.y0 + i * rowH, w = Math.max(2, (r.value / max) * (f.x1 - f.x0));
      add(f.svg, `<text class="lbl" x="${f.x0 - 10}" y="${yy + 19}" text-anchor="end">${esc(r.label)}</text>
        <path d="M${f.x0} ${yy + 8} h${w - 4} q4 0 4 4 v6 q0 4 -4 4 h${-(w - 4)} z" fill="${o.color}"/>
        <text class="val" x="${f.x0 + w + 8}" y="${yy + 19}">${esc(o.fmt(r.value))}</text>
        <text x="${f.x0 + w + 8 + o.fmt(r.value).length * 7.2 + 6}" y="${yy + 19}">${esc(r.sub || '')}</text>`);
      const hit = document.createElementNS(NS, 'rect');
      hit.setAttribute('x', 0); hit.setAttribute('y', yy); hit.setAttribute('width', f.W); hit.setAttribute('height', rowH); hit.setAttribute('fill', 'transparent');
      hit.addEventListener('mousemove', (e) => showTip(e, r.label, r.tip || [{ name: 'Value', value: o.fmt(r.value) }]));
      hit.addEventListener('mouseleave', hideTip);
      f.svg.appendChild(hit);
    });
  }

  function spark(values, color = '#8a8883', w = 120, h = 30) {
    const v = values.filter((x) => x != null); if (v.length < 2) return '';
    const lo = Math.min(...v), hi = Math.max(...v), x = (i) => 2 + (i / (v.length - 1)) * (w - 8), y = (n) => h - 3 - ((n - lo) / (hi - lo || 1)) * (h - 6);
    const d = v.map((n, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(n).toFixed(1)).join(' ');
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${x(v.length - 1)}" cy="${y(v[v.length - 1])}" r="3" fill="#2a78d6"/></svg>`;
  }

  window.Charts = { line, stack, hbar, spark, showTip, hideTip };
})();
