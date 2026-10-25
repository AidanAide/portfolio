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

export async function fetchJSON(url) {
    try {
        // Fetch the JSON data from the given URL
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching or parsing JSON data:', error);
        throw error;
    }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
    containerElement.innerHTML = '';

    for (const project of projects) {
        const projectElement = document.createElement('div');
        projectElement.classList.add('project');

        const heading = document.createElement(headingLevel);
        if (project.url) {
            const projectLink = document.createElement('a');
            projectLink.href = new URL(project.url, import.meta.url).href;
            projectLink.textContent = project.title;
            heading.appendChild(projectLink);
        } else {
            heading.textContent = project.title;
        }
        projectElement.appendChild(heading);

        if (Number.isInteger(project.year)) {
            const year = document.createElement('p');
            year.textContent = `Year: ${project.year}`;
            projectElement.appendChild(year);
        }

        const image = document.createElement('img');
        image.src = new URL(project.image, import.meta.url).href;
        image.alt = project.title;
        projectElement.appendChild(image);

        const description = document.createElement('p');
        description.textContent =
            project.description.trim() || 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
        projectElement.appendChild(description);

        if (project.url) {
            const projectLink = document.createElement('a');
            projectLink.href = new URL(project.url, import.meta.url).href;
            projectLink.textContent = 'View project report';
            projectElement.appendChild(projectLink);
        }

        containerElement.appendChild(projectElement);
    }
}

export async function fetchGitHubData(username) {
    return fetchJSON(`https://api.github.com/users/${username}`);
}