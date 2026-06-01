const state = {
  dates: [],
  dashboard: null,
  selectedTopic: "",
};

const COPILOT_QUESTIONS = [
  "哪个国家风险最高？",
  "哪个问题最值得优先处理？",
  "Powercreep问题严重吗？",
  "马来西亚登录问题具体是什么？",
  "4.2版本后发生了什么？",
  "给我生成一份运营日报",
];

const els = {
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  reloadButton: document.querySelector("#reloadButton"),
  loadingBar: document.querySelector("#loadingBar"),
  loadingStatus: document.querySelector("#loadingStatus"),
  dataCoverageNote: document.querySelector("#dataCoverageNote"),
  methodNote: document.querySelector("#methodNote"),
  headline: document.querySelector("#headline"),
  dataSource: document.querySelector("#dataSource"),
  healthNote: document.querySelector("#healthNote"),
  healthPanel: document.querySelector("#healthPanel"),
  kpiReviews: document.querySelector("#kpiReviews"),
  kpiRating: document.querySelector("#kpiRating"),
  kpiNegative: document.querySelector("#kpiNegative"),
  kpiVersion: document.querySelector("#kpiVersion"),
  kpiCompetitor: document.querySelector("#kpiCompetitor"),
  metricsTable: document.querySelector("#metricsTable"),
  sentimentBars: document.querySelector("#sentimentBars"),
  issueBars: document.querySelector("#issueBars"),
  topicBars: document.querySelector("#topicBars"),
  topicDetails: document.querySelector("#topicDetails"),
  regionRatingChart: document.querySelector("#regionRatingChart"),
  regionIssueChart: document.querySelector("#regionIssueChart"),
  versionTable: document.querySelector("#versionTable"),
  competitorTable: document.querySelector("#competitorTable"),
  competitorMetricsTable: document.querySelector("#competitorMetricsTable"),
  recommendations: document.querySelector("#recommendations"),
  actionCenter: document.querySelector("#actionCenter"),
  riskSamples: document.querySelector("#riskSamples"),
  copilotToggle: document.querySelector("#copilotToggle"),
  copilotPanel: document.querySelector("#copilotPanel"),
  copilotClose: document.querySelector("#copilotClose"),
  copilotMessages: document.querySelector("#copilotMessages"),
  copilotSuggestions: document.querySelector("#copilotSuggestions"),
  copilotForm: document.querySelector("#copilotForm"),
  copilotInput: document.querySelector("#copilotInput"),
};

init();

function init() {
  els.startDate.addEventListener("change", () => loadDashboard());
  els.endDate.addEventListener("change", () => loadDashboard());
  els.reloadButton.addEventListener("click", () => loadDashboard());
  initCopilot();
  loadDates();
}

async function loadDates() {
  setLoading(true, "正在读取可用日期...");
  try {
    const payload = await fetchJson("data/dates.json");
    state.dates = payload.dates || [];
    if (state.dates.length) {
      const values = state.dates.map((item) => item.date).sort();
      const min = values[0];
      const max = values[values.length - 1];
      els.startDate.value = min;
      els.endDate.value = max;
      renderDataCoverageNote();
      await loadDashboard();
    } else {
      showError("没有找到可用日期。");
    }
  } catch (error) {
    showError(error.message || "读取日期失败。");
  } finally {
    setLoading(false);
  }
}

