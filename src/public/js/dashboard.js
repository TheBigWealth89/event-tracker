document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  async function fetchInitialData() {
    try {
      const response = await fetch('/api/stats');
      const result = await response.json();
      if (result.success && result.data) {
        updateDashboard(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch initial stats:", err);
    }
  }

  function updateDashboard(eventCounts) {
    console.log('Updating dashboard with:', eventCounts);

    const events = Object.entries(eventCounts).map(([name, count]) => ({
      name,
      count: parseInt(count, 10)
    }));

    if (events.length === 0) return;

    const totalEvents = events.reduce((sum, e) => sum + e.count, 0);
    const topEvent = events.reduce((max, e) => e.count > max.count ? e : max, events[0]);
    const avgEvents = Math.round(totalEvents / events.length);

    // Update stat cards
    document.getElementById('stat-total').textContent = totalEvents.toLocaleString();
    document.getElementById('stat-types').textContent = events.length;
    document.getElementById('stat-top-event').textContent = topEvent.name;
    document.getElementById('stat-top-event-label').textContent = `${topEvent.count.toLocaleString()} total hits`;
    document.getElementById('stat-avg').textContent = avgEvents.toLocaleString();

    // Update event list
    const eventList = document.getElementById('event-list');
    if (!eventList) return;
    eventList.innerHTML = '';

    events.sort((a, b) => b.count - a.count).forEach((event) => {
      const item = document.createElement('div');
      item.className = 'event-item';
      item.innerHTML = `
        <div class="event-name">
          <div class="event-icon">${event.name.charAt(0).toUpperCase()}</div>
          ${event.name}
        </div>
        <div class="event-count">${event.count.toLocaleString()}</div>
      `;
      eventList.appendChild(item);
    });

    // Hide empty state if visible
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = 'none';

    // Ensure stats and chart are visible
    const statsGrid = document.getElementById('stats-grid');
    const chartContainer = document.getElementById('chart-container');
    if (statsGrid) statsGrid.style.display = 'grid';
    if (chartContainer) chartContainer.style.display = 'block';
  }

  socket.on('analytics-update', updateDashboard);
  socket.on('connect', () => console.log('Connected to server'));
  socket.on('disconnect', () => console.log('Disconnected from server'));
  socket.on('error', (error) => console.error('Socket error:', error));

  // Load initial data
  fetchInitialData();
});
