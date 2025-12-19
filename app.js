// ========================================
// Home Checklist App - Multi-Page Edition
// ========================================

// Default sections for a new page
const DEFAULT_SECTIONS = [
  {
    id: 'daily-1',
    type: 'daily',
    title: 'Ready for the Day.',
    subtitle: 'Complete by nightfall',
    doubleColumn: true,
    chores: [
      "Trash away in cans",
      "Clear pathways",
      "Dishes put in dishwasher",
      "Reduce clutter",
      "Wipe surfaces",
      "Laundry put in Bins"
    ]
  },
  {
    id: 'weekly-1',
    type: 'weekly',
    title: 'Ready for the week.',
    subtitle: 'Complete by Sun',
    chores: [
      "Change sheets",
      "Dishes, loaded",
      "Dishes, unloaded",
      "Vacuum/Clean floors",
      "Clean bathroom",
      "Laundry washed",
      "Laundry dried"
    ]
  },
  {
    id: 'monthly-1',
    type: 'monthly',
    title: 'Monthly Goals',
    subtitle: 'Complete this month',
    doubleColumn: true,
    blankRows: 3,
    chores: [
      "Schedule appointments",
      "Review budget",
      "Plan next month"
    ]
  },
  {
    id: 'notes-1',
    type: 'notes',
    title: 'Notes',
    subtitle: '',
    lineCount: 5,
    doubleColumn: true
  }
];

// Default page template
function createDefaultPage(id, monthOffset = 0) {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthStr = targetDate.getFullYear() + '-' + String(targetDate.getMonth() + 1).padStart(2, '0');
  
  return {
    id: id,
    title: 'Home Checklist',
    month: monthStr,
    baseSize: 10,
    scaleRatio: 1.250,
    sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS))
  };
}

// State
let state = {
  weekStartDay: 1, // 0=Sunday, 1=Monday, 6=Saturday
  pages: [createDefaultPage('page-1', 0)],
  multiPageView: false // false = single page, true = multi-page grid
};

// Generate unique IDs
let pageIdCounter = 2;
let sectionIdCounter = 2;

// ========================================
// Utility Functions
// ========================================

function getMonthName(date) {
  return date.toLocaleDateString('en-US', { month: 'long' });
}

function getDayHeaders() {
  const allDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const result = [];
  for (let i = 0; i < 7; i++) {
    result.push(allDays[(state.weekStartDay + i) % 7]);
  }
  return result;
}

function getMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getWeeksInMonth(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const weeks = [];
  let currentDate = new Date(firstDay);
  
  const firstDayOfWeek = currentDate.getDay();
  const weekStartDay = state.weekStartDay;
  let offset = weekStartDay - firstDayOfWeek;
  if (offset > 0) offset -= 7;
  currentDate.setDate(currentDate.getDate() + offset);
  
  while (currentDate <= lastDay || currentDate.getMonth() === month) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentDate);
      day.setDate(day.getDate() + i);
      days.push({
        date: day,
        inMonth: day.getMonth() === month
      });
    }
    
    const hasMonthDay = days.some(d => d.inMonth);
    if (hasMonthDay) {
      weeks.push({
        start: weekStart,
        end: weekEnd,
        days: days,
        weekNum: weeks.length + 1
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 7);
    
    if (currentDate.getMonth() > month && currentDate.getFullYear() >= year) break;
    if (currentDate.getFullYear() > year) break;
  }
  
  return weeks;
}

function formatDateRange(start, end) {
  const startNum = start.getDate();
  const endNum = end.getDate();
  return `${startNum}–${endNum}`;
}

// ========================================
// Storage
// ========================================

function saveState() {
  const data = {
    weekStartDay: state.weekStartDay,
    pages: state.pages,
    multiPageView: state.multiPageView
  };
  localStorage.setItem('homeChecklist', JSON.stringify(data));
  updateUrlWithState();
}

function updateUrlWithState() {
  try {
    // Only encode: template (first page without month) + list of months
    const master = state.pages[0];
    if (!master) return;
    
    // Type abbreviations
    const typeMap = { daily: 'd', weekly: 'w', monthly: 'm', notes: 'n' };
    
    // Compress sections with ultra-short keys and type abbreviations
    const compressSections = (sections) => {
      return sections.map(s => {
        const compressed = [];
        // Use array format: [type, title?, subtitle?, chores?, doubleColumn?, lineCount?, blankRows?, hideCheckboxes?]
        compressed[0] = typeMap[s.type] || s.type;
        if (s.title) compressed[1] = s.title;
        if (s.subtitle) compressed[2] = s.subtitle;
        if (s.chores && s.chores.length > 0) compressed[3] = s.chores;
        if (s.doubleColumn !== undefined && s.type !== 'weekly') compressed[4] = s.doubleColumn;
        if (s.lineCount !== undefined && s.lineCount !== 5) compressed[5] = s.lineCount;
        if (s.blankRows !== undefined && s.blankRows !== 0) compressed[6] = s.blankRows;
        if (s.hideCheckboxes !== undefined && s.hideCheckboxes) compressed[7] = s.hideCheckboxes;
        // Remove trailing undefined values
        while (compressed.length > 0 && compressed[compressed.length - 1] === undefined) {
          compressed.pop();
        }
        return compressed;
      });
    };
    
    // Compress months: "2026-01" -> "2601"
    const compressMonths = (months) => {
      return months.map(m => m.replace('-', '').substring(2)); // "2026-01" -> "2601"
    };
    
    const urlData = [];
    // Use array format: [weekStartDay?, title?, baseSize?, scaleRatio?, sections, months]
    let idx = 0;
    if (state.weekStartDay !== 1) urlData[idx++] = state.weekStartDay;
    if (master.title !== 'Home Checklist') urlData[idx++] = master.title;
    if (master.baseSize !== 10) urlData[idx++] = master.baseSize;
    if (master.scaleRatio !== 1.250) urlData[idx++] = master.scaleRatio;
    urlData[idx++] = compressSections(master.sections);
    urlData[idx] = compressMonths(state.pages.map(p => p.month));
    
    // Use compact JSON (no whitespace) and base64url encoding
    const json = JSON.stringify(urlData);
    // Convert base64 to base64url (replace + with -, / with _, remove padding)
    const base64 = btoa(json);
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const url = new URL(window.location);
    url.searchParams.set('s', base64url);
    window.history.replaceState({}, '', url);
  } catch (e) {
    console.warn('Could not update URL with state:', e);
  }
}