async function loadDashboard() {
  const start = els.startDate.value;
  const end = els.endDate.value || start;
  setLoading(true, `正在更新 ${start} ~ ${end}...`);
  try {
    const payload = await fetchJson("data/dashboard.json");
    if (payload.error) {
      showError(payload.error);
      return;
    }
    state.dashboard = payload;
    render(payload);
  } catch (error) {
    showError(error.message || "读取数据失败。");
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading, message = "正在更新...") {
  document.body.classList.toggle("is-loading", isLoading);
  if (els.loadingStatus) {
    els.loadingStatus.textContent = isLoading ? message : "已更新";
  }
  els.reloadButton.disabled = isLoading;
  els.startDate.disabled = isLoading;
  els.endDate.disabled = isLoading;
}

function renderDataCoverageNote() {
  if (!els.dataCoverageNote || !state.dates.length) return;
  const sorted = [...state.dates].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]?.date;
  const last = sorted[sorted.length - 1]?.date;
  if (!first || !last) return;

  const missing = sorted.filter((item) => item.status === "missing").map((item) => item.date);
  const errors = sorted.filter((item) => item.status === "error");
  const empty = sorted.filter((item) => item.status === "empty").map((item) => item.date);
  const listDates = (dates) => (dates.length <= 3 ? dates.join("、") : `${dates.slice(0, 3).join("、")}等${dates.length}天`);
  const listErrorDetails = (items) => items.slice(0, 3).map((item) => `${item.date}抓取异常：${item.status_detail || "原因待确认"}`).join("；") + (items.length > 3 ? `；另有${items.length - 3}天异常` : "");

  let note = `已抓取${first}至${last}的数据。`;
  if (missing.length) note += `${listDates(missing)}的数据未抓取。`;
  if (errors.length) note += `${listErrorDetails(errors)}。`;
  if (!missing.length && !errors.length) note += "数据抓取无异常。";
  if (empty.length) note += `${listDates(empty)}已抓取，但按北京时间口径无有效样本。`;

  els.dataCoverageNote.classList.toggle("warning", Boolean(missing.length || errors.length));
  els.dataCoverageNote.textContent = note;
}

