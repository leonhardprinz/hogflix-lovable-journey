/* HogFlix Finance. This file only fetches and draws. Every metric definition lives in a PostHog Endpoint. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const C = { new: '#2a78d6', exp: '#1baf7a', react: '#eda100', contr: '#4a3aa7', churn: '#e34948', mute: '#8a8883' };

  // ---------- formatting
  const money = (v) => {
    if (v == null || isNaN(v)) return '-';
    const a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e4) return `${s}$${Math.round(a / 1e3)}K`;
    if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
    return `${s}$${a.toFixed(a < 100 ? 2 : 0)}`;
  };
  const moneyFull = (v) => (v == null ? '-' : (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'));
  const num = (v) => (v == null ? '-' : Math.round(v).toLocaleString('en-US'));
  const compact = (v) => (Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(v >= 1e5 ? 0 : 1) + 'K' : String(Math.round(v)));
  const pct = (v, d = 1) => (v == null ? '-' : v.toFixed(d) + '%');
  const mon = (iso) => { const d = new Date(iso.slice(0, 10) + 'T12:00:00Z'); return d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + ' ' + String(d.getUTCFullYear()).slice(2); };
  const chg = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
  const delta = (v, goodUp = true, suffix = '%', d = 1) => {
    if (v == null) return '';
    const up = v >= 0, good = up === goodUp;
    return `<b class="${good ? 'up' : 'down'}">${up ? '+' : ''}${v.toFixed(d)}${suffix}</b>`;
  };

  // ---------- data
  const cache = new Map(), meta = {};
  let catalog = { items: [] };
  async function run(name, vars = {}) {
    const key = name + JSON.stringify(vars);
    if (!cache.has(key)) {
      // Live call through the serverless proxy; if it is unreachable, fall back to the bundled snapshot.
      const snap = 'snapshots/' + (name + Object.entries(vars).map(([k, v]) => `__${k}-${v}`).join('')).replace(/[^a-z0-9_-]/gi, '_') + '.json';
      const live = fetch('/api/finance?' + new URLSearchParams({ endpoint: name, ...vars })).then((r) => r.json()).then((j) => { if (j.error || !j.rows) throw new Error(j.error || 'bad response'); return j; });
      cache.set(key, live.catch((err) => fetch(snap).then((r) => r.json()).then((j) => ({ ...j, meta: { ...j.meta, source: 'snapshot', snapshot_reason: err.message } }))).then((j) => {
        meta[name] = j.meta; updateMode(); return j.rows;
      }));
    }
    return cache.get(key);
  }
  function updateMode() {
    const ms = Object.values(meta); if (!ms.length) return;
    const snap = ms.some((m) => m.source === 'snapshot');
    $('#mode').className = 'mode ' + (snap ? 'snapshot' : 'live');
    const avg = Math.round(ms.filter((m) => m.latency_ms).reduce((a, m) => a + m.latency_ms, 0) / Math.max(1, ms.filter((m) => m.latency_ms).length));
    $('#modeText').textContent = snap ? 'Snapshot data' : `Live from PostHog, avg ${avg} ms`;
  }

  // ---------- building blocks
  const src = (key, mini) => `<button class="src${mini ? ' mini' : ''}" data-info="${key}" title="Where does this come from?"><i>i</i>${esc(INFO[key].endpoint)}</button>`;
  const card = (key, title, sub, body, cls = '') => `<div class="card ${cls}"><div class="card-h"><div><div class="card-t">${esc(title)}</div>${sub ? `<div class="card-s">${esc(sub)}</div>` : ''}</div>${key ? src(key) : ''}</div>${body}</div>`;
  const tile = (key, label, value, deltaHtml, extra = '', cls = '') => `<div class="card tile ${cls}"><div class="card-h"><div class="label">${esc(label)}</div>${key ? src(key, cls !== 'hero') : ''}</div><div class="value">${value}</div><div class="delta">${deltaHtml || '&nbsp;'}</div>${extra}</div>`;
  const legend = (items) => `<div class="legend">${items.map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}</div>`;
  const z = (v) => v || 0;

  // ---------- views
  const views = {
    async live(el) {
      const [[k], mrr, fails] = await Promise.all([run('fin_kpi_snapshot'), run('fin_mrr_monthly'), run('fin_payment_failures_weekly')]);
      const last12 = mrr.slice(-13).map((r) => r.ending_mrr), wk = fails[fails.length - 2] || fails[fails.length - 1] || {};
      el.innerHTML = `
        <div class="grid g21">
          ${tile('kpi', 'Monthly recurring revenue', money(k.mrr), `${delta(chg(k.mrr, k.mrr_prev_month_end))} since last month-end &middot; ledger as of ${esc(k.ledger_as_of.slice(0, 16))}`, Charts.spark(last12, C.mute, 320, 54), 'hero')}
          <div class="stack">
            ${tile('kpi', 'Annual run rate', money(k.arr), 'MRR &times; 12')}
            ${tile('kpi', 'Subscribers', num(k.customers), `${delta(chg(k.customers, k.customers_prev_month_end))} since last month-end`)}
          </div>
        </div>
        <div class="grid g4" style="margin-top:14px">
          ${tile('kpi', 'Net new MRR, month to date', money(k.net_new_mrr_mtd), 'new + expansion - churn')}
          ${tile('kpi', 'New MRR, month to date', money(k.new_mrr_mtd), `${num(k.new_customers_mtd)} new subscribers`)}
          ${tile('kpi', 'Churned MRR, month to date', money(k.churn_mrr_mtd), `${num(k.churned_customers_mtd)} subscribers lost`)}
          ${tile('kpi', 'ARPA', money(k.arpa), 'MRR / subscribers')}
        </div>
        <div class="grid g21" style="margin-top:14px">
          ${card('failures', 'Failed Ultimate-plan payments per week', 'Real product events from the HogFlix app, not seeded', '<div id="c-fail"></div>')}
          ${card(null, 'Why this tile is here', '', `<p style="margin:0;color:var(--ink-2)">A failed checkout never becomes an invoice, so it never shows up in a billing export. It does show up in product data. Last full week: <b style="color:var(--ink)">${num(wk.failed_attempts)} failed attempts from ${num(wk.users_affected)} users</b>.</p><p class="note">Same API, same key, same screen as the finance figures.</p>`)}
        </div>`;
      Charts.stack($('#c-fail'), { labels: fails.map((r) => mon(r.week).replace(/ \d+$/, '') + ' ' + +r.week.slice(8, 10)), pos: [{ name: 'Failed attempts', color: C.churn, values: fails.map((r) => r.failed_attempts) }], fmt: (v) => num(v), height: 190 });
    },

    async mrr(el) {
      const mrr = await run('fin_mrr_monthly');
      const m12 = mrr.slice(-12);
      el.innerHTML = `
        ${card('mrrTrend', 'Ending MRR', 'Running total of the billing ledger, monthly', '<div id="c-trend"></div>')}
        <div class="grid g21" style="margin-top:14px">
          ${card('mrrWaterfall', 'What moved MRR', 'Last 12 months. Bars above zero add MRR, bars below remove it', legend([['New', C.new], ['Expansion', C.exp], ['Reactivation', C.react], ['Contraction', C.contr], ['Churn', C.churn]]) + '<div id="c-wf"></div>')}
          ${card('mrrSegment', 'Where MRR sits today', 'One endpoint, the split is a variable', '<div class="seg" id="segsw"></div><div id="c-seg" style="margin-top:12px"></div><div class="note" id="segnote"></div>')}
        </div>`;
      Charts.line($('#c-trend'), { labels: mrr.map((r) => mon(r.month)), series: [{ name: 'Ending MRR', color: C.new, values: mrr.map((r) => r.ending_mrr) }], fmt: money, area: true, height: 260,
        marks: [{ at: 'Mar 26', text: 'Price increase' }, { at: 'Jun 26', text: 'Partner bundle launch' }] });
      Charts.stack($('#c-wf'), { labels: m12.map((r) => mon(r.month)), fmt: money, totalLabel: 'Net new MRR', height: 290,
        pos: [{ name: 'New', color: C.new, values: m12.map((r) => z(r.new_mrr)) }, { name: 'Expansion', color: C.exp, values: m12.map((r) => z(r.expansion_mrr)) }, { name: 'Reactivation', color: C.react, values: m12.map((r) => z(r.reactivation_mrr)) }],
        neg: [{ name: 'Contraction', color: C.contr, values: m12.map((r) => z(r.contraction_mrr)) }, { name: 'Churn', color: C.churn, values: m12.map((r) => z(r.churn_mrr)) }] });
      const dims = ['plan', 'region', 'country', 'channel'];
      const draw = async (dim) => {
        $('#segsw').innerHTML = dims.map((d) => `<button class="${d === dim ? 'on' : ''}" data-d="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('');
        $('#c-seg').innerHTML = '<div class="loading">calling endpoint...</div>';
        const rows = await run('fin_mrr_by_segment', { fin_segment_by: dim }), tot = rows.reduce((a, r) => a + r.mrr, 0);
        Charts.hbar($('#c-seg'), { color: C.new, fmt: money, rows: rows.map((r) => ({ label: r.segment, value: r.mrr, sub: pct((r.mrr / tot) * 100, 0), tip: [{ name: 'MRR', value: moneyFull(r.mrr) }, { name: 'Subscribers', value: num(r.customers) }, { name: 'ARPA', value: money(r.arpa) }, { name: 'Net new MRR, MTD', value: moneyFull(r.net_new_mrr_mtd) }] })) });
        $('#segnote').innerHTML = `Called with <span class="pill">{"variables": {"fin_segment_by": "${dim}"}}</span>`;
      };
      $('#segsw').addEventListener('click', (e) => e.target.dataset.d && draw(e.target.dataset.d));
      draw('plan');
    },

    async mom(el) {
      const [mrr, cust] = await Promise.all([run('fin_mrr_monthly'), run('fin_customer_churn_monthly')]);
      const closed = mrr.slice(0, -1), a = closed[closed.length - 1], b = closed[closed.length - 2], y = closed[closed.length - 13];
      const cm = Object.fromEntries(cust.map((r) => [r.month, r])), ca = cm[a.month], cb = cm[b.month], cy = y && cm[y.month];
      const row = (label, va, vb, vy, f, goodUp = true, isPct = false) => {
        const d1 = isPct ? va - vb : chg(va, vb), d2 = vy == null ? null : isPct ? va - vy : chg(va, vy);
        return `<tr><td>${label}</td><td>${f(va)}</td><td>${f(vb)}</td><td class="delta">${delta(d1, goodUp, isPct ? ' pt' : '%', isPct ? 2 : 1)}</td><td>${vy == null ? '-' : f(vy)}</td><td class="delta">${delta(d2, goodUp, isPct ? ' pt' : '%', isPct ? 2 : 1)}</td></tr>`;
      };
      el.innerHTML = card('mom', `${mon(a.month)} against ${mon(b.month)} and ${y ? mon(y.month) : 'last year'}`, 'Closed months only. The current month is excluded until it ends', `
        <div class="scroll"><table>
          <thead><tr><th>Metric</th><th>${mon(a.month)}</th><th>${mon(b.month)}</th><th>Change</th><th>${y ? mon(y.month) : ''}</th><th>vs last year</th></tr></thead>
          <tbody>
            <tr class="group"><td colspan="6">Recurring revenue</td></tr>
            ${row('Ending MRR', a.ending_mrr, b.ending_mrr, y?.ending_mrr, moneyFull)}
            ${row('New MRR', a.new_mrr, b.new_mrr, y?.new_mrr, moneyFull)}
            ${row('Expansion MRR', a.expansion_mrr, b.expansion_mrr, y?.expansion_mrr, moneyFull)}
            ${row('Churned MRR', -a.churn_mrr, -b.churn_mrr, y ? -y.churn_mrr : null, moneyFull, false)}
            ${row('Net new MRR', a.net_new_mrr, b.net_new_mrr, y?.net_new_mrr, moneyFull)}
            <tr class="group"><td colspan="6">Subscribers</td></tr>
            ${row('Ending subscribers', ca.ending_customers, cb.ending_customers, cy?.ending_customers, num)}
            ${row('New subscribers', ca.new_customers, cb.new_customers, cy?.new_customers, num)}
            ${row('Logo churn', ca.logo_churn_pct, cb.logo_churn_pct, cy?.logo_churn_pct, (v) => pct(v, 2), false, true)}
            ${row('Net revenue retention', ca.nrr_pct, cb.nrr_pct, cy?.nrr_pct, (v) => pct(v, 2), true, true)}
            ${row('ARPA', ca.arpa, cb.arpa, cy?.arpa, (v) => '$' + v.toFixed(2))}
          </tbody></table></div>`) +
        `<div class="callout" style="margin-top:14px"><b>What to notice:</b> subscribers grew faster than MRR and ARPA slipped. The partner bundle brings volume at a wholesale price. Whether that is a good trade is a finance question, and the figures to answer it are one click away on the Cohorts and Spend tabs.</div>`;
    },

    async customers(el) {
      const c = await run('fin_customer_churn_monthly'), closed = c.slice(0, -1), L = closed.map((r) => mon(r.month));
      el.innerHTML = `
        <div class="grid g2">
          ${card('customers', 'Subscribers', 'Ending balance per month', '<div id="c-sub"></div>')}
          ${card('customers', 'Logo churn and revenue churn', 'Share of the opening balance lost each month', legend([['Logo churn', C.churn], ['Revenue churn', C.contr]]) + '<div id="c-churn"></div>')}
        </div>
        <div class="grid g21" style="margin-top:14px">
          ${card('customers', 'Net revenue retention, monthly', 'Opening MRR plus expansion, less contraction and churn', '<div id="c-nrr"></div>')}
          ${card(null, 'What to notice', '', `<p style="margin:0;color:var(--ink-2)">March and April 2026: the price increase pushed logo churn from about 4.0% to 5.3% for two months. Net revenue retention in March was still 99%, because the increase more than paid for the subscribers it cost.</p><p class="note">That is the argument for or against the next increase, and it comes out of one endpoint.</p>`)}
        </div>`;
      Charts.line($('#c-sub'), { labels: c.map((r) => mon(r.month)), series: [{ name: 'Subscribers', color: C.new, values: c.map((r) => r.ending_customers) }], fmt: compact, area: true, height: 230 });
      Charts.line($('#c-churn'), { labels: L, series: [{ name: 'Logo churn', color: C.churn, values: closed.map((r) => r.logo_churn_pct) }, { name: 'Revenue churn', color: C.contr, values: closed.map((r) => r.revenue_churn_pct) }], fmt: (v) => pct(v, 1), height: 214, yMin0: false });
      Charts.line($('#c-nrr'), { labels: L, series: [{ name: 'NRR', color: C.exp, values: closed.map((r) => r.nrr_pct) }], fmt: (v) => pct(v, 1), height: 220, yMin0: false, marks: [{ at: 'Mar 26', text: 'Price increase' }] });
    },

    async cohorts(el) {
      const rows = await run('fin_cohort_retention');
      const by = {}; rows.forEach((r) => ((by[r.cohort_month] ||= { size: r.cohort_size, m: {} }).m[r.month_index] = r.retained_pct));
      const cohorts = Object.keys(by).sort(), maxIdx = Math.max(...rows.map((r) => r.month_index));
      const ramp = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281'];
      const cell = (v) => { if (v == null) return '<td></td>'; const t = Math.max(0, Math.min(1, (v - 58) / 42)), i = Math.round(t * (ramp.length - 1)); return `<td style="background:${ramp[i]};color:${i > 5 ? '#fff' : '#0b0b0b'}">${v.toFixed(0)}%</td>`; };
      el.innerHTML = card('cohort', 'Subscribers retained, by signup month', 'Read across for one cohort over time, down a column to compare cohorts at the same age', `
        <div class="scroll"><table class="heat"><thead><tr><th>Cohort</th><th style="text-align:right;padding-right:10px">Size</th>${Array.from({ length: maxIdx + 1 }, (_, i) => `<th style="text-align:center">M${i}</th>`).join('')}</tr></thead>
        <tbody>${cohorts.map((c) => `<tr><td>${mon(c + '-01')}</td><td style="text-align:right;padding:0 10px;background:none">${num(by[c].size)}</td>${Array.from({ length: maxIdx + 1 }, (_, i) => cell(by[c].m[i])).join('')}</tr>`).join('')}</tbody></table></div>`) +
        `<div class="callout" style="margin-top:14px"><b>What to notice:</b> look down column M1. Most cohorts keep about 91% after their first month. February and March 2026 kept 87 to 88%: they met the price increase in their first billing cycle. The blended churn line on the previous tab cannot tell you that.</div>`;
    },

    async cac(el) {
      const rows = await run('fin_cac_by_channel');
      const months = [...new Set(rows.map((r) => r.month))], chans = ['Organic', 'Referral', 'Partner', 'Paid Search', 'Paid Social'];
      const get = (m, ch) => rows.find((r) => r.month === m && r.channel === ch);
      const lastM = months[months.length - 1], yearAgo = months[months.length - 13] || months[0];
      const tot = (m, f) => rows.filter((r) => r.month === m).reduce((a, r) => a + r[f], 0);
      const blended = (m) => tot(m, 'spend') / tot(m, 'new_customers'), bpay = (m) => tot(m, 'spend') / tot(m, 'new_mrr');
      el.innerHTML = `
        <div class="grid g4">
          ${tile('cac', `Blended CAC, ${mon(lastM)}`, '$' + blended(lastM).toFixed(2), `${delta(chg(blended(lastM), blended(yearAgo)), false)} vs ${mon(yearAgo)}`)}
          ${tile('cac', 'Blended payback', bpay(lastM).toFixed(1) + ' months', 'spend / new MRR')}
          ${tile('cac', `Acquisition spend, ${mon(lastM)}`, money(tot(lastM, 'spend')), `${num(tot(lastM, 'new_customers'))} new subscribers`)}
          ${tile('cac', 'Paid Social CAC', '$' + get(lastM, 'Paid Social').cac.toFixed(2), `${delta(chg(get(lastM, 'Paid Social').cac, get(yearAgo, 'Paid Social').cac), false)} vs ${mon(yearAgo)}`)}
        </div>
        ${card('cac', 'CAC per channel', 'One small chart per channel, all from a zero baseline', `<div class="grid g5" id="c-cacs"></div>`, '" style="margin-top:14px')}
        ${card('cac', `Channel economics, ${mon(lastM)}`, 'Closed month', `<div class="scroll"><table><thead><tr><th>Channel</th><th>Spend</th><th>New subscribers</th><th>New MRR</th><th>CAC</th><th>CAC ${mon(yearAgo)}</th><th>Payback</th></tr></thead><tbody>
          ${chans.filter((ch) => get(lastM, ch)).map((ch) => { const r = get(lastM, ch), o = get(yearAgo, ch); return `<tr><td>${ch}</td><td>${moneyFull(r.spend)}</td><td>${num(r.new_customers)}</td><td>${moneyFull(r.new_mrr)}</td><td>$${r.cac.toFixed(2)}</td><td>${o ? '$' + o.cac.toFixed(2) : 'not live'}</td><td>${r.payback_months.toFixed(1)} mo</td></tr>`; }).join('')}
          <tr class="total"><td>Blended</td><td>${moneyFull(tot(lastM, 'spend'))}</td><td>${num(tot(lastM, 'new_customers'))}</td><td>${moneyFull(tot(lastM, 'new_mrr'))}</td><td>$${blended(lastM).toFixed(2)}</td><td>$${blended(yearAgo).toFixed(2)}</td><td>${bpay(lastM).toFixed(1)} mo</td></tr>
        </tbody></table></div>`, '" style="margin-top:14px')}
        <div class="callout" style="margin-top:14px"><b>What to notice:</b> blended CAC looks healthy because the partner bundle is cheap to acquire. Underneath, Paid Social gets more expensive every month. A blended number in a spreadsheet would have hidden both.</div>`;
      $('#c-cacs').innerHTML = chans.map((ch, i) => `<div><div class="card-s" style="margin-bottom:2px">${ch}</div><div id="cac-${i}"></div></div>`).join('');
      chans.forEach((ch, i) => {
        const ms = months.filter((m) => get(m, ch));
        Charts.line($('#cac-' + i), { labels: ms.map(mon), series: [{ name: ch + ' CAC', color: ch === 'Paid Social' ? C.churn : C.new, values: ms.map((m) => get(m, ch).cac) }], fmt: (v) => '$' + v.toFixed(v < 20 ? 1 : 0), height: 150 });
      });
    },

    async investor(el) {
      const [q, cust] = await Promise.all([run('fin_investor_quarterly'), run('fin_customer_churn_monthly')]);
      const cur = q[q.length - 1], yr = q[q.length - 5], closedC = cust.slice(0, -1);
            el.innerHTML = `
        <div class="grid g4">
          ${tile('investor', 'ARR', money(cur.ending_arr), yr ? `${delta(chg(cur.ending_arr, yr.ending_arr))} year on year` : '')}
          ${tile('investor', 'Net new ARR, this quarter to date', money(cur.net_new_arr), cur.quarter)}
          ${tile('customers', `Monthly logo churn, ${mon(closedC[closedC.length - 1].month)}`, pct(closedC[closedC.length - 1].logo_churn_pct, 2), 'share of opening subscribers lost')}
          ${tile('investor', 'Subscribers', num(cur.ending_customers), yr ? `${delta(chg(cur.ending_customers, yr.ending_customers))} year on year` : '')}
        </div>
        ${card('investor', 'ARR by quarter', 'Quarter-end annual run rate. The last bar is the quarter in progress', '<div id="c-arr"></div>', '" style="margin-top:14px')}
        ${card('investor', 'Quarterly detail', '', `<div class="scroll"><table><thead><tr><th>Quarter</th><th>Ending ARR</th><th>Net new ARR</th><th>Subscribers added</th><th>Subscribers lost</th><th>Ending subscribers</th></tr></thead><tbody>${q.map((r) => `<tr><td>${r.quarter}</td><td>${moneyFull(r.ending_arr)}</td><td>${moneyFull(r.net_new_arr)}</td><td>${num(r.new_customers)}</td><td>${num(r.churned_customers)}</td><td>${num(r.ending_customers)}</td></tr>`).join('')}</tbody></table></div>`, '" style="margin-top:14px')}`;
      Charts.stack($('#c-arr'), { labels: q.map((r) => r.quarter), pos: [{ name: 'Ending ARR', color: C.new, values: q.map((r) => r.ending_arr) }], fmt: money, valueLabels: true, height: 250 });
    },

    async sheet(el) {
      const [mrr, cust] = await Promise.all([run('fin_mrr_monthly'), run('fin_customer_churn_monthly')]);
      const months = mrr.slice(-13).map((r) => r.month), M = Object.fromEntries(mrr.map((r) => [r.month, r])), Cm = Object.fromEntries(cust.map((r) => [r.month, r]));
      const spec = [
        ['Recurring revenue', null],
        ['Opening MRR', (m) => M[m].ending_mrr - M[m].net_new_mrr, moneyFull, 'mrrWaterfall'],
        ['+ New', (m) => M[m].new_mrr, moneyFull, 'mrrWaterfall'], ['+ Expansion', (m) => M[m].expansion_mrr, moneyFull, 'mrrWaterfall'],
        ['+ Reactivation', (m) => M[m].reactivation_mrr, moneyFull, 'mrrWaterfall'], ['- Contraction', (m) => M[m].contraction_mrr, moneyFull, 'mrrWaterfall'],
        ['- Churn', (m) => M[m].churn_mrr, moneyFull, 'mrrWaterfall'], ['Ending MRR', (m) => M[m].ending_mrr, moneyFull, 'mrrTrend', true],
        ['Subscribers', null],
        ['Opening subscribers', (m) => Cm[m]?.starting_customers, num, 'customers'], ['+ New', (m) => Cm[m]?.new_customers, num, 'customers'],
        ['+ Reactivated', (m) => Cm[m]?.reactivated_customers, num, 'customers'], ['- Churned', (m) => (Cm[m] ? -Cm[m].churned_customers : null), num, 'customers'],
        ['Ending subscribers', (m) => Cm[m]?.ending_customers, num, 'customers', true],
        ['Ratios', null],
        ['Logo churn', (m) => Cm[m]?.logo_churn_pct, (v) => pct(v, 2), 'customers'], ['Revenue churn', (m) => Cm[m]?.revenue_churn_pct, (v) => pct(v, 2), 'customers'],
        ['Net revenue retention', (m) => Cm[m]?.nrr_pct, (v) => pct(v, 2), 'customers'], ['ARPA', (m) => Cm[m]?.arpa, (v) => (v == null ? '-' : '$' + v.toFixed(2)), 'customers'],
      ];
      el.innerHTML = card(null, 'Monthly board sheet', `Last 13 months. ${mon(months[months.length - 1])} is month to date`, `
        <div style="display:flex;gap:8px;margin-bottom:12px"><button class="btn" id="csv">Export CSV</button></div>
        <div class="scroll"><table class="sheet"><thead><tr><th>Metric</th>${months.map((m) => `<th>${mon(m)}</th>`).join('')}</tr></thead><tbody>
        ${spec.map(([label, f, fmt, key, total]) => (f ? `<tr class="${total ? 'total' : ''}"><td>${label}${src(key, true)}</td>${months.map((m) => { const v = f(m); return `<td class="${v < 0 ? 'neg' : ''}">${fmt(v)}</td>`; }).join('')}</tr>` : `<tr class="group"><td colspan="${months.length + 1}">${label}</td></tr>`)).join('')}
        </tbody></table></div>
        <p class="note">A sheet is one more consumer. Anything that can make an authenticated HTTPS call can read the same endpoints: a Google Sheets script, a notebook, Retool, a board-pack generator. The figures cannot drift apart, because none of those places hold the definition.</p>`);
      $('#csv').onclick = () => {
        const lines = [['Metric', ...months.map(mon)], ...spec.filter((s) => s[1]).map(([l, f]) => [l, ...months.map((m) => f(m) ?? '')])];
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })); a.download = 'hogflix-board-sheet.csv'; a.click();
      };
    },

    async wiring(el) {
      const [[s]] = await Promise.all([run('revenue_summary', { revenue_source_label: '' }).catch(() => [{}])]);
      const fresh = (x) => ({ 900: '15 min', 1800: '30 min', 3600: '1 hour', 21600: '6 hours', 43200: '12 hours', 86400: '1 day', 604800: '7 days' }[x] || x + ' s');
      el.innerHTML = `
        <div class="flow">
          <div><div class="n">1 &middot; SOURCES</div><h4>Billing, spend, product</h4><p>Stripe and other sources sync into the PostHog data warehouse on a schedule. Product events are already there.</p></div>
          <div><div class="n">2 &middot; MODELS</div><h4>Saved SQL views</h4><p>Cleaning and business rules are written once, in SQL, next to the data. This is where "what counts as MRR" is decided.</p></div>
          <div><div class="n">3 &middot; ENDPOINTS</div><h4>Named, versioned APIs</h4><p>Each view or query becomes a stable URL with its own freshness, version history, execution log and OpenAPI spec.</p></div>
          <div><div class="n">4 &middot; SURFACES</div><h4>Anything you like</h4><p>This app, a wall screen, a sheet, an investor portal on your own domain with your own login.</p></div>
        </div>
        ${card(null, 'Endpoints behind this app', catalog.source === 'live' ? 'Read live from the PostHog API a moment ago' : 'From the last saved snapshot', `<div class="scroll"><table><thead><tr><th>Endpoint</th><th>Freshness</th><th>Version</th><th>Materialisation</th><th>Last call, this session</th><th></th></tr></thead><tbody>
          ${catalog.items.map((e) => { const m = meta[e.name]; return `<tr><td><span style="font-family:var(--mono);font-size:12.5px">${esc(e.name)}</span><div class="card-s" style="white-space:normal;max-width:520px">${esc(e.description || '')}</div></td><td>${fresh(e.data_freshness_seconds)}</td><td>v${e.current_version}</td><td>${e.is_materialized ? '<span class="pill ok">on</span>' : e.materialization?.can_materialize ? '<span class="pill">eligible</span>' : '<span class="pill warn">direct only</span>'}</td><td>${m ? (m.source === 'live' ? m.latency_ms + ' ms' : 'snapshot') : 'not yet'}</td><td><a href="${esc(e.ui_url)}" target="_blank" rel="noopener">Open in PostHog</a></td></tr>`; }).join('')}
        </tbody></table></div>`, '" style="margin-top:14px')}
        <div class="grid g2" style="margin-top:14px">
          ${card(null, 'What this app is allowed to see', '', `<ul style="margin:0;padding-left:18px;color:var(--ink-2)"><li>The API key stays on the server. The browser never receives it.</li><li>A key for an app like this needs one scope: <span class="pill">endpoint:read</span>. With only that scope it can call endpoints, and cannot query raw events, persons or recordings.</li><li>The server only forwards calls to a fixed list of endpoint names.</li><li>Callers pass variable values, never SQL.</li></ul>`)}
          ${card('stripe', 'A real warehouse source: Stripe', 'Sandbox account, so the figures are small on purpose', `<div class="grid g4">${[['Active subscriptions', num(s.active_subscriptions)], ['Revenue', moneyFull(s.total_revenue)], ['Paying customers', num(s.paying_customers)], ['Revenue per customer', s.avg_revenue_per_customer == null ? '-' : '$' + Number(s.avg_revenue_per_customer).toFixed(2)]].map(([l, v]) => `<div><div class="card-s">${l}</div><div style="font-size:20px;font-weight:650;margin-top:2px">${v}</div></div>`).join('')}</div>`)}
        </div>
        <div class="callout" style="margin-top:14px"><b>What is real in this demo:</b> the PostHog project, the eight endpoints, every API call and its latency, the Stripe warehouse source and the payment failure events. <b>What is synthetic:</b> the billing ledger behind the MRR figures, loaded as ${num(24631)} events so the numbers are large enough to be interesting. With a real billing source, steps 3 and 4 do not change.</div>`;
    },
  };
  INFO.mom = { ...INFO.mrrWaterfall, title: 'Month over month', what: 'Two endpoints side by side: fin_mrr_monthly for revenue rows, fin_customer_churn_monthly for subscriber rows. The comparison itself is just three columns of the same response.', why: 'The monthly close conversation: what changed, against last month and against last year, without anyone assembling it.' };

  // ---------- info drawer
  function openInfo(key) {
    const i = INFO[key], m = meta[i.endpoint], e = catalog.items.find((x) => x.name === i.endpoint) || {};
    const fresh = { 900: '15 min', 1800: '30 min', 3600: '1 hour', 21600: '6 hours', 43200: '12 hours', 86400: '1 day', 604800: '7 days' }[e.data_freshness_seconds];
    const vars = m && Object.keys(m.variables || {}).length ? m.variables : null;
    $('#drawerBody').innerHTML = `
      <h2>${esc(i.title)}</h2><div class="ep">POST /endpoints/${esc(i.endpoint)}/run</div>
      <div>${m ? `<span class="pill ${m.source === 'live' ? 'ok' : 'warn'}">${m.source === 'live' ? 'live call' : 'snapshot'}</span>` : ''}${m?.latency_ms ? `<span class="pill">${m.latency_ms} ms</span>` : ''}${e.current_version ? `<span class="pill">version ${e.current_version}</span>` : ''}${fresh ? `<span class="pill">fresh within ${fresh}</span>` : ''}${e.is_materialized ? '<span class="pill ok">materialised</span>' : e.materialization?.can_materialize ? '<span class="pill">can be materialised</span>' : ''}</div>
      <h3>What this is</h3><p>${esc(i.what)}</p>
      <h3>Why it matters</h3><p>${esc(i.why)}</p>
      <h3>Why an endpoint, not an export</h3><ul>${i.better.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      ${AUDIENCE.show ? `<h3>For ${esc(AUDIENCE.name)}</h3><div class="you"><p style="margin:0">${esc(i.you)}</p></div>` : ''}
      <h3>The call</h3><pre>curl -X POST \\
  "${esc(m?.run_url || e.run_url || '')}" \\
  -H "Authorization: Bearer $POSTHOG_API_KEY" \\
  -H "Content-Type: application/json"${vars ? ` \\\n  -d '${esc(JSON.stringify({ variables: vars }))}'` : ''}</pre>
      <h3>The definition</h3>${e.sql ? `<details open><summary>SQL saved in PostHog. Nothing else computes this figure.</summary><pre>${esc(e.sql)}</pre></details>` : '<p>SQL not available in snapshot mode.</p>'}
      ${e.ui_url ? `<p style="margin-top:14px"><a href="${esc(e.ui_url)}" target="_blank" rel="noopener">Open this endpoint in PostHog</a> to see its versions, execution log and configuration.</p>` : ''}`;
    $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
  }
  const closeInfo = () => { $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); };

  // ---------- shell
  let current = location.hash.slice(1) || 'live';
  async function show(id) {
    const t = TABS.find((x) => x.id === id) || TABS[0]; current = t.id; location.hash = t.id; closeInfo();
    $('#tabs').innerHTML = TABS.map((x) => (x.sep ? '<div class="sep"></div>' : `<button class="${x.id === t.id ? 'on' : ''}" data-tab="${x.id}">${esc(x.name)}</button>`)).join('');
    $('#viewTitle').textContent = t.title; $('#viewLede').textContent = t.lede;
    const el = $('#view'); el.innerHTML = '<div class="loading">Calling PostHog endpoints...</div>';
    try { await views[t.id](el); } catch (err) { el.innerHTML = `<div class="card err">Could not load this view: ${esc(err.message)}</div>`; }
  }
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]'), info = e.target.closest('[data-info]');
    if (tab) show(tab.dataset.tab); else if (info) openInfo(info.dataset.info);
    else if (!e.target.closest('#drawer')) closeInfo();
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeInfo());
  $('#drawerClose').onclick = closeInfo;
  $('#explain').onchange = (e) => $('#app').classList.toggle('explain', e.target.checked);
  $('#tv').onclick = () => { const on = $('#app').classList.toggle('tvmode'); $('#tv').textContent = on ? 'Exit TV mode' : 'TV mode'; if (on) { show('live'); document.documentElement.requestFullscreen?.().catch(() => {}); } else document.exitFullscreen?.().catch(() => {}); };
  $('#refresh').onclick = () => { cache.clear(); show(current); };
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => show(current), 200); });
  addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== current) show(h); });
  $('#app').classList.add('explain');
  fetch('/api/finance?endpoint=_catalog').then((r) => r.json()).then((c) => { if (!c.items?.length) throw new Error('empty'); catalog = c; }).catch(() => fetch('snapshots/_catalog.json').then((r) => r.json()).then((c) => { catalog = { ...c, source: 'snapshot' }; })).finally(() => show(current));
  setInterval(() => { if ($('#app').classList.contains('tvmode')) { cache.clear(); show('live'); } }, 60000);
})();
