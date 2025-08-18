document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderTops();
    setInterval(fetchAndRenderTops, 30000);
});

function fetchAndRenderTops() {
    fetch('/api/top')
        .then(response => response.json())
        .then(data => {
            renderTopList(data.gainers, 'gainers', true);
            renderTopList(data.losers, 'losers', false);
        })
        .catch(error => console.error('Ошибка загрузки топов:', error));
}

function renderTopList(list, elementId, isGainer) {
    const container = document.getElementById(elementId);
    if (!container) return;

    container.innerHTML = '';

    list.forEach(item => {
        const change = item.price_change.toFixed(2);
        const color = isGainer ? '#0f0' : '#f55';
        const symbol = item.symbol.replace('USDT', '');
        const cap = formatAbbreviatedNumber(item.market_cap);

        const div = document.createElement('li');
        div.className = '';
        div.innerHTML = `
            <a href="/ticker/${item.symbol}">
            <b>${symbol}</b>
            <u>$${item.price.toFixed(2)}</u>
            <i style="color:${color}">${change > 0 ? '+' : ''}${change}%</i>
            <em>${cap}</em>
            </a>
        `;
        container.appendChild(div);
    });
}

function formatAbbreviatedNumber(value) {
    if (value >= 1_000_000_000) {
        return (value / 1_000_000_000).toFixed(2) + 'b';
    } else if (value >= 1_000_000) {
        return (value / 1_000_000).toFixed(2) + 'm';
    } else if (value >= 1_000) {
        return (value / 1_000).toFixed(2) + 'k';
    } else {
        return value.toFixed(2);
    }
}
