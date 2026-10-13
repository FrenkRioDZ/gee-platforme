import { useState } from 'react';
import { Box, IconButton, Typography, Popover } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

const DAY_LABELS = ['Jeu', 'Ven', 'Sam', 'Dim', 'Lun', 'Mar', 'Mer'];

// Same Thu-Wed cycle logic as the backend's getWeekDeadline/getCycleStart —
// kept separate here since this runs client-side with no API round trip.
const getCycleStart = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat, Thu=4
  const diff = (day + 7 - 4) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const getWeekEndFromStart = (weekStart) => {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

function buildWeeks(viewMonth, viewYear) {
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);

  let rowStart = getCycleStart(firstOfMonth);
  const weeks = [];

  while (rowStart <= lastOfMonth) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(rowStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    weeks.push({ weekStart: rowStart, weekEnd: getWeekEndFromStart(rowStart), days });
    rowStart = new Date(rowStart);
    rowStart.setDate(rowStart.getDate() + 7);
  }
  return weeks;
}

export default function WeekCalendarPicker({ anchorEl, open, onClose, selectedWeekEnd, onSelect }) {
  const today = new Date();
  const initial = selectedWeekEnd ? new Date(selectedWeekEnd) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const weeks = buildWeeks(viewMonth, viewYear);
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

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {DAY_LABELS.map(d => (
            <Typography key={d} align="center" fontSize="0.68rem" color="text.secondary" fontWeight={600}>
              {d}
            </Typography>
          ))}
        </Box>

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
          Chaque ligne représente un cycle Jeudi → Mercredi. Cliquez sur une ligne pour sélectionner cette semaine.
        </Typography>
      </Box>
    </Popover>
  );
}