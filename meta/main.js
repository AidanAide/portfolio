import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const colors = d3.scaleOrdinal(d3.schemeTableau10);

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: 'https://github.com/vis-society/lab-7/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        writable: false,
        configurable: false,
        enumerable: false,
      });

      return ret;
    })
    .sort((a, b) => a.datetime - b.datetime);
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  document.getElementById('tooltip-commit-time').textContent = `${commit.time} ${commit.timezone}`;
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function renderCommitInfo(data, commits) {
  const fileLengths = d3.rollups(data, (lines) => lines.length, (line) => line.file);
  const maxDepth = d3.max(data, (line) => line.depth);
  const longestLine = d3.max(data, (line) => line.length);
  const maxFileLines = d3.max(fileLengths, ([, lines]) => lines);

  const container = d3.select('#stats');
  container.append('h2').attr('class', 'stats-title').text('Summary');
  const dl = container.append('dl').attr('class', 'stats');

  const stats = [
    { label: 'Commits', value: commits.length },
    { label: 'Files', value: fileLengths.length },
    { label: 'Total LOC', value: data.length },
    { label: 'Max depth', value: maxDepth },
    { label: 'Longest line', value: longestLine },
    { label: 'Max lines', value: maxFileLines },
  ];

  for (const stat of stats) {
    dl.append('dt').text(stat.label);
    const value = dl.append('dd').text(stat.value);
    if (stat.label === 'Commits') {
      value.attr('id', 'commit-count');
    }
  }
}

function renderFiles(files) {
  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (file) => file.name)
    .join((enter) =>
      enter.append('div').call((div) => {
        div.append('dt').append('code');
        div.append('dd');
      }),
    );

  filesContainer.select('dt > code').text((file) => file.name);
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((file) => file.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (line) => `--color: ${colors(line.type)}`);
}