function loadStateFromUrl() {
  try {
    const url = new URL(window.location);
    const encoded = url.searchParams.get('s');
    if (!encoded) return null;
    
    // Convert base64url back to base64 (replace - with +, _ with /, add padding if needed)
    const base64url = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - base64url.length % 4) % 4;
    const base64 = base64url + '='.repeat(padding);
    
    // Try new format first (base64url), fall back to old format (double-encoded)
    let json;
    try {
      json = atob(base64);
    } catch (e) {
      // Fall back to old double-encoded format
      json = decodeURIComponent(atob(encoded));
    }
    
    let urlData = JSON.parse(json);
    
    // Handle old format (full pages array)
    if (urlData.pages) {
      return urlData;
    }
    
    // Detect format: array format [weekStartDay?, title?, baseSize?, scaleRatio?, sections, months]
    const isArrayFormat = Array.isArray(urlData);
    let weekStartDay = 1, title = 'Home Checklist', baseSize = 10, scaleRatio = 1.250, sections, months;
    
    if (isArrayFormat) {
      // New ultra-compact array format
      let idx = 0;
      if (typeof urlData[idx] === 'number' && urlData[idx] >= 0 && urlData[idx] <= 6) {
        weekStartDay = urlData[idx++];
      }
      if (typeof urlData[idx] === 'string' && urlData[idx].length > 0) {
        title = urlData[idx++];
      }
      if (typeof urlData[idx] === 'number' && urlData[idx] !== 10) {
        baseSize = Math.max(6, urlData[idx++] || 10);
      }
      if (typeof urlData[idx] === 'number' && urlData[idx] !== 1.250) {
        scaleRatio = urlData[idx++];
      }
      sections = urlData[idx++];
      months = urlData[idx];
    } else {
      // Old object format (backward compatibility)
      weekStartDay = urlData.w !== undefined ? urlData.w : 1;
      title = urlData.t || 'Home Checklist';
      baseSize = Math.max(6, urlData.b || 10);
      scaleRatio = urlData.r || 1.250;
      sections = urlData.s;
      months = urlData.m;
    }
    
    // Type reverse map
    const typeReverseMap = { d: 'daily', w: 'weekly', m: 'monthly', n: 'notes' };
    
    // Decompress sections (handle both array and object formats)
    const decompressSections = (compressed) => {
      if (!compressed || !Array.isArray(compressed)) return DEFAULT_SECTIONS;
      return compressed.map((s, idx) => {
        let type, title, subtitle, chores, doubleColumn, lineCount, blankRows, hideCheckboxes;
        
        if (Array.isArray(s)) {
          // New array format: [type, title?, subtitle?, chores?, doubleColumn?, lineCount?, blankRows?, hideCheckboxes?]
          type = typeReverseMap[s[0]] || s[0];
          title = s[1];
          subtitle = s[2];
          chores = s[3];
          doubleColumn = s[4];
          lineCount = s[5];
          blankRows = s[6];
          hideCheckboxes = s[7];
        } else {
          // Old object format
          type = typeReverseMap[s.t] || s.t || 'daily';
          title = s.ti;
          subtitle = s.st;
          chores = s.c;
          doubleColumn = s.dc;
          lineCount = s.lc;
          blankRows = s.br;
          hideCheckboxes = s.hc;
        }
        
        const section = {
          id: `${type}-${idx + 1}`,
          type: type,
          title: title || 'New Section',
          subtitle: subtitle || '',
          chores: chores || []
        };
        
        if (doubleColumn !== undefined) section.doubleColumn = doubleColumn;
        else if (section.type === 'daily') section.doubleColumn = true;
        else if (section.type === 'notes') section.doubleColumn = true;
        else if (section.type === 'monthly') section.doubleColumn = true;
        
        if (lineCount !== undefined) section.lineCount = lineCount;
        else if (section.type === 'notes') section.lineCount = 5;
        
        if (blankRows !== undefined) section.blankRows = blankRows;
        else if (section.type === 'monthly') section.blankRows = 0;
        
        if (hideCheckboxes !== undefined) section.hideCheckboxes = hideCheckboxes;
        
        return section;
      });
    };
    
    // Decompress months: "2601" -> "2026-01"
    const decompressMonths = (compressed) => {
      if (!compressed || !Array.isArray(compressed)) {
        return [new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0')];
      }
      const currentYear = new Date().getFullYear();
      return compressed.map(m => {
        if (m.includes('-')) return m; // Already in full format
        // Assume 20xx for 2-digit years, current year for 4-digit
        if (m.length === 4) {
          const year = parseInt('20' + m.substring(0, 2));
          const month = m.substring(2);
          return `${year}-${month}`;
        }
        return `${currentYear}-${m.padStart(2, '0')}`;
      });
    };
    
    const decompressedMonths = decompressMonths(months);
    const pages = decompressedMonths.map((month, idx) => ({
      id: `page-${idx + 1}`,
      title: title,
      month: month,
      baseSize: Math.max(6, baseSize),
      scaleRatio: scaleRatio,
      sections: decompressSections(sections)
    }));
    
    return {
      weekStartDay: weekStartDay,
      pages: pages
    };
  } catch (e) {
    console.warn('Could not load state from URL:', e);
    return null;
  }
}

function copyShareLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    // Show brief feedback
    const btn = document.getElementById('share-btn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    // Fallback: select the URL
    prompt('Copy this link to share:', url);
  });
}

function generateMarkdown() {
  const page = state.pages[0];
  if (!page) return '';
  
  const [year, month] = page.month.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  let md = `# ${page.title}  ${monthName}\n\n`;
  
  page.sections.forEach(section => {
    if (section.type === 'weekly') {
      md += `## ${section.title}`;
      if (section.subtitle) md += ` *${section.subtitle}*`;
      md += '\n\n';
      
      // Get weeks for the month
      const weeks = getWeeksInMonth(year, month - 1);
      
      // Header row
      md += '| Chore |';
      weeks.forEach((week, i) => {
        const startDay = week.days.find(d => d.inMonth)?.date.getDate() || week.days[0].date.getDate();
        const endDay = week.days.slice().reverse().find(d => d.inMonth)?.date.getDate() || week.days[6].date.getDate();
        md += ` Week ${i + 1} (${startDay}-${endDay}) |`;
      });
      md += '\n';
      
      // Separator row
      md += '|-------|';
      weeks.forEach(() => md += ':-:|');
      md += '\n';
      
      // Chore rows
      section.chores.forEach(chore => {
        md += `| ${chore} |`;
        weeks.forEach(() => md += ' ☐ |');
        md += '\n';
      });
      // Add blank rows
      const blankRows = section.blankRows || 0;
      for (let i = 0; i < blankRows; i++) {
        md += '| |';
        weeks.forEach(() => md += ' ☐ |');
        md += '\n';
      }
      md += '\n';
      
    } else if (section.type === 'daily') {
      md += `## ${section.title}`;
      if (section.subtitle) md += ` *${section.subtitle}*`;
      md += '\n\n';
      
      const dayHeaders = getDayHeaders();
      const weeks = getWeeksInMonth(year, month - 1);
      
      // Repeat table for each week
      weeks.forEach((week, weekIdx) => {
        const startDay = week.days.find(d => d.inMonth)?.date.getDate() || week.days[0].date.getDate();
        const endDay = week.days.slice().reverse().find(d => d.inMonth)?.date.getDate() || week.days[6].date.getDate();
        
        md += `### Week ${weekIdx + 1} (${startDay}-${endDay})\n\n`;
        
        // Header row with actual dates
        md += '| Chore |';
        week.days.forEach(day => {
          if (day.inMonth) {
            md += ` ${day.date.getDate()} |`;
          } else {
            md += ` - |`;
          }
        });
        md += '\n';
        
        // Separator row
        md += '|-------|';
        week.days.forEach(() => md += ':-:|');
        md += '\n';
        
        // Chore rows
        section.chores.forEach(chore => {
          md += `| ${chore} |`;
          week.days.forEach(day => {
            md += day.inMonth ? ' ☐ |' : ' - |';
          });
          md += '\n';
        });
        // Add blank rows
        const blankRows = section.blankRows || 0;
        for (let i = 0; i < blankRows; i++) {
          md += '| |';
          week.days.forEach(day => {
            md += day.inMonth ? ' ☐ |' : ' - |';
          });
          md += '\n';
        }
        md += '\n';
      });
      
    } else if (section.type === 'monthly') {
      md += `## ${section.title}`;
      if (section.subtitle) md += ` *${section.subtitle}*`;
      md += '\n\n';
      
      // Simple checklist table
      md += '| Goal | Done |\n';
      md += '|------|:----:|\n';
      section.chores.forEach(goal => {
        md += `| ${goal} | ☐ |\n`;
      });
      // Add blank rows
      const blankRows = section.blankRows || 0;
      for (let i = 0; i < blankRows; i++) {
        md += `| | ☐ |\n`;
      }
      md += '\n';
      
    } else if (section.type === 'notes') {
      md += `## ${section.title}`;
      if (section.subtitle) md += ` *${section.subtitle}*`;
      md += '\n\n';
      
      const lineCount = section.lineCount || 5;
      for (let i = 0; i < lineCount; i++) {
        md += '- \n';
      }
      md += '\n';
    }
  });
  
  return md;
}