function render(data) {
  els.methodNote.textContent = data.method_note || "";
  els.dataSource.textContent = `${data.start || data.date} ~ ${data.end || data.date} · ${data.generated_at || ""}`;
  els.headline.innerHTML = (data.headline || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("");

  els.kpiReviews.textContent = integer(data.kpis?.target_reviews);
  els.kpiRating.textContent = decimal(data.kpis?.avg_rating);
  els.kpiNegative.textContent = percent(data.kpis?.negative_rate);
  els.kpiVersion.textContent = percent(data.kpis?.version_related_rate);
  els.kpiCompetitor.textContent = decimal(data.kpis?.competitor_avg_rating);
  renderHealth(data.health || {});

  renderTable(els.metricsTable, data.target_metrics, [
    ["app_short_name", "产品"],
    ["store", "商店"],
    ["reviews", "样本", "numeric", integer],
    ["avg_rating", "均分", "numeric", decimal],
    ["negative_rate", "负面率", "numeric", percent],
    ["high_severity", "高危率", "numeric", percent],
  ]);
  renderBars(els.sentimentBars, data.sentiment, sentimentColor);
  renderBars(els.issueBars, data.issues, issueColor);
  renderRegionRatingChart(data.region_rating_chart || []);
  renderRegionIssueChart(data.region_issue_chart || {});
  renderTopicBars(data.topics || [], data.topic_details || {});
  renderTable(els.versionTable, data.versions, [
    ["version", "版本"],
    ["store", "商店"],
    ["reviews", "负面样本", "numeric", integer],
    ["avg_rating", "均分", "numeric", decimal],
    ["top_issue", "主要问题"],
    ["top_other_detail", "other 细分"],
  ]);
  renderTable(els.competitorMetricsTable, data.competitor_metrics, [
    ["app_short_name", "产品"],
    ["store", "商店"],
    ["reviews", "样本", "numeric", integer],
    ["avg_rating", "均分", "numeric", decimal],
    ["negative_rate", "负面率", "numeric", percent],
    ["high_severity", "高危率", "numeric", percent],
    ["top_issue", "主要问题"],
  ]);
  renderActionCenter(data.action_center || {});
  renderRecommendations(data.recommendations || [], data.action_center || {});
  renderRiskSamples(data.risk_samples || []);
  renderDataCoverageNote();
}

function renderHealth(health) {
  if (els.healthNote) els.healthNote.textContent = health.note || "";
  const items = health.items || [];
  const cards = items.length
    ? items.map((item) => {
        const value = item.value === null || item.value === undefined ? "待接入" : integer(item.value);
        const trend = item.trend === null || item.trend === undefined ? item.status || "待接入" : `${Number(item.trend) >= 0 ? "+" : ""}${percent(item.trend)}`;
        return `<div class="health-card"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(value))}</strong><em>${escapeHtml(trend)}</em></div>`;
      }).join("")
    : `<div class="health-card"><span>业务数据</span><strong>待接入</strong><em>DAU / 收入 / 下载</em></div>`;
  const insights = (health.insights || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  els.healthPanel.innerHTML = `<div class="health-cards">${cards}</div><ul class="health-insights">${insights}</ul>`;
}

function renderRegionRatingChart(rows) {
  if (!rows.length) {
    els.regionRatingChart.innerHTML = `<div class="empty">暂无数据</div>`;
    return;
  }
  const maxReviews = Math.max(...rows.map((item) => item.reviews || 0), 1);
  const colors = { 1: "#c92a2a", 2: "#e66b6b", 3: "#adb5bd", 4: "#8fbe6d", 5: "#2f7d20" };
  const columnWidth = 78;
  const leftPad = 34;
  const rightPad = 24;
  const chartWidth = leftPad + rightPad + rows.length * columnWidth;
  const chartHeight = 330;
  const topPad = 28;
  const barBottom = 252;
  const labelY = 282;
  const countY = 304;
  const plotHeight = 198;
  const points = rows.map((item, index) => {
    const x = leftPad + index * columnWidth + columnWidth / 2;
    const rating = Math.max(1, Math.min(5, Number(item.avg_rating || 1)));
    const y = topPad + ((5 - rating) / 4) * plotHeight;
    return { x, y, label: decimal(item.avg_rating) };
  });
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const barSegments = rows.map((item, index) => {
    const total = Math.max(item.reviews || 0, 1);
    const barHeight = Math.max(46, ((item.reviews || 0) / maxReviews) * 210);
    const x = leftPad + index * columnWidth + columnWidth / 2 - 19;
    let y = barBottom;
    return [1, 2, 3, 4, 5].map((score) => {
      const count = item.ratings?.[String(score)] || 0;
      const height = Math.max(count ? 1 : 0, (count / total) * barHeight);
      y -= height;
      const label = count > total * 0.12 ? `<text x="${x + 19}" y="${y + height / 2 + 3}" text-anchor="middle" class="bar-count">${integer(count)}</text>` : "";
      return `<rect x="${x}" y="${y}" width="38" height="${height}" fill="${colors[score]}"></rect>${label}`;
    }).join("");
  }).join("");
  const regionLabels = rows.map((item, index) => {
    const x = leftPad + index * columnWidth + columnWidth / 2;
    return `<text x="${x}" y="${labelY}" text-anchor="middle" class="region-label">${escapeHtml(item.region_name || item.region)}</text><text x="${x}" y="${countY}" text-anchor="middle" class="region-count-label">${integer(item.reviews)}条</text>`;
  }).join("");
  els.regionRatingChart.innerHTML = `
    <div class="rating-legend">
      <span class="avg-line-key"></span><span>加权评分</span>
      ${[5,4,3,2,1].map((score) => `<span class="legend-dot" style="background:${colors[score]}"></span><span>${score}星</span>`).join("")}
    </div>
    <div class="region-rating-plot" style="min-width:${chartWidth}px">
      <svg class="region-rating-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="地区评分与评分量级">
        <line x1="${leftPad}" y1="${barBottom}" x2="${chartWidth - rightPad}" y2="${barBottom}" class="axis-line"></line>
        ${barSegments}
        <polyline points="${pointString}" fill="none" stroke="#29adbd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#29adbd"></circle><text x="${point.x}" y="${point.y - 9}" text-anchor="middle" class="rating-label">${point.label}</text>`).join("")}
        ${regionLabels}
      </svg>
    </div>
  `;
}

function renderRegionIssueChart(chart) {
  const rows = chart.regions || [];
  const issues = chart.issues || [];
  if (!rows.length || !issues.length) {
    els.regionIssueChart.innerHTML = `<div class="empty">暂无数据</div>`;
    return;
  }
  const palette = ["#4f83c4", "#c4514e", "#9bbb59", "#8064a2", "#4bacc6", "#f79646", "#7f8c8d", "#d88c2d"];
  const maxShare = 0.5;
  const chartHeight = 230;
  const axisLabels = [0, 10, 20, 30, 40, 50]
    .map((value) => `<span style="bottom:${(value / 50) * chartHeight}px">${value}%</span>`)
    .join("");
  els.regionIssueChart.innerHTML = `
    <div class="issue-legend">${issues.map((issue, index) => `<span><i style="background:${palette[index % palette.length]}"></i>${escapeHtml(issue)}</span>`).join("")}</div>
    <div class="region-issue-body">
      <div class="issue-axis-labels" aria-hidden="true">${axisLabels}</div>
      <div class="region-issue-grid">
        ${rows.map((region) => `
        <div class="region-issue-group">
          <div class="issue-bars-group">
            ${region.issues.map((issue, index) => {
              const rawHeight = ((issue.share || 0) / maxShare) * chartHeight;
              const height = Math.min(chartHeight, Math.max(issue.share ? 4 : 0, rawHeight));
              return `
                <div class="issue-column" title="${escapeHtml(issue.name)}：${percent(issue.share)}" data-tooltip="${escapeHtml(issue.name)}：${percent(issue.share)}">
                  <span style="height:${height}px;background:${palette[index % palette.length]}"></span>
                  <b>${percent(issue.share)}</b>
                </div>
              `;
            }).join("")}
          </div>
          <div class="region-name">${escapeHtml(region.region_name || region.region)}</div>
          <div class="region-count">${integer(region.reviews)}条负面</div>
        </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderTable(node, rows, columns) {
  if (!rows || rows.length === 0) {
    node.innerHTML = `<tbody><tr><td class="empty">暂无数据</td></tr></tbody>`;
    return;
  }
  const head = columns
    .map(([, label, className]) => `<th class="${className || ""}">${escapeHtml(label)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map(([key, , className, formatter]) => {
          const value = formatter ? formatter(row[key]) : row[key] ?? "-";
          return `<td class="${className || ""}">${escapeHtml(String(value))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  node.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
}

function renderBars(node, rows, colorFn) {
  if (!rows || rows.length === 0) {
    node.innerHTML = `<div class="empty">暂无数据</div>`;
    return;
  }
  const max = Math.max(...rows.map((item) => item.count || 0), 1);
  node.innerHTML = rows
    .map((item) => {
      const width = Math.max(8, ((item.count || 0) / max) * 100);
      const color = colorFn(item.name);
      return `
        <div class="bar-row">
          <div class="bar-label" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div>
          <div class="bar-value">${integer(item.count)}</div>
        </div>
      `;
    })
    .join("");
}


function renderTopicBars(rows, details) {
  if (!rows.length) {
    els.topicBars.innerHTML = `<div class="empty">暂无数据</div>`;
    els.topicDetails.innerHTML = "";
    return;
  }
  if (!state.selectedTopic || !details[state.selectedTopic]) {
    state.selectedTopic = rows[0].name;
  }
  const max = Math.max(...rows.map((item) => item.count || 0), 1);
  els.topicBars.innerHTML = rows
    .map((item) => {
      const width = Math.max(8, ((item.count || 0) / max) * 100);
      const color = issueColor(item.name);
      const active = item.name === state.selectedTopic ? " active" : "";
      return `
        <button class="bar-row topic-row${active}" type="button" data-topic="${escapeHtml(item.name)}">
          <span class="bar-label" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${width}%;background:${color}"></span></span>
          <span class="bar-value">${integer(item.count)}</span>
        </button>
      `;
    })
    .join("");
  els.topicBars.querySelectorAll(".topic-row").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTopic = button.dataset.topic || "";
      renderTopicBars(rows, details);
    });
  });
  renderTopicDetails(details[state.selectedTopic]);
}

function renderTopicDetails(detail) {
  if (!detail) {
    els.topicDetails.innerHTML = `<div class="empty">暂无细分样本</div>`;
    return;
  }
  const entities = detail.entities?.length
    ? detail.entities
        .map((item) => `<span class="entity-chip">${escapeHtml(item.name)}<b>${integer(item.count)}</b><small>${escapeHtml(item.type)}</small></span>`)
        .join("")
    : `<span class="muted-text">暂未识别到明确角色、活动或玩法名词</span>`;
  const issues = detail.issue_breakdown?.length
    ? detail.issue_breakdown
        .map((item) => `<span>${escapeHtml(item.name)} ${integer(item.count)}</span>`)
        .join("")
    : `<span>暂无拆分</span>`;
  const samples = (detail.samples || [])
    .map((item) => {
      const text = item.evidence || item.text || "";
      return `
        <article class="sample topic-sample">
          <div class="sample-meta sample-meta-readable">
            <span class="pill">${escapeHtml(item.store || "-")}</span>
            <span>${escapeHtml(item.region_name || item.region || "-")}</span>
            <span>版本 ${escapeHtml(String(item.version || "-"))}</span>
            <span>评分 ${escapeHtml(String(item.rating ?? "-"))}</span>
            <span>情绪：${escapeHtml(item.sentiment_display || "-")}</span>
            <span>高频对象：${escapeHtml(entityNames(item.entities || []))}</span>
            <span>问题类型：${escapeHtml(item.issue_display || "-")}</span>
          </div>
          <div class="sample-text">${escapeHtml(text)}</div>
          <div class="sample-translation"><strong>中文翻译</strong>${escapeHtml(item.translation_zh || "暂无中文翻译")}</div>
        </article>
      `;
    })
    .join("");
  els.topicDetails.innerHTML = `
    <div class="topic-detail-head">
      <strong>${escapeHtml(detail.topic)}</strong>
      <span>${integer(detail.count)} 条负面/混合样本</span>
    </div>
    <div class="detail-block">
      <div class="detail-title">高频对象</div>
      <div class="entity-list">${entities}</div>
    </div>
    <div class="detail-block">
      <div class="detail-title">问题类型拆分</div>
      <div class="issue-list">${issues}</div>
    </div>
    <div class="detail-block">
      <div class="detail-title">代表性负评</div>
      <div class="topic-samples">${samples || `<div class="empty">暂无样本</div>`}</div>
    </div>
  `;
}

function entityNames(items) {
  if (!items.length) return "未识别";
  return items.map((item) => item.name || item[0]).filter(Boolean).join("、");
}


function renderActionCenter(center) {
  if (!els.actionCenter) return;
  const p1 = center.p1 || [];
  const p2 = center.p2 || [];
  const markets = center.markets || [];
  const localization = center.localization || {};
  const competitor = center.competitor_opportunity || {};
  const future = center.future_risk || {};
  els.actionCenter.innerHTML = `
    <section class="action-section action-p1">
      <div class="action-section-head"><h3>P1 Critical Issues</h3><span>Top ${p1.length}</span></div>
      <div class="p1-list">${p1.map(renderP1Action).join("") || `<div class="empty">暂无 P1 问题</div>`}</div>
    </section>
    <section class="action-section">
      <div class="action-section-head"><h3>P2 Monitoring Issues</h3><span>Top ${p2.length}</span></div>
      <div class="p2-list">${p2.map(renderP2Action).join("") || `<div class="empty">暂无 P2 问题</div>`}</div>
    </section>
    <section class="action-section">
      <div class="action-section-head"><h3>Market Operation Suggestions</h3><span>Top ${markets.length}</span></div>
      <div class="market-actions">${markets.map(renderMarketAction).join("") || `<div class="empty">暂无市场建议</div>`}</div>
    </section>
    <section class="action-grid-2">
      <div class="action-section">
        <div class="action-section-head"><h3>Localization Suggestions</h3><span>${localization.triggered ? "已触发" : "未触发"}</span></div>
        ${renderLocalizationAction(localization)}
      </div>
      <div class="action-section">
        <div class="action-section-head"><h3>Competitor Opportunity Analysis</h3><span>相对竞品</span></div>
        ${renderCompetitorAction(competitor)}
      </div>
    </section>
    <section class="action-section">
      <div class="action-section-head"><h3>Future Risk Alert</h3><span>未来 7 天</span></div>
      ${renderFutureRisk(future)}
    </section>
  `;
}

function renderP1Action(item) {
  return `
    <article class="p1-card">
      <div class="p1-top"><span class="priority-badge">${escapeHtml(item.priority || "P1")}</span><strong>${escapeHtml(item.issue || "-")}</strong><em>风险 ${escapeHtml(item.risk_level || "-")} · Score ${decimal(item.priority_score)}</em></div>
      <div class="action-meta-grid">
        <span>来源：${escapeHtml(item.source || "-")}</span>
        <span>国家：${escapeHtml(joinText(item.countries))}</span>
        <span>版本：${escapeHtml(joinText(item.versions))}</span>
        <span>负面样本：${integer(item.negative_samples)}</span>
      </div>
      <p><b>原因</b>${escapeHtml(item.why || "-")}</p>
      <p><b>影响</b>${escapeHtml(item.impact || "-")}</p>
      <p><b>建议动作</b>${escapeHtml(item.action || "-")}</p>
      <div class="value-row"><span>预计影响评分：${escapeHtml(item.value?.rating || "-")}</span><span>预计影响留存：${escapeHtml(item.value?.retention || "-")}</span><span>预计影响付费：${escapeHtml(item.value?.monetization || "-")}</span></div>
    </article>
  `;
}

function renderP2Action(item) {
  return `
    <article class="p2-card">
      <strong>${escapeHtml(item.issue || "-")}</strong>
      <span class="trend ${trendClass(item.trend)}">${escapeHtml(item.trend || "→")} ${percent(item.change_7d)}</span>
      <span>${integer(item.negative_samples)} 条 · 风险 ${escapeHtml(item.risk_level || "-")}</span>
      <p>${escapeHtml(item.action || "-")}</p>
    </article>
  `;
}

function renderMarketAction(item) {
  return `
    <article class="market-card">
      <strong>${escapeHtml(item.market || "-")}</strong>
      <span>${integer(item.negative_samples)} 条负面</span>
      <p><b>主要问题</b>${escapeHtml(joinText(item.main_issues))}</p>
      <p><b>原因</b>${escapeHtml(item.reason || "-")}</p>
      <p><b>动作</b>${escapeHtml(item.action || "-")}</p>
    </article>
  `;
}

function renderLocalizationAction(item) {
  const details = item.items || [];
  return `
    <p class="action-summary">${escapeHtml(item.summary || "-")}</p>
    ${details.map((detail) => `
      <div class="action-mini-list">
        <span>涉及语言：${escapeHtml(joinText(detail.languages))}</span>
        <span>涉及对象：${escapeHtml(joinText(detail.entities))}</span>
        <span>涉及活动：${escapeHtml(joinText(detail.activities))}</span>
        <p>${escapeHtml(detail.action || "-")}</p>
      </div>
    `).join("")}
  `;
}

function renderCompetitorAction(item) {
  return `
    <div class="opportunity-grid">
      <div><b>优势</b>${listItems(item.advantages || [])}</div>
      <div><b>劣势</b>${listItems(item.disadvantages || [])}</div>
    </div>
    <p class="action-summary">${escapeHtml(item.action || "-")}</p>
  `;
}

function renderFutureRisk(item) {
  return `
    <div class="risk-rank-grid">
      <div><b>风险国家排行</b>${rankItems(item.countries || [], "top_issue")}</div>
      <div><b>风险主题排行</b>${rankItems(item.topics || [], "samples")}</div>
    </div>
    <p class="action-summary">${escapeHtml(item.action || "-")}</p>
  `;
}

function listItems(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function rankItems(items, subKey) {
  return `<ol>${items.map((item) => `<li><strong>${escapeHtml(item.name || "-")}</strong><span>${escapeHtml(String(item[subKey] ?? ""))}</span></li>`).join("")}</ol>`;
}

function joinText(items) {
  return (items || []).filter(Boolean).join("、") || "-";
}

function trendClass(value) {
  if (value === "↑") return "up";
  if (value === "↓") return "down";
  return "flat";
}

function renderRecommendations(items, actionCenter = {}) {
  const summaries = actionCenterRecommendations(actionCenter);
  const source = summaries.length ? summaries : items;
  if (!source.length) {
    els.recommendations.innerHTML = `<li>暂无建议</li>`;
    return;
  }
  els.recommendations.innerHTML = source.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function actionCenterRecommendations(center) {
  const out = [];
  const p1 = center.p1 || [];
  const markets = center.markets || [];
  const competitor = center.competitor_opportunity || {};
  const future = center.future_risk || {};
  if (p1[0]) {
    out.push(`最高优先级处理「${p1[0].source || p1[0].issue}」：${p1[0].impact || "该问题已进入 P1。"}${p1[0].action || ""}`);
  }
  if (p1[1]) {
    out.push(`第二优先级处理「${p1[1].source || p1[1].issue}」：负面样本 ${integer(p1[1].negative_samples)} 条，风险等级 ${p1[1].risk_level || "-"}。${p1[1].action || ""}`);
  }
  if (markets.length) {
    const names = markets.slice(0, 3).map((item) => item.market).join("、");
    out.push(`地区运营先覆盖${names}：这些市场在 Action Center 中风险靠前，需要分别准备本地语言说明、社区回应和客服分流口径。`);
  }
  if ((competitor.disadvantages || []).length) {
    out.push(`竞品侧短板：${competitor.disadvantages[0]}${competitor.action || ""}`);
  }
  if (future.action) {
    out.push(`未来 7 天监控：${future.action}`);
  }
  return out.slice(0, 6);
}

function renderRiskSamples(items) {
  if (!items.length) {
    els.riskSamples.innerHTML = `<div class="empty">暂无样本</div>`;
    return;
  }
  els.riskSamples.innerHTML = items
    .map((item) => {
      const text = item.evidence || item.text || "";
      return `
        <article class="sample">
          <div class="sample-meta">
            <span class="pill">${escapeHtml(item.store || "-")}</span>
            <span>${escapeHtml(item.region_name || item.region || "-")}</span>
            <span>版本 ${escapeHtml(String(item.version || "-"))}</span>
            <span>评分 ${escapeHtml(String(item.rating ?? "-"))}</span>
            <span>${escapeHtml(item.sentiment_display || "-")} / ${escapeHtml(item.issue_display || "-")}</span>
          </div>
          <div class="sample-text">${escapeHtml(text)}</div>
          <div class="sample-translation"><strong>中文翻译</strong>${escapeHtml(item.translation_zh || "暂无中文翻译")}</div>
        </article>
      `;
    })
    .join("");
}


function initCopilot() {
  if (!els.copilotToggle) return;
  els.copilotToggle.addEventListener("click", () => {
    els.copilotPanel.classList.add("open");
    if (!els.copilotMessages.dataset.ready) {
      addCopilotMessage("assistant", "你好，这是 GitHub Pages 静态 Demo 版。我可以基于当前 data/dashboard.json 做简单规则回答；实时 LLM 问答需要本地后端版支持。");
      els.copilotMessages.dataset.ready = "1";
    }
    els.copilotInput.focus();
  });
  els.copilotClose.addEventListener("click", () => els.copilotPanel.classList.remove("open"));
  els.copilotForm.addEventListener("submit", (event) => {
    event.preventDefault();
    askCopilot(els.copilotInput.value.trim());
  });
  els.copilotSuggestions.innerHTML = COPILOT_QUESTIONS.map((question) => `<button type="button">${escapeHtml(question)}</button>`).join("");
  els.copilotSuggestions.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) askCopilot(button.textContent.trim());
  });
}

async function askCopilot(question) {
  if (!question) return;
  addCopilotMessage("user", question);
  els.copilotInput.value = "";
  const loading = addCopilotMessage("assistant loading", "正在读取静态 Dashboard 数据...");
  try {
    if (!state.dashboard) {
      state.dashboard = await fetchJson("data/dashboard.json");
    }
    loading.classList.remove("loading");
    loading.innerHTML = formatCopilotAnswer(buildStaticCopilotAnswer(question, state.dashboard));
  } catch (error) {
    loading.classList.remove("loading");
    loading.textContent = "Demo 版本暂不支持实时问答。请使用本地 8797 后端版获得完整 Review Agent。";
  }
  els.copilotMessages.scrollTop = els.copilotMessages.scrollHeight;
}

function buildStaticCopilotAnswer(question, data) {
  const action = data.action_center || {};
  const p1 = action.p1 || [];
  const futureCountries = action.future_risk?.countries || [];
  const topCountry = futureCountries[0];
  const topIssue = p1[0];
  const q = question.toLowerCase();

  if (q.includes("国家") || q.includes("风险最高")) {
    return [
      "## 结论",
      topCountry ? `当前静态样例中，风险最高的国家/地区是 ${topCountry.name}。` : "当前静态样例没有足够的国家风险数据。",
      "## 证据",
      ...(futureCountries.slice(0, 5).map((item, index) => `- ${index + 1}. ${item.name}：风险分 ${item.score}，主要问题 ${item.top_issue}`)),
      "## 建议动作",
      "- GitHub Pages Demo 只能基于 dashboard.json 做规则回答；完整追问、根因解释和实时 LLM 建议请使用本地 8797 后端版。",
    ].join("\n");
  }

  if (q.includes("优先") || q.includes("最值得")) {
    return [
      "## 结论",
      topIssue ? `当前最优先处理的是：${topIssue.issue}。` : "当前静态样例没有 P1 问题。",
      "## 证据",
      topIssue ? `- 来源：${topIssue.source}\n- 涉及国家：${(topIssue.countries || []).join("、") || "-"}\n- 负面样本数：${topIssue.negative_samples}\n- Priority Score：${topIssue.priority_score}` : "- 暂无",
      "## 建议动作",
      topIssue?.action ? `- ${topIssue.action}` : "- 请回到本地后端版生成完整建议。",
    ].join("\n");
  }

  if (q.includes("powercreep") || q.includes("强度") || q.includes("平衡")) {
    const issue = p1.find((item) => `${item.issue} ${item.source} ${(item.topics || []).join(" ")}`.toLowerCase().includes("powercreep") || `${item.issue} ${item.source}`.includes("强度") || `${item.issue} ${item.source}`.includes("平衡"));
    return [
      "## 结论",
      issue ? `${issue.issue} 是当前静态样例中的重点风险之一。` : "当前静态样例没有集中显示 Powercreep/强度膨胀为 P1。",
      "## 证据",
      issue ? `- 关联主题：${(issue.topics || []).join("、")}\n- 涉及国家：${(issue.countries || []).join("、")}\n- 影响：${issue.impact || "-"}` : "- 可以查看页面中的玩家抱怨焦点和 AI Action Center。",
      "## 建议动作",
      issue?.action ? `- ${issue.action}` : "- Demo 版暂不调用 LLM；请使用本地 8797 后端版做深度追问。",
    ].join("\n");
  }

  return [
    "## 结论",
    "这是 GitHub Pages 静态 Demo 版，暂不支持实时 LLM 问答。",
    "## 证据",
    `- 当前展示数据来自 data/dashboard.json，日期范围：${data.start || "-"} ~ ${data.end || "-"}` ,
    `- 目标样本：${data.kpis?.target_reviews ?? "-"}` ,
    `- 平均评分：${data.kpis?.avg_rating ?? "-"}` ,
    `- 负面率：${data.kpis?.negative_rate !== undefined ? percent(data.kpis.negative_rate) : "-"}` ,
    "## 建议动作",
    "- 查看页面中的 AI Action Center、地区表现和高风险原声样本。",
    "- 如需自然语言追问、实时筛选和 LLM 生成建议，请启动本地 8797 后端版。",
  ].join("\n");
}

function addCopilotMessage(role, text) {
  const node = document.createElement("article");
  node.className = `copilot-message ${role}`;
  node.innerHTML = role.includes("assistant") ? formatCopilotAnswer(text) : escapeHtml(text);
  els.copilotMessages.appendChild(node);
  els.copilotMessages.scrollTop = els.copilotMessages.scrollHeight;
  return node;
}

function formatCopilotAnswer(text) {
  return escapeHtml(text)
    .replace(/^## (.+)$/gm, "<h4>$1</h4>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n/g, "<br>")
    .replace(/(<li>.*?<\/li>)(?:<br>)?/gs, "$1");
}

async function fetchJson(url, options = undefined) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`请求失败：${response.status}`);
  return response.json();
}

function showError(message) {
  els.methodNote.textContent = message;
}

function integer(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function decimal(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toFixed(2);
}

function percent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function sentimentColor(name) {
  if (name === "positive") return "#287a43";
  if (name === "negative") return "#b42318";
  if (name === "mixed") return "#b45309";
  return "#607086";
}

function issueColor(name) {
  if (["crash", "payment", "account_login"].includes(name)) return "#b42318";
  if (["performance", "update_regression", "monetization"].includes(name)) return "#b45309";
  return "#0f766e";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