function createBrushSelector(svg, brushed, extent) {
  svg.call(d3.brush().extent(extent).on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, width])
    .nice();
  const yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 15]);
  const tooltip = d3.select('#commit-tooltip');
  const timeColor = d3
    .scaleLinear()
    .domain([0, 6, 12, 18, 24])
    .range(['#4169a1', '#e9a15b', '#e9a15b', '#4169a1', '#4169a1'])
    .interpolate(d3.interpolateHcl);
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  xScale.range([usableArea.left, usableArea.right]);
  yScale.range([usableArea.bottom, usableArea.top]);

  let currentCommits = commits;
  let currentSelection = null;

  function isCommitSelected(selection, commit) {
    if (!selection) {
      return false;
    }

    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);
    return x0 <= x && x <= x1 && y0 <= y && y <= y1;
  }

  function renderSelectionCount(selection) {
    const selectedCommits = selection
      ? currentCommits.filter((commit) => isCommitSelected(selection, commit))
      : [];
    const countElement = document.querySelector('#selection-count');
    countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;

    return selectedCommits;
  }

  function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
      ? currentCommits.filter((commit) => isCommitSelected(selection, commit))
      : [];
    const container = document.getElementById('language-breakdown');

    container.innerHTML = '';
    if (selectedCommits.length === 0) {
      return;
    }

    const lines = selectedCommits.flatMap((commit) => commit.lines);
    const breakdown = d3.rollup(lines, (rows) => rows.length, (line) => line.type);

    for (const [language, count] of breakdown) {
      const proportion = d3.format('.1~%')(count / lines.length);
      d3.select(container).append('dt').text(language);
      d3.select(container).append('dd').text(`${count} lines (${proportion})`);
    }
  }

  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);
  gridlines
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));
  gridlines
    .selectAll('.tick line')
    .style('stroke', (hour) => timeColor(hour));

  const dots = svg.append('g').attr('class', 'dots');
  const xAxis = svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`);

  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'),
    );

  function updateScatterPlot(nextCommits) {
    currentCommits = nextCommits;
    d3.select('#commit-count').text(currentCommits.length);
    xScale.domain(d3.extent(currentCommits, (d) => d.datetime)).nice();
    rScale.domain(d3.extent(currentCommits, (d) => d.totalLines));
    const xAxisGenerator = d3.axisBottom(xScale);
    const xAxisGroup = svg.select('g.x-axis');
    xAxisGroup.selectAll('*').remove();
    xAxisGroup.call(xAxisGenerator);

    const sortedCommits = d3.sort(currentCommits, (d) => -d.totalLines);
    dots
      .selectAll('circle')
      .data(sortedCommits, (d) => d.id)
      .join('circle')
      .attr('cx', (d) => xScale(d.datetime))
      .attr('cy', (d) => yScale(d.hourFrac))
      .attr('r', (d) => rScale(d.totalLines))
      .attr('fill', 'steelblue')
      .style('fill-opacity', 0.7)
      .on('mouseenter', (event, commit) => {
        d3.select(event.currentTarget).style('fill-opacity', 1);
        renderTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
      })
      .on('mousemove', updateTooltipPosition)
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).style('fill-opacity', 0.7);
        updateTooltipVisibility(false);
      })
      .classed('selected', (commit) => isCommitSelected(currentSelection, commit));

    dots.classed('brushing', Boolean(currentSelection));
    renderSelectionCount(currentSelection);
    renderLanguageBreakdown(currentSelection);
  }

  const brushed = (event) => {
    currentSelection = event.selection;
    dots.classed('brushing', Boolean(currentSelection));
    dots
      .selectAll('circle')
      .classed('selected', (commit) => isCommitSelected(currentSelection, commit));
    renderSelectionCount(currentSelection);
    renderLanguageBreakdown(currentSelection);
  };

  createBrushSelector(svg, brushed, [
    [usableArea.left, usableArea.top],
    [usableArea.right, usableArea.bottom],
  ]);
  updateScatterPlot(commits);

  return updateScatterPlot;
}

const data = await loadData();
const commits = processCommits(data);
let filteredCommits = commits;
let lines = filteredCommits.flatMap((d) => d.lines);
let files = d3
  .groups(lines, (d) => d.file)
  .map(([name, lines]) => {
    return { name, lines };
  })
  .sort((a, b) => b.lines.length - a.lines.length);

renderCommitInfo(data, commits);
const updateScatterPlot = renderScatterPlot(data, commits);

let commitProgress = 100;

let timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);
let commitMaxTime;
const commitProgressSlider = document.getElementById('commit-progress');
const commitTime = document.getElementById('commit-time');

function onTimeSliderChange() {
  commitProgress = Number(commitProgressSlider.value);
  commitMaxTime = timeScale.invert(commitProgress);
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  lines = filteredCommits.flatMap((d) => d.lines);
  files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length);
  renderFiles(files);
  commitTime.dateTime = commitMaxTime.toISOString();
  commitTime.textContent = commitMaxTime.toLocaleString();
  updateScatterPlot(filteredCommits);
}

commitProgressSlider.addEventListener('input', onTimeSliderChange);
onTimeSliderChange();

function renderCommitStory(selector) {
  d3.select(selector)
    .selectAll('.step')
    .data(commits, (d) => d.id)
    .join('div')
    .attr('class', 'step')
    .each(function (commit, i) {
      const step = d3.select(this);
      step.selectAll('*').remove();

      const paragraph = step.append('p');
      paragraph
        .append('span')
        .text(`On ${commit.datetime.toLocaleString('en', {
          dateStyle: 'full',
          timeStyle: 'short',
        })}, I made `);
      paragraph
        .append('a')
        .attr('href', commit.url)
        .attr('target', '_blank')
        .attr('rel', 'noopener noreferrer')
        .text(i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious');
      paragraph.append('span').text(
        `. I edited ${commit.totalLines} lines across ${
          d3.rollups(
            commit.lines,
            (lines) => lines.length,
            (line) => line.file,
          ).length
        } files. Then I looked over all I had made, and I saw that it was very good.`,
      );
    });
}

renderCommitStory('#scatter-story');
renderCommitStory('#files-story');

function onStepEnter(response) {
  const commit = response.element.__data__;
  commitProgress = timeScale(commit.datetime);
  commitProgressSlider.value = commitProgress;
  onTimeSliderChange();
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);

const filesScroller = scrollama();
filesScroller
  .setup({
    container: '#scrolly-2',
    step: '#scrolly-2 .step',
  })
  .onStepEnter(onStepEnter);
