document.addEventListener('DOMContentLoaded', () => {
    fetchMarketDataHeatmap();
    setInterval(fetchMarketDataHeatmap, 5000);
});

function fetchMarketDataHeatmap() {
    fetch(`/api/heatmap`)
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data)) {
                updateHeatmap(data);
            } else {
                console.error("Ошибка данных для тепловой карты:", data);
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки данных тепловой карты:', error);
        });
}

function updateHeatmap(data) {
    const heatmapElement = document.getElementById('heatmap');
    if (!heatmapElement) {
        console.error('Heatmap не найден');
        return;
    }
    const minChange = Math.min(...data.map(d => d.price_change));
    const maxChange = Math.max(...data.map(d => d.price_change));
    const mappedData = data.map(item => {
        let name = item.symbol;
        if (name.endsWith('USDT')) {
            name = name.slice(0, -4);
        }

        return {
            name: name,
            value: item.market_cap,
            price: item.price,
            change: item.price_change,
            market_cap: item.market_cap,
            volume_24h: item.volume_24h,
            color: colorScale(item.price_change)
        };
    });

    if (!window.treemapInstance) {
        window.treemapInstance = new Treemap(heatmapElement);
    }

    window.treemapInstance.updateData(mappedData);
}
