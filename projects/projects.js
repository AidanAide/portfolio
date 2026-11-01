import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
let selectedYear = null;
let query = '';

function renderPieChart(projectsGiven) {
    const rolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year,
    );
    const data = rolledData.map(([year, count]) => ({ label: year, value: count }));
    const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    const sliceGenerator = d3.pie().value((d) => d.value);
    const arcData = sliceGenerator(data);
    const arcs = arcData.map((d) => arcGenerator(d));
    const colors = d3.scaleOrdinal(d3.schemeTableau10);
    const pie = d3.select('#projects-pie-plot');
    const legend = d3.select('.legend');

    pie.selectAll('*').remove();
    legend.selectAll('*').remove();

    arcs.forEach((arc, index) => {
        pie.append('path')
            .attr('d', arc)
            .attr('fill', colors(index))
            .classed('selected', data[index].label === selectedYear)
            .on('click', () => {
                const year = data[index].label;
                selectedYear = selectedYear === year ? null : year;
                updateView();
            });
    });

    data.forEach((d, idx) => {
        legend
            .append('li')
            .attr('style', `--color:${colors(idx)}`)
            .attr('class', 'legend-item')
            .classed('selected', d.label === selectedYear)
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
    });
}

const projectsTitle = document.querySelector('.projects-title');
projectsTitle.textContent = `Projects (${projects.length})`;

function getSearchFilteredProjects() {
    return projects.filter((project) => {
        const values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query);
    });
}

function getFilteredProjects() {
    return projects.filter((project) => {
        const values = Object.values(project).join('\n').toLowerCase();
        const matchesQuery = values.includes(query);
        const matchesYear = selectedYear === null || project.year === selectedYear;
        return matchesQuery && matchesYear;
    });
}

function updateView() {
    renderProjects(getFilteredProjects(), projectsContainer, 'h2');
    renderPieChart(getSearchFilteredProjects());
}

updateView();

const searchInput = document.querySelector('.searchBar');
searchInput.addEventListener('input', (event) => {
    query = event.target.value.trim().toLowerCase();
    updateView();
});
