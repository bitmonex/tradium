let lastPrices = [];
let currentSymbol = new URLSearchParams(window.location.search).get('ticker') || 'BTCUSDT';
let validTickers = [];
let socket;
let reconnectInterval = 5000;

async function fetchTickers() {
    try {
        const response = await fetch('/orderbook/api/tickers');
        if (!response.ok) {
            throw new Error("Ошибка при загрузке тикеров");
        }
        validTickers = await response.json();
    } catch (error) {
        console.error("Ошибка при загрузке тикеров:", error);
    }
}

function calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil(percentile / 100 * sorted.length) - 1;
    return sorted[index];
}

function fetchPrice() {
    fetch(`/orderbook/api/price?symbol=${currentSymbol}`)
        .then(response => response.json())
        .then(data => {
            if (!data.price) {
                throw new Error("Цена не найдена");
            }

            const newPrice = parseFloat(data.price).toFixed(2);
            document.querySelectorAll('.price').forEach((priceElement, index) => {
                if (!lastPrices[index]) {
                    lastPrices[index] = null;
                }

                if (lastPrices[index] !== null) {
                    if (newPrice < lastPrices[index]) {
                        priceElement.classList.add('red');
                        priceElement.classList.remove('green');
                    } else if (newPrice > lastPrices[index]) {
                        priceElement.classList.add('green');
                        priceElement.classList.remove('red');
                    }
                } else {
                    priceElement.classList.add('green');
                }

                priceElement.innerHTML = `${newPrice}<b data-binding="price">${newPrice}</b>`;
                lastPrices[index] = newPrice;
            });
        })
        .catch(error => {
            console.error('Ошибка при получении цены:', error);
            document.querySelectorAll('.price').forEach(priceElement => {
                priceElement.innerHTML = `<b data-binding="price">NaN</b>`;
                priceElement.classList.add('red');
            });
        });
}

function fetchOrderBook(step) {
    fetch(`/orderbook/api/order_book?symbol=${currentSymbol}&step=${step}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            ensureOrderBookTables(); // Обеспечение наличия таблиц ордеров
            const asksTable = document.getElementById(`asks_${step}`);
            const bidsTable = document.getElementById(`bids_${step}`);

            if (!asksTable || !bidsTable) {
                console.error(`Таблицы ордеров с шагом ${step} не найдены в DOM.`);
                return;
            }

            asksTable.innerHTML = '';
            bidsTable.innerHTML = '';

            const asksQuantities = data.asks.map(([_, qty]) => qty);
            const bidsQuantities = data.bids.map(([_, qty]) => qty);

            const asksThreshold = calculatePercentile(asksQuantities, 85);
            const bidsThreshold = calculatePercentile(bidsQuantities, 85);

            data.asks.reverse().forEach(([price, qty]) => {
                const roundedPrice = Math.ceil(price);
                const roundedQty = qty.toFixed(2);
                const row = document.createElement('div');
                if (qty >= asksThreshold) row.classList.add('big');
                row.innerHTML = `<b>${roundedPrice}</b><i>${roundedQty}</i>`;
                asksTable.appendChild(row);
            });

            data.bids.forEach(([price, qty]) => {
                const roundedPrice = Math.floor(price);
                const roundedQty = qty.toFixed(2);
                const row = document.createElement('div');
                if (qty >= bidsThreshold) row.classList.add('big');
                row.innerHTML = `<b>${roundedPrice}</b><i>${roundedQty}</i>`;
                bidsTable.appendChild(row);
            });
        })
        .catch(err => console.error('Error fetching order book:', err));
}

function ensureOrderBookTables() {
    let asksTable = document.getElementById('asksTable');
    let bidsTable = document.getElementById('bidsTable');

    if (!asksTable) {
        asksTable = document.createElement('div');
        asksTable.id = 'asksTable';
        document.body.appendChild(asksTable);
    }

    if (!bidsTable) {
        bidsTable = document.createElement('div');
        bidsTable.id = 'bidsTable';
        document.body.appendChild(bidsTable);
    }
}

function updateOrderBook(symbol, message) {
    const asksTable = document.getElementById('asksTable');
    const bidsTable = document.getElementById('bidsTable');

    if (!asksTable || !bidsTable) {
        console.error("Таблицы ордеров не найдены в DOM.");
        return;
    }

    asksTable.innerHTML = '';
    bidsTable.innerHTML = '';

    const asks = message.a;
    const bids = message.b;

    if (Array.isArray(asks)) {
        asks.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${order[0]}</td><td>${order[1]}</td>`;
            asksTable.appendChild(row);
        });
    } else {
        console.error("asks не является массивом или равен undefined");
    }

    if (Array.isArray(bids)) {
        bids.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${order[0]}</td><td>${order[1]}</td>`;
            bidsTable.appendChild(row);
        });
    } else {
        console.error("bids не является массивом или равен undefined");
    }
}

function updateSymbol(newSymbol) {
    const inputElement = document.getElementById('key');
    const errorElement = document.querySelector('.err');
    if (validateSymbol(newSymbol)) {
        currentSymbol = newSymbol.toUpperCase();
        lastPrices = [];
        updateData();
        history.pushState(null, '', `?ticker=${newSymbol.toUpperCase()}`);
        inputElement.classList.remove('error');
        errorElement.style.display = 'none';
    } else {
        inputElement.classList.add('error');
        errorElement.style.display = 'inline';
    }
}

function validateSymbol(symbol) {
    const isValid = validTickers.includes(symbol.toUpperCase());
    return isValid;
}

function startWebSocket(symbol) {
    if (socket) {
        socket.close();
    }
    socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@depth`);

    socket.onopen = function(event) {
        console.log("WebSocket соединение открыто", event);
    };

    socket.onmessage = function(event) {
        let message;
        try {
            if (typeof event.data === 'object') {
                message = JSON.parse(JSON.stringify(event.data));
            } else {
                message = JSON.parse(event.data);
            }
        } catch (e) {
            console.error("Ошибка при парсинге JSON:", e);
            return;
        }
        updateOrderBook(symbol, message);
    };

    socket.onerror = function(error) {
        console.error("Ошибка WebSocket:", error);
    };

    socket.onclose = function(event) {
        console.log("WebSocket соединение закрыто", event);
        setTimeout(function() {
            startWebSocket(symbol);
        }, reconnectInterval);
    };
}

function checkWebSocketConnection() {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
        console.log("WebSocket не подключен. Попытка переподключения...");
        startWebSocket(currentSymbol);
    }
}

function updateData() {
    fetchPrice();
    const steps = [1, 10, 50, 100, 200, 500, 1000];
    steps.forEach(step => fetchOrderBook(step));
}

window.addEventListener('load', () => {
    fetchTickers().then(() => {
        updateData();
        startWebSocket(currentSymbol);
    });
});

document.getElementById('key').addEventListener('change', (event) => {
    updateSymbol(event.target.value);
});

setInterval(checkWebSocketConnection, 10000);
setInterval(updateData, 100);

function clearOrderBooks() {
    const asksTable = document.getElementById('asksTable');
    const bidsTable = document.getElementById('bidsTable');

    if (asksTable) {
        asksTable.innerHTML = '';
    }
    if (bidsTable) {
        bidsTable.innerHTML = '';
    }
}
