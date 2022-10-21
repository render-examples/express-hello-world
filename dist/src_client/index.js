const btnSend = document.querySelector('#btn-clac');

btnSend.addEventListener('click', evt => {

    const xhr = new XMLHttpRequest();

    xhr.addEventListener('load', evt => {

        if (xhr.status == 200) {
            const result = JSON.parse(xhr.response);
            const resultEle = document.querySelector('#result');
            resultEle.value = result.sum;
        }
    });

    xhr.addEventListener('error', evt => {
        console.error(evt);
    });

    xhr.open('post', 'api/add', true);

    const formEle = document.querySelector('#myform');
    const formData = new FormData(formEle);

    xhr.send(formData);

});