function copyMarkdown() {
  const md = generateMarkdown();
  navigator.clipboard.writeText(md).then(() => {
    const btn = document.getElementById('copy-md-btn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    prompt('Copy this markdown:', md);
  });
}

function loadState() {
  // Check URL first (for shared links)
  const urlState = loadStateFromUrl();
  const saved = urlState || (localStorage.getItem('homeChecklist') ? JSON.parse(localStorage.getItem('homeChecklist')) : null);
  
  if (saved) {
    state.weekStartDay = saved.weekStartDay !== undefined ? saved.weekStartDay : 1;
    state.multiPageView = saved.multiPageView !== undefined ? saved.multiPageView : false;
    
    if (saved.pages && saved.pages.length > 0) {
      state.pages = saved.pages;
      // Find highest IDs for counters and ensure baseSize minimum
      state.pages.forEach(page => {
        const pageNum = parseInt(page.id.split('-')[1]) || 0;
        if (pageNum >= pageIdCounter) pageIdCounter = pageNum + 1;
        
        // Ensure baseSize is at least 6
        if (page.baseSize !== undefined) {
          page.baseSize = Math.max(6, page.baseSize);
        }
        
        page.sections.forEach(s => {
          const num = parseInt(s.id.split('-')[1]) || 0;
          if (num >= sectionIdCounter) sectionIdCounter = num + 1;
        });
      });
    } else if (saved.sections) {
      // Migrate from old single-page format
      state.pages = [{
        id: 'page-1',
        title: saved.title || 'Home Checklist',
        month: saved.startMonth || new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
        baseSize: Math.max(6, saved.baseSize || 10),
        scaleRatio: saved.scaleRatio || 1.250,
        sections: saved.sections
      }];
    }
    
    // If loaded from URL, save to localStorage too
    if (urlState) {
      localStorage.setItem('homeChecklist', JSON.stringify({
        weekStartDay: state.weekStartDay,
        pages: state.pages
      }));
    }
  }
}

// ========================================
// Page Generation
// ========================================

function generateSingleColumnDaily(section, weeks, weekCount) {
  const blankRows = section.blankRows || 0;
  const hideCheckboxes = section.hideCheckboxes || false;
  return `
    <table class="daily-table ${hideCheckboxes ? 'hide-checkboxes' : ''}">
      <thead>
        <tr>
          <th class="chore-name-col">Chore</th>
          ${getDayHeaders().map(d => 
            `<th class="day-col">${d}</th>`
          ).join('')}
        </tr>
      </thead>
      <tbody>
        ${section.chores.map(chore => `
          ${weeks.map((week, weekIdx) => `
            <tr class="${weekIdx > 0 ? 'week-row' : ''}">
              ${weekIdx === 0 ? `<td class="chore-name" rowspan="${weekCount}">${chore}</td>` : ''}
              ${week.days.map(day => `
                <td class="check-cell ${!day.inMonth ? 'out-of-month' : ''}">
                  ${day.inMonth ? `
                    <span class="check-area">
                      <span class="day-num">${day.date.getDate()}</span><span class="checkbox"></span>
                    </span>
                  ` : ''}
                </td>
              `).join('')}
            </tr>
          `).join('')}
        `).join('')}
        ${Array(blankRows).fill('').map(() => `
          ${weeks.map((week, weekIdx) => `
            <tr class="${weekIdx > 0 ? 'week-row' : ''}">
              ${weekIdx === 0 ? `<td class="chore-name blank-chore" rowspan="${weekCount}"></td>` : ''}
              ${week.days.map(day => `
                <td class="check-cell ${!day.inMonth ? 'out-of-month' : ''}">
                  ${day.inMonth ? `
                    <span class="check-area">
                      <span class="day-num">${day.date.getDate()}</span><span class="checkbox"></span>
                    </span>
                  ` : ''}
                </td>
              `).join('')}
            </tr>
          `).join('')}
        `).join('')}
      </tbody>
    </table>
  `;
}

function generateDoubleColumnDaily(section, weeks, weekCount) {
  const midpoint = Math.ceil(section.chores.length / 2);
  const leftChores = section.chores.slice(0, midpoint);
  const rightChores = section.chores.slice(midpoint);
  
  while (rightChores.length < leftChores.length) {
    rightChores.push(null);
  }
  
  const dayHeaders = getDayHeaders();
  const blankRows = section.blankRows || 0;
  const hideCheckboxes = section.hideCheckboxes || false;
  
  // Generate colgroup for explicit column widths
  const dayCols = Array(7).fill('<col style="width: 5.5%">').join('');
  
  return `
    <table class="daily-table double-column ${hideCheckboxes ? 'hide-checkboxes' : ''}">
      <colgroup>
        <col style="width: 11%">
        ${dayCols}
        <col style="width: 1%">
        <col style="width: 11%">
        ${dayCols}
      </colgroup>
      <thead>
        <tr>
          <th class="chore-name-col">Chore</th>
          ${dayHeaders.map(d => `<th class="day-col">${d}</th>`).join('')}
          <th class="column-separator"></th>
          <th class="chore-name-col">Chore</th>
          ${dayHeaders.map(d => `<th class="day-col">${d}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${leftChores.map((leftChore, choreIdx) => {
          const rightChore = rightChores[choreIdx];
          return weeks.map((week, weekIdx) => `
            <tr class="${weekIdx > 0 ? 'week-row' : ''}">
              ${weekIdx === 0 ? `<td class="chore-name" rowspan="${weekCount}">${leftChore}</td>` : ''}
              ${week.days.map(day => `
                <td class="check-cell ${!day.inMonth ? 'out-of-month' : ''}">
                  ${day.inMonth ? `
                    <span class="check-area">
                      <span class="day-num">${day.date.getDate()}</span><span class="checkbox"></span>
                    </span>
                  ` : ''}
                </td>
              `).join('')}
              ${weekIdx === 0 ? `<td class="column-separator" rowspan="${weekCount}"></td>` : ''}
              ${weekIdx === 0 ? `<td class="chore-name ${rightChore === null ? 'orphan-chore' : ''}" rowspan="${weekCount}">${rightChore || ''}</td>` : ''}
              ${week.days.map(day => `
                <td class="check-cell ${!day.inMonth ? 'out-of-month' : ''} ${rightChore === null ? 'orphan-cell' : ''}">
                  ${day.inMonth ? `
                    <span class="check-area">
                      <span class="day-num">${day.date.getDate()}</span><span class="checkbox"></span>
                    </span>
                  ` : ''}
                </td>
              `).join('')}
            </tr>
          `).join('');
        }).join('')}
        ${Array(blankRows).fill('').map(() => `
          ${weeks.map((week, weekIdx) => `
            <tr class="${weekIdx > 0 ? 'week-row' : ''}">
              ${weekIdx === 0 ? `<td class="chore-name blank-chore" rowspan="${weekCount}"></td>` : ''}
              ${week.days.map(day => `
                <td class="check-cell ${!day.inMonth ? 'out-of-month' : ''}">
                  ${day.inMonth ? `
                    <span class="check-area">
                      <span class="day-num">${day.date.getDate()}</span><span class="checkbox"></span>
                    </span>
                  ` : ''}
                </td>
              `).join('')}
              ${weekIdx === 0 ? `<td class="column-separator" rowspan="${weekCount}"></td>` : ''}
              ${weekIdx === 0 ? `<td class="chore-name blank-chore" rowspan="${weekCount}"></td>` : ''}
              ${week.days.map(day => `
                <td class="check-cell ${!day.inMonth ? 'out-of-month' : ''}">
                  ${day.inMonth ? `
                    <span class="check-area">
                      <span class="day-num">${day.date.getDate()}</span><span class="checkbox"></span>
                    </span>
                  ` : ''}
                </td>
              `).join('')}
            </tr>
          `).join('')}
        `).join('')}
      </tbody>
    </table>
  `;
}

function generateWeeklySection(section, weeks) {
  const blankRows = section.blankRows || 0;
  const hideCheckboxes = section.hideCheckboxes || false;
  return `
    <section class="chore-section weekly-section">
      <div class="section-header">
        <h2><strong>${section.title}</strong> <em>${section.subtitle}</em></h2>
      </div>
      <table class="weekly-table ${hideCheckboxes ? 'hide-checkboxes' : ''}">
        <thead>
          <tr>
            <th class="chore-name-col">Chore</th>
            ${weeks.map(week => `
              <th>
                <span class="week-header">
                  <span class="week-label">Week ${week.weekNum}</span>
                  <span class="week-dates">${formatDateRange(week.start, week.end)}</span>
                </span>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${section.chores.map(chore => `
            <tr>
              <td class="chore-name">${chore}</td>
              ${weeks.map(() => `
                <td class="check-cell"><span class="check-area"></span></td>
              `).join('')}
            </tr>
          `).join('')}
          ${Array(blankRows).fill('').map(() => `
            <tr>
              <td class="chore-name blank-chore"></td>
              ${weeks.map(() => `
                <td class="check-cell"><span class="check-area"></span></td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function generateDailySection(section, weeks, weekCount) {
  return `
    <section class="chore-section daily-section">
      <div class="section-header">
        <h2><strong>${section.title}</strong> <em>${section.subtitle}</em></h2>
      </div>
      ${section.doubleColumn ? generateDoubleColumnDaily(section, weeks, weekCount) : generateSingleColumnDaily(section, weeks, weekCount)}
    </section>
  `;
}

function generateNotesSection(section) {
  const lineCount = section.lineCount || 5;
  const lines = Array(lineCount).fill('').map(() => '<div class="note-line"></div>').join('');
  const subtitleHtml = section.subtitle ? ` <em>${section.subtitle}</em>` : '';
  
  if (section.doubleColumn) {
    return `
      <section class="chore-section notes-section">
        <div class="section-header">
          <h2><strong>${section.title}</strong>${subtitleHtml}</h2>
        </div>
        <div class="notes-columns">
          <div class="notes-column">${lines}</div>
          <div class="notes-column">${lines}</div>
        </div>
      </section>
    `;
  }
  
  return `
    <section class="chore-section notes-section">
      <div class="section-header">
        <h2><strong>${section.title}</strong>${subtitleHtml}</h2>
      </div>
      <div class="notes-lines">
        ${lines}
      </div>
    </section>
  `;
}

function generateMonthlySection(section) {
  const subtitleHtml = section.subtitle ? ` <em>${section.subtitle}</em>` : '';
  const blankRows = section.blankRows || 0;
  const hideCheckboxes = section.hideCheckboxes || false;
  
  if (section.doubleColumn) {
    // Multi-column grid layout
    const gridItems = section.chores.map(chore => `
      <div class="monthly-grid-item">
        <span class="checkbox"></span>
        <span class="monthly-label">${chore}</span>
      </div>
    `).join('');
    
    // Add blank grid items
    const blankGridItems = Array(blankRows).fill('').map(() => `
      <div class="monthly-grid-item blank">
        <span class="checkbox"></span>
        <span class="monthly-label blank-line"></span>
      </div>
    `).join('');
    
    return `
      <section class="chore-section monthly-section">
        <div class="section-header">
          <h2><strong>${section.title}</strong>${subtitleHtml}</h2>
        </div>
        <div class="monthly-grid ${hideCheckboxes ? 'hide-checkboxes' : ''}">
          ${gridItems}
          ${blankGridItems}
        </div>
      </section>
    `;
  }
  
  // Single column list layout
  const listItems = section.chores.map(chore => `
    <tr>
      <td class="monthly-goal">${chore}</td>
      <td class="monthly-check"><span class="checkbox"></span></td>
    </tr>
  `).join('');
  
  // Add blank rows
  const blankListItems = Array(blankRows).fill('').map(() => `
    <tr>
      <td class="monthly-goal blank-goal"></td>
      <td class="monthly-check"><span class="checkbox"></span></td>
    </tr>
  `).join('');
  
  return `
    <section class="chore-section monthly-section">
      <div class="section-header">
        <h2><strong>${section.title}</strong>${subtitleHtml}</h2>
      </div>
      <table class="monthly-table ${hideCheckboxes ? 'hide-checkboxes' : ''}">
        <thead>
          <tr>
            <th class="monthly-goal-col">Goal</th>
            <th class="monthly-check-col">${hideCheckboxes ? '' : '☐'}</th>
          </tr>
        </thead>
        <tbody>
          ${listItems}
          ${blankListItems}
        </tbody>
      </table>
    </section>
  `;
}

function generatePrintablePage(page) {
  const [year, month] = page.month.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const weeks = getWeeksInMonth(year, month - 1);
  const weekCount = weeks.length;
  
  const div = document.createElement('div');
  div.className = 'checklist-page';
  div.dataset.pageId = page.id;
  
  // Apply page-specific type scale as inline styles
  const base = Math.max(6, page.baseSize || 10);
  const ratio = page.scaleRatio;
  const typeSmall = base / ratio;
  const typeBase = base;
  const typeMedium = base * ratio;
  const typeLarge = base * ratio * ratio;
  
  div.style.setProperty('--type-small', `${typeSmall.toFixed(2)}px`);
  div.style.setProperty('--type-base', `${typeBase.toFixed(2)}px`);
  div.style.setProperty('--type-medium', `${typeMedium.toFixed(2)}px`);
  div.style.setProperty('--type-large', `${typeLarge.toFixed(2)}px`);
  
  let sectionsHtml = '';
  page.sections.forEach(section => {
    if (section.type === 'weekly') {
      sectionsHtml += generateWeeklySection(section, weeks);
    } else if (section.type === 'daily') {
      sectionsHtml += generateDailySection(section, weeks, weekCount);
    } else if (section.type === 'notes') {
      sectionsHtml += generateNotesSection(section);
    } else if (section.type === 'monthly') {
      sectionsHtml += generateMonthlySection(section);
    }
  });
  
  div.innerHTML = `
    <header class="page-header">
      <h1>${page.title}</h1>
      <span class="month-display">${getMonthYear(date)}</span>
    </header>
    ${sectionsHtml}
  `;
  
  return div;
}

// ========================================
// Scale ratio options HTML
// ========================================

function getScaleRatioOptions(selectedValue) {
  const options = [
    { value: '1.000', label: '1.000 – Mono' },
    { value: '1.067', label: '1.067 – Minor 2nd' },
    { value: '1.125', label: '1.125 – Major 2nd' },
    { value: '1.200', label: '1.200 – Minor 3rd' },
    { value: '1.250', label: '1.250 – Major 3rd' },
    { value: '1.333', label: '1.333 – Perfect 4th' },
    { value: '1.414', label: '1.414 – Aug 4th' },
    { value: '1.500', label: '1.500 – Perfect 5th' },
    { value: '1.618', label: '1.618 – Golden' }
  ];
  
  return options.map(opt => 
    `<option value="${opt.value}" ${opt.value === selectedValue ? 'selected' : ''}>${opt.label}</option>`
  ).join('');
}

// ========================================
// Rendering
// ========================================

function renderPrintablePages() {
  const container = document.getElementById('checklist-container');
  container.innerHTML = '';
  
  // Sync master template to all pages (keeping their unique months)
  const master = state.pages[0];
  if (master) {
    state.pages.forEach((page, idx) => {
      if (idx > 0) {
        page.title = master.title;
        page.baseSize = master.baseSize;
        page.scaleRatio = master.scaleRatio;
        page.sections = JSON.parse(JSON.stringify(master.sections));
      }
    });
  }
  
  // Create stack wrapper
  const stack = document.createElement('div');
  stack.className = 'page-stack';
  
  // Add multi-page-view class if enabled
  if (state.multiPageView && state.pages.length > 1) {
    stack.classList.add('multi-page-view');
  }
  
  state.pages.forEach(page => {
    const pageEl = generatePrintablePage(page);
    stack.appendChild(pageEl);
  });
  
  // Add page count badge if more than 1 page (only in single-page view)
  if (state.pages.length > 1 && !state.multiPageView) {
    const countBadge = document.createElement('span');
    countBadge.className = 'stack-count';
    countBadge.textContent = `${state.pages.length} pages`;
    stack.appendChild(countBadge);
  }
  
  container.appendChild(stack);
  
  // Show/hide view mode section and sync toggle state
  const viewModeSection = document.getElementById('view-mode-section');
  const multiPageToggle = document.getElementById('multi-page-toggle');
  if (viewModeSection) {
    viewModeSection.style.display = state.pages.length > 1 ? 'flex' : 'none';
  }
  if (multiPageToggle) {
    multiPageToggle.checked = state.multiPageView;
  }
}

function renderPageHint() {
  const count = state.pages.length;
  const hint = document.getElementById('page-hint');
  hint.textContent = `${count} page${count > 1 ? 's' : ''}`;
}

function renderPageCards() {
  const container = document.getElementById('pages-container');
  container.innerHTML = '';
  
  // Only render the master template (first page)
  const page = state.pages[0];
  if (!page) return;
  
  const card = document.createElement('div');
  card.className = 'panel-card page-card';
  card.dataset.pageId = page.id;
  
  card.innerHTML = `
    <div class="details-section">
      <div class="detail-field">
        <label>Page Title</label>
        <input type="text" class="page-title-input" data-page-id="${page.id}" value="${page.title}" placeholder="Enter title...">
      </div>
      <div class="type-scale-row">
        <div class="detail-field compact">
          <label>Base Size</label>
          <input type="number" class="page-base-size" data-page-id="${page.id}" value="${page.baseSize}" min="6" max="16" step="0.5">
        </div>
        <div class="detail-field compact">
          <label>Scale Ratio</label>
          <select class="page-scale-ratio" data-page-id="${page.id}">
            ${getScaleRatioOptions(page.scaleRatio.toFixed(3))}
          </select>
        </div>
      </div>
    </div>
    
    <div class="chore-sections-area">
      <h3 class="card-title">Chore Sections</h3>
      <div class="sections-container" data-page-id="${page.id}">
        <!-- Sections rendered here -->
      </div>
      <div class="add-section-buttons">
        <button class="add-section-btn add-weekly" data-page-id="${page.id}">+ Weekly</button>
        <button class="add-section-btn add-daily" data-page-id="${page.id}">+ Daily</button>
        <button class="add-section-btn add-monthly" data-page-id="${page.id}">+ Monthly</button>
        <button class="add-section-btn add-notes" data-page-id="${page.id}">+ Notes</button>
      </div>
    </div>
  `;
  
  container.appendChild(card);
  
  // Render sections for the master page
  renderPageSections(page);
  
  attachPageCardEventListeners();
}

function renderPageSections(page) {
  const container = document.querySelector(`.sections-container[data-page-id="${page.id}"]`);
  if (!container) return;
  
  container.innerHTML = '';
  
  page.sections.forEach((section, sectionIdx) => {
    const div = document.createElement('div');
    div.className = 'chore-section-item';
    div.dataset.pageId = page.id;
    div.dataset.sectionId = section.id;
    
    div.innerHTML = `
      <div class="section-header-row">
        <div class="section-order-btns">
          <button class="section-move-btn" data-page-id="${page.id}" data-section-id="${section.id}" data-direction="up" title="Move up" ${sectionIdx === 0 ? 'disabled' : ''}>▲</button>
          <button class="section-move-btn" data-page-id="${page.id}" data-section-id="${section.id}" data-direction="down" title="Move down" ${sectionIdx === page.sections.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <span class="section-order-num">${sectionIdx + 1}</span>
        <span class="section-type-badge ${section.type}">${section.type}</span>
        <button class="section-delete-btn" data-page-id="${page.id}" data-section-id="${section.id}" title="Remove section">×</button>
      </div>
      ${section.type === 'notes' ? `
        <div class="section-title-inputs">
          <input type="text" class="section-title" data-page-id="${page.id}" data-section-id="${section.id}" placeholder="Label..." value="${section.title}">
          <input type="text" class="section-subtitle" data-page-id="${page.id}" data-section-id="${section.id}" placeholder="Subtitle..." value="${section.subtitle || ''}">
        </div>
        <div class="section-options layout-toggle">
          <span class="layout-icon" title="Single column">▤</span>
          <label class="toggle-switch">
            <input type="checkbox" class="double-column-toggle" data-page-id="${page.id}" data-section-id="${section.id}" ${section.doubleColumn ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="layout-icon" title="Double column">▥</span>
        </div>
        <div class="notes-option-item">
          <label>Lines:</label>
          <input type="number" class="line-count-input" data-page-id="${page.id}" data-section-id="${section.id}" value="${section.lineCount || 5}" min="1" max="20">
        </div>
      ` : section.type === 'monthly' ? `
        <div class="section-title-inputs">
          <input type="text" class="section-title" data-page-id="${page.id}" data-section-id="${section.id}" placeholder="Section title..." value="${section.title}">
          <input type="text" class="section-subtitle" data-page-id="${page.id}" data-section-id="${section.id}" placeholder="Subtitle..." value="${section.subtitle || ''}">
        </div>
        <div class="section-options layout-toggle">
          <span class="layout-icon" title="List">☰</span>
          <label class="toggle-switch">
            <input type="checkbox" class="double-column-toggle" data-page-id="${page.id}" data-section-id="${section.id}" ${section.doubleColumn ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="layout-icon" title="Grid">▦</span>
        </div>
        <div class="notes-option-item">
          <label>Blank rows:</label>
          <input type="number" class="blank-rows-input" data-page-id="${page.id}" data-section-id="${section.id}" value="${section.blankRows || 0}" min="0" max="20">
        </div>
        <div class="notes-option-item">
          <label>Hide checkboxes:</label>
          <label class="toggle-switch">
            <input type="checkbox" class="hide-checkboxes-toggle" data-page-id="${page.id}" data-section-id="${section.id}" ${section.hideCheckboxes ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <ul class="section-chore-list" data-page-id="${page.id}" data-section-id="${section.id}"></ul>
        <div class="inline-adder">
          <input type="text" class="chore-input" data-page-id="${page.id}" data-section-id="${section.id}" placeholder="Add goal...">
          <button class="add-chore-btn" data-page-id="${page.id}" data-section-id="${section.id}">+</button>
        </div>
      ` : `
        <div class="section-title-inputs">
          <input type="text" class="section-title" data-page-id="${page.id}" data-section-id="${section.id}" placeholder="Section title..." value="${section.title}">
          <input type="text" class="section-subtitle" data-page-id="${page.id}" data-section-id="${section.id}" placeholder="Subtitle..." value="${section.subtitle}">
        </div>
        ${section.type === 'daily' ? `
          <div class="section-options layout-toggle">
            <span class="layout-icon" title="Single column">▤</span>
            <label class="toggle-switch">
              <input type="checkbox" class="double-column-toggle" data-page-id="${page.id}" data-section-id="${section.id}" ${section.doubleColumn ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span class="layout-icon" title="Double column">▥</span>
          </div>
          <div class="notes-option-item">
            <label>Blank calendars:</label>
            <input type="number" class="blank-rows-input" data-page-id="${page.id}" data-section-id="${section.id}" value="${section.blankRows || 0}" min="0" max="20">
          </div>
          <div class="notes-option-item">
            <label>Hide checkboxes:</label>
            <label class="toggle-switch">
              <input type="checkbox" class="hide-checkboxes-toggle" data-page-id="${page.id}" data-section-id="${section.id}" ${section.hideCheckboxes ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        ` : section.type === 'weekly' ? `
          <div class="notes-option-item">
            <label>Blank rows:</label>
            <input type="number" class="blank-rows-input" data-page-id="${page.id}" data-section-id="${section.id}" value="${section.blankRows || 0}" min="0" max="20">
          </div>
          <div class="notes-option-item">
            <label>Hide checkboxes:</label>
            <label class="toggle-switch">
              <input type="checkbox" class="hide-checkboxes-toggle" data-page-id="${page.id}" data-section-id="${section.id}" ${section.hideCheckboxes ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        ` : ''}
        <ul class="section-chore-list" data-page-id="${page.id}" data-section-id="${section.id}"></ul>
        <div class="inline-adder">
          <input type="text" class="chore-input" data-page-id="${page.id}" data-section-id="${section.id}" placeholder="Add chore...">
          <button class="add-chore-btn" data-page-id="${page.id}" data-section-id="${section.id}">+</button>
        </div>
      `}
    `;
    
    container.appendChild(div);
    
    if (section.type !== 'notes' && section.chores) {
      renderSectionChores(page, section);
    }
  });
}

function renderSectionChores(page, section) {
  const list = document.querySelector(`.section-chore-list[data-page-id="${page.id}"][data-section-id="${section.id}"]`);
  if (!list) return;
  
  list.innerHTML = '';
  section.chores.forEach((chore, index) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.pageId = page.id;
    li.dataset.sectionId = section.id;
    li.dataset.index = index;
    li.innerHTML = `
      <span class="drag-handle">⋮⋮</span>
      <span class="chore-text">${chore}</span>
      <div class="chore-actions">
        <button class="edit-chore-btn" data-page-id="${page.id}" data-section-id="${section.id}" data-index="${index}" title="Edit">✎</button>
        <button class="remove-chore-btn" data-page-id="${page.id}" data-section-id="${section.id}" data-index="${index}" title="Remove">×</button>
      </div>
    `;
    
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragenter', handleDragEnter);
    li.addEventListener('dragleave', handleDragLeave);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragend', handleDragEnd);
    
    list.appendChild(li);
  });
}

// ========================================
// Drag and Drop
// ========================================

let draggedItem = null;

function handleDragStart(e) {
  draggedItem = e.target;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  const li = e.target.closest('li');
  if (li && li !== draggedItem) {
    li.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  const li = e.target.closest('li');
  if (li) {
    li.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const targetLi = e.target.closest('li');
  if (!targetLi || targetLi === draggedItem) return;
  
  const pageId = draggedItem.dataset.pageId;
  const sectionId = draggedItem.dataset.sectionId;
  const fromIndex = parseInt(draggedItem.dataset.index);
  const toIndex = parseInt(targetLi.dataset.index);
  
  if (targetLi.dataset.sectionId !== sectionId || targetLi.dataset.pageId !== pageId) return;
  
  const page = state.pages.find(p => p.id === pageId);
  if (!page) return;
  const section = page.sections.find(s => s.id === sectionId);
  if (!section) return;
  
  const [movedItem] = section.chores.splice(fromIndex, 1);
  section.chores.splice(toIndex, 0, movedItem);
  
  saveState();
  renderSectionChores(page, section);
  renderPrintablePages();
  // Reattach event listeners after DOM is recreated
  attachSectionEventListeners(page);
  
  targetLi.classList.remove('drag-over');
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  draggedItem = null;
}

// ========================================
// Event Listeners
// ========================================

function attachPageCardEventListeners() {
  const masterPage = state.pages[0];
  if (!masterPage) return;
  
  // Sync changes from master to all pages
  function syncToAllPages() {
    const { title, baseSize, scaleRatio, sections } = masterPage;
    state.pages.forEach((page, idx) => {
      if (idx > 0) {
        page.title = title;
        page.baseSize = baseSize;
        page.scaleRatio = scaleRatio;
        page.sections = JSON.parse(JSON.stringify(sections));
      }
    });
  }
  
  // Page title input
  document.querySelectorAll('.page-title-input').forEach(input => {
    input.addEventListener('input', (e) => {
      masterPage.title = e.target.value || 'Home Checklist';
      syncToAllPages();
      saveState();
      renderPrintablePages();
    });
  });
  
  // Page base size input
  document.querySelectorAll('.page-base-size').forEach(input => {
    input.addEventListener('input', (e) => {
      const value = Math.max(6, parseFloat(e.target.value) || 10);
      masterPage.baseSize = value;
      e.target.value = value; // Update input to show clamped value
      syncToAllPages();
      saveState();
      renderPrintablePages();
    });
  });
  
  // Page scale ratio select
  document.querySelectorAll('.page-scale-ratio').forEach(select => {
    select.addEventListener('change', (e) => {
      masterPage.scaleRatio = parseFloat(e.target.value);
      syncToAllPages();
      saveState();
      renderPrintablePages();
    });
  });
  
  // Add section buttons
  document.querySelectorAll('.add-weekly').forEach(btn => {
    btn.addEventListener('click', (e) => {
      masterPage.sections.push({
        id: `weekly-${sectionIdCounter++}`,
        type: 'weekly',
        title: 'New Weekly Section',
        subtitle: 'Complete by...',
        chores: []
      });
      syncToAllPages();
      saveState();
      renderPageSections(masterPage);
      attachSectionEventListeners(masterPage);
      renderPrintablePages();
    });
  });
  
  document.querySelectorAll('.add-daily').forEach(btn => {
    btn.addEventListener('click', (e) => {
      masterPage.sections.push({
        id: `daily-${sectionIdCounter++}`,
        type: 'daily',
        title: 'New Daily Section',
        subtitle: 'Complete by...',
        doubleColumn: true,
        chores: []
      });
      syncToAllPages();
      saveState();
      renderPageSections(masterPage);
      attachSectionEventListeners(masterPage);
      renderPrintablePages();
    });
  });
  
  document.querySelectorAll('.add-monthly').forEach(btn => {
    btn.addEventListener('click', (e) => {
      masterPage.sections.push({
        id: `monthly-${sectionIdCounter++}`,
        type: 'monthly',
        title: 'Monthly Goals',
        subtitle: 'Complete this month',
        doubleColumn: true,
        blankRows: 3,
        chores: [
          "Schedule appointments",
          "Review budget",
          "Plan next month"
        ]
      });
      syncToAllPages();
      saveState();
      renderPageSections(masterPage);
      attachSectionEventListeners(masterPage);
      renderPrintablePages();
    });
  });
  
  document.querySelectorAll('.add-notes').forEach(btn => {
    btn.addEventListener('click', (e) => {
      masterPage.sections.push({
        id: `notes-${sectionIdCounter++}`,
        type: 'notes',
        title: 'Notes',
        subtitle: '',
        lineCount: 5,
        doubleColumn: true
      });
      syncToAllPages();
      saveState();
      renderPageSections(masterPage);
      attachSectionEventListeners(masterPage);
      renderPrintablePages();
    });
  });
  
  // Attach section event listeners for master page only
  attachSectionEventListeners(masterPage);
}

function attachSectionEventListeners(page) {
  const pageId = page.id;
  
  // Section move buttons
  document.querySelectorAll(`.section-move-btn[data-page-id="${pageId}"]`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sectionId = e.target.dataset.sectionId;
      const direction = e.target.dataset.direction;
      const idx = page.sections.findIndex(s => s.id === sectionId);
      
      if (direction === 'up' && idx > 0) {
        [page.sections[idx - 1], page.sections[idx]] = [page.sections[idx], page.sections[idx - 1]];
      } else if (direction === 'down' && idx < page.sections.length - 1) {
        [page.sections[idx], page.sections[idx + 1]] = [page.sections[idx + 1], page.sections[idx]];
      }
      
      saveState();
      renderPageSections(page);
      attachSectionEventListeners(page);
      renderPrintablePages();
    });
  });
  
  // Section delete buttons
  document.querySelectorAll(`.section-delete-btn[data-page-id="${pageId}"]`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sectionId = e.target.dataset.sectionId;
      page.sections = page.sections.filter(s => s.id !== sectionId);
      saveState();
      renderPageSections(page);
      attachSectionEventListeners(page);
      renderPrintablePages();
    });
  });
  
  // Section title/subtitle inputs
  document.querySelectorAll(`.section-title[data-page-id="${pageId}"]`).forEach(input => {
    input.addEventListener('input', (e) => {
      const section = page.sections.find(s => s.id === e.target.dataset.sectionId);
      if (section) {
        section.title = e.target.value;
        saveState();
        renderPrintablePages();
      }
    });
  });
  
  document.querySelectorAll(`.section-subtitle[data-page-id="${pageId}"]`).forEach(input => {
    input.addEventListener('input', (e) => {
      const section = page.sections.find(s => s.id === e.target.dataset.sectionId);
      if (section) {
        section.subtitle = e.target.value;
        saveState();
        renderPrintablePages();
      }
    });
  });
  
  // Double column toggles
  document.querySelectorAll(`.double-column-toggle[data-page-id="${pageId}"]`).forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const section = page.sections.find(s => s.id === e.target.dataset.sectionId);
      if (section) {
        section.doubleColumn = e.target.checked;
        saveState();
        renderPrintablePages();
      }
    });
  });
  
  // Line count inputs
  document.querySelectorAll(`.line-count-input[data-page-id="${pageId}"]`).forEach(input => {
    input.addEventListener('input', (e) => {
      const section = page.sections.find(s => s.id === e.target.dataset.sectionId);
      if (section) {
        section.lineCount = parseInt(e.target.value) || 5;
        saveState();
        renderPrintablePages();
      }
    });
  });
  
  // Blank rows inputs (for monthly section)
  document.querySelectorAll(`.blank-rows-input[data-page-id="${pageId}"]`).forEach(input => {
    input.addEventListener('input', (e) => {
      const section = page.sections.find(s => s.id === e.target.dataset.sectionId);
      if (section) {
        section.blankRows = parseInt(e.target.value) || 0;
        saveState();
        renderPrintablePages();
      }
    });
  });
  
  // Hide checkboxes toggles
  document.querySelectorAll(`.hide-checkboxes-toggle[data-page-id="${pageId}"]`).forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const section = page.sections.find(s => s.id === e.target.dataset.sectionId);
      if (section) {
        section.hideCheckboxes = e.target.checked;
        saveState();
        renderPrintablePages();
      }
    });
  });
  
  // Add chore buttons
  document.querySelectorAll(`.add-chore-btn[data-page-id="${pageId}"]`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sectionId = e.target.dataset.sectionId;
      const input = document.querySelector(`.chore-input[data-page-id="${pageId}"][data-section-id="${sectionId}"]`);
      if (input && input.value.trim()) {
        const section = page.sections.find(s => s.id === sectionId);
        if (section) {
          section.chores.push(input.value.trim());
          input.value = '';
          saveState();
          renderSectionChores(page, section);
          renderPrintablePages();
        }
      }
    });
  });
  
  // Chore input enter key
  document.querySelectorAll(`.chore-input[data-page-id="${pageId}"]`).forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        const sectionId = input.dataset.sectionId;
        const section = page.sections.find(s => s.id === sectionId);
        if (section) {
          section.chores.push(input.value.trim());
          input.value = '';
          saveState();
          renderSectionChores(page, section);
          renderPrintablePages();
        }
      }
    });
  });
  
  // Remove chore buttons
  document.querySelectorAll(`.remove-chore-btn[data-page-id="${pageId}"]`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling
      // Use currentTarget (the button) instead of target (might be a child element)
      const button = e.currentTarget;
      const sectionId = button.dataset.sectionId;
      const index = parseInt(button.dataset.index);
      const section = page.sections.find(s => s.id === sectionId);
      if (section) {
        section.chores.splice(index, 1);
        saveState();
        renderSectionChores(page, section);
        renderPrintablePages();
        // Reattach event listeners after DOM is recreated
        attachSectionEventListeners(page);
      }
    });
  });
  
  // Edit chore buttons
  document.querySelectorAll(`.edit-chore-btn[data-page-id="${pageId}"]`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling
      // Use currentTarget (the button) instead of target (might be a child element)
      const button = e.currentTarget;
      const sectionId = button.dataset.sectionId;
      const index = parseInt(button.dataset.index);
      const section = page.sections.find(s => s.id === sectionId);
      if (!section) return;
      
      const li = button.closest('li');
      const choreText = li.querySelector('.chore-text');
      const currentText = section.chores[index];
      
      choreText.innerHTML = `
        <input type="text" class="edit-chore-input" value="${currentText}">
        <div class="edit-controls">
          <button class="save-edit-btn">✓</button>
          <button class="cancel-edit-btn">✕</button>
        </div>
      `;
      
      const editInput = choreText.querySelector('.edit-chore-input');
      editInput.focus();
      editInput.select();
      
      const saveEdit = () => {
        const newText = editInput.value.trim();
        if (newText) {
          section.chores[index] = newText;
          saveState();
        }
        renderSectionChores(page, section);
        renderPrintablePages();
        // Reattach event listeners after DOM is recreated
        attachSectionEventListeners(page);
      };
      
      choreText.querySelector('.save-edit-btn').addEventListener('click', saveEdit);
      choreText.querySelector('.cancel-edit-btn').addEventListener('click', () => {
        renderSectionChores(page, section);
        // Reattach event listeners after DOM is recreated
        attachSectionEventListeners(page);
      });
      editInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveEdit();
      });
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          renderSectionChores(page, section);
          // Reattach event listeners after DOM is recreated
          attachSectionEventListeners(page);
        }
      });
    });
  });
}

// Month picker state and functions (defined globally for accessibility)
let monthPickerElements = null;
let currentPickerYear = new Date().getFullYear();
let currentPickerMonth = new Date().getMonth() + 1;

function updateMonthPickerDisplay() {
  if (!monthPickerElements) return;
  const { monthDisplay } = monthPickerElements;
  
  if (state.pages.length > 0) {
    const [year, month] = state.pages[0].month.split('-').map(Number);
    currentPickerYear = year;
    currentPickerMonth = month;
    
    const date = new Date(year, month - 1, 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    monthDisplay.textContent = `${monthName} ${year}`;
  }
}

function renderAll() {
  renderPrintablePages();
  renderPageHint();
  renderPageCards();
  updateMonthPickerDisplay();
}

// ========================================
// Zoom Function
// ========================================

function applyZoom(value) {
  const scale = value / 100;
  const pageStack = document.querySelector('.page-stack');
  const container = document.getElementById('checklist-container');
  const zoomLevel = document.getElementById('zoom-level');
  const zoomSlider = document.getElementById('zoom-slider');
  
  if (pageStack) {
    if (state.multiPageView && state.pages.length > 1) {
      // In multi-page view, use CSS zoom for uniform scaling that affects layout
      // Zoom scales everything uniformly (fonts, borders, padding, dimensions) and affects flexbox wrapping
      const pages = pageStack.querySelectorAll('.checklist-page');
      
      pages.forEach(page => {
        // Use CSS zoom for uniform scaling - affects both visual and layout
        // Zoom scales everything uniformly: fonts, borders, padding, dimensions
        page.style.zoom = scale;
        page.style.webkitTransform = 'scale(1)'; // Ensure transform doesn't interfere
        page.style.transform = 'none';
        page.style.transformOrigin = 'top left';
        // Reset width/height to let zoom handle scaling
        page.style.width = '';
        page.style.height = '';
        page.style.minHeight = '';
        // Reset flex properties
        page.style.flexBasis = '';
        page.style.flexShrink = '';
        page.style.flexGrow = '';
      });
      // Reset gap to default (zoom handles scaling)
      pageStack.style.gap = '';
      pageStack.style.transform = 'none';
      
      // Only allow horizontal scroll when zoomed in enough that only one column fits
      // With zoom, the actual rendered size is scaled
      const basePageWidth = 8.5 * 96; // 8.5in in pixels
      const scaledWidth = basePageWidth * scale;
      const containerWidth = container ? container.clientWidth : window.innerWidth;
      const gap = 24 * scale; // Gap also scales with zoom
      const minWidthForTwoPages = (scaledWidth * 2) + gap;
      
      if (containerWidth < minWidthForTwoPages && state.pages.length > 1) {
        if (container) container.style.overflowX = 'auto';
      } else {
        if (container) container.style.overflowX = 'hidden';
      }
    } else {
      // In single-page view, scale from top center
      pageStack.style.transform = `scale(${scale})`;
      pageStack.style.transformOrigin = 'top center';
      // Reset gap
      pageStack.style.gap = '';
      // Reset individual page styles
      const pages = pageStack.querySelectorAll('.checklist-page');
      pages.forEach(page => {
        page.style.width = '';
        page.style.height = '';
        page.style.minHeight = '';
        page.style.transform = '';
        page.style.flexBasis = '';
        page.style.flexShrink = '';
        page.style.flexGrow = '';
        page.style.zoom = '';
      });
      if (container) {
        container.style.overflowX = 'hidden';
      }
    }
  }
  if (zoomLevel) zoomLevel.textContent = `${value}%`;
  if (zoomSlider) zoomSlider.value = value;
}

// ========================================
// Global Event Handlers
// ========================================

function setupEventListeners() {
  // Week start day picker
  const weekStartDaySelect = document.getElementById('week-start-day');
  weekStartDaySelect.value = state.weekStartDay;
  weekStartDaySelect.addEventListener('change', (e) => {
    state.weekStartDay = parseInt(e.target.value);
    saveState();
    renderAll();
  });

  // Month range picker
  const monthRangeSelect = document.getElementById('month-range');
  monthRangeSelect.addEventListener('change', (e) => {
    const range = e.target.value;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    
    let startYear, startMonth, endYear, endMonth;
    
    switch (range) {
      case 'this-month':
        startYear = currentYear;
        startMonth = currentMonth;
        endYear = currentYear;
        endMonth = currentMonth;
        break;
      case 'rest-of-year':
        startYear = currentYear;
        startMonth = currentMonth;
        endYear = currentYear;
        endMonth = 11; // December
        break;
      case 'next-year':
        startYear = currentYear + 1;
        startMonth = 0; // January
        endYear = currentYear + 1;
        endMonth = 11; // December
        break;
      case 'through-next':
        startYear = currentYear;
        startMonth = currentMonth;
        endYear = currentYear + 1;
        endMonth = 11; // December
        break;
      default:
        return;
    }
    
    // Generate pages for the range
    const newPages = [];
    let year = startYear;
    let month = startMonth;
    let pageNum = 1;
    
    while (year < endYear || (year === endYear && month <= endMonth)) {
      const monthStr = year + '-' + String(month + 1).padStart(2, '0');
      newPages.push({
        id: `page-${pageNum}`,
        title: 'Home Checklist',
        month: monthStr,
        baseSize: Math.max(6, state.pages[0]?.baseSize || 10),
        scaleRatio: state.pages[0]?.scaleRatio || 1.250,
        sections: JSON.parse(JSON.stringify(state.pages[0]?.sections || DEFAULT_SECTIONS))
      });
      
      pageNum++;
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }
    
    state.pages = newPages;
    pageIdCounter = pageNum;
    
    // Update month picker display
    updateMonthPickerDisplay();
    
    saveState();
    renderAll();
  });

  // Custom Month Picker
  monthPickerElements = {
    trigger: document.getElementById('month-select-trigger'),
    popup: document.getElementById('month-picker-popup'),
    monthDisplay: document.getElementById('month-display'),
    monthPickerYear: document.getElementById('month-picker-year'),
    monthPickerGrid: document.getElementById('month-picker-grid'),
    yearPrevBtn: document.getElementById('year-prev'),
    yearNextBtn: document.getElementById('year-next')
  };
  
  const { trigger, popup, monthDisplay, monthPickerYear, monthPickerGrid, yearPrevBtn, yearNextBtn } = monthPickerElements;
  
  // Render month grid
  function renderMonthGrid() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthPickerYear.textContent = currentPickerYear;
    
    // Get current selected month from state
    let selectedYear = currentPickerYear;
    let selectedMonth = currentPickerMonth;
    if (state.pages.length > 0) {
      const [year, month] = state.pages[0].month.split('-').map(Number);
      selectedYear = year;
      selectedMonth = month;
    }
    
    monthPickerGrid.innerHTML = '';
    months.forEach((monthName, index) => {
      const monthBtn = document.createElement('button');
      monthBtn.type = 'button';
      monthBtn.className = 'month-picker-month';
      monthBtn.textContent = monthName;
      if (currentPickerYear === selectedYear && (index + 1) === selectedMonth) {
        monthBtn.classList.add('selected');
      }
      
      monthBtn.addEventListener('click', () => {
        const selectedMonth = index + 1;
        
        // Update all pages
        state.pages.forEach((page, idx) => {
          const targetDate = new Date(currentPickerYear, selectedMonth - 1 + idx, 1);
          page.month = targetDate.getFullYear() + '-' + String(targetDate.getMonth() + 1).padStart(2, '0');
        });
        
        currentPickerMonth = selectedMonth;
        updateMonthPickerDisplay();
        popup.style.display = 'none';
        trigger.classList.remove('open');
        saveState();
        renderAll();
      });
      
      monthPickerGrid.appendChild(monthBtn);
    });
  }
  
  // Toggle popup
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = popup.style.display !== 'none';
    if (isOpen) {
      popup.style.display = 'none';
      trigger.classList.remove('open');
    } else {
      // Sync picker year with current selection
      if (state.pages.length > 0) {
        const [year] = state.pages[0].month.split('-').map(Number);
        currentPickerYear = year;
      }
      renderMonthGrid();
      popup.style.display = 'block';
      trigger.classList.add('open');
    }
  });
  
  // Year navigation
  yearPrevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentPickerYear--;
    renderMonthGrid();
  });
  
  yearNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentPickerYear++;
    renderMonthGrid();
  });
  
  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !popup.contains(e.target)) {
      popup.style.display = 'none';
      trigger.classList.remove('open');
    }
  });
  
  // Initialize display
  updateMonthPickerDisplay();

  // Share button
  document.getElementById('share-btn').addEventListener('click', copyShareLink);
  
  // Copy Markdown button
  document.getElementById('copy-md-btn').addEventListener('click', copyMarkdown);

  // Print button
  document.getElementById('print-btn').addEventListener('click', () => {
    window.print();
  });

  // Reset button
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset everything to defaults?')) {
      state.weekStartDay = 1;
      state.pages = [createDefaultPage('page-1', 0)];
      pageIdCounter = 2;
      sectionIdCounter = 2;
      weekStartDaySelect.value = state.weekStartDay;
      updateMonthPickerDisplay();
      saveState();
      renderAll();
    }
  });

  // Zoom controls
  const zoomSlider = document.getElementById('zoom-slider');
  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');

  zoomSlider.addEventListener('input', (e) => {
    applyZoom(parseInt(e.target.value));
  });

  zoomIn.addEventListener('click', () => {
    const current = parseInt(zoomSlider.value);
    const newValue = Math.min(current + 10, 150);
    applyZoom(newValue);
  });

  zoomOut.addEventListener('click', () => {
    const current = parseInt(zoomSlider.value);
    const newValue = Math.max(current - 10, 25);
    applyZoom(newValue);
  });
  
  // Multi-page view toggle
  const multiPageToggle = document.getElementById('multi-page-toggle');
  if (multiPageToggle) {
    // Initialize toggle state
    multiPageToggle.checked = state.multiPageView;
    
    multiPageToggle.addEventListener('change', (e) => {
      state.multiPageView = e.target.checked;
      saveState();
      renderPrintablePages();
      // Set appropriate zoom when switching views (use setTimeout to ensure DOM is ready)
      setTimeout(() => {
        if (state.multiPageView) {
          // Multi-page view: zoom out to fit more pages
          applyZoom(50);
        } else {
          // Single-page view: reset to 100%
          applyZoom(100);
        }
      }, 0);
    });
    
    // Reapply zoom on window resize to update overflow behavior
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (state.multiPageView && state.pages.length > 1) {
          const currentZoom = parseInt(zoomSlider.value);
          applyZoom(currentZoom);
        }
      }, 150);
    });
  }
}

// ========================================
// Initialize
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderAll();
  setupEventListeners();
  // Initialize zoom state after everything is set up
  setTimeout(() => {
    const zoomSlider = document.getElementById('zoom-slider');
    if (zoomSlider) {
      applyZoom(parseInt(zoomSlider.value));
    }
  }, 0);
});
