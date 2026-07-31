'use client';

const pageStyles = `
/* Grid defaults (desktop) */
.cal-period-grid   { grid-template-columns: repeat(4, 1fr); }
.cal-important-grid { grid-template-columns: repeat(4, 1fr); }

/* Tablet: 2-col months + 2-col periods + 2-col important dates */
@media (max-width: 900px) {
    .cal-period-grid    { grid-template-columns: 1fr 1fr; }
    #calendarMonths     { grid-template-columns: 1fr 1fr !important; }
    .cal-important-grid { grid-template-columns: 1fr 1fr; }
}

/* Mobile: everything single column */
@media (max-width: 540px) {
    .cal-period-grid    { grid-template-columns: 1fr; }
    #calendarMonths     { grid-template-columns: 1fr !important; }
    .cal-important-grid { grid-template-columns: 1fr; }
    .page-header h1     { font-size: 1.3rem; }
}
`;

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const months = [
  { y: 2026, m: 5 }, { y: 2026, m: 6 }, { y: 2026, m: 7 }, { y: 2026, m: 8 },
  { y: 2026, m: 9 }, { y: 2026, m: 10 }, { y: 2026, m: 11 }, { y: 2027, m: 0 },
  { y: 2027, m: 1 }, { y: 2027, m: 2 }, { y: 2027, m: 3 }, { y: 2027, m: 4 },
];

const highlights = {
  // Summer Camp: June 22 – Aug 14, 2026 (weekdays only)
  '2026-6-22': 'cal-summer', '2026-6-23': 'cal-summer', '2026-6-24': 'cal-summer',
  '2026-6-25': 'cal-summer', '2026-6-26': 'cal-summer',
  '2026-6-29': 'cal-summer', '2026-6-30': 'cal-summer',
  '2026-7-1': 'cal-summer', '2026-7-2': 'cal-summer', '2026-7-3': 'cal-summer',
  '2026-7-6': 'cal-summer', '2026-7-7': 'cal-summer', '2026-7-8': 'cal-summer',
  '2026-7-9': 'cal-summer', '2026-7-10': 'cal-summer',
  '2026-7-13': 'cal-summer', '2026-7-14': 'cal-summer', '2026-7-15': 'cal-summer',
  '2026-7-16': 'cal-summer', '2026-7-17': 'cal-summer',
  '2026-7-20': 'cal-summer', '2026-7-21': 'cal-summer', '2026-7-22': 'cal-summer',
  '2026-7-23': 'cal-summer', '2026-7-24': 'cal-summer',
  '2026-7-27': 'cal-summer', '2026-7-28': 'cal-summer', '2026-7-29': 'cal-summer',
  '2026-7-30': 'cal-summer', '2026-7-31': 'cal-summer',
  '2026-8-3': 'cal-summer', '2026-8-4': 'cal-summer', '2026-8-5': 'cal-summer',
  '2026-8-6': 'cal-summer', '2026-8-7': 'cal-summer',
  '2026-8-10': 'cal-summer', '2026-8-11': 'cal-summer', '2026-8-12': 'cal-summer',
  '2026-8-13': 'cal-summer', '2026-8-14': 'cal-summer',
  // No School: Aug 24 – Sept 6, 2026 (Summer Break)
  '2026-8-24': 'cal-noschool', '2026-8-25': 'cal-noschool', '2026-8-26': 'cal-noschool',
  '2026-8-27': 'cal-noschool', '2026-8-28': 'cal-noschool', '2026-8-29': 'cal-noschool',
  '2026-8-30': 'cal-noschool', '2026-8-31': 'cal-noschool',
  '2026-9-1': 'cal-noschool', '2026-9-2': 'cal-noschool', '2026-9-3': 'cal-noschool',
  '2026-9-4': 'cal-noschool', '2026-9-5': 'cal-noschool', '2026-9-6': 'cal-noschool',
  // No School: Dec 14 – Jan 3 (Winter Break)
  '2026-12-14': 'cal-noschool', '2026-12-15': 'cal-noschool', '2026-12-16': 'cal-noschool',
  '2026-12-17': 'cal-noschool', '2026-12-18': 'cal-noschool', '2026-12-19': 'cal-noschool',
  '2026-12-20': 'cal-noschool', '2026-12-21': 'cal-noschool', '2026-12-22': 'cal-noschool',
  '2026-12-23': 'cal-noschool', '2026-12-24': 'cal-noschool', '2026-12-25': 'cal-noschool',
  '2026-12-26': 'cal-noschool', '2026-12-27': 'cal-noschool', '2026-12-28': 'cal-noschool',
  '2026-12-29': 'cal-noschool', '2026-12-30': 'cal-noschool', '2026-12-31': 'cal-noschool',
  '2027-1-1': 'cal-noschool', '2027-1-2': 'cal-noschool', '2027-1-3': 'cal-noschool',
  // No School: Feb 15 – 21 (Mid-Winter Break)
  '2027-2-15': 'cal-noschool', '2027-2-16': 'cal-noschool', '2027-2-17': 'cal-noschool',
  '2027-2-18': 'cal-noschool', '2027-2-19': 'cal-noschool', '2027-2-20': 'cal-noschool',
  '2027-2-21': 'cal-noschool',
  // No School: Apr 12 – 18 (Spring Break)
  '2027-4-12': 'cal-noschool', '2027-4-13': 'cal-noschool', '2027-4-14': 'cal-noschool',
  '2027-4-15': 'cal-noschool', '2027-4-16': 'cal-noschool', '2027-4-17': 'cal-noschool',
  '2027-4-18': 'cal-noschool',
};

