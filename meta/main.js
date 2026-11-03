import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
  return d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
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
  });
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
  document.getElementById('commit-time').textContent = `${commit.time} ${commit.timezone}`;
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
    dl.append('dd').text(stat.value);
  }
}

function createBrushSelector(svg, brushed, extent) {
  svg.call(d3.brush().extent(extent).on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function renderScatterPlot(data, commits) {
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
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
        ? commits.filter((commit) => isCommitSelected(selection, commit))
        : [];
      const countElement = document.querySelector('#selection-count');
      countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;

      return selectedCommits;
    }

    function renderLanguageBreakdown(selection) {
      const selectedCommits = selection
        ? commits.filter((commit) => isCommitSelected(selection, commit))
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
    dots
      .selectAll('circle')
      .data(sortedCommits)
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
      });

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3
      .axisLeft(yScale)
      .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

    svg.append('g')
      .attr('transform', `translate(0, ${usableArea.bottom})`)
      .call(xAxis);

    svg.append('g')
      .attr('transform', `translate(${usableArea.left}, 0)`)
      .call(yAxis);

    const brushed = (event) => {
      dots.classed('brushing', Boolean(event.selection));
      dots
        .selectAll('circle')
        .classed('selected', (commit) => isCommitSelected(event.selection, commit));
      renderSelectionCount(event.selection);
      renderLanguageBreakdown(event.selection);
    };

    createBrushSelector(svg, brushed, [
      [usableArea.left, usableArea.top],
      [usableArea.right, usableArea.bottom],
    ]);
}

const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
