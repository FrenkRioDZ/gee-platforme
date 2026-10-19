import { useState } from 'react';
import { Box, IconButton, Typography, Popover } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

import { getWeekDeadline, getWeekStart, nextWeekEnd } from '../../utils/week';

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// One row per reporting week overlapping the month. The transition week
// (Thu 22/10 → Tue 27/10/2026) has 6 days; its row is padded with an empty cell.
function buildWeeks(viewMonth, viewYear) {
  const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
  const weeks = [];

  for (let weekEnd = getWeekDeadline(new Date(viewYear, viewMonth, 1)); ; weekEnd = nextWeekEnd(weekEnd)) {
    const weekStart = getWeekStart(weekEnd);
    if (weekStart > lastOfMonth) break;
    const days = [];
    for (const d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    while (days.length < 7) days.push(null);
    weeks.push({ weekStart, weekEnd, days });
  }
  return weeks;
}

// Column headers only when every full week of the month starts on the same day
// (not in October 2026, which mixes Thu→Wed and Wed→Tue weeks)
const dayLabels = (weeks) => {
  const full = weeks.filter(w => w.days[6]);
  const starts = new Set(full.map(w => w.days[0].getDay()));
  return starts.size === 1 ? full[0].days.map(d => WEEKDAYS[d.getDay()]) : null;
};

export default function WeekCalendarPicker({ anchorEl, open, onClose, selectedWeekEnd, onSelect }) {
  const today = new Date();
  const initial = selectedWeekEnd ? new Date(selectedWeekEnd) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const weeks = buildWeeks(viewMonth, viewYear);
  const labels = dayLabels(weeks);
  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('fr-DZ', { month: 'long', year: 'numeric' });

  const goPrevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const isSelectedRow = (week) =>
    selectedWeekEnd && new Date(selectedWeekEnd).toDateString() === week.weekEnd.toDateString();

  const isTodayRow = (week) => today >= week.weekStart && today <= week.weekEnd;

  return (
    <Popover open={open} anchorEl={anchorEl} onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
      <Box sx={{ p: 2, width: 320 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <IconButton size="small" onClick={goPrevMonth}><ChevronLeft fontSize="small" /></IconButton>
          <Typography fontWeight={700} fontSize="0.875rem" color="primary.main" sx={{ textTransform: 'capitalize' }}>
            {monthLabel}
          </Typography>
          <IconButton size="small" onClick={goNextMonth}><ChevronRight fontSize="small" /></IconButton>
        </Box>

        {labels && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {labels.map(d => (
            <Typography key={d} align="center" fontSize="0.68rem" color="text.secondary" fontWeight={600}>
              {d}
            </Typography>
          ))}
        </Box>}

        {weeks.map((week, wi) => {
          const selected = isSelectedRow(week);
          const isCurrent = isTodayRow(week);
          return (
            <Box
              key={wi}
              onClick={() => { onSelect(week.weekEnd); onClose(); }}
              sx={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                borderRadius: 1.5, cursor: 'pointer', mb: 0.3, py: 0.4,
                background: selected ? 'linear-gradient(135deg, #0D3B6E, #1565C0)'
                  : isCurrent ? 'rgba(13,59,110,0.08)' : 'transparent',
                '&:hover': {
                  background: selected
                    ? 'linear-gradient(135deg, #0D3B6E, #1565C0)'
                    : 'rgba(13,59,110,0.12)'
                }
              }}
            >
              {week.days.map((d, di) => {
                if (!d) return <span key={di} />;
                const inMonth = d.getMonth() === viewMonth;
                return (
                  <Typography key={di} align="center" fontSize="0.78rem"
                    fontWeight={selected ? 700 : 500}
                    sx={{ color: selected ? '#fff' : inMonth ? 'text.primary' : 'text.disabled' }}>
                    {d.getDate()}
                  </Typography>
                );
              })}
            </Box>
          );
        })}

        <Typography fontSize="0.68rem" color="text.secondary" sx={{ mt: 1 }}>
          Chaque ligne représente une semaine de rapport, du lendemain d'une date limite à la suivante (mardi 23:59 depuis le 27/10/2026). Cliquez sur une ligne pour la sélectionner.
        </Typography>
      </Box>
    </Popover>
  );
}