const quarterColor = {
  5: '#c9a96e', 6: '#c9a96e', 7: '#c9a96e',
  8: '#e8a87c', 9: '#e8a87c', 10: '#e8a87c',
  11: '#7ab3d4', 0: '#7ab3d4', 1: '#7ab3d4',
  2: '#7cbf8e', 3: '#7cbf8e', 4: '#7cbf8e',
};

function MonthGrid({ y, m }) {
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const headerColor = quarterColor[m];

  const rows = [];
  let day = 1;
  for (let row = 0; row < 6; row++) {
    const cells = [];
    for (let col = 0; col < 7; col++) {
      const idx = row * 7 + col;
      if (idx < firstDay || day > daysInMonth) {
        cells.push(<td key={col}></td>);
      } else {
        const key = `${y}-${m + 1}-${day}`;
        const hl = highlights[key];
        const style = { textAlign: 'center', padding: '4px 0' };
        if (hl === 'cal-noschool') {
          style.background = '#e88080';
          style.color = '#fff';
          style.fontWeight = 600;
        } else if (hl === 'cal-summer') {
          style.background = '#f7c948';
          style.color = '#6b5b47';
          style.fontWeight = 600;
        }
        cells.push(<td key={col} style={style}>{day}</td>);
        day++;
      }
    }
    rows.push(<tr key={row}>{cells}</tr>);
    if (day > daysInMonth) break;
  }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ background: headerColor, color: '#fff', textAlign: 'center', padding: '0.55rem', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.01em' }}>
        {monthNames[m]} {y}
      </div>
      <div style={{ background: '#fff', padding: '0.6rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr>
              {dayLabels.map((d) => (
                <th key={d} style={{ textAlign: 'center', color: '#aaa', fontWeight: 600, padding: '2px 0' }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function CalendarClient() {
  return (
    <main>
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
      <div className="container">
        <div className="page-header">
          <h1>📅 2026–27 Academic Calendar</h1>
          <p style={{ textAlign: 'left' }}>View Dotori School&apos;s full academic year at a glance. Session dates, no-school days, and summer camp periods are all color-coded for easy reference.</p>
        </div>

        {/* Course Periods */}
        <div className="cal-period-grid" style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#c9a96e22', borderLeft: '4px solid #c9a96e', borderRadius: 8, padding: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: '#6b5b47', marginBottom: '0.2rem' }}>Summer Quarter</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Jun 22 – Aug 14, 2026</div>
          </div>
          <div style={{ background: '#e8a87c22', borderLeft: '4px solid #e8a87c', borderRadius: 8, padding: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: '#6b5b47', marginBottom: '0.2rem' }}>Fall Quarter</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Sept 21 – Dec 13, 2026</div>
          </div>
          <div style={{ background: '#7ab3d422', borderLeft: '4px solid #7ab3d4', borderRadius: 8, padding: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: '#6b5b47', marginBottom: '0.2rem' }}>Winter Quarter</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Jan 4 – Mar 31, 2027</div>
          </div>
          <div style={{ background: '#7cbf8e22', borderLeft: '4px solid #7cbf8e', borderRadius: 8, padding: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: '#6b5b47', marginBottom: '0.2rem' }}>Spring Quarter</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Apr 5 – Jul 4, 2027</div>
          </div>
        </div>

        {/* Color Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem 1.8rem', marginBottom: '2rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span style={{ width: 16, height: 16, background: '#c9a96e', borderRadius: 4, display: 'inline-block', flexShrink: 0 }}></span> Summer Quarter
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span style={{ width: 16, height: 16, background: '#e8a87c', borderRadius: 4, display: 'inline-block', flexShrink: 0 }}></span> Fall Quarter
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span style={{ width: 16, height: 16, background: '#7ab3d4', borderRadius: 4, display: 'inline-block', flexShrink: 0 }}></span> Winter Quarter
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span style={{ width: 16, height: 16, background: '#7cbf8e', borderRadius: 4, display: 'inline-block', flexShrink: 0 }}></span> Spring Quarter
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span style={{ width: 16, height: 16, background: '#e88080', borderRadius: 4, display: 'inline-block', flexShrink: 0 }}></span> No School / Break
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span style={{ width: 16, height: 16, background: '#f7c948', borderRadius: 4, display: 'inline-block', flexShrink: 0 }}></span> Summer Camp
          </span>
        </div>

        {/* Monthly calendar grids */}
        <div id="calendarMonths" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.2rem', marginBottom: '2.5rem' }}>
          {months.map(({ y, m }) => (
            <MonthGrid key={`${y}-${m}`} y={y} m={m} />
          ))}
        </div>

        {/* Download */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <a href="/assets/pdf/dotori_calendar_2026-27.pdf" className="btn btn-primary" download style={{ display: 'inline-block', padding: '0.8rem 2.5rem', fontSize: '1rem' }}>
            ⬇ Download Full Calendar (PDF)
          </a>
        </div>

        {/* Important Dates */}
        <div style={{ border: '1px solid #e0dbd4', borderRadius: 12, padding: '1.5rem', marginBottom: '3rem' }}>
          <h3 style={{ color: '#6b5b47', margin: '0 0 1.2rem 0', fontSize: '1.05rem', letterSpacing: '0.01em' }}>Important Dates</h3>
          <div className="cal-important-grid" style={{ display: 'grid', gap: '1.5rem' }}>
            <div>
              <div style={{ color: '#8a6d3b', fontWeight: 700, marginBottom: '0.6rem', borderBottom: '2px solid #c9a96e', paddingBottom: '0.3rem', fontSize: '0.95rem' }}>Summer Quarter</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.83rem', lineHeight: 2 }}>
                <li><strong>Jun. 8–19</strong> 1:1 Private Lesson Registration</li>
                <li><strong>Jun. 22–Jul. 3</strong> Gr. 2–3 Summer Camp</li>
                <li><strong>Jul. 6–17</strong> Gr. K–1 Summer Camp</li>
                <li><strong>Jul. 20–31</strong> Gr. 4–5 Summer Camp</li>
                <li><strong>Aug. 3–14</strong> Gr. 4–5 Summer Camp</li>
                <li><strong>Aug. 24–Sept. 6</strong> Summer Break (No School)</li>
              </ul>
            </div>
            <div>
              <div style={{ color: '#b85e1a', fontWeight: 700, marginBottom: '0.6rem', borderBottom: '2px solid #e8a87c', paddingBottom: '0.3rem', fontSize: '0.95rem' }}>Fall Quarter</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.83rem', lineHeight: 2 }}>
                <li><strong>Sept. 7–18</strong> Fall Quarter Registration</li>
                <li><strong>Sept. 21–Dec. 13</strong> Fall Quarter (12 weeks)</li>
              </ul>
            </div>
            <div>
              <div style={{ color: '#1a6090', fontWeight: 700, marginBottom: '0.6rem', borderBottom: '2px solid #7ab3d4', paddingBottom: '0.3rem', fontSize: '0.95rem' }}>Winter Quarter</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.83rem', lineHeight: 2 }}>
                <li><strong>Dec. 14–Jan. 3</strong> Winter Quarter Registration</li>
                <li><strong>Dec. 14–Jan. 3</strong> Winter Break (No School)</li>
                <li><strong>Jan. 4–Mar. 31</strong> Winter Quarter (12 weeks)</li>
                <li><strong>Feb. 15–21</strong> Mid-Winter Break (No School)</li>
              </ul>
            </div>
            <div>
              <div style={{ color: '#1e7a40', fontWeight: 700, marginBottom: '0.6rem', borderBottom: '2px solid #7cbf8e', paddingBottom: '0.3rem', fontSize: '0.95rem' }}>Spring Quarter</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.83rem', lineHeight: 2 }}>
                <li><strong>Mar. 22–Apr. 4</strong> Spring Quarter Registration</li>
                <li><strong>Apr. 5–Jul. 4</strong> Spring Quarter (12 weeks)</li>
                <li><strong>Apr. 12–18</strong> Spring Break (No School)</li>
              </ul>
            </div>
          </div>
          <p style={{ textAlign: 'right', color: '#aaa', fontSize: '0.75rem', margin: '1rem 0 0' }}>* Calendar is subject to change. &nbsp;Updated 06/2026</p>
        </div>
      </div>
    </main>
  );
}
