const fs = require('fs');

let code = fs.readFileSync('script.js', 'utf8');

const newChartLogic = `let chartCache = {};
async function loadAnalytics() {
    try {
        const res = await fetch(\`\${API_URL}/stats\`);
        const data = await res.json();
        
        document.getElementById('metric-sales').innerText = \`₹\${data.metrics.total_sales.toFixed(2)}\`;
        document.getElementById('metric-orders').innerText = data.metrics.total_orders;
        document.getElementById('metric-aov').innerText = \`₹\${data.metrics.avg_order_value.toFixed(2)}\`;

        const colors = ['rgba(212, 163, 115, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(139, 92, 246, 0.8)'];
        Chart.defaults.color = "rgba(255,255,255,0.7)";

        const trendCtx = document.getElementById('salesTrendChart').getContext('2d');
        if (chartCache.trend) chartCache.trend.destroy();
        chartCache.trend = new Chart(trendCtx, { type: 'line', data: { labels: data.trends.map(t => new Date(t.date).toLocaleDateString()), datasets: [{ label: 'Daily Revenue (₹)', data: data.trends.map(t => t.daily_revenue), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }] }, options: { scales: { y: { beginAtZero: true } } } });

        const pieCtx = document.getElementById('revenuePieChart').getContext('2d');
        if (chartCache.pie) chartCache.pie.destroy();
        chartCache.pie = new Chart(pieCtx, { type: 'doughnut', data: { labels: data.revMethods.map(m => m.payment_method), datasets: [{ data: data.revMethods.map(m => m.revenue), backgroundColor: colors, borderWidth: 0 }] } });
        
        const barCtx = document.getElementById('popularItemsChart').getContext('2d');
        if (chartCache.bar) chartCache.bar.destroy();
        chartCache.bar = new Chart(barCtx, { type: 'bar', data: { labels: data.topItems.map(i => i.item_name), datasets: [{ label: 'Units Sold', data: data.topItems.map(i => i.total_sold), backgroundColor: 'rgba(212, 163, 115, 0.8)', borderRadius: 5 }] } });

        document.getElementById('top-customers-list').innerHTML = data.topCust.map(c => \`<li><span>\${c.name}</span> <span style="color:#10b981;">\${c.total_orders} Orders</span></li>\`).join('') || "<li>No repeat customers yet</li>";
        document.getElementById('low-perf-list').innerHTML = data.lowItems.map(i => \`<li><span>\${i.item_name}</span> <span style="color:#ef4444;">\${i.total_sold} Units</span></li>\`).join('');
    } catch (err) { console.error("Failed to load stats", err); }
}`;

code = code.replace(/async function loadAnalytics\(\) \{[\s\S]*?\n\}/m, newChartLogic);
fs.writeFileSync('script.js', code);
console.log("Injected charts JS successfully");
