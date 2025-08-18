/*mm*/
const mm = document.querySelector('.mm');
if (mm) {
    mm.addEventListener('click', function () {
        document.querySelector('.bar')?.classList.toggle('open');
        this.classList.toggle('on');
    });
}

/*nn*/
document.addEventListener('DOMContentLoaded', () => {
    const nn = document.querySelector('.nn');
    if (!nn) return;
    const path = window.location.pathname;
    const allowedPaths = ['/desk', '/heatmap'];
    if (!allowedPaths.includes(path)) {
        nn.classList.add('hide');
    } else {
        nn.classList.remove('hide');
    }

    const sidebar = document.querySelector('.sidebar');
    const wire = document.querySelector('.wire');

    if (sidebar && wire) {
        if (localStorage.getItem('sidebar-show') === 'true') {
            sidebar.classList.add('show');
            wire.classList.add('wire');
            nn.classList.add('on');
        } else {
            sidebar.classList.remove('show');
            wire.classList.remove('wire');
            nn.classList.remove('on');
        }

        nn.addEventListener('click', function () {
            sidebar.classList.toggle('show');
            wire.classList.toggle('wire');
            nn.classList.toggle('on');
            const isVisible = sidebar.classList.contains('show');
            localStorage.setItem('sidebar-show', isVisible);
        });
    }
});

/*Gotop*/
const gotop = document.querySelector('.gotop');
if (gotop) {
    window.addEventListener('scroll', function () {
        gotop.classList.toggle('show', window.scrollY > 0);
    });
    gotop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
