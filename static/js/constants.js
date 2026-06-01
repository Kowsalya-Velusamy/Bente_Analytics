export const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#4a5168', font: { family: 'DM Mono', size: 9 } }, grid: { color: 'rgba(28,34,53,0.6)' }, border: { color: 'rgba(28,34,53,0.4)' } },
    y: { ticks: { color: '#4a5168', font: { family: 'DM Mono', size: 9 } }, grid: { color: 'rgba(28,34,53,0.6)' }, border: { color: 'rgba(28,34,53,0.4)' } },
  },
};

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SEG_COLORS = {
  'Power Users':    '#ff4d6d',
  'Event Seekers':  '#f5a623',
  'Casual Visitors':'#00f5c4',
  'Venue Explorers':'#6c63ff',
};

export const SEG_ICONS = {
  'Power Users':    '⚡',
  'Event Seekers':  '🎭',
  'Casual Visitors':'☕',
  'Venue Explorers':'🧭',
};

export const REVIEW_LABELS = {
  atmosphere:      '🌟 Atmosphere',
  cleanliness:     '🧹 Cleanliness',
  wifi:            '📶 WiFi / Connectivity',
  service:         '💼 Service Quality',
  value_for_money: '💰 Value for Money',
  noise_level:     '🔊 Noise Level',
};

export const REVIEW_COLORS = {
  atmosphere:      '#f5a623',
  cleanliness:     '#10b981',
  wifi:            '#38bdf8',
  service:         '#6c63ff',
  value_for_money: '#00f5c4',
  noise_level:     '#ff4d6d',
};
