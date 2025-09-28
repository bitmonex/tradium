function uploadFile() {
    let formData = new FormData();
    let fileInput = document.getElementById("fileInput").files[0];

    if (!fileInput) {
        alert("Выберите файл!");
        return;
    }

    formData.append("file", fileInput);

    fetch("/img/upload", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert("Файл загружен успешно!");
            let fileList = document.getElementById("fileList");
            let now = new Date();
            let formattedDate = `${now.getDate()}.${now.getMonth()+1}.${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}`;
            let newFile = `<p><a href="${data.url}">${data.url.split('/').pop()}</a> ${formattedDate}</p>`;
            fileList.innerHTML = newFile + fileList.innerHTML;
        }
    })
    .catch(error => alert("Ошибка загрузки файла"));
}