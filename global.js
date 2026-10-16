console.log("IT'S ALIVE!")

let pages = [
    { url: 'index.html', title: 'Home' },
    { url: 'contact/index.html', title: 'Contact' },
    { url: 'projects/index.html', title: 'Projects' },
    { url: 'Resume/index.html', title: 'Resume' },
    { url: 'https://github.com/AidanAide', title: 'GitHub' },
];

let nav = document.createElement('nav');
document.body.prepend(nav);

document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label class="color-scheme">
        Theme:
        <select>
            <option value="light dark">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>`,
);

const select = document.querySelector('.color-scheme select');
select.addEventListener('input', (event) => {
    document.documentElement.style.setProperty('color-scheme', event.target.value);
});

const form = document.querySelector('form');
form?.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(form);
    let url = form.action;
    let firstParameter = true;

    for (let [name, value] of data) {
        url += `${firstParameter ? '?' : '&'}${name}=${encodeURIComponent(value)}`;
        firstParameter = false;
    }

    location.href = url;
});

const currentPath = location.pathname.endsWith('/')
    ? `${location.pathname}index.html`
    : location.pathname;

for (let p of pages) {
    let url = new URL(p.url, import.meta.url);
    let title = p.title;

    let a = document.createElement ('a');
    a.href = url;
    a.textContent = title;
    nav.append(a);
    let link = nav.lastElementChild;

    if (url.origin === location.origin && url.pathname === currentPath) {
        link.classList.add('current');
    }

    if (title === 'GitHub') {
        link.target = '_blank';
    }
}