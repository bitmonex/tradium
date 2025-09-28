function fetchPing() {
    fetch('/ping')
        .then(response => response.json())
        .then(data => {
            updatePingStatus(data);
        })
        .catch(error => {
            console.error("Ping Error!:", error);
            updatePingStatus({ server_ping: "Error!" });
        });
}
function updatePingStatus(data) {
    const statusElement = document.querySelector('[data-binding="ping"]');
    if (statusElement) {
        statusElement.textContent = `${data.server_ping}`;
    }
}
setInterval(fetchPing, 500);
fetchPing();